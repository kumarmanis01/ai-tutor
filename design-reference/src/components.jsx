/* ============================================================
   SPINZY — SHARED COMPONENTS
   ============================================================ */
const { useState, useEffect, useRef, useMemo } = React;

/* ---------- Button ---------- */
function Btn({ children, variant = 'primary', size = 'md', full, icon, iconRight, onClick, disabled, style }) {
  const sizes = {
    sm: { h: 38, px: 14, fs: 13.5 },
    md: { h: 48, px: 18, fs: 15 },
    lg: { h: 56, px: 22, fs: 16 },
  }[size];
  const base = {
    height: sizes.h, padding: `0 ${sizes.px}px`, fontSize: sizes.fs,
    fontFamily: 'var(--font-sans)', fontWeight: 600, letterSpacing: '-0.01em',
    borderRadius: 'var(--r-md)', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    width: full ? '100%' : 'auto', transition: 'transform .12s, filter .15s, background .15s',
    opacity: disabled ? 0.5 : 1, whiteSpace: 'nowrap', ...style,
  };
  const variants = {
    primary: { background: 'var(--primary)', color: 'var(--on-brand)', boxShadow: 'var(--shadow-brand)' },
    secondary: { background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' },
    ghost: { background: 'transparent', color: 'var(--text-muted)' },
    outline: { background: 'transparent', color: 'var(--primary)', border: '1.5px solid var(--primary)' },
    danger: { background: 'var(--tier-critical)', color: '#fff' },
  };
  return (
    <button onClick={disabled ? undefined : onClick}
      onMouseDown={e => !disabled && (e.currentTarget.style.transform = 'scale(0.97)')}
      onMouseUp={e => (e.currentTarget.style.transform = '')}
      onMouseLeave={e => (e.currentTarget.style.transform = '')}
      style={{ ...base, ...variants[variant] }}>
      {icon}{children}{iconRight}
    </button>
  );
}

/* ---------- Readiness Tier Pill (5 states, consistent map) ---------- */
function TierPill({ tier, size = 'md', showDot = true }) {
  const t = TIERS[tier];
  const s = size === 'sm'
    ? { h: 22, fs: 11, px: 8, dot: 6 }
    : { h: 27, fs: 12.5, px: 10, dot: 7 };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, height: s.h, padding: `0 ${s.px}px`,
      borderRadius: 'var(--r-pill)', background: t.soft, color: t.color,
      fontSize: s.fs, fontWeight: 700, letterSpacing: '-0.01em', whiteSpace: 'nowrap',
    }}>
      {showDot && <span style={{ width: s.dot, height: s.dot, borderRadius: 99, background: t.color }} />}
      {t.label}
    </span>
  );
}

/* ---------- Subject Chip ---------- */
function SubjectChip({ subject, size = 'md', filled }) {
  const s = SUBJECTS[subject];
  const dims = size === 'sm' ? { h: 22, fs: 11, px: 8 } : { h: 26, fs: 12.5, px: 10 };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, height: dims.h, padding: `0 ${dims.px}px`,
      borderRadius: 'var(--r-pill)', fontSize: dims.fs, fontWeight: 600, whiteSpace: 'nowrap',
      background: filled ? s.color : `color-mix(in oklch, ${s.color} 14%, transparent)`,
      color: filled ? '#fff' : s.color,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 99, background: filled ? '#fff' : s.color, opacity: filled ? 0.9 : 1 }} />
      {s.short}
    </span>
  );
}

/* ---------- Readiness Ring (tier-colored, no number for students) ---------- */
function Ring({ tier, size = 56, stroke = 6, children, animate = true }) {
  const t = TIERS[tier];
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = t.pct / 100;
  const ref = useRef(null);
  const [off, setOff] = useState(animate ? circ : circ * (1 - pct));
  useEffect(() => {
    if (!animate) return;
    const id = setTimeout(() => setOff(circ * (1 - pct)), 80);
    return () => clearTimeout(id);
  }, []);
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
        <circle ref={ref} cx={size/2} cy={size/2} r={r} fill="none" stroke={t.color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={off}
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.22,1,0.36,1)' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {children}
      </div>
    </div>
  );
}

/* ---------- Card ---------- */
function Card({ children, pad = 16, onClick, style, glow, accent }) {
  return (
    <div onClick={onClick} style={{
      background: 'var(--surface)', borderRadius: 'var(--r-lg)', padding: pad,
      border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)',
      cursor: onClick ? 'pointer' : 'default', position: 'relative', overflow: 'hidden',
      ...(accent ? { borderTop: `3px solid ${accent}` } : {}),
      ...(glow ? { boxShadow: 'var(--shadow-md)' } : {}),
      ...style,
    }}>{children}</div>
  );
}

