INTERNAL APP CONTINUATION.
{{CORRECTION_REASON}}

Re-emit the complete response as exactly one JSON object and nothing else.
Do not use markdown fences.
Do not add explanations or extra text.

The only valid top-level shape is:

{
  "assistantMessage": "...",
  "draft": {
    "title": "...",
    "description": "...",
    "scenario": "...",
    "level": "...",
    "pedagogicalFocus": "...",
    "maxLearnerTurns": 6,
    "characters": [
      {
        "id": "learner",
        "name": "...",
        "description": "..."
      },
      {
        "id": "ai",
        "name": "...",
        "description": "..."
      }
    ]
  }
}

Rules to preserve:
- draft.characters must contain exactly two characters.
- character ids must be exactly "learner" and "ai".
- maxLearnerTurns must be an integer from 1 to 20, or null.
- draft.description, draft.scenario, and draft.pedagogicalFocus may use simple
  Markdown.
- Do not include learnerContext, targetTopic, learningGoals, languageFocus,
  evaluationFocus, instructions, openingLine, icon, role, persona,
  shortDescription, speakingStyle, or learnerCharacterId.
- Return JSON only.
