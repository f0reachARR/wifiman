import { describe, expect, it } from 'vitest';
import { CreateBestPracticeSchema } from '../../src/schemas/bestPractice.js';

describe('CreateBestPracticeSchema', () => {
  it('scope ごとの target 整合性を検証する', () => {
    expect(
      CreateBestPracticeSchema.safeParse({
        title: 'general',
        body: 'body',
        scope: 'general',
      }).success,
    ).toBe(true);

    expect(
      CreateBestPracticeSchema.safeParse({
        title: 'band',
        body: 'body',
        scope: 'band',
        targetBand: '5GHz',
      }).success,
    ).toBe(true);

    expect(
      CreateBestPracticeSchema.safeParse({
        title: 'broken band',
        body: 'body',
        scope: 'band',
      }).success,
    ).toBe(false);

    expect(
      CreateBestPracticeSchema.safeParse({
        title: 'broken general',
        body: 'body',
        scope: 'general',
        targetModel: 'AP-1',
      }).success,
    ).toBe(false);
  });
});
