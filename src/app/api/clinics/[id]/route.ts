import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'
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

    if (session.user.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json()

    const clinic = await prisma.clinic.findUnique({ where: { id } })
    if (!clinic) {
      return NextResponse.json({ error: 'Clinic not found' }, { status: 404 })
    }

    const allowedFields: Record<string, any> = {}
    if (body.name !== undefined) allowedFields.name = body.name
    if (body.address !== undefined) allowedFields.address = body.address
    if (body.phone !== undefined) allowedFields.phone = body.phone
    if (body.email !== undefined) allowedFields.email = body.email
    if (body.timezone !== undefined) allowedFields.timezone = body.timezone
    if (body.isActive !== undefined) allowedFields.isActive = body.isActive

    const updated = await prisma.clinic.update({
      where: { id },
      data: allowedFields,
    })

    await auditLog({
      userId: session.user.id,
      clinicId: id,
      action: body.isActive !== undefined
        ? (body.isActive ? 'ACTIVATE_CLINIC' : 'DEACTIVATE_CLINIC')
        : 'UPDATE_CLINIC',
      entity: 'Clinic',
      entityId: id,
      oldValues: { name: clinic.name, isActive: clinic.isActive },
      newValues: allowedFields,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating clinic:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
