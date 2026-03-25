// src/utils/processing.ts

export function captureFrame(video: HTMLVideoElement, width: number, height: number): ImageData {
    const offscreen = document.createElement('canvas');
    offscreen.width = width;
    offscreen.height = height;
    const ctx = offscreen.getContext('2d');
    if (!ctx) throw new Error('Could not get context');
    
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, width, height);
    return ctx.getImageData(0, 0, width, height);
}

export function generatePuzzleState(cols: number, rows: number) {
    const tiles = [];
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            tiles.push({ currentX: x, currentY: y, origX: x, origY: y, id: y * cols + x });
        }
    }
    for (let i = tiles.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
    }
    return tiles;
}

export function checkWinCondition(tiles: any[]) {
    return tiles.every((tile, index) => tile.id === index);
}

// (기존 코드의 renderPuzzleGame 함수 전체를 여기에 붙여넣습니다. 코드가 너무 길어 생략하지만 원본 코드의 renderPuzzleGame 함수 부분 전체를 가져오시면 됩니다.)
// 함수 선언부에 export 키워드만 붙여주세요: export function renderPuzzleGame(...) { ... }


// export function renderPuzzleGame(
//   ctx: CanvasRenderingContext2D, 
//   imageSource: ImageBitmap | HTMLCanvasElement, 
//   tiles: any[], // The shuffled array
//   cols: number, 
//   rows: number, 
//   destWidth: number, 
//   destHeight: number,
//   dragInfo: { index: number, x: number, y: number } | null, // x,y are relative to the board
//   hoverIndex: number | null 
// ) {
//   const destTileW = destWidth / cols;
//   const destTileH = destHeight / rows;
//   const srcTileW = imageSource.width / cols;
//   const srcTileH = imageSource.height / rows;

//   // Fill background
//   ctx.fillStyle = '#111';
//   ctx.fillRect(0, 0, destWidth, destHeight);

//   // Helper to draw a single tile
//   const drawTile = (tile: any, dx: number, dy: number, width: number, height: number, isDragging: boolean = false) => {
//       const srcCol = tile.origX;
//       const srcRow = tile.origY;
//       const sx = srcCol * srcTileW;
//       const sy = srcRow * srcTileH;

//       ctx.save();
      
//       if (isDragging) {
//           // Shadow for lifted tile
//           ctx.shadowColor = 'rgba(0,0,0,0.5)';
//           ctx.shadowBlur = 15;
//           ctx.shadowOffsetY = 10;
//           ctx.globalAlpha = 1.0;
//           ctx.strokeStyle = '#ccff00'; // Custom Green
//           ctx.lineWidth = 2;
//       } else {
//           ctx.strokeStyle = '#ffffff';
//           ctx.lineWidth = 1;
//       }

//       ctx.drawImage(imageSource, sx, sy, srcTileW, srcTileH, dx, dy, width, height);
//       ctx.strokeRect(dx, dy, width, height);
      
//       ctx.restore();
//   };

//   // 1. Draw grid (skipping the dragged tile)
//   tiles.forEach((tile, currentIndex) => {
//       // Calculate grid position
//       const drawCol = currentIndex % cols;
//       const drawRow = Math.floor(currentIndex / cols);
//       const dx = drawCol * destTileW;
//       const dy = drawRow * destTileH;

//       if (dragInfo && dragInfo.index === currentIndex) {
//           // Draw "hole" or dimmed version
//           ctx.fillStyle = '#222';
//           ctx.fillRect(dx, dy, destTileW, destTileH);
//           ctx.strokeStyle = '#333';
//           ctx.strokeRect(dx, dy, destTileW, destTileH);
          
//           // Draw the target highlight if we are hovering over a valid drop zone
//           if (hoverIndex !== null && hoverIndex !== currentIndex) {
//              // This logic is handled below broadly, but we can do specific slot highlighting here
//           }
//       } else {
//           // Normal tile
//           // Check if this is a potential drop target
//           if (dragInfo && hoverIndex === currentIndex) {
//               // Highlight the tile we might swap with
//               ctx.save();
//               ctx.globalAlpha = 0.5;
//               drawTile(tile, dx, dy, destTileW, destTileH);
//               ctx.fillStyle = 'rgba(204, 255, 0, 0.2)'; // Green Tint
//               ctx.fillRect(dx, dy, destTileW, destTileH);
//               ctx.strokeStyle = '#ccff00'; // Green Stroke
//               ctx.lineWidth = 2;
//               ctx.strokeRect(dx, dy, destTileW, destTileH);
//               ctx.restore();
//           } else {
//               drawTile(tile, dx, dy, destTileW, destTileH);
//           }
//       }
//   });

//   // 2. Draw dragged tile on top
//   if (dragInfo) {
//       const tile = tiles[dragInfo.index];
//       // Draw centered on cursor
//       const dragW = destTileW * 1.1; // Slightly larger
//       const dragH = destTileH * 1.1;
//       const dx = dragInfo.x - (dragW / 2);
//       const dy = dragInfo.y - (dragH / 2);
      
