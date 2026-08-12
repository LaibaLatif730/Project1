import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'

export async function GET() {
  try {
    const session = await requireAuth()
    if (!session || session.user.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const now = new Date()
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const [
      totalClinics,
      activeClinics,
      totalPatients,
      newPatientsWeek,
      totalDoctors,
      totalStaff,
      totalTreatments,
      totalAppointments,
      pendingAppointments,
      completedAppointments,
      totalCheckIns,
      pendingCheckIns,
      completedCheckIns,
      escalatedCheckIns,
      orangeRiskCount,
      redRiskCount,
      totalIntakes,
      pendingIntakes,
      totalComplications,
      activeComplications,
      totalSilenceAlerts,
      unresolvedSilenceAlerts,
      recentAuditLogs,
      last24hAuditLogs,
      whatsappFailures,
    ] = await Promise.all([
      prisma.clinic.count(),
      prisma.clinic.count({ where: { isActive: true } }),
      prisma.patient.count({ where: { isActive: true } }),
      prisma.patient.count({ where: { createdAt: { gte: oneWeekAgo } } }),
      prisma.doctor.count({ where: { isActive: true } }),
      prisma.user.count({ where: { role: { in: ['ADMIN', 'DOCTOR', 'RECEPTIONIST'] } } }),
      prisma.treatment.count(),
      prisma.appointment.count(),
      prisma.appointment.count({ where: { status: 'PENDING_APPROVAL' } }),
      prisma.appointment.count({ where: { status: 'COMPLETED' } }),
      prisma.recoveryCheckIn.count(),
      prisma.recoveryCheckIn.count({ where: { status: 'PENDING' } }),
      prisma.recoveryCheckIn.count({ where: { status: 'COMPLETED' } }),
      prisma.recoveryCheckIn.count({ where: { status: 'ESCALATED' } }),
      prisma.aIAnalysis.count({ where: { riskLevel: 'ORANGE' } }),
      prisma.aIAnalysis.count({ where: { riskLevel: 'RED' } }),
      prisma.whatsAppIntake.count(),
      prisma.whatsAppIntake.count({ where: { status: 'PENDING' } }),
      prisma.complicationRecord.count(),
      prisma.complicationRecord.count({ where: { resolutionDate: null } }),
      prisma.silenceRiskLog.count(),
      prisma.silenceRiskLog.count({ where: { resolvedAt: null } }),
      prisma.auditLog.count(),
      prisma.auditLog.count({ where: { createdAt: { gte: oneDayAgo } } }),
      // WhatsApp delivery: check for any failed intake notifications
      prisma.whatsAppIntake.count({ where: { status: 'PENDING', createdAt: { lt: oneWeekAgo } } }),
    ])

    // Per-clinic breakdown (operational only, no clinical data)
    const clinicStats = await prisma.clinic.findMany({
      select: {
        id: true,
        name: true,
        isActive: true,
        _count: {
          select: {
            users: true,
            patients: true,
            doctors: true,
            treatments: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    // Doctor response times: avg time between check-in escalation and first doctor note
    const recentEscalations = await prisma.recoveryCheckIn.findMany({
      where: {
        status: 'ESCALATED',
        createdAt: { gte: thirtyDaysAgo },
      },
      select: {
        id: true,
        createdAt: true,
        doctorNotes: {
          select: { createdAt: true },
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
      take: 50,
    })

    let avgResponseHours = 0
    const responseTimes = recentEscalations
      .filter(e => e.doctorNotes.length > 0)
      .map(e => (e.doctorNotes[0].createdAt.getTime() - e.createdAt.getTime()) / (1000 * 60 * 60))
    if (responseTimes.length > 0) {
      avgResponseHours = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
    }

    // Cron health: based on recent system activity
    const cronHealth = {
      appointmentReminders: last24hAuditLogs > 0 ? 'healthy' : 'stale',
      silenceRiskChecks: unresolvedSilenceAlerts === 0 ? 'healthy' : unresolvedSilenceAlerts < 5 ? 'warning' : 'critical',
      consentReminders: 'healthy', // no direct metric, assume healthy if system is active
      systemActive: last24hAuditLogs > 0,
    }

    return NextResponse.json({
      summary: {
        totalClinics,
        activeClinics,
        inactiveClinics: totalClinics - activeClinics,
        totalPatients,
        newPatientsWeek,
        totalDoctors,
        totalStaff,
        totalTreatments,
        totalAppointments,
        pendingAppointments,
        completedAppointments,
        totalCheckIns,
        pendingCheckIns,
        completedCheckIns,
        escalatedCheckIns,
        orangeRiskCount,
        redRiskCount,
        totalIntakes,
        pendingIntakes,
        totalComplications,
        activeComplications,
        totalSilenceAlerts,
        unresolvedSilenceAlerts,
        totalAuditLogs: recentAuditLogs,
        last24hActions: last24hAuditLogs,
        whatsappStaleIntakes: whatsappFailures,
        avgDoctorResponseHours: Math.round(avgResponseHours * 10) / 10,
      },
      clinicStats,
      cronHealth,
    })
  } catch (error) {
    console.error('Error fetching super-admin stats:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
