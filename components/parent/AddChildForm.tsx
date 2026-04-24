/**
 * FILE OBJECTIVE:
 * - P1.1-P: Form for parent to add one or more children during onboarding.
 *   Collects first name, grade (1-12), and board (CBSE/ICSE/State Board).
 *   Supports adding multiple children before submitting. Calls onSuccess
 *   with created child records on completion.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/parent/AddChildForm.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-24T00:00:00Z | staff-engineer | created per P1.1-P AC
 */

'use client'

import { useState } from 'react'

export interface ChildInput {
  firstName: string
  grade: string
  board: string
}

export interface CreatedChild {
  id: string
  name: string
  grade: string
  board: string
}

interface AddChildFormProps {
  onSuccess: (children: CreatedChild[]) => void
}

const BOARDS = ['CBSE', 'ICSE', 'State Board']
const GRADES = Array.from({ length: 12 }, (_, i) => String(i + 1))

const EMPTY_CHILD: ChildInput = { firstName: '', grade: '', board: '' }

export default function AddChildForm({ onSuccess }: AddChildFormProps) {
  const [children, setChildren] = useState<ChildInput[]>([{ ...EMPTY_CHILD }])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function updateChild(index: number, field: keyof ChildInput, value: string) {
    setChildren((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  function addChild() {
    setChildren((prev) => [...prev, { ...EMPTY_CHILD }])
  }

  function removeChild(index: number) {
    if (children.length === 1) return
    setChildren((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const invalid = children.find((c) => !c.firstName.trim() || !c.grade || !c.board)
    if (invalid) {
      setError('Please fill in all fields for each child.')
      return
    }

    setSubmitting(true)
    const created: CreatedChild[] = []

    for (const child of children) {
      const res = await fetch('/api/parent/create-child', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: child.firstName.trim(),
          grade: child.grade,
          board: child.board,
        }),
      })

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        setError(data?.error ?? 'Could not create child profile. Please try again.')
        setSubmitting(false)
        return
      }

      const data = (await res.json()) as { child?: CreatedChild }
      if (data.child) created.push(data.child)
    }

    setSubmitting(false)
    onSuccess(created)
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {error && (
        <p role="alert" className="mb-4 text-sm text-[#E24B4A] bg-[#FCEBEB] rounded-lg px-4 py-3">
          {error}
        </p>
      )}

      <div className="space-y-6">
        {children.map((child, idx) => (
          <div
            key={idx}
            className="bg-[#EEEDFE] rounded-2xl p-5 relative"
            aria-label={`Child ${idx + 1}`}
          >
            {children.length > 1 && (
              <button
                type="button"
                onClick={() => removeChild(idx)}
                aria-label={`Remove child ${idx + 1}`}
                className="absolute top-3 right-3 text-gray-400 hover:text-[#E24B4A] text-xl leading-none min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                &times;
              </button>
            )}

            <h3 className="font-semibold text-gray-800 mb-4 dark:text-white">
              {children.length > 1 ? `Child ${idx + 1}` : `Your child`}
            </h3>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor={`firstName-${idx}`}
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  First Name *
                </label>
                <input
                  id={`firstName-${idx}`}
                  type="text"
                  maxLength={30}
                  required
                  value={child.firstName}
                  onChange={(e) => updateChild(idx, 'firstName', e.target.value)}
                  placeholder="e.g. Aarav"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base
                    focus:border-[#534AB7] focus:ring-2 focus:ring-[#534AB7]/30 focus:outline-none
                    dark:bg-gray-800 dark:border-gray-600 dark:text-white min-h-[44px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor={`grade-${idx}`}
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Grade *
                  </label>
                  <select
                    id={`grade-${idx}`}
                    required
                    value={child.grade}
                    onChange={(e) => updateChild(idx, 'grade', e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base
                      focus:border-[#534AB7] focus:ring-2 focus:ring-[#534AB7]/30 focus:outline-none
                      dark:bg-gray-800 dark:border-gray-600 dark:text-white min-h-[44px]"
                  >
                    <option value="">Select</option>
                    {GRADES.map((g) => (
                      <option key={g} value={g}>
                        Grade {g}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor={`board-${idx}`}
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Board *
                  </label>
                  <select
                    id={`board-${idx}`}
                    required
                    value={child.board}
                    onChange={(e) => updateChild(idx, 'board', e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base
                      focus:border-[#534AB7] focus:ring-2 focus:ring-[#534AB7]/30 focus:outline-none
                      dark:bg-gray-800 dark:border-gray-600 dark:text-white min-h-[44px]"
                  >
                    <option value="">Select</option>
                    {BOARDS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addChild}
        className="mt-4 w-full border-2 border-dashed border-[#534AB7] rounded-2xl
          py-3 px-4 text-[#534AB7] font-medium text-sm hover:bg-[#EEEDFE]
          transition-colors min-h-[44px]"
      >
        + Add Another Child
      </button>

      <button
        type="submit"
        disabled={submitting}
        className="mt-6 w-full bg-[#FF6B35] text-white font-bold text-base rounded-2xl
          py-4 px-6 min-h-[52px] hover:bg-[#e85a25] active:scale-95 transition-all
          disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {submitting ? 'Creating profiles...' : 'Continue'}
      </button>
    </form>
  )
}
