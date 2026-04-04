from threading import Lock
from typing import Any, List

import cv2
import numpy as np

from app.core.config import settings

try:
    from insightface.app import FaceAnalysis  # type: ignore
except Exception:
    FaceAnalysis = None


# ---------------------------------------------------------------------------
# InsightFace model pool — we initialise with a large detection size for
# maximum recall and use the ArcFace recognition head inside buffalo_l.
# ---------------------------------------------------------------------------

_face_app: Any | None = None
_face_app_init_failed = False
_face_app_lock = Lock()


def _get_face_app() -> Any | None:
    global _face_app
    global _face_app_init_failed

    if settings.embedding_backend.strip().lower() == "opencv":
        return None

    if _face_app is not None:
        return _face_app
    if _face_app_init_failed:
        return None
    if FaceAnalysis is None:
        _face_app_init_failed = True
        return None

    with _face_app_lock:
        if _face_app is not None:
            return _face_app
        if _face_app_init_failed:
            return None

        try:
            app = FaceAnalysis(
                name="buffalo_l",
                providers=["CPUExecutionProvider"],
            )
            det_size = max(320, int(settings.insightface_det_size))
            app.prepare(ctx_id=0, det_size=(det_size, det_size))
            _face_app = app
            return _face_app
        except Exception:
            _face_app_init_failed = True
            return None


# ---------------------------------------------------------------------------
# Image preprocessing — multiple strategies to maximise face detection recall
# ---------------------------------------------------------------------------

def _preprocess_clahe(image: np.ndarray) -> np.ndarray:
    """CLAHE on the luminance channel to fix low-contrast / poorly-lit photos."""
    lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
    l_ch, a_ch, b_ch = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    l_ch = clahe.apply(l_ch)
    return cv2.cvtColor(cv2.merge([l_ch, a_ch, b_ch]), cv2.COLOR_LAB2BGR)


def _preprocess_sharpen(image: np.ndarray) -> np.ndarray:
    """Sharpen blurry images so facial features are more distinct."""
    kernel = np.array([
        [0, -1, 0],
        [-1, 5, -1],
        [0, -1, 0],
    ], dtype=np.float32)
    return cv2.filter2D(image, -1, kernel)


def _preprocess_denoise(image: np.ndarray) -> np.ndarray:
    """Bilateral filter: reduces noise while keeping edges sharp."""
    return cv2.bilateralFilter(image, d=9, sigmaColor=75, sigmaSpace=75)


def _generate_preprocessed_variants(image: np.ndarray) -> list[np.ndarray]:
    """Return a list of image variants to try for face detection.

    The order matters — we try the most likely to succeed first and stop
    as soon as we detect a face.
    """
    variants: list[np.ndarray] = [image]  # original first

    # CLAHE enhanced
    try:
        variants.append(_preprocess_clahe(image))
    except Exception:
        pass

    # Sharpened
    try:
        variants.append(_preprocess_sharpen(image))
    except Exception:
        pass

    # Denoised + CLAHE combo (helps noisy phone photos)
    try:
        denoised = _preprocess_denoise(image)
        variants.append(_preprocess_clahe(denoised))
    except Exception:
        pass

    return variants


# ---------------------------------------------------------------------------
# Face detection — fast first, fallback to enhanced only if needed
# ---------------------------------------------------------------------------

_FALLBACK_SCALES = [1.5, 0.75]


def _detect_best_face(face_app: Any, image: np.ndarray) -> Any | None:
    """Detect the best face with a fast-first strategy.

    1. Try the original image at 1x — this works for the vast majority of
       photos and is the cheapest call.
    2. Only if no face is found, try CLAHE-enhanced variant at 1x.
    3. Only if still nothing, try 2 extra scales (1.5x, 0.75x) on original.

    This reduces the worst case from 20 inference passes to 4, and the
    common case to just 1.
    """
    best_face = None
    best_area = 0

    def _pick_best(faces: list) -> None:
        nonlocal best_face, best_area
        for f in faces:
            area = int(f.bbox[2] - f.bbox[0]) * int(f.bbox[3] - f.bbox[1])
            if area > best_area:
                best_area = area
                best_face = f

    # --- Pass 1: original image at native resolution (fastest) ---
    try:
        faces = face_app.get(image)
        if faces:
            _pick_best(faces)
            return best_face
    except Exception:
        pass

    # --- Pass 2: CLAHE-enhanced at native resolution ---
    try:
        enhanced = _preprocess_clahe(image)
        faces = face_app.get(enhanced)
        if faces:
            _pick_best(faces)
            return best_face
    except Exception:
        pass

    # --- Pass 3: original image at alternate scales ---
    for scale in _FALLBACK_SCALES:
        h, w = image.shape[:2]
        resized = cv2.resize(
            image,
            (int(w * scale), int(h * scale)),
            interpolation=cv2.INTER_LINEAR if scale > 1.0 else cv2.INTER_AREA,
        )
        try:
            faces = face_app.get(resized)
            if faces:
                _pick_best(faces)
                return best_face
        except Exception:
            continue

    return best_face


