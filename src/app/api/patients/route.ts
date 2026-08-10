import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { patientSchema } from '@/lib/validators'
import { requireAuth, getClinicIdFromSession } from '@/lib/api-auth'
import { auditLog } from '@/lib/audit-log'
import bcrypt from 'bcryptjs'

export async function GET(req: Request) {
  try {
    const session = await requireAuth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const clinicId = await getClinicIdFromSession()
    if (!clinicId) {
      return NextResponse.json({ error: 'No clinic assigned' }, { status: 400 })
    }

    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search')

    const where: any = { isActive: true, clinicId }
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ]
    }

    const patients = await prisma.patient.findMany({
      where,
      include: {
        treatments: {
          select: { id: true, type: true, treatmentDate: true },
        },
        _count: { select: { treatments: true, checkIns: true, appointments: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return NextResponse.json(patients)
  } catch (error) {
    console.error('Error fetching patients:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAuth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'DOCTOR' && session.user.role !== 'RECEPTIONIST') {
      return NextResponse.json({ error: 'Only doctors and receptionists can create patients' }, { status: 403 })
    }

    const clinicId = await getClinicIdFromSession()
    if (!clinicId) {
      return NextResponse.json({ error: 'No clinic assigned' }, { status: 400 })
    }

    const body = await req.json()
    const validatedData = patientSchema.parse(body)
    const { initialPassword, ...patientData } = body

    let medicalHistory = undefined
    if (validatedData.medicalHistory) {
      try {
        medicalHistory = JSON.parse(validatedData.medicalHistory)
      } catch {
        medicalHistory = validatedData.medicalHistory
      }
    }

    let passwordHash = undefined
    let passwordSetAt = undefined
    if (initialPassword && initialPassword.length >= 6) {
      passwordHash = await bcrypt.hash(initialPassword, 12)
      passwordSetAt = new Date()
    }

    const patient = await prisma.patient.create({
      data: {
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        email: validatedData.email || undefined,
        phone: validatedData.phone || undefined,
        dateOfBirth: validatedData.dateOfBirth ? new Date(validatedData.dateOfBirth) : undefined,
        gender: validatedData.gender || undefined,
        address: validatedData.address || undefined,
        medicalHistory,
        allergies: validatedData.allergies || undefined,
        medications: validatedData.medications || undefined,
        emergencyContact: validatedData.emergencyContact || undefined,
        clinicId,
        consentGiven: true,
        consentDate: new Date(),
        passwordHash,
        passwordSetAt,
      },
    })

    await auditLog({
      userId: session.user.id,
      clinicId,
      action: 'CREATE_PATIENT',
      entity: 'Patient',
      entityId: patient.id,
      newValues: { firstName: patient.firstName, lastName: patient.lastName, phone: patient.phone },
    })

    return NextResponse.json(patient, { status: 201 })
  } catch (error) {
    console.error('Error creating patient:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
