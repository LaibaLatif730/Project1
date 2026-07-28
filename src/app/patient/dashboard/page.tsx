'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'

interface CheckIn {
  id: string
  dayNumber: number
  scheduledDate: string
  status: string
  riskLevel: string
  patientMessage: string
  aiResponse: string
  photos: any[]
  aiAnalyses: any[]
}

interface Treatment {
  id: string
  type: string
  productName: string
  treatmentDate: string
  checkIns: CheckIn[]
}

interface PatientData {
  id: string
  firstName: string
  lastName: string
  phone: string
  treatments: Treatment[]
  standaloneCheckIns: CheckIn[]
  appointments: any[]
}

export default function PatientDashboard() {
  const router = useRouter()
  const [patient, setPatient] = useState<PatientData | null>(null)
  const [loading, setLoading] = useState(true)
  const [patientName, setPatientName] = useState('')

  useEffect(() => {
    const name = localStorage.getItem('patientName')
    setPatientName(name || '')
    fetchPatientData()
  }, [router])

  const fetchPatientData = async () => {
    try {
      const res = await fetch('/api/patient/data')
      if (!res.ok) {
        router.push('/patient/login')
        return
      }
      const data = await res.json()
      setPatient(data)
    } catch (error) {
      console.error('Error fetching patient data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/patient/auth/logout', { method: 'POST' })
    } catch {}
    localStorage.removeItem('patientName')
    router.push('/patient/login')
  }

  const getPendingCheckIns = () => {
    if (!patient) return []
    const allCheckIns: (CheckIn & { treatmentType: string })[] = []
    patient.treatments.forEach((t) => {
      t.checkIns.forEach((ci) => {
        if (ci.status === 'PENDING' || ci.status === 'SENT') {
          allCheckIns.push({ ...ci, treatmentType: t.type })
        }
      })
    })
    patient.standaloneCheckIns?.forEach((ci) => {
      if (ci.status === 'PENDING' || ci.status === 'SENT') {
        allCheckIns.push({ ...ci, treatmentType: 'General' })
      }
    })

    const seen = new Set<string>()
    const unique = allCheckIns.filter((ci) => {
      const key = `${ci.dayNumber}-${ci.treatmentType}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    return unique.sort((a, b) => a.dayNumber - b.dayNumber)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-white/20 border-t-cyan-400 rounded-full animate-spin" />
      </div>
    )
  }

  if (!patient) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass-strong p-8 text-center">
          <p className="text-white/70">Patient not found</p>
          <Button onClick={() => router.push('/patient/login')} className="btn-primary mt-4">
            Go to Login
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen relative">
      <div className="bg-orbs" />
      
      {/* Header */}
      <header className="header-glass sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <span className="text-xl font-bold text-white">AI Clinic</span>
          </div>
          
          <div className="flex items-center gap-4">
            <a href="/patient/appointments" className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium hover:shadow-lg hover:shadow-cyan-500/25 transition-all text-sm">
              My Appointments
            </a>
            <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-white/5 border border-white/10">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white text-sm font-bold">
                {patient.firstName[0]}{patient.lastName[0]}
              </div>
              <span className="text-white/90 font-medium hidden sm:block">{patientName}</span>
            </div>
            <Button onClick={handleLogout} className="btn-danger">
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Welcome Section */}
        <div className="glass-strong p-8 animate-fade-in">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-2xl font-bold text-white glow-accent">
              {patient.firstName[0]}{patient.lastName[0]}
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Welcome, {patient.firstName}!</h1>
              <p className="text-white/60">Track your recovery progress and upload photos</p>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="glass p-6 card-hover animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <span className="badge-glass badge-info">{patient.treatments.length}</span>
            </div>
            <h3 className="text-2xl font-bold text-white">{patient.treatments.length}</h3>
            <p className="text-white/50 text-sm">Total Treatments</p>
          </div>

          <div className="glass p-6 card-hover animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="badge-glass badge-success">{patient.appointments?.length ?? 0}</span>
            </div>
            <h3 className="text-2xl font-bold text-white">{patient.appointments?.length ?? 0}</h3>
            <p className="text-white/50 text-sm">Appointments</p>
          </div>
        </div>

        {/* Pending Check-ins */}
        {getPendingCheckIns().length > 0 && (
          <div className="glass p-6 animate-fade-in" style={{ animationDelay: '0.4s' }}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white">Pending Recovery Check-ins</h2>
            </div>
            <div className="space-y-4">
              {getPendingCheckIns().map((checkIn, index) => (
                <div 
                  key={checkIn.id} 
                  className="glass-subtle p-5 card-hover flex items-center justify-between"
                  style={{ animationDelay: `${0.5 + index * 0.1}s` }}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                      <span className="text-xl font-bold text-white">D{checkIn.dayNumber}</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">Day {checkIn.dayNumber} Check-in</h3>
                      <p className="text-sm text-white/50">
                        {checkIn.treatmentType.replace(/_/g, ' ')} • {formatDate(checkIn.scheduledDate)}
                      </p>
                    </div>
                  </div>
                  <Button 
                    onClick={() => router.push(`/patient/checkin/${checkIn.id}`)}
                    className="btn-primary"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Upload Photos
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Treatment History */}
        <div className="glass p-6 animate-fade-in" style={{ animationDelay: '0.6s' }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white">Your Treatments</h2>
          </div>

          {patient.treatments.length === 0 ? (
            <div className="text-center py-12 glass-subtle rounded-xl">
              <p className="text-white/50">No treatments found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {patient.treatments.map((treatment, index) => (
                <div 
                  key={treatment.id} 
                  className="glass-subtle p-5 card-hover"
                  style={{ animationDelay: `${0.7 + index * 0.1}s` }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">
                        {treatment.type.replace(/_/g, ' ')}
                        {treatment.productName && ` - ${treatment.productName}`}
                      </h3>
                      <p className="text-sm text-white/50">{formatDate(treatment.treatmentDate)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="glass-strong p-6 animate-fade-in" style={{ animationDelay: '0.8s' }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white">Need Help?</h2>
          </div>
          <p className="text-white/60 text-sm">Contact your clinic if you have any concerns about your recovery. Our medical team is here to help.</p>
        </div>
      </main>
    </div>
  )
}
