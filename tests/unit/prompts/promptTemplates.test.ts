/**
 * FILE OBJECTIVE:
 * - Validate prompt template files exist and render correctly when placeholders are substituted.
 *
 * LINKED UNIT TEST:
 * - tests/unit/prompts/promptTemplates.test.ts
 *
 * EDIT LOG:
 * - 2026-01-27T14:00:00Z | copilot | added prompt template rendering tests
 */

import fs from 'fs'
import path from 'path'

describe('prompt templates', () => {
  const promptsDir = path.join(process.cwd(), 'prompts')

  it('base_context.md exists and contains required placeholders', () => {
    const p = path.join(promptsDir, 'base_context.md')
    expect(fs.existsSync(p)).toBe(true)
    const content = fs.readFileSync(p, 'utf8')
    expect(content).toContain('{language}')
    expect(content).toContain('{board}')
    expect(content).toContain('{grade}')
    expect(content).toContain('{subject}')
  })

  it('notes.md renders without leftover placeholders', () => {
    const base = fs.readFileSync(path.join(promptsDir, 'base_context.md'), 'utf8')
    const notes = fs.readFileSync(path.join(promptsDir, 'notes.md'), 'utf8')
    const rendered = (base + '\n' + notes)
      .replace(/{chapter_title}/g, 'Number System')
      .replace(/{topic_title}/g, 'Rational Numbers')
      .replace(/{subject}/g, 'Mathematics')
      .replace(/{grade}/g, '8')
      .replace(/{board}/g, 'CBSE')
      .replace(/{language}/g, 'en')

    // Ensure no remaining named placeholders used in our templates
    expect(rendered).not.toMatch(/\{chapter_title\}/)
    expect(rendered).not.toMatch(/\{topic_title\}/)
    expect(rendered).not.toMatch(/\{subject\}/)
    expect(rendered).not.toMatch(/\{grade\}/)
    expect(rendered).not.toMatch(/\{board\}/)
    expect(rendered).not.toMatch(/\{language\}/)
  })

  it('question templates exist for easy/medium/hard', () => {
    const easy = path.join(promptsDir, 'questions.easy.md')
    const med = path.join(promptsDir, 'questions.medium.md')
    const hard = path.join(promptsDir, 'questions.hard.md')
    expect(fs.existsSync(easy)).toBe(true)
    expect(fs.existsSync(med)).toBe(true)
    expect(fs.existsSync(hard)).toBe(true)
  })
})
