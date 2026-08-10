import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { requireAuth, getClinicIdFromSession } from '@/lib/api-auth'
import { auditLog } from '@/lib/audit-log'

export async function GET(req: Request) {
  try {
    const session = await requireAuth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const clinicId = await getClinicIdFromSession()
    if (!clinicId) {
      return NextResponse.json({ error: 'No clinic associated with session' }, { status: 400 })
    }

    const { searchParams } = new URL(req.url)
    const patientId = searchParams.get('patientId')
    const treatmentId = searchParams.get('treatmentId')
    const status = searchParams.get('status')

    const where: any = { clinicId }
    if (patientId) where.patientId = patientId
    if (treatmentId) where.treatmentId = treatmentId
    if (status) {
      if (status === 'SILENCE_RISK') {
        where.status = 'SILENCE_RISK'
      } else {
        where.status = status
      }
    }

    const checkIns = await prisma.recoveryCheckIn.findMany({
      where,
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, phone: true } },
        treatment: { select: { id: true, type: true, treatmentDate: true } },
        photos: true,
        aiAnalyses: true,
      },
      orderBy: { scheduledDate: 'asc' },
      take: 100,
    })

    return NextResponse.json(checkIns)
  } catch (error) {
    console.error('Error fetching check-ins:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await requireAuth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const clinicId = await getClinicIdFromSession()
    if (!clinicId) {
      return NextResponse.json({ error: 'No clinic associated with session' }, { status: 400 })
    }

    const body = await req.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: 'Check-in ID is required' }, { status: 400 })
    }

    const existing = await prisma.recoveryCheckIn.findFirst({
      where: { id, clinicId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Check-in not found' }, { status: 404 })
    }

    const checkIn = await prisma.recoveryCheckIn.update({
      where: { id },
      data: {
        status: updateData.status,
        patientMessage: updateData.patientMessage,
        aiResponse: updateData.aiResponse,
        riskLevel: updateData.riskLevel,
        symptoms: updateData.symptoms,
        completedDate: updateData.status === 'COMPLETED' ? new Date() : undefined,
      },
    })

    return NextResponse.json(checkIn)
  } catch (error) {
    console.error('Error updating check-in:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAuth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (session.user.role !== 'DOCTOR') {
      return NextResponse.json({ error: 'Only doctors can create check-ins' }, { status: 403 })
    }

    const clinicId = await getClinicIdFromSession()
    if (!clinicId) {
      return NextResponse.json({ error: 'No clinic associated with session' }, { status: 400 })
    }

    const body = await req.json()
    const { patientId, treatmentId, startDate, numberOfCheckIns, intervalDays, notes } = body

    if (!patientId) {
      return NextResponse.json({ error: 'patientId is required' }, { status: 400 })
    }

    if (treatmentId) {
      const existingCheckIns = await prisma.recoveryCheckIn.findMany({
        where: { treatmentId },
        select: { dayNumber: true },
      })
      const existingDays = new Set(existingCheckIns.map(c => c.dayNumber))
      if (existingDays.size > 0) {
        const count = Math.min(Math.max(parseInt(numberOfCheckIns) || 5, 1), 30)
        const hasOverlap = Array.from({ length: count }, (_, i) => i + 1).some(d => existingDays.has(d))
        if (hasOverlap) {
          return NextResponse.json({ error: 'Check-ins already exist for some of these days. Increase the start day or use different interval.' }, { status: 400 })
        }
      }
    } else {
      const existingStandalone = await prisma.recoveryCheckIn.findMany({
        where: { patientId, treatmentId: null },
        select: { dayNumber: true },
      })
      const existingDays = new Set(existingStandalone.map(c => c.dayNumber))
      const count = Math.min(Math.max(parseInt(numberOfCheckIns) || 5, 1), 30)
      const hasOverlap = Array.from({ length: count }, (_, i) => i + 1).some(d => existingDays.has(d))
      if (hasOverlap) {
        return NextResponse.json({ error: 'Standalone check-ins already exist for some of these days.' }, { status: 400 })
      }
    }

    const count = Math.min(Math.max(parseInt(numberOfCheckIns) || 5, 1), 30)
    const interval = Math.min(Math.max(parseInt(intervalDays) || 1, 1), 30)
    const start = startDate ? new Date(startDate) : new Date()
    start.setHours(0, 0, 0, 0)

    const checkIns = await Promise.all(
      Array.from({ length: count }, (_, i) => {
        const dayNumber = i + 1
        const scheduledDate = new Date(start.getTime() + (i * interval) * 24 * 60 * 60 * 1000)
        return prisma.recoveryCheckIn.create({
          data: {
            patientId,
            treatmentId: treatmentId || undefined,
            clinicId,
            dayNumber,
            scheduledDate,
            notes: notes || undefined,
          },
        })
      })
    )

    await auditLog({
      userId: session.user.id,
      action: 'CREATE_CHECKINS',
      entity: 'RecoveryCheckIn',
      entityId: patientId,
      newValues: { count, interval, startDate: start.toISOString() },
    })

    return NextResponse.json(checkIns, { status: 201 })
  } catch (error) {
    console.error('Error creating check-ins:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
