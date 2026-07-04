# Third-Party Resource Exercise Extraction Research

Last researched: 2026-07-04.

This note evaluates whether Mister F should help teachers extract exercise content from third-party resources such as PDFs, Word documents, and URLs.

The feature is feasible, but it should be designed as an assisted authoring workflow rather than a one-click importer. Document extraction is noisy, source materials may be copyrighted, and exercise structure often depends on visual layout. The safest product shape is:

1. Ingest a teacher-provided source.
2. Extract text and lightweight structure.
3. Identify candidate exercises.
4. Let the teacher review and choose what to use.
5. Generate a Mister F resource draft from the selected material.
6. Keep the normal AI authoring chat available for revision.

## Executive Recommendation

Build this as "Create from source" inside the existing resource authoring flow.

Initial supported inputs:

- `.docx` documents;
- PDFs with selectable text;
- public URLs with readable article/page content.

Defer:

- scanned PDF OCR;
- image-only worksheets;
- JavaScript-heavy sites;
- paywalled, login-only, or access-controlled URLs;
- bulk crawling.

Recommended first version:

- Add a source-ingestion service that normalizes PDF, DOCX, and URL content into the same internal `ExtractedSourceDocument` shape.
- Add an LLM extraction step that turns normalized text into `ExtractedExerciseCandidate[]`.
- Show candidates to the teacher for selection and editing before generating a quiz, practice guide, or roleplay.
- Route the selected material through the existing `resourceFromContext` / `resourceDrafts` flow instead of creating a separate resource-generation pipeline.
- Store source metadata and extraction notes, but avoid storing the full source file permanently unless the teacher explicitly asks to keep it.

The first product goal should be "help the teacher reuse and adapt material they are already allowed to use," not "scrape the internet for worksheets."

## Why This Is Feasible

The core technical pieces are straightforward:

- DOCX files are ZIP-based Office documents and can be converted to text or HTML with mature libraries such as Mammoth.
- PDFs with selectable text can be parsed with PDF.js-based tooling or Poppler-based extraction.
- Public web pages can be fetched and cleaned with Mozilla Readability plus a DOM parser.
- Mister F already has AI draft generation for quizzes, practice guides, and roleplays.
- Mister F already has a `createResourceFromContextDraft` service that turns contextual text into a saved resource draft.

The hard part is not reading bytes. The hard part is preserving enough structure for useful exercise extraction while preventing copyright, layout, and hallucination issues.

## Current Mister F Fit

Current observations from the codebase:

- `misterf-web/package.json` has no upload middleware such as Multer or Busboy.
- `docs/operations/sync-production-to-development.md` explicitly notes that there is no current production upload directory.
- Existing resource generation lives in `src/server/services/resourceDrafts.ts`.
- Existing "create from context" behavior lives in `src/server/services/resourceFromContext.ts`.
- Resource authoring conventions prefer a single AI generation/revision pipeline, followed by manual editing and AI chat revision.

That means this feature should not add separate "generate quiz from PDF" endpoints for every resource type. It should add a source extraction layer, then hand the reviewed source context to the existing draft generator.

## Proposed Architecture

### 1. Source Intake

Input methods:

- upload PDF;
- upload DOCX;
- paste URL;
- paste raw text as a fallback.

Server constraints:

- require authentication;
- run through the existing credit-gated authoring key before LLM calls;
- set file size limits;
- set page/character limits;
- accept only known MIME types and extensions;
- scan/validate file headers rather than trusting extension alone;
- do not follow arbitrary redirects forever;
- block localhost/private-network URLs to prevent SSRF;
- enforce request timeouts.

Recommended limits for V1:

- PDF: 10 MB or 30 pages, whichever is smaller;
- DOCX: 10 MB;
- URL: one page only, 1 MB HTML response cap before cleanup;
- extracted text: cap at 20,000-40,000 characters before LLM processing.

### 2. Normalize Source Documents

Use one internal shape regardless of source type:

```ts
type ExtractedSourceDocument = {
  sourceType: 'pdf' | 'docx' | 'url' | 'text';
  title: string;
  sourceUrl?: string;
  fileName?: string;
  extractedAt: string;
  languageHint?: string;
  chunks: Array<{
    id: string;
    label: string;
    text: string;
    pageNumber?: number;
    heading?: string;
    urlFragment?: string;
  }>;
  warnings: string[];
};
```

