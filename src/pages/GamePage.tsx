import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AiThinkingIndicator from '../components/AiThinkingIndicator';
import AudioControls from '../components/AudioControls';
import AutoPlayButton from '../components/AutoPlayButton';
import BombDecisionPanel from '../components/BombDecisionPanel';
import CardMissionPanel from '../components/CardMissionPanel';
import CapturedCardRack from '../components/CapturedCardRack';
import CaptureSummary from '../components/CaptureSummary';
import ChongtongDecisionPanel from '../components/ChongtongDecisionPanel';
import DifficultySelector from '../components/DifficultySelector';
import DealAnimation from '../components/DealAnimation';
import DiscardConfirmationToggle from '../components/DiscardConfirmationToggle';
import ExitChoiceDialog from '../components/ExitChoiceDialog';
import NameEditDialog from '../components/NameEditDialog';
import FloorCardField, { type FloorCardChoice } from '../components/FloorCardField';
import GameDeclarationOverlay, { type DeclarationEffect, type DeclarationKind } from '../components/GameDeclarationOverlay';
import GamePlayerPanel from '../components/GamePlayerPanel';
import GoStopDecisionPanel from '../components/GoStopDecisionPanel';
import GookjinDecisionPanel from '../components/GookjinDecisionPanel';
import HumanHandRow from '../components/HumanHandRow';
import Loading from '../components/Loading';
import MultiplayerLobby from '../components/MultiplayerLobby';
import PointValueSelector from '../components/PointValueSelector';
import RoundResultOverlay, { type MoneyTransfer } from '../components/RoundResultOverlay';
import ShakeDecisionPanel from '../components/ShakeDecisionPanel';
import StakeQuickSelector from '../components/StakeQuickSelector';
import StartingPlayerChoice from '../components/StartingPlayerChoice';
import TableScoreBadge from '../components/TableScoreBadge';
import UndoTurnButton from '../components/UndoTurnButton';
import { chooseAiFloorMatch } from '../engine/ai/evaluator';
import { AI_DIFFICULTY_ORDER, aiDifficultyLabel } from '../engine/ai/settings';
import { chooseAiChongtong, chooseAiGoStop, chooseAiGookjinAsDoubleJunk, chooseAiMove } from '../engine/ai/strategy';
import { createAiThinkingPlan, type AiThinkingPlan } from '../engine/ai/thinking';
import type { AiDifficulty } from '../engine/ai/types';
import { captureChoiceRequired, getCard } from '../engine/cards';
import { chooseChongtong, chooseGo, chooseStartingPlayer, chooseStop, createInitialGame, declareShake, getDrawFloorChoice, getFlipOnlyDrawChoice, getMatchingFloorCards, isValidGameState, nextRoundMultiplier, playBomb, playFlipOnlyTurn, playTurn, setGookjinChoice, setPointValue } from '../engine/gameState';
import { calculateCapturedScore } from '../engine/rules/scoring';
import { createCardMission } from '../engine/rules/missions';
import { normalizeMatgoPointValue, type MatgoPointValue } from '../engine/rules/settings';
import { findBombOptions, findShakeOptions, type BombOption } from '../engine/rules/specialRules';
import type { GameState, TurnResult, TurnSpecialEvent } from '../engine/types';
import { loadMatgoServerGame, refillBalance, saveMatgoServerGame, session } from '../lib/api';
import { applyAudioSettings, playAutoPlaySound, playBombSound, playBonusPeeSound, playCancelSound, playCaptureSound, playCardSound, playChongtongSound, playDealerResultSound, playDealSound, playDecisionSound, playFlipSound, playGoSound, playGookjinSound, playLoseSound, playMissionSound, playMoneySound, playNagariSound, playPeeTransferSound, playPpeokSound, playScoreSound, playSelectSound, playShakeSound, playSpecialMoveSound, playStartSound, playStopSound, playUndoSound, playWinSound, unlockAudio, type VoiceActor } from '../lib/audio';
import { loadAudioSettings, saveAudioSettings, type AudioSettings } from '../lib/audioSettings';
import { useVolumeWheel } from '../lib/useVolumeWheel';
import { animateCapturedCardTransfers, animateCardFlight, elementForMatchFlight } from '../lib/effects';
import { drawnMatchFlight, matchFlightOnFloor, nextTableDrawId } from '../lib/floorStack';
import { loadAiDifficulty, loadAutoPlay, loadDiscardConfirmation, loadPointValue, saveAiDifficulty, saveAutoPlay, saveDiscardConfirmation, savePointValue } from '../lib/gamePreferences';
import { chooseLatestGame, shouldResumeSavedGame } from '../lib/gameResume';
import { useGameViewportFit } from '../lib/gameViewport';
import { remainingTurnUndos, useTurnUndo } from '../lib/useTurnUndo';
import { useProfileImageUpload } from '../lib/useProfileImageUpload';
import { getMatgoOpponentSessionId, useMatgoOpponent } from '../lib/opponentNames';
import { handCardIndexFromKey, isTextEntryTarget } from '../lib/gameShortcuts';
import { MANUAL_IDLE_MS, manualIdleKey } from '../lib/manualIdle';
import { claimFreshReload, OPPONENT_WAIT_MS, releaseFreshReload } from '../lib/pageLoad';
import { finishPlayerSeat, seatNextUser } from '../lib/playerIds';
import { loadLocalGame, loadProfile, loadSoloProfile, saveLocalGame, saveProfile, saveSoloProfile } from '../lib/localStore';
import AppInstallPrompt from '../components/AppInstallPrompt';
import CustomerBoardLink from '../components/CustomerBoardLink';
import { writeScoreCookie } from '../lib/scoreCookie';
import { migrateOpponentEntry, randomOpponentBalance } from '../lib/opponentBalance';
import { createSoloProfile, REFILL_RECONNECT_MESSAGE, settleSoloRound, SOLO_BALANCE, SOLO_USER_ID } from '../lib/soloPlay';
import { applyGuestAction, type GuestAction } from '../lib/multiplayerView';
import { useMultiplayer } from '../lib/useMultiplayer';
import { bonusPeeBurst, describePeeTransfer, summarizePeeTransfer } from '../lib/peeEffects';
import { getPpeokDeclaration } from '../lib/ppeokEffects';
import { getScoreCelebration, getScoreHeadline, getSettlementCelebration } from '../lib/scoreEffects';
import type { SessionData, UserProfile } from '../lib/types';

const ROUND_RESULT_REVEAL_DELAY_MS = 2200;

