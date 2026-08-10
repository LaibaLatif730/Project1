import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'
import { auditLog } from '@/lib/audit-log'

export async function GET() {
  try {
    const session = await requireAuth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const clinics = await prisma.clinic.findMany({
      include: {
        _count: {
          select: {
            users: true,
            patients: true,
            treatments: true,
            doctors: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(clinics)
  } catch (error) {
    console.error('Error fetching clinics:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAuth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { name, address, phone, email, timezone } = body

    if (!name) {
      return NextResponse.json({ error: 'Clinic name is required' }, { status: 400 })
    }

    const clinic = await prisma.clinic.create({
      data: {
        name,
        address: address || undefined,
        phone: phone || undefined,
        email: email || undefined,
        timezone: timezone || 'UTC',
      },
    })

    await auditLog({
      userId: session.user.id,
      clinicId: clinic.id,
      action: 'CREATE_CLINIC',
      entity: 'Clinic',
      entityId: clinic.id,
      newValues: { name: clinic.name, address: clinic.address, phone: clinic.phone },
    })

    return NextResponse.json(clinic, { status: 201 })
  } catch (error) {
    console.error('Error creating clinic:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
