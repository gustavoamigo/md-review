# md-review — Markdown AI-Assisted In-Document Reviewer

A local-first, in-document Markdown review workbench where AI rewrites, section movements, and structural edits appear as precise inline diffs directly inside rendered documents with code highlighting, validated Mermaid diagrams, anchored review comments, and an automated snapshot & version history timeline for safe rollbacks.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural decisions incorporate your new requirements for version snapshots and rollbacks:

- **Confirmed: Automated Snapshotting & Version History**: Every accepted AI suggestion and major manual edit automatically saves an immutable snapshot (with timestamp, change label, prompt instruction, line delta, and full content).
- **Confirmed: Visual History & Diff Drawer**: A slide-over Version History panel allows users to browse past snapshots, inspect full-document unified diffs against the current state, and **Revert to this version** in one click.
- **Confirmed: Quick Undo / Redo**: Instant keyboard shortcuts (`Cmd+Z` / `Ctrl+Z`, `Cmd+Shift+Z` / `Ctrl+Y`) and header toolbar buttons (`↺ Undo`, `↻ Redo`) for immediate iterative rollback without opening the history drawer.
- **Confirmed: AI Provider Default & Flexibility**: Defaults to built-in Google Gemini (`gemini-3.8-flash` via secure server proxy) with immediate one-click toggle to local Ollama (`http://localhost:11434/v1`), LM Studio (`http://localhost:1234/v1`), or custom OpenAI-compatible local/remote endpoints for zero-cloud privacy.
- **Confirmed: Primary Diff Presentation**: Unified inline diff view with high-visibility color-coded additions (green highlight + line indicator) and deletions (red strikethrough highlight), with a fast toggle to side-by-side comparison for multi-paragraph rewrites.
- **Confirmed: Starter Document**: Preloaded with a comprehensive **Technical Architecture Spec** featuring live rendered Mermaid sequence/architecture diagrams, table data, and TypeScript code blocks, plus quick switchers for an open-source README and an engineering incident runbook.
- **Decision: Mermaid Pre-Validation**: Before accepting any diagram edit, md-review compiles the Mermaid syntax in an isolated sandbox. If invalid, it highlights the exact syntax error and triggers an automatic one-click "Auto-Repair Diagram with AI" loop.
- **Decision: Anchored Comments & Persistence**: Comments and proposed reviews stay anchored to specific blocks using content-hash and line-matching heuristics, surviving edits and persisted in browser storage with instant export to `.md` or `.review.json`.

---

## 1. Overview & Core Concept

### What It Does
`md-review` eliminates the tedious "copy text into chat, explain context, copy back, manually diff" loop. Instead, the AI operates *inside* the document:
- **Hover & Selection Edits**: Hover any rendered block (heading, paragraph, list, code block, table, diagram) to trigger the `✏️ Edit Block` button, or highlight any arbitrary sentence to trigger the floating selection bar.
- **Natural Language Transformation**: Prompt arbitrary rewrites ("make this shorter", "number headings", "move this section above Pricing", "convert bullets into a table", "add error handling to this diagram").
- **Exact Diff Inspection**: Edits are displayed as unified inline diffs. The user can 👍 **Accept** (writes directly into the file), 👎 **Reject** (discards), or 🔄 **Revise** (provides feedback to iterate on the proposal).
- **Snapshot Safety Net & Version History**: Every accepted change auto-commits a snapshot. Users can step backwards and forwards with Undo/Redo or explore full past versions in the History Drawer with side-by-side diffing and 1-click restore.
- **Mermaid Guardrails**: Diagrams are parsed and validated prior to commit.
- **Document Anchored Comments**: Add sticky review comments directly alongside blocks, mimicking a GitHub PR review experience on local Markdown files.

### Target Audience & Persona
- Software engineers, technical writers, product managers, and systems architects working with docs in Git (specs, READMEs, RFCs, ADRs, runbooks).

### Key Value
Precision, privacy, fear-free AI experimentation, and speed: no lost context, no accidental overwriting, and instant safety rails to revert any AI edit.

---

## 2. User Experience & Visual Design

### Key User Flows
1. **Document Loading**: The user opens the app to find the pre-loaded Technical Architecture Spec. They can open local `.md` files via file picker, drag-and-drop, or switch between pre-loaded sample specs.
2. **Review & In-Document Prompting**:
   - The user hovers over a paragraph or Mermaid diagram: a subtle floating `✏️` button appears in the margin.
   - Alternatively, selecting any span of text invokes the floating quick-action pill with common prompts ("Make concise", "Check accuracy", "Fix tone") or a custom prompt input.
3. **AI Generation & Inline Diff Preview**:
   - The AI generates a surgical replacement block or section move.
   - The rendered view transforms that block into an inline unified diff with green additions (`+`) and red strikethrough removals (`-`).
