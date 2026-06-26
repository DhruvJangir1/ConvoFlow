export function validatePasswordLocal(password: string): { isValid: boolean; error: string | null; strength: "weak" | "strong" } {
  if (typeof password !== "string") return { isValid: false, error: "Invalid password", strength: "weak" };
  if (password.length < 8) return { isValid: false, error: "Password must be at least 8 characters", strength: "weak" };
  const strength = password.length >= 12 ? "strong" : "weak";
  return { isValid: true, error: null, strength };
}

export async function checkPasswordPwned(password: string): Promise<{ pwned: boolean; count: number; strength?: "weak" | "strong"; message?: string }> {
  try {
    const res = await fetch('/api/auth/EmailVerificaitonRouter/check-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
    if (!res.ok) return { pwned: false, count: 0 };
    return await res.json();
  } catch {
    return { pwned: false, count: 0 };
  }
}
