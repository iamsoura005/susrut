"""
RadiAI Backend — FastAPI main application
"""
import os
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routes import router
from app.models import brain_mri, chest_ct, head_ct, ecg, bone_xray
from app.services import modality_classifier

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("radiai")

OUTPUTS_DIR = Path(__file__).parent.parent / "outputs"
OUTPUTS_DIR.mkdir(exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load all models at startup."""
    logger.info("🚀 RadiAI starting up — loading models...")
    modality_classifier.load()   # ML modality router (EfficientNetB0)
    brain_mri.load()
    chest_ct.load()
    head_ct.load()
    ecg.load()
    bone_xray.load()
    logger.info("✅ All models loaded. RadiAI ready.")
    yield
    logger.info("🛑 RadiAI shutting down.")


app = FastAPI(
    title="RadiAI API",
    description="Multi-modal radiology intelligence platform",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
origins = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static outputs (PDFs, heatmaps)
app.mount("/outputs", StaticFiles(directory=str(OUTPUTS_DIR)), name="outputs")

# Register routes
app.include_router(router, prefix="/api")


@app.get("/")
def root():
    return {"message": "RadiAI API is running", "docs": "/docs"}
