export const OPEN_ONBOARDING_EVENT = 'open-onboarding';

export function openOnboarding() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(OPEN_ONBOARDING_EVENT));
}
