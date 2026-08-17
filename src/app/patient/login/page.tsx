'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FieldError } from '@/components/FieldError'

interface Clinic {
  id: string
  name: string
}

function PatientLoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const registered = searchParams.get('registered')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [clinicId, setClinicId] = useState('')
  const [clinics, setClinics] = useState<Clinic[]>([])
  const [clinicsLoading, setClinicsLoading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fieldError, setFieldError] = useState('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setClinicsLoading(true)
    fetch('/api/patient/clinics')
      .then(r => r.json())
      .then(data => {
        setClinics(data)
        if (data.length === 1) setClinicId(data[0].id)
      })
      .catch(() => {})
      .finally(() => setClinicsLoading(false))
  }, [])

  const validateEmail = (value: string): boolean => {
    if (!value) { setFieldError('Email is required'); return false }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) { setFieldError('Please enter a valid email address'); return false }
    setFieldError('')
    return true
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!validateEmail(email)) return
    if (!password || password.length < 6) { setFieldError('Password must be at least 6 characters'); return }
    if (!clinicId) { setError('Please select your clinic'); return }
    setFieldError('')
    setLoading(true)
    try {
      const res = await fetch('/api/patient/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, clinicId }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.name) localStorage.setItem('patientName', data.name)
        router.push('/patient/dashboard')
      } else {
        const data = await res.json()
        setError(data.error || 'Invalid credentials')
      }
    } catch {
      setError('An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      <div className="bg-orbs" />

      <div className="absolute top-8 left-8 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <span className="text-xl font-bold text-white">AI Clinic</span>
      </div>

      <div className="glass-strong w-full max-w-md p-8 animate-fade-in">
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center mx-auto mb-6 glow-accent">
            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Patient Portal</h1>
          <p className="text-white/60">Select your clinic and sign in</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          {error && (
            <div className="p-4 rounded-xl bg-red-500/20 border border-red-500/30 text-red-300 text-sm flex items-center gap-3">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}

          {registered && (
            <div className="p-4 rounded-xl bg-green-500/20 border border-green-500/30 text-green-300 text-sm flex items-center gap-3">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Account created successfully! Please sign in.
            </div>
          )}

          {/* Clinic selector — only rendered client-side to avoid hydration mismatch */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-white/80 block">Clinic</label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              {!mounted ? (
                <div className="w-full pl-12 pr-4 h-12 rounded-xl bg-white/10 border border-white/20 flex items-center">
                  <span className="text-white/40 text-sm">Loading clinics...</span>
                </div>
              ) : (
                <select
                  value={clinicId}
                  onChange={e => setClinicId(e.target.value)}
                  required
                  disabled={clinicsLoading}
                  className="w-full pl-12 pr-4 h-12 rounded-xl bg-white/10 border border-white/20 text-white text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 disabled:opacity-50"
                >
                  <option value="" disabled className="bg-gray-900">
                    {clinicsLoading ? 'Loading clinics...' : 'Select your clinic'}
                  </option>
                  {clinics.map(c => (
                    <option key={c.id} value={c.id} className="bg-gray-900 text-white">
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          {/* Email */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-white/80 block">Email</label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                </svg>
              </div>
              <Input
                type="email"
                placeholder="patient@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="pl-12"
                required
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-white/80 block">Password</label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <Input
                type="password"
                placeholder="Your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="pl-12"
                required
              />
            </div>
            <FieldError error={fieldError} />
          </div>

          <Button type="submit" className="btn-primary w-full h-14 text-lg" disabled={loading || !mounted || clinicsLoading}>
            {loading ? (
              <span className="flex items-center justify-center gap-3">
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Signing in...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                Sign In
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </span>
            )}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-white/50">
            Don&apos;t have an account?{' '}
            <a href="/signup" className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
              Create one
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function PatientLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-8 h-8 border-2 border-white/20 border-t-white rounded-full" /></div>}>
      <PatientLoginForm />
    </Suspense>
  )
}
