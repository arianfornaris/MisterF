INTERNAL APP CONTINUATION.

{{CORRECTION_REASON}}

Re-emit the complete response as exactly one JSON object and nothing else.
Do not use markdown fences.
Do not add explanations or extra text before or after the JSON.
Keep `summary.title` short, Spanish, human-friendly, and suitable for naming the finalized conversation in the sidebar.

The only valid shape is:

{
  "report": {
    "summary": {
      "title": "string",
      "description": "string"
    },
    "practicedTopics": ["string"],
    "progressHighlights": ["string"],
    "difficultyAreas": [
      {
        "title": "string",
        "description": "string"
      }
    ],
    "vocabulary": [
      {
        "term": "string",
        "meaning": "string",
        "example": "string optional"
      }
    ],
    "usefulPhrases": ["string"],
    "recommendations": ["string"],
    "nextSteps": ["string"]
  }
}
