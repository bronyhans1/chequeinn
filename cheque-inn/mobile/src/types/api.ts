/** Optional payroll/earnings follow-up issues (e.g. after clock-out). */
export type ApiWarning = { code: string; message: string };

export interface ApiSuccess<T> {
  success: true;
  data: T;
  warnings?: ApiWarning[];
}

export interface ApiError {
  success: false;
  error: string;
  accessBlockCode?: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export function isApiError<T>(r: ApiResponse<T>): r is ApiError {
  return r.success === false;
}
