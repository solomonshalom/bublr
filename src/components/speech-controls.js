import React, { useState, useRef } from 'react';
import { IconButton } from './button';
import { PlayIcon, PauseIcon, MicrophoneIcon } from '@radix-ui/react-icons';

export function SpeechToTextButton({ onTranscription }) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  const startListening = async () => {
    try {
      const recognition = new window.webkitSpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map(result => result[0])
          .map(result => result.transcript)
          .join('');

        if (event.results[0].isFinal) {
          onTranscription(transcript);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);
    } catch (error) {
      console.error('Speech recognition error:', error);
      alert('Speech recognition is not supported in this browser.');
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  return (
    <IconButton
      onClick={isListening ? stopListening : startListening}
      title={isListening ? "Stop recording" : "Start recording"}
      style={{ color: isListening ? 'red' : 'inherit' }}
    >
      <MicrophoneIcon style={{ width: '24px', height: '24px' }} />
    </IconButton>
  );
}

export function TextToSpeechButton({ text }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const speechRef = useRef(null);

  const startSpeaking = async () => {
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onend = () => setIsPlaying(false);
      speechRef.current = utterance;
      window.speechSynthesis.speak(utterance);
      setIsPlaying(true);
    } catch (error) {
      console.error('Text-to-speech error:', error);
      alert('Text-to-speech is not supported in this browser.');
    }
  };

  const stopSpeaking = () => {
    window.speechSynthesis.cancel();
    setIsPlaying(false);
  };

  return (
    <IconButton
      onClick={isPlaying ? stopSpeaking : startSpeaking}
      title={isPlaying ? "Stop speaking" : "Start speaking"}
    >
      {isPlaying ? (
        <PauseIcon style={{ width: '24px', height: '24px' }} />
      ) : (
        <PlayIcon style={{ width: '24px', height: '24px' }} />
      )}
    </IconButton>
  );
}