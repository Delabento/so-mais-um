import React from 'react';

interface VoiceIndicatorProps {
  active: boolean;
  volume: number; // 0-100
  isSpeaking: boolean;
}

export const VoiceIndicator: React.FC<VoiceIndicatorProps> = ({ active, volume, isSpeaking }) => {
  if (!active) {
    return (
      <div className="w-24 h-24 rounded-full bg-stone-800 flex items-center justify-center border-4 border-stone-700">
        <span className="text-stone-500">OFF</span>
      </div>
    );
  }

  // Map volume to scale
  const scale = 1 + (volume / 200); 

  return (
    <div className="relative flex items-center justify-center w-32 h-32">
        {/* Pulsing ring for output (ZARA speaking) */}
        {isSpeaking && <div className="pulse-ring absolute inset-0 rounded-full bg-amber-500 opacity-20"></div>}
        
        {/* Input visualizer (Mic volume) */}
        <div 
            className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-75 shadow-[0_0_30px_rgba(245,158,11,0.3)] ${isSpeaking ? 'bg-amber-600' : 'bg-stone-800 border-2 border-amber-500'}`}
            style={{ transform: `scale(${scale})` }}
        >
            <div className={`w-3 h-3 rounded-full ${isSpeaking ? 'bg-white animate-pulse' : 'bg-amber-500'}`}></div>
        </div>
        
        {/* Status Text */}
        <div className="absolute -bottom-10 text-center w-full">
            <span className="text-sm font-medium text-amber-500 uppercase tracking-widest animate-pulse">
                {isSpeaking ? 'ZARA Speaking...' : 'Listening...'}
            </span>
        </div>
    </div>
  );
};