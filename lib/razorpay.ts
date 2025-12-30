let _razorpay: any = null;

export async function getRazorpayDefault() {
  if (_razorpay) return _razorpay;
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) {
    throw new Error('Missing billing credentials: RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set');
  }
  const RazorpayModule = await import('razorpay');
  const Razorpay = RazorpayModule?.default ?? RazorpayModule;
  const RazorpayCtor: any = Razorpay as any;
  _razorpay = new RazorpayCtor({ key_id, key_secret });
  return _razorpay;
}
