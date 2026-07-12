#!/usr/bin/env python3
"""Build the standalone scene script review index."""

from __future__ import annotations

import html
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent
SCENE_IMAGES_PATH = ROOT.parent / "scene-images" / "scene-images.json"
SCENE_SCRIPTS_PATH = ROOT / "scene-scripts.json"
OUTPUT_PATH = ROOT / "index.html"


def json_for_script_tag(data: object) -> str:
    return json.dumps(data, ensure_ascii=False).replace("</", "<\\/")


def main() -> None:
    images = json.loads(SCENE_IMAGES_PATH.read_text())
    scripts = json.loads(SCENE_SCRIPTS_PATH.read_text())

    document = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Mister F Scene Script Review</title>
  <style>
    :root {{
      color-scheme: light;
      --bg: #f6f8fa;
      --surface: #ffffff;
      --surface-alt: #eef3f7;
      --text: #17212b;
      --muted: #607080;
      --border: #d7e0e8;
      --primary: #2c7be5;
      --primary-dark: #185abc;
      --warning: #b7791f;
      --danger: #b42318;
      --ok: #13795b;
      --shadow: 0 10px 24px rgba(23, 33, 43, 0.08);
      --radius: 8px;
    }}

    * {{
      box-sizing: border-box;
    }}

    body {{
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.45;
    }}

    button,
    input,
    select,
    textarea {{
      font: inherit;
    }}

    button {{
      cursor: pointer;
    }}

    .app-shell {{
      display: grid;
      grid-template-columns: 320px minmax(0, 1fr);
      min-height: 100vh;
    }}

    .sidebar {{
      position: sticky;
      top: 0;
      height: 100vh;
      overflow: auto;
      border-right: 1px solid var(--border);
      background: var(--surface);
      padding: 18px;
    }}

    .brand {{
      margin-bottom: 16px;
    }}

    .brand h1 {{
      margin: 0 0 4px;
      font-size: 1.25rem;
      line-height: 1.2;
    }}

    .brand p {{
      margin: 0;
      color: var(--muted);
      font-size: 0.92rem;
    }}

    .summary-grid {{
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
      margin: 16px 0;
    }}

    .summary-tile {{
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 10px;
      background: var(--surface-alt);
    }}

    .summary-tile strong {{
      display: block;
      font-size: 1rem;
    }}

    .summary-tile span {{
      color: var(--muted);
      font-size: 0.78rem;
    }}

    .controls {{
      display: grid;
      gap: 10px;
      margin-bottom: 16px;
    }}

    .control-label {{
      display: grid;
      gap: 4px;
      color: var(--muted);
      font-size: 0.78rem;
      font-weight: 700;
      text-transform: uppercase;
    }}

    .control-label input,
    .control-label select {{
      width: 100%;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: #fff;
      color: var(--text);
      padding: 9px 10px;
      outline: none;
    }}

    .control-label input:focus,
    .control-label select:focus,
    textarea:focus {{
      border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(44, 123, 229, 0.16);
    }}

    .scene-nav {{
      display: grid;
      gap: 6px;
    }}

    .scene-nav button {{
      width: 100%;
      border: 1px solid transparent;
      border-radius: var(--radius);
      background: transparent;
      color: var(--text);
      padding: 9px 10px;
      text-align: left;
    }}

    .scene-nav button:hover,
    .scene-nav button.active {{
      border-color: var(--border);
      background: var(--surface-alt);
    }}

    .nav-title {{
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-weight: 700;
    }}

    .nav-meta {{
      display: block;
      color: var(--muted);
      font-size: 0.78rem;
    }}

    main {{
      min-width: 0;
      padding: 24px;
    }}

    .toolbar {{
      position: sticky;
      top: 0;
      z-index: 4;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin: -24px -24px 24px;
      border-bottom: 1px solid var(--border);
      background: rgba(246, 248, 250, 0.92);
      padding: 14px 24px;
      backdrop-filter: blur(8px);
    }}

    .toolbar-title {{
      min-width: 0;
    }}

    .toolbar-title strong {{
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }}

    .toolbar-title span {{
      color: var(--muted);
      font-size: 0.88rem;
    }}

    .toolbar-actions {{
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }}

    .button {{
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--surface);
      color: var(--text);
      padding: 8px 10px;
    }}

    .button.primary {{
      border-color: var(--primary);
      background: var(--primary);
      color: #fff;
    }}

    .button:hover {{
      border-color: var(--primary);
    }}

    .button.primary:hover {{
      background: var(--primary-dark);
    }}

    .scene-list {{
      display: grid;
      gap: 24px;
    }}

    .scene-card {{
      display: grid;
      grid-template-columns: minmax(280px, 420px) minmax(0, 1fr);
      gap: 18px;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--surface);
      box-shadow: var(--shadow);
      padding: 16px;
    }}

    .scene-media {{
      min-width: 0;
    }}

    .scene-image {{
      display: block;
      width: 100%;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--surface-alt);
      aspect-ratio: 1 / 1;
      object-fit: contain;
    }}

    .scene-details {{
      display: grid;
      gap: 12px;
      margin-top: 12px;
      color: var(--muted);
      font-size: 0.9rem;
    }}

    .scene-title-row {{
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 12px;
    }}

    .scene-title-row h2 {{
      margin: 0 0 4px;
      font-size: 1.35rem;
      line-height: 1.2;
    }}

    .scene-title-row p {{
      margin: 0;
      color: var(--muted);
    }}

    .badge-row {{
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }}

    .badge {{
      display: inline-flex;
      align-items: center;
      min-height: 24px;
      border-radius: 999px;
      background: var(--surface-alt);
      color: var(--muted);
      padding: 3px 8px;
      font-size: 0.78rem;
      font-weight: 700;
    }}

    .badge.warn {{
      background: #fff3cd;
      color: var(--warning);
    }}

    .badge.danger {{
      background: #fdecec;
      color: var(--danger);
    }}

    .script-grid {{
      display: grid;
      gap: 12px;
    }}

    .script-card {{
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: #fff;
      padding: 12px;
    }}

    .script-card.needs-review {{
      border-color: #f0ad4e;
      background: #fffaf0;
    }}

    .script-header {{
      display: flex;
      justify-content: space-between;
      gap: 10px;
      align-items: flex-start;
      margin-bottom: 8px;
    }}

    .script-header h3 {{
      margin: 0;
      font-size: 1rem;
    }}

    .script-meta {{
      color: var(--muted);
      font-size: 0.82rem;
    }}

    audio {{
      width: 100%;
      min-height: 38px;
      margin: 8px 0;
    }}

    .turn-audio {{
      min-height: 30px;
      margin: 6px 0 0;
    }}

    .transcript {{
      display: grid;
      gap: 8px;
      margin-top: 10px;
    }}

    .turn {{
      display: grid;
      grid-template-columns: 120px minmax(0, 1fr);
      gap: 10px;
      border-top: 1px solid var(--border);
      padding-top: 8px;
    }}

    .speaker {{
      color: var(--muted);
      font-size: 0.84rem;
      font-weight: 800;
    }}

    .turn-text {{
      white-space: pre-wrap;
    }}

    .plain-text {{
      margin: 10px 0 0;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--surface-alt);
      padding: 10px;
      white-space: pre-wrap;
    }}

    .review-tools {{
      display: grid;
      gap: 8px;
      margin-top: 10px;
      border-top: 1px solid var(--border);
      padding-top: 10px;
    }}

    .review-line {{
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      flex-wrap: wrap;
    }}

    .review-check {{
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 0.9rem;
      font-weight: 700;
    }}

    textarea {{
      width: 100%;
      min-height: 72px;
      resize: vertical;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 9px 10px;
    }}

    .empty-state {{
      border: 1px dashed var(--border);
      border-radius: var(--radius);
      background: var(--surface);
      color: var(--muted);
      padding: 28px;
      text-align: center;
    }}

    .hidden {{
      display: none !important;
    }}

    @media (max-width: 1080px) {{
      .app-shell {{
        grid-template-columns: 1fr;
      }}

      .sidebar {{
        position: static;
        height: auto;
        max-height: none;
        border-right: 0;
        border-bottom: 1px solid var(--border);
      }}

      .scene-nav {{
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      }}
    }}

    @media (max-width: 760px) {{
      main {{
        padding: 14px;
      }}

      .toolbar {{
        margin: -14px -14px 14px;
        padding: 12px 14px;
      }}

      .scene-card {{
        grid-template-columns: 1fr;
      }}

      .turn {{
        grid-template-columns: 1fr;
      }}
    }}
  </style>
