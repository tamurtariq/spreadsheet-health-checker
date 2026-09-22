import { onRequest } from '@cloudflare/pages-functions';
import { verifyMagicLink, getUserByEmail, createSession } from '../../lib/auth';

export const onRequestGet: PagesFunction = async (context) => {
  const { request, env } = context;
  
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get('token');
    
    if (!token) {
      return new Response('Invalid magic link', { status: 400 });
    }
    
    const magicLink = await verifyMagicLink(env.spreadsheet_health_checker, token);
    
    if (!magicLink) {
      return new Response('Invalid or expired magic link', { status: 400 });
    }
    
    const user = await getUserByEmail(env.spreadsheet_health_checker, magicLink.email);
    
    if (!user) {
      return new Response('User not found', { status: 404 });
    }
    
    const session = await createSession(env.spreadsheet_health_checker, user.id);
    
    const cookie = `session=${session.id}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`;
    
    return new Response(null, {
      status: 302,
      headers: {
        'Set-Cookie': cookie,
        'Location': '/dashboard',
      },
    });
  } catch (error) {
    console.error('Verify magic link error:', error);
    return new Response('Authentication failed', { status: 500 });
  }
};