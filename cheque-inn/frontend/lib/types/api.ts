/**
 * Common API response shapes aligned with backend.
 */
export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: string;
  /** Set when GET /api/auth/me returns 403 for inactive/suspended account or company. */
  accessBlockCode?: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export function isApiError<T>(r: ApiResponse<T>): r is ApiError {
  return r.success === false;
}
