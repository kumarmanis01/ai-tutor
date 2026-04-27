/**
 * FILE OBJECTIVE:
 * - P2.2: React Email templates for weekly parent progress report.
 *   Three variants based on activity and subscription tier:
 *     WeeklyReportEmailFree        -- free-tier parent, includes premium teaser
 *     WeeklyReportEmailPremium     -- premium parent, includes weak topics section
 *     WeeklyReportEmailZeroActivity -- no sessions this week, includes suggested topic
 *   All variants include an unsubscribe link in the footer.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/email/templates/weekly-report.spec.tsx
 *
 * EDIT LOG:
 * - 2026-04-27T00:00:00Z | copilot | created -- B3.2 React Email weekly report template
 * - 2026-04-27T00:00:00Z | staff-engineer | P2.2: three variants, unsubscribe, weak topics,
 *   premium teaser, zero-activity, totalMinutes, avgAccuracy, xpEarned, topicsList
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
const TANGERINE = '#FF6B35';
const SUCCESS = '#1D9E75';
const WARNING = '#BA7517';
const DANGER = '#E24B4A';
const SUCCESS_BG = '#EAF3DE';
const WARNING_BG = '#FAEEDA';
const PRIMARY_BG = '#EEEDFE';

// ── Shared types ───────────────────────────────────────────────────────────────

export interface WeeklyReportData {
  studentName: string;
  parentName: string;
  daysActive: number;
  totalSessions: number;
  topicsStudied: number;
  currentStreak: number;
  weeklyGoal?: number;
  strongSubject?: string;
  focusSubject?: string;
  dashboardUrl: string;
}

export interface WeeklyReportFreeData {
  studentName: string;
  parentName: string;
  totalMinutes: number;
  topicsCovered: string[];
  avgAccuracy: number;
  xpEarned: number;
  currentStreak: number;
  dashboardUrl: string;
  unsubscribeUrl: string;
}

export interface WeeklyReportPremiumData {
  studentName: string;
  parentName: string;
  totalMinutes: number;
  topicsCovered: string[];
  avgAccuracy: number;
  xpEarned: number;
  currentStreak: number;
  weakTopics: Array<{ name: string; accuracy: number }>;
  dashboardUrl: string;
  unsubscribeUrl: string;
}

export interface WeeklyReportZeroActivityData {
  studentName: string;
  parentName: string;
  currentStreak: number;
  suggestedTopic: string;
  dashboardUrl: string;
  unsubscribeUrl: string;
}

// ── Shared helpers ─────────────────────────────────────────────────────────────

function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ── Shared layout pieces ──────────────────────────────────────────────────────

function EmailShell({
  preview,
  children,
}: {
  preview: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Img
            src="https://spinzyacademy.com/icons/spinzy-navbar-source.png"
            alt="Spinzy Academy"
            height={40}
            style={logoStyle}
          />
          {children}
        </Container>
      </Body>
    </Html>
  );
}

function StatsRow({
  totalMinutes,
  topicCount,
  avgAccuracy,
  xpEarned,
  currentStreak,
}: {
  totalMinutes: number;
  topicCount: number;
  avgAccuracy: number;
  xpEarned: number;
  currentStreak: number;
}): React.ReactElement {
  return (
    <Section style={{ margin: '20px 0' }}>
      <Row>
        <Column style={statBox}>
          <Text style={statNum}>{formatMinutes(totalMinutes)}</Text>
          <Text style={statLabel}>Time Spent</Text>
        </Column>
        <Column style={statBox}>
          <Text style={statNum}>{String(topicCount)}</Text>
          <Text style={statLabel}>Topics</Text>
        </Column>
        <Column style={statBox}>
          <Text style={statNum}>{String(avgAccuracy)}%</Text>
          <Text style={statLabel}>Accuracy</Text>
        </Column>
        <Column style={statBox}>
          <Text style={statNum}>{String(xpEarned)}</Text>
          <Text style={statLabel}>XP Earned</Text>
        </Column>
        <Column style={statBox}>
          <Text style={statNum}>{String(currentStreak)}</Text>
          <Text style={statLabel}>Day Streak</Text>
        </Column>
      </Row>
    </Section>
  );
}

function TopicsList({ topics }: { topics: string[] }): React.ReactElement | null {
  if (topics.length === 0) return null;
  return (
    <Section style={{ margin: '8px 0 16px' }}>
      <Text style={sectionHeading}>Topics covered this week</Text>
      {topics.slice(0, 5).map((t) => (
        <Text key={t} style={topicItem}>
          &bull; {t}
        </Text>
      ))}
    </Section>
  );
}

function EmailFooter({
  unsubscribeUrl,
}: {
  unsubscribeUrl: string;
}): React.ReactElement {
  return (
    <Text style={footerStyle}>
      Spinzy Academy -- AI Home Tutor
      <br />
      You are receiving this because you have a linked student account.
      <br />
      <a href={unsubscribeUrl} style={{ color: '#aaa' }}>
        Unsubscribe from weekly reports
      </a>
    </Text>
  );
}

// ── WeeklyReportEmailFree ─────────────────────────────────────────────────────

export function WeeklyReportEmailFree({
  studentName,
  parentName,
  totalMinutes,
  topicsCovered,
  avgAccuracy,
  xpEarned,
  currentStreak,
  dashboardUrl,
  unsubscribeUrl,
}: WeeklyReportFreeData): React.ReactElement {
  return (
    <EmailShell preview={`${studentName}'s weekly learning summary -- see this week's progress`}>
      <Heading style={{ color: PRIMARY, fontSize: '22px', margin: '0 0 8px' }}>
        {studentName}&apos;s Weekly Report
      </Heading>
      <Text style={subtitleStyle}>Hi {parentName}, here is this week&apos;s summary.</Text>

      <StatsRow
        totalMinutes={totalMinutes}
        topicCount={topicsCovered.length}
        avgAccuracy={avgAccuracy}
        xpEarned={xpEarned}
        currentStreak={currentStreak}
      />

      <TopicsList topics={topicsCovered} />

      {/* Premium teaser */}
      <Section style={{ ...teaserBox, borderColor: PRIMARY }}>
        <Text style={{ ...teaserText, color: PRIMARY }}>
          <strong>Upgrade to Premium</strong> to unlock detailed weak-topic analysis,
          chapter-level mastery scores, and personalised practice assignments for{' '}
          {studentName}.
        </Text>
        <Button href={`${dashboardUrl}/../billing`} style={upgradeBtn}>
          Upgrade Now -- see weak topics
        </Button>
      </Section>

      <Button href={dashboardUrl} style={primaryBtn}>
        View Full Report
      </Button>

      <EmailFooter unsubscribeUrl={unsubscribeUrl} />
    </EmailShell>
  );
}

