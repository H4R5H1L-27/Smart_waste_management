"""Download five Wikimedia photos for the classifier demo."""

from __future__ import annotations

from io import BytesIO
from pathlib import Path
from urllib.parse import quote
from urllib.request import Request, urlopen

from PIL import Image

OUT = Path(__file__).resolve().parent / "samples"
OUT.mkdir(parents=True, exist_ok=True)

# Commons FilePath + real titles (spaces quoted). Avoid /thumb/ URLs.
FILES = {
    "plastic.jpg": "PET bottle.jpg",
    "paper.jpg": "Roll of Paper Towels.jpg",
    "glass.jpg": "Glass of Red Wine with a bottle of Red Wine - Evan Swigart.jpg",
    "organic.jpg": "Cavendish Banana DS.jpg",
    "metal.jpg": "Hahn 29cm Frying Pan.jpg",
}


def grab(title: str) -> bytes:
    url = "https://commons.wikimedia.org/wiki/Special:FilePath/" + quote(title)
    req = Request(url, headers={"User-Agent": "smart-waste-management-academic-demo/1.0"})
    with urlopen(req, timeout=60) as resp:
        data = resp.read()
        if len(data) < 800:
            raise RuntimeError(f"too small: {title}")
        return data


def shrink(data: bytes) -> bytes:
    image = Image.open(BytesIO(data)).convert("RGB")
    image.thumbnail((512, 512))
    buf = BytesIO()
    image.save(buf, format="JPEG", quality=85)
    return buf.getvalue()


def main() -> None:
    for name, title in FILES.items():
        dest = OUT / name
        dest.write_bytes(shrink(grab(title)))
        print("ok", name, dest.stat().st_size)


if __name__ == "__main__":
    main()
