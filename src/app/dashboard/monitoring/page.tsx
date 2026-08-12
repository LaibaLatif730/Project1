'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface ErrorStats {
  summary: {
    totalErrors: number
    errors24h: number
    unresolvedCount: number
    recentCritical: number
    whatsappErrors24h: number
  }
  errorsByLevel: Record<string, number>
  errorsByCategory: Record<string, number>
  errorsBySource: Record<string, number>
  cronHealth: {
    recentErrors: number
    lastError: string | null
  }
}

interface ErrorItem {
  id: string
  level: string
  source: string
  category: string
  message: string
  stackTrace?: string
  metadata?: Record<string, unknown>
  endpoint?: string
  method?: string
  statusCode?: number
  resolved: boolean
  createdAt: string
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

function formatRelativeTime(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

function getLevelBadge(level: string) {
  switch (level) {
    case 'INFO':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
    case 'WARN':
      return 'bg-amber-500/20 text-amber-400 border-amber-500/30'
    case 'ERROR':
      return 'bg-red-500/20 text-red-400 border-red-500/30'
    case 'CRITICAL':
      return 'bg-red-600/30 text-red-300 border-red-500/40 font-bold'
    default:
      return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
  }
}

function getSourceBadge(source: string) {
  switch (source) {
    case 'API':
      return 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30'
    case 'CRON':
      return 'bg-purple-500/20 text-purple-400 border-purple-500/30'
    case 'WEBHOOK':
      return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
    case 'AUTH':
      return 'bg-orange-500/20 text-orange-400 border-orange-500/30'
    default:
      return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
  }
}

function getCategoryBadge(category: string) {
  switch (category) {
    case 'whatsapp_webhook':
      return 'bg-green-500/20 text-green-400 border-green-500/30'
    case 'cron_job':
      return 'bg-purple-500/20 text-purple-400 border-purple-500/30'
    case 'auth':
      return 'bg-orange-500/20 text-orange-400 border-orange-500/30'
    case 'api_route':
      return 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30'
    case 'ai_analysis':
      return 'bg-pink-500/20 text-pink-400 border-pink-500/30'
    default:
      return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
  }
}

export default function MonitoringPage() {
  const [stats, setStats] = useState<ErrorStats | null>(null)
  const [errors, setErrors] = useState<ErrorItem[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorsLoading, setErrorsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [page, setPage] = useState(1)
  const [levelFilter, setLevelFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [resolvedFilter, setResolvedFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/monitoring/stats')
      if (!res.ok) throw new Error('Failed to fetch stats')
      const data = await res.json()
      setStats(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load stats')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchErrors = useCallback(async () => {
    setErrorsLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', '50')
      if (levelFilter) params.set('level', levelFilter)
      if (categoryFilter) params.set('category', categoryFilter)
      if (sourceFilter) params.set('source', sourceFilter)
      if (resolvedFilter) params.set('resolved', resolvedFilter)
      if (searchQuery) params.set('search', searchQuery)

      const res = await fetch(`/api/monitoring/errors?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch errors')
      const data = await res.json()
      setErrors(data.errors)
      setPagination(data.pagination)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load errors')
    } finally {
      setErrorsLoading(false)
    }
  }, [page, levelFilter, categoryFilter, sourceFilter, resolvedFilter, searchQuery])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  useEffect(() => {
    fetchErrors()
  }, [fetchErrors])

  const toggleResolve = async (id: string, currentResolved: boolean) => {
    try {
      const res = await fetch('/api/monitoring/errors', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, resolved: !currentResolved }),
      })
      if (!res.ok) throw new Error('Failed to update error')
      setErrors(prev => prev.map(e => e.id === id ? { ...e, resolved: !e.resolved } : e))
      fetchStats()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update error')
    }
  }

  const handleSearch = () => {
    setPage(1)
    fetchErrors()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">System Monitoring</h1>
        <p className="text-gray-400 text-sm">Error tracking and system health</p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline hover:text-red-300">Dismiss</button>
        </div>
      )}

      {/* Stats Section */}
      <div className="space-y-6">
        <h2 className="text-lg font-semibold text-white">Error Overview</h2>

        {loading ? (
          <div className="text-gray-400">Loading stats...</div>
        ) : stats ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-4">
                <div className="text-xs text-gray-400 mb-1">Total Errors (7d)</div>
                <div className="text-2xl font-bold text-white">{stats.summary.totalErrors}</div>
              </div>
              <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-4">
                <div className="text-xs text-gray-400 mb-1">Unresolved</div>
                <div className={`text-2xl font-bold ${stats.summary.unresolvedCount > 0 ? 'text-red-400' : 'text-white'}`}>
                  {stats.summary.unresolvedCount}
                </div>
              </div>
              <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-4">
                <div className="text-xs text-gray-400 mb-1">Last 24h</div>
                <div className="text-2xl font-bold text-white">{stats.summary.errors24h}</div>
              </div>
              <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-4">
                <div className="text-xs text-gray-400 mb-1">Critical</div>
                <div className={`text-2xl font-bold ${stats.summary.recentCritical > 0 ? 'text-red-400' : 'text-white'}`}>
                  {stats.summary.recentCritical}
                </div>
              </div>
              <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-4">
                <div className="text-xs text-gray-400 mb-1">WhatsApp Errors (24h)</div>
                <div className="text-2xl font-bold text-white">{stats.summary.whatsappErrors24h}</div>
              </div>
              <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-4">
                <div className="text-xs text-gray-400 mb-1">Cron Errors (24h)</div>
                <div className="text-2xl font-bold text-white">{stats.cronHealth.recentErrors}</div>
              </div>
            </div>

            {/* Breakdowns */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-4">
                <div className="text-sm font-medium text-white mb-3">By Level</div>
                <div className="space-y-2">
                  {Object.entries(stats.errorsByLevel).map(([level, count]) => (
                    <div key={level} className="flex items-center justify-between">
                      <span className={`inline-block px-2 py-0.5 rounded-md text-xs border ${getLevelBadge(level)}`}>{level}</span>
                      <span className="text-sm text-gray-300 font-mono">{count as number}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-4">
                <div className="text-sm font-medium text-white mb-3">By Category</div>
                <div className="space-y-2">
                  {Object.entries(stats.errorsByCategory).map(([cat, count]) => (
                    <div key={cat} className="flex items-center justify-between">
                      <span className={`inline-block px-2 py-0.5 rounded-md text-xs border ${getCategoryBadge(cat)}`}>{cat}</span>
                      <span className="text-sm text-gray-300 font-mono">{count as number}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-4">
                <div className="text-sm font-medium text-white mb-3">By Source</div>
                <div className="space-y-2">
                  {Object.entries(stats.errorsBySource).map(([src, count]) => (
                    <div key={src} className="flex items-center justify-between">
                      <span className={`inline-block px-2 py-0.5 rounded-md text-xs border ${getSourceBadge(src)}`}>{src}</span>
                      <span className="text-sm text-gray-300 font-mono">{count as number}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>

      {/* Error List Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-white">Error Log</h2>

        {/* Filters */}
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <select
              value={levelFilter}
              onChange={e => { setLevelFilter(e.target.value); setPage(1) }}
              className="h-10 rounded-xl border border-white/15 bg-white/5 backdrop-blur-sm px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 hover:border-white/25 hover:bg-white/8 transition-all duration-300"
            >
              <option value="">All Levels</option>
              <option value="INFO">INFO</option>
              <option value="WARN">WARN</option>
              <option value="ERROR">ERROR</option>
              <option value="CRITICAL">CRITICAL</option>
            </select>
            <select
              value={categoryFilter}
              onChange={e => { setCategoryFilter(e.target.value); setPage(1) }}
              className="h-10 rounded-xl border border-white/15 bg-white/5 backdrop-blur-sm px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 hover:border-white/25 hover:bg-white/8 transition-all duration-300"
            >
              <option value="">All Categories</option>
              <option value="whatsapp_webhook">WhatsApp Webhook</option>
              <option value="cron_job">Cron Job</option>
              <option value="auth">Auth</option>
              <option value="api_route">API Route</option>
              <option value="ai_analysis">AI Analysis</option>
            </select>
            <select
              value={sourceFilter}
              onChange={e => { setSourceFilter(e.target.value); setPage(1) }}
              className="h-10 rounded-xl border border-white/15 bg-white/5 backdrop-blur-sm px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 hover:border-white/25 hover:bg-white/8 transition-all duration-300"
            >
              <option value="">All Sources</option>
              <option value="API">API</option>
              <option value="CRON">CRON</option>
              <option value="WEBHOOK">WEBHOOK</option>
              <option value="AUTH">AUTH</option>
            </select>
            <select
              value={resolvedFilter}
              onChange={e => { setResolvedFilter(e.target.value); setPage(1) }}
              className="h-10 rounded-xl border border-white/15 bg-white/5 backdrop-blur-sm px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 hover:border-white/25 hover:bg-white/8 transition-all duration-300"
            >
              <option value="">All Status</option>
              <option value="true">Resolved</option>
              <option value="false">Unresolved</option>
            </select>
            <div className="flex gap-2">
              <Input
                placeholder="Search errors..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                className="h-10 text-sm"
              />
              <Button variant="outline" size="sm" onClick={handleSearch} className="shrink-0">
                Search
              </Button>
            </div>
          </div>
        </div>

        {/* Error Table */}
        {errorsLoading ? (
          <div className="text-gray-400 py-8 text-center">Loading errors...</div>
        ) : errors.length === 0 ? (
          <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-8 text-center text-gray-400">
            No errors found
          </div>
        ) : (
          <div className="space-y-2">
            {errors.map(err => (
              <div key={err.id} className="bg-gray-800/50 border border-gray-700/50 rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedId(expandedId === err.id ? null : err.id)}
                  className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors"
                >
                  <div className="grid grid-cols-12 gap-3 items-center text-sm">
                    <div className="col-span-2 sm:col-span-1 text-gray-400 text-xs">
                      {formatRelativeTime(err.createdAt)}
                    </div>
                    <div className="col-span-2 sm:col-span-2">
                      <span className={`inline-block px-2 py-0.5 rounded-md text-xs border ${getLevelBadge(err.level)}`}>
                        {err.level}
                      </span>
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <span className={`inline-block px-2 py-0.5 rounded-md text-xs border ${getSourceBadge(err.source)}`}>
                        {err.source}
                      </span>
                    </div>
                    <div className="col-span-3 sm:col-span-2 hidden sm:block">
                      <span className={`inline-block px-2 py-0.5 rounded-md text-xs border ${getCategoryBadge(err.category)}`}>
                        {err.category}
                      </span>
                    </div>
                    <div className="col-span-5 sm:col-span-4 text-gray-300 truncate text-xs">
                      {err.message}
                    </div>
                    <div className="col-span-2 sm:col-span-2 hidden sm:block">
                      <span className={`inline-block px-2 py-0.5 rounded-md text-xs ${err.resolved ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'}`}>
                        {err.resolved ? 'Resolved' : 'Unresolved'}
                      </span>
                    </div>
                    <div className="col-span-3 sm:col-span-1 text-right">
                      <Button
                        variant={err.resolved ? 'outline' : 'destructive'}
                        size="sm"
                        onClick={e => { e.stopPropagation(); toggleResolve(err.id, err.resolved) }}
                        className="text-xs h-7 px-2"
                      >
                        {err.resolved ? 'Reopen' : 'Resolve'}
                      </Button>
                    </div>
                  </div>
                </button>

                {expandedId === err.id && (
                  <div className="px-4 pb-4 border-t border-gray-700/50 pt-3 space-y-3">
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Full Message</div>
                      <div className="text-sm text-gray-200 whitespace-pre-wrap break-words">{err.message}</div>
                    </div>
                    {err.endpoint && (
                      <div className="flex gap-4 text-xs">
                        <div><span className="text-gray-400">Endpoint:</span> <span className="text-gray-200">{err.endpoint}</span></div>
                        {err.method && <div><span className="text-gray-400">Method:</span> <span className="text-gray-200">{err.method}</span></div>}
                        {err.statusCode && <div><span className="text-gray-400">Status:</span> <span className="text-gray-200">{err.statusCode}</span></div>}
                      </div>
                    )}
                    {err.stackTrace && (
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Stack Trace</div>
                        <pre className="text-xs text-gray-300 bg-gray-900/50 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-words max-h-60 overflow-y-auto">
                          {err.stackTrace}
                        </pre>
                      </div>
                    )}
                    {err.metadata && Object.keys(err.metadata).length > 0 && (
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Metadata</div>
                        <pre className="text-xs text-gray-300 bg-gray-900/50 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-words max-h-60 overflow-y-auto">
                          {JSON.stringify(err.metadata, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between bg-gray-800/50 border border-gray-700/50 rounded-2xl p-4">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
            >
              Previous
            </Button>
            <span className="text-sm text-gray-400">
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