/* ---------- Section header ---------- */
function SectionTitle({ children, action, onAction }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 0 10px' }}>
      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)', whiteSpace: 'nowrap' }}>{children}</h3>
      {action && <button onClick={onAction} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', padding: 0 }}>{action}</button>}
    </div>
  );
}

/* ---------- Session Card (concept, subject, status, CTA) ---------- */
function SessionCard({ concept, subject, status, mastery, onClick, cta = 'Start' }) {
  const statusMap = {
    UPCOMING: { label: 'Upcoming', color: 'var(--text-faint)', bg: 'var(--surface-2)' },
    IN_PROGRESS: { label: 'In progress', color: 'var(--primary)', bg: 'var(--primary-soft)' },
    COMPLETED: { label: 'Completed', color: 'var(--tier-strong)', bg: 'var(--tier-strong-soft)' },
  };
  const st = statusMap[status] || statusMap.UPCOMING;
  return (
    <Card pad={14} onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 7 }}>
          <SubjectChip subject={subject} size="sm" />
          <span style={{ display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 8px', borderRadius: 99, fontSize: 11, fontWeight: 600, background: st.bg, color: st.color, whiteSpace: 'nowrap' }}>{st.label}</span>
        </div>
        <div style={{ fontSize: 14.5, fontWeight: 600, letterSpacing: '-0.01em', lineHeight: 1.3, color: 'var(--text)', textWrap: 'pretty' }}>{concept}</div>
      </div>
      {status === 'COMPLETED'
        ? <div style={{ color: 'var(--tier-strong)' }}><I.checkCircle size={26} /></div>
        : <div style={{ color: status === 'IN_PROGRESS' ? 'var(--primary)' : 'var(--text-faint)' }}><I.chevR size={20} /></div>}
    </Card>
  );
}

/* ---------- Empty State template ---------- */
function EmptyState({ icon = 'sparkle', title, body, action, onAction }) {
  const Ico = I[icon] || I.sparkle;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '48px 28px' }}>
      <div style={{ width: 72, height: 72, borderRadius: 22, background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)', marginBottom: 18 }}>
        <Ico size={32} stroke={1.7} />
      </div>
      <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.5, maxWidth: 260, textWrap: 'pretty' }}>{body}</div>
      {action && <div style={{ marginTop: 22 }}><Btn onClick={onAction}>{action}</Btn></div>}
    </div>
  );
}

/* ---------- Loading Skeleton template ---------- */
function Skel({ w = '100%', h = 14, r = 8, style }) {
  return <div style={{
    width: w, height: h, borderRadius: r,
    background: 'linear-gradient(90deg, var(--skeleton-base) 25%, var(--skeleton-shine) 50%, var(--skeleton-base) 75%)',
    backgroundSize: '200% 100%', animation: 'spz-shimmer 1.4s infinite linear', ...style,
  }} />;
}
function SkeletonCard() {
  return (
    <Card pad={16} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8 }}><Skel w={64} h={22} r={99} /><Skel w={80} h={22} r={99} /></div>
      <Skel w="85%" h={16} /><Skel w="60%" h={16} />
    </Card>
  );
}

/* ---------- Error State template ---------- */
function ErrorState({ title = 'Something went wrong', body = 'We couldn’t load this right now. Check your connection and try again.', onRetry }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '44px 28px' }}>
      <div style={{ width: 72, height: 72, borderRadius: 22, background: 'var(--tier-critical-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--tier-critical)', marginBottom: 18 }}>
        <I.alert size={32} stroke={1.8} />
      </div>
      <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.5, maxWidth: 270, textWrap: 'pretty' }}>{body}</div>
      {onRetry && <div style={{ marginTop: 22 }}><Btn variant="secondary" icon={<I.refresh size={17} />} onClick={onRetry}>Try again</Btn></div>}
    </div>
  );
}

/* ---------- Progress bar ---------- */
function Bar({ value, max = 100, color = 'var(--primary)', h = 8, track = 'var(--surface-3)' }) {
  return (
    <div style={{ height: h, borderRadius: 99, background: track, overflow: 'hidden', width: '100%' }}>
      <div style={{ height: '100%', width: `${Math.min(100, value/max*100)}%`, background: color, borderRadius: 99, transition: 'width .8s cubic-bezier(0.22,1,0.36,1)' }} />
    </div>
  );
}

/* ---------- Avatar ---------- */
function Avatar({ letter, hue = 184, size = 40, ring }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 99, flexShrink: 0,
      background: `oklch(0.62 0.10 ${hue})`,
      color: '#fff', fontWeight: 700, fontSize: size * 0.42,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: ring ? `0 0 0 3px var(--surface), 0 0 0 5px oklch(0.62 0.10 ${hue} / 0.4)` : 'none',
    }}>{letter}</div>
  );
}

