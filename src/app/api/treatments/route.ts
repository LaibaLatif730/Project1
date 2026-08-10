import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { treatmentSchema } from '@/lib/validators'
import { requireAuth, getClinicIdFromSession } from '@/lib/api-auth'

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

    const where: any = { clinicId }
    if (patientId) where.patientId = patientId

    const treatments = await prisma.treatment.findMany({
      where,
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        doctor: { include: { user: { select: { name: true } } } },
        checkIns: { select: { id: true, status: true, dayNumber: true } },
      },
      orderBy: { treatmentDate: 'desc' },
      take: 50,
    })

    return NextResponse.json(treatments)
  } catch (error) {
    console.error('Error fetching treatments:', error)
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
      return NextResponse.json({ error: 'Only doctors can create treatments' }, { status: 403 })
    }

    const clinicId = await getClinicIdFromSession()
    if (!clinicId) return NextResponse.json({ error: 'No clinic assigned' }, { status: 400 })

    const body = await req.json()
    const validatedData = treatmentSchema.parse(body)
    const numberOfCheckIns = Math.min(Math.max(parseInt(body.numberOfCheckIns) || 5, 0), 30)
    const status = body.status || (new Date(validatedData.treatmentDate) > new Date() ? 'SCHEDULED' : 'COMPLETED')

    let injectionAreasStr = '[]'
    if (validatedData.injectionAreas) {
      try {
        const parsed = JSON.parse(validatedData.injectionAreas)
        injectionAreasStr = JSON.stringify(parsed)
      } catch {
        const arr = validatedData.injectionAreas.split(',').map((s: string) => s.trim()).filter(Boolean)
        injectionAreasStr = JSON.stringify(arr)
      }
    }

    const treatment = await prisma.treatment.create({
      data: {
        patientId: validatedData.patientId,
        doctorId: validatedData.doctorId || undefined,
        clinicId,
        type: validatedData.type,
        productName: validatedData.productName || undefined,
        units: validatedData.units || undefined,
        injectionAreas: injectionAreasStr,
        treatmentDate: new Date(validatedData.treatmentDate),
        notes: validatedData.notes || undefined,
        aftercareNotes: validatedData.aftercareNotes || undefined,
        status,
      },
    })

    const treatmentDate = new Date(validatedData.treatmentDate)

    let checkIns: any[] = []
    if (numberOfCheckIns > 0) {
      checkIns = await Promise.all(
        Array.from({ length: numberOfCheckIns }, (_, i) => {
          const dayNumber = i + 1
          return prisma.recoveryCheckIn.create({
            data: {
              treatmentId: treatment.id,
              patientId: validatedData.patientId,
              dayNumber,
              scheduledDate: new Date(treatmentDate.getTime() + dayNumber * 24 * 60 * 60 * 1000),
              clinicId,
            },
          })
        })
      )
    }

    return NextResponse.json(
      { ...treatment, checkIns },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error creating treatment:', error)
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
      return NextResponse.json({ error: 'Only doctors can update treatments' }, { status: 403 })
    }

    const clinicId = await getClinicIdFromSession()
    if (!clinicId) return NextResponse.json({ error: 'No clinic assigned' }, { status: 400 })

    const body = await req.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: 'Treatment ID is required' }, { status: 400 })
    }

    const existing = await prisma.treatment.findFirst({ where: { id, clinicId } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const allowedFields: Record<string, any> = {}
    if (updateData.type) allowedFields.type = updateData.type
    if (updateData.productName !== undefined) allowedFields.productName = updateData.productName
    if (updateData.units !== undefined) allowedFields.units = updateData.units
    if (updateData.notes !== undefined) allowedFields.notes = updateData.notes
    if (updateData.aftercareNotes !== undefined) allowedFields.aftercareNotes = updateData.aftercareNotes
    if (updateData.status) allowedFields.status = updateData.status
    if (updateData.treatmentDate) allowedFields.treatmentDate = new Date(updateData.treatmentDate)

    const treatment = await prisma.treatment.update({
      where: { id },
      data: allowedFields,
    })

    return NextResponse.json(treatment)
  } catch (error) {
    console.error('Error updating treatment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await requireAuth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'DOCTOR') {
      return NextResponse.json({ error: 'Only doctors can delete treatments' }, { status: 403 })
    }

    const clinicId = await getClinicIdFromSession()
    if (!clinicId) return NextResponse.json({ error: 'No clinic assigned' }, { status: 400 })

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Treatment ID is required' }, { status: 400 })
    }

    const existing = await prisma.treatment.findFirst({ where: { id, clinicId } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await prisma.treatment.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting treatment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
