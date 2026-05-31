/* ============================================================
   SPINZY — S9 Subscription / Upgrade
   states: default | locked | success
   ============================================================ */
function UpgradeScreen({ scenario = 'default', onNav }) {
  const [phase, setPhase] = useState(scenario === 'success' ? 'success' : 'plans');
  const [plan, setPlan] = useState('annual');
  const [paying, setPaying] = useState(false);

  const pay = () => {
    setPaying(true);
    setTimeout(() => { setPaying(false); setPhase('success'); }, 1900);
  };

  // ---- SUCCESS / unlock ----
  if (phase === 'success') {
    return (
      <div style={{ height: '100%', background: 'linear-gradient(170deg, var(--brand-500), var(--brand-700))', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: 32, textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        {/* confetti */}
        {[...Array(14)].map((_, i) => (
          <div key={i} style={{ position: 'absolute', top: -10, left: `${(i * 7 + 5) % 100}%`, width: 8, height: 12, borderRadius: 2, background: ['#fff', 'var(--tier-fair)', 'var(--tier-strong)', 'var(--tier-ontrack-soft)'][i % 4], animation: `spz-confetti ${1.6 + (i % 4) * 0.3}s ${(i % 5) * 0.12}s ease-in forwards`, opacity: 0 }} />
        ))}
        <div style={{ width: 100, height: 100, borderRadius: 32, background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24, color: '#fff', animation: 'spz-pop 0.6s cubic-bezier(0.22,1.4,0.4,1) both' }}>
          <I.crown size={52} />
        </div>
        <h1 style={{ margin: '0 0 10px', fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', color: '#fff' }}>You’re Premium! 🎉</h1>
        <p style={{ margin: '0 0 28px', fontSize: 15, color: 'rgba(255,255,255,0.9)', lineHeight: 1.5, maxWidth: 280, textWrap: 'pretty' }}>Unlimited Vidya sessions, mock exams and full progress reports are now unlocked.</p>
        <div style={{ width: '100%', maxWidth: 300 }}>
          <Btn full size="lg" onClick={() => onNav('home')} style={{ background: '#fff', color: 'var(--brand-700)' }} icon={<I.unlock size={19} />}>Start learning</Btn>
        </div>
      </div>
    );
  }

  // ---- PAYING (Razorpay handoff sim) ----
  if (paying) {
    return (
      <div style={{ height: '100%', background: 'var(--bg)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: 32, textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: 99, border: '4px solid var(--border)', borderTopColor: 'var(--primary)', animation: 'spz-spin 0.8s linear infinite', marginBottom: 24 }} />
        <div style={{ fontSize: 16, fontWeight: 700 }}>Securely processing…</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}><I.shield size={15} /> Razorpay · 256-bit encrypted</div>
      </div>
    );
  }

  const plans = [
    { id: 'monthly', ...PLANS.monthly },
    { id: 'annual', ...PLANS.annual },
  ];
  const locked = scenario === 'locked';

  return (
    <div style={{ height: '100%', overflow: 'auto', background: 'var(--bg)', paddingBottom: 110 }}>
      <div style={{ padding: '8px 16px 0' }}><AppHeader title="" back onBack={() => onNav('home')} /></div>
      <div style={{ padding: '4px 24px 20px', textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: 20, background: 'oklch(0.80 0.13 88 / 0.16)', color: 'var(--tier-fair)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}><I.crown size={32} /></div>
        <h1 style={{ margin: '0 0 8px', fontSize: 25, fontWeight: 800, letterSpacing: '-0.03em' }}>Unlock your full potential</h1>
        <p style={{ margin: 0, fontSize: 14.5, color: 'var(--text-muted)', lineHeight: 1.5, textWrap: 'pretty' }}>Aarav’s exam is in {STUDENT.examDateDays} days. Premium gives unlimited practice.</p>
      </div>

      {/* freemium usage when locked */}
      {locked && (
        <div style={{ padding: '0 16px 16px' }}>
          <div style={{ borderRadius: 16, padding: 16, background: 'var(--tier-critical-soft)', border: '1px solid color-mix(in oklch, var(--tier-critical) 25%, transparent)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>Today’s free sessions</span>
              <Mono style={{ fontSize: 13, fontWeight: 700, color: 'var(--tier-critical)' }}>{STUDENT.sessionLimit}/{STUDENT.sessionLimit} used</Mono>
            </div>
            <Bar value={100} color="var(--tier-critical)" />
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 8 }}>Resets at midnight, or go unlimited now ↓</div>
          </div>
        </div>
      )}

      {/* plan selector */}
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {plans.map(p => {
          const on = plan === p.id;
          return (
            <div key={p.id} onClick={() => setPlan(p.id)} style={{ cursor: 'pointer', borderRadius: 18, padding: 18, background: 'var(--surface)', border: `2px solid ${on ? 'var(--primary)' : 'var(--border)'}`, boxShadow: on ? 'var(--shadow-md)' : 'none', position: 'relative' }}>
              {p.save && <span style={{ position: 'absolute', top: -10, right: 16, background: 'var(--tier-strong)', color: '#fff', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99 }}>{p.save}</span>}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 24, height: 24, borderRadius: 99, border: `2px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'var(--primary)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>{on && <I.check size={14} stroke={3} />}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{p.id === 'annual' ? 'Annual' : 'Monthly'}</div>
                  {p.perMonth && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.perMonth}, billed yearly</div>}
                </div>
                <div style={{ textAlign: 'right' }}><Mono style={{ fontSize: 20, fontWeight: 700 }}>₹{p.price.toLocaleString('en-IN')}</Mono><div style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>{p.period}</div></div>
              </div>
            </div>
          );
        })}
      </div>

      {/* features */}
      <div style={{ padding: '20px 24px 0' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Everything included</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          {PLANS.monthly.features.map(f => (
            <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <div style={{ width: 22, height: 22, borderRadius: 99, background: 'var(--tier-strong-soft)', color: 'var(--tier-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><I.check size={14} stroke={3} /></div>
              <span style={{ fontSize: 14, color: 'var(--text)' }}>{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* sticky CTA */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '14px 20px 28px', background: 'color-mix(in oklch, var(--surface) 92%, transparent)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderTop: '1px solid var(--border)' }}>
        <Btn full size="lg" onClick={pay} icon={<I.crown size={19} />}>Continue · ₹{(plan === 'annual' ? PLANS.annual.price : PLANS.monthly.price).toLocaleString('en-IN')}{plan === 'annual' ? '/yr' : '/mo'}</Btn>
        <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-faint)', marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}><I.shield size={13} /> Secure payment via Razorpay · Cancel anytime</div>
      </div>
    </div>
  );
}
Object.assign(window, { UpgradeScreen });
