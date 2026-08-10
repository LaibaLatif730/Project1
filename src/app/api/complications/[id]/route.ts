import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { requireAuth, getClinicIdFromSession } from '@/lib/api-auth'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.user.role !== 'DOCTOR') {
      return NextResponse.json({ error: 'Only doctors can update complications' }, { status: 403 })
    }

    const { id } = await params

    const clinicId = await getClinicIdFromSession()
    if (!clinicId) return NextResponse.json({ error: 'No clinic assigned' }, { status: 400 })
    const existing = await prisma.complicationRecord.findFirst({ where: { id, clinicId } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = await req.json()

    const complication = await prisma.complicationRecord.update({
      where: { id },
      data: {
        complicationType: body.complicationType || undefined,
        description: body.description || undefined,
        severity: body.severity || undefined,
        treatmentGiven: body.treatmentGiven || undefined,
        outcome: body.outcome || undefined,
        resolutionDate: body.resolutionDate ? new Date(body.resolutionDate) : undefined,
        reportedToRegulatory: body.reportedToRegulatory,
      },
    })

    return NextResponse.json(complication)
  } catch (error) {
    console.error('Error updating complication:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.user.role !== 'DOCTOR') {
      return NextResponse.json({ error: 'Only doctors can delete complications' }, { status: 403 })
    }

    const { id } = await params

    const clinicId = await getClinicIdFromSession()
    if (!clinicId) return NextResponse.json({ error: 'No clinic assigned' }, { status: 400 })
    const existing = await prisma.complicationRecord.findFirst({ where: { id, clinicId } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await prisma.complicationRecord.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting complication:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
