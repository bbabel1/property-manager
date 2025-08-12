import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Create a sample property
  const property = await prisma.property.create({
    data: {
      name: 'Sunset Apartments',
      addressLine1: '123 Main Street',
      city: 'Los Angeles',
      state: 'CA',
      postalCode: '90210',
      numberUnits: 24,
      isActive: true,
    },
  })

  console.log('✅ Database seeded successfully!')
  console.log('Created property:', property.name)
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
