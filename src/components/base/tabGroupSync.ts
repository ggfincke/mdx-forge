// src/components/base/tabGroupSync.ts
// module-level store syncing tab selection across groups w/ persistence

type Listener = () => void;

// in-memory choice per storage key; never read from storage during render
const choices = new Map<string, string>();
const listeners = new Map<string, Set<Listener>>();

function notify(key: string): void {
  listeners.get(key)?.forEach((listener) => listener());
}

// subscribe to choice changes for a storage key
export function subscribeTabGroup(key: string, listener: Listener): () => void {
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  set.add(listener);
  return () => {
    set.delete(listener);
    if (set.size === 0) {
      listeners.delete(key);
    }
  };
}

// current in-memory choice (undefined until a selection or restore)
export function getTabGroupChoice(key: string): string | undefined {
  return choices.get(key);
}

// publish a choice in-memory only (URL restores must not overwrite storage)
export function publishTabGroupChoice(key: string, value: string): void {
  if (choices.get(key) === value) {
    return;
  }
  choices.set(key, value);
  notify(key);
}

// record a user selection: publish to every group & persist
export function setTabGroupChoice(key: string, value: string): void {
  publishTabGroupChoice(key, value);
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // storage unavailable -> in-memory sync only
  }
}

// restore a persisted choice once after hydration; no-op when already chosen
export function restoreTabGroupChoice(key: string): void {
  if (choices.has(key)) {
    return;
  }
  try {
    const stored = window.localStorage.getItem(key);
    if (stored !== null) {
      publishTabGroupChoice(key, stored);
    }
  } catch {
    // ignore storage errors
  }
}

// test-only reset for the module-level store
export function __resetTabGroupSync(): void {
  choices.clear();
  listeners.clear();
}
