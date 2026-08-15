import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || !['ADMIN', 'SUPERADMIN'].includes(session.user.role as string)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isSuperAdmin = session.user.role === 'SUPERADMIN'
    const callerClinicId = (session.user as any).clinicId as string | null

    // ADMIN sees only their clinic's stats; SUPERADMIN sees all
    const clinicFilter = !isSuperAdmin && callerClinicId
      ? { clinicId: callerClinicId }
      : {}

    const now = new Date()
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const [
      totalErrors,
      errors24h,
      errorsByLevel,
      errorsByCategory,
      errorsBySource,
      unresolvedCount,
      recentCritical,
      cronHealth,
      whatsappErrors24h,
    ] = await Promise.all([
      prisma.errorLog.count({ where: { ...clinicFilter } }),
      prisma.errorLog.count({ where: { ...clinicFilter, createdAt: { gte: last24h } } }),
      prisma.errorLog.groupBy({ by: ['level'], _count: { id: true }, where: { ...clinicFilter, createdAt: { gte: last7d } } }),
      prisma.errorLog.groupBy({ by: ['category'], _count: { id: true }, where: { ...clinicFilter, createdAt: { gte: last7d } } }),
      prisma.errorLog.groupBy({ by: ['source'], _count: { id: true }, where: { ...clinicFilter, createdAt: { gte: last7d } } }),
      prisma.errorLog.count({ where: { ...clinicFilter, resolved: false } }),
      prisma.errorLog.count({ where: { ...clinicFilter, level: 'CRITICAL', resolved: false } }),
      prisma.errorLog.findMany({
        where: { ...clinicFilter, source: 'CRON', createdAt: { gte: last24h } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { message: true, createdAt: true, category: true },
      }),
      prisma.errorLog.count({
        where: { ...clinicFilter, category: 'whatsapp_webhook', createdAt: { gte: last24h } },
      }),
    ])

    const levelMap: Record<string, number> = {}
    for (const l of errorsByLevel) levelMap[l.level] = l._count.id

    const catMap: Record<string, number> = {}
    for (const c of errorsByCategory) catMap[c.category] = c._count.id

    const srcMap: Record<string, number> = {}
    for (const s of errorsBySource) srcMap[s.source] = s._count.id

    return NextResponse.json({
      summary: {
        totalErrors,
        errors24h,
        unresolvedCount,
        recentCritical,
        whatsappErrors24h,
        // Surface whether this is scoped or global for the UI
        scope: isSuperAdmin ? 'global' : 'clinic',
      },
      errorsByLevel: levelMap,
      errorsByCategory: catMap,
      errorsBySource: srcMap,
      cronHealth: {
        recentErrors: cronHealth.length,
        lastError: cronHealth[0] || null,
      },
    })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