The chunk ids are important. They let the UI show where each extracted exercise came from and let the teacher trace model output back to the source.

### 3. Extract Candidate Exercises

Run an LLM over the normalized source and ask for structured candidates:

```ts
type ExtractedExerciseCandidate = {
  id: string;
  sourceChunkIds: string[];
  title: string;
  inferredSkill: string;
  learnerLevel?: string;
  originalInstructions?: string;
  originalText: string;
  suggestedResourceType: 'quiz' | 'practice_guide' | 'roleplay';
  suggestedPrompt: string;
  confidence: 'high' | 'medium' | 'low';
  copyrightRisk: 'low' | 'medium' | 'high';
  warnings: string[];
};
```

The extraction step should not silently create student-facing resources. It should surface candidates and warnings.

### 4. Teacher Review

The review screen should let the teacher:

- preview extracted text;
- select one or more candidate exercises;
- remove copyrighted or irrelevant content;
- edit instructions;
- choose the output resource type;
- decide whether to adapt, summarize, or preserve the original wording;
- confirm they have rights to use the material.

Only after review should Mister F call the existing draft generator.

### 5. Draft Generation

After teacher review, build a context prompt like:

```text
Create a quiz from the selected source material.

Teacher instruction:
Adapt these exercises for an A2 English learner. Keep the target skill focused on past tense.

Selected source excerpts:
[chunk_3, page 2]
...
```

Then call the existing resource draft service:

- quiz: `generateQuizDraft`;
- practice guide: `generatePracticeGuideDraft`;
- roleplay: `generateRoleplayDraft`.

This keeps all normal validation, correction prompts, authoring history, and revision chat behavior intact.

## Source-Specific Extraction

### DOCX

Recommended package: `mammoth`

Why:

- Mature Node package for `.docx`.
- Can convert DOCX to HTML or extract raw text.
- Raw text extraction is enough for many worksheets.
- HTML conversion may preserve headings, lists, and tables better than plain text.

Suggested V1:

- Use Mammoth to extract HTML.
- Convert sanitized HTML to markdown-like text.
- Preserve paragraph breaks, headings, lists, and tables where possible.

Limitations:

- `.doc`, Apple Pages, Google Docs links, and embedded images are out of scope for V1.
- Complex table-based worksheets may need manual review.
- Images inside DOCX need a later OCR/vision step.

### PDF

Recommended V1 approach:

- Use a PDF.js-based Node library for text extraction, such as `unpdf` or `pdfjs-dist`.
- Consider `pdf.js-extract` when coordinates are needed for worksheets with columns or tables.
- Consider Poppler CLI (`pdftotext`) later if server deployment can reliably include system packages.

Why:

- Many teacher PDFs contain selectable text.
- Page-level extraction is enough to identify candidate exercises.
- Coordinate-aware extraction helps reconstruct multi-column worksheets.

Limitations:

- PDFs are presentation files, not semantic documents.
- Reading order can be wrong in columns, tables, and worksheets.
- Scanned PDFs require OCR.
- Answer keys and teacher notes may be mixed with student-facing exercises.

Suggested V1:

- Extract per page.
- Keep page labels.
- Detect suspiciously low text volume and warn: "This looks like a scanned PDF; OCR is not supported yet."
- Ask the teacher to select relevant pages before running the LLM if the PDF is long.

### URL

Recommended package path:

- fetch the URL server-side;
- parse HTML with `jsdom`;
- extract main content with `@mozilla/readability`;
- sanitize the result;
- convert to normalized text.

Why:

- Mozilla Readability is the same family of logic used for reader-mode extraction.
- It strips navigation, ads, sidebars, and unrelated page chrome.
- It works well for article-like pages and simple educational pages.

Limitations:

- It may fail on JavaScript-rendered sites.
- It may miss interactive exercises.
- It should not bypass paywalls, logins, robots rules, or anti-bot controls.
- It should process one user-supplied URL, not crawl a site.

Suggested V1:

- One URL per import.
- Fetch only HTTP(S).
- Reject private IPs and localhost.
- Respect robots.txt for automated URL fetching.
- Show the extracted title, byline/site when available, and a source URL link.

## Copyright and Policy Guardrails

