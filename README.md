# 🧩 Live Puzzle: AI-Powered Interactive Gesture Game

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)
![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)

An innovative, end-to-end interactive puzzle game built with real-time AI hand-tracking technology. Frame the real world with your hands, snap a picture, and solve the puzzle by pinching and dragging in thin air!

[🇰🇷 한국어 설명은 아래에 있습니다. (Korean description below)](#-한국어-설명-korean)

---

## 🚀 Key Features
* **Real-time AI Hand Tracking:** High-precision bimanual landmark detection utilizing Google MediaPipe Vision Tasks (Pinch & Drag gesture recognition).
* **Dynamic Survival Mode:** A time-attack system where the grid expands (2x2 → 3x3 → 4x4...) and time is added incrementally upon clearing each level.
* **Physics & Sound Engine:** Implemented Hooke's Law (Spring Physics) for a satisfying, elastic UI snap effect, coupled with Web Audio API for immersive auditory feedback.
* **Auto-Recording for Viral Content:** Seamless background canvas recording via MediaRecorder API, instantly exporting gameplay into 9:16 vertical `.webm` files optimized for YouTube Shorts and Instagram Reels.
* **Global Leaderboard System:** Real-time ranking architecture powered by a Supabase (PostgreSQL) backend.

## 🛠 Tech Stack
* **Frontend:** React, TypeScript, Tailwind CSS, HTML5 Canvas API, MediaPipe
* **Backend:** Python, FastAPI, Uvicorn
* **Database:** Supabase (PostgreSQL)

## 💡 How to Play
1. Make a rectangular frame with both hands facing the camera.
2. **Pinch** with your index fingers and thumbs to capture the screen.
3. **Pinch & Drag** the puzzle pieces to swap their positions.
4. Clear the puzzle fast to survive and reach the highest level possible!
5. To reset the board, hold a **Fist** for 1.5 seconds.

## 🤝 Acknowledgments
* Original concept inspired by [@byisabellek](https://www.instagram.com/byisabellek) (Google Creative Lab). 
* Developed and architected with expanded survival mechanics, custom physics engine, and full-stack DB integration.

---

<br>

# 🇰🇷 한국어 설명 (Korean)

웹캠과 AI 핸드 트래킹 기술을 활용해, 허공에서 손가락을 꼬집고 드래그하며 즐기는 신개념 풀스택 인터랙티브 퍼즐 게임입니다.

## 🚀 핵심 기능
* **AI 핸드 트래킹:** Google MediaPipe를 활용한 실시간, 고정밀 양손 랜드마크 추적 (Pinch & Drag 제스처 완벽 인식).
* **다이나믹 서바이벌 모드:** 2x2에서 시작해 클리어 시 점차 3x3, 4x4로 격자가 확장되며 보너스 시간이 추가되는 타임어택 시스템.
* **물리 엔진 & 사운드 피드백:** 단순한 슬라이딩을 넘어, 조각이 고무줄처럼 쫀득하게 빨려 들어가는 후크의 법칙 물리 애니메이션과 Web Audio API 기반의 효과음 구현.
* **쇼츠/릴스용 자동 녹화:** 플레이어의 캔버스 화면을 백그라운드에서 실시간 녹화하여 클리어 시 세로형 비디오 포맷으로 즉시 추출 및 다운로드 지원.
* **글로벌 리더보드:** Supabase (PostgreSQL) 연동을 통한 실시간 글로벌 랭킹 아키텍처 구축.

## 🛠 기술 스택
* **프론트엔드:** React, TypeScript, Tailwind CSS, HTML5 Canvas API, MediaPipe
* **백엔드:** Python, FastAPI, Uvicorn
* **데이터베이스:** Supabase (PostgreSQL)

## 💡 플레이 방법
1. 카메라를 향해 양손으로 네모난 프레임을 만듭니다.
2. 양손의 검지와 엄지를 꼬집어 찰칵! 캡처합니다.
3. 꼬집기로 퍼즐을 집어 들고, 빈 공간에 드래그 앤 드롭으로 퍼즐을 맞춥니다.
4. 제한 시간 내에 최대한 높은 레벨에 도달해 리더보드에 이름을 남기세요!
5. 화면 리셋이 필요하다면 주먹을 1.5초간 꽉 쥐고 있으면 됩니다.