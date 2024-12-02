import { useEffect, useMemo, useRef, useState } from "react";
import type { Utterance } from "@/types";

interface Word {
  text: string;
  start_time: number;
  end_time: number;
}

interface Transcript {
  speaker: string | null;
  speaker_id: string | null;
  transcription_provider_speaker?: string;
  language: string | null;
  original_transcript_id: number;
  words: Word[];
  is_final: boolean;
}

interface TranscriptMessage {
  bot_id: string;
  transcript: Transcript;
}

const WAKE_AIDA_COMMAND_LIST = ["hey aida", "aida listen", "start listening"];
const MUTE_AIDA_COMMAND_LIST = ["aida mute", "stop listening"];

const normalizeText = (text: string): string => {
  return text.toLowerCase().replace(/[^\w\s]/g, "");
};

export const useTranscriptWebSocket = (wsUrl: string) => {
  const RECONNECT_RETRY_INTERVAL_MS = 3000;

  const wsRef = useRef<WebSocket | null>(null);
  const retryIntervalRef = useRef<number | null>(null);

  const [finalizedUtterances, setFinalizedUtterances] = useState<Utterance[]>(
    []
  );
  const [currentUtterance, setCurrentUtterance] = useState<Utterance | null>(
    null
  );

  const [command, setCommand] = useState<"connect" | "disconnect">();

  const connectWebSocket = () => {
    if (wsRef.current) return;

    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onopen = () => {
      console.log("Connected to WebSocket server");
      if (retryIntervalRef.current) {
        clearInterval(retryIntervalRef.current);
        retryIntervalRef.current = null;
      }
    };

    wsRef.current.onmessage = async (event: MessageEvent) => {
      const message = JSON.parse(event.data) as TranscriptMessage;
      const transcript = message.transcript;
      const text = transcript.words.map((word) => word.text).join(" ");

      if (!transcript.is_final) {
        setCurrentUtterance({
          speaker: transcript.speaker,
          text,
        });
      } else {
        setFinalizedUtterances((prev) => [
          ...prev,
          {
            speaker: transcript.speaker,
            text,
          },
        ]);
        setCurrentUtterance(null);

        // Check command
        const normalizedText = normalizeText(text);
        if (
          WAKE_AIDA_COMMAND_LIST.some((command) =>
            normalizedText.includes(command)
          )
        ) {
          // Check for wake command
          setCommand("connect");
        } else if (
          MUTE_AIDA_COMMAND_LIST.some((command) =>
            normalizedText.includes(command)
          )
        ) {
          // Check for mute command
          setCommand("disconnect");
        }
      }
    };

    wsRef.current.onclose = () => {
      console.log("WebSocket closed. Attempting to reconnect...");
      wsRef.current = null;
      attemptReconnect();
    };

    wsRef.current.onerror = (error: Event) => {
      console.error("WebSocket error:", error);
      wsRef.current?.close();
    };
  };

  const attemptReconnect = () => {
    if (!retryIntervalRef.current) {
      retryIntervalRef.current = window.setInterval(() => {
        console.log("Attempting to reconnect to WebSocket...");
        connectWebSocket();
      }, RECONNECT_RETRY_INTERVAL_MS);
    }
  };

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (retryIntervalRef.current) {
        clearInterval(retryIntervalRef.current);
      }
    };
  }, []);

  // This could get super long for really long conversations.
  // Consider limiting the number of utterances stored.
  const utterances = useMemo(() => {
    if (currentUtterance) {
      return [...finalizedUtterances, currentUtterance];
    }
    return finalizedUtterances;
  }, [finalizedUtterances, currentUtterance]);

  // Function to add Aida's utterance to the utterances
  const addAidaUtterance = (utterance: Utterance) => {
    setFinalizedUtterances((prev) => [...prev, utterance]);
  };

  return {
    command,
    utterances,
    addAidaUtterance,
  };
};
