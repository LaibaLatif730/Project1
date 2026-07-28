'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { formatDate } from '@/lib/utils'

interface InjectionMapping {
  id: string
  area: string
  subArea: string | null
  units: number | null
  volume: number | null
  technique: string | null
  needleCannula: string | null
  depth: string | null
  product: { name: string } | null
}

interface Treatment {
  id: string
  type: string
  productName: string
  treatmentDate: string
  units: number | null
  volume: number | null
  notes: string
  status: string
  injectionMappings: InjectionMapping[]
  checkIns: { id: string; status: string; dayNumber: number; riskLevel: string }[]
}

interface Patient {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  gender: string
  dateOfBirth: string
  address: string
  medicalHistory: any
  allergies: string
  medications: string
  treatments: Treatment[]
  checkIns: any[]
  appointments: any[]
  photos: any[]
}

export default function PatientDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [patient, setPatient] = useState<Patient | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editForm, setEditForm] = useState({
    firstName: '', lastName: '', email: '', phone: '', gender: '',
    dateOfBirth: '', address: '', medicalHistory: '', allergies: '',
    medications: '', emergencyContact: '',
  })
  const [userRole, setUserRole] = useState('')
  const [showCheckinForm, setShowCheckinForm] = useState(false)
  const [checkinForm, setCheckinForm] = useState({ treatmentId: '', numberOfCheckIns: '5', intervalDays: '1', startDate: '', notes: '' })
  const [creatingCheckins, setCreatingCheckins] = useState(false)
  const [patientSummary, setPatientSummary] = useState('')
  const [loadingSummary, setLoadingSummary] = useState(false)

  useEffect(() => {
    fetchPatient()
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(d => { if (d?.role) setUserRole(d.role) })
  }, [params.id])

  const fetchPatient = async () => {
    try {
      const res = await fetch(`/api/patients/${params.id}`)
      const data = await res.json()
      setPatient(data)
    } catch (error) {
      console.error('Error fetching patient:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchPatientSummary = async () => {
    setLoadingSummary(true)
    try {
      const res = await fetch(`/api/ai/patient-summary?patientId=${params.id}`)
      const data = await res.json()
      if (res.ok) setPatientSummary(data.summary)
    } catch (error) {
      console.error('Error fetching summary:', error)
    } finally {
      setLoadingSummary(false)
    }
  }

  const handleCreateCheckins = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreatingCheckins(true)
    try {
      const res = await fetch('/api/checkins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: params.id,
          treatmentId: checkinForm.treatmentId || undefined,
          numberOfCheckIns: parseInt(checkinForm.numberOfCheckIns),
          intervalDays: parseInt(checkinForm.intervalDays),
          startDate: checkinForm.startDate || undefined,
          notes: checkinForm.notes || undefined,
        }),
      })
      if (res.ok) {
        setShowCheckinForm(false)
        setCheckinForm({ treatmentId: '', numberOfCheckIns: '5', intervalDays: '1', startDate: '', notes: '' })
        fetchPatient()
      }
    } catch (error) {
      console.error('Error creating check-ins:', error)
    } finally {
      setCreatingCheckins(false)
    }
  }

  const startEditing = () => {
    if (!patient) return
    setEditForm({
      firstName: patient.firstName || '',
      lastName: patient.lastName || '',
      email: patient.email || '',
      phone: patient.phone || '',
      gender: patient.gender || '',
      dateOfBirth: patient.dateOfBirth ? patient.dateOfBirth.split('T')[0] : '',
      address: patient.address || '',
      medicalHistory: patient.medicalHistory || '',
      allergies: patient.allergies || '',
      medications: patient.medications || '',
      emergencyContact: '',
    })
    setEditing(true)
  }

  const savePatient = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/patients/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      if (res.ok) {
        await fetchPatient()
        setEditing(false)
      }
    } catch (error) {
      console.error('Error saving patient:', error)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!patient) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Patient not found</p>
        <Button onClick={() => router.back()} className="mt-4">Go Back</Button>
      </div>
    )
  }

  const getRiskBadge = (level: string) => {
    switch (level) {
      case 'RED': return 'destructive'
      case 'ORANGE': return 'destructive'
      case 'YELLOW': return 'secondary'
      case 'GREEN': return 'outline'
      default: return 'outline'
    }
  }

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'timeline', label: 'Clinical Timeline' },
    { id: 'injections', label: 'Injection Map' },
    { id: 'checkins', label: 'Check-ins' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {patient.firstName} {patient.lastName}
          </h1>
          <p className="text-muted-foreground">{patient.email} {patient.phone && `• ${patient.phone}`}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.back()}>Back</Button>
          {editing ? (
              <Button onClick={savePatient} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
          ) : (
            <Button onClick={startEditing}>Edit Patient</Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b pb-2">
        {tabs.map((tab) => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? 'default' : 'ghost'}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {userRole === 'DOCTOR' && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>AI Patient Summary</CardTitle>
                  <CardDescription>Quick clinical overview for this patient</CardDescription>
                </div>
                <Button size="sm" variant="outline" onClick={fetchPatientSummary} disabled={loadingSummary}>
                  {loadingSummary ? 'Generating...' : patientSummary ? 'Refresh' : 'Generate Summary'}
                </Button>
              </CardHeader>
              <CardContent>
                {patientSummary ? (
                  <p className="text-sm">{patientSummary}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Click "Generate Summary" to get an AI-generated clinical overview of this patient's history, treatments, and risk flags.</p>
                )}
              </CardContent>
            </Card>
          )}
          <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {editing ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm text-muted-foreground">First Name</label>
                      <input className="w-full mt-1 p-2 rounded-md bg-white/5 border border-white/10 text-white" value={editForm.firstName} onChange={e => setEditForm({...editForm, firstName: e.target.value})} />
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground">Last Name</label>
                      <input className="w-full mt-1 p-2 rounded-md bg-white/5 border border-white/10 text-white" value={editForm.lastName} onChange={e => setEditForm({...editForm, lastName: e.target.value})} />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Email</label>
                    <input className="w-full mt-1 p-2 rounded-md bg-white/5 border border-white/10 text-white" type="email" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Phone</label>
                    <input className="w-full mt-1 p-2 rounded-md bg-white/5 border border-white/10 text-white" value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Gender</label>
                    <select className="w-full mt-1 p-2 rounded-md bg-white/5 border border-white/10 text-white" value={editForm.gender} onChange={e => setEditForm({...editForm, gender: e.target.value})}>
                      <option value="">Select</option>
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Date of Birth</label>
                    <input className="w-full mt-1 p-2 rounded-md bg-white/5 border border-white/10 text-white" type="date" value={editForm.dateOfBirth} onChange={e => setEditForm({...editForm, dateOfBirth: e.target.value})} />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Address</label>
                    <input className="w-full mt-1 p-2 rounded-md bg-white/5 border border-white/10 text-white" value={editForm.address} onChange={e => setEditForm({...editForm, address: e.target.value})} />
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Gender</span>
                    <span>{patient.gender || 'Not specified'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Date of Birth</span>
                    <span>{patient.dateOfBirth ? formatDate(patient.dateOfBirth) : 'Not specified'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Address</span>
                    <span className="text-right max-w-xs">{patient.address || 'Not specified'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Allergies</span>
                    <span className="text-right max-w-xs">{patient.allergies || 'None'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Medications</span>
                    <span className="text-right max-w-xs">{patient.medications || 'None'}</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{editing ? 'Medical History' : 'Statistics'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {editing ? (
                <>
                  <div>
                    <label className="text-sm text-muted-foreground">Medical History</label>
                    <textarea className="w-full mt-1 p-2 rounded-md bg-white/5 border border-white/10 text-white h-20" value={editForm.medicalHistory} onChange={e => setEditForm({...editForm, medicalHistory: e.target.value})} />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Allergies</label>
                    <textarea className="w-full mt-1 p-2 rounded-md bg-white/5 border border-white/10 text-white h-16" value={editForm.allergies} onChange={e => setEditForm({...editForm, allergies: e.target.value})} />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Medications</label>
                    <textarea className="w-full mt-1 p-2 rounded-md bg-white/5 border border-white/10 text-white h-16" value={editForm.medications} onChange={e => setEditForm({...editForm, medications: e.target.value})} />
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Treatments</span>
                    <span className="font-medium">{patient.treatments?.length ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Check-ins</span>
                    <span className="font-medium">{patient.checkIns?.length ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Appointments</span>
                    <span className="font-medium">{patient.appointments?.length ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Photos Uploaded</span>
                    <span className="font-medium">{patient.photos?.length ?? 0}</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
        </div>
      )}

      {/* Clinical Timeline Tab */}
      {activeTab === 'timeline' && (
        <Card>
          <CardHeader>
            <CardTitle>Clinical Timeline</CardTitle>
            <CardDescription>Chronological treatment history</CardDescription>
          </CardHeader>
          <CardContent>
            {(patient.treatments?.length ?? 0) === 0 ? (
              <p className="text-center py-4 text-muted-foreground">No treatments recorded</p>
            ) : (
              <div className="space-y-4">
                {patient.treatments.map((treatment) => (
                  <div key={treatment.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h4 className="font-medium">{treatment.type.replace(/_/g, ' ')}</h4>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(treatment.treatmentDate)}
                          {treatment.productName && ` • ${treatment.productName}`}
                          {treatment.units && ` • ${treatment.units} units`}
                        </p>
                      </div>
                      <Badge variant={treatment.status === 'COMPLETED' ? 'default' : 'secondary'}>
                        {treatment.status}
                      </Badge>
                    </div>
                    {treatment.notes && (
                      <p className="text-sm text-muted-foreground mb-2">{treatment.notes}</p>
                    )}
                    {treatment.checkIns?.length > 0 && (
                      <div className="flex gap-2 mt-2">
                        {treatment.checkIns.map((ci) => (
                          <Badge key={ci.id} variant={getRiskBadge(ci.riskLevel)} className="text-xs">
                            Day {ci.dayNumber}: {ci.status}
                          </Badge>
                        ))}
                      </div>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => {
                        const params = new URLSearchParams({
                          patientId: patient!.id,
                          treatmentType: treatment.type,
                              dayNumber: (treatment.checkIns?.length ?? 0) > 0
                            ? Math.max(...treatment.checkIns.map(c => c.dayNumber)).toString()
                            : '1',
                        })
                        window.open(`/api/ai/explain-analysis?${params.toString()}`, '_blank')
                      }}
                    >
                      View Explainability
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Injection Map Tab */}
      {activeTab === 'injections' && (
        <Card>
          <CardHeader>
            <CardTitle>Injection Mapping</CardTitle>
            <CardDescription>Detailed injection site documentation</CardDescription>
          </CardHeader>
          <CardContent>
            {(patient.treatments?.length ?? 0) === 0 ? (
              <p className="text-center py-4 text-muted-foreground">No treatments recorded</p>
            ) : (
              <div className="space-y-6">
                {patient.treatments.map((treatment) => (
                  <div key={treatment.id}>
                    <h3 className="font-semibold mb-3">
                      {treatment.type.replace(/_/g, ' ')} — {formatDate(treatment.treatmentDate)}
                    </h3>
                    {(treatment.injectionMappings?.length ?? 0) === 0 ? (
                      <p className="text-sm text-muted-foreground">No injection mappings recorded</p>
                    ) : (
                      <div className="space-y-2">
                        {treatment.injectionMappings.map((mapping) => (
                          <div key={mapping.id} className="p-3 border rounded-lg">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline">{mapping.area}</Badge>
                              {mapping.subArea && <Badge variant="secondary">{mapping.subArea}</Badge>}
                            </div>
                            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                              {mapping.units && <span>Units: <strong>{mapping.units}</strong></span>}
                              {mapping.volume && <span>Volume: <strong>{mapping.volume}mL</strong></span>}
                              {mapping.product && <span>Product: {mapping.product.name}</span>}
                              {mapping.technique && <span>Technique: {mapping.technique}</span>}
                              {mapping.needleCannula && <span>Device: {mapping.needleCannula}</span>}
                              {mapping.depth && <span>Depth: {mapping.depth}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Check-ins Tab */}
      {activeTab === 'checkins' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recovery Check-ins</CardTitle>
              <CardDescription>Recovery monitoring status</CardDescription>
            </div>
            {userRole === 'DOCTOR' && (
              <Button size="sm" onClick={() => setShowCheckinForm(!showCheckinForm)}>
                {showCheckinForm ? 'Cancel' : '+ Add Check-ins'}
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {showCheckinForm && (
              <form onSubmit={handleCreateCheckins} className="mb-6 p-4 border rounded-lg space-y-4 bg-muted/50">
                <p className="text-sm font-medium">Create check-ins for this patient</p>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Link to Treatment (optional)</label>
                  <select
                    className="w-full p-2 rounded-md bg-white/5 border border-white/10 text-white"
                    value={checkinForm.treatmentId}
                    onChange={(e) => setCheckinForm({ ...checkinForm, treatmentId: e.target.value })}
                  >
                    <option value="">No treatment (standalone check-ins)</option>
                    {patient!.treatments.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.type.replace(/_/g, ' ')} — {formatDate(t.treatmentDate)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Number of check-ins</label>
                    <Input
                      type="number"
                      min="1"
                      max="30"
                      value={checkinForm.numberOfCheckIns}
                      onChange={(e) => setCheckinForm({ ...checkinForm, numberOfCheckIns: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Interval (days between)</label>
                    <Input
                      type="number"
                      min="1"
                      max="30"
                      value={checkinForm.intervalDays}
                      onChange={(e) => setCheckinForm({ ...checkinForm, intervalDays: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Start date</label>
                    <Input
                      type="date"
                      value={checkinForm.startDate}
                      onChange={(e) => setCheckinForm({ ...checkinForm, startDate: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Notes (optional)</label>
                  <Input
                    value={checkinForm.notes}
                    onChange={(e) => setCheckinForm({ ...checkinForm, notes: e.target.value })}
                    placeholder="Reason for check-ins..."
                  />
                </div>
                <Button type="submit" size="sm" disabled={creatingCheckins}>
                  {creatingCheckins ? 'Creating...' : 'Create Check-ins'}
                </Button>
              </form>
            )}

            {(patient.checkIns?.length ?? 0) === 0 ? (
              <p className="text-center py-4 text-muted-foreground">No check-ins scheduled</p>
            ) : (
              <div className="space-y-3">
                {patient.checkIns.slice(0, 20).map((checkIn) => (
                  <div key={checkIn.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">Day {checkIn.dayNumber} Check-in</p>
                      <p className="text-sm text-muted-foreground">
                        Scheduled: {formatDate(checkIn.scheduledDate)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {checkIn.riskLevel && (
                        <Badge variant={getRiskBadge(checkIn.riskLevel)}>
                          {checkIn.riskLevel}
                        </Badge>
                      )}
                      <Badge variant={
                        checkIn.status === 'COMPLETED' ? 'default' :
                        checkIn.status === 'ESCALATED' ? 'destructive' : 'secondary'
                      }>
                        {checkIn.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
