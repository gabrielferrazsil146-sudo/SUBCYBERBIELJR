import express from 'express';
import type { Request, Response } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';

type VerifiedRole = 'dono' | 'adm' | null;

interface EquippedLoadout {
  suit: string;
  cape: string | null;
  hair: string | null;
  eyewear: string | null;
  headband: string | null;
  aura: string | null;
  weapon: string | null;
}

interface LeaderboardRecord {
  id: string;
  playerName: string;
  timeMs: number;
  mapId: string;
  mapName: string;
  createdAt: string;
  playerToken?: string;
  verified?: boolean;
  verifiedRole?: VerifiedRole;
}

interface AccountRecord {
  uniqueKey: string;
  playerToken: string;
  playerName: string;
  passwordSalt: string;
  passwordHash: string;
  verified: boolean;
  verifiedRole: VerifiedRole;
  admUnlocked: boolean;
  bestTimeMs: number;
  selectedMapId: string;
  loadout: EquippedLoadout | null;
  createdAt: string;
  updatedAt: string;
}

interface BackupPayload {
  v: 1;
  u: string;
  n: string;
  s: string;
  h: string;
  t: string;
  vr: boolean;
  r: VerifiedRole;
  a: boolean;
  b: number;
  m: string;
  l: EquippedLoadout | null;
  c: string;
}

const PORT = 3000;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const LEADERBOARD_FILE = path.join(DATA_DIR, 'leaderboard.json');
const LEADERBOARD_BAK_FILE = path.join(DATA_DIR, 'leaderboard.json.bak');
const ACCOUNTS_FILE = path.join(DATA_DIR, 'accounts.json');
const ACCOUNTS_BAK_FILE = path.join(DATA_DIR, 'accounts.json.bak');
const MAX_ENTRIES = 15;
const ADMIN_SECRET = 'GABRIELFERRAZ7';
const ACCOUNT_SIGNING_KEY =
  process.env.ACCOUNT_SIGNING_KEY ||
  crypto
    .createHash('sha256')
    .update(`CyberSurfers::AccountPersistence::${ADMIN_SECRET}`)
    .digest('hex');

let operationQueue: Promise<unknown> = Promise.resolve();
let leaderboardCache: LeaderboardRecord[] | null = null;
let accountsCache: Record<string, AccountRecord> | null = null;

function withLock<T>(task: () => Promise<T>): Promise<T> {
  const next = operationQueue.then(task, task);
  operationQueue = next.catch(() => undefined);
  return next;
}

function cleanPlayerName(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 20);
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

function normalizePlayerKey(name: string): string {
  const mapped = name
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .toLowerCase()
    .split('')
    .map((ch) => HOMOGLYPH_MAP[ch] ?? ch)
    .join('');

  return mapped
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

function compactAlnumKey(name: string): string {
  return normalizePlayerKey(name)
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/0/g, 'o')
    .replace(/[^a-z0-9]/g, '');
}

function isAdminPasswordValid(rawPassword: unknown): boolean {
  return typeof rawPassword === 'string' && rawPassword.trim().toUpperCase() === ADMIN_SECRET;
}

function isValidToken(rawToken: unknown): rawToken is string {
  return typeof rawToken === 'string' && rawToken.trim().length >= 6 && rawToken.trim().length <= 128;
}

