'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Summary {
  totalClinics: number
  activeClinics: number
  inactiveClinics: number
  totalPatients: number
  newPatientsWeek: number
  totalDoctors: number
  totalStaff: number
  totalTreatments: number
  totalAppointments: number
  pendingAppointments: number
  completedAppointments: number
  totalCheckIns: number
  pendingCheckIns: number
  completedCheckIns: number
  escalatedCheckIns: number
  orangeRiskCount: number
  redRiskCount: number
  totalIntakes: number
  pendingIntakes: number
  totalComplications: number
  activeComplications: number
  totalSilenceAlerts: number
  unresolvedSilenceAlerts: number
  totalAuditLogs: number
  last24hActions: number
  whatsappStaleIntakes: number
  avgDoctorResponseHours: number
}

interface ClinicCount {
  users: number
  patients: number
  doctors: number
  treatments: number
}

interface ClinicStat {
  id: string
  name: string
  isActive: boolean
  _count: ClinicCount
}

type HealthStatus = 'healthy' | 'warning' | 'critical' | 'stale'

interface CronHealth {
  appointmentReminders: HealthStatus
  silenceRiskChecks: HealthStatus
  consentReminders: HealthStatus
  systemActive: boolean
}

interface StatsResponse {
  summary: Summary
  clinicStats: ClinicStat[]
  cronHealth: CronHealth
}

interface Clinic {
  id: string
  name: string
  address: string | null
  phone: string | null
  email: string | null
  timezone: string
  isActive: boolean
  createdAt: string
  _count: ClinicCount
}

interface ClinicAdmin {
  id: string
  name: string | null
  email: string
  role: string
}

type Tab = 'overview' | 'clinics' | 'create' | 'admins'

// ---------------------------------------------------------------------------
// Helper Components
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string | number
  sub?: string
  accent?: string
}) {
  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-5">
      <p className="text-white/50 text-sm mb-1">{label}</p>
      <p className={`text-2xl font-bold ${accent ?? 'text-white'}`}>{value}</p>
      {sub && <p className="text-white/40 text-xs mt-1">{sub}</p>}
    </div>
  )
}

