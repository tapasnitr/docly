import type { ApiResponse } from '@docly/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost/api';

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

// Thin wrapper around fetch that speaks the API's response envelope
// (@docly/types ApiResponse) so callers get typed data or a typed error,
// never a raw Response to unwrap by hand.
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  const body = (await response.json()) as ApiResponse<T>;

  if (!body.success) {
    throw new ApiRequestError(response.status, body.error.message, body.error.code);
  }

  return body.data;
}
