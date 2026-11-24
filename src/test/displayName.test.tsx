import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import GamePlayerPanel from '../components/GamePlayerPanel';
import NameEditDialog from '../components/NameEditDialog';
import { cleanDisplayName } from '../lib/displayName';

describe('내 이름 수정', () => {
  it('앞뒤 공백을 없애고 20자까지만 남긴다', () => {
    expect(cleanDisplayName('  홍길동  ')).toBe('홍길동');
    expect(cleanDisplayName('가'.repeat(25))).toHaveLength(20);
    expect(cleanDisplayName('   ')).toBe('');
  });

  it('내 이름은 버튼이고 상대 이름은 버튼이 아니다', () => {
    const mine = renderToStaticMarkup(<GamePlayerPanel name="나" balance={100} human onNameClick={vi.fn()} />);
    const opponent = renderToStaticMarkup(<GamePlayerPanel name="김영숙" balance={100} />);
    expect(mine).toContain('aria-label="나 이름 수정"');
    expect(opponent).not.toContain('이름 수정');
  });

  it('이름 수정 화면에 현재 이름과 저장 버튼이 있다', () => {
    const html = renderToStaticMarkup(<NameEditDialog name="나" onSave={vi.fn()} onClose={vi.fn()} />);
    expect(html).toContain('이름 수정');
    expect(html).toContain('value="나"');
    expect(html).toContain('저장');
    expect(html).toContain('닫기');
  });
});