"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useSyncExternalStore,
  useTransition,
  type SetStateAction,
} from "react";
import { useRouter } from "next/navigation";
import type { Catalog } from "@pasaorder/types";
import {
  cartStorageKey,
  deviceStorage,
  encodeCart,
  restoreCart,
  type CartLine,
} from "./saved-cart";

const serverSnapshot = { raw: null as string | null, saved: false };

function cartStore(key: string, preview: boolean) {
  let snapshot = serverSnapshot;
  let initialized = false;
  const listeners = new Set<() => void>();
  const getSnapshot = () => {
    if (!initialized) {
      initialized = true;
      try {
        const storage = preview ? null : deviceStorage();
        snapshot = { raw: storage?.getItem(key) ?? null, saved: !!storage };
      } catch {
        /* Use memory for this tab. */
      }
    }
    return snapshot;
  };
  return {
    getSnapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    write(lines: CartLine[]) {
      const raw = lines.length ? encodeCart(lines) : null;
      let saved = false;
      try {
        const storage = preview ? null : deviceStorage();
        if (storage) {
          if (raw) storage.setItem(key, raw);
          else storage.removeItem(key);
          saved = true;
        }
      } catch {
        /* Preserve the cart in memory even when storage is full. */
      }
      initialized = true;
      snapshot = { raw, saved };
      listeners.forEach((listener) => listener());
    },
  };
}

function subscribeConnection(listener: () => void) {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
}
const onlineSnapshot = () => navigator.onLine;
const serverOnlineSnapshot = () => true;

export function useMenuRecovery(catalog: Catalog, preview: boolean) {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  const store = useMemo(
    () => cartStore(cartStorageKey(catalog.store.id), preview),
    [catalog.store.id, preview],
  );
  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    () => serverSnapshot,
  );
  const restored = useMemo(
    () => restoreCart(snapshot.raw, catalog),
    [snapshot.raw, catalog],
  );
  const setCart = useCallback(
    (action: SetStateAction<CartLine[]>) => {
      const current = restoreCart(store.getSnapshot().raw, catalog).lines;
      store.write(typeof action === "function" ? action(current) : action);
    },
    [store, catalog],
  );
  const online = useSyncExternalStore(
    subscribeConnection,
    onlineSnapshot,
    serverOnlineSnapshot,
  );

  useEffect(() => {
    if (preview) return;
    const refresh = () => startTransition(() => router.refresh());
    window.addEventListener("online", refresh);
    return () => window.removeEventListener("online", refresh);
  }, [preview, router]);

  return {
    cart: restored.lines,
    setCart,
    cartAdjusted: restored.changed,
    saved: snapshot.saved,
    online,
    refreshing,
  };
}
