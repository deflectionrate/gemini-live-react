import { useState } from 'react';
import { useGeminiLive } from 'gemini-live-react';

// Replace with your proxy URL
const PROXY_URL = 'wss://your-project.supabase.co/functions/v1/gemini-live-proxy';

export default function App() {
  const [proxyUrl, setProxyUrl] = useState(PROXY_URL);

  const {
    connect,
    disconnect,
    transcripts,
    isConnected,
    isConnecting,
    isSpeaking,
    isMuted,
    setMuted,
    error,
  } = useGeminiLive({
    proxyUrl,
    onError: (err) => console.error('Gemini error:', err),
  });

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Voice Chat</h1>
        <p style={styles.subtitle}>Talk to Gemini in real-time</p>
      </header>

      {/* Proxy URL input */}
      <div style={styles.configSection}>
        <label style={styles.label}>Proxy URL:</label>
        <input
          type="text"
          value={proxyUrl}
          onChange={(e) => setProxyUrl(e.target.value)}
          placeholder="wss://your-project.supabase.co/functions/v1/gemini-live-proxy"
          style={styles.input}
          disabled={isConnected}
        />
      </div>

      {/* Error display */}
      {error && (
        <div style={styles.error}>
          {error}
        </div>
      )}

      {/* Connection controls */}
      <div style={styles.controls}>
        <button
          onClick={() => (isConnected ? disconnect() : connect())}
          style={{
            ...styles.button,
            ...(isConnected ? styles.buttonDanger : styles.buttonPrimary),
          }}
          disabled={isConnecting}
        >
          {isConnecting ? 'Connecting...' : isConnected ? 'End Call' : 'Start Call'}
        </button>

        {isConnected && (
          <button
            onClick={() => setMuted(!isMuted)}
            style={{
              ...styles.button,
              ...(isMuted ? styles.buttonWarning : styles.buttonSecondary),
            }}
          >
            {isMuted ? 'Unmute' : 'Mute'}
          </button>
        )}
      </div>

      {/* Status indicators */}
      <div style={styles.status}>
        <span style={styles.statusItem}>
          <span
            style={{
              ...styles.statusDot,
              backgroundColor: isConnected ? '#22c55e' : '#ef4444',
            }}
          />
          {isConnected ? 'Connected' : 'Disconnected'}
        </span>

        {isSpeaking && (
          <span style={styles.statusItem}>
            <span style={{ ...styles.statusDot, backgroundColor: '#3b82f6' }} />
            AI Speaking
          </span>
        )}

        {isMuted && (
          <span style={styles.statusItem}>
            <span style={{ ...styles.statusDot, backgroundColor: '#f59e0b' }} />
            Muted
          </span>
        )}
      </div>

      {/* Transcript */}
      <div style={styles.transcriptContainer}>
        <h2 style={styles.transcriptTitle}>Conversation</h2>
        <div style={styles.transcriptList}>
          {transcripts.length === 0 ? (
            <p style={styles.emptyState}>
              {isConnected
                ? 'Start speaking to begin the conversation...'
                : 'Connect to start chatting'}
            </p>
          ) : (
            transcripts.map((t) => (
              <div
                key={t.id}
                style={{
                  ...styles.message,
                  ...(t.role === 'user' ? styles.userMessage : styles.assistantMessage),
                }}
              >
                <span style={styles.messageRole}>
                  {t.role === 'user' ? 'You' : 'AI'}
                </span>
                <span style={styles.messageText}>{t.text}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 600,
    margin: '0 auto',
    padding: 24,
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  header: {
    textAlign: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 700,
    color: '#1f2937',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  configSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: 500,
    color: '#374151',
  },
  input: {
    padding: '10px 14px',
    borderRadius: 8,
    border: '1px solid #d1d5db',
    fontSize: 14,
    outline: 'none',
  },
  error: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#fef2f2',
    color: '#dc2626',
    fontSize: 14,
  },
  controls: {
    display: 'flex',
    gap: 12,
    justifyContent: 'center',
  },
  button: {
    padding: '12px 24px',
    borderRadius: 8,
    border: 'none',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.2s',
  },
  buttonPrimary: {
    backgroundColor: '#3b82f6',
    color: 'white',
  },
  buttonSecondary: {
    backgroundColor: '#6b7280',
    color: 'white',
  },
  buttonDanger: {
    backgroundColor: '#ef4444',
    color: 'white',
  },
  buttonWarning: {
    backgroundColor: '#f59e0b',
    color: 'white',
  },
  status: {
    display: 'flex',
    gap: 16,
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  statusItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 13,
    color: '#4b5563',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
  },
  transcriptContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  transcriptTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: '#1f2937',
  },
  transcriptList: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    minHeight: 300,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    overflowY: 'auto',
    border: '1px solid #e5e7eb',
  },
  emptyState: {
    color: '#9ca3af',
    textAlign: 'center',
    padding: 40,
  },
  message: {
    padding: 12,
    borderRadius: 8,
    maxWidth: '85%',
  },
  userMessage: {
    backgroundColor: '#eff6ff',
    alignSelf: 'flex-end',
  },
  assistantMessage: {
    backgroundColor: '#f3f4f6',
    alignSelf: 'flex-start',
  },
  messageRole: {
    display: 'block',
    fontSize: 11,
    fontWeight: 600,
    color: '#6b7280',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 14,
    color: '#1f2937',
    lineHeight: 1.5,
  },
};
