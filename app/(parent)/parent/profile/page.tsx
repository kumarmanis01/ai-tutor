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
    <div className="bg-[var(--bg)] min-h-screen max-w-[390px] mx-auto pb-8">
      <div className="bg-[var(--surface)] border-b border-[var(--border)] px-4 pt-4 pb-[14px]">
        <div className="h-6 w-[100px] rounded-lg bg-[var(--surface-3)]" />
      </div>
      <div className="px-4 pt-[14px] flex flex-col gap-3">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center px-4 py-3 border-b border-[var(--border)]">
      <span className="text-[13px] text-[var(--text-muted)] font-medium">{label}</span>
      <span className="text-[14px] font-semibold text-[var(--text)]">{value}</span>
    </div>
  )
}

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      aria-label={on ? 'Turn off' : 'Turn on'}
      className="relative shrink-0 min-h-[28px] min-w-[46px] w-[46px] h-[28px] rounded-full border-0 cursor-pointer transition-colors duration-200"
      style={{ background: on ? 'var(--primary)' : 'var(--surface-3)' }}
    >
      <span
        className="absolute top-[3px] w-[22px] h-[22px] rounded-full bg-white transition-all duration-200 [box-shadow:0_1px_3px_rgba(0,0,0,0.22)]"
        style={{ left: on ? 21 : 3 }}
      />
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
      className={[
        'w-full flex items-center gap-3 p-[14px] bg-transparent border-0 cursor-pointer text-left [font-family:var(--font-sans)] min-h-[44px]',
        last ? '' : 'border-b border-[var(--border)]',
      ].join(' ')}
    >
      <div style={{ color: danger ? 'var(--tier-critical)' : 'var(--text-muted)' }}>{icon}</div>
      <span className={['flex-1 text-[14px] font-medium', danger ? 'text-[var(--tier-critical)]' : 'text-[var(--text)]'].join(' ')}>{label}</span>
      {detail && <span className="text-[13px] text-[var(--text-faint)] font-semibold">{detail}</span>}
      {!danger && <ChevRightIcon size={16} className="text-[var(--text-faint)]" />}
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
    <div className="bg-[var(--bg)] min-h-screen max-w-[390px] mx-auto p-4">
      <ErrorState title="Could not load profile" body="Please check your connection and try again." onRetry={() => {}} />
    </div>
  )

  const initials = data.parentName.charAt(0).toUpperCase()

  return (
    <div className="bg-[var(--bg)] min-h-screen max-w-[390px] mx-auto pb-8">
      {/* Header */}
      <div className="bg-[var(--surface)] border-b border-[var(--border)] px-4 pt-4 pb-[14px]">
        <div className="text-[18px] font-extrabold tracking-[-0.02em] text-[var(--text)]">Settings</div>
        <div className="text-[12px] text-[var(--text-muted)] mt-[2px]">Your account and preferences</div>
      </div>

      <div className="px-4 pt-[14px] pb-6">
        {/* Identity hero */}
        <Card pad={16} className="mb-[18px] flex items-center gap-4">
          <Avatar letter={initials} hue={280} size={56} />
          <div className="flex-1">
            <div className="text-[17px] font-extrabold text-[var(--text)]">{data.parentName}</div>
            <div className="text-[12.5px] text-[var(--text-muted)] mt-[2px]">{data.email}</div>
            <div className="text-[12.5px] text-[var(--text-muted)]">{data.phone}</div>
          </div>
        </Card>

        {/* Child info (display only -- immutable) */}
        <SectionTitle>Your child</SectionTitle>
        <Card pad={0} className="overflow-hidden mb-[18px]">
          <InfoRow label="Name" value={data.childName} />
          <InfoRow label="Grade" value={data.childGrade} />
          {/* grade/board immutable after first save -- strip from all PATCH handlers */}
          <div className="flex justify-between items-center px-4 py-3">
            <span className="text-[13px] text-[var(--text-muted)] font-medium">Board</span>
            <span className="text-[14px] font-semibold text-[var(--text)]">{data.childBoard}</span>
          </div>
        </Card>

        {/* Preferences */}
        <SectionTitle>Preferences</SectionTitle>
        <Card pad={0} className="overflow-hidden mb-[18px]">
          {/* Notifications toggle */}
          <div className="flex items-center gap-3 p-[14px] border-b border-[var(--border)] min-h-[44px]">
            <BellIcon size={20} className="text-[var(--text-muted)]" />
            <span className="flex-1 text-[14px] font-medium text-[var(--text)]">Progress notifications</span>
            <Toggle on={notificationsOn} onChange={() => setNotificationsOn(v => !v)} />
          </div>
          {/* Dark mode toggle */}
          <div className="flex items-center gap-3 p-[14px] min-h-[44px]">
            {theme === 'dark'
              ? <MoonIcon size={20} className="text-[var(--text-muted)]" />
              : <SunIcon size={20} className="text-[var(--text-muted)]" />
            }
            <span className="flex-1 text-[14px] font-medium text-[var(--text)]">Dark mode</span>
            <Toggle on={theme === 'dark'} onChange={toggle} />
          </div>
        </Card>

        {/* Account actions */}
        <SectionTitle>Account</SectionTitle>
        <Card pad={0} className="overflow-hidden mb-[18px]">
          <SettingRow icon={<UserIcon size={20} />} label="Edit profile" onClick={() => {}} />
          <SettingRow icon={<GearIcon size={20} />} label="Notification settings" onClick={() => {}} />
          <SettingRow icon={<ShieldIcon size={20} />} label="Privacy and consent" onClick={() => {}} />
          <SettingRow icon={<LogoutIcon size={20} />} label="Sign out" danger last onClick={() => router.push('/auth/signin')} />
        </Card>

        <div className="text-center text-[11px] text-[var(--text-faint)] [font-family:var(--font-mono)]">
          Spinzy Academy · v1.0.0
        </div>
      </div>
    </div>
  )
}
