export type PaymentMethod = 'upi' | 'card' | 'netbanking';

interface Props {
  selected: PaymentMethod;
  onSelect: (method: PaymentMethod) => void;
}

const METHODS: { id: PaymentMethod; label: string }[] = [
  { id: 'upi', label: 'UPI' },
  { id: 'card', label: 'Credit / Debit Card' },
  { id: 'netbanking', label: 'Net Banking' },
];

export default function PaymentMethodSelector({ selected, onSelect }: Props) {
  return (
    <div className="space-y-3">
      {METHODS.map((m) => (
        <button
          key={m.id}
          onClick={() => onSelect(m.id)}
          className={`w-full flex items-center gap-3 rounded-lg border-2 p-4 min-h-[44px] transition-colors ${
            selected === m.id
              ? 'border-brand-primary bg-brand-primary-bg'
              : 'border-border bg-card hover:border-brand-primary/40'
          }`}
        >
          <span className="font-body text-foreground">{m.label}</span>
        </button>
      ))}
    </div>
  );
}
