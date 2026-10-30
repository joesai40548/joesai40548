# The Libraries Needed — JOES AI Agent Build Tracker

**Purpose:** Track the libraries, services, and implementation work required to give JOES AI website-navigation, website inspection, GitHub repository analysis and code repair capabilities similar to a coding agent.

**Tracking rule:** A library is not marked *implemented* merely because it appears in package.json. It must be integrated into a real feature, configured safely, and covered by a verification step. Packages marked *candidate* must be checked against the actual code, Node/browser compatibility, current official documentation, and license before installation. Alternatives are choices, not packages to install together.

## Repository boundaries

- **Frontend:** `joesai40548/joesai40548` — static HTML/CSS/browser JavaScript on GitHub Pages.
- **Backend:** `joesai40548/Joes-AI` — Express/TypeScript API on Render. All secrets, GitHub credentials, browser automation and untrusted code execution belong server-side or in isolated sandboxes.
- Do not use or modify `joesai40548/joes-ai-server`.
- Changes are developed on feature branches and proposed as pull requests. No merge or production deployment without explicit approval.

## Current audit snapshot

| Area | Observed state | Progress |
|---|---|---|
| Frontend package manifest | `zustand`, `@tanstack/query-core`, ESLint, Tailwind | Audited |
| Backend package manifest | Express, TypeScript, Zod, Mastra, Mastra MCP, LangGraph, LangGraph Postgres checkpoint, E2B, Google GenAI, Firebase | Audited; integration still needs verification |
| GitHub API integration | Not yet verified end-to-end | Pending |
| Browser navigation / inspection | Not yet verified end-to-end | Pending |
| E2B execution | SDK dependency exists; runtime integration and security need verification | Partial |
| WebContainers | Existing frontend integration work/PR needs review and runtime verification; not assumed production-ready | Partial |
| Agent UI / tool streaming | Not yet verified end-to-end | Pending |
| Automated tests and security gates | To be audited and implemented | Pending |

## Status legend

- [ ] **Planned** — not yet integrated.
- [~] **Audit / verify** — present or previously proposed; actual use or compatibility is not yet proven.
- [x] **Implemented and verified** — feature works and has a repeatable test.
- [—] **Optional / alternative** — only add if a concrete requirement justifies it.
- [!] **Do not install blindly** — duplicate, questionable package name, platform-specific, or external service requiring separate validation.

---

## 1. Agent orchestration and tool calling

| Package | Intended role | Status |
|---|---|---|
| `@mastra/core` | Existing backend agent orchestration and tools | [~] Present in backend manifest; audit usage |
| `@mastra/mcp` | Existing MCP integration | [~] Present in backend manifest; audit usage |
| `@langchain/langgraph` | Existing graph-based workflows | [~] Present in backend manifest; audit usage |
| `@langchain/langgraph-checkpoint-postgres` | Durable workflow checkpoints | [~] Present in backend manifest; verify DB wiring |
| `ai` | Vercel AI SDK for streaming/tool calling, if selected | [—] Alternative; do not duplicate current agent stack without a reason |
| `@ai-sdk/openai` | OpenAI provider for Vercel AI SDK | [—] Optional |
| `@ai-sdk/anthropic` | Anthropic provider | [—] Optional |
| `@ai-sdk/google` | Google provider | [—] Optional; backend already has Google GenAI |
| `@modelcontextprotocol/sdk` | MCP protocol SDK | [!] Compare with existing Mastra MCP before adding |
| `zod` | Input/output validation | [~] Present in backend; frontend/API boundaries need audit |
| `eventemitter3` | Event dispatch | [—] Optional |
| `p-limit` | Concurrency limits | [ ] Planned if needed |
| `p-retry` | Retry policies | [ ] Planned if needed |
| `nanoid` | IDs for jobs/tool calls | [ ] Planned if needed |

## 2. Website browsing, navigation and extraction

| Package | Intended role | Status |
|---|---|---|
| `playwright` | Server-side browser automation | [ ] Planned; run in controlled worker/container |
| `playwright-core` | Browser automation with externally managed browser | [—] Alternative to full Playwright |
| `@browserbasehq/stagehand` | Higher-level AI browser actions | [—] Optional; evaluate after deterministic Playwright |
| `puppeteer` | Browser automation alternative | [—] Alternative; do not install with Playwright without a need |
| `@mozilla/readability` | Extract readable article content | [ ] Planned |
| `cheerio` | Parse HTML server-side | [ ] Planned |
| `jsdom` | DOM implementation for parsing/testing | [—] Optional |
| `crawlee` | Crawling queues and orchestration | [—] Optional |
| `robots-parser` | Respect robots.txt rules | [ ] Planned |
| `screenshot-desktop` | Desktop screenshots | [!] Not suitable for ordinary cloud browser workers; only if desktop capture is required |

