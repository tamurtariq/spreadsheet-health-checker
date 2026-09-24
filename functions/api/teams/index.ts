import { onRequest } from '@cloudflare/pages-functions';
import { getAuthContext } from '../../lib/auth/middleware';
import { getUserTeam, getTeamMembers, inviteTeamMember } from '../../lib/auth';

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
    
    const userTeam = await getUserTeam(env.spreadsheet_health_checker, authContext.user.id);
    
    if (!userTeam) {
      return new Response(JSON.stringify({ team: null, members: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const members = await getTeamMembers(env.spreadsheet_health_checker, userTeam.teamId);
    
    return new Response(JSON.stringify({
      team: { id: userTeam.teamId, role: userTeam.role },
      members,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Get team error:', error);
    return new Response(JSON.stringify({ error: 'Failed to get team' }), {
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
    
    const userTeam = await getUserTeam(env.spreadsheet_health_checker, authContext.user.id);
    
    if (!userTeam || userTeam.role !== 'owner' && userTeam.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Only team owners and admins can invite members' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const { email, role = 'member' } = await request.json() as {
      email: string;
      role?: 'admin' | 'member';
    };
    
    if (!email || !email.includes('@')) {
      return new Response(JSON.stringify({ error: 'Valid email required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const member = await inviteTeamMember(env.spreadsheet_health_checker, userTeam.teamId, email, role, authContext.user.id);
    
    // TODO: Send invitation email
    
    return new Response(JSON.stringify({
      id: member.id,
      teamId: member.teamId,
      email: member.email,
      role: member.role,
      status: member.status,
      invitedAt: member.invitedAt,
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Invite team member error:', error);
    const message = error instanceof Error ? error.message : 'Failed to invite member';
    return new Response(JSON.stringify({ error: message }), {
      status: error instanceof Error && message === 'Member already invited or part of team' ? 409 : 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};