let getTokenFn: (() => Promise<string | null>) | null = null

export function setGetTokenFn(fn: () => Promise<string | null>) {
  getTokenFn = fn;
}

export async function clerkFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);

  if (getTokenFn) {
    const token = await getTokenFn();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  return fetch(input, {
    ...init,
    headers,
    credentials: 'include'
  });
}
