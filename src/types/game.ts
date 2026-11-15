export type MapId =
  | 'metropole_neon'
  | 'via_solar'
  | 'nucleo_subterraneo'
  | 'passarela_orbital'
  | 'floresta_cibernetica'
  | 'glaciar_artico'
  | 'distrito_vulcanico'
  | 'circuito_synth';

export type QualityLevel = 'baixa' | 'media' | 'alta';

export type GameMode = 'lobby' | 'playing' | 'gameover';

export type PlayMode = 'normal' | 'training';

export type CosmeticSlot =
  | 'suit'
  | 'cape'
  | 'hair'
  | 'eyewear'
  | 'headband'
  | 'aura'
  | 'weapon';

export type UnlockSource = 'default' | 'record' | 'adm' | 'player';

export type ObstacleKind =
  | 'coin'
  | 'barrier_low'
  | 'barrier_high'
  | 'bus'
  | 'pillar'
  | 'pit'
  | 'laser_low'
  | 'laser_high';

export interface MapConfig {
  id: MapId;
  name: string;
  subtitle: string;
  accentHex: string;
  skyHex: number;
  fogHex: number;
  fogDensity: number;
  trackBaseHex: number;
  trackLineHex: number;
  railHex: number;
  sceneryHex: number;
  sceneryGlowHex: number;
  keyLightHex: number;
  hemiSkyHex: number;
  hemiGroundHex: number;
  baseSpeed: number;
  maxSpeed: number;
  patternWeights: Record<string, number>;
}

export interface CosmeticItem {
  id: string;
  name: string;
  description: string;
  slot: CosmeticSlot;
  unlockSource: UnlockSource;
  requiredTimeSec?: number;
  previewColor: string;
  secondaryColor?: string;
}

export interface EquippedLoadout {
  suit: string;
  cape: string | null;
  hair: string | null;
  eyewear: string | null;
  headband: string | null;
  aura: string | null;
  weapon: string | null;
}

export interface GraphicsSettings {
  quality: QualityLevel;
  noTextures: boolean;
  soundEnabled: boolean;
}

export type VerifiedRole = 'dono' | 'adm' | null;

export interface LeaderboardEntry {
  id: string;
  rank: number;
  playerName: string;
  timeMs: number;
  mapId: MapId | string;
  mapName: string;
  createdAt: string;
  verified?: boolean;
  verifiedRole?: VerifiedRole;
}

export interface PlayerClaimResponse {
  ok: boolean;
  available?: boolean;
  playerName?: string;
  nameLocked?: boolean;
  verified?: boolean;
  verifiedRole?: VerifiedRole;
  admUnlocked?: boolean;
  bestTimeMs?: number;
  loadout?: EquippedLoadout;
  selectedMapId?: MapId;
  accountBackupToken?: string;
  restored?: boolean;
  requiresPassword?: boolean;
  error?: string;
}

export interface PlayerSessionResponse {
  ok: boolean;
  hasAccount: boolean;
  playerName?: string;
  nameLocked: boolean;
  verified: boolean;
  verifiedRole: VerifiedRole;
  admUnlocked: boolean;
  bestTimeMs?: number;
  loadout?: EquippedLoadout;
  selectedMapId?: MapId;
  accountBackupToken?: string;
  restored?: boolean;
}

export interface GameOverPayload {
  timeMs: number;
  coinsCollected: number;
  reason: string;
  hitType: ObstacleKind | 'manual';
  mapId: MapId;
  mapName: string;
  playMode: PlayMode;
}