//       drawTile(tile, dx, dy, dragW, dragH, true);
//   }
// }


// src/utils/processing.ts 안의 renderPuzzleGame 함수를 이것으로 교체하세요.

export function renderPuzzleGame(
    ctx: CanvasRenderingContext2D, 
    imageSource: ImageBitmap | HTMLCanvasElement, 
    tiles: any[], 
    cols: number, 
    rows: number, 
    destWidth: number, 
    destHeight: number,
    dragInfo: { index: number, x: number, y: number } | null, 
    hoverIndex: number | null 
  ) {
    const destTileW = destWidth / cols;
    const destTileH = destHeight / rows;
    const srcTileW = imageSource.width / cols;
    const srcTileH = imageSource.height / rows;
  
    // --- 물리 엔진 파라미터 ---
    const SPRING_K = 0.15; // 탄성 (높을수록 뻣뻣하고 빨리 붙음)
    const DAMPING = 0.70;  // 감쇠 (낮을수록 더 많이 출렁거림)
  
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, destWidth, destHeight);
  
    const drawTile = (tile: any, dx: number, dy: number, width: number, height: number, isDragging: boolean = false) => {
        const sx = tile.origX * srcTileW;
        const sy = tile.origY * srcTileH;
        ctx.save();
        if (isDragging) {
            ctx.shadowColor = 'rgba(0,0,0,0.6)';
            ctx.shadowBlur = 20;
            ctx.shadowOffsetY = 15;
            ctx.globalAlpha = 1.0;
            ctx.strokeStyle = '#ccff00';
            ctx.lineWidth = 3;
        } else {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
        }
        ctx.drawImage(imageSource, sx, sy, srcTileW, srcTileH, dx, dy, width, height);
        ctx.strokeRect(dx, dy, width, height);
        ctx.restore();
    };
  
    // 1. 그리드 및 물리 애니메이션 그리기
    tiles.forEach((tile, currentIndex) => {
        // 이 타일이 최종적으로 가야 할 목표 위치
        const targetX = (currentIndex % cols) * destTileW;
        const targetY = Math.floor(currentIndex / cols) * destTileH;
  
        // 초기 렌더링 시 물리 속성 부여
        if (typeof tile.animX === 'undefined') {
            tile.animX = targetX;
            tile.animY = targetY;
            tile.vX = 0;
            tile.vY = 0;
        }
  
        if (dragInfo && dragInfo.index === currentIndex) {
            // [드래그 중인 타일]
            // 물리 엔진의 현재 위치를 마우스 위치로 강제 고정시킵니다.
            // 놓는 순간 이 위치부터 스프링처럼 튕겨갑니다!
            tile.animX = dragInfo.x - (destTileW / 2);
            tile.animY = dragInfo.y - (destTileH / 2);
            
            // 원래 자리에 빈 공간(Hole) 표시
            ctx.fillStyle = '#222';
            ctx.fillRect(targetX, targetY, destTileW, destTileH);
            ctx.strokeStyle = '#333';
            ctx.strokeRect(targetX, targetY, destTileW, destTileH);
        } else {
            // [내려놓아진 타일]
            // 목표 위치(target)를 향해 후크의 법칙(스프링) 적용
            const ax = (targetX - tile.animX) * SPRING_K;
            const ay = (targetY - tile.animY) * SPRING_K;
            tile.vX = (tile.vX + ax) * DAMPING;
            tile.vY = (tile.vY + ay) * DAMPING;
            tile.animX += tile.vX;
            tile.animY += tile.vY;
  
            // 호버 타겟 하이라이트 효과
            if (dragInfo && hoverIndex === currentIndex) {
                ctx.save();
                ctx.globalAlpha = 0.5;
                drawTile(tile, tile.animX, tile.animY, destTileW, destTileH);
                ctx.fillStyle = 'rgba(204, 255, 0, 0.3)';
                ctx.fillRect(tile.animX, tile.animY, destTileW, destTileH);
                ctx.strokeStyle = '#ccff00'; 
                ctx.lineWidth = 2;
                ctx.strokeRect(tile.animX, tile.animY, destTileW, destTileH);
                ctx.restore();
            } else {
                // 부드럽게 계산된 animX, animY 좌표에 타일을 그립니다.
                drawTile(tile, tile.animX, tile.animY, destTileW, destTileH);
            }
        }
    });
  
    // 2. 드래그 중인 타일을 가장 맨 위(Top)에 그리기
    if (dragInfo) {
        const tile = tiles[dragInfo.index];
        const dragW = destTileW * 1.05; // 드래그 시 살짝 커지는 효과
        const dragH = destTileH * 1.05;
        const dx = dragInfo.x - (dragW / 2);
        const dy = dragInfo.y - (dragH / 2);
        drawTile(tile, dx, dy, dragW, dragH, true);
    }
  }