import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { parseClinicalQuery } from '@/lib/utils'
import { requireAuth, getClinicIdFromSession } from '@/lib/api-auth'

export async function POST(req: Request) {
  try {
    const session = await requireAuth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { query } = body

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    const clinicId = await getClinicIdFromSession()
    if (!clinicId) return NextResponse.json({ error: 'No clinic assigned' }, { status: 400 })

    const parsed = parseClinicalQuery(query)
    let results: any = {}

    switch (parsed.intent) {
      case 'PROLONGED_SWELLING': {
        const days = parseInt(parsed.filters.duration || '10')
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - days)

        const patients = await prisma.patient.findMany({
          where: { clinicId },
          include: {
            treatments: {
              include: {
                checkIns: {
                  where: {
                    status: { not: 'COMPLETED' },
                    dayNumber: { gte: days },
                  },
                  include: {
                    aiAnalyses: { orderBy: { analysisDate: 'desc' }, take: 1 },
                  },
                },
              },
            },
          },
        })

        const patientsWithProlongedSwelling = patients.filter(p =>
          p.treatments.some(t =>
            t.checkIns.some(ci =>
              ci.aiAnalyses.some(a =>
                a.swellingScore > 0.3
              )
            )
          )
        )

        results = {
          intent: parsed.intent,
          query,
          count: patientsWithProlongedSwelling.length,
          patients: patientsWithProlongedSwelling.map(p => ({
            id: p.id,
            name: `${p.firstName} ${p.lastName}`,
            phone: p.phone,
            treatments: p.treatments.map(t => ({
              id: t.id,
              type: t.type,
              date: t.treatmentDate,
              pendingCheckIns: t.checkIns.length,
            })),
          })),
        }
        break
      }

      case 'MISSED_CHECKIN': {
        const missedCheckIns = await prisma.recoveryCheckIn.findMany({
          where: {
            clinicId,
            status: 'PENDING',
            scheduledDate: { lt: new Date() },
          },
          include: {
            patient: { select: { id: true, firstName: true, lastName: true, phone: true } },
            treatment: { select: { id: true, type: true, treatmentDate: true } },
          },
          orderBy: { scheduledDate: 'asc' },
          take: 50,
        })

        results = {
          intent: parsed.intent,
          query,
          count: missedCheckIns.length,
          checkIns: missedCheckIns.map(ci => ({
            id: ci.id,
            patient: `${ci.patient.firstName} ${ci.patient.lastName}`,
            phone: ci.patient.phone,
            treatment: ci.treatment?.type || 'UNKNOWN',
            dayNumber: ci.dayNumber,
            scheduledDate: ci.scheduledDate,
          })),
        }
        break
      }

      case 'VASCULAR_ALERTS': {
        const complications = await prisma.complicationRecord.findMany({
          where: {
            clinicId,
            complicationType: { in: ['VASCULAR_OCCLUSION', 'SKIN_NECROSIS'] },
          },
          include: {
            patient: { select: { id: true, firstName: true, lastName: true, phone: true } },
            treatment: { select: { id: true, type: true, treatmentDate: true, productName: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        })

        results = {
          intent: parsed.intent,
          query,
          count: complications.length,
          complications: complications.map(c => ({
            id: c.id,
            patient: `${c.patient.firstName} ${c.patient.lastName}`,
            phone: c.patient.phone,
            type: c.complicationType,
            severity: c.severity,
            onsetDate: c.onsetDate,
            treatment: c.treatment?.type,
            product: c.treatment?.productName,
            batchNumber: c.batchNumber,
            outcome: c.outcome,
          })),
        }
        break
      }

      case 'COMPLICATIONS': {
        const complications = await prisma.complicationRecord.findMany({
          where: {
            clinicId,
          },
          include: {
            patient: { select: { id: true, firstName: true, lastName: true } },
            treatment: { select: { id: true, type: true, treatmentDate: true, productName: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        })

        results = {
          intent: parsed.intent,
          query,
          count: complications.length,
          complications: complications.map(c => ({
            id: c.id,
            patient: `${c.patient.firstName} ${c.patient.lastName}`,
            type: c.complicationType,
            severity: c.severity,
            onsetDate: c.onsetDate,
            resolutionDate: c.resolutionDate,
            treatment: c.treatment?.type,
            outcome: c.outcome,
          })),
        }
        break
      }

      case 'PATIENT_SEARCH': {
        const searchTerm = parsed.filters.search || query
        const patients = await prisma.patient.findMany({
          where: {
            clinicId,
            OR: [
              { firstName: { contains: searchTerm, mode: 'insensitive' } },
              { lastName: { contains: searchTerm, mode: 'insensitive' } },
              { email: { contains: searchTerm, mode: 'insensitive' } },
              { phone: { contains: searchTerm, mode: 'insensitive' } },
            ],
          },
          include: {
            treatments: { select: { id: true, type: true, treatmentDate: true } },
            _count: { select: { treatments: true, checkIns: true } },
          },
          take: 20,
        })

        results = {
          intent: parsed.intent,
          query,
          count: patients.length,
          patients: patients.map(p => ({
            id: p.id,
            name: `${p.firstName} ${p.lastName}`,
            email: p.email,
            phone: p.phone,
            treatmentCount: p._count.treatments,
            checkInCount: p._count.checkIns,
          })),
        }
        break
      }

      default: {
        results = {
          intent: 'GENERAL',
          query,
          message: 'Query received. Please refine your search for more specific results.',
          suggestions: [
            'Show all patients with prolonged swelling over 10 days',
            'Which lip filler patients missed Day 5 check-in?',
            'Show all vascular occlusion alerts this month',
            'Find complications by product batch',
          ],
        }
      }
    }

    return NextResponse.json(results)
  } catch (error) {
    console.error('Error processing clinical query:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
