/**
 * FILE OBJECTIVE:
 * - Show LP-6.2 annual plan savings against traditional private tutoring with responsive mini charts.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/(public)/landing-page/components/SavingsComparison.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-27T14:30:00Z | copilot | created LP-6.2 savings comparison card and responsive bar chart
 */

const TUTORING_MONTHLY = 2500;
const SPINZY_ANNUAL = 8999;
const TUTORING_ANNUAL = TUTORING_MONTHLY * 12;
const SAVINGS_ANNUAL = TUTORING_ANNUAL - SPINZY_ANNUAL;
const SPINZY_MONTHLY_EQUIVALENT = 750;

const SavingsComparison = () => {
  return (
    <div className="max-w-lg mx-auto mb-8 rounded-2xl border border-[#1D9E75]/25 bg-[#EAF3DE] p-5 md:p-6">
      <p className="inline-flex items-center rounded-full bg-[#1D9E75] px-3 py-1 text-xs font-bold tracking-wide text-white">
        Annual Savings
      </p>

      <h3 className="mt-3 text-lg md:text-xl font-bold text-secondary leading-snug">
        Save ₹{SAVINGS_ANNUAL.toLocaleString('en-IN')}/year vs private tutoring
      </h3>

      <p className="mt-2 text-sm text-muted-foreground">
        Traditional tutoring costs about ₹{TUTORING_MONTHLY.toLocaleString('en-IN')}/month
        (₹{TUTORING_ANNUAL.toLocaleString('en-IN')}/year). Spinzy Annual is ₹
        {SPINZY_ANNUAL.toLocaleString('en-IN')}/year.
      </p>

      <div className="mt-5 rounded-xl border border-[#1D9E75]/20 bg-white/80 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Monthly Cost Comparison
        </p>

        <div className="sm:hidden flex items-end justify-center gap-6 h-36">
          <div className="w-20 flex flex-col items-center gap-2">
            <div className="w-12 h-28 rounded-t-md bg-[#E24B4A]" />
            <p className="text-[11px] font-medium text-center text-secondary">Tutoring ₹2,500</p>
          </div>
          <div className="w-20 flex flex-col items-center gap-2">
            <div className="w-12 h-[34px] rounded-t-md bg-[#1D9E75]" />
            <p className="text-[11px] font-medium text-center text-secondary">Spinzy ₹750</p>
          </div>
        </div>

        <div className="hidden sm:block space-y-3">
          <div>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="font-medium text-secondary">Tutoring</span>
              <span className="font-semibold text-secondary">₹2,500 / month</span>
            </div>
            <div className="h-3 rounded-full bg-[#FCEBEB] overflow-hidden">
              <div className="h-full w-full bg-[#E24B4A]" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="font-medium text-secondary">Spinzy (Annual)</span>
              <span className="font-semibold text-secondary">
                ₹{SPINZY_MONTHLY_EQUIVALENT.toLocaleString('en-IN')} / month
              </span>
            </div>
            <div className="h-3 rounded-full bg-[#EAF3DE] overflow-hidden">
              <div className="h-full w-[30%] bg-[#1D9E75]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SavingsComparison;