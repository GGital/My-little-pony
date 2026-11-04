import { parseApiError } from './errors';

export interface RequestOptions extends RequestInit {
  onUnauthorized?: () => void;
}

export async function apiRequest<T>(url: string, options: RequestOptions = {}): Promise<T> {
  const { onUnauthorized, headers, ...rest } = options;

  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const response = await fetch(url, {
    credentials: 'same-origin',
    headers: {
      ...defaultHeaders,
      ...(headers as Record<string, string>),
    },
    ...rest,
  });

  if (response.status === 401) {
    if (onUnauthorized) {
      onUnauthorized();
    } else if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `/login?returnTo=${returnTo}`;
    }
  }

  if (!response.ok) {
    throw await parseApiError(response);
  }

  if (response.status === 204) {
    return undefined as unknown as T;
  }

  return response.json() as Promise<T>;
}

export const api = {
  get: <T>(url: string, options?: RequestOptions) =>
    apiRequest<T>(url, { method: 'GET', ...options }),
  post: <T>(url: string, body?: unknown, options?: RequestOptions) =>
    apiRequest<T>(url, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...options,
    }),
  patch: <T>(url: string, body?: unknown, options?: RequestOptions) =>
    apiRequest<T>(url, {
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...options,
    }),
  delete: <T>(url: string, options?: RequestOptions) =>
    apiRequest<T>(url, { method: 'DELETE', ...options }),
};
