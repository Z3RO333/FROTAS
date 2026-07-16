from __future__ import annotations

import asyncio
import ipaddress
import os
import re
import socket
import tempfile
from urllib.parse import urljoin, urlparse
from pathlib import Path
from typing import Any, Literal

import httpx
import cv2
import numpy as np
from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile, status
from pydantic import BaseModel, Field, HttpUrl

try:
    from ultralytics import YOLO
except ImportError:  # pragma: no cover - only happens when deps are not installed
    YOLO = None  # type: ignore[assignment]

try:
    import easyocr
except ImportError:  # pragma: no cover - only happens when deps are not installed
    easyocr = None  # type: ignore[assignment]


SERVICE_NAME = "frotas-yolo-checklist"
DEFAULT_MODEL = "yolov8n.pt"
DEFAULT_CONFIDENCE = 0.35
MAX_IMAGE_BYTES = 12 * 1024 * 1024

app = FastAPI(title=SERVICE_NAME, version="0.1.0")
_model: Any | None = None
_ocr_reader: Any | None = None


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


class OdometerReadingResponse(BaseModel):
    km_lido: int | None
    confianca: float = Field(ge=0, le=1)
    leitura_segura: bool
    precisa_digitacao_manual: bool
    motivo: str | None
    texto_visivel: str | None
    observacoes_imagem: str | None


def require_token(authorization: str | None = Header(default=None)) -> None:
    token = os.getenv("YOLO_SERVICE_TOKEN", "").strip()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="YOLO_SERVICE_TOKEN is not configured",
        )

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


def get_ocr_reader() -> Any:
    global _ocr_reader
    if _ocr_reader is not None:
        return _ocr_reader
    if easyocr is None:
        raise RuntimeError("easyocr is not installed")

    gpu = os.getenv("YOLO_OCR_GPU", "false").strip().lower() in {"1", "true", "yes"}
    _ocr_reader = easyocr.Reader(["en"], gpu=gpu, verbose=False)
    return _ocr_reader


async def download_image(url: str) -> Path:
    timeout = httpx.Timeout(connect=5, read=30, write=5, pool=5)
    current_url = url
    image_bytes = b""
    content_type = ""
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=False) as client:
        for _ in range(4):
            await ensure_public_http_url(current_url)
            async with client.stream("GET", current_url) as response:
                if response.status_code in {301, 302, 303, 307, 308}:
                    location = response.headers.get("location")
                    if not location:
                        raise HTTPException(status_code=422, detail="Redirect without location")
                    current_url = urljoin(current_url, location)
                    continue
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
                chunks: list[bytes] = []
                total = 0
                async for chunk in response.aiter_bytes():
                    total += len(chunk)
                    if total > MAX_IMAGE_BYTES:
                        raise HTTPException(status_code=413, detail="Image is too large")
                    chunks.append(chunk)
                image_bytes = b"".join(chunks)
                break
        else:
            raise HTTPException(status_code=422, detail="Too many redirects")

    if not image_bytes:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Image is empty")

    suffix = extension_from_content_type(content_type)
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    try:
        tmp.write(image_bytes)
        tmp.flush()
    finally:
        tmp.close()
    return Path(tmp.name)


async def ensure_public_http_url(value: str) -> None:
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname or parsed.username or parsed.password:
        raise HTTPException(status_code=422, detail="Only public HTTP(S) image URLs are allowed")
    try:
        addresses = await asyncio.to_thread(
            socket.getaddrinfo, parsed.hostname, parsed.port or (443 if parsed.scheme == "https" else 80)
        )
    except socket.gaierror as exc:
        raise HTTPException(status_code=422, detail="Image host could not be resolved") from exc
    for address in addresses:
        ip = ipaddress.ip_address(address[4][0])
        if not ip.is_global:
            raise HTTPException(status_code=422, detail="Private or reserved image hosts are not allowed")


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


