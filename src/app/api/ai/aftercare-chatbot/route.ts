import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { sendWhatsAppMessage } from '@/lib/whatsapp'

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'

async function generateAftercareResponse(question: string, patientContext: string): Promise<string> {
  const apiKey = process.env.GROK_API_KEY || process.env.GROQ_API_KEY
  if (!apiKey) {
    return 'Thank you for your question. Our team will review it and get back to you shortly. If this is urgent, please contact the clinic directly.'
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
            content: `You are an AI aftercare assistant for an aesthetic medicine clinic. You answer common post-treatment questions from patients.

Rules:
- Be reassuring but not dismissive
- Use simple language, avoid medical jargon
- If the question involves severe symptoms (difficulty breathing, severe swelling, fever above 101°F, signs of infection), advise immediate medical attention
- For routine questions (redness, mild swelling, bruising), provide standard aftercare guidance
- If unsure, escalate to the doctor
- Keep responses concise (2-3 sentences max)
- Always end with: "If you're concerned, please contact the clinic."`
          },
          {
            role: 'user',
            content: `Patient context: ${patientContext}\n\nPatient question: ${question}\n\nProvide a helpful aftercare response:`
          }
        ],
        temperature: 0.4,
        max_tokens: 300,
      }),
    })

    if (!response.ok) throw new Error('Groq API error')
    const data = await response.json()
    return data.choices[0]?.message?.content || 'Thank you for your question. Our team will review it shortly.'
  } catch {
    return 'Thank you for your question. Our team will review it and get back to you shortly. If this is urgent, please contact the clinic directly.'
  }
}

function shouldEscalateToDoctor(response: string): boolean {
  const urgentKeywords = ['immediate', 'emergency', 'urgent', 'difficulty breathing', 'severe', 'fever', 'infection', 'hospital']
  return urgentKeywords.some(keyword => response.toLowerCase().includes(keyword))
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { phone, message, patientId } = body

    if (!phone || !message) {
      return NextResponse.json({ error: 'phone and message are required' }, { status: 400 })
    }

    let patientContext = 'No patient context available.'
    let resolvedPatientId = patientId

    if (!resolvedPatientId) {
      const patient = await prisma.patient.findFirst({
        where: { phone: { contains: phone.slice(-10) }, isActive: true },
        select: { id: true, firstName: true, treatments: { select: { type: true, treatmentDate: true }, orderBy: { treatmentDate: 'desc' }, take: 1 } },
      })
      if (patient) {
        resolvedPatientId = patient.id
        const latestTreatment = patient.treatments[0]
        patientContext = `Patient: ${patient.firstName}. Latest treatment: ${latestTreatment?.type || 'Unknown'} on ${latestTreatment?.treatmentDate?.toISOString()?.split('T')[0] || 'Unknown date'}.`
      }
    }

    const response = await generateAftercareResponse(message, patientContext)

    await sendWhatsAppMessage(phone, {
      messaging_product: 'whatsapp',
      to: phone,
      type: 'text',
      text: { body: response },
    })

    if (shouldEscalateToDoctor(response) && resolvedPatientId) {
      const doctors = await prisma.user.findMany({ where: { role: 'DOCTOR' }, select: { id: true } })
      for (const doctor of doctors) {
        await prisma.notification.create({
          data: {
            userId: doctor.id,
            title: 'Aftercare Chatbot Escalation',
            message: `Patient ${phone} asked: "${message.slice(0, 100)}". Response flagged for review.`,
            type: 'ESCALATION',
            channel: 'SYSTEM',
          },
        })
      }
    }

    return NextResponse.json({ response, escalated: shouldEscalateToDoctor(response) })
  } catch (error) {
    console.error('Error in aftercare chatbot:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
