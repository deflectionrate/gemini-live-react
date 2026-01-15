# Gemini Live Proxy (Deno/Supabase)

WebSocket proxy for Google Gemini Live API. Keeps your API key secure on the server.

## Quick Start (Supabase)

### 1. Copy the function

```bash
mkdir -p supabase/functions/gemini-live-proxy
cp index.ts supabase/functions/gemini-live-proxy/index.ts
```

### 2. Set your API key

```bash
supabase secrets set GOOGLE_AI_API_KEY=your-google-ai-api-key
```

Get your key from [Google AI Studio](https://aistudio.google.com/apikey).

### 3. Deploy

```bash
supabase functions deploy gemini-live-proxy
```

### 4. Use it

```typescript
import { useGeminiLive } from 'gemini-live-react';

const { connect } = useGeminiLive({
  proxyUrl: 'wss://your-project.supabase.co/functions/v1/gemini-live-proxy',
});
```

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GOOGLE_AI_API_KEY` | Yes | - | Your Google AI API key |
| `GEMINI_VOICE` | No | `Zephyr` | Default voice |
| `GEMINI_SYSTEM_INSTRUCTION` | No | (see code) | Default system prompt |

### Query Parameters

Override settings per-connection via query params:

```
wss://your-proxy.com?voice=Kore&session_id=abc123
```

| Parameter | Description |
|-----------|-------------|
| `voice` | Voice name (Zephyr, Puck, Charon, Kore, Fenrir, Aoede) |
| `session_id` | Your app's session identifier |

## Available Voices

| Voice | Description |
|-------|-------------|
| Zephyr | Bright, clear |
| Puck | Warm, friendly |
| Charon | Deep, authoritative |
| Kore | Soft, gentle |
| Fenrir | Strong, confident |
| Aoede | Melodic, expressive |

## Protocol

### Client → Proxy Messages

```typescript
// Audio from microphone
{ type: 'audio', mimeType: 'audio/pcm;rate=16000', data: '<base64>' }

// Screen frame (for screen sharing)
{ type: 'frame', data: '<base64 JPEG>' }

// Text message
{ type: 'text', text: 'Hello' }
```

### Proxy → Client Messages

```typescript
// Connection ready
{ type: 'setup_complete' }

// AI audio response
{ type: 'audio', mimeType: 'audio/pcm;rate=24000', data: '<base64>' }

// User speech transcribed
{ type: 'input_transcription', text: 'Hello' }

// AI speech transcribed
{ type: 'output_transcription', text: 'Hi there!' }

// AI turn finished
{ type: 'turn_complete' }

// Session handle for reconnection
{ type: 'session_handle', handle: '...', resumable: true }

// Error occurred
{ type: 'error', message: 'Something went wrong' }

// Disconnected
{ type: 'disconnected', reason: 'Connection closed' }
```

## Customization

### Adding Tool Calling

To add custom tools (function calling), modify the setup message:

```typescript
const setupMessage = {
  setup: {
    // ... existing config ...
    tools: [{
      functionDeclarations: [{
        name: 'search_docs',
        description: 'Search documentation',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' }
          },
          required: ['query']
        }
      }]
    }]
  }
};
```

Then handle `toolCall` messages from Gemini and respond with `toolResponse`.

### Using Your Own Database

Replace the simple env-based config with database lookups:

```typescript
// Instead of:
const voiceName = url.searchParams.get("voice") || DEFAULT_VOICE;

// Do:
const { data: config } = await supabase
  .from('sessions')
  .select('voice, system_instruction')
  .eq('id', sessionId)
  .single();

const voiceName = config?.voice || DEFAULT_VOICE;
```

## Deploying to Other Platforms

### Cloudflare Workers

See `packages/proxy-cloudflare` (coming soon).

### Vercel Edge Functions

See `packages/proxy-vercel` (coming soon).

### Self-hosted Node.js

See `packages/proxy-node` (coming soon).