## 3. GitHub and repository operations

| Package | Intended role | Status |
|---|---|---|
| `@octokit/rest` | GitHub REST API | [ ] Planned; verify existing connector/API first |
| `@octokit/graphql` | GitHub GraphQL API | [—] Optional |
| `@octokit/auth-app` | GitHub App authentication | [ ] Planned; prefer least-privilege GitHub App |
| `@octokit/webhooks` | Verify and process GitHub webhooks | [ ] Planned |
| `simple-git` | Git CLI wrapper | [ ] Planned for isolated worker |
| `isomorphic-git` | Pure JS Git alternative | [—] Alternative |
| `diff` | Produce readable code diffs | [ ] Planned |
| `fast-glob` | Find repository files | [ ] Planned |
| `ignore` | Respect .gitignore | [ ] Planned |
| `tree-sitter` | Syntax-aware code parsing | [ ] Planned; verify native/runtime support |
| `@babel/parser` | Parse JavaScript/TypeScript-adjacent syntax | [ ] Planned where needed |

## 4. Isolated code execution and sandboxing

| Package / service | Intended role | Status |
|---|---|---|
| `e2b` | Existing E2B SDK dependency in backend | [~] Present; verify secure create/run/stop lifecycle |
| `@e2b/code-interpreter` | E2B code interpreter package | [!] Verify current SDK/package guidance before use; do not add alongside `e2b` automatically |
| `@e2b/sdk` | Previously suggested package name | [!] Verify existence/current official package; do not install based on this list |
| `@webcontainer/api` | Browser-side Node.js/WebContainer runtime | [~] Existing integration work; verify license, browser support and runtime |
| `node-pty` | Pseudo-terminal support | [ ] Planned only if interactive terminal is required |
| `execa` | Spawn subprocesses safely | [ ] Planned for trusted worker operations |
| `cross-spawn` | Cross-platform process spawning | [—] Alternative |
| `which` | Resolve executables | [—] Optional |
| `tar`, `archiver`, `unzipper` | Archive import/export | [ ] Planned as required |
| `chokidar` | Watch workspace files | [ ] Planned if live file watching is required |
| `tmp-promise` | Temporary workspace management | [—] Optional |
| Docker / Firecracker-backed isolation | Infrastructure isolation for untrusted code | [ ] Required architecture/security work; not an npm package |

## 5. Code intelligence and editor

| Package | Intended role | Status |
|---|---|---|
| `monaco-editor` | Browser code editor | [ ] Planned |
| `@monaco-editor/react` | React wrapper | [—] Optional; frontend currently vanilla JS |
| `@vscode/ripgrep` | Fast code search | [ ] Planned; verify binary/platform support |
| `web-tree-sitter` | Browser syntax parsing | [ ] Planned if browser-side parsing is needed |
| `vscode-languageserver` | Language server implementation | [—] Optional |
| `vscode-languageserver-protocol` | LSP protocol types | [—] Optional |
| `vscode-jsonrpc` | JSON-RPC transport | [—] Optional |
| `typescript` | TypeScript compiler and language services | [~] Present in backend dev dependencies |
| `prettier` | Formatting | [ ] Planned |
| `eslint` | JavaScript/TypeScript linting | [~] Present in frontend and backend tooling; verify configurations |
| `stylelint` | CSS linting | [—] Optional |
| `postcss` | CSS transformations | [~] Present in backend toolchain; verify usage |
| `jsonc-parser` | Parse JSON with comments | [ ] Planned if config editing needs it |
| `yaml` | YAML parsing | [ ] Planned if workflow/config editing needs it |

## 6. Testing, debugging and security scanning

