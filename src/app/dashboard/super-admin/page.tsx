'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Clinic {
  id: string
  name: string
  address: string | null
  phone: string | null
  email: string | null
  timezone: string
  isActive: boolean
  createdAt: string
  _count: {
    users: number
    patients: number
    treatments: number
    doctors: number
  }
}

export default function SuperAdminDashboard() {
  const [clinics, setClinics] = useState<Clinic[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showAdmin, setShowAdmin] = useState<string | null>(null)
  const [createForm, setCreateForm] = useState({ name: '', address: '', phone: '', email: '', timezone: 'UTC' })
  const [adminForm, setAdminForm] = useState({ name: '', email: '', password: '' })
  const [message, setMessage] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => { fetchClinics() }, [])

  const fetchClinics = async () => {
    try {
      const res = await fetch('/api/clinics')
      if (res.ok) {
        const data = await res.json()
        setClinics(data)
      }
    } catch (e) {
      console.error('Failed to fetch clinics:', e)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
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
        setShowCreate(false)
        fetchClinics()
      } else {
        const data = await res.json()
        setMessage(data.error || 'Failed to create clinic')
      }
    } catch (e) {
      setMessage('Error creating clinic')
    } finally {
      setCreating(false)
    }
  }

  const handleAssignAdmin = async (clinicId: string) => {
    setCreating(true)
    setMessage('')
    try {
      const res = await fetch(`/api/clinics/${clinicId}/admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adminForm),
      })
      if (res.ok) {
        setMessage('Admin assigned successfully!')
        setAdminForm({ name: '', email: '', password: '' })
        setShowAdmin(null)
        fetchClinics()
      } else {
        const data = await res.json()
        setMessage(data.error || 'Failed to assign admin')
      }
    } catch (e) {
      setMessage('Error assigning admin')
    } finally {
      setCreating(false)
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
      }
    } catch (e) {
      setMessage('Error updating clinic')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Super Admin</h1>
            <p className="text-white/60 mt-1">Manage clinics and tenant provisioning</p>
          </div>
          <Button onClick={() => setShowCreate(true)} className="bg-gradient-to-r from-purple-600 to-indigo-600">
            + Create Clinic
          </Button>
        </div>

        {message && (
          <div className={`p-4 rounded-xl mb-6 ${message.includes('success') ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-300' : 'bg-red-500/20 border border-red-500/30 text-red-300'}`}>
            {message}
          </div>
        )}

        {/* Create Clinic Modal */}
        {showCreate && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
            <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 w-full max-w-md">
              <h2 className="text-xl font-bold text-white mb-4">Create New Clinic</h2>
              <form onSubmit={handleCreate} className="space-y-4">
                <Input placeholder="Clinic Name *" value={createForm.name} onChange={e => setCreateForm({ ...createForm, name: e.target.value })} required />
                <Input placeholder="Address" value={createForm.address} onChange={e => setCreateForm({ ...createForm, address: e.target.value })} />
                <Input placeholder="Phone" value={createForm.phone} onChange={e => setCreateForm({ ...createForm, phone: e.target.value })} />
                <Input placeholder="Email" value={createForm.email} onChange={e => setCreateForm({ ...createForm, email: e.target.value })} />
                <Input placeholder="Timezone" value={createForm.timezone} onChange={e => setCreateForm({ ...createForm, timezone: e.target.value })} />
                <div className="flex gap-3">
                  <Button type="submit" disabled={creating} className="bg-gradient-to-r from-purple-600 to-indigo-600">
                    {creating ? 'Creating...' : 'Create'}
                  </Button>
                  <Button type="button" onClick={() => setShowCreate(false)} variant="outline" className="text-white border-gray-600">
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Assign Admin Modal */}
        {showAdmin && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
            <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 w-full max-w-md">
              <h2 className="text-xl font-bold text-white mb-4">Assign Clinic Admin</h2>
              <form onSubmit={(e) => { e.preventDefault(); handleAssignAdmin(showAdmin) }} className="space-y-4">
                <Input placeholder="Admin Name *" value={adminForm.name} onChange={e => setAdminForm({ ...adminForm, name: e.target.value })} required />
                <Input placeholder="Admin Email *" type="email" value={adminForm.email} onChange={e => setAdminForm({ ...adminForm, email: e.target.value })} required />
                <Input placeholder="Password *" type="password" value={adminForm.password} onChange={e => setAdminForm({ ...adminForm, password: e.target.value })} required minLength={6} />
                <div className="flex gap-3">
                  <Button type="submit" disabled={creating} className="bg-gradient-to-r from-purple-600 to-indigo-600">
                    {creating ? 'Assigning...' : 'Assign Admin'}
                  </Button>
                  <Button type="button" onClick={() => setShowAdmin(null)} variant="outline" className="text-white border-gray-600">
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Clinic List */}
        {loading ? (
          <div className="text-center text-white/60 py-12">Loading clinics...</div>
        ) : clinics.length === 0 ? (
          <div className="text-center text-white/60 py-12">No clinics yet. Create one to get started.</div>
        ) : (
          <div className="space-y-4">
            {clinics.map(clinic => (
              <div key={clinic.id} className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold text-white">{clinic.name}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${clinic.isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                        {clinic.isActive ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </div>
                    {clinic.address && <p className="text-white/50 text-sm">{clinic.address}</p>}
                    {clinic.email && <p className="text-white/50 text-sm">{clinic.email}</p>}
                    <div className="flex gap-6 mt-3 text-sm text-white/40">
                      <span>{clinic._count.users} staff</span>
                      <span>{clinic._count.patients} patients</span>
                      <span>{clinic._count.treatments} treatments</span>
                      <span>{clinic._count.doctors} doctors</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => setShowAdmin(clinic.id)} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                      Assign Admin
                    </Button>
                    <Button size="sm" onClick={() => toggleActive(clinic)} variant="outline" className={clinic.isActive ? 'text-red-400 border-red-500/30' : 'text-emerald-400 border-emerald-500/30'}>
                      {clinic.isActive ? 'Deactivate' : 'Activate'}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
