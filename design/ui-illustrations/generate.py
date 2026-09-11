"""Generate and optimize the app's UI illustrations.

The one place new UI imagery comes from. Every file in
`misterf-web/public/illustrations/` has an entry in `illustrations.json` next to
this script, and this script is what produced it. Read
`.agents/skills/ui-illustrations/SKILL.md` before adding one.

Run from the repository root:

    python3 design/ui-illustrations/generate.py                      # every missing file
    python3 design/ui-illustrations/generate.py spot-charla          # one
    python3 design/ui-illustrations/generate.py spot-charla --force  # regenerate one
    python3 design/ui-illustrations/generate.py spot-charla --dry-run  # print the prompt, no call

Existing files are skipped unless `--force` is given, so a normal run only
spends credit on what is new. Generation uses the design-side OpenRouter key
(`design/scene-scripts/.assts-gen-key`, gitignored — see
`.agents/skills/generate-scene-assets`), never a user's credit.

Why the set stays coherent: the prompt is `subject + STYLE + ratio`, and only the
subject ever changes. The style block below is the single source of truth; the
same text is quoted in the skill so a reader can review it, but edit it here.
"""

import base64
import json
import subprocess
import sys
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
REGISTRY = Path(__file__).resolve().parent / "illustrations.json"
OUT = REPO / "misterf-web" / "public" / "illustrations"
KEY_FILE = REPO / "design" / "scene-scripts" / ".assts-gen-key"
MODEL = "google/gemini-3.1-flash-image"

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

# The class is the file-name prefix, and the prefix is the contract: a file
# named `spot-*` gets the spot ratio, size, palette and byte budget.
CLASSES = {
    "hero": {"ratio": "16:9", "geometry": "1400x", "colors": 64, "budget_kb": 100},
    "spot": {"ratio": "1:1", "geometry": "512x512", "colors": 48, "budget_kb": 40},
    "empty": {"ratio": "4:3", "geometry": "640x", "colors": 48, "budget_kb": 40},
}


def load_registry() -> list[dict]:
    entries = json.loads(REGISTRY.read_text())["illustrations"]
    for entry in entries:
        prefix = entry["name"].split("-", 1)[0]
        if prefix not in CLASSES:
            raise SystemExit(
                f"{entry['name']}: unknown class prefix '{prefix}' "
                f"(expected one of {', '.join(CLASSES)})"
            )
    return entries


def class_of(name: str) -> dict:
    return CLASSES[name.split("-", 1)[0]]


def build_prompt(entry: dict) -> str:
    return f"{entry['subject']}\n\n{STYLE}\n\nAspect ratio: {class_of(entry['name'])['ratio']}."


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


def optimize(target: Path, spec: dict) -> None:
    """Flat vector art quantizes almost losslessly: ~900 KB in, tens of KB out."""
    subprocess.run(
        [
            "magick", str(target),
            "-resize", spec["geometry"],
            "-strip",
            "-colors", str(spec["colors"]),
            "-define", "png:compression-level=9",
            f"PNG8:{target}",
        ],
        check=True,
    )


def build(entry: dict, key: str, force: bool) -> None:
    name = entry["name"]
    spec = class_of(name)
    target = OUT / f"{name}.png"
    if target.exists() and not force:
        print(f"skip {name} (exists)")
        return

    target.write_bytes(request_image(build_prompt(entry), key))
    optimize(target, spec)

    size_kb = target.stat().st_size / 1024
    verdict = "ok  " if size_kb <= spec["budget_kb"] else "OVER"
    print(f"{verdict} {name} — {size_kb:.0f} KB (budget {spec['budget_kb']} KB)")


def main() -> None:
    args = sys.argv[1:]
    force = "--force" in args
    dry_run = "--dry-run" in args
    wanted = {arg for arg in args if not arg.startswith("--")}

    entries = load_registry()
    unknown = wanted - {entry["name"] for entry in entries}
    if unknown:
        raise SystemExit(f"not in illustrations.json: {', '.join(sorted(unknown))}")

    selected = [entry for entry in entries if not wanted or entry["name"] in wanted]

    if dry_run:
        for entry in selected:
            print(f"--- {entry['name']}\n{build_prompt(entry)}\n")
        return

    OUT.mkdir(parents=True, exist_ok=True)
    key = api_key()
    for entry in selected:
        try:
            build(entry, key, force)
        except Exception as error:  # one bad asset must not stop the batch
            print(f"FAIL {entry['name']}: {error}")


if __name__ == "__main__":
    main()
