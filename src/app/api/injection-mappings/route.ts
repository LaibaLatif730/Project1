import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { injectionMappingSchema } from '@/lib/validators'
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
    const treatmentId = searchParams.get('treatmentId')
    const patientId = searchParams.get('patientId')
    const area = searchParams.get('area')

    const where: any = { treatment: { patient: { clinicId } } }
    if (treatmentId) where.treatmentId = treatmentId
    if (area) where.area = area

    if (patientId) {
      where.treatment = { ...where.treatment, patientId }
    }

    const mappings = await prisma.injectionMapping.findMany({
      where,
      include: {
        treatment: { select: { id: true, type: true, treatmentDate: true, patientId: true } },
        doctor: { include: { user: { select: { name: true } } } },
        product: { select: { id: true, name: true, category: true } },
        batch: { select: { id: true, batchNumber: true, expiryDate: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })

    return NextResponse.json(mappings)
  } catch (error) {
    console.error('Error fetching injection mappings:', error)
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
      return NextResponse.json({ error: 'Only doctors can create injection mappings' }, { status: 403 })
    }

    const clinicId = await getClinicIdFromSession()
    if (!clinicId) {
      return NextResponse.json({ error: 'Missing clinicId' }, { status: 400 })
    }

    const body = await req.json()
    const validatedData = injectionMappingSchema.parse(body)

    const mapping = await prisma.injectionMapping.create({
      data: {
        treatmentId: validatedData.treatmentId,
        doctorId: validatedData.doctorId || undefined,
        area: validatedData.area,
        subArea: validatedData.subArea,
        units: validatedData.units,
        volume: validatedData.volume,
        productId: validatedData.productId || undefined,
        batchId: validatedData.batchId || undefined,
        technique: validatedData.technique,
        needleCannula: validatedData.needleCannula,
        depth: validatedData.depth,
        aspiration: validatedData.aspiration,
        notes: validatedData.notes,
        clinicId,
      },
      include: {
        treatment: { select: { id: true, type: true, treatmentDate: true } },
        doctor: { include: { user: { select: { name: true } } } },
        product: { select: { id: true, name: true } },
        batch: { select: { id: true, batchNumber: true } },
      },
    })

    return NextResponse.json(mapping, { status: 201 })
  } catch (error) {
    console.error('Error creating injection mapping:', error)
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
      return NextResponse.json({ error: 'Only doctors can delete injection mappings' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }

    const clinicId = await getClinicIdFromSession()
    if (!clinicId) return NextResponse.json({ error: 'No clinic assigned' }, { status: 400 })
    const existing = await prisma.injectionMapping.findFirst({ where: { id, clinicId } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await prisma.injectionMapping.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting injection mapping:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await requireAuth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.user.role !== 'DOCTOR') {
      return NextResponse.json({ error: 'Only doctors can update injection mappings' }, { status: 403 })
    }

    const body = await req.json()
    const { id, ...updateData } = body

    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

    const clinicId = await getClinicIdFromSession()
    if (!clinicId) return NextResponse.json({ error: 'No clinic assigned' }, { status: 400 })
    const existing = await prisma.injectionMapping.findFirst({ where: { id, clinicId } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const mapping = await prisma.injectionMapping.update({
      where: { id },
      data: {
        area: updateData.area || undefined,
        subArea: updateData.subArea || undefined,
        units: updateData.units !== undefined ? parseFloat(updateData.units) || null : undefined,
        volume: updateData.volume !== undefined ? parseFloat(updateData.volume) || null : undefined,
        technique: updateData.technique || undefined,
        needleCannula: updateData.needleCannula || undefined,
        depth: updateData.depth || undefined,
        aspiration: updateData.aspiration || undefined,
        notes: updateData.notes || undefined,
        productId: updateData.productId || undefined,
        batchId: updateData.batchId || undefined,
      },
      include: {
        treatment: { select: { id: true, type: true, treatmentDate: true } },
        doctor: { include: { user: { select: { name: true } } } },
        product: { select: { id: true, name: true } },
        batch: { select: { id: true, batchNumber: true } },
      },
    })

    return NextResponse.json(mapping)
  } catch (error) {
    console.error('Error updating injection mapping:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
