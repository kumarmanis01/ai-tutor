/**
 * FILE OBJECTIVE:
 * - Multi-step student registration wizard (S0.1).
 *   Steps: Role → AgeGate → Profile → ParentContact → Success.
 *   Under-18 students see ParentContact step; over-18 skip directly to success.
 *   On success, calls onComplete with explore_token (under-18) or null (adult).
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/student/registration/StudentRegistrationWizard.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-24T00:00:00Z | copilot | created
 * - 2026-04-24T12:00:00Z | copilot | cleaned duplicate exports and helpers
 * - 2026-04-27T00:00:00Z | copilot | integrated S0.1/S0.2 onboarding deltas (DOB dropdowns, medium+subjects retention, expanded board options, and refined consent flow)
 * - 2026-04-27T12:00:00Z | copilot | align step-1 tangerine CTA, outlined parent action, email validation, and DPDP helper text
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { logger } from '@/lib/logger';
import { calculateAgeFromDob } from '@/lib/student/calculateAgeFromDob';

type Step = 'role' | 'age' | 'profile' | 'parent' | 'success';

interface SuccessData {
  isAdult: boolean;
  exploreToken: string | null;
  name: string;
  contactMask: string | null;
  studentId: string | null;
}

interface Props {
  onComplete?: (data: SuccessData) => void;
}

const BOARDS = [
  { value: 'CBSE', label: 'CBSE' },
  { value: 'ICSE', label: 'ICSE' },
  { value: 'STATE_MAHARASHTRA', label: 'State Board - Maharashtra' },
  { value: 'STATE_UTTAR_PRADESH', label: 'State Board - Uttar Pradesh' },
  { value: 'STATE_OTHER', label: 'State Board - Other' },
];

const SUBJECTS = [
  'Mathematics',
  'Science',
  'English',
  'Hindi',
  'Social Science',
  'Computer Science',
  'Physics',
  'Chemistry',
  'Biology',
];

const MEDIUMS = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
];

const GRADES = Array.from({ length: 12 }, (_, i) => i + 1);
const MAX_ALLOWED_AGE = 120;

function formatPhoneInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  return digits.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
}

function dobFromParts(day: string, month: string, year: string): string | null {
  if (!day || !month || !year) {
    return null;
  }

  const normalized = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  if (
    parsed.getUTCFullYear() !== Number(year) ||
    parsed.getUTCMonth() + 1 !== Number(month) ||
    parsed.getUTCDate() !== Number(day)
  ) {
    return null;
  }

  return normalized;
}

export default function StudentRegistrationWizard({ onComplete }: Props) {
  const [step, setStep] = useState<Step>('role');
  const [dobDay, setDobDay] = useState('');
  const [dobMonth, setDobMonth] = useState('');
  const [dobYear, setDobYear] = useState('');
  const [isAdult, setIsAdult] = useState(false);
  const [name, setName] = useState('');
  const [grade, setGrade] = useState('');
  const [board, setBoard] = useState('');
  const [medium, setMedium] = useState('en');
  const [subjects, setSubjects] = useState<string[]>([]);
  const [channel, setChannel] = useState<'whatsapp' | 'email'>('whatsapp');
  const [parentContact, setParentContact] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showDpdpModal, setShowDpdpModal] = useState(false);
  const [success, setSuccess] = useState<SuccessData | null>(null);

  const dob = dobFromParts(dobDay, dobMonth, dobYear);

  // Role
  if (step === 'role') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-slate-950 p-6 gap-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Welcome to Spinzy</h1>
        <p className="text-gray-500 dark:text-gray-400 text-center">
          How will you be using Spinzy?
        </p>
        <button
          className="w-full max-w-xs min-h-[44px] rounded-2xl bg-[#F28C28] text-white font-bold text-lg"
          onClick={() => setStep('age')}
        >
          {"I'm a Student"}
        </button>
        <Link
          href="/login"
          className="w-full max-w-xs min-h-[44px] rounded-2xl border-2 border-[#F28C28] text-[#F28C28] font-semibold text-base flex items-center justify-center bg-transparent"
        >
          {"I'm a Parent"}
        </Link>
      </div>
    );
  }

  // Age
  if (step === 'age') {
    const age = dob ? calculateAgeFromDob(dob) : null;
    const valid = age !== null && age >= 4 && age <= MAX_ALLOWED_AGE;
    const currentYear = new Date().getUTCFullYear();
    const years = Array.from({ length: MAX_ALLOWED_AGE + 1 }, (_, i) => String(currentYear - i));
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-slate-950 p-6 gap-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 text-center">
          When were you born?
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
          We need this to comply with India's data protection laws.
        </p>
        <div className="w-full max-w-xs grid grid-cols-3 gap-2">
          <select
            aria-label="Day"
            value={dobDay}
            onChange={(e) => setDobDay(e.target.value)}
            className="min-h-[44px] rounded-xl border-2 border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-2 text-sm"
          >
            <option value="">Day</option>
            {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
              <option key={day} value={String(day)}>
                {day}
              </option>
            ))}
          </select>
          <select
            aria-label="Month"
            value={dobMonth}
            onChange={(e) => setDobMonth(e.target.value)}
            className="min-h-[44px] rounded-xl border-2 border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-2 text-sm"
          >
            <option value="">Month</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
              <option key={month} value={String(month)}>
                {month}
              </option>
            ))}
          </select>
          <select
            aria-label="Year"
            value={dobYear}
            onChange={(e) => setDobYear(e.target.value)}
            className="min-h-[44px] rounded-xl border-2 border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-2 text-sm"
          >
            <option value="">Year</option>
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
        <button
          disabled={!valid}
          className="w-full max-w-xs min-h-[44px] rounded-2xl bg-[#534AB7] text-white font-bold text-lg disabled:opacity-40"
          onClick={() => {
            if (!dob) {
              return;
            }
            const a = calculateAgeFromDob(dob);
            if (a == null) {
              return;
            }
            setIsAdult(a >= 18);
            setStep('profile');
          }}
        >
          Continue
        </button>
      </div>
    );
  }

  // Profile
  if (step === 'profile') {
    const canNext =
      name.trim().length > 0 &&
      grade !== '' &&
      board !== '' &&
      medium !== '' &&
      subjects.length > 0;

    const profileStepLabel = isAdult ? 'Step 2 of 3' : 'Step 2 of 5';

    async function handleProfileNext() {
      if (!dob) {
        setError('Please provide a valid date of birth.');
        return;
      }

      if (isAdult) {
        setBusy(true);
        setError('');
        try {
          const res = await fetch('/api/v1/students/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name,
              dateOfBirth: dob,
              grade,
              board,
              medium,
              subjects,
            }),
          });
          const data = (await res.json()) as Record<string, unknown>;
          if (!res.ok) {
            setError(
              typeof data.error === 'string'
                ? data.error
                : 'Something went wrong. Please try again.'
            );
            return;
          }
          const sd: SuccessData = {
            isAdult: true,
            exploreToken: null,
            name,
            contactMask: null,
            studentId: typeof data?.user === 'object' && data.user && 'id' in data.user ? String((data.user as { id: unknown }).id) : null,
          };
          setSuccess(sd);
          setStep('success');
          onComplete?.(sd);
        } catch (e) {
          logger.warn('StudentRegistrationWizard: adult register fetch failed', {
            error: String(e),
          });
          setError('Network error. Please check your connection.');
        } finally {
          setBusy(false);
        }
      } else {
        setStep('parent');
      }
    }

    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-slate-950 p-6 gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 text-center">
          Tell us about yourself
        </h1>
        <p className="text-xs text-gray-500 dark:text-gray-400">{profileStepLabel}</p>
        <input
          type="text"
          placeholder="First Name"
          maxLength={30}
          value={name}
          onChange={(e) => {
            const cleaned = e.target.value.replace(/[^A-Za-z ]/g, '');
            setName(cleaned);
          }}
          className="w-full max-w-xs min-h-[44px] rounded-xl border-2 border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-sm"
        />
        <select
          aria-label="Grade"
          value={grade}
          onChange={(e) => setGrade(e.target.value)}
          className="w-full max-w-xs min-h-[44px] rounded-xl border-2 border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-sm"
        >
          <option value="">Select Grade</option>
          {GRADES.map((g) => (
            <option key={g} value={String(g)}>
              Class {g}
            </option>
          ))}
        </select>
        <select
          aria-label="Board"
          value={board}
          onChange={(e) => setBoard(e.target.value)}
          className="w-full max-w-xs min-h-[44px] rounded-xl border-2 border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-sm"
        >
          <option value="">Select Board</option>
          {BOARDS.map((b) => (
            <option key={b.value} value={b.value}>
              {b.label}
            </option>
          ))}
        </select>
        <select
          aria-label="Medium"
          value={medium}
          onChange={(e) => setMedium(e.target.value)}
          className="w-full max-w-xs min-h-[44px] rounded-xl border-2 border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-sm"
        >
          {MEDIUMS.map((item) => (
            <option key={item.value} value={item.value}>
              Medium: {item.label}
            </option>
          ))}
        </select>
        <div className="w-full max-w-xs rounded-xl border-2 border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-3">
          <p className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-2">
            Subjects (select up to 6)
          </p>
          <div className="grid grid-cols-2 gap-2">
            {SUBJECTS.map((subject) => {
              const selected = subjects.includes(subject);
              return (
                <button
                  key={subject}
                  type="button"
                  onClick={() => {
                    setSubjects((prev) => {
                      if (prev.includes(subject)) {
                        return prev.filter((item) => item !== subject);
                      }
                      if (prev.length >= 6) {
                        return prev;
                      }
                      return [...prev, subject];
                    });
                  }}
                  className={`min-h-[40px] rounded-lg text-xs font-semibold px-2 ${selected ? 'bg-[#534AB7] text-white' : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200'}`}
                >
                  {subject}
                </button>
              );
            })}
          </div>
        </div>
        {error && <p className="text-sm text-[#E24B4A] text-center">{error}</p>}
        <button
          disabled={!canNext || busy}
          className="w-full max-w-xs min-h-[44px] rounded-2xl bg-[#534AB7] text-white font-bold text-lg disabled:opacity-40"
          onClick={() => {
            void handleProfileNext();
          }}
        >
          {busy ? 'Creating account...' : 'Next'}
        </button>
        {isAdult && (
          <p className="text-xs text-gray-400">You are 18+. No parental consent needed.</p>
        )}
      </div>
    );
  }

  // Parent contact
  if (step === 'parent') {
    const emailIsValid = /^\S+@\S+\.\S+$/.test(parentContact.trim());
    const canSend =
      channel === 'whatsapp'
        ? parentContact.replace(/\s/g, '').length === 10
        : emailIsValid;

    async function handleSend() {
      if (!dob) {
        setError('Please provide a valid date of birth.');
        return;
      }

      setBusy(true);
      setError('');
      try {
        const res = await fetch('/api/v1/students/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            dateOfBirth: dob,
            grade,
            board,
            medium,
            subjects,
            channel,
            parent_contact:
              channel === 'whatsapp' ? `+91${parentContact.replace(/\s/g, '')}` : parentContact,
          }),
        });
        const data = (await res.json()) as Record<string, unknown>;
        if (!res.ok) {
          setError(
            typeof data.error === 'string' ? data.error : 'Something went wrong. Please try again.'
          );
          return;
        }
        const sd: SuccessData = {
          isAdult: false,
          exploreToken:
            typeof data.consent_token === 'string'
              ? data.consent_token
              : typeof data.explore_token === 'string'
                ? data.explore_token
                : null,
          name,
          contactMask: typeof data.contactMask === 'string' ? data.contactMask : null,
          studentId:
            typeof data?.user === 'object' && data.user && 'id' in data.user
              ? String((data.user as { id: unknown }).id)
              : null,
        };
        setSuccess(sd);
        setStep('success');
        onComplete?.(sd);
      } catch (e) {
        logger.warn('StudentRegistrationWizard: register fetch failed', { error: String(e) });
        setError('Network error. Please check your connection.');
      } finally {
        setBusy(false);
      }
    }

    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-slate-950 p-6 gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 text-center">
          Who should we ask for permission?
        </h1>
        <p className="text-xs text-gray-500 dark:text-gray-400">Step 3 of 5</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
          Indian law requires parental consent for learners under 18. We will send a quick approval
          message.
        </p>
        <div className="flex w-full max-w-xs rounded-xl overflow-hidden border-2 border-gray-200 dark:border-slate-700">
          {(['whatsapp', 'email'] as const).map((c) => (
            <button
              key={c}
              className={`flex-1 min-h-[44px] text-sm font-semibold transition-colors ${channel === c ? 'bg-[#534AB7] text-white' : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300'}`}
              onClick={() => {
                setChannel(c);
                setParentContact('');
              }}
            >
              {c === 'whatsapp' ? 'WhatsApp' : 'Email'}
            </button>
          ))}
        </div>
        {channel === 'whatsapp' ? (
          <div className="w-full max-w-xs rounded-xl border-2 border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 flex items-center gap-2 min-h-[44px]">
            <span className="text-sm text-gray-600 dark:text-gray-300">+91</span>
            <input
              type="tel"
              placeholder="987 654 3210"
              value={parentContact}
              onChange={(e) => setParentContact(formatPhoneInput(e.target.value))}
              className="w-full bg-transparent outline-none text-sm"
            />
          </div>
        ) : (
          <input
            type="email"
            placeholder="parent@example.com"
            value={parentContact}
            onChange={(e) => setParentContact(e.target.value)}
            className="w-full max-w-xs min-h-[44px] rounded-xl border-2 border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-sm"
          />
        )}
        <p className="w-full max-w-xs text-xs text-gray-500 dark:text-gray-400">
          {channel === 'whatsapp'
            ? 'We will send a WhatsApp message. No app download needed.'
            : 'We will send an email with an approval link.'}
        </p>
        {error && <p className="text-sm text-[#E24B4A] text-center">{error}</p>}
        <button
          disabled={!canSend || busy}
          className="w-full max-w-xs min-h-[44px] rounded-2xl bg-[#534AB7] text-white font-bold text-lg disabled:opacity-40"
          onClick={() => {
            void handleSend();
          }}
        >
          {busy ? 'Sending...' : 'Send Request & Start Exploring'}
        </button>
        <button
          type="button"
          className="text-xs text-[#534AB7] underline"
          onClick={() => setShowDpdpModal(true)}
        >
          Why do we need this? Learn about Indian data protection law.
        </button>

        {showDpdpModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4">
            <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-5">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                About Indian Data Protection Law
              </h2>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                Learners under 18 need a parent approval step before full access. We only use this
                contact to request consent and important safety updates.
              </p>
              <button
                type="button"
                className="mt-4 min-h-[44px] px-4 rounded-xl bg-[#534AB7] text-white font-semibold"
                onClick={() => setShowDpdpModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Success
  if (step === 'success') {
    if (isAdult || success?.isAdult) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-slate-950 p-6 gap-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 text-center">
            Welcome to Spinzy! 🎉
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-center">
            You are all set. Let us find out where you stand with a quick diagnostic quiz.
          </p>
          <Link
            href="/student/onboarding"
            className="w-full max-w-xs min-h-[44px] rounded-2xl bg-[#534AB7] text-white font-bold text-lg flex items-center justify-center"
          >
            Take Diagnostic
          </Link>
          <Link href="/dashboard" className="text-[#534AB7] text-sm underline">
            Skip for now
          </Link>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-slate-950 p-6 gap-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 text-center">{`You're in, ${success?.name ?? name}! 🎉`}</h1>
        <p className="text-gray-500 dark:text-gray-400 text-center">{`We've sent an approval request to ${success?.contactMask ?? parentContact}. While you wait, explore 3 free sample lessons!`}</p>
        <Link
          href={`/explore?token=${encodeURIComponent(success?.exploreToken ?? '')}&grade=${encodeURIComponent(grade)}&board=${encodeURIComponent(board)}&studentId=${encodeURIComponent(success?.studentId ?? '')}`}
          className="w-full max-w-xs min-h-[44px] rounded-2xl bg-[#534AB7] text-white font-bold text-lg flex items-center justify-center"
        >
          Start Exploring
        </Link>
        <button
          className="text-[#534AB7] text-sm underline"
          onClick={() => {
            setStep('parent');
            setParentContact('');
          }}
        >
          Send a different contact
        </button>
      </div>
    );
  }

  return null;
}
