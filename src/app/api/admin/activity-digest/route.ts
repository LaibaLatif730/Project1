import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'

async function generateActivityDigest(metrics: any): Promise<string> {
  const apiKey = process.env.GROK_API_KEY || process.env.GROQ_API_KEY
  if (!apiKey) {
    return generateFallbackDigest(metrics)
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
            content: `You are an operational analytics AI. Generate a weekly activity digest for a clinic admin.
Summarize the following metrics in plain language. Be concise (3-5 bullet points).
Focus on: patient volume, staff activity, appointment trends, and any anomalies.
Do NOT include clinical details or patient names.`
          },
          {
            role: 'user',
            content: `Weekly Metrics:\n- Total patients: ${metrics.totalPatients}\n- New patients this week: ${metrics.newPatients}\n- Appointments this week: ${metrics.appointments}\n- Completed appointments: ${metrics.completedAppointments}\n- Treatments recorded: ${metrics.treatments}\n- Check-ins completed: ${metrics.completedCheckIns}\n- Silence risk alerts: ${metrics.silenceRiskCount}\n- Staff activity entries: ${metrics.auditLogCount}\n\nGenerate a weekly digest:`
          }
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
    })

    if (!response.ok) throw new Error('Groq API error')
    const data = await response.json()
    return data.choices[0]?.message?.content || generateFallbackDigest(metrics)
  } catch {
    return generateFallbackDigest(metrics)
  }
}

function generateFallbackDigest(m: any): string {
  return `Weekly Activity Digest:\n\n- ${m.newPatients} new patient(s) registered this week.\n- ${m.appointments} appointment(s) scheduled, ${m.completedAppointments} completed.\n- ${m.treatments} treatment(s) recorded by doctors.\n- ${m.completedCheckIns} recovery check-in(s) completed by patients.\n- ${m.silenceRiskCount} silence risk alert(s) detected.\n- ${m.auditLogCount} staff action(s) logged for compliance.`
}

export async function GET(req: Request) {
  try {
    const session = await requireAuth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only admins can view activity digest' }, { status: 403 })
    }

    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const [totalPatients, newPatients, appointments, completedAppointments, treatments, completedCheckIns, silenceRiskCount, auditLogCount] = await Promise.all([
      prisma.patient.count({ where: { isActive: true } }),
      prisma.patient.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.appointment.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.appointment.count({ where: { status: 'COMPLETED', createdAt: { gte: weekAgo } } }),
      prisma.treatment.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.recoveryCheckIn.count({ where: { status: 'COMPLETED', completedDate: { gte: weekAgo } } }),
      prisma.silenceRiskLog.count({ where: { detectedAt: { gte: weekAgo } } }),
      prisma.auditLog.count({ where: { createdAt: { gte: weekAgo } } }),
    ])

    const metrics = { totalPatients, newPatients, appointments, completedAppointments, treatments, completedCheckIns, silenceRiskCount, auditLogCount }
    const digest = await generateActivityDigest(metrics)

    return NextResponse.json({ digest, metrics, period: { from: weekAgo, to: now } })
  } catch (error) {
    console.error('Error generating activity digest:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
