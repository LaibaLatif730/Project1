import { NextResponse } from 'next/server'
import { sendWhatsAppMessage } from '@/lib/whatsapp'
import prisma from '@/lib/db'
import { logCronJobError } from '@/lib/error-logger'

function verifyCronAuth(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[SECURITY] CRON_SECRET not configured')
    return false
  }
  return req.headers.get('authorization') === `Bearer ${secret}`
}

const SURVEY_TRIGGER_DAY = 14

export async function POST(req: Request) {
  try {
    if (!verifyCronAuth(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    const windowStart = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)
    const windowEnd = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000)

    const completedCheckIns = await prisma.recoveryCheckIn.findMany({
      where: {
        status: 'COMPLETED',
        dayNumber: SURVEY_TRIGGER_DAY,
        completedDate: { gte: windowStart, lte: windowEnd },
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, phone: true } },
        treatment: { select: { id: true, type: true } },
      },
    })

    let surveysSent = 0

    for (const checkIn of completedCheckIns) {
      const existingSurvey = await prisma.survey.findFirst({
        where: {
          patientId: checkIn.patientId,
          treatmentId: checkIn.treatmentId,
          type: 'POST_TREATMENT',
        },
      })

      if (existingSurvey) continue

      await prisma.survey.create({
        data: {
          patientId: checkIn.patientId,
          treatmentId: checkIn.treatmentId,
          type: 'POST_TREATMENT',
          responses: '{}',
        },
      })

      if (checkIn.patient.phone) {
        const baseUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : 'http://localhost:3000'

        await sendWhatsAppMessage(checkIn.patient.phone, {
          messaging_product: 'whatsapp',
          to: checkIn.patient.phone,
          type: 'text',
          text: {
            body: `Hi ${checkIn.patient.firstName}! 🎉\n\nCongratulations on completing your Day ${SURVEY_TRIGGER_DAY} recovery check-in for your ${(checkIn.treatment?.type || 'treatment').replace(/_/g, ' ')} treatment!\n\nWe'd love to hear about your experience. Please take a moment to complete our short survey:\n\n${baseUrl}/patient/survey\n\nYour feedback helps us improve our care. Thank you!\n\nAI Clinic Assistant`,
          },
        })
        surveysSent++
      }
    }

    return NextResponse.json({
      eligibleCheckIns: completedCheckIns.length,
      surveysCreated: surveysSent,
    })
  } catch (error) {
    console.error('Survey dispatch error:', error)
    await logCronJobError('survey-dispatch', 'Unhandled error in survey dispatch cron', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
