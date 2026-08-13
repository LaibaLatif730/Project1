import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import bcrypt from 'bcryptjs'
import { requireAuth } from '@/lib/api-auth'
import { auditLog } from '@/lib/audit-log'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const admin = await prisma.user.findFirst({
      where: {
        clinicId: id,
        role: 'ADMIN',
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    })

    return NextResponse.json({ admin: admin || null })
  } catch (error) {
    console.error('Error fetching clinic admin:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

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

    const existingAdmin = await prisma.user.findFirst({
      where: {
        clinicId: id,
        role: 'ADMIN',
      },
    })

    if (existingAdmin) {
      return NextResponse.json(
        { error: 'This clinic already has an assigned admin. Please remove the existing admin first.' },
        { status: 400 }
      )
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

export async function DELETE(
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
    const { adminId } = body

    if (!adminId) {
      return NextResponse.json({ error: 'Admin ID is required' }, { status: 400 })
    }

    const admin = await prisma.user.findFirst({
      where: {
        id: adminId,
        clinicId: id,
        role: 'ADMIN',
      },
    })

    if (!admin) {
      return NextResponse.json({ error: 'Admin not found for this clinic' }, { status: 404 })
    }

    await prisma.user.delete({
      where: { id: adminId },
    })

    await auditLog({
      userId: session.user.id,
      clinicId: id,
      action: 'REMOVE_CLINIC_ADMIN',
      entity: 'User',
      entityId: adminId,
      oldValues: { name: admin.name, email: admin.email, clinicId: id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing clinic admin:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