This feature deals with third-party educational content. It must be cautious by design.

Recommended guardrails:

- Require teacher confirmation: "I have the right to use this material with my students."
- Preserve source URL/file name and extraction timestamp.
- Do not automatically publish imported resources.
- Default imported resources to private drafts.
- Keep sharing disabled until the teacher reviews and saves.
- Prefer adaptation and transformation over verbatim copying when the source is third-party.
- Do not extract from paywalled, login-only, or access-controlled URLs.
- Do not bulk crawl websites.
- Respect robots.txt for URL extraction.
- Do not store full source documents indefinitely unless there is a clear user-facing reason.

The product copy should be clear: Mister F helps teachers adapt material; it does not grant reuse rights.

## LLM Prompting Strategy

Use a two-step LLM flow rather than one giant "make me a quiz" call.

Step 1: Extract candidates

- Input: normalized source chunks.
- Output: `ExtractedExerciseCandidate[]`.
- Goal: identify promising material and warnings.
- No resource is created yet.

Step 2: Generate resource draft

- Input: teacher-selected candidates and teacher instruction.
- Output: existing resource draft schema.
- Goal: create a valid Mister F quiz, practice guide, or roleplay.

This split makes review easier and reduces accidental copying.

Prompt rules:

- Preserve factual content from the source.
- Do not invent answer keys unless the exercise type requires one and the answer is inferable.
- Mark uncertain extracted answers as warnings.
- Separate source text from generated adaptation.
- Keep the output self-contained for the student.
- For copyrighted third-party material, prefer transformed/adapted exercises unless the teacher explicitly says to preserve wording and confirms rights.

## UI Proposal

Add a "Create from source" entry point to the resource creation flow.

Suggested flow:

1. Teacher chooses output type or leaves it as "Suggest best type."
2. Teacher uploads a file or pastes a URL.
3. System extracts content and shows a source preview.
4. System finds candidate exercises.
5. Teacher selects candidates and adds an instruction.
6. System generates a draft resource.
7. Teacher lands on the normal edit page with `General`, type-specific tabs, and `Chat IA`.

Useful UI states:

- unsupported file;
- extraction failed;
- scanned PDF detected;
- too much content, choose pages/sections;
- no exercises found, offer "create a practice guide from this text";
- copyright confirmation required;
- generation failed due to credits.

## Implementation Plan

Phase 1: Text and DOCX pilot

- Add a raw text paste option.
- Add DOCX upload.
- Normalize extracted content.
- Use the candidate extraction LLM step.
- Generate quiz/practice guide from selected candidates.

Why start here:

- avoids PDF layout complexity;
- avoids URL crawling/legal complexity;
- proves the teacher review workflow.

Phase 2: PDF selectable text

- Add PDF upload with page-level extraction.
- Add page selection before LLM extraction.
- Detect scanned PDFs and show a clear unsupported-state message.

Phase 3: Public URL extraction

- Add URL intake.
- Add SSRF protections, timeouts, robots.txt handling, and Readability extraction.
- Keep it single-page only.

Phase 4: OCR and rich layouts

- Add OCR for scanned PDFs and image worksheets if demand is strong.
- Consider rendering PDF pages to images and using a multimodal model for OCR/layout analysis.
- Consider coordinate-aware PDF extraction for table-heavy worksheets.

## Cost Analysis

The non-AI extraction cost is low for DOCX, selectable-text PDFs, and static HTML URLs. The expensive path is JavaScript-rendered URL extraction because it requires running a real browser or paying for a managed browser service.

### Cost By Source Type

| Source type | Direct vendor cost | Server cost | Main cost driver | V1 recommendation |
| --- | ---: | ---: | --- | --- |
| Pasted text | $0 | negligible | LLM cleanup/extraction only | Support first |
| DOCX | $0 | low CPU/memory | file upload + Mammoth conversion | Support first |
| Selectable-text PDF | $0 | low to medium CPU/memory | page count and layout complexity | Support in V1/V2 |
| Static public URL | $0 | low network + HTML parsing | timeouts, Readability cleanup, SSRF safety | Support after upload flow |
| JavaScript-rendered URL | $0 if self-hosted, or managed browser fees | high CPU/RAM | headless browser lifecycle | Defer or isolate |
| Scanned PDF / image worksheet | $0 if local OCR, or OCR/vision fees | high CPU/RAM | OCR quality and page rendering | Defer |