4. **Accept / Reject / Revise Cycle**:
   - Clicking 👍 replaces the Markdown source and updates the rendered DOM immediately.
   - Automatically captures a new snapshot labeled with the AI prompt (e.g. `AI: Make this shorter`).
   - Clicking 👎 reverts the block cleanly without changing the document.
   - Clicking 🔄 opens the iterative revision popover with feedback history.
5. **Snapshot Timeline & Rollback Experience**:
   - **Header Controls**: `↺ Undo` and `↻ Redo` buttons show whether past/future states are available, with keyboard shortcuts (`Cmd+Z` / `Cmd+Shift+Z`).
   - **History Button (`⏱️ History`)**: Opens a slide-out drawer showing chronological checkpoints with timestamps, author tags (`AI Edit` / `Manual Edit`), and line delta badges (`+14 / -6`).
   - **Version Diff View**: Selecting a past version shows a visual diff against the current document, with an explicit **"Revert Document to This Version"** button that restores the file while preserving history.
6. **Diagram Validation Safeguard**:
   - If an AI-suggested Mermaid diagram has invalid syntax, a red banner displays the parser error with an automatic "Fix with AI" repair button before accept is allowed.
7. **File Export & Git Patching**:
   - 1-click "Download Markdown", "Copy Raw", or "Export Git Diff (.patch)".

### Visual Identity & Theme
- **Aesthetic Direction**: Clean, high-density developer tool aesthetic inspired by Linear, GitHub PR review, and modern code editors. Focused, calm, distraction-free.
- **Color Palette**:
  - Background: Crisp neutral canvas (`#0F172A` dark / `#F8FAFC` light; with sleek Slate/Zinc palette).
  - Primary Accent: Indigo/Blue (`#2563EB` / `#3B82F6`) for active review states and focused selections.
  - Diff Greens: `#DCFCE7` (light mode text/bg) / `rgba(34, 197, 94, 0.18)` (dark mode) with emerald accents.
  - Diff Reds: `#FEE2E2` (light mode) / `rgba(239, 68, 68, 0.18)` (dark mode) with ruby accents.
  - History Cards: Clean hairline borders, subtle hover highlights, and unboxed metadata timestamps (`10:42 AM · 3 min ago`).
- **Typography & Scale**:
  - Display & Headings: `Plus Jakarta Sans` or `Manrope` with strict title-case discipline.
  - Body Prose: Clear 15px `DM Sans` / `Plus Jakarta Sans` with balanced line-height (1.6) and 68ch measure for optimal reading.
  - Code & Telemetry: `JetBrains Mono` / monospace tabular figures (`font-mono tabular-nums`).
- **Anti-Slop Restraint**:
  - No fake system telemetry tickers, no pill badge sandwiches on cards, no `//` code comment headers.
  - Functional buttons with explicit human labels (`Accept`, `Discard`, `Revise`, `Revert to Version`).

---

## 3. Key Product Decisions & Trade-Offs

| Decision | Chosen Approach | Rationale & Trade-Off |
| :--- | :--- | :--- |
| **Snapshot Storage & History** | In-memory stack + `localStorage` mirrored snapshot array with LRU pruning (up to 50 snapshots per file) | Ensures zero lag when rolling back, survives accidental browser refresh, and stores full snapshots so diffs between any two versions can be calculated instantly. |
| **Undo / Redo Mechanism** | Linear pointer with branch-on-write + snapshot timeline | Provides both the immediate muscle-memory `Cmd+Z` experience and the granular visual checkpoint browser for multi-step audits. |
| **Model Gateway** | Express proxy server for Gemini + direct or proxied local OpenAI/Ollama endpoints | Prevents browser CORS issues when talking to `http://localhost:11434`, protects Gemini API keys on server side, gives user zero-friction switch between local and cloud AI. |
| **Markdown & Mermaid Engine** | `marked` + `highlight.js` + client-side `mermaid` with SVG sandboxing | Fast synchronous rendering with custom renderer extensions for block IDs, line anchors, and inline diff widgets. |
| **Diff Representation** | Unified inline diff (green additions, red deletions) with word-level granularity | Avoids layout shift and maintains reading flow directly within the document context. |
| **Section Move Support** | Full-document AST & block matching | Allows user to request structural shifts ("move this section above Pricing") with exact line and anchor reconciliation. |

---

## 4. Technical Architecture & Data Strategy

