import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { requireAuth, getClinicIdFromSession } from '@/lib/api-auth'
import { auditLog } from '@/lib/audit-log'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'RECEPTIONIST') {
      return NextResponse.json({ error: 'Only receptionists can manage appointment requests' }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json()
    const { action, rejectionReason, doctorId } = body

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Action must be "approve" or "reject"' }, { status: 400 })
    }

    const clinicId = await getClinicIdFromSession()
    if (!clinicId) {
      return NextResponse.json({ error: 'Missing clinicId' }, { status: 400 })
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: { patient: { select: { id: true, firstName: true, lastName: true, userId: true, clinicId: true } } },
    })

    if (!appointment) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }

    if (appointment.patient.clinicId !== clinicId) {
      return NextResponse.json({ error: 'Appointment does not belong to this clinic' }, { status: 403 })
    }

    if (appointment.status !== 'PENDING_APPROVAL') {
      return NextResponse.json({ error: 'This request has already been processed' }, { status: 400 })
    }

    if (action === 'approve') {
      const updated = await prisma.appointment.update({
        where: { id },
        data: {
          status: 'CONFIRMED',
          doctorId: doctorId || appointment.doctorId,
          rejectionReason: null,
        },
      })

      if (appointment.patient.userId) {
        await prisma.notification.create({
          data: {
            userId: appointment.patient.userId,
            title: 'Appointment Confirmed',
            message: `Your ${appointment.type.replace(/_/g, ' ').toLowerCase()} appointment on ${new Date(appointment.appointmentDate).toLocaleDateString()} has been confirmed.`,
            type: 'APPOINTMENT_APPROVED',
            channel: 'IN_APP',
          },
        })
      }

      await auditLog({
        userId: session.user.id,
        action: 'APPROVE_APPOINTMENT_REQUEST',
        entity: 'Appointment',
        entityId: id,
        newValues: { status: 'CONFIRMED', doctorId },
      })

      return NextResponse.json(updated)
    } else {
      const updated = await prisma.appointment.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          rejectionReason: rejectionReason || 'Rejected by receptionist',
        },
      })

      await auditLog({
        userId: session.user.id,
        action: 'REJECT_APPOINTMENT_REQUEST',
        entity: 'Appointment',
        entityId: id,
        newValues: { status: 'CANCELLED', rejectionReason },
      })

      return NextResponse.json(updated)
    }
  } catch (error) {
    console.error('Error processing appointment request:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