### DOCX Runtime Cost

DOCX extraction should be close to free at runtime.

Costs:

- one file upload;
- CPU to unzip and parse XML;
- memory proportional to document size;
- optional HTML-to-text cleanup;
- no required external API.

With a 10 MB file limit, this should run comfortably inside the existing Node server as a short request or background job. The real cost is engineering time and QA for layout edge cases, not compute.

Estimated implementation cost:

- extraction service and tests: 1-2 days;
- UI upload/review integration: 2-4 days;
- end-to-end candidate extraction flow: 2-4 days.

### Selectable PDF Runtime Cost

Selectable PDF extraction is also cheap in direct dollars, but less predictable in CPU and quality.

Costs:

- one file upload;
- parsing pages with PDF.js-style tooling;
- memory and CPU proportional to page count;
- possible worker/job queue if PDFs are large;
- no required external API for text extraction.

With a V1 limit of 30 pages / 10 MB, selectable PDFs can likely run on the app server if concurrency is low. If usage grows, move extraction to a small background worker so PDF parsing does not block normal web requests.

Estimated implementation cost:

- simple text extraction: 2-4 days;
- page selection and warnings: 2-3 days;
- coordinate-aware/layout-aware improvements: 1-2 additional weeks.

### Static URL Runtime Cost

Static URL extraction is cheap when the page returns useful HTML.

Costs:

- one outbound HTTP request;
- HTML parsing with `jsdom`;
- Readability extraction;
- SSRF protection and timeout handling;
- robots.txt lookup if we decide to enforce it.

This path should not require Electron, Playwright, Puppeteer, or a browser. It should be implemented as plain HTTP fetch plus HTML parsing.

Estimated implementation cost:

- safe URL fetcher: 2-4 days;
- Readability extraction and cleanup: 1-2 days;
- review UI integration: 1-2 days.

### JavaScript-Rendered URL Runtime Cost

JavaScript-rendered pages are the expensive and operationally risky case.

To extract these pages, the server would need one of:

- local Playwright/Puppeteer with Chromium;
- a separate self-hosted browser worker;
- a managed browser service such as Browserless.

This is meaningfully different from static extraction. A headless browser has to launch or reuse Chromium, load scripts, execute JavaScript, wait for the DOM to settle, and then extract rendered content. It consumes much more CPU and memory than simple HTML parsing and introduces failure modes such as hanging pages, bot detection, captchas, browser crashes, and zombie processes.

Observed market pricing:

- Browserless lists a free tier and a paid prototyping plan at $25/month billed annually with 20k units/month and 10 max concurrent browsers.
- Browserless Starter is listed at $140/month billed annually with 40 max concurrent browsers.
- DigitalOcean Droplets start at low monthly prices, but compute is still reserved and billed while a Droplet exists, even if powered off. A separate browser worker therefore creates a real standing infrastructure cost.

Self-hosted browser cost estimate:

- If run on the main app server: $0 direct vendor cost, but high risk of degrading Mister F latency and stability.
- If run on a separate worker: likely one additional small-to-medium VPS. Budget roughly $12-$24/month for a low-concurrency worker, plus maintenance.
- Concurrency should be capped to 1-2 browser jobs at first.
- Each browser job should have a hard timeout, for example 15-30 seconds.

Managed browser cost estimate:

- $0/month if the free tier is enough for experiments.
- Around $25/month for a small prototyping tier.
- $140/month or more if this becomes a frequent production feature with higher concurrency.

Recommendation:

- Do not include JavaScript-rendered URL extraction in V1.
- For V1, if Readability cannot extract useful content from static HTML, show a clear message asking the teacher to paste the relevant text or upload a PDF/DOCX.
- If demand is strong later, add a separate browser-rendering worker or managed browser integration. Do not run unbounded headless Chromium inside the main web process.

### OCR Runtime Cost

OCR is the other expensive path.

Local OCR can avoid vendor fees but adds CPU cost and operational complexity. OCR quality for worksheets varies widely, especially with handwriting, columns, tables, screenshots, low resolution, or decorative layouts.

A multimodal LLM/vision approach may be easier to implement for scanned pages, but then the cost is no longer "document conversion"; it becomes AI image understanding per page.