</head>
<body>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="brand">
        <h1>Scene Script Review</h1>
        <p>Review images, leveled scripts, and Gemini TTS audio.</p>
      </div>

      <div class="summary-grid" id="summaryGrid"></div>

      <div class="controls" aria-label="Filters">
        <label class="control-label">
          Search
          <input id="searchInput" type="search" placeholder="Scene, text, tag, speaker...">
        </label>
        <label class="control-label">
          Level
          <select id="levelFilter">
            <option value="all">All levels</option>
            <option value="A1-A2">A1-A2</option>
            <option value="B1-B2">B1-B2</option>
            <option value="C1">C1</option>
          </select>
        </label>
        <label class="control-label">
          Format
          <select id="formatFilter">
            <option value="all">All formats</option>
          </select>
        </label>
        <label class="control-label">
          Review Status
          <select id="reviewFilter">
            <option value="all">All scripts</option>
            <option value="flagged">Needs rewrite</option>
            <option value="not-flagged">Not flagged</option>
          </select>
        </label>
      </div>

      <nav class="scene-nav" id="sceneNav" aria-label="Scene navigation"></nav>
    </aside>

    <main>
      <div class="toolbar">
        <div class="toolbar-title">
          <strong id="resultTitle">All Scenes</strong>
          <span id="resultMeta"></span>
        </div>
        <div class="toolbar-actions">
          <button class="button" type="button" id="collapseAllButton">Collapse Text</button>
          <button class="button primary" type="button" id="exportNotesButton">Export Notes</button>
        </div>
      </div>

      <section class="scene-list" id="sceneList"></section>
      <div class="empty-state hidden" id="emptyState">No scenes match the current filters.</div>
    </main>
  </div>

  <script id="scene-images-data" type="application/json">{json_for_script_tag(images)}</script>
  <script id="scene-scripts-data" type="application/json">{json_for_script_tag(scripts)}</script>
  <script>
    const imageRegistry = JSON.parse(document.getElementById("scene-images-data").textContent);
    const scriptRegistry = JSON.parse(document.getElementById("scene-scripts-data").textContent);
    const sceneImages = imageRegistry.images;
    const scripts = scriptRegistry.scripts;
    const sceneById = new Map(sceneImages.map((scene) => [scene.id, scene]));
    const scriptsByScene = new Map();
    const reviewKey = "misterf.sceneScriptReview.v1";
    const levelOrder = ["A1-A2", "B1-B2", "C1"];

    for (const script of scripts) {{
      if (!scriptsByScene.has(script.sceneImageId)) {{
        scriptsByScene.set(script.sceneImageId, []);
      }}
      scriptsByScene.get(script.sceneImageId).push(script);
    }}

    for (const sceneScripts of scriptsByScene.values()) {{
      sceneScripts.sort((a, b) => levelOrder.indexOf(a.level) - levelOrder.indexOf(b.level));
    }}

    const state = {{
      search: "",
      level: "all",
      format: "all",
      review: "all",
      collapsedText: false,
      activeSceneId: sceneImages[0]?.id ?? null,
      notes: loadReviewNotes(),
    }};

    const elements = {{
      summaryGrid: document.getElementById("summaryGrid"),
      searchInput: document.getElementById("searchInput"),
      levelFilter: document.getElementById("levelFilter"),
      formatFilter: document.getElementById("formatFilter"),
      reviewFilter: document.getElementById("reviewFilter"),
      sceneNav: document.getElementById("sceneNav"),
      sceneList: document.getElementById("sceneList"),
      emptyState: document.getElementById("emptyState"),
      resultTitle: document.getElementById("resultTitle"),
      resultMeta: document.getElementById("resultMeta"),
      collapseAllButton: document.getElementById("collapseAllButton"),
      exportNotesButton: document.getElementById("exportNotesButton"),
    }};

    function loadReviewNotes() {{
      try {{
        return JSON.parse(localStorage.getItem(reviewKey) || "{{}}");
      }} catch {{
        return {{}};
      }}
    }}

    function saveReviewNotes() {{
      localStorage.setItem(reviewKey, JSON.stringify(state.notes));
    }}

    function noteFor(scriptId) {{
      if (!state.notes[scriptId]) {{
        state.notes[scriptId] = {{ needsRewrite: false, note: "" }};
      }}
      return state.notes[scriptId];
    }}

    function speakerName(script, speakerId) {{
      const speaker = script.speakers.find((item) => item.id === speakerId);
      return speaker ? speaker.name : speakerId;
    }}

    function formatSeconds(seconds) {{
      const safeSeconds = Number(seconds || 0);
      const minutes = Math.floor(safeSeconds / 60);
      const remainder = Math.round(safeSeconds % 60).toString().padStart(2, "0");
      return `${{minutes}}:${{remainder}}`;
    }}

    function relativeImagePath(scene) {{
      return `../scene-images/${{scene.file}}`;
    }}

    function scriptSearchText(scene, sceneScripts) {{
      return [
        scene.id,
        scene.title,
        scene.setting,
        scene.format,
        ...(scene.tags || []),
        ...(scene.skills || []),
        ...(scene.panelSequence || []),
        ...sceneScripts.flatMap((script) => [
          script.id,
          script.title,
          script.level,
          script.scriptType,
          script.plainText,
          ...(script.teachingFocus || []),
          ...script.speakers.map((speaker) => `${{speaker.name}} ${{speaker.role}} ${{speaker.voice}}`),
        ]),
      ].filter(Boolean).join(" ").toLowerCase();
    }}

    function scriptMatchesReview(script) {{
      const note = noteFor(script.id);
      if (state.review === "flagged") return note.needsRewrite;
      if (state.review === "not-flagged") return !note.needsRewrite;
      return true;
    }}

    function filteredSceneData() {{
      const search = state.search.trim().toLowerCase();
      return sceneImages.map((scene) => {{
        const allScripts = scriptsByScene.get(scene.id) || [];
        const visibleScripts = allScripts.filter((script) => {{
          const levelMatch = state.level === "all" || script.level === state.level;
          return levelMatch && scriptMatchesReview(script);
        }});
        return {{ scene, allScripts, visibleScripts }};
      }}).filter((item) => {{
        if (!item.visibleScripts.length) return false;
        if (state.format !== "all" && item.scene.format !== state.format) return false;
        if (!search) return true;
        return scriptSearchText(item.scene, item.allScripts).includes(search);
      }});
    }}

    function renderSummary() {{
      const totalClips = scripts.reduce((sum, script) => sum + (script.audio?.clips?.length || 0), 0);
      const flaggedCount = scripts.filter((script) => noteFor(script.id).needsRewrite).length;
      const tiles = [
        ["Scenes", sceneImages.length],
        ["Scripts", scripts.length],
        ["Clips", totalClips],
        ["Flagged", flaggedCount],
      ];
      elements.summaryGrid.innerHTML = tiles.map(([label, value]) => `
        <div class="summary-tile">
          <strong>${{escapeHtml(String(value))}}</strong>
          <span>${{escapeHtml(label)}}</span>
        </div>
      `).join("");
    }}

    function renderFormatOptions() {{
      const formats = [...new Set(sceneImages.map((scene) => scene.format))].sort();
      elements.formatFilter.insertAdjacentHTML("beforeend", formats.map((format) => (
        `<option value="${{escapeAttribute(format)}}">${{escapeHtml(format.replaceAll("_", " "))}}</option>`
      )).join(""));
    }}

    function renderNav(items) {{
      elements.sceneNav.innerHTML = items.map((item) => {{
        const scene = item.scene;
        const activeClass = scene.id === state.activeSceneId ? " active" : "";
        const flaggedCount = item.allScripts.filter((script) => noteFor(script.id).needsRewrite).length;
        const flaggedLabel = flaggedCount ? ` · ${{flaggedCount}} flagged` : "";
        return `
          <button type="button" class="${{activeClass}}" data-scene-jump="${{escapeAttribute(scene.id)}}">
            <span class="nav-title">${{escapeHtml(scene.title)}}</span>
            <span class="nav-meta">${{item.visibleScripts.length}} script(s)${{flaggedLabel}}</span>
          </button>
        `;
      }}).join("");
    }}

    function renderScene(scene, visibleScripts, allScripts) {{
      const tags = (scene.tags || []).slice(0, 10);
      const sequence = scene.panelSequence || [];
      return `
        <article class="scene-card" id="${{escapeAttribute(scene.id)}}">
          <div class="scene-media">
            <img class="scene-image" src="${{escapeAttribute(relativeImagePath(scene))}}" alt="${{escapeAttribute(scene.title)}}">
            <div class="scene-details">
              <div><strong>Setting:</strong> ${{escapeHtml(scene.setting || "Unknown")}}</div>
              <div><strong>Format:</strong> ${{escapeHtml(scene.format.replaceAll("_", " "))}} · ${{scene.panelCount}} panel(s)</div>
              <div class="badge-row">${{tags.map((tag) => `<span class="badge">${{escapeHtml(tag)}}</span>`).join("")}}</div>
              <details>
                <summary>Panel sequence</summary>
                <ol>${{sequence.map((step) => `<li>${{escapeHtml(step)}}</li>`).join("")}}</ol>
              </details>
            </div>
          </div>
          <div class="scene-copy">
            <div class="scene-title-row">
              <div>
                <h2>${{escapeHtml(scene.title)}}</h2>
                <p>${{escapeHtml(scene.id)}} · ${{allScripts.length}} total script(s)</p>
              </div>
              <div class="badge-row">
                ${{allScripts.some((script) => noteFor(script.id).needsRewrite) ? '<span class="badge warn">Needs review</span>' : '<span class="badge">Unflagged</span>'}}
              </div>
            </div>
            <div class="script-grid">
              ${{visibleScripts.map(renderScript).join("")}}
            </div>
          </div>
        </article>
      `;
    }}

    function renderScript(script) {{
      const note = noteFor(script.id);
      const needsReviewClass = note.needsRewrite ? " needs-review" : "";
      const transcript = script.transcript.map((turn) => `
        <div class="turn">
          <div class="speaker">${{escapeHtml(speakerName(script, turn.speakerId))}}</div>
          <div class="turn-text">${{escapeHtml(turn.text)}}</div>
          ${{(script.audio?.clips || []).filter((clip) => clip.turn === turn.turn).map((clip) => `<audio class="turn-audio" controls preload="none" src="${{escapeAttribute(clip.file)}}"></audio>`).join("")}}
        </div>
      `).join("");
      return `
        <section class="script-card${{needsReviewClass}}" data-script-card="${{escapeAttribute(script.id)}}">
          <div class="script-header">
            <div>
              <h3>${{escapeHtml(script.level)}} · ${{escapeHtml(script.title)}}</h3>
              <div class="script-meta">
                ${{escapeHtml(script.scriptType)}} · ${{script.stats.wordCount}} words · ${{script.stats.characterCount}} chars · ${{script.audio?.clips?.length || 0}} clip(s) · ${{escapeHtml(script.audio?.model || "no audio")}}
              </div>
            </div>
            <div class="badge-row">
              ${{note.needsRewrite ? '<span class="badge danger">Needs rewrite</span>' : '<span class="badge">OK</span>'}}
            </div>
          </div>
          <div class="transcript${{state.collapsedText ? " hidden" : ""}}">
            ${{transcript}}
          </div>
          <details class="${{state.collapsedText ? "hidden" : ""}}">
            <summary>Plain text</summary>
            <div class="plain-text">${{escapeHtml(script.plainText)}}</div>
          </details>
          <div class="review-tools">
            <div class="review-line">
              <label class="review-check">
                <input type="checkbox" data-review-toggle="${{escapeAttribute(script.id)}}" ${{note.needsRewrite ? "checked" : ""}}>
                Needs rewrite
              </label>
              <button class="button" type="button" data-copy-script="${{escapeAttribute(script.id)}}">Copy Transcript</button>
            </div>
            <textarea data-review-note="${{escapeAttribute(script.id)}}" placeholder="Reviewer notes for this script...">${{escapeHtml(note.note || "")}}</textarea>
          </div>
        </section>
      `;
    }}

    function render() {{
      const items = filteredSceneData();
      if (!items.some((item) => item.scene.id === state.activeSceneId)) {{
        state.activeSceneId = items[0]?.scene.id ?? null;
      }}
      renderSummary();
      renderNav(items);
      elements.sceneList.innerHTML = items.map((item) => renderScene(item.scene, item.visibleScripts, item.allScripts)).join("");
      elements.emptyState.classList.toggle("hidden", items.length > 0);
      elements.resultTitle.textContent = items.length === sceneImages.length ? "All Scenes" : "Filtered Scenes";
      elements.resultMeta.textContent = `${{items.length}} scene(s), ${{items.reduce((sum, item) => sum + item.visibleScripts.length, 0)}} visible script(s)`;
      elements.collapseAllButton.textContent = state.collapsedText ? "Show Text" : "Collapse Text";
    }}

    function exportNotes() {{
      const reviewEntries = Object.entries(state.notes)
        .filter(([, value]) => value.needsRewrite || value.note.trim())
        .map(([scriptId, value]) => ({{
          scriptId,
          sceneImageId: scripts.find((script) => script.id === scriptId)?.sceneImageId,
          level: scripts.find((script) => script.id === scriptId)?.level,
          needsRewrite: value.needsRewrite,
          note: value.note.trim(),
        }}));
      const payload = JSON.stringify({{
        exportedAt: new Date().toISOString(),
        reviewCount: reviewEntries.length,
        reviews: reviewEntries,
      }}, null, 2);
      const blob = new Blob([payload], {{ type: "application/json" }});
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "scene-script-review-notes.json";
      link.click();
      URL.revokeObjectURL(url);
    }}

    function copyScript(scriptId) {{
      const script = scripts.find((item) => item.id === scriptId);
      if (!script) return;
      navigator.clipboard.writeText(script.plainText);
    }}

    function escapeHtml(value) {{
      return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }}

    function escapeAttribute(value) {{
      return escapeHtml(String(value));
    }}

    elements.searchInput.addEventListener("input", (event) => {{
      state.search = event.target.value;
      render();
    }});

    elements.levelFilter.addEventListener("change", (event) => {{
      state.level = event.target.value;
      render();
    }});

    elements.formatFilter.addEventListener("change", (event) => {{
      state.format = event.target.value;
      render();
    }});

    elements.reviewFilter.addEventListener("change", (event) => {{
      state.review = event.target.value;
      render();
    }});

    elements.collapseAllButton.addEventListener("click", () => {{
      state.collapsedText = !state.collapsedText;
      render();
    }});

    elements.exportNotesButton.addEventListener("click", exportNotes);

    document.addEventListener("click", (event) => {{
      const jumpButton = event.target.closest("[data-scene-jump]");
      if (jumpButton) {{
        const sceneId = jumpButton.getAttribute("data-scene-jump");
        state.activeSceneId = sceneId;
        document.getElementById(sceneId)?.scrollIntoView({{ behavior: "smooth", block: "start" }});
        render();
      }}

      const copyButton = event.target.closest("[data-copy-script]");
      if (copyButton) {{
        copyScript(copyButton.getAttribute("data-copy-script"));
      }}
    }});

    document.addEventListener("change", (event) => {{
      const toggle = event.target.closest("[data-review-toggle]");
      if (!toggle) return;
      const scriptId = toggle.getAttribute("data-review-toggle");
      noteFor(scriptId).needsRewrite = toggle.checked;
      saveReviewNotes();
      render();
    }});

    document.addEventListener("input", (event) => {{
      const noteInput = event.target.closest("[data-review-note]");
      if (!noteInput) return;
      const scriptId = noteInput.getAttribute("data-review-note");
      noteFor(scriptId).note = noteInput.value;
      saveReviewNotes();
      renderSummary();
    }});

    renderFormatOptions();
    render();
  </script>
</body>
</html>
"""
    OUTPUT_PATH.write_text(document)
    print(f"Wrote {html.escape(str(OUTPUT_PATH))}")


if __name__ == "__main__":
    main()
