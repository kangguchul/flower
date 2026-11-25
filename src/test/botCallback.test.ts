import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { botCallbackReply, decodeRequestBody, formatBotCallbackLog, handleBotCallback } from '../../server/botCallback.mjs';

describe('네이버웍스 봇 콜백', () => {
  it('주소 확인 요청이면 challenge를 그대로 돌려준다', () => {
    expect(botCallbackReply('{"type":"url_verification","challenge":"abc-123"}')).toEqual({
      status: 200,
      body: { challenge: 'abc-123' }
    });
  });

  it('한글 윈도우 CP949 본문을 한글로 읽는다', () => {
    const bytes = Buffer.from('7b2274797065223a226d657373616765222c22636f6e74656e74223a7b2274797065223a2274657874222c2274657874223a22c5d7bdbac6ae227d7d', 'hex');
    const text = decodeRequestBody(bytes);
    expect(text).toContain('테스트');
    expect(botCallbackReply(text).body).toMatchObject({ command: '테스트' });
  });

  it('받은 명령 본문을 그대로 돌려준다', () => {
    expect(botCallbackReply('{"type":"message","content":{"type":"text","text":"안녕"}}')).toEqual({
      status: 200,
      body: {
        ok: true,
        command: '안녕',
        received: { type: 'message', content: { type: 'text', text: '안녕' } }
      }
    });
  });

  it('받은 본문과 헤더를 로그 문자열에 남긴다', () => {
    const entry = formatBotCallbackLog({
      receivedAt: '2026-11-25T14:00:00.000Z',
      address: '203.0.113.8',
      headers: { 'content-type': 'application/json', 'x-works-signature': 'sig' },
      bodyText: '{"type":"message","content":{"text":"테스트"}}'
    });
    expect(entry).toContain('POST /bot from 203.0.113.8');
    expect(entry).toContain('"x-works-signature":"sig"');
    expect(entry).toContain('{"type":"message","content":{"text":"테스트"}}');
  });

  it('POST 본문을 로그에 찍고 JSON으로 응답한다', async () => {
    const request = new EventEmitter() as EventEmitter & { method: string; headers: Record<string, string>; socket: { remoteAddress: string } };
    request.method = 'POST';
    request.headers = { 'content-type': 'application/json', 'x-works-signature': 'sig' };
    request.socket = { remoteAddress: '127.0.0.1' };
    const response = {
      statusCode: 0,
      headers: {} as Record<string, string>,
      body: '',
      setHeader(name: string, value: string) { this.headers[name] = value; },
      end(body?: string) { this.body = body ?? ''; }
    };
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const pending = handleBotCallback(request, response);
    request.emit('data', Buffer.from('{"type":"url_verification","challenge":"works"}'));
    request.emit('end');
    await pending;
    expect(response.statusCode).toBe(200);
    expect(response.body).toBe('{"challenge":"works"}');
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('{"type":"url_verification","challenge":"works"}'));
    spy.mockRestore();
  });
});
