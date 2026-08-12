import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { parseWhatsAppWebhook, sendWhatsAppMessage, verifyWhatsAppSignature } from '@/lib/whatsapp'
import { analyzeWithGrok, compareWithPreviousAnalysis } from '@/lib/grok'
import { resizeImage } from '@/lib/image-utils'
import { logWhatsAppWebhookError } from '@/lib/error-logger'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 })
  }

  return NextResponse.json({ error: 'Verification failed' }, { status: 403 })
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text()
    const signature = req.headers.get('x-hub-signature-256')

    if (!verifyWhatsAppSignature(rawBody, signature)) {
      console.error('[SECURITY] Rejected WhatsApp webhook — invalid signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
    }

    const body = JSON.parse(rawBody)
    const { messages } = parseWhatsAppWebhook(body)

    for (const message of messages) {
      if (message.type === 'text' && message.text?.body) {
        try {
          const patientPhone = message.from
          const text = message.text.body.trim().toLowerCase()

          const normalizePhone = (s: string) => s.replace(/\D/g, '')
          const normalizedIncoming = normalizePhone(patientPhone)

          const patients = await prisma.patient.findMany({
            where: { isActive: true },
            select: { id: true, phone: true, firstName: true },
          })
          const existingPatient = patients.find(p => p.phone && normalizePhone(p.phone) === normalizedIncoming)

          if (text.startsWith('register') || text.startsWith('intake') || text.startsWith('new patient')) {
            const parts = message.text.body.trim().split('\n')
            const nameLine = parts.find(p => p.toLowerCase().startsWith('name:'))
            const emailLine = parts.find(p => p.toLowerCase().startsWith('email:'))
            const reasonLine = parts.find(p => p.toLowerCase().startsWith('reason:') || p.toLowerCase().startsWith('concern:'))

            const name = nameLine?.replace(/name:\s*/i, '').trim()
            const email = emailLine?.replace(/email:\s*/i, '').trim()
            const reason = reasonLine?.replace(/(reason|concern):\s*/i, '').trim()

            if (name) {
              const existingIntake = await prisma.whatsAppIntake.findFirst({
                where: { phone: patientPhone, status: 'PENDING' },
              })

              if (existingIntake) {
                await sendWhatsAppMessage(patientPhone, {
                  messaging_product: 'whatsapp',
                  to: patientPhone,
                  type: 'text',
                  text: {
                    body: `⏳ You already have a pending registration request.\n\nOur team is reviewing it and will contact you shortly.\n\nIf you need to update your information, please reply with the corrected details.\n\nAI Clinic Assistant`,
                  },
                })
                continue
              }

              await prisma.whatsAppIntake.create({
                data: {
                  phone: patientPhone,
                  name,
                  email: email || undefined,
                  reason: reason || undefined,
                  rawMessage: message.text.body,
                  status: 'PENDING',
                },
              })

              await sendWhatsAppMessage(patientPhone, {
                messaging_product: 'whatsapp',
                to: patientPhone,
                type: 'text',
                text: {
                  body: `📝 Thank you, ${name}! Your registration request has been received.\n\nOur team will review it shortly and contact you to schedule your consultation.\n\nIf you have any questions, please reply to this message.\n\nAI Clinic Assistant`,
                },
              })

              const receptionists = await prisma.user.findMany({ where: { role: 'RECEPTIONIST' }, select: { id: true } })
              for (const rec of receptionists) {
                await prisma.notification.create({
                  data: {
                    userId: rec.id,
                    title: 'New WhatsApp Intake Request',
                    message: `${name} (${patientPhone}) submitted a registration request. Reason: ${reason || 'Not specified'}. Please review and approve in the Intake dashboard.`,
                    type: 'INTAKE',
                    channel: 'WHATSAPP',
                  },
                })
              }
              continue
            }

            await sendWhatsAppMessage(patientPhone, {
              messaging_product: 'whatsapp',
              to: patientPhone,
              type: 'text',
              text: {
                body: `📝 To register as a new patient, please reply with:\n\nREGISTER\nName: Your Full Name\nEmail: your@email.com\nReason: Brief description of your concern\n\nOur team will review your request and contact you shortly.\n\nAI Clinic Assistant`,
              },
            })
            continue
          }

          if (existingPatient) {
            if (text === 'confirm' || text === 'yes') {
              await sendWhatsAppMessage(patientPhone, {
                messaging_product: 'whatsapp',
                to: patientPhone,
                type: 'text',
                text: { body: `✅ Thank you, ${existingPatient.firstName}! Your appointment has been confirmed.\n\nSee you soon!\nAI Clinic Assistant` },
              })
              continue
            }

            if (text === 'reschedule') {
              await sendWhatsAppMessage(patientPhone, {
                messaging_product: 'whatsapp',
                to: patientPhone,
                type: 'text',
                text: { body: `📅 To reschedule, please reply with your preferred date and time, or call the clinic directly.\n\nAI Clinic Assistant` },
              })
              continue
            }
          }

          if (!existingPatient) {
            await sendWhatsAppMessage(patientPhone, {
              messaging_product: 'whatsapp',
              to: patientPhone,
              type: 'text',
              text: {
                body: `Welcome to AI Clinic! 👋\n\nTo get started, reply with:\n• REGISTER — to create a patient account\n• Or send a photo for check-in if you're an existing patient\n\nAI Clinic Assistant`,
              },
            })
          }
        } catch (textError) {
          console.error(`[WHATSAPP] Failed to process text message:`, textError)
        }
      }

      if (message.type !== 'image') continue

      try {
        const patientPhone = message.from
        const whatsappMessageId = message.id

        const existingPhoto = await prisma.patientPhoto.findFirst({
          where: { whatsappMessageId },
          select: { id: true },
        })

        if (existingPhoto) {
          console.log(`Duplicate webhook delivery ignored — whatsappMessageId: ${whatsappMessageId}`)
          continue
        }

        const normalizePhone = (s: string) => s.replace(/\D/g, '')
        const normalizedIncoming = normalizePhone(patientPhone)

        const patients = await prisma.patient.findMany({
          where: { isActive: true },
          select: { id: true, phone: true },
        })

        const patient = patients.find(p => p.phone && normalizePhone(p.phone) === normalizedIncoming)

        if (!patient) {
          console.log(`No patient found for phone: ${patientPhone}`)
          continue
        }

        const pendingCheckIn = await prisma.recoveryCheckIn.findFirst({
          where: {
            patientId: patient.id,
            status: { in: ['PENDING', 'SILENCE_RISK'] },
          },
          include: { treatment: { select: { type: true } } },
          orderBy: { scheduledDate: 'desc' },
        })

        if (!pendingCheckIn) {
          await sendWhatsAppMessage(patientPhone, {
            messaging_product: 'whatsapp',
            to: patientPhone,
            type: 'text',
            text: { body: 'Thank you for your photo! We currently don\'t have a pending check-in for you. We\'ll review your submission and get back to you shortly.' },
          })
          continue
        }

        await sendWhatsAppMessage(patientPhone, {
          messaging_product: 'whatsapp',
          to: patientPhone,
          type: 'text',
          text: { body: '📸 Photo received! Our AI is analyzing your recovery. We\'ll send you an update shortly.' },
        })

        const photoUrl = `https://graph.facebook.com/v18.0/${message.image?.id}`
        const imageResponse = await fetch(photoUrl, {
          headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
          },
        })

        if (!imageResponse.ok) {
          console.error('Failed to download WhatsApp image')
          continue
        }

        const imageBuffer = Buffer.from(await imageResponse.arrayBuffer())
        let imageUrl: string

        if (process.env.BLOB_READ_WRITE_TOKEN) {
          const { put } = await import('@vercel/blob')
          const blob = await put(`whatsapp/${Date.now()}-whatsapp.jpg`, imageBuffer, {
            access: 'public',
            contentType: 'image/jpeg',
          })
          imageUrl = blob.url
        } else if (process.env.VERCEL) {
          console.error('Photo storage not configured on Vercel. Set BLOB_READ_WRITE_TOKEN.')
          continue
        } else {
          const { writeFile } = await import('fs/promises')
          const { join } = await import('path')
          const filename = `${Date.now()}-whatsapp.jpg`
          await writeFile(join(process.cwd(), 'public', 'uploads', filename), imageBuffer)
          imageUrl = `/uploads/${filename}`
        }

        const base64Image = await resizeImage(imageBuffer, 'image/jpeg')

        const previousAnalysis = await prisma.aIAnalysis.findFirst({
          where: { checkInId: pendingCheckIn.id },
          orderBy: { analysisDate: 'desc' },
          select: {
            swellingScore: true,
            bruisingScore: true,
            rednessScore: true,
            asymmetryScore: true,
          },
        })

        const grokResult = await analyzeWithGrok(
          base64Image,
          'image/jpeg',
          pendingCheckIn.treatment?.type || 'OTHER',
          pendingCheckIn.dayNumber
        )

        let trendData = null
        if (previousAnalysis) {
          trendData = compareWithPreviousAnalysis(grokResult.clinicalFeatures, {
            edema: previousAnalysis.swellingScore,
            ecchymosis: previousAnalysis.bruisingScore,
            erythema: previousAnalysis.rednessScore,
            asymmetry: previousAnalysis.asymmetryScore,
          })
        }

        const features = grokResult.clinicalFeatures
        const shouldEscalate = grokResult.riskLevel === 'RED' || grokResult.riskLevel === 'ORANGE'
        const newStatus = shouldEscalate ? 'ESCALATED' : 'COMPLETED'

        await prisma.$transaction(async (tx) => {
          const photo = await tx.patientPhoto.create({
            data: {
              patientId: patient.id,
              checkInId: pendingCheckIn.id,
              imageUrl: imageUrl,
              source: 'WHATSAPP',
              whatsappMessageId,
              metadata: JSON.stringify({
                source: 'whatsapp',
                receivedAt: new Date().toISOString(),
              }),
            },
          })

          await tx.aIAnalysis.create({
            data: {
              photoId: photo.id,
              checkInId: pendingCheckIn.id,
              swellingScore: features.edema,
              bruisingScore: features.ecchymosis,
              rednessScore: features.erythema,
              asymmetryScore: features.asymmetry,
              noduleScore: features.nodules,
              vascularityScore: features.vascularity,
              overallScore: (features.edema + features.ecchymosis + features.erythema + features.asymmetry) / 40,
              confidenceScore: grokResult.confidenceScore,
              riskLevel: grokResult.riskLevel,
              status: grokResult.riskLevel === 'RED' || grokResult.riskLevel === 'ORANGE' ? 'UNDER_REVIEW' : 'COMPLETED',
              clinicalFeatures: JSON.stringify(features),
              findings: JSON.stringify(grokResult.findings),
              recommendations: JSON.stringify(grokResult.recommendations),
              clinicalSummary: grokResult.clinicalSummary,
              recommendedAction: grokResult.recommendedAction,
              rawResponse: JSON.stringify({ grokResult }),
              rationale: grokResult.rationale,
              confidenceFactors: JSON.stringify(grokResult.confidenceFactors),
              trendDirection: trendData?.trendDirection || null,
              trendDetails: trendData ? JSON.stringify(trendData.trendDetails) : null,
            },
          })

          await tx.recoveryCheckIn.update({
            where: { id: pendingCheckIn.id },
            data: {
              status: newStatus,
              aiResponse: grokResult.aiResponse,
              riskLevel: grokResult.riskLevel,
              completedDate: new Date(),
            },
          })
        })

        const riskEmoji = grokResult.riskLevel === 'RED' ? '🚨' :
          grokResult.riskLevel === 'ORANGE' ? '⚠️' :
          grokResult.riskLevel === 'YELLOW' ? '📋' : '✅'

        await sendWhatsAppMessage(patientPhone, {
          messaging_product: 'whatsapp',
          to: patientPhone,
          type: 'text',
          text: {
            body: `${riskEmoji} Recovery Check-in Complete

Status: ${grokResult.riskLevel}
${grokResult.clinicalSummary}

${grokResult.rationale ? `\n📋 Why: ${grokResult.rationale}` : ''}

${grokResult.recommendations.length > 0 ? `\n📌 Next Steps:\n${grokResult.recommendations.slice(0, 3).map(r => `• ${r}`).join('\n')}` : ''}

${shouldEscalate ? '\n⚡ Our team will contact you shortly.' : '\n✅ Continue your normal aftercare routine.'}

Thank you!
AI Clinic Assistant`
          },
        })
      } catch (msgError) {
        console.error(`[WHATSAPP] Failed to process message ${message.id}:`, msgError)
        await logWhatsAppWebhookError(`Failed to process message ${message.id}`, msgError, undefined, { messageId: message.id })
        continue
      }
    }

    return NextResponse.json({ status: 'ok' })
  } catch (error) {
    console.error('WhatsApp webhook error:', error)
    await logWhatsAppWebhookError('WhatsApp webhook processing failed', error, undefined, { endpoint: '/api/webhooks/whatsapp', method: 'POST' })
    return NextResponse.json({ status: 'ok' })
  }
}