// ── WeeklyReportEmailPremium ──────────────────────────────────────────────────

export function WeeklyReportEmailPremium({
  studentName,
  parentName,
  totalMinutes,
  topicsCovered,
  avgAccuracy,
  xpEarned,
  currentStreak,
  weakTopics,
  dashboardUrl,
  unsubscribeUrl,
}: WeeklyReportPremiumData): React.ReactElement {
  return (
    <EmailShell
      preview={`${studentName}'s weekly summary -- ${weakTopics.length > 0 ? `${weakTopics.length} topic${weakTopics.length > 1 ? 's' : ''} need attention` : 'great progress this week!'}`}
    >
      <Heading style={{ color: PRIMARY, fontSize: '22px', margin: '0 0 8px' }}>
        {studentName}&apos;s Weekly Report
      </Heading>
      <Text style={subtitleStyle}>Hi {parentName}, here is this week&apos;s summary.</Text>

      <StatsRow
        totalMinutes={totalMinutes}
        topicCount={topicsCovered.length}
        avgAccuracy={avgAccuracy}
        xpEarned={xpEarned}
        currentStreak={currentStreak}
      />

      <TopicsList topics={topicsCovered} />

      {/* Weak topics (accuracy < 60%) */}
      {weakTopics.length > 0 ? (
        <Section style={{ ...highlight, backgroundColor: WARNING_BG, borderColor: WARNING }}>
          <Text style={sectionHeading}>Topics that need more practice</Text>
          {weakTopics.map((wt) => (
            <Text key={wt.name} style={{ ...topicItem, color: WARNING }}>
              &bull; {wt.name} &mdash; {String(wt.accuracy)}% accuracy
            </Text>
          ))}
          <Button href={`${dashboardUrl}?tab=practice`} style={practiceBtn}>
            Assign extra practice
          </Button>
        </Section>
      ) : (
        <Section style={{ ...highlight, backgroundColor: SUCCESS_BG, borderColor: SUCCESS }}>
          <Text style={{ ...teaserText, color: SUCCESS }}>
            Excellent! {studentName} is on track across all topics this week.
          </Text>
        </Section>
      )}

      <Button href={dashboardUrl} style={primaryBtn}>
        View Full Report
      </Button>

      <EmailFooter unsubscribeUrl={unsubscribeUrl} />
    </EmailShell>
  );
}

