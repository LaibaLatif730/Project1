'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DashboardPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.role === 'SUPERADMIN') {
          router.replace('/dashboard/super-admin')
        } else if (d?.role === 'ADMIN') {
          router.replace('/dashboard/admin')
        } else if (d?.role === 'DOCTOR') {
          router.replace('/dashboard/doctor')
        } else if (d?.role === 'RECEPTIONIST') {
          router.replace('/dashboard/receptionist')
        } else {
          setChecking(false)
        }
      })
      .catch(() => setChecking(false))
  }, [router])

  if (checking) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  return <div className="text-center py-8 text-muted-foreground">Dashboard not available for your role</div>
}
