"""Generate and optimize the "Cuaderno" demo illustrations.

Reproduces every image in `assets/img/`. Run from the repository root:

    python3 design/ui-refresh-demo/generate-illustrations.py            # all
    python3 design/ui-refresh-demo/generate-illustrations.py spot-quiz  # one

Existing files are skipped, so regenerating a single asset means deleting it
first. The OpenRouter key resolves the same way the scene generators do — see
`.agents/skills/generate-scene-assets` — from the gitignored
`design/scene-scripts/.assts-gen-key`.

Optimization is part of the recipe, not an afterthought: the model returns
~900 KB PNGs and flat vector art quantizes to a palette with no visible loss,
which is the difference between a 8 MB page and a 250 KB one.
"""

import base64
import json
import subprocess
import sys
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
OUT = REPO / "design" / "ui-refresh-demo" / "assets" / "img"
KEY_FILE = REPO / "design" / "scene-scripts" / ".assts-gen-key"
MODEL = "google/gemini-3.1-flash-image"

# The fixed half of every prompt. Nine images generated on different days look
# like one set because only the subject line above this block ever changes.
STYLE = (
    "Style: clean flat 2D vector cartoon illustration in a friendly modern "
    "English-workbook style. Rounded approachable shapes, crisp clean outlines, "
    "flat color fills with light minimal shading, no gradients, no texture, no "
    "photorealism, no 3D. "
    "Palette strictly limited to: warm paper cream #FBF8F4 background, deep navy "
    "#00496A, terracotta #B8541F, teal #0F766E, indigo #4F46E5, muted sand "
    "#E6E0D7, off-white #FFFFFF. "
    "Warm, calm, optimistic, classroom-safe, inclusive. "
    "Strict constraint: absolutely no readable text, no letters, no numbers, no "
    "logos, no signs, no labels, no watermarks anywhere in the image. Where "
    "writing would appear, draw simple abstract horizontal lines instead. "
    "Composition: generous empty margins, single clear subject, reads well at "
    "small size."
)

# name, aspect ratio, ImageMagick geometry, palette size, subject
JOBS = [
    (
        "hero-aprendo", "16:9", "1400x", 64,
        "A wide horizontal scene: one adult woman learner in her thirties sitting at a small "
        "kitchen table at home, relaxed and lightly smiling, a phone propped in front of her and "
        "an open notebook and pen beside a mug of coffee. Warm morning light. She looks calm and "
        "focused, not stressed. Simple domestic background: a window, a plant, a shelf. Plenty of "
        "clean empty space on the left.",
    ),
    (
        "hero-enseno", "16:9", "1400x", 64,
        "A wide horizontal scene: one adult man teacher in his forties standing beside a small "
        "desk, holding a few printed worksheets, an open laptop on the desk, a simple blank "
        "whiteboard behind him. He looks organized and welcoming. Three empty chairs suggested at "
        "the edge of the frame. Plenty of clean empty space on the left.",
    ),
    (
        "spot-quiz", "1:1", "512x512", 48,
        "A single centered spot illustration: a worksheet card seen straight on, with abstract "
        "horizontal lines standing in for questions, a few small checkbox squares, one of them "
        "ticked, and a pencil resting diagonally across it. Indigo #4F46E5 is the dominant accent "
        "color.",
    ),
    (
        "spot-roleplay", "1:1", "512x512", 48,
        "A single centered spot illustration: two simple friendly character busts facing each "
        "other in three-quarter view, one with a rounded speech bubble above them and the other "
        "with a smaller one. The speech bubbles are completely empty. Teal #0F766E is the dominant "
        "accent color.",
    ),
    (
        "spot-guia", "1:1", "512x512", 48,
        "A single centered spot illustration: an open notebook seen from slightly above with "
        "abstract horizontal lines on both pages, a ribbon bookmark, and a very small potted plant "
        "beside it. Deep blue-cyan #1F6F8B is the dominant accent color.",
    ),
    (
        "spot-escena", "1:1", "512x512", 48,
        "A single centered spot illustration: a small four-panel comic grid card, two by two, each "
        "panel holding one simple abstract shape suggesting a tiny scene: a cup, a bus, a door, a "
        "hand. Terracotta #B8541F is the dominant accent color.",
    ),
    (
        "spot-progreso", "1:1", "512x512", 48,
        "A single centered spot illustration: a small healthy potted plant with three leaves "
        "growing beside a simple rising staircase of three blocks. Warm and encouraging. Teal "
        "#0F766E and terracotta #B8541F accents.",
    ),
    (
        "empty-biblioteca", "4:3", "640x", 48,
        "A gentle empty-state illustration: an open empty folder standing upright with nothing "
        "inside, a pencil leaning against it, and two small abstract paper shapes floating nearby. "
        "Very light, mostly paper cream, muted and calm, lots of empty space.",
    ),
    (
        "empty-clase", "4:3", "640x", 48,
        "A gentle empty-state illustration: three empty chairs arranged in a loose semicircle "
        "facing a small blank easel board. Nobody in the scene. Very light, mostly paper cream, "
        "muted and calm, lots of empty space.",
    ),
]


def api_key() -> str:
    raw = KEY_FILE.read_text().strip()
    if raw.startswith("OPENROUTER_API_KEY"):
        return raw.split("=", 1)[1].strip()
    return raw


def request_image(prompt: str, key: str) -> bytes:
    body = json.dumps(
        {
            "model": MODEL,
            "modalities": ["image", "text"],
            "messages": [{"role": "user", "content": prompt}],
        }
    ).encode()
    request = urllib.request.Request(
        "https://openrouter.ai/api/v1/chat/completions",
        data=body,
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=180) as response:
        payload = json.load(response)

    images = payload["choices"][0]["message"].get("images") or []
    if not images:
        raise RuntimeError("model returned no image")
    return base64.b64decode(images[0]["image_url"]["url"].split(",", 1)[1])


def optimize(target: Path, geometry: str, colors: int) -> None:
    subprocess.run(
        [
            "magick", str(target),
            "-resize", geometry,
            "-strip",
            "-colors", str(colors),
            "-define", "png:compression-level=9",
            f"PNG8:{target}",
        ],
        check=True,
    )


def build(name: str, ratio: str, geometry: str, colors: int, subject: str, key: str) -> None:
    target = OUT / f"{name}.png"
    if target.exists():
        print(f"skip {name} (exists)")
        return

    target.write_bytes(request_image(f"{subject}\n\n{STYLE}\n\nAspect ratio: {ratio}.", key))
    optimize(target, geometry, colors)
    print(f"ok   {name} — {target.stat().st_size // 1024} KB")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    key = api_key()
    wanted = set(sys.argv[1:])

    for name, ratio, geometry, colors, subject in JOBS:
        if wanted and name not in wanted:
            continue
        try:
            build(name, ratio, geometry, colors, subject, key)
        except Exception as error:  # one bad asset must not stop the batch
            print(f"FAIL {name}: {error}")


if __name__ == "__main__":
    main()
