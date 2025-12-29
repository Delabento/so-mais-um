import React, { useState } from 'react';
import { useLiveSession } from './hooks/useLiveSession';
import { MenuCard } from './components/MenuCard';
import { VoiceIndicator } from './components/VoiceIndicator';
import { MENU_ITEMS } from './constants';

const App: React.FC = () => {
  const { isConnected, isSpeaking, volume, connect, disconnect, error, groundingMetadata, logs } = useLiveSession();
  const [activeCategory, setActiveCategory] = useState<string>('All');

  const categories = ['All', ...Array.from(new Set(MENU_ITEMS.map(item => item.category)))];

  const filteredItems = activeCategory === 'All'
    ? MENU_ITEMS
    : MENU_ITEMS.filter(item => item.category === activeCategory);

  const toggleConnection = () => {
    if (isConnected) {
      disconnect();
    } else {
      connect();
    }
  };

  return (
    <div className="min-h-screen bg-stone-950 flex flex-col">
      {/* Navbar */}
      <nav className="border-b border-stone-800 bg-stone-950/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-amber-500 rounded flex items-center justify-center text-stone-950 font-bold text-lg">
              S
            </div>
            <h1 className="text-xl font-bold tracking-tight">Só Mais Um <span className="text-stone-500 font-normal">| Luanda</span></h1>
          </div>
          <div className="text-sm font-medium text-amber-500">
            {isConnected ? (
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                ZARA Active
              </span>
            ) : (
              <span className="text-stone-500">ZARA Offline</span>
            )}
          </div>
        </div>
      </nav>

      {/* Hero / Interaction Area */}
      <header className="bg-stone-900 border-b border-stone-800 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-900/20 via-stone-950/50 to-stone-950 pointer-events-none"></div>
        <div className="max-w-4xl mx-auto px-4 py-16 flex flex-col items-center justify-center relative z-10 text-center">

          <h2 className="text-3xl md:text-5xl font-bold mb-4 text-white">
            "Um hambúrguer não é só comida, <br />é uma <span className="text-amber-500">experiência</span>."
          </h2>
          <p className="text-stone-400 max-w-lg mb-12 text-lg">
            Fale com a <strong>ZARA</strong>, nossa assistente virtual, para conhecer o cardápio, verificar entregas ou fazer o seu pedido.
          </p>

          {/* Voice Interface */}
          <div className="mb-12 flex flex-col items-center gap-8">
            <VoiceIndicator active={isConnected} volume={volume} isSpeaking={isSpeaking} />

            <button
              onClick={toggleConnection}
              className={`px-8 py-3 rounded-full font-bold transition-all duration-300 flex items-center gap-2 shadow-lg ${isConnected
                ? 'bg-red-500/10 text-red-500 border border-red-500 hover:bg-red-500 hover:text-white'
                : 'bg-amber-500 text-stone-950 hover:bg-amber-400 hover:scale-105'
                }`}
            >
              {isConnected ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  Desconectar
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
                  Falar com ZARA
                </>
              )}
            </button>

            {error && (
              <div className="bg-red-900/30 text-red-400 border border-red-900 px-4 py-2 rounded text-sm">
                {error}
              </div>
            )}
          </div>

          {/* Grounding / Maps Display */}
          {groundingMetadata && groundingMetadata.length > 0 && (
            <div className="w-full max-w-lg mt-4 bg-stone-800/50 p-4 rounded-lg border border-stone-700 text-left">
              <h4 className="text-amber-500 text-sm font-bold uppercase tracking-wider mb-3">Referências do Mapa</h4>
              <div className="space-y-2">
                {groundingMetadata.map((chunk, i) => {
                  if (chunk.web?.uri) {
                    return (
                      <a key={i} href={chunk.web.uri} target="_blank" rel="noopener noreferrer" className="block text-sm text-blue-400 hover:underline truncate">
                        {chunk.web.title || chunk.web.uri}
                      </a>
                    )
                  }
                  return null;
                })}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Menu Section */}
      <main className="flex-grow max-w-6xl mx-auto px-4 py-12 w-full">
        <div className="flex flex-col md:flex-row items-center justify-between mb-8">
          <h3 className="text-2xl font-bold text-white mb-4 md:mb-0">Nosso Menu</h3>

          <div className="flex gap-2 overflow-x-auto pb-2 w-full md:w-auto">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${activeCategory === cat
                  ? 'bg-amber-500 text-stone-900 font-bold'
                  : 'bg-stone-800 text-stone-400 hover:text-white'
                  }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item, index) => (
            <MenuCard key={index} {...item} />
          ))}
        </div>
        <div className="max-w-6xl mx-auto px-4 py-4 w-full">
          <details className="bg-stone-900 border border-stone-800 rounded p-2 text-xs text-stone-400 font-mono">
            <summary className="cursor-pointer hover:text-stone-300">Debugger Logs ({logs ? logs.length : 0})</summary>
            <div className="mt-2 h-48 overflow-y-auto space-y-1 p-2 bg-black rounded">
              {logs && logs.map((log, i) => (
                <div key={i} className="border-b border-stone-800 pb-0.5">{log}</div>
              ))}
              {!logs && <div>No logs initialized</div>}
            </div>
          </details>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-stone-950 border-t border-stone-800 py-8">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center text-sm text-stone-500">
          <p>© 2024 Só Mais Um. Todos os direitos reservados.</p>
          <div className="flex items-center gap-6 mt-4 md:mt-0">
            <span>Bairro Prenda, Luanda</span>
            <span>+244 923 444 333</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;