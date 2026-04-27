// AI CONTENT ENGINE NOTICE
import { callLLM } from '@/lib/callLLM'

export default async function run() {
  return callLLM({ prompt: 'Test' })
}
