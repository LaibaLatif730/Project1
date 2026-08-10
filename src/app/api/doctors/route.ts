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
    if (!clinicId) return NextResponse.json({ error: 'No clinic assigned' }, { status: 400 })

    const doctors = await prisma.doctor.findMany({
      where: { clinicId },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true } },
        _count: { select: { treatments: true, appointments: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(doctors)
  } catch (error) {
    console.error('Error fetching doctors:', error)
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
    if (!clinicId) return NextResponse.json({ error: 'No clinic assigned' }, { status: 400 })

    const body = await req.json()
    const { name, email, password, phone, specialty, licenseNo } = body

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
        role: 'DOCTOR',
        clinicId,
      },
    })

    const doctor = await prisma.doctor.create({
      data: {
        userId: user.id,
        specialty: specialty || undefined,
        licenseNo: licenseNo || undefined,
        clinicId,
      },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
      },
    })

    return NextResponse.json(doctor, { status: 201 })
  } catch (error) {
    console.error('Error creating doctor:', error)
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

    const clinicId = await getClinicIdFromSession()
    if (!clinicId) return NextResponse.json({ error: 'No clinic assigned' }, { status: 400 })

    const body = await req.json()
    const { id, isActive, specialty, licenseNo, name, email, phone } = body

    if (!id) {
      return NextResponse.json({ error: 'Doctor ID is required' }, { status: 400 })
    }

    const doctor = await prisma.doctor.findFirst({
      where: { id, clinicId },
      select: { userId: true },
    })

    if (!doctor) {
      return NextResponse.json({ error: 'Doctor not found' }, { status: 404 })
    }

    const userUpdate: any = {}
    if (name) userUpdate.name = name
    if (email !== undefined) userUpdate.email = email
    if (phone !== undefined) userUpdate.phone = phone || null

    if (isActive !== undefined) {
      userUpdate.role = isActive ? 'DOCTOR' : 'INACTIVE'
    }

    if (Object.keys(userUpdate).length > 0) {
      await prisma.user.update({ where: { id: doctor.userId }, data: userUpdate })
    }

    const updated = await prisma.doctor.update({
      where: { id },
      data: {
        isActive: isActive !== undefined ? isActive : undefined,
        specialty: specialty !== undefined ? specialty || null : undefined,
        licenseNo: licenseNo !== undefined ? licenseNo || null : undefined,
      },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, role: true } },
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating doctor:', error)
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

    const clinicId = await getClinicIdFromSession()
    if (!clinicId) return NextResponse.json({ error: 'No clinic assigned' }, { status: 400 })

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Doctor ID is required' }, { status: 400 })
    }

    const doctor = await prisma.doctor.findFirst({
      where: { id, clinicId },
      select: { userId: true, _count: { select: { treatments: true, appointments: true } } },
    })

    if (!doctor) {
      return NextResponse.json({ error: 'Doctor not found' }, { status: 404 })
    }

    if (doctor._count.treatments > 0 || doctor._count.appointments > 0) {
      await prisma.doctor.update({ where: { id }, data: { isActive: false } })
      await prisma.user.update({ where: { id: doctor.userId }, data: { role: 'INACTIVE' } })
      return NextResponse.json({ success: true, deactivated: true })
    }

    await prisma.doctor.delete({ where: { id } })
    await prisma.user.delete({ where: { id: doctor.userId } })

    return NextResponse.json({ success: true, deleted: true })
  } catch (error) {
    console.error('Error deleting doctor:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
