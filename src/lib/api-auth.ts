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
  return (session.user as any).clinicId as string | null
}
