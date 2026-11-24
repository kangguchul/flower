import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameState } from '../engine/types';
import { viewForSeat, type DrawChoiceRequest, type GuestAction, type Seat } from './multiplayerView';

export type MultiplayerStatus = 'off' | 'lobby' | 'waiting' | 'ready' | 'closed';

export interface IncomingAction {
  id: string;
  action: GuestAction;
}

export function useMultiplayer(enabled: boolean) {
  const socketRef = useRef<WebSocket | null>(null);
  const revisionRef = useRef(0);
  const seenRevisionRef = useRef(0);
  const [status, setStatus] = useState<MultiplayerStatus>(enabled ? 'lobby' : 'off');
  const [seat, setSeat] = useState<Seat | null>(null);
  const [code, setCode] = useState('');
  const [names, setNames] = useState({ host: '', guest: '' });
  const [error, setError] = useState('');
  const [addresses, setAddresses] = useState<string[]>([]);
  const [incomingState, setIncomingState] = useState<GameState | null>(null);
  const [incomingAction, setIncomingAction] = useState<IncomingAction | null>(null);
  const [choiceRequest, setChoiceRequest] = useState<DrawChoiceRequest | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    fetch('/multiplayer/host', { signal: controller.signal })
      .then(response => response.json())
      .then((body: { ips?: string[] }) => setAddresses(body.ips ?? []))
      .catch(() => undefined);
    return () => controller.abort();
  }, [enabled]);

  const connect = useCallback(() => {
    if (socketRef.current && socketRef.current.readyState <= WebSocket.OPEN) return socketRef.current;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}/multiplayer`);
    socketRef.current = socket;
    socket.onmessage = event => {
      const message = JSON.parse(String(event.data)) as {
        type: string;
        code?: string;
        seat?: Seat;
        hostName?: string;
        guestName?: string;
        message?: string;
        state?: GameState;
        revision?: number;
        action?: GuestAction;
        id?: string;
        choice?: DrawChoiceRequest;
      };
      if (message.type === 'created') {
        setSeat('host');
        setCode(message.code ?? '');
        setNames({ host: message.hostName ?? '나', guest: '' });
        setStatus('waiting');
        setError('');
      } else if (message.type === 'joined') {
        setSeat(message.seat ?? null);
        setCode(message.code ?? '');
        setNames({ host: message.hostName ?? '나', guest: message.guestName ?? '상대' });
        setStatus('ready');
        setError('');
      } else if (message.type === 'state' && message.state) {
        const revision = message.revision ?? 0;
        if (revision < seenRevisionRef.current) return;
        seenRevisionRef.current = revision;
        setIncomingState(message.state);
        setChoiceRequest(null);
      } else if (message.type === 'action' && message.action && message.id) {
        setIncomingAction({ id: message.id, action: message.action });
      } else if (message.type === 'choice' && message.choice) {
        setChoiceRequest(message.choice);
      } else if (message.type === 'error') {
        setError(message.message ?? '방에 들어가지 못했습니다.');
      } else if (message.type === 'closed') {
        setStatus('closed');
        setError(message.message ?? '상대가 나갔습니다.');
      }
    };
    socket.onerror = () => setError('같이 하기 연결이 되지 않았습니다. 개발 서버를 다시 실행해 주세요.');
    return socket;
  }, []);

  const createRoom = useCallback((name: string) => {
    const socket = connect();
    const payload = JSON.stringify({ type: 'create', name });
    if (socket.readyState === WebSocket.OPEN) socket.send(payload);
    else socket.addEventListener('open', () => socket.send(payload), { once: true });
  }, [connect]);

  const joinRoom = useCallback((roomCode: string, name: string) => {
    const socket = connect();
    const payload = JSON.stringify({ type: 'join', code: roomCode.trim().toUpperCase(), name });
    if (socket.readyState === WebSocket.OPEN) socket.send(payload);
    else socket.addEventListener('open', () => socket.send(payload), { once: true });
  }, [connect]);

  const sendState = useCallback((state: GameState) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    revisionRef.current += 1;
    socket.send(JSON.stringify({
      type: 'state',
      revision: revisionRef.current,
      guestView: viewForSeat(state, 'guest')
    }));
  }, []);

  const sendAction = useCallback((action: GuestAction) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: 'action', action }));
  }, []);

  const sendChoiceRequest = useCallback((choice: DrawChoiceRequest) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: 'choice', choice }));
  }, []);

  const clearAction = useCallback(() => setIncomingAction(null), []);

  const leave = useCallback(() => {
    socketRef.current?.close();
    socketRef.current = null;
  }, []);

  return {
    enabled, status, seat, code, names, error, addresses,
    incomingState, incomingAction, choiceRequest,
    createRoom, joinRoom, sendState, sendAction, sendChoiceRequest, clearAction, leave
  };
}
