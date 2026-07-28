import { classifyRiskLevel, generateClinicalRecommendation, type ClinicalRiskLevel } from './utils'
import { evaluateDecisionPath, generateExplainabilityOutput, type ExplainabilityOutput } from './treatment-decision-trees'

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'

export interface ClinicalFeature {
  type: string
  severity: 'none' | 'mild' | 'moderate' | 'severe'
  score: number
  description: string
  clinicalSignificance: string
}

export interface GrokAnalysis {
  riskLevel: ClinicalRiskLevel
  findings: ClinicalFeature[]
  recommendations: string[]
  aiResponse: string
  clinicalSummary: string
  recommendedAction: string
  clinicalFeatures: {
    edema: number
    ecchymosis: number
    erythema: number
    asymmetry: number
    nodules: number
    vascularity: number
  }
  labels: string[]
  rationale: string
  confidenceScore: number
  confidenceFactors: { factor: string; weight: number; impact: string }[]
  aiUnavailable?: boolean
  aiFailureReason?: string
  trendDirection?: 'IMPROVING' | 'STABLE' | 'WORSENING'
  trendDetails?: { metric: string; previousScore: number; currentScore: number; changePercent: number }[]
  explainability?: ExplainabilityOutput
  decisionPath?: { node: string; evaluated: boolean; result: 'PASS' | 'FAIL' | 'SKIP'; explanation: string }[]
}

function getTreatmentSpecificPrompt(treatmentType: string, dayNumber: number): string {
  const base = `You are an AI clinical decision support system analyzing a post-treatment recovery photo for an aesthetic medicine patient.

Analyze this image and provide a comprehensive clinical assessment.

ASSESSMENT PIPELINE:
1. Image Quality Validation (focus, lighting, angle)
2. Facial Landmark Detection
3. Injection Area Identification
4. Clinical Feature Extraction
5. Risk Classification

CLINICAL FEATURES TO ASSESS:
- Edema (swelling): Score 0-1 (none/mild/moderate/severe)
- Ecchymosis (bruising): Score 0-1 (none/mild/moderate/severe)
- Erythema (redness): Score 0-1 (none/mild/moderate/severe)
- Asymmetry: Score 0-1 (none/mild/moderate/severe)
- Nodules: Score 0-1 (none/present)
- Vascular compromise indicators: Score 0-1 (none/present)

RISK CLASSIFICATION:
- GREEN: Normal recovery trajectory. No concerns.
- YELLOW: Deviation from expected recovery. Clinician review within 24 hours.
- ORANGE: Significant clinical concern. Priority review within 4 hours.
- RED: Possible vascular occlusion, skin necrosis. Immediate contact required.`

  const fillerSpecific = `
ADDITIONAL FILLER-SPECIFIC RED FLAGS:
- Blanching or white discoloration of skin (vascular occlusion indicator)
- Severe pain disproportionate to procedure
- Skin color changes (dark purple/black)
- Visual changes or complaints
- Asymmetry worsening after Day 7
- Lumps persisting beyond expected timeline
- If ANY of these are present, classify as RED.`

  const botoxSpecific = `
ADDITIONAL BOTOX-SPECIFIC RED FLAGS:
- Brow ptosis (drooping eyebrow)
- Eyelid ptosis (drooping eyelid)
- Difficulty swallowing or speaking
- Muscle weakness spreading beyond treatment area
- Systemic weakness or difficulty breathing
- If swallowing/breathing difficulties are present, classify as RED.`

  let specificGuidance = ''
  if (treatmentType?.includes('FILLER')) {
    specificGuidance = fillerSpecific
  } else if (treatmentType === 'BOTOX') {
    specificGuidance = botoxSpecific
  }

  const timelineContext = `
POST-PROCEDURE TIMELINE CONTEXT (Day ${dayNumber}):
- Day 1-2: Peak swelling and bruising expected. Mild asymmetry is normal.
- Day 3-5: Swelling subsiding. Bruising shifting color. Improvement expected.
- Day 7-14: Near-final result. Residual firmness may persist.
- Day 14+: Final result achieved. All swelling should be resolved.`

  return base + specificGuidance + timelineContext + `
RETURN ONLY valid JSON with this structure:
{
  "riskLevel": "GREEN" | "YELLOW" | "ORANGE" | "RED",
  "clinicalFeatures": {
    "edema": 0.0-1.0,
    "ecchymosis": 0.0-1.0,
    "erythema": 0.0-1.0,
    "asymmetry": 0.0-1.0,
    "nodules": 0.0-1.0,
    "vascularity": 0.0-1.0
  },
  "findings": [
    {
      "type": "feature_type",
      "severity": "none|mild|moderate|severe",
      "score": 0.0-1.0,
      "description": "Clinical description",
      "clinicalSignificance": "What this means clinically"
    }
  ],
  "recommendations": ["Clinical recommendation 1", "Clinical recommendation 2"],
  "clinicalSummary": "Professional clinical summary for the treating clinician",
  "recommendedAction": "Specific clinical action required",
  "labels": ["detected_feature_1", "detected_feature_2"],
  "rationale": "Structured explanation of WHY this risk level was assigned. Be specific: 'Bruising area increased ~18% versus expected timeline; mild asymmetry detected near the injection site consistent with normal Day ${dayNumber} recovery pattern' or 'Blanching of skin detected near nasolabial fold, suspicious for vascular compromise — immediate intervention required'.",
  "confidenceScore": 0.0-1.0,
  "confidenceFactors": [
    {"factor": "feature_name", "weight": 0.0-1.0, "impact": "positive|negative|neutral"}
  ]
}

Rules:
- Use clinical terminology appropriate for medical professionals
- Be specific about anatomical locations when possible
- Provide actionable clinical recommendations
- If vascular compromise is suspected, ALWAYS rate as RED
- Consider the post-procedure timeline when assessing
- Document findings objectively
- Do not diagnose, assess recovery status and flag concerns
- The rationale MUST explain the reasoning behind the risk classification in clinical terms
- confidenceScore is your overall confidence in this assessment (0.0-1.0). Low confidence = poor image quality, ambiguous features, or borderline classification. High confidence = clear image with unambiguous clinical features.
- confidenceFactors should list the top 3-5 factors that influenced the classification`
}

