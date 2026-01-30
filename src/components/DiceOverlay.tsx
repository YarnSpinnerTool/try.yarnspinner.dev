import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

export type DiceOverlayHandle = {
  /** Roll a die and return the physics-determined face value. Returns null on failure. */
  rollAndWait(sides: number): Promise<number | null>;
  /** Roll dice notation (e.g. "2d6") and return the sum. Returns null on failure. */
  rollNotationAndWait(notation: string): Promise<number | null>;
  clear(): void;
};

const SUPPORTED_DICE = new Set([4, 6, 8, 10, 12, 20, 100]);

// Matches dice notation like "2d6", "3d20", "1d100"
const NOTATION_RE = /^(\d+)d(\d+)$/i;
function parseNotation(s: string): { qty: number; sides: number } | null {
  const m = s.match(NOTATION_RE);
  if (!m) return null;
  const qty = parseInt(m[1], 10);
  const sides = parseInt(m[2], 10);
  if (qty < 1 || !SUPPORTED_DICE.has(sides)) return null;
  return { qty, sides };
}

// After dice settle, show the result briefly before fading out
const POST_SETTLE_DISPLAY_MS = 1500;
const FADE_DURATION_MS = 800;
const CLEANUP_DELAY_MS = POST_SETTLE_DISPLAY_MS + FADE_DURATION_MS + 200;

// Max time to wait for physics to settle before falling back to built-in dice
const ROLL_TIMEOUT_MS = 15000;

export const DiceOverlay = forwardRef<
  DiceOverlayHandle,
  { enabled?: boolean; theme?: string }
