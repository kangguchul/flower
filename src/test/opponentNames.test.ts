import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInitialGame } from '../engine/gameState';
import { createGostopRoom } from '../games/gostop/gameState';
import { getGostopOpponentSessionId, gostopComputerPlayersForSession, resetGostopOpponentSession, voiceActorDisplayName, VOICE_ACTOR_NAMES } from '../lib/computerPlayers';
import { getMatgoOpponentSessionId, opponentNameForGame, opponentProfileForSession, resetMatgoOpponentSession } from '../lib/opponentNames';
import { claimFreshReload, releaseFreshReload } from '../lib/pageLoad';
import { assignPlayerIndexes, finishPlayerSeat, MAX_CONSECUTIVE_ROUNDS, MIN_CONSECUTIVE_ROUNDS, PLAYER_ID_COUNT, playerIdAt, playerIds, randomConsecutiveRounds, seatNextUser } from '../lib/playerIds';

describe('컴퓨터 상대 이름', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('모든 음색에 성별과 역할에 맞는 고유 이름을 부여한다', () => {
    expect(VOICE_ACTOR_NAMES).toEqual({
      player: '사용자',
      opponent: '이정호',
      matgoFemale: '김영숙',
      gostopComputerA: '이서윤',
      gostopComputerB: '박영수',
      gostopComputerC: '최동철',
      gostopComputerD: '한서진'
    });
    expect(voiceActorDisplayName('player', '어머니')).toBe('어머니');
    expect(voiceActorDisplayName('gostopComputerC', '어머니')).toBe('최동철');
  });

  it('같은 판에서는 항상 같은 이름을 사용한다', () => {
    const gameUuid = '44b5331b-f506-4a21-9f04-1666ab76387b';
    expect(opponentNameForGame(gameUuid)).toBe(opponentNameForGame(gameUuid));
    expect(opponentNameForGame(gameUuid)).toMatch(/^[A-Za-z0-9가-힣]{8,18}$/);
    expect(opponentNameForGame(gameUuid).startsWith('ID-')).toBe(false);
  });

  it('아이디 1000개를 만들고 여러 번 둔 뒤에는 다른 상대를 고른다', () => {
    expect(playerIds()).toHaveLength(PLAYER_ID_COUNT);
    expect(new Set(playerIds()).size).toBe(PLAYER_ID_COUNT);
    expect(playerIdAt(0)).toBe('apple19하린OO');
    expect(playerIdAt(999)).toBe('mint연우35oliv');
    expect(playerIds().every(id => /^[A-Za-z0-9가-힣]{8,18}$/.test(id) && /[가-힣]{2}/.test(id) && /\d/.test(id) && /[A-Za-z]{3}/.test(id) && !/[._]/.test(id) && !id.startsWith('ID-'))).toBe(true);
    const names = new Set(Array.from({ length: 300 }, (_, index) => opponentNameForGame(`44b5331b-f506-4a21-9f04-${String(index).padStart(12, '0')}`)));
    expect(names.size).toBeGreaterThan(6);
    const gameUuid = '44b5331b-f506-4a21-9f04-1666ab76387b';
    expect(opponentNameForGame(gameUuid, 1)).not.toBe(opponentNameForGame(gameUuid, 0));
    const memory = new Map<string, string>();
    const store = { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => memory.set(key, value) };
    const oneRound = () => 0;
    const first = assignPlayerIndexes('game-a', 1, '같은사람', store, oneRound);
    expect(assignPlayerIndexes('game-a', 1, '같은사람', store, oneRound)).toEqual(first);
    expect(assignPlayerIndexes('game-b', 1, '같은사람', store, oneRound)).toEqual(first);
    expect(finishPlayerSeat(store, oneRound)).toMatchObject({ leaving: true, leftName: playerIdAt(first[0]) });
    expect(assignPlayerIndexes('game-c', 1, '같은사람', store, oneRound)[0]).not.toBe(first[0]);
    expect(randomConsecutiveRounds(() => 0)).toBe(MIN_CONSECUTIVE_ROUNDS);
    expect(randomConsecutiveRounds(() => 0.999)).toBe(MAX_CONSECUTIVE_ROUNDS);
    const longStore = { getItem: (key: string) => memory.get(`long:${key}`) ?? null, setItem: (key: string, value: string) => memory.set(`long:${key}`, value) };
    const same = assignPlayerIndexes('round-1', 1, '같은사람', longStore, () => 0.999);
    for (let round = 1; round < MAX_CONSECUTIVE_ROUNDS; round += 1) {
      expect(finishPlayerSeat(longStore, () => 0.999).leaving).toBe(false);
      expect(assignPlayerIndexes(`round-${round + 1}`, 1, '같은사람', longStore, () => 0.999)).toEqual(same);
    }
    expect(finishPlayerSeat(longStore, () => 0.999).leaving).toBe(true);
  });

  it('새로고침은 같은 상대를 유지하지 않고 새 사용자를 입장시킨다', () => {
    const memory = new Map<string, string>();
    const store = { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => memory.set(key, value) };
    const first = assignPlayerIndexes('loaded', 1, '사람', store, () => 0);
    const next = seatNextUser('사람', 1, store, () => 0);
    expect(next.leftName).toBe(playerIdAt(first[0]));
    expect(next.indexes[0]).not.toBe(first[0]);
    expect(assignPlayerIndexes('after-reload', 1, '사람', store, () => 0)).toEqual(next.indexes);
    const stamps = new Map<string, string>();
    const stampStore = {
      getItem: (key: string) => stamps.get(key) ?? null,
      setItem: (key: string, value: string) => stamps.set(key, value),
      removeItem: (key: string) => { stamps.delete(key); }
    };
    expect(claimFreshReload(stampStore, 'load-1', 'navigate')).toBe(false);
    expect(claimFreshReload(stampStore, 'load-1', 'reload')).toBe(true);
    expect(claimFreshReload(stampStore, 'load-1', 'reload')).toBe(false);
    releaseFreshReload(stampStore);
    expect(claimFreshReload(stampStore, 'load-1', 'reload')).toBe(true);
  });

  it('맞고 입장 세션 동안 이름과 음성을 함께 고정한다', () => {
    const sessionId = 'matgo-session-20260721';
    expect(opponentProfileForSession(sessionId)).toEqual(opponentProfileForSession(sessionId));
  });

  it('새로고침에는 세션을 유지하고 각 대기실 진입 시 초기화한다', () => {
    const values = new Map<string, string>();
    vi.stubGlobal('window', { sessionStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key)
    } });
    const first = getMatgoOpponentSessionId();
    expect(getMatgoOpponentSessionId()).toBe(first);
    expect(opponentProfileForSession(getMatgoOpponentSessionId())).toEqual(opponentProfileForSession(first));
    resetMatgoOpponentSession();
    expect(getMatgoOpponentSessionId()).not.toBe(first);
    const gostopFirst = getGostopOpponentSessionId();
    expect(getGostopOpponentSessionId()).toBe(gostopFirst);
    expect(gostopComputerPlayersForSession(getGostopOpponentSessionId())).toEqual(gostopComputerPlayersForSession(gostopFirst));
    resetGostopOpponentSession();
    expect(getGostopOpponentSessionId()).not.toBe(gostopFirst);
  });

  it('randomUUID가 없는 HTTP 주소에서도 입장과 패 나누기가 된다', () => {
    const values = new Map<string, string>();
    vi.stubGlobal('window', { sessionStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key)
    } });
    vi.stubGlobal('crypto', {
      getRandomValues(bytes: Uint8Array) {
        bytes.set([0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99, 0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff, 0x00]);
        return bytes;
      }
    });
    expect(getMatgoOpponentSessionId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(createInitialGame(1).gameUuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('같은 아이디는 항상 같은 음성을 쓰고 세 글자 이름에 묶이지 않는다', () => {
    const first = opponentProfileForSession('session-0', 0);
    expect(opponentProfileForSession('session-0', 0)).toEqual(first);
    expect(first.name).toMatch(/^[A-Za-z0-9가-힣]{8,18}$/);
    expect(opponentProfileForSession('session-0', 1).name).not.toBe(first.name);
  });

  it('고스톱은 서로 다른 아이디 둘을 상대로 두고 다시 두면 바뀐다', () => {
    const selectedNames = new Set<string>();
    Array.from({ length: 300 }, (_, index) => {
      const players = gostopComputerPlayersForSession(`gostop-session-${index}`);
      expect(players.computerA.voiceActor).not.toBe(players.computerB.voiceActor);
      expect(players.computerA.name).not.toBe(players.computerB.name);
      expect(players.computerA.name).toMatch(/^[A-Za-z0-9가-힣]{8,18}$/);
      selectedNames.add(players.computerA.name);
      selectedNames.add(players.computerB.name);
      return players;
    });
    expect(selectedNames.size).toBeGreaterThan(6);
    const players = gostopComputerPlayersForSession('gostop-session-7');
    expect(gostopComputerPlayersForSession('gostop-session-7', 1).computerA.name).not.toBe(players.computerA.name);
    expect(createGostopRoom(308, 100, 1, 'computerA', players).lastAction).toContain(`${players.computerA.name}가 선`);
  });

  it('AI 판단용 난수값이 달라져도 판 고유번호가 같으면 이름이 유지된다', () => {
    const game = createInitialGame(20260719);
    const beforeMove = opponentNameForGame(game.gameUuid);
    game.randomSeed = 13579;
    const afterMove = opponentNameForGame(game.gameUuid);
    expect(afterMove).toBe(beforeMove);
  });
});
