/**
 * @jest-environment jsdom
 * FILE OBJECTIVE:
 * - Unit tests for the public privacy policy page to ensure English default and Hindi toggle.
 *
 * LINKED UNIT TEST:
 * - (this file)
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-17T00:00:00Z | staff-engineer | added tests for bilingual privacy page (no JSX)
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

// Relative import to the page component in the app folder
import PrivacyPolicyPage from '../../../app/(public)/privacy/page'

describe('PrivacyPolicyPage', () => {
  it('renders English by default and switches to Hindi on toggle', () => {
    // Use createElement to keep this file valid as .ts (no JSX)
    render(React.createElement(PrivacyPolicyPage))

    // English title should be visible initially
    expect(screen.getByText(/Privacy Policy/i)).toBeInTheDocument()
    expect(screen.getByText(/Your privacy is important to us/i)).toBeInTheDocument()

    // Click Hindi toggle
    const hindiButton = screen.getByRole('button', { name: /हिन्दी|हिंदी|Hindi/i })
    fireEvent.click(hindiButton)

    // Hindi title and intro should now appear
    expect(screen.getByText(/गोपनीयता नीति/)).toBeInTheDocument()
    expect(screen.getByText(/हम आपकी गोपनीयता/)).toBeInTheDocument()
  })
})
