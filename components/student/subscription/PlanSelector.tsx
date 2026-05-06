interface Props {
  selected: string;
  onSelect: (id: string) => void;
}

const PLANS = [
  { id: 'individual', label: 'Individual', price: '₹399/mo' },
  { id: 'family', label: 'Family', price: '₹599/mo' },
];

export default function PlanSelector({ selected, onSelect }: Props) {
  return (
    <div className="space-y-3">
      {PLANS.map((plan) => (
        <button
          key={plan.id}
          onClick={() => onSelect(plan.id)}
          className={`w-full flex items-center justify-between rounded-lg border-2 p-4 min-h-[44px] transition-colors ${
            selected === plan.id
              ? 'border-brand-primary bg-brand-primary-bg'
              : 'border-border bg-card hover:border-brand-primary/40'
          }`}
        >
          <span className="font-body font-semibold text-foreground">{plan.label}</span>
          <span className="font-headline font-bold text-brand-primary">{plan.price}</span>
        </button>
      ))}
    </div>
  );
}
