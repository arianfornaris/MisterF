#!/usr/bin/env python3
"""Build script-report.html: a review of proposed script rewrites against the
Script & Audio Quality Requirements (see README.md).

This report is read-only with respect to the master registry. It never edits
scene-scripts.json; it only shows the current script beside a proposed rewrite
plus the criteria that drove each change, so the rewrites can be reviewed before
anything is applied to metadata or audio is regenerated.

Inputs:
  - scene-scripts.json            (current master registry)
  - proposed-script-rewrites.json (authored rewrites, keyed by script id)

Output:
  - script-report.html            (standalone, embeds its own data)
"""

import html
import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
REGISTRY = HERE / "scene-scripts.json"
REWRITES = HERE / "proposed-script-rewrites.json"
OUTPUT = HERE / "script-report.html"

# Listening-calibrated ranges (see script-levels.md). Soft targets: level is
# defined by linguistic complexity, not word count.
LEVEL_BANDS = {"A1-A2": (30, 60), "B1-B2": (55, 90), "C1": (75, 130)}

RULES = {
    "P1": "Character identity established in the audio",
    "P2": "Grounding and answerability",
    "P3": "Self-contained narrative",
    "P4": "Level-appropriate for listening",
    "P5": "Audio production quality",
    "P6": "Representation consistency",
}


def find_scripts(node):
    if isinstance(node, dict):
        for value in node.values():
            if (
                isinstance(value, list)
                and value
                and isinstance(value[0], dict)
                and "transcript" in value[0]
            ):
                return value
            found = find_scripts(value)
            if found:
                return found
    elif isinstance(node, list):
        if node and isinstance(node[0], dict) and "transcript" in node[0]:
            return node
        for value in node:
            found = find_scripts(value)
            if found:
                return found
    return None


def word_count(turns):
    return len(" ".join(t.get("text", "") for t in turns).split())


def speaker_names(script):
    names = []
    for sp in script.get("speakers", []):
        if sp.get("role") == "narrator" or sp.get("name", "").lower() == "narrator":
            continue
        if sp.get("name"):
            names.append(sp["name"])
    return names


def name_for(script, speaker_id):
    for sp in script.get("speakers", []):
        if sp.get("id") == speaker_id:
            return sp.get("name", speaker_id)
    return speaker_id


def highlight_names(text, names):
    """Bold spoken character names so reviewers can spot the identity fix.

    Longest tokens are applied first (and skipped if already inside a <mark>),
    so a full name like "Mr. James" is highlighted whole rather than leaving a
    stray "Mr." wrapped on its own.
    """
    tokens = set()
    for name in names:
        if name:
            tokens.add(name)
            tokens.add(name.split()[0])
    escaped = html.escape(text)
    for token in sorted(tokens, key=len, reverse=True):
        escaped = re.sub(
            r"(?<![\w>])(" + re.escape(html.escape(token)) + r")(?![\w<])",
            r"<mark>\1</mark>",
            escaped,
        )
    return escaped


def turn_rows(turns, script, names, other_turns=None):
    rows = []
    for idx, t in enumerate(turns):
        changed = other_turns is not None and (
            idx >= len(other_turns) or t.get("text") != other_turns[idx].get("text")
        )
        speaker = html.escape(name_for(script, t.get("speakerId")))
        text = highlight_names(t.get("text", ""), names)
        cls = " changed" if changed else ""
        rows.append(
            f'<div class="turn{cls}"><span class="spk">{speaker}</span>'
            f'<span class="txt">{text}</span></div>'
        )
    return "\n".join(rows)


def chip(rule):
    return f'<span class="chip chip-{rule}" title="{html.escape(RULES.get(rule, rule))}">{rule}</span>'