| Package / tool | Intended role | Status |
|---|---|---|
| `vitest` | Unit/integration tests | [ ] Planned; choose one test runner |
| `jest` | Unit test runner alternative | [—] Alternative to Vitest |
| `@playwright/test` | Browser end-to-end tests | [ ] Planned |
| `supertest` | Express API tests | [ ] Planned |
| `msw` | Mock API calls | [ ] Planned if useful |
| `nyc`, `c8` | Coverage | [—] Alternatives; select one |
| `fast-check` | Property-based testing | [—] Optional |
| `axe-core` | Accessibility tests | [ ] Planned |
| `lighthouse` | Web performance/accessibility audits | [ ] Planned |
| `depcheck` | Dependency usage checks | [—] Optional; verify maintenance/compatibility |
| `npm-check-updates` | Dependency update review | [ ] Planned for maintenance workflow |
| `semgrep` | Static security analysis | [ ] Planned; CLI/service integration |
| `osv-scanner` | Dependency vulnerability scans | [ ] Planned; CLI/service integration |

## 7. Backend API, observability and streaming

| Package | Intended role | Status |
|---|---|---|
| `express` | Existing API server | [~] Present |
| `cors` | CORS policy | [~] Present |
| `helmet` | HTTP security headers | [ ] Planned / verify |
| `express-rate-limit` | API rate limits | [ ] Planned / verify |
| `compression` | Response compression | [ ] Planned |
| `multer` | Multipart uploads | [ ] Planned if uploads require it |
| `ws` | WebSocket transport | [ ] Planned if required |
| `socket.io` | Realtime transport alternative | [—] Alternative to ws/SSE |
| `undici` | HTTP client | [—] Node built-in/fetch may be sufficient |
| `axios` | HTTP client alternative | [—] Optional |
| `pino`, `pino-pretty` | Structured logging | [ ] Planned |
| `@sentry/node` | Backend error reporting | [ ] Planned |
| `prom-client` | Prometheus metrics | [ ] Planned |

## 8. Durable jobs and workflow execution

| Package / service | Intended role | Status |
|---|---|---|
| `bullmq` + `ioredis` | Redis-backed background jobs | [—] Candidate; choose only if Redis is available |
| `@upstash/redis` | Managed Redis | [—] Alternative infrastructure |
| `@upstash/qstash` | Managed job delivery | [—] Alternative |
| `inngest` | Durable workflows | [—] Alternative |
| `trigger.dev` | Durable background tasks | [—] Alternative |
| `temporalio` | Durable workflow engine | [—] Alternative; heavier operational footprint |

**Decision:** Reuse the existing Mastra/LangGraph capabilities first. Add one queue/workflow system only after identifying a concrete durability gap.

## 9. Database, persistence and retrieval

| Package / service | Intended role | Status |
|---|---|---|
| `firebase`, `firebase-admin` | Existing client auth / server verification | [~] Firebase client present; verify admin/auth server wiring |
| `pg` | PostgreSQL client | [~] Verify actual dependency and checkpoint connection |
| `@supabase/supabase-js` | Supabase client | [—] Only if Supabase is selected |
| `prisma` | ORM alternative | [—] Optional |
| `drizzle-orm` | ORM alternative | [—] Optional |
| `redis` | Cache/queue backend | [—] Optional |
| `@qdrant/js-client-rest` | Vector database client | [—] Optional |
| `chromadb` | Vector store alternative | [—] Optional |
| `@langchain/core` | LangChain abstractions | [—] Add only if LangChain integrations require it |
| `@langchain/textsplitters` | Document chunking | [—] Optional |
| `@xenova/transformers` | Local/browser model inference | [—] Optional; verify current package status and runtime needs |

## 10. File and document processing

| Package | Intended role | Status |
|---|---|---|
| `pdf-parse` | PDF text extraction | [ ] Planned if PDF upload is supported |
| `mammoth` | DOCX extraction | [ ] Planned if DOCX upload is supported |
| `xlsx`, `exceljs` | Spreadsheet support | [—] Alternatives / choose based on requirements |
| `csv-parse`, `csv-stringify` | CSV parsing/export | [ ] Planned if CSV support is required |
| `marked`, `markdown-it` | Markdown rendering | [—] Alternatives; sanitize rendered HTML |
| `highlight.js`, `shiki` | Code highlighting | [—] Alternatives |
| `file-type`, `mime-types` | File type validation | [ ] Planned |
| `sharp` | Image processing | [ ] Planned only if image transformations are needed |
| `@img/sharp-wasm32` | WASM Sharp distribution | [!] Platform-specific; verify before use |

## 11. Authentication and secret management