# ---------------------------------------------------------------------------
# OpenCV Haar cascade fallback (for when InsightFace is not available)
# ---------------------------------------------------------------------------

def _extract_embedding_opencv(image_path: str) -> List[float]:
    image = cv2.imread(image_path)
    if image is None:
        raise ValueError("Could not read image file")

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    face_cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    face_cascade = cv2.CascadeClassifier(face_cascade_path)

    faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5)
    if len(faces) == 0:
        # Try with CLAHE enhancement
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        gray = clahe.apply(gray)
        faces = face_cascade.detectMultiScale(gray, scaleFactor=1.05, minNeighbors=3)
        if len(faces) == 0:
            raise ValueError("No face detected in the image")

    x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
    face_roi = gray[y : y + h, x : x + w]
    face_resized = cv2.resize(face_roi, (128, 128))
    face_normalized = face_resized.astype("float32") / 255.0
    embedding = face_normalized.flatten()

    return embedding.tolist()


# ---------------------------------------------------------------------------
# Main embedding extraction — the public API
# ---------------------------------------------------------------------------

def extract_embedding(image_path: str) -> List[float]:
    """Extract a normalised face embedding with maximum accuracy.

    Uses InsightFace ArcFace (buffalo_l) with:
    - Multiple image preprocessing variants (CLAHE, sharpen, denoise)
    - Multi-scale detection (0.5x – 2.0x)
    - Best-face selection across all attempts
    Falls back to OpenCV Haar + grayscale embedding when InsightFace is
    unavailable.
    """

    image = cv2.imread(image_path)
    if image is None:
        raise ValueError("Could not read image file")

    face_app = _get_face_app()
    if face_app is not None:
        best_face = _detect_best_face(face_app, image)
        if best_face is not None:
            embedding = np.array(best_face.embedding, dtype="float32")
            norm = np.linalg.norm(embedding)
            if norm > 0:
                embedding = embedding / norm
            return embedding.tolist()

    return _extract_embedding_opencv(image_path)


# ---------------------------------------------------------------------------
# Similarity computation
# ---------------------------------------------------------------------------

def cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
    a = np.array(vec1, dtype="float32")
    b = np.array(vec2, dtype="float32")

    if a.size == 0 or b.size == 0:
        return 0.0

    if a.shape != b.shape:
        # Different backend embeddings — truncate to shorter length with penalty.
        min_len = min(a.shape[0], b.shape[0])
        a = a[:min_len]
        b = b[:min_len]
        penalty = 0.85
    else:
        penalty = 1.0

    denom = np.linalg.norm(a) * np.linalg.norm(b)
    if denom == 0:
        return 0.0
    raw = float(np.dot(a, b) / denom)

    # Clamp to [0, 1] — negative cosine similarity means totally different.
    return max(0.0, raw * penalty)


# ---------------------------------------------------------------------------
# Metadata helpers
# ---------------------------------------------------------------------------

def _normalize_text(value: str | None) -> str:
    if not value:
        return ""
    return " ".join(value.strip().lower().split())


def _token_set(value: str | None) -> set[str]:
    normalized = _normalize_text(value)
    if not normalized:
        return set()
    return {token for token in normalized.replace(",", " ").split(" ") if token}


def _substring_overlap(a: str | None, b: str | None) -> float:
    """Return the best of Jaccard and containment similarity."""
    na = _normalize_text(a)
    nb = _normalize_text(b)
    if not na or not nb:
        return 0.0

    if na in nb or nb in na:
        return 1.0

    set_a = _token_set(a)
    set_b = _token_set(b)
    if not set_a or not set_b:
        return 0.0

    intersection = len(set_a & set_b)
    jaccard = intersection / len(set_a | set_b)
    containment = intersection / min(len(set_a), len(set_b))
    return max(jaccard, containment)


def _age_similarity(missing_age: int | None, found_age: int | None) -> float:
    if missing_age is None or found_age is None:
        return 0.0
    gap = abs(missing_age - found_age)
    if gap <= 1:
        return 1.0
    if gap <= 3:
        return 0.85
    if gap <= 5:
        return 0.65
    if gap <= 10:
        return 0.35
    return 0.0


