import { onRequest } from '@cloudflare/pages-functions';
import { getAuthContext } from '../../lib/auth/middleware';
import { deleteApiKey } from '../../lib/auth';

export const onRequestDelete: PagesFunction = async (context) => {
  const { request, env, params } = context;
  
  try {
    const authContext = await getAuthContext(request, env);
    
    if (!authContext.user) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const keyId = params.id as string;
    
    if (!keyId) {
      return new Response(JSON.stringify({ error: 'Key ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const deleted = await deleteApiKey(env.spreadsheet_health_checker, authContext.user.id, keyId);
    
    if (!deleted) {
      return new Response(JSON.stringify({ error: 'API key not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Delete API key error:', error);
    return new Response(JSON.stringify({ error: 'Failed to delete API key' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};