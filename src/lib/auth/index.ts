import { D1Database } from '@cloudflare/workers-types';

export interface User {
  id: string;
  email: string;
  createdAt: number;
}

export interface Session {
  id: string;
  userId: string;
  expiresAt: number;
  createdAt: number;
}

export interface Subscription {
  id: string;
  userId: string;
  lemonSqueezyId?: string;
  status: string;
  tier: 'free' | 'pro' | 'team';
  currentPeriodEnd?: number;
  createdAt: number;
  updatedAt: number;
}

export interface ScanCounter {
  userId: string;
  count: number;
  periodStart: number;
}

export interface MagicLink {
  token: string;
  email: string;
  expiresAt: number;
  createdAt: number;
}

const SESSION_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days
const MAGIC_LINK_DURATION = 15 * 60 * 1000; // 15 minutes
const FREE_SCANS_PER_MONTH = 3;

function generateId(): string {
  return crypto.randomUUID();
}

function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

export async function createUser(db: D1Database, email: string): Promise<User> {
  const id = generateId();
  const now = Date.now();
  
  await db.prepare(
    'INSERT INTO users (id, email, created_at) VALUES (?, ?, ?)'
  ).bind(id, email.toLowerCase(), now).run();
  
  return { id, email: email.toLowerCase(), createdAt: now };
}

export async function getUserByEmail(db: D1Database, email: string): Promise<User | null> {
  const result = await db.prepare(
    'SELECT id, email, created_at as createdAt FROM users WHERE email = ?'
  ).bind(email.toLowerCase()).first();
  
  return result ? { id: result.id, email: result.email, createdAt: result.createdAt } : null;
}

export async function getUserById(db: D1Database, id: string): Promise<User | null> {
  const result = await db.prepare(
    'SELECT id, email, created_at as createdAt FROM users WHERE id = ?'
  ).bind(id).first();
  
  return result ? { id: result.id, email: result.email, createdAt: result.createdAt } : null;
}

export async function createSession(db: D1Database, userId: string): Promise<Session> {
  const id = generateId();
  const now = Date.now();
  const expiresAt = now + SESSION_DURATION;
  
  await db.prepare(
    'INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)'
  ).bind(id, userId, expiresAt, now).run();
  
  return { id, userId, expiresAt, createdAt: now };
}

export async function getSession(db: D1Database, sessionId: string): Promise<Session | null> {
  const result = await db.prepare(
    'SELECT id, user_id as userId, expires_at as expiresAt, created_at as createdAt FROM sessions WHERE id = ? AND expires_at > ?'
  ).bind(sessionId, Date.now()).first();
  
  return result ? { id: result.id, userId: result.userId, expiresAt: result.expiresAt, createdAt: result.createdAt } : null;
}

export async function deleteSession(db: D1Database, sessionId: string): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
}

export async function deleteExpiredSessions(db: D1Database): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(Date.now()).run();
}

export async function createMagicLink(db: D1Database, email: string): Promise<MagicLink> {
  const token = generateToken();
  const now = Date.now();
  const expiresAt = now + MAGIC_LINK_DURATION;
  
  await db.prepare(
    'INSERT INTO magic_links (token, email, expires_at, created_at) VALUES (?, ?, ?, ?)'
  ).bind(token, email.toLowerCase(), expiresAt, now).run();
  
  return { token, email: email.toLowerCase(), expiresAt, createdAt: now };
}

export async function verifyMagicLink(db: D1Database, token: string): Promise<MagicLink | null> {
  const result = await db.prepare(
    'SELECT token, email, expires_at as expiresAt, created_at as createdAt FROM magic_links WHERE token = ? AND expires_at > ?'
  ).bind(token, Date.now()).first();
  
  if (!result) return null;
  
  await db.prepare('DELETE FROM magic_links WHERE token = ?').bind(token).run();
  
  return { token: result.token, email: result.email, expiresAt: result.expiresAt, createdAt: result.createdAt };
}

export async function deleteExpiredMagicLinks(db: D1Database): Promise<void> {
  await db.prepare('DELETE FROM magic_links WHERE expires_at <= ?').bind(Date.now()).run();
}

