---
name: live-product-qa
description: Use when a change needs to be exercised as a real logged-in user rather than proved by tests — roadmap items that end in "pending live QA", full-cycle flows (create → share → attempt → evaluate → report), or any behavior whose claim is about what a person sees. Covers the reusable QA accounts, driving the Browser pane, verifying persistence in SQLite, and the one thing that genuinely needs the founder's say-so.
---

# Live Product QA

**Do not hand Arian a click-through as though you could not do it yourself.**
You can. Logged-in QA against the local server is yours to run end to end, and
has been since 2026-07-20 (V3 §1.3, four AI modification operations against real
inference). Roadmap items sat in `[~]` for weeks because this was framed as a
capability limit; it never was.

Pair with `restart-local-server` (the app serves compiled `dist/` — rebuild
before you test), `testing-conventions` (what belongs in a test instead), and
`llm-credit-gate` (what spends money).

## The Only Real Boundary: Money, Not Capability

Decide which kind of flow you are testing before you start:

- **Costs nothing** — anything that never reaches an LLM: duplication, folders,
  archive/restore/Trash, sharing and grants, participation listings, catalog
  filters, routing, i18n, page rendering, permissions. **Run these immediately
  without asking.** Reporting them as "pending your click-through" is pure waste.
- **Spends Arian's credit** — every generation, revision, evaluation, tutor
  turn, report, and participation summary draws down his OpenRouter key. **Ask
  first, and ask in the honest currency:** name the flow and roughly how many
  LLM calls it takes ("a full roleplay cycle plus its summary, ~8 calls"). Do
  not quote dollars — cost per cycle has never been measured, and pretending
  otherwise is the error this project already dropped an item over.

Two more limits worth stating plainly when they apply:

- **Local is not production.** Local QA proves the code path. A claim about
  production — a seeded demo, a real signup, a deploy, a share preview rendering
  in WhatsApp — needs a production run, which is a different decision.
- **"Works" is not "is good."** You verify behavior. Whether the experience is
  right is Arian's judgment; report what you saw, do not pronounce it good.

## The QA Accounts

They already exist in `misterf-web/data/misterf.sqlite`. Reuse them; do not
create a new account for every session.

| Account | Password | Profiles |
| --- | --- | --- |
| `qa.fable@misterf.local` | `QaFable2026!` | `QA Fable` (owner/author), `Participante QA` (same user, second profile) |
| `qa.student@misterf.local` | `QaStudent2026!` | `Estudiante QA` (a genuinely separate user) |
| `qa.landing@misterf.local` | — | `QA` |

Pick the right one for what you are testing. `Participante QA` gets you a
collectable attempt cheaply, without a second login — enough for participation
*listings*. But it is the **same user**, so it cannot test anything gated on the
viewer differing from the participant; use `qa.student@misterf.local` for that
(see the traps at the end).

### Creating A New One

Sign up through the UI like any user — that path already provisions the
OpenRouter key with the welcome credit (`ensureOpenRouterKeyForUser` in
`auth/forms.ts:317`), so the account can spend inference immediately. The one
thing the UI cannot give you is verification: there is no dev bypass and no
mail. Flip it directly:

```bash
node -e "const D=require('better-sqlite3');const db=new D('data/misterf.sqlite');db.prepare(\"UPDATE users SET email_verified=1 WHERE email=?\").run('qa.new@misterf.local');console.log('verified')"
```

Use `@misterf.local` addresses so QA data is greppable and never collides with a
real user.

## Driving The Browser Pane

Open the app with `preview_start {url: "http://localhost:5005/"}`, then:

- **Prefer `javascript_tool` over native clicks and scrolling.** Native
  `computer` clicks time out on this app often enough that they are not worth
  the round trips. Submit forms with `document.querySelector('form[action*="…"]').submit()`
  and read state with `fetch(..., {credentials: 'same-origin'})` + `DOMParser`.
- **Log in** by filling `input[name="email"]` / `input[name="password"]` and
  submitting the form — do not hand-roll the POST, the CSRF token is already in
  the form.
- **A stale `misterf_lang` cookie outranks `Accept-Language`.** The pane carries
  cookies between sessions, so the root can serve a language you did not ask
  for. Clear it (`document.cookie = 'misterf_lang=; Max-Age=0; path=/'`) before
  concluding anything about locale negotiation.
- **Filter by `offsetParent` before believing an error is on screen.** Modal
  markup includes hidden state templates, so `textContent` reports text the user
  cannot see.
- **Screenshot for what a person would judge** — layout, empty states, mobile at
  `resize_window {preset: "mobile"}`. Use `read_page`/`fetch` for anything
  textual; it is faster and quotable.

## Verify Where The Truth Is

A screenshot proves rendering. It does not prove persistence, and most QA claims
are about persistence.

- **Read SQLite directly** (`readonly: true`) to confirm what was written:
  counts of attempts, share links, grants, summaries; the shape of the stored
  draft; `archived_at`. This is how you catch a copy that silently carried
  participation, or an apply that previewed but did not persist.
- **Check the server log for the run.** Paths are
  `~/.pm2/logs/misterf-web-out-0.log` and `-error-0.log` — note the `-0` suffix,
  which `restart-local-server` omits. Application logs are JSON lines: grep the
  event you expect (`resource_duplicated`, `quiz_follow_up_conversation_created`)
  to confirm it fired with the right ids, and confirm the error log gained
  nothing during the session.
- **Exercise the negative path too**, not only the happy one: discard as well as
  apply, the empty state as well as the populated one, the non-owner as well as
  the owner.

## Finishing

- **Clean up what you created.** Archive or remove test resources so the
  fixtures stay usable for the next session. Leaving `Copia de Copia de …` piles
  up until nobody trusts the account.
- **Update the roadmap item in the same change**, with what you actually
  exercised and what you verified it against — DB rows, log events, the screens
  you looked at. "QA passed" with no evidence is not a record.
- **Write down anything that looks like a violation and is not.** These are the
  most valuable lines in a QA note, because the next reader will hit the same
  thing and re-investigate it. Example: a duplicated quiz *does* get a
  `resource_share_links` row — not copied, but minted lazily by
  `renderQuizShowPage` for the share modal, with a fresh id nobody has been
  given.
- **Report failures as failures.** If something did not work, say so with the
  output; if you skipped part of the flow, say which part and why.

## Two Traps This Skill Was Written After

**A single account with two profiles cannot test an owner's view of someone
else's work.** The owner read-only result views are gated on
`attempt.userId !== viewer.id` (`roleplays/handlers.ts:1336`, and the quiz
equivalent), so a second profile on the *same* user falls through to the
learner's own view — complete with learner action buttons. It looks exactly like
a bug in the owner view and is not. Testing that path needs a **second real
user**; `qa.student@misterf.local` / `QaStudent2026!` exists for it.

**A fresh account cannot finish everything, and the reason is not "it ran out."**
OpenRouter reserves a request's *maximum possible* output against the key limit,
not its actual cost, so a welcome-credit key (`OPENROUTER_USER_KEY_LIMIT_USD`,
`0.05` locally and in production) is refused outright for operations whose model
advertises a large output budget — reported usage can still be `0` at the moment
of refusal. Raise the QA account's limit with `updateOpenRouterUserKeyLimit`
(`services/openRouterUserKeys.js`, the same call the superadmin tool makes)
rather than concluding the feature is broken. Say so when you do: it changes a
spend guardrail.

Related: OpenRouter's usage figures lag, so do not expect to read back the cost
of a run immediately after it finishes.
