import { getServerSession } from 'next-auth'
import { authOptions } from './auth'

export async function requireAuth() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return null
  }
  if (session.user.role === 'PATIENT') {
    return null
  }
  return session
}

export async function requireRole(...roles: string[]) {
  const session = await requireAuth()
  if (!session) return null
  if (!roles.includes(session.user.role)) return null
  return session
}

export async function getClinicIdFromSession(): Promise<string | null> {
  const session = await requireAuth()
  if (!session) return null
  // SuperAdmins have no clinic — they bypass clinic scoping
  if (session.user.role === 'SUPERADMIN') return null
  return (session.user as any).clinicId as string | null
}

export async function requireClinicScoped(): Promise<{ session: any; clinicId: string } | null> {
  const session = await requireAuth()
  if (!session) return null
  if (session.user.role === 'SUPERADMIN') return null
  const clinicId = (session.user as any).clinicId as string | null
  if (!clinicId) return null
  return { session, clinicId }
}
