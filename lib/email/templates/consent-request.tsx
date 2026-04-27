/**
 * FILE OBJECTIVE:
 * - React Email template for parent consent request.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/email/templates/consent-request.spec.tsx
 *
 * EDIT LOG:
 * - 2026-04-27T00:00:00Z | copilot | created -- B3.2 React Email consent request template
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
  Text,
} from '@react-email/components';

// ── Brand constants ────────────────────────────────────────────────────────────

const PRIMARY = '#534AB7';
const SUCCESS = '#1D9E75';

// ── Props ─────────────────────────────────────────────────────────────────────

interface ConsentRequestEmailProps {
  parentName: string;
  childName: string;
  grade: string;
  consentLink: string;
  board?: string;
  denyLink?: string;
}

// ── Template ──────────────────────────────────────────────────────────────────

export function ConsentRequestEmail({
  parentName,
  childName,
  grade,
  consentLink,
  board,
  denyLink,
}: ConsentRequestEmailProps): React.ReactElement {
  return (
    <Html>
      <Head />
      <Preview>
        {childName} wants to join Spinzy Academy -- your approval is needed
      </Preview>
      <Body style={body}>
        <Container style={container}>
          <Img
            src="https://spinzyacademy.com/icons/spinzy-navbar-source.png"
            alt="Spinzy Academy"
            height={40}
            style={logo}
          />
          <Heading style={{ color: PRIMARY, fontSize: '22px', margin: '0 0 16px' }}>
            Your approval is needed
          </Heading>
          <Text style={body1}>Dear {parentName},</Text>
          <Text style={body1}>
            Your child <strong>{childName}</strong> (Grade {grade}{board ? `, ${board}` : ''}) has
            registered on Spinzy Academy, an AI-powered home tutoring platform. We need your consent
            before they can begin learning.
          </Text>
          <Text style={body1}>
            Spinzy Academy uses Vidya -- our AI tutor -- to provide personalised, curriculum-aligned
            lessons. Your child&apos;s data is protected under India&apos;s DPDP Act 2023.
          </Text>
          <Button href={consentLink} style={btn}>
            Review and Approve
          </Button>
          {denyLink && (
            <Text style={body2}>
              If you do not want {childName} to use Spinzy Academy, you can{' '}
              <a href={denyLink} style={{ color: '#E24B4A' }}>
                deny access here
              </a>
              .
            </Text>
          )}
          <Text style={body2}>
            This link is valid for 48 hours. If you have questions, reply to this email.
          </Text>
          <Text style={footer}>
            Spinzy Academy -- AI Home Tutor
            <br />
            <span style={{ color: SUCCESS }}>Trusted by parents across India</span>
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

const body1: React.CSSProperties = { fontSize: '15px', color: '#1a1a1a', margin: '0 0 12px' };

const body2: React.CSSProperties = { fontSize: '13px', color: '#555', margin: '16px 0 0' };

const btn: React.CSSProperties = {
  display: 'inline-block',
  padding: '12px 28px',
  backgroundColor: PRIMARY,
  color: '#ffffff',
  textDecoration: 'none',
  borderRadius: '8px',
  fontWeight: '600',
  fontSize: '15px',
  marginTop: '8px',
};

const footer: React.CSSProperties = {
  fontSize: '12px',
  color: '#888',
  marginTop: '32px',
  borderTop: '1px solid #eee',
  paddingTop: '16px',
};

export default ConsentRequestEmail;
