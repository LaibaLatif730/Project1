import { NextResponse } from 'next/server'
import prisma from '@/lib/db'

// Public endpoint — no auth required.
// Returns aggregate stats for the landing page.
export async function GET() {
  try {
    const [
      totalClinics,
      totalPatients,
      totalTreatments,
      totalAppointments,
      activeCheckIns,
    ] = await Promise.all([
      prisma.clinic.count({ where: { isActive: true } }),
      prisma.patient.count({ where: { isActive: true } }),
      prisma.treatment.count(),
      prisma.appointment.count(),
      prisma.recoveryCheckIn.count({ where: { status: 'PENDING' } }),
    ])

    return NextResponse.json({
      totalClinics,
      totalPatients,
      totalTreatments,
      totalAppointments,
      activeCheckIns,
    })
  } catch (error) {
    console.error('Error fetching public stats:', error)
    return NextResponse.json({
      totalClinics: 0,
      totalPatients: 0,
      totalTreatments: 0,
      totalAppointments: 0,
      activeCheckIns: 0,
    })
  }
}
