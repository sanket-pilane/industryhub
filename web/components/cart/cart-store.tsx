"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";

/**
 * Demo cart kept in the browser (per user) until the database lands in
 * Phase 2. Prices are never stored here; pages look them up from products,
 * and authoritative totals will be recalculated on the server.
 */
export interface CartLine {
  productId: string;
  quantity: number;
}
interface Toast {
  id: number;
  message: string;
}
interface CartContextValue {
  lines: CartLine[];
  count: number;
  hydrated: boolean;
  add(productId: string, quantity: number, name: string): void;
  setQuantity(productId: string, quantity: number): void;
  remove(productId: string): void;
  clear(): void;
}

export const MAX_QUANTITY = 999;
const clamp = (n: number) =>
  Math.min(MAX_QUANTITY, Math.max(1, Math.floor(n) || 1));

// localStorage-backed external store; falls back to memory when storage is
// unavailable (e.g. blocked in private mode).
const EMPTY: CartLine[] = [];
const memory = new Map<string, string>();
const cache = new Map<string, { raw: string | null; lines: CartLine[] }>();
const listeners = new Set<() => void>();

function readRaw(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return memory.get(key) ?? null;
  }
}
function parse(raw: string | null): CartLine[] {
  try {
    const value: unknown = JSON.parse(raw ?? "[]");
    if (!Array.isArray(value)) return EMPTY;
    return value.filter(
      (line): line is CartLine =>
        typeof line?.productId === "string" &&
        Number.isSafeInteger(line?.quantity) &&
        line.quantity > 0,
    );
  } catch {
    return EMPTY;
  }
}
function snapshot(key: string) {
  const raw = readRaw(key);
  const cached = cache.get(key);
  if (cached && cached.raw === raw) return cached.lines;
  const lines = parse(raw);
  cache.set(key, { raw, lines });
  return lines;
}
function write(key: string, lines: CartLine[]) {
  const raw = JSON.stringify(lines);
  try {
    localStorage.setItem(key, raw);
  } catch {
    memory.set(key, raw);
  }
  cache.set(key, { raw, lines });
  listeners.forEach((notify) => notify());
}
function subscribe(notify: () => void) {
  listeners.add(notify);
  window.addEventListener("storage", notify); // other tabs
  return () => {
    listeners.delete(notify);
    window.removeEventListener("storage", notify);
  };
}
const noopSubscribe = () => () => {};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({
  userId,
  children,
}: {
  userId: string;
  children: React.ReactNode;
}) {
  const key = `industrihub:cart:${userId}`;
  const lines = useSyncExternalStore(
    subscribe,
    () => snapshot(key),
    () => EMPTY,
  );
  const hydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const notify = useCallback((message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), message });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  const value = useMemo<CartContextValue>(() => {
    const update = (fn: (current: CartLine[]) => CartLine[]) =>
      write(key, fn(snapshot(key)));
    return {
      lines,
      hydrated,
      count: lines.reduce((sum, line) => sum + line.quantity, 0),
      add(productId, quantity, name) {
        update((current) =>
          current.some((l) => l.productId === productId)
            ? current.map((l) =>
                l.productId === productId
                  ? { ...l, quantity: clamp(l.quantity + quantity) }
                  : l,
              )
            : [...current, { productId, quantity: clamp(quantity) }],
        );
        notify(`Added ${clamp(quantity)} × ${name} to your cart`);
      },
      setQuantity(productId, quantity) {
        update((current) =>
          current.map((l) =>
            l.productId === productId ? { ...l, quantity: clamp(quantity) } : l,
          ),
        );
      },
      remove(productId) {
        update((current) => current.filter((l) => l.productId !== productId));
      },
      clear() {
        update(() => []);
      },
    };
  }, [key, lines, hydrated, notify]);

  return (
    <CartContext.Provider value={value}>
      {children}
      <div className="toast-region" aria-live="polite" aria-atomic="true">
        {toast && (
          <div className="toast" key={toast.id}>
            <span className="toast-check" aria-hidden="true">
              ✓
            </span>
            <span>{toast.message}</span>
            <Link href="/cart" onClick={() => setToast(null)}>
              View cart
            </Link>
          </div>
        )}
      </div>
    </CartContext.Provider>
  );
}

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart must be used inside CartProvider.");
  return value;
}
