import { describe, expect, it } from 'vitest';
import {
  canActivateWifiConfig,
  canAddWifiConfig,
  getActiveWifiConfigCount,
} from '../../src/domain/wifiConfigLimit.js';

describe('getActiveWifiConfigCount', () => {
  it('空配列は 0', () => {
    expect(getActiveWifiConfigCount([])).toBe(0);
  });

  it('active のみカウントする', () => {
    expect(
      getActiveWifiConfigCount([{ status: 'active' }, { status: 'active' }, { status: 'active' }]),
    ).toBe(3);
  });

  it('standby もカウントする', () => {
    expect(getActiveWifiConfigCount([{ status: 'active' }, { status: 'standby' }])).toBe(2);
  });

  it('disabled はカウントしない', () => {
    expect(
      getActiveWifiConfigCount([
        { status: 'active' },
        { status: 'disabled' },
        { status: 'disabled' },
      ]),
    ).toBe(1);
  });

  it('active 2 + standby 1 = 3', () => {
    expect(
      getActiveWifiConfigCount([{ status: 'active' }, { status: 'active' }, { status: 'standby' }]),
    ).toBe(3);
  });
});

describe('canAddWifiConfig', () => {
  it('0 件の場合は追加可能', () => {
    expect(canAddWifiConfig([])).toBe(true);
  });

  it('1 件の場合は追加可能', () => {
    expect(canAddWifiConfig([{ status: 'active' }])).toBe(true);
  });

  it('2 件の場合は追加可能', () => {
    expect(canAddWifiConfig([{ status: 'active' }, { status: 'standby' }])).toBe(true);
  });

  it('3 件 (上限) の場合は追加不可', () => {
    expect(
      canAddWifiConfig([{ status: 'active' }, { status: 'active' }, { status: 'standby' }]),
    ).toBe(false);
  });

  it('disabled のみ 5 件の場合は追加可能', () => {
    expect(
      canAddWifiConfig([
        { status: 'disabled' },
        { status: 'disabled' },
        { status: 'disabled' },
        { status: 'disabled' },
        { status: 'disabled' },
      ]),
    ).toBe(true);
  });

  it('active 2 + disabled 3 の場合は追加可能', () => {
    expect(
      canAddWifiConfig([
        { status: 'active' },
        { status: 'active' },
        { status: 'disabled' },
        { status: 'disabled' },
        { status: 'disabled' },
      ]),
    ).toBe(true);
  });
});

describe('canActivateWifiConfig', () => {
  const configs = [
    { id: 'a', status: 'active' as const },
    { id: 'b', status: 'active' as const },
    { id: 'c', status: 'disabled' as const },
  ];

  it('disabled → disabled は常に可能', () => {
    expect(canActivateWifiConfig(configs, 'c', 'disabled')).toBe(true);
  });

  it('active → disabled は常に可能', () => {
    expect(canActivateWifiConfig(configs, 'a', 'disabled')).toBe(true);
  });

  it('disabled → active で他に 2 件なら可能 (合計 3 件未満)', () => {
    // 他の active: a, b の 2 件 → 追加後 3 件 = 上限ちょうど → 可能
    expect(canActivateWifiConfig(configs, 'c', 'active')).toBe(true);
  });

  it('disabled → active で他に 3 件 (上限) なら不可', () => {
    const fullConfigs = [
      { id: 'a', status: 'active' as const },
      { id: 'b', status: 'active' as const },
      { id: 'd', status: 'active' as const },
      { id: 'c', status: 'disabled' as const },
    ];
    expect(canActivateWifiConfig(fullConfigs, 'c', 'active')).toBe(false);
  });
});
