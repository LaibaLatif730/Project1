import { NextResponse } from 'next/server'
import { detectSilenceRisks, getSilenceRiskStats } from '@/lib/silence-risk'
import { sendWhatsAppMessage } from '@/lib/whatsapp'
import prisma from '@/lib/db'
import { logCronJobError } from '@/lib/error-logger'

function verifyCronAuth(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[SECURITY] CRON_SECRET not configured — rejecting request')
    return false
  }
  const authHeader = req.headers.get('authorization')
  return authHeader === `Bearer ${secret}`
}

export async function POST(req: Request) {
  try {
    if (!verifyCronAuth(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const results = await detectSilenceRisks()
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true },
    })

    for (const result of results) {
      for (const admin of admins) {
        await prisma.notification.create({
          data: {
            userId: admin.id,
            title: `Silence Risk: ${result.patientName}`,
            message: `Day ${result.missedDayNumber} check-in for ${result.treatmentType.replace(/_/g, ' ')} is ${result.hoursPastDue}h overdue. Risk level: ${result.escalationLevel}`,
            type: 'SILENCE_RISK',
            channel: 'IN_APP',
            metadata: JSON.stringify({
              checkInId: result.checkInId,
              riskScore: result.riskScore,
              escalationLevel: result.escalationLevel,
            }),
          },
        })
      }

      if (result.escalationLevel === 'HIGH' || result.escalationLevel === 'CRITICAL') {
        const patient = await prisma.patient.findUnique({
          where: { id: result.patientId || '' },
          select: { phone: true, firstName: true, lastName: true },
        })

        if (patient?.phone) {
          await sendWhatsAppMessage(patient.phone, {
            messaging_product: 'whatsapp',
            to: patient.phone,
            type: 'text',
            text: {
              body: `Hi ${patient.firstName}, this is a reminder for your Day ${result.missedDayNumber} recovery check-in for your ${result.treatmentType.replace(/_/g, ' ')} treatment. Please reply with a photo of the treated area so we can monitor your recovery.`,
            },
          })
        }

        const staff = await prisma.user.findMany({
          where: { role: { in: ['ADMIN', 'DOCTOR'] } },
          select: { phone: true, name: true },
        })

        for (const s of staff) {
          if (s.phone) {
            await sendWhatsAppMessage(s.phone, {
              messaging_product: 'whatsapp',
              to: s.phone,
              type: 'text',
              text: {
                body: `${result.escalationLevel === 'CRITICAL' ? '🚨' : '⚠️'} ${result.escalationLevel} SILENCE RISK\n\nPatient: ${result.patientName}\nTreatment: ${result.treatmentType.replace(/_/g, ' ')}\nDay ${result.missedDayNumber} — ${result.hoursPastDue}h overdue\n\nPlease review in the dashboard.`,
              },
            })
          }
        }
      }
    }

    return NextResponse.json({
      detected: results.length,
      results,
    })
  } catch (error) {
    console.error('Silence risk detection error:', error)
    await logCronJobError('check-silence', 'Unhandled error in silence risk detection cron', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(req: Request) {
  try {
    if (!verifyCronAuth(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const stats = await getSilenceRiskStats()
    return NextResponse.json(stats)
  } catch (error) {
    console.error('Error fetching silence risk stats:', error)
    await logCronJobError('check-silence', 'Error fetching silence risk stats', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
