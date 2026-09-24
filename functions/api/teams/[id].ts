import { onRequest } from '@cloudflare/pages-functions';
import { getAuthContext } from '../../lib/auth/middleware';
import { getUserTeam, removeTeamMember, updateMemberRole } from '../../lib/auth';

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
    
    const userTeam = await getUserTeam(env.spreadsheet_health_checker, authContext.user.id);
    
    if (!userTeam || userTeam.role !== 'owner') {
      return new Response(JSON.stringify({ error: 'Only team owners can remove members' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const memberId = params.id as string;
    
    if (!memberId) {
      return new Response(JSON.stringify({ error: 'Member ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const removed = await removeTeamMember(env.spreadsheet_health_checker, userTeam.teamId, memberId);
    
    if (!removed) {
      return new Response(JSON.stringify({ error: 'Member not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Remove team member error:', error);
    return new Response(JSON.stringify({ error: 'Failed to remove member' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const onRequestPatch: PagesFunction = async (context) => {
  const { request, env, params } = context;
  
  try {
    const authContext = await getAuthContext(request, env);
    
    if (!authContext.user) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const userTeam = await getUserTeam(env.spreadsheet_health_checker, authContext.user.id);
    
    if (!userTeam || userTeam.role !== 'owner') {
      return new Response(JSON.stringify({ error: 'Only team owners can change roles' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const memberId = params.id as string;
    const { role } = await request.json() as { role: 'admin' | 'member' };
    
    if (!memberId) {
      return new Response(JSON.stringify({ error: 'Member ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    if (!['admin', 'member'].includes(role)) {
      return new Response(JSON.stringify({ error: 'Invalid role' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const updated = await updateMemberRole(env.spreadsheet_health_checker, userTeam.teamId, memberId, role);
    
    if (!updated) {
      return new Response(JSON.stringify({ error: 'Member not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Update member role error:', error);
    return new Response(JSON.stringify({ error: 'Failed to update role' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};