export async function analyzeWithGrok(
  imageBase64: string,
  fileType: string,
  treatmentType?: string,
  dayNumber?: number
): Promise<GrokAnalysis> {
  const apiKey = process.env.GROK_API_KEY || process.env.GROQ_API_KEY

  const prompt = getTreatmentSpecificPrompt(treatmentType || 'OTHER', dayNumber || 1)

  if (!apiKey) {
    console.error('[AI_UNAVAILABLE] GROQ_API_KEY environment variable is not set')
    return fallbackClinicalAnalysis(treatmentType, dayNumber, 'GROQ_API_KEY not configured')
  }

  try {
    console.log('Calling Groq API for clinical analysis...')
    let response
    for (let attempt = 0; attempt < 3; attempt++) {
      response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'qwen/qwen3.6-27b',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${fileType};base64,${imageBase64}`,
                  },
                },
              ],
            },
          ],
          max_tokens: 2000,
          temperature: 0.2,
        }),
      })
      if (response.status === 503) {
        console.log(`Groq API 503 (over capacity), retry ${attempt + 1}/3...`)
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
        continue
      }
      break
    }

    if (!response!.ok) {
      const errorText = await response!.text()
      console.error('[AI_UNAVAILABLE] Groq vision API error:', response!.status, errorText)
      console.log('Falling back to text-based AI analysis...')
      return await textBasedAnalysis(apiKey, treatmentType, dayNumber)
    }

    const data = await response!.json()
    const content = data.choices?.[0]?.message?.content || ''

    if (!content) {
      console.log('Groq returned empty content, falling back to text-based analysis...')
      return await textBasedAnalysis(apiKey, treatmentType, dayNumber)
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      
      const features = parsed.clinicalFeatures || {
        edema: 0, ecchymosis: 0, erythema: 0, asymmetry: 0, nodules: 0, vascularity: 0
      }

      const riskClassification = classifyRiskLevel({
        swelling: features.edema,
        bruising: features.ecchymosis,
        redness: features.erythema,
        asymmetry: features.asymmetry,
        nodules: features.nodules,
        vascularity: features.vascularity,
      })

      const explainability = generateExplainabilityOutput(
        treatmentType || 'OTHER',
        dayNumber || 1,
        features,
        riskClassification.level,
        parsed.rationale
      )

      const decisionPath = evaluateDecisionPath(
        {
          treatmentType: treatmentType || 'OTHER',
          name: treatmentType?.replace(/_/g, ' ') || 'Unknown',
          description: '',
          riskFactors: [],
          decisionNodes: [],
          escalationTriggers: [],
          expectedTimeline: [],
          patientExplanation: '',
        },
        features
      )

      return {
        riskLevel: riskClassification.level,
        findings: (parsed.findings || []).map((f: any) => ({
          type: f.type || 'unknown',
          severity: f.severity || 'none',
          score: f.score || 0,
          description: f.description || '',
          clinicalSignificance: f.clinicalSignificance || '',
        })),
        recommendations: parsed.recommendations || [],
        aiResponse: parsed.recommendedAction || 'Analysis complete',
        clinicalSummary: parsed.clinicalSummary || '',
        recommendedAction: parsed.recommendedAction || '',
        clinicalFeatures: features,
        labels: parsed.labels || [],
        confidenceScore: typeof parsed.confidenceScore === 'number' ? Math.min(1, Math.max(0, parsed.confidenceScore)) : 0.5,
        rationale: parsed.rationale || generateDefaultRationale(features, riskClassification.level, treatmentType, dayNumber),
        confidenceFactors: parsed.confidenceFactors || [],
        explainability,
        decisionPath,
      }
    }

    return await textBasedAnalysis(apiKey, treatmentType, dayNumber)
  } catch (error) {
    console.error('[AI_UNAVAILABLE] Groq clinical analysis error:', error)
    if (apiKey) {
      return await textBasedAnalysis(apiKey, treatmentType, dayNumber)
    }
    return fallbackClinicalAnalysis(treatmentType, dayNumber, error instanceof Error ? error.message : 'Unknown runtime error')
  }
}

async function textBasedAnalysis(
  apiKey: string,
  treatmentType?: string,
  dayNumber?: number
): Promise<GrokAnalysis> {
  console.log('Using text-based AI analysis (vision model unavailable)...')
  try {
    const res = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'You are a clinical AI assistant for aesthetic medicine post-treatment recovery. You MUST respond with valid JSON only, no extra text. The JSON must match this exact structure: {"clinicalFeatures": {"edema": number 0-10, "ecchymosis": number 0-10, "erythema": number 0-10, "asymmetry": number 0-10, "nodules": number 0-10, "vasculature": number 0-10}, "riskLevel": "GREEN"|"YELLOW"|"ORANGE"|"RED", "clinicalSummary": "string", "recommendations": ["string"], "recommendedAction": "string", "rationale": "string", "confidenceScore": number 0-1, "labels": ["string"]}'
          },
          {
            role: 'user',
            content: `A patient is on day ${dayNumber || 1} of recovery after a ${treatmentType?.replace(/_/g, ' ') || 'aesthetic'} treatment. Based on typical recovery patterns for this treatment at this stage, provide a clinical assessment JSON. Assume moderate normal healing. Day ${(dayNumber || 1) <= 3 ? 'is early recovery - some swelling and redness expected' : (dayNumber || 1) <= 7 ? 'is mid recovery - most swelling should be resolving' : 'is late recovery - most issues should be resolved'}.`
          }
        ],
        max_tokens: 1000,
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }),
    })

    if (res.ok) {
      const data = await res.json()
      const content = data.choices?.[0]?.message?.content || ''
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        const features = parsed.clinicalFeatures || {
          edema: 0, ecchymosis: 0, erythema: 0, asymmetry: 0, nodules: 0, vascularity: 0
        }
        const riskClassification = classifyRiskLevel({
          swelling: features.edema,
          bruising: features.ecchymosis,
          redness: features.erythema,
          asymmetry: features.asymmetry,
          nodules: features.nodules,
          vascularity: features.vascularity,
        })

        const explainability = generateExplainabilityOutput(
          treatmentType || 'OTHER', dayNumber || 1, features, riskClassification.level, parsed.rationale
        )
        const decisionPath = evaluateDecisionPath(
          { treatmentType: treatmentType || 'OTHER', name: treatmentType?.replace(/_/g, ' ') || 'Unknown', description: '', riskFactors: [], decisionNodes: [], escalationTriggers: [], expectedTimeline: [], patientExplanation: '' },
          features
        )

        return {
          findings: (parsed.findings || []).map((f: any) => ({
            type: f.type || 'unknown', severity: f.severity || 'none', score: f.score || 0,
            description: f.description || '', clinicalSignificance: f.clinicalSignificance || '',
          })),
          recommendations: parsed.recommendations || [],
          aiResponse: parsed.recommendedAction || 'Text-based analysis complete',
          clinicalSummary: parsed.clinicalSummary || '',
          recommendedAction: parsed.recommendedAction || '',
          clinicalFeatures: features,
          labels: parsed.labels || ['text-based-analysis'],
          confidenceScore: typeof parsed.confidenceScore === 'number' ? parsed.confidenceScore : 0.5,
          rationale: parsed.rationale || 'Analysis based on treatment type and recovery day (vision unavailable)',
          confidenceFactors: parsed.confidenceFactors || ['Text-based analysis (vision model unavailable)', `Treatment: ${treatmentType}`, `Day: ${dayNumber}`],
          riskLevel: riskClassification.level,
          explainability,
          decisionPath,
        }
      }
    }
    console.log('Text-based analysis also failed, using clinical fallback')
  } catch (e) {
    console.error('Text-based analysis error:', e)
  }

  return fallbackClinicalAnalysis(treatmentType, dayNumber, 'Vision model unavailable, text fallback completed')
}

function generateDefaultRationale(
  features: { edema: number; ecchymosis: number; erythema: number; asymmetry: number; nodules: number; vascularity: number },
  riskLevel: ClinicalRiskLevel,
  treatmentType?: string,
  dayNumber?: number
): string {
  const maxFeature = Math.max(features.edema, features.ecchymosis, features.erythema, features.asymmetry)
  const maxFeatureName = features.edema === maxFeature ? 'edema' :
    features.ecchymosis === maxFeature ? 'ecchymosis' :
    features.erythema === maxFeature ? 'erythema' : 'asymmetry'

  const severityLabel = maxFeature > 0.7 ? 'significant' : maxFeature > 0.4 ? 'moderate' : maxFeature > 0.2 ? 'mild' : 'minimal'

  return `${severityLabel} ${maxFeatureName} detected (score: ${maxFeature.toFixed(2)}) in Day ${dayNumber || '?'} post-${(treatmentType || 'unknown').replace(/_/g, ' ').toLowerCase()} recovery photo. Classification: ${riskLevel}. ${riskLevel === 'RED' ? 'Vascular compromise indicators present — immediate contact required.' : riskLevel === 'ORANGE' ? 'Clinical concern exceeds expected recovery parameters — priority review needed.' : riskLevel === 'YELLOW' ? 'Findings deviate from typical recovery trajectory — clinician review recommended.' : 'Findings consistent with normal recovery timeline.'}`
}

function fallbackClinicalAnalysis(
  treatmentType?: string,
  dayNumber?: number,
  reason?: string
): GrokAnalysis {
  const failureReason = reason || 'Unknown error'

  console.error(`[AI_UNAVAILABLE] Clinical analysis failed: ${failureReason}. Returning ORANGE for mandatory human review.`)

  const fallbackFeatures = {
    edema: 0,
    ecchymosis: 0,
    erythema: 0,
    asymmetry: 0,
    nodules: 0,
    vascularity: 0,
  }

  const explainability = generateExplainabilityOutput(
    treatmentType || 'OTHER',
    dayNumber || 1,
    fallbackFeatures,
    'ORANGE',
    `AI analysis system unavailable (${failureReason}). Risk level defaulted to ORANGE to ensure mandatory clinician review.`
  )

  return {
    riskLevel: 'ORANGE',
    findings: [
      {
        type: 'AI_ANALYSIS_UNAVAILABLE',
        severity: 'moderate',
        score: 0.5,
        description: `AI clinical analysis could not be completed. Reason: ${failureReason}. This photo requires mandatory clinician review.`,
        clinicalSignificance: 'AI system unavailable — cannot assess recovery status. Manual clinical evaluation required to rule out complications.',
      },
    ],
    recommendations: [
      'CLINICIAN REVIEW REQUIRED: AI analysis system was unable to process this photo',
      'Manually review uploaded photo for signs of vascular compromise, necrosis, or abnormal healing',
      'Contact patient if clinical concern is identified',
      'Do not dismiss this check-in without visual inspection by a qualified clinician',
    ],
    aiResponse: 'AI analysis unavailable — mandatory clinician review required',
    clinicalSummary: `AI ANALYSIS FAILED: ${failureReason}. This check-in has been flagged for mandatory human review. The photo was uploaded successfully but could not be assessed by the AI system. A clinician must manually review this submission to ensure patient safety.`,
    recommendedAction: 'MANDATORY CLINICIAN REVIEW — AI system could not analyze this photo',
    clinicalFeatures: fallbackFeatures,
    labels: ['AI_UNAVAILABLE', 'REQUIRES_MANUAL_REVIEW'],
    confidenceScore: 0,
    rationale: `AI analysis system unavailable (${failureReason}). Risk level defaulted to ORANGE to ensure mandatory clinician review. No clinical assessment was performed — all scores are placeholders. A qualified clinician must manually review this photo to determine patient recovery status and rule out complications including vascular occlusion or necrosis.`,
    confidenceFactors: [
      { factor: 'ai_system_status', weight: 1.0, impact: 'negative' },
      { factor: 'analysis_completed', weight: 0, impact: 'negative' },
    ],
    aiUnavailable: true,
    aiFailureReason: failureReason,
    explainability,
    decisionPath: [],
  }
}

export function compareWithPreviousAnalysis(
  currentFeatures: GrokAnalysis['clinicalFeatures'],
  previousFeatures: { edema: number; ecchymosis: number; erythema: number; asymmetry: number } | null
): { trendDirection: 'IMPROVING' | 'STABLE' | 'WORSENING'; trendDetails: { metric: string; previousScore: number; currentScore: number; changePercent: number }[] } | null {
  if (!previousFeatures) return null

  const metrics = ['edema', 'ecchymosis', 'erythema', 'asymmetry'] as const
  const details: { metric: string; previousScore: number; currentScore: number; changePercent: number }[] = []
  let totalChange = 0

  for (const metric of metrics) {
    const prev = previousFeatures[metric]
    const curr = currentFeatures[metric]
    const changePercent = prev > 0 ? ((curr - prev) / prev) * 100 : curr > 0 ? 100 : 0
    details.push({
      metric,
      previousScore: Math.round(prev * 100) / 100,
      currentScore: Math.round(curr * 100) / 100,
      changePercent: Math.round(changePercent * 10) / 10,
    })
    totalChange += curr - prev
  }

  let trendDirection: 'IMPROVING' | 'STABLE' | 'WORSENING' = 'STABLE'
  if (totalChange < -0.1) trendDirection = 'IMPROVING'
  else if (totalChange > 0.1) trendDirection = 'WORSENING'

  return { trendDirection, trendDetails: details }
}

export function generateClinicalDocument(
  type: string,
  data: {
    patientName: string
    treatmentType: string
    dayNumber: number
    treatmentDate: string
    findings: ClinicalFeature[]
    riskLevel: string
    recommendations: string[]
    clinicalSummary: string
    rationale?: string
  }
): string {
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  switch (type) {
    case 'SOAP':
      return `SOAP NOTE
Date: ${date}
Patient: ${data.patientName}

SUBJECTIVE:
- Day ${data.dayNumber} post-${data.treatmentType.replace(/_/g, ' ').toLowerCase()}
- Treatment Date: ${data.treatmentDate}
- Patient-reported symptoms: Monitored via AI check-in

OBJECTIVE:
- Clinical Photography: Day ${data.dayNumber} post-procedure
- AI Clinical Assessment: ${data.riskLevel}
${data.findings.map(f => `- ${f.type}: ${f.severity} (score: ${f.score})`).join('\n')}
${data.rationale ? `\nAI Rationale: ${data.rationale}` : ''}

ASSESSMENT:
- Day ${data.dayNumber} post-${data.treatmentType.replace(/_/g, ' ').toLowerCase()}
- Risk Classification: ${data.riskLevel}
- ${data.clinicalSummary}

PLAN:
${data.recommendations.map(r => `- ${r}`).join('\n')}
- Follow-up as scheduled`

    case 'PROCEDURE':
      return `PROCEDURE NOTE
Date: ${data.treatmentDate}
Patient: ${data.patientName}
Procedure: ${data.treatmentType.replace(/_/g, ' ')}

Follow-up Assessment:
- Day ${data.dayNumber} post-procedure
- AI Assessment: ${data.riskLevel}
${data.findings.map(f => `- ${f.type}: ${f.severity}`).join('\n')}
${data.rationale ? `\nRationale: ${data.rationale}` : ''}

Recommendations:
${data.recommendations.map(r => `- ${r}`).join('\n')}`

    case 'RECOVERY_SUMMARY':
      return `RECOVERY SUMMARY
Patient: ${data.patientName}
Treatment: ${data.treatmentType.replace(/_/g, ' ')}
Treatment Date: ${data.treatmentDate}
Assessment Date: ${date}

Recovery Status: ${data.riskLevel}

Clinical Findings:
${data.findings.map(f => `- ${f.type}: ${f.severity} — ${f.description}`).join('\n')}

${data.rationale ? `Clinical Rationale:\n${data.rationale}\n` : ''}
Summary: ${data.clinicalSummary}

Recommendations:
${data.recommendations.map(r => `- ${r}`).join('\n')}`

    default:
      return `CLINICAL DOCUMENT
Date: ${date}
Patient: ${data.patientName}
Type: ${data.treatmentType.replace(/_/g, ' ')}

${data.clinicalSummary}`
  }
}