| Package / service | Intended role | Status |
|---|---|---|
| `jose` | JWT/JWK validation | [ ] Planned if not already covered by Firebase |
| `openid-client` | OAuth/OIDC client | [—] Optional |
| `dotenv` | Local environment loading | [~] Present in backend |
| `@aws-sdk/client-secrets-manager` | AWS secret storage | [—] Only if AWS is selected |
| `@vercel/oidc` | Vercel OIDC identity | [—] Only if deploying workloads on Vercel |
| GitHub App installation credentials | Scoped GitHub access | [ ] Required integration; credentials must stay server-side |

## 12. Web search and research

| Package / service | Intended role | Status |
|---|---|---|
| `@tavily/core` | Search for agent research | [ ] Candidate; verify provider API and current package |
| Brave Search API | Web search provider | [—] Service/API integration; verify official SDK before selecting |
| SerpAPI | Search provider | [—] Alternative |
| Firecrawl | Crawl and extract web pages | [—] Optional service |
| `rss-parser` | RSS feeds | [ ] Planned if news/feed research is required |
| `@browserbasehq/stagehand` | AI-assisted browsing | [—] Listed in browser section; avoid duplicate installation |

## 13. Frontend workspace and terminal UI

| Package | Intended role | Status |
|---|---|---|
| `react`, `react-dom` | React UI | [!] Backend manifest has React, but frontend is currently vanilla JS; do not assume frontend uses React |
| `lucide-react` | React icon library | [—] Backend dependency; frontend may use Lucide browser package or inline icons |
| `zustand` | Client state | [~] Present in frontend |
| `@tanstack/react-query` | React data fetching | [—] Frontend is vanilla JS; query-core already present |
| `react-markdown`, `remark-gfm` | React Markdown rendering | [—] Only if React UI is adopted |
| `react-syntax-highlighter` | React code highlighting | [—] Only if React UI is adopted |
| `xterm` | Browser terminal UI | [ ] Planned |
| `@xterm/addon-fit` | Terminal resize | [ ] Planned with xterm |
| `@xterm/addon-web-links` | Clickable terminal links | [ ] Planned with xterm |
| `@xterm/addon-webgl` | Terminal rendering acceleration | [—] Optional |
| `@dnd-kit/core` | Drag-and-drop UI | [—] Optional |
| `recharts` | React charts | [—] Optional |

## 14. Infrastructure, delivery and monitoring

| Service / package | Intended role | Status |
|---|---|---|
| Render | Existing backend hosting | [~] Existing service; production changes require approval |
| GitHub Actions | CI, tests, security checks | [ ] Planned |
| GitHub Pages | Existing frontend hosting | [~] Existing frontend hosting |
| Docker | Reproducible isolated worker images | [ ] Planned |
| `@opentelemetry/api`, `@opentelemetry/sdk-node` | Tracing | [ ] Planned |
| `@opentelemetry/instrumentation-http` | HTTP tracing | [ ] Planned |
| `@opentelemetry/exporter-trace-otlp-http` | Trace export | [ ] Planned |
| `@sentry/react` | Frontend error reporting | [ ] Planned if needed |
| `@sentry/node`, `prom-client`, `pino` | Backend monitoring/logging | [ ] Planned; avoid duplicate entries |

## 15. Optional integrations

| Package / service | Intended role | Status |
|---|---|---|
| `@mcp-use/server` | MCP server framework candidate | [!] Verify package and compare with Mastra MCP |
| `@slack/web-api` | Slack integration | [—] Optional |
| `nodemailer`, `resend` | Email delivery alternatives | [—] Optional |
| `web-push` | Browser push notifications | [—] Optional |
| `sharp` | Image processing | [—] Optional; listed above |
| `@img/sharp-wasm32` | WASM image processing | [!] Platform-specific |

---

## Implementation sequence and acceptance criteria

The work will proceed in small, testable increments. Update this tracker after each increment; do not bulk-install the catalogue.