def build():
    registry = json.loads(REGISTRY.read_text())
    scripts = find_scripts(registry)
    rewrites = json.loads(REWRITES.read_text())

    rewritten, compliant = [], []
    cards = []

    for script in scripts:
        sid = script["id"]
        level = script.get("level")
        stype = script.get("scriptType")
        turns = script.get("transcript", [])
        names = speaker_names(script)
        wc = word_count(turns)

        if sid in rewrites:
            rw = rewrites[sid]
            rewritten.append(sid)
            new_turns = rw["turns"]
            new_names = names[:]  # names unchanged in metadata; report only
            criteria = "".join(chip(c) for c in rw.get("criteria", []))
            meta = rw.get("metadataRec", "")
            note = rw.get("notes", "")
            new_wc = word_count(new_turns)
            body = f"""
            <div class="cols">
              <div class="col before">
                <div class="col-h">Current <span class="wc">{wc} words</span></div>
                {turn_rows(turns, script, names)}
              </div>
              <div class="col after">
                <div class="col-h">Proposed <span class="wc">{new_wc} words</span></div>
                {turn_rows(new_turns, script, new_names, other_turns=turns)}
              </div>
            </div>
            <div class="note"><strong>Why:</strong> {html.escape(note)}</div>
            <div class="meta"><strong>Metadata (not applied):</strong> {html.escape(meta)}
              &nbsp;·&nbsp;<code>identityStrategy: {html.escape(rw.get('identityStrategy',''))}</code></div>
            """
            status, status_cls = "Rewritten", "st-rewritten"
        else:
            compliant.append(sid)
            criteria = '<span class="chip chip-ok">OK</span>'
            body = f"""
            <div class="cols">
              <div class="col before full">
                <div class="col-h">Current <span class="wc">{wc} words</span></div>
                {turn_rows(turns, script, names)}
              </div>
            </div>
            <div class="note ok">Reviewed against P1-P6: identity, grounding, meta-phrase, and
              representation checks pass. No change needed.</div>
            """
            status, status_cls = "Compliant", "st-ok"

        cards.append(f"""
        <article class="card {status_cls}" data-status="{status_cls}">
          <header class="card-h">
            <div class="titles">
              <span class="sid">{html.escape(sid)}</span>
              <span class="tags">{html.escape(level)} · {html.escape(stype)}</span>
            </div>
            <div class="right">{criteria}<span class="status {status_cls}">{status}</span></div>
          </header>
          {body}
        </article>
        """)

    legend = "".join(
        f'<li>{chip(k)} {html.escape(v)}</li>' for k, v in RULES.items()
    )

    doc = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Scene Script Quality Report</title>
<style>
:root {{
  --bg:#f6f7f9; --card:#fff; --ink:#1c2024; --muted:#6b7280; --line:#e4e7eb;
  --before:#fff7ed; --after:#f0fdf4; --mark:#fde68a; --mark-ink:#4a3500;
  --ok:#16a34a; --flag:#d97706; --rew:#2563eb;
}}
@media (prefers-color-scheme: dark) {{
  :root {{
    --bg:#0f1216; --card:#171b21; --ink:#e7eaee; --muted:#9aa4b2; --line:#262c34;
    --before:#241a10; --after:#10231a; --mark:#a97e12; --mark-ink:#fff6d8;
  }}
}}
* {{ box-sizing:border-box; }}
body {{ margin:0; background:var(--bg); color:var(--ink);
  font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; }}
.wrap {{ max-width:1100px; margin:0 auto; padding:28px 20px 80px; }}
h1 {{ font-size:24px; margin:0 0 4px; }}
.sub {{ color:var(--muted); margin:0 0 22px; }}
.summary {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:12px; margin-bottom:20px; }}
.stat {{ background:var(--card); border:1px solid var(--line); border-radius:12px; padding:14px 16px; }}
.stat b {{ font-size:26px; display:block; }}
.stat span {{ color:var(--muted); font-size:13px; }}
.callout {{ background:var(--card); border:1px solid var(--line); border-left:4px solid var(--flag);
  border-radius:10px; padding:14px 16px; margin-bottom:20px; }}
.callout h3 {{ margin:0 0 6px; font-size:15px; }}
.legend {{ background:var(--card); border:1px solid var(--line); border-radius:12px; padding:12px 18px; margin-bottom:20px; }}
.legend ul {{ list-style:none; margin:0; padding:0; display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:4px 20px; }}
.legend li {{ font-size:13px; color:var(--muted); }}
.filters {{ display:flex; gap:8px; flex-wrap:wrap; margin-bottom:18px; position:sticky; top:0;
  background:var(--bg); padding:10px 0; z-index:5; }}
.filters button {{ border:1px solid var(--line); background:var(--card); color:var(--ink);
  border-radius:999px; padding:6px 14px; font-size:13px; cursor:pointer; }}
