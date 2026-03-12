import { PROMPT_EVAL_FIXTURES, assembleFixturePrompt } from '@/tests/eval/_shared/promptEvalFixtures'

type AssertionResult = {
  fixture: string
  description: string
  pass: boolean
}

function line(s: string) {
  process.stdout.write(`${s}\n`)
}

function run() {
  const results: AssertionResult[] = []

  for (const fixture of PROMPT_EVAL_FIXTURES) {
    const prompt = assembleFixturePrompt(fixture)
    for (const a of fixture.assertions) {
      let pass = false
      try {
        pass = a.assert(prompt) === true
      } catch {
        pass = false
      }
      results.push({ fixture: fixture.name, description: a.description, pass })
    }
  }

  let passed = 0
  for (const r of results) {
    if (r.pass) {
      passed += 1
      line(`PASS  ${r.fixture} :: ${r.description}`)
    } else {
      line(`FAIL  ${r.fixture} :: ${r.description}`)
    }
  }

  line(`\n${passed}/${results.length} assertions passed`)

  if (passed !== results.length) {
    process.exitCode = 1
  } else {
    process.exitCode = 0
  }
}

run()

