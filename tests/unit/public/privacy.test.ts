// @jest-environment jsdom
/**
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

// Ensure a DOM exists before importing page component
const { JSDOM } = require('jsdom')
const dom = new JSDOM('<!doctype html><html><body></body></html>')
global.window = dom.window
global.document = dom.window.document
global.navigator = dom.window.navigator

const React = require('react')
const { render, screen, fireEvent } = require('@testing-library/react')
// Import the page after DOM setup
const PrivacyPolicyPage = require('../../../app/(public)/privacy/page').default

describe('PrivacyPolicyPage', () => {
  it('renders English by default and switches to Hindi on toggle', () => {
    // Use createElement to keep this file valid as .ts (no JSX)
    render(React.createElement(PrivacyPolicyPage))

    // English title should be visible initially
    expect(screen.getByText(/Privacy Policy/i)).toBeTruthy()
    expect(screen.getByText(/Your privacy is important to us/i)).toBeTruthy()

    // Click Hindi toggle
    const hindiButton = screen.getByRole('button', { name: /हिन्दी|हिंदी|Hindi/i })
    fireEvent.click(hindiButton)

    // Hindi title and intro should now appear
    expect(screen.getByText(/गोपनीयता नीति/)).toBeTruthy()
    expect(screen.getByText(/हम आपकी गोपनीयता/)).toBeTruthy()
  })
})
