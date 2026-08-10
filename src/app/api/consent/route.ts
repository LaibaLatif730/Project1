import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { requireAuth, getClinicIdFromSession } from '@/lib/api-auth'

export async function GET(req: Request) {
  try {
    const session = await requireAuth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const clinicId = await getClinicIdFromSession()
    if (!clinicId) {
      return NextResponse.json({ error: 'Missing clinicId' }, { status: 400 })
    }

    const { searchParams } = new URL(req.url)
    const patientId = searchParams.get('patientId')
    const status = searchParams.get('status')
    const consentType = searchParams.get('type')

    const where: any = { patient: { clinicId } }
    if (patientId) where.patientId = patientId
    if (status) where.status = status
    if (consentType) where.consentType = consentType

    const records = await prisma.consentRecord.findMany({
      where,
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })

    return NextResponse.json(records)
  } catch (error) {
    console.error('Error fetching consent records:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAuth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const clinicId = await getClinicIdFromSession()
    if (!clinicId) {
      return NextResponse.json({ error: 'Missing clinicId' }, { status: 400 })
    }

    const body = await req.json()
    const { patientId, consentType, version } = body

    const record = await prisma.consentRecord.create({
      data: {
        patientId,
        consentType,
        version: version || '1.0',
        status: 'ACTIVE',
        givenDate: new Date(),
        clinicId,
      },
    })

    return NextResponse.json(record, { status: 201 })
  } catch (error) {
    console.error('Error creating consent record:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await requireAuth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { id, status } = body

    const clinicId = await getClinicIdFromSession()
    if (!clinicId) return NextResponse.json({ error: 'No clinic assigned' }, { status: 400 })
    const existing = await prisma.consentRecord.findFirst({ where: { id, clinicId } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const record = await prisma.consentRecord.update({
      where: { id },
      data: {
        status,
        withdrawnDate: status === 'WITHDRAWN' ? new Date() : undefined,
      },
    })

    return NextResponse.json(record)
  } catch (error) {
    console.error('Error updating consent record:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
