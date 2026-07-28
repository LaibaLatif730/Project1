import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'

async function generatePatientSummary(patientData: any): Promise<string> {
  const apiKey = process.env.GROK_API_KEY || process.env.GROQ_API_KEY
  if (!apiKey) {
    return generateFallbackSummary(patientData)
  }

  try {
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
            content: `You are a clinical summary AI. Generate a concise one-paragraph patient summary for a doctor who is about to see this patient for the first time.

Include:
- Key treatment history (types, dates, frequency)
- Known reactions or complications
- Last risk flag or concern
- Current medications and allergies
- Any pending follow-ups

Keep it to 3-5 sentences. Be factual and clinical. Do not make assumptions beyond what the data shows.`
          },
          {
            role: 'user',
            content: `Patient: ${patientData.firstName} ${patientData.lastName}\nDOB: ${patientData.dateOfBirth || 'Unknown'}\nGender: ${patientData.gender || 'Unknown'}\nAllergies: ${patientData.allergies || 'None known'}\nMedications: ${patientData.medications || 'None'}\nMedical History: ${patientData.medicalHistory || 'None'}\n\nTreatments: ${patientData.treatments?.map((t: any) => `${t.type} on ${t.treatmentDate?.split('T')[0]}`).join(', ') || 'No treatments'}\n\nComplications: ${patientData.complications?.map((c: any) => `${c.complicationType} (${c.severity})`).join(', ') || 'None'}\n\nLatest Risk Flags: ${patientData.checkIns?.filter((c: any) => c.riskLevel !== 'GREEN').map((c: any) => `Day ${c.dayNumber}: ${c.riskLevel}`).join(', ') || 'None'}\n\nGenerate a one-paragraph clinical summary:`
          }
        ],
        temperature: 0.2,
        max_tokens: 500,
      }),
    })

    if (!response.ok) throw new Error('Groq API error')
    const data = await response.json()
    return data.choices[0]?.message?.content || generateFallbackSummary(patientData)
  } catch {
    return generateFallbackSummary(patientData)
  }
}

function generateFallbackSummary(data: any): string {
  const treatments = data.treatments?.length || 0
  const complications = data.complications?.length || 0
  const allergies = data.allergies || 'None known'
  return `Patient ${data.firstName} ${data.lastName} has ${treatments} treatment(s) on record with ${complications} reported complication(s). Known allergies: ${allergies}. ${data.medications ? `Current medications: ${data.medications}.` : ''} No significant flags at this time.`
}

export async function GET(req: Request) {
  try {
    const session = await requireAuth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const patientId = searchParams.get('patientId')

    if (!patientId) {
      return NextResponse.json({ error: 'patientId is required' }, { status: 400 })
    }

    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      include: {
        treatments: { select: { type: true, treatmentDate: true, notes: true }, orderBy: { treatmentDate: 'desc' }, take: 10 },
        complications: { select: { complicationType: true, severity: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 5 },
        checkIns: { select: { dayNumber: true, riskLevel: true, status: true }, orderBy: { scheduledDate: 'desc' }, take: 5 },
        photos: { select: { uploadDate: true }, orderBy: { uploadDate: 'desc' }, take: 1 },
      },
    })

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    const summary = await generatePatientSummary(patient)

    return NextResponse.json({ summary, patientId })
  } catch (error) {
    console.error('Error generating patient summary:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
