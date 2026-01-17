import { useRef, useCallback, useState, useEffect } from 'react';

/**
 * Chrome's Captured Surface Control API
 *
 * Enables scroll and zoom control of a captured tab/window without needing
 * a script installed on the target page. Useful for AI-assisted navigation
 * where you want to scroll the user's shared screen.
 *
 * Browser support: Chrome 124+ only
 * Spec: https://wicg.github.io/captured-surface-control/
 */

/**
 * State returned by useCapturedSurfaceControl hook
 */
export interface CapturedSurfaceControlState {
  /** Whether the Captured Surface Control API is supported in this browser */
  supported: boolean;
  /** Whether permission has been granted for surface control */
  permissionGranted: boolean;
  /** Error message if an operation failed */
  error: string | null;
  /** Whether a CaptureController is currently available */
  hasController: boolean;
}

/**
 * Options for scrollBy operation
 */
export interface ScrollByOptions {
  /** X coordinate for wheel event position (defaults to viewport center) */
  x?: number;
  /** Y coordinate for wheel event position (defaults to viewport center) */
  y?: number;
  /** Horizontal scroll delta in pixels */
  deltaX?: number;
  /** Vertical scroll delta in pixels */
  deltaY?: number;
}

/**
 * Return type for useCapturedSurfaceControl hook
 */
export interface UseCapturedSurfaceControlReturn extends CapturedSurfaceControlState {
  /** Scroll to an absolute position */
  scrollTo: (x: number, y: number) => Promise<boolean>;
  /** Scroll by a relative amount */
  scrollBy: (options: ScrollByOptions) => Promise<boolean>;
  /** Scroll up by specified pixels (default 300) */
  scrollUp: (amount?: number) => Promise<boolean>;
  /** Scroll down by specified pixels (default 300) */
  scrollDown: (amount?: number) => Promise<boolean>;
  /** Scroll left by specified pixels (default 300) */
  scrollLeft: (amount?: number) => Promise<boolean>;
  /** Scroll right by specified pixels (default 300) */
  scrollRight: (amount?: number) => Promise<boolean>;
  /** Get current zoom level of captured surface */
  getZoomLevel: () => Promise<number | null>;
  /** Set zoom level of captured surface */
  setZoomLevel: (level: number) => Promise<boolean>;
}

// Extend CaptureController interface for TypeScript
declare global {
  interface CaptureController {
    forwardWheel(event: {
      x: number;
      y: number;
      deltaX?: number;
      deltaY?: number;
      deltaMode?: number;
    }): Promise<void>;
    getZoomLevel(): Promise<number>;
    setZoomLevel(level: number): Promise<void>;
    oncapturedzoomlevelchange: ((this: CaptureController, ev: Event) => void) | null;
  }
}

/**
 * Check if Captured Surface Control API is available in the current browser.
 *
 * @returns true if the API is supported (Chrome 124+)
 */
export function isCapturedSurfaceControlSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    'CaptureController' in window &&
    typeof (window as any).CaptureController?.prototype?.forwardWheel === 'function'
  );
}

/**
 * React hook for controlling a captured screen surface (scroll and zoom).
 *
 * Use this hook when you have a MediaStream from getDisplayMedia() and want
 * to programmatically scroll or zoom the captured tab/window.
 *
 * @param stream - MediaStream from screen capture (getDisplayMedia)
 * @returns Control functions and state
 *
 * @example
 * ```tsx
 * const { supported, scrollDown, scrollUp } = useCapturedSurfaceControl(stream);
 *
 * if (supported) {
 *   await scrollDown(500); // Scroll down 500px
 * }
 * ```
 */
