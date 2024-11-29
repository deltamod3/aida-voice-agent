import * as React from "react";
import { useState, useEffect, useRef, useCallback } from "react";
import { RealtimeClient } from "@openai/realtime-api-beta";
import Transcript from "@/components/Transcript";

// @ts-expect-error - External library without type definitions
import { WavRecorder, WavStreamPlayer } from "./lib/wavtools/index.js";
import { instructions } from "./conversation_config.js";
import "./App.css";

const clientRef = { current: null as RealtimeClient | null };
const wavRecorderRef = { current: null as WavRecorder | null };
const wavStreamPlayerRef = { current: null as WavStreamPlayer | null };
const RELAY_SERVER_URL = import.meta.env.VITE_WSS_SERVER_URL;

const App: React.FC = () => {
  const [connectionStatus, setConnectionStatus] = useState<
    "disconnected" | "connecting" | "connected"
  >("disconnected");
  const isConnectedRef = useRef(false);

  // OpenAI real-time client with WSS
  if (!clientRef.current) {
    clientRef.current = new RealtimeClient({
      url: RELAY_SERVER_URL || undefined,
    });
  }

  // Microphone recorder
  if (!wavRecorderRef.current) {
    wavRecorderRef.current = new WavRecorder({ sampleRate: 24000 });
  }

  // Audio output
  if (!wavStreamPlayerRef.current) {
    wavStreamPlayerRef.current = new WavStreamPlayer({ sampleRate: 24000 });
  }

  const connectConversation = useCallback(async () => {
    if (isConnectedRef.current) {
      return;
    }
    isConnectedRef.current = true;

    setConnectionStatus("connecting");

    const client = clientRef.current;
    const wavRecorder = wavRecorderRef.current;
    const wavStreamPlayer = wavStreamPlayerRef.current;
    if (!client || !wavRecorder || !wavStreamPlayer) {
      return;
    }

    try {
      // Connect to microphone
      await wavRecorder.begin();

      // Connect to audio output
      await wavStreamPlayer.connect();

      // Connect to realtime API
      await client.connect();

      setConnectionStatus("connected");

      client.on("error", (event: any) => {
        console.error(event);
        setConnectionStatus("disconnected");
      });

      client.on("disconnected", () => {
        setConnectionStatus("disconnected");
      });

      client.sendUserMessageContent([
        {
          type: `input_text`,
          text: `Hello!`,
        },
      ]);

      // Always use VAD mode
      client.updateSession({
        turn_detection: { type: "server_vad" },
      });

      // Check if we're already recording before trying to pause
      if (wavRecorder.recording) {
        await wavRecorder.pause();
      }

      // Check if we're already paused before trying to record
      if (!wavRecorder.recording) {
        await wavRecorder.record((data: { mono: Float32Array }) =>
          client.appendInputAudio(data.mono)
        );
      }
    } catch (error) {
      console.error("Connection error:", error);
      setConnectionStatus("disconnected");
    }
  }, [RELAY_SERVER_URL]);

  /**
   * Core RealtimeClient and audio capture setup
   * Set all of our instructions, tools, events and more
   */
  useEffect(() => {
    connectConversation();
    const wavStreamPlayer = wavStreamPlayerRef.current;
    const client = clientRef.current;
    if (!client || !wavStreamPlayer) {
      return;
    }

    // Set instructions
    client.updateSession({ instructions: instructions });

    // Handle realtime events from client + server for event logging
    client.on("error", (event: any) => console.error(event));

    client.on("conversation.interrupted", async () => {
      const trackSampleOffset = await wavStreamPlayer.interrupt();
      if (trackSampleOffset?.trackId) {
        const { trackId, offset } = trackSampleOffset;
        await client.cancelResponse(trackId, offset);
      }
    });

    client.on("conversation.updated", async ({ item, delta }: any) => {
      client.conversation.getItems();
      if (delta?.audio) {
        wavStreamPlayer.add16BitPCM(delta.audio, item.id);
      }
      if (item.status === "completed" && item.formatted.audio?.length) {
        const wavFile = await WavRecorder.decode(
          item.formatted.audio,
          24000,
          24000
        );
        item.formatted.file = wavFile;

        if (item.formatted.transcript) {
          console.log(item.formatted.transcript);
        }
      }
    });

    return () => {
      client.reset();
    };
  }, []);

  return (
    <div className="app-container">
      <Transcript />
    </div>
  );
};

export default App;