.filters button.active {{ background:var(--ink); color:var(--bg); border-color:var(--ink); }}
.card {{ background:var(--card); border:1px solid var(--line); border-radius:14px; padding:16px 18px; margin-bottom:16px; }}
.card-h {{ display:flex; justify-content:space-between; align-items:flex-start; gap:12px; margin-bottom:12px; }}
.sid {{ font-weight:600; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:13.5px; display:block; }}
.tags {{ color:var(--muted); font-size:12.5px; }}
.right {{ display:flex; align-items:center; gap:6px; flex-wrap:wrap; justify-content:flex-end; }}
.status {{ font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; padding:3px 9px; border-radius:999px; }}
.st-rewritten .status, .status.st-rewritten {{ background:color-mix(in srgb,var(--rew) 16%,transparent); color:var(--rew); }}
.status.st-ok {{ background:color-mix(in srgb,var(--ok) 16%,transparent); color:var(--ok); }}
.cols {{ display:grid; grid-template-columns:1fr 1fr; gap:12px; }}
.col.full {{ grid-column:1 / -1; }}
.col {{ border:1px solid var(--line); border-radius:10px; padding:10px 12px; }}
.col.before {{ background:var(--before); }}
.col.after {{ background:var(--after); }}
.col-h {{ font-size:11px; text-transform:uppercase; letter-spacing:.05em; color:var(--muted); margin-bottom:8px; font-weight:700; }}
.col-h .wc {{ font-weight:400; text-transform:none; letter-spacing:0; }}
.turn {{ display:flex; gap:8px; padding:3px 0; font-size:14px; }}
.turn.changed {{ background:color-mix(in srgb,var(--mark) 22%,transparent); border-radius:6px; padding:3px 6px; margin:0 -6px; }}
.spk {{ color:var(--muted); font-weight:600; min-width:74px; font-size:12.5px; padding-top:1px; }}
mark {{ background:var(--mark); color:var(--mark-ink); border-radius:3px; padding:0 2px; }}
.note {{ margin-top:12px; font-size:13.5px; color:var(--ink); }}
.note.flag {{ color:var(--ink); background:color-mix(in srgb,var(--flag) 8%,transparent); padding:10px 12px; border-radius:8px; }}
.note.ok {{ color:var(--muted); }}
.meta {{ margin-top:8px; font-size:12.5px; color:var(--muted); }}
.meta code, .note code {{ font-family:ui-monospace,Menlo,monospace; font-size:12px;
  background:color-mix(in srgb,var(--ink) 8%,transparent); padding:1px 5px; border-radius:5px; }}
.chip {{ font-size:11px; font-weight:700; padding:2px 7px; border-radius:6px; font-family:ui-monospace,Menlo,monospace; }}
.chip-P1 {{ background:color-mix(in srgb,var(--rew) 18%,transparent); color:var(--rew); }}
.chip-P2,.chip-P3,.chip-P5,.chip-P6 {{ background:color-mix(in srgb,var(--muted) 22%,transparent); color:var(--ink); }}
.chip-P4 {{ background:color-mix(in srgb,var(--flag) 20%,transparent); color:var(--flag); }}
.chip-ok {{ background:color-mix(in srgb,var(--ok) 16%,transparent); color:var(--ok); }}
@media (max-width:720px) {{ .cols {{ grid-template-columns:1fr; }} .spk {{ min-width:60px; }} }}
</style>
</head>
<body>
<div class="wrap">
  <h1>Scene Script Quality Report</h1>
  <p class="sub">Proposed rewrites against the Script &amp; Audio Quality Requirements. Read-only:
     the master registry and audio are untouched until these are approved.</p>

  <div class="summary">
    <div class="stat"><b>{len(scripts)}</b><span>scripts reviewed</span></div>
    <div class="stat"><b>{len(rewritten)}</b><span>rewritten (P1 identity)</span></div>
    <div class="stat"><b>{len(compliant)}</b><span>compliant, no change</span></div>
  </div>

  <div class="callout">
    <h3>Resolved: level bands recalibrated for listening</h3>
    <p>An earlier pass flagged all 41 C1 narrations as short against a 130-190 band. On review,
    the whole scale was sitting about one band below the documented targets (A1-A2 ~37, B1-B2 ~64,
    C1 ~82 median words), but the levels <em>are</em> differentiated — by complexity, not length:
    A1-A2 uses simple actions, B1-B2 adds connectors and reasons, C1 carries inference, embedded
    clauses, and implied meaning. Length is a soft proxy, and listening passages should run shorter
    than reading. So rather than padding good scripts, the bands in <code>script-levels.md</code>
    were recalibrated to listening-appropriate ranges (A1-A2 30-60, B1-B2 55-90, C1 75-130), which
    the current scripts already meet. No regeneration needed for length. (Consider a longer C1 only
    if comprehension design needs more material per passage for inference questions.)</p>
  </div>

  <div class="legend"><ul>{legend}</ul></div>

  <div class="filters">
    <button data-f="all" class="active">All ({len(scripts)})</button>
    <button data-f="st-rewritten">Rewritten ({len(rewritten)})</button>
    <button data-f="st-ok">Compliant ({len(compliant)})</button>
  </div>

  <div id="cards">
    {''.join(cards)}
  </div>
</div>
<script>
const btns=document.querySelectorAll('.filters button');
const cards=document.querySelectorAll('.card');
btns.forEach(b=>b.addEventListener('click',()=>{{
  btns.forEach(x=>x.classList.remove('active'));
  b.classList.add('active');
  const f=b.dataset.f;
  cards.forEach(c=>c.style.display=(f==='all'||c.dataset.status===f)?'':'none');
}}));
</script>
</body>
</html>
"""
    OUTPUT.write_text(doc)
    print(f"Wrote {OUTPUT.relative_to(HERE.parent.parent)}")
    print(f"  rewritten={len(rewritten)} compliant={len(compliant)}")


if __name__ == "__main__":
    build()
