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
  const [audioUrl, setAudioUrl] = useState(null);
  const audioRef = useRef(new Audio());

  const generateSpeech = async () => {
    try {
      const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5,
          },
        }),
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

  React.useEffect(() => {
    const audio = audioRef.current;
    
    audio.onended = () => {
      setIsPlaying(false);
    };

    return () => {
      audio.onended = null;
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

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