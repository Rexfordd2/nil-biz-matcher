import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Create or reuse two coaches
  const coachA = await prisma.coach.upsert({
    where: { email: 'coachA@school.edu' },
    update: {},
    create: {
      name: 'Coach A',
      email: 'coachA@school.edu',
      school: 'Example University',
      sport: 'Basketball',
      level: 'NCAA D1'
    }
  })
  const coachB = await prisma.coach.upsert({
    where: { email: 'coachB@school.edu' },
    update: {},
    create: {
      name: 'Coach B',
      email: 'coachB@school.edu',
      school: 'Sample College',
      sport: 'Football',
      level: 'NCAA D2'
    }
  })

  // Create a highlight clip (replace athleteId later if you want)
  const clip = await prisma.highlightClip.create({
    data: {
      athleteId: 'athlete-123',
      title: 'Sample Highlight',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      description: 'Auto-seeded highlight clip'
    }
  })

  // Print out IDs for later use
  const payload = {
    clipId: clip.id,
    coachIds: [coachA.id, coachB.id],
    athleteId: 'athlete-123'
  }
  console.log(JSON.stringify(payload, null, 2))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })


