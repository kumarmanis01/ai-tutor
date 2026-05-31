/* ============================================================
   SPINZY — PARENT P4 Billing · P5 Settings
   ============================================================ */

/* ============ P4 — BILLING ============ */
function BillingScreen({ scenario = 'default', onNav }) {
  const b = BILLING;
  const emiFailed = scenario === 'emi-failed';
  return (
    <ParentShell active="p-billing" onNav={onNav} title="Billing" sub="Plan & payments">
      <div style={{ padding: '14px 16px 24px' }}>
        {/* active plan */}
        <div style={{ borderRadius: 20, padding: 18, background: 'linear-gradient(135deg, var(--brand-600), var(--brand-800))', color: '#fff', marginBottom: 16, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', right: -16, top: -16, opacity: 0.16 }}><I.crown size={100} /></div>
          <div style={{ position: 'relative' }}>
            <div style={{ fontSize: 12, opacity: 0.85, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active plan</div>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', margin: '4px 0 12px' }}>{b.plan}</div>
            <div style={{ display: 'flex', gap: 20 }}>
              <div><div style={{ fontSize: 11, opacity: 0.8 }}>Amount</div><Mono style={{ fontSize: 16, fontWeight: 700 }}>{b.amount}</Mono></div>
              <div><div style={{ fontSize: 11, opacity: 0.8 }}>Next billing</div><div style={{ fontSize: 14, fontWeight: 700 }}>{b.nextDate}</div></div>
            </div>
          </div>
        </div>

        {/* EMI schedule */}
        {b.emi.enabled && (
          <Card pad={16} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>EMI schedule</div>
              <Mono style={{ fontSize: 12.5, color: 'var(--text-muted)', fontWeight: 600 }}>{b.emi.paid}/{b.emi.total} paid</Mono>
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
              {[...Array(b.emi.total)].map((_, i) => {
                const paid = i < b.emi.paid; const failed = emiFailed && i === b.emi.paid;
                return <div key={i} style={{ flex: 1, height: 8, borderRadius: 99, background: failed ? 'var(--tier-critical)' : paid ? 'var(--tier-strong)' : 'var(--surface-3)' }} />;
              })}
            </div>
            {emiFailed ? (
              <div style={{ borderRadius: 12, padding: 13, background: 'var(--tier-critical-soft)', border: '1px solid color-mix(in oklch, var(--tier-critical) 25%, transparent)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}><I.alert size={17} style={{ color: 'var(--tier-critical)' }} /><span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>Installment 3 failed</span></div>
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.45 }}>Your {b.emi.perMonth} payment couldn’t be processed. Retry to keep Premium active.</div>
                <Btn size="sm" full variant="danger" icon={<I.refresh size={16} />}>Retry payment · {b.emi.perMonth}</Btn>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, background: 'var(--surface-2)' }}>
                <I.clock size={18} style={{ color: 'var(--text-muted)' }} />
                <div style={{ flex: 1, fontSize: 13 }}>Next installment <b>{b.emi.perMonth}</b></div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{b.emi.nextDue}</span>
              </div>
            )}
          </Card>
        )}

        {/* payment methods */}
        <SectionTitle action="+ Add" onAction={() => {}}>Payment methods</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
          {b.methods.map(m => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--surface-2)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{React.createElement(m.type === 'card' ? I.card : I.phone, { size: 20 })}</div>
              <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 600 }}>{m.label}</div>{m.primary && <div style={{ fontSize: 11.5, color: 'var(--primary)', fontWeight: 600 }}>Primary</div>}</div>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', padding: 6 }}><I.x size={17} /></button>
            </div>
          ))}
        </div>

        {/* invoices */}
        <SectionTitle>Invoices</SectionTitle>
        <Card pad={0} style={{ overflow: 'hidden' }}>
          {b.invoices.map((inv, i) => (
            <div key={inv.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderBottom: i < b.invoices.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <I.doc size={19} style={{ color: 'var(--text-faint)' }} />
              <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 600 }}>{inv.date}</div><Mono style={{ fontSize: 12, color: 'var(--text-muted)' }}>{inv.amount}</Mono></div>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: inv.status === 'Paid' ? 'var(--tier-strong)' : 'var(--tier-weak)', background: inv.status === 'Paid' ? 'var(--tier-strong-soft)' : 'var(--tier-weak-soft)', padding: '4px 9px', borderRadius: 99 }}>{inv.status}</span>
              {inv.status === 'Paid' && <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', padding: 4 }}><I.download size={18} /></button>}
            </div>
          ))}
        </Card>

        <div style={{ marginTop: 18 }}><Btn full variant="secondary" icon={<I.crown size={18} />} onClick={() => onNav('p-billing')}>Change plan</Btn></div>
      </div>
    </ParentShell>
  );
}

