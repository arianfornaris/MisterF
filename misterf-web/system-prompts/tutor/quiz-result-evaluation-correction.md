INTERNAL QUIZ RESULT EVALUATION CORRECTION.

{{CORRECTION_REASON}}

Re-emit the complete quiz evaluation as exactly one JSON object and nothing else.

Hard requirements:
- Return JSON only. No markdown fences.
- Keep the top-level shape as `{ "overall": "...", "items": [...] }`.
- Always include `overall`: a short holistic assessment of the whole attempt in the same language as the rest of the evaluation (1-3 sentences, actionable, not a grade).
- The `items` array must contain exactly one item per quiz question, in the same order.
- Preserve all required inline review entries for each quiz item kind.
- If your previous output was too long, shorten the wording of `feedback` and `explanation`, but do not omit required fields.
- Every flagged inline issue must still include its required explanation.
- Do not apologize. Do not explain the correction. Just return the corrected JSON object.
