import { onRequest } from '@cloudflare/pages-functions';
import { createMagicLink, getUserByEmail, createUser } from '../../lib/auth';

export const onRequestPost: PagesFunction = async (context) => {
  const { request, env } = context;
  
  try {
    const { email } = await request.json() as { email?: string };
    
    if (!email || !email.includes('@')) {
      return new Response(JSON.stringify({ error: 'Valid email required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const normalizedEmail = email.toLowerCase().trim();
    
    let user = await getUserByEmail(env.spreadsheet_health_checker, normalizedEmail);
    
    if (!user) {
      user = await createUser(env.spreadsheet_health_checker, normalizedEmail);
    }
    
    const magicLink = await createMagicLink(env.spreadsheet_health_checker, normalizedEmail);
    
    const loginUrl = `${new URL(request.url).origin}/auth/verify?token=${magicLink.token}`;
    
    console.log(`Magic link for ${normalizedEmail}: ${loginUrl}`);
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Magic link sent',
      devLoginUrl: loginUrl,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Magic link error:', error);
    return new Response(JSON.stringify({ error: 'Failed to create magic link' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};