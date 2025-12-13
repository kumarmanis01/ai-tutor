import { enqueueTopicHydration } from "@/producers/enqueueTopicHydration";

export async function POST(
  _: Request,
  { params }: { params: { id: string } }
) {
  await enqueueTopicHydration(params.id)
  return Response.json({ queued: true })
}
