import prisma from './db'

export type ErrorLevel = 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL'
export type ErrorSource = 'API' | 'CRON' | 'WEBHOOK' | 'AUTH' | 'CLIENT'
export type ErrorCategory =
  | 'whatsapp_webhook'
  | 'cron_job'
  | 'auth'
  | 'api_route'
  | 'ai_analysis'
  | 'db'
  | 'notification'
  | 'consent'
  | 'unknown'

interface LogErrorParams {
  clinicId?: string | null
  level?: ErrorLevel
  source: ErrorSource
  category: ErrorCategory
  message: string
  error?: unknown
  statusCode?: number
  endpoint?: string
  method?: string
  userId?: string
  metadata?: Record<string, unknown>
}

export async function logError(params: LogErrorParams): Promise<void> {
  try {
    const {
      clinicId,
      level = 'ERROR',
      source,
      category,
      message,
      error,
      statusCode,
      endpoint,
      method,
      userId,
      metadata,
    } = params

    let stackTrace: string | undefined
    let enrichedMetadata = metadata ? { ...metadata } : {}

    if (error instanceof Error) {
      stackTrace = error.stack
      enrichedMetadata.originalMessage = error.message
      enrichedMetadata.name = error.name
    } else if (typeof error === 'string') {
      enrichedMetadata.originalMessage = error
    }

    await prisma.errorLog.create({
      data: {
        clinicId: clinicId || null,
        level,
        source,
        category,
        message,
        stackTrace: stackTrace || null,
        metadata: JSON.stringify(enrichedMetadata),
        statusCode: statusCode || null,
        endpoint: endpoint || null,
        method: method || null,
        userId: userId || null,
      },
    })
  } catch {
    // Never let logging failure break the app
    console.error('[monitoring] Failed to write ErrorLog to database')
  }
}

export async function logWhatsAppWebhookError(
  message: string,
  error: unknown,
  clinicId?: string | null,
  metadata?: Record<string, unknown>
) {
  return logError({
    clinicId,
    level: 'ERROR',
    source: 'WEBHOOK',
    category: 'whatsapp_webhook',
    message,
    error,
    metadata,
  })
}

export async function logCronJobError(
  jobName: string,
  message: string,
  error: unknown,
  clinicId?: string | null,
  metadata?: Record<string, unknown>
) {
  return logError({
    clinicId,
    level: 'ERROR',
    source: 'CRON',
    category: 'cron_job',
    message: `[${jobName}] ${message}`,
    error,
    metadata: { jobName, ...metadata },
  })
}

export async function logAuthError(
  message: string,
  error: unknown,
  metadata?: Record<string, unknown>
) {
  return logError({
    level: 'WARN',
    source: 'AUTH',
    category: 'auth',
    message,
    error,
    metadata,
  })
}

export async function logApiError(
  message: string,
  error: unknown,
  opts: {
    endpoint: string
    method: string
    statusCode?: number
    clinicId?: string | null
    userId?: string
  }
) {
  return logError({
    ...opts,
    level: 'ERROR',
    source: 'API',
    category: 'api_route',
    message,
    error,
  })
}

export async function logAIError(
  message: string,
  error: unknown,
  clinicId?: string | null,
  metadata?: Record<string, unknown>
) {
  return logError({
    clinicId,
    level: 'WARN',
    source: 'API',
    category: 'ai_analysis',
    message,
    error,
    metadata,
  })
}
