import { onRequest } from '@cloudflare/pages-functions';
import { getSession, getUserById, getSubscription, canScan, incrementScanCounter } from '../../lib/auth';

export const onRequestPost: PagesFunction = async (context) => {
  const { request, env } = context;
  
  try {
    const cookieHeader = request.headers.get('Cookie');
    const sessionId = cookieHeader?.match(/session=([^;]+)/)?.[1];
    
    if (!sessionId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const session = await getSession(env.spreadsheet_health_checker, sessionId);
    
    if (!session) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const subscription = await getSubscription(env.spreadsheet_health_checker, session.userId);
    const allowed = await canScan(env.spreadsheet_health_checker, session.userId, subscription);
    
    if (!allowed) {
      return new Response(JSON.stringify({ error: 'Scan limit exceeded. Upgrade to Pro for unlimited scans.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    await incrementScanCounter(env.spreadsheet_health_checker, session.userId);
    
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Track scan error:', error);
    return new Response(JSON.stringify({ error: 'Failed to track scan' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};