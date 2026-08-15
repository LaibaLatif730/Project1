import { NextResponse } from 'next/server'
import { sendWhatsAppMessage } from '@/lib/whatsapp'
import prisma from '@/lib/db'
import { logCronJobError } from '@/lib/error-logger'

function verifyCronAuth(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[SECURITY] CRON_SECRET not configured')
    return false
  }
  return req.headers.get('authorization') === `Bearer ${secret}`
}

const EXPIRY_WINDOW_DAYS = 30

export async function POST(req: Request) {
  try {
    if (!verifyCronAuth(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    const threshold = new Date(now.getTime() + EXPIRY_WINDOW_DAYS * 24 * 60 * 60 * 1000)

    const expiringBatches = await prisma.productBatch.findMany({
      where: {
        isActive: true,
        expiryDate: { lte: threshold },
      },
      include: {
        product: { select: { name: true, category: true } },
      },
      orderBy: { expiryDate: 'asc' },
    })

    const alreadyExpired = expiringBatches.filter(b => b.expiryDate < now)
    const nearExpiry = expiringBatches.filter(b => b.expiryDate >= now)

    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true, phone: true, name: true },
    })

    for (const admin of admins) {
      await prisma.notification.create({
        data: {
          userId: admin.id,
          title: `Product Expiry Alert: ${expiringBatches.length} batches`,
          message: `${alreadyExpired.length} expired, ${nearExpiry.length} expiring within ${EXPIRY_WINDOW_DAYS} days`,
          type: 'PRODUCT_EXPIRY',
          channel: 'IN_APP',
          metadata: JSON.stringify({
            expiredCount: alreadyExpired.length,
            nearExpiryCount: nearExpiry.length,
            batches: expiringBatches.map(b => ({
              id: b.id,
              batchNumber: b.batchNumber,
              productName: b.product.name,
              expiryDate: b.expiryDate.toISOString(),
              quantity: b.quantity,
              isExpired: b.expiryDate < now,
            })),
          }),
        },
      })

      if (admin.phone) {
        const summary = alreadyExpired.length > 0
          ? `🚨 ${alreadyExpired.length} EXPIRED batches! `
          : ''
        const nearSummary = nearExpiry.length > 0
          ? `⚠️ ${nearExpiry.length} batches expiring within ${EXPIRY_WINDOW_DAYS} days. `
          : ''

        const batchLines = expiringBatches.slice(0, 5).map(b => {
          const status = b.expiryDate < now ? '❌ EXPIRED' : '⚠️ Expiring'
          return `${status}: ${b.product.name} (Batch: ${b.batchNumber}) — ${b.expiryDate.toLocaleDateString()}`
        }).join('\n')

        await sendWhatsAppMessage(admin.phone, {
          messaging_product: 'whatsapp',
          to: admin.phone,
          type: 'text',
          text: {
            body: `💊 Product Expiry Alert\n\n${summary}${nearSummary}\n${batchLines}${expiringBatches.length > 5 ? `\n...and ${expiringBatches.length - 5} more` : ''}\n\nPlease review in the dashboard.`,
          },
        })
      }
    }

    return NextResponse.json({
      checked: true,
      expired: alreadyExpired.length,
      nearExpiry: nearExpiry.length,
      total: expiringBatches.length,
    })
  } catch (error) {
    console.error('Expiry alert error:', error)
    await logCronJobError('expiry-alerts', 'Unhandled error in product expiry alerts cron', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
