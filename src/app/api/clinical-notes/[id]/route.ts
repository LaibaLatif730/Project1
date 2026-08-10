import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { requireAuth, getClinicIdFromSession } from '@/lib/api-auth'
import { auditLog } from '@/lib/audit-log'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.user.role !== 'DOCTOR') {
      return NextResponse.json({ error: 'Only doctors can update clinical notes' }, { status: 403 })
    }

    const { id } = await params

    const clinicId = await getClinicIdFromSession()
    if (!clinicId) return NextResponse.json({ error: 'No clinic assigned' }, { status: 400 })
    const existing = await prisma.clinicalNote.findFirst({ where: { id, clinicId } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = await req.json()

    const old = await prisma.clinicalNote.findUnique({ where: { id }, select: { content: true, noteType: true } })

    const note = await prisma.clinicalNote.update({
      where: { id },
      data: {
        noteType: body.noteType || undefined,
        content: body.content || undefined,
        isPrivate: body.isPrivate,
      },
    })

    await auditLog({
      userId: session.user.id,
      action: 'UPDATE_CLINICAL_NOTE',
      entity: 'ClinicalNote',
      entityId: id,
      oldValues: old ? { content: old.content, noteType: old.noteType } : undefined,
      newValues: { content: body.content, noteType: body.noteType },
    })

    return NextResponse.json(note)
  } catch (error) {
    console.error('Error updating clinical note:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.user.role !== 'DOCTOR') {
      return NextResponse.json({ error: 'Only doctors can delete clinical notes' }, { status: 403 })
    }

    const { id } = await params

    const clinicId = await getClinicIdFromSession()
    if (!clinicId) return NextResponse.json({ error: 'No clinic assigned' }, { status: 400 })
    const existing = await prisma.clinicalNote.findFirst({ where: { id, clinicId } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await prisma.clinicalNote.delete({ where: { id } })

    await auditLog({
      userId: session.user.id,
      action: 'DELETE_CLINICAL_NOTE',
      entity: 'ClinicalNote',
      entityId: id,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting clinical note:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