/* ---------- Bottom tab bar (student) ---------- */
function BottomNav({ active, onChange }) {
  const tabs = [
    { id: 'home', icon: 'home', label: 'Home' },
    { id: 'path', icon: 'path', label: 'Path' },
    { id: 'tutor', icon: 'tutor', label: 'Vidya', center: true },
    { id: 'tests', icon: 'tests', label: 'Tests' },
    { id: 'progress', icon: 'progress', label: 'Progress' },
  ];
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 40,
      paddingBottom: 24, paddingTop: 8,
      background: 'color-mix(in oklch, var(--surface) 88%, transparent)',
      backdropFilter: 'blur(20px) saturate(160%)', WebkitBackdropFilter: 'blur(20px) saturate(160%)',
      borderTop: '1px solid var(--border)',
      display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end',
    }}>
      {tabs.map(t => {
        const Ico = I[t.icon];
        const on = active === t.id;
        if (t.center) {
          return (
            <button key={t.id} onClick={() => onChange(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: 0, marginTop: -22 }}>
              <div style={{ width: 52, height: 52, borderRadius: 18, background: 'var(--primary)', color: 'var(--on-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-brand)' }}>
                <Ico size={26} />
              </div>
              <span style={{ fontSize: 10.5, fontWeight: 600, color: on ? 'var(--primary)' : 'var(--text-faint)' }}>{t.label}</span>
            </button>
          );
        }
        return (
          <button key={t.id} onClick={() => onChange(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '2px 4px', flex: 1 }}>
            <div style={{ color: on ? 'var(--primary)' : 'var(--text-faint)', transition: 'color .2s' }}><Ico size={23} stroke={on ? 2.2 : 1.9} /></div>
            <span style={{ fontSize: 10.5, fontWeight: on ? 700 : 500, color: on ? 'var(--primary)' : 'var(--text-faint)' }}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------- App header ---------- */
function AppHeader({ title, sub, back, onBack, right, large }) {
  return (
    <div style={{ padding: large ? '8px 20px 4px' : '6px 16px', display: 'flex', alignItems: 'center', gap: 10, minHeight: 44 }}>
      {back && <button onClick={onBack} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', width: 38, height: 38, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text)', flexShrink: 0 }}><I.chevL size={20} /></button>}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: large ? 22 : 17, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{title}</div>
        {sub && <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
      </div>
      {right}
    </div>
  );
}

/* ---------- Segmented control ---------- */
function Segmented({ options, value, onChange, full }) {
  return (
    <div style={{ display: 'flex', gap: 3, padding: 3, background: 'var(--surface-2)', borderRadius: 12, border: '1px solid var(--border)', width: full ? '100%' : 'auto' }}>
      {options.map(o => {
        const on = value === (o.id ?? o);
        return (
          <button key={o.id ?? o} onClick={() => onChange(o.id ?? o)} style={{
            flex: full ? 1 : undefined, height: 34, padding: '0 14px', border: 'none', cursor: 'pointer',
            borderRadius: 9, fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-sans)',
            background: on ? 'var(--surface)' : 'transparent', color: on ? 'var(--text)' : 'var(--text-muted)',
            boxShadow: on ? 'var(--shadow-sm)' : 'none', transition: 'all .15s', whiteSpace: 'nowrap',
          }}>{o.label ?? o}</button>
        );
      })}
    </div>
  );
}

/* ---------- Mono label (for codes, numerals, placeholders) ---------- */
function Mono({ children, style }) {
  return <span style={{ fontFamily: 'var(--font-mono)', letterSpacing: '-0.02em', ...style }}>{children}</span>;
}

/* ---------- Image placeholder ---------- */
function Placeholder({ label, h = 120, r = 16 }) {
  return (
    <div style={{
      height: h, borderRadius: r, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'repeating-linear-gradient(135deg, var(--surface-2), var(--surface-2) 10px, var(--surface-3) 10px, var(--surface-3) 20px)',
      border: '1px dashed var(--border-strong)', color: 'var(--text-faint)',
    }}>
      <Mono style={{ fontSize: 11.5 }}>{label}</Mono>
    </div>
  );
}

Object.assign(window, {
  Btn, TierPill, SubjectChip, Ring, Card, SectionTitle, SessionCard,
  EmptyState, Skel, SkeletonCard, ErrorState, Bar, Avatar, BottomNav,
  AppHeader, Segmented, Mono, Placeholder,
  useState, useEffect, useRef, useMemo,
});