>(({ enabled = true, theme }, ref) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const diceBoxRef = useRef<any>(null);
  const [initFailed, setInitFailed] = useState(false);
  const initPromiseRef = useRef<Promise<void> | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cleanupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const cancelTimers = () => {
    if (fadeTimerRef.current) {
      clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
    if (cleanupTimerRef.current) {
      clearTimeout(cleanupTimerRef.current);
      cleanupTimerRef.current = null;
    }
    // Reset any in-progress fade
    if (containerRef.current) {
      containerRef.current.style.transition = '';
      containerRef.current.style.opacity = '1';
    }
  };

  const schedulePostSettleCleanup = () => {
    cancelTimers();
    const box = diceBoxRef.current;
    if (!box) return;

    // Show the settled die for a moment, then fade out
    fadeTimerRef.current = setTimeout(() => {
      if (containerRef.current) {
        containerRef.current.style.transition = `opacity ${FADE_DURATION_MS}ms ease-out`;
        containerRef.current.style.opacity = '0';
      }
    }, POST_SETTLE_DISPLAY_MS);

    // After fade completes, clear dice and restore container
    cleanupTimerRef.current = setTimeout(() => {
      box.clear();
      if (containerRef.current) {
        containerRef.current.style.transition = '';
        containerRef.current.style.opacity = '1';
      }
    }, CLEANUP_DELAY_MS);
  };

  // Wait until the container element has non-zero layout dimensions.
  // On iOS Safari, position:absolute + percentage sizing can resolve to
  // 0x0 before the browser has finished layout. dice-box reads
  // canvas.clientWidth/clientHeight during init() — if those are 0 the
  // WebGL drawing buffer is permanently invisible.
  const waitForLayout = (el: HTMLElement): Promise<void> => {
    if (el.clientWidth > 0 && el.clientHeight > 0) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      let attempts = 0;
      const check = () => {
        if (el.clientWidth > 0 && el.clientHeight > 0 || attempts >= 30) {
          resolve();
          return;
        }
        attempts++;
        requestAnimationFrame(check);
      };
      requestAnimationFrame(check);
    });
  };

  // Ensure dice-box is initialized (lazy, only loads the heavy lib when needed).
  // NOT called eagerly — we wait until the first roll so that the container
  // is guaranteed to be laid out and visible (fixes 0x0 canvas on iOS).
  const ensureInit = (): Promise<void> => {
    if (diceBoxRef.current) return Promise.resolve();
    if (initPromiseRef.current) return initPromiseRef.current;

    initPromiseRef.current = (async () => {
      try {
        // Start the heavy download immediately (network I/O) while we
        // wait for the container to have layout dimensions in parallel.
        const modulePromise = import("@3d-dice/dice-box");
        if (containerRef.current) {
          await waitForLayout(containerRef.current);
        }

        const DiceBox = (await modulePromise).default;
        const box = new DiceBox({
          container: "#dice-overlay-container",
          assetPath: "/assets/dice-box/",
          ...(theme ? { theme } : {}),
          themeColor: "#4C8962",
          scale: 6,
          gravity: 2,
          throwForce: 5,
          spinForce: 4,
          offscreen: false,
        });
        await box.init();

        // dice-box creates its canvas during init() and immediately reads
        // canvas.clientWidth/clientHeight to size the WebGL drawing buffer.
        // On iOS Safari, the CSS (width/height: 100%) hasn't been applied to
        // the newly-appended canvas yet, so those reads return 0 → invisible.
        // Wait one frame for layout, then force a resize recalculation.
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => {
            try { box.resizeWorld(); } catch { /* ignore */ }
            resolve();
          });
        });

        diceBoxRef.current = box;
      } catch (err) {
        console.warn("DiceOverlay: failed to init dice-box", err);
        setInitFailed(true);
        throw err;
      }
    })();

    return initPromiseRef.current;
  };

  // Eagerly start init when enabled — waitForLayout inside ensureInit
  // guarantees the container has real dimensions before dice-box reads them.
  useEffect(() => {
    if (!enabled || initFailed || diceBoxRef.current || initPromiseRef.current) return;
    ensureInit().catch(() => {});
  }, [enabled, initFailed]);

  // Shared setup for roll methods: ensure init, get box ref, cancel timers
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prepareForRoll = async (): Promise<any | null> => {
    if (!enabled) return null;
    try {
      await ensureInit();
    } catch {
      return null;
    }
    const box = diceBoxRef.current;
    if (!box) return null;

    // Cancel any pending fade/cleanup from a previous roll
    cancelTimers();
    if (containerRef.current) {
      containerRef.current.style.transition = '';
      containerRef.current.style.opacity = '1';
    }
    return box;
  };

  useImperativeHandle(
    ref,
    () => ({
      async rollAndWait(sides: number): Promise<number | null> {
        if (!SUPPORTED_DICE.has(sides)) return null;

        const box = await prepareForRoll();
        if (!box) return null;

        try {
          // Race the physics roll against a timeout — if the worker
          // errors (e.g. AmmoJS WASM failure), the promise may hang.
          const results = await Promise.race([
            box.roll(`1d${sides}`),
            new Promise<null>((resolve) =>
              setTimeout(() => resolve(null), ROLL_TIMEOUT_MS)
            ),
          ]);

          if (results === null) {
            // Timed out — physics engine likely errored
            try { box.clear(); } catch { /* ignore */ }
            return null;
          }

          const value = results?.[0]?.value
            ?? results?.[0]?.rolls?.[0]?.value
            ?? null;

          // Validate the result is in the expected range [1, sides].
          // On some devices (e.g. iOS Safari) the face detection can fail,
          // returning 0 or -1 ("No value found for mesh face -1").
          // Still show the dice animation (visual-only) — just return null
          // so the game falls back to the built-in random dice value.
          if (typeof value !== 'number' || value < 1 || value > sides) {
            schedulePostSettleCleanup();
            return null;
          }

          // Show the settled die, then schedule fade + cleanup
          schedulePostSettleCleanup();

          return value;
        } catch {
          return null;
        }
      },

      async rollNotationAndWait(notation: string): Promise<number | null> {
        const parsed = parseNotation(notation);
        if (!parsed) return null;

        const box = await prepareForRoll();
        if (!box) return null;

        try {
          const results = await Promise.race([
            box.roll(notation),
            new Promise<null>((resolve) =>
              setTimeout(() => resolve(null), ROLL_TIMEOUT_MS)
            ),
          ]);

          if (results === null) {
            try { box.clear(); } catch { /* ignore */ }
            return null;
          }

          // Sum all individual die values from the results array
          let total = 0;
          for (const entry of results) {
            const v = entry.value
              ?? entry.rolls?.[0]?.value
              ?? null;
            if (typeof v !== 'number' || v < 1 || v > parsed.sides) {
              schedulePostSettleCleanup();
              return null;
            }
            total += v;
          }

          schedulePostSettleCleanup();
          return total;
        } catch {
          return null;
        }
      },

      clear() {
        cancelTimers();
        diceBoxRef.current?.clear();
      },
    }),
    [enabled],
  );

  // Suppress errors from dice-box's web workers (blob URLs) to prevent
  // them from triggering the app's ErrorBoundary. These are non-critical
  // visual failures — the game falls back to built-in dice.
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: ErrorEvent) => {
      if (e.filename?.startsWith('blob:')) {
        e.preventDefault();
        console.warn('DiceOverlay: suppressed worker error:', e.message);
      }
    };
    window.addEventListener('error', handler);
    return () => window.removeEventListener('error', handler);
  }, [enabled]);

  // When disabled or unmounted, tear down dice-box so re-enabling
  // triggers a fresh init with the new DOM container
  useEffect(() => {
    if (!enabled) {
      cancelTimers();
      try { diceBoxRef.current?.clear(); } catch { /* ignore */ }
      diceBoxRef.current = null;
      initPromiseRef.current = null;
    }
    return () => {
      cancelTimers();
      try { diceBoxRef.current?.clear(); } catch { /* ignore */ }
      diceBoxRef.current = null;
      initPromiseRef.current = null;
    };
  }, [enabled]);

  if (!enabled || initFailed) return null;

  return <div ref={containerRef} id="dice-overlay-container" className="dice-overlay" />;
});
