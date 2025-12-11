"use client";
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { HttpOnboardingService, OnboardingProfile, OnboardingService, OnboardingValues } from '@/lib/onboardingService';
import { logger } from '@/lib/logger';

type State = {
  isOpen: boolean;
  loading: boolean;
  saving: boolean;
  values: OnboardingValues;
  errors: Record<string, string>;
};

type API = {
  open: (opts?: { force?: boolean }) => Promise<void> | void;
  close: () => void;
  setValue: (field: keyof OnboardingValues, value: any) => void;
  save: () => Promise<void>;
} & State;

const defaultValues: OnboardingValues = {
  name: '',
  class_grade: null,
  board: null,
  preferred_language: null,
  subjects: undefined,
};

const Ctx = createContext<API | null>(null);

export function OnboardingProvider({ children, service }: { children: React.ReactNode; service?: OnboardingService }) {
  const svc = useMemo(() => service ?? new HttpOnboardingService(), [service]);
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<OnboardingValues>(defaultValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  // reserved for future cancellation support
  // const abortRef = useRef<AbortController | null>(null);

  const hydrate = useCallback(async () => {
    if (!session?.user?.email) return;
    setLoading(true);
    try {
      const profile: OnboardingProfile | null = await svc.loadProfile();
      if (profile) {
        setValues({
          name: profile.name || '',
          class_grade: profile.grade ?? null,
          board: profile.board ?? null,
          preferred_language: profile.language ?? null,
          subjects: profile.subjects ?? undefined,
        });
        logger.info('onboarding.hydrate', { hasProfile: true });
        const complete = !!profile.name && !!profile.language && !!profile.grade && !!profile.board;
        const seen = typeof window !== 'undefined' ? window.sessionStorage.getItem('spinzy:onboarding_shown') : null;
        if (!complete && !seen) {
          setIsOpen(true);
          logger.info('onboarding.open.auto', { reason: 'incomplete-profile' });
          try { window.sessionStorage.setItem('spinzy:onboarding_shown', '1'); } catch {}
        }
      }
    } catch (e) {
      logger.warn(`OnboardingProvider hydrate error: ${String(e)}`);
    } finally {
      setLoading(false);
    }
  }, [session, svc]);

  const open = useCallback(async () => {
    if (!values.name && !values.preferred_language && !values.class_grade && !values.board) {
      await hydrate();
    }
    setIsOpen(true);
    logger.info('onboarding.open.manual');
  }, [hydrate, values]);

  const close = useCallback(() => {
    setIsOpen(false);
    logger.info('onboarding.close');
  }, []);

  const setValue = useCallback((field: keyof OnboardingValues, value: any) => {
    setValues((v) => ({ ...v, [field]: value }));
  }, []);

  function validate(v: OnboardingValues) {
    const errs: Record<string, string> = {};
    if (!v.name || !v.name.trim()) errs.name = 'Name is required';
    if (!v.class_grade || String(v.class_grade).trim() === '') errs.class_grade = 'Class is required';
    if (!v.board || String(v.board).trim() === '') errs.board = 'Board is required';
    if (!v.preferred_language || String(v.preferred_language).trim() === '') errs.preferred_language = 'Preferred language is required';
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
      await svc.saveProfile(v);
      logger.info('onboarding.save', { hasSubjects: !!values.subjects?.length });
      setIsOpen(false);
      if (typeof window !== 'undefined') window.location.replace('/dashboard');
    } catch (e: any) {
      if (e && typeof e === 'object' && e.fieldErrors && typeof e.fieldErrors === 'object') {
        setErrors((prev) => ({ ...prev, ...e.fieldErrors, _root: e?.message || 'Failed to save profile' }));
      } else {
        setErrors((prev) => ({ ...prev, _root: e?.message || 'Failed to save profile' }));
      }
      logger.warn('onboarding.save.error', { message: e?.message });
    } finally {
      setSaving(false);
    }
  }, [svc, values]);

  const api: API = {
    isOpen,
    loading,
    saving,
    values,
    errors,
    open,
    close,
    setValue,
    save,
  };

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useOnboarding() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useOnboarding must be used within OnboardingProvider');
  return ctx;
}
