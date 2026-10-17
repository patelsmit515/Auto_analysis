
"""FastAPI application for Auto_analysis."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.config import PROJECT_NAME

app = FastAPI(
    title=PROJECT_NAME,
    description="A data cleaning and SQL analysis application.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def home():
    return {
        "project": PROJECT_NAME,
        "status": "running",
    }


@app.get("/api/health")
def health_check():
    return {"status": "healthy"}


@app.get("/api/datasets")
def get_datasets():
    return {
        "datasets": [],
        "total": 0,
    }
