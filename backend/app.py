
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.config import (
    PROJECT_NAME,
    PROJECT_VERSION,
    PROJECT_DESCRIPTION,
    API_PREFIX,
)

app = FastAPI(
    title=PROJECT_NAME,
    description=PROJECT_DESCRIPTION,
    version=PROJECT_VERSION,
)

# Development configuration for the future Antigravity frontend.
# We will restrict allowed origins when the frontend URL is finalized.
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
        "version": PROJECT_VERSION,
        "status": "running",
    }


@app.get(f"{API_PREFIX}/health")
def health_check():
    return {
        "status": "healthy",
        "message": "Backend is working correctly.",
    }


@app.get(f"{API_PREFIX}/datasets")
def get_datasets():
    return {
        "datasets": [],
        "total": 0,
        "message": "No datasets have been uploaded yet.",
    }
