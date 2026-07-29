import crypto from 'crypto';

const tickets = new Map<string, { userId: string; expiresAt: number }>();

const TICKET_TTL_MS = 60_000;

let cleanupInterval: ReturnType<typeof setInterval> | null = null;

export function generateTicket(userId: string): string {
  const ticket = crypto.randomUUID();
  tickets.set(ticket, { userId, expiresAt: Date.now() + TICKET_TTL_MS });
  return ticket;
}

export function consumeTicket(ticket: string): string | null {
  const entry = tickets.get(ticket);
  if (!entry) return null;
  tickets.delete(ticket);
  if (Date.now() > entry.expiresAt) return null;
  return entry.userId;
}

export function startTicketCleanup(): void {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [ticket, entry] of tickets) {
      if (now > entry.expiresAt) tickets.delete(ticket);
    }
  }, 30_000);
}

export function stopTicketCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}
