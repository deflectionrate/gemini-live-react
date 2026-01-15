/**
 * Gemini Live Proxy for Supabase Edge Functions (Deno)
 *
 * This proxy sits between your frontend and Google's Gemini Live API,
 * keeping your API key secure on the server side.
 *
 * Environment variables:
 * - GOOGLE_AI_API_KEY (required): Your Google AI API key
 * - GEMINI_VOICE (optional): Voice name (default: "Zephyr")
 * - GEMINI_SYSTEM_INSTRUCTION (optional): Custom system instruction
 *
 * Query parameters:
 * - voice: Override the voice (e.g., ?voice=Kore)
 * - session_id: Optional session identifier for your app
 *
 * Deploy to Supabase:
 * 1. Copy this file to supabase/functions/gemini-live-proxy/index.ts
 * 2. Set secrets: supabase secrets set GOOGLE_AI_API_KEY=your-key
 * 3. Deploy: supabase functions deploy gemini-live-proxy
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
const DEFAULT_VOICE = Deno.env.get("GEMINI_VOICE") || "Zephyr";
const DEFAULT_SYSTEM_INSTRUCTION =
  Deno.env.get("GEMINI_SYSTEM_INSTRUCTION") ||
  `You are a helpful AI assistant having a real-time voice conversation.

Guidelines:
- Speak naturally and conversationally
- Be concise - give direct answers
- Ask clarifying questions if needed

You're having a real-time voice conversation. Respond as if speaking, not writing.`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, upgrade, connection, sec-websocket-key, sec-websocket-version, sec-websocket-protocol",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Check for WebSocket upgrade
  const upgradeHeader = req.headers.get("upgrade") || "";
  if (upgradeHeader.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket upgrade", {
      status: 426,
      headers: corsHeaders,
    });
  }

  if (!GOOGLE_AI_API_KEY) {
    console.error("GOOGLE_AI_API_KEY not configured");
    return new Response("API key not configured", {
      status: 500,
      headers: corsHeaders,
    });
  }

  // Parse query parameters
  const url = new URL(req.url);
  const voiceName = url.searchParams.get("voice") || DEFAULT_VOICE;
  const sessionId = url.searchParams.get("session_id");
  const systemInstruction = DEFAULT_SYSTEM_INSTRUCTION;

  console.log(
    "New connection - voice:",
    voiceName,
    "session:",
    sessionId || "none"
  );

  try {
    // Upgrade to WebSocket
    const { socket: clientSocket, response } = Deno.upgradeWebSocket(req);

    let geminiSocket: WebSocket | null = null;
    let isSetupComplete = false;

    clientSocket.onopen = () => {
      console.log("Client connected, establishing Gemini connection...");

      // Connect to Gemini Live API
      const geminiUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${GOOGLE_AI_API_KEY}`;

      geminiSocket = new WebSocket(geminiUrl);

      geminiSocket.onopen = () => {
        console.log("Connected to Gemini Live API");

        // Send setup message with native audio model
        const setupMessage = {
          setup: {
            model: "models/gemini-2.5-flash-native-audio-preview-12-2025",
            generationConfig: {
              responseModalities: ["AUDIO"],
              mediaResolution: "MEDIA_RESOLUTION_MEDIUM",
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: voiceName,
                  },
                },
              },
            },
            systemInstruction: {
              parts: [{ text: systemInstruction }],
            },
            // Enable transcription for both input and output
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            // Enable session resumption for reconnections
            sessionResumption: {},
            // Enable context window compression for unlimited session time
            contextWindowCompression: {
              slidingWindow: {},
            },
          },
        };

        geminiSocket!.send(JSON.stringify(setupMessage));
      };

      geminiSocket.onmessage = async (event) => {
        try {
          // Get the message data as string
          let messageText: string;
          if (event.data instanceof Blob) {
            messageText = await event.data.text();
          } else {
            messageText = event.data;
          }

          const data = JSON.parse(messageText);

          // Check for error response
          if (data.error) {
            console.error("Gemini error:", JSON.stringify(data.error));
            clientSocket.send(
              JSON.stringify({
                type: "error",
                message: data.error.message || "Gemini API error",
              })
            );
            return;
          }

          // Check for setup complete
          if (
            data.setupComplete !== undefined ||
            data.setup_complete !== undefined
          ) {
            isSetupComplete = true;
            clientSocket.send(JSON.stringify({ type: "setup_complete" }));
            console.log("Gemini setup complete");
            return;
          }

          // Handle session resumption updates
          if (data.sessionResumptionUpdate) {
            const update = data.sessionResumptionUpdate;
            if (update.newHandle || update.new_handle) {
              clientSocket.send(
                JSON.stringify({
                  type: "session_handle",
                  handle: update.newHandle || update.new_handle,
                  resumable: update.resumable,
                })
              );
            }
            return;
          }

          // Forward server content to client
          if (data.serverContent) {
            // Mark setup complete on first serverContent
            if (!isSetupComplete) {
              isSetupComplete = true;
              clientSocket.send(JSON.stringify({ type: "setup_complete" }));
              console.log("Gemini setup complete (first serverContent)");
            }

            const parts = data.serverContent.modelTurn?.parts || [];

            for (const part of parts) {
              // Forward text responses
              if (part.text) {
                clientSocket.send(
                  JSON.stringify({
                    type: "response",
                    text: part.text,
                  })
                );
              }

              // Forward audio data (base64 encoded)
              if (part.inlineData?.mimeType?.startsWith("audio/")) {
                clientSocket.send(
                  JSON.stringify({
                    type: "audio",
                    mimeType: part.inlineData.mimeType,
                    data: part.inlineData.data,
                  })
                );
              }
            }

            // Forward input transcription (user's speech as text)
            if (data.serverContent.inputTranscription?.text) {
              clientSocket.send(
                JSON.stringify({
                  type: "input_transcription",
                  text: data.serverContent.inputTranscription.text,
                })
              );
            }

            // Forward output transcription (AI's speech as text)
            if (data.serverContent.outputTranscription?.text) {
              clientSocket.send(
                JSON.stringify({
                  type: "output_transcription",
                  text: data.serverContent.outputTranscription.text,
                })
              );
            }

            // Check if turn is complete
            if (data.serverContent.turnComplete) {
              clientSocket.send(JSON.stringify({ type: "turn_complete" }));
            }
          }
        } catch (error) {
          console.error("Error parsing Gemini response:", error);
        }
      };

      geminiSocket.onerror = (error) => {
        console.error("Gemini WebSocket error:", error);
        clientSocket.send(
          JSON.stringify({
            type: "error",
            message: "Connection to AI failed",
          })
        );
      };

      geminiSocket.onclose = (event) => {
        console.log("Gemini connection closed:", event.code, event.reason);
        if (clientSocket.readyState === WebSocket.OPEN) {
          clientSocket.send(
            JSON.stringify({
              type: "disconnected",
              reason: event.reason || "Connection closed",
            })
          );
        }
      };
    };

    clientSocket.onmessage = (event) => {
      if (!geminiSocket || geminiSocket.readyState !== WebSocket.OPEN) {
        return;
      }

      if (!isSetupComplete) {
        return;
      }

      try {
        const data = JSON.parse(event.data);

        if (data.type === "frame") {
          // Send image frame to Gemini (for screen sharing)
          geminiSocket.send(
            JSON.stringify({
              realtimeInput: {
                mediaChunks: [
                  {
                    mimeType: "image/jpeg",
                    data: data.data,
                  },
                ],
              },
            })
          );
        } else if (data.type === "audio") {
          // Send audio chunk to Gemini
          geminiSocket.send(
            JSON.stringify({
              realtimeInput: {
                mediaChunks: [
                  {
                    mimeType: data.mimeType || "audio/pcm;rate=16000",
                    data: data.data,
                  },
                ],
              },
            })
          );
        } else if (data.type === "text") {
          // Send text message to Gemini
          geminiSocket.send(
            JSON.stringify({
              clientContent: {
                turns: [
                  {
                    role: "user",
                    parts: [{ text: data.text }],
                  },
                ],
                turnComplete: true,
              },
            })
          );
        }
      } catch (error) {
        console.error("Error processing client message:", error);
      }
    };

    clientSocket.onerror = (error) => {
      console.error("Client WebSocket error:", error);
      if (geminiSocket) {
        geminiSocket.close();
      }
    };

    clientSocket.onclose = () => {
      console.log("Client disconnected");
      if (geminiSocket) {
        geminiSocket.close();
      }
    };

    return response;
  } catch (error) {
    console.error("WebSocket upgrade failed:", error);
    return new Response("WebSocket upgrade failed", {
      status: 500,
      headers: corsHeaders,
    });
  }
});
