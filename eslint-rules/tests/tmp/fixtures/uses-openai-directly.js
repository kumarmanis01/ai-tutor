import OpenAI from 'openai'

// This file intentionally imports the SDK directly to exercise the rule.
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export default async function run() {
  return client
}
