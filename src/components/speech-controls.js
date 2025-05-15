import React, { useState, useRef, useEffect } from 'react';
import { IconButton } from './button';
import { PlayIcon as PlayIconHuge, PauseIcon as PauseIconHuge, Mic02Icon, MicOff02Icon } from 'hugeicons-react';
import { PlayIcon, PauseIcon } from '@radix-ui/react-icons';

export function SpeechToTextButton({ onTranscription }) {
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [error, setError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const streamRef = useRef(null);

  // Cleanup function for when component unmounts or recording stops
  const cleanupRecording = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    
    if (mediaRecorder) {
      try {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
        }
      } catch (err) {
        console.error("Error stopping media recorder:", err);
      }
    }
    
    setIsRecording(false);
    setMediaRecorder(null);
  };

  // Cleanup on component unmount
  useEffect(() => {
    return cleanupRecording;
  }, [cleanupRecording]);

  const handleRecord = async () => {
    setError(null);
    
    if (isRecording && mediaRecorder) {
      mediaRecorder.stop();
      setIsRecording(false);
    } else if (!isProcessing) {
      try {
        setIsProcessing(true);
        
        // Check if browser supports getUserMedia
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Your browser doesn't support audio recording");
        }
        
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          } 
        });
        
        streamRef.current = stream;
        
        // Create options with proper mime type support detection
        const mimeType = MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4';
          
        const recorder = new MediaRecorder(stream, { mimeType });
        
        const audioChunks = [];
        
        recorder.addEventListener("dataavailable", (event) => {
          if (event.data.size > 0) {
            audioChunks.push(event.data);
          }
        });

        recorder.addEventListener("stop", async () => {
          try {
            if (audioChunks.length === 0) {
              throw new Error("No audio data captured");
            }
            
            const audioBlob = new Blob(audioChunks, { type: mimeType });
            
            if (audioBlob.size === 0) {
              throw new Error("Audio recording is empty");
            }
            
            const formData = new FormData();
            formData.append("audio", audioBlob, `recording.${mimeType.includes('webm') ? 'webm' : 'mp4'}`);
            
            const response = await fetch("/api/transcribe", {
              method: "POST",
              body: formData,
            });

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({ error: response.statusText }));
              throw new Error(`Transcription failed: ${errorData.error || response.statusText}`);
            }

            const data = await response.json();
            if (data.text) {
              onTranscription(data.text);
            } else {
              throw new Error("Transcription returned no text");
            }
          } catch (error) {
            console.error("Error during transcription:", error);
            setError(error.message);
          } finally {
            cleanupRecording();
            setIsProcessing(false);
          }
        });

        recorder.addEventListener("error", (event) => {
          console.error("MediaRecorder error:", event);
          setError("Recording error occurred");
          cleanupRecording();
          setIsProcessing(false);
        });

        setMediaRecorder(recorder);
        recorder.start();
        setIsRecording(true);
      } catch (error) {
        console.error("Error setting up recording:", error);
        setError(error.message);
        cleanupRecording();
        setIsProcessing(false);
      }
    }
  };

  return (
    <IconButton
      onClick={handleRecord}
      title={isRecording ? "Stop recording" : (isProcessing ? "Processing..." : "Start recording")}
      style={{ color: isRecording ? 'red' : (error ? '#ff6b6b' : 'inherit') }}
      disabled={isProcessing}
    >
      {isRecording ? 
        <MicOff02Icon style={{ width: '24px', height: '24px' }} /> : 
        <Mic02Icon style={{ width: '24px', height: '24px' }} />
      }
      {error && (
        <span style={{ 
          position: 'absolute', 
          width: '6px', 
          height: '6px', 
          borderRadius: '50%', 
          background: '#ff6b6b', 
          bottom: '3px', 
          right: '3px' 
        }} />
      )}
    </IconButton>
  );
}

export function TextToSpeechButton({ text }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const audioRef = useRef(null);
  const abortControllerRef = useRef(null);
  
  // Initialize audio on mount to avoid SSR issues
  useEffect(() => {
    audioRef.current = new Audio();
    
    // Setup audio event listeners
    const audio = audioRef.current;
    
    const handleEnded = () => setIsPlaying(false);
    const handleError = (e) => {
      console.error('Audio playback error:', e);
      setIsPlaying(false);
      setError('Playback failed');
    };
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    
    return () => {
      // Cleanup audio element and URL on unmount
      audio.pause();
      audio.src = '';
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      
      // Cancel any in-flight requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const generateSpeech = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Cancel any previous requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      // Create a new abort controller for this request
      abortControllerRef.current = new AbortController();
      
      // Pause any currently playing audio
      if (audioRef.current) {
        audioRef.current.pause();
      }
      
      // Validate text
      if (!text || text.trim() === '') {
        throw new Error('No text to speak');
      }
      
      const response = await fetch('/api/text-to-speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          text: text.trim().substring(0, 5000) // Limit text length
        }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        let errorMessage = 'Failed to generate speech';
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (e) {
          // If we can't parse the error as JSON, use the status text
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const blob = await response.blob();
      
      if (blob.size === 0) {
        throw new Error('Received empty audio data');
      }
      
      // Revoke previous URL to avoid memory leaks
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      
      if (audioRef.current) {
        audioRef.current.src = url;
        await audioRef.current.play();
        setIsPlaying(true);
      }
    } catch (error) {
      // Don't show aborted request errors to the user
      if (error.name === 'AbortError') {
        console.log('Text-to-speech request aborted');
        return;
      }
      
      console.error('Text-to-speech error:', error);
      setError(error.message);
      setIsPlaying(false);
    } finally {
      setIsLoading(false);
    }
  };

  const togglePlayback = async () => {
    if (isLoading) return;
    
    if (!audioUrl || error) {
      await generateSpeech();
    } else if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      // setIsPlaying(false) will be called by the 'pause' event handler
    } else if (audioRef.current) {
      try {
        await audioRef.current.play();
        // setIsPlaying(true) will be called by the 'play' event handler
      } catch (error) {
        console.error('Error playing audio:', error);
        // If the audio fails to play (corrupted), generate a new one
        await generateSpeech();
      }
    }
  };

  return (
    <IconButton
      onClick={togglePlayback}
      title={isPlaying ? "Pause" : (isLoading ? "Loading..." : "Play")}
      disabled={isLoading}
      style={{ color: error ? '#ff6b6b' : 'inherit' }}
    >
      {isLoading ? (
        <span className="loading-indicator" style={{ 
          display: 'inline-block',
          width: '24px',
          height: '24px',
          borderRadius: '50%',
          border: '2px solid currentColor',
          borderTopColor: 'transparent',
          animation: 'spin 1s linear infinite'
        }} />
      ) : isPlaying ? (
        <PauseIcon style={{ width: '24px', height: '24px' }} />
      ) : (
        <PlayIcon style={{ width: '24px', height: '24px' }} />
      )}
      {error && (
        <span style={{ 
          position: 'absolute', 
          width: '6px', 
          height: '6px', 
          borderRadius: '50%', 
          background: '#ff6b6b', 
          bottom: '3px', 
          right: '3px' 
        }} />
      )}
    </IconButton>
  );
}