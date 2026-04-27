/**
 * FILE OBJECTIVE:
 * - React Email template for weekly parent report.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/email/templates/weekly-report.spec.tsx
 *
 * EDIT LOG:
 * - 2026-04-27T00:00:00Z | copilot | created -- B3.2 React Email weekly report template
 */

import * as React from 'react';
import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Row,
  Section,
  Text,
} from '@react-email/components';

// ── Brand constants ────────────────────────────────────────────────────────────

const PRIMARY = '#534AB7';
const SUCCESS = '#1D9E75';
const WARNING = '#BA7517';
const SUCCESS_BG = '#EAF3DE';
const WARNING_BG = '#FAEEDA';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface WeeklyReportData {
  studentName: string;
  parentName: string;
  daysActive: number;
  totalSessions: number;
  topicsStudied: number;
  currentStreak: number;
  strongSubject?: string;
  focusSubject?: string;
  dashboardUrl: string;
}

// ── Template ──────────────────────────────────────────────────────────────────

export function WeeklyReportEmail({
  studentName,
  parentName,
  daysActive,
  totalSessions,
  topicsStudied,
  currentStreak,
  strongSubject,
  focusSubject,
  dashboardUrl,
}: WeeklyReportData): React.ReactElement {
  return (
    <Html>
      <Head />
      <Preview>
        {studentName} studied {String(daysActive)} days this week -- see the full report
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
            {studentName}&apos;s Weekly Report
          </Heading>
          <Text style={subtitle}>Dear {parentName}, here is this week&apos;s learning summary.</Text>

          {/* Stats grid */}
          <Section style={{ margin: '24px 0' }}>
            <Row>
              <Column style={statBox}>
                <Text style={statNum}>{String(daysActive)}</Text>
                <Text style={statLabel}>Days Active</Text>
              </Column>
              <Column style={statBox}>
                <Text style={statNum}>{String(totalSessions)}</Text>
                <Text style={statLabel}>Sessions</Text>
              </Column>
              <Column style={statBox}>
                <Text style={statNum}>{String(topicsStudied)}</Text>
                <Text style={statLabel}>Topics</Text>
              </Column>
              <Column style={statBox}>
                <Text style={statNum}>{String(currentStreak)}</Text>
                <Text style={statLabel}>Day Streak</Text>
              </Column>
            </Row>
          </Section>

          {/* Subject highlights */}
          {strongSubject && (
            <Section style={{ ...highlight, backgroundColor: SUCCESS_BG, borderColor: SUCCESS }}>
              <Text style={{ ...highlightText, color: SUCCESS }}>
                Doing well in <strong>{strongSubject}</strong> -- keep it up!
              </Text>
            </Section>
          )}
          {focusSubject && (
            <Section style={{ ...highlight, backgroundColor: WARNING_BG, borderColor: WARNING }}>
              <Text style={{ ...highlightText, color: WARNING }}>
                A bit more practice in <strong>{focusSubject}</strong> will help {studentName}{' '}
                build confidence.
              </Text>
            </Section>
          )}

          <Button href={dashboardUrl} style={btn}>
            View Full Report
          </Button>

          <Text style={footer}>
            Spinzy Academy -- AI Home Tutor
            <br />
            You are receiving this because you have a linked student account.
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

const subtitle: React.CSSProperties = { fontSize: '14px', color: '#555', margin: '0 0 8px' };

const statBox: React.CSSProperties = {
  backgroundColor: '#EEEDFE',
  borderRadius: '8px',
  padding: '12px 8px',
  textAlign: 'center',
  margin: '0 4px',
};

const statNum: React.CSSProperties = {
  fontSize: '28px',
  fontWeight: '700',
  color: PRIMARY,
  margin: 0,
};

const statLabel: React.CSSProperties = {
  fontSize: '11px',
  color: '#888',
  margin: '4px 0 0',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const highlight: React.CSSProperties = {
  borderLeft: '4px solid',
  borderRadius: '4px',
  padding: '12px 16px',
  margin: '12px 0',
};

const highlightText: React.CSSProperties = { fontSize: '14px', margin: 0 };

const btn: React.CSSProperties = {
  display: 'inline-block',
  padding: '12px 28px',
  backgroundColor: PRIMARY,
  color: '#ffffff',
  textDecoration: 'none',
  borderRadius: '8px',
  fontWeight: '600',
  fontSize: '15px',
  marginTop: '16px',
};

const footer: React.CSSProperties = {
  fontSize: '12px',
  color: '#888',
  marginTop: '32px',
  borderTop: '1px solid #eee',
  paddingTop: '16px',
};

export default WeeklyReportEmail;
