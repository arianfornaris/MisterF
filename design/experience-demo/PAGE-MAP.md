# Production-view coverage

This maps every top-level EJS view in `misterf-web/views/` to a static proposal.
It is a **page-level design inventory**, not a claim that all production fields,
permissions, resource types, runtime blocks, modal variants, or data states have
been implemented. No production templates were changed. The landing is a
reference adaptation; the existing production landing remains the baseline.

Open “Todas las páginas” in the demo for the interactive index. Prefix screen
IDs with `#learn/` or `#teach/`. Public screens automatically use the public
shell. The original `chat` screen is retained as a compatibility route; tutor
conversation and roleplay now have separate entrypoints.

| Production view | Demo screen(s) | Design focus |
| --- | --- | --- |
| `landing.ejs` | `landing` | Existing editorial direction, reference mockups |
| `auth.ejs` | `login`, `register`, `forgot-password`, `reset-password` | Clear public forms with contextual warmth |
| `auth_message.ejs` | `verify-email` | Code entry, next step, simulated resend |
| `change_password.ejs` | `password` | Quiet account form |
| `profile-onboarding.ejs` | `onboarding` | Mode, instruction language, personal context |
| `profiles-list.ejs` | `profiles` | Distinct contextual profiles |
| `profiles-form.ejs` | `profile-new`, `profile-edit` | Profile, language, tutor configuration |
| `settings.ejs` | `settings` | Account navigation and grouped settings |
| `credits.ejs` | `credits` | Balance/package layout without invented pricing |
| `chat.ejs` | `conversation`, `conversation-summary`, `guide-session` | Conversation, source context, summary |
| `progress.ejs` | `progress`, `vocabulary`, `activity-log` | General, vocabulary, history |
| `resources-list.ejs` | `library`, `folder` | Gallery, filtering, folder trail |
| `resources-shared.ejs` | `shared`, `quiz-shared` | Invitation, guest/account context, result notice |
| `resources-trash.ejs` | `trash` | Reversible archive presentation |
| `quizzes-new.ejs` | `quiz-new` | Prompt, reference material, format preview |
| `quizzes-show.ejs` | `quiz-detail` | Intent, contents, attempt/history, options |
| `quizzes-authoring.ejs` | `quiz-edit` | Editable metadata/blocks, revision preview |
| `quizzes-attempt.ejs` | `quiz-attempt` | Selection, completion, written response |
| `quizzes-evaluating.ejs` | `quiz-evaluating` | Pending/completion/error navigation |
| `quizzes-result.ejs` | `quiz-result` | Answer feedback, follow-up, guest context |
| `quizzes-participation.ejs` | `quiz-participation` | Aggregate and individual participation |
| `quizzes-shared.ejs` | `quiz-shared` | Shared quiz entry |
| `roleplays-new.ejs` | `roleplay-new` | Situation-based creation |
| `roleplays-show.ejs` | `roleplay-detail` | Mission, character, preview/start |
| `roleplays-edit.ejs` | `roleplay-edit` | Scenario, character, opening message |
| `roleplays-attempt.ejs` | `roleplay-attempt` | Character conversation and completion |
| `roleplays-result.ejs` | `roleplay-result` | Communicative strengths and turn feedback |
| `roleplays-participation.ejs` | `roleplay-participation` | Teacher view of attempts |
| `practice-guides-new.ejs` | `guide-new` | Guided-practice creation |
| `practice-guides.ejs` | `guide-detail` | Guide purpose, steps, actions |
| `practice-guides-authoring.ejs` | `guide-edit` | Tutor instructions and context |
| `practice-guides-report.ejs` | `guide-report` | Qualitative report and next practice |
| `practice-guides-participation.ejs` | `guide-participation` | Session participation |
| `media-library.ejs` | `media` | Scene gallery and search |
| `media-library-show.ejs` | `media-detail` | Image, script, audio-state location |
| `media-library-new.ejs` | `media-new` | Scene prompt and content choices |
| `media-library-authoring.ejs` | `media-edit` | Visual summary and script editing |
| `media-library-variation-new.ejs` | `media-variation` | Source scene, adaptation, level |
| `media-library-trash.ejs` | `media-trash` | Archived scenes |
| `superadmin.ejs` | `admin` | Searchable fictitious users, quiet management UI |
| `privacy.ejs` | `privacy` | Legal reading layout, illustrative text only |
| `terms.ejs` | `terms` | Legal reading layout, illustrative text only |

## Additional proposed screens

- `home`: separate learning and teaching home treatments.
- `create`: common entry to the three creation formats.
- `empty`, `error`: empty library and recoverable-operation state examples.
- `pages`, `design-guide`, `about`: design review and continuation tools.

## Connected example flows

1. `library` → matching resource detail → attempt/session → result/report.
2. `create` / resource-specific creation → format-specific editor → detail.
3. Detail → options → sharing preview / editor / participation.
4. Editor → modification dialog → proposal → apply to local form.
5. `quiz-shared` → guest attempt → guest evaluating → guest result.
6. `media` → selected scene detail → editor or variation.
7. `register` → verify example → onboarding → selected mode's home.
8. `login` → recovery → reset example → login.
9. `settings` → profiles, password, credits, public information.

## Deliberate limitations

- Every resource family uses one detailed representative fixture; other gallery
  cards illustrate visual variety, not independent authored resource records.
- Fields can be edited locally, but navigation discards drafts. Save controls
  explicitly confirm a simulation. Static previews do not reflect every edit.
- Revision proposals, AI summaries, open-answer feedback, and conversations are
  predefined. Only the two closed quiz answers are checked against local keys.
- Media has images and scripts; audio availability is represented by an explicit
  pending example, not a fake play control. No media is generated.
- The share dialog previews a local guest quiz. It does not publish anything,
  generate a real public link, or implement permission settings/QR codes.
- Public forms never send email, sign in, register users, or change credentials.
- Credit packages are layout placeholders, with no new prices or checkout.
- Legal copy is explicitly a layout sample. Do not deploy it as policy text.
- Profile mode choices and teacher dashboard figures are visual proposals.
- Admin controls contain no real users, secrets, balance mutations, or access
  management. The page is discoverable in the demo index only for design review.

Production integration needs a separate pass through every field, permission,
runtime block, state, and locale. The page coverage above must not be described
as production feature parity.
