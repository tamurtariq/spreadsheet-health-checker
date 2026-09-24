import { useEffect, useState } from 'react';

export interface TierLimits {
  scansPerMonth: number;
  maxFileSizeMB: number;
  diffChecker: boolean;
  pdfExport: boolean;
  seats: number;
}

export interface AuthUser {
  id: string;
  email: string;
  createdAt: number;
}

export interface AuthSubscription {
  tier: 'free' | 'pro' | 'team';
  status: string;
  currentPeriodEnd?: number;
}

export interface AuthContextState {
  /**
   * True until the first /api/auth/me response arrives. React effects never
   * run during SSR, so consumers rendered server-side always see this initial
   * (loading, free-tier-default) state rather than undefined limits - this is
   * what makes it safe for a component to read `limits.*` unconditionally.
   */
  loading: boolean;
  user: AuthUser | null;
  subscription: AuthSubscription;
  limits: TierLimits;
  scansUsed: number;
  scansRemaining: number;
}

const FREE_TIER_LIMITS: TierLimits = {
  scansPerMonth: 3,
  maxFileSizeMB: 5,
  diffChecker: false,
  pdfExport: false,
  seats: 1,
};

const INITIAL_STATE: AuthContextState = {
  loading: true,
  user: null,
  subscription: { tier: 'free', status: 'active' },
  limits: FREE_TIER_LIMITS,
  scansUsed: 0,
  scansRemaining: FREE_TIER_LIMITS.scansPerMonth,
};

/**
 * Fetches the signed-in user's real subscription/limits/usage from
 * /api/auth/me on mount. Until that resolves (including during SSR, where
 * effects don't run at all), returns safe free-tier defaults instead of
 * undefined - components should show their normal "free tier" UI while
 * `loading` is true rather than a spinner, since that's what most visitors
 * (anonymous or free) will actually see.
 */
export function useAuthContext(): AuthContextState {
  const [state, setState] = useState<AuthContextState>(INITIAL_STATE);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/auth/me', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (cancelled) return;
        setState({
          loading: false,
          user: data.user,
          subscription: data.subscription,
          limits: data.limits,
          scansUsed: data.usage.scansUsed,
          scansRemaining: data.usage.scansRemaining,
        });
      })
      .catch(err => {
        console.error('Failed to load auth context:', err);
        if (cancelled) return;
        setState(prev => ({ ...prev, loading: false }));
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
