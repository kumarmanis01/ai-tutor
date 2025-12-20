import { NextResponse } from 'next/server';
import client from 'prom-client';

const registry = (client as any).register;

export async function GET() {
  try {
    const metrics = await registry.metrics();
    return new NextResponse(metrics, {
      status: 200,
      headers: { 'Content-Type': (registry as any).contentType || 'text/plain; version=0.0.4' },
    });
  } catch (e) {
    return new NextResponse(String(e), { status: 500 });
  }
}
