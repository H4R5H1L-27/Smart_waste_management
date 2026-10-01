"""Optional live check: five held-out photos against POST /classify.

Skipped automatically if TensorFlow is not installed or sample files are missing.
Run the API (or TestClient) from the backend folder after `pip install -r requirements.txt`.
"""

from pathlib import Path

import pytest

SAMPLES = Path(__file__).resolve().parents[2] / "ml" / "samples"

EXPECTED = {
    "plastic.jpg": "plastic",
    "paper.jpg": "paper",
    "glass.jpg": "glass",
    "organic.jpg": "organic",
    "metal.jpg": "metal",
}


@pytest.mark.integration
def test_five_sample_images_are_sane():
    pytest.importorskip("tensorflow")
    missing = [name for name in EXPECTED if not (SAMPLES / name).exists()]
    if missing:
        pytest.skip(f"sample images missing: {missing}")

    from models.classifier import classify

    for name, category in EXPECTED.items():
        pred = classify((SAMPLES / name).read_bytes())
        assert pred["category"] == category, f"{name} -> {pred}"
        assert 0.0 <= float(pred["confidence"]) <= 1.0
