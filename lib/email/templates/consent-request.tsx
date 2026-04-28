/**
 * FILE OBJECTIVE:
 * - P1.2-R: React Email template for parent consent request (unsolicited).
 *   Sent when a minor registers via the student flow with channel=EMAIL.
 *   Button text, controls checklist, and expiry notice match P1.2-R AC.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/email/templates/consent-request.spec.tsx
 *
 * EDIT LOG:
 * - 2026-04-27T00:00:00Z | copilot | created -- B3.2 React Email consent request template
 * - 2026-04-27T00:00:00Z | staff-engineer | P1.2-R: button text, controls list, expiry, preview text
 */

import * as React from 'react';
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from '@react-email/components';

// ── Brand constants ────────────────────────────────────────────────────────────

const PRIMARY = '#534AB7';
const TANGERINE = '#FF6B35';
const SUCCESS = '#1D9E75';
const DANGER = '#E24B4A';

// ── Props ─────────────────────────────────────────────────────────────────────

interface ConsentRequestEmailProps {
  parentName: string;
  childName: string;
  grade: string;
  consentLink: string;
  board?: string;
  denyLink?: string;
}

// ── Controls lists ────────────────────────────────────────────────────────────

const CONTROLS_ALLOWED = [
  "Child can access unlimited study notes and guided practice",
  "Learning activity visible only to you",
  "You can set screen time limits and block subjects",
];

const CONTROLS_NOT = [
  "No ads or targeted recommendations",
  "No third-party data sharing",
  "No social features (chat, friend requests)",
];

// ── Template ──────────────────────────────────────────────────────────────────

export function ConsentRequestEmail({
  parentName,
  childName,
  grade,
  consentLink,
  board,
  denyLink,
}: ConsentRequestEmailProps): React.ReactElement {
  const gradeBoard = [grade ? `Grade ${grade}` : null, board ?? null].filter(Boolean).join(', ');
  return (
    <Html>
      <Head />
      <Preview>
        {childName} wants to learn with Spinzy Academy -- your approval is needed
      </Preview>
      <Body style={body}>
        <Container style={container}>
          <Img
            src="https://spinzyacademy.com/icons/spinzy-navbar-source.png"
            alt="Spinzy Academy"
            height={40}
            style={logo}
          />
          <Heading style={{ color: PRIMARY, fontSize: '22px', margin: '0 0 8px' }}>
            {childName} wants to learn with Spinzy Academy
          </Heading>
          {gradeBoard ? (
            <Text style={mutedText}>{gradeBoard}</Text>
          ) : null}

          <Text style={body1}>Dear {parentName},</Text>
          <Text style={body1}>
            Your child <strong>{childName}</strong> has registered on Spinzy Academy, an
            AI-powered home tutoring platform. Your consent is required before they can begin
            learning, as required by India&apos;s DPDP Act 2023.
          </Text>

          {/* Controls checklist */}
          <Section style={checklistBox}>
            <Text style={checklistHeading}>As a parent you can:</Text>
            {CONTROLS_ALLOWED.map((item) => (
              <Text key={item} style={checkItem}>
                <span style={{ color: SUCCESS }}>&#x2705;</span> {item}
              </Text>
            ))}
            {CONTROLS_NOT.map((item) => (
              <Text key={item} style={checkItem}>
                <span style={{ color: DANGER }}>&#x274C;</span> {item}
              </Text>
            ))}
          </Section>

          {/* Primary CTA */}
          <Button href={consentLink} style={btn}>
            Approve &amp; Set Limits
          </Button>

          {/* Deny link */}
          {denyLink ? (
            <Text style={denyText}>
              If you do not want {childName} to use Spinzy Academy,{' '}
              <a href={denyLink} style={{ color: '#888' }}>
                deny access here
              </a>
              .
            </Text>
          ) : null}

          <Text style={body2}>
            This link expires in 48 hours. If you did not expect this email, you can ignore it
            safely.
          </Text>

          <Text style={footerText}>
            Spinzy Academy -- AI Home Tutor
            <br />
            <span style={{ color: SUCCESS }}>Trusted by parents across India</span>
            <br />
            <a href="https://spinzyacademy.com/privacy" style={{ color: PRIMARY }}>
              Privacy Policy
            </a>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const body: React.CSSProperties = {
  backgroundColor: '#f5f5f5',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif',
};

const container: React.CSSProperties = {
  backgroundColor: '#ffffff',
  margin: '40px auto',
  padding: '32px',
  borderRadius: '8px',
  maxWidth: '520px',
};

const logo: React.CSSProperties = { marginBottom: '24px', display: 'block' };

const mutedText: React.CSSProperties = { fontSize: '13px', color: '#888', margin: '0 0 16px' };

const body1: React.CSSProperties = { fontSize: '15px', color: '#1a1a1a', margin: '0 0 12px' };

const body2: React.CSSProperties = { fontSize: '13px', color: '#888', margin: '16px 0 0' };

const checklistBox: React.CSSProperties = {
  backgroundColor: '#EEEDFE',
  borderRadius: '8px',
  padding: '16px',
  margin: '16px 0',
};

const checklistHeading: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: '600',
  color: '#374151',
  margin: '0 0 8px',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const checkItem: React.CSSProperties = {
  fontSize: '14px',
  color: '#374151',
  margin: '4px 0',
};

const btn: React.CSSProperties = {
  display: 'inline-block',
  padding: '14px 28px',
  backgroundColor: TANGERINE,
  color: '#ffffff',
  textDecoration: 'none',
  borderRadius: '8px',
  fontWeight: '700',
  fontSize: '16px',
  marginTop: '8px',
};

const denyText: React.CSSProperties = { fontSize: '13px', color: '#888', margin: '12px 0 0' };

const footerText: React.CSSProperties = {
  fontSize: '12px',
  color: '#888',
  marginTop: '32px',
  borderTop: '1px solid #eee',
  paddingTop: '16px',
  lineHeight: '1.8',
};

export default ConsentRequestEmail;
