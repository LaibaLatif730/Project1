import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { requireAuth, getClinicIdFromSession } from '@/lib/api-auth'
import { auditLog } from '@/lib/audit-log'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const clinicId = await getClinicIdFromSession()
    if (!clinicId) {
      return NextResponse.json({ error: 'No clinic assigned' }, { status: 400 })
    }

    const { id } = await params
    const role = session.user.role

    const patient = await prisma.patient.findFirst({
      where: { id, clinicId },
      include: {
        treatments: {
          include: {
            doctor: { include: { user: true } },
            checkIns: {
              include: {
                photos: role === 'DOCTOR',
                aiAnalyses: role === 'DOCTOR',
              },
              orderBy: { scheduledDate: 'asc' },
            },
          },
          orderBy: { treatmentDate: 'desc' },
        },
        appointments: { orderBy: { appointmentDate: 'desc' } },
        checkIns: {
          include: {
            photos: role === 'DOCTOR',
            aiAnalyses: role === 'DOCTOR',
          },
          orderBy: { scheduledDate: 'desc' },
          take: 10,
        },
        photos: role === 'DOCTOR' ? { orderBy: { uploadDate: 'desc' }, take: 20 } : false,
      },
    })

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    await auditLog({
      userId: session.user.id,
      clinicId,
      action: 'VIEW_PATIENT',
      entity: 'Patient',
      entityId: id,
      ipAddress: req.headers.get('x-forwarded-for') || undefined,
      userAgent: req.headers.get('user-agent') || undefined,
    })

    if (role === 'ADMIN') {
      const { photos, ...patientWithoutPhotos } = patient as any
      const stripped = {
        ...patientWithoutPhotos,
        checkIns: patientWithoutPhotos.checkIns?.map((c: any) => {
          const { photos: _p, aiAnalyses: _a, ...rest } = c
          return rest
        }),
        treatments: patientWithoutPhotos.treatments?.map((t: any) => ({
          ...t,
          checkIns: t.checkIns?.map((c: any) => {
            const { photos: _p, aiAnalyses: _a, ...rest } = c
            return rest
          }),
        })),
      }
      return NextResponse.json(stripped)
    }

    if (role === 'RECEPTIONIST') {
      const stripped = {
        ...patient,
        checkIns: patient.checkIns?.map((c: any) => ({
          id: c.id,
          dayNumber: c.dayNumber,
          scheduledDate: c.scheduledDate,
          status: c.status,
          completedDate: c.completedDate,
        })),
        treatments: patient.treatments?.map((t: any) => ({
          ...t,
          checkIns: t.checkIns?.map((c: any) => ({
            id: c.id,
            dayNumber: c.dayNumber,
            scheduledDate: c.scheduledDate,
            status: c.status,
          })),
        })),
      }
      return NextResponse.json(stripped)
    }

    return NextResponse.json(patient)
  } catch (error) {
    console.error('Error fetching patient:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const clinicId = await getClinicIdFromSession()
    if (!clinicId) {
      return NextResponse.json({ error: 'No clinic assigned' }, { status: 400 })
    }

    const { id } = await params
    const body = await req.json()

    const existing = await prisma.patient.findFirst({ where: { id, clinicId } })
    if (!existing) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    const allowedFields: Record<string, any> = {}
    if (body.firstName) allowedFields.firstName = body.firstName
    if (body.lastName) allowedFields.lastName = body.lastName
    if (body.email !== undefined) allowedFields.email = body.email
    if (body.phone !== undefined) allowedFields.phone = body.phone
    if (body.dateOfBirth) allowedFields.dateOfBirth = new Date(body.dateOfBirth)
    if (body.gender) allowedFields.gender = body.gender
    if (body.address !== undefined) allowedFields.address = body.address
    if (body.medicalHistory !== undefined) allowedFields.medicalHistory = body.medicalHistory
    if (body.allergies !== undefined) allowedFields.allergies = body.allergies
    if (body.medications !== undefined) allowedFields.medications = body.medications
    if (body.emergencyContact !== undefined) allowedFields.emergencyContact = body.emergencyContact

    const patient = await prisma.patient.update({
      where: { id },
      data: allowedFields,
    })

    return NextResponse.json(patient)
  } catch (error) {
    console.error('Error updating patient:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const clinicId = await getClinicIdFromSession()
    if (!clinicId) {
      return NextResponse.json({ error: 'No clinic assigned' }, { status: 400 })
    }

    const { id } = await params

    const existing = await prisma.patient.findFirst({ where: { id, clinicId } })
    if (!existing) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    await prisma.patient.update({
      where: { id },
      data: { isActive: false },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting patient:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
