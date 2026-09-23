import { onRequest } from '@cloudflare/pages-functions';
import { getSession, getUserById, getSubscription, getScanCounter } from '../../lib/auth';
import { createEmailService } from '../../lib/email';

export const onRequestPost: PagesFunction = async (context) => {
  const { request, env } = context;
  
  try {
    // Verify cron secret or admin token
    const authHeader = request.headers.get('Authorization');
    const cronSecret = env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // For manual testing, allow session-based auth
    let userId: string | null = null;
    if (!cronSecret) {
      const cookieHeader = request.headers.get('Cookie');
      const sessionId = cookieHeader?.match(/session=([^;]+)/)?.[1];
      
      if (sessionId) {
        const session = await getSession(env.spreadsheet_health_checker, sessionId);
        if (session) userId = session.userId;
      }
    }
    
    if (!userId) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const user = await getUserById(env.spreadsheet_health_checker, userId);
    const subscription = await getSubscription(env.spreadsheet_health_checker, userId);
    const scanCounter = await getScanCounter(env.spreadsheet_health_checker, userId);
    
    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const tier = subscription?.tier || 'free';
    const scansLimit = tier === 'free' ? 3 : -1;
    const remainingScans = scansLimit === -1 ? -1 : Math.max(0, scansLimit - scanCounter.count);
    
    // In a real app, you'd fetch recent findings from a findings table
    // For now, we'll use placeholder data
    const digestData = {
      userName: user.email.split('@')[0],
      userEmail: user.email,
      scansThisWeek: Math.min(scanCounter.count, 10), // Simplified
      scansThisMonth: scanCounter.count,
      remainingScans,
      tier,
      recentFindings: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
      },
      topIssues: [] as Array<{ title: string; severity: string; fileName: string }>,
      unsubscribeUrl: `${new URL(request.url).origin}/unsubscribe?email=${encodeURIComponent(user.email)}`,
      dashboardUrl: `${new URL(request.url).origin}/dashboard`,
    };
    
    const emailService = createEmailService({
      RESEND_API_KEY: env.RESEND_API_KEY,
      FROM_EMAIL: env.FROM_EMAIL || 'digest@spreadsheethealthchecker.com',
      FROM_NAME: env.FROM_NAME || 'Spreadsheet Health Checker',
    });
    
    const result = await emailService.sendWeeklyDigest(digestData);
    
    if (!result.success) {
      return new Response(JSON.stringify({ error: result.error }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    return new Response(JSON.stringify({ success: true, sentTo: user.email }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Digest send error:', error);
    return new Response(JSON.stringify({ error: 'Failed to send digest' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};