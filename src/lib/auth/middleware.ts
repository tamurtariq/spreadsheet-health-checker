import { getSession, getUserById, getSubscription, getScanCounter, getTierLimits } from '../auth';

export interface AuthContext {
  user: {
    id: string;
    email: string;
    createdAt: number;
  } | null;
  subscription: {
    tier: 'free' | 'pro' | 'team';
    status: string;
    currentPeriodEnd?: number;
  } | null;
  usage: {
    scansUsed: number;
    scansRemaining: number;
    scansLimit: number;
  } | null;
  limits: ReturnType<typeof getTierLimits>;
}

export async function getAuthContext(request: Request, env: any): Promise<AuthContext> {
  const cookieHeader = request.headers.get('Cookie');
  const sessionId = cookieHeader?.match(/session=([^;]+)/)?.[1];
  
  if (!sessionId) {
    return {
      user: null,
      subscription: null,
      usage: null,
      limits: getTierLimits('free'),
    };
  }
  
  const session = await getSession(env.spreadsheet_health_checker, sessionId);
  
  if (!session) {
    return {
      user: null,
      subscription: null,
      usage: null,
      limits: getTierLimits('free'),
    };
  }
  
  const user = await getUserById(env.spreadsheet_health_checker, session.userId);
  const subscription = await getSubscription(env.spreadsheet_health_checker, session.userId);
  const scanCounter = await getScanCounter(env.spreadsheet_health_checker, session.userId);
  const tier = subscription?.tier || 'free';
  const limits = getTierLimits(tier);
  const remainingScans = limits.scansPerMonth === -1 ? -1 : Math.max(0, limits.scansPerMonth - scanCounter.count);
  
  return {
    user: user ? { id: user.id, email: user.email, createdAt: user.createdAt } : null,
    subscription: subscription ? {
      tier: subscription.tier,
      status: subscription.status,
      currentPeriodEnd: subscription.currentPeriodEnd,
    } : { tier: 'free', status: 'active' },
    usage: {
      scansUsed: scanCounter.count,
      scansRemaining: remainingScans,
      scansLimit: limits.scansPerMonth,
    },
    limits,
  };
}

export function requireAuth(context: AuthContext) {
  if (!context.user) {
    throw new Error('UNAUTHORIZED');
  }
  return context;
}

export function requireTier(context: AuthContext, allowedTiers: ('free' | 'pro' | 'team')[]) {
  requireAuth(context);
  if (!allowedTiers.includes(context.subscription?.tier || 'free')) {
    throw new Error('FORBIDDEN');
  }
  return context;
}