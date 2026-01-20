import { useState } from 'react';
import {
  useGeminiLive,
  useScreenRecording,
  shouldUseCameraMode,
} from 'gemini-live-react';

// Replace with your proxy URL
const PROXY_URL = 'wss://your-project.supabase.co/functions/v1/gemini-live-proxy';

export default function App() {
  const [proxyUrl, setProxyUrl] = useState(PROXY_URL);

  const {
    state: recordingState,
    startRecording,
    stopRecording,
    getVideoElement,
    getStream,
  } = useScreenRecording();

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

  const handleStart = async () => {
    try {
      // Use camera on mobile devices without screen capture support
      const useCameraMode = shouldUseCameraMode();
      await startRecording(useCameraMode);

      // Connect the video element to Gemini for live analysis
      const videoEl = getVideoElement();
      if (videoEl) {
        await connect(videoEl);
      }
    } catch (err) {
      console.error('Failed to start:', err);
    }
  };

  const handleStop = async () => {
    disconnect();
    const result = await stopRecording();
    if (result) {
      console.log('Recording stopped:', {
        videoSize: result.videoBlob.size,
        audioSize: result.audioBlob?.size,
        screenshots: result.screenshots.length,
      });
    }
  };

  // Get the stream for video preview
  const stream = getStream();

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <h1 style={styles.title}>Screen Share Assistant</h1>
        <p style={styles.subtitle}>
          Share your screen and talk to Gemini about what you see
        </p>
      </header>

      {/* Main content */}
      <div style={styles.main}>
        {/* Left: Video preview */}
        <div style={styles.videoSection}>
          <div style={styles.videoContainer}>
            {recordingState.isRecording && stream ? (
              <video
                style={styles.video}
                muted
                playsInline
                autoPlay
                ref={(el) => {
                  if (el && el.srcObject !== stream) {
                    el.srcObject = stream;
                  }
                }}
              />
            ) : (
              <div style={styles.placeholder}>
                <svg
                  width="64"
                  height="64"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <rect x="2" y="3" width="20" height="14" rx="2" />
                  <path d="M8 21h8M12 17v4" />
                </svg>
                <p>Click "Share Screen" to begin</p>
              </div>
            )}
          </div>

          {/* Controls */}
          <div style={styles.controls}>
            {!isConnected ? (
              <>
                <input
                  type="text"
                  value={proxyUrl}
                  onChange={(e) => setProxyUrl(e.target.value)}
                  placeholder="Proxy URL"
                  style={styles.input}
                />
                <button
                  onClick={handleStart}
                  style={{ ...styles.button, ...styles.buttonPrimary }}
                  disabled={isConnecting}
                >
                  {isConnecting ? 'Connecting...' : 'Share Screen'}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setMuted(!isMuted)}
                  style={{
                    ...styles.button,
                    ...(isMuted ? styles.buttonWarning : styles.buttonSecondary),
                  }}
                >
                  {isMuted ? 'Unmute' : 'Mute'}
                </button>
                <button
                  onClick={handleStop}
                  style={{ ...styles.button, ...styles.buttonDanger }}
                >
                  Stop Sharing
                </button>
              </>
            )}
          </div>

          {/* Status */}
          <div style={styles.statusBar}>
            <span style={styles.statusItem}>
              <span
                style={{
                  ...styles.dot,
                  backgroundColor: isConnected ? '#22c55e' : '#6b7280',
                }}
              />
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
            {recordingState.isRecording && (
              <span style={styles.statusItem}>
                <span style={{ ...styles.dot, backgroundColor: '#ef4444' }} />
                {recordingState.duration}s
              </span>
            )}
            {isSpeaking && (
              <span style={styles.statusItem}>
                <span style={{ ...styles.dot, backgroundColor: '#3b82f6' }} />
                AI Speaking
              </span>
            )}
          </div>
        </div>

        {/* Right: Transcript */}
        <div style={styles.transcriptSection}>
          <h2 style={styles.sectionTitle}>Conversation</h2>

          {(error || recordingState.error) && (
            <div style={styles.error}>{error || recordingState.error}</div>
          )}

          <div style={styles.transcriptList}>
            {transcripts.length === 0 ? (
              <p style={styles.emptyState}>
                {isConnected
                  ? 'Start speaking to ask about your screen...'
                  : 'Share your screen to begin'}
              </p>
            ) : (
              transcripts.map((t) => (
                <div
                  key={t.id}
                  style={{
                    ...styles.message,
                    ...(t.role === 'user'
                      ? styles.userMessage
                      : styles.assistantMessage),
                  }}
                >
                  <span style={styles.role}>
                    {t.role === 'user' ? 'You' : 'AI'}
                  </span>
                  <p style={styles.text}>{t.text}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    padding: '24px 32px',
    borderBottom: '1px solid #1e293b',
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 4,
  },
  main: {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: '1fr 400px',
    gap: 0,
  },
  videoSection: {
    padding: 32,
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  videoContainer: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 400,
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },
  placeholder: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
    color: '#64748b',
  },
  controls: {
    display: 'flex',
    gap: 12,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    padding: '12px 16px',
    borderRadius: 8,
    border: '1px solid #334155',
    backgroundColor: '#1e293b',
    color: 'white',
    fontSize: 14,
    outline: 'none',
  },
  button: {
    padding: '12px 24px',
    borderRadius: 8,
    border: 'none',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  buttonPrimary: {
    backgroundColor: '#3b82f6',
    color: 'white',
  },
  buttonSecondary: {
    backgroundColor: '#475569',
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
  statusBar: {
    display: 'flex',
    gap: 16,
  },
  statusItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    color: '#94a3b8',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
  },
  transcriptSection: {
    backgroundColor: '#1e293b',
    borderLeft: '1px solid #334155',
    padding: 24,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 600,
  },
  error: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    color: '#ef4444',
    fontSize: 13,
  },
  transcriptList: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  emptyState: {
    color: '#64748b',
    fontSize: 14,
    textAlign: 'center',
    padding: 40,
  },
  message: {
    padding: 12,
    borderRadius: 8,
  },
  userMessage: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    marginLeft: 24,
  },
  assistantMessage: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginRight: 24,
  },
  role: {
    display: 'block',
    fontSize: 11,
    fontWeight: 600,
    color: '#64748b',
    marginBottom: 4,
  },
  text: {
    fontSize: 14,
    lineHeight: 1.5,
    color: '#e2e8f0',
  },
};
