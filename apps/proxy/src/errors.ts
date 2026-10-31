export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

export function errorBody(code: string, message: string) {
  return { error: { code, message } };
}

export function invalidRequest(message = 'Permintaan tidak valid.'): ApiError {
  return new ApiError('invalid_request', 400, message);
}

export function payloadTooLarge(): ApiError {
  return new ApiError('payload_too_large', 413, 'Badan permintaan terlalu besar.');
}

export function originNotAllowed(): ApiError {
  return new ApiError('origin_not_allowed', 403, 'Origin tidak diizinkan.');
}

export function rateLimited(): ApiError {
  return new ApiError('rate_limited', 429, 'Terlalu banyak permintaan.');
}
