/**
 * FILE OBJECTIVE:
 * - React Email template for admin account invitation.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/email/templates/admin-invite.spec.tsx
 *
 * EDIT LOG:
 * - 2026-04-27T00:00:00Z | copilot | created -- B3.2 React Email admin invite template
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

// ── Props ─────────────────────────────────────────────────────────────────────

interface AdminInviteEmailProps {
  setupLink: string;
  role: string;
}

// ── Template ──────────────────────────────────────────────────────────────────

export function AdminInviteEmail({ setupLink, role }: AdminInviteEmailProps): React.ReactElement {
  const roleLabel = role
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <Html>
      <Head />
      <Preview>You have been invited to join Spinzy Academy as {roleLabel}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Img
            src="https://spinzyacademy.com/icons/spinzy-navbar-source.png"
            alt="Spinzy Academy"
            height={40}
            style={logo}
          />
          <Heading style={{ color: PRIMARY, fontSize: '22px', margin: '0 0 16px' }}>
            Admin Invitation
          </Heading>
          <Text style={body1}>
            You have been invited to join the Spinzy Academy admin panel as{' '}
            <strong>{roleLabel}</strong>.
          </Text>
          <Text style={body1}>
            Click the button below to set up your account. This link expires in 48 hours.
          </Text>
          <Button href={setupLink} style={btn}>
            Set Up Your Account
          </Button>
          <Text style={body2}>
            If you were not expecting this invitation, please ignore this email or contact your
            Spinzy administrator.
          </Text>
          <Text style={footer}>
            Spinzy Academy -- AI Home Tutor
            <br />
            This is an automated message. Do not reply.
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

export default AdminInviteEmail;
