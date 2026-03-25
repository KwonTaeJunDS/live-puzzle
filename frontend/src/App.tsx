// src/App.tsx
import GestureCamera from './components/GestureCamera';

export default function App() {
  return (
    <div className="w-screen h-screen flex flex-col items-center justify-center bg-zinc-950 relative" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
      
      {/* 상단 타이틀 */}
      <div className="absolute top-4 left-0 right-0 text-center z-10 pointer-events-none">
        <h1 className="text-2xl font-bold tracking-widest text-[#ccff00] uppercase drop-shadow-md">
          Live Puzzle
        </h1>
        <p className="text-zinc-400 text-xs mt-1">
          Frame it to Snap. Pinch & Drag to Swap.
        </p>
      </div>
      
      {/* 게임 메인 화면 */}
      <div className="relative w-[95vw] h-[85vh] bg-zinc-900 rounded-xl overflow-hidden shadow-2xl border border-zinc-800">
        <GestureCamera />
      </div>

      {/* 하단 크레딧 (원작자 리스펙트) */}
      <div className="absolute bottom-4 left-0 right-0 text-center z-10 pointer-events-none">
        <p className="text-zinc-500 text-[10px] uppercase tracking-widest">
            Inspired by <a href="https://www.instagram.com/byisabellek" target="_blank" rel="noreferrer" className="text-[#ccff00] hover:underline pointer-events-auto">@byisabellek</a>
        </p>
      </div>

    </div>
  );
}