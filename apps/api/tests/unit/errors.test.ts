import { ErrorCodes } from '@wifiman/shared';
import { describe, expect, it } from 'vitest';
import {
  AppError,
  forbidden,
  notFound,
  toApiErrorResponse,
  unauthorized,
  unprocessable,
  validationError,
} from '../../src/errors.js';

describe('AppError', () => {
  it('ステータスコード・コード・メッセージを保持する', () => {
    const err = new AppError(400, ErrorCodes.VALIDATION_ERROR, 'テストエラー');
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe(ErrorCodes.VALIDATION_ERROR);
    expect(err.message).toBe('テストエラー');
  });

  it('details を保持する', () => {
    const details = { field: 'name', issue: 'required' };
    const err = new AppError(400, ErrorCodes.VALIDATION_ERROR, 'テスト', details);
    expect(err.details).toEqual(details);
  });
});

describe('toApiErrorResponse', () => {
  it('details なしの場合 details フィールドを含まない', () => {
    const err = notFound('見つかりません');
    const response = toApiErrorResponse(err);
    expect(response.error.code).toBe(ErrorCodes.NOT_FOUND);
    expect(response.error.message).toBe('見つかりません');
    expect(response.error.details).toBeUndefined();
  });

  it('details ありの場合 details フィールドを含む', () => {
    const err = unprocessable('処理不能', { rows: [1, 2] });
    const response = toApiErrorResponse(err);
    expect(response.error.details).toEqual({ rows: [1, 2] });
  });
});

describe('エラーファクトリ', () => {
  it('notFound は 404 を返す', () => {
    const err = notFound();
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe(ErrorCodes.NOT_FOUND);
  });

  it('unauthorized は 401 を返す', () => {
    const err = unauthorized();
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe(ErrorCodes.UNAUTHORIZED);
  });

  it('forbidden は 403 を返す', () => {
    const err = forbidden();
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe(ErrorCodes.FORBIDDEN);
  });

  it('unprocessable は 422 を返す', () => {
    const err = unprocessable('要件違反');
    expect(err.statusCode).toBe(422);
    expect(err.code).toBe(ErrorCodes.UNPROCESSABLE);
  });

  it('validationError は 400 を返す', () => {
    const err = validationError('入力エラー');
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe(ErrorCodes.VALIDATION_ERROR);
  });
});
