import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { complicationSchema } from '@/lib/validators'
import { requireAuth, getClinicIdFromSession } from '@/lib/api-auth'

export async function GET(req: Request) {
  try {
    const session = await requireAuth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const clinicId = await getClinicIdFromSession()
    if (!clinicId) {
      return NextResponse.json({ error: 'Missing clinicId' }, { status: 400 })
    }

    const { searchParams } = new URL(req.url)
    const patientId = searchParams.get('patientId')
    const treatmentId = searchParams.get('treatmentId')
    const severity = searchParams.get('severity')
    const complicationType = searchParams.get('type')

    const where: any = { clinicId }
    if (patientId) where.patientId = patientId
    if (treatmentId) where.treatmentId = treatmentId
    if (severity) where.severity = severity
    if (complicationType) where.complicationType = complicationType

    const complications = await prisma.complicationRecord.findMany({
      where,
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, phone: true } },
        treatment: { select: { id: true, type: true, treatmentDate: true, productName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })

    return NextResponse.json(complications)
  } catch (error) {
    console.error('Error fetching complications:', error)
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
      return NextResponse.json({ error: 'Only doctors can create complications' }, { status: 403 })
    }

    const clinicId = await getClinicIdFromSession()
    if (!clinicId) {
      return NextResponse.json({ error: 'Missing clinicId' }, { status: 400 })
    }

    const body = await req.json()
    const validatedData = complicationSchema.parse(body)

    const complication = await prisma.complicationRecord.create({
      data: {
        patientId: validatedData.patientId,
        treatmentId: validatedData.treatmentId || undefined,
        complicationType: validatedData.complicationType,
        description: validatedData.description,
        severity: validatedData.severity,
        onsetDate: new Date(validatedData.onsetDate),
        resolutionDate: validatedData.resolutionDate ? new Date(validatedData.resolutionDate) : undefined,
        treatmentGiven: validatedData.treatmentGiven,
        outcome: validatedData.outcome,
        batchNumber: validatedData.batchNumber,
        productUsed: validatedData.productUsed,
        clinicId,
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        treatment: { select: { id: true, type: true, treatmentDate: true } },
      },
    })

    return NextResponse.json(complication, { status: 201 })
  } catch (error) {
    console.error('Error creating complication:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await requireAuth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (session.user.role !== 'DOCTOR') {
      return NextResponse.json({ error: 'Only doctors can update complications' }, { status: 403 })
    }

    const body = await req.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: 'Complication ID is required' }, { status: 400 })
    }

    const complication = await prisma.complicationRecord.update({
      where: { id },
      data: {
        resolutionDate: updateData.resolutionDate ? new Date(updateData.resolutionDate) : undefined,
        treatmentGiven: updateData.treatmentGiven,
        outcome: updateData.outcome,
        severity: updateData.severity,
        reportedToRegulatory: updateData.reportedToRegulatory,
      },
    })

    return NextResponse.json(complication)
  } catch (error) {
    console.error('Error updating complication:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
