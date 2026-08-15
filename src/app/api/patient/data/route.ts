import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { requirePatientAuth } from '@/lib/patient-auth'

export async function GET() {
  try {
    const { patientId } = await requirePatientAuth()

    const patient = await prisma.patient.findUnique({
      where: { id: patientId, isActive: true },
      include: {
        clinic: { select: { name: true } },
        treatments: {
          include: {
            checkIns: {
              include: {
                photos: {
                  include: { aiAnalyses: true },
                  orderBy: { uploadDate: 'desc' },
                },
                aiAnalyses: true,
              },
              orderBy: { scheduledDate: 'asc' },
            },
          },
          orderBy: { treatmentDate: 'desc' },
        },
        checkIns: {
          where: { treatmentId: null },
          include: {
            photos: {
              include: { aiAnalyses: true },
              orderBy: { uploadDate: 'desc' },
            },
            aiAnalyses: true,
          },
          orderBy: { scheduledDate: 'asc' },
        },
      },
    })

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    const safeData = {
      id: patient.id,
      firstName: patient.firstName,
      lastName: patient.lastName,
      dateOfBirth: patient.dateOfBirth,
      clinicName: patient.clinic?.name ?? null,
      treatments: patient.treatments,
      standaloneCheckIns: patient.checkIns,
    }

    return NextResponse.json(safeData)
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error fetching patient data:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
