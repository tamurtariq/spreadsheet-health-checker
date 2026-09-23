import { onRequest } from '@cloudflare/pages-functions';
import { getSession, getUserById } from '../../lib/auth';

export const onRequestGet: PagesFunction = async (context) => {
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
    
    // In a real app, you'd fetch from a preferences table
    // For now, return defaults
    return new Response(JSON.stringify({
      prefs: {
        digestEnabled: true,
        includeFindings: true,
        includeTopIssues: true,
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Get prefs error:', error);
    return new Response(JSON.stringify({ error: 'Failed to get preferences' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

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
    
    const { digestEnabled, includeFindings, includeTopIssues } = await request.json() as {
      digestEnabled: boolean;
      includeFindings: boolean;
      includeTopIssues: boolean;
    };
    
    // In a real app, you'd save to a preferences table
    // For now, just acknowledge
    
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Save prefs error:', error);
    return new Response(JSON.stringify({ error: 'Failed to save preferences' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};