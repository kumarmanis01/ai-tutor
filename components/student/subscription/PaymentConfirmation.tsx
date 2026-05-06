import type { PaymentMethod } from './PaymentMethodSelector';

interface Props {
  planId: string;
  paymentMethod: PaymentMethod;
  loading: boolean;
  onConfirm: () => void;
  onBack: () => void;
}

export default function PaymentConfirmation({
  planId,
  paymentMethod,
  loading,
  onConfirm,
  onBack,
}: Props) {
  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-border bg-card p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Plan</span>
          <span className="font-semibold text-foreground capitalize">{planId}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Payment</span>
          <span className="font-semibold text-foreground uppercase">{paymentMethod}</span>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        By confirming you agree to our Terms of Service. Subscription renews monthly. Cancel anytime.
      </p>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          disabled={loading}
          className="flex-1 py-3 rounded-lg border border-border font-cta font-semibold text-foreground min-h-[44px] disabled:opacity-50"
        >
          Back
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className="flex-1 py-3 rounded-lg bg-brand-primary text-white font-cta font-semibold min-h-[44px] hover:bg-brand-primary-hover disabled:opacity-50 transition-colors"
        >
          {loading ? 'Processing...' : 'Pay Now'}
        </button>
      </div>
    </div>
  );
}
