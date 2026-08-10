import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import bcrypt from 'bcryptjs'
import { requireAuth } from '@/lib/api-auth'
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

    if (session.user.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    const clinic = await prisma.clinic.findUnique({ where: { id } })
    if (!clinic) {
      return NextResponse.json({ error: 'Clinic not found' }, { status: 404 })
    }

    const body = await req.json()
    const { name, email, password } = body

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Name, email and password are required' }, { status: 400 })
    }

    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: 'ADMIN',
        clinicId: id,
      },
    })

    await auditLog({
      userId: session.user.id,
      clinicId: id,
      action: 'ASSIGN_CLINIC_ADMIN',
      entity: 'User',
      entityId: user.id,
      newValues: { name, email, clinicId: id, clinicName: clinic.name },
    })

    return NextResponse.json({ id: user.id, name: user.name, email: user.email, role: user.role }, { status: 201 })
  } catch (error) {
    console.error('Error creating clinic admin:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
