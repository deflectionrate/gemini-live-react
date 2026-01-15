# gemini-live-react

React hook for real-time bidirectional voice communication with Google Gemini Live API.

## Features

- **Real-time voice streaming** - Talk to Gemini and hear responses instantly
- **Automatic audio handling** - Mic capture, playback, resampling all handled for you
- **Screen sharing support** - Optional video frame streaming for visual context
- **Live transcription** - Both user and AI speech transcribed in real-time
- **Auto-reconnection** - Exponential backoff reconnection on connection loss
- **TypeScript** - Full type definitions included

## Installation

```bash
npm install gemini-live-react
```

## Quick Start

```tsx
import { useGeminiLive } from 'gemini-live-react';

function VoiceChat() {
  const {
    connect,
    disconnect,
    transcripts,
    isConnected,
    isSpeaking,
  } = useGeminiLive({
    proxyUrl: 'wss://your-project.supabase.co/functions/v1/gemini-live-proxy',
  });

  return (
    <div>
      <button onClick={() => isConnected ? disconnect() : connect()}>
        {isConnected ? 'Disconnect' : 'Connect'}
      </button>

      {isSpeaking && <div>AI is speaking...</div>}

      <div>
        {transcripts.map((t) => (
          <div key={t.id}>
            <strong>{t.role}:</strong> {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}
```

## API Reference

### `useGeminiLive(options)`

#### Options

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `proxyUrl` | `string` | Yes | - | WebSocket URL of your proxy server |
| `sessionId` | `string` | No | - | Passed to proxy as query param |
| `onTranscript` | `(t: Transcript) => void` | No | - | Called when transcript is finalized |
| `onError` | `(error: string) => void` | No | - | Called on errors |
| `onConnectionChange` | `(connected: boolean) => void` | No | - | Called when connection state changes |
| `minBufferMs` | `number` | No | `200` | Audio buffer before playback (ms) |
| `transcriptDebounceMs` | `number` | No | `1500` | Debounce time for transcripts (ms) |

#### Return Value

| Property | Type | Description |
|----------|------|-------------|
| `isConnected` | `boolean` | Currently connected to proxy |
| `isConnecting` | `boolean` | Attempting to connect |
| `isSpeaking` | `boolean` | AI audio is playing |
| `isMuted` | `boolean` | Microphone is muted |
| `error` | `string \| null` | Current error message |
| `transcripts` | `Transcript[]` | All transcript entries |
| `connect` | `(video?: HTMLVideoElement) => Promise<void>` | Connect to proxy |
| `disconnect` | `() => void` | Disconnect and cleanup |
| `sendText` | `(text: string) => void` | Send text message |
| `setMuted` | `(muted: boolean) => void` | Set mute state |
| `clearTranscripts` | `() => void` | Clear transcript history |

### Types

```typescript
interface Transcript {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}
```

## Screen Sharing

To enable screen sharing, pass a video element to `connect()`:

```tsx
function ScreenShareChat() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { connect, disconnect, isConnected } = useGeminiLive({
    proxyUrl: 'wss://your-proxy.com',
  });

  const startWithScreenShare = async () => {
    // Get screen capture stream
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false,
    });

    // Attach to video element
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
    }

    // Connect with video element - frames will be sent at 1 FPS
    await connect(videoRef.current!);
  };

  return (
    <div>
      <video ref={videoRef} style={{ display: 'none' }} />
      <button onClick={startWithScreenShare}>
        Start with Screen Share
      </button>
    </div>
  );
}
```

## How Audio Works

This library handles the complex audio format juggling that Gemini Live requires:

### Input (Microphone → Gemini)
1. Captures audio at **16kHz** using `getUserMedia`
2. Uses **AudioWorklet** for low-latency processing
3. Converts **Float32 → Int16 PCM** with proper clamping
4. Base64 encodes and sends via WebSocket

### Output (Gemini → Speakers)
1. Receives **24kHz PCM16** audio (little-endian)
2. Decodes base64 and parses with **DataView** (endianness matters!)
3. **Resamples** to browser's native sample rate (44.1kHz or 48kHz)
4. Buffers **200ms** minimum before starting playback
5. Chains audio buffers for seamless playback

### Why This Matters

Most tutorials get audio wrong because:
- They use `Int16Array` directly (ignores endianness)
- They force AudioContext to 24kHz (browsers often ignore this)
- They don't buffer enough (causes choppy audio)
- They don't chain playback (causes gaps)

This library handles all of this correctly.

## Proxy Setup

You need a WebSocket proxy to keep your Google AI API key secure. See:

- [Supabase Edge Functions proxy](../proxy-deno)
- More platforms coming soon

## License

MIT
