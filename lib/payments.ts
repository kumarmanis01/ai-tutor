let _razorpay: any = null;

export async function getRazorpay() {
  if (_razorpay) return _razorpay;
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) {
    throw new Error('Missing billing credentials: RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set');
  }
  // dynamic import to satisfy ESLint's no-require-imports rule
  const RazorpayModule = await import('razorpay');
  const Razorpay = RazorpayModule?.default ?? RazorpayModule;
  const RazorpayCtor: any = Razorpay as any;
  _razorpay = new RazorpayCtor({ key_id, key_secret });
  return _razorpay;
}

/**
 * Attempt a tokenized charge using Razorpay.
 * Returns the raw Razorpay response on success, or null on failure.
 *
 * Params:
 * - amountPaise: integer amount in paise
 * - currency: 'INR'
 * - customerId: provider customer id (optional)
 * - token: provider payment method id (card token / instrument)
 * - email, contact, description, notes, idempotencyKey
 */
export async function createRazorpayTokenCharge(opts: {
  amountPaise: number;
  currency?: string;
  customerId?: string | null;
  token?: string | null;
  email?: string;
  contact?: string;
  description?: string;
  notes?: Record<string, any>;
  idempotencyKey?: string;
}): Promise<any | null> {
  try {
    const client = await getRazorpay();
    if (!client) return null;

    const payload: any = {
      amount: opts.amountPaise,
      currency: opts.currency ?? 'INR',
      customer_id: opts.customerId ?? undefined,
      token: opts.token ?? undefined,
      email: opts.email ?? undefined,
      contact: opts.contact ?? undefined,
      description: opts.description ?? undefined,
      notes: opts.notes ?? undefined,
    };

    // Remove undefined fields
    Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

    // SDK should forward this to Razorpay payments endpoint. Some SDKs expose payments.create.
    if (typeof client.payments?.create === 'function') {
      const resp = await client.payments.create(payload, opts.idempotencyKey ? { 'Idempotency-Key': opts.idempotencyKey } : undefined);
      return resp;
    }

    // Fallback: use direct REST call via fetch (best-effort)
    const key = process.env.RAZORPAY_KEY_ID;
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!key || !secret) return null;
    const auth = Buffer.from(`${key}:${secret}`).toString('base64');
    const headers: any = { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' };
    if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey;
    // Node global fetch is available on modern runtimes; if not, this will throw and be caught.
    const res = await fetch('https://api.razorpay.com/v1/payments', { method: 'POST', headers, body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok) return null;
    return data;
  } catch (err) {
    return null;
  }
}
