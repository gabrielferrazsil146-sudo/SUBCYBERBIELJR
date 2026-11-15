import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Coins,
  Dumbbell,
  KeyRound,
  Lock,
  LogOut,
  MapPin,
  Play,
  RotateCcw,
  ShieldCheck,
  Shirt,
  Sliders,
  Trophy,
} from 'lucide-react';
import { AuthGateModal, type RememberedAccountHint } from './components/AuthGateModal';
import { GameCanvas } from './components/GameCanvas';
import { LeaderboardTable } from './components/LeaderboardTable';
import { SettingsModal } from './components/SettingsModal';
import { VerifiedBadge } from './components/VerifiedBadge';
import { WardrobeModal } from './components/WardrobeModal';
import {
  COSMETIC_ITEMS,
  DEFAULT_LOADOUT,
  MAPS,
  getMapById,
} from './data/catalog';
import type {
  CosmeticSlot,
  EquippedLoadout,
  GameMode,
  GameOverPayload,
  GraphicsSettings,
  LeaderboardEntry,
  MapId,
  PlayMode,
  PlayerClaimResponse,
  PlayerSessionResponse,
  VerifiedRole,
} from './types/game';
import { soundEngine } from './utils/audio';
import { formatTimeFull, formatTimePrecise } from './utils/format';

const STORAGE_KEYS = {
  playerToken: 'cybersurfers_player_token',
  playerName: 'cybersurfers_player_name',
  bestTimeMs: 'cybersurfers_best_time_ms',
  loadout: 'cybersurfers_loadout',
  settings: 'cybersurfers_settings',
  mapId: 'cybersurfers_map_id',
  accountBackups: 'cybersurfers_account_backups_v1',
};

// Clear legacy client-side password flags so old password holders lose access immediately
try {
  localStorage.removeItem('cybersurfers_adm_unlocked');
  localStorage.removeItem('cybersurfers_player_unlocked');
} catch {}

interface StoredBackupMap {
  [uniqueKey: string]: {
    playerName: string;
    token: string;
  };
}

