import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { requireAuth, getClinicIdFromSession } from '@/lib/api-auth'
import { auditLog } from '@/lib/audit-log'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (session.user.role !== 'RECEPTIONIST' && session.user.role !== 'DOCTOR') {
      return NextResponse.json({ error: 'Only doctors and receptionists can approve intakes' }, { status: 403 })
    }

    const clinicId = await getClinicIdFromSession()
    if (!clinicId) {
      return NextResponse.json({ error: 'No clinic associated with session' }, { status: 400 })
    }

    const { id } = await params

    const intake = await prisma.whatsAppIntake.findFirst({
      where: { id, clinicId },
    })

    if (!intake) {
      return NextResponse.json({ error: 'Intake not found' }, { status: 404 })
    }

    if (intake.status !== 'PENDING') {
      return NextResponse.json({ error: 'Intake has already been processed' }, { status: 400 })
    }

    const nameParts = (intake.name || 'Unknown Patient').split(/\s+/)
    const firstName = nameParts[0]
    const lastName = nameParts.slice(1).join(' ') || firstName

    const patient = await prisma.patient.create({
      data: {
        firstName,
        lastName,
        email: intake.email || undefined,
        phone: intake.phone,
        consentGiven: true,
        consentDate: new Date(),
        source: 'WHATSAPP',
        intakeId: intake.id,
        clinicId,
      },
    })

    await prisma.whatsAppIntake.update({
      where: { id },
      data: {
        status: 'APPROVED',
        patientId: patient.id,
        reviewedById: session.user.id,
        reviewedAt: new Date(),
      },
    })

    await auditLog({
      userId: session.user.id,
      entity: 'Patient',
      entityId: patient.id,
      action: 'PATIENT_CREATED',
      newValues: { source: 'WHATSAPP', intakeId: intake.id },
      ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
      userAgent: req.headers.get('user-agent') || undefined,
    })

    return NextResponse.json({
      success: true,
      patient: {
        id: patient.id,
        firstName: patient.firstName,
        lastName: patient.lastName,
        phone: patient.phone,
        source: patient.source,
      },
      message: `Patient record created for ${intake.name}`,
    })
  } catch (error) {
    console.error('Error approving intake:', error)
    return NextResponse.json({ error: 'Failed to approve intake' }, { status: 500 })
  }
}
