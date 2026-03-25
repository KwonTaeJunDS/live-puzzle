from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 🌟 여기에 Supabase에서 복사한 URL과 KEY를 따옴표 안에 넣어주세요!
SUPABASE_URL = "https://ftfckudokhcwvdmezcxp.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ0ZmNrdWRva2hjd3ZkbWV6Y3hwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzODAwNDksImV4cCI6MjA4OTk1NjA0OX0.sWSCYvnTGUpMqOUKj3-biMDKmtBtP1xbuRtMa_9skbM"

# Supabase 클라이언트 연결
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

class Score(BaseModel):
    name: str
    level: int  

@app.post("/api/score")
async def submit_score(score: Score):
    # 메모리 리스트가 아닌, 진짜 Supabase DB의 'leaderboard' 테이블에 데이터를 저장합니다!
    data, count = supabase.table("leaderboard").insert({"name": score.name, "level": score.level}).execute()
    return {"message": "Score saved successfully!"}

@app.get("/api/leaderboard")
async def get_leaderboard():
    # Supabase DB에서 레벨이 높은 순서(desc)로 상위 50명을 가져옵니다!
    response = supabase.table("leaderboard").select("*").order("level", desc=True).limit(50).execute()
    return response.data