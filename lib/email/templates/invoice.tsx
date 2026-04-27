/**
 * FILE OBJECTIVE:
 * - React Email template for payment invoice / receipt.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/email/templates/invoice.spec.tsx
 *
 * EDIT LOG:
 * - 2026-04-27T00:00:00Z | copilot | created -- B3.2 React Email invoice template
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
const SUCCESS_BG = '#EAF3DE';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface InvoiceEmailData {
  invoiceNumber: string;
  studentName: string;
  plan: string;
  amountPaise: number;
  billingDate: string;
  invoiceUrl: string;
}

// ── Template ──────────────────────────────────────────────────────────────────

export function InvoiceEmail({
  invoiceNumber,
  studentName,
  plan,
  amountPaise,
  billingDate,
  invoiceUrl,
}: InvoiceEmailData): React.ReactElement {
  const amountRs = (amountPaise / 100).toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  });

  return (
    <Html>
      <Head />
      <Preview>
        Payment confirmed -- {amountRs} for {plan}
      </Preview>
      <Body style={body}>
        <Container style={container}>
          <Img
            src="https://spinzyacademy.com/icons/spinzy-navbar-source.png"
            alt="Spinzy Academy"
            height={40}
            style={logo}
          />

          {/* Confirmation banner */}
          <Section style={{ ...banner, backgroundColor: SUCCESS_BG }}>
            <Text style={{ ...bannerText, color: SUCCESS }}>
              Payment confirmed
            </Text>
          </Section>

          <Heading style={{ color: PRIMARY, fontSize: '20px', margin: '24px 0 8px' }}>
            Invoice #{invoiceNumber}
          </Heading>
          <Text style={body1}>Thank you for subscribing to Spinzy Academy.</Text>

          {/* Line items */}
          <Section style={lineTable}>
            <Row style={lineRow}>
              <Column>
                <Text style={lineLabel}>Student</Text>
              </Column>
              <Column>
                <Text style={lineValue}>{studentName}</Text>
              </Column>
            </Row>
            <Row style={lineRow}>
              <Column>
                <Text style={lineLabel}>Plan</Text>
              </Column>
              <Column>
                <Text style={lineValue}>{plan}</Text>
              </Column>
            </Row>
            <Row style={lineRow}>
              <Column>
                <Text style={lineLabel}>Billing date</Text>
              </Column>
              <Column>
                <Text style={lineValue}>{billingDate}</Text>
              </Column>
            </Row>
            <Row style={{ ...lineRow, borderTop: '2px solid #eee' }}>
              <Column>
                <Text style={{ ...lineLabel, fontWeight: '700', color: '#1a1a1a' }}>Total</Text>
              </Column>
              <Column>
                <Text style={{ ...lineValue, fontWeight: '700', color: PRIMARY }}>
                  {amountRs}
                </Text>
              </Column>
            </Row>
          </Section>

          <Button href={invoiceUrl} style={btn}>
            Download Invoice
          </Button>

          <Text style={footer}>
            Spinzy Academy -- AI Home Tutor
            <br />
            GST-compliant invoice available at the link above.
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

const banner: React.CSSProperties = {
  borderRadius: '8px',
  padding: '12px 16px',
  margin: '0 0 8px',
};

const bannerText: React.CSSProperties = {
  fontSize: '15px',
  fontWeight: '600',
  margin: 0,
};

const body1: React.CSSProperties = { fontSize: '14px', color: '#555', margin: '0 0 16px' };

const lineTable: React.CSSProperties = {
  border: '1px solid #eee',
  borderRadius: '8px',
  padding: '8px 16px',
  margin: '16px 0',
};

const lineRow: React.CSSProperties = { padding: '8px 0' };

const lineLabel: React.CSSProperties = { fontSize: '13px', color: '#888', margin: 0 };

const lineValue: React.CSSProperties = {
  fontSize: '13px',
  color: '#1a1a1a',
  margin: 0,
  textAlign: 'right',
};

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

export default InvoiceEmail;
