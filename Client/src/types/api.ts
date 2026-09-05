export interface ApiErrorData {
  message: string;
}

export interface ApiError {
  status: number;
  data: ApiErrorData;
}

export function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    'data' in error &&
    typeof (error as ApiError).data?.message === 'string'
  );
}
