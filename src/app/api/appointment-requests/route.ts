import { NextResponse } from 'next/server'
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

    const requests = await prisma.appointment.findMany({
      where: {
        requestedByPatient: true,
        status: 'PENDING_APPROVAL',
        patient: { clinicId },
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        doctor: { include: { user: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(requests)
  } catch (error) {
    console.error('Error fetching appointment requests:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
