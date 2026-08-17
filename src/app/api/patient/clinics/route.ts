import { NextResponse } from 'next/server'
import prisma from '@/lib/db'

// Public endpoint — no auth required.
// Returns only id + name of active clinics for the patient login selector.
export async function GET() {
  try {
    const clinics = await prisma.clinic.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(clinics)
  } catch (error) {
    console.error('Error fetching public clinic list:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
