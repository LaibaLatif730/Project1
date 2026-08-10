import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function seedClinic(name: string, suffix: string) {
  console.log(`\nSeeding clinic: ${name}...`)

  const clinic = await prisma.clinic.create({
    data: {
      name,
      address: `${suffix} Beauty Street, Suite 100`,
      phone: `+1-555-0${suffix}`,
      email: `info@${suffix}clinic.com`,
      timezone: 'America/New_York',
    },
  })

  const adminPassword = await bcrypt.hash('admin123', 12)
  const doctorPassword = await bcrypt.hash('doctor123', 12)
  const receptionistPassword = await bcrypt.hash('patient123', 12)

  const adminUser = await prisma.user.create({
    data: {
      name: `Admin ${name}`,
      email: `admin@${suffix}clinic.com`,
      password: adminPassword,
      role: 'ADMIN',
      clinicId: clinic.id,
    },
  })

  const doctorUser = await prisma.user.create({
    data: {
      name: `Dr. Smith ${suffix}`,
      email: `doctor@${suffix}clinic.com`,
      password: doctorPassword,
      role: 'DOCTOR',
      clinicId: clinic.id,
    },
  })

  const receptionistUser = await prisma.user.create({
    data: {
      name: `Receptionist ${suffix}`,
      email: `receptionist@${suffix}clinic.com`,
      password: receptionistPassword,
      role: 'RECEPTIONIST',
      clinicId: clinic.id,
    },
  })

  const doctor = await prisma.doctor.create({
    data: {
      userId: doctorUser.id,
      specialty: 'Aesthetic Medicine',
      licenseNo: `MD-${suffix.toUpperCase()}`,
      clinicId: clinic.id,
    },
  })

  const products = await Promise.all([
    prisma.product.create({
      data: {
        name: 'Botox 100u',
        category: 'NEUROMODULATOR',
        manufacturer: 'Allergan',
        description: 'Botulinum Toxin Type A 100 units',
        clinicId: clinic.id,
      },
    }),
    prisma.product.create({
      data: {
        name: 'Juvederm Ultra XC',
        category: 'HYALURONIC_ACID_FILLER',
        manufacturer: 'Allergan',
        description: 'Hyaluronic acid filler 1mL',
        clinicId: clinic.id,
      },
    }),
  ])

  const patients = await Promise.all([
    prisma.patient.create({
      data: {
        firstName: `Alice ${suffix}`,
        lastName: 'Smith',
        email: `alice@${suffix}patient.com`,
        phone: '+1-555-0101',
        gender: 'FEMALE',
        dateOfBirth: new Date('1985-03-15'),
        clinicId: clinic.id,
        consentGiven: true,
        consentDate: new Date(),
      },
    }),
    prisma.patient.create({
      data: {
        firstName: `Bob ${suffix}`,
        lastName: 'Johnson',
        email: `bob@${suffix}patient.com`,
        phone: '+1-555-0102',
        gender: 'MALE',
        dateOfBirth: new Date('1978-07-22'),
        clinicId: clinic.id,
        consentGiven: true,
        consentDate: new Date(),
      },
    }),
  ])

  const treatments = await Promise.all([
    prisma.treatment.create({
      data: {
        patientId: patients[0].id,
        doctorId: doctor.id,
        clinicId: clinic.id,
        type: 'BOTOX',
        productName: 'Botox 100u',
        units: 20,
        injectionAreas: JSON.stringify(['Forehead', 'Glabella']),
        treatmentDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        notes: `Standard Botox treatment for ${name}`,
      },
    }),
    prisma.treatment.create({
      data: {
        patientId: patients[1].id,
        doctorId: doctor.id,
        clinicId: clinic.id,
        type: 'FILLER_HYALURONIC',
        productName: 'Juvederm Ultra XC',
        units: 1,
        volume: 1.0,
        injectionAreas: JSON.stringify(['Lips']),
        treatmentDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        notes: `Lip augmentation for ${name}`,
      },
    }),
  ])

  for (const treatment of treatments) {
    for (const dayNumber of [1, 2, 3, 5, 7]) {
      await prisma.recoveryCheckIn.create({
        data: {
          treatmentId: treatment.id,
          patientId: treatment.patientId,
          clinicId: clinic.id,
          dayNumber,
          scheduledDate: new Date(treatment.treatmentDate.getTime() + dayNumber * 24 * 60 * 60 * 1000),
          status: dayNumber <= 2 ? 'COMPLETED' : 'PENDING',
          riskLevel: 'GREEN',
        },
      })
    }
  }

  await Promise.all([
    prisma.appointment.create({
      data: {
        patientId: patients[0].id,
        doctorId: doctor.id,
        clinicId: clinic.id,
        appointmentDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        duration: 30,
        type: 'FOLLOW_UP',
        status: 'SCHEDULED',
      },
    }),
    prisma.appointment.create({
      data: {
        patientId: patients[1].id,
        doctorId: doctor.id,
        clinicId: clinic.id,
        appointmentDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        duration: 60,
        type: 'TREATMENT',
        status: 'SCHEDULED',
      },
    }),
  ])

  console.log(`  Clinic: ${name} (${clinic.id})`)
  console.log(`  Admin: admin@${suffix}clinic.com / admin123`)
  console.log(`  Doctor: doctor@${suffix}clinic.com / doctor123`)
  console.log(`  Receptionist: receptionist@${suffix}clinic.com / patient123`)
  console.log(`  Patients: ${patients.length}`)

  return clinic
}

