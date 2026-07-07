# Scene Image Asset Planning

This folder is the design workspace for curated, pre-generated scene images for Mister F.

The goal is to build a reusable library of classroom-safe wordless story images that can support:

- tutor chat prompts;
- quiz prompts;
- writing prompts;
- speaking prompts;
- story sequencing;
- vocabulary and grammar practice;
- roleplay setup screens.

These are not final runtime assets yet. The design folder stores source prompts, generated candidates, QA notes, and metadata. When a set is approved for product use, selected images can be copied into a public runtime folder and wired into the application.

## Asset Principles

- Prefer four-panel wordless stories over single-scene illustrations.
- Show different moments of one situation in a clean 2x2 grid.
- Use the shared platform illustration direction from `../illustration-style-guide.md`.
- Use varied characters, ages, cultures, settings, and everyday problems.
- Avoid readable text inside the image unless a specific exercise requires it.
- Keep scenes classroom-safe, warm, cartoon-like, and easy to describe.
- Make the central action obvious at thumbnail size.
- Favor reusable situations over one-off jokes or overly specific stories.
- Store enough metadata to search by topic, level, use case, setting, and prompt.

## Suggested Categories

- cafe and restaurant;
- transportation;
- school and classroom;
- workplace;
- shopping and money;
- health and appointments;
- home and family;
- weather and plans;
- asking for help;
- lost and found;
- directions and places;
- emotions and social situations;
- problem and solution;
- four-panel wordless stories.

## Workflow

1. Draft a structured prompt from `prompt-template.md`.
2. Generate an image with Codex image generation.
3. Save the image under `images/`.
4. Visually inspect for clarity, diversity, classroom safety, and unwanted text.
5. Add or update the entry in `scene-images.json`.
6. If the image is approved, mark `"status": "approved"`.
7. If it needs another pass, keep the entry as `"draft"` or `"needs_revision"` and add QA notes.

## Planning

Use `generation-plan.md` as the working tracker for the first 50 curated scene images. It groups images into thematic batches of five and records planned IDs, formats, titles, and generation status.

## Runtime Direction

If these assets become product assets, use a separate runtime folder such as:

```text
misterf-web/public/scene-images/
```

The runtime registry should be derived from approved entries only.
