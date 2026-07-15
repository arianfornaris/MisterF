INTERNAL APP CONTINUATION.
{{CORRECTION_REASON}}

Re-emit the complete response as exactly one JSON object that satisfies this
TypeScript contract. Do not use markdown fences, comments, explanations, or
fields outside the contract.

```ts
interface RoleplayDraft {
  title: string;
  /**
   * The complete learner-facing setup in one field. May use headings, bold,
   * lists, quotes, and links as Markdown.
   */
  description: string;
  level: 'A1-A2' | 'B1-B2' | 'C1';
  characters: [LearnerCharacter, AiCharacter];
}

interface LearnerCharacter {
  id: 'learner';
  /** One id from the available avatar list. */
  avatarId?: string;
  name: string;
  description: string;
}

interface AiCharacter {
  id: 'ai';
  /** One id from the available avatar list. */
  avatarId?: string;
  name: string;
  description: string;
}
```

Available avatar ids:
{{ROLEPLAY_AVATAR_OPTIONS}}
