# Agent platforms, SDKs and frameworks for building an Excel (.xls/.xlsx) and CSV agent (state as of 2026-11-16)

Research date: 2026-11-16. Official pages were fetched live on that date unless a finding is marked "secondary source". Identifiers in backticks are copied as written in the fetched docs.

## 1. Claude Code: custom subagents, Skills, and Anthropic's official `xlsx` Skill

### Takeaway
In Claude Code a spreadsheet specialist is two plain files: a subagent at `.claude/agents/<name>.md` (YAML frontmatter + system prompt) and a Skill at `.claude/skills/<name>/SKILL.md` (frontmatter + instructions + optional scripts). Anthropic's own `xlsx` Skill is a short instruction file plus a LibreOffice-backed `scripts/recalc.py`; it tells Claude to use `openpyxl` for formulas/formatting, `pandas` for bulk data, and to always recalculate and ship zero formula errors.

### Cited Findings

**Subagent files (`.claude/agents/*.md`)**
- Subagent files are Markdown with YAML frontmatter; the body after the closing `---` is the system prompt. Only `name` and `description` are required. Field names are case-sensitive camelCase and unrecognized fields are silently ignored. — [Claude Code subagents docs](https://code.claude.com/docs/en/sub-agents)
- Supported frontmatter fields: `name` (max 256 chars, no `:`), `description`, `tools` (allowlist, comma-separated string or YAML list; default inherits all tools), `disallowedTools` (denylist, applied first), `model` (`sonnet`, `opus`, `haiku`, `fable`, a full model ID, or `inherit`), `permissionMode` (`default`, `acceptEdits`, `auto`, `dontAsk`, `bypassPermissions`, `plan`, `manual`), `maxTurns`, `autoCompactWindow` (100000 to 1000000, needs v2.1.296+), `skills` (preloads full skill content, first 32 names), `mcpServers` (server name or inline definition), `hooks`, `memory` (`user`, `project`, `local`), `background`, `omitClaudeMd` (v2.1.271+), `effort` (`low`, `medium`, `high`, `xhigh`, `max`), `isolation` (`worktree`), `color`, `initialPrompt`, `experimental` (`cacheTtl`: `5m` or `1h`). — [Claude Code subagents docs](https://code.claude.com/docs/en/sub-agents)
- Model resolution order: per-invocation `model` parameter, then the `model` field, then `CLAUDE_CODE_SUBAGENT_MODEL`, then the parent conversation's model. — [Claude Code subagents docs](https://code.claude.com/docs/en/sub-agents)
- Location priority (highest first): managed settings; `--agents` CLI flag (JSON, session only); `.claude/agents/` (project); `~/.claude/agents/` (user); plugin `agents/` directory. Plugin subagents do not support `hooks`, `mcpServers` or `permissionMode`. — [Claude Code subagents docs](https://code.claude.com/docs/en/sub-agents)
- `--agents` takes a JSON object keyed by agent name with `description`, `prompt`, `tools`, `model` etc. — [Claude Code subagents docs](https://code.claude.com/docs/en/sub-agents)
- Subagents can spawn subagents up to three layers deep by default (`CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH`; set `1` to disable nesting); `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS` defaults to 20. — [Claude Code subagents docs](https://code.claude.com/docs/en/sub-agents)
- Built-in subagents: `Explore`, `Plan`, `general-purpose`, `claude`, `statusline-setup`, `claude-code-guide`. — [Claude Code subagents docs](https://code.claude.com/docs/en/sub-agents)

**Skills (`SKILL.md`) in Claude Code**
- A skill is a directory containing `SKILL.md` with YAML frontmatter followed by Markdown. All fields are optional in Claude Code; `description` is the one recommended. — [Claude Code skills docs](https://code.claude.com/docs/en/skills)
- Claude Code frontmatter fields: `name`, `description`, `when_to_use`, `argument-hint`, `arguments`, `disable-model-invocation`, `user-invocable`, `allowed-tools`, `disallowed-tools`, `model`, `effort`, `context` (`fork`), `agent`, `background`, `hooks`, `paths`, `shell`, plus spec fields `metadata`, `license`, `compatibility`. — [Claude Code skills docs](https://code.claude.com/docs/en/skills)
- Skills uploaded to claude.ai or the Skills API, or packaged with `package_skill.py`, accept only `name`, `description`, `license`, `compatibility`, `metadata` and `allowed-tools`; other fields cause a hard error at upload. — [Claude Code skills docs](https://code.claude.com/docs/en/skills)
- Limits: `description` + `when_to_use` truncated at 1,536 characters in the listing; keep `SKILL.md` under 500 lines; after compaction up to 5,000 tokens per skill are re-attached within a shared 25,000-token budget. — [Claude Code skills docs](https://code.claude.com/docs/en/skills)
- Locations: enterprise (managed settings dir), personal `~/.claude/skills/<skill-name>/SKILL.md`, project `.claude/skills/<skill-name>/SKILL.md`, nested `<subdir>/.claude/skills/...`, `--add-dir` directories, plugin `<plugin>/skills/<skill-name>/SKILL.md` (invoked as `/plugin-name:skill-name`). Enterprise overrides personal, personal overrides project. — [Claude Code skills docs](https://code.claude.com/docs/en/skills)
- Supporting files (`reference.md`, `scripts/helper.py`) load only when needed; scripts are executed, not loaded. Substitutions include `$ARGUMENTS`, `$0`/`$1`, `${CLAUDE_SKILL_DIR}`, `${CLAUDE_PROJECT_DIR}`, `${CLAUDE_PLUGIN_ROOT}`. — [Claude Code skills docs](https://code.claude.com/docs/en/skills)
- Plugin install syntax: `/plugin install <name>@<marketplace>`. — [Claude Code skills docs](https://code.claude.com/docs/en/skills)
- Progressive disclosure costs: Level 1 metadata ~100 tokens per Skill (always loaded); Level 2 `SKILL.md` body under 5k tokens (when triggered); Level 3 resources cost nothing until accessed. — [Agent Skills overview](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview)
- API/claude.ai field rules: `name` max 64 chars, lowercase letters/numbers/hyphens, no reserved words `anthropic` or `claude`; `description` max 1,024 chars. — [Agent Skills overview](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview)

**Anthropic's `xlsx` Skill (anthropics/skills)**
- Frontmatter: `name: xlsx`; the description triggers when a spreadsheet file (.xlsx, .xlsm, .xltx, .csv, .tsv) is the primary input or output, and excludes Word/HTML deliverables, standalone scripts, database pipelines and Google Sheets API work; `license` points to LICENSE.txt. — [xlsx SKILL.md](https://raw.githubusercontent.com/anthropics/skills/main/skills/xlsx/SKILL.md)
- Tool selection: `openpyxl` to create/edit with formulas and formatting; `pandas` (`read_excel`, `to_excel`) for bulk data; `markitdown file.xlsx` for a quick look (no cell coordinates); two `load_workbook` passes to read both formulas and values. — [xlsx SKILL.md](https://raw.githubusercontent.com/anthropics/skills/main/skills/xlsx/SKILL.md)
- Output rules: professional font (Arial or Times New Roman), zero formula errors, live formulas instead of Python-computed hardcoded values, follow the user's spec literally, document assumptions, and when editing an existing file match its conventions and leave existing formulas unchanged. — [xlsx SKILL.md](https://raw.githubusercontent.com/anthropics/skills/main/skills/xlsx/SKILL.md)
- Recalculation is mandatory when formulas exist: `python scripts/recalc.py output.xlsx [timeout_seconds]` (default 30 s). LibreOffice computes formulas on a copy and writes values back. JSON output fields: `status` (`success` or `errors_found`), `total_formulas`, `total_errors`, `error_summary`, `locations_truncated`, and a `not_computed` list for functions LibreOffice cannot evaluate. — [xlsx SKILL.md](https://raw.githubusercontent.com/anthropics/skills/main/skills/xlsx/SKILL.md)
- Formula compatibility: use Excel 2007-era functions; `_xlfn.` prefix needed for TEXTJOIN, CONCAT, IFS, SWITCH, MAXIFS, MINIFS; avoid XLOOKUP, XMATCH, SORT, FILTER, UNIQUE, SEQUENCE. — [xlsx SKILL.md](https://raw.githubusercontent.com/anthropics/skills/main/skills/xlsx/SKILL.md)
- Financial-model conventions: blue text for hardcoded inputs, black for formulas, green for cross-sheet links, red for external links, yellow fill for key assumptions; currency `$#,##0`, percentages `0.0%`, multiples `0.0x`, negatives in parentheses. — [xlsx SKILL.md](https://raw.githubusercontent.com/anthropics/skills/main/skills/xlsx/SKILL.md)
- openpyxl gotchas listed: saving a `data_only=True` workbook permanently replaces formulas with values; `.xlsm` needs `keep_vba=True`; saving can drop text boxes, shapes and slicers. — [xlsx SKILL.md](https://raw.githubusercontent.com/anthropics/skills/main/skills/xlsx/SKILL.md)
- Dependencies: `openpyxl`, `pandas`, `markitdown`, LibreOffice (`soffice`, via `scripts/office/soffice.py`); files `scripts/recalc.py`, `scripts/office/soffice.py`, LICENSE.txt. — [xlsx SKILL.md](https://raw.githubusercontent.com/anthropics/skills/main/skills/xlsx/SKILL.md)
- Repo stats: about 195.6k stars, 23.0k forks, 63 commits on `main`; folders `skills/`, `spec/`, `template/`, `.claude-plugin/`. README states skills are "provided for demonstration and educational purposes only". — [anthropics/skills](https://github.com/anthropics/skills)

**Installing skills per surface**
- Claude Code: `/plugin marketplace add anthropics/skills`, then `/plugin install document-skills@anthropic-agent-skills` or `/plugin install example-skills@anthropic-agent-skills`. — [anthropics/skills](https://github.com/anthropics/skills)
- claude.ai: pre-built document Skills are active with no setup when creating documents; custom Skills are uploaded as zip files on Pro, Max, Ultra, Team and Enterprise plans with code execution enabled. — [Agent Skills overview](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview)
- API: reference pre-built `skill_id` values `pptx`, `xlsx`, `docx`, `pdf`, or upload custom skills via `/v1/skills`. — [Agent Skills overview](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview)
- Custom Skills do not sync across surfaces: claude.ai, API and Claude Code each need their own copy. — [Agent Skills overview](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview)
- Runtime differs by surface: API has no network and no runtime package installation; Claude Code has full network access; claude.ai varies by user/admin settings. — [Agent Skills overview](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview)
- Licensing conflict: the repo README says the document skills (docx, pdf, pptx, xlsx) "are also open source (Apache 2.0)" — [anthropics/skills](https://github.com/anthropics/skills); the xlsx `SKILL.md` frontmatter instead points to a separate LICENSE.txt for full terms — [xlsx SKILL.md](https://raw.githubusercontent.com/anthropics/skills/main/skills/xlsx/SKILL.md). The LICENSE.txt itself was not read.
- Availability conflict: the platform overview says "The pre-built document Skills (PowerPoint, Excel, Word, PDF) are not available in Claude Code" — [Agent Skills overview](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview); the repo offers them as the `document-skills` plugin for Claude Code — [anthropics/skills](https://github.com/anthropics/skills).

### Inferences
- The two statements about Claude Code are compatible in practice: the skills are not bundled, but the repo copy can be installed as a plugin. A developer should expect to install LibreOffice locally for `recalc.py` to work.
- A minimal spreadsheet subagent built only from documented fields would look like this (illustrative, not from the docs):
  ```markdown
  ---
  name: spreadsheet-analyst
  description: Reads, cleans, analyses and writes .xlsx/.xls/.csv files. Use for any spreadsheet task.
  tools: Read, Write, Edit, Bash, Glob, Grep
  model: sonnet
  skills: xlsx
  permissionMode: acceptEdits
  maxTurns: 40
  ---
  You are a spreadsheet specialist. Never overwrite the source file; write to a copy...
  ```
- The xlsx Skill does not mention legacy `.xls`; an agent needs `xlrd` (read-only for .xls) or a LibreOffice conversion step, which a custom skill would have to add.

### Gaps
- The final ~16k characters of the subagents page and ~20k of the skills page were not read (fetch truncated), so later sections (e.g. hooks examples, troubleshooting) are not covered.
- Last-commit date of anthropics/skills and the content of the xlsx LICENSE.txt were not retrieved.
- Claude Code's own sandboxing settings (bash sandbox, network rules) were not researched.

## 2. Claude API: code execution tool, Files API and Agent Skills

### Takeaway
The server-side route is now fully out of beta: upload a file with the Files API, pass it as a `container_upload` block, enable `code_execution_20250825` (or later), optionally attach the `xlsx` Skill through `container.skills`, and download the generated file by `file_id`. The sandbox has no internet, 5 GiB RAM, 1 CPU, and 1,550 free container-hours per organization per month.

### Cited Findings

**Code execution tool**
- Status stable on Claude API, Claude Platform on AWS, Claude Models on Google Cloud (Anthropic managed) and Microsoft Foundry (hosted on Anthropic); not ZDR-eligible (container data retained up to 30 days). — [Code execution tool docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/code-execution-tool)
- Three current versions: `code_execution_20250825` (Bash + file operations), `code_execution_20260120` (adds REPL state persistence and programmatic tool calling), `code_execution_20260521` (same runtime, tool description tells Claude about the 90-second per-cell limit). "None of the three tool versions requires an `anthropic-beta` header." Latest is `code_execution_20260521`. — [Code execution tool docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/code-execution-tool)
- Legacy: `code_execution_20250522` (Python only) with beta header `code-execution-2025-05-22`; upgrade by changing the type string. — [Code execution tool docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/code-execution-tool)
- Tool definition: `{"type": "code_execution_20250825", "name": "code_execution"}`; `name` must be `code_execution`. Sub-tools: `bash_code_execution` and `text_editor_code_execution`. — [Code execution tool docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/code-execution-tool)
- Supported upload types for analysis: CSV, Excel (.xlsx, .xls), JSON, XML, images (JPEG, PNG, GIF, WebP), text files. — [Code execution tool docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/code-execution-tool)
- Container: Python 3.11, Linux x86_64, 5 GiB RAM, 5 GiB disk, 1 CPU, internet completely disabled, expires 30 days after creation, checkpointed after about 5 minutes of inactivity. — [Code execution tool docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/code-execution-tool)
- Pre-installed libraries include pandas, numpy, scipy, scikit-learn, statsmodels, matplotlib, seaborn, pyarrow, openpyxl, xlsxwriter, xlrd, python-pptx, python-docx, pypdf, pdfplumber, reportlab; CLI tools include sqlite, ripgrep, 7zip. No extra packages can be installed. — [Code execution tool docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/code-execution-tool)
- Generated files: only files at the top level of `$OUTPUT_DIR` are captured and returned as `file_id` entries in the `bash_code_execution_tool_result` content list; download with the Files API. — [Code execution tool docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/code-execution-tool)
- Container reuse: pass the previous response's `container.id` in the top-level `container` parameter. `pause_turn` stop reason means send the response back with the same container ID. — [Code execution tool docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/code-execution-tool)
- Pricing: free when used with `web_search_20260209`/`web_fetch_20260209` or later; otherwise billed by execution time with a 5-minute minimum, 1,550 free hours per organization per month, then $0.05 per hour per container; if files are included, time is billed even if the tool is not called. — [Code execution tool docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/code-execution-tool)
- Error codes: `unavailable`, `execution_time_exceeded`, `invalid_tool_input`, `too_many_requests`, `output_file_too_large`, `file_not_found`. — [Code execution tool docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/code-execution-tool)

**Files API**
- Out of beta, no header needed; the old `files-api-2025-04-14` header still works and returns the beta response shapes. — [Files API docs](https://platform.claude.com/docs/en/build-with-claude/files)
- Limits: 500 MB per file, 1 TB per organization, about 500 requests per minute; file operations are free, content used in Messages is billed as input tokens. — [Files API docs](https://platform.claude.com/docs/en/build-with-claude/files)
- Content block mapping: PDF and plain text use `document`; images use `image`; datasets and other types use `container_upload` (`{"type": "container_upload", "file_id": "..."}`). — [Files API docs](https://platform.claude.com/docs/en/build-with-claude/files)
- `.xlsx` is not supported by the `document` block: convert to text or upload for code execution via `container_upload`. `.csv` can be sent as text or uploaded with an explicit `text/plain` type. — [Files API docs](https://platform.claude.com/docs/en/build-with-claude/files)
- Uploaded files have `downloadable: false`; only files created by skills or the code execution tool can be downloaded (`GET /v1/files/{file_id}/content`). — [Files API docs](https://platform.claude.com/docs/en/build-with-claude/files)
- Files are workspace-scoped, not user-scoped; never accept `file_id` from end users; use one workspace per tenant (up to 100 workspaces per organization). — [Files API docs](https://platform.claude.com/docs/en/build-with-claude/files)
- Optional expiry via `expires_in_seconds` (3,600 to 7,776,000). Not ZDR or HIPAA eligible. — [Files API docs](https://platform.claude.com/docs/en/build-with-claude/files)
- Examples use `anthropic-version: 2026-10-21`. — [Files API docs](https://platform.claude.com/docs/en/build-with-claude/files)

**Agent Skills in the API**
- Skills go in `container.skills`, max 20 per request; each entry has `type` (`anthropic` or `custom`), `skill_id`, optional `version`. Anthropic skill IDs: `pptx`, `xlsx`, `docx`, `pdf`, with date versions such as `20251013` or `latest`. Custom IDs look like `skill_01AbCdEfGhIjKlMnOpQrStUv`, versions `skver_...`. — [Skills API guide](https://platform.claude.com/docs/en/build-with-claude/skills-guide)
- Example as documented: `container={"skills": [{"type": "anthropic", "skill_id": "xlsx", "version": "latest"}]}` with `tools=[{"type": "code_execution_20250825", "name": "code_execution"}]`. — [Skills API guide](https://platform.claude.com/docs/en/build-with-claude/skills-guide)
- The Skills API is out of beta and needs no header; `skills-2025-10-02` still works with the old response shapes (`display_title` vs new `display_name`, `latest_version` vs `latest_version_id`). — [Skills API guide](https://platform.claude.com/docs/en/build-with-claude/skills-guide)
- Custom skills: `POST /v1/skills`, `POST /v1/skills/{skill_id}/versions`; upload limit 30 MB uncompressed; visible to the whole workspace. — [Skills API guide](https://platform.claude.com/docs/en/build-with-claude/skills-guide)
- Constraints: no network access, no runtime package installation, fresh container unless a container ID is given. Pin versions in production; changing the skills list breaks the prompt cache. — [Skills API guide](https://platform.claude.com/docs/en/build-with-claude/skills-guide)
- Skills are not covered by ZDR. — [Skills API guide](https://platform.claude.com/docs/en/build-with-claude/skills-guide)

**Model pricing (per MTok, input / output)**
- Claude Fable 5.2 $8 / $40; Claude Opus 5.5 $4 / $20; Claude Sonnet 5.5 $2 / $10; Claude Haiku 5.5 $0.10 / $0.50 for prompts up to 100,000 tokens and $0.50 / $2.50 above; Claude Haiku 4.5 $1 / $5. Web search is $10 per 1,000 searches. — [Claude pricing docs](https://platform.claude.com/docs/en/about-claude/pricing)

### Inferences
- For a product feature the cheapest safe path is Sonnet 5.5 or Haiku 5.5 + `code_execution` + `xlsx` Skill; container cost is negligible (free tier of 1,550 hours, then $0.05/hour), so tokens dominate.
- Because the container has no network and a fixed library set, anything needing database drivers, extra pip packages or internal APIs must run in a customer-controlled sandbox instead (Agent SDK, Managed Agents, or a third-party sandbox).
- `xlrd` is pre-installed, so reading legacy `.xls` is feasible in the container; writing `.xls` is not covered by the listed libraries.

### Gaps
- Maximum execution time per tool call is referenced but no number was found on the page.
- Whether LibreOffice is present in the API container (needed by the Skill's `recalc.py`) is not stated in the library list that was read.
- Bedrock/Vertex (partner-operated) availability of code execution was not confirmed; the page lists only Anthropic-operated platforms.

## 3. Claude Agent SDK (Python / TypeScript) and Claude Managed Agents

### Takeaway
The Agent SDK is Claude Code as a library: it runs a bundled `claude` binary as a subprocess with built-in file/Bash tools, so a spreadsheet agent can run pandas/openpyxl on files in its working directory, load the `xlsx` skill from disk, and expose custom in-process MCP tools. Claude Managed Agents (beta, `managed-agents-2026-04-01`) is the hosted equivalent at $0.08 per session-hour plus tokens.

### Cited Findings

**Agent SDK basics**
- Packages: `npm install @anthropic-ai/claude-agent-sdk` (Node.js 18.14+) and `pip install claude-agent-sdk` / `uv add claude-agent-sdk` (Python 3.10+). Both bundle a native Claude Code binary. — [Agent SDK quickstart](https://code.claude.com/docs/en/agent-sdk/quickstart)
- Auth: `ANTHROPIC_API_KEY`; or `CLAUDE_CODE_USE_BEDROCK=1`, `CLAUDE_CODE_USE_ANTHROPIC_AWS=1` + `ANTHROPIC_AWS_WORKSPACE_ID`, `CLAUDE_CODE_USE_VERTEX=1`, `CLAUDE_CODE_USE_FOUNDRY=1`. The SDK does not load `.env` files. — [Agent SDK quickstart](https://code.claude.com/docs/en/agent-sdk/quickstart)
- Third-party developers may not offer claude.ai login or rate limits in products built on the SDK without approval; use API keys. — [Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview)
- Minimal Python call: `query(prompt=..., options=ClaudeAgentOptions(allowed_tools=["Read", "Edit", "Glob"], permission_mode="acceptEdits"))`; TypeScript uses `allowedTools`, `permissionMode`. Other options named: `systemPrompt`/`system_prompt`, `mcpServers`, `cwd`, `maxTurns`/`max_turns`. — [Agent SDK quickstart](https://code.claude.com/docs/en/agent-sdk/quickstart)
- Tool sets: `Read`, `Glob`, `Grep` (read-only); add `Edit`; add `Bash` for full automation. `tools` restricts availability, `allowedTools` only pre-approves. — [Agent SDK quickstart](https://code.claude.com/docs/en/agent-sdk/quickstart)
- Capabilities: built-in tools, hooks, subagents, MCP, permissions, sessions, skills/commands/memory, plugins. Licence: Anthropic Commercial Terms. Branding: "Claude Agent" allowed, "Claude Code" not permitted. — [Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview)

**Custom tools (in-process MCP)**
- Python: `@tool(name, description, schema)` + `create_sdk_mcp_server(name=..., version=..., tools=[...])`; TypeScript: `tool(name, description, zodSchema, handler)` + `createSdkMcpServer({...})`. Pass via `mcp_servers`/`mcpServers`. — [Agent SDK custom tools](https://code.claude.com/docs/en/agent-sdk/custom-tools)
- Tool names follow `mcp__{server_name}__{tool_name}`; wildcard `mcp__weather__*` allowed in `allowedTools`. `tools: []` removes all built-ins so Claude can only use MCP tools. — [Agent SDK custom tools](https://code.claude.com/docs/en/agent-sdk/custom-tools)
- Handlers return `content` blocks (`text`, `image`, `audio`, `resource`, `resource_link`), optional `structuredContent`, and `isError` (TS) / `"is_error": True` (Python). The Python `@tool` decorator forwards only `content` and `is_error`. — [Agent SDK custom tools](https://code.claude.com/docs/en/agent-sdk/custom-tools)
- Annotations: `readOnlyHint` (enables parallel calls), `destructiveHint`, `idempotentHint`, `openWorldHint`. TypeScript-only `permission_policy` (`always_ask`, `always_deny`) requires SDK v0.3.301+. — [Agent SDK custom tools](https://code.claude.com/docs/en/agent-sdk/custom-tools)

**Skills and subagents in the SDK**
- Skills are filesystem artifacts loaded through `settingSources`/`setting_sources` (`"user"`, `"project"`); there is no programmatic registration API. The `skills` option takes a list of names, `"all"`, or `[]`. Example: `ClaudeAgentOptions(cwd=..., setting_sources=["user", "project"], skills="all", allowed_tools=["Read", "Write", "Bash"])`. — [Agent SDK skills](https://code.claude.com/docs/en/agent-sdk/skills)
- Subagents: `agents={"name": AgentDefinition(description=..., prompt=..., tools=[...], model="sonnet")}` with `"Agent"` in `allowed_tools`. `AgentDefinition` fields: `description`, `prompt`, `tools`, `disallowedTools`, `model`, `skills`, `memory`, `mcpServers`, `initialPrompt`, `maxTurns`, `autoCompactWindow`, `background`, `omitClaudeMd`, `effort`, `permissionMode`. Python keeps camelCase for multi-word fields. — [Agent SDK subagents](https://code.claude.com/docs/en/agent-sdk/subagents)
- Subagents start with fresh context; only the Agent tool prompt is passed. Spend cap: `maxBudgetUsd` / `max_budget_usd`. — [Agent SDK subagents](https://code.claude.com/docs/en/agent-sdk/subagents)

**Hosting**
- Each session is one `claude` CLI subprocess; suggested starting size is 1 GiB RAM, 5 GiB disk, 1 CPU per agent; needs outbound HTTPS to `api.anthropic.com`. A minimal container is roughly $0.05 per hour while token cost typically dominates by an order of magnitude. — [Agent SDK hosting](https://code.claude.com/docs/en/agent-sdk/hosting)
- Multi-tenant isolation: `settingSources: []`, `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`, per-tenant `CLAUDE_CONFIG_DIR` and `cwd`. Deployable examples exist for Docker, Modal and Kubernetes. — [Agent SDK hosting](https://code.claude.com/docs/en/agent-sdk/hosting)

**Claude Managed Agents**
- Status beta; all endpoints require `managed-agents-2026-04-01` (SDK sets it automatically); enabled by default for all API accounts; endpoints `/v1/agents`, `/v1/sessions`, `/v1/environments`. — [Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview)
- Concepts: Agent (model, system prompt, tools, MCP servers, skills), Environment (Anthropic cloud sandbox or self-hosted sandbox), Session, Events (SSE). Built-in tools: Bash, file operations, web search/fetch, MCP servers. — [Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview)
- Not eligible for ZDR or HIPAA BAA (except self-hosted for ZDR). Available on Claude API, Claude Platform on AWS and Google Cloud (Anthropic managed). — [Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview)
- Files: uploads are mounted read-only under `/mnt/session/uploads`; files written to `/mnt/session/outputs/` can be downloaded with the Files API. — [Files API docs](https://platform.claude.com/docs/en/build-with-claude/files)
- Skills attach via the agent's `skills` array or a mounted GitHub repository. — [Agent Skills overview](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview)
- Pricing: tokens at model rates plus $0.08 per session-hour, metered only while status is `running`; replaces code-execution container billing; no Batch discount. — [Claude pricing docs](https://platform.claude.com/docs/en/about-claude/pricing)

### Inferences
- A standalone local spreadsheet agent needs roughly: `cwd` pointing at the data folder, `.claude/skills/xlsx/` copied from anthropics/skills, `setting_sources=["project"]`, `allowed_tools=["Read","Write","Edit","Bash","Glob","Grep"]`, and optionally typed MCP tools (e.g. `read_range`, `write_range`) to avoid free-form Bash.
- Replacing `Bash` with a small set of custom MCP tools (`tools: []` + in-process server) is the lowest-risk design for end-user products, since the model can then only do the spreadsheet operations you wrote.
- Managed Agents suits long asynchronous jobs (batch report generation) where you do not want to host the loop; the Agent SDK suits local or self-hosted use where files must stay on your infrastructure.

### Gaps
- The Agent SDK `sandbox` option and full permission-mode table were not read; the hosting page points to a separate secure-deployment page.
- Managed Agents rate limits, toolset type strings and package/network details of the cloud sandbox were not retrieved.
- Current SDK version numbers were not captured beyond the minimums quoted.

## 4. Claude's first-party spreadsheet products

### Takeaway
Claude for Excel is a generally available Office add-in for paid plans that edits the open workbook natively but cannot run macros/VBA or data tables; claude.ai file creation runs code in a sandbox to produce .xlsx/.csv files up to 30 MB on all plans including Free. Neither is a build target, but both set the baseline a custom agent must beat.

### Cited Findings
- Claude for Excel is "generally available to Pro, Max, Team, and Enterprise plans". — [Claude for Excel docs](https://claude.com/docs/office-agents/excel)
- Supported: Excel on the web; Excel on Windows (Microsoft 365, build 16.0.13127.20296+); Excel on Mac 16.46+. Unsupported: Excel 2016/2019 perpetual, iPad, Android. — [Claude for Excel docs](https://claude.com/docs/office-agents/excel)
- Install from the "Claude for Microsoft 365" listing on Microsoft AppSource, or admin deployment through Microsoft 365 Admin Center (Integrated apps), or a custom manifest XML. — [Claude for Excel docs](https://claude.com/docs/office-agents/excel)
- Capabilities: answers with cell-level citations, assumption changes preserving formulas, error debugging, model building, sort/filter, pivot table edits, conditional formatting, data validation; connectors (S&P Global, LSEG, Daloopa) and Skills; shared context with PowerPoint, Word and Outlook add-ins. — [Claude for Excel docs](https://claude.com/docs/office-agents/excel)
- Unsupported capabilities: data tables; macros and VBA operations. — [Claude for Excel docs](https://claude.com/docs/office-agents/excel)
- Can be deployed through Amazon Bedrock, Google Cloud Vertex AI, Azure AI Foundry or an LLM gateway without individual Claude accounts. — [Claude for Excel docs](https://claude.com/docs/office-agents/excel)
- Usage counts against the user's normal Claude plan limits; inputs/outputs deleted within 30 days; chat history stored locally in IndexedDB; does not inherit custom retention settings and is not in Enterprise audit logs (it is in the Compliance API). — [Claude for Excel docs](https://claude.com/docs/office-agents/excel)
- Known issue: after September and October 2026 Microsoft 365 updates on Windows some users lost chat history and uploaded skills in the add-in. — [Claude for Excel docs](https://claude.com/docs/office-agents/excel)
- Prompt-injection warning: only use with trusted spreadsheets; testing found the add-in can be manipulated to extract or modify data. — [Claude for Excel docs](https://claude.com/docs/office-agents/excel)
- History (secondary source): beta launched October 2025 for Max and Enterprise; opened to Pro in January 2026. — [The Decoder](https://the-decoder.com/anthropic-opens-claudes-improved-excel-integration-to-all-pro-subscribers-after-limited-beta/)
- claude.ai file creation makes .xlsx, .pptx, .docx, PDF, .csv and charts; available on Free, Pro, Max, Ultra, Team and Enterprise (web, desktop, mobile); enabled under Settings > Capabilities > "Code execution and file creation"; 30 MB per file for uploads and downloads. — [Create and edit files with Claude](https://support.claude.com/en/articles/12111783-create-and-edit-files-with-claude)
- Network: on by default for individual plans (approved package managers); Team/Enterprise owners choose egress off, package managers only, package managers plus specific domains, or all domains. — [Create and edit files with Claude](https://support.claude.com/en/articles/12111783-create-and-edit-files-with-claude)

### Inferences
- If the users already live in Excel and the task is interactive modelling, the add-in likely removes the need to build anything; a custom agent is justified for batch/unattended work, legacy `.xls`, macros, or integration with internal systems.

### Gaps
- No official per-plan message caps, workbook size limits or model list for the add-in were found.
- Conflicting secondary reports exist on whether the add-in was "GA on May 7, 2026"; the official page confirms GA but gives no date.

## 5. MCP servers for spreadsheets

### Takeaway
Two open-source Excel servers dominate: haris-musa/excel-mcp-server (Python/openpyxl, about 4.3k stars, about 45 tools including pivots, charts and CSV import/export) and negokaz/excel-mcp-server (about 1.1k stars, 7 tools, Windows live editing). Neither supports legacy `.xls`, and no first-party Microsoft Excel MCP server was found.

### Cited Findings
- haris-musa/excel-mcp-server: 4.3k stars, 487 forks, MIT, 223 commits; built on `openpyxl`, no Excel install needed; built-in formula engine (479 functions); formats `.xlsx`, `.xlsm`, `.xltx`, `.xltm`. — [haris-musa/excel-mcp-server](https://github.com/haris-musa/excel-mcp-server)
- Run with `uvx excel-mcp-server stdio`; `--allow-dir /path/to/workbooks`; streamable HTTP at `http://127.0.0.1:8017/mcp`. Env vars include `EXCEL_FILES_PATH`, `EXCEL_MCP_READ_ONLY`, `EXCEL_MCP_ALLOW_VBA_WRITE`, `EXCEL_MCP_TOOLS`, `EXCEL_MCP_MAX_FILE_MB`, `EXCEL_MCP_MAX_CELLS`, `EXCEL_MCP_PORT`, `EXCEL_MCP_AUTH_TOKEN`. — [haris-musa/excel-mcp-server](https://github.com/haris-musa/excel-mcp-server)
- Tools: `describe_workbook`, `describe_sheet`, `read_range`, `create_workbook`, `import_csv`, `export_csv`, `write_range`, `sort_range`, `find_cells`, `replace_cells`, `trace_formula`, `goal_seek`, `format_range`, `add_conditional_format`, `add_data_validation`, `set_table`, `create_chart`, `create_pivot_table`, `add_slicer`, `insert_image`, `read_vba` (plus `write_vba_module` with `--allow-vba-write`), and sheet/row/column management tools. — [haris-musa/excel-mcp-server](https://github.com/haris-musa/excel-mcp-server)
- Limitations: legacy `.xls` not supported; uncalculable formulas return null; volatile functions not calculated; threaded comments, shapes and form controls preserved but not editable; signed VBA projects refused. — [haris-musa/excel-mcp-server](https://github.com/haris-musa/excel-mcp-server)
- negokaz/excel-mcp-server: 1.1k stars, 137 forks, MIT; `npx --yes @negokaz/excel-mcp-server`, Node.js 20+; formats xlsx, xlsm, xltx, xltm. Tools: `excel_describe_sheets`, `excel_read_sheet`, `excel_write_to_sheet`, `excel_create_table`, `excel_copy_sheet`, `excel_format_range`, `excel_screen_capture` (Windows only). Live editing is Windows only. `EXCEL_MCP_PAGING_CELLS_LIMIT` default 4000. 23 open issues, 9 open PRs. — [negokaz/excel-mcp-server](https://github.com/negokaz/excel-mcp-server)
- xing5/mcp-google-sheets: 1.0k stars, 253 forks, MIT; `uvx mcp-google-sheets@latest`; auth via `SERVICE_ACCOUNT_PATH` + `DRIVE_FOLDER_ID`, OAuth (`CREDENTIALS_PATH`, `TOKEN_PATH`), `CREDENTIALS_CONFIG`, or ADC. 19 tools including `get_sheet_data`, `get_sheet_formulas`, `update_cells`, `batch_update_cells`, `add_rows`, `create_spreadsheet`, `share_spreadsheet`. All tools enabled cost about 13K tokens of context; filter with `--include-tools` or `ENABLED_TOOLS`. — [xing5/mcp-google-sheets](https://github.com/xing5/mcp-google-sheets)
- Microsoft (secondary, vendor source with commercial interest): Work IQ MCP exposes generic Microsoft 365 tools with no workbook/range operations, and the Agent 365 MCP server list has no Excel server. — [Scalekit blog](https://www.scalekit.com/blog/excel-mcp-vs-api)

### Inferences
- For Claude Code or the Agent SDK, an MCP server is optional: Bash + pandas/openpyxl already covers the same ground. MCP servers add value where the client has no code execution (e.g. Claude Desktop) or where typed, auditable operations are preferred over free-form code.
- Version 2.0 of the haris-musa server appears to have changed the tool names and environment variables (older write-ups mention `FASTMCP_PORT` and SSE, which the current README does not), so older tutorials may be out of date.

### Gaps
- Last commit/release dates for all three repos were not visible in the fetched pages.
- Absence of an official Microsoft Excel MCP server was not verified against Microsoft Learn or the microsoft/mcp repo directly.
- No dedicated CSV-only MCP server was evaluated.

## 6. Alternatives: OpenAI, Google, Microsoft, open-source frameworks, sandboxes

### Takeaway
OpenAI's Code Interpreter (Responses API) is the closest equivalent to Claude's code execution, priced per 20-minute container session; Gemini code execution is free beyond tokens but cannot return files other than inline charts; Microsoft's Graph Excel API and Copilot Agent Mode only handle modern workbooks in Microsoft 365. LangChain and LlamaIndex dataframe agents execute model-written Python locally and carry explicit arbitrary-code-execution warnings, so they need an external sandbox.

### Cited Findings

**OpenAI**
- Responses API tool: `"type": "code_interpreter"` with `container` (`"type": "auto"`, `memory_limit`, optional `file_ids`), or an explicit container from `v1/containers`. Containers expire after 20 minutes of inactivity and cannot be reactivated. Memory tiers 1g (default), 4g, 16g, 64g. Rate limit 100 RPM per organization. — [OpenAI Code Interpreter guide](https://developers.openai.com/api/docs/guides/tools-code-interpreter)
- Supported extensions include .csv, .xlsx, .json, .pdf, .docx, .pptx, .zip (no .xls in the list). Generated files come back as `container_file_citation` annotations with `container_id`, `file_id`, `filename`. — [OpenAI Code Interpreter guide](https://developers.openai.com/api/docs/guides/tools-code-interpreter)
- Pricing (from search of OpenAI's pricing page): 1 GB $0.03, 4 GB $0.12, 16 GB $0.48, 64 GB $1.92 per 20-minute session per container. — [OpenAI pricing](https://developers.openai.com/api/docs/pricing?web=1)
- The Assistants API was sunset on August 26, 2026; the Responses API is the recommended replacement. — [OpenAI Assistants what's new](https://developers.openai.com/api/docs/assistants/whats-new)

**Google**
- Gemini API code execution: `"tools": [{"type": "code_execution"}]` on the `/v1beta/interactions` endpoint; 30-second maximum runtime; up to 5 regeneration attempts; Python only. — [Gemini code execution docs](https://aistudio.google.com/docs/code-execution)
- Libraries include pandas, numpy, openpyxl, xlrd, matplotlib, seaborn, scikit-learn, python-docx, python-pptx, reportlab; custom libraries cannot be installed. "Works best with text and CSV files"; file size bounded by the model's token window. — [Gemini code execution docs](https://aistudio.google.com/docs/code-execution)
- Output: Matplotlib graphs as inline images; the model "can't return other artifacts like media files". No extra charge beyond tokens. — [Gemini code execution docs](https://aistudio.google.com/docs/code-execution)
- Gemini in Sheets AI function limits: no access on Business Starter; 5,000 per month on Business Standard/Plus and Enterprise Standard/Plus; 25,000 per month on the top add-on tier. Enforcement dates conflict across page versions (September 1, 2026 vs November 1, 2026). — [Google Workspace AI usage limits](https://knowledge.workspace.google.com/admin/generative-ai/workspace-with-gemini/about-ai-usage-limits)

**Microsoft**
- Graph Excel REST API reads/modifies workbooks in OneDrive for Business, SharePoint or Group drives; "supports only Office Open XML file formatted workbooks. The `.xls` extension workbooks aren't supported"; OneDrive Consumer not supported. Scopes `Files.Read`, `Files.ReadWrite`. — [Microsoft Graph Excel API](https://learn.microsoft.com/en-us/graph/api/resources/excel?view=graph-rest-1.0)
- Sessions: `POST .../workbook/createSession` with `{ "persistChanges": true }`, then header `workbook-session-id`; persistent sessions expire after about 5 minutes of inactivity, non-persistent after about 7. Resources: worksheets, ranges, tables, charts, named items, `/functions`. Range properties return null above 5M cells. — [Microsoft Graph Excel API](https://learn.microsoft.com/en-us/graph/api/resources/excel?view=graph-rest-1.0)
- Agent Mode in Excel is generally available on Excel for the web and on desktop. — [Microsoft Excel blog (web GA)](https://techcommunity.microsoft.com/blog/excelblog/agent-mode-in-excel-is-now-generally-available-on-excel-for-web/4476092); [Microsoft Excel blog (desktop GA)](https://techcommunity.microsoft.com/blog/excelblog/agent-mode-in-excel-is-now-generally-available-on-desktop/4457408)
- Agent Mode in Copilot Chat can query locally stored .xlsx, .xlsb, .xlsm workbooks on Windows and Mac. — [Microsoft 365 Insider blog](https://techcommunity.microsoft.com/blog/microsoft365insiderblog/agent-mode-in-excel-now-works-with-your-local-files/4497675)
- Copilot pricing reports conflict (secondary sources): $30 per user per month add-on vs $18 promotional / $21 standard for Copilot Business. — [EPC Group](https://www.epcgroup.net/answers/microsoft-copilot-pricing-july-2026); [Velosio](https://www.velosio.com/blog/m365-copilot-pricing-reset-2026/)

**LangChain / LlamaIndex / PandasAI / Vercel AI SDK**
- `create_pandas_dataframe_agent` (langchain_experimental) raises `ValueError` unless `allow_dangerous_code=True`; it relies on a Python REPL tool that can execute arbitrary code. `create_csv_agent` forwards to it. — [LangChain reference](https://reference.langchain.com/v0.3/python/experimental/agents/langchain_experimental.agents.agent_toolkits.pandas.base.create_pandas_dataframe_agent.html)
- CVE-2026-27966: Langflow before 1.8.0 hardcoded `allow_dangerous_code=True` in its CSV Agent node, exposing `python_repl_ast`; rated critical. — [Sonatype CVE-2026-27966](https://guide.sonatype.com/vulnerability/CVE-2026-27966)
- LlamaIndex `PandasQueryEngine` docs warn the tool gives access to `eval`, arbitrary code execution is possible, and it is not recommended for production without heavy sandboxing. — [LlamaIndex PandasQueryEngine reference](https://developers.llamaindex.ai/python/framework-api-reference/query_engine/pandas/)
- HiddenLayer advisory: `safe_eval`/`safe_exec` in llama-index-experimental (v0.10.29+) can be bypassed, e.g. through `pandas.read_pickle`; CVSS 7.8. — [HiddenLayer advisory](https://hiddenlayer.com/sai-security-advisory/2024-08-llamaindex-2)
- PandasAI: about 23.9k stars, MIT except `pandasai/ee`; `pip install pandasai pandasai-litellm`; usage `pai.config.set({"llm": llm})`, `pai.read_csv(...)`, `df.chat(...)`; Docker sandbox via `pandasai-docker` (`DockerSandbox()`); Python 3.8 to 3.11. — [sinaptik-ai/pandas-ai](https://github.com/sinaptik-ai/pandas-ai)
- Vercel AI SDK Anthropic provider: `anthropic.tools.codeExecution_20260120()` (recommended, no beta header), also `codeExecution_20250825`; files uploaded with `uploadFile({ api: anthropic.files(), ... })` and referenced with `containerUpload: true`; agent class `ToolLoopAgent`. — [AI SDK Anthropic provider](https://ai-sdk.dev/providers/ai-sdk-providers/anthropic)
- Conflict: the AI SDK page describes `codeExecution_20250522` as "supports Bash only" — [AI SDK Anthropic provider](https://ai-sdk.dev/providers/ai-sdk-providers/anthropic); Anthropic describes that legacy version as Python only — [Code execution tool docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/code-execution-tool).

**Code sandboxes**
- E2B: Hobby $0 with one-time $100 credit, 1-hour sessions, 10 concurrent sandboxes; Pro $150/month plus usage, 24-hour sessions, 100 concurrent; $0.000014 per vCPU-second and $0.0000045 per GiB-second. — [E2B pricing](https://e2b.dev/pricing)
- Secondary comparison figures: Daytona about $0.0504 per vCPU-hour and $0.0162 per GiB-hour (wall clock); Modal sandbox about $0.1419 per core-hour (1 core = 2 vCPU) and about $0.024 per GiB-hour; Vercel Sandbox $0.128 per active-CPU hour plus about $0.0212 per GB-hour. — [StartupHub comparison](https://www.startuphub.ai/ai-news/artificial-intelligence/2026/daytona-vs-e2b-vs-modal-vs-vercel-sandbox-2026); [Fly.io sandbox pricing comparison](https://fly.io/learn/ai-sandbox-pricing/)

### Inferences
- Gemini code execution cannot hand back a modified .xlsx, so it fits analysis/Q&A over CSV rather than file-producing agents.
- Graph Excel API is the only route here that edits a live shared workbook with Excel's own calculation engine, but it requires Microsoft 365 business storage and excludes `.xls` and local files.
- LangChain/LlamaIndex dataframe agents are best treated as prototypes; in production pair any framework with E2B/Daytona/Modal/Vercel Sandbox or use a vendor-hosted interpreter.

### Gaps
- Not researched: Python in Excel, Office Scripts, OpenAI Agents SDK `CodeInterpreterTool`, OpenAI file size limits, LangGraph-specific patterns, Vercel AI SDK skills support (page truncated), and official Daytona/Modal/Vercel pricing pages (figures above are secondary).
- Whether the 2024 llama-index-experimental bypass has been patched is unknown.
- OpenAI model names and current per-token prices were not collected.

## 7. Route-by-route comparison: strengths, weaknesses, cost and best fit

### Takeaway
Local personal automation is best served by Claude Code (subagent + xlsx skill); an end-user product feature by the Claude API with code execution + Skills (or OpenAI Code Interpreter); enterprise in-Excel work by Claude for Excel or Copilot Agent Mode; and self-hosted or long-running jobs by the Agent SDK or Managed Agents.

### Cited Findings
- Claude Code skills run with full network access on the user's machine, and files stay local. — [Agent Skills overview](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview)
- Claude API code execution: no internet, fixed libraries, 5 GiB RAM, 1,550 free hours/month then $0.05/hour; not ZDR-eligible. — [Code execution tool docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/code-execution-tool)
- Files API is workspace-scoped, so multi-tenant products need one workspace per tenant. — [Files API docs](https://platform.claude.com/docs/en/build-with-claude/files)
- Agent SDK hosting: about 1 GiB RAM per agent, container roughly $0.05/hour, tokens dominate cost. — [Agent SDK hosting](https://code.claude.com/docs/en/agent-sdk/hosting)
- Managed Agents: $0.08 per session-hour plus tokens, beta, not ZDR/HIPAA eligible. — [Claude pricing docs](https://platform.claude.com/docs/en/about-claude/pricing); [Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview)
- Claude for Excel: paid plans only, no VBA/macros/data tables, prompt-injection risk on untrusted files. — [Claude for Excel docs](https://claude.com/docs/office-agents/excel)
- OpenAI Code Interpreter: $0.03 to $1.92 per 20-minute container session by memory tier; containers lost after 20 idle minutes. — [OpenAI pricing](https://developers.openai.com/api/docs/pricing?web=1); [OpenAI Code Interpreter guide](https://developers.openai.com/api/docs/guides/tools-code-interpreter)
- Gemini code execution: no extra charge, 30-second runtime, no file outputs. — [Gemini code execution docs](https://aistudio.google.com/docs/code-execution)
- Graph Excel API: .xlsx in OneDrive for Business/SharePoint only. — [Microsoft Graph Excel API](https://learn.microsoft.com/en-us/graph/api/resources/excel?view=graph-rest-1.0)
- LangChain pandas/CSV agents require `allow_dangerous_code=True`. — [LangChain reference](https://reference.langchain.com/v0.3/python/experimental/agents/langchain_experimental.agents.agent_toolkits.pandas.base.create_pandas_dataframe_agent.html)

### Inferences
| Route | Strengths | Weaknesses | Cost driver | Best fit |
|---|---|---|---|---|
| Claude Code subagent + xlsx skill | Fastest to start; local files; any library; `.xls` via xlrd/LibreOffice | Needs a developer machine and LibreOffice; not a product surface | Claude subscription or API tokens | Personal local automation |
| Claude API + code execution + `xlsx` Skill | No infrastructure; GA; file in, file out | No network, fixed libraries, no ZDR, workspace-scoped files | Tokens (container mostly free) | Product feature for end users |
| Claude Agent SDK | Full control, custom typed tools, on-prem data | You host and secure subprocesses | Tokens + own compute | Self-hosted product or internal tool |
| Claude Managed Agents | Hosted loop, long sessions, scheduling | Beta; no ZDR/HIPAA | Tokens + $0.08/session-hour | Asynchronous batch jobs |
| Claude for Excel / Copilot Agent Mode | Native Excel editing, no build | No macros (Claude); licence per user; not programmable | Per-seat plan | Enterprise analysts inside Excel |
| MCP Excel servers | Typed tools for clients without code execution | No `.xls`; openpyxl feature gaps | Free (MIT) + tokens | Claude Desktop / IDE users |
| OpenAI Code Interpreter | Mature, up to 64 GB memory | 20-minute idle expiry; per-session fee | Tokens + $0.03 to $1.92/session | Product feature on OpenAI stack |
| Gemini code execution | No extra fee | 30 s limit; no file output | Tokens | CSV Q&A and charts |
| Graph Excel API | Real Excel calc engine, live shared workbooks | M365 business only; no `.xls` | M365 licences | Enterprise workflow integration |
| LangChain / LlamaIndex / PandasAI + sandbox | Model-agnostic, open source | Arbitrary code execution risk; you assemble the pieces | Tokens + sandbox (E2B from $0.000014/vCPU-s) | Custom multi-model pipelines |

- Legacy `.xls` is the common weak point: the MCP servers, Graph API, OpenAI's extension list and the xlsx Skill's trigger list all omit it; only Claude's code execution container explicitly lists `.xls` uploads (with `xlrd`).

### Gaps
- No benchmark data comparing accuracy of these routes on spreadsheet tasks was collected.
- Per-task cost estimates are not available; only unit prices were gathered.
- Data-residency and compliance details (EU availability, HIPAA) were only captured for the Anthropic features noted above.
