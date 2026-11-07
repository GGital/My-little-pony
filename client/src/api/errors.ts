import type { ApiErrorDetail, ApiErrorPayload, ApiErrorEnvelope } from './types';

export class ApiError extends Error {
  public status: number;
  public code: string;
  public details?: ApiErrorDetail[];

  constructor(status: number, payload: ApiErrorPayload) {
    super(payload.message || 'API request failed');
    this.name = 'ApiError';
    this.status = status;
    this.code = payload.code;
    this.details = payload.details;
  }
}

export async function parseApiError(response: Response): Promise<ApiError> {
  try {
    const data = (await response.json()) as ApiErrorEnvelope;
    if (data?.error) {
      return new ApiError(response.status, data.error);
    }
  } catch {
    // fallback if body is not valid JSON
  }
  return new ApiError(response.status, {
    code: 'UNKNOWN_ERROR',
    message: response.statusText || 'An unexpected error occurred',
  });
}
