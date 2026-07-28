'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
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
  symptoms: string | null
  completedDate: string | null
  patient: { id: string; firstName: string; lastName: string; phone: string }
  treatment: { id: string; type: string; treatmentDate: string } | null
  photos: any[]
  aiAnalyses: any[]
}

interface SilenceRiskStats {
  active: any[]
  last24h: number
  lastWeek: number
  byLevel: Record<string, number>
}

export default function CheckInsPage() {
  const router = useRouter()
  const [checkIns, setCheckIns] = useState<CheckIn[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [silenceStats, setSilenceStats] = useState<SilenceRiskStats | null>(null)
  const [checkingSilence, setCheckingSilence] = useState(false)

  useEffect(() => {
    fetchCheckIns()
    fetchSilenceStats()
  }, [filter])

  const fetchCheckIns = async () => {
    try {
      const url = filter === 'all' ? '/api/checkins' : `/api/checkins?status=${filter}`
      const res = await fetch(url)
      const data = await res.json()
      setCheckIns(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error fetching check-ins:', error)
      setCheckIns([])
    } finally {
      setLoading(false)
    }
  }

  const fetchSilenceStats = async () => {
    try {
      const res = await fetch('/api/checkins?status=SILENCE_RISK')
      const data = await res.json()
      if (Array.isArray(data)) {
        const byLevel: Record<string, number> = {}
        data.forEach((r: any) => {
          byLevel[r.riskLevel] = (byLevel[r.riskLevel] || 0) + 1
        })
        setSilenceStats({
          active: data,
          last24h: data.length,
          lastWeek: data.length,
          byLevel,
        })
      }
    } catch (error) {
      console.error('Error fetching silence stats:', error)
    }
  }

  const runSilenceCheck = async () => {
    setCheckingSilence(true)
    try {
      const res = await fetch('/api/checkins/run-silence-check', { method: 'POST' })
      const data = await res.json()
      if (data.detected > 0) {
        fetchCheckIns()
        fetchSilenceStats()
      }
    } catch (error) {
      console.error('Error running silence check:', error)
    } finally {
      setCheckingSilence(false)
    }
  }

  const toggleDetails = (id: string) => {
    setExpandedId(expandedId === id ? null : id)
  }

  const getRiskBadgeVariant = (level: string) => {
    switch (level) {
      case 'RED': return 'destructive'
      case 'ORANGE': return 'destructive'
      case 'YELLOW': return 'secondary'
      case 'GREEN': return 'outline'
      default: return 'outline'
    }
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'default'
      case 'ESCALATED': return 'destructive'
      case 'PENDING': return 'secondary'
      case 'SILENCE_RISK': return 'destructive'
      default: return 'outline'
    }
  }

  const getTrendIcon = (direction: string) => {
    switch (direction) {
      case 'IMPROVING': return '📈'
      case 'WORSENING': return '📉'
      case 'STABLE': return '➡️'
      default: return ''
    }
  }

  const getTrendColor = (direction: string) => {
    switch (direction) {
      case 'IMPROVING': return 'text-green-400'
      case 'WORSENING': return 'text-red-400'
      case 'STABLE': return 'text-blue-400'
      default: return 'text-gray-400'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Recovery Check-ins</h1>
          <p className="text-muted-foreground">Monitor patient recovery progress</p>
        </div>
        <Button
          onClick={runSilenceCheck}
          disabled={checkingSilence}
          variant="outline"
          className="gap-2"
        >
          {checkingSilence ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          )}
          Check Silence Risks
        </Button>
      </div>

      {silenceStats && silenceStats.active.length > 0 && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
              <h3 className="text-sm font-semibold text-red-400">
                Silence Risk Alert — {silenceStats.active.length} patient{silenceStats.active.length !== 1 ? 's' : ''} unresponsive
              </h3>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-3">
              <div className="text-center">
                <div className="text-2xl font-bold text-red-400">{silenceStats.byLevel?.CRITICAL || 0}</div>
                <div className="text-xs text-muted-foreground">Critical</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-400">{silenceStats.byLevel?.HIGH || 0}</div>
                <div className="text-xs text-muted-foreground">High</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-400">{silenceStats.byLevel?.MEDIUM || 0}</div>
                <div className="text-xs text-muted-foreground">Medium</div>
              </div>
            </div>
            <div className="space-y-2">
              {silenceStats.active.slice(0, 5).map((risk: any) => (
                <div key={risk.id} className="flex items-center justify-between p-2 bg-white/5 rounded text-sm">
                  <span className="text-white">{risk.patient.firstName} {risk.patient.lastName}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Day {risk.missedDayNumber}</span>
                    <Badge variant={risk.escalationLevel === 'CRITICAL' ? 'destructive' : 'secondary'}>
                      {risk.escalationLevel}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('all')}
            >
              All
            </Button>
            <Button
              variant={filter === 'PENDING' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('PENDING')}
            >
              Pending
            </Button>
            <Button
              variant={filter === 'COMPLETED' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('COMPLETED')}
            >
              Completed
            </Button>
            <Button
              variant={filter === 'ESCALATED' ? 'destructive' : 'outline'}
              size="sm"
              onClick={() => setFilter('ESCALATED')}
            >
              Escalated
            </Button>
            <Button
              variant={filter === 'SILENCE_RISK' ? 'destructive' : 'outline'}
              size="sm"
              onClick={() => setFilter('SILENCE_RISK')}
              className="gap-1"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m-2.829-2.829a5 5 0 000-7.07m-4.243 2.121a1 1 0 111.414 1.414m-1.414 1.414L9 10" />
              </svg>
              Silence Risk
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : checkIns.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No check-ins found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {checkIns.map((checkIn) => {
                const latestAnalysis = checkIn.aiAnalyses?.[checkIn.aiAnalyses.length - 1]
                const rationale = latestAnalysis?.rationale
                const trendDirection = latestAnalysis?.trendDirection
                const trendDetails = latestAnalysis?.trendDetails ? JSON.parse(latestAnalysis.trendDetails) : null
                const confidenceFactors = latestAnalysis?.confidenceFactors ? JSON.parse(latestAnalysis.confidenceFactors) : null

                return (
                  <div key={checkIn.id} className="p-4 border rounded-lg hover:bg-white/5 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-lg font-medium text-primary">
                            {checkIn.patient.firstName[0]}{checkIn.patient.lastName[0]}
                          </span>
                        </div>
                        <div>
                          <h3 className="font-medium">
                            {checkIn.patient.firstName} {checkIn.patient.lastName}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            Day {checkIn.dayNumber} check-in • {checkIn.treatment?.type?.replace(/_/g, ' ') || 'N/A'}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Scheduled: {formatDate(checkIn.scheduledDate)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {trendDirection && (
                          <span className={`text-lg ${getTrendColor(trendDirection)}`} title={`Trend: ${trendDirection}`}>
                            {getTrendIcon(trendDirection)}
                          </span>
                        )}
                        <Badge variant={getRiskBadgeVariant(checkIn.riskLevel)}>
                          {checkIn.riskLevel}
                        </Badge>
                        <Badge variant={getStatusBadgeVariant(checkIn.status)}>
                          {checkIn.status.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                    </div>

                    {checkIn.patientMessage && (
                      <div className="mt-4 p-3 bg-white/5 rounded-md">
                        <p className="text-sm font-medium text-white">Patient Message:</p>
                        <p className="text-sm text-gray-300">{checkIn.patientMessage}</p>
                      </div>
                    )}

                    {checkIn.aiResponse && (
                      <div className="mt-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-md">
                        <p className="text-sm font-medium text-blue-400">AI Response:</p>
                        <p className="text-sm text-blue-300">{checkIn.aiResponse}</p>
                      </div>
                    )}

                    {rationale && (
                      <div className="mt-2 p-3 bg-purple-500/10 border border-purple-500/20 rounded-md">
                        <p className="text-sm font-medium text-purple-400 flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                          AI Rationale
                        </p>
                        <p className="text-sm text-purple-300 mt-1">{rationale}</p>
                      </div>
                    )}

                    {expandedId === checkIn.id && (
                      <div className="mt-4 p-4 bg-white/5 rounded-lg space-y-3 border border-white/10">
                        <h4 className="font-medium text-white">Full Details</h4>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div><span className="text-muted-foreground">Patient ID:</span> {checkIn.patient.id}</div>
                          <div><span className="text-muted-foreground">Phone:</span> {checkIn.patient.phone || 'N/A'}</div>
                          <div><span className="text-muted-foreground">Treatment ID:</span> {checkIn.treatment?.id || 'N/A'}</div>
                          <div><span className="text-muted-foreground">Treatment Date:</span> {checkIn.treatment?.treatmentDate ? formatDate(checkIn.treatment.treatmentDate) : 'N/A'}</div>
                          <div><span className="text-muted-foreground">Completed:</span> {checkIn.completedDate ? formatDate(checkIn.completedDate) : 'Not completed'}</div>
                          {checkIn.symptoms && <div className="col-span-2"><span className="text-muted-foreground">Symptoms:</span> {checkIn.symptoms}</div>}
                        </div>

                        {trendDetails && (
                          <div className="p-3 bg-white/5 rounded-md">
                            <p className="text-sm font-medium text-white mb-2">Trend Analysis</p>
                            <div className="space-y-1">
                              {trendDetails.map((detail: any, idx: number) => (
                                <div key={idx} className="flex items-center justify-between text-xs">
                                  <span className="text-muted-foreground capitalize">{detail.metric}</span>
                                  <span className={detail.changePercent < 0 ? 'text-green-400' : detail.changePercent > 0 ? 'text-red-400' : 'text-gray-400'}>
                                    {detail.previousScore.toFixed(2)} → {detail.currentScore.toFixed(2)} ({detail.changePercent > 0 ? '+' : ''}{detail.changePercent}%)
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {confidenceFactors && confidenceFactors.length > 0 && (
                          <div className="p-3 bg-white/5 rounded-md">
                            <p className="text-sm font-medium text-white mb-2">Confidence Factors</p>
                            <div className="space-y-1">
                              {confidenceFactors.map((cf: any, idx: number) => (
                                <div key={idx} className="flex items-center justify-between text-xs">
                                  <span className="text-muted-foreground">{cf.factor.replace(/_/g, ' ')}</span>
                                  <div className="flex items-center gap-2">
                                    <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                      <div
                                        className={`h-full rounded-full ${cf.impact === 'positive' ? 'bg-green-500' : cf.impact === 'negative' ? 'bg-red-500' : 'bg-gray-500'}`}
                                        style={{ width: `${cf.weight * 100}%` }}
                                      />
                                    </div>
                                    <span className="text-muted-foreground w-8 text-right">{(cf.weight * 100).toFixed(0)}%</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {checkIn.photos.length > 0 && (
                          <div>
                            <p className="text-sm font-medium text-white mb-2">Photos ({checkIn.photos.length})</p>
                            <div className="flex gap-2">
                              {checkIn.photos.map((photo: any) => (
                                <div key={photo.id} className="w-16 h-16 rounded bg-white/10 flex items-center justify-center text-xs text-muted-foreground">
                                  {photo.source === 'WHATSAPP' ? '📱' : '📷'} Photo
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {checkIn.aiAnalyses.length > 0 && (
                          <div>
                            <p className="text-sm font-medium text-white mb-2">AI Analyses</p>
                            {checkIn.aiAnalyses.map((analysis: any) => (
                              <div key={analysis.id} className="p-2 bg-blue-500/10 rounded text-xs">
                                Edema: {(analysis.swellingScore * 10).toFixed(1)}/10 | Ecchymosis: {(analysis.bruisingScore * 10).toFixed(1)}/10 | Erythema: {(analysis.rednessScore * 10).toFixed(1)}/10
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="mt-4 flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => toggleDetails(checkIn.id)}>
                        {expandedId === checkIn.id ? 'Hide Details' : 'View Details'}
                      </Button>
                      {checkIn.status === 'ESCALATED' && (
                        <Button size="sm" onClick={() => router.push(`/dashboard/patients/${checkIn.patient.id}`)}>
                          Take Action
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