| Step | Work item | Acceptance criteria | Status |
|---|---|---|---|
| 0 | Repository/dependency audit | Confirm manifests, entrypoints, Node version, existing agent/sandbox code and current PRs | [~] Initial manifest audit complete |
| 1 | Backend agent foundation | Reuse and verify Mastra/LangGraph; typed tool schemas; bounded steps, timeouts and cancellation | [ ] |
| 2 | GitHub App + repository tools | Read repository metadata/files; create branch; propose diff; commit only to authorized feature branch; PR creation; no merge | [~] Read-only GitHub tools proposed in backend PR #17; live token/build verification pending |
| 3 | Website browser tools | Navigate, screenshot, inspect DOM/accessibility tree, extract readable content; obey robots/rate limits and block private-network targets | [ ] |
| 4 | E2B sandbox lifecycle | Per-task isolated sandbox; resource/time limits; no secrets in guest process; cleanup; test commands and logs | [ ] |
| 5 | WebContainers frontend runtime | Browser Node workspace, install/run/preview; enforce origin isolation and verify licensing/browser support | [ ] |
| 6 | Agent UI and streaming | Show plan, tool activity, files, diffs, terminal output, approvals and cancellation | [ ] |
| 7 | Code intelligence | File search, syntax-aware parsing, Monaco editor, formatting and lint diagnostics | [ ] |
| 8 | Tests and security | Unit/API/E2E tests, dependency scan, secret scan, sandbox escape and SSRF tests | [ ] |
| 9 | Durable jobs and persistence | Resume long tasks safely; persist runs and audit events; add a queue only if needed | [ ] |
| 10 | Research and document tools | Search/crawl/extract and process supported files with provenance | [ ] |
| 11 | CI and observability | CI gates, structured logs, traces, metrics and actionable errors | [ ] |
| 12 | End-to-end acceptance | Demonstrate website inspection and a GitHub code fix from prompt to tested PR without merging/deploying | [ ] |

## Security and approval requirements

- Never expose GitHub App private keys, provider API keys, Firebase service credentials, or sandbox credentials to browser code.
- Use least-privilege GitHub App permissions and per-user authorization checks.
- Treat website content, repository files, tool output and model-generated code as untrusted input.
- Browser automation must block localhost, private IP ranges, cloud metadata endpoints and unsafe redirects (SSRF protection).
- Code must run in an isolated sandbox with CPU, memory, disk, process and wall-clock limits.
- Require explicit user approval before privileged writes, publishing, merging pull requests, or deploying production.
- Record tool calls, approvals, repository/branch identifiers, test outcomes and generated diffs in an audit trail.
- Do not install every candidate package. Prefer existing dependencies and select only one library/service from each alternative group.


## Latest implementation notes — 30 October 2026

- Existing open frontend PR [#16](https://github.com/joesai40548/joesai40548/pull/16) already proposes the WebContainers 1.6.4 upgrade, expired-E2B-sandbox recovery, Python/WebContainers guard, and removal of the unsafe same-origin iframe code runner. It remains **open and unmerged**; do not duplicate that work.
- Existing open backend PR [#9](https://github.com/joesai40548/Joes-AI/pull/9) proposes isolated E2B execution using the `e2b` SDK, with per-run microVM cleanup and output/time bounds. It remains **open and unmerged**.
- Existing open backend PR [#15](https://github.com/joesai40548/Joes-AI/pull/15) raises the Node engine floor to `>=22.19.0`, matching the E2B SDK requirement. It remains **open and unmerged**.
- Backend source audit found `agent-runtime.ts` already builds a Mastra agent and supports configured, administrator-allowlisted **read-only MCP tools**. The MCP server configuration is supplied through `JOESAI_MCP_SERVERS_JSON`; no actual GitHub or browser server connection was verified.
- Backend `langgraph-runtime.ts` already has planner → executor → reviewer workflow nodes and optional Postgres checkpoint/store persistence. Without `JOESAI_LANGGRAPH_DATABASE_URL`, it falls back to process-local memory.
- The current frontend sandbox imports WebContainers `1.6.1` on its default branch; PR #16 updates it to `1.6.4`. The default-branch sandbox therefore must not be described as already upgraded.
- **Next implementation increment:** add and verify a least-privilege GitHub repository read/inspection toolset in the backend, then proceed to browser inspection, controlled code edits, and PR creation. Do not enable repository writes until branch scoping and explicit approval are implemented.

- First new backend implementation increment is proposed in [backend PR #17](https://github.com/joesai40548/Joes-AI/pull/17): four read-only GitHub tools (repository metadata, file tree, bounded file reads, code search) registered with the existing Mastra agent. Tools are disabled unless both a server-side `GITHUB_TOKEN` and exact `JOESAI_GITHUB_ALLOWED_REPOS` allowlist are configured. The PR is **open and unmerged**; live-token and CI/build verification remain outstanding.
- Documentation tracker PR [frontend #20](https://github.com/joesai40548/joesai40548/pull/20) is **open and unmerged**.
