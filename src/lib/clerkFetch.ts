let getTokenFn: (() => Promise<string | null>) | null = null;

export function setGetTokenFn(fn: () => Promise<string | null>) {
  getTokenFn = fn;
}

const REQUEST_TIMEOUT_MS = 60_000;
const RETRY_DELAY_MS = 2_000;

function createTimeoutError(url: string): Error {
  const error = new Error(`Request timed out after ${REQUEST_TIMEOUT_MS}ms: ${url}`);
  error.name = 'TimeoutFetchError';
  return error;
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && error.name === 'TimeoutFetchError';
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const url = String(input);

  const abortController = new AbortController();

  const timeout = setTimeout(() => {
    abortController.abort(new Error('timeout'));
  }, REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(input, {
      ...init,
      signal: abortController.signal,
    });

    return response;
  } catch (error) {
    if (abortController.signal.aborted) {
      throw createTimeoutError(url);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }

  return res;
}

async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const url = String(input);

  try {
    return await fetchWithTimeout(input, init);
  } catch (error) {
    if (!isTimeoutError(error)) {
      throw error;
    }

    console.warn('[fetchWithRetry] TIMEOUT DETECTED - RETRYING', {
      url,
      retryDelayMs: RETRY_DELAY_MS,
    });

    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));

    return fetchWithTimeout(input, init);
  }
}

export async function clerkFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  function buildHeaders(token: string | null): Headers {
    const headers = new Headers(init ? init.headers : undefined);

    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    return headers;
  }

  const firstToken = getTokenFn ? await getTokenFn() : null;

  let res = await fetchWithRetry(input, {
    ...init,
    headers: buildHeaders(firstToken),
    credentials: 'include',
  });

  if (res.status === 401 && getTokenFn) {
    console.warn('[clerkFetch] 401 RECEIVED - GETTING RETRY TOKEN', {
      url: String(input),
    });

    const retryToken = await getTokenFn();

    if (retryToken && retryToken !== firstToken) {
      res = await fetchWithRetry(input, {
        ...init,
        headers: buildHeaders(retryToken),
        credentials: 'include',
      });
    } else {
      console.warn('[clerkFetch] RETRY SKIPPED', {
        url: String(input),
        reason: !retryToken
          ? 'No retry token'
          : 'Retry token is identical to first token',
      });
    }
  }

  return res;
}