def run_odometer_ocr(image_path: Path) -> OdometerReadingResponse:
    image = cv2.imread(str(image_path))
    if image is None:
      raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Could not read image")

    crops = odometer_crops(image_path, image)
    variants: list[np.ndarray] = []
    for crop in crops:
        variants.extend(preprocess_for_digits(crop))

    reader = get_ocr_reader()
    candidates: list[tuple[int, float, str]] = []
    visible_parts: list[str] = []

    for variant in variants[:8]:
        results = reader.readtext(variant, detail=1, paragraph=False, allowlist="0123456789., ")
        for (_box, text, confidence) in results:
            clean_text = str(text).strip()
            if clean_text:
                visible_parts.append(clean_text)
            for value in extract_number_candidates(clean_text):
                candidates.append((value, float(confidence), clean_text))

    if not candidates:
        return OdometerReadingResponse(
            km_lido=None,
            confianca=0,
            leitura_segura=False,
            precisa_digitacao_manual=True,
            motivo="YOLO/OCR nao encontrou numeros de hodometro legiveis.",
            texto_visivel=" ".join(visible_parts)[:500] or None,
            observacoes_imagem="Tente foto mais proxima, sem reflexo e com o painel centralizado.",
        )

    value, confidence, text = sorted(candidates, key=lambda item: (item[1], len(str(item[0]))), reverse=True)[0]
    safe = confidence >= 0.55 and value >= 100
    return OdometerReadingResponse(
        km_lido=value,
        confianca=max(0.0, min(1.0, confidence)),
        leitura_segura=safe,
        precisa_digitacao_manual=not safe,
        motivo=None if safe else "OCR encontrou numero, mas a confianca esta baixa. Confirme digitando manualmente.",
        texto_visivel=text,
        observacoes_imagem="Leitura local via YOLO/OCR.",
    )


def odometer_crops(image_path: Path, image: np.ndarray) -> list[np.ndarray]:
    crops: list[np.ndarray] = []
    h, w = image.shape[:2]

    # If a custom model has odometer/dashboard/display classes, use it to crop the panel first.
    try:
        _model_name, detections = run_yolo(image_path)
        target_names = ("odometer", "hodometro", "dashboard", "display", "speedometer", "painel", "meter")
        for detection in detections:
            if not any(name in detection.class_name.lower() for name in target_names):
                continue
            x1 = max(0, int(detection.box.x))
            y1 = max(0, int(detection.box.y))
            x2 = min(w, int(detection.box.x + detection.box.width))
            y2 = min(h, int(detection.box.y + detection.box.height))
            if x2 > x1 and y2 > y1:
                crops.append(image[y1:y2, x1:x2])
    except Exception:
        pass

    if crops:
        return crops

    # Generic fallback for phones pointed at a dashboard: full image and central zones.
    return [
        image,
        image[int(h * 0.15): int(h * 0.85), int(w * 0.05): int(w * 0.95)],
        image[int(h * 0.25): int(h * 0.75), int(w * 0.15): int(w * 0.85)],
    ]


def preprocess_for_digits(image: np.ndarray) -> list[np.ndarray]:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    scale = max(1.0, 1000 / max(gray.shape[:2]))
    resized = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
    denoised = cv2.bilateralFilter(resized, 7, 50, 50)
    equalized = cv2.equalizeHist(denoised)
    thresh = cv2.adaptiveThreshold(
        equalized,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        31,
        7,
    )
    inverted = cv2.bitwise_not(thresh)
    return [resized, equalized, thresh, inverted]


def extract_number_candidates(text: str) -> list[int]:
    candidates: list[int] = []
    for match in re.finditer(r"[0-9][0-9., ]{2,}[0-9]", text):
        digits = re.sub(r"\D", "", match.group(0))
        if 3 <= len(digits) <= 8:
            value = int(digits)
            if 0 <= value <= 2_000_000:
                candidates.append(value)
    return candidates


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
        model, detections = await asyncio.to_thread(run_yolo, image_path)
    finally:
        image_path.unlink(missing_ok=True)

    confidence = max((detection.confidence for detection in detections), default=None)
    return ChecklistVisionResponse(
        model_name=model,
        confidence=confidence,
        summary=summarize(payload.source_type, detections),
        detections=detections,
    )


@app.post("/odometer", response_model=OdometerReadingResponse, dependencies=[Depends(require_token)])
async def odometer(foto_km: UploadFile = File(...)) -> OdometerReadingResponse:
    content_type = foto_km.content_type or ""
    if content_type and not content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"File is not an image: {content_type}",
        )

    data = await foto_km.read()
    if not data:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Image is empty")
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Image is too large")

    suffix = extension_from_content_type(content_type)
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    try:
        tmp.write(data)
        tmp.flush()
    finally:
        tmp.close()

    image_path = Path(tmp.name)
    try:
        return await asyncio.to_thread(run_odometer_ocr, image_path)
    finally:
        image_path.unlink(missing_ok=True)
