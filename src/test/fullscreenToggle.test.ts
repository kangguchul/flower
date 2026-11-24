import { describe, expect, it } from 'vitest';
import { isFullscreenToggleTarget, isPhoneFullscreenWarningScreen, shouldShowFullscreenWarning } from '../lib/fullscreenToggle';

function node(tag: string, parent: { closest: (selector: string) => unknown } | null = null) {
  return {
    closest(selector: string) {
      const names = selector.split(',').map(part => part.trim().replace('[role="slider"]', 'slider'));
      if (names.includes(tag)) return this;
      return parent?.closest(selector) ?? null;
    }
  };
}

describe('화면 더블 클릭 전체화면', () => {
  it('화면 빈 곳을 더블 클릭하면 전체화면을 토글한다', () => {
    const table = node('main');
    const floor = node('section', table);
    expect(isFullscreenToggleTarget(floor as unknown as EventTarget)).toBe(true);
    expect(isFullscreenToggleTarget(table as unknown as EventTarget)).toBe(true);
  });

  it('버튼과 입력은 더블 클릭해도 전체화면으로 바꾸지 않는다', () => {
    const button = node('button');
    const label = node('span', button);
    expect(isFullscreenToggleTarget(label as unknown as EventTarget)).toBe(false);
    expect(isFullscreenToggleTarget(node('a') as unknown as EventTarget)).toBe(false);
    expect(isFullscreenToggleTarget(node('input') as unknown as EventTarget)).toBe(false);
    expect(isFullscreenToggleTarget(node('slider') as unknown as EventTarget)).toBe(false);
  });

  it('핸드폰에서 전체화면이 아니면 더블탭 경고를 보여준다', () => {
    const phone = (query: string) => query.includes('portrait');
    expect(isPhoneFullscreenWarningScreen(phone)).toBe(true);
    expect(shouldShowFullscreenWarning(false, true)).toBe(true);
    expect(shouldShowFullscreenWarning(true, true)).toBe(false);
    expect(shouldShowFullscreenWarning(false, false)).toBe(false);
  });
});
