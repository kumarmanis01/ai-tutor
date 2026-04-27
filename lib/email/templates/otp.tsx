/**
 * FILE OBJECTIVE:
 * - React Email template for OTP delivery.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/email/templates/otp.spec.tsx
 *
 * EDIT LOG:
 * - 2026-04-27T00:00:00Z | copilot | created -- B3.2 React Email OTP template
 */

import * as React from 'react';
import {
  Body,
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

// ── Props ─────────────────────────────────────────────────────────────────────

interface OTPEmailProps {
  otp: string;
  expiryMinutes?: number;
}

// ── Template ──────────────────────────────────────────────────────────────────

export function OTPEmail({ otp, expiryMinutes = 10 }: OTPEmailProps): React.ReactElement {
  return (
    <Html>
      <Head />
      <Preview>Your Spinzy Academy verification code is {otp}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Img
            src="https://spinzyacademy.com/icons/spinzy-navbar-source.png"
            alt="Spinzy Academy"
            height={40}
            style={logo}
          />
          <Heading style={{ color: PRIMARY, fontSize: '22px', margin: '0 0 16px' }}>
            Your verification code
          </Heading>
          <Section style={otpBox}>
            <Text style={otpText}>{otp}</Text>
          </Section>
          <Text style={body1}>
            This code expires in {expiryMinutes} minutes. Do not share it with anyone.
          </Text>
          <Text style={footer}>
            Spinzy Academy -- AI Home Tutor
            <br />
            If you did not request this, you can safely ignore this email.
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

const otpBox: React.CSSProperties = {
  backgroundColor: '#EEEDFE',
  borderRadius: '8px',
  padding: '24px',
  textAlign: 'center',
  margin: '24px 0',
};

const otpText: React.CSSProperties = {
  fontSize: '36px',
  fontWeight: '700',
  letterSpacing: '8px',
  color: PRIMARY,
  margin: 0,
};

const body1: React.CSSProperties = { fontSize: '14px', color: '#555', margin: '0 0 24px' };

const footer: React.CSSProperties = {
  fontSize: '12px',
  color: '#888',
  marginTop: '32px',
  borderTop: '1px solid #eee',
  paddingTop: '16px',
};

export default OTPEmail;