export default function GamePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const viewportFit = useGameViewportFit();
  const [game, setGame] = useState<GameState | null>(null);
  const { name: opponentName, voiceActor: opponentVoiceActor } = useMatgoOpponent(game?.gameUuid);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [onlineSession, setOnlineSession] = useState<SessionData | null>(null);
  const profileImage = useProfileImageUpload(onlineSession !== null || (import.meta.env.DEV && new URLSearchParams(location.search).get('preview') === '1'), setProfile);
  const [started, setStarted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [audioSettings, setAudioSettings] = useState<AudioSettings>(() => loadAudioSettings());
  const [preferredDifficulty, setPreferredDifficulty] = useState<AiDifficulty>(() => loadAiDifficulty());
  const [preferredPointValue, setPreferredPointValue] = useState<MatgoPointValue>(() => loadPointValue());
  const [exitDialogOpen, setExitDialogOpen] = useState(false);
  const [nameEditorOpen, setNameEditorOpen] = useState(false);
  const [opponentLeft, setOpponentLeft] = useState(false);
  const [seatChangeNotice, setSeatChangeNotice] = useState('');
  const [opponentWait, setOpponentWait] = useState(false);
  const cancelReloadRef = useRef<(() => void) | null>(null);
  const [exitReserved, setExitReserved] = useState(false);
  const [computerBalance, setComputerBalance] = useState(500000);
  const [moneyTransfer, setMoneyTransfer] = useState<MoneyTransfer | null>(null);
  const [dealing, setDealing] = useState(false);
  const [declaration, setDeclaration] = useState<DeclarationEffect | null>(null);
  const [floorCardChoice, setFloorCardChoice] = useState<FloorCardChoice | null>(null);
  const [bombChoice, setBombChoice] = useState<(BombOption & { selectedCardId: string }) | null>(null);
  const [shakeChoice, setShakeChoice] = useState<{ month: number; cardIds: string[]; selectedCardId: string } | null>(null);
  const [stakeSelectorOpen, setStakeSelectorOpen] = useState(false);
  const [autoPlay, setAutoPlay] = useState(() => loadAutoPlay());
  const [discardConfirmation, setDiscardConfirmation] = useState(() => loadDiscardConfirmation());
  const [showRoundResult, setShowRoundResult] = useState(false);
  const [aiThinking, setAiThinking] = useState<AiThinkingPlan | null>(null);
  const [gookjinChoiceOpen, setGookjinChoiceOpen] = useState(false);
  const floorRef = useRef<HTMLDivElement>(null);
  const deckRef = useRef<HTMLDivElement>(null);
  const computerHandRef = useRef<HTMLDivElement>(null);
  const humanHandRef = useRef<HTMLDivElement>(null);
  const aiTimerRef = useRef<number | null>(null);
  const autoPlayTimerRef = useRef<number | null>(null);
  const initializedRef = useRef(false);
  const soloModeRef = useRef(false);
  const seatRef = useRef<'host' | 'guest' | null>(null);
  const gameRef = useRef<GameState | null>(null);
  const pendingGuestRef = useRef<GuestAction | null>(null);
  const handledActionRef = useRef('');
  const dealtRef = useRef(false);
  const returnToDealerRef = useRef<() => void>(() => {});
  const continueAfterRoundRef = useRef<() => void>(() => {});
  const multiplayer = useMultiplayer(new URLSearchParams(location.search).get('multi') === '1');
  seatRef.current = multiplayer.seat;
  gameRef.current = game;
  const announcedResultRef = useRef<string | null>(null);
  const transferredGameRef = useRef<string | null>(null);
  const dealTimerRef = useRef<number | null>(null);
  const declarationTimerRef = useRef<number | null>(null);
  const declarationSequenceRef = useRef(0);
  const drawChoiceResolverRef = useRef<((cardId: string) => void) | null>(null);
  const turnUndo = useTurnUndo();

  useEffect(() => {
    applyAudioSettings(audioSettings);
    saveAudioSettings(audioSettings);
    if (!audioSettings.muted) void unlockAudio();
  }, [audioSettings]);
  useEffect(() => {
    if (!game) return;
    writeScoreCookie(calculateCapturedScore(game.humanCaptured, { gookjinAsDoubleJunk: game.humanGookjinAsDoubleJunk }).total);
  }, [game]);
  useVolumeWheel(audioSettings, next => {
    setAudioSettings(next);
    if (!next.muted) unlockAudio().catch(() => undefined);
  });
  useEffect(() => saveAutoPlay(autoPlay), [autoPlay]);
  useEffect(() => saveDiscardConfirmation(discardConfirmation), [discardConfirmation]);

  useEffect(() => () => {
    if (dealTimerRef.current !== null) window.clearTimeout(dealTimerRef.current);
    if (declarationTimerRef.current !== null) window.clearTimeout(declarationTimerRef.current);
    if (autoPlayTimerRef.current !== null) window.clearTimeout(autoPlayTimerRef.current);
  }, []);

  const showDeclaration = (kind: DeclarationKind, text: string, detail?: string, duration = 950, peeBurstValue?: 2 | 3, peeBurstText?: string) => {
    if (declarationTimerRef.current !== null) window.clearTimeout(declarationTimerRef.current);
    declarationSequenceRef.current += 1;
    setDeclaration({ id: declarationSequenceRef.current, kind, text, detail, peeBurstValue, peeBurstText });
    declarationTimerRef.current = window.setTimeout(() => setDeclaration(null), duration);
  };

  const showDealAnimation = () => {
    if (dealTimerRef.current !== null) window.clearTimeout(dealTimerRef.current);
    playDealSound(); setDealing(true);
    dealTimerRef.current = window.setTimeout(() => {
      setDealing(false);
    }, 1700);
  };

  const announceBonus = (result: TurnResult, opponent: false | VoiceActor = false, delay = 0) => {
    const count = result.bonusCards?.length ?? 0;
    if (!count) return false;
    const burst = bonusPeeBurst(result.bonusCards ?? []);
    const show = () => {
      playBonusPeeSound(burst.strongest, opponent, count);
      const stolen = result.bonusStolenPee?.length ?? result.stolenPee?.length ?? 0;
      const mission = result.missionCards?.length ? ` · 미션 ×${result.missionMultiplier ?? 1}` : '';
      const chain = count > 1 ? `${count}장 연속 · ` : '';
      showDeclaration(burst.kind, burst.strongest === 3 ? '쓰리피!' : '쌍피!', `${chain}피 ${burst.totalValue}장 값${stolen ? ` · 상대 피 ${stolen}장 뺏기` : ''}${mission}`, 1250);
    };
    if (delay) window.setTimeout(show, delay);
    else show();
    return true;
  };

  const announceSpecialCapture = (result: TurnResult, opponent: false | VoiceActor = false, delay = 0) => {
    const candidates = (result.specialEvents ?? []).filter(event => event.kind !== 'ppeok' && event.kind !== 'bomb') as Array<TurnSpecialEvent & {
      kind: 'jjok' | 'ttadak' | 'sweep' | 'ppeok-capture' | 'self-ppeok';
    }>;
    if (!candidates.length) return false;
    const priority = ['self-ppeok', 'ppeok-capture', 'ttadak', 'jjok', 'sweep'];
    const primary = [...candidates].sort((left, right) => priority.indexOf(left.kind) - priority.indexOf(right.kind))[0];
    const secondary = candidates.filter(event => event !== primary).map(event => event.label);
    const stolenPee = candidates.flatMap(event => event.stolenPee);
    const transfer = summarizePeeTransfer(stolenPee);
    const detail = [secondary.length ? `${secondary.join(' · ')}까지` : '', describePeeTransfer(stolenPee, Boolean(opponent)), result.missionCards?.length ? `미션 ×${result.missionMultiplier ?? 1}` : '']
      .filter(Boolean).join(' · ');
    const show = () => {
      playSpecialMoveSound(primary.kind, opponent);
      if (transfer.strongestBurst) window.setTimeout(() => playPeeTransferSound(transfer.strongestBurst!, opponent), 120);
      const burstText = transfer.strongestBurst
        ? `${transfer.strongestBurst === 3 ? '쓰리피' : '쌍피'} ${opponent ? '뺏김' : '뺏기'}!`
        : undefined;
      showDeclaration(primary.kind, `${primary.label}!`, detail, transfer.strongestBurst ? 1350 : 1100, transfer.strongestBurst ?? undefined, burstText);
    };
    if (delay) window.setTimeout(show, delay);
    else show();
    return true;
  };

  const announceMission = (result: TurnResult, opponent: false | VoiceActor = false, delay = 0) => {
    const count = result.missionCards?.length ?? 0;
    if (!count) return false;
    const multiplier = result.missionMultiplier ?? 1;
    const show = () => {
      playMissionSound(multiplier, opponent);
      showDeclaration('mission', `미션 ×${multiplier}!`, `미션패 ${count}장 획득`, 1100);
    };
    if (delay) window.setTimeout(show, delay);
    else show();
    return true;
  };

  const persist = async (state: GameState, account: UserProfile, auth: SessionData | null) => {
    await saveLocalGame(account.id, state, Boolean(auth));
    if (soloModeRef.current && account.id === SOLO_USER_ID) {
      const settled = settleSoloRound(account, state);
      if (settled && transferredGameRef.current !== state.gameUuid) {
        transferredGameRef.current = state.gameUuid;
        setProfile(settled.profile);
        setComputerBalance(settled.profile.opponentBalance ?? SOLO_BALANCE);
        setMoneyTransfer(settled.transfer);
        await saveSoloProfile(settled.profile);
      }
      return;
    }
    if (!auth || !navigator.onLine) return;
    try {
      const saved = await saveMatgoServerGame(auth, state);
      await saveLocalGame(account.id, state, false);
      if (saved.balance !== account.virtualBalance || saved.opponentBalance !== account.opponentBalance) {
        const updatedProfile = { ...account, virtualBalance: saved.balance, opponentBalance: saved.opponentBalance };
        setProfile(current => current?.id === account.id ? {
          ...current,
          virtualBalance: saved.balance,
          opponentBalance: saved.opponentBalance
        } : current);
        await saveProfile(updatedProfile);
      }
      setComputerBalance(saved.opponentBalance);
      if (state.phase === 'round-ended' && state.settlement && transferredGameRef.current !== state.gameUuid) {
        transferredGameRef.current = state.gameUuid;
        const computerAfter = saved.opponentBalanceAfterSettlement ?? saved.opponentBalance;
        const computerBefore = computerAfter + saved.settlementAmount;
        setMoneyTransfer({
          humanBefore: saved.balance - saved.settlementAmount,
          humanAfter: saved.balance,
          computerBefore,
          computerAfter,
          ...(saved.opponentRefilled ? { computerRefillAfter: saved.opponentBalance } : {}),
          amount: saved.settlementAmount,
          appliedNow: saved.settlementApplied
        });
      }
    }
    catch { /* 로컬 저장으로 계속 */ }
  };
  const undoLastTurn = async () => {
    if (!game || !profile || busy || dealing || floorCardChoice || bombChoice || shakeChoice) return;
    const restored = turnUndo.restore(game);
    if (!restored) return;
    if (aiTimerRef.current !== null) window.clearTimeout(aiTimerRef.current);
    setAiThinking(null); setAutoPlay(false); setGookjinChoiceOpen(false); setStakeSelectorOpen(false);
    playUndoSound(); setDeclaration(null); setGame(restored); setBusy(true);
    try { await persist(restored, profile, onlineSession); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    const parameters = new URLSearchParams(location.search);
    soloModeRef.current = parameters.get('solo') === '1';
    const reloadNewUser = parameters.get('multi') !== '1' && parameters.get('preview') !== '1' && claimFreshReload();
    let cancelled = false;
    const waitForNewUser = (account: UserProfile) => {
      const fresh = createInitialGame(Date.now(), preferredDifficulty, preferredPointValue);
      fresh.mission ??= createCardMission(fresh.randomSeed);
      setProfile(account);
      setComputerBalance(account.opponentBalance ?? SOLO_BALANCE);
      setGame(fresh);
      setStarted(false);
      setOpponentWait(true);
      setSeatChangeNotice('상대방을 기다리고 있습니다.');
      let done = false;
      const timer = window.setTimeout(() => {
        done = true;
        const change = seatNextUser(getMatgoOpponentSessionId(), 1);
        const nextBalance = randomOpponentBalance();
        const next = { ...account, opponentBalance: nextBalance };
        setProfile(next);
        setComputerBalance(nextBalance);
        void (soloModeRef.current || next.id === SOLO_USER_ID ? saveSoloProfile(next) : saveProfile(next));
        setOpponentWait(false);
        setSeatChangeNotice(change.leftName ? `${change.leftName} 님이 나갔습니다. ${change.nextName} 님이 들어왔습니다.` : `${change.nextName} 님이 들어왔습니다.`);
        const state = createInitialGame(Date.now(), preferredDifficulty, preferredPointValue);
        state.mission ??= createCardMission(state.randomSeed);
        setGame(state);
        setStarted(false);
      }, OPPONENT_WAIT_MS);
      cancelReloadRef.current = () => {
        window.clearTimeout(timer);
        if (!done) releaseFreshReload();
      };
    };
    (async () => {
      if (parameters.get('multi') === '1') {
        const account = createSoloProfile(await loadSoloProfile());
        setProfile(account);
        setComputerBalance(account.opponentBalance ?? SOLO_BALANCE);
        return;
      }
      if (soloModeRef.current) {
        const account = createSoloProfile(await loadSoloProfile());
        account.opponentBalance = migrateOpponentEntry('hwatu.opponent-entry', account.opponentBalance);
        await saveSoloProfile(account);
        if (cancelled) return;
        if (reloadNewUser) { waitForNewUser(account); return; }
        setProfile(account);
        setComputerBalance(account.opponentBalance ?? SOLO_BALANCE);
        const local = await loadLocalGame(account.id);
        const state = local?.state && isValidGameState(local.state) ? local.state : createInitialGame(Date.now(), preferredDifficulty, preferredPointValue);
        const difficulty = state.computerDifficulty ?? preferredDifficulty;
        const pointValue = normalizeMatgoPointValue(state.pointValue);
        state.computerDifficulty = difficulty;
        state.pointValue = pointValue;
        state.roundMultiplier ??= 1;
        state.mission ??= createCardMission(state.randomSeed);
        setPreferredDifficulty(difficulty);
        setPreferredPointValue(pointValue);
        saveAiDifficulty(difficulty);
        savePointValue(pointValue);
        setGame(state);
        setStarted(shouldResumeSavedGame(state));
        await persist(state, account, null);
        return;
      }
      if (import.meta.env.DEV && parameters.get('preview') === '1') {
        setProfile({ id: 0, username: 'preview', displayName: '어머니', role: 'member', virtualBalance: 500000 });
        setGame(createInitialGame(20260719, preferredDifficulty, preferredPointValue));
        setStarted(false);
        return;
      }
      let auth: SessionData | null = null;
      let account: UserProfile | null = null;
      try { auth = await session(); account = auth.user; await saveProfile(account); setOnlineSession(auth); }
      catch { account = await loadProfile(); }
      if (!account) {
        const solo = createSoloProfile(await loadSoloProfile());
        await saveSoloProfile(solo);
        if (cancelled) return;
        if (reloadNewUser) { waitForNewUser(solo); return; }
        setProfile(solo);
        setComputerBalance(solo.opponentBalance ?? SOLO_BALANCE);
        const state = createInitialGame(Date.now(), preferredDifficulty, preferredPointValue);
        state.mission ??= createCardMission(state.randomSeed);
        setGame(state);
        setStarted(false);
        return;
      }
      const loadedOpponentBalance = (account.opponentBalance ?? 0) > 0 && account.opponentBalance !== SOLO_BALANCE ? account.opponentBalance : randomOpponentBalance();
      if (loadedOpponentBalance !== account.opponentBalance) account = { ...account, opponentBalance: loadedOpponentBalance };
      if (cancelled) return;
      if (reloadNewUser) { waitForNewUser(account); return; }
      setProfile(account);
      setComputerBalance(loadedOpponentBalance);
      const fresh = parameters.get('action') === 'new';
      if (fresh) { const state = createInitialGame(Date.now(), preferredDifficulty, preferredPointValue); setGame(state); setStarted(state.phase === 'round-ended'); navigate('/matgo/play', { replace: true }); await persist(state, account, auth); return; }
      const local = await loadLocalGame(account.id);
      let serverState: GameState | null = null;
      if (auth) { try { const saved = await loadMatgoServerGame(); serverState = saved?.state && isValidGameState(saved.state) ? saved.state : null; } catch { /* 오프라인 저장으로 계속 */ } }
      const state = chooseLatestGame(local?.state && isValidGameState(local.state) ? local.state : null, serverState) ?? createInitialGame(Date.now(), preferredDifficulty, preferredPointValue);
      const difficulty = state.computerDifficulty ?? preferredDifficulty;
      const pointValue = normalizeMatgoPointValue(state.pointValue);
      state.computerDifficulty = difficulty;
      state.pointValue = pointValue;
      state.roundMultiplier ??= 1;
      state.mission ??= createCardMission(state.randomSeed);
      setPreferredDifficulty(difficulty);
      setPreferredPointValue(pointValue);
      saveAiDifficulty(difficulty);
      savePointValue(pointValue);
      setGame(state); setStarted(shouldResumeSavedGame(state)); await persist(state, account, auth);
    })().catch(async () => {
      if (cancelled) return;
      const solo = createSoloProfile(await loadSoloProfile().catch(() => null));
      if (reloadNewUser) { waitForNewUser(solo); return; }
      setProfile(solo);
      setComputerBalance(solo.opponentBalance ?? SOLO_BALANCE);
      const state = createInitialGame(Date.now(), preferredDifficulty, preferredPointValue);
      state.mission ??= createCardMission(state.randomSeed);
      setGame(state);
      setStarted(false);
    });
    return () => {
      cancelled = true;
      initializedRef.current = false;
      if (cancelReloadRef.current) cancelReloadRef.current();
      else if (reloadNewUser) releaseFreshReload();
      cancelReloadRef.current = null;
      if (aiTimerRef.current !== null) window.clearTimeout(aiTimerRef.current);
    };
  }, [location.search, navigate]);

  useEffect(() => {
    if (!started || !game || !profile || busy || dealing || gookjinChoiceOpen || (autoPlay && declaration) || seatRef.current || game.currentPlayer !== 'computer' || game.phase !== 'playing') return;
    const thinking = createAiThinkingPlan(game.computerDifficulty ?? preferredDifficulty, game.randomSeed, game.turnNumber, 'turn', autoPlay);
    setAiThinking(autoPlay ? null : thinking);
    aiTimerRef.current = window.setTimeout(async () => {
      setAiThinking(null);
      setBusy(true);
      const working = structuredClone(game);
      const difficulty = working.computerDifficulty ?? preferredDifficulty;
      const choice = chooseAiMove(working, 'computer', difficulty);
      if (!choice.move) { setBusy(false); return; }
      if (choice.move.kind === 'shake') {
        const next = declareShake(working, 'computer', choice.move.month);
        playShakeSound(opponentVoiceActor);
        showDeclaration('shake', '흔들기!', `상대가 ${choice.move.month}월 세 장을 공개했습니다.`, 1100);
        setGame(next); await persist(next, profile, onlineSession); setBusy(false);
        return;
      }
      let result;
      if (choice.move.kind === 'flip-only') {
        const drawnCardId = nextTableDrawId(working.drawPile);
        const drawnFlight = elementForMatchFlight(floorRef.current, drawnCardId ? matchFlightOnFloor(working.floorCards, drawnCardId) : null);
        await animateCardFlight(deckRef.current, drawnFlight?.element ?? floorRef.current, 8, 260, drawnFlight?.landing);
        playFlipSound();
        result = playFlipOnlyTurn(working, 'computer');
      } else {
        const source = computerHandRef.current?.querySelector('.card-back');
        const bonusMove = choice.move.kind === 'card' && getCard(choice.move.cardId)?.tags.includes('bonus-pee');
        const bombMonth = choice.move.kind === 'bomb' ? choice.move.month : 0;
        const playedCardId = choice.move.kind === 'card'
          ? choice.move.cardId
          : working.floorCards.find(cardId => getCard(cardId)?.month === bombMonth);
        const playedFlight = bonusMove || !playedCardId ? null : elementForMatchFlight(floorRef.current, matchFlightOnFloor(working.floorCards, playedCardId));
        const flightTarget = bonusMove ? document.querySelector('.opponent-rack') : playedFlight?.element ?? floorRef.current;
        await animateCardFlight(source ?? null, flightTarget, 6, 360, playedFlight?.landing);
        if (choice.move.kind === 'bomb') {
          playBombSound(opponentVoiceActor);
          result = playBomb(working, 'computer', choice.move.month);
          const bombEvent = result.specialEvents?.find(event => event.kind === 'bomb');
          const bombStolen = bombEvent?.stolenPee ?? [];
          const mission = result.missionCards?.length ? ` · 미션 ×${result.missionMultiplier ?? 1}` : '';
          showDeclaration('bomb', `${bombEvent?.label ?? '폭탄'}!`, `상대가 패를 한꺼번에 냈습니다.${bombStolen.length ? ` · ${describePeeTransfer(bombStolen, true)}` : ''}${mission}`, 1100);
        } else {
          playCardSound();
          result = playTurn(working, 'computer', choice.move.cardId, { playedMatchId: choice.move.playedMatchId });
        }
      }
      const playedMove = choice.move;
      if (result.replacementCardId) await animateCardFlight(deckRef.current, computerHandRef.current, 8, 240);
      else if (result.drawnCardId && playedMove && playedMove.kind !== 'flip-only') {
        const playedCardId = playedMove.kind === 'card' ? playedMove.cardId : '';
        const bombMonth = playedMove.kind === 'bomb' ? playedMove.month : null;
        const floorAfterBomb = bombMonth === null
          ? null
          : working.floorCards.filter(cardId => getCard(cardId)?.month !== bombMonth);
        const drawnFlight = elementForMatchFlight(floorRef.current, floorAfterBomb
          ? matchFlightOnFloor(floorAfterBomb, result.drawnCardId)
          : drawnMatchFlight(working.floorCards, playedCardId, result.drawnCardId, playedMove.kind === 'card' ? playedMove.playedMatchId : undefined));
        await animateCardFlight(deckRef.current, drawnFlight?.element ?? floorRef.current, 8, 260, drawnFlight?.landing);
        playFlipSound();
      }
      await animateCapturedCardTransfers(result.stolenPee ?? [], document.querySelector('.human-rack'), document.querySelector('.opponent-rack'));
      setGame(result.state);
      const showedBonus = announceBonus(result, opponentVoiceActor, choice.move.kind === 'bomb' ? 620 : 0);
      const scoreEffect = getScoreCelebration(working, result.state, 'computer');
      if (result.ppeok) {
        window.setTimeout(() => {
          const effect = getPpeokDeclaration(result.state.computerPpeokCount);
          playPpeokSound(opponentVoiceActor, effect.count);
          showDeclaration(effect.kind, effect.text, effect.detail, effect.duration);
        }, showedBonus ? 1120 : 190);
      } else if (announceSpecialCapture(result, opponentVoiceActor, showedBonus ? (choice.move.kind === 'bomb' ? 1720 : 1120) : choice.move.kind === 'bomb' ? 1180 : 190)) {
        // 특수 패 선언이 일반 짝 효과를 대신합니다.
      } else if (!showedBonus && choice.move.kind !== 'bomb' && announceMission(result, opponentVoiceActor, 190)) {
        // 미션 성공 선언이 일반 짝 효과를 대신합니다.
      } else if (result.captured.length && choice.move.kind !== 'bomb' && !showedBonus) {
        if (scoreEffect) {
          window.setTimeout(() => playScoreSound(scoreEffect.label, scoreEffect.score, opponentVoiceActor), 190);
          showDeclaration('score', `${scoreEffect.label}!`, `+${scoreEffect.points}점 · 현재 ${scoreEffect.score}점`, 1250);
        } else {
          window.setTimeout(() => playCaptureSound(opponentVoiceActor), 190);
          showDeclaration('capture', '짝!', `${result.captured.length}장을 먹었습니다.`, 620);
        }
      }
      await persist(result.state, profile, onlineSession);
      setBusy(false);
    }, thinking.durationMs);
    return () => { if (aiTimerRef.current !== null) window.clearTimeout(aiTimerRef.current); setAiThinking(null); };
  }, [autoPlay, busy, dealing, autoPlay && declaration, game, gookjinChoiceOpen, onlineSession, preferredDifficulty, profile, started]);

  const playHumanBombSkip = async (autoChooseDraw = false) => {
    if (seatRef.current === 'guest') {
      multiplayer.sendAction({ kind: 'flip-only' });
      return;
    }
    if (!started || !game || !profile || busy || dealing || game.currentPlayer !== 'human' || game.phase !== 'playing' || (game.humanBombSkips ?? 0) <= 0) return;
    if (autoChooseDraw) turnUndo.clear(); else turnUndo.capture(game);
    setBusy(true);
    try {
      const drawChoice = getFlipOnlyDrawChoice(game);
      const upcomingDrawId = nextTableDrawId(game.drawPile);
      const drawnFlight = elementForMatchFlight(floorRef.current, upcomingDrawId ? matchFlightOnFloor(game.floorCards, upcomingDrawId) : null);
      await animateCardFlight(deckRef.current, drawnFlight?.element ?? floorRef.current, -8, 260, drawnFlight?.landing);
      playFlipSound();
      let drawnMatchId: string | undefined;
      if (drawChoice) {
        if (autoChooseDraw) drawnMatchId = chooseAiFloorMatch(drawChoice.candidateIds, game.computerCaptured);
        else {
        drawnMatchId = await new Promise<string>(resolve => {
          drawChoiceResolverRef.current = resolve;
          playDecisionSound();
          setFloorCardChoice({ playedCardId: drawChoice.drawnCardId, candidateIds: drawChoice.candidateIds, source: 'draw' });
          });
          drawChoiceResolverRef.current = null;
        }
      }
      const result = playFlipOnlyTurn(game, 'human', drawnMatchId);
      await animateCapturedCardTransfers(result.stolenPee ?? [], document.querySelector('.opponent-rack'), document.querySelector('.human-rack'));
      setGame(result.state);
      if (!game.humanCaptured.includes('m09-01') && result.state.humanCaptured.includes('m09-01')) { playDecisionSound(); setGookjinChoiceOpen(true); }
      const showedBonus = announceBonus(result);
      const showedSpecial = announceSpecialCapture(result, false, showedBonus ? 1120 : 150);
      const showedMission = !showedBonus && !showedSpecial && announceMission(result, false, 150);
      if (result.captured.length && !showedBonus && !showedSpecial && !showedMission) {
        window.setTimeout(playCaptureSound, 150);
        showDeclaration('capture', '짝!', `${result.captured.length}장을 먹었습니다.`, 620);
      }
      await persist(result.state, profile, onlineSession);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!started || !game || !profile || busy || dealing || gookjinChoiceOpen || (autoPlay && declaration) || seatRef.current || game.phase !== 'awaiting-chongtong' || game.pendingDecision !== 'computer') return;
    const thinking = createAiThinkingPlan(game.computerDifficulty ?? preferredDifficulty, game.randomSeed, game.turnNumber, 'chongtong', autoPlay);
    setAiThinking(autoPlay ? null : thinking);
    aiTimerRef.current = window.setTimeout(async () => {
      setAiThinking(null);
      setBusy(true);
      const working = structuredClone(game);
      const decision = chooseAiChongtong(working, working.computerDifficulty ?? preferredDifficulty);
      const next = chooseChongtong(working, 'computer', decision);
      playChongtongSound(opponentVoiceActor);
      if (decision === 'continue') {
        showDeclaration('shake', '흔들기!', '상대가 총통을 공개했습니다.', 1100);
      } else {
        showDeclaration('stop', '스톱!', '총통으로 7점 승리', 1200);
      }
      setGame(next); await persist(next, profile, onlineSession); setBusy(false);
    }, thinking.durationMs);
    return () => { if (aiTimerRef.current !== null) window.clearTimeout(aiTimerRef.current); setAiThinking(null); };
  }, [autoPlay, busy, dealing, autoPlay && declaration, game, gookjinChoiceOpen, onlineSession, preferredDifficulty, profile, started]);

  useEffect(() => {
    if (!started || !game || !profile || busy || dealing || gookjinChoiceOpen || (autoPlay && declaration) || seatRef.current || game.phase !== 'awaiting-go-stop' || game.pendingDecision !== 'computer') return;
    const thinking = createAiThinkingPlan(game.computerDifficulty ?? preferredDifficulty, game.randomSeed, game.turnNumber, 'go-stop', autoPlay);
    setAiThinking(autoPlay ? null : thinking);
    aiTimerRef.current = window.setTimeout(async () => {
      setAiThinking(null);
      setBusy(true);
      const working = structuredClone(game);
      const difficulty = working.computerDifficulty ?? preferredDifficulty;
      const decision = chooseAiGoStop(working, 'computer', difficulty);
      const next = decision === 'go' ? chooseGo(working, 'computer') : chooseStop(working, 'computer');
      if (decision === 'go') {
        const scoreHeadline = getScoreHeadline(next, 'computer');
        playGoSound(next.computerGoCount, opponentVoiceActor);
        showDeclaration('go', `${next.computerGoCount}고!`, scoreHeadline ? `${scoreHeadline.label} · 현재 ${scoreHeadline.score}점` : '상대가 승부를 계속합니다.', next.computerGoCount >= 5 ? 1800 : 1150);
      } else {
        playStopSound(opponentVoiceActor);
        const settlementEffect = getSettlementCelebration(next, 'computer');
        showDeclaration('settlement', settlementEffect.text, settlementEffect.detail, 1600);
      }
      setGame(next); await persist(next, profile, onlineSession); setBusy(false);
    }, thinking.durationMs);
    return () => { if (aiTimerRef.current !== null) window.clearTimeout(aiTimerRef.current); setAiThinking(null); };
  }, [autoPlay, busy, dealing, autoPlay && declaration, game, gookjinChoiceOpen, onlineSession, preferredDifficulty, profile, started]);

  useEffect(() => {
    if (!started || !game || gookjinChoiceOpen || game.phase !== 'round-ended' || announcedResultRef.current === game.gameUuid) return;
    announcedResultRef.current = game.gameUuid;
    const timer = window.setTimeout(() => {
      if (game.winner === 'human') playWinSound(game.settlement?.finalScore ?? 7, game.humanGoCount);
      else if (game.winner === 'computer') playLoseSound(game.settlement?.baks.map(bak => bak.label) ?? [], opponentVoiceActor);
      else playNagariSound();
    }, 520);
    return () => window.clearTimeout(timer);
  }, [game, gookjinChoiceOpen, started]);

  useEffect(() => {
    if (!started || gookjinChoiceOpen || game?.phase !== 'round-ended') {
      setShowRoundResult(false);
      return;
    }
    setShowRoundResult(false);
    const timer = window.setTimeout(() => setShowRoundResult(true), ROUND_RESULT_REVEAL_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [game?.gameUuid, game?.phase, gookjinChoiceOpen, started]);

  useEffect(() => {
    if (!showRoundResult || !moneyTransfer?.appliedNow || moneyTransfer.amount === 0) return;
    playMoneySound(moneyTransfer.amount > 0);
  }, [moneyTransfer?.amount, moneyTransfer?.appliedNow, showRoundResult]);

  useEffect(() => {
    if (!started || busy || !exitReserved || game?.phase !== 'round-ended' || !showRoundResult) return;
    const timer = window.setTimeout(() => returnToDealerRef.current(), 3000);
    return () => window.clearTimeout(timer);
  }, [busy, exitReserved, game?.phase, showRoundResult, started]);

  useEffect(() => {
    const humanBalance = moneyTransfer?.humanAfter ?? profile?.virtualBalance ?? 0;
    const waitingForRefill = !seatRef.current && humanBalance <= 0;
    if (!autoPlay || !started || busy || exitReserved || exitDialogOpen || waitingForRefill || game?.phase !== 'round-ended' || !showRoundResult) return;
    const timer = window.setTimeout(() => continueAfterRoundRef.current(), 2000);
    return () => window.clearTimeout(timer);
  }, [autoPlay, busy, exitDialogOpen, exitReserved, game?.phase, moneyTransfer?.humanAfter, profile?.virtualBalance, showRoundResult, started]);

  const playHumanCard = async (cardId: string, source: HTMLButtonElement, playedMatchId?: string, autoChooseDraw = false, stateOverride?: GameState) => {
    if (seatRef.current === 'guest') {
      multiplayer.sendAction({ kind: 'play', cardId, playedMatchId });
      return;
    }
    const activeGame = stateOverride ?? game;
    if (!activeGame || !profile || busy || dealing || activeGame.phase !== 'playing' || activeGame.currentPlayer !== 'human') return;
    if (autoChooseDraw) turnUndo.clear(); else turnUndo.capture(activeGame);
    setFloorCardChoice(null);
    setStakeSelectorOpen(false);
    setBusy(true);
    const bonusMove = Boolean(getCard(cardId)?.tags.includes('bonus-pee'));
    const playedFlight = bonusMove ? null : elementForMatchFlight(floorRef.current, matchFlightOnFloor(activeGame.floorCards, cardId));
    const flightTarget = bonusMove ? document.querySelector('.human-rack') : playedFlight?.element ?? floorRef.current;
    await animateCardFlight(source, flightTarget, -7, 320, playedFlight?.landing);
    playCardSound();
    const drawChoice = getDrawFloorChoice(activeGame, cardId, playedMatchId);
    const upcomingDrawId = nextTableDrawId(activeGame.drawPile);
    const drawnFlight = elementForMatchFlight(floorRef.current, drawnMatchFlight(activeGame.floorCards, cardId, upcomingDrawId, playedMatchId));
    let drawnMatchId: string | undefined;
    let drawAnimated = false;
    if (drawChoice) {
      await animateCardFlight(deckRef.current, drawnFlight?.element ?? floorRef.current, 8, 260, drawnFlight?.landing);
      playFlipSound();
      drawAnimated = true;
      if (autoChooseDraw) drawnMatchId = chooseAiFloorMatch(drawChoice.candidateIds, activeGame.computerCaptured);
      else {
        drawnMatchId = await new Promise<string>(resolve => {
          drawChoiceResolverRef.current = resolve;
          playDecisionSound();
          setFloorCardChoice({ playedCardId: drawChoice.drawnCardId, candidateIds: drawChoice.candidateIds, source: 'draw' });
        });
        drawChoiceResolverRef.current = null;
      }
    }
    const result = playTurn(activeGame, 'human', cardId, { playedMatchId, drawnMatchId });
    if (result.replacementCardId) await animateCardFlight(deckRef.current, humanHandRef.current, 8, 240);
    else if (result.drawnCardId && !drawAnimated) {
      await animateCardFlight(deckRef.current, drawnFlight?.element ?? floorRef.current, 8, 260, drawnFlight?.landing);
      playFlipSound();
    }
    await animateCapturedCardTransfers(result.stolenPee ?? [], document.querySelector('.opponent-rack'), document.querySelector('.human-rack'));
    setGame(result.state);
    if (!activeGame.humanCaptured.includes('m09-01') && result.state.humanCaptured.includes('m09-01')) { playDecisionSound(); setGookjinChoiceOpen(true); }
    const showedBonus = announceBonus(result);
    const scoreEffect = getScoreCelebration(activeGame, result.state, 'human');
    if (result.ppeok) {
      window.setTimeout(() => {
        const effect = getPpeokDeclaration(result.state.humanPpeokCount);
        playPpeokSound(false, effect.count);
        showDeclaration(effect.kind, effect.text, effect.detail, effect.duration);
      }, showedBonus ? 1120 : 0);
    } else if (announceSpecialCapture(result, false, showedBonus ? 1120 : 0)) {
      // 특수 패 선언이 일반 짝 효과를 대신합니다.
    } else if (!showedBonus && announceMission(result)) {
      // 미션 성공 선언이 일반 짝 효과를 대신합니다.
    } else if (result.captured.length && !showedBonus) {
      if (scoreEffect) {
        playScoreSound(scoreEffect.label, scoreEffect.score);
        showDeclaration('score', `${scoreEffect.label}!`, `+${scoreEffect.points}점 · 현재 ${scoreEffect.score}점`, 1250);
      } else {
        playCaptureSound();
        showDeclaration('capture', '짝!', `${result.captured.length}장을 먹었습니다.`, 620);
      }
    }
    await persist(result.state, profile, onlineSession);
    setBusy(false);
  };
  const requestHumanCard = (cardId: string, source: HTMLButtonElement) => {
    if (!game || busy || dealing || floorCardChoice || bombChoice || shakeChoice || gookjinChoiceOpen) return;
    const cardMonth = getCard(cardId)?.month;
    const bomb = findBombOptions(game.humanHand, game.floorCards)
      .find(option => option.month === cardMonth);
    if (bomb) {
      playDecisionSound(); setBombChoice({ ...bomb, selectedCardId: cardId });
      return;
    }
    const shake = findShakeOptions(game.humanHand, game.floorCards, game.humanShakenMonths ?? [])
      .find(option => option.month === cardMonth);
    if (shake) {
      playDecisionSound(); setShakeChoice({ month: shake.month, cardIds: shake.handCardIds, selectedCardId: cardId });
      return;
    }
    const candidateIds = getMatchingFloorCards(game.floorCards, cardId);
    if (captureChoiceRequired(candidateIds)) {
      playDecisionSound(); setFloorCardChoice({ playedCardId: cardId, candidateIds, source: 'hand' });
      return;
    }
    void playHumanCard(cardId, source);
  };
  const decideHumanShake = (decision: 'shake' | 'plain') => {
    if (!game || !shakeChoice || busy || dealing) return;
    if (seatRef.current === 'guest') {
      const choice = shakeChoice;
      setShakeChoice(null);
      multiplayer.sendAction(decision === 'shake'
        ? { kind: 'shake', month: choice.month, cardId: choice.selectedCardId }
        : { kind: 'play', cardId: choice.selectedCardId });
      return;
    }
    const choice = shakeChoice;
    const source = humanHandRef.current?.querySelector<HTMLButtonElement>(`button[data-card-id="${choice.selectedCardId}"]`);
    setShakeChoice(null);
    if (!source) return;
    if (decision === 'plain') {
      playCancelSound();
      void playHumanCard(choice.selectedCardId, source);
      return;
    }
    const next = declareShake(game, 'human', choice.month);
    turnUndo.capture(game);
    playShakeSound();
    showDeclaration('shake', '흔들기!', `${choice.month}월 세 장을 공개했습니다.`, 1200);
    setGame(next);
    void playHumanCard(choice.selectedCardId, source, undefined, false, next);
  };
  const selectFloorCard = (floorCardId: string) => {
    if (!floorCardChoice || !floorCardChoice.candidateIds.includes(floorCardId)) return;
    playSelectSound();
    if (floorCardChoice.source === 'draw') {
      if (seatRef.current === 'guest') {
        setFloorCardChoice(null);
        multiplayer.sendAction({ kind: 'draw-choice', cardId: floorCardId });
        return;
      }
      const resolve = drawChoiceResolverRef.current;
      setFloorCardChoice(null);
      resolve?.(floorCardId);
      return;
    }
    const cardId = floorCardChoice.playedCardId;
    const source = humanHandRef.current?.querySelector<HTMLButtonElement>(`button[data-card-id="${cardId}"]`);
    if (!source) { setFloorCardChoice(null); return; }
    void playHumanCard(cardId, source, floorCardId);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || isTextEntryTarget(event.target)) return;
      const cardIndex = handCardIndexFromKey(event.code, event.key);
      if (cardIndex === null || !started || !game || !profile || busy || dealing || floorCardChoice || bombChoice || shakeChoice || gookjinChoiceOpen || exitDialogOpen || game.phase !== 'playing' || game.currentPlayer !== 'human') return;
      const cardId = game.humanHand[cardIndex];
      if (!cardId) return;
      const source = humanHandRef.current?.querySelector<HTMLButtonElement>(`button[data-card-id="${cardId}"]`);
      if (!source || source.disabled) return;
      event.preventDefault();
      requestHumanCard(cardId, source);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [bombChoice, busy, dealing, exitDialogOpen, floorCardChoice, game, gookjinChoiceOpen, profile, shakeChoice, started]);

  const decideGoStop = async (decision: 'go' | 'stop') => {
    if (seatRef.current === 'guest') {
      multiplayer.sendAction({ kind: decision });
      return;
    }
    if (!game || !profile || busy || game.pendingDecision !== 'human') return;
    setBusy(true);
    const next = decision === 'go' ? chooseGo(game, 'human') : chooseStop(game, 'human');
    if (decision === 'go') {
      const scoreHeadline = getScoreHeadline(next, 'human');
      playGoSound(next.humanGoCount);
      showDeclaration('go', `${next.humanGoCount}고!`, scoreHeadline ? `${scoreHeadline.label} · 현재 ${scoreHeadline.score}점` : '승부를 계속합니다.', next.humanGoCount >= 5 ? 1800 : 1150);
    } else {
      playStopSound();
      const settlementEffect = getSettlementCelebration(next, 'human');
      showDeclaration('settlement', settlementEffect.text, settlementEffect.detail, 1600);
    }
    setGame(next); await persist(next, profile, onlineSession);
    setBusy(false);
  };

  const useBomb = async (month: number, allowUndo = true) => {
    if (!game || !profile || busy) return;
    if (allowUndo) turnUndo.capture(game); else turnUndo.clear();
    setBusy(true);
    const result = playBomb(game, 'human', month);
    playBombSound();
    const bombEvent = result.specialEvents?.find(event => event.kind === 'bomb');
    const bombStolen = bombEvent?.stolenPee ?? [];
    const mission = result.missionCards?.length ? ` · 미션 ×${result.missionMultiplier ?? 1}` : '';
    showDeclaration('bomb', `${bombEvent?.label ?? '폭탄'}!`, `${month}월 패를 한꺼번에 냈습니다.${bombStolen.length ? ` · ${describePeeTransfer(bombStolen, false)}` : ''}${mission}`, 1100);
    await animateCapturedCardTransfers(result.stolenPee ?? [], document.querySelector('.opponent-rack'), document.querySelector('.human-rack'));
    setGame(result.state);
    if (!game.humanCaptured.includes('m09-01') && result.state.humanCaptured.includes('m09-01')) { playDecisionSound(); setGookjinChoiceOpen(true); }
    const showedBonus = announceBonus(result, false, 1180);
    announceSpecialCapture(result, false, showedBonus ? 2360 : 1180);
    await persist(result.state, profile, onlineSession); setBusy(false);
  };
  const decideHumanBomb = (decision: 'bomb' | 'plain') => {
    if (!game || !bombChoice || busy || dealing) return;
    if (seatRef.current === 'guest' && decision === 'bomb') {
      setBombChoice(null);
      multiplayer.sendAction({ kind: 'bomb', month: bombChoice.month });
      return;
    }
    const choice = bombChoice;
    const source = humanHandRef.current?.querySelector<HTMLButtonElement>(`button[data-card-id="${choice.selectedCardId}"]`);
    setBombChoice(null);
    if (!source) return;
    if (decision === 'bomb') {
      void useBomb(choice.month);
      return;
    }
    playCancelSound();
    const candidateIds = getMatchingFloorCards(game.floorCards, choice.selectedCardId);
    if (captureChoiceRequired(candidateIds)) {
      playDecisionSound(); setFloorCardChoice({ playedCardId: choice.selectedCardId, candidateIds, source: 'hand' });
      return;
    }
    void playHumanCard(choice.selectedCardId, source);
  };

  const declareHumanShake = async (month: number) => {
    if (!game || !profile || busy) return;
    turnUndo.clear();
    setBusy(true);
    try {
      const next = declareShake(game, 'human', month);
      playShakeSound();
      showDeclaration('shake', '흔들기!', `${month}월 세 장을 공개했습니다. 이제 셋 중 한 장을 내세요.`, 1200);
      setGame(next);
      await persist(next, profile, onlineSession);
    }
    finally { setBusy(false); }
  };

  const decideChongtong = async (decision: 'continue' | 'stop') => {
    if (seatRef.current === 'guest') {
      multiplayer.sendAction({ kind: 'chongtong', decision });
      return;
    }
    if (!game || !profile || busy || game.pendingDecision !== 'human') return;
    setBusy(true);
    const next = chooseChongtong(game, 'human', decision);
    playChongtongSound();
    if (decision === 'continue') {
      showDeclaration('shake', '흔들기!', '총통을 공개하고 계속합니다.', 1100);
    } else {
      showDeclaration('stop', '스톱!', '총통으로 7점 승리', 1200);
    }
    setGame(next); await persist(next, profile, onlineSession);
    setBusy(false);
  };

  const decideGookjin = async (asDoubleJunk: boolean) => {
    if (seatRef.current === 'guest') {
      multiplayer.sendAction({ kind: 'gookjin', asDoubleJunk });
      return;
    }
    if (!game || !profile) return;
    setBusy(true);
    try {
      const next = setGookjinChoice(game, 'human', asDoubleJunk);
      playGookjinSound(asDoubleJunk);
      setGame(next); setGookjinChoiceOpen(false); await persist(next, profile, onlineSession);
    }
    finally { setBusy(false); }
  };

  const start = async () => {
    await unlockAudio(); playStartSound(); setStarted(true);
    if (!game?.turnNumber) showDealAnimation();
  };
  const selectStartingPlayer = async (player: 'human' | 'computer') => {
    if (!game || !profile || busy || game.startingPlayerConfirmed !== false) return;
    setOpponentLeft(false);
    setSeatChangeNotice('');
    setBusy(true);
    try {
      await unlockAudio();
      const next = chooseStartingPlayer(game, player);
      playStartSound();
      setGame(next);
      setStarted(true);
      showDealAnimation();
      await persist(next, profile, onlineSession);
    }
    finally { setBusy(false); }
  };
  const changeAudioSettings = (next: AudioSettings) => {
    setAudioSettings(next);
    applyAudioSettings(next);
    saveAudioSettings(next);
    if (!next.muted) unlockAudio().catch(() => undefined);
  };
  const createFreshRound = async (startingPlayer?: 'human' | 'computer', accountOverride?: UserProfile) => {
    if (seatRef.current === 'guest') {
      multiplayer.sendAction({ kind: 'next', seed: Date.now() });
      return;
    }
    const account = accountOverride ?? profile;
    if (!account) return;
    setBusy(true);
    if (declarationTimerRef.current !== null) window.clearTimeout(declarationTimerRef.current);
    setDeclaration(null);
    const state = createInitialGame(Date.now(), preferredDifficulty, preferredPointValue, startingPlayer, nextRoundMultiplier(game?.roundResult, game?.roundMultiplier));
    turnUndo.clear();
    setGame(state);
    setStarted(Boolean(startingPlayer) || state.phase === 'round-ended');
    setFloorCardChoice(null);
    setBombChoice(null);
    setShakeChoice(null);
    setGookjinChoiceOpen(false);
    setStakeSelectorOpen(false);
    setExitReserved(false);
    setMoneyTransfer(null);
    if (startingPlayer) {
      playStartSound();
      showDealAnimation();
    }
    try { await persist(state, account, onlineSession); }
    finally { setBusy(false); }
  };
  const refillEmptyBalance = async () => {
    if (!profile || busy || seatRef.current) return;
    setBusy(true);
    try {
      const refilled = soloModeRef.current || profile.id === SOLO_USER_ID
        ? { ...profile, virtualBalance: SOLO_BALANCE }
        : { ...profile, virtualBalance: (await refillBalance()).balance };
      setProfile(refilled);
      setMoneyTransfer(null);
      if (soloModeRef.current || profile.id === SOLO_USER_ID) await saveSoloProfile(refilled);
      else await saveProfile(refilled);
      if (game?.phase === 'round-ended') await createFreshRound(undefined, refilled);
    }
    finally { setBusy(false); }
  };
  const startFreshRound = () => createFreshRound(game?.startingPlayerConfirmed ? game.startingPlayer : undefined);
  const continueAfterRound = async () => {
    if (busy || exitReserved) return;
    if (seatRef.current === 'guest') {
      multiplayer.sendAction({ kind: 'next', seed: Date.now() });
      return;
    }
    if (!seatRef.current) {
      const change = finishPlayerSeat();
      if (change.leaving) {
        const nextBalance = randomOpponentBalance();
        const nextProfile = profile ? { ...profile, opponentBalance: nextBalance } : profile;
        setSeatChangeNotice(`${change.leftName} 님이 나갔습니다. ${change.nextName} 님이 들어왔습니다.`);
        setComputerBalance(nextBalance);
        if (nextProfile) {
          setProfile(nextProfile);
          if (soloModeRef.current || nextProfile.id === SOLO_USER_ID) await saveSoloProfile(nextProfile);
          else await saveProfile(nextProfile);
        }
        await createFreshRound(undefined, nextProfile ?? undefined);
        return;
      }
    }
    await createFreshRound(game?.winner ?? game?.startingPlayer);
  };
  continueAfterRoundRef.current = () => { void continueAfterRound(); };
  const selectDifficulty = async (difficulty: AiDifficulty) => {
    if (!game || !profile || busy) return;
    setPreferredDifficulty(difficulty);
    saveAiDifficulty(difficulty);
    const next = structuredClone(game);
    next.computerDifficulty = difficulty;
    setGame(next);
    await persist(next, profile, onlineSession);
  };
  const cycleDifficulty = () => {
    const current = game?.computerDifficulty ?? preferredDifficulty;
    const nextIndex = (AI_DIFFICULTY_ORDER.indexOf(current) + 1) % AI_DIFFICULTY_ORDER.length;
    void selectDifficulty(AI_DIFFICULTY_ORDER[nextIndex]);
  };
  const selectPointValue = async (pointValue: MatgoPointValue) => {
    if (!game || !profile || busy || game.phase === 'round-ended') return;
    setStakeSelectorOpen(false);
    setPreferredPointValue(pointValue);
    savePointValue(pointValue);
    const roundInProgress = started && game.startingPlayerConfirmed !== false;
    if (roundInProgress) return;
    setBusy(true);
    try {
      const next = setPointValue(game, pointValue);
      setGame(next);
      await persist(next, profile, onlineSession);
    }
    finally { setBusy(false); }
  };
  const newRound = async () => {
    if (!confirm('지금 판을 덮고 새 판을 시작할까요?')) return;
    await startFreshRound();
  };
  const reserveExit = () => {
    setExitDialogOpen(false);
    setExitReserved(true);
  };
  const leaveNow = () => {
    if (!game || !profile) return;
    setOpponentLeft(false);
    setExitDialogOpen(false);
    setExitReserved(false);
    setAutoPlay(false);
    const leavingRoom = Boolean(seatRef.current) || new URLSearchParams(location.search).get('multi') === '1';
    if (seatRef.current) {
      multiplayer.leave();
      seatRef.current = null;
    }
    void (async () => {
      await createFreshRound();
      if (leavingRoom) navigate('/matgo/play?solo=1', { replace: true });
    })();
  };
  returnToDealerRef.current = leaveNow;
  const idleExitRef = useRef<() => void>(() => {});
  idleExitRef.current = () => {
    setOpponentLeft(true);
    setNameEditorOpen(false);
    setExitDialogOpen(false);
    setExitReserved(false);
    setAutoPlay(false);
    void createFreshRound();
  };
  const idleKey = game ? manualIdleKey({
    started,
    autoPlay,
    multiplayer: Boolean(seatRef.current),
    dealing,
    menuOpen: nameEditorOpen || exitDialogOpen,
    phase: game.phase,
    currentPlayer: game.currentPlayer,
    pendingDecision: game.pendingDecision,
    turnNumber: game.turnNumber,
    choosing: Boolean(floorCardChoice || bombChoice || shakeChoice || gookjinChoiceOpen)
  }) : '';
  useEffect(() => {
    if (!idleKey) return;
    const timer = window.setTimeout(() => idleExitRef.current(), MANUAL_IDLE_MS);
    return () => window.clearTimeout(timer);
  }, [idleKey]);

  const toggleAutoPlay = () => {
    if (!started || !game) return;
    const next = !autoPlay;
    setAutoPlay(next);
    if (next) void unlockAudio().then(() => playAutoPlaySound(true));
    else playAutoPlaySound(false);
  };

  useEffect(() => {
    if (seatRef.current || !autoPlay || !started || !game || !profile || busy || dealing || declaration || exitDialogOpen || floorCardChoice || bombChoice || shakeChoice || game.phase === 'round-ended') return;
    autoPlayTimerRef.current = window.setTimeout(() => {
      if (gookjinChoiceOpen) {
        void decideGookjin(chooseAiGookjinAsDoubleJunk(game.humanCaptured));
        return;
      }
      if (game.phase === 'awaiting-go-stop' && game.pendingDecision === 'human') {
        void decideGoStop(chooseAiGoStop(structuredClone(game), 'human', 'hard'));
        return;
      }
      if (game.phase === 'awaiting-chongtong' && game.pendingDecision === 'human') {
        void decideChongtong(chooseAiChongtong(structuredClone(game), 'hard'));
        return;
      }
      if (game.phase !== 'playing' || game.currentPlayer !== 'human') return;
      const choice = chooseAiMove(structuredClone(game), 'human', 'hard');
      if (!choice.move) return;
      if (choice.move.kind === 'flip-only') {
        void playHumanBombSkip(true);
        return;
      }
      if (choice.move.kind === 'bomb') {
        void useBomb(choice.move.month, false);
        return;
      }
      if (choice.move.kind === 'shake') {
        void declareHumanShake(choice.move.month);
        return;
      }
      const source = humanHandRef.current?.querySelector<HTMLButtonElement>(`button[data-card-id="${choice.move.cardId}"]`);
      if (source) void playHumanCard(choice.move.cardId, source, choice.move.playedMatchId, true);
    }, 1200);
    return () => {
      if (autoPlayTimerRef.current !== null) window.clearTimeout(autoPlayTimerRef.current);
      autoPlayTimerRef.current = null;
    };
  }, [autoPlay, bombChoice, busy, dealing, declaration, exitDialogOpen, floorCardChoice, game, gookjinChoiceOpen, profile, shakeChoice, started]);

  useEffect(() => {
    if (!multiplayer.seat) return;
    const mine = multiplayer.seat === 'host' ? multiplayer.names.host : multiplayer.names.guest;
    if (!mine) return;
    setProfile(current => current && current.displayName !== mine ? { ...current, displayName: mine } : current);
  }, [multiplayer.names.guest, multiplayer.names.host, multiplayer.seat]);

  useEffect(() => {
    if (multiplayer.seat !== 'host' || multiplayer.status !== 'ready' || dealtRef.current || gameRef.current) return;
    dealtRef.current = true;
    const state = createInitialGame(Date.now(), preferredDifficulty, preferredPointValue);
    setGame(state);
    setStarted(false);
  }, [multiplayer.seat, multiplayer.status, preferredDifficulty, preferredPointValue]);

  useEffect(() => {
    if (multiplayer.seat !== 'host' || !game) return;
    multiplayer.sendState(game);
  }, [game, multiplayer.seat, multiplayer.sendState]);

  useEffect(() => {
    if (multiplayer.seat !== 'guest' || !multiplayer.incomingState) return;
    setGame(multiplayer.incomingState);
    setStarted(multiplayer.incomingState.startingPlayerConfirmed !== false || multiplayer.incomingState.phase === 'round-ended');
  }, [multiplayer.incomingState, multiplayer.seat]);

  useEffect(() => {
    if (multiplayer.seat !== 'guest' || !multiplayer.choiceRequest) return;
    playDecisionSound();
    setFloorCardChoice({
      playedCardId: multiplayer.choiceRequest.drawnCardId,
      candidateIds: multiplayer.choiceRequest.candidateIds,
      source: 'draw'
    });
  }, [multiplayer.choiceRequest, multiplayer.seat]);

  useEffect(() => {
    if (multiplayer.seat !== 'host' || !multiplayer.incomingAction) return;
    const current = gameRef.current;
    if (!current || handledActionRef.current === multiplayer.incomingAction.id) return;
    handledActionRef.current = multiplayer.incomingAction.id;
    try {
      const result = applyGuestAction(current, multiplayer.incomingAction.action, pendingGuestRef.current);
      if (result.type === 'choice') {
        pendingGuestRef.current = result.pending;
        multiplayer.sendChoiceRequest(result.choice);
      } else {
        pendingGuestRef.current = null;
        setGame(result.state);
        setStarted(result.state.startingPlayerConfirmed !== false || result.state.phase === 'round-ended');
      }
    } catch {
      pendingGuestRef.current = null;
    }
    multiplayer.clearAction();
  }, [multiplayer.incomingAction, multiplayer.seat, multiplayer.clearAction, multiplayer.sendChoiceRequest]);

  if (!profile) return <Loading />;
  if (multiplayer.enabled && !game) {
    if (multiplayer.status === 'waiting') return <main className="multiplayer-waiting"><div><p>상대가 들어올 때까지 기다려 주세요</p><strong>{multiplayer.code}</strong>{multiplayer.addresses.length > 0 && <p>{multiplayer.addresses.map(ip => `http://${ip}:${window.location.port || '5234'}/matgo/play?multi=1`).join(' · ')}</p>}</div></main>;
    if (multiplayer.status === 'ready') return <Loading />;
    return <MultiplayerLobby error={multiplayer.error} addresses={multiplayer.addresses} onCreate={multiplayer.createRoom} onJoin={multiplayer.joinRoom} onSolo={() => navigate('/matgo/play?solo=1')} />;
  }
  if (!game || !profile) return <Loading />;
  const opponentLabel = multiplayer.seat === 'host' ? (multiplayer.names.guest || '상대') : multiplayer.seat === 'guest' ? (multiplayer.names.host || '상대') : opponentName;
  const humanScore = calculateCapturedScore(game.humanCaptured, { gookjinAsDoubleJunk: game.humanGookjinAsDoubleJunk }).total;
  const computerScore = calculateCapturedScore(game.computerCaptured, { gookjinAsDoubleJunk: game.computerGookjinAsDoubleJunk }).total;
  const computerDifficulty = game.computerDifficulty ?? preferredDifficulty;
  const pointValue = normalizeMatgoPointValue(game.pointValue);
  const roundInProgress = started && game.startingPlayerConfirmed !== false && game.phase !== 'round-ended';
  const nextPointValue = normalizeMatgoPointValue(preferredPointValue);
  const pointValuePending = roundInProgress && nextPointValue !== pointValue;
  const balanceEmpty = (moneyTransfer?.humanAfter ?? profile.virtualBalance) <= 0;
  const pendingStopSettlement = game.phase === 'awaiting-go-stop' && game.pendingDecision
    ? chooseStop(game, game.pendingDecision).settlement
    : null;
  const showPlayHints = started && !busy && !dealing && !floorCardChoice && !bombChoice && !shakeChoice && !gookjinChoiceOpen && game.phase === 'playing' && game.currentPlayer === 'human';
  return <div className={viewportFit.className} style={viewportFit.style}>
    {multiplayer.seat && <p className="multiplayer-banner">같이 하기 {multiplayer.code}{multiplayer.error ? ` · ${multiplayer.error}` : ''}</p>}
    <main className="game-table">
      <section className="game-field">
        {dealing && <DealAnimation />}
        <button
          type="button"
          className="game-stake"
          data-point-value={pointValue}
          aria-label={`점당 ${pointValue.toLocaleString('ko-KR')}냥${pointValuePending ? `, 다음 판부터 ${nextPointValue.toLocaleString('ko-KR')}냥` : ''}${(game.roundMultiplier ?? 1) > 1 ? `, 나가리 이월 ${game.roundMultiplier}배` : ''}, 눌러서 변경`}
          aria-expanded={stakeSelectorOpen}
          disabled={busy || dealing || game.phase === 'round-ended'}
          onClick={() => setStakeSelectorOpen(open => !open)}
        ><b>점 {pointValue.toLocaleString('ko-KR')}냥{(game.roundMultiplier ?? 1) > 1 ? ` · 나가리 ×${game.roundMultiplier}` : ''}</b><span>{pointValuePending ? `다음 판 ${nextPointValue.toLocaleString('ko-KR')} ▾` : '변경 ▾'}</span></button>
        {stakeSelectorOpen && <StakeQuickSelector
          value={roundInProgress ? nextPointValue : pointValue}
          appliesNextRound={roundInProgress}
          disabled={busy || dealing}
          onChange={value => void selectPointValue(value)}
          onClose={() => setStakeSelectorOpen(false)}
        />}
        <UndoTurnButton
          remaining={remainingTurnUndos(game)}
          disabled={Boolean(multiplayer.seat) || !turnUndo.canUndo(game) || busy || dealing || autoPlay || Boolean(floorCardChoice) || Boolean(bombChoice) || Boolean(shakeChoice)}
          onUndo={() => void undoLastTurn()}
        />
        <TableScoreBadge key={`computer-${computerScore}-${game.computerGoCount}-${game.computerShakeCount}`} owner="computer" score={computerScore} goCount={game.computerGoCount}
          shakeMultiplierCount={game.computerShakeCount ?? 0} bombCount={game.computerBombCount ?? 0} />
        <div className="computer-hand" ref={computerHandRef} aria-label={`${multiplayer.seat ? '상대' : '컴퓨터'} 패 ${game.computerHand.length}장`}>
          {game.computerHand.map(card => <div className="card-back" key={card}><span>花</span></div>)}
          <b className="hand-count">{game.computerHand.length}</b>
        </div>
        <CapturedCardRack cardIds={game.computerCaptured} owner="opponent" gookjinAsDoubleJunk={game.computerGookjinAsDoubleJunk} />

        <section className={`floor-zone${floorCardChoice ? ' floor-choice-active' : ''}`}>
          <div className="draw-pile" ref={deckRef}><div className="card-back deck-back"><span>花</span></div><b>{game.drawPile.length}</b></div>
          <div ref={floorRef} className="floor-card-field"><FloorCardField
            cardIds={game.floorCards}
            choice={floorCardChoice}
            disabled={busy && floorCardChoice?.source !== 'draw'}
            onSelect={selectFloorCard}
            onCancel={() => { playCancelSound(); setFloorCardChoice(null); }}
          /></div>
        </section>
        {aiThinking && game.phase === 'playing' && <AiThinkingIndicator plan={aiThinking} placement="board" />}

        <TableScoreBadge key={`human-${humanScore}-${game.humanGoCount}-${game.humanShakeCount}`} owner="human" score={humanScore} goCount={game.humanGoCount}
          shakeMultiplierCount={game.humanShakeCount ?? 0} bombCount={game.humanBombCount ?? 0} />
        <CapturedCardRack
          cardIds={game.humanCaptured}
          owner="human"
          gookjinAsDoubleJunk={game.humanGookjinAsDoubleJunk}
          onToggleGookjin={() => { playDecisionSound(); setGookjinChoiceOpen(true); }}
        />
        {bombChoice && <BombDecisionPanel
          month={bombChoice.month}
          kind={bombChoice.kind}
          handCardIds={bombChoice.handCardIds}
          floorCardIds={bombChoice.floorCardIds}
          selectedCardId={bombChoice.selectedCardId}
          disabled={busy || dealing}
          onDecision={decideHumanBomb}
        />}
        {shakeChoice && <ShakeDecisionPanel
          month={shakeChoice.month}
          cardIds={shakeChoice.cardIds}
          selectedCardId={shakeChoice.selectedCardId}
          disabled={busy || dealing}
          onDecision={decideHumanShake}
        />}
        {gookjinChoiceOpen && game.humanCaptured.includes('m09-01') && <GookjinDecisionPanel
          currentAsDoubleJunk={game.humanGookjinAsDoubleJunk}
          disabled={busy}
          onDecision={asDoubleJunk => void decideGookjin(asDoubleJunk)}
        />}
        {game.phase === 'awaiting-go-stop' && game.pendingDecision && <GoStopDecisionPanel
          owner={game.pendingDecision}
          score={game.pendingDecision === 'human' ? humanScore : computerScore}
          nextGoCount={(game.pendingDecision === 'human' ? game.humanGoCount : game.computerGoCount) + 1}
          stopScore={pendingStopSettlement?.finalScore ?? (game.pendingDecision === 'human' ? humanScore : computerScore)}
          stopAmount={pendingStopSettlement?.displayAmount ?? 0}
          opponentBalance={game.pendingDecision === 'human' ? computerBalance : undefined}
          disabled={busy}
          onDecision={game.pendingDecision === 'human' ? decision => void decideGoStop(decision) : undefined}
        />}
        {game.phase === 'awaiting-chongtong' && game.pendingDecision === 'human' && <ChongtongDecisionPanel
          cardIds={game.humanHand}
          month={game.chongtongMonth}
          disabled={busy}
          onDecision={decision => void decideChongtong(decision)}
        />}
      </section>

      <aside className="game-side-rail">
        <GamePlayerPanel name={opponentLabel} balance={computerBalance} active={game.currentPlayer === 'computer'} first={game.startingPlayerConfirmed !== false && game.startingPlayer === 'computer'} />
        {game.mission && <CardMissionPanel placement="side" mission={game.mission} humanCaptured={game.humanCaptured} computerCaptured={game.computerCaptured} />}
        <div className="rail-command-panel">
          {!multiplayer.seat && <DifficultySelector compact value={computerDifficulty} disabled={busy || dealing} onChange={difficulty => void selectDifficulty(difficulty)} />}
          {!multiplayer.seat && <button type="button" className="mobile-difficulty-cycle" data-difficulty={computerDifficulty} aria-label={`컴퓨터 난이도 ${aiDifficultyLabel(computerDifficulty)}, 눌러서 바꾸기`} disabled={busy || dealing} onClick={cycleDifficulty}>
            <b>{aiDifficultyLabel(computerDifficulty)}</b><small>눌러서 바꾸기</small>
          </button>}
          <div className="side-actions">
            {!multiplayer.seat && <button type="button" onClick={() => navigate('/matgo/play?multi=1')}>같이 하기</button>}
            <button type="button" disabled={busy || dealing || balanceEmpty} onClick={newRound}>새 판</button>
            <button type="button" className={exitReserved ? 'exit-reserved' : ''} disabled={busy || dealing || exitReserved} onClick={() => setExitDialogOpen(true)}>{exitReserved ? '나가기 예약됨' : '나가기'}</button>
          </div>
          <AudioControls compact settings={audioSettings} onChange={changeAudioSettings} />
        </div>
        <GamePlayerPanel name={profile.displayName} balance={profile.virtualBalance} human active={game.currentPlayer === 'human'} first={game.startingPlayerConfirmed !== false && game.startingPlayer !== 'computer'} profileImageUrl={profile.profileImageUrl} onProfileImageChange={profileImage.upload} profileImageUploading={profileImage.uploading} onNameClick={multiplayer.seat ? undefined : () => setNameEditorOpen(true)} />
      </aside>

      <div className="human-play-dock">
        <HumanHandRow
          ref={humanHandRef}
          cardIds={game.humanHand}
          floorCardIds={game.floorCards}
          bombSkips={game.humanBombSkips ?? 0}
          shakenMonths={game.humanShakenMonths ?? []}
          requiredMonth={game.humanPendingShakeMonth ?? null}
          showHints={showPlayHints}
          disabled={!showPlayHints}
          flipOnlyDisabled={!showPlayHints || Boolean(game.humanPendingShakeMonth)}
          confirmTouchPlay={discardConfirmation}
          selectedCardId={bombChoice?.selectedCardId ?? shakeChoice?.selectedCardId ?? (floorCardChoice?.source === 'hand' ? floorCardChoice.playedCardId : null)}
          onPlay={requestHumanCard}
          onFlipOnly={() => void playHumanBombSkip()}
        />
        <div className="hand-auto-zone">
          <DiscardConfirmationToggle enabled={discardConfirmation} onChange={setDiscardConfirmation} />
          <AutoPlayButton
            active={autoPlay}
            disabled={Boolean(multiplayer.seat) || !started || (!autoPlay && (game.phase === 'round-ended' || busy || dealing || Boolean(floorCardChoice)))}
            onToggle={toggleAutoPlay}
          />
        </div>
      </div>
    </main>
    {opponentWait ? <div className="starting-player-overlay"><section><h1>상대방을 기다리고 있습니다</h1><p>새 사용자가 들어오면 패를 고릅니다.</p></section></div> : !started && game.startingPlayerConfirmed === false && game.phase !== 'round-ended' && multiplayer.seat === 'guest' ? <div className="starting-player-overlay"><section><h1>상대가 선을 고르고 있습니다</h1><p>방 코드 {multiplayer.code}</p></section></div> : !started && game.startingPlayerConfirmed === false && game.phase !== 'round-ended' ? <div className="starting-player-overlay"><section>
      <p className="eyebrow">새 판 · 선 정하기</p>
      {opponentLeft && <p className="opponent-left-notice" role="alert">상대방이 나갔습니다.</p>}
      {seatChangeNotice && <p className="opponent-left-notice" role="alert">{seatChangeNotice}</p>}
      <h1>바닥의 패를 고르세요</h1>
      <p>한 장을 뒤집으면 선공과 후공이 정해집니다.</p>
      <div className="dealer-selection-layout">
        <div className="dealer-point-value"><PointValueSelector value={pointValue} disabled={busy} onChange={value => void selectPointValue(value)} /></div>
        <StartingPlayerChoice seed={game.randomSeed} disabled={busy} onSelect={player => void selectStartingPlayer(player)} onReveal={player => playDealerResultSound(player === 'computer' ? opponentVoiceActor : 'player')} onExit={leaveNow} />
        <div className="dealer-difficulty"><DifficultySelector value={computerDifficulty} onChange={difficulty => void selectDifficulty(difficulty)} /></div>
      </div>
    </section></div> : !started && <div className="start-overlay"><div><span className="start-logo">가족화투</span><>
      <p className="eyebrow">시원한 손맛 효과음 준비 완료</p>
      <h1>{game.turnNumber ? '이어서 칠까요?' : '패를 받고 시작하세요'}</h1>
      <p>게임 시작을 누르면 패 치는 소리와 미리 생성한 AI 선언 음성이 재생됩니다. 난이도는 이번 판에 저장됩니다.</p>
      <DifficultySelector value={computerDifficulty} onChange={difficulty => void selectDifficulty(difficulty)} />
      <button className="start-button" onClick={start}>게임 시작</button>
    </></div></div>}
    {balanceEmpty && !multiplayer.seat && !(started && game.phase === 'round-ended' && showRoundResult) && <div className="round-result-overlay"><section className="round-result-card" role="dialog" aria-label="게임머니 리필">
      <p className="result-question balance-empty-notice">게임머니가 0냥입니다.</p>
      <AppInstallPrompt />
      <CustomerBoardLink />
      <button type="button" className="result-new-button refill-home-button" disabled={busy} onClick={() => void refillEmptyBalance()}>{REFILL_RECONNECT_MESSAGE}</button>
    </section></div>}
    {started && game.phase === 'round-ended' && showRoundResult && <RoundResultOverlay game={game} opponentName={opponentName} exitReserved={exitReserved} moneyTransfer={moneyTransfer} balanceEmpty={balanceEmpty && !multiplayer.seat} autoPlay={autoPlay} disabled={busy} onContinue={() => void continueAfterRound()} onExit={leaveNow} onReturnHome={leaveNow} onRefill={() => void refillEmptyBalance()} />}
    {exitDialogOpen && <ExitChoiceDialog onReserve={reserveExit} onImmediate={leaveNow} onCancel={() => setExitDialogOpen(false)} guide="이번 판을 마친 뒤 돌아가거나, 지금 바닥의 패를 고르는 화면으로 돌아갈 수 있습니다." immediateDescription="바닥의 패를 고르는 화면으로 돌아갑니다" />}
    {declaration && <GameDeclarationOverlay key={declaration.id} effect={declaration} />}
    {nameEditorOpen && <NameEditDialog name={profile.displayName} onClose={() => setNameEditorOpen(false)} onSave={name => {
      setProfile(current => {
        if (!current) return current;
        const next = { ...current, displayName: name };
        void (next.id === SOLO_USER_ID ? saveSoloProfile(next) : saveProfile(next));
        return next;
      });
      setNameEditorOpen(false);
    }} />}
  </div>;
}
