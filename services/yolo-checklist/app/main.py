from __future__ import annotations

import os
import tempfile
from pathlib import Path
from typing import Any, Literal

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException, status
from pydantic import BaseModel, Field, HttpUrl

try:
    from ultralytics import YOLO
except ImportError:  # pragma: no cover - only happens when deps are not installed
    YOLO = None  # type: ignore[assignment]


SERVICE_NAME = "frotas-yolo-checklist"
DEFAULT_MODEL = "yolov8n.pt"
DEFAULT_CONFIDENCE = 0.35
MAX_IMAGE_BYTES = 12 * 1024 * 1024

app = FastAPI(title=SERVICE_NAME, version="0.1.0")
_model: Any | None = None


class ChecklistVisionRequest(BaseModel):
    inspection_id: str
    checklist_id: int
    item_codigo: str | None = None
    source_type: Literal["hodometro", "item", "abastecimento"]
    image_url: HttpUrl


class BoundingBox(BaseModel):
    x: float
    y: float
    width: float
    height: float


class Detection(BaseModel):
    class_name: str
    confidence: float = Field(ge=0, le=1)
    box: BoundingBox


class ChecklistVisionResponse(BaseModel):
    model_name: str
    confidence: float | None
    summary: str
    detections: list[Detection]


def require_token(authorization: str | None = Header(default=None)) -> None:
    token = os.getenv("YOLO_SERVICE_TOKEN", "").strip()
    if not token:
        return

    expected = f"Bearer {token}"
    if authorization != expected:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")


def get_model() -> Any:
    global _model
    if _model is not None:
        return _model
    if YOLO is None:
        raise RuntimeError("ultralytics is not installed")

    model_path = os.getenv("YOLO_MODEL_PATH", DEFAULT_MODEL).strip() or DEFAULT_MODEL
    _model = YOLO(model_path)
    return _model


async def download_image(url: str) -> Path:
    timeout = httpx.Timeout(connect=5, read=30, write=5, pool=5)
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
        response = await client.get(url)

    if response.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Could not download image: HTTP {response.status_code}",
        )

    content_type = response.headers.get("content-type", "")
    if content_type and not content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"URL did not return an image: {content_type}",
        )

    image_bytes = response.content
    if not image_bytes:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Image is empty")
    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Image is too large")

    suffix = extension_from_content_type(content_type)
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    try:
        tmp.write(image_bytes)
        tmp.flush()
    finally:
        tmp.close()
    return Path(tmp.name)


def extension_from_content_type(content_type: str) -> str:
    if "png" in content_type:
        return ".png"
    if "webp" in content_type:
        return ".webp"
    if "heic" in content_type or "heif" in content_type:
        return ".heic"
    return ".jpg"


def run_yolo(image_path: Path) -> tuple[str, list[Detection]]:
    model = get_model()
    confidence = float(os.getenv("YOLO_CONFIDENCE", str(DEFAULT_CONFIDENCE)))
    results = model.predict(source=str(image_path), conf=confidence, verbose=False)
    if not results:
        return model_name(), []

    result = results[0]
    names = getattr(result, "names", {}) or {}
    detections: list[Detection] = []

    for box in getattr(result, "boxes", []) or []:
        cls_index = int(box.cls[0].item())
        class_name = str(names.get(cls_index, cls_index))
        confidence_value = float(box.conf[0].item())
        x1, y1, x2, y2 = [float(value) for value in box.xyxy[0].tolist()]
        detections.append(
            Detection(
                class_name=class_name,
                confidence=confidence_value,
                box=BoundingBox(x=x1, y=y1, width=max(0.0, x2 - x1), height=max(0.0, y2 - y1)),
            )
        )

    return model_name(), detections


def model_name() -> str:
    return os.getenv("YOLO_MODEL_NAME", os.getenv("YOLO_MODEL_PATH", DEFAULT_MODEL)).strip() or DEFAULT_MODEL


def summarize(source_type: str, detections: list[Detection]) -> str:
    if not detections:
        return f"Nenhuma classe detectada para {source_type}."

    counts: dict[str, int] = {}
    for detection in detections:
        counts[detection.class_name] = counts.get(detection.class_name, 0) + 1

    parts = [f"{name}: {count}" for name, count in sorted(counts.items())]
    return f"Deteccoes em {source_type}: " + ", ".join(parts)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": SERVICE_NAME}


@app.post("/inspect", response_model=ChecklistVisionResponse, dependencies=[Depends(require_token)])
async def inspect(payload: ChecklistVisionRequest) -> ChecklistVisionResponse:
    image_path = await download_image(str(payload.image_url))
    try:
        model, detections = run_yolo(image_path)
    finally:
        image_path.unlink(missing_ok=True)

    confidence = max((detection.confidence for detection in detections), default=None)
    return ChecklistVisionResponse(
        model_name=model,
        confidence=confidence,
        summary=summarize(payload.source_type, detections),
        detections=detections,
    )
