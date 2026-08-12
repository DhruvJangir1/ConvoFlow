let getTokenFn: (() => Promise<string | null>) | null = null

export function setGetTokenFn(fn: () => Promise<string | null>) {
  getTokenFn = fn;
}

const REQUEST_TIMEOUT_MS = 15_000;

async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(new Error('timeout')), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: abortController.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export async function clerkFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  function buildHeaders(token: string | null): Headers {
    const headers = new Headers(init ? init.headers : undefined);
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  }

  const firstToken = getTokenFn ? await getTokenFn() : null;
  let res = await fetchWithTimeout(input, {
    ...init,
    headers: buildHeaders(firstToken),
    credentials: 'include',
  });

  if (res.status === 401 && getTokenFn) {
    const retryToken = await getTokenFn();
    if (retryToken && retryToken !== firstToken) {
      res = await fetchWithTimeout(input, {
        ...init,
        headers: buildHeaders(retryToken),
        credentials: 'include',
      });
    }
  }

  return res;
}
