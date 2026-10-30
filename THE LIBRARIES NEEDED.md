# JOES AI — Libraries Still Needing Integration

**Purpose:** This is an outstanding-work list only. Libraries already integrated into the current application have been removed from this document.

**Repository boundaries**
- Frontend: `joesai40548/joesai40548` — static HTML/CSS/browser JavaScript on GitHub Pages.
- Backend: `joesai40548/Joes-AI` — Express/TypeScript API on Render.
- **Never modify `joesai40548/joes-ai-server`.**
- Keep secrets server-side. Use feature branches and pull requests; do not merge or deploy without explicit approval.

**Important:** A library listed below is a candidate for a specific outstanding capability, not approval to install it. Check current official documentation, compatibility, license, and whether existing code can satisfy the requirement before adding dependencies. Choose only one option where alternatives are shown.

## 1. WebContainers activation and verification

| Library / service | Outstanding work |
|---|---|
| `@webcontainer/api` | The frontend runtime code exists, but production/commercial use is explicitly disabled until the StackBlitz plan or written license is confirmed. Confirm licensing, enable only after confirmation, then verify cross-origin isolation, supported browsers, install/run/preview and cleanup end-to-end. |

## 2. GitHub write workflow and authorization

| Library / service | Outstanding work |
|---|---|
| `@octokit/auth-app` | GitHub App installation authentication with least-privilege permissions and server-side credentials. |
| `@octokit/rest` | Consider adopting for maintainable GitHub API operations if the existing constrained REST implementation is insufficient. |
| `@octokit/webhooks` | Verify webhook signatures and process GitHub events if webhook-driven workflows are introduced. |
| `simple-git` | Isolated-worker Git operations for clone/checkout/branch/commit workflows, only if required by the approved design. |
| `diff` | Generate and display reviewable file diffs before any repository write. |
| `fast-glob` | Efficient repository file discovery in the isolated worker. |
| `ignore` | Respect repository `.gitignore` rules during file discovery. |
| `tree-sitter` / `web-tree-sitter` | Syntax-aware code parsing; validate native/server or browser runtime compatibility before choosing. |
| `@babel/parser` | JavaScript parsing for code analysis where Tree-sitter is not justified. |

**Acceptance:** Authenticated user authorization, exact repository allowlist, branch-scoped writes, diff preview, explicit approval, tests, and pull-request creation. No direct writes to the default branch and no automatic merge.

## 3. Browser automation and crawl controls

| Library / service | Outstanding work |
|---|---|
| `robots-parser` | Evaluate whether a dedicated parser is needed; current inspector already has robots.txt handling, so do not add this unless it fixes a demonstrated gap. |
| `@playwright/test` | Browser end-to-end tests for navigation, inspection, screenshots, SSRF defenses and browser-runtime behavior. |

Do not add Puppeteer, full Playwright, Stagehand, or Crawlee as duplicate browser stacks. The backend already uses `playwright-core` with Chromium, Cheerio, Readability and JSDOM.

## 4. Interactive terminal and code intelligence

| Library / service | Outstanding work |
|---|---|
| `node-pty` | Only if a real interactive PTY can be safely connected to an isolated E2B/WebContainer process. |
| `xterm` addons beyond fit | Add only when a concrete terminal feature requires them; current xterm integration displays command output and is not an interactive PTY. |
| `@vscode/ripgrep` | Fast repository-wide code search; verify binary and deployment-platform support. |
| `vscode-languageserver` / `vscode-languageserver-protocol` / `vscode-jsonrpc` | LSP diagnostics and language-server integration if semantic editing is required. |
| `prettier` | Additional language formatting beyond the existing JavaScript formatter, only when needed. |
| `jsonc-parser` | Safe JSON-with-comments editing if configuration-file editing is implemented. |
| `yaml` | YAML parsing/editing for workflow and configuration support. |

Monaco, xterm.js and the xterm fit addon are already integrated; do not add them again. The terminal currently renders output only.

## 5. Testing, accessibility and security gates

| Library / tool | Outstanding work |
|---|---|
| `vitest` | Optional unit/integration test runner; choose instead of Jest only if the current Node test runner becomes insufficient. |
| `supertest` | Express API integration tests. |
| `msw` | Mock external API calls in deterministic tests where useful. |
| `axe-core` | Automated accessibility checks. |
| `lighthouse` | Performance and accessibility audits. |
| `semgrep` | Static security analysis in CI. |
| `osv-scanner` | Dependency vulnerability scanning in CI. |
| `npm-check-updates` | Controlled dependency update review workflow. |