function HealthBadge({ label, status }: { label: string; status: HealthStatus | boolean }) {
  const map: Record<string, { bg: string; text: string; dot: string }> = {
    healthy: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', dot: 'bg-emerald-400' },
    warning: { bg: 'bg-amber-500/20', text: 'text-amber-400', dot: 'bg-amber-400' },
    critical: { bg: 'bg-red-500/20', text: 'text-red-400', dot: 'bg-red-400' },
    stale: { bg: 'bg-gray-500/20', text: 'text-gray-400', dot: 'bg-gray-400' },
  }

  const resolvedStatus = typeof status === 'boolean' ? (status ? 'healthy' : 'stale') : status
  const style = map[resolvedStatus] ?? map.stale

  return (
    <div className={`${style.bg} border border-gray-700/50 rounded-2xl p-4 flex items-center gap-3`}>
      <span className={`w-2.5 h-2.5 rounded-full ${style.dot} shrink-0`} />
      <div>
        <p className={`${style.text} text-sm font-medium`}>{label}</p>
        <p className="text-white/40 text-xs capitalize">{resolvedStatus}</p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function SuperAdminDashboard() {
  const [tab, setTab] = useState<Tab>('overview')

  // Overview data
  const [stats, setStats] = useState<StatsResponse | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)

  // Clinics data
  const [clinics, setClinics] = useState<Clinic[]>([])
  const [clinicsLoading, setClinicsLoading] = useState(true)
  const [clinicAdmins, setClinicAdmins] = useState<Record<string, ClinicAdmin | null>>({})

  // Admins data
  const [allAdmins, setAllAdmins] = useState<ClinicAdmin[]>([])
  const [adminsLoading, setAdminsLoading] = useState(true)

  // Create clinic form
  const [createForm, setCreateForm] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
    timezone: 'UTC',
  })

  // Assign admin modal
  const [showAdmin, setShowAdmin] = useState<string | null>(null)
  const [adminForm, setAdminForm] = useState({ name: '', email: '', password: '' })

  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // -------------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------------

  useEffect(() => {
    fetchStats()
    fetchClinics()
    fetchAllAdmins()
  }, [])

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/super-admin/stats')
      if (res.ok) {
        setStats(await res.json())
      }
    } catch (e) {
      console.error('Failed to fetch stats:', e)
    } finally {
      setStatsLoading(false)
    }
  }

  const fetchClinics = async () => {
    try {
      const res = await fetch('/api/clinics')
      if (res.ok) {
        const clinicsData = await res.json()
        setClinics(clinicsData)
        await fetchClinicAdmins(clinicsData)
      }
    } catch (e) {
      console.error('Failed to fetch clinics:', e)
    } finally {
      setClinicsLoading(false)
    }
  }

  const fetchClinicAdmins = async (clinicsData: Clinic[]) => {
    const adminsMap: Record<string, ClinicAdmin | null> = {}
    await Promise.all(
      clinicsData.map(async (clinic) => {
        try {
          const res = await fetch(`/api/clinics/${clinic.id}/admin`)
          if (res.ok) {
            const data = await res.json()
            adminsMap[clinic.id] = data.admin || null
          }
        } catch (e) {
          console.error(`Failed to fetch admin for clinic ${clinic.id}:`, e)
        }
      })
    )
    setClinicAdmins(adminsMap)
  }

  const fetchAllAdmins = async () => {
    try {
      const res = await fetch('/api/super-admin/admins')
      if (res.ok) {
        setAllAdmins(await res.json())
      }
    } catch (e) {
      console.error('Failed to fetch admins:', e)
    } finally {
      setAdminsLoading(false)
    }
  }

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleCreateClinic = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setMessage('')
    try {
      const res = await fetch('/api/clinics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      })
      if (res.ok) {
        setMessage('Clinic created successfully!')
        setCreateForm({ name: '', address: '', phone: '', email: '', timezone: 'UTC' })
        fetchClinics()
        fetchStats()
        setTimeout(() => setMessage(''), 3000)
      } else {
        const data = await res.json()
        setMessage(data.error || 'Failed to create clinic')
      }
    } catch {
      setMessage('Error creating clinic')
    } finally {
      setSubmitting(false)
    }
  }

  const handleAssignAdmin = async (clinicId: string) => {
    setSubmitting(true)
    setMessage('')
    try {
      const res = await fetch(`/api/clinics/${clinicId}/admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adminForm),
      })
      if (res.ok) {
        const newAdmin = await res.json()
        setMessage('Admin assigned successfully!')
        setClinicAdmins((prev) => ({ ...prev, [clinicId]: newAdmin }))
        setAdminForm({ name: '', email: '', password: '' })
        setShowAdmin(null)
        fetchClinics()
        setTimeout(() => setMessage(''), 3000)
      } else {
        const data = await res.json()
        setMessage(data.error || 'Failed to assign admin')
      }
    } catch {
      setMessage('Error assigning admin')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRemoveAdmin = async (clinicId: string, adminId: string) => {
    if (!confirm('Are you sure you want to remove this admin?')) return
    
    setSubmitting(true)
    setMessage('')
    try {
      const res = await fetch(`/api/clinics/${clinicId}/admin`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId }),
      })
      if (res.ok) {
        setMessage('Admin removed successfully!')
        setClinicAdmins((prev) => ({ ...prev, [clinicId]: null }))
        fetchClinics()
        setTimeout(() => setMessage(''), 3000)
      } else {
        const data = await res.json()
        setMessage(data.error || 'Failed to remove admin')
      }
    } catch {
      setMessage('Error removing admin')
    } finally {
      setSubmitting(false)
    }
  }

  const toggleActive = async (clinic: Clinic) => {
    try {
      const res = await fetch(`/api/clinics/${clinic.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !clinic.isActive }),
      })
      if (res.ok) {
        setMessage(`Clinic ${clinic.isActive ? 'deactivated' : 'activated'}`)
        fetchClinics()
        fetchStats()
        setTimeout(() => setMessage(''), 3000)
      }
    } catch {
      setMessage('Error updating clinic')
    }
  }

  // -------------------------------------------------------------------------
  // Derived
  // -------------------------------------------------------------------------

  const s = stats?.summary

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">System-Wide Dashboard</h1>
            <p className="text-white/60 mt-1">Operational overview for Super Admin</p>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div
            className={`p-4 rounded-xl mb-6 ${
              message.includes('success') || message.includes('assigned') || message.includes('activated') || message.includes('deactivated')
                ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-300'
                : 'bg-red-500/20 border border-red-500/30 text-red-300'
            }`}
          >
            {message}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-8 bg-gray-800/50 border border-gray-700/50 rounded-xl p-1 w-fit">
          {(
            [
              { key: 'overview', label: 'Overview' },
              { key: 'clinics', label: 'Clinics' },
              { key: 'admins', label: 'Admins' },
              { key: 'create', label: 'Create Clinic' },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === t.key
                  ? 'bg-indigo-600 text-white'
                  : 'text-white/50 hover:text-white hover:bg-gray-700/50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ================================================================ */}
        {/* OVERVIEW TAB                                                     */}
        {/* ================================================================ */}
        {tab === 'overview' && (
          <div className="space-y-8">
            {statsLoading ? (
              <div className="text-center text-white/60 py-12">Loading stats...</div>
            ) : !stats || !stats.summary ? (
              <div className="text-center text-white/60 py-12">Failed to load stats.</div>
            ) : s ? (
              <>
                {/* 1. Platform Summary */}
                <section>
                  <h2 className="text-lg font-semibold text-white mb-4">Platform Summary</h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    <StatCard
                      label="Clinics"
                      value={s.totalClinics}
                      sub={`${s.activeClinics} active · ${s.inactiveClinics} inactive`}
                      accent="text-indigo-400"
                    />
                    <StatCard
                      label="Patients"
                      value={s.totalPatients}
                      sub={`+${s.newPatientsWeek} this week`}
                      accent="text-emerald-400"
                    />
                    <StatCard label="Doctors" value={s.totalDoctors} accent="text-blue-400" />
                    <StatCard label="Staff" value={s.totalStaff} accent="text-purple-400" />
                    <StatCard label="Treatments" value={s.totalTreatments} accent="text-cyan-400" />
                    <StatCard
                      label="Audit Logs"
                      value={s.totalAuditLogs}
                      sub={`${s.last24hActions} in 24h`}
                      accent="text-amber-400"
                    />
                  </div>
                </section>

                {/* 2. Alerts & Risk */}
                <section>
                  <h2 className="text-lg font-semibold text-white mb-4">Alerts &amp; Risk</h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    <StatCard
                      label="Escalated Check-ins"
                      value={s.escalatedCheckIns}
                      accent="text-red-400"
                    />
                    <StatCard
                      label="Orange Alerts"
                      value={s.orangeRiskCount}
                      accent="text-amber-400"
                    />
                    <StatCard
                      label="Red Alerts"
                      value={s.redRiskCount}
                      accent="text-red-400"
                    />
                    <StatCard
                      label="Active Complications"
                      value={s.activeComplications}
                      accent="text-orange-400"
                    />
                    <StatCard
                      label="Unresolved Silence"
                      value={s.unresolvedSilenceAlerts}
                      accent="text-yellow-400"
                    />
                    <StatCard
                      label="Pending Intakes"
                      value={s.pendingIntakes}
                      accent="text-violet-400"
                    />
                  </div>
                </section>

                {/* 3. Operational Health */}
                <section>
                  <h2 className="text-lg font-semibold text-white mb-4">Operational Health</h2>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <HealthBadge
                      label="Appointment Reminders"
                      status={stats.cronHealth.appointmentReminders}
                    />
                    <HealthBadge
                      label="Silence Risk Checks"
                      status={stats.cronHealth.silenceRiskChecks}
                    />
                    <HealthBadge
                      label="Consent Reminders"
                      status={stats.cronHealth.consentReminders}
                    />
                    <HealthBadge label="System Activity" status={stats.cronHealth.systemActive} />
                  </div>
                  <p className="text-white/30 text-xs mt-2">
                    24h actions: {s.last24hActions}
                  </p>
                </section>

                {/* 4. Appointments & Intake */}
                <section>
                  <h2 className="text-lg font-semibold text-white mb-4">Appointments &amp; Intake</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard
                      label="Total Appointments"
                      value={s.totalAppointments}
                      accent="text-indigo-400"
                    />
                    <StatCard
                      label="Pending Approval"
                      value={s.pendingAppointments}
                      accent="text-amber-400"
                    />
                    <StatCard
                      label="Completed"
                      value={s.completedAppointments}
                      accent="text-emerald-400"
                    />
                    <StatCard
                      label="Avg Doctor Response"
                      value={`${s.avgDoctorResponseHours.toFixed(1)}h`}
                      accent="text-blue-400"
                    />
                  </div>
                </section>
              </>
            ) : (
              <div className="text-center text-white/60 py-12">No stats available.</div>
            )}
          </div>
        )}

        {/* ================================================================ */}
        {/* CLINICS TAB                                                      */}
        {/* ================================================================ */}
        {tab === 'clinics' && (
          <div>
            {clinicsLoading ? (
              <div className="text-center text-white/60 py-12">Loading clinics...</div>
            ) : clinics.length === 0 ? (
              <div className="text-center text-white/60 py-12">
                No clinics yet. Create one to get started.
              </div>
            ) : (
              <div className="space-y-4">
                {clinics.map((clinic) => (
                  <div
                    key={clinic.id}
                    className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-bold text-white">{clinic.name}</h3>
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              clinic.isActive
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-red-500/20 text-red-400'
                            }`}
                          >
                            {clinic.isActive ? 'ACTIVE' : 'INACTIVE'}
                          </span>
                        </div>
                        {clinic.address && (
                          <p className="text-white/50 text-sm">{clinic.address}</p>
                        )}
                        {clinic.email && (
                          <p className="text-white/50 text-sm">{clinic.email}</p>
                        )}
                        <div className="flex gap-6 mt-3 text-sm text-white/40">
                          <span>{clinic._count.users} users</span>
                          <span>{clinic._count.patients} patients</span>
                          <span>{clinic._count.doctors} doctors</span>
                          <span>{clinic._count.treatments} treatments</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {clinicAdmins[clinic.id] ? (
                          <div className="flex items-center gap-2">
                            <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-lg text-sm font-medium">
                              Admin Assigned
                            </span>
                            <Button
                              size="sm"
                              onClick={() => {
                                if (confirm(`Replace admin ${clinicAdmins[clinic.id]?.email}?`)) {
                                  handleRemoveAdmin(clinic.id, clinicAdmins[clinic.id]!.id)
                                }
                              }}
                              variant="outline"
                              className="text-amber-400 border-amber-500/30"
                              disabled={submitting}
                            >
                              Replace
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => setShowAdmin(clinic.id)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white"
                          >
                            Assign Admin
                          </Button>
                        )}
                        <Button
                          size="sm"
                          onClick={() => toggleActive(clinic)}
                          variant="outline"
                          className={
                            clinic.isActive
                              ? 'text-red-400 border-red-500/30'
                              : 'text-emerald-400 border-emerald-500/30'
                          }
                        >
                          {clinic.isActive ? 'Deactivate' : 'Activate'}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================================================================ */}
        {/* ADMINS TAB                                                       */}
        {/* ================================================================ */}
        {tab === 'admins' && (
          <div>
            {adminsLoading ? (
              <div className="text-center text-white/60 py-12">Loading admins...</div>
            ) : allAdmins.length === 0 ? (
              <div className="text text-white/60 py-12">
                No admins found. Assign admins to clinics from the Clinics tab.
              </div>
            ) : (
              <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
                <h2 className="text-xl font-bold text-white mb-4">All Clinic Admins</h2>
                <p className="text-white/50 text-sm mb-6">
                  Total: {allAdmins.length} admin(s) across all clinics
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left py-3 px-4 text-white/60 font-medium">Name</th>
                        <th className="text-left py-3 px-4 text-white/60 font-medium">Email</th>
                        <th className="text-left py-3 px-4 text-white/60 font-medium">Role</th>
                        <th className="text-left py-3 px-4 text-white/60 font-medium">Clinic</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allAdmins.map((admin) => {
                        const clinic = clinics.find((c) => clinicAdmins[c.id]?.id === admin.id)
                        return (
                          <tr key={admin.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                            <td className="py-3 px-4 text-white">{admin.name || 'N/A'}</td>
                            <td className="py-3 px-4 text-white/70">{admin.email}</td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-1 bg-indigo-500/20 text-indigo-400 rounded-full text-xs">
                                {admin.role}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-white/70">{clinic?.name || 'Unknown'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================================================================ */}
        {/* CREATE CLINIC TAB                                                */}
        {/* ================================================================ */}
        {tab === 'create' && (
          <div className="max-w-xl">
            <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
              <h2 className="text-xl font-bold text-white mb-6">Create New Clinic</h2>
              <form onSubmit={handleCreateClinic} className="space-y-4">
                <div>
                  <label className="text-white/60 text-sm mb-1 block">Name *</label>
                  <Input
                    placeholder="Clinic Name"
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="text-white/60 text-sm mb-1 block">Address</label>
                  <Input
                    placeholder="Address"
                    value={createForm.address}
                    onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-white/60 text-sm mb-1 block">Phone</label>
                  <Input
                    placeholder="Phone"
                    value={createForm.phone}
                    onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-white/60 text-sm mb-1 block">Email</label>
                  <Input
                    placeholder="Email"
                    type="email"
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-white/60 text-sm mb-1 block">Timezone</label>
                  <Input
                    placeholder="e.g. America/New_York"
                    value={createForm.timezone}
                    onChange={(e) => setCreateForm({ ...createForm, timezone: e.target.value })}
                  />
                </div>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 w-full"
                >
                  {submitting ? 'Creating...' : 'Create Clinic'}
                </Button>
              </form>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* ASSIGN ADMIN MODAL                                               */}
        {/* ================================================================ */}
        {showAdmin && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
            <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 w-full max-w-md">
              <h2 className="text-xl font-bold text-white mb-4">Assign Clinic Admin</h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  handleAssignAdmin(showAdmin)
                }}
                className="space-y-4"
              >
                <Input
                  placeholder="Admin Name *"
                  value={adminForm.name}
                  onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })}
                  required
                />
                <Input
                  placeholder="Admin Email *"
                  type="email"
                  value={adminForm.email}
                  onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                  required
                />
                <Input
                  placeholder="Password *"
                  type="password"
                  value={adminForm.password}
                  onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                  required
                  minLength={6}
                />
                <div className="flex gap-3">
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="bg-gradient-to-r from-purple-600 to-indigo-600"
                  >
                    {submitting ? 'Assigning...' : 'Assign Admin'}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setShowAdmin(null)}
                    variant="outline"
                    className="text-white border-gray-600"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