function hashAccountPassword(password: string, existingSalt?: string): { salt: string; hash: string } {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

function verifyAccountPassword(password: string, salt: string, expectedHash: string): boolean {
  if (!salt || !expectedHash) return false;
  try {
    const derived = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHash, 'hex');
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

function signAccountBackup(acc: AccountRecord): string {
  const payload: BackupPayload = {
    v: 1,
    u: acc.uniqueKey,
    n: acc.playerName,
    s: acc.passwordSalt,
    h: acc.passwordHash,
    t: acc.playerToken,
    vr: Boolean(acc.verified),
    r: acc.verified ? (acc.verifiedRole ?? 'dono') : null,
    a: Boolean(acc.admUnlocked),
    b: Number.isFinite(acc.bestTimeMs) && acc.bestTimeMs > 0 ? Math.round(acc.bestTimeMs) : 0,
    m: acc.selectedMapId || 'metropole_neon',
    l: acc.loadout ?? null,
    c: acc.createdAt,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', ACCOUNT_SIGNING_KEY)
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

function verifyAccountBackup(rawToken: unknown): BackupPayload | null {
  if (typeof rawToken !== 'string' || !rawToken.includes('.')) return null;
  const parts = rawToken.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  if (!encoded || !sig) return null;

  try {
    const expectedSig = crypto
      .createHmac('sha256', ACCOUNT_SIGNING_KEY)
      .update(encoded)
      .digest('base64url');
    const a = Buffer.from(sig, 'utf8');
    const b = Buffer.from(expectedSig, 'utf8');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as BackupPayload;
    if (
      !parsed ||
      parsed.v !== 1 ||
      typeof parsed.u !== 'string' ||
      typeof parsed.n !== 'string' ||
      typeof parsed.s !== 'string' ||
      typeof parsed.h !== 'string' ||
      typeof parsed.t !== 'string'
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function sanitizeLoadoutInput(raw: unknown): EquippedLoadout | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const pickStr = (key: string): string | null =>
    typeof obj[key] === 'string' && obj[key].length > 0 && obj[key].length <= 64
      ? (obj[key] as string)
      : null;
  const suit = pickStr('suit') ?? 'suit_padrao';
  return {
    suit,
    cape: pickStr('cape'),
    hair: pickStr('hair'),
    eyewear: pickStr('eyewear'),
    headband: pickStr('headband'),
    aura: pickStr('aura'),
    weapon: pickStr('weapon'),
  };
}

function deduplicateByPlayer(records: LeaderboardRecord[]): LeaderboardRecord[] {
  const sorted = [...records].sort((a, b) => b.timeMs - a.timeMs);
  const bestByPlayer = new Map<string, LeaderboardRecord>();

  for (const record of sorted) {
    const key = compactAlnumKey(record.playerName) || normalizePlayerKey(record.playerName) || 'corredor';
    const existing = bestByPlayer.get(key);
    if (!existing || record.timeMs > existing.timeMs) {
      bestByPlayer.set(key, record);
    }
  }

  return Array.from(bestByPlayer.values())
    .sort((a, b) => b.timeMs - a.timeMs)
    .slice(0, MAX_ENTRIES);
}

async function writeFileAtomic(targetPath: string, backupPath: string, content: string): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmpPath = `${targetPath}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(tmpPath, content, 'utf8');
  await fs.rename(tmpPath, targetPath);
  const tmpBak = `${backupPath}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(tmpBak, content, 'utf8');
  await fs.rename(tmpBak, backupPath);
}

function parseLeaderboardJson(raw: string): LeaderboardRecord[] | null {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const valid = parsed.filter(
      (item): item is LeaderboardRecord =>
        Boolean(item) &&
        typeof item.id === 'string' &&
        typeof item.playerName === 'string' &&
        typeof item.timeMs === 'number' &&
        typeof item.mapId === 'string' &&
        typeof item.mapName === 'string'
    );
    return deduplicateByPlayer(valid);
  } catch {
    return null;
  }
}

function parseAccountsJson(raw: string): Record<string, AccountRecord> | null {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const result: Record<string, AccountRecord> = {};
    for (const [key, val] of Object.entries(parsed)) {
      if (
        val &&
        typeof val === 'object' &&
        typeof (val as AccountRecord).playerToken === 'string' &&
        typeof (val as AccountRecord).playerName === 'string' &&
        typeof (val as AccountRecord).passwordHash === 'string' &&
        typeof (val as AccountRecord).passwordSalt === 'string'
      ) {
        const rec = val as AccountRecord;
        const uKey = rec.uniqueKey || compactAlnumKey(rec.playerName) || key;
        result[uKey] = {
          ...rec,
          uniqueKey: uKey,
          verified: Boolean(rec.verified),
          verifiedRole: rec.verified ? (rec.verifiedRole ?? 'dono') : null,
          admUnlocked: Boolean(rec.admUnlocked),
          bestTimeMs: Number.isFinite(rec.bestTimeMs) && rec.bestTimeMs > 0 ? rec.bestTimeMs : 0,
          selectedMapId: typeof rec.selectedMapId === 'string' ? rec.selectedMapId : 'metropole_neon',
          loadout: sanitizeLoadoutInput(rec.loadout),
        };
      }
    }
    return result;
  } catch {
    return null;
  }
}

async function readLeaderboard(): Promise<LeaderboardRecord[]> {
  if (leaderboardCache !== null) {
    return leaderboardCache;
  }

  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    const raw = await fs.readFile(LEADERBOARD_FILE, 'utf8');
    const parsed = parseLeaderboardJson(raw);
    if (parsed !== null) {
      leaderboardCache = parsed;
      return parsed;
    }
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') {
      console.error('Error reading primary leaderboard file:', err);
    }
  }

  try {
    const bakRaw = await fs.readFile(LEADERBOARD_BAK_FILE, 'utf8');
    const bakParsed = parseLeaderboardJson(bakRaw);
    if (bakParsed !== null) {
      leaderboardCache = bakParsed;
      await writeFileAtomic(LEADERBOARD_FILE, LEADERBOARD_BAK_FILE, JSON.stringify(bakParsed, null, 2));
      return bakParsed;
    }
  } catch {
    // Backup doesn't exist yet
  }

  leaderboardCache = [];
  await writeFileAtomic(LEADERBOARD_FILE, LEADERBOARD_BAK_FILE, JSON.stringify([], null, 2));
  return [];
}

async function writeLeaderboard(entries: LeaderboardRecord[]): Promise<LeaderboardRecord[]> {
  const deduped = deduplicateByPlayer(entries);
  leaderboardCache = deduped;
  await writeFileAtomic(LEADERBOARD_FILE, LEADERBOARD_BAK_FILE, JSON.stringify(deduped, null, 2));
  return deduped;
}

async function readAccounts(): Promise<Record<string, AccountRecord>> {
  if (accountsCache !== null) {
    return accountsCache;
  }

  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    const raw = await fs.readFile(ACCOUNTS_FILE, 'utf8');
    const parsed = parseAccountsJson(raw);
    if (parsed !== null) {
      accountsCache = parsed;
      return parsed;
    }
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') {
      console.error('Error reading primary accounts file:', err);
    }
  }

  try {
    const bakRaw = await fs.readFile(ACCOUNTS_BAK_FILE, 'utf8');
    const bakParsed = parseAccountsJson(bakRaw);
    if (bakParsed !== null) {
      accountsCache = bakParsed;
      await writeFileAtomic(ACCOUNTS_FILE, ACCOUNTS_BAK_FILE, JSON.stringify(bakParsed, null, 2));
      return bakParsed;
    }
  } catch {
    // Backup doesn't exist yet
  }

  accountsCache = {};
  await writeFileAtomic(ACCOUNTS_FILE, ACCOUNTS_BAK_FILE, JSON.stringify({}, null, 2));
  return {};
}