// ── WeeklyReportEmailZeroActivity ─────────────────────────────────────────────

export function WeeklyReportEmailZeroActivity({
  studentName,
  parentName,
  currentStreak,
  suggestedTopic,
  dashboardUrl,
  unsubscribeUrl,
}: WeeklyReportZeroActivityData): React.ReactElement {
  return (
    <EmailShell
      preview={`${studentName} did not log in this week -- here is how to help them get back on track`}
    >
      <Heading style={{ color: PRIMARY, fontSize: '22px', margin: '0 0 8px' }}>
        {studentName}&apos;s Weekly Report
      </Heading>
      <Text style={subtitleStyle}>Hi {parentName},</Text>

      <Section style={{ ...highlight, backgroundColor: '#FFF9F0', borderColor: WARNING }}>
        <Text style={{ ...body1, color: '#374151' }}>
          {studentName} did not log in this week. It happens! A gentle reminder can go a long way
          -- their best progress is still ahead.
        </Text>
        {currentStreak > 0 ? (
          <Text style={{ fontSize: '13px', color: WARNING, margin: '8px 0 0' }}>
            Current streak: {String(currentStreak)} day{currentStreak > 1 ? 's' : ''}
          </Text>
        ) : null}
      </Section>

      {suggestedTopic ? (
        <Section style={{ margin: '16px 0' }}>
          <Text style={sectionHeading}>Suggested topic to restart with</Text>
          <Text style={{ ...topicItem, fontWeight: '600' }}>&bull; {suggestedTopic}</Text>
        </Section>
      ) : null}

      <Button href={dashboardUrl} style={primaryBtn}>
        Open {studentName}&apos;s Dashboard
      </Button>

      <EmailFooter unsubscribeUrl={unsubscribeUrl} />
    </EmailShell>
  );
}

// ── Original single-variant (kept for backwards compat) ───────────────────────

