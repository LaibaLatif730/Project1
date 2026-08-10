import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { requireAuth, getClinicIdFromSession } from '@/lib/api-auth'
import { auditLog } from '@/lib/audit-log'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (session.user.role !== 'RECEPTIONIST' && session.user.role !== 'DOCTOR') {
      return NextResponse.json({ error: 'Only doctors and receptionists can reject intakes' }, { status: 403 })
    }

    const clinicId = await getClinicIdFromSession()
    if (!clinicId) {
      return NextResponse.json({ error: 'No clinic associated with session' }, { status: 400 })
    }

    const { id } = await params
    const body = await req.json()
    const { reason } = body

    const intake = await prisma.whatsAppIntake.findFirst({
      where: { id, clinicId },
    })

    if (!intake) {
      return NextResponse.json({ error: 'Intake not found' }, { status: 404 })
    }

    if (intake.status !== 'PENDING') {
      return NextResponse.json({ error: 'Intake has already been processed' }, { status: 400 })
    }

    await prisma.whatsAppIntake.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectionReason: reason || 'No reason provided',
        reviewedById: session.user.id,
        reviewedAt: new Date(),
      },
    })

    await auditLog({
      userId: session.user.id,
      entity: 'WhatsAppIntake',
      entityId: intake.id,
      action: 'INTAKE_REJECTED',
      newValues: { reason: reason || 'No reason provided' },
      ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
      userAgent: req.headers.get('user-agent') || undefined,
    })

    return NextResponse.json({
      success: true,
      message: `Intake request from ${intake.name || intake.phone} has been rejected`,
    })
  } catch (error) {
    console.error('Error rejecting intake:', error)
    return NextResponse.json({ error: 'Failed to reject intake' }, { status: 500 })
  }
}
