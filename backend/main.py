import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
from supabase import Client, create_client

app = FastAPI()

DEFAULT_ALLOWED_ORIGINS = [
    "https://live-puzzle-beige.vercel.app",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]


def get_allowed_origins() -> list[str]:
    raw_origins = os.getenv("ALLOWED_ORIGINS")
    if not raw_origins:
        return DEFAULT_ALLOWED_ORIGINS

    origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]
    return origins or DEFAULT_ALLOWED_ORIGINS


def require_env(name: str, fallback: str | None = None) -> str:
    value = os.getenv(name)
    if value:
        return value

    if fallback:
        fallback_value = os.getenv(fallback)
        if fallback_value:
            return fallback_value

    raise RuntimeError(f"Missing required environment variable: {name}")


app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

# Backend-only Supabase credentials. Prefer SUPABASE_SERVICE_ROLE_KEY in production.
SUPABASE_URL = require_env("SUPABASE_URL")
SUPABASE_KEY = require_env("SUPABASE_SERVICE_ROLE_KEY", fallback="SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


class Score(BaseModel):
    name: str = Field(min_length=1, max_length=10)
    level: int = Field(ge=1, le=999)

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        cleaned = value.strip().upper()
        if not cleaned:
            raise ValueError("Name cannot be empty.")
        return cleaned


@app.post("/api/score")
async def submit_score(score: Score):
    try:
        supabase.table("leaderboard").insert(
            {"name": score.name, "level": score.level}
        ).execute()
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Could not save score.") from exc

    return {"message": "Score saved successfully!"}


@app.get("/api/leaderboard")
async def get_leaderboard():
    try:
        response = (
            supabase.table("leaderboard")
            .select("name, level")
            .order("level", desc=True)
            .limit(50)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Could not load leaderboard.") from exc

    return response.data
