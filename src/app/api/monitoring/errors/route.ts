import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || !['ADMIN', 'SUPERADMIN'].includes(session.user.role as string)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = req.nextUrl
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100)
    const level = url.searchParams.get('level')
    const category = url.searchParams.get('category')
    const source = url.searchParams.get('source')
    const resolved = url.searchParams.get('resolved')
    const search = url.searchParams.get('search')

    const where: Record<string, unknown> = {}

    if (level) where.level = level
    if (category) where.category = category
    if (source) where.source = source
    if (resolved !== null && resolved !== undefined && resolved !== '') {
      where.resolved = resolved === 'true'
    }
    if (search) {
      where.OR = [
        { message: { contains: search, mode: 'insensitive' } },
        { endpoint: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [errors, total] = await Promise.all([
      prisma.errorLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          level: true,
          source: true,
          category: true,
          message: true,
          stackTrace: true,
          metadata: true,
          statusCode: true,
          endpoint: true,
          method: true,
          userId: true,
          resolved: true,
          resolvedAt: true,
          resolvedBy: true,
          createdAt: true,
        },
      }),
      prisma.errorLog.count({ where }),
    ])

    return NextResponse.json({
      errors,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || !['ADMIN', 'SUPERADMIN'].includes(session.user.role as string)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { id, resolved } = body

    if (!id) {
      return NextResponse.json({ error: 'ID required' }, { status: 400 })
    }

    const updated = await prisma.errorLog.update({
      where: { id },
      data: {
        resolved,
        resolvedAt: resolved ? new Date() : null,
        resolvedBy: resolved ? session.user.id : null,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
