import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import bcrypt from 'bcryptjs'
import { setPatientSessionCookie } from '@/lib/patient-auth'

const attempts = new Map<string, { count: number; resetAt: number }>()
const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000

function checkRateLimit(key: string): boolean {
  const now = Date.now()
  const record = attempts.get(key)

  if (!record || now > record.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return true
  }

  if (record.count >= MAX_ATTEMPTS) {
    return false
  }

  record.count++
  return true
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { email, password, clinicId } = body

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    if (!clinicId) {
      return NextResponse.json({ error: 'Please select your clinic' }, { status: 400 })
    }

    const normalizedEmail = email.toLowerCase().trim()

    if (!checkRateLimit(normalizedEmail)) {
      return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 })
    }

    // First try: Patient record with a passwordHash (WhatsApp/PIN-set patients)
    // Scoped to the selected clinic to prevent cross-clinic email collisions
    const patient = await prisma.patient.findFirst({
      where: { isActive: true, email: normalizedEmail, clinicId },
      select: { id: true, firstName: true, lastName: true, email: true, passwordHash: true, userId: true },
    })

    if (patient && patient.passwordHash) {
      const valid = await bcrypt.compare(password, patient.passwordHash)
      if (!valid) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
      }
      attempts.delete(normalizedEmail)
      await setPatientSessionCookie(patient.id)
      return NextResponse.json({ name: `${patient.firstName} ${patient.lastName}` })
    }

    // Second try: User table (patients registered via the signup form)
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, name: true, email: true, password: true, role: true, clinicId: true },
    })

    if (!user || user.role !== 'PATIENT' || !user.password) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    // Enforce clinic match for User-based patients too
    if (user.clinicId && user.clinicId !== clinicId) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    // Ensure a Patient record exists and is linked to the User
    let patientRecord = await prisma.patient.findFirst({
      where: { userId: user.id },
      select: { id: true },
    })

    if (!patientRecord) {
      // Also check by email + clinicId
      patientRecord = await prisma.patient.findFirst({
        where: { email: normalizedEmail, clinicId },
        select: { id: true },
      })

      if (patientRecord) {
        await prisma.patient.update({
          where: { id: patientRecord.id },
          data: { userId: user.id },
        })
      } else {
        const nameParts = user.name?.trim().split(/\s+/) || ['Patient']
        patientRecord = await prisma.patient.create({
          data: {
            userId: user.id,
            firstName: nameParts[0],
            lastName: nameParts.slice(1).join(' ') || nameParts[0],
            email: user.email,
            clinicId,
            isActive: true,
            consentGiven: true,
            consentDate: new Date(),
          },
        })
      }
    }

    attempts.delete(normalizedEmail)
    await setPatientSessionCookie(patientRecord.id)

    return NextResponse.json({ name: user.name })
  } catch (error) {
    console.error('Patient auth error:', error)
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 })
  }
}