def _gender_similarity(missing_gender: str | None, found_gender: str | None) -> float:
    a = _normalize_text(missing_gender)
    b = _normalize_text(found_gender)
    if not a or not b:
        return 0.0
    return 1.0 if a == b else 0.0


# ---------------------------------------------------------------------------
# Metadata composite score
# ---------------------------------------------------------------------------

def compute_metadata_similarity(missing_doc: dict, found_doc: dict) -> tuple[float, dict]:
    age_score = _age_similarity(missing_doc.get("age"), found_doc.get("estimated_age"))
    gender_score = _gender_similarity(missing_doc.get("gender"), found_doc.get("gender"))
    location_score = _substring_overlap(
        missing_doc.get("last_seen_location"),
        found_doc.get("found_location"),
    )
    birthmarks_score = _substring_overlap(
        missing_doc.get("birthmarks"),
        found_doc.get("birthmarks"),
    )
    info_score = _substring_overlap(
        missing_doc.get("additional_info"),
        found_doc.get("additional_info"),
    )

    components = {
        "age": age_score,
        "gender": gender_score,
        "location": location_score,
        "birthmarks": birthmarks_score,
        "info": info_score,
    }

    _has_data = {
        "age": (missing_doc.get("age") is not None and found_doc.get("estimated_age") is not None),
        "gender": (bool(_normalize_text(missing_doc.get("gender"))) and bool(_normalize_text(found_doc.get("gender")))),
        "location": (bool(_normalize_text(missing_doc.get("last_seen_location"))) and bool(_normalize_text(found_doc.get("found_location")))),
        "birthmarks": (bool(_normalize_text(missing_doc.get("birthmarks"))) and bool(_normalize_text(found_doc.get("birthmarks")))),
        "info": (bool(_normalize_text(missing_doc.get("additional_info"))) and bool(_normalize_text(found_doc.get("additional_info")))),
    }

    field_weights = {
        "gender": 2.0,
        "age": 1.5,
        "birthmarks": 1.5,
        "location": 1.0,
        "info": 0.5,
    }

    weighted_sum = 0.0
    total_weight = 0.0
    for field, has in _has_data.items():
        if has:
            w = field_weights[field]
            weighted_sum += w * components[field]
            total_weight += w

    score = (weighted_sum / total_weight) if total_weight > 0 else 0.0
    return float(score), components


# ---------------------------------------------------------------------------
# Hybrid match (face + metadata)
# ---------------------------------------------------------------------------

def compute_hybrid_match(missing_doc: dict, found_doc: dict) -> tuple[float, dict]:
    face_score = cosine_similarity(
        missing_doc.get("embedding", []),
        found_doc.get("embedding", []),
    )
    metadata_score, metadata_components = compute_metadata_similarity(missing_doc, found_doc)

    # Face is the primary signal; metadata confirms / boosts.
    total_score = (settings.face_weight * face_score) + (settings.metadata_weight * metadata_score)

    # Strong face boost: ArcFace is highly reliable above 0.70 cosine sim.
    # Different photos of the same person typically score 0.60–0.85 in raw
    # cosine, so we need to amplify the hybrid score to reflect the true
    # confidence.  The boost scales linearly from +0.05 at face=0.70 to
    # +0.15 at face=1.0.
    if face_score >= 0.70:
        face_boost = 0.05 + 0.10 * ((face_score - 0.70) / 0.30)
        # Extra nudge when metadata also agrees
        if metadata_score > 0.3:
            face_boost += 0.04 * min(metadata_score, 1.0)
        total_score = min(total_score + face_boost, 1.0)
    elif face_score >= 0.50 and metadata_score > 0:
        boost = 0.06 * min(metadata_score, 1.0)
        total_score = min(total_score + boost, 1.0)

    # Gender mismatch penalty: if both specified but different, penalise.
    gender_comp = metadata_components.get("gender", 0.0)
    both_have_gender = (
        bool(_normalize_text(missing_doc.get("gender")))
        and bool(_normalize_text(found_doc.get("gender")))
    )
    if both_have_gender and gender_comp == 0.0:
        total_score *= 0.6  # 40% penalty for gender mismatch

    details = {
        "face_score": face_score,
        "metadata_score": metadata_score,
        "metadata_components": metadata_components,
        "weights": {
            "face_weight": settings.face_weight,
            "metadata_weight": settings.metadata_weight,
        },
    }
    return float(max(0.0, total_score)), details