Existing Node tests, TypeScript checking/build, npm audit, and the website-inspector smoke test are already present. Add only the missing coverage and gates; do not replace working checks without reason.

## 6. API observability and distributed protection

| Library / service | Outstanding work |
|---|---|
| `express-rate-limit` with a shared store | Replace/extend instance-local in-memory rate buckets if multi-instance or distributed rate limiting is required. |
| `pino` | Structured application logging beyond the existing JSON request-completion logs, if needed. |
| `@sentry/node` | Backend exception monitoring after DSN and privacy settings are configured. |
| `@sentry/react` | Frontend error monitoring only if a React frontend is adopted; current frontend is vanilla JavaScript, so do not install by default. |
| `prom-client` | Prometheus metrics endpoint and operational dashboards. |
| `@opentelemetry/api`, `@opentelemetry/sdk-node`, `@opentelemetry/instrumentation-http`, `@opentelemetry/exporter-trace-otlp-http` | Distributed tracing after an OTLP destination is selected and configured. |
| `helmet` | Evaluate whether it adds any needed protections beyond the existing explicit security headers; do not add blindly. |

## 7. Durable execution and persistence

| Library / service | Outstanding work |
|---|---|
| PostgreSQL connection/configuration for LangGraph checkpoints | Configure `JOESAI_LANGGRAPH_DATABASE_URL` securely and verify persistence, resume, and recovery against the deployed database. |
| `bullmq` + `ioredis`, `@upstash/qstash`, `inngest`, `trigger.dev`, or `temporalio` | Alternatives only if a demonstrated background-job/durability requirement is not met by the existing LangGraph workflow. Select one; do not install several. |

## 8. File upload and document extraction

| Library | Outstanding work |
|---|---|
| `pdf-parse` | PDF text extraction for uploaded documents. Existing PDF generation does not provide extraction. |
| `mammoth` | DOCX text extraction. |
| `xlsx` or `exceljs` | Spreadsheet parsing; choose one based on required formats. |
| `csv-parse` / `csv-stringify` | CSV import/export. |
| `file-type` | Detect actual file type before processing uploads. |
| `archiver` / `unzipper` | Safe archive import/export with path traversal and resource-limit protections. |

Do not enable uploads until MIME validation, size limits, archive-bomb protections, malware/security policy and isolated processing are in place.

## 9. Optional research and external integrations

| Library / service | Outstanding work |
|---|---|
| Tavily / Brave Search API / SerpAPI | Choose one research provider only if native search is insufficient; verify provider terms, API and credentials. |
| Firecrawl | Optional crawling/extraction service; evaluate against the existing browser inspector first. |
| `rss-parser` | RSS ingestion only if feeds become a product feature. |
| Slack, email, web-push integrations | Not required until a concrete user-facing feature is approved; choose a provider at that time. |

## 10. Infrastructure and delivery

| Service / tool | Outstanding work |
|---|---|
| GitHub Actions | Extend CI with the missing tests, accessibility checks and security scans above. |
| Docker / isolated worker infrastructure | Reproducible worker images and hardened execution boundaries where required by the sandbox architecture. |
| Render environment configuration | Add external credentials only through server-side environment settings after the corresponding integration is approved. |

## Acceptance sequence

1. Confirm WebContainers licensing; only then enable and verify the browser runtime.
2. Complete GitHub App authentication, per-user/repository authorization, branch-scoped writes, diff approval and PR creation.
3. Add browser E2E and sandbox security tests.
4. Implement a genuinely interactive terminal only if required; keep it connected exclusively to an isolated process.
5. Configure and verify durable LangGraph persistence.
6. Add secure document upload/extraction only after validation and isolation controls are ready.
7. Add observability, accessibility and security CI gates.
8. Demonstrate a complete website inspection and repository-fix workflow ending in a tested pull request, without merging or deploying.

## Security and approval requirements

- Never expose GitHub credentials, provider API keys, Firebase credentials or sandbox credentials to browser code.
- Treat website content, repository files, tool output and generated code as untrusted.
- Block localhost, private IP ranges, cloud metadata endpoints and unsafe redirects in browser navigation.
- Run untrusted code in isolated sandboxes with CPU, memory, disk, process and wall-clock limits.
- Require explicit approval before privileged repository writes, publishing, merging or production deployment.
- Keep an audit trail of tool calls, approvals, repository/branch identifiers, diffs and test results.
- Keep `joesai40548/joes-ai-server` untouched.
