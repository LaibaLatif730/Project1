'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Stats {
  totalClinics: number
  totalPatients: number
  totalTreatments: number
  totalAppointments: number
  activeCheckIns: number
}

const features = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
    title: 'Smart Check-ins',
    description: 'Automated recovery tracking with AI-powered risk assessment and personalized follow-up schedules.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: 'Appointment Management',
    description: 'Schedule, reschedule, and manage appointments with intelligent conflict detection and reminders.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    title: 'Complication Tracking',
    description: 'Early detection and management of post-treatment complications with severity classification.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    ),
    title: 'Before & After Photos',
    description: 'Secure photo documentation with AI-assisted comparison and progress visualization.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    title: 'AI-Powered Insights',
    description: 'Intelligent analysis of treatment outcomes, patient trends, and clinical performance metrics.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    title: 'Multi-Clinic Support',
    description: 'Manage multiple clinics with role-based access, isolated data, and centralized administration.',
  },
]

export default function HomePage() {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    fetch('/api/public/stats')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setStats(data) })
      .catch(() => {})
  }, [])

  return (
    <div className="min-h-screen">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 header-glass">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <span className="text-lg font-bold text-white">AI Clinic</span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium text-white/60 hover:text-white transition-colors">Features</a>
            <a href="#impact" className="text-sm font-medium text-white/60 hover:text-white transition-colors">Impact</a>
            <a href="#mission" className="text-sm font-medium text-white/60 hover:text-white transition-colors">Mission</a>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-white/60 hover:text-white transition-colors px-4 py-2">
              Staff Login
            </Link>
            <Link href="/patient/login" className="text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 px-5 py-2.5 rounded-xl transition-all hover:shadow-lg hover:shadow-indigo-500/25">
              Patient Login
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="bg-orbs" />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full badge-glass text-sm mb-8">
            <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            AI-Powered Aesthetic Aftercare
          </div>

          <h1 className="text-5xl md:text-6xl font-extrabold text-white leading-tight mb-6">
            Aesthetic care should{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-500">never end</span>{' '}
            at discharge
          </h1>

          <p className="text-lg text-white/50 max-w-2xl mx-auto mb-10 leading-relaxed">
            The smart clinic assistant for aesthetic treatment aftercare. Automate check-ins, track recovery, detect complications early, and deliver exceptional patient outcomes.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <Link href="/patient/login" className="inline-flex items-center gap-2 px-8 py-4 btn-glass text-lg rounded-xl">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Patient Login
            </Link>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-white/40">
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              AES-256 encrypted
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              HIPAA compliant
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Multi-clinic support
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Real-time analytics
            </span>
          </div>
        </div>
      </section>

      {/* Dashboard Preview */}
      <section className="pb-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="glass-strong rounded-2xl p-1 shadow-2xl shadow-indigo-500/10">
            <div className="bg-secondary rounded-xl overflow-hidden">
              {/* Browser bar */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400"></div>
                  <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                  <div className="w-3 h-3 rounded-full bg-emerald-400"></div>
                </div>
                <div className="flex-1 mx-4">
                  <div className="bg-white/5 rounded-lg px-3 py-1.5 text-xs text-white/30 max-w-xs">
                    app.aiclinic.com/dashboard
                  </div>
                </div>
              </div>
              {/* Dashboard content */}
              <div className="p-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  {[
                    { label: 'Active Patients', value: stats?.totalPatients?.toLocaleString() ?? '---', color: 'bg-indigo-500' },
                    { label: 'Recoveries', value: stats?.totalTreatments?.toLocaleString() ?? '---', color: 'bg-emerald-500' },
                    { label: 'Check-ins', value: stats?.totalAppointments?.toLocaleString() ?? '---', color: 'bg-cyan-500' },
                    { label: 'Pending', value: stats?.activeCheckIns?.toLocaleString() ?? '---', color: 'bg-amber-500' },
                  ].map((stat) => (
                    <div key={stat.label} className="glass-subtle rounded-xl p-4">
                      <div className={`w-2 h-2 rounded-full ${stat.color} mb-2`}></div>
                      <div className="text-2xl font-bold text-white">{stat.value}</div>
                      <div className="text-xs text-white/40 mt-1">{stat.label}</div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2 glass-subtle rounded-xl p-4">
                    <div className="text-sm font-medium text-white/70 mb-3">Recovery Trend</div>
                    <div className="flex items-end gap-2 h-32">
                      {[40, 55, 45, 65, 70, 60, 80, 75, 85, 90, 88, 95].map((h, i) => (
                        <div key={i} className="flex-1 rounded-t-md bg-gradient-to-t from-indigo-500 to-indigo-400 opacity-60" style={{ height: `${h}%` }}></div>
                      ))}
                    </div>
                  </div>
                  <div className="glass-subtle rounded-xl p-4">
                    <div className="text-sm font-medium text-white/70 mb-3">Risk Distribution</div>
                    <div className="flex items-center justify-center">
                      <div className="relative w-28 h-28">
                        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                          <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="12" />
                          <circle cx="50" cy="50" r="40" fill="none" stroke="#22c55e" strokeWidth="12" strokeDasharray="188 252" />
                          <circle cx="50" cy="50" r="40" fill="none" stroke="#f59e0b" strokeWidth="12" strokeDasharray="38 252" strokeDashoffset="-188" />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="text-center">
                            <div className="text-lg font-bold text-white">86%</div>
                            <div className="text-[10px] text-white/40">On Track</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section id="impact" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { value: stats ? `${stats.totalPatients.toLocaleString()}+` : '---', label: 'Patients Managed' },
              { value: stats ? `${stats.totalClinics}+` : '---', label: 'Active Clinics' },
              { value: stats ? `${stats.totalTreatments.toLocaleString()}+` : '---', label: 'Treatments Tracked' },
              { value: stats ? `${stats.activeCheckIns}+` : '---', label: 'Pending Check-ins' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-500 mb-2">
                  {stat.value}
                </div>
                <div className="text-sm text-white/50 font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="text-sm font-semibold text-cyan-400 uppercase tracking-wider mb-3">Platform</div>
            <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4">
              Everything needed for{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-500">smarter aftercare</span>
            </h2>
            <p className="text-white/50 max-w-2xl mx-auto">
              Comprehensive tools for post-treatment monitoring, patient engagement, and clinical excellence.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <div key={feature.title} className="group glass-subtle p-6 rounded-2xl hover:bg-white/10 transition-all duration-300 card-hover">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white mb-4 group-hover:scale-110 transition-transform">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{feature.title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section id="mission" className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="glass-strong rounded-3xl p-12 text-center relative overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2"></div>
            <div className="relative z-10">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto mb-8">
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-6 leading-tight">
                Every patient deserves{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-500">
                  continuous care
                </span>
              </h2>
              <p className="text-lg text-white/50 max-w-2xl mx-auto mb-10 leading-relaxed">
                We combine AI-powered recovery tracking, automated patient engagement, and clinical intelligence to ensure no patient falls through the cracks after their aesthetic treatment.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <span className="text-sm text-white/40 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Trusted by {stats?.totalClinics ?? 0}+ clinics
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div className="md:col-span-2">
              <Link href="/" className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <span className="text-lg font-bold text-white">AI Clinic</span>
              </Link>
              <p className="text-sm text-white/40 max-w-sm">
                Smart clinic assistant for aesthetic treatment aftercare. Automate recovery tracking and deliver exceptional patient outcomes.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Platform</h4>
              <ul className="space-y-2">
                <li><a href="#features" className="text-sm text-white/40 hover:text-white transition-colors">Features</a></li>
                <li><a href="#impact" className="text-sm text-white/40 hover:text-white transition-colors">Impact</a></li>
                <li><a href="#mission" className="text-sm text-white/40 hover:text-white transition-colors">Mission</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Login</h4>
              <ul className="space-y-2">
                <li><Link href="/patient/login" className="text-sm text-white/40 hover:text-white transition-colors">Patient Login</Link></li>
                <li><Link href="/login" className="text-sm text-white/40 hover:text-white transition-colors">Staff Login</Link></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-white/30">&copy; 2026 AI Clinic Assistant. All rights reserved.</p>
            <div className="flex items-center gap-4 text-xs text-white/20">
              <span>AES-256 encrypted</span>
              <span>&middot;</span>
              <span>HIPAA compliant</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