function generateFreshToken(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `cs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function getOrCreatePlayerToken(): string {
  try {
    const existing = localStorage.getItem(STORAGE_KEYS.playerToken);
    if (existing && existing.length >= 6) return existing;
    const generated = generateFreshToken();
    localStorage.setItem(STORAGE_KEYS.playerToken, generated);
    return generated;
  } catch {
    return generateFreshToken();
  }
}

const HOMOGLYPH_MAP: Record<string, string> = {
  а: 'a',
  е: 'e',
  ё: 'e',
  і: 'i',
  ї: 'i',
  о: 'o',
  р: 'p',
  с: 'c',
  у: 'y',
  х: 'x',
  к: 'k',
  м: 'm',
  н: 'h',
  т: 't',
  в: 'b',
};

function toUniqueKey(name: string): string {
  const mapped = name
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '')
    .toLowerCase()
    .split('')
    .map((ch) => HOMOGLYPH_MAP[ch] ?? ch)
    .join('');

  return mapped
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/0/g, 'o')
    .replace(/[^a-z0-9]/g, '');
}

function loadBackupMap(): StoredBackupMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.accountBackups);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const valid: StoredBackupMap = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (
        v &&
        typeof v === 'object' &&
        typeof (v as { playerName?: unknown }).playerName === 'string' &&
        typeof (v as { token?: unknown }).token === 'string'
      ) {
        valid[k] = {
          playerName: (v as { playerName: string }).playerName,
          token: (v as { token: string }).token,
        };
      }
    }
    return valid;
  } catch {
    return {};
  }
}

function saveAccountBackup(playerName: string, token: string): StoredBackupMap {
  const key = toUniqueKey(playerName);
  const current = loadBackupMap();
  if (!key || !token) return current;
  const next: StoredBackupMap = {
    ...current,
    [key]: { playerName, token },
  };
  try {
    localStorage.setItem(STORAGE_KEYS.accountBackups, JSON.stringify(next));
  } catch {}
  return next;
}

function getBackupTokensList(): string[] {
  return Object.values(loadBackupMap()).map((item) => item.token);
}

function getRememberedHints(): RememberedAccountHint[] {
  return Object.entries(loadBackupMap()).map(([uniqueKey, val]) => ({
    uniqueKey,
    playerName: val.playerName,
  }));
}

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...JSON.parse(raw) };
  } catch {
    return fallback;
  }
}

function sanitizeLoadout(
  raw: EquippedLoadout,
  admUnlocked: boolean,
  bestTimeMs: number
): EquippedLoadout {
  const bestSec = Math.floor(bestTimeMs / 1000);
  const canUse = (itemId: string | null, slot: CosmeticSlot): boolean => {
    if (!itemId) return false;
    const item = COSMETIC_ITEMS.find((c) => c.id === itemId && c.slot === slot);
    if (!item) return false;
    if (item.unlockSource === 'default') return true;
    if (item.unlockSource === 'record') return bestSec >= (item.requiredTimeSec ?? 0);
    if (item.unlockSource === 'adm' || item.unlockSource === 'player') return admUnlocked;
    return false;
  };

  return {
    suit: canUse(raw.suit, 'suit') ? raw.suit : DEFAULT_LOADOUT.suit,
    cape: canUse(raw.cape, 'cape') ? raw.cape : null,
    hair: canUse(raw.hair, 'hair') ? raw.hair : null,
    eyewear: canUse(raw.eyewear, 'eyewear') ? raw.eyewear : null,
    headband: canUse(raw.headband, 'headband') ? raw.headband : null,
    aura: canUse(raw.aura, 'aura') ? raw.aura : null,
    weapon: canUse(raw.weapon, 'weapon') ? raw.weapon : null,
  };
}

export default function App() {
  const [mode, setMode] = useState<GameMode>('lobby');
  const [playMode, setPlayMode] = useState<PlayMode>('normal');
  const [runKey, setRunKey] = useState(0);

  const [playerToken, setPlayerToken] = useState<string>(() => getOrCreatePlayerToken());
  const [playerName, setPlayerName] = useState<string>('');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [sessionReady, setSessionReady] = useState<boolean>(false);
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [rememberedAccounts, setRememberedAccounts] = useState<RememberedAccountHint[]>(() =>
    getRememberedHints()
  );

  const [selectedMapId, setSelectedMapId] = useState<MapId>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.mapId);
      return (MAPS.find((m) => m.id === saved)?.id ?? MAPS[0].id) as MapId;
    } catch {
      return MAPS[0].id;
    }
  });

  const [bestTimeMs, setBestTimeMs] = useState<number>(0);
  const [admUnlocked, setAdmUnlocked] = useState<boolean>(false);

  const [loadout, setLoadout] = useState<EquippedLoadout>(() =>
    sanitizeLoadout(
      loadJson<EquippedLoadout>(STORAGE_KEYS.loadout, DEFAULT_LOADOUT),
      false,
      0
    )
  );

  const [settings, setSettings] = useState<GraphicsSettings>(() =>
    loadJson<GraphicsSettings>(STORAGE_KEYS.settings, {
      quality: 'media',
      noTextures: false,
      soundEnabled: true,
    })
  );

  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [coinsCollected, setCoinsCollected] = useState(0);
  const [timerStoppedByCoin, setTimerStoppedByCoin] = useState(false);
  const runSubmittedRef = useRef(false);
  const [gameOverInfo, setGameOverInfo] = useState<GameOverPayload | null>(null);
  const [isNewPersonalBest, setIsNewPersonalBest] = useState(false);
  const [newlyUnlockedSkins, setNewlyUnlockedSkins] = useState<string[]>([]);
  const [achievedGlobalRank, setAchievedGlobalRank] = useState<number | null>(null);
  const [lastSubmittedId, setLastSubmittedId] = useState<string | null>(null);

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);

  const [wardrobeOpen, setWardrobeOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [verified, setVerified] = useState<boolean>(false);
  const [verifiedRole, setVerifiedRole] = useState<VerifiedRole>(null);
  const [verifyBoxOpen, setVerifyBoxOpen] = useState(false);
  const [verifyPasswordInput, setVerifyPasswordInput] = useState('');
  const [verifySubmitting, setVerifySubmitting] = useState(false);
  const [verifyFeedback, setVerifyFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [startingRun, setStartingRun] = useState(false);

  const activeMap = useMemo(() => getMapById(selectedMapId), [selectedMapId]);
  const activeCharacter = useMemo(
    () => COSMETIC_ITEMS.find((c) => c.id === loadout.suit) ?? COSMETIC_ITEMS[0],
    [loadout.suit]
  );

  useEffect(() => {
    soundEngine.enabled = settings.soundEnabled;
  }, [settings.soundEnabled]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.mapId, selectedMapId);
    } catch {}
  }, [selectedMapId]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.loadout, JSON.stringify(loadout));
    } catch {}
  }, [loadout]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
    } catch {}
  }, [settings]);

  const applyServerAccount = useCallback(
    (data: {
      playerName?: string;
      verified?: boolean;
      verifiedRole?: VerifiedRole;
      admUnlocked?: boolean;
      bestTimeMs?: number;
      loadout?: EquippedLoadout;
      selectedMapId?: MapId | string;
      accountBackupToken?: string;
    }) => {
      const nextName = data.playerName ?? '';
      const nextAdm = Boolean(data.admUnlocked);
      const nextVerified = Boolean(data.verified);
      const nextBest =
        typeof data.bestTimeMs === 'number' && data.bestTimeMs > 0 ? data.bestTimeMs : 0;

      if (nextName) {
        setPlayerName(nextName);
        try {
          localStorage.setItem(STORAGE_KEYS.playerName, nextName);
        } catch {}
        if (data.accountBackupToken) {
          saveAccountBackup(nextName, data.accountBackupToken);
          setRememberedAccounts(getRememberedHints());
        }
      }

      setAdmUnlocked(nextAdm);
      setVerified(nextVerified);
      setVerifiedRole(nextVerified ? (data.verifiedRole ?? 'dono') : null);
      setBestTimeMs(nextBest);
      try {
        localStorage.setItem(STORAGE_KEYS.bestTimeMs, String(nextBest));
      } catch {}

      if (data.selectedMapId && MAPS.some((m) => m.id === data.selectedMapId)) {
        setSelectedMapId(data.selectedMapId as MapId);
      }

      if (data.loadout) {
        setLoadout(sanitizeLoadout(data.loadout, nextAdm, nextBest));
      } else {
        setLoadout((prev) => sanitizeLoadout(prev, nextAdm, nextBest));
      }
      setIsAuthenticated(true);
      setAuthModalOpen(false);
    },
    []
  );

  const fetchLeaderboard = useCallback(async () => {
    setLeaderboardLoading(true);
    setLeaderboardError(null);
    try {
      const res = await fetch('/api/leaderboard');
      if (!res.ok) throw new Error('Falha ao carregar ranking');
      const data = await res.json();
      setLeaderboard(Array.isArray(data.entries) ? data.entries.slice(0, 15) : []);
    } catch {
      setLeaderboardError('Não foi possível conectar ao ranking global.');
    } finally {
      setLeaderboardLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  // Hydrate or auto-restore permanent password-protected account on boot
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/player/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playerToken,
            accountBackupTokens: getBackupTokensList(),
          }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as PlayerSessionResponse;
        if (!active || !data.ok) return;

        if (data.hasAccount && data.playerName) {
          applyServerAccount(data);
        } else {
          setIsAuthenticated(false);
          setAuthModalOpen(true);
        }
      } catch {
        if (active) {
          setIsAuthenticated(false);
          setAuthModalOpen(true);
        }
      } finally {
        if (active) setSessionReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [applyServerAccount, playerToken]);

  // Keep locked secret cosmetics sanitized if admUnlocked or bestTimeMs changes
  useEffect(() => {
    setLoadout((prev) => {
      const cleaned = sanitizeLoadout(prev, admUnlocked, bestTimeMs);
      if (JSON.stringify(cleaned) === JSON.stringify(prev)) return prev;
      return cleaned;
    });
  }, [admUnlocked, bestTimeMs]);

  // Persist loadout, map selection, and record back to server account + signed backup
  useEffect(() => {
    if (!sessionReady || !isAuthenticated) return;
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch('/api/player/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playerToken,
            bestTimeMs,
            loadout,
            selectedMapId,
          }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as PlayerClaimResponse;
        if (data.ok && data.playerName && data.accountBackupToken) {
          saveAccountBackup(data.playerName, data.accountBackupToken);
          setRememberedAccounts(getRememberedHints());
        }
      } catch {}
    }, 350);

    return () => window.clearTimeout(timer);
  }, [bestTimeMs, isAuthenticated, loadout, playerToken, selectedMapId, sessionReady]);

  const handleCheckNameAvailability = useCallback(
    async (candidateName: string): Promise<{ ok: boolean; error?: string }> => {
      try {
        const res = await fetch('/api/player/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerName: candidateName }),
        });
        const data = (await res.json()) as PlayerClaimResponse;
        if (!res.ok || !data.ok) {
          return {
            ok: false,
            error: data.error || 'Esse nome já existe! Escolha outro nome.',
          };
        }
        return { ok: true };
      } catch {
        return { ok: false, error: 'Erro ao verificar disponibilidade do nome.' };
      }
    },
    []
  );

  const handleRegisterAccount = useCallback(
    async (name: string, password: string): Promise<{ ok: boolean; error?: string }> => {
      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playerToken,
            playerName: name,
            password,
            loadout,
            selectedMapId,
          }),
        });
        const data = (await res.json()) as PlayerClaimResponse & {
          entries?: LeaderboardEntry[];
        };
        if (!res.ok || !data.ok) {
          return { ok: false, error: data.error || 'Não foi possível criar a conta.' };
        }
        applyServerAccount(data);
        if (Array.isArray(data.entries)) {
          setLeaderboard(data.entries.slice(0, 15));
        }
        return { ok: true };
      } catch {
        return { ok: false, error: 'Erro de conexão ao criar a conta.' };
      }
    },
    [applyServerAccount, loadout, playerToken, selectedMapId]
  );

  const handleLoginAccount = useCallback(
    async (name: string, password: string): Promise<{ ok: boolean; error?: string }> => {
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playerToken,
            playerName: name,
            password,
            accountBackupTokens: getBackupTokensList(),
          }),
        });
        const data = (await res.json()) as PlayerClaimResponse & {
          entries?: LeaderboardEntry[];
        };
        if (!res.ok || !data.ok) {
          return { ok: false, error: data.error || 'Nome ou senha incorretos.' };
        }
        applyServerAccount(data);
        if (Array.isArray(data.entries)) {
          setLeaderboard(data.entries.slice(0, 15));
        }
        return { ok: true };
      } catch {
        return { ok: false, error: 'Erro de conexão ao entrar na conta.' };
      }
    },
    [applyServerAccount, playerToken]
  );

  const handleSwitchAccount = useCallback(() => {
    const freshToken = generateFreshToken();
    try {
      localStorage.setItem(STORAGE_KEYS.playerToken, freshToken);
      localStorage.removeItem(STORAGE_KEYS.playerName);
      localStorage.removeItem(STORAGE_KEYS.bestTimeMs);
    } catch {}
    setPlayerToken(freshToken);
    setPlayerName('');
    setIsAuthenticated(false);
    setVerified(false);
    setVerifiedRole(null);
    setAdmUnlocked(false);
    setBestTimeMs(0);
    setLoadout(DEFAULT_LOADOUT);
    setVerifyBoxOpen(false);
    setVerifyFeedback(null);
    setRememberedAccounts(getRememberedHints());
    setAuthModalOpen(true);
  }, []);

  const startRun = useCallback(() => {
    if (startingRun || !sessionReady) return;
    if (!isAuthenticated) {
      setAuthModalOpen(true);
      return;
    }
    setStartingRun(true);
    try {
      setWardrobeOpen(false);
      setSettingsOpen(false);
      setGameOverInfo(null);
      setIsNewPersonalBest(false);
      setNewlyUnlockedSkins([]);
      setAchievedGlobalRank(null);
      setTimerStoppedByCoin(false);
      setCoinsCollected(0);
      runSubmittedRef.current = false;
      setCurrentTimeMs(0);
      setRunKey((k) => k + 1);
      setMode('playing');
    } finally {
      setStartingRun(false);
    }
  }, [isAuthenticated, sessionReady, startingRun]);

  const recordRunScore = useCallback(
    async (timeMs: number, mapId: string, mapName: string, runPlayMode: PlayMode) => {
      // Training mode NEVER records to personal best or Top Global leaderboard
      if (runPlayMode === 'training') return;

      const prevBestSec = Math.floor(bestTimeMs / 1000);
      const newBestSec = Math.floor(timeMs / 1000);

      if (timeMs > bestTimeMs) {
        setBestTimeMs(timeMs);
        setIsNewPersonalBest(true);
        try {
          localStorage.setItem(STORAGE_KEYS.bestTimeMs, String(timeMs));
        } catch {}

        const unlockedNow = COSMETIC_ITEMS.filter(
          (item) =>
            item.unlockSource === 'record' &&
            (item.requiredTimeSec ?? 0) > prevBestSec &&
            (item.requiredTimeSec ?? 0) <= newBestSec
        ).map((item) => item.name);

        if (unlockedNow.length > 0) {
          setNewlyUnlockedSkins(unlockedNow);
          soundEngine.playUnlock();
        }
      }

      if (runSubmittedRef.current) return;
      runSubmittedRef.current = true;

      try {
        const res = await fetch('/api/leaderboard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playerToken,
            playMode: runPlayMode,
            timeMs,
            mapId,
            mapName,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.accountBackupToken && playerName) {
            saveAccountBackup(playerName, data.accountBackupToken);
          }
          if (Array.isArray(data.entries)) {
            setLeaderboard(data.entries.slice(0, 15));
            if (typeof data.rank === 'number') {
              setAchievedGlobalRank(data.rank);
            }
            if (typeof data.keptRecordId === 'string') {
              setLastSubmittedId(data.keptRecordId);
            } else if (typeof data.rank === 'number') {
              const matched = data.entries.find((e: LeaderboardEntry) => e.rank === data.rank);
              if (matched) setLastSubmittedId(matched.id);
            }
          }
        }
      } catch {
        // Offline or network hiccup — local best already saved
      }
    },
    [bestTimeMs, playerName, playerToken]
  );

  const handleCoinStopTimer = useCallback(
    (timeMs: number) => {
      setTimerStoppedByCoin(true);
      setCurrentTimeMs(timeMs);
      void recordRunScore(timeMs, activeMap.id, activeMap.name, playMode);
    },
    [activeMap.id, activeMap.name, playMode, recordRunScore]
  );

  const handleGameOver = useCallback(
    async (payload: GameOverPayload) => {
      setCurrentTimeMs(payload.timeMs);
      setGameOverInfo(payload);
      setMode('gameover');
      await recordRunScore(payload.timeMs, payload.mapId, payload.mapName, payload.playMode);
    },
    [recordRunScore]
  );

  const handleEquip = useCallback((slot: CosmeticSlot, itemId: string | null) => {
    setLoadout((prev) => ({
      ...prev,
      [slot]: itemId,
    }));
  }, []);

  const verifySecretOnServer = useCallback(
    async (
      rawPassword: string
    ): Promise<{ ok: boolean; message: string; playerName?: string }> => {
      const trimmed = rawPassword.trim();
      if (!trimmed) {
        return { ok: false, message: 'Digite a senha secreta.' };
      }
      if (!isAuthenticated) {
        return { ok: false, message: 'Entre ou crie sua conta antes de verificar.' };
      }
      try {
        const res = await fetch('/api/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playerToken,
            password: trimmed,
          }),
        });
        const data = (await res.json()) as PlayerClaimResponse & {
          entries?: LeaderboardEntry[];
        };
        if (!res.ok || !data.ok) {
          return { ok: false, message: data.error || 'Senha secreta incorreta.' };
        }

        applyServerAccount(data);
        if (Array.isArray(data.entries)) {
          setLeaderboard(data.entries.slice(0, 15));
        }
        soundEngine.playUnlock();
        return {
          ok: true,
          playerName: data.playerName,
          message: 'Selo Verificado e itens secretos desbloqueados!',
        };
      } catch {
        return { ok: false, message: 'Erro de conexão ao validar a senha.' };
      }
    },
    [applyServerAccount, isAuthenticated, playerToken]
  );

  const handleVerifySubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (verifySubmitting) return;
      setVerifySubmitting(true);
      try {
        const result = await verifySecretOnServer(verifyPasswordInput);
        setVerifyFeedback({ ok: result.ok, message: result.message });
        if (result.ok) {
          setVerifyPasswordInput('');
        }
      } finally {
        setVerifySubmitting(false);
      }
    },
    [verifyPasswordInput, verifySecretOnServer, verifySubmitting]
  );

  const handleRedeemCode = useCallback(
    async (rawCode: string): Promise<{ ok: boolean; message: string }> => {
      const result = await verifySecretOnServer(rawCode);
      return { ok: result.ok, message: result.message };
    },
    [verifySecretOnServer]
  );

  const effectiveVerified = verified;
  const effectiveRole: VerifiedRole = effectiveVerified ? (verifiedRole ?? 'dono') : null;
  const timerDisplay = formatTimePrecise(currentTimeMs);

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#080B10] select-none">
      {/* 3D WebGL Viewport */}
      <GameCanvas
        mode={mode}
        playMode={playMode}
        runKey={runKey}
        map={activeMap}
        loadout={loadout}
        settings={settings}
        onTimeUpdate={setCurrentTimeMs}
        onCoinStopTimer={handleCoinStopTimer}
        onCoinCountChange={setCoinsCollected}
        onGameOver={handleGameOver}
      />

      {/* ============================================================ */}
      {/* LOBBY / HOME SCREEN OVERLAY                                  */}
      {/* ============================================================ */}
      {mode === 'lobby' && (
        <div className="relative z-10 w-full h-full flex flex-col justify-between pointer-events-none overflow-y-auto lg:overflow-hidden custom-scroll">
          {/* Top Navigation Bar */}
          <header className="pointer-events-auto flex items-center justify-between gap-4 px-5 py-3.5 bg-[#0A0E17]/88 border-b border-white/10 shrink-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="flex items-baseline gap-2 whitespace-nowrap">
                <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-white">
                  Cyber Surfers
                </h1>
                <span className="text-slate-500 text-sm" aria-hidden="true">·</span>
                <span className="font-display text-sm sm:text-base font-bold text-cyan-400">
                  Biel.JR
                </span>
              </div>
              <VerifiedBadge
                role="dono"
                variant="corner"
                labelOverride="Verificado"
              />
            </div>

            <div className="flex items-center gap-2.5 sm:gap-4">
              {effectiveVerified && (
                <div className="hidden sm:flex items-center">
                  <VerifiedBadge role={effectiveRole} variant="pill" />
                </div>
              )}

              <div className="hidden md:flex items-center gap-2 text-xs text-slate-300 whitespace-nowrap">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                <span>Melhor Tempo:</span>
                <span className="font-mono-tabular font-bold text-cyan-300">
                  {formatTimeFull(bestTimeMs)}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setWardrobeOpen(true)}
                className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#141C2B] text-slate-100 border border-white/12 hover:border-cyan-400/60 transition-colors whitespace-nowrap shrink-0"
              >
                <Shirt className="w-4 h-4 text-cyan-400" />
                <span>Personagens e Códigos</span>
              </button>

              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#141C2B] text-slate-100 border border-white/12 hover:border-cyan-400/60 transition-colors whitespace-nowrap shrink-0"
              >
                <Sliders className="w-4 h-4 text-slate-300" />
                <span className="hidden sm:inline">Gráficos</span>
              </button>
            </div>
          </header>

          {/* Main Lobby Split: Left Controls | Open 3D Hero Center | Right Top-15 Global Ranking */}
          <main className="flex-1 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 p-4 sm:p-6 pointer-events-none">
            {/* Left Panel: Account, Mode Selector, Map Selector & Start Button */}
            <section className="pointer-events-auto w-full lg:w-[360px] bg-[#0B0F18]/90 border border-white/10 rounded-xl p-4 shadow-2xl space-y-3.5 shrink-0">
              {/* Saved Account Bar */}
              <div>
                <div className="flex items-center justify-between mb-1.5 gap-2">
                  <span className="text-xs font-semibold text-slate-300">
                    Conta Salva e Única
                  </span>
                  {effectiveVerified && (
                    <VerifiedBadge role={effectiveRole} variant="compact" />
                  )}
                </div>

                {isAuthenticated && playerName ? (
                  <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-[#070A10] border border-cyan-500/35">
                    <div className="flex items-center gap-2 min-w-0">
                      <Lock className="w-4 h-4 text-cyan-400 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-white truncate">{playerName}</div>
                        <div className="text-[10px] text-slate-400">
                          Conta protegida por senha
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleSwitchAccount}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-white/8 hover:bg-white/14 text-[11px] font-semibold text-slate-200 transition-colors whitespace-nowrap shrink-0"
                    >
                      <LogOut className="w-3 h-3" />
                      <span>Trocar</span>
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAuthModalOpen(true)}
                    className="w-full py-2.5 px-3 rounded-lg bg-cyan-500/15 border border-cyan-400/50 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/25 transition-colors"
                  >
                    Entrar ou Criar Conta (Nome e Senha)
                  </button>
                )}

                {/* Owner / ADM Verification Bar (Server-Validated) */}
                {isAuthenticated && (
                  <div className="mt-2">
                    {!effectiveVerified ? (
                      <div className="space-y-2">
                        <button
                          type="button"
                          onClick={() => setVerifyBoxOpen((v) => !v)}
                          className="flex items-center gap-1.5 text-[11px] font-semibold text-cyan-300 hover:text-cyan-200 transition-colors"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>
                            {verifyBoxOpen
                              ? 'Ocultar verificação Dono / ADM'
                              : 'Sou Dono ou ADM (Verificar com senha)'}
                          </span>
                        </button>

                        {verifyBoxOpen && (
                          <form
                            onSubmit={handleVerifySubmit}
                            className="p-2.5 rounded-lg bg-[#0E1420] border border-cyan-500/25 space-y-2"
                          >
                            <div className="flex items-center gap-2">
                              <div className="relative flex-1">
                                <KeyRound className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                <input
                                  type="password"
                                  autoComplete="off"
                                  value={verifyPasswordInput}
                                  onChange={(e) => setVerifyPasswordInput(e.target.value)}
                                  placeholder="Senha secreta"
                                  className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-[#070A10] border border-white/15 rounded-md text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
                                />
                              </div>
                              <button
                                type="submit"
                                disabled={verifySubmitting}
                                className="px-3 py-1.5 rounded-md bg-cyan-500 hover:bg-cyan-400 disabled:opacity-60 text-slate-950 text-xs font-bold transition-colors whitespace-nowrap"
                              >
                                {verifySubmitting ? '...' : 'Verificar'}
                              </button>
                            </div>
                            {verifyFeedback && (
                              <p
                                className={`text-[11px] leading-snug ${
                                  verifyFeedback.ok ? 'text-emerald-300' : 'text-red-300'
                                }`}
                              >
                                {verifyFeedback.message}
                              </p>
                            )}
                          </form>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-500/12 via-cyan-500/12 to-transparent border border-amber-300/30">
                        <VerifiedBadge role={effectiveRole} variant="pill" />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Game Mode Selector: Normal vs Training */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-slate-300">Modo de Jogo</span>
                  <span className="text-[11px] text-amber-300 font-medium">
                    {playMode === 'training' ? 'Sem Top Global' : 'Moeda para o cronômetro'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5 p-1 rounded-lg bg-[#070A10] border border-white/10">
                  <button
                    type="button"
                    onClick={() => setPlayMode('normal')}
                    className={`py-2 px-2.5 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                      playMode === 'normal'
                        ? 'bg-cyan-500 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <Trophy className="w-3.5 h-3.5 shrink-0" />
                    <span>Modo Normal</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlayMode('training')}
                    className={`py-2 px-2.5 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                      playMode === 'training'
                        ? 'bg-amber-400 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <Dumbbell className="w-3.5 h-3.5 shrink-0" />
                    <span>Modo Treino</span>
                  </button>
                </div>
                {playMode === 'training' && (
                  <p className="mt-1.5 text-[11px] text-amber-200/90 leading-snug">
                    Treino focado nos obstáculos de 3 fileiras e no arco com barreira alta. Não conta para o Ranking Top Global.
                  </p>
                )}
              </div>

              {/* Map Selection */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                    Escolha o Mapa
                  </span>
                  <span className="text-[11px] text-slate-400">{MAPS.length} mapas</span>
                </div>
                <div className="grid grid-cols-2 gap-2 max-h-[144px] overflow-y-auto custom-scroll pr-1">
                  {MAPS.map((m) => {
                    const active = m.id === selectedMapId;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setSelectedMapId(m.id)}
                        className={`text-left p-2.5 rounded-lg border transition-colors ${
                          active
                            ? 'bg-cyan-500/15 border-cyan-400 text-white'
                            : 'bg-[#101624] border-white/8 text-slate-300 hover:border-white/25'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-sm shrink-0"
                            style={{ backgroundColor: m.accentHex }}
                          />
                          <span className="text-xs font-semibold truncate">{m.name}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-[11px] text-slate-400 leading-snug">
                  {activeMap.subtitle}
                </p>
              </div>

              {/* Start Run CTA */}
              <button
                type="button"
                disabled={!sessionReady || startingRun}
                onClick={startRun}
                className={`w-full py-3.5 px-5 rounded-lg font-display font-bold text-base tracking-wide flex items-center justify-center gap-2.5 transition-colors shadow-lg ${
                  !sessionReady || startingRun
                    ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                    : playMode === 'training'
                      ? 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                      : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
                }`}
              >
                <Play
                  className={`w-5 h-5 ${
                    !sessionReady || startingRun ? 'fill-slate-400' : 'fill-slate-950'
                  }`}
                />
                <span>
                  {!isAuthenticated
                    ? 'Entre na Conta para Jogar'
                    : playMode === 'training'
                      ? 'Iniciar Treino'
                      : 'Iniciar Corrida'}
                </span>
              </button>

              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-white/8">
                <span>PC: Setas / A D / Espaço / ↓</span>
                <span>Celular: Deslize ou toque nas laterais</span>
              </div>
            </section>

            {/* Center Hero Nameplate over Open 3D Stage */}
            <div className="hidden lg:flex flex-col items-center justify-end self-end pb-2 pointer-events-none">
              <div className="bg-[#0B0F18]/85 border border-white/10 rounded-lg px-4 py-2 text-center">
                <div className="flex items-center justify-center gap-1.5">
                  <span className="text-xs font-bold text-cyan-300 truncate max-w-[160px]">
                    {playerName.trim() || 'Visitante'}
                  </span>
                  {effectiveVerified && (
                    <VerifiedBadge role={effectiveRole} variant="compact" />
                  )}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">Personagem Equipado</div>
                <div className="font-display text-sm font-bold text-white">
                  {activeCharacter.name}
                </div>
              </div>
            </div>

            {/* Right Panel: Ranking Top Global ALWAYS visible on Home Screen */}
            <div className="pointer-events-auto w-full lg:w-[390px] shrink-0">
              <LeaderboardTable
                entries={leaderboard}
                loading={leaderboardLoading}
                error={leaderboardError}
                highlightId={lastSubmittedId}
              />
            </div>
          </main>
        </div>
      )}

      {/* ============================================================ */}
      {/* IN-GAME HUD (STOPWATCH AT TOP + MINIMAL CONTROLS)            */}
      {/* ============================================================ */}
      {mode === 'playing' && (
        <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-4 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            {/* Map, Player Corner Badge & Mode / Personal Best */}
            <div className="bg-[#0B0F18]/88 border border-white/10 rounded-lg px-3.5 py-2 text-xs space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-cyan-300 truncate max-w-[140px]">
                  {playerName.trim() || 'Corredor'}
                </span>
                {effectiveVerified && (
                  <VerifiedBadge role={effectiveRole} variant="compact" />
                )}
              </div>
              <div className="text-slate-300 font-medium">{activeMap.name}</div>
              {playMode === 'training' ? (
                <div className="text-amber-300 font-semibold">
                  Modo Treino · Sem Top Global
                </div>
              ) : (
                <div className="text-slate-400 font-mono-tabular">
                  Recorde: {formatTimeFull(bestTimeMs)}
                </div>
              )}
            </div>

            {/* Top Center Stopwatch starting at 00:00 */}
            <div
              className={`bg-[#0B0F18]/92 rounded-xl px-5 py-2.5 shadow-xl text-center border ${
                timerStoppedByCoin ? 'border-amber-400/70' : 'border-cyan-400/35'
              }`}
            >
              <div
                className={`text-[11px] font-medium ${
                  timerStoppedByCoin ? 'text-amber-300' : 'text-slate-400'
                }`}
              >
                {timerStoppedByCoin ? 'Cronômetro Parado (Moeda)' : 'Cronômetro'}
              </div>
              <div className="font-mono-tabular text-3xl sm:text-4xl font-bold text-white tracking-tight leading-none mt-0.5">
                <span>{timerDisplay.main}</span>
                <span
                  className={`text-lg sm:text-xl ${
                    timerStoppedByCoin ? 'text-amber-400' : 'text-cyan-400'
                  }`}
                >
                  {timerDisplay.centis}
                </span>
              </div>
            </div>

            {/* Quit Run Button + Live Coin Counter */}
            <div className="flex items-center gap-2.5">
              <div
                className={`bg-[#0B0F18]/90 border rounded-lg px-3 py-2 flex items-center gap-2 ${
                  coinsCollected > 0
                    ? 'border-amber-400/60 text-amber-300'
                    : 'border-white/12 text-slate-200'
                }`}
              >
                <Coins
                  className={`w-4 h-4 ${
                    coinsCollected > 0 ? 'text-amber-400' : 'text-slate-400'
                  }`}
                />
                <div className="text-xs leading-none">
                  <span className="text-[10px] text-slate-400 block">Moedas</span>
                  <span className="font-mono-tabular font-bold text-sm">{coinsCollected}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setMode('lobby')}
                className="pointer-events-auto px-3.5 py-2 rounded-lg bg-[#0B0F18]/88 border border-white/12 text-xs font-semibold text-slate-200 hover:bg-white/10 transition-colors"
              >
                Sair
              </button>
            </div>
          </div>

          <div className="flex justify-center">
            <div className="bg-[#0B0F18]/82 border border-white/10 rounded-lg px-4 py-1.5 text-[11px] text-slate-300 text-center">
              {playMode === 'training'
                ? 'Modo Treino: Pratique as burlas nas 3 fileiras e no arco sem valer no Top Global.'
                : timerStoppedByCoin
                  ? 'Moeda tocada! Cronômetro travado — continue correndo e desviando das armadilhas.'
                  : 'Desvie das moedas e armadilhas · Deslize ou toque nas laterais (Celular) · ← → A D / Espaço / ↓ (PC)'}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* GAME OVER OVERLAY                                            */}
      {/* ============================================================ */}
      {mode === 'gameover' && gameOverInfo && (
        <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-black/65">
          <div className="w-full max-w-md bg-[#0B0F18] border border-white/15 rounded-xl shadow-2xl overflow-hidden">
            <div className="px-6 py-4 bg-[#121826] border-b border-white/10 flex items-center gap-3">
              <AlertTriangle
                className={`w-6 h-6 shrink-0 ${
                  gameOverInfo.hitType === 'coin' ? 'text-amber-400' : 'text-red-400'
                }`}
              />
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-display text-lg font-bold text-white">
                    {gameOverInfo.playMode === 'training' ? 'Fim de Treino' : 'Fim de Corrida'}
                  </h2>
                  {effectiveVerified && (
                    <VerifiedBadge role={effectiveRole} variant="compact" />
                  )}
                </div>
                <p className="text-xs text-slate-300">{gameOverInfo.reason}</p>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-2.5">
                <div className="p-3 rounded-lg bg-[#101624] border border-white/8">
                  <div className="text-[11px] text-slate-400">
                    {gameOverInfo.playMode === 'training' ? 'Tempo de Treino' : 'Tempo Final'}
                  </div>
                  <div className="font-mono-tabular text-xl font-bold text-cyan-300 mt-1">
                    {formatTimeFull(gameOverInfo.timeMs)}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-[#101624] border border-white/8">
                  <div className="text-[11px] text-slate-400">Moedas</div>
                  <div
                    className={`font-mono-tabular text-xl font-bold mt-1 flex items-center gap-1.5 ${
                      gameOverInfo.coinsCollected > 0 ? 'text-amber-300' : 'text-emerald-300'
                    }`}
                  >
                    <Coins className="w-4 h-4 shrink-0" />
                    <span>{gameOverInfo.coinsCollected}</span>
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-[#101624] border border-white/8">
                  <div className="text-[11px] text-slate-400">Recorde</div>
                  <div className="font-mono-tabular text-xl font-bold text-white mt-1">
                    {formatTimeFull(bestTimeMs)}
                  </div>
                </div>
              </div>

              {gameOverInfo.playMode === 'training' && (
                <div className="p-3 rounded-lg bg-amber-500/12 border border-amber-400/35 text-xs font-medium text-amber-200">
                  Modo Treino — este modo não envia tempos para o Ranking Top Global.
                </div>
              )}

              {gameOverInfo.playMode === 'normal' && isNewPersonalBest && (
                <div className="p-3 rounded-lg bg-emerald-500/15 border border-emerald-400/40 text-xs font-semibold text-emerald-300">
                  Novo recorde pessoal salvo automaticamente!
                </div>
              )}

              {gameOverInfo.playMode === 'normal' && achievedGlobalRank !== null && (
                <div className="p-3 rounded-lg bg-amber-500/15 border border-amber-400/40 text-xs font-semibold text-amber-300">
                  Você entrou no Ranking Top Global em {achievedGlobalRank}º lugar!
                </div>
              )}

              {gameOverInfo.playMode === 'normal' && newlyUnlockedSkins.length > 0 && (
                <div className="p-3 rounded-lg bg-cyan-500/15 border border-cyan-400/40 text-xs text-cyan-200">
                  <span className="font-semibold">Skin desbloqueada: </span>
                  {newlyUnlockedSkins.join(', ')}
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={startRun}
                  className="flex-1 py-3 px-4 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-display font-bold text-sm flex items-center justify-center gap-2 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>
                    {gameOverInfo.playMode === 'training' ? 'Treinar Novamente' : 'Jogar Novamente'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode('lobby')}
                  className="py-3 px-4 rounded-lg bg-[#151D2E] hover:bg-[#1E2940] text-slate-100 font-semibold text-sm border border-white/12 transition-colors"
                >
                  Tela Inicial
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* STARTUP ACCOUNT GATE (NOME + SENHA)                          */}
      {/* ============================================================ */}
      <AuthGateModal
        open={sessionReady && (!isAuthenticated || authModalOpen)}
        canClose={isAuthenticated}
        onClose={() => setAuthModalOpen(false)}
        rememberedAccounts={rememberedAccounts}
        onCheckNameAvailability={handleCheckNameAvailability}
        onRegister={handleRegisterAccount}
        onLogin={handleLoginAccount}
      />

      {/* ============================================================ */}
      {/* WARDROBE & CODES DRAWER                                      */}
      {/* ============================================================ */}
      <WardrobeModal
        open={wardrobeOpen}
        onClose={() => setWardrobeOpen(false)}
        bestTimeMs={bestTimeMs}
        admUnlocked={admUnlocked}
        loadout={loadout}
        onEquip={handleEquip}
        onRedeemCode={handleRedeemCode}
      />

      {/* ============================================================ */}
      {/* GRAPHICS & OPTIMIZATION MODAL                                */}
      {/* ============================================================ */}
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onChange={setSettings}
      />
    </div>
  );
}
