/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
/**
 * Tests for GET /api/parent/invoices/annual-summary (F-PAR-032 AC-05).
 */

jest.mock('@/lib/prisma', () => ({ prisma: require('../../helpers/prismaMock').prismaMock }));
jest.mock('@/lib/auth', () => ({ authOptions: {} }));
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), logAPI: jest.fn() },
}));
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { prismaMock, resetPrismaMock } from '../../helpers/prismaMock';
import '../../helpers/mockSession';

const PARENT_ID = 'parent-1';

function makeInvoice(overrides: any = {}) {
  return {
    id: `inv-${overrides.invoiceNumber ?? 1}`,
    invoiceNumber: 1,
    amount: 11682, // 99 * 118 / 100 * 100 (with GST, in paise)
    currency: 'INR',
    fileUrl: 'https://r2.example.com/invoices/inv-1.pdf',
    createdAt: new Date('2025-09-01'),
    ...overrides,
  };
}

describe('GET /api/parent/invoices/annual-summary', () => {
  beforeEach(() => {
    resetPrismaMock();
    (global as any).__TEST_SESSION__ = { user: { id: PARENT_ID, role: 'parent' } };
  });

  it('should return 401 when unauthenticated', async () => {
    (global as any).__TEST_SESSION__ = null;
    const { GET } = await import('@/app/api/parent/invoices/annual-summary/route');
    const req = new Request('http://localhost');
    const res = await GET(req as any);
    expect(res.status).toBe(401);
  });

  it('should return empty invoices list when none exist for the FY', async () => {
    prismaMock.invoice.findMany.mockResolvedValue([]);
    const { GET } = await import('@/app/api/parent/invoices/annual-summary/route');
    const req = new Request('http://localhost?fy=2025-26');
    const res = await GET(req as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.invoiceCount).toBe(0);
    expect(data.totalAmount).toBe(0);
    expect(data.invoices).toHaveLength(0);
    expect(data.financialYear).toBe('2025-26');
  });

  it('should return invoices with correct totals', async () => {
    prismaMock.invoice.findMany.mockResolvedValue([
      makeInvoice({ invoiceNumber: 1, amount: 11682 }),
      makeInvoice({ invoiceNumber: 2, amount: 11682, createdAt: new Date('2025-10-01') }),
    ] as any);
    const { GET } = await import('@/app/api/parent/invoices/annual-summary/route');
    const req = new Request('http://localhost?fy=2025-26');
    const res = await GET(req as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.invoiceCount).toBe(2);
    expect(data.totalAmount).toBe(23364);
    expect(data.invoices[0].invoiceNumber).toBe(1);
    expect(data.invoices[0].fileUrl).toContain('r2.example.com');
  });

  it('should return 400 for invalid fy format', async () => {
    const { GET } = await import('@/app/api/parent/invoices/annual-summary/route');
    const req = new Request('http://localhost?fy=2025');
    const res = await GET(req as any);
    expect(res.status).toBe(400);
  });

  it('should return 400 for non-consecutive fy suffix', async () => {
    const { GET } = await import('@/app/api/parent/invoices/annual-summary/route');
    const req = new Request('http://localhost?fy=2025-28');
    const res = await GET(req as any);
    expect(res.status).toBe(400);
  });

  it('should default to current financial year when fy not supplied', async () => {
    prismaMock.invoice.findMany.mockResolvedValue([makeInvoice()] as any);
    const { GET } = await import('@/app/api/parent/invoices/annual-summary/route');
    // Make the test deterministic by setting system time to 2026-04-13 (start of FY 2026-27)
    jest.useFakeTimers('modern');
    jest.setSystemTime(new Date('2026-04-13T00:00:00Z'));

    const req = new Request('http://localhost');
    const res = await GET(req as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    // financialYear should match expected FY for April 2026 context
    expect(data.financialYear).toBe('2026-27');

    jest.useRealTimers();
  });

  it('should query invoices with correct date range for supplied fy', async () => {
    prismaMock.invoice.findMany.mockResolvedValue([]);
    const { GET } = await import('@/app/api/parent/invoices/annual-summary/route');
    const req = new Request('http://localhost?fy=2025-26');
    await GET(req as any);
    const call = prismaMock.invoice.findMany.mock.calls[0][0] as any;
    const gte: Date = call.where.createdAt.gte;
    const lte: Date = call.where.createdAt.lte;
    expect(gte.getUTCFullYear()).toBe(2025);
    expect(gte.getUTCMonth()).toBe(3); // April = month index 3
    expect(lte.getUTCFullYear()).toBe(2026);
    expect(lte.getUTCMonth()).toBe(2); // March = month index 2
  });

  it('should return 404 JSON when requesting PDF and no invoices exist', async () => {
    prismaMock.invoice.findMany.mockResolvedValue([]);
    const { GET } = await import('@/app/api/parent/invoices/annual-summary/route');
    const req = new Request('http://localhost?fy=2025-26&format=pdf');
    const res = await GET(req as any);
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toMatch(/no invoices found/i);
  });

  it('should return a merged PDF when format=pdf is requested', async () => {
    // Create two small PDF bytes to be returned by mocked fetch
    const { PDFDocument } = require('pdf-lib');
    const a = await PDFDocument.create();
    a.addPage([300, 200]);
    const aBytes = await a.save();

    const b = await PDFDocument.create();
    b.addPage([300, 200]);
    const bBytes = await b.save();

    prismaMock.invoice.findMany.mockResolvedValue([
      makeInvoice({ invoiceNumber: 1, fileUrl: 'https://r2.example.com/invoices/inv-1.pdf' }),
      makeInvoice({ invoiceNumber: 2, fileUrl: 'https://r2.example.com/invoices/inv-2.pdf' }),
    ] as any);

    const mockFetch = jest.fn().mockImplementation(async (url: string) => {
      if (url.includes('inv-1')) return { ok: true, arrayBuffer: async () => aBytes };
      if (url.includes('inv-2')) return { ok: true, arrayBuffer: async () => bBytes };
      return { ok: false };
    });
    (global as any).fetch = mockFetch;

    const { GET } = await import('@/app/api/parent/invoices/annual-summary/route');
    const req = new Request('http://localhost?fy=2025-26&format=pdf');
    const res = await GET(req as any);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/pdf');
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.length).toBeGreaterThan(0);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
