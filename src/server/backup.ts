import { copyFile, mkdir, readFile, readdir, stat, unlink, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { storeObject } from './storage.ts';

const DATA_PATH = resolve(process.cwd(), process.env.DATA_FILE ?? 'data/app-state.json');
const BACKUP_DIR = resolve(process.cwd(), process.env.BACKUP_DIR ?? 'backups');
const BACKUP_INTERVAL_MS = Number(process.env.BACKUP_INTERVAL_MS ?? 24 * 60 * 60 * 1000);
const BACKUP_RETENTION_DAYS = Number(process.env.BACKUP_RETENTION_DAYS ?? 30);
let backupTimer: NodeJS.Timeout | undefined;
let lastBackup: BackupResult | undefined;
let backupInFlight: Promise<BackupResult> | undefined;

export interface BackupResult {
  timestamp: string;
  localPath: string;
  fileName: string;
  sizeBytes: number;
  r2Key?: string;
  r2Url?: string;
  error?: string;
}

export async function runBackup(reason = 'manual'): Promise<BackupResult> {
  if (backupInFlight) return backupInFlight;
  backupInFlight = createBackup(reason).finally(() => { backupInFlight = undefined; });
  lastBackup = await backupInFlight;
  return lastBackup;
}

export function startBackupScheduler() {
  if (backupTimer || process.env.BACKUP_ENABLED !== 'true') return;
  backupTimer = setInterval(() => {
    runBackup('scheduled').catch((error) => console.error('Scheduled backup failed:', error instanceof Error ? error.message : error));
  }, BACKUP_INTERVAL_MS);
  backupTimer.unref?.();
  runBackup('startup').catch((error) => console.error('Startup backup failed:', error instanceof Error ? error.message : error));
}

export function backupStatus() {
  return {
    enabled: process.env.BACKUP_ENABLED === 'true',
    intervalMs: BACKUP_INTERVAL_MS,
    retentionDays: BACKUP_RETENTION_DAYS,
    localDir: BACKUP_DIR,
    lastBackup,
  };
}

async function createBackup(reason: string): Promise<BackupResult> {
  await mkdir(BACKUP_DIR, { recursive: true });
  await mkdir(dirname(DATA_PATH), { recursive: true });
  const timestamp = new Date().toISOString();
  const safeStamp = timestamp.replace(/[:.]/g, '-');
  const fileName = `app-state-${safeStamp}-${reason}.json`;
  const localPath = join(BACKUP_DIR, fileName);
  await copyFile(DATA_PATH, localPath);
  const sizeBytes = (await stat(localPath)).size;
  const payload = await readFile(localPath);
  const result: BackupResult = { timestamp, localPath, fileName, sizeBytes };
  try {
    const stored = await storeObject(`backups/app-state/${fileName}`, 'application/json', payload, { allowInlineFallback: false });
    result.r2Key = stored.key;
    result.r2Url = stored.url;
  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Upload backup ke R2 gagal';
  }
  await writeFile(join(BACKUP_DIR, 'latest.json'), JSON.stringify(result, null, 2));
  await pruneLocalBackups();
  return result;
}

async function pruneLocalBackups() {
  if (!Number.isFinite(BACKUP_RETENTION_DAYS) || BACKUP_RETENTION_DAYS <= 0) return;
  const cutoff = Date.now() - BACKUP_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const files = await readdir(BACKUP_DIR).catch(() => []);
  await Promise.all(files.filter((file) => file.startsWith('app-state-') && file.endsWith('.json')).map(async (file) => {
    const full = join(BACKUP_DIR, file);
    const info = await stat(full).catch(() => null);
    if (info && info.mtimeMs < cutoff) await unlink(full).catch(() => undefined);
  }));
}
