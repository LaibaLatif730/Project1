import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/db'
import { requireAuth, getClinicIdFromSession } from '@/lib/api-auth'

export async function GET() {
  try {
    const session = await requireAuth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const clinicId = await getClinicIdFromSession()
    if (!clinicId) {
      return NextResponse.json({ error: 'Missing clinicId' }, { status: 400 })
    }

    const receptionists = await prisma.user.findMany({
      where: { role: { in: ['RECEPTIONIST', 'INACTIVE'] }, clinicId },
      select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(receptionists)
  } catch (error) {
    console.error('Error fetching receptionists:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAuth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
    }

    const clinicId = await getClinicIdFromSession()
    if (!clinicId) {
      return NextResponse.json({ error: 'Missing clinicId' }, { status: 400 })
    }

    const body = await req.json()
    const { name, email, password, phone } = body

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
        phone: phone || undefined,
        role: 'RECEPTIONIST',
        clinicId,
      },
      select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true },
    })

    return NextResponse.json(user, { status: 201 })
  } catch (error) {
    console.error('Error creating receptionist:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await requireAuth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
    }

    const body = await req.json()
    const { id, name, email, phone, role } = body

    if (!id) {
      return NextResponse.json({ error: 'Receptionist ID is required' }, { status: 400 })
    }

    const clinicId = await getClinicIdFromSession()
    if (!clinicId) return NextResponse.json({ error: 'No clinic assigned' }, { status: 400 })

    const existing = await prisma.user.findFirst({ where: { id, clinicId } })
    if (!existing || (existing.role !== 'RECEPTIONIST' && existing.role !== 'INACTIVE')) {
      return NextResponse.json({ error: 'Receptionist not found' }, { status: 404 })
    }

    const updateData: any = {}
    if (name) updateData.name = name
    if (email !== undefined) updateData.email = email
    if (phone !== undefined) updateData.phone = phone || null
    if (role !== undefined && (role === 'RECEPTIONIST' || role === 'INACTIVE')) updateData.role = role

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating receptionist:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await requireAuth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Receptionist ID is required' }, { status: 400 })
    }

    const clinicId = await getClinicIdFromSession()
    if (!clinicId) return NextResponse.json({ error: 'No clinic assigned' }, { status: 400 })

    const existing = await prisma.user.findFirst({ where: { id, clinicId } })
    if (!existing) {
      return NextResponse.json({ error: 'Receptionist not found' }, { status: 404 })
    }

    if (existing.role !== 'RECEPTIONIST' && existing.role !== 'INACTIVE') {
      return NextResponse.json({ error: 'Receptionist not found' }, { status: 404 })
    }

    await prisma.user.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting receptionist:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