export async function getSubscription(db: D1Database, userId: string): Promise<Subscription | null> {
  const result = await db.prepare(
    `SELECT id, user_id as userId, lemon_squeezy_id as lemonSqueezyId, status, tier, 
            current_period_end as currentPeriodEnd, created_at as createdAt, updated_at as updatedAt
     FROM subscriptions WHERE user_id = ?`
  ).bind(userId).first();
  
  if (!result) return null;
  
  return {
    id: result.id,
    userId: result.userId,
    lemonSqueezyId: result.lemonSqueezyId,
    status: result.status,
    tier: result.tier,
    currentPeriodEnd: result.currentPeriodEnd,
    createdAt: result.createdAt,
    updatedAt: result.updatedAt,
  };
}

export async function createOrUpdateSubscription(
  db: D1Database,
  userId: string,
  data: { lemonSqueezyId?: string; status: string; tier: 'free' | 'pro' | 'team'; currentPeriodEnd?: number }
): Promise<Subscription> {
  const now = Date.now();
  const existing = await getSubscription(db, userId);
  
  if (existing) {
    await db.prepare(
      `UPDATE subscriptions SET lemon_squeezy_id = ?, status = ?, tier = ?, 
       current_period_end = ?, updated_at = ? WHERE id = ?`
    ).bind(data.lemonSqueezyId || null, data.status, data.tier, data.currentPeriodEnd || null, now, existing.id).run();
    
    return { ...existing, ...data, updatedAt: now };
  } else {
    const id = generateId();
    await db.prepare(
      `INSERT INTO subscriptions (id, user_id, lemon_squeezy_id, status, tier, current_period_end, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, userId, data.lemonSqueezyId || null, data.status, data.tier, data.currentPeriodEnd || null, now, now).run();
    
    return { id, userId, ...data, createdAt: now, updatedAt: now };
  }
}

export async function getScanCounter(db: D1Database, userId: string): Promise<ScanCounter> {
  const now = Date.now();
  const monthStart = new Date(now).setDate(1); // First day of current month
  
  const result = await db.prepare(
    'SELECT user_id as userId, count, period_start as periodStart FROM scan_counters WHERE user_id = ? AND period_start = ?'
  ).bind(userId, monthStart).first();
  
  if (result) {
    return { userId: result.userId, count: result.count, periodStart: result.periodStart };
  }
  
  return { userId, count: 0, periodStart: monthStart };
}

export async function incrementScanCounter(db: D1Database, userId: string): Promise<ScanCounter> {
  const counter = await getScanCounter(db, userId);
  const newCount = counter.count + 1;
  
  await db.prepare(
    `INSERT INTO scan_counters (user_id, count, period_start) VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET count = ?`
  ).bind(userId, newCount, counter.periodStart, newCount).run();
  
  return { userId, count: newCount, periodStart: counter.periodStart };
}

export async function getRemainingScans(db: D1Database, userId: string, subscription?: Subscription | null): Promise<number> {
  if (!subscription || subscription.tier === 'free') {
    const counter = await getScanCounter(db, userId);
    return Math.max(0, FREE_SCANS_PER_MONTH - counter.count);
  }
  return -1; // Unlimited
}

export async function canScan(db: D1Database, userId: string, subscription?: Subscription | null): Promise<boolean> {
  const remaining = await getRemainingScans(db, userId, subscription);
  return remaining === -1 || remaining > 0;
}

export function getTierLimits(tier: 'free' | 'pro' | 'team') {
  return {
    free: { scansPerMonth: 3, maxFileSizeMB: 5, diffChecker: false, pdfExport: false, seats: 1 },
    pro: { scansPerMonth: -1, maxFileSizeMB: 50, diffChecker: true, pdfExport: true, seats: 1 },
    team: { scansPerMonth: -1, maxFileSizeMB: 50, diffChecker: true, pdfExport: true, seats: 5 },
  }[tier];
}

export interface ApiKey {
  id: string;
  userId: string;
  name: string;
  prefix: string;
  rateLimit: number;
  lastUsedAt?: number;
  expiresAt?: number;
  createdAt: number;
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  email: string;
  role: 'owner' | 'admin' | 'member';
  status: 'pending' | 'active' | 'rejected';
  invitedBy: string;
  invitedAt: number;
  acceptedAt?: number;
}

export async function createApiKey(
  db: D1Database,
  userId: string,
  name: string,
  rateLimit = 100,
  expiresInDays?: number
): Promise<{ apiKey: ApiKey; rawKey: string }> {
  const id = generateId();
  const now = Date.now();
  const rawKey = `shc_${generateToken()}`;
  const keyHash = await hashKey(rawKey);
  const prefix = rawKey.slice(0, 8);
  const expiresAt = expiresInDays ? now + expiresInDays * 24 * 60 * 60 * 1000 : null;

  await db.prepare(
    `INSERT INTO api_keys (id, user_id, name, key_hash, prefix, rate_limit, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, userId, name, keyHash, prefix, rateLimit, expiresAt, now).run();

  return {
    apiKey: { id, userId, name, prefix, rateLimit, expiresAt, createdAt: now },
    rawKey,
  };
}

export async function verifyApiKey(db: D1Database, rawKey: string): Promise<ApiKey | null> {
  const prefix = rawKey.slice(0, 8);
  const result = await db.prepare(
    `SELECT id, user_id as userId, name, prefix, rate_limit as rateLimit, 
            last_used_at as lastUsedAt, expires_at as expiresAt, created_at as createdAt
     FROM api_keys WHERE prefix = ?`
  ).bind(prefix).first();

  if (!result) return null;

  const isValid = await verifyKey(rawKey, result.key_hash);
  if (!isValid) return null;

  if (result.expiresAt && result.expiresAt < Date.now()) return null;

  await db.prepare(
    'UPDATE api_keys SET last_used_at = ? WHERE id = ?'
  ).bind(Date.now(), result.id).run();

  return {
    id: result.id,
    userId: result.userId,
    name: result.name,
    prefix: result.prefix,
    rateLimit: result.rateLimit,
    lastUsedAt: result.lastUsedAt,
    expiresAt: result.expiresAt,
    createdAt: result.createdAt,
  };
}

export async function listApiKeys(db: D1Database, userId: string): Promise<ApiKey[]> {
  const results = await db.prepare(
    `SELECT id, user_id as userId, name, prefix, rate_limit as rateLimit, 
            last_used_at as lastUsedAt, expires_at as expiresAt, created_at as createdAt
     FROM api_keys WHERE user_id = ? ORDER BY created_at DESC`
  ).bind(userId).all();

  return results.results.map(r => ({
    id: r.id,
    userId: r.userId,
    name: r.name,
    prefix: r.prefix,
    rateLimit: r.rateLimit,
    lastUsedAt: r.lastUsedAt,
    expiresAt: r.expiresAt,
    createdAt: r.createdAt,
  }));
}

export async function deleteApiKey(db: D1Database, userId: string, keyId: string): Promise<boolean> {
  const result = await db.prepare(
    'DELETE FROM api_keys WHERE id = ? AND user_id = ?'
  ).bind(keyId, userId).run();

  return (result.meta.changes || 0) > 0;
}

export async function checkRateLimit(kv: KVNamespace, prefix: string, limit: number, windowMs: number): Promise<boolean> {
  const key = `ratelimit:${prefix}:${Math.floor(Date.now() / windowMs)}`;
  const current = await kv.get(key);
  const count = current ? parseInt(current, 10) + 1 : 1;

  if (count > limit) return false;

  await kv.put(key, String(count), { expirationTtl: Math.ceil(windowMs / 1000) + 60 });
  return true;
}

async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyKey(key: string, hash: string): Promise<boolean> {
  const keyHash = await hashKey(key);
  return keyHash === hash;
}

export async function inviteTeamMember(
  db: D1Database,
  teamId: string,
  email: string,
  role: 'admin' | 'member',
  invitedBy: string
): Promise<TeamMember> {
  const id = generateId();
  const now = Date.now();

  const existing = await db.prepare(
    'SELECT id FROM team_members WHERE team_id = ? AND email = ?'
  ).bind(teamId, email.toLowerCase()).first();

  if (existing) {
    throw new Error('Member already invited or part of team');
  }

  await db.prepare(
    `INSERT INTO team_members (id, team_id, email, role, status, invited_by, invited_at)
     VALUES (?, ?, ?, ?, 'pending', ?, ?)`
  ).bind(id, teamId, email.toLowerCase(), role, invitedBy, now).run();

  return { id, teamId, userId: '', email: email.toLowerCase(), role, status: 'pending', invitedBy, invitedAt: now };
}

export async function acceptTeamInvite(db: D1Database, email: string, userId: string): Promise<TeamMember | null> {
  const result = await db.prepare(
    `UPDATE team_members SET user_id = ?, status = 'active', accepted_at = ? WHERE email = ? AND status = 'pending'`
  ).bind(userId, Date.now(), email.toLowerCase()).run();

  if ((result.meta.changes || 0) === 0) return null;

  const member = await db.prepare(
    `SELECT id, team_id as teamId, user_id as userId, email, role, status, invited_by as invitedBy, invited_at as invitedAt, accepted_at as acceptedAt
     FROM team_members WHERE email = ?`
  ).bind(email.toLowerCase()).first();

  return member ? {
    id: member.id,
    teamId: member.teamId,
    userId: member.userId,
    email: member.email,
    role: member.role,
    status: member.status,
    invitedBy: member.invitedBy,
    invitedAt: member.invitedAt,
    acceptedAt: member.acceptedAt,
  } : null;
}

export async function getTeamMembers(db: D1Database, teamId: string): Promise<TeamMember[]> {
  const results = await db.prepare(
    `SELECT id, team_id as teamId, user_id as userId, email, role, status, invited_by as invitedBy, invited_at as invitedAt, accepted_at as acceptedAt
     FROM team_members WHERE team_id = ? ORDER BY invited_at DESC`
  ).bind(teamId).all();

  return results.results.map(r => ({
    id: r.id,
    teamId: r.teamId,
    userId: r.userId,
    email: r.email,
    role: r.role,
    status: r.status,
    invitedBy: r.invitedBy,
    invitedAt: r.invitedAt,
    acceptedAt: r.acceptedAt,
  }));
}

export async function removeTeamMember(db: D1Database, teamId: string, memberId: string): Promise<boolean> {
  const result = await db.prepare(
    'DELETE FROM team_members WHERE id = ? AND team_id = ?'
  ).bind(memberId, teamId).run();

  return (result.meta.changes || 0) > 0;
}

export async function updateMemberRole(db: D1Database, teamId: string, memberId: string, role: 'admin' | 'member'): Promise<boolean> {
  const result = await db.prepare(
    'UPDATE team_members SET role = ? WHERE id = ? AND team_id = ?'
  ).bind(role, memberId, teamId).run();

  return (result.meta.changes || 0) > 0;
}

export async function getUserTeam(db: D1Database, userId: string): Promise<{ teamId: string; role: string } | null> {
  const result = await db.prepare(
    `SELECT team_id as teamId, role FROM team_members WHERE user_id = ? AND status = 'active'`
  ).bind(userId).first();

  return result ? { teamId: result.teamId, role: result.role } : null;
}

export interface KVNamespace {
  get(key: string, options?: { type?: 'text' | 'json' | 'arrayBuffer' | 'stream' }): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number; expiration?: number }): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{ keys: Array<{ name: string; expiration?: number; metadata?: unknown }>; list_complete: boolean; cursor?: string }>;
}

export async function checkRateLimit(kv: KVNamespace, prefix: string, limit: number, windowMs: number): Promise<boolean> {
  const key = `ratelimit:${prefix}:${Math.floor(Date.now() / windowMs)}`;
  const current = await kv.get(key);
  const count = current ? parseInt(current, 10) + 1 : 1;

  if (count > limit) return false;

  await kv.put(key, String(count), { expirationTtl: Math.ceil(windowMs / 1000) + 60 });
  return true;
}