export function useCapturedSurfaceControl(
  stream: MediaStream | null
): UseCapturedSurfaceControlReturn {
  const controllerRef = useRef<CaptureController | null>(null);
  const [state, setState] = useState<CapturedSurfaceControlState>({
    supported: false,
    permissionGranted: false,
    error: null,
    hasController: false,
  });

  // Check API support on mount
  useEffect(() => {
    setState(prev => ({
      ...prev,
      supported: isCapturedSurfaceControlSupported(),
    }));
  }, []);

  // Initialize controller when stream is available
  useEffect(() => {
    if (!stream || !state.supported) {
      controllerRef.current = null;
      setState(prev => ({ ...prev, hasController: false }));
      return;
    }

    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) {
      controllerRef.current = null;
      setState(prev => ({ ...prev, hasController: false }));
      return;
    }

    // Access capture controller from track settings
    const settings = videoTrack.getSettings() as any;
    if (settings.captureController) {
      controllerRef.current = settings.captureController;
      setState(prev => ({
        ...prev,
        permissionGranted: true,
        hasController: true,
        error: null,
      }));
    } else {
      controllerRef.current = null;
      setState(prev => ({ ...prev, hasController: false }));
    }
  }, [stream, state.supported]);

  /** Scroll to an absolute position */
  const scrollTo = useCallback(async (x: number, y: number): Promise<boolean> => {
    if (!controllerRef.current) return false;

    try {
      await controllerRef.current.forwardWheel({
        x,
        y,
        deltaY: 0,
        deltaMode: 0,
      });
      return true;
    } catch (error) {
      setState(prev => ({ ...prev, error: String(error) }));
      return false;
    }
  }, []);

  /** Scroll by a relative amount */
  const scrollBy = useCallback(async (options: ScrollByOptions): Promise<boolean> => {
    if (!controllerRef.current) return false;

    try {
      const centerX = typeof window !== 'undefined' ? window.innerWidth / 2 : 500;
      const centerY = typeof window !== 'undefined' ? window.innerHeight / 2 : 400;

      await controllerRef.current.forwardWheel({
        x: options.x ?? centerX,
        y: options.y ?? centerY,
        deltaX: options.deltaX ?? 0,
        deltaY: options.deltaY ?? 0,
        deltaMode: 0,
      });
      return true;
    } catch (error) {
      setState(prev => ({ ...prev, error: String(error) }));
      return false;
    }
  }, []);

  /** Scroll up by specified pixels (default 300) */
  const scrollUp = useCallback(
    async (amount: number = 300): Promise<boolean> => {
      return scrollBy({ deltaY: -amount });
    },
    [scrollBy]
  );

  /** Scroll down by specified pixels (default 300) */
  const scrollDown = useCallback(
    async (amount: number = 300): Promise<boolean> => {
      return scrollBy({ deltaY: amount });
    },
    [scrollBy]
  );

  /** Scroll left by specified pixels (default 300) */
  const scrollLeft = useCallback(
    async (amount: number = 300): Promise<boolean> => {
      return scrollBy({ deltaX: -amount });
    },
    [scrollBy]
  );

  /** Scroll right by specified pixels (default 300) */
  const scrollRight = useCallback(
    async (amount: number = 300): Promise<boolean> => {
      return scrollBy({ deltaX: amount });
    },
    [scrollBy]
  );

  /** Get current zoom level of captured surface */
  const getZoomLevel = useCallback(async (): Promise<number | null> => {
    if (!controllerRef.current) return null;

    try {
      return await controllerRef.current.getZoomLevel();
    } catch {
      return null;
    }
  }, []);

  /** Set zoom level of captured surface */
  const setZoomLevel = useCallback(async (level: number): Promise<boolean> => {
    if (!controllerRef.current) return false;

    try {
      await controllerRef.current.setZoomLevel(level);
      return true;
    } catch (error) {
      setState(prev => ({ ...prev, error: String(error) }));
      return false;
    }
  }, []);

  return {
    // State
    supported: state.supported,
    permissionGranted: state.permissionGranted,
    error: state.error,
    hasController: state.hasController,

    // Scroll actions
    scrollTo,
    scrollBy,
    scrollUp,
    scrollDown,
    scrollLeft,
    scrollRight,

    // Zoom actions
    getZoomLevel,
    setZoomLevel,
  };
}
