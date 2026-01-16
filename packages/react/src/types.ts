/**
 * Debug log levels for categorizing log messages
 */
export type DebugLevel = 'info' | 'warn' | 'error' | 'verbose';

/**
 * Debug callback function signature
 */
export type DebugCallback = (level: DebugLevel, message: string, data?: unknown) => void;

/**
 * A transcript entry representing either user speech or AI response
 */
export interface Transcript {
  /** Unique identifier for this transcript entry */
  id: string;
  /** Who said this - 'user' for mic input, 'assistant' for AI */
  role: 'user' | 'assistant';
  /** The transcribed text */
  text: string;
  /** When this transcript was created */
  timestamp: Date;
}

/**
 * Definition of a tool that can be called by the AI
 */
export interface ToolDefinition {
  /** Unique name for this tool */
  name: string;
  /** Description of what this tool does (helps AI decide when to use it) */
  description: string;
  /**
   * JSON Schema for the tool's parameters
   * @example { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }
   */
  parameters?: Record<string, unknown>;
}

/**
 * A tool call request from the AI
 */
export interface ToolCall {
  /** Unique ID for this tool call (use when sending results back) */
  id: string;
  /** Name of the tool being called */
  name: string;
  /** Arguments passed to the tool */
  args: Record<string, unknown>;
}

/**
 * Callback function signature for handling tool calls
 * Return the result to send back to the AI
 */
export type ToolCallHandler = (
  toolName: string,
  args: Record<string, unknown>
) => Promise<unknown> | unknown;

/**
 * Configuration options for useGeminiLive hook
 */
export interface UseGeminiLiveOptions {
  /**
   * WebSocket URL of your Gemini Live proxy server
   * @example 'wss://your-project.supabase.co/functions/v1/gemini-live-proxy'
   */
  proxyUrl: string;

  /**
   * Optional session ID passed to the proxy as a query parameter
   * Useful for identifying sessions or loading custom configurations
   */
  sessionId?: string;

  /**
   * Optional message sent to AI immediately after connection to trigger a greeting
   * @example 'Please greet the user warmly and ask how you can help them today.'
   */
  welcomeMessage?: string;

  /**
   * Callback fired when a new transcript entry is finalized
   * Transcripts are debounced - this fires after 1.5s of silence
   */
  onTranscript?: (transcript: Transcript) => void;

  /**
   * Callback fired when an error occurs
   */
  onError?: (error: string) => void;

  /**
   * Callback fired when connection state changes
   */
  onConnectionChange?: (connected: boolean) => void;

  /**
   * Minimum audio buffer (in milliseconds) before playback starts
   * Higher values = smoother audio but more latency
   * @default 200
   */
  minBufferMs?: number;

  /**
   * Debounce time (in milliseconds) for grouping transcript chunks
   * @default 1500
   */
  transcriptDebounceMs?: number;

  /**
   * Enable debug logging to help diagnose issues
   * - true: logs to console
   * - DebugCallback: custom logging function
   * @default false
   */
  debug?: boolean | DebugCallback;

  /**
   * Reconnection configuration
   */
  reconnection?: {
    /** Maximum number of reconnection attempts @default 5 */
    maxAttempts?: number;
    /** Initial delay in ms before first reconnection @default 1000 */
    initialDelay?: number;
    /** Maximum delay in ms between reconnections @default 10000 */
    maxDelay?: number;
    /** Multiplier for exponential backoff @default 2 */
    backoffFactor?: number;
  };

  /**
   * Tools/functions that the AI can call
   * Tool definitions are forwarded to Gemini via the proxy
   */
  tools?: ToolDefinition[];

  /**
   * Callback fired when the AI requests a tool call
   * Return the result to send back to the AI
   */
  onToolCall?: ToolCallHandler;

  /**
   * Enable Voice Activity Detection
   * Only sends audio when user is speaking, reducing bandwidth
   * @default false
   */
  vad?: boolean;

  /**
   * VAD configuration options
   */
  vadOptions?: {
    /** Speech probability threshold (0-1) @default 0.5 */
    threshold?: number;
    /** Minimum speech duration in ms before triggering @default 250 */
    minSpeechDuration?: number;
    /** Duration of silence before ending speech @default 300 */
    silenceDuration?: number;
  };
}

/**
 * Connection state machine states
 */
export type ConnectionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error'
  | 'disconnected';

/**
 * Return value from useGeminiLive hook
 */
export interface UseGeminiLiveReturn {
  /** Whether currently connected to the proxy */
  isConnected: boolean;

  /** Whether currently attempting to connect */
  isConnecting: boolean;

  /**
   * Unified connection state machine
   * Provides more granular state than isConnected/isConnecting
   */
  connectionState: ConnectionState;

  /** Whether the AI is currently speaking (audio playing) */
  isSpeaking: boolean;

  /** Whether microphone input is muted */
  isMuted: boolean;

  /** Current error message, if any */
  error: string | null;

  /** All transcript entries from the session */
  transcripts: Transcript[];

  /**
   * AI's current partial transcript (real-time, before debounce finalizes)
   * null when AI is not currently speaking or transcript is finalized
   */
  streamingText: string | null;

  /**
   * User's current partial transcript (real-time, before debounce finalizes)
   * null when user is not currently speaking or transcript is finalized
   */
  streamingUserText: string | null;

  /**
   * Connect to the Gemini Live proxy
   * @param videoElement - Optional video element for screen sharing
   */
  connect: (videoElement?: HTMLVideoElement) => Promise<void>;

  /** Disconnect from the proxy and clean up resources */
  disconnect: () => void;

  /**
   * Send a text message to Gemini (in addition to voice)
   */
  sendText: (text: string) => void;

  /** Set microphone muted state */
  setMuted: (muted: boolean) => void;

  /** Clear all transcript entries */
  clearTranscripts: () => void;

  /**
   * Send a tool result back to the AI
   * @param toolCallId - The ID from the tool call
   * @param result - The result to send back
   */
  sendToolResult: (toolCallId: string, result: unknown) => void;

  /**
   * Whether the user is currently speaking (VAD detected voice activity)
   * Only available when vad: true
   */
  isUserSpeaking: boolean;
}

/**
 * Message types sent from the proxy to the client
 * @internal
 */
export type ProxyMessageType =
  | 'setup_complete'
  | 'response'
  | 'audio'
  | 'turn_complete'
  | 'input_transcription'
  | 'output_transcription'
  | 'session_handle'
  | 'error'
  | 'disconnected'
  | 'tool_call'
  | 'tool_result';

/**
 * Message from proxy to client
 * @internal
 */
export interface ProxyMessage {
  type: ProxyMessageType;
  text?: string;
  data?: string;
  mimeType?: string;
  message?: string;
  reason?: string;
  handle?: string;
  resumable?: boolean;
  tool?: string;
  query?: string;
  found?: boolean;
  answer?: string;
  toolCallId?: string;
  toolName?: string;
  args?: Record<string, unknown>;
}

/**
 * Message types sent from client to proxy
 * @internal
 */
export type ClientMessageType = 'frame' | 'audio' | 'text' | 'tool_result' | 'setup_tools';

/**
 * Message from client to proxy
 * @internal
 */
export interface ClientMessage {
  type: ClientMessageType;
  data?: string;
  mimeType?: string;
  text?: string;
  toolCallId?: string;
  result?: unknown;
  tools?: ToolDefinition[];
}
