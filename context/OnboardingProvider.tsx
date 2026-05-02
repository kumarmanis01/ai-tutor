'use client';
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  HttpOnboardingService,
  OnboardingProfile,
  OnboardingService,
  OnboardingValues,
} from '@/lib/onboardingService';
import { DPDP_MINOR_AGE } from '@/lib/constants/age';
import { logger } from '@/lib/logger';

type State = {
  isOpen: boolean;
  loading: boolean;
  saving: boolean;
  values: OnboardingValues;
  errors: Record<string, string>;
  parentVerified: boolean;
  gradeLocked: boolean;
  allowDismiss: boolean;
};

type API = {
  isRequired: boolean;
  open: (opts?: {
    force?: boolean;
    allowDismiss?: boolean;
    afterSave?: 'dashboard' | 'stay';
  }) => Promise<void> | void;
  close: () => void;
  setValue: (field: keyof OnboardingValues, value: any) => void;
  save: () => Promise<void>;
} & State;

const defaultValues: OnboardingValues = {
  name: '',
  age: null,
  class_grade: null,
  board: null,
  preferred_language: null,
  subjects: undefined,
  parent_email: null,
  parent_phone: null,
  parent_otp: null,
};

const Ctx = createContext<API | null>(null);

export function OnboardingProvider({
  children,
  service,
}: {
  children: React.ReactNode;
  service?: OnboardingService;
}) {
  const svc = useMemo(() => service ?? new HttpOnboardingService(), [service]);
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<OnboardingValues>(defaultValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [parentVerified, setParentVerified] = useState(false);
  const [gradeLocked, setGradeLocked] = useState(false);
  const [allowDismiss, setAllowDismiss] = useState(false);
  const [afterSave, setAfterSave] = useState<'dashboard' | 'stay'>('dashboard');
  // reserved for future cancellation support
  // const abortRef = useRef<AbortController | null>(null);

  const hydrate = useCallback(async () => {
    if (!session?.user?.email) return;
    setLoading(true);
    try {
      const profile: OnboardingProfile | null = await svc.loadProfile();
      if (profile) {
        const pParentVerified = !!(profile as any)?.parentPhoneVerifiedAt;
        const pGradeLocked = !!profile.grade;
        setValues({
          name: profile.name || '',
          age: (profile as any).age ?? null,
          class_grade: profile.grade ?? null,
          board: profile.board ?? null,
          preferred_language: profile.language ?? null,
          subjects: profile.subjects ?? undefined,
          parent_email: profile.parentEmail ?? null,
          parent_phone: (profile as any).parentPhone ?? null,
          parent_otp: null,
        });
        setParentVerified(pParentVerified);
        setGradeLocked(pGradeLocked);
        logger.info('onboarding.hydrate', { hasProfile: true });

        // Onboarding Gate:
        // Trigger modal when any of the core profile fields are missing
        // (board, grade, language, subjects) OR when firstLogin is true.
        const profileWithFirstLogin = profile as typeof profile & { firstLogin?: boolean };
        const ageNum = (profile as any).age;
        const isMinorByDpdpAge =
          ageNum != null && Number(ageNum) >= 1 && Number(ageNum) < DPDP_MINOR_AGE;
        const needsParentEmail = isMinorByDpdpAge && !(profile as any).parentEmail?.trim?.();
        const needsProfile =
          !profile.board ||
          !profile.grade ||
          !profile.language ||
          (profile as any).age == null ||
          !profile.subjects ||
          profile.subjects.length === 0 ||
          needsParentEmail;
        const isFirstLogin = profileWithFirstLogin.firstLogin === true;

        const needsParentVerification =
          (profile as any)?.accountStatus === 'pending_parent_verification';

        if (needsProfile || isFirstLogin || needsParentVerification) {
          setIsOpen(true);
          logger.info('onboarding.open.auto', {
            reason: needsParentVerification
              ? 'parent-verification'
              : needsProfile
                ? 'incomplete-profile'
                : 'first-login',
          });
        }
      }
    } catch (e) {
      logger.warn(`OnboardingProvider hydrate error: ${String(e)}`);
    } finally {
      setLoading(false);
    }
  }, [session, svc]);

  // Auto-hydrate on fresh login to decide showing the modal
  React.useEffect(() => {
    if (session?.user?.email) {
      // Only hydrate when not already open to avoid flicker
      if (!isOpen) {
        hydrate();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.email]);

  const open = useCallback(
    async (opts?: {
      force?: boolean;
      allowDismiss?: boolean;
      afterSave?: 'dashboard' | 'stay';
    }) => {
      const force = opts?.force === true;
      const isMinorByDpdpAge =
        values.age != null && Number(values.age) >= 1 && Number(values.age) < DPDP_MINOR_AGE;
      const needsParentEmail = isMinorByDpdpAge && !values.parent_email?.trim?.();
      const shouldHydrate =
        force ||
        !values.name ||
        !values.preferred_language ||
        !values.class_grade ||
        !values.board ||
        values.age == null ||
        !values.subjects ||
        values.subjects.length === 0 ||
        needsParentEmail;

      if (shouldHydrate) {
        await hydrate();
      }
      setAllowDismiss(!!opts?.allowDismiss);
      setAfterSave(opts?.afterSave ?? 'dashboard');
      setIsOpen(true);
      logger.info('onboarding.open.manual', {
        force,
        allowDismiss: !!opts?.allowDismiss,
        afterSave: opts?.afterSave ?? 'dashboard',
      });
    },
    [hydrate, values]
  );

  // Profile is required (non-dismissable) when core fields are missing
  const isMinorByDpdpAge =
    values.age != null && Number(values.age) >= 1 && Number(values.age) < DPDP_MINOR_AGE;
  const needsParentEmail = isMinorByDpdpAge && !values.parent_email?.trim?.();
  const needsProfileValues =
    !values.board ||
    !values.class_grade ||
    !values.preferred_language ||
    values.age == null ||
    !values.subjects ||
    values.subjects.length === 0 ||
    needsParentEmail;

  const isRequired =
    !!session?.user &&
    (needsProfileValues ||
      (values.age != null && Number(values.age) < DPDP_MINOR_AGE && !parentVerified));

  const close = useCallback(() => {
    if (isRequired && !allowDismiss) return; // Cannot dismiss when onboarding is required (unless explicitly allowed)
    setIsOpen(false);
    setAllowDismiss(false);
    setAfterSave('dashboard');
    logger.info('onboarding.close');
  }, [isRequired, allowDismiss]);

  const setValue = useCallback((field: keyof OnboardingValues, value: any) => {
    setValues((v) => ({ ...v, [field]: value }));
  }, []);

  function validate(v: OnboardingValues) {
    const errs: Record<string, string> = {};
    if (!v.name || !v.name.trim()) errs.name = 'Name is required';
    if (v.age == null || !Number.isFinite(Number(v.age)) || Number(v.age) <= 0)
      errs.age = 'Age is required';
    if (!v.class_grade || String(v.class_grade).trim() === '')
      errs.class_grade = 'Class is required';
    if (!v.board || String(v.board).trim() === '') errs.board = 'Board is required';
    if (!v.preferred_language || String(v.preferred_language).trim() === '')
      errs.preferred_language = 'Preferred language is required';
    if (!v.subjects || v.subjects.length === 0) errs.subjects = 'Select at least 1 subject';
    if (v.subjects && v.subjects.length > 6) errs.subjects = 'You can select up to 6 subjects';
    if (
      v.age != null &&
      Number(v.age) >= 1 &&
      Number(v.age) < DPDP_MINOR_AGE &&
      (!v.parent_email || !String(v.parent_email).trim() || !v.parent_email.includes('@'))
    ) {
      errs.parent_email =
        'Parent or guardian email is required for students below the DPDP minor age threshold.';
    }
    if (v.age != null && Number(v.age) < DPDP_MINOR_AGE && !parentVerified) {
      if (!v.parent_phone || !String(v.parent_phone).trim())
        errs.parent_phone = `Parent phone is required for under-${DPDP_MINOR_AGE}`;
      // OTP is verified via dedicated endpoint, but we validate presence here to block bypass.
      if (!v.parent_otp || !String(v.parent_otp).trim())
        errs.parent_otp = 'Enter OTP to verify parent phone';
    }
    return errs;
  }

  const save = useCallback(async () => {
    setSaving(true);
    setErrors({});
    try {
      const v = { ...values };
      const errs = validate(v);
      if (Object.keys(errs).length) {
        setErrors(errs);
        throw new Error('Please fill all required fields.');
      }

      // Under DPDP minor age: verify parent OTP before saving profile (cannot bypass).
      if (v.age != null && Number(v.age) < DPDP_MINOR_AGE && !parentVerified) {
        const verifyRes = await fetch('/api/auth/parent/verify-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ parentPhone: v.parent_phone, code: v.parent_otp }),
        });
        if (!verifyRes.ok) {
          const payload = await verifyRes.json().catch(() => ({}));
          setErrors((prev) => ({
            ...prev,
            parent_otp: payload?.error || 'Invalid OTP',
            _root: payload?.error || 'Parent verification failed',
          }));
          throw new Error(payload?.error || 'Parent verification failed');
        }
        setParentVerified(true);
        setValues((prev) => ({ ...prev, parent_otp: null }));
      }
      await svc.saveProfile(v);
      logger.info('onboarding.save', { hasSubjects: !!values.subjects?.length });
      setIsOpen(false);
      const next = afterSave;
      setAllowDismiss(false);
      setAfterSave('dashboard');
      if (typeof window !== 'undefined') {
        if (next === 'stay') {
          window.location.reload();
        } else {
          window.location.replace('/dashboard');
        }
      }
    } catch (e: any) {
      if (e && typeof e === 'object' && e.fieldErrors && typeof e.fieldErrors === 'object') {
        setErrors((prev) => ({
          ...prev,
          ...e.fieldErrors,
          _root: e?.message || 'Failed to save profile',
        }));
      } else {
        setErrors((prev) => ({ ...prev, _root: e?.message || 'Failed to save profile' }));
      }
      logger.warn('onboarding.save.error', { message: e?.message });
    } finally {
      setSaving(false);
    }
  }, [svc, values, afterSave]);

  const api: API = {
    isOpen,
    isRequired,
    loading,
    saving,
    values,
    errors,
    parentVerified,
    gradeLocked,
    allowDismiss,
    open,
    close,
    setValue,
    save,
  };

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useOnboarding() {
  const ctx = useContext(Ctx);

  // During SSG/SSR, context might be null - return safe defaults
  if (!ctx) {
    // Check if we're in a browser environment
    if (typeof window === 'undefined') {
      return {
        isOpen: false,
        loading: false,
        saving: false,
        values: defaultValues,
        errors: {},
        isRequired: false,
        open: () => {},
        close: () => {},
        setValue: () => {},
        save: async () => {},
      };
    }
    throw new Error('useOnboarding must be used within OnboardingProvider');
  }

  return ctx;
}
