import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { clinicalNoteSchema } from '@/lib/validators'
import { requireAuth, getClinicIdFromSession } from '@/lib/api-auth'
import { auditLog } from '@/lib/audit-log'

export async function GET(req: Request) {
  try {
    const session = await requireAuth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'DOCTOR') {
      return NextResponse.json({ error: 'Only doctors can view clinical notes' }, { status: 403 })
    }

    const clinicId = await getClinicIdFromSession()
    if (!clinicId) {
      return NextResponse.json({ error: 'Missing clinicId' }, { status: 400 })
    }

    const { searchParams } = new URL(req.url)
    const patientId = searchParams.get('patientId')
    const treatmentId = searchParams.get('treatmentId')
    const noteType = searchParams.get('noteType')

    const where: any = { clinicId }
    if (patientId) where.patientId = patientId
    if (treatmentId) where.treatmentId = treatmentId
    if (noteType) where.noteType = noteType

    const notes = await prisma.clinicalNote.findMany({
      where,
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        treatment: { select: { id: true, type: true, treatmentDate: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })

    await auditLog({
      userId: session.user.id,
      action: 'VIEW_CLINICAL_NOTES',
      entity: 'ClinicalNote',
      entityId: patientId || undefined,
    })

    return NextResponse.json(notes)
  } catch (error) {
    console.error('Error fetching clinical notes:', error)
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
      return NextResponse.json({ error: 'Only doctors can create clinical notes' }, { status: 403 })
    }

    const clinicId = await getClinicIdFromSession()
    if (!clinicId) {
      return NextResponse.json({ error: 'Missing clinicId' }, { status: 400 })
    }

    const body = await req.json()
    const validatedData = clinicalNoteSchema.parse(body)

    const note = await prisma.clinicalNote.create({
      data: {
        patientId: validatedData.patientId,
        doctorId: validatedData.doctorId || undefined,
        treatmentId: validatedData.treatmentId || undefined,
        checkInId: validatedData.checkInId || undefined,
        noteType: validatedData.noteType,
        content: validatedData.content,
        isAiGenerated: validatedData.isAiGenerated,
        isPrivate: validatedData.isPrivate,
        clinicId,
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
      },
    })

    return NextResponse.json(note, { status: 201 })
  } catch (error) {
    console.error('Error creating clinical note:', error)
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
      return NextResponse.json({ error: 'Only doctors can update clinical notes' }, { status: 403 })
    }

    const body = await req.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: 'Note ID is required' }, { status: 400 })
    }

    const allowedFields: Record<string, any> = {}
    if (updateData.content) allowedFields.content = updateData.content
    if (updateData.noteType) allowedFields.noteType = updateData.noteType
    if (updateData.isPrivate !== undefined) allowedFields.isPrivate = updateData.isPrivate

    const note = await prisma.clinicalNote.update({
      where: { id },
      data: allowedFields,
    })

    return NextResponse.json(note)
  } catch (error) {
    console.error('Error updating clinical note:', error)
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
      return NextResponse.json({ error: 'Only doctors can delete clinical notes' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Note ID is required' }, { status: 400 })
    }

    await prisma.clinicalNote.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting clinical note:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
