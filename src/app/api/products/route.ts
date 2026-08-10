import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { productSchema, productBatchSchema } from '@/lib/validators'
import { requireAuth, getClinicIdFromSession } from '@/lib/api-auth'

export async function GET(req: Request) {
  try {
    const session = await requireAuth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const clinicId = await getClinicIdFromSession()
    if (!clinicId) {
      return NextResponse.json({ error: 'Missing clinicId' }, { status: 400 })
    }

    const { searchParams } = new URL(req.url)
    const category = searchParams.get('category')

    const where: any = { isActive: true, clinicId }
    if (category) where.category = category

    const products = await prisma.product.findMany({
      where,
      include: {
        batches: {
          where: { isActive: true },
          orderBy: { expiryDate: 'asc' },
        },
        _count: { select: { treatments: true } },
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(products)
  } catch (error) {
    console.error('Error fetching products:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAuth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const clinicId = await getClinicIdFromSession()
    if (!clinicId) {
      return NextResponse.json({ error: 'Missing clinicId' }, { status: 400 })
    }

    const body = await req.json()
    const validatedData = productSchema.parse(body)

    const product = await prisma.product.create({
      data: {
        name: validatedData.name,
        category: validatedData.category,
        manufacturer: validatedData.manufacturer,
        description: validatedData.description,
        clinicId,
      },
    })

    return NextResponse.json(product, { status: 201 })
  } catch (error) {
    console.error('Error creating product:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const session = await requireAuth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 })
    }

    const clinicId = await getClinicIdFromSession()
    if (!clinicId) return NextResponse.json({ error: 'No clinic assigned' }, { status: 400 })
    const existingProduct = await prisma.product.findFirst({ where: { id, clinicId } })
    if (!existingProduct) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const allowedFields: Record<string, any> = {}
    if (updateData.name) allowedFields.name = updateData.name
    if (updateData.category) allowedFields.category = updateData.category
    if (updateData.manufacturer !== undefined) allowedFields.manufacturer = updateData.manufacturer
    if (updateData.description !== undefined) allowedFields.description = updateData.description
    if (updateData.isActive !== undefined) allowedFields.isActive = updateData.isActive

    if (updateData.batch) {
      const batch = updateData.batch
      if (batch.batchNumber && batch.expiryDate) {
        await prisma.productBatch.create({
          data: {
            productId: id,
            batchNumber: batch.batchNumber,
            expiryDate: new Date(batch.expiryDate),
            quantity: batch.quantity ? parseInt(batch.quantity) : undefined,
          },
        })
      }
      return NextResponse.json({ success: true })
    }

    const product = await prisma.product.update({
      where: { id },
      data: allowedFields,
    })

    return NextResponse.json(product)
  } catch (error) {
    console.error('Error updating product:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await requireAuth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 })
    }

    const clinicId = await getClinicIdFromSession()
    if (!clinicId) return NextResponse.json({ error: 'No clinic assigned' }, { status: 400 })
    const existingProduct = await prisma.product.findFirst({ where: { id, clinicId } })
    if (!existingProduct) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await prisma.product.update({
      where: { id },
      data: { isActive: false },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting product:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