export function WeeklyReportEmail({
  studentName,
  parentName,
  daysActive,
  totalSessions,
  topicsStudied,
  currentStreak,
  weeklyGoal,
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
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Img
            src="https://spinzyacademy.com/icons/spinzy-navbar-source.png"
            alt="Spinzy Academy"
            height={40}
            style={logoStyle}
          />
          <Heading style={{ color: PRIMARY, fontSize: '22px', margin: '0 0 8px' }}>
            {studentName}&apos;s Weekly Report
          </Heading>
          <Text style={subtitleStyle}>
            Dear {parentName}, here is this week&apos;s learning summary.
          </Text>

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

          {weeklyGoal !== undefined && weeklyGoal > 0 ? (
            <Text style={goalText}>
              Goal this week: <strong>{String(totalSessions)}/{String(weeklyGoal)}</strong> sessions
              {totalSessions >= weeklyGoal ? ' -- goal reached!' : ''}
            </Text>
          ) : null}

          {strongSubject ? (
            <Section style={{ ...highlight, backgroundColor: SUCCESS_BG, borderColor: SUCCESS }}>
              <Text style={{ ...teaserText, color: SUCCESS }}>
                Doing well in <strong>{strongSubject}</strong> -- keep it up!
              </Text>
            </Section>
          ) : null}

          {focusSubject ? (
            <Section style={{ ...highlight, backgroundColor: WARNING_BG, borderColor: WARNING }}>
              <Text style={{ ...teaserText, color: WARNING }}>
                A bit more practice in <strong>{focusSubject}</strong> will help {studentName}{' '}
                build confidence.
              </Text>
            </Section>
          ) : null}

          <Button href={dashboardUrl} style={primaryBtn}>
            View Full Report
          </Button>

          <Text style={footerStyle}>
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

const bodyStyle: React.CSSProperties = {
  backgroundColor: '#f5f5f5',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif',
};

const containerStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  margin: '40px auto',
  padding: '32px',
  borderRadius: '8px',
  maxWidth: '520px',
};

const logoStyle: React.CSSProperties = { marginBottom: '24px', display: 'block' };

const subtitleStyle: React.CSSProperties = { fontSize: '14px', color: '#555', margin: '0 0 8px' };

const body1: React.CSSProperties = { fontSize: '14px', color: '#1a1a1a', margin: '0 0 8px' };

const statBox: React.CSSProperties = {
  backgroundColor: PRIMARY_BG,
  borderRadius: '8px',
  padding: '10px 6px',
  textAlign: 'center',
  margin: '0 3px',
};

const statNum: React.CSSProperties = {
  fontSize: '22px',
  fontWeight: '700',
  color: PRIMARY,
  margin: 0,
};

const statLabel: React.CSSProperties = {
  fontSize: '10px',
  color: '#888',
  margin: '4px 0 0',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const sectionHeading: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: '600',
  color: '#374151',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  margin: '0 0 6px',
};

const topicItem: React.CSSProperties = {
  fontSize: '14px',
  color: '#374151',
  margin: '2px 0',
};

const highlight: React.CSSProperties = {
  borderLeft: '4px solid',
  borderRadius: '4px',
  padding: '12px 16px',
  margin: '12px 0',
};

const teaserBox: React.CSSProperties = {
  border: '2px solid',
  borderRadius: '8px',
  padding: '16px',
  margin: '16px 0',
};

const teaserText: React.CSSProperties = { fontSize: '14px', margin: '0 0 12px' };

const goalText: React.CSSProperties = { fontSize: '13px', color: '#555', margin: '0 0 12px' };

const primaryBtn: React.CSSProperties = {
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

const upgradeBtn: React.CSSProperties = {
  display: 'inline-block',
  padding: '10px 20px',
  backgroundColor: PRIMARY,
  color: '#ffffff',
  textDecoration: 'none',
  borderRadius: '8px',
  fontWeight: '600',
  fontSize: '14px',
  marginTop: '8px',
};

const practiceBtn: React.CSSProperties = {
  display: 'inline-block',
  padding: '10px 20px',
  backgroundColor: TANGERINE,
  color: '#ffffff',
  textDecoration: 'none',
  borderRadius: '8px',
  fontWeight: '600',
  fontSize: '14px',
  marginTop: '10px',
};

const footerStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#888',
  marginTop: '32px',
  borderTop: '1px solid #eee',
  paddingTop: '16px',
  lineHeight: '1.8',
};

// suppress unused-variable warnings for colours used only in JSX
void SUCCESS;
void DANGER;
void WARNING;
void TANGERINE;

export default WeeklyReportEmail;
