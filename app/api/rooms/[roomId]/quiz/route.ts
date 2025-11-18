import { logApiUsage } from '@/utils/logApiUsage';

export async function GET() {
  logApiUsage('/api/rooms/[roomId]/quiz', 'GET');
  // Dummy function
  return new Response('Dummy function called');
}
