import { useEffect, useState } from 'react';

/**
 * Returns true when onboarding should be visible.
 * Primary control is NEXT_PUBLIC_ENABLE_PROPERTY_ONBOARDING=true.
 * Also supports query/localStorage overrides for easy toggling in dev:
 *   - ?onboarding=1 or ?enableOnboarding=1
 *   - localStorage.setItem('enablePropertyOnboarding', 'true')
 */
export function useOnboardingFlag(): boolean {
  const envEnabled = process.env.NEXT_PUBLIC_ENABLE_PROPERTY_ONBOARDING === 'true';
  const [enabled, setEnabled] = useState<boolean>(envEnabled);

  useEffect(() => {
    const search =
      typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search || '')
        : null;
    const queryEnabled =
      (search?.get('onboarding') === '1' || search?.get('enableOnboarding') === '1') ?? false;
    const lsEnabled =
      typeof window !== 'undefined'
        ? window.localStorage.getItem('enablePropertyOnboarding') === 'true'
        : false;
    setEnabled(envEnabled || queryEnabled || lsEnabled);
  }, [envEnabled]);

  return enabled;
}
