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