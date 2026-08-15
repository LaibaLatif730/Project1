import { NextResponse } from 'next/server'
import { sendWhatsAppMessage } from '@/lib/whatsapp'
import prisma from '@/lib/db'
import { auditLog } from '@/lib/audit-log'
import { logCronJobError } from '@/lib/error-logger'

function verifyCronAuth(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers.get('authorization') === `Bearer ${secret}`
}

interface ReminderTier {
  hoursBefore: number
  label: string
  message: (name: string, date: string, time: string, type: string) => string
  escalateIfNoResponse: boolean
}

const REMINDER_TIERS: ReminderTier[] = [
  {
    hoursBefore: 48,
    label: '48h',
    message: (name, date, time, type) =>
      `Hi ${name}! 📅\n\nThis is a reminder for your upcoming appointment:\n\n📅 ${date} at ${time}\n📋 Type: ${type}\n\nPlease reply CONFIRM or RESCHEDULE.\n\nThank you!\nAI Clinic Assistant`,
    escalateIfNoResponse: false,
  },
  {
    hoursBefore: 24,
    label: '24h',
    message: (name, date, time, type) =>
      `Hi ${name}! ⏰\n\nYour appointment is tomorrow:\n\n📅 ${date} at ${time}\n📋 Type: ${type}\n\nPlease reply CONFIRM to confirm your attendance.\n\nSee you soon!\nAI Clinic Assistant`,
    escalateIfNoResponse: false,
  },
  {
    hoursBefore: 2,
    label: '2h',
    message: (name, date, time, type) =>
      `Hi ${name}! 🚨\n\nYour appointment is in 2 hours:\n\n📅 ${date} at ${time}\n📋 Type: ${type}\n\nPlease confirm you're on your way by replying YES.\n\nAI Clinic Assistant`,
    escalateIfNoResponse: true,
  },
]

export async function POST(req: Request) {
  try {
    if (!verifyCronAuth(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    let totalSent = 0
    let totalEscalated = 0
    const results: any[] = []

    for (const tier of REMINDER_TIERS) {
      const windowStart = new Date(now.getTime() + (tier.hoursBefore - 1) * 60 * 60 * 1000)
      const windowEnd = new Date(now.getTime() + tier.hoursBefore * 60 * 60 * 1000)

      const upcoming = await prisma.appointment.findMany({
        where: {
          status: { in: ['SCHEDULED', 'CONFIRMED'] },
          appointmentDate: { gte: windowStart, lte: windowEnd },
        },
        include: {
          patient: { select: { id: true, firstName: true, lastName: true, phone: true } },
        },
      })

      for (const appt of upcoming) {
        if (!appt.patient.phone) continue

        const alreadyNotified = await prisma.notification.findFirst({
          where: {
            userId: appt.patient.id,
            title: { contains: `Appointment Reminder (${tier.label})` },
            createdAt: { gte: new Date(now.getTime() - tier.hoursBefore * 60 * 60 * 1000) },
          },
        })
        if (alreadyNotified) continue

        const dateStr = appt.appointmentDate.toLocaleDateString('en-US', {
          weekday: 'long', month: 'long', day: 'numeric',
        })
        const timeStr = appt.appointmentDate.toLocaleTimeString('en-US', {
          hour: 'numeric', minute: '2-digit',
        })

        const message = tier.message(
          appt.patient.firstName,
          dateStr,
          timeStr,
          appt.type.replace(/_/g, ' ').toLowerCase()
        )

        await sendWhatsAppMessage(appt.patient.phone, {
          messaging_product: 'whatsapp',
          to: appt.patient.phone,
          type: 'text',
          text: { body: message },
        })

        await prisma.notification.create({
          data: {
            userId: appt.patient.id,
            title: `Appointment Reminder (${tier.label})`,
            message: `Reminder for ${dateStr} at ${timeStr} — ${appt.type.replace(/_/g, ' ')}`,
            type: 'APPOINTMENT_REMINDER',
            channel: 'WHATSAPP',
            sentAt: new Date(),
          },
        })

        if (tier.escalateIfNoResponse) {
          const doctors = await prisma.user.findMany({ where: { role: 'DOCTOR' }, select: { id: true } })
          for (const doc of doctors) {
            await prisma.notification.create({
              data: {
                userId: doc.id,
                title: 'Appointment No-Response Escalation',
                message: `Patient ${appt.patient.firstName} ${appt.patient.lastName} has not confirmed appointment at ${timeStr}. May be a no-show risk.`,
                type: 'ESCALATION',
                channel: 'SYSTEM',
              },
            })
          }
          totalEscalated++
        }

        totalSent++
        results.push({ appointmentId: appt.id, tier: tier.label, patient: appt.patient.firstName })
      }
    }

    await auditLog({
      action: 'APPOINTMENT_REMINDERS_SENT',
      entity: 'Appointment',
      newValues: { totalSent, totalEscalated },
    })

    return NextResponse.json({ totalSent, totalEscalated, results })
  } catch (error) {
    console.error('Appointment reminder error:', error)
    await logCronJobError('appointment-reminders', 'Unhandled error in appointment reminders cron', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
