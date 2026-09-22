import { onRequest } from '@cloudflare/pages-functions';
import { deleteSession } from '../../lib/auth';

export const onRequestPost: PagesFunction = async (context) => {
  const { request, env } = context;
  
  try {
    const cookieHeader = request.headers.get('Cookie');
    const sessionId = cookieHeader?.match(/session=([^;]+)/)?.[1];
    
    if (sessionId) {
      await deleteSession(env.spreadsheet_health_checker, sessionId);
    }
    
    const cookie = 'session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';
    
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': cookie,
      },
    });
  } catch (error) {
    console.error('Logout error:', error);
    return new Response(JSON.stringify({ error: 'Logout failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};