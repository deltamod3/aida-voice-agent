import React, { useEffect, useRef } from "react";
import { useTranscriptWebSocket } from "@/hooks/useTranscriptWebSocket";
import "./Transcript.css";

const Transcript: React.FC = () => {
  const { utterances } = useTranscriptWebSocket(
    "wss://meeting-data.bot.recall.ai/api/v1/transcript"
  );

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo(0, 0);
    }
  }, [utterances]);

  let lastSpeaker: string | null = null;

  return (
    <>
      <div className="transcript-container" ref={containerRef}>
        {!utterances.length ? (
          <div
            style={{
              textAlign: "center",
              padding: "1rem",
              fontSize: "1.2rem",
            }}
          >
            Aida Voice Agent is listening...
          </div>
        ) : (
          <div
            style={{
              textAlign: "center",
              padding: "0 0 2rem",
              color: "lightgray",
            }}
          >
            <span className="badge">Meeting transcription</span>
          </div>
        )}
        {utterances
          .slice()
          .reverse() // Display the latest utterance at the top
          .map((item, index) => {
            const isNewSpeaker = item.speaker !== lastSpeaker;
            lastSpeaker = item.speaker;

            return (
              <div key={index} className="transcript-item">
                <div
                  className="speaker-column"
                  style={{
                    fontWeight: isNewSpeaker ? "bold" : "normal",
                    visibility: isNewSpeaker ? "visible" : "hidden",
                  }}
                >
                  {isNewSpeaker && item.speaker ? `${item.speaker}` : ""}
                </div>

                <div className="utterance-column">
                  <div className="transcript-text">{item.text}</div>
                </div>
              </div>
            );
          })}
      </div>
    </>
  );
};

export default Transcript;
