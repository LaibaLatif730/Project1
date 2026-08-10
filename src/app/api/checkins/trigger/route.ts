import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { requireAuth, getClinicIdFromSession } from '@/lib/api-auth'
import { auditLog } from '@/lib/audit-log'

export async function POST(req: Request) {
  try {
    const session = await requireAuth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (session.user.role !== 'DOCTOR') {
      return NextResponse.json({ error: 'Only doctors can trigger ad-hoc check-ins' }, { status: 403 })
    }

    const clinicId = await getClinicIdFromSession()
    if (!clinicId) {
      return NextResponse.json({ error: 'No clinic assigned' }, { status: 400 })
    }

    const body = await req.json()
    const { patientId, treatmentId } = body

    if (!patientId) {
      return NextResponse.json({ error: 'patientId is required' }, { status: 400 })
    }

    const patient = await prisma.patient.findFirst({ where: { id: patientId, clinicId } })
    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    let treatment = null
    if (treatmentId) {
      treatment = await prisma.treatment.findUnique({ where: { id: treatmentId } })
      if (!treatment || treatment.patientId !== patientId) {
        return NextResponse.json({ error: 'Treatment not found for this patient' }, { status: 404 })
      }
    } else {
      treatment = await prisma.treatment.findFirst({
        where: { patientId },
        orderBy: { treatmentDate: 'desc' },
      })
    }

    if (!treatment) {
      return NextResponse.json({ error: 'No treatments found for this patient' }, { status: 404 })
    }

    const existingCheckIns = await prisma.recoveryCheckIn.findMany({
      where: { treatmentId: treatment.id },
      orderBy: { dayNumber: 'desc' },
      take: 1,
    })

    const nextDay = existingCheckIns.length > 0 ? existingCheckIns[0].dayNumber + 1 : 1

    const checkIn = await prisma.recoveryCheckIn.create({
      data: {
        treatmentId: treatment.id,
        patientId,
        clinicId,
        dayNumber: nextDay,
        scheduledDate: new Date(),
        status: 'PENDING',
        riskLevel: 'GREEN',
      },
    })

    await auditLog({
      userId: session.user.id,
      action: 'TRIGGER_ADHOC_CHECKIN',
      entity: 'RecoveryCheckIn',
      entityId: checkIn.id,
      newValues: { patientId, treatmentId: treatment.id, dayNumber: nextDay },
    })

    return NextResponse.json(checkIn, { status: 201 })
  } catch (error) {
    console.error('Error triggering ad-hoc check-in:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
