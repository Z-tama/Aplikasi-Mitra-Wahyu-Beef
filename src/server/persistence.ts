import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { AppState } from '../seed.ts';
import { createSeedState, syncProductCatalogImages, syncProductCatalogPrices } from '../seed.ts';

const DATA_PATH = resolve(process.cwd(), process.env.DATA_FILE ?? 'data/app-state.json');
let state: AppState | null = null;
let writeQueue = Promise.resolve();

export async function loadState(): Promise<AppState> {
  if (state) return state;
  try {
    const raw = await readFile(DATA_PATH, 'utf8');
    state = syncProductCatalogPrices(syncProductCatalogImages(JSON.parse(raw) as AppState));
  } catch {
    state = createSeedState();
    await saveState(state);
  }
  return state;
}

export async function saveState(nextState: AppState) {
  state = nextState;
  writeQueue = writeQueue.then(async () => {
    await mkdir(dirname(DATA_PATH), { recursive: true });
    await writeFile(DATA_PATH, JSON.stringify(nextState, null, 2));
  });
  await writeQueue;
}

export async function mutateState<T>(fn: (state: AppState) => T | Promise<T>): Promise<T> {
  const current = await loadState();
  const result = await fn(current);
  await saveState(current);
  return result;
}

export function resetLoadedStateForTests() {
  state = null;
}