/* ============ P5 — SETTINGS ============ */
function ParentSettingsScreen({ scenario = 'default', onNav }) {
  const [digest, setDigest] = useState('weekly');
  const [paused, setPaused] = useState({ ch1: false, ch2: false });
  return (
    <ParentShell active="p-settings" onNav={onNav} title="Settings" sub="Notifications & controls">
      <div style={{ padding: '14px 16px 24px' }}>
        {/* notifications */}
        <SectionTitle>Progress digest</SectionTitle>
        <Card pad={16} style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>How often should we email you a summary?</div>
          <Segmented full options={[{ id: 'daily', label: 'Daily' }, { id: 'weekly', label: 'Weekly' }, { id: 'off', label: 'Off' }]} value={digest} onChange={setDigest} />
        </Card>

        {/* notification toggles */}
        <SectionTitle>Notifications</SectionTitle>
        <Card pad={0} style={{ overflow: 'hidden', marginBottom: 18 }}>
          {[['Exam approaching alerts', true], ['Weak topic warnings', true], ['Missed session reminders', false], ['Billing & payment alerts', true]].map(([label, def], i, arr) => (
            <SettingToggle key={label} label={label} def={def} last={i === arr.length - 1} />
          ))}
        </Card>

        {/* parental controls */}
        <SectionTitle>Parental controls</SectionTitle>
        <Card pad={0} style={{ overflow: 'hidden', marginBottom: 18 }}>
          {CHILDREN.map((c, i) => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderBottom: i < CHILDREN.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <Avatar letter={c.avatar} hue={c.hue} size={36} />
              <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 600 }}>Pause learning · {c.name}</div><div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{paused[c.id] ? 'Learning paused' : 'Active'}</div></div>
              <Toggle on={paused[c.id]} onChange={() => setPaused(p => ({ ...p, [c.id]: !p[c.id] }))} />
            </div>
          ))}
        </Card>

        {/* account */}
        <SectionTitle>Account</SectionTitle>
        <Card pad={0} style={{ overflow: 'hidden', marginBottom: 18 }}>
          <SettingRow icon="users" label="Linked children" detail={`${CHILDREN.length}`} onClick={() => {}} />
          <SettingRow icon="plus" label="Add a child" onClick={() => onNav('p-onboarding')} />
          <SettingRow icon="shield" label="Privacy & DPDP consent" onClick={() => {}} />
          <SettingRow icon="logout" label="Sign out" danger last onClick={() => onNav('p-onboarding')} />
        </Card>
        <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>Spinzy Academy · v1.0.0</div>
      </div>
    </ParentShell>
  );
}
function SettingToggle({ label, def, last }) {
  const [on, setOn] = useState(def);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderBottom: last ? 'none' : '1px solid var(--border)' }}>
      <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{label}</span>
      <Toggle on={on} onChange={() => setOn(!on)} />
    </div>
  );
}
function Toggle({ on, onChange }) {
  return (
    <button onClick={onChange} style={{ width: 46, height: 28, borderRadius: 99, border: 'none', cursor: 'pointer', background: on ? 'var(--primary)' : 'var(--surface-3)', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
      <span style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 22, height: 22, borderRadius: 99, background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }} />
    </button>
  );
}
function SettingRow({ icon, label, detail, danger, last, onClick }) {
  return (
    <button onClick={onClick} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: 14, background: 'none', border: 'none', borderBottom: last ? 'none' : '1px solid var(--border)', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-sans)' }}>
      <div style={{ color: danger ? 'var(--tier-critical)' : 'var(--text-muted)' }}>{React.createElement(I[icon], { size: 20 })}</div>
      <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: danger ? 'var(--tier-critical)' : 'var(--text)' }}>{label}</span>
      {detail && <span style={{ fontSize: 13, color: 'var(--text-faint)', fontWeight: 600 }}>{detail}</span>}
      {!danger && <I.chevR size={17} style={{ color: 'var(--text-faint)' }} />}
    </button>
  );
}
Object.assign(window, { BillingScreen, ParentSettingsScreen, Toggle, SettingRow });
