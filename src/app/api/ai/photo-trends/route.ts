import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'
import { auditLog } from '@/lib/audit-log'

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'

async function generateTrendAnalysis(analyses: any[], treatmentType: string): Promise<string> {
  const apiKey = process.env.GROK_API_KEY || process.env.GROQ_API_KEY
  if (!apiKey) {
    return generateFallbackTrend(analyses, treatmentType)
  }

  try {
    const timeline = analyses.map((a, i) => {
      const data = JSON.parse(a.rawResponse || '{}')
      return `Day ${i + 1} (${a.createdAt?.split('T')[0]}): Risk=${a.riskLevel}, Features: Edema=${data.clinicalFeatures?.edema || 0}, Erythema=${data.clinicalFeatures?.erythema || 0}, Asymmetry=${data.clinicalFeatures?.asymmetry || 0}`
    }).join('\n')

    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: `You are a clinical trend analysis AI. Analyze the progression of post-treatment recovery photos over time.

Provide:
1. Overall trend direction (IMPROVING / STABLE / WORSENING)
2. Key observations about each clinical feature
3. Whether the recovery is on track for this treatment type
4. Any concerns that need doctor attention

Be concise and clinical.`
          },
          {
            role: 'user',
            content: `Treatment Type: ${treatmentType.replace(/_/g, ' ')}\n\nPhoto Analysis Timeline:\n${timeline}\n\nAnalyze the recovery trend:`
          }
        ],
        temperature: 0.2,
        max_tokens: 500,
      }),
    })

    if (!response.ok) throw new Error('Groq API error')
    const data = await response.json()
    return data.choices[0]?.message?.content || generateFallbackTrend(analyses, treatmentType)
  } catch {
    return generateFallbackTrend(analyses, treatmentType)
  }
}

function generateFallbackTrend(analyses: any[], treatmentType: string): string {
  if (analyses.length === 0) return 'No photo analyses available for trend tracking.'

  const riskCounts = { GREEN: 0, YELLOW: 0, ORANGE: 0, RED: 0 }
  analyses.forEach(a => {
    if (a.riskLevel in riskCounts) riskCounts[a.riskLevel as keyof typeof riskCounts]++
  })

  const total = analyses.length
  const greenPct = Math.round((riskCounts.GREEN / total) * 100)

  let trend = 'STABLE'
  if (riskCounts.RED > 0) trend = 'WORSENING'
  else if (greenPct >= 80) trend = 'IMPROVING'

  return `Recovery Trend for ${treatmentType.replace(/_/g, ' ')}:\n\n• ${total} photo(s) analyzed\n• Risk distribution: ${riskCounts.GREEN} green, ${riskCounts.YELLOW} yellow, ${riskCounts.ORANGE} orange, ${riskCounts.RED} red\n• Overall trend: ${trend}\n• ${greenPct}% of check-ins show green risk level`
}

export async function GET(req: Request) {
  try {
    const session = await requireAuth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (session.user.role !== 'DOCTOR') {
      return NextResponse.json({ error: 'Only doctors can view photo trends' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const patientId = searchParams.get('patientId')
    const treatmentId = searchParams.get('treatmentId')

    if (!patientId) {
      return NextResponse.json({ error: 'patientId is required' }, { status: 400 })
    }

    const where: any = { patientId }
    if (treatmentId) {
      const checkIns = await prisma.recoveryCheckIn.findMany({
        where: { treatmentId },
        select: { id: true },
      })
      where.checkInId = { in: checkIns.map(c => c.id) }
    }

    const analyses = await prisma.aIAnalysis.findMany({
      where,
      include: {
        checkIn: { select: { dayNumber: true, scheduledDate: true, treatmentId: true } },
      },
      orderBy: { createdAt: 'asc' },
    })

    await auditLog({
      userId: session.user.id,
      entity: 'Patient',
      entityId: patientId,
      action: 'PATIENT_VIEWED',
      newValues: { photoAnalysesCount: analyses.length },
      ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
      userAgent: req.headers.get('user-agent') || undefined,
    })

    if (analyses.length === 0) {
      return NextResponse.json({ trend: 'No photo analyses available', dataPoints: [], trendDirection: 'UNKNOWN' })
    }

    const treatment = analyses[0].checkIn?.treatmentId
      ? await prisma.treatment.findUnique({ where: { id: analyses[0].checkIn.treatmentId }, select: { type: true } })
      : null

    const trendText = await generateTrendAnalysis(analyses, treatment?.type || 'OTHER')

    const dataPoints = analyses.map(a => {
      const raw = JSON.parse(a.rawResponse || '{}')
      return {
        date: a.createdAt,
        dayNumber: a.checkIn?.dayNumber,
        riskLevel: a.riskLevel,
        edema: raw.clinicalFeatures?.edema || 0,
        erythema: raw.clinicalFeatures?.erythema || 0,
        asymmetry: raw.clinicalFeatures?.asymmetry || 0,
        ecchymosis: raw.clinicalFeatures?.ecchymosis || 0,
      }
    })

    let trendDirection: 'IMPROVING' | 'STABLE' | 'WORSENING' | 'UNKNOWN' = 'UNKNOWN'
    if (trendText.includes('IMPROVING')) trendDirection = 'IMPROVING'
    else if (trendText.includes('STABLE')) trendDirection = 'STABLE'
    else if (trendText.includes('WORSENING')) trendDirection = 'WORSENING'

    return NextResponse.json({ trend: trendText, dataPoints, trendDirection, totalAnalyses: analyses.length })
  } catch (error) {
    console.error('Error generating trend analysis:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
