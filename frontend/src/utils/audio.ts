// src/utils/audio.ts

// 브라우저의 오디오 엔진을 가져옵니다.
const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();

export function playSound(type: 'pickup' | 'drop' | 'win') {
    // 브라우저 정책상 정지된 오디오 컨텍스트를 깨웁니다.
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const now = audioCtx.currentTime;

    if (type === 'pickup') {
        // 뾱! (높아지는 소리)
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.1); // 주파수 상승
        
        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1); // 볼륨 페이드아웃
        
        osc.start(now);
        osc.stop(now + 0.1);

    } else if (type === 'drop') {
        // 착! (낮아지는 둔탁한 소리)
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.1); // 주파수 하강
        
        gainNode.gain.setValueAtTime(0.4, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        
        osc.start(now);
        osc.stop(now + 0.1);

    } else if (type === 'win') {
        // 띠리링~ 빰! (승리의 화음)
        const notes = [440, 554, 659, 880]; // A장조 코드 (A, C#, E, A)
        notes.forEach((freq, i) => {
            const osc = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            osc.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            
            osc.type = 'square';
            osc.frequency.value = freq;
            
            // 시간차를 두고 화음이 연주되게 함
            const startTime = now + (i * 0.1); 
            gainNode.gain.setValueAtTime(0, startTime);
            gainNode.gain.linearRampToValueAtTime(0.15, startTime + 0.05);
            gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3);
            
            osc.start(startTime);
            osc.stop(startTime + 0.3);
        });
    }
}