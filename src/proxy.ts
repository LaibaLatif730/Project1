import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { jwtVerify } from 'jose'

const PATIENT_SECRET = new TextEncoder().encode(
  process.env.PATIENT_SESSION_SECRET || process.env.NEXTAUTH_SECRET || 'fallback-patient-session-secret-change-in-production'
)

// Admin CANNOT access these — Doctor/Receptionist only
const STAFF_ONLY_PATHS = [
  '/dashboard/patients/new',
  '/dashboard/treatments/new',
  '/dashboard/appointments/new',
  '/dashboard/clinical-notes/new',
  '/dashboard/checkins',
  '/dashboard/before-after',
]

// Admin ONLY paths — Doctor/Receptionist/Patient CANNOT access
const ADMIN_ONLY_PATHS = [
  '/dashboard/doctors',
  '/dashboard/analytics',
  '/dashboard/compliance',
  '/dashboard/products',
  '/dashboard/consent',
]

// Doctor ONLY paths — Receptionist and Admin CANNOT access
const DOCTOR_ONLY_PATHS = [
  '/dashboard/treatments',
  '/dashboard/clinical-notes',
  '/dashboard/protocols',
]

async function hasValidPatientSession(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get('patient-session')?.value
  if (!token) return false
  try {
    await jwtVerify(token, PATIENT_SECRET)
    return true
  } catch {
    return false
  }
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // ── Protect /dashboard routes ──────────────────────────────────────
  if (pathname.startsWith('/dashboard')) {
    // Use NextAuth's getToken — works correctly with NextAuth JWT format
    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET || 'fallback-nextauth-secret',
    })

    if (!token) {
      const loginUrl = new URL('/login', req.url)
      loginUrl.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(loginUrl)
    }

    const role = token.role as string | undefined

    // Patients must NEVER access the staff dashboard
    if (!role || role === 'PATIENT') {
      return NextResponse.redirect(new URL('/patient/login', req.url))
    }

    // Inactive users are blocked from the dashboard
    if (role === 'INACTIVE') {
      const loginUrl = new URL('/login', req.url)
      loginUrl.searchParams.set('error', 'account_inactive')
      return NextResponse.redirect(loginUrl)
    }

    // SuperAdmin can ONLY access /dashboard/super-admin
    if (role === 'SUPERADMIN') {
      if (!pathname.startsWith('/dashboard/super-admin')) {
        return NextResponse.redirect(new URL('/dashboard/super-admin', req.url))
      }
      return NextResponse.next()
    }

    // Staff cannot access super-admin path
    if (pathname.startsWith('/dashboard/super-admin')) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    // Admin cannot access staff-only paths
    if (role === 'ADMIN') {
      const isStaffPath = STAFF_ONLY_PATHS.some(
        p => pathname === p || pathname.startsWith(p + '/')
      )
      if (isStaffPath) {
        return NextResponse.redirect(new URL('/dashboard', req.url))
      }
    }

    // Receptionist cannot access admin or doctor paths
    if (role === 'RECEPTIONIST') {
      const blocked =
        ADMIN_ONLY_PATHS.some(p => pathname === p || pathname.startsWith(p + '/')) ||
        DOCTOR_ONLY_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
      if (blocked) {
        return NextResponse.redirect(new URL('/dashboard', req.url))
      }
    }

    // Doctor cannot access admin paths
    if (role === 'DOCTOR') {
      const isAdminPath = ADMIN_ONLY_PATHS.some(
        p => pathname === p || pathname.startsWith(p + '/')
      )
      if (isAdminPath) {
        return NextResponse.redirect(new URL('/dashboard', req.url))
      }
    }
  }

  // ── Protect /patient routes ────────────────────────────────────────
  if (pathname.startsWith('/patient') && !pathname.startsWith('/patient/login')) {
    if (!(await hasValidPatientSession(req))) {
      return NextResponse.redirect(new URL('/patient/login', req.url))
    }
  }

  // ── Protect /api/patient routes ───────────────────────────────────
  if (
    pathname.startsWith('/api/patient/') &&
    !pathname.startsWith('/api/patient/auth') &&
    !pathname.startsWith('/api/patient/clinics')
  ) {
    if (!(await hasValidPatientSession(req))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/patient/:path*', '/api/patient/:path*'],
}