async function writeAccounts(accounts: Record<string, AccountRecord>): Promise<void> {
  accountsCache = accounts;
  await writeFileAtomic(ACCOUNTS_FILE, ACCOUNTS_BAK_FILE, JSON.stringify(accounts, null, 2));
}

function attachRank(entries: LeaderboardRecord[]) {
  return entries.slice(0, MAX_ENTRIES).map((entry, idx) => ({
    id: entry.id,
    rank: idx + 1,
    playerName: entry.playerName,
    timeMs: entry.timeMs,
    mapId: entry.mapId,
    mapName: entry.mapName,
    createdAt: entry.createdAt,
    verified: Boolean(entry.verified),
    verifiedRole: entry.verified ? (entry.verifiedRole ?? 'adm') : null,
  }));
}

function findAccountByToken(
  accounts: Record<string, AccountRecord>,
  playerToken: string
): AccountRecord | null {
  for (const acc of Object.values(accounts)) {
    if (acc.playerToken === playerToken) {
      return acc;
    }
  }
  return null;
}

function findAccountByUniqueOrNormKey(
  accounts: Record<string, AccountRecord>,
  playerName: string
): AccountRecord | null {
  const uKey = compactAlnumKey(playerName);
  const nKey = normalizePlayerKey(playerName);
  if (uKey && accounts[uKey]) return accounts[uKey];
  for (const acc of Object.values(accounts)) {
    if (
      (uKey && compactAlnumKey(acc.playerName) === uKey) ||
      (nKey && normalizePlayerKey(acc.playerName) === nKey)
    ) {
      return acc;
    }
  }
  return null;
}

