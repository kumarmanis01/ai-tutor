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
