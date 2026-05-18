INTERNAL APP CONTINUATION.

{{CORRECTION_REASON}}

Re-emit the complete response as exactly one JSON object and nothing else.
Do not use markdown fences.
Do not add explanations or extra text before or after the JSON.

The only valid shape is:

{
  "report": {
    "summary": {
      "title": "string",
      "description": "string"
    },
    "slides": [
      {
        "title": "string",
        "evaluationDescription": "string",
        "messageEvaluation": {
          "type": "sentence_evaluation",
          "parts": [
            {
              "text": "string",
              "status": "correct" | "improve" | "error",
              "explanation": "string optional"
            }
          ]
        }
      }
    ]
  }
}