function isNameTakenInLeaderboard(entries: LeaderboardRecord[], playerName: string): boolean {
  const uKey = compactAlnumKey(playerName);
  const nKey = normalizePlayerKey(playerName);
  return entries.some(
    (e) =>
      (uKey && compactAlnumKey(e.playerName) === uKey) ||
      (nKey && normalizePlayerKey(e.playerName) === nKey)
  );
}

function serializeAccountResponse(acc: AccountRecord) {
  const verified = Boolean(acc.verified);
  return {
    playerName: acc.playerName,
    nameLocked: true,
    verified,
    verifiedRole: verified ? (acc.verifiedRole ?? 'dono') : null,
    admUnlocked: Boolean(acc.admUnlocked),
    bestTimeMs: acc.bestTimeMs ?? 0,
    selectedMapId: acc.selectedMapId || 'metropole_neon',
    loadout: acc.loadout ?? undefined,
    accountBackupToken: signAccountBackup(acc),
  };
}

function restoreFromBackupPayload(
  payload: BackupPayload,
  newPlayerToken: string
): AccountRecord {
  const now = new Date().toISOString();
  return {
    uniqueKey: payload.u,
    playerToken: newPlayerToken,
    playerName: payload.n,
    passwordSalt: payload.s,
    passwordHash: payload.h,
    verified: Boolean(payload.vr),
    verifiedRole: payload.vr ? (payload.r ?? 'dono') : null,
    admUnlocked: Boolean(payload.a),
    bestTimeMs: Number.isFinite(payload.b) && payload.b > 0 ? payload.b : 0,
    selectedMapId: payload.m || 'metropole_neon',
    loadout: sanitizeLoadoutInput(payload.l),
    createdAt: payload.c || now,
    updatedAt: now,
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '64kb' }));

  await withLock(async () => {
    await readAccounts();
    await readLeaderboard();
  });

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.get('/api/leaderboard', async (_req: Request, res: Response) => {
    try {
      const entries = await withLock(() => readLeaderboard());
      res.json({ entries: attachRank(entries) });
    } catch (err) {
      console.error('Failed to read leaderboard:', err);
      res.status(500).json({ error: 'Erro ao carregar o ranking.' });
    }
  });

  // Restore active session OR auto-restore signed backup after app update/redeploy
  app.post('/api/player/session', async (req: Request, res: Response) => {
    try {
      const body = req.body ?? {};
      if (!isValidToken(body.playerToken)) {
        res.status(400).json({ ok: false, error: 'Identidade inválida.' });
        return;
      }
      const playerToken = body.playerToken.trim();
      const backupList: unknown[] = Array.isArray(body.accountBackupTokens)
        ? body.accountBackupTokens.slice(0, 12)
        : body.accountBackupToken
          ? [body.accountBackupToken]
          : [];

      const result = await withLock(async () => {
        const accounts = await readAccounts();
        const existing = findAccountByToken(accounts, playerToken);
        if (existing) {
          return { acc: existing, restored: false };
        }

        // If server restarted/republished, automatically restore matching signed backup for this token
        for (const rawBackup of backupList) {
          const payload = verifyAccountBackup(rawBackup);
          if (payload && payload.t === playerToken) {
            const collision = accounts[payload.u] || findAccountByUniqueOrNormKey(accounts, payload.n);
            if (!collision || collision.playerToken === playerToken) {
              const restoredAcc = restoreFromBackupPayload(payload, playerToken);
              await writeAccounts({ ...accounts, [restoredAcc.uniqueKey]: restoredAcc });
              return { acc: restoredAcc, restored: true };
            }
          }
        }

        return null;
      });

      if (!result) {
        res.status(200).json({
          ok: true,
          hasAccount: false,
          nameLocked: false,
          verified: false,
          verifiedRole: null,
          admUnlocked: false,
        });
        return;
      }

      res.status(200).json({
        ok: true,
        hasAccount: true,
        restored: result.restored,
        ...serializeAccountResponse(result.acc),
      });
    } catch (err) {
      console.error('Failed to read player session:', err);
      if (!res.headersSent) {
        res.status(500).json({ ok: false, error: 'Erro ao carregar sessão do jogador.' });
      }
    }
  });

  // Read-only name uniqueness check during account registration
  app.post('/api/player/check', async (req: Request, res: Response) => {
    try {
      const body = req.body ?? {};
      const playerName = cleanPlayerName(body.playerName);
      const uniqueKey = compactAlnumKey(playerName);

      if (playerName.length < 2 || uniqueKey.length < 2) {
        res.status(400).json({
          ok: false,
          available: false,
          error: 'Digite um nome com pelo menos 2 letras ou números válidos.',
        });
        return;
      }

      const taken = await withLock(async () => {
        const accounts = await readAccounts();
        const entries = await readLeaderboard();
        return Boolean(
          findAccountByUniqueOrNormKey(accounts, playerName) ||
            isNameTakenInLeaderboard(entries, playerName)
        );
      });

      if (taken) {
        res.status(409).json({
          ok: false,
          available: false,
          error: 'Esse nome já existe! Escolha outro nome ou clique em Entrar.',
        });
        return;
      }

      res.status(200).json({
        ok: true,
        available: true,
        playerName,
      });
    } catch (err) {
      console.error('Failed to check player name:', err);
      if (!res.headersSent) {
        res.status(500).json({ ok: false, error: 'Erro ao verificar o nome.' });
      }
    }
  });

  // Register a brand-new unique player account protected by password
  app.post('/api/auth/register', async (req: Request, res: Response) => {
    try {
      const body = req.body ?? {};
      if (!isValidToken(body.playerToken)) {
        res.status(400).json({ ok: false, error: 'Sessão inválida. Recarregue a página.' });
        return;
      }

      const playerToken = body.playerToken.trim();
      const playerName = cleanPlayerName(body.playerName);
      const uniqueKey = compactAlnumKey(playerName);
      const password = typeof body.password === 'string' ? body.password : '';

      if (playerName.length < 2 || uniqueKey.length < 2) {
        res.status(400).json({
          ok: false,
          error: 'Digite um nome com pelo menos 2 letras ou números válidos.',
        });
        return;
      }

      if (password.length < 4 || password.length > 64) {
        res.status(400).json({
          ok: false,
          error: 'A senha precisa ter entre 4 e 64 caracteres.',
        });
        return;
      }

      const outcome = await withLock(async () => {
        const accounts = await readAccounts();
        const entries = await readLeaderboard();

        if (
          findAccountByUniqueOrNormKey(accounts, playerName) ||
          isNameTakenInLeaderboard(entries, playerName)
        ) {
          return {
            ok: false as const,
            status: 409,
            error: 'Esse nome já está em uso! Escolha outro ou entre com sua senha.',
          };
        }

        const { salt, hash } = hashAccountPassword(password);
        const now = new Date().toISOString();
        const account: AccountRecord = {
          uniqueKey,
          playerToken,
          playerName,
          passwordSalt: salt,
          passwordHash: hash,
          verified: false,
          verifiedRole: null,
          admUnlocked: false,
          bestTimeMs: 0,
          selectedMapId:
            typeof body.selectedMapId === 'string' ? body.selectedMapId.slice(0, 40) : 'metropole_neon',
          loadout: sanitizeLoadoutInput(body.loadout),
          createdAt: now,
          updatedAt: now,
        };

        await writeAccounts({ ...accounts, [uniqueKey]: account });
        return { ok: true as const, account, entries };
      });

      if (!outcome.ok) {
        res.status(outcome.status).json({ ok: false, error: outcome.error });
        return;
      }

      res.status(201).json({
        ok: true,
        ...serializeAccountResponse(outcome.account),
        entries: attachRank(outcome.entries),
      });
    } catch (err) {
      console.error('Failed to register account:', err);
      if (!res.headersSent) {
        res.status(500).json({ ok: false, error: 'Erro ao criar a conta.' });
      }
    }
  });

  // Login to existing account with Name + Password (also recovers signed backup after updates/publish)
  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const body = req.body ?? {};
      if (!isValidToken(body.playerToken)) {
        res.status(400).json({ ok: false, error: 'Sessão inválida. Recarregue a página.' });
        return;
      }

      const playerToken = body.playerToken.trim();
      const playerName = cleanPlayerName(body.playerName);
      const uniqueKey = compactAlnumKey(playerName);
      const password = typeof body.password === 'string' ? body.password : '';
      const backupList: unknown[] = Array.isArray(body.accountBackupTokens)
        ? body.accountBackupTokens.slice(0, 12)
        : body.accountBackupToken
          ? [body.accountBackupToken]
          : [];

      if (playerName.length < 2 || uniqueKey.length < 2 || !password) {
        res.status(400).json({ ok: false, error: 'Informe seu nome e sua senha.' });
        return;
      }

      const outcome = await withLock(async () => {
        const accounts = await readAccounts();
        const entries = await readLeaderboard();
        const existing = findAccountByUniqueOrNormKey(accounts, playerName);

        if (existing) {
          if (!verifyAccountPassword(password, existing.passwordSalt, existing.passwordHash)) {
            return {
              ok: false as const,
              status: 401,
              error: 'Senha incorreta para essa conta.',
            };
          }

          const updated: AccountRecord = {
            ...existing,
            playerToken,
            updatedAt: new Date().toISOString(),
          };
          await writeAccounts({ ...accounts, [updated.uniqueKey]: updated });
          return { ok: true as const, account: updated, entries, restored: false };
        }

        // Check signed local backup tokens if server accounts were reset after an update/publish
        for (const rawBackup of backupList) {
          const payload = verifyAccountBackup(rawBackup);
          if (payload && payload.u === uniqueKey) {
            if (!verifyAccountPassword(password, payload.s, payload.h)) {
              return {
                ok: false as const,
                status: 401,
                error: 'Senha incorreta para essa conta.',
              };
            }
            const restoredAcc = restoreFromBackupPayload(payload, playerToken);
            await writeAccounts({ ...accounts, [restoredAcc.uniqueKey]: restoredAcc });
            return { ok: true as const, account: restoredAcc, entries, restored: true };
          }
        }

        return {
          ok: false as const,
          status: 404,
          error: 'Conta não encontrada. Confira o nome ou clique em Criar Conta.',
        };
      });

      if (!outcome.ok) {
        res.status(outcome.status).json({ ok: false, error: outcome.error });
        return;
      }

      res.status(200).json({
        ok: true,
        restored: outcome.restored,
        ...serializeAccountResponse(outcome.account),
        entries: attachRank(outcome.entries),
      });
    } catch (err) {
      console.error('Failed to login:', err);
      if (!res.headersSent) {
        res.status(500).json({ ok: false, error: 'Erro ao entrar na conta.' });
      }
    }
  });

  // Sync loadout, selected map, and personal record to account + refreshed backup token
  app.post('/api/player/sync', async (req: Request, res: Response) => {
    try {
      const body = req.body ?? {};
      if (!isValidToken(body.playerToken)) {
        res.status(400).json({ ok: false, error: 'Sessão inválida.' });
        return;
      }

      const playerToken = body.playerToken.trim();
      const updated = await withLock(async () => {
        const accounts = await readAccounts();
        const existing = findAccountByToken(accounts, playerToken);
        if (!existing) return null;

        const incomingBest = Number(body.bestTimeMs);
        const nextBest =
          Number.isFinite(incomingBest) && incomingBest > existing.bestTimeMs && incomingBest <= 36000000
            ? Math.round(incomingBest)
            : existing.bestTimeMs;

        const nextLoadout = sanitizeLoadoutInput(body.loadout) ?? existing.loadout;
        const nextMap =
          typeof body.selectedMapId === 'string' && body.selectedMapId.length > 0
            ? body.selectedMapId.slice(0, 40)
            : existing.selectedMapId;

        const nextAcc: AccountRecord = {
          ...existing,
          bestTimeMs: nextBest,
          loadout: nextLoadout,
          selectedMapId: nextMap,
          updatedAt: new Date().toISOString(),
        };
        await writeAccounts({ ...accounts, [nextAcc.uniqueKey]: nextAcc });
        return nextAcc;
      });

      if (!updated) {
        res.status(401).json({ ok: false, error: 'Conta não conectada.' });
        return;
      }

      res.status(200).json({
        ok: true,
        ...serializeAccountResponse(updated),
      });
    } catch (err) {
      console.error('Failed to sync account:', err);
      if (!res.headersSent) {
        res.status(500).json({ ok: false, error: 'Erro ao sincronizar conta.' });
      }
    }
  });

  // Validate hidden Owner/ADM privilege password strictly server-side
  app.post('/api/auth/verify', async (req: Request, res: Response) => {
    try {
      const body = req.body ?? {};
      if (!isValidToken(body.playerToken)) {
        res.status(400).json({ ok: false, error: 'Identidade do jogador inválida.' });
        return;
      }
      if (!isAdminPasswordValid(body.password)) {
        res.status(403).json({ ok: false, error: 'Senha secreta incorreta.' });
        return;
      }

      const playerToken = body.playerToken.trim();
      const outcome = await withLock(async () => {
        const accounts = await readAccounts();
        const existing = findAccountByToken(accounts, playerToken);
        if (!existing) {
          return {
            ok: false as const,
            status: 401,
            error: 'Entre ou crie sua conta antes de verificar.',
          };
        }

        const updatedAcc: AccountRecord = {
          ...existing,
          verified: true,
          verifiedRole: 'dono',
          admUnlocked: true,
          updatedAt: new Date().toISOString(),
        };
        await writeAccounts({ ...accounts, [updatedAcc.uniqueKey]: updatedAcc });

        const entries = await readLeaderboard();
        let mutated = false;
        let nextEntries = entries.map((entry) => {
          if (compactAlnumKey(entry.playerName) === updatedAcc.uniqueKey) {
            mutated = true;
            return {
              ...entry,
              playerName: updatedAcc.playerName,
              verified: true,
              verifiedRole: 'dono' as VerifiedRole,
            };
          }
          return entry;
        });
        if (mutated) {
          nextEntries = await writeLeaderboard(nextEntries);
        }

        return { ok: true as const, account: updatedAcc, entries: nextEntries };
      });

      if (!outcome.ok) {
        res.status(outcome.status).json({ ok: false, error: outcome.error });
        return;
      }

      res.status(200).json({
        ok: true,
        ...serializeAccountResponse(outcome.account),
        entries: attachRank(outcome.entries),
      });
    } catch (err) {
      console.error('Failed to verify secret password:', err);
      if (!res.headersSent) {
        res.status(500).json({ ok: false, error: 'Erro ao validar a senha secreta.' });
      }
    }
  });

  app.post('/api/leaderboard', async (req: Request, res: Response) => {
    try {
      const body = req.body ?? {};
      if (body.playMode === 'training') {
        res.status(400).json({ error: 'Modo treino não participa do ranking global.' });
        return;
      }

      if (!isValidToken(body.playerToken)) {
        res.status(401).json({ error: 'Faça login antes de salvar um recorde.' });
        return;
      }

      const timeMs = Number(body.timeMs);
      const mapId = typeof body.mapId === 'string' ? body.mapId.slice(0, 40) : 'metropole_neon';
      const mapName = typeof body.mapName === 'string' ? body.mapName.slice(0, 40) : 'Metrópole Neon';

      if (!Number.isFinite(timeMs) || timeMs <= 0 || timeMs > 36000000) {
        res.status(400).json({ error: 'Tempo inválido.' });
        return;
      }

      await withLock(async () => {
        const playerToken = body.playerToken.trim();
        const accounts = await readAccounts();
        const account = findAccountByToken(accounts, playerToken);

        if (!account) {
          res.status(401).json({ error: 'Conta não encontrada. Faça login novamente.' });
          return;
        }

        const roundedTimeMs = Math.round(timeMs);
        let updatedAccount = account;
        if (roundedTimeMs > account.bestTimeMs) {
          updatedAccount = {
            ...account,
            bestTimeMs: roundedTimeMs,
            updatedAt: new Date().toISOString(),
          };
          await writeAccounts({ ...accounts, [updatedAccount.uniqueKey]: updatedAccount });
        }

        const entries = await readLeaderboard();
        const existingIndex = entries.findIndex(
          (item) => compactAlnumKey(item.playerName) === account.uniqueKey
        );

        if (existingIndex !== -1 && entries[existingIndex].timeMs >= roundedTimeMs) {
          const ranked = attachRank(entries);
          const existingPlaced = ranked[existingIndex];
          res.status(200).json({
            entries: ranked,
            rank: null,
            bestRank: existingPlaced ? existingPlaced.rank : null,
            improved: false,
            keptRecordId: existingPlaced ? existingPlaced.id : null,
            accountBackupToken: signAccountBackup(updatedAccount),
          });
          return;
        }

        const newRecord: LeaderboardRecord = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          playerName: updatedAccount.playerName,
          timeMs: roundedTimeMs,
          mapId,
          mapName,
          createdAt: new Date().toISOString(),
          playerToken,
          verified: Boolean(updatedAccount.verified),
          verifiedRole: updatedAccount.verified ? (updatedAccount.verifiedRole ?? 'dono') : null,
        };

        const filtered = entries.filter(
          (item) => compactAlnumKey(item.playerName) !== account.uniqueKey
        );
        const updated = await writeLeaderboard([...filtered, newRecord]);

        const ranked = attachRank(updated);
        const placed = ranked.find((item) => item.id === newRecord.id);

        res.status(201).json({
          entries: ranked,
          rank: placed ? placed.rank : null,
          bestRank: placed ? placed.rank : null,
          improved: Boolean(placed),
          keptRecordId: placed ? placed.id : null,
          accountBackupToken: signAccountBackup(updatedAccount),
        });
      });
    } catch (err) {
      console.error('Failed to save leaderboard entry:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Erro ao salvar recorde no ranking.' });
      }
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('/{*splat}', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Cyber Surfers server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Server startup failed:', err);
  process.exit(1);
});
