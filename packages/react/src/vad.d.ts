/**
 * Type declarations for @ricky0123/vad-web
 * This is an optional peer dependency used for Voice Activity Detection
 */
declare module '@ricky0123/vad-web' {
  export interface MicVADOptions {
    stream?: MediaStream;
    positiveSpeechThreshold?: number;
    negativeSpeechThreshold?: number;
    minSpeechFrames?: number;
    redemptionFrames?: number;
    preSpeechPadFrames?: number;
    onSpeechStart?: () => void;
    onSpeechEnd?: (audio?: Float32Array) => void;
    onVADMisfire?: () => void;
  }

  export class MicVAD {
    static new(options: MicVADOptions): Promise<MicVAD>;
    start(): void;
    pause(): void;
    destroy(): void;
  }
}
