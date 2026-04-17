import type { ApiError, ErrorCode } from '@wifiman/shared';
import { ErrorCodes } from '@wifiman/shared';
import type { Context } from 'hono';

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function notFound(message = 'リソースが見つかりません'): AppError {
  return new AppError(404, ErrorCodes.NOT_FOUND, message);
}

export function unauthorized(message = '認証が必要です'): AppError {
  return new AppError(401, ErrorCodes.UNAUTHORIZED, message);
}

export function forbidden(message = 'アクセス権限がありません'): AppError {
  return new AppError(403, ErrorCodes.FORBIDDEN, message);
}

export function conflict(message: string, details?: unknown): AppError {
  return new AppError(409, ErrorCodes.CONFLICT, message, details);
}

export function unprocessable(message: string, details?: unknown): AppError {
  return new AppError(422, ErrorCodes.UNPROCESSABLE, message, details);
}

export function validationError(message: string, details?: unknown): AppError {
  return new AppError(400, ErrorCodes.VALIDATION_ERROR, message, details);
}

export function toApiErrorResponse(err: AppError): ApiError {
  const response: ApiError = {
    error: {
      code: err.code,
      message: err.message,
    },
  };
  if (err.details !== undefined) {
    response.error.details = err.details;
  }
  return response;
}

export function errorHandler(err: Error, c: Context) {
  if (err instanceof AppError) {
    return c.json(toApiErrorResponse(err), err.statusCode as Parameters<typeof c.json>[1]);
  }
  console.error('Unhandled error:', err);
  return c.json(
    {
      error: {
        code: ErrorCodes.INTERNAL_ERROR,
        message: '内部サーバーエラーが発生しました',
      },
    } satisfies ApiError,
    500,
  );
}
