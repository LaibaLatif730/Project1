import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { appointmentSchema } from '@/lib/validators'
import { requireAuth, getClinicIdFromSession } from '@/lib/api-auth'
import { auditLog } from '@/lib/audit-log'

export async function GET(req: Request) {
  try {
    const session = await requireAuth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const clinicId = await getClinicIdFromSession()
    if (!clinicId) return NextResponse.json({ error: 'No clinic assigned' }, { status: 400 })

    const { searchParams } = new URL(req.url)
    const patientId = searchParams.get('patientId')
    const doctorId = searchParams.get('doctorId')
    const date = searchParams.get('date')

    const where: any = { clinicId }
    if (patientId) where.patientId = patientId
    if (doctorId) where.doctorId = doctorId
    if (date) {
      const startOfDay = new Date(date + 'T00:00:00.000Z')
      const endOfDay = new Date(date + 'T23:59:59.999Z')
      where.appointmentDate = { gte: startOfDay, lte: endOfDay }
    }

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, phone: true } },
        doctor: { include: { user: { select: { name: true } } } },
      },
      orderBy: { appointmentDate: 'asc' },
    })

    return NextResponse.json(appointments)
  } catch (error) {
    console.error('Error fetching appointments:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAuth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'RECEPTIONIST') {
      return NextResponse.json({ error: 'Only receptionists can create appointments' }, { status: 403 })
    }

    const clinicId = await getClinicIdFromSession()
    if (!clinicId) return NextResponse.json({ error: 'No clinic assigned' }, { status: 400 })

    const body = await req.json()
    const validatedData = appointmentSchema.parse(body)

    const nameParts = validatedData.patientName.trim().split(/\s+/)
    const firstName = nameParts[0]
    const lastName = nameParts.slice(1).join(' ') || nameParts[0]

    const patient = await prisma.patient.findFirst({
      where: {
        isActive: true,
        clinicId,
        firstName: { contains: firstName, mode: 'insensitive' },
        ...(lastName !== firstName ? { lastName: { contains: lastName, mode: 'insensitive' } } : {}),
      },
    })

    if (!patient) {
      return NextResponse.json({ error: `No patient found matching "${validatedData.patientName}". Please register the patient first.` }, { status: 404 })
    }

    const appointmentDate = new Date(validatedData.appointmentDate)
    const duration = validatedData.duration || 30
    const startWindow = new Date(appointmentDate.getTime() - duration * 60 * 1000)
    const endWindow = new Date(appointmentDate.getTime() + duration * 60 * 1000)

    const patientConflict = await prisma.appointment.findFirst({
      where: {
        patientId: patient.id,
        clinicId,
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        appointmentDate: { gte: startWindow, lt: endWindow },
      },
    })

    if (patientConflict) {
      return NextResponse.json(
        { error: `${validatedData.patientName} already has an appointment at this time (${new Date(patientConflict.appointmentDate).toLocaleString()})` },
        { status: 409 }
      )
    }

    const doctorConflict = validatedData.doctorId
      ? await prisma.appointment.findFirst({
          where: {
            doctorId: validatedData.doctorId,
            clinicId,
            status: { notIn: ['CANCELLED', 'NO_SHOW'] },
            appointmentDate: { gte: startWindow, lt: endWindow },
          },
          include: {
            patient: { select: { firstName: true, lastName: true } },
          },
        })
      : null

    if (doctorConflict) {
      return NextResponse.json(
        { error: `Doctor already has an appointment at this time with ${doctorConflict.patient.firstName} ${doctorConflict.patient.lastName}` },
        { status: 409 }
      )
    }

    const appointment = await prisma.appointment.create({
      data: {
        patientId: patient.id,
        doctorId: validatedData.doctorId || undefined,
        clinicId,
        appointmentDate: new Date(validatedData.appointmentDate),
        duration: validatedData.duration,
        type: validatedData.type,
        notes: validatedData.notes,
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
      },
    })

    await auditLog({
      userId: session.user.id,
      action: 'CREATE_APPOINTMENT',
      entity: 'Appointment',
      entityId: appointment.id,
      clinicId,
      newValues: { patientId: patient.id, doctorId: validatedData.doctorId, appointmentDate, type: validatedData.type },
    })

    return NextResponse.json(appointment, { status: 201 })
  } catch (error) {
    console.error('Error creating appointment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await requireAuth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (session.user.role !== 'RECEPTIONIST') {
      return NextResponse.json({ error: 'Only receptionists can update appointments' }, { status: 403 })
    }

    const clinicId = await getClinicIdFromSession()
    if (!clinicId) return NextResponse.json({ error: 'No clinic assigned' }, { status: 400 })

    const body = await req.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: 'Appointment ID is required' }, { status: 400 })
    }

    const existing = await prisma.appointment.findFirst({ where: { id, clinicId } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const allowedFields: Record<string, any> = {}
    if (updateData.status) allowedFields.status = updateData.status
    if (updateData.appointmentDate) {
      const newDate = new Date(updateData.appointmentDate)
      if (newDate <= new Date()) {
        return NextResponse.json({ error: 'Appointment date must be in the future' }, { status: 400 })
      }
      allowedFields.appointmentDate = newDate
    }
    if (updateData.duration) allowedFields.duration = updateData.duration
    if (updateData.type) allowedFields.type = updateData.type
    if (updateData.notes !== undefined) allowedFields.notes = updateData.notes
    if (updateData.doctorId !== undefined) allowedFields.doctorId = updateData.doctorId
    if (updateData.priorityFlag !== undefined) allowedFields.priorityFlag = updateData.priorityFlag

    const old = await prisma.appointment.findUnique({ where: { id } })

    const appointment = await prisma.appointment.update({
      where: { id },
      data: allowedFields,
    })

    await auditLog({
      userId: session.user.id,
      action: 'UPDATE_APPOINTMENT',
      entity: 'Appointment',
      entityId: id,
      clinicId,
      oldValues: old ? { status: old.status, appointmentDate: old.appointmentDate, notes: old.notes } : undefined,
      newValues: allowedFields,
    })

    return NextResponse.json(appointment)
  } catch (error) {
    console.error('Error updating appointment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await requireAuth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (session.user.role !== 'RECEPTIONIST') {
      return NextResponse.json({ error: 'Only receptionists can delete appointments' }, { status: 403 })
    }

    const clinicId = await getClinicIdFromSession()
    if (!clinicId) return NextResponse.json({ error: 'No clinic assigned' }, { status: 400 })

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Appointment ID is required' }, { status: 400 })
    }

    const existing = await prisma.appointment.findFirst({ where: { id, clinicId } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await prisma.appointment.delete({ where: { id } })

    await auditLog({
      userId: session.user.id,
      action: 'DELETE_APPOINTMENT',
      entity: 'Appointment',
      entityId: id,
      clinicId,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting appointment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