async function main() {
  console.log('Seeding multi-clinic database...')

  await seedClinic('Aesthetic Beauty Clinic', 'alpha')
  await seedClinic('Glow Wellness Spa', 'beta')

  // Treatment protocols are shared across clinics
  const protocols = [
    {
      procedureType: 'BOTOX',
      category: 'Neuromodulator',
      substance: 'Botulinum Toxin Type A',
      typicalVolumes: '20-64 units',
      recoveryTimeline: JSON.stringify({
        day_0_1: 'Onset of effect begins. Mild swelling at injection sites possible.',
        day_2_7: 'Effect becoming visible. Peak effect at Day 14.',
        day_7_14: 'Full effect achieved.',
      }),
      normalSymptoms: JSON.stringify(['Mild swelling at injection sites', 'Minor bruising', 'Headache']),
      warningSigns: JSON.stringify(['Brow ptosis', 'Eyelid droop', 'Difficulty swallowing']),
      emergencySigns: JSON.stringify(['Difficulty breathing', 'Difficulty swallowing', 'Voice changes']),
      followUpSchedule: JSON.stringify([
        { day: 1, type: 'Photo + Questionnaire', purpose: 'Early assessment' },
        { day: 7, type: 'Photo + Questionnaire', purpose: 'Effect assessment' },
        { day: 14, type: 'Photo + Questionnaire', purpose: 'Full effect evaluation' },
      ]),
      contraindications: JSON.stringify(['Known allergy to botulinum toxin', 'Infection at treatment site', 'Pregnancy']),
      postProcedureInstructions: JSON.stringify([
        'Do not lie down for 4 hours after treatment',
        'Avoid rubbing or massaging the treated area for 24 hours',
        'Avoid strenuous exercise for 24 hours',
      ]),
    },
    {
      procedureType: 'FILLER_HYALURONIC',
      category: 'Dermal Filler',
      substance: 'Hyaluronic Acid',
      typicalVolumes: '0.5mL - 2.0mL',
      recoveryTimeline: JSON.stringify({
        day_0_1: 'Peak swelling and bruising expected. Ice recommended.',
        day_2_3: 'Swelling begins to subside.',
        day_4_7: 'Major swelling resolved.',
        day_7_14: 'Near-final result visible.',
        day_14_30: 'Final result achieved.',
      }),
      normalSymptoms: JSON.stringify(['Swelling', 'Bruising', 'Tenderness', 'Firmness at injection site']),
      warningSigns: JSON.stringify(['Increasing swelling after Day 3', 'Blanching or white discoloration', 'Severe pain']),
      emergencySigns: JSON.stringify(['Sudden severe pain', 'Blanching of skin', 'Visual changes', 'Skin necrosis indicators']),
      followUpSchedule: JSON.stringify([
        { day: 1, type: 'Photo + Questionnaire', purpose: 'Early assessment' },
        { day: 3, type: 'Photo + Questionnaire', purpose: 'Swelling monitoring' },
        { day: 7, type: 'Photo + Questionnaire', purpose: 'Healing assessment' },
        { day: 14, type: 'Photo + Questionnaire', purpose: 'Outcome evaluation' },
      ]),
      contraindications: JSON.stringify(['Active infection at treatment site', 'Known allergy to product components', 'Pregnancy']),
      postProcedureInstructions: JSON.stringify([
        'Apply ice packs for 10 minutes on, 10 minutes off for first 24 hours',
        'Avoid strenuous exercise for 48 hours',
        'Avoid extreme heat for 48 hours',
      ]),
    },
  ]

  for (const protocol of protocols) {
    await prisma.treatmentProtocol.create({ data: protocol })
  }

  console.log('\nDatabase seeded successfully!')
  console.log('\nCross-clinic test credentials:')
  console.log('  Clinic Alpha: admin@alphaclinic.com / admin123')
  console.log('  Clinic Beta:  admin@betaclinic.com / admin123')
  console.log('\nEach clinic has its own patients, treatments, appointments, and check-ins.')
  console.log('Staff from one clinic should NEVER see data from the other.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
