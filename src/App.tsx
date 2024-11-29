import * as React from "react";
import { useState, useRef, useEffect, useCallback } from "react";
import { RealtimeClient } from "@openai/realtime-api-beta";
import Transcript from "@/components/Transcript";
import { useTranscriptWebSocket } from "@/hooks/useTranscriptWebSocket";

// @ts-expect-error - External library without type definitions
import { WavRecorder, WavStreamPlayer } from "./lib/wavtools/index.js";
import { instructions } from "./conversation_config.js";
import "./App.css";

const clientRef = { current: null as RealtimeClient | null };
const wavRecorderRef = { current: null as WavRecorder | null };
const wavStreamPlayerRef = { current: null as WavStreamPlayer | null };
const RELAY_SERVER_URL = import.meta.env.VITE_WSS_SERVER_URL;

const App: React.FC = () => {
  // Aida status
  const [aidaConnectionStatus, setAidaConnectionStatus] = useState<
    "muted" | "connect" | "connecting" | "disconnect" | "unmuted"
  >("muted");
  const isAidaConnectedRef = useRef(false);

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
    if (isAidaConnectedRef.current) {
      return;
    }

    setAidaConnectionStatus("connecting");

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

      isAidaConnectedRef.current = true;
      setAidaConnectionStatus("unmuted");

      client.on("error", (event: any) => {
        console.error(event);
        setAidaConnectionStatus("muted");
      });

      client.on("disconnected", () => {
        setAidaConnectionStatus("muted");
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
      setAidaConnectionStatus("muted");
    }
  }, [RELAY_SERVER_URL]);

  /**
   * Core RealtimeClient and audio capture setup
   * Set all of our instructions, tools, events and more
   */
  const connectAidaAgent = async () => {
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
      if (!item) {
        return;
      }
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
          addAidaUtterance({
            speaker: "Aida Voice Agent",
            text: item.formatted.transcript,
          });
        }
      }
    });

    return () => {
      client.reset();
    };
  };

  const disconnectAidaAgent = async () => {
    isAidaConnectedRef.current = false;
    const client = clientRef.current;
    const wavRecorder = wavRecorderRef.current;
    const wavStreamPlayer = wavStreamPlayerRef.current;

    if (!client || !wavRecorder || !wavStreamPlayer) {
      return;
    }

    try {
      // Disconnect from the microphone (pause or stop recording)
      if (wavRecorder.recording) {
        await wavRecorder.end(); // Pause recording if it's active
      }

      await wavStreamPlayer.stop();

      // Disconnect the real-time client
      await client.disconnect();
      console.log("Disconnected from Aida agent.");
      await client.reset(); // Reset client session
    } catch (error) {
      console.error("Error while disconnecting Aida agent:", error);
    }

    // Set the connection status to disconnected
    setAidaConnectionStatus("muted");
  };

  // Real-time transcript
  const { command, utterances, addAidaUtterance } = useTranscriptWebSocket(
    "wss://meeting-data.bot.recall.ai/api/v1/transcript"
  );

  // Aida command
  const handleCommand = (command: string) => {
    if (command === "connect") {
      setAidaConnectionStatus("connect");
      connectAidaAgent();
    } else if (command === "disconnect") {
      setAidaConnectionStatus("disconnect");
      disconnectAidaAgent();
    }
  };

  useEffect(() => {
    if (command) {
      handleCommand(command);
    }
  }, [command]);

  return (
    <div className="app-container">
      <p>
        Aida Status: {aidaConnectionStatus}, command: {command}
      </p>
      <Transcript utterances={utterances} />
    </div>
  );
};

export default App;
