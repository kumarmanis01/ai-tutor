export const dynamic = 'force-dynamic';

/**
 * FILE OBJECTIVE:
 * - GET /api/parent/invoices/annual-summary
 *   Returns metadata for all invoices in an Indian financial year (April 1 - March 31)
 *   so the parent can download or view them for tax filings.
 *   F-PAR-032 AC-05: annual invoice summary downloadable.
 *
 *   NOTE: PDF generation is out of scope for this endpoint. It returns structured
 *   invoice data (invoiceNumber, amount, date, fileUrl) that the frontend assembles
 *   into a downloadable list or triggers a separate PDF job. This keeps the API
 *   response fast and stateless.
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/parent-invoices-annual-summary.spec.ts
 *
 * EDIT LOG:
 * - 2026-04-14 | claude | created for F-PAR-032 AC-05
 * - 2026-04-17 | copilot | add PDF download support (?format=pdf) and 404 handling when no invoices
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateAnnualInvoicesPdf } from '@/lib/invoices';
import { logger } from '@/lib/logger';
import { formatErrorForResponse } from '@/lib/errorResponse';
import type { AppSession } from '@/lib/types/auth';

const CLASS_NAME = 'ParentInvoicesAnnualSummaryAPI';

interface InvoiceRow {
  id: string;
  invoiceNumber: number;
  amount: number;
  currency: string;
  createdAt: string;
  fileUrl: string | null;
}

interface AnnualSummaryResponse {
  financialYear: string; // e.g. "2025-26"
  fyStart: string;       // ISO date of April 1
  fyEnd: string;         // ISO date of March 31
  totalAmount: number;
  invoiceCount: number;
  invoices: InvoiceRow[];
}

/**
 * Compute Indian financial year boundaries for a given year offset.
 * offset=0 => current FY, offset=-1 => previous FY.
 */
function financialYearBounds(offset = 0): { fyStart: Date; fyEnd: Date; label: string } {
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth() + 1; // 1-based
  // FY starts April 1: if we're in Jan-Mar, the FY started the previous calendar year
  const fyStartYear = (currentMonth < 4 ? currentYear - 1 : currentYear) + offset;
  const fyStart = new Date(Date.UTC(fyStartYear, 3, 1, 0, 0, 0, 0)); // April 1
  const fyEnd = new Date(Date.UTC(fyStartYear + 1, 2, 31, 23, 59, 59, 999)); // March 31
  const label = `${fyStartYear}-${String(fyStartYear + 1).slice(-2)}`;
  return { fyStart, fyEnd, label };
}

/**
 * GET /api/parent/invoices/annual-summary?fy=2025-26
 *
 * Query params:
 *   fy (optional) -- financial year label, e.g. "2025-26". Defaults to current FY.
 */
export async function GET(req: NextRequest) {
  const start = Date.now();

  try {
    const session = (await getServerSession(authOptions)) as AppSession | null;
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const parentId = session.user.id;
    // Support both NextRequest (has `nextUrl`) and native Request (has `url`)
    const urlLike: URL | typeof req.nextUrl = (req as any).nextUrl ?? new URL((req as any).url);
    const fyParam = urlLike.searchParams.get('fy');

    // Parse requested financial year or default to current
    let fyStart: Date;
    let fyEnd: Date;
    let fyLabel: string;

    if (fyParam) {
      // Expect format "YYYY-YY" e.g. "2025-26"
      const match = /^(\d{4})-(\d{2})$/.exec(fyParam);
      if (!match) {
        return NextResponse.json({ error: 'fy must be in format YYYY-YY, e.g. 2025-26' }, { status: 400 });
      }
      const startYear = parseInt(match[1], 10);
      const endYearShort = parseInt(match[2], 10);
      // Validate the year suffix is consistent (e.g. 2025-26: 25+1=26)
      if ((startYear + 1) % 100 !== endYearShort) {
        return NextResponse.json({ error: 'fy year suffix must be consecutive, e.g. 2025-26' }, { status: 400 });
      }
      fyStart = new Date(Date.UTC(startYear, 3, 1, 0, 0, 0, 0));
      fyEnd = new Date(Date.UTC(startYear + 1, 2, 31, 23, 59, 59, 999));
      fyLabel = fyParam;
    } else {
      const bounds = financialYearBounds(0);
      fyStart = bounds.fyStart;
      fyEnd = bounds.fyEnd;
      fyLabel = bounds.label;
    }

    // Fetch invoices for this parent in the financial year window
    const invoices = await prisma.invoice.findMany({
      where: {
        userId: parentId,
        createdAt: { gte: fyStart, lte: fyEnd },
      },
      orderBy: { invoiceNumber: 'asc' },
      select: {
        id: true,
        invoiceNumber: true,
        amount: true,
        currency: true,
        fileUrl: true,
        createdAt: true,
      },
    });

    const totalAmount = invoices.reduce((sum: any, inv: any) => sum + inv.amount, 0);

    const payload: AnnualSummaryResponse = {
      financialYear: fyLabel,
      fyStart: fyStart.toISOString().slice(0, 10),
      fyEnd: fyEnd.toISOString().slice(0, 10),
      totalAmount,
      invoiceCount: invoices.length,
      invoices: invoices.map((inv: any) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        amount: inv.amount,
        currency: inv.currency,
        createdAt: inv.createdAt.toISOString(),
        fileUrl: inv.fileUrl ?? null,
      })),
    };

    logger.info('Annual invoice summary fetched', {
      className: CLASS_NAME,
      parentId,
      fy: fyLabel,
      invoiceCount: invoices.length,
    });

    // If the client requested a merged PDF, generate and return it.
    const format = urlLike.searchParams.get('format');
    if (format === 'pdf') {
      try {
        const pdfBuf = await generateAnnualInvoicesPdf(parentId, fyStart, fyEnd);
        const headers = new Headers();
        headers.set('Content-Type', 'application/pdf');
        headers.set('Content-Disposition', `attachment; filename="invoices-${fyLabel}.pdf"`);
        const pdfRes = new Response(new Uint8Array(pdfBuf as any), { status: 200, headers });
        logger.logAPI(req, pdfRes, { className: CLASS_NAME, methodName: 'GET' }, start);
        return pdfRes;
      } catch (e: any) {
        logger.error('Failed to generate merged PDF', { className: CLASS_NAME, error: String(e) });
        // If no invoices were found for the FY, return a 404 JSON response instead
        if (String(e).toLowerCase().includes('no invoices')) {
          return NextResponse.json({ error: 'No invoices found for requested financial year' }, { status: 404 });
        }
        return NextResponse.json({ error: formatErrorForResponse(e) }, { status: 500 });
      }
    }

    const response = NextResponse.json(payload);
    logger.logAPI(req, response, { className: CLASS_NAME, methodName: 'GET' }, start);
    return response;
  } catch (error) {
    logger.error('Failed to fetch annual invoice summary', { className: CLASS_NAME, error });
    return NextResponse.json({ error: formatErrorForResponse(error) }, { status: 500 });
  }
}
