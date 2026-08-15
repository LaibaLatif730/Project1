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

export async function POST(req: Request) {
  try {
    if (!verifyCronAuth(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    const recentWindow = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    const escalatedAnalyses = await prisma.aIAnalysis.findMany({
      where: {
        riskLevel: { in: ['ORANGE', 'RED'] },
        analysisDate: { gte: recentWindow },
        doctorOverride: false,
      },
      include: {
        photo: {
          include: {
            patient: { select: { id: true, firstName: true, lastName: true, phone: true } },
            checkIn: {
              include: {
                treatment: { select: { id: true, type: true, patientId: true } },
              },
            },
          },
        },
      },
    })

    let triggersCreated = 0

    for (const analysis of escalatedAnalyses) {
      const patient = analysis.photo.patient
      const checkIn = analysis.photo.checkIn
      if (!checkIn?.treatment) continue

      const existingAppointment = await prisma.appointment.findFirst({
        where: {
          patientId: patient.id,
          status: 'SCHEDULED',
          appointmentDate: { gte: now },
        },
      })

      if (existingAppointment) continue

      const followUpDate = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)

      await prisma.appointment.create({
        data: {
          patientId: patient.id,
          appointmentDate: followUpDate,
          type: 'FOLLOW_UP',
          status: 'SCHEDULED',
          notes: `Auto-triggered follow-up based on Day ${checkIn.dayNumber} check-in clinical review. ${analysis.clinicalSummary || ''}`,
        },
      })

      triggersCreated++

      if (patient.phone) {
        const urgency = analysis.riskLevel === 'RED' ? '🚨 Urgent' : '⚠️ Follow-up needed'
        await sendWhatsAppMessage(patient.phone, {
          messaging_product: 'whatsapp',
          to: patient.phone,
          type: 'text',
          text: {
            body: `Hi ${patient.firstName}, ${urgency}\n\nBased on your recent recovery check-in, we'd like to schedule a follow-up appointment to review your progress.\n\nTreatment: ${checkIn.treatment.type.replace(/_/g, ' ')}\nRisk level: ${analysis.riskLevel}\n\nA member of our team will contact you to confirm the appointment.\n\nAI Clinic Assistant`,
          },
        })
      }

      const admins = await prisma.user.findMany({
        where: { role: 'ADMIN' },
        select: { id: true },
      })

      for (const admin of admins) {
        await prisma.notification.create({
          data: {
            userId: admin.id,
            title: `Auto-Rebook: ${patient.firstName} ${patient.lastName}`,
            message: `Priority follow-up auto-created for ${followUpDate.toLocaleDateString()} based on clinical review trigger.`,
            type: 'REBOOKING_TRIGGER',
            channel: 'IN_APP',
            metadata: JSON.stringify({
              analysisId: analysis.id,
              patientId: patient.id,
              followUpDate: followUpDate.toISOString(),
            }),
          },
        })
      }
    }

    return NextResponse.json({
      escalatedFound: escalatedAnalyses.length,
      triggersCreated,
    })
  } catch (error) {
    console.error('Rebooking trigger error:', error)
    await logCronJobError('rebooking-triggers', 'Unhandled error in rebooking triggers cron', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