### System Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                        md-review Web Interface                        │
│                                                                        │
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │ Top Bar Contract                                                   │ │
│ │ [md-review] ── [↺ Undo] [↻ Redo] [⏱️ History (5)] ── [Download .md] │ │
│ └────────────────────────────────────────────────────────────────────┘ │
│                                                                        │
│ ┌─────────────────────────┐  ┌───────────────────────────────────────┐ │
│ │ Sidebar / Drawer        │  │ Document Viewport                     │ │
│ │ • Outline / Headings    │  │ • Rendered Markdown Blocks           │ │
│ │ • Version History Stack │  │ • Code Blocks (with syntax highlight) │ │
│ │   - v5: AI Section Move │  │ • Mermaid Diagrams (Live Rendered)    │ │
│ │   - v4: AI Shorter      │  │ • Block Hover (✏️ Edit trigger)       │ │
│ │   - v3: User Heading    │  │ • Text Selection Popover              │ │
│ │   - v1: Initial File    │  │ • Unified Inline Diff Card:           │ │
│ │ • Review Comments (3)   │  │   [ - Deleted Original Text       ]   │ │
│ │ • Sample Docs Switcher  │  │   [ + Added AI Rewritten Text     ]   │ │
│ │ • File Open / Drag-Drop │  │   [ 👍 Accept ] [ 👎 Discard ] [ 🔄 ] │ │
│ └─────────────────────────┘  └───────────────────────────────────────┘ │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP / JSON
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Express Backend Server                          │
│                                                                        │
│  POST /api/ai/review-block      POST /api/ai/repair-mermaid            │
│  POST /api/ai/test-connection   POST /api/ai/models                    │
│                                                                        │
│  ┌─────────────────────────┐      ┌──────────────────────────────────┐ │
│  │ @google/genai           │      │ Local OpenAI / Ollama Client     │ │
│  │ (gemini-3.8-flash)      │      │ (http://localhost:11434 / LM)   │ │
│  └─────────────────────────┘      └──────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

### Data Model & Core State
- `DocumentSnapshot`:
  - `id`: string (unique uuid or timestamp)
  - `timestamp`: number
  - `label`: string (e.g. `Initial State`, `AI: Shorten summary`, `Manual edit`)
  - `author`: `'ai'` | `'user'` | `'system'`
  - `content`: string (full markdown snapshot)
  - `instruction`: string | null (the AI prompt that generated this snapshot)
  - `diffSummary`: `{ additions: number, deletions: number }`
- `HistoryState`:
  - `snapshots`: `DocumentSnapshot[]`
  - `currentIndex`: number (active snapshot index for Undo/Redo)
  - `canUndo`: boolean
  - `canRedo`: boolean
- `ReviewProposal`:
  - `id`: unique review ID
  - `blockId` / `targetRange`: block index or character span
  - `instruction`: user's natural language change request
  - `originalText`: untouched text
  - `suggestedText`: AI generated output
  - `diffChunks`: array of diff operations (`insert`, `delete`, `equal`)
  - `isDiagram`: boolean (flags Mermaid validation check)
  - `diagramError`: string | null (Mermaid parser output)
  - `feedbackThread`: array of revision feedback messages
- `ReviewComment`:
  - `id`: string
  - `blockId`: string
  - `text`: comment content
  - `author`: "Gustavo Amigo" / "Reviewer"
  - `resolved`: boolean
- `AIProviderConfig`:
  - `provider`: `'gemini'` | `'ollama'` | `'openai-compatible'`
  - `endpoint`: string (default `http://localhost:11434/v1`)
  - `model`: string (default `gemini-3.8-flash` or `llama3.2`)
  - `apiKey`: optional for external OpenAI endpoints

### Planned Step-by-Step Implementation Flow
1. **Server Proxy (`server.ts`)**: Setup Express server with `@google/genai` (using `gemini-3.8-flash` and `User-Agent: aistudio-build`) and OpenAI/Ollama proxying.
2. **Markdown, Code & Mermaid Rendering Engine**: Install dependencies (`marked`, `highlight.js`, `mermaid`, `diff`). Implement custom renderer with block tracking, code highlighting, and reactive Mermaid SVG rendering.
3. **Snapshot Engine & Undo/Redo System**: Build version management hook with auto-snapshot on AI accept, manual checkpoint creation, `Cmd+Z` / `Cmd+Shift+Z` shortcuts, and the slide-over Version History drawer with side-by-side snapshot comparison and one-click restore.
4. **Inline Diff & Review System**: Compute line-level and word-level diffs; build high-fidelity inline unified diff card with 👍 Accept, 👎 Discard, and 🔄 Revise action loops.
5. **Mermaid Validation & Self-Healing**: Parse diagrams in sandbox; detect syntax breakages; automate the "Revise & Fix" workflow before user acceptance.
6. **Interactive Controls & Sidebar**: Quick prompt popovers on text selection, block hover handles, table-of-contents outline, review comment threads, and sample document selector.
7. **Creator & Customer Testimonial Modal**: Authentic attribution from Gustavo Amigo and technical reviewer quotes, plus product name suggestions ("DiffDoc", "ReviewMD", "MarkSmith", "Vellum").
