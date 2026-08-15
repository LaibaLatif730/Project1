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

const CONSENT_RENEWAL_DAYS: Record<string, number> = {
  TREATMENT_CONSENT: 365,
  PHOTO_CONSENT: 365,
  DATA_PROCESSING: 365,
  MARKETING: 180,
  RESEARCH: 365,
}

const REMINDER_WINDOW_DAYS = 30

export async function POST(req: Request) {
  try {
    if (!verifyCronAuth(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()

    const activeConsents = await prisma.consentRecord.findMany({
      where: { status: 'ACTIVE' },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, phone: true } },
      },
    })

    let remindersSent = 0
    let expiredCount = 0

    for (const consent of activeConsents) {
      const renewalPeriodDays = CONSENT_RENEWAL_DAYS[consent.consentType] || 365
      const expiryDate = new Date(consent.givenDate.getTime() + renewalPeriodDays * 24 * 60 * 60 * 1000)
      const reminderDate = new Date(expiryDate.getTime() - REMINDER_WINDOW_DAYS * 24 * 60 * 60 * 1000)

      if (now > expiryDate) {
        await prisma.consentRecord.update({
          where: { id: consent.id },
          data: { status: 'EXPIRED' },
        })
        expiredCount++

        const admins = await prisma.user.findMany({
          where: { role: 'ADMIN' },
          select: { id: true },
        })

        for (const admin of admins) {
          await prisma.notification.create({
            data: {
              userId: admin.id,
              title: `Consent Expired: ${consent.patient.firstName} ${consent.patient.lastName}`,
              message: `${consent.consentType.replace(/_/g, ' ')} consent has expired. Treatment should not proceed until renewed.`,
              type: 'CONSENT_EXPIRED',
              channel: 'IN_APP',
              metadata: JSON.stringify({
                consentId: consent.id,
                patientId: consent.patientId,
                consentType: consent.consentType,
                expiredAt: expiryDate.toISOString(),
              }),
            },
          })
        }

        if (consent.patient.phone) {
          await sendWhatsAppMessage(consent.patient.phone, {
            messaging_product: 'whatsapp',
            to: consent.patient.phone,
            type: 'text',
            text: {
              body: `Hi ${consent.patient.firstName},\n\nYour ${consent.consentType.replace(/_/g, ' ').toLowerCase()} consent has expired. Please contact the clinic to renew it before your next treatment.\n\nThank you,\nAI Clinic Assistant`,
            },
          })
          remindersSent++
        }
      } else if (now >= reminderDate) {
        const alreadyReminded = consent.lastReminderSent &&
          (now.getTime() - new Date(consent.lastReminderSent).getTime()) < REMINDER_WINDOW_DAYS * 24 * 60 * 60 * 1000

        if (!alreadyReminded) {
          const admins = await prisma.user.findMany({
            where: { role: 'ADMIN' },
            select: { id: true },
          })

          for (const admin of admins) {
            await prisma.notification.create({
              data: {
                userId: admin.id,
                title: `Consent Expiring: ${consent.patient.firstName} ${consent.patient.lastName}`,
                message: `${consent.consentType.replace(/_/g, ' ')} consent expires on ${expiryDate.toLocaleDateString()}. Please arrange renewal.`,
                type: 'CONSENT_EXPIRING',
                channel: 'IN_APP',
                metadata: JSON.stringify({
                  consentId: consent.id,
                  patientId: consent.patientId,
                  consentType: consent.consentType,
                  expiryDate: expiryDate.toISOString(),
                }),
              },
            })
          }

          if (consent.patient.phone) {
            await sendWhatsAppMessage(consent.patient.phone, {
              messaging_product: 'whatsapp',
              to: consent.patient.phone,
              type: 'text',
              text: {
                body: `Hi ${consent.patient.firstName},\n\nYour ${consent.consentType.replace(/_/g, ' ').toLowerCase()} consent will expire on ${expiryDate.toLocaleDateString()}. Please contact the clinic to renew it.\n\nThank you,\nAI Clinic Assistant`,
              },
            })
          }

          await prisma.consentRecord.update({
            where: { id: consent.id },
            data: { lastReminderSent: now },
          })

          remindersSent++
        }
      }
    }

    return NextResponse.json({
      totalActive: activeConsents.length,
      remindersSent,
      expired: expiredCount,
    })
  } catch (error) {
    console.error('Consent reminder error:', error)
    await logCronJobError('consent-reminders', 'Unhandled error in consent reminders cron', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
