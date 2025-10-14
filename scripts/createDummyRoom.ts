import { prisma } from '../lib/db';

/**
 * Script to create a dummy room and participant for testing.
 * Run with: ts-node scripts/createDummyRoom.ts
 */
async function main() {
  // Create a dummy room
  const room = await prisma.room.create({
    data: {
      name: 'Dummy Study Room',
      subject: 'Mathematics',
      grade: '10',
      isPrivate: false,
    },
  });

  // Create a dummy participant (user)
  const user = await prisma.user.create({
    data: {
      name: 'Test Student',
      email: 'teststudent@example.com',
    },
  });

  // Add participant to the room
  await prisma.roomMember.create({
    data: {
      roomId: room.id,
      userId: user.id,
      name: user.name,
    },
  });

  console.log('Dummy room and participant created:');
  console.log('Room:', room);
  console.log('User:', user);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
