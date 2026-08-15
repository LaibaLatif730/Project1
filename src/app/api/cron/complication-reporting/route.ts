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

const REPORTING_THRESHOLD_DAYS = 7

export async function POST(req: Request) {
  try {
    if (!verifyCronAuth(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    const threshold = new Date(now.getTime() - REPORTING_THRESHOLD_DAYS * 24 * 60 * 60 * 1000)

    const unreportedComplications = await prisma.complicationRecord.findMany({
      where: {
        reportedToRegulatory: false,
        severity: { in: ['MODERATE', 'SEVERE', 'CRITICAL'] },
        createdAt: { lte: threshold },
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        treatment: { select: { type: true } },
      },
      orderBy: { createdAt: 'asc' },
    })

    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true, phone: true, name: true },
    })

    for (const complication of unreportedComplications) {
      for (const admin of admins) {
        await prisma.notification.create({
          data: {
            userId: admin.id,
            title: `Unreported Complication: ${complication.patient.firstName} ${complication.patient.lastName}`,
            message: `${complication.severity} ${complication.complicationType.replace(/_/g, ' ')} reported ${Math.floor((now.getTime() - complication.createdAt.getTime()) / (1000 * 60 * 60 * 24))} days ago — still not reported to regulatory.`,
            type: 'COMPLICATION_REPORTING',
            channel: 'IN_APP',
            metadata: JSON.stringify({
              complicationId: complication.id,
              patientId: complication.patientId,
              severity: complication.severity,
              complicationType: complication.complicationType,
              daysSinceReport: Math.floor((now.getTime() - complication.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
            }),
          },
        })

        if (admin.phone) {
          await sendWhatsAppMessage(admin.phone, {
            messaging_product: 'whatsapp',
            to: admin.phone,
            type: 'text',
            text: {
              body: `🚨 Regulatory Reporting Required\n\nPatient: ${complication.patient.firstName} ${complication.patient.lastName}\nType: ${complication.complicationType.replace(/_/g, ' ')}\nSeverity: ${complication.severity}\nReported: ${Math.floor((now.getTime() - complication.createdAt.getTime()) / (1000 * 60 * 60 * 24))} days ago\n\nThis complication has NOT been reported to regulatory authorities. Please ensure compliance.\n\nAI Clinic Assistant`,
            },
          })
        }
      }
    }

    return NextResponse.json({
      unreportedCount: unreportedComplications.length,
      complications: unreportedComplications.map(c => ({
        id: c.id,
        patient: `${c.patient.firstName} ${c.patient.lastName}`,
        type: c.complicationType,
        severity: c.severity,
        daysSinceReport: Math.floor((now.getTime() - c.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
      })),
    })
  } catch (error) {
    console.error('Complication reporting error:', error)
    await logCronJobError('complication-reporting', 'Unhandled error in complication reporting cron', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
