import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import { analyzeWithGrok, compareWithPreviousAnalysis } from '@/lib/grok'
import { resizeImage } from '@/lib/image-utils'
import { requirePatientAuth } from '@/lib/patient-auth'
import { logAIError } from '@/lib/error-logger'

export async function POST(req: Request) {
  try {
    const { patientId } = await requirePatientAuth()
    const formData = await req.formData()
    const file = formData.get('photo') as File
    const checkInId = formData.get('checkInId') as string
    const message = formData.get('message') as string

    if (!file || !checkInId) {
      return NextResponse.json(
        { error: 'Photo and check-in ID are required' },
        { status: 400 }
      )
    }

    if (!/^c[a-z0-9]{24,}$/.test(checkInId)) {
      return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 })
    }

    const checkIn = await prisma.recoveryCheckIn.findUnique({
      where: { id: checkInId },
      include: { treatment: { select: { type: true } } },
    })

    if (!checkIn || checkIn.patientId !== patientId) {
      return NextResponse.json({ error: 'Check-in not found or does not belong to this patient' }, { status: 404 })
    }

    const bytes = await file.arrayBuffer()
    let buffer = Buffer.from(bytes)

    const filename = `${Date.now()}-${file.name}`
    let imageUrl: string

    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const { put } = await import('@vercel/blob')
      const blob = await put(`uploads/${filename}`, buffer, {
        access: 'public',
        contentType: file.type,
      })
      imageUrl = blob.url
    } else if (process.env.VERCEL) {
      return NextResponse.json({ error: 'Photo storage not configured. Set BLOB_READ_WRITE_TOKEN in Vercel environment variables.' }, { status: 500 })
    } else {
      const uploadDir = join(process.cwd(), 'public', 'uploads')
      await writeFile(join(uploadDir, filename), buffer)
      imageUrl = `/uploads/${filename}`
    }

    const base64Image = await resizeImage(buffer, file.type)

    const previousAnalysis = await prisma.aIAnalysis.findFirst({
      where: { checkInId },
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
      file.type,
      checkIn?.treatment?.type,
      checkIn?.dayNumber
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
    const shouldEscalate = grokResult.riskLevel === 'RED' || grokResult.riskLevel === 'ORANGE' || grokResult.aiUnavailable
    const newStatus = shouldEscalate ? 'ESCALATED' : 'COMPLETED'

    let nextCheckInHours: number | null = null
    if (grokResult.riskLevel === 'YELLOW') nextCheckInHours = 24
    else if (grokResult.riskLevel === 'ORANGE') nextCheckInHours = 4
    else if (grokResult.riskLevel === 'RED') nextCheckInHours = 1

    const { photo, aiAnalysis, nextCheckIn } = await prisma.$transaction(async (tx) => {
      const photo = await tx.patientPhoto.create({
        data: {
          patientId,
          checkInId,
          imageUrl: imageUrl,
          source: 'PORTAL',
          metadata: JSON.stringify({
            originalName: file.name,
            size: file.size,
            type: file.type,
            grokLabels: grokResult.labels,
          }),
        },
      })

      const aiAnalysis = await tx.aIAnalysis.create({
        data: {
          photoId: photo.id,
          checkInId,
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
        where: { id: checkInId },
        data: {
          status: newStatus,
          patientMessage: message || undefined,
          aiResponse: grokResult.aiResponse,
          riskLevel: grokResult.riskLevel,
          completedDate: new Date(),
        },
      })

      let nextCheckIn = null
      if (nextCheckInHours) {
        const currentCheckIn = await tx.recoveryCheckIn.findUnique({
          where: { id: checkInId },
          select: { treatmentId: true, patientId: true, dayNumber: true },
        })
        if (currentCheckIn) {
          const nextDate = new Date()
          nextDate.setHours(nextDate.getHours() + nextCheckInHours)
          nextCheckIn = await tx.recoveryCheckIn.create({
            data: {
              treatmentId: currentCheckIn.treatmentId,
              patientId: currentCheckIn.patientId,
              dayNumber: currentCheckIn.dayNumber + 1,
              scheduledDate: nextDate,
              status: 'PENDING',
              riskLevel: 'GREEN',
            },
          })
        }
      }

      return { photo, aiAnalysis, nextCheckIn }
    })

    return NextResponse.json({
      photo,
      analysis: aiAnalysis,
      riskLevel: grokResult.riskLevel,
      findings: grokResult.findings,
      recommendations: grokResult.recommendations,
      aiResponse: grokResult.aiResponse,
      clinicalSummary: grokResult.clinicalSummary,
      recommendedAction: grokResult.recommendedAction,
      rationale: grokResult.rationale,
      confidenceFactors: grokResult.confidenceFactors,
      aiUnavailable: grokResult.aiUnavailable || false,
      aiFailureReason: grokResult.aiFailureReason || null,
      trendDirection: trendData?.trendDirection || null,
      trendDetails: trendData?.trendDetails || null,
      nextCheckIn,
      shouldEscalate,
      visionLabels: grokResult.labels,
      disclaimer: 'This analysis is generated by AI clinical decision support system and should not replace professional medical advice. Always consult your healthcare provider for clinical decisions.',
    }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error uploading photo:', error)
    await logAIError('AI photo analysis upload failed', error, undefined, { endpoint: '/api/patient/checkin/upload' })
    const message = error instanceof Error ? error.message : 'Photo upload failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
