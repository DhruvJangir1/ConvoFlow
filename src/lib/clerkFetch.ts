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
    } else {
      console.warn('[clerkFetch] getToken returned null — request will likely 401');
    }
  } else {
    console.warn('[clerkFetch] getTokenFn not registered yet — request will likely 401');
  }

  return fetch(input, {
    ...init,
    headers,
    credentials: 'include'
  });
}
