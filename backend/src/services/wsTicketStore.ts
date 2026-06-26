import crypto from 'crypto';

interface TicketEntry {
  userId: string;
  expiresAt: number;
}

const tickets = new Map<string, TicketEntry>();
const TICKET_TTL_MS = 60_000;
const CLEANUP_INTERVAL_MS = 30_000;

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

export function generateTicket(userId: string): string {
  console.log(`the new ticket will expire are ${Date.now() + TICKET_TTL_MS} `)
  const ticket = crypto.randomUUID();
  tickets.set(ticket, { userId, expiresAt: Date.now() + TICKET_TTL_MS });
  return ticket;
}

export function consumeTicket(ticket: string): string | null {
  const entry = tickets.get(ticket);
  if (!entry) return null;
  tickets.delete(ticket);
  return entry.expiresAt > Date.now() ? entry.userId : null;
}

function cleanupExpired(): void {
  const now = Date.now();
  for (const [key, entry] of tickets) {
    if (entry.expiresAt <= now) tickets.delete(key);
  }
}

export function startTicketCleanup(): void {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(cleanupExpired, CLEANUP_INTERVAL_MS);
}

export function stopTicketCleanup(): void {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}