import React, { useEffect, useRef, useState, useCallback } from 'react';
import { FilesetResolver, HandLandmarker, DrawingUtils } from '@mediapipe/tasks-vision';
import { Loader2, RotateCcw, Flame, Hand, Timer, ListOrdered, ArrowRight, User, Star, Wifi, WifiOff } from 'lucide-react';
import { captureFrame, generatePuzzleState, checkWinCondition, renderPuzzleGame } from '../utils/processing';
import { playSound } from '../utils/audio';

// --- CONSTANTS ---
const PINCH_THRESHOLD = 0.05; 
const FRAME_THRESHOLD = 0.1;
const RESET_DWELL_MS = 1500; 
const API_BASE_URL = 'https://live-puzzle-api.onrender.com';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));


type GameState = 'SCANNING' | 'PLAYING' | 'GAME_OVER' | 'LEADERBOARD';

type LeaderboardEntry = {
  name: string;
  level: number;
  date: number;
};

export default function GestureCamera() {
  const [modelLoaded, setModelLoaded] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [gameState, setGameState] = useState<GameState>('SCANNING');
  const [error, setError] = useState<string | null>(null);
  
  // 서바이벌 모드 상태 관리
  const [level, setLevel] = useState(1);
  const [timeLeft, setTimeLeft] = useState(10.0); // 1단계는 10초 시작
  const gridSize = level + 1; // Level 1 -> 2x2, Level 2 -> 3x3

  // Leaderboard State
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [playerName, setPlayerName] = useState(() => localStorage.getItem('live-puzzle-player-name') || '');
  const [personalBest, setPersonalBest] = useState<number | null>(() => {
    const best = localStorage.getItem('live-puzzle-personal-best-level');
    return best ? parseInt(best) : null;
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  
  // Video Recording State
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const requestRef = useRef<number | null>(null);
  
  // Game Data
  const puzzleTilesRef = useRef<any[]>([]);
  const puzzleImageCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameBoardCoordsRef = useRef<{minX: number, maxX: number, minY: number, maxY: number} | null>(null);

  // Interaction State
  const smoothCursorRef = useRef<{x: number, y: number}>({x: 0, y: 0});
  const dragRef = useRef<{isDragging: boolean, tileIndex: number | null}>({ isDragging: false, tileIndex: null });
  const lastPinchTimeRef = useRef<number>(0);
  const lastFrameCoordsRef = useRef<any>(null); 
  const fistHoldStartRef = useRef<number | null>(null); 

  // --- 1. FETCH LEADERBOARD ---
  const fetchLeaderboard = async (retries = 2) => {
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/leaderboard`);
        if (!res.ok) {
          throw new Error(`Leaderboard request failed with ${res.status}`);
        }

        const data = await res.json();
        setLeaderboard(data);
        setIsConnected(true);
        return true;
      } catch (err) {
        if (attempt === retries) {
          setIsConnected(false);
          return false;
        }

        await wait(1500 * (attempt + 1));
      }
    }

    return false;
  };

  useEffect(() => {
    fetchLeaderboard(gameState === 'LEADERBOARD' ? 3 : 1);
  }, [gameState]);

  useEffect(() => {
    if (gameState !== 'LEADERBOARD') return;

    const interval = window.setInterval(() => {
      fetchLeaderboard(1);
    }, 15000);

    return () => window.clearInterval(interval);
  }, [gameState]);

  // --- 2. INITIALIZE MEDIAPIPE ---
  useEffect(() => {
    const initMediaPipe = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm");
        handLandmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`, delegate: "GPU" },
          runningMode: "VIDEO", numHands: 2 
        });
        setModelLoaded(true);
      } catch (err) {
        setError("Failed to load AI Model.");
      }
    };
    initMediaPipe();
  }, []);

  // --- 3. INITIALIZE CAMERA ---
  useEffect(() => {
    const startCamera = async () => {
      if (!videoRef.current) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" } });
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => { videoRef.current?.play().then(() => setCameraReady(true)); };
      } catch (err) {
        setError("Camera access denied.");
      }
    };
    startCamera();
  }, []);

  // 4. COUNTDOWN TIMER LOGIC ---
  useEffect(() => {
    let interval: number;
    if (gameState === 'PLAYING') {
        interval = window.setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 0.1) {
                    clearInterval(interval);
                    setGameState('GAME_OVER');
                    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                        mediaRecorderRef.current.stop();
                    }
                    return 0;
                }
                return prev - 0.1;
            });
        }, 100);
    }
    return () => clearInterval(interval);
  }, [gameState]);

  const resetGame = () => {
      setGameState('SCANNING');
      puzzleTilesRef.current = [];
      dragRef.current = { isDragging: false, tileIndex: null };
      gameBoardCoordsRef.current = null;
      fistHoldStartRef.current = null;
      setIsSubmitting(false);
      setVideoUrl(null); 
      // 리셋 시 레벨과 시간 초기화
      setLevel(1);
      setTimeLeft(10.0);
  };

  // --- 5. SUBMIT SCORE ---
  const submitScore = async () => {
      if (!playerName.trim() || isSubmitting) return;
      setIsSubmitting(true);
      const cleanName = playerName.trim().toUpperCase();

      localStorage.setItem('live-puzzle-player-name', cleanName);
      
      // 최고 기록이 레벨이 더 높을 때 갱신
      if (personalBest === null || level > personalBest) {
          setPersonalBest(level);
          localStorage.setItem('live-puzzle-personal-best-level', level.toString());
      }

      try {
          const response = await fetch(`${API_BASE_URL}/api/score`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: cleanName, level: level }) // 시간 대신 레벨 전송
          });

          if (response.ok) {
              await fetchLeaderboard();
              setGameState('LEADERBOARD');
          } else {
              alert("Could not save score. Server error.");
          }
      } catch (e) {
          alert("Could not save score. Connection error.");
      } finally {
          setIsSubmitting(false);
      }
  };

  // --- 6. MAIN RENDER LOOP ---
  const renderLoop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const landmarker = handLandmarkerRef.current;

    if (!video || !canvas || !cameraReady) return;

    if (video.readyState >= 2) {
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      let results = null;
      if (landmarker && modelLoaded) {
          results = landmarker.detectForVideo(video, performance.now());
      }

      // STATE: SCANNING / LEADERBOARD
      if (gameState === 'SCANNING' || gameState === 'LEADERBOARD') {
          ctx.save();
          ctx.translate(width, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(video, 0, 0, width, height);
          ctx.restore();

          let validFrame = false;
          if (gameState === 'SCANNING') {
              if (results && results.landmarks && results.landmarks.length === 2) {
                const h1 = results.landmarks[0];
                const h2 = results.landmarks[1];
                
                const d1 = Math.hypot(h1[8].x - h1[4].x, h1[8].y - h1[4].y);
                const d2 = Math.hypot(h2[8].x - h2[4].x, h2[8].y - h2[4].y);

                if (d1 > FRAME_THRESHOLD && d2 > FRAME_THRESHOLD) {
                    const allX = [h1[8].x, h1[4].x, h2[8].x, h2[4].x];
                    const allY = [h1[8].y, h1[4].y, h2[8].y, h2[4].y];
                    lastFrameCoordsRef.current = {
                        minX: Math.min(...allX), maxX: Math.max(...allX),
                        minY: Math.min(...allY), maxY: Math.max(...allY)
                    };
                    validFrame = true;
                } 
                
                if (d1 < PINCH_THRESHOLD && d2 < PINCH_THRESHOLD && lastFrameCoordsRef.current) {
                    const now = Date.now();
                    if (now - lastPinchTimeRef.current > 1000) {
                        lastPinchTimeRef.current = now;
                        
                        const fullFrame = captureFrame(video, width, height);
                        const c = lastFrameCoordsRef.current;
                        const sx = (1 - c.maxX) * width;
                        const sy = c.minY * height;
                        const sw = ((1 - c.minX) * width) - sx;
                        const sh = (c.maxY * height) - sy;

                        if (sw > 0 && sh > 0) {
                            const cropCanvas = document.createElement('canvas');
                            cropCanvas.width = sw * 2;
                            cropCanvas.height = sh * 2;
                            const cropCtx = cropCanvas.getContext('2d');
                            
                            const tempC = document.createElement('canvas');
                            tempC.width = width;
                            tempC.height = height;
                            tempC.getContext('2d')?.putImageData(fullFrame, 0, 0);
                            
                            if (cropCtx) {
                                cropCtx.drawImage(tempC, sx, sy, sw, sh, 0, 0, cropCanvas.width, cropCanvas.height);
                            }
                            
                            puzzleImageCanvasRef.current = cropCanvas;
                            //  첫 시작은  2x2 (gridSize = 2)
                            puzzleTilesRef.current = generatePuzzleState(2, 2);
                            gameBoardCoordsRef.current = { ...c };
                            setLevel(1);
                            setTimeLeft(10.0);
                            setGameState('PLAYING');

                            if (canvasRef.current) {
                                const stream = (canvasRef.current as any).captureStream(30); 
                                mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'video/webm' });
                                recordedChunksRef.current = [];
                                mediaRecorderRef.current.ondataavailable = (e) => {
                                    if (e.data.size > 0) recordedChunksRef.current.push(e.data);
                                };
                                mediaRecorderRef.current.onstop = () => {
                                    const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
                                    const url = URL.createObjectURL(blob);
                                    setVideoUrl(url); 
                                };
                                mediaRecorderRef.current.start();
                            }
                        }
                    }
                }
              }

              if (lastFrameCoordsRef.current && validFrame) {
                 const c = lastFrameCoordsRef.current;
                 const sx = (1 - c.maxX) * width;
                 const ex = (1 - c.minX) * width;
                 const sy = c.minY * height;
                 const ey = c.maxY * height;
                 
                 ctx.strokeStyle = '#ccff00';
                 ctx.lineWidth = 4;
                 ctx.strokeRect(sx, sy, ex-sx, ey-sy);
                 
                 ctx.fillStyle = "white";
                 ctx.font = "bold 14px monospace";
                 ctx.fillText("PINCH TO CAPTURE", sx, sy - 8);
              }
          }
      }
      // STATE: PLAYING / GAME_OVER
      else if ((gameState === 'PLAYING' || gameState === 'GAME_OVER') && puzzleImageCanvasRef.current && gameBoardCoordsRef.current) {
          ctx.save();
          ctx.translate(width, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(video, 0, 0, width, height);
          ctx.restore();

          const c = gameBoardCoordsRef.current;
          const boardSX = (1 - c.maxX) * width;
          const boardSY = c.minY * height;
          const boardW = ((1 - c.minX) * width) - boardSX;
          const boardH = (c.maxY * height) - boardSY;

          let hoverIndex: number | null = null;
          let isPinching = false;
          let rawPointerX = 0;
          let rawPointerY = 0;
          let interactingHand = null;

          if (results && results.landmarks && results.landmarks.length > 0) {
              const hand = results.landmarks[0];
              interactingHand = hand;
              const indexTip = hand[8];
              const thumbTip = hand[4];
              
              rawPointerX = (1 - ((indexTip.x + thumbTip.x) / 2)) * width;
              rawPointerY = ((indexTip.y + thumbTip.y) / 2) * height;

              const dist = Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y);
              isPinching = dist < PINCH_THRESHOLD;

              const distMove = Math.hypot(rawPointerX - smoothCursorRef.current.x, rawPointerY - smoothCursorRef.current.y);
              const alpha = distMove > 100 ? 1 : 0.4;
              smoothCursorRef.current.x = smoothCursorRef.current.x * (1 - alpha) + rawPointerX * alpha;
              smoothCursorRef.current.y = smoothCursorRef.current.y * (1 - alpha) + rawPointerY * alpha;
          }

          const cursorX = smoothCursorRef.current.x;
          const cursorY = smoothCursorRef.current.y;
          
          const relX = cursorX - boardSX;
          const relY = cursorY - boardSY;
          
          if (relX >= 0 && relX <= boardW && relY >= 0 && relY <= boardH) {
              const col = Math.floor(relX / (boardW / gridSize));
              const row = Math.floor(relY / (boardH / gridSize));
              if (col >= 0 && col < gridSize && row >= 0 && row < gridSize) {
                  hoverIndex = row * gridSize + col;
              }
          }

          if (gameState === 'PLAYING') {
              if (isPinching) {
                  if (!dragRef.current.isDragging && hoverIndex !== null) {
                      dragRef.current = { isDragging: true, tileIndex: hoverIndex };
                      playSound('pickup'); 
                  } 
              } else {
                  if (dragRef.current.isDragging) {
                      const startIndex = dragRef.current.tileIndex;
                      const endIndex = hoverIndex;

                      if (startIndex !== null && endIndex !== null && startIndex !== endIndex) {
                          const newTiles = [...puzzleTilesRef.current];
                          [newTiles[startIndex], newTiles[endIndex]] = [newTiles[endIndex], newTiles[startIndex]];
                          puzzleTilesRef.current = newTiles;
                          
                          playSound('drop'); 

                          // 클리어 시 레벨업 및 시간 추가
                          if (checkWinCondition(newTiles)) {
                              playSound('win'); 
                              
                              const nextLevel = level + 1;
                              const nextGridSize = nextLevel + 1;
                              const bonusTime = 15 + ((nextLevel - 1) * 5); // 2단계 20초, 3단계 25초...

                              setLevel(nextLevel);
                              setTimeLeft(prev => prev + bonusTime);
                              
                              // 화면 쪼개기 즉시 리렌더링
                              puzzleTilesRef.current = generatePuzzleState(nextGridSize, nextGridSize);
                          }
                      } else {
                          playSound('drop'); 
                      }
                      dragRef.current = { isDragging: false, tileIndex: null };
                  }
              }
          }

          ctx.save();
          ctx.translate(boardSX, boardSY);
          
          renderPuzzleGame(
              ctx, 
              puzzleImageCanvasRef.current, 
              puzzleTilesRef.current, 
              gridSize, 
              gridSize, 
              boardW, 
              boardH, 
              dragRef.current.isDragging && dragRef.current.tileIndex !== null ? { 
                  index: dragRef.current.tileIndex,
                  x: relX,
                  y: relY
              } : null, 
              hoverIndex
          );

          ctx.strokeStyle = '#ffffff'; 
          ctx.lineWidth = 4;
          ctx.strokeRect(0, 0, boardW, boardH);
          ctx.restore();

          if (results && results.landmarks && results.landmarks.length > 0) {
              ctx.beginPath();
              ctx.arc(cursorX, cursorY, 10, 0, Math.PI * 2);
              if (dragRef.current.isDragging) ctx.fillStyle = '#ccff00';
              else { ctx.strokeStyle = '#ccff00'; ctx.lineWidth = 2; }
              if (dragRef.current.isDragging) ctx.fill();
              else ctx.stroke();
          }

          let isFist = false;
          if (interactingHand) {
            const wrist = interactingHand[0];
            const tips = [8, 12, 16, 20]; 
            const pips = [6, 10, 14, 18];
            const closedFingers = tips.filter((tipIdx, i) => {
              const tip = interactingHand[tipIdx];
              const pip = interactingHand[pips[i]];
              return Math.hypot(tip.x - wrist.x, tip.y - wrist.y) < Math.hypot(pip.x - wrist.x, pip.y - wrist.y);
            });
            isFist = closedFingers.length === 4;
          }

          if (isFist && gameState === 'PLAYING') {
              if (!fistHoldStartRef.current) fistHoldStartRef.current = performance.now();
              const elapsed = performance.now() - fistHoldStartRef.current;
              const progress = Math.min(elapsed / RESET_DWELL_MS, 1);

              const cx = width / 2;
              const cy = height / 2;
              
              ctx.save();
              ctx.beginPath();
              ctx.arc(cx, cy, 50, 0, Math.PI * 2);
              ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
              ctx.fill();

              ctx.beginPath();
              ctx.arc(cx, cy, 50, -Math.PI / 2, (-Math.PI / 2) + (Math.PI * 2 * progress));
              ctx.strokeStyle = '#ccff00';
              ctx.lineWidth = 6;
              ctx.lineCap = 'round';
              ctx.stroke();

              ctx.fillStyle = "white";
              ctx.font = "bold 14px monospace";
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillText("RESETTING", cx, cy - 5);
              ctx.restore();

              if (elapsed > RESET_DWELL_MS) resetGame();
          } else {
              fistHoldStartRef.current = null;
          }
      }

      if (results && results.landmarks && gameState !== 'LEADERBOARD') {
        const drawingUtils = new DrawingUtils(ctx);
        for (const landmarks of results.landmarks) {
           ctx.save();
           ctx.translate(width, 0);
           ctx.scale(-1, 1);
           drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, { color: "#ffffff", lineWidth: 3 });
           drawingUtils.drawLandmarks(landmarks, { color: "#ffffff", radius: 3, lineWidth: 1 });
           ctx.restore();
        }
      }
    }
    requestRef.current = requestAnimationFrame(renderLoop);
  }, [cameraReady, modelLoaded, gameState, level, timeLeft]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(renderLoop);
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [renderLoop]);

  return (
    <div className="relative w-full h-full bg-black overflow-hidden rounded-xl">
      <video ref={videoRef} className="hidden" playsInline muted autoPlay />
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover mx-auto" />

      {/* 🌟 서바이벌 HUD (레벨 & 타이머) */}
      {gameState === 'PLAYING' && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2">
            <div className="bg-[#ccff00] text-black px-4 py-1 rounded-full font-bold text-xs uppercase tracking-widest shadow-lg">
                LEVEL {level}
            </div>
            <div className={`flex items-center gap-2 px-6 py-3 rounded-full border shadow-2xl backdrop-blur transition-colors duration-300 ${timeLeft <= 5 ? 'bg-red-500/80 border-red-400 text-white animate-pulse' : 'bg-zinc-900/80 border-white/10 text-white'}`}>
                <Timer className={`w-5 h-5 ${timeLeft <= 5 ? 'text-white' : 'text-[#ccff00]'}`} />
                <span className="font-mono text-2xl font-bold tracking-wider">{timeLeft.toFixed(1)}s</span>
            </div>
        </div>
      )}

      {/* View Leaderboard Button */}
      {gameState === 'SCANNING' && (
        <button onClick={() => setGameState('LEADERBOARD')} className="absolute top-6 left-6 z-30 flex items-center gap-2 bg-zinc-900/80 text-white px-4 py-2 rounded-full border border-white/10 hover:bg-zinc-800 transition-colors cursor-pointer pointer-events-auto">
           <ListOrdered className="w-4 h-4 text-[#ccff00]" />
           <span className="text-xs font-bold uppercase">Leaderboard</span>
        </button>
      )}

      {/* Instructions Overlay */}
      <div className="absolute top-4 right-4 z-20 flex flex-col items-end gap-2 pointer-events-none">
          <div className="text-[10px] text-white/70 bg-black/60 p-3 rounded-lg backdrop-blur border border-white/10 text-right shadow-xl">
             {gameState === 'SCANNING' && (<><p className="font-bold text-[#ccff00] mb-1">PHASE 1: CAPTURE</p><p>1. Form a frame with two hands</p><p>2. Pinch both hands to SNAP</p></>)}
             {gameState === 'PLAYING' && (<><p className="font-bold text-[#ccff00] mb-1">PHASE 2: SURVIVE</p><p>Clear fast to add time!</p><p className="text-[#ccff00] mt-2">Hold Fist to Reset</p></>)}
             {gameState === 'GAME_OVER' && (<p className="font-bold text-red-500">TIME'S UP!</p>)}
          </div>
      </div>

      {/* 🌟 GAME OVER Screen */}
      {gameState === 'GAME_OVER' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-30 bg-black/80 backdrop-blur-md animate-in fade-in duration-500">
              <Flame className="w-20 h-20 text-red-500 drop-shadow-lg mb-4 animate-bounce" />
              <h2 className="text-4xl font-black text-white mb-2 italic tracking-widest">TIME'S UP</h2>
              
              <div className="flex flex-col items-center gap-1 mb-8">
                  <span className="text-zinc-400 uppercase tracking-widest text-sm">You Reached</span>
                  <span className="text-5xl font-bold text-[#ccff00]">LEVEL {level}</span>
              </div>

              {videoUrl && (
                  <a href={videoUrl} download="live_puzzle_survival.webm" className="mb-8 flex items-center gap-2 bg-white text-black font-bold py-2 px-6 rounded-full hover:bg-gray-200 transition-transform hover:scale-105 pointer-events-auto shadow-lg">
                      🎥 Download Replay (Shorts/Reels)
                  </a>
              )}
              
              <div className="flex flex-col items-center gap-4 w-full max-w-xs">
                  <p className="text-zinc-400 text-sm">Enter name to save your record</p>
                  <div className="flex items-center gap-2 w-full">
                     <div className="relative flex-1">
                        <User className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                        <input type="text" placeholder="YOUR NAME" maxLength={10} value={playerName} onChange={(e) => setPlayerName(e.target.value)} className="w-full bg-transparent border-b-2 border-[#ccff00] text-center text-xl text-white outline-none py-2 pl-6 font-mono uppercase focus:border-white transition-colors placeholder:text-zinc-700 pointer-events-auto" onKeyDown={(e) => e.key === 'Enter' && submitScore()} autoFocus />
                     </div>
                     <button onClick={submitScore} disabled={!playerName.trim() || isSubmitting} className="bg-[#ccff00] hover:bg-[#b3e600] disabled:opacity-50 disabled:cursor-not-allowed text-black p-2 rounded-full transition-transform hover:scale-105 pointer-events-auto">
                        {isSubmitting ? <Loader2 size={24} className="animate-spin" /> : <ArrowRight size={24} />}
                     </button>
                  </div>
              </div>

              <div className="mt-8 flex gap-4">
                 <button onClick={resetGame} className="text-white/50 hover:text-white text-xs underline cursor-pointer pointer-events-auto">Try Again</button>
              </div>
          </div>
      )}

      {/* Leaderboard Screen */}
      {gameState === 'LEADERBOARD' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-30 bg-black/90 backdrop-blur-xl animate-in fade-in duration-300">
             <div className="w-full max-w-md p-6">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <ListOrdered className="w-8 h-8 text-[#ccff00]" />
                        <h2 className="text-2xl font-bold text-white tracking-widest uppercase">Leaderboard</h2>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10">
                         {isConnected ? (<><Wifi className="w-3 h-3 text-green-400" /><span className="text-[10px] text-green-400 font-mono">LIVE</span></>) : (<><WifiOff className="w-3 h-3 text-red-400" /><span className="text-[10px] text-red-400 font-mono">OFFLINE</span></>)}
                    </div>
                </div>

                <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden mb-6 max-h-[50vh] overflow-y-auto custom-scrollbar relative">
                    {leaderboard.length === 0 ? (
                        <div className="p-8 text-center text-zinc-500">{isConnected ? (<p>No records yet.</p>) : (<Loader2 className="w-6 h-6 animate-spin text-[#ccff00] mx-auto" />)}</div>
                    ) : (
                        <div className="divide-y divide-white/5">
                            <div className="flex items-center justify-between p-4 bg-white/5 text-xs text-zinc-400 font-bold uppercase tracking-wider sticky top-0 backdrop-blur-md">
                                <span>Rank</span>
                                <span>Player</span>
                                <span>Max Level</span>
                            </div>
                            {leaderboard.map((entry, i) => (
                                <div key={i} className={`flex items-center justify-between p-4 text-sm transition-colors ${entry.name === playerName ? 'bg-[#ccff00]/10' : 'hover:bg-white/5'}`}>
                                    <div className="flex items-center gap-4">
                                        <span className={`font-mono font-bold w-6 ${i === 0 ? 'text-[#ccff00] text-lg' : 'text-zinc-500'}`}>#{i + 1}</span>
                                        <span className={`font-bold ${entry.name === playerName ? 'text-[#ccff00]' : 'text-white'}`}>{entry.name}</span>
                                    </div>
                                    <span className="font-bold text-[#ccff00]">Lv.{entry.level}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                
                <div className="flex justify-center">
                    <button onClick={resetGame} className="bg-[#ccff00] hover:bg-[#b3e600] text-black font-bold py-3 px-8 rounded-full flex items-center gap-2 transition-transform hover:scale-105 pointer-events-auto cursor-pointer">
                        <RotateCcw size={20} /> Back to Game
                    </button>
                </div>
             </div>
          </div>
      )}

      {gameState === 'PLAYING' && (
          <button onClick={resetGame} className="absolute bottom-6 left-6 z-20 bg-zinc-800/80 hover:bg-zinc-700 text-white p-3 rounded-full border border-white/10 transition-colors pointer-events-auto cursor-pointer"><RotateCcw size={20} /></button>
      )}

      {!cameraReady && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 text-white z-20"><Loader2 className="w-10 h-10 animate-spin text-[#ccff00] mb-4" /><p className="text-sm tracking-wider uppercase">Initializing Camera...</p></div>
      )}
    </div>
  );
}
