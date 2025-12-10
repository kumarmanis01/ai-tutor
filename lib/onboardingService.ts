import { logger } from '@/lib/logger';

export type OnboardingValues = {
  name: string;
  class_grade: string | null;
  board: string | null;
  preferred_language: string | null;
  subjects: string[] | undefined;
};

export type OnboardingProfile = {
  name?: string;
  grade?: string;
  board?: string;
  language?: string;
  subjects?: string[];
};

export interface OnboardingService {
  loadProfile(): Promise<OnboardingProfile | null>;
  saveProfile(values: OnboardingValues): Promise<void>;
}

export class HttpOnboardingService implements OnboardingService {
  async loadProfile(): Promise<OnboardingProfile | null> {
    try {
      const res = await fetch('/api/user/profile');
      if (!res.ok) return null;
      const data = await res.json();
      return data as OnboardingProfile;
    } catch (e) {
      logger.warn(`OnboardingService.loadProfile error: ${String(e)}`, { className: 'OnboardingService' });
      return null;
    }
  }

  async saveProfile(values: OnboardingValues): Promise<void> {
    const res = await fetch('/api/user/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j?.error || 'Failed to save profile');
    }
  }
}
