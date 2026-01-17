export { useGeminiLive } from './useGeminiLive';
export type {
  Transcript,
  UseGeminiLiveOptions,
  UseGeminiLiveReturn,
  ConnectionState,
  DebugLevel,
  DebugCallback,
  ToolDefinition,
  ToolCall,
  ToolCallHandler,
} from './types';

// Browser capability detection utilities
export {
  isIOS,
  isMobile,
  canScreenRecord,
  shouldUseCameraMode,
  getVideoMimeType,
  getRecommendedAudioConstraints,
} from './browserCapabilities';

// Captured Surface Control (Chrome 124+ scroll/zoom control for captured screens)
export {
  useCapturedSurfaceControl,
  isCapturedSurfaceControlSupported,
} from './useCapturedSurfaceControl';
export type {
  CapturedSurfaceControlState,
  ScrollByOptions,
  UseCapturedSurfaceControlReturn,
} from './useCapturedSurfaceControl';
