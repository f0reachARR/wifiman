import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createTanStackFormZodHelpers } from './tanstackFormZod.js';

describe('createTanStackFormZodHelpers', () => {
  const schema = z.object({
    email: z
      .string()
      .trim()
      .min(1, 'メールアドレスを入力してください')
      .email('メールアドレスを入力してください'),
    token: z.string().trim().length(64, 'トークンは 64 文字で入力してください'),
  });

  it('field validator は schema の最初のエラーメッセージを返す', () => {
    const setSubmitError = vi.fn();
    const helpers = createTanStackFormZodHelpers(schema, setSubmitError, '送信に失敗しました');

    expect(helpers.getFieldValidator('email')({ value: '' })).toBe(
      'メールアドレスを入力してください',
    );
    expect(
      helpers.getFieldValidator('token')({
        value: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      }),
    ).toBeUndefined();
  });

  it('change handler は submit error を消してから変更を流す', () => {
    const setSubmitError = vi.fn();
    const handleChange = vi.fn();
    const helpers = createTanStackFormZodHelpers(schema, setSubmitError, '送信に失敗しました');

    helpers.getChangeHandler(handleChange)('next-value');

    expect(setSubmitError).toHaveBeenCalledWith(null);
    expect(handleChange).toHaveBeenCalledWith('next-value');
  });

  it('submit invalid と submit error を分けて扱う', () => {
    const setSubmitError = vi.fn();
    const helpers = createTanStackFormZodHelpers(schema, setSubmitError, '送信に失敗しました');

    helpers.handleSubmitInvalid();
    helpers.handleSubmitError(new Error('認証に失敗しました'));
    helpers.handleSubmitError('unexpected');

    expect(setSubmitError).toHaveBeenNthCalledWith(1, null);
    expect(setSubmitError).toHaveBeenNthCalledWith(2, '認証に失敗しました');
    expect(setSubmitError).toHaveBeenNthCalledWith(3, '送信に失敗しました');
  });
});
