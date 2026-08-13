import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'

export async function GET() {
  try {
    const session = await requireAuth()
    if (!session || session.user.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const admins = await prisma.user.findMany({
      where: {
        role: 'ADMIN',
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        clinicId: true,
      },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json(admins)
  } catch (error) {
    console.error('Error fetching admins:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
