import { onRequest } from '@cloudflare/pages-functions';
import { getAuthContext } from '../../lib/auth/middleware';
import { createApiKey, listApiKeys, deleteApiKey } from '../../lib/auth';

export const onRequestGet: PagesFunction = async (context) => {
  const { request, env } = context;
  
  try {
    const authContext = await getAuthContext(request, env);
    
    if (!authContext.user) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const keys = await listApiKeys(env.spreadsheet_health_checker, authContext.user.id);
    
    return new Response(JSON.stringify({ keys }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('List API keys error:', error);
    return new Response(JSON.stringify({ error: 'Failed to list API keys' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const onRequestPost: PagesFunction = async (context) => {
  const { request, env } = context;
  
  try {
    const authContext = await getAuthContext(request, env);
    
    if (!authContext.user) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const { name, rateLimit = 100, expiresInDays } = await request.json() as {
      name: string;
      rateLimit?: number;
      expiresInDays?: number;
    };
    
    if (!name || name.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Key name is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const result = await createApiKey(env.spreadsheet_health_checker, authContext.user.id, name.trim(), rateLimit, expiresInDays);
    
    return new Response(JSON.stringify({
      id: result.apiKey.id,
      name: result.apiKey.name,
      prefix: result.apiKey.prefix,
      rateLimit: result.apiKey.rateLimit,
      expiresAt: result.apiKey.expiresAt,
      createdAt: result.apiKey.createdAt,
      key: result.rawKey,
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Create API key error:', error);
    return new Response(JSON.stringify({ error: 'Failed to create API key' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};