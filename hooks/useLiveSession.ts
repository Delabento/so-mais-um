
import { useState, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage } from '@google/genai';
import { createPcmBlob, decodeAudioData, base64ToUint8Array } from '../utils/audioUtils';
import { SYSTEM_INSTRUCTION } from '../constants';

interface UseLiveSessionResult {
  isConnected: boolean;
  isSpeaking: boolean;
  volume: number;
  connect: () => Promise<void>;
  disconnect: () => void;
  error: string | null;
  groundingMetadata: any[] | null;
}

// Restaurant Location (Bairro Prenda, Luanda approx)
const RESTAURANT_LOCATION = {
  latitude: -8.825,
  longitude: 13.235
};

// Calculate distance in km using Haversine formula
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  // Clamp 'a' to [0, 1] to prevent NaN in sqrt due to floating point errors
  const clampedA = Math.max(0, Math.min(1, a));

  const c = 2 * Math.atan2(Math.sqrt(clampedA), Math.sqrt(1 - clampedA));
  const d = R * c; // Distance in km
  return parseFloat(d.toFixed(2));
};

const getDeliveryZone = (distance: number) => {
  if (distance <= 3) return { zone: "Zona 1", price: "500 Kzs" };
  if (distance <= 10) return { zone: "Zona 2", price: "1.500 Kzs" };
  if (distance <= 20) return { zone: "Zona 3", price: "3.000 Kzs" };
  return { zone: "Zona 4", price: "5.000 Kzs (Sob consulta)" };
};

const WEBHOOK_URL = "https://teste-n8n.gre2wr.easypanel.host/webhook/b86058db-cee3-4e57-8822-594cb5d1c398";

export const useLiveSession = (): UseLiveSessionResult => {
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [volume, setVolume] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [groundingMetadata, setGroundingMetadata] = useState<any[] | null>(null);

  // Audio Contexts and Nodes
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const outputNodeRef = useRef<GainNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Live Session
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const currentSessionRef = useRef<any | null>(null);

  // Audio Queue Management
  const nextStartTimeRef = useRef<number>(0);
  const scheduledSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  // Animation frame for volume visualization
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafIdRef = useRef<number | null>(null);

  // Connection/Greeting State
  const allowAudioStreamRef = useRef<boolean>(false);

  const cleanup = useCallback(() => {
    console.log("Cleaning up session...");

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (inputSourceRef.current) {
      inputSourceRef.current.disconnect();
      inputSourceRef.current = null;
    }
    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }

    if (inputAudioContextRef.current) {
      inputAudioContextRef.current.close();
      inputAudioContextRef.current = null;
    }
    if (outputAudioContextRef.current) {
      scheduledSourcesRef.current.forEach(source => {
        try { source.stop(); } catch (e) { /* ignore */ }
      });
      scheduledSourcesRef.current.clear();
      outputAudioContextRef.current.close();
      outputAudioContextRef.current = null;
    }

    currentSessionRef.current = null;
    sessionPromiseRef.current = null;
    allowAudioStreamRef.current = false;

    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    setIsConnected(false);
    setIsSpeaking(false);
    setVolume(0);
    setGroundingMetadata(null);
  }, []);

  const visualizeVolume = () => {
    if (!analyserRef.current) return;
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    const average = sum / dataArray.length;

    setVolume(Math.min(100, average * 1.5));
    rafIdRef.current = requestAnimationFrame(visualizeVolume);
  };

  const getUserLocation = (): Promise<{ latitude: number, longitude: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        },
        (err) => {
          console.warn("Geolocation denied or failed:", err);
          resolve(null);
        },
        { timeout: 5000 }
      );
    });
  };

  const connect = useCallback(async () => {
    setError(null);
    try {
      const apiKey = (import.meta as any).env.VITE_GEMINI_API_KEY;
      if (!apiKey) throw new Error("API Key not found in environment.");

      // Get location before connecting
      let locationContext = "";
      try {
        const location = await getUserLocation();
        if (location) {
          const distance = calculateDistance(
            RESTAURANT_LOCATION.latitude,
            RESTAURANT_LOCATION.longitude,
            location.latitude,
            location.longitude
          );

          if (isNaN(distance)) {
            locationContext = "\n[AVISO DO SISTEMA: Erro no cálculo de distância. Pergunte o bairro.]";
          } else {
            const deliveryInfo = getDeliveryZone(distance);
            locationContext = `
                    [DADOS DE LOCALIZAÇÃO DO SISTEMA]
                    Localização do Cliente: Lat ${location.latitude}, Long ${location.longitude}
                    Distância do Restaurante: ${distance} km
                    Zona de Entrega: ${deliveryInfo.zone}
                    Taxa de Entrega Calculada: ${deliveryInfo.price}
                    
                    Instrução: Use estes dados para informar a taxa de entrega se o cliente perguntar.
                  `;
          }
        } else {
          locationContext = "\n[AVISO DO SISTEMA: Localização do cliente não disponível. Pergunte o bairro.]";
        }
      } catch (e) {
        console.warn("Could not fetch location", e);
        locationContext = "\n[AVISO DO SISTEMA: Erro ao obter localização. Pergunte o bairro.]";
      }

      const ai = new GoogleGenAI({ apiKey });

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      inputAudioContextRef.current = new AudioContextClass({ sampleRate: 16000 });
      outputAudioContextRef.current = new AudioContextClass({ sampleRate: 24000 });

      if (inputAudioContextRef.current.state === 'suspended') await inputAudioContextRef.current.resume();
      if (outputAudioContextRef.current.state === 'suspended') await outputAudioContextRef.current.resume();

      outputNodeRef.current = outputAudioContextRef.current.createGain();
      outputNodeRef.current.connect(outputAudioContextRef.current.destination);

      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (err: any) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          throw new Error("Permissão de microfone negada. Por favor, permita o acesso no navegador.");
        }
        throw err;
      }
      streamRef.current = stream;

      const source = inputAudioContextRef.current.createMediaStreamSource(stream);
      inputSourceRef.current = source;

      const analyser = inputAudioContextRef.current.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
      visualizeVolume();

      const processor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (!sessionPromiseRef.current || !allowAudioStreamRef.current) return;

        const inputData = e.inputBuffer.getChannelData(0);
        const pcmBlob = createPcmBlob(inputData);

        // Use the ref to ensure we have the latest promise
        sessionPromiseRef.current.then(session => {
          try {
            session.sendRealtimeInput({ media: pcmBlob });
          } catch (err) {
            // Ignore transient errors
          }
        }).catch(() => { });
      };

      source.connect(processor);
      processor.connect(inputAudioContextRef.current.destination);

      // Construct config with injected location context
      // Explicitly formatting systemInstruction as Content object to prevent 503 errors
      const config: any = {
        responseModalities: ['AUDIO'],
        systemInstruction: {
          parts: [{ text: SYSTEM_INSTRUCTION + "\n\n" + locationContext }]
        },
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
        },
        tools: [{
          functionDeclarations: [{
            name: "finalize_order",
            description: "Finaliza o pedido enviando os dados para o CRM via webhook.",
            parameters: {
              type: "OBJECT",
              properties: {
                name: { type: "STRING", description: "Nome completo do cliente" },
                phone_number: { type: "STRING", description: "Número de telefone do cliente" },
                email: { type: "STRING", description: "Email do cliente" },
                address: { type: "STRING", description: "Endereço de entrega completo" },
                items: { type: "STRING", description: "Lista de itens pedidos (formatado como texto)" },
                total: { type: "STRING", description: "Valor total do pedido (ex: 5.000 Kzs)" }
              },
              required: ["name", "phone_number", "email", "address", "items", "total"]
            }
          }]
        }]
      };

      console.log("Connecting to Gemini Live with config:", config);

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config,
        callbacks: {
          onopen: () => {
            setIsConnected(true);
            nextStartTimeRef.current = outputAudioContextRef.current?.currentTime || 0;
            console.log("Session opened");
          },
          onmessage: async (message: LiveServerMessage) => {
            // Check for grounding metadata (if available in future)
            const parts = message.serverContent?.modelTurn?.parts;
            if (parts) {
              const groundingChunks = parts.flatMap(p => (p as any).groundingMetadata?.groundingChunks || []);
              if (groundingChunks.length > 0) {
                setGroundingMetadata(prev => [...(prev || []), ...groundingChunks]);
              }
            }

            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && outputAudioContextRef.current && outputNodeRef.current) {
              try {
                const audioBuffer = await decodeAudioData(
                  base64ToUint8Array(base64Audio),
                  outputAudioContextRef.current,
                  24000
                );

                const source = outputAudioContextRef.current.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(outputNodeRef.current);

                const currentTime = outputAudioContextRef.current.currentTime;
                const startTime = Math.max(nextStartTimeRef.current, currentTime);

                source.start(startTime);
                nextStartTimeRef.current = startTime + audioBuffer.duration;

                scheduledSourcesRef.current.add(source);
                setIsSpeaking(true);

                source.onended = () => {
                  scheduledSourcesRef.current.delete(source);
                  if (scheduledSourcesRef.current.size === 0) {
                    setIsSpeaking(false);
                  }
                };
              } catch (decodeErr) {
                console.error("Error decoding audio:", decodeErr);
              }
            }

            if (message.serverContent?.interrupted) {
              scheduledSourcesRef.current.forEach(src => {
                try { src.stop(); } catch (e) { /* ignore */ }
              });
              scheduledSourcesRef.current.clear();
              nextStartTimeRef.current = outputAudioContextRef.current?.currentTime || 0;
              setIsSpeaking(false);
            }

            // Handle Tool Calls
            const toolCall = message.toolCall;
            if (toolCall) {
              const functionCalls = toolCall.functionCalls;
              if (functionCalls && functionCalls.length > 0) {
                const call = functionCalls[0];
                if (call.name === 'finalize_order') {
                  console.log("Recebida chamada de ferramenta finalize_order", call.id, call.args);
                  try {
                    const response = await fetch(WEBHOOK_URL, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(call.args)
                    });

                    let resultText = "Pedido enviado com sucesso para a cozinha.";
                    if (!response.ok) {
                      resultText = "Houve um erro técnico ao registrar o pedido, mas anotei os detalhes.";
                      console.error("Webhook error", response.status);
                    }

                    // Send Tool Response Back to Gemini
                    const toolResponse = {
                      toolResponse: {
                        functionResponses: [{
                          id: call.id,
                          response: { result: { text: resultText } }
                        }]
                      }
                    };

                    // Use the current session ref to send response
                    if (currentSessionRef.current) {
                      await currentSessionRef.current.send(toolResponse);
                    }

                  } catch (e) {
                    console.error("Erro ao chamar webhook", e);
                  }
                }
              }
            }
          },
          onclose: (e) => {
            console.log("Session closed", e);
            cleanup();
          },
          onerror: (err) => {
            console.error("Session error:", err);
            setError("Connection error encountered.");
            cleanup();
          }
        }
      });

      sessionPromiseRef.current = sessionPromise;
      const session = await sessionPromise;
      currentSessionRef.current = session;

      // Minimized delay to ensure WebSocket is ready, but feels immediate
      await new Promise(resolve => setTimeout(resolve, 100));

      try {
        await (session as any).send({
          parts: [{ text: "O usuário conectou. Comece a falar IMEDIATAMENTE com esta frase exata: 'Só Mais Um, fala a ZARA. Como posso ajudar no seu pedido hoje?'" }],
          turnComplete: true
        });

        // Delay microphone input slightly to prevent picking up self-voice or initial noise
        setTimeout(() => {
          allowAudioStreamRef.current = true;
        }, 1000);
      } catch (e) {
        console.warn("Failed to send initial greeting", e);
        allowAudioStreamRef.current = true;
      }

    } catch (err: any) {
      console.error("Failed to connect:", err);
      setError(err.message || "Failed to start session");
      cleanup();
    }
  }, [cleanup]);

  const disconnect = useCallback(() => {
    cleanup();
  }, [cleanup]);

  return {
    isConnected,
    isSpeaking,
    volume,
    connect,
    disconnect,
    error,
    groundingMetadata
  };
};
