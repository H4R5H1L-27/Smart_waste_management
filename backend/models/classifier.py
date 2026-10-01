"""Waste image classifier.

Prefers a locally fine-tuned Keras model (`ml/saved_model/waste_classifier.keras`)
produced by `ml/train_classifier.ipynb`. If that file is missing — the usual
state before a student has trained — falls back to ImageNet-pretrained
MobileNetV2 with an explicit waste-category mapping. That is still transfer
learning on a pretrained backbone (spec §3 / §5.1), and it is demoable without
a GPU training run.
"""

from __future__ import annotations

import json
import os
from functools import lru_cache
from io import BytesIO
from pathlib import Path

import numpy as np
from PIL import Image

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")

ROOT = Path(__file__).resolve().parents[2]
SAVED_MODEL = ROOT / "ml" / "saved_model" / "waste_classifier.keras"
LABELS_PATH = ROOT / "ml" / "saved_model" / "labels.json"

# TrashNet-style labels used by the training notebook.
FINETUNED_CLASSES = ["cardboard", "glass", "metal", "organic", "paper", "plastic", "trash"]

# ImageNet decode_predictions names (or fragments) → waste category.
# Top-5 predictions are scored and the best matching bucket wins.
IMAGENET_TO_WASTE: dict[str, str] = {
    "water bottle": "plastic",
    "pop bottle": "plastic",
    "soda bottle": "plastic",
    "pill bottle": "plastic",
    "water jug": "plastic",
    "plastic bag": "plastic",
    "shower cap": "plastic",
    "ping-pong ball": "plastic",
    "balloon": "plastic",
    "nipple": "plastic",
    "wine bottle": "glass",
    "beer bottle": "glass",
    "beer glass": "glass",
    "goblet": "glass",
    "perfume": "glass",
    "vase": "glass",
    "red wine": "glass",
    "lotion": "plastic",
    "hair spray": "plastic",
    "soap dispenser": "plastic",
    "envelope": "paper",
    "book jacket": "paper",
    "dust jacket": "paper",
    "notebook": "paper",
    "comic book": "paper",
    "menu": "paper",
    "packet": "paper",
    "binder": "paper",
    "paper towel": "paper",
    "toilet tissue": "paper",
    "carton": "cardboard",
    "crate": "cardboard",
    "chest": "cardboard",
    "cardboard": "cardboard",
    "can opener": "metal",
    "corkscrew": "metal",
    "frying pan": "metal",
    "wok": "metal",
    "ladle": "metal",
    "spatula": "metal",
    "bucket": "metal",
    "pail": "metal",
    "ashcan": "metal",
    "trash can": "metal",
    "hook": "metal",
    "nail": "metal",
    "screw": "metal",
    "padlock": "metal",
    "banana": "organic",
    "orange": "organic",
    "lemon": "organic",
    "fig": "organic",
    "pineapple": "organic",
    "strawberry": "organic",
    "granny smith": "organic",
    "pomegranate": "organic",
    "head cabbage": "organic",
    "broccoli": "organic",
    "cauliflower": "organic",
    "cucumber": "organic",
    "zucchini": "organic",
    "butternut squash": "organic",
    "acorn squash": "organic",
    "mushroom": "organic",
    "ear": "organic",
    "corn": "organic",
    "pizza": "organic",
    "bagel": "organic",
    "pretzel": "organic",
    "hotdog": "organic",
    "cheeseburger": "organic",
    "meat loaf": "organic",
    "guacamole": "organic",
    "mashed potato": "organic",
    "french loaf": "organic",
    "custard apple": "organic",
}


def supported_categories() -> list[str]:
    return ["cardboard", "glass", "metal", "organic", "paper", "plastic", "trash"]


def _load_image(image_bytes: bytes) -> Image.Image:
    try:
        image = Image.open(BytesIO(image_bytes))
        image.load()
        return image.convert("RGB")
    except Exception as e:
        raise ValueError(f"Invalid image format: {e}") from e


@lru_cache(maxsize=1)
def _finetuned():
    import tensorflow as tf

    if not SAVED_MODEL.exists():
        return None
    model = tf.keras.models.load_model(SAVED_MODEL)
    if LABELS_PATH.exists():
        labels = json.loads(LABELS_PATH.read_text(encoding="utf-8"))
    else:
        labels = FINETUNED_CLASSES
    return model, labels


@lru_cache(maxsize=1)
def _imagenet_backbone():
    from tensorflow.keras.applications.mobilenet_v2 import MobileNetV2

    return MobileNetV2(weights="imagenet", include_top=True)


def _map_imagenet(preds) -> tuple[str, float]:
    from tensorflow.keras.applications.mobilenet_v2 import decode_predictions

    decoded = decode_predictions(preds, top=5)[0]
    scores: dict[str, float] = {}
    for _id, name, conf in decoded:
        label = name.replace("_", " ").lower()
        category = None
        for fragment, mapped in IMAGENET_TO_WASTE.items():
            if fragment in label:
                category = mapped
                break
        if category:
            scores[category] = scores.get(category, 0.0) + float(conf)
    if not scores:
        return "trash", float(decoded[0][2])
    category = max(scores, key=scores.get)
    return category, float(scores[category])


def classify(image_bytes: bytes) -> dict[str, float | str]:
    """Run inference. Returns {"category": str, "confidence": float}."""
    image = _load_image(image_bytes).resize((224, 224))
    arr = np.asarray(image, dtype="float32")
    batch = np.expand_dims(arr, axis=0)

    loaded = _finetuned()
    if loaded is not None:
        import tensorflow as tf

        model, labels = loaded
        x = tf.keras.applications.mobilenet_v2.preprocess_input(batch.copy())
        probs = model.predict(x, verbose=0)[0]
        idx = int(np.argmax(probs))
        return {"category": labels[idx], "confidence": float(probs[idx])}

    from tensorflow.keras.applications.mobilenet_v2 import preprocess_input

    model = _imagenet_backbone()
    x = preprocess_input(batch.copy())
    preds = model.predict(x, verbose=0)
    category, confidence = _map_imagenet(preds)
    return {"category": category, "confidence": round(confidence, 4)}
