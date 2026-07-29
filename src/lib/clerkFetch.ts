let getTokenFn: (() => Promise<string | null>) | null = null

export function setGetTokenFn(fn: () => Promise<string | null>) {
  getTokenFn = fn;
}

export async function clerkFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  function buildHeaders(token?: string | null): Headers {
    const headers = new Headers(init?.headers);
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  }

  const firstToken = getTokenFn ? await getTokenFn() : null;
  let res = await fetch(input, {
    ...init,
    headers: buildHeaders(firstToken),
    credentials: 'include',
  });

  if (res.status === 401 && getTokenFn) {
    const retryToken = await getTokenFn();
    if (retryToken && retryToken !== firstToken) {
      res = await fetch(input, {
        ...init,
        headers: buildHeaders(retryToken),
        credentials: 'include',
      });
    }
  }

  return res;
}
