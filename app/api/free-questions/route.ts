import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/db';
import { getSession } from 'next-auth/react';

const FREE_QUESTIONS_LIMIT = 5;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getSession({ req });

  if (!session || !session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = session.user.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const today = new Date();
  const lastUpdate = user.lastFreeQuestionsUpdate || new Date(0);

  if (lastUpdate.toDateString() !== today.toDateString()) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        todaysFreeQuestionsCount: 0,
        lastFreeQuestionsUpdate: today,
      },
    });
  }

  if (user.todaysFreeQuestionsCount >= FREE_QUESTIONS_LIMIT) {
    return res.status(403).json({ error: 'Free question limit reached' });
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      todaysFreeQuestionsCount: {
        increment: 1,
      },
    },
  });

  return res.status(200).json({ message: 'Free question allowed' });
}
