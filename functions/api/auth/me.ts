import { onRequest } from '@cloudflare/pages-functions';
import { getSession, getUserById, getSubscription, getScanCounter, getTierLimits } from '../../lib/auth';

export const onRequestGet: PagesFunction = async (context) => {
  const { request, env } = context;
  
  try {
    const cookieHeader = request.headers.get('Cookie');
    const sessionId = cookieHeader?.match(/session=([^;]+)/)?.[1];
    
    if (!sessionId) {
      return new Response(JSON.stringify({ user: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const session = await getSession(env.spreadsheet_health_checker, sessionId);
    
    if (!session) {
      const cookie = 'session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';
      return new Response(JSON.stringify({ user: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Set-Cookie': cookie },
      });
    }
    
    const user = await getUserById(env.spreadsheet_health_checker, session.userId);
    const subscription = await getSubscription(env.spreadsheet_health_checker, session.userId);
    const scanCounter = await getScanCounter(env.spreadsheet_health_checker, session.userId);
    const tier = subscription?.tier || 'free';
    const limits = getTierLimits(tier);
    const remainingScans = limits.scansPerMonth === -1 ? -1 : Math.max(0, limits.scansPerMonth - scanCounter.count);
    
    return new Response(JSON.stringify({
      user: user ? {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt,
      } : null,
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
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Me error:', error);
    return new Response(JSON.stringify({ error: 'Failed to get user' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};