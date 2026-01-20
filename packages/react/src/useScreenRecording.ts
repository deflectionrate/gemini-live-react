import { useState, useRef, useCallback } from 'react';
import type {
  UseScreenRecordingOptions,
  UseScreenRecordingReturn,
  RecordingState,
  RecordingResult,
  TimestampedScreenshot,
} from './types';

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Hook for screen/camera recording with screenshot capture.
 *
 * Handles the complex setup of screen capture, camera fallback (for mobile),
 * separate microphone audio, cross-browser codec detection, and periodic
 * screenshot capture for AI analysis.
 *
 * @example
 * ```tsx
 * const {
 *   state,
 *   startRecording,
 *   stopRecording,
 *   getVideoElement,
 * } = useScreenRecording({ screenshotInterval: 3000 });
 *
 * const handleStart = async () => {
 *   await startRecording();
 *   const videoEl = getVideoElement();
 *   if (videoEl) {
 *     await connect(videoEl); // from useGeminiLive
 *   }
 * };
 * ```
 */
export function useScreenRecording(
  options: UseScreenRecordingOptions = {}
): UseScreenRecordingReturn {
  const {
    screenshotInterval = 2000,
    maxScreenshots = 30,
    screenshotQuality = 0.8,
    audioConstraints,
  } = options;

  const [state, setState] = useState<RecordingState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    error: null,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioChunksRef = useRef<Blob[]>([]);
  const screenshotsRef = useRef<TimestampedScreenshot[]>([]);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const screenshotIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const startTimeRef = useRef<number>(0);
  const videoMimeTypeRef = useRef<string>('video/webm');
  const audioMimeTypeRef = useRef<string>('audio/webm');
  const isRecordingRef = useRef<boolean>(false);

  const captureScreenshot = useCallback((): string | null => {
    if (!streamRef.current || !videoRef.current || !canvasRef.current) return null;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx) return null;

    // Set canvas size to match video
    canvas.width = video.videoWidth || 1920;
    canvas.height = video.videoHeight || 1080;

    // Draw the current frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Get the image as base64
    const image = canvas.toDataURL('image/jpeg', screenshotQuality);
    const timestamp = Math.floor((Date.now() - startTimeRef.current) / 1000);

    // Keep max screenshots (rolling window)
    if (screenshotsRef.current.length >= maxScreenshots) {
      screenshotsRef.current.shift();
    }

    screenshotsRef.current.push({
      image,
      timestamp,
      formattedTime: formatTime(timestamp),
    });

    return image;
  }, [screenshotQuality, maxScreenshots]);

  // Get the latest stored screenshot (for real-time AI analysis)
  const getLatestScreenshot = useCallback((): string | null => {
    if (screenshotsRef.current.length === 0) return null;
    return screenshotsRef.current[screenshotsRef.current.length - 1].image;
  }, []);

  // Capture a fresh screenshot right now (for on-demand analysis)
  const captureScreenshotNow = useCallback((): string | null => {
    return captureScreenshot();
  }, [captureScreenshot]);

  // Internal stop function that doesn't depend on state
  const stopRecordingInternal = useCallback((): Promise<RecordingResult | null> => {
    return new Promise<RecordingResult | null>((resolve) => {
      if (!mediaRecorderRef.current || !streamRef.current) {
        resolve(null);
        return;
      }

      isRecordingRef.current = false;

      // Capture final screenshot
      captureScreenshot();

      // Clear intervals
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
      if (screenshotIntervalRef.current) {
        clearInterval(screenshotIntervalRef.current);
        screenshotIntervalRef.current = null;
      }

      const mediaRecorder = mediaRecorderRef.current;
      const audioRecorder = audioRecorderRef.current;

      // Stop audio recorder first
      if (audioRecorder && audioRecorder.state !== 'inactive') {
        audioRecorder.stop();
      }

      mediaRecorder.onstop = () => {
        // Create video blob with the correct mime type
        const videoBlob = new Blob(chunksRef.current, { type: videoMimeTypeRef.current });
        const screenshots = [...screenshotsRef.current];

        // Create audio blob if we have audio (with correct mime type)
        const audioBlob = audioChunksRef.current.length > 0
          ? new Blob(audioChunksRef.current, { type: audioMimeTypeRef.current })
          : undefined;

        // Stop all tracks
        streamRef.current?.getTracks().forEach((track) => track.stop());
        audioStreamRef.current?.getTracks().forEach((track) => track.stop());

        // Clean up video element
        if (videoRef.current) {
          videoRef.current.srcObject = null;
          videoRef.current = null;
        }

        // Reset refs
        streamRef.current = null;
        audioStreamRef.current = null;
        mediaRecorderRef.current = null;
        audioRecorderRef.current = null;
        chunksRef.current = [];
        audioChunksRef.current = [];

        setState({
          isRecording: false,
          isPaused: false,
          duration: 0,
          error: null,
        });

        resolve({ videoBlob, screenshots, audioBlob });
      };

      mediaRecorder.stop();
    });
  }, [captureScreenshot]);

  const startRecording = useCallback(
    async (useCameraMode = false) => {
      try {
        setState((prev) => ({ ...prev, error: null }));

        let screenStream: MediaStream;

        if (useCameraMode) {
          // Camera fallback for iOS/mobile - use rear camera
          screenStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }, // Rear camera
            audio: true,
          });
        } else {
          // Normal screen capture - let browser show all options (screen, window, tab)
          screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true, // System audio if available
          });
        }

        streamRef.current = screenStream;
        chunksRef.current = [];
        audioChunksRef.current = [];
        screenshotsRef.current = [];
        startTimeRef.current = Date.now();
        isRecordingRef.current = true;

        // Request microphone audio separately for clean transcription
        let micStream: MediaStream | null = null;
        try {
          const micConstraints = audioConstraints || {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          };

          micStream = await navigator.mediaDevices.getUserMedia({
            audio: micConstraints,
          });
          audioStreamRef.current = micStream;

          // Also add mic to video stream for combined recording
          micStream.getAudioTracks().forEach((track) => {
            screenStream.addTrack(track.clone());
          });

          // Create separate audio recorder for clean transcription
          // Try WebM first (Chrome/Firefox), then MP4 (Safari/iOS), then fallback
          const audioMimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
            ? 'audio/webm;codecs=opus'
            : MediaRecorder.isTypeSupported('audio/mp4')
              ? 'audio/mp4'
              : 'audio/webm';
          audioMimeTypeRef.current = audioMimeType;

          const audioRecorder = new MediaRecorder(micStream, { mimeType: audioMimeType });
          audioRecorderRef.current = audioRecorder;

          audioRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
              audioChunksRef.current.push(event.data);
            }
          };

          audioRecorder.start(1000);
        } catch (audioError) {
          console.warn('Could not get microphone audio:', audioError);
          // Continue without mic - we'll note this in the transcription
        }

        // Create video element for screenshots
        const video = document.createElement('video');
        video.srcObject = screenStream;
        video.muted = true;
        await video.play();
        videoRef.current = video;

        // Create canvas for screenshots
        const canvas = document.createElement('canvas');
        canvasRef.current = canvas;

        // Set up video MediaRecorder
        // Try VP9 first (Chrome), then VP8 (Firefox), then MP4 (Safari/iOS), then fallback
        const videoMimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
          ? 'video/webm;codecs=vp9,opus'
          : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
            ? 'video/webm;codecs=vp8,opus'
            : MediaRecorder.isTypeSupported('video/mp4')
              ? 'video/mp4'
              : 'video/webm';
        videoMimeTypeRef.current = videoMimeType;

        const mediaRecorder = new MediaRecorder(screenStream, { mimeType: videoMimeType });
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunksRef.current.push(event.data);
          }
        };

        // Handle stream ending (user clicks "Stop sharing")
        const videoTrack = screenStream.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.onended = () => {
            if (isRecordingRef.current) {
              stopRecordingInternal();
            }
          };
        }

        // Start recording
        mediaRecorder.start(1000); // Capture in 1-second chunks

        // Start duration timer
        durationIntervalRef.current = setInterval(() => {
          setState((prev) => ({
            ...prev,
            duration: Math.floor((Date.now() - startTimeRef.current) / 1000),
          }));
        }, 1000);

        // Capture initial screenshot after 1 second
        setTimeout(() => captureScreenshot(), 1000);

        // Capture screenshots at configured interval
        screenshotIntervalRef.current = setInterval(() => {
          captureScreenshot();
        }, screenshotInterval);

        setState((prev) => ({
          ...prev,
          isRecording: true,
          isPaused: false,
          duration: 0,
        }));
      } catch (error) {
        console.error('Error starting recording:', error);
        setState((prev) => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Failed to start recording',
        }));
      }
    },
    [captureScreenshot, screenshotInterval, audioConstraints, stopRecordingInternal]
  );

  const stopRecording = useCallback(async (): Promise<RecordingResult | null> => {
    return stopRecordingInternal();
  }, [stopRecordingInternal]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      if (audioRecorderRef.current && audioRecorderRef.current.state === 'recording') {
        audioRecorderRef.current.pause();
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      if (screenshotIntervalRef.current) {
        clearInterval(screenshotIntervalRef.current);
      }
      setState((prev) => ({ ...prev, isPaused: true }));
    }
  }, []);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      if (audioRecorderRef.current && audioRecorderRef.current.state === 'paused') {
        audioRecorderRef.current.resume();
      }

      // Resume duration timer
      const pausedDuration = state.duration;
      const resumeTime = Date.now();
      durationIntervalRef.current = setInterval(() => {
        setState((prev) => ({
          ...prev,
          duration: pausedDuration + Math.floor((Date.now() - resumeTime) / 1000),
        }));
      }, 1000);

      // Resume screenshot capture
      screenshotIntervalRef.current = setInterval(() => {
        captureScreenshot();
      }, screenshotInterval);

      setState((prev) => ({ ...prev, isPaused: false }));
    }
  }, [state.duration, captureScreenshot, screenshotInterval]);

  // Get the video element for live streaming
  const getVideoElement = useCallback((): HTMLVideoElement | null => {
    return videoRef.current;
  }, []);

  // Get the current stream for preview
  const getStream = useCallback((): MediaStream | null => {
    return streamRef.current;
  }, []);

  return {
    state,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    getLatestScreenshot,
    captureScreenshotNow,
    getVideoElement,
    getStream,
  };
}
