import React, { useState, useRef } from 'react';
import { IconButton } from './button';
import { PlayIcon as PlayIconHuge, PauseIcon as PauseIconHuge, Mic02Icon, MicOff02Icon } from 'hugeicons-react';
import { PlayIcon, PauseIcon } from '@radix-ui/react-icons';

export function SpeechToTextButton({ onTranscription }) {
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);

  const handleRecord = async () => {
    if (isRecording && mediaRecorder) {
      mediaRecorder.stop();
      setIsRecording(false);
      setMediaRecorder(null);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        setMediaRecorder(recorder);

        recorder.addEventListener("dataavailable", async (event) => {
          if (event.data.size > 0) {
            const audioBlob = event.data;
            try {
              const formData = new FormData();
              formData.append("audio", audioBlob, "recording.webm");

              const response = await fetch("/api/transcribe", {
                method: "POST",
                body: formData,
              });

              if (!response.ok) {
                throw new Error(`Transcription failed: ${response.statusText}`);
              }

              const data = await response.json();
              if (data.text) {
                onTranscription(data.text);
              } else {
                console.error("Transcription response did not contain text:", data);
              }
            } catch (error) {
              console.error("Error during transcription request:", error);
            } finally {
              setIsRecording(false);
              setMediaRecorder(null);
              stream.getTracks().forEach((track) => track.stop());
            }
          }
        });

        recorder.addEventListener("stop", () => {
          stream.getTracks().forEach((track) => track.stop());
        });

        recorder.start();
        setIsRecording(true);
      } catch (error) {
        console.error("Error accessing microphone:", error);
        setIsRecording(false);
      }
    }
  };

  return (
    <IconButton
      onClick={handleRecord}
      title={isRecording ? "Stop recording" : "Start recording"}
      style={{ color: isRecording ? 'red' : 'inherit' }}
    >
      {isRecording ? <MicOff02Icon style={{ width: '24px', height: '24px' }} /> : <Mic02Icon style={{ width: '24px', height: '24px' }} />}
    </IconButton>
  );
}

export function TextToSpeechButton({ text }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const audioRef = useRef(new Audio());

  const generateSpeech = async () => {
    try {
      const response = await fetch('/api/text-to-speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate speech');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      
      audioRef.current.src = url;
      audioRef.current.play();
      setIsPlaying(true);
    } catch (error) {
      console.error('Text-to-speech error:', error);
      alert('Failed to generate speech. Please try again.');
      setIsPlaying(false);
    }
  };

  const togglePlayback = async () => {
    if (!audioUrl) {
      await generateSpeech();
    } else if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  return (
    <IconButton
      onClick={togglePlayback}
      title={isPlaying ? "Pause" : "Play"}
    >
      {isPlaying ? (
        <PauseIcon style={{ width: '24px', height: '24px' }} />
      ) : (
        <PlayIcon style={{ width: '24px', height: '24px' }} />
      )}
    </IconButton>
  );
}