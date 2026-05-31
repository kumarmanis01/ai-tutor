'use client'
import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Card, Btn, ErrorState, SkeletonCard,
  SectionTitle, Avatar,
  UserIcon, GearIcon, ShieldIcon, LogoutIcon, ChevRightIcon, BellIcon, MoonIcon, SunIcon,
} from '@/components/ui'
import { useTheme } from '@/context/ThemeContext'

interface ParentProfileData {
  parentName: string
  email: string
  phone: string
  childName: string
  childGrade: string
  childBoard: string
  notificationsEnabled: boolean
  isLoading?: boolean
  error?: string | null
}

function LoadingState() {
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', maxWidth: 390, margin: '0 auto', paddingBottom: 32 }}>
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '16px 16px 14px' }}>
        <div style={{ height: 24, width: 100, borderRadius: 8, background: 'var(--surface-3)' }} />
      </div>
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{value}</span>
    </div>
  )
}

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      aria-label={on ? 'Turn off' : 'Turn on'}
      style={{ width: 46, height: 28, borderRadius: 99, border: 'none', cursor: 'pointer', background: on ? 'var(--primary)' : 'var(--surface-3)', position: 'relative', transition: 'background .2s', flexShrink: 0, minHeight: 28, minWidth: 46 }}
    >
      <span style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 22, height: 22, borderRadius: 99, background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,0.22)' }} />
    </button>
  )
}

function SettingRow({ icon, label, detail, danger, last, onClick }: {
  icon: React.ReactNode
  label: string
  detail?: string
  danger?: boolean
  last?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: 14, background: 'none', border: 'none', borderBottom: last ? 'none' : '1px solid var(--border)', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-sans)', minHeight: 44 }}
    >
      <div style={{ color: danger ? 'var(--tier-critical)' : 'var(--text-muted)' }}>{icon}</div>
      <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: danger ? 'var(--tier-critical)' : 'var(--text)' }}>{label}</span>
      {detail && <span style={{ fontSize: 13, color: 'var(--text-faint)', fontWeight: 600 }}>{detail}</span>}
      {!danger && <ChevRightIcon size={16} style={{ color: 'var(--text-faint)' }} />}
    </button>
  )
}

// --- DEMO DATA ---
const DEMO: ParentProfileData = {
  parentName: 'Meera Sharma',
  email: 'meera@example.com',
  phone: '+91 98765 43210',
  childName: 'Aarav Sharma',
  childGrade: 'Class 10',
  childBoard: 'CBSE',
  notificationsEnabled: true,
}

export default function ParentProfilePage() {
  const router = useRouter()
  const { theme, toggle } = useTheme()
  const [isLoading] = useState(false)
  const [error] = useState<string | null>(null)
  const data = DEMO
  const [notificationsOn, setNotificationsOn] = useState(data.notificationsEnabled)

  if (isLoading) return <LoadingState />
  if (error) return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', maxWidth: 390, margin: '0 auto', padding: 16 }}>
      <ErrorState title="Could not load profile" body="Please check your connection and try again." onRetry={() => {}} />
    </div>
  )

  const initials = data.parentName.charAt(0).toUpperCase()

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', maxWidth: 390, margin: '0 auto', paddingBottom: 32 }}>
      {/* Header */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '16px 16px 14px' }}>
        <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text)' }}>Settings</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Your account and preferences</div>
      </div>

      <div style={{ padding: '14px 16px 24px' }}>
        {/* Identity hero */}
        <Card pad={16} style={{ marginBottom: 18, display: 'flex', alignItems: 'center', gap: 16 }}>
          <Avatar letter={initials} hue={280} size={56} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>{data.parentName}</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>{data.email}</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{data.phone}</div>
          </div>
        </Card>

        {/* Child info (display only -- immutable) */}
        <SectionTitle>Your child</SectionTitle>
        <Card pad={0} style={{ overflow: 'hidden', marginBottom: 18 }}>
          <InfoRow label="Name" value={data.childName} />
          <InfoRow label="Grade" value={data.childGrade} />
          {/* grade/board immutable after first save -- strip from all PATCH handlers */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px' }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>Board</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{data.childBoard}</span>
          </div>
        </Card>

        {/* Preferences */}
        <SectionTitle>Preferences</SectionTitle>
        <Card pad={0} style={{ overflow: 'hidden', marginBottom: 18 }}>
          {/* Notifications toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderBottom: '1px solid var(--border)', minHeight: 44 }}>
            <BellIcon size={20} style={{ color: 'var(--text-muted)' }} />
            <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>Progress notifications</span>
            <Toggle on={notificationsOn} onChange={() => setNotificationsOn(v => !v)} />
          </div>
          {/* Dark mode toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, minHeight: 44 }}>
            {theme === 'dark'
              ? <MoonIcon size={20} style={{ color: 'var(--text-muted)' }} />
              : <SunIcon size={20} style={{ color: 'var(--text-muted)' }} />
            }
            <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>Dark mode</span>
            <Toggle on={theme === 'dark'} onChange={toggle} />
          </div>
        </Card>

        {/* Account actions */}
        <SectionTitle>Account</SectionTitle>
        <Card pad={0} style={{ overflow: 'hidden', marginBottom: 18 }}>
          <SettingRow icon={<UserIcon size={20} />} label="Edit profile" onClick={() => {}} />
          <SettingRow icon={<GearIcon size={20} />} label="Notification settings" onClick={() => {}} />
          <SettingRow icon={<ShieldIcon size={20} />} label="Privacy and consent" onClick={() => {}} />
          <SettingRow icon={<LogoutIcon size={20} />} label="Sign out" danger last onClick={() => router.push('/auth/signin')} />
        </Card>

        <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>
          Spinzy Academy · v1.0.0
        </div>
      </div>
    </div>
  )
}
