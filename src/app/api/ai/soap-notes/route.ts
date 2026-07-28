import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'
import { auditLog } from '@/lib/audit-log'

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'

async function generateSOAPNotes(consultationNotes: string, patientHistory: string, treatmentType: string): Promise<string> {
  const apiKey = process.env.GROK_API_KEY || process.env.GROQ_API_KEY
  if (!apiKey) {
    return generateFallbackSOAP(consultationNotes, treatmentType)
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
            content: `You are a medical documentation AI assistant. Generate structured SOAP notes from consultation notes.
Format the output as:

SUBJECTIVE:
[Patient's complaints, symptoms, and history as reported]

OBJECTIVE:
[Clinical findings, observations, and measurements]

ASSESSMENT:
[Diagnosis or clinical impression]

PLAN:
[Treatment plan, medications, follow-up instructions]

Be concise, professional, and use standard medical terminology. Do not include information not present in the consultation notes.`
          },
          {
            role: 'user',
            content: `Patient History: ${patientHistory}\n\nTreatment Type: ${treatmentType}\n\nConsultation Notes: ${consultationNotes}\n\nGenerate structured SOAP notes:`
          }
        ],
        temperature: 0.3,
        max_tokens: 1500,
      }),
    })

    if (!response.ok) throw new Error('Groq API error')
    const data = await response.json()
    return data.choices[0]?.message?.content || generateFallbackSOAP(consultationNotes, treatmentType)
  } catch {
    return generateFallbackSOAP(consultationNotes, treatmentType)
  }
}

function generateFallbackSOAP(notes: string, treatmentType: string): string {
  return `SUBJECTIVE:\n${notes || 'Patient presented for consultation.'}\n\nOBJECTIVE:\n${treatmentType} treatment consultation performed.\n\nASSESSMENT:\nPatient evaluated for ${treatmentType.replace(/_/g, ' ').toLowerCase()} treatment.\n\nPLAN:\nTreatment recommendations discussed with patient. Follow-up as scheduled.`
}

export async function POST(req: Request) {
  try {
    const session = await requireAuth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (session.user.role !== 'DOCTOR') {
      return NextResponse.json({ error: 'Only doctors can generate SOAP notes' }, { status: 403 })
    }

    const body = await req.json()
    const { patientId, treatmentId, consultationNotes, treatmentType } = body

    if (!patientId || !consultationNotes) {
      return NextResponse.json({ error: 'patientId and consultationNotes are required' }, { status: 400 })
    }

    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: { firstName: true, lastName: true, medicalHistory: true, allergies: true, medications: true },
    })

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    const patientHistory = [
      patient.medicalHistory && `History: ${patient.medicalHistory}`,
      patient.allergies && `Allergies: ${patient.allergies}`,
      patient.medications && `Medications: ${patient.medications}`,
    ].filter(Boolean).join('. ') || 'No significant history.'

    const soapNotes = await generateSOAPNotes(consultationNotes, patientHistory, treatmentType || 'GENERAL')

    const note = await prisma.clinicalNote.create({
      data: {
        patientId,
        doctorId: session.user.id,
        treatmentId: treatmentId || undefined,
        noteType: 'SOAP',
        content: soapNotes,
        isAiGenerated: true,
        isPrivate: true,
      },
    })

    await auditLog({
      userId: session.user.id,
      action: 'GENERATE_SOAP_NOTE',
      entity: 'ClinicalNote',
      entityId: note.id,
      newValues: { patientId, treatmentType },
    })

    return NextResponse.json({ note, soapNotes }, { status: 201 })
  } catch (error) {
    console.error('Error generating SOAP notes:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
