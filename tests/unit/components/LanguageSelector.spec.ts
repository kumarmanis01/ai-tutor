/**
 * FILE OBJECTIVE:
 * - Unit tests for `LanguageSelector` component.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/LanguageSelector.spec.ts
 *
 * EDIT LOG:
 * - 2026-04-18T00:00:00Z | copilot | add basic persistence & callback test
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'

import LanguageSelector from '@/components/LanguageSelector'

describe('LanguageSelector', () => {
  beforeEach(() => {
    // @ts-ignore
    global.fetch = jest.fn()
    // Clear localStorage
    try { global.localStorage?.clear?.() } catch (e) {}
  })

  it('persists selection and calls setLang', async () => {
    // @ts-ignore
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })

    const setLang = jest.fn()
    render(<LanguageSelector lang={'English'} setLang={setLang} availableCodes={['en','hi']} />)

    // open menu
    const opener = screen.getByTitle('Choose Language')
    fireEvent.click(opener)

    // click Hindi option (label contains 'Hindi')
    const hiBtn = await screen.findByText(/Hindi/i)
    fireEvent.click(hiBtn)

    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    expect(setLang).toHaveBeenCalled()
  })
})
