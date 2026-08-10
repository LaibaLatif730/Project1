import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { requireAuth, getClinicIdFromSession } from '@/lib/api-auth'

export async function GET(req: Request) {
  try {
    const session = await requireAuth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (session.user.role !== 'RECEPTIONIST' && session.user.role !== 'DOCTOR' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const clinicId = await getClinicIdFromSession()
    if (!clinicId) {
      return NextResponse.json({ error: 'No clinic associated with session' }, { status: 400 })
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || 'PENDING'
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const skip = (page - 1) * limit

    const where: any = { clinicId }
    if (status !== 'ALL') {
      where.status = status
    }

    const [intakes, total] = await Promise.all([
      prisma.whatsAppIntake.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          reviewedBy: { select: { name: true, email: true } },
        },
      }),
      prisma.whatsAppIntake.count({ where }),
    ])

    return NextResponse.json({
      intakes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching intakes:', error)
    return NextResponse.json({ error: 'Failed to fetch intakes' }, { status: 500 })
  }
}