Recommendation:

- Detect scanned PDFs in V1 and return a helpful unsupported-state.
- Add OCR only after measuring teacher demand.
- If added, process OCR as an asynchronous job with page limits and visible cost warnings.

### Storage Cost

Storage should be minimal if the feature keeps only extracted text and metadata.

Recommended storage policy:

- Store extracted text chunks and source metadata.
- Do not permanently store uploaded source files by default.
- Delete temporary uploads after extraction.
- Keep generated Mister F resources as normal durable content.

If teachers need source retention later, add an explicit "keep source file" option and sync the upload directory in production operations. The current production sync docs state that no upload directory exists today, so adding persistent uploads would require operational work.

### Engineering Cost Summary

Rough engineering estimates:

| Scope | Estimated effort | Runtime cost |
| --- | ---: | --- |
| Pasted text only | 2-4 days | negligible plus existing LLM processing |
| DOCX import | 1-2 weeks | negligible direct cost |
| Selectable PDF import | 1-2 weeks | negligible direct cost, moderate CPU |
| Static URL import | 1-2 weeks | negligible direct cost, network + parsing |
| Candidate review UI + generation handoff | 1-2 weeks | existing LLM processing |
| JavaScript-rendered URL support | 1-3 weeks plus ops hardening | likely $25-$140/month managed, or extra VPS cost |
| OCR support | 2-4 weeks | CPU-heavy locally or AI/vision cost per page |

Best first build:

- pasted text;
- DOCX;
- selectable PDF;
- static URL fetch with Readability;
- no headless browser;
- no OCR.

This gives most teacher value with very little non-AI runtime cost.

## Suggested Dependencies

Likely additions:

- multipart upload: `busboy`, `multer`, or a similar Express-compatible upload parser;
- DOCX: `mammoth`;
- PDF: `unpdf`, `pdfjs-dist`, or `pdf.js-extract`;
- URL parsing: `jsdom`, `@mozilla/readability`;
- HTML cleanup / conversion: use existing `dompurify` where appropriate, plus a small HTML-to-text/markdown utility if needed;
- URL safety: IP range checks and strict URL parsing.

Avoid in V1:

- Playwright for URL rendering, unless there is a strong need for JavaScript-heavy pages;
- OCR dependencies, unless scanned worksheets are a launch requirement;
- broad web crawling infrastructure.

## Risks

Technical risks:

- PDF reading order is often wrong.
- Worksheets may use tables or images that text extraction misses.
- OCR adds cost and operational complexity.
- URL extraction may be brittle across websites.
- Long documents can exceed LLM context limits.

Product risks:

- Teachers may expect a perfect worksheet importer.
- Extracted content may include answer keys, teacher notes, or irrelevant boilerplate.
- Imported third-party content may create copyright and sharing issues.
- Automatic conversion can create bad quizzes if teacher review is skipped.

Mitigation:

- keep the feature explicitly review-first;
- show extracted source snippets next to candidates;
- default to private drafts;
- require teacher confirmation;
- make unsupported states clear rather than pretending every document can be parsed.

## Final Recommendation

The feature is feasible and strategically useful.

The highest-value version is not "upload anything and magically create a quiz." The stronger product is "help me extract useful exercises from a source I already have, then adapt them into a Mister F resource I can review."

Recommended first build:

- DOCX and pasted text first;
- PDF selectable text second;
- public URL extraction third;
- OCR later.

Recommended product name:

- "Create from source"
- Spanish UI candidate: "Crear desde una fuente"

## Sources

- Mammoth npm package: https://www.npmjs.com/package/mammoth
- Mozilla Readability repository: https://github.com/mozilla/readability
- Mozilla Readability npm package: https://www.npmjs.com/package/@mozilla/readability
- Readability Node usage note: https://chromium.googlesource.com/external/github.com/mozilla/readability/+/49bc5bfcc7704adc928dcd17e477fd36fd9f5679/README.md
- unpdf PDF extraction library: https://github.com/unjs/unpdf
- pdf.js-extract npm package: https://www.npmjs.com/package/pdf.js-extract
- RFC 9309 Robots Exclusion Protocol: https://www.rfc-editor.org/info/rfc9309/
- Google robots.txt introduction: https://developers.google.com/search/docs/crawling-indexing/robots/intro
