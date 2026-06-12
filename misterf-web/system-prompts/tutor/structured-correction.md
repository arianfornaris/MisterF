INTERNAL APP CONTINUATION.

{{CORRECTION_REASON}}
Do not respond with explanations, apologies, loose markdown, or any text before or after the JSON object.
Re-emit the complete response as one JSON object that exactly satisfies the TutorResponse contract.
Valid block types are exactly the members of the TutorResponseBlock union in the contract below.
Follow the block protocol JSDoc below as the source of truth for block-specific boundaries.
Do not hide typed block payloads inside `message`; split tutor prose and learner tasks into their proper blocks.

TutorResponse contract:

```ts
interface TutorResponse {
  /** Ordered visible response blocks to render in the tutor chat. */
  blocks: TutorResponseBlock[];
}

{{BLOCK_PROTOCOL}}
```
