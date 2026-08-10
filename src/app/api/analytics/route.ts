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
      return NextResponse.json({ error: 'No clinic associated with session' }, { status: 400 })
    }

    const role = session.user.role

    if (role === 'ADMIN') {
      return adminAnalytics(clinicId)
    } else if (role === 'DOCTOR') {
      return doctorAnalytics(session.user.id, clinicId)
    } else if (role === 'RECEPTIONIST') {
      return receptionistAnalytics(clinicId)
    }

    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  } catch (error) {
    console.error('Error fetching analytics:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function adminAnalytics(clinicId: string) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const eightWeeksAgo = new Date(now.getTime() - 56 * 24 * 60 * 60 * 1000)

  const [
    totalDoctors,
    totalReceptionists,
    totalPatients,
    totalTreatments,
    totalAppointments,
    recentPatients,
    recentTreatments,
    recentAppointments,
    complications,
    auditLogs,
    completedCheckIns,
    pendingCheckIns,
    escalatedCheckIns,
    riskRows,
    treatmentTypeRows,
    complicationTypeRows,
    weeklyCheckIns,
  ] = await Promise.all([
    prisma.user.count({ where: { role: 'DOCTOR', clinicId } }),
    prisma.user.count({ where: { role: 'RECEPTIONIST', clinicId } }),
    prisma.patient.count({ where: { isActive: true, clinicId } }),
    prisma.treatment.count({ where: { clinicId } }),
    prisma.appointment.count({ where: { clinicId } }),
    prisma.patient.count({ where: { createdAt: { gte: thirtyDaysAgo }, clinicId } }),
    prisma.treatment.count({ where: { createdAt: { gte: thirtyDaysAgo }, clinicId } }),
    prisma.appointment.count({ where: { createdAt: { gte: thirtyDaysAgo }, clinicId } }),
    prisma.complicationRecord.count({ where: { reportedToRegulatory: false, clinicId } }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        action: true,
        entity: true,
        entityId: true,
        createdAt: true,
        user: { select: { name: true, role: true } },
      },
      where: {
        user: { clinicId },
      },
    }),
    prisma.recoveryCheckIn.count({ where: { status: 'COMPLETED', clinicId } }),
    prisma.recoveryCheckIn.count({ where: { status: 'PENDING', clinicId } }),
    prisma.recoveryCheckIn.count({ where: { status: 'ESCALATED', clinicId } }),
    prisma.recoveryCheckIn.groupBy({
      by: ['riskLevel'],
      _count: { id: true },
      where: { clinicId },
    }),
    prisma.treatment.groupBy({
      by: ['type'],
      _count: { id: true },
      where: { clinicId },
    }),
    prisma.complicationRecord.groupBy({
      by: ['complicationType'],
      _count: { id: true },
      where: { clinicId },
    }),
    prisma.recoveryCheckIn.findMany({
      where: { createdAt: { gte: eightWeeksAgo }, clinicId },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
  ])

  const riskDistribution = riskRows.map(r => ({ level: r.riskLevel, count: r._count.id }))
  const treatmentTypeDistribution = treatmentTypeRows.map(r => ({ type: r.type, count: r._count.id }))
  const complicationStats = complicationTypeRows.map(r => ({ type: r.complicationType, count: r._count.id }))

  const weekMap = new Map<string, number>()
  for (let i = 7; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 7 * 24 * 60 * 60 * 1000)
    const label = d.toISOString().split('T')[0]
    weekMap.set(label, 0)
  }
  for (const row of weeklyCheckIns) {
    const d = row.createdAt
    const weekStart = new Date(d.getTime() - d.getDay() * 24 * 60 * 60 * 1000)
    const label = weekStart.toISOString().split('T')[0]
    if (weekMap.has(label)) {
      weekMap.set(label, (weekMap.get(label) || 0) + 1)
    }
  }
  const weeklyTrend = Array.from(weekMap.entries()).map(([date, count]) => ({ date, count }))

  return NextResponse.json({
    totalDoctors,
    totalReceptionists,
    totalPatients,
    totalTreatments,
    totalAppointments,
    recentPatients,
    recentTreatments,
    recentAppointments,
    unreportedComplications: complications,
    staffActivity: auditLogs,
    completedCheckIns,
    pendingCheckIns,
    escalatedCheckIns,
    riskDistribution,
    treatmentTypeDistribution,
    complicationStats,
    weeklyTrend,
  })
}

async function doctorAnalytics(userId: string, clinicId: string) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)

  const doctor = await prisma.doctor.findUnique({
    where: { userId },
    select: { id: true },
  })

  if (!doctor) {
    return NextResponse.json({ error: 'Doctor profile not found' }, { status: 404 })
  }

  const [
    todayAppointments,
    flaggedCheckIns,
    pendingCheckIns,
    totalPatients,
    recentTreatments,
  ] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        doctorId: doctor.id,
        clinicId,
        appointmentDate: { gte: today, lt: tomorrow },
        status: { not: 'CANCELLED' },
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, phone: true } },
      },
      orderBy: { appointmentDate: 'asc' },
    }),
    prisma.recoveryCheckIn.findMany({
      where: {
        clinicId,
        riskLevel: { in: ['ORANGE', 'RED'] },
        status: { not: 'COMPLETED' },
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        treatment: { select: { type: true } },
        photos: {
          include: {
            aiAnalyses: { select: { riskLevel: true, clinicalSummary: true, createdAt: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { scheduledDate: 'asc' },
      take: 10,
    }),
    prisma.recoveryCheckIn.count({
      where: { status: 'PENDING', clinicId },
    }),
    prisma.patient.count({ where: { isActive: true, clinicId } }),
    prisma.treatment.findMany({
      where: { clinicId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        patient: { select: { firstName: true, lastName: true } },
      },
    }),
  ])

  return NextResponse.json({
    todayAppointments,
    flaggedCheckIns,
    pendingCheckIns,
    totalPatients,
    recentTreatments,
  })
}

async function receptionistAnalytics(clinicId: string) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)

  const [
    todayAppointments,
    upcomingAppointments,
    pendingCheckIns,
    totalPatients,
    priorityFlaggedPatients,
  ] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        clinicId,
        appointmentDate: { gte: today, lt: tomorrow },
        status: { not: 'CANCELLED' },
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, phone: true } },
        doctor: { include: { user: { select: { name: true } } } },
      },
      orderBy: { appointmentDate: 'asc' },
    }),
    prisma.appointment.findMany({
      where: {
        clinicId,
        appointmentDate: { gte: tomorrow },
        status: 'SCHEDULED',
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        doctor: { include: { user: { select: { name: true } } } },
      },
      orderBy: { appointmentDate: 'asc' },
      take: 10,
    }),
    prisma.recoveryCheckIn.findMany({
      where: {
        clinicId,
        status: 'COMPLETED',
        completedDate: { gte: today },
      },
      select: {
        id: true,
        dayNumber: true,
        completedDate: true,
        patient: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.patient.count({ where: { isActive: true, clinicId } }),
    prisma.patient.findMany({
      where: { isActive: true, clinicId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
      },
      take: 10,
    }),
  ])

  return NextResponse.json({
    todayAppointments,
    upcomingAppointments,
    todayCompletedCheckIns: pendingCheckIns,
    totalPatients,
    priorityFlaggedPatients,
  })
}
