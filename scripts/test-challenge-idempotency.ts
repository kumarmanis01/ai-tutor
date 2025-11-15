// import { PrismaClient } from '@prisma/client';

// const prisma = new PrismaClient();

// async function main() {
//   const ts = Date.now().toString().slice(-6);
//   // create a temp user
//   const user = await prisma.user.create({
//     data: {
//       name: `test-user-${ts}`,
//       email: `test-user-${ts}@example.com`,
//     },
//   });
//   console.log('Created user:', user.id);

//   // create a temp badge
//   const badge = await prisma.badge.create({
//     data: {
//       key: `test_challenge_badge_${ts}`,
//       name: `Test Challenge Badge ${ts}`,
//       description: 'Badge for idempotency test',
//     },
//   });
//   console.log('Created badge:', badge.id);

//   // create a temp challenge that rewards points + badge
//   const now = new Date();
//   const start = new Date(now.getTime() - 1000 * 60 * 60);
//   const end = new Date(now.getTime() + 1000 * 60 * 60 * 24);
//   const challenge = await prisma.challenge.create({
//     data: {
//       key: `test_challenge_${ts}`,
//       title: `Test Challenge ${ts}`,
//       description: 'Idempotency test challenge',
//       startAt: start,
//       endAt: end,
//       rewardPoints: 123,
//       rewardBadgeId: badge.id,
//     },
//   });
//   console.log('Created challenge:', challenge.id);

//   // Helper to read state
//   async function state() {
//     const u = await prisma.user.findUnique({
//       where: { id: user.id },
//       include: { userBadges: true },
//     });
//     const ub = await prisma.userBadge.findMany({ where: { userId: user.id, badgeId: badge.id } });
//     const cp = await prisma.challengeParticipation.findUnique({
//       where: { challengeId_userId: { challengeId: challenge.id, userId: user.id } },
//     });
//     return { user: u, userBadges: ub, participation: cp };
//   }

//   // Simulate join (upsert)
//   await prisma.challengeParticipation.upsert({
//     where: { challengeId_userId: { challengeId: challenge.id, userId: user.id } },
//     update: { status: 'joined' },
//     create: { challengeId: challenge.id, userId: user.id, status: 'joined' },
//   });
//   console.log('Joined challenge');

//   // show baseline
//   console.log('State before submit:', await state());

//   // submit function (mirrors server-side logic: upsert -> if not rewarded -> transact rewards + mark)
//   async function submit() {
//     const now = new Date();
//     const participation = await prisma.challengeParticipation.upsert({
//       where: { challengeId_userId: { challengeId: challenge.id, userId: user.id } },
//       update: { status: 'completed', submittedAt: now },
//       create: { challengeId: challenge.id, userId: user.id, status: 'completed', submittedAt: now },
//     });

//     if (participation.rewardApplied) {
//       console.log('Submit: already rewarded, skipping');
//       return { alreadyRewarded: true };
//     }

//     // apply rewards transactionally and mark rewardApplied
//     await prisma.$transaction(async (tx) => {
//       if ((challenge.rewardPoints ?? 0) > 0) {
//         await tx.user.update({
//           where: { id: user.id },
//           data: { points: { increment: challenge.rewardPoints } },
//         });
//       }

//       if (challenge.rewardBadgeId) {
//         await tx.userBadge.upsert({
//           where: { userId_badgeId: { userId: user.id, badgeId: challenge.rewardBadgeId } },
//           update: {},
//           create: { userId: user.id, badgeId: challenge.rewardBadgeId },
//         });
//       }

//       await tx.challengeParticipation.update({
//         where: { id: participation.id },
//         data: { rewardApplied: true },
//       });

//       // optional event
//       await tx.event.create({
//         data: {
//           userId: user.id,
//           type: 'challenge_completed_test',
//           metadata: { challengeId: challenge.id },
//         },
//       });
//     });

//     console.log('Submit: rewards applied');
//     return { alreadyRewarded: false };
//   }

//   // First submit
//   await submit();
//   const afterFirst = await state();
//   console.log('State after first submit:', afterFirst);

//   // Second submit (should be idempotent / no extra points or duplicate badge)
//   await submit();
//   const afterSecond = await state();
//   console.log('State after second submit:', afterSecond);

//   // Assertions / checks
//   const initialPoints = 0;
//   const expectedAfter = initialPoints + challenge.rewardPoints;
//   const actualPoints = afterSecond.user?.points ?? 0;
//   const badgeCount = afterSecond.userBadges.length;

//   console.log(`Expected points >= ${expectedAfter}, actual: ${actualPoints}`);
//   console.log(`Badge instances for user/badge: ${badgeCount} (should be 1)`);

//   if (actualPoints !== expectedAfter) {
//     throw new Error('Points not applied as expected or double-applied');
//   }
//   if (badgeCount !== 1) {
//     throw new Error('Badge upsert did not behave idempotently');
//   }

//   console.log('Idempotency test passed ✅');
// }
// catchWrap();

// async function catchWrap() {
//   try {
//     await main();
//   } catch (err) {
//     console.error('Test failed:', err);
//     process.exitCode = 1;
//   } finally {
//     await prisma.$disconnect();
//   }
// }
