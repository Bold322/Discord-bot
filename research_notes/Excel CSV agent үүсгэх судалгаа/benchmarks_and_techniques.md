# LLM agents on spreadsheets and tabular files: benchmarks, encodings, architectures (state as of 16 Nov 2026)

Reading notes for the report writer:
- "Peer-reviewed" = published at a named venue. "Preprint" = arXiv only. "Vendor" = self-reported by a company with a commercial interest. "Aggregator" = third-party leaderboard mirror that I could not check against the primary board.
- The official SpreadsheetBench leaderboard (https://spreadsheetbench.github.io) renders its rows with JavaScript; I could read its headline statistics but not the individual rows. Row-level V1-Verified numbers below come from an aggregator and are flagged as such.
- Model names such as "Claude Opus 4.8", "Claude Sonnet 5", "Claude Fable 5.2", "GPT-5.5", "GPT-6.1 Terra", "Gemini 4 Carbon" appear exactly as printed on the cited pages; I did not cross-check them against vendor release notes.

## 1. Benchmarks: what they are, current top scores, who holds them, gap to human

### Takeaway
The original SpreadsheetBench (912 forum tasks, 2024) went from about 18% (GPT-4o) to 57-59% for products in autumn 2025, and its 400-task "Verified" subset is now effectively saturated (many agents above 90%, top listings at 98-99% in Oct 2026). The discriminating benchmark is now SpreadsheetBench 2 (June 2026, multi-sheet business workflows), where the best published model scores 34.89% overall and 12% on debugging, and the Vals Excel Modeling Benchmark, where the best agent is at about 77% with partial credit.

### Cited Findings

**SpreadsheetBench V1 (peer-reviewed, NeurIPS 2024 Spotlight; arXiv June 2024, revised 17 Oct 2024)**
- 912 instructions from real Excel-forum posts, 2,729 test-case spreadsheets (about 3 per instruction), scored like an online judge so a solution must generalise across spreadsheets with different values — [SpreadsheetBench paper](https://arxiv.org/html/2406.14991v2)
- 35.7% of spreadsheets contain multiple tables and 42.7% contain non-standard relational tables; 80% of sheets fall within about 1-49 rows and 1-13 columns, but some exceed 100 columns and 20,000 rows — [SpreadsheetBench paper](https://arxiv.org/html/2406.14991v2)
- Original results (overall, soft restriction): GPT-4o 18.35% single-round and 16.96% multi-round; GPT-3.5 2.34% / 7.09%; Llama-3 70B 1.32% / 3.74%; Binder (GPT-3.5) 1.17%; TaPEx and TaPas scored zero — [SpreadsheetBench paper](https://arxiv.org/html/2406.14991v2)
- Human experts: 71.33% overall soft (75.56% cell-level, 65.00% sheet-level) and 62.00% hard, measured with four Excel experts on a 50-instruction subset within one day — [SpreadsheetBench paper](https://arxiv.org/html/2406.14991v2)
- Products on a roughly 5% manual sample in the paper: Copilot in Excel about 20%, SheetCopilot (GPT-4) about 14% — [SpreadsheetBench paper](https://arxiv.org/html/2406.14991v2)
- The metric itself has a 3.8% false-omission rate (correct outputs occasionally marked wrong) and 0% false discovery in the authors' human validation — [SpreadsheetBench paper](https://arxiv.org/html/2406.14991v2)
- Official site headline statistic for V1 Full (912): top overall score 70.48% (model not named in the readable part of the page). Verified entries are run by the maintainers through provider APIs; unverified ones are submitted by third parties — [SpreadsheetBench site](https://spreadsheetbench.github.io)

**SpreadsheetBench V1 full-912 scores, autumn 2025 (vendor)**
- Microsoft announced Agent Mode in Excel on 29 Sep 2025 with 57.2% on SpreadsheetBench versus 71.3% for humans; the earlier Copilot in Excel was about 20% — [SiliconANGLE](https://siliconangle.com/2025/09/29/microsoft-wants-everyone-start-vibe-working-ai-agents-excel-word/); [Computerworld](https://www.computerworld.com/article/4064781/microsoft-upgrades-m365-copilot-with-agent-mode.html)
- Shortcut's snapshot of the board (16 Oct 2025): Shortcut.ai 59.25% (verified), Copilot in Excel Agent Mode 57.2% (unverified), ChatGPT Agent with .xlsx 45.5% (unverified), Claude Files Opus 4.1 42.9% (unverified), ChatGPT Agent 35.3% (unverified). Published by Shortcut, which ranks itself first — [Shortcut blog](https://shortcut.ai/blog/posts/benchmarks-explained)

**SpreadsheetBench V1 Verified (400-task expert-reviewed subset), 2026**
- GRID (vendor, 27 Jul 2026) with its own spreadsheet engine as the agent's tool: claude-sonnet-5 best 91.25% / median 90.75% over 7 runs; claude-opus-4-8 best 91.0% / median 90.5% (2 runs); claude-sonnet-4-6 best 90.0% / median 89.0% (7 runs); claude-sonnet-4-5 best 86.75% / median 85.6% (6 runs). Early builds scored about 75% before export-path fixes — [GRID blog](https://grid.is/blog/an-agent-with-a-spreadsheet-engine-beats-one-without)
- Aggregator listing sampled 18 Oct 2026 (rows "imported" from the official site): JT-DA-Agent 99.25%, Data Analysis Agent 99.25%, JT AlphaData 98.5%, Qingqiu Agent 98.25%, WPS AI 96.75%, Fundy from Emblem 95.5%, arito 95.5%, Tetra-Beta-2 94.25%, GPT for Excel 92.5%, Leni 91.25%, GRID Agent 91.25%, Nobie Agent 91%, Atoms Agent v0.3 90.5%, Shortcut.ai 86%, Kyra 84.25%, Catalyst 82.75% — [benchmarklist.com](https://benchmarklist.com/benchmarks/spreadsheetbench_v1_verified/)
- Same aggregator lists bare-model "self-reported" rows (all linked to one Qwen blog post, so weakly sourced): Claude Opus 4.6 Max 89.3%, Qwen3.7 Max 87%, GLM-5.1 Thinking 85.2%, DeepSeek V4 Pro Max 84.9%, Kimi K2.6 Thinking 84.5% — [benchmarklist.com](https://benchmarklist.com/benchmarks/spreadsheetbench_v1_verified/)
- The aggregator is internally inconsistent: its own summary text says Qingqiu Agent leads at 94.75%, while its table shows 98.25% in fourth place — [benchmarklist.com](https://benchmarklist.com/benchmarks/spreadsheetbench_v1_verified/)
- Run-to-run noise is large relative to leaderboard gaps: with temperature 0 and top_k 1, 12 of 100 tasks flipped pass/fail across five claude-sonnet-4-6 runs and 14 of 100 across four claude-sonnet-4-5 runs; across all GRID runs 99.25% of tasks passed at least once and 3 tasks never passed (judged defective) — [GRID blog](https://grid.is/blog/an-agent-with-a-spreadsheet-engine-beats-one-without)
- Scope limits noted by GRID: formatting is not scored, comparison is by fixed cell position, and the reference harness assumes the agent writes Python and recalculates in Excel — [GRID blog](https://grid.is/blog/an-agent-with-a-spreadsheet-engine-beats-one-without)

**SpreadsheetBench 2 (arXiv 29 Jun 2026, v2 7 Nov 2026; listed as a NeurIPS 2026 poster)**
- 321 expert-curated end-to-end business tasks (template, financial modelling, debugging, visualisation); each averages 11.8 worksheets and 593.5 cell modifications; about 1,500 hours of expert annotation — [SpreadsheetBench 2 paper](https://arxiv.org/html/2606.29955v2); [NeurIPS listing](https://neurips.cc/virtual/2026/poster/139155)
- Results, overall (template / financial modelling / debugging / visualisation): Claude Opus 4.6 34.89% (52.58 / 34.00 / 12.00 / 62.50); GPT-5.2 26.79% (35.05 / 33.00 / 8.00 / 45.83); Gemini 3.1 Pro 23.68% (28.87 / 31.00 / 7.00 / 41.67); GLM-5 17.14%; DeepSeek-V3.2 15.58%; Kimi K2.5 14.64%; Qwen3.5 11.22%; MiniMax M2.5 7.17% — [SpreadsheetBench 2 paper](https://arxiv.org/html/2606.29955v2)
- Scoring is all-or-nothing for non-visual tasks: every required cell must be right and untouched cells must stay untouched; visualisation is judged by a VLM against a checklist (pass above 70) — [SpreadsheetBench site](https://spreadsheetbench.github.io)
- Commercial spreadsheet products were tested by hand on a 30-example subset; the best, Claude for Excel, scored 15.4% — [SpreadsheetBench 2 paper](https://arxiv.org/html/2606.29955v2)
- No human solver accuracy is reported for V2 — [SpreadsheetBench 2 paper](https://arxiv.org/html/2606.29955v2)
- Official site still shows 34.89% as the V2 top overall score; an aggregator lists Kimi K3 at 34.8% (29 Jul 2026, run with the Claude Code harness, single-source) — [SpreadsheetBench site](https://spreadsheetbench.github.io); [BenchLM](https://benchlm.ai/benchmarks/spreadsheetbench2)

**Vals Excel Modeling Benchmark v1.1 (independent commercial evaluator, proprietary; updated 11 Nov 2026)**
- 51-task private test set from 103 expert-written tasks (LBO, DCF, M&A, operating models, comps, dataroom summaries, misc.); each would take a human expert at least 5 hours; workbooks recalculated in a real Excel engine; template mode uses exact cell match, scratch mode uses an LLM judge with partial credit — [Vals AI EMB](https://www.vals.ai/benchmarks/emb-v1-1)
- Top results: Claude Fable 5.2 77.38% ($6.67 and 16m19s per task), Claude Fable 5.1 76.73%, Gemini 4 Carbon 76.47%, Claude Sonnet 5.5 75.90%, Claude Opus 5.5 75.84%; GPT-6.1 Terra 73.33% at $0.56 per task; Muse Ember 72.17% at $0.09 per task — [Vals AI EMB](https://www.vals.ai/benchmarks/emb-v1-1)
- Vals states that partial credit means high scores do not imply client-ready models; LBO is weakest and dataroom summaries strongest for nearly all agents — [Vals AI EMB](https://www.vals.ai/benchmarks/emb-v1-1)

**OpenAI internal investment-banking spreadsheet benchmark (vendor, not independently reproducible)**
- GPT-5 43.7%, GPT-5.2 Thinking 68.4%, GPT-5.4 Thinking 87.3%; OpenAI's own run of Claude Opus 4.6 scored 64.1%. ChatGPT for Excel launched in beta on 5 Mar 2026 — [OpenAI, ChatGPT for Excel](https://openai.com/index/chatgpt-for-excel/); [The Decoder](https://the-decoder.com/?p=32842)

**Older spreadsheet-manipulation benchmarks**
- SheetCopilot benchmark (SCB): SheetCopilot with GPT-3.5 reaches Exec@1 87.3 / Pass@1 44.3 — [SheetAgent paper, Table of results](https://arxiv.org/html/2403.03636v3)
- SheetRM (introduced with SheetAgent, WWW 2025): 41 files, 137 sheets, 317 tasks made of 1,625 subtasks, average 5.13 subtasks per task versus 1.95 in SCB — [SheetAgent paper](https://arxiv.org/html/2403.03636v3)
- SheetAgent results: SCB Pass@1 61.1 (GPT-3.5) versus SheetCopilot 44.3; SheetRM Pass@1 31.2 (GPT-3.5), 44.8 (GPT-4), 46.1 (GPT-4o), 62.5 (o1), versus SheetCopilot 0 (GPT-3.5) and 2.2 (GPT-4) — [SheetAgent paper](https://arxiv.org/html/2403.03636v3)
- InstructExcel (Findings of EMNLP 2023): over 10,000 samples, 170+ Excel operations, 2,000 public spreadsheets; task is generating OfficeScripts (TypeScript) from an instruction; reported as hard even for GPT-4, improving with more in-context examples and dynamic prompting — [InstructExcel](https://arxiv.org/abs/2310.14495)

**Table QA and data-analysis benchmarks**
- TableBench (preprint, revised 18 Mar 2025): 886 samples, 18 subcategories; tables average 16.71 rows and 6.68 columns; human 85.91 versus best model GPT-4-Turbo 51.32 (textual chain-of-thought) — [TableBench](https://arxiv.org/html/2408.09174v2)
- InfiAgent-DABench (preprint, Mar 2024; listed in ICML 2024 proceedings): 257 closed-form questions over 52 CSV files; GPT-4-0613 78.99%, AutoGen (GPT-4) 71.48%, GPT-3.5 60.70%, XAgent (GPT-4) 47.52%, Claude-2.1 47.47%; no human baseline — [InfiAgent-DABench](https://arxiv.org/html/2401.05507v3); [ICML listing](https://mlanthology.org/icml/2024/hu2024icml-infiagentdabench)
- Data Interpreter claims 94.93% on InfiAgent-DABench with GPT-4o versus 75.92% for GPT-4o without the agent framework — [Data Interpreter](https://arxiv.org/pdf/2402.18679); a later independent rerun (DatawiseAgent) measured 79.97% / 75.78% for Data Interpreter with GPT-4o under its own two metrics — [DatawiseAgent](https://arxiv.org/pdf/2503.07044)
- DA-Code (EMNLP 2024): agentic data-science code generation; best LLMs at release reached 30.5% — [DA-Code](https://arxiv.org/abs/2410.07331)
- BIRD (text-to-SQL, for comparison): human 92.96% execution accuracy; Gemini-SQL2 reported at 80.04% on the single-model board (12 Jun 2026, single source) and another source cites 81.95% for AskData + GPT-4o on test — [BIRD leaderboard](https://bird-bench.github.io); [AI Weekly](https://aiweekly.co/alerts/googles-gemini-sql2-tops-bird-text-to-sql-at-8004)
- Spider 2.0 (for comparison): Oracle claims 72.02% EX on Spider 2.0-Lite (undated vendor post); an aggregator shows about 40.4 for the agentic track's top entry (Spider-Agent-Extended + GPT-5, 27 May 2026) — [Oracle blog](https://blogs.oracle.com/cloud-infrastructure/oci-gen-ai-tops-spider-2-lite); [benchmarklist Spider 2.0](https://benchmarklist.com/benchmarks/spider_2_0/)

### Inferences
- Gap to human on V1: about 53 points in 2024 (71.33 vs 18.35), about 14 points in Sep 2025 (71.3 vs 57.2). The site's 70.48% top score on the full 912 set is roughly at the 2024 human-expert figure, and Verified-400 results exceed it, so V1 no longer measures a human gap. The human figure was measured on only 50 tasks under a one-day limit, so it is a rough reference rather than a ceiling.
- The top Verified-400 listing (99.25%) equals exactly the share of tasks GRID found solvable at least once across all its runs (99.25%, i.e. 397 of 400). Top entries are therefore at the practical ceiling, and given 12-14% per-task flip rates at temperature 0, differences among the 90%+ systems are not meaningful. Best-of-n reporting or benchmark-specific tuning cannot be excluded for unverified rows.
- The realistic state of the art for long, multi-sheet work is the V2 number: about one task in three fully correct for the best model, one in eight for debugging. Purpose-built products did worse than the bare-model scaffold on the small V2 sample (15.4% vs 34.89%), though the samples differ (30 tasks, manual) so this is indicative only.
- Each benchmark tests a different thing and the numbers are not interchangeable: V1 = small localised edits; V2 and Vals EMB = long workbook construction; TableBench / DABench = question answering over small clean tables; BIRD / Spider 2.0 = SQL over relational databases.

### Gaps
- I could not read row-level data from the official SpreadsheetBench leaderboard; which system holds the 70.48% V1-Full top score is unknown, and the Verified-400 rows are from an aggregator with visible inconsistencies.
- No Anthropic-published SpreadsheetBench number was found; Anthropic results above come from the benchmark authors, OpenAI, Vals and GRID.
- No Google-published spreadsheet-benchmark number was found.
- No human baseline exists for SpreadsheetBench 2, InfiAgent-DABench or DA-Code in the material read.
- Current (late 2026) top scores for TableBench, DABench and DA-Code were not found; the figures above are from the original papers (2024-2025) and will have moved.
- TableGPT2's own benchmark table was not read; only a secondary description (593.8K tables, 2.36M query-table-output tuples, claimed average gains of 35.20% at 7B and 49.32% at 72B across 23 metrics) surfaced via search and is not verified against the paper.

## 2. Spreadsheet encoding: SpreadsheetLLM / SheetCompressor and serialisation-format studies

### Takeaway
Microsoft's SheetCompressor cut tokens by 96% (about 25x) and raised table-detection F1 from 0.52 to 0.76-0.79, mainly by making large sheets fit at all; uncompressed sheets above 32k tokens scored 0.000. On the question of markdown vs CSV vs JSON vs HTML, studies disagree and the differences are small for strong models; the consistent findings are that cell addresses matter for spreadsheets and that verbose markup costs tokens that hurt on large sheets.

### Cited Findings

**SpreadsheetLLM (Microsoft, arXiv July 2024; preprint)**
- Three modules: (1) structural-anchor extraction keeps rows/columns within k=4 of heterogeneous "anchor" rows and columns at likely table boundaries, discarding about 75% of content while preserving 97% of boundary rows/columns; (2) inverted-index translation, lossless, maps each distinct value to its cell addresses, merges repeats into ranges and drops empty cells; (3) data-format aggregation groups adjacent cells with the same number format or data type — [SpreadsheetLLM](https://arxiv.org/html/2407.09025v2)
- Compression ratios: module 1 alone 4.41x, module 2 alone 2.67x, module 3 alone 7.24x, all three 24.79x; total tokens fell from 1,548,577 to 62,469 (96% reduction) — [SpreadsheetLLM](https://arxiv.org/html/2407.09025v2)
- Table detection F1: GPT-4 in-context 0.154 uncompressed vs 0.410 compressed; fine-tuned GPT-4 0.520 vs 0.759; best configuration (fine-tuned GPT-4, compression without the aggregation module) 0.789, vs the prior TableSense-CNN baseline 0.666; fine-tuned Llama3 0.471 vs 0.719, Mistral-v2 0.542 vs 0.726 — [SpreadsheetLLM](https://arxiv.org/html/2407.09025v2)
- By sheet size (fine-tuned GPT-4, uncompressed vs compressed): small under 4k tokens 0.779 vs 0.810; medium 4-8k 0.707 vs 0.832; large 8-32k 0.288 vs 0.718; huge over 32k 0.000 vs 0.690 — [SpreadsheetLLM](https://arxiv.org/html/2407.09025v2)
- Chain of Spreadsheet (first detect the relevant table, then answer over it), 307 QA items: GPT-4 baseline 0.466, GPT-4 with CoS 0.684, fine-tuned 0.743; TaPEx 0.378, Binder 0.622 — [SpreadsheetLLM](https://arxiv.org/html/2407.09025v2)
- Base-format comparison for spreadsheets (GPT-4 in-context, table detection): HTML 0.031, XML 0.142, Markdown 0.175. The authors chose a Markdown-like format with explicit cell addresses because XML/HTML spend tokens on repeated tags and plain Markdown lacks addresses and handles merged cells poorly — [SpreadsheetLLM](https://arxiv.org/html/2407.09025v2)
- Adding cell-format information (colours, borders) to the uncompressed encoding hurt: fine-tuned GPT-4 fell from 0.520 to 0.315 because the extra tokens pushed data past limits; the method does not use background colour or borders — [SpreadsheetLLM](https://arxiv.org/html/2407.09025v2)
- A vendor blog headlines "23% more accurate"; the paper's own figure is 12.3 points over the prior best on table detection — [Daloopa blog](https://daloopa.com/blog/analyst-best-practices/structured-financial-data-analysis-when-llms-meet-excel-spreadsheets); contradicted by [SpreadsheetLLM](https://arxiv.org/html/2407.09025v2)

**Serialisation-format studies**
- "Table Meets LLM" (WSDM 2024, peer-reviewed; GPT-3.5/GPT-4): on seven structural tasks, HTML beat delimiter-separated text by 6.76% on average. Per-task figures: cell lookup 39.67% (delimited) to 44.00% (HTML); table size detection 40.67% (Markdown) vs 67.00% (HTML); the best configuration averaged only 65.43% — [Table Meets LLM](https://arxiv.org/html/2305.13062v5)
- Same study: removing the one-shot example cost 30.38% overall (size detection down 50.33 points); putting the question/context after the table instead of before cost 6.81% overall; "self-augmented prompting" (ask the model to first extract key structure, then answer) added 0.8-2.7 points on TabFact, HybridQA, SQA, FEVEROUS — [Table Meets LLM](https://arxiv.org/html/2305.13062v5)
- SheetAgent ablation (WWW 2025; GPT-3.5): JSON 63.3 WTQ accuracy / 31.2 SheetRM Pass@1; DataFrame-loader text 59.7 / 30.0; Markdown 58.6 / 29.0; HTML 62.1 / 23.3. HTML's drop on the spreadsheet task is attributed to verbosity straining token limits — [SheetAgent paper](https://arxiv.org/html/2403.03636v3)
- A study on long hybrid documents found plain text and CSV outperformed XML and HTML, attributed to tag overhead — [Enabling and Analyzing How to Efficiently Extract Information from Hybrid Long Documents](https://arxiv.org/pdf/2305.16344)
- A non-peer-reviewed blog test (11 formats, 1,000 questions; reported via Gigazine, Oct 2025) found Markdown key-value records best at 60.7%, XML 56.0%, natural language 49.6%, CSV 44.3% — [Gigazine summary](https://gigazine.net/gsc_news/en/20251007-ai-table-format)
- A 2025 preprint on small tabular datasets found GPT-5 largely stable across CSV, JSON and Markdown, while DeepSeek was more format-sensitive (JSON better) — [LLMs as Universal Predictors?](https://arxiv.org/pdf/2508.17391)
- A survey concluded HTML and separator-based text (Markdown/CSV) are the two most effective general options — [LLM for Table Processing: A Survey](https://arxiv.org/pdf/2402.05121)

**Vision / screenshot input**
- "Tables as Texts or Images" (Findings of ACL 2024): compared five text and three image representations on six benchmarks; text tended to do better on Wikipedia-derived benchmarks; GPT-4-class multimodal models could use table images effectively; highlighting and chain-of-thought helped image inputs — [Tables as Texts or Images](https://arxiv.org/html/2402.12424v5)
- SpreadsheetBench 2 gives its agent a read-only `view_xlsx` tool showing both formulas and values rather than screenshots, and uses a VLM only to judge chart output — [SpreadsheetBench 2 paper](https://arxiv.org/html/2606.29955v2)

### Inferences
- There is no universally best serialisation. The older, weaker models showed HTML ahead on small tables; on larger sheets and in agent settings, compact formats (JSON records, address-annotated Markdown, CSV) win because token cost dominates. With current frontier models format choice is a second-order effect compared with (a) whether the data fits and (b) whether the model computes via code.
- For real spreadsheets (as opposed to clean tables), the evidence favours address-annotated, sparse encodings: explicit `A1`-style addresses, empty cells dropped, repeated values merged into ranges, number formats summarised instead of listing every value.
- "Schema + sample rows" is the de facto input in code-executing agents: SpreadsheetBench V1 fed the first 5 rows and found no clear gain from 10 (see section 3), and SheetAgent replaces full-sheet input with targeted SQL query results.
- Structural detection (where tables start and end, which rows are headers) should be done before question answering on multi-table sheets: CoS's two-stage approach added about 22 points over single-stage GPT-4.

### Gaps
- All SpreadsheetLLM numbers are with GPT-4-era models (2024); I found no replication with 2026 models that have much larger context windows, so the size of the benefit today is unknown.
- No controlled study was found that measures screenshot input specifically for spreadsheets (as opposed to rendered web/Wikipedia tables).
- The "Improving Agents" format test was read only through a secondary summary; the model used and its methodology were not verified.
- No study was found that isolates the effect of including cell addresses on QA accuracy with a frontier model.

## 3. Architecture evidence: code generation vs direct cell tools vs text-to-SQL vs whole table in context

### Takeaway
The best-performing published systems all use a sandboxed execute-observe-fix loop (Python/openpyxl/pandas, or a real spreadsheet engine) plus a dedicated inspection tool, rather than reading the whole table in context. SQL-style querying wins clearly on clean, long or multi-table data (about 82% vs under 47% for direct reading in one controlled study) but collapses on messy semi-structured layouts, where hybrids are the most stable.

### Cited Findings

**Code execution with feedback loops**
- SpreadsheetBench V1: multi-round prompting with code-execution feedback raised GPT-4o from 12.79% to 16.08% and GPT-3.5 from 5.38% to 6.58% (appendix runs, 5 preview rows). Adding ReAct-style retrieval on top lowered GPT-4o to 14.67%. Raising preview rows from 5 to 10 gave no clear gain — [SpreadsheetBench paper](https://arxiv.org/html/2406.14991v2)
- SpreadsheetBench 2 reference scaffold (source of the 34.89% result): SWE-agent-style observe-reason-act loop, three tools only (`bash`, read-only `view_xlsx` showing formulas and values, `submit`), up to 50 turns, Docker sandbox with Python 3.11, openpyxl, pandas and LibreOffice, no network — [SpreadsheetBench 2 paper](https://arxiv.org/html/2606.29955v2)
- Scaffold matters with the model held fixed (GLM-5, 50-task subset): the benchmark's scaffold 15.45%, Claude Code 14.20%, Kilo Code 8.66%, Cline 8.66% — [SpreadsheetBench 2 paper](https://arxiv.org/html/2606.29955v2)
- TableBench: single-pass program-of-thought without a repair loop underperformed textual reasoning (GPT-4-Turbo 45.69 vs 51.32) and only 78.67% of GPT-4-Turbo's generated programs executed; GPT-3.5 was the opposite (39.34 PoT vs 30.85 textual) — [TableBench](https://arxiv.org/html/2408.09174v2)
- "Rethinking Tabular Data Understanding" (NAACL 2024; GPT-3.5 on WikiTableQuestions): direct textual chain-of-thought 58.66% vs Python agent 56.87%; combining both with mix self-consistency reached 73.6% — [Rethinking Tabular Data Understanding](https://arxiv.org/abs/2312.16702)
- InfiAgent-DABench: wrapping GPT-4 in heavier agent frameworks did not help at the time: plain GPT-4 with code execution 78.99%, AutoGen 71.48%, XAgent 47.52% — [InfiAgent-DABench](https://arxiv.org/html/2401.05507v3)

**Real spreadsheet engine vs Python libraries**
- GRID (vendor) attributes its 90%+ Verified-400 scores to giving the agent a real spreadsheet engine; roughly 10-15% of its early failures were in the export/write path rather than in reasoning, and scores rose from about 75% to about 91% as those were fixed. The post argues the openpyxl approach is lossy but reports no head-to-head score without the engine — [GRID blog](https://grid.is/blog/an-agent-with-a-spreadsheet-engine-beats-one-without)
- Model choice mattered less than the harness at this level: with the build fixed, Opus 4.8 scored 91.0% and Sonnet 5 90.0% — [GRID blog](https://grid.is/blog/an-agent-with-a-spreadsheet-engine-beats-one-without)
- Vals recalculates every submitted workbook in a real Excel engine before grading — [Vals AI EMB](https://www.vals.ai/benchmarks/emb-v1-1)

**Text-to-SQL vs direct reading vs hybrid (controlled preprint, Sep 2025, "RePairTQA")**
- Weighted accuracy on structured vs semi-structured versions of the same content: NL2SQL 69.14% → 38.65%; XiYan (NL2SQL) 69.55% → 24.08%; GPT-4o direct 45.37% → 41.93%; Gemini-2.5-flash direct 52.07% → 50.78%; hybrid Weaver 62.19% → 57.70% — [Same Content, Different Representations](https://arxiv.org/html/2509.22983v2)
- Long tables: GPT-4o direct falls to 28.9% (structured) and Gemini below 15%, while NL2SQL holds 62.9% on long structured tables. On multi-table structured inputs NL2SQL reaches 82.3%, more than 35 points above GPT-4o. Direct reading manages about 70% on simple lookups but degrades on multi-hop questions — [Same Content, Different Representations](https://arxiv.org/html/2509.22983v2)
- Authors' decision rule: NL2SQL for clean structured tables, hybrids for noisy or large semi-structured inputs, direct LLM reading only as a cheap baseline for simple lookups — [Same Content, Different Representations](https://arxiv.org/html/2509.22983v2)

**Multi-module / multi-agent designs**
- SheetAgent (WWW 2025): Planner writes Python in a closed loop with sandbox feedback; Informer writes SQL against a database copy of the sheet to fetch only the evidence needed; Retriever pulls similar code examples when execution fails — [SheetAgent paper](https://arxiv.org/html/2403.03636v3)
- SheetAgent ablation (SheetRM, GPT-3.5, Exec@1 / Pass@1 / SubPass@1): full 92.4 / 31.2 / 69.8; without Informer 95.3 / 13.2 / 65.8; without Retriever 84.2 / 19.9 / 63.7; without both 88.6 / 11.4 / 57.5 — [SheetAgent paper](https://arxiv.org/html/2403.03636v3)
- Data Interpreter's claimed 94.93% on DABench was not reproduced by an independent group (about 76-80%) — [Data Interpreter](https://arxiv.org/pdf/2402.18679); contradicted by [DatawiseAgent](https://arxiv.org/pdf/2503.07044)

### Inferences
- The strongest single design lever is a closed loop: run code, read the error or result, repair. Single-shot code generation is not reliably better than textual reasoning (TableBench, Rethinking), but every top spreadsheet result since 2025 uses iterative execution.
- The second lever is targeted inspection instead of bulk loading. SheetAgent's SQL "Informer" more than doubled full-task pass rate (13.2 → 31.2) while slightly lowering nothing but raw executability, and V2's failure analysis names insufficient inspection as the top cause of failure (section 4). An agent should be able to query the sheet cheaply and repeatedly.
- Simple scaffolds with few tools (shell + viewer) are competitive with or better than elaborate frameworks; 2024 evidence (AutoGen, XAgent below plain GPT-4) and 2026 evidence (three-tool scaffold at or above coding-agent products) point the same way. Elaborate multi-agent claims should be treated with caution given the Data Interpreter reproduction gap.
- Choice by data shape: clean rectangular CSV or database-like sheets → load into DuckDB/SQLite or pandas and query; messy human-formatted workbooks → first normalise/detect tables with code plus model judgment, then query; whole-table-in-context only for small tables and simple lookups.
- For workbook editing (as opposed to analysis), fidelity of the write path (formulas preserved, recalculation in a real engine) is a measurable part of accuracy, not just an engineering detail.

### Gaps
- No controlled head-to-head was found between "direct cell-level tool calls" (set_cell, set_formula style APIs) and "write a Python script" with the same model; GRID's evidence is suggestive but has no ablation, and is vendor-reported.
- No published ablation was found on turn limits, on the presence or absence of an explicit self-verification/reflection step, or on planner-vs-no-planner with 2026 models. SpreadsheetBench 2 explicitly does not report these.
- SheetMind and TableGPT2 agent results were not found in primary sources during this research.
- Microsoft has not published the architecture ablations behind Agent Mode's 57.2% in the material found.

## 4. Known failure modes and quantified error rates

### Takeaway
The best-documented failures are (1) not looking at enough of the workbook and editing the wrong cells, (2) sharp accuracy loss as tables get longer, wider or multi-table, (3) numerically wrong outputs even when formulas and structure look right, and (4) non-determinism: around 12-14% of tasks flip between pass and fail across identical runs. Several commonly cited risks (hidden sheets, locale/date parsing, cached values) have little quantified evidence.

### Cited Findings
- Dominant failure categories for the best model on SpreadsheetBench 2 are "insufficient inspection" and "wrong target selection" (exact shares are only in a figure) — [SpreadsheetBench 2 paper](https://arxiv.org/html/2606.29955v2)
- Debugging existing workbooks is the weakest skill: best model 12.00%; for formula-error types such as #REF! and #NUM! the best model barely exceeds 20% — [SpreadsheetBench 2 paper](https://arxiv.org/html/2606.29955v2)
- Local error recovery does not translate into task success for weaker models: MiniMax M2.5 fixes at least one error in 72% / 47% / 34% of affected template / modelling / debugging tasks, yet passes only 7% / 9% / 3% end to end; it hits errors in 62-88% of tasks versus 16-67% for Opus 4.6 — [SpreadsheetBench 2 paper](https://arxiv.org/html/2606.29955v2)
- Size and layout effects (GPT-4o, SpreadsheetBench V1): 20.63% on sheets with 50 rows or fewer vs 11.50% on larger; 22.50% with 10 columns or fewer vs 10.51% with more; 21.12% on single-table sheets vs 13.71% on multi-table sheets — [SpreadsheetBench paper](https://arxiv.org/html/2406.14991v2)
- Case-study errors in the same paper: wrong cell indexing, misaligned table reading, ignoring rows beyond the previewed ten, and treating empty cells as zero — [SpreadsheetBench paper](https://arxiv.org/html/2406.14991v2)
- Context overflow: uncompressed spreadsheets above 32k tokens gave F1 0.000 for table detection with GPT-4 (2024), and 8-32k gave 0.288 — [SpreadsheetLLM](https://arxiv.org/html/2407.09025v2)
- Basic structure reading is unreliable when done in-context: best case 67% on detecting a table's size and 44% on cell lookup for GPT-3.5/GPT-4-era models — [Table Meets LLM](https://arxiv.org/html/2305.13062v5)
- Direct in-context reading degrades steadily with length even when the table fits: GPT-4o 28.9% and Gemini-2.5-flash under 15% on long tables in a 2025 controlled study — [Same Content, Different Representations](https://arxiv.org/html/2509.22983v2)
- On WikiTQ/TabFact split by token count, several table-QA methods lost 30-50 points on the largest bin (e.g. Binder to 6.41%, DATER to 34.62%) — [Interpretable LLM-based Table QA](https://arxiv.org/pdf/2412.12386)
- RUST-BENCH (preprint, Nov 2025; tables averaging about 23,000 tokens) reports performance dropping with table size even within the context window — [RUST-BENCH](https://arxiv.org/html/2511.04491v1)
- Trimming a table to its first and last three rows cost a Python agent only 4.42 points (to 52.45%) on WikiTQ, i.e. a code-writing agent needs the schema more than the rows — [Rethinking Tabular Data Understanding](https://arxiv.org/abs/2312.16702)
- Structural perturbation (same content, transposed or shuffled layout) causes a notable decline, particularly for symbolic/code reasoning — [Rethinking Tabular Data Understanding](https://arxiv.org/abs/2312.16702)
- Numbers are the weak point in financial models: formula and presentation checks pass far more often than numerical checks; a formula can reference the right cells and still yield a wrong value because an upstream input is wrong, and errors propagate through linked chains (LBO, DCF worst) — [Vals AI EMB](https://www.vals.ai/benchmarks/emb-v1-1)
- Agents front-load generation and under-invest in later verification — [Vals AI EMB](https://www.vals.ai/benchmarks/emb-v1-1)
- Non-determinism: at temperature 0, 12 of 100 tasks (Sonnet 4.6, five runs) and 14 of 100 (Sonnet 4.5, four runs) flipped between pass and fail; most single-run failures pass on re-run — [GRID blog](https://grid.is/blog/an-agent-with-a-spreadsheet-engine-beats-one-without)
- Semi-structured layouts break SQL pipelines: NL2SQL lost 30-45 points when the same content was presented in non-columnar form — [Same Content, Different Representations](https://arxiv.org/html/2509.22983v2)
- Generated code often does not run first time: 78.67% executable for GPT-4-Turbo single-pass on TableBench — [TableBench](https://arxiv.org/html/2408.09174v2)
- Output formatting alone can cost accuracy in automated pipelines: without an answer-reformatting step GPT-4 lost about 6 points and Mistral-7B up to 32 on DABench — [InfiAgent-DABench](https://arxiv.org/html/2401.05507v3)
- Merged cells: plain Markdown handles them poorly, which is one reason SpreadsheetLLM used address-annotated encoding; merged-cell detection accuracy in-context was 71-78% across formats — [SpreadsheetLLM](https://arxiv.org/html/2407.09025v2); [Table Meets LLM](https://arxiv.org/html/2305.13062v5)

### Inferences
- Failures are mostly silent: benchmarks score completed outputs that executed without error but were wrong (wrong target cell, wrong number). High executability does not imply correctness; SheetAgent without its Informer had the highest Exec@1 (95.3) and less than half the Pass@1.
- Roughly one in eight borderline tasks changes outcome between identical runs, so a single successful run is weak evidence of correctness; running twice and comparing results is a cheap detector.
- Arithmetic done by the model in its head is not directly quantified in the sources read, but the indirect evidence is consistent: in-context cell lookup and size counting are well below 70% for older models, long-table direct reading falls below 30%, and all top systems compute through code or formulas.
- Debugging and modifying someone else's workbook is much harder than building from a template; products that edit existing user files should expect accuracy nearer the V2 debugging numbers than the V1 numbers.

### Gaps
- No quantified error rates were found for: hidden sheets/rows, formulas vs cached values (e.g. openpyxl reading stale or empty cached values), date serials and locale-dependent number/date parsing (decimal comma, DD/MM vs MM/DD), or encoding problems in CSV. These remain engineering lore in the material I read.
- The exact percentage breakdown of V2 failure categories is in a figure I could not read.
- No recent (2026-model) measurement of pure in-context arithmetic error rate on tables was found.
- Header-detection accuracy on multi-row or hierarchical headers with current models was not found; the SpreadsheetLLM table-detection figures (max F1 0.789) are the closest proxy and date from 2024.

## 5. Non-English and multilingual tabular data

### Takeaway
Evidence is thin and none of it is specific to spreadsheets or to Cyrillic-script/Mongolian data. The best available number is an average 19.4% drop for non-English versus English on table-and-text QA (MULTITAT, Findings of EMNLP 2025).

### Cited Findings
- MULTITAT: first multilingual table-and-text QA benchmark, built by sampling three mainstream datasets and translating into 10 languages (the paper body says 11); non-English performance drops by an average of 19.4% relative to English; the authors' baseline improves on others by 3.3 points on average — [MULTITAT, arXiv](https://arxiv.org/abs/2502.17253v1); [ACL Anthology](https://preview.aclanthology.org/dashboard/2025.findings-emnlp.33)
- M3TQA: 97 languages, 50 real-world tables, 2,916 professionally annotated QA pairs (a later listing cites 6,606), tables translated by a six-step LLM pipeline (median back-translation BLEU 60.19); abstract states synthetic unannotated QA data significantly boosts performance, particularly for low-resource languages — [M3TQA](https://arxiv.org/abs/2508.16265)
- A low-resource Indic table-QA paper notes that table QA research has concentrated on high-resource languages — [Table QA for Low-resourced Indic Languages](https://fugumt.com/fugumt/paper_check/2410.03576v1_enmode)

### Inferences
- Expect a material accuracy penalty (order of 20% relative, from MULTITAT) when questions and table content are non-English, likely larger for low-resource languages such as Mongolian, where no benchmark data was found.
- A code-executing architecture should reduce exposure: the model only has to map a question to column names and filter values, while aggregation is exact. The residual risks are header understanding, matching user wording to cell values (inflection, transliteration, mixed Cyrillic/Latin spellings), and file encoding. This is reasoning from the architecture evidence, not a measured result.
- Because public evidence is absent, a project targeting Mongolian (Cyrillic) spreadsheets needs its own small evaluation set built from real files.

### Gaps
- No study was found reporting results on Mongolian, Kazakh, or Russian tabular data specifically; I could not confirm whether M3TQA's 97 languages include them, nor obtain its per-language or high-vs-low-resource scores.
- No evidence was found on Cyrillic headers in spreadsheet-manipulation benchmarks; SpreadsheetBench, SheetCopilot and SheetRM are English (V1 sourced from English Excel forums).
- No measurement was found of tokenisation overhead for Cyrillic cell content and its effect on how much table fits in context.

## 6. Practical guidance derived from the evidence

### Takeaway
Do not let the model read or compute over raw data when it can query it: give it schema, a few rows, and tools to run code or SQL in a sandbox, keep in-context tables small, detect table structure first on messy sheets, and verify numerically by recomputation and re-running rather than by trusting a single pass.

### Cited Findings
- Five preview rows were as good as ten for code-writing agents on SpreadsheetBench V1 — [SpreadsheetBench paper](https://arxiv.org/html/2406.14991v2)
- A code agent given only the first and last three rows lost 4.42 points versus the full table — [Rethinking Tabular Data Understanding](https://arxiv.org/abs/2312.16702)
- In-context accuracy begins falling well before the context limit: 2024 GPT-4 dropped from 0.779 (under 4k tokens) to 0.707 (4-8k) to 0.288 (8-32k) on table detection; 2025 models fell below 30% on long tables in direct reading — [SpreadsheetLLM](https://arxiv.org/html/2407.09025v2); [Same Content, Different Representations](https://arxiv.org/html/2509.22983v2)
- GPT-4o's task accuracy roughly halved beyond 50 rows or 10 columns — [SpreadsheetBench paper](https://arxiv.org/html/2406.14991v2)
- Reducing a table to relevant rows and columns before answering kept GPT-4 accuracy much steadier on long inputs — [Learning to Reduce](https://arxiv.org/pdf/2407.02750)
- Putting the question before the table and including one worked example each gave measurable gains on structural tasks (6.81% and 30.38% respectively, GPT-3.5/4 era) — [Table Meets LLM](https://arxiv.org/html/2305.13062v5)
- Combining a textual and a code-based answer and voting raised WikiTQ accuracy from about 57-59% to 73.6% — [Rethinking Tabular Data Understanding](https://arxiv.org/abs/2312.16702)
- An inspection tool that exposes both formulas and values, a 50-turn budget, and a sandbox with LibreOffice for recalculation formed the best published V2 scaffold — [SpreadsheetBench 2 paper](https://arxiv.org/html/2606.29955v2)
- Recalculating in a real engine and checking numbers, not just formula presence, is what separates passing from failing in financial-model grading — [Vals AI EMB](https://www.vals.ai/benchmarks/emb-v1-1)
- Single-run scores carry several points of noise; a fixed representative 100-task subset is a practical regression suite, and publishing transcripts aids diagnosis — [GRID blog](https://grid.is/blog/an-agent-with-a-spreadsheet-engine-beats-one-without)
- Decision rule from the controlled comparison: SQL for clean structured tables, hybrids for noisy or large semi-structured data, direct reading for simple lookups — [Same Content, Different Representations](https://arxiv.org/html/2509.22983v2)

### Inferences
These are my synthesis for the report writer; the thresholds are judgment calls anchored on the cited numbers, not measured optima.
- **How much table in context.** Treat roughly 50 rows by 10 columns, or a few thousand tokens, as the zone where whole-table reading is still reasonably safe for lookups. Above that, pass schema (column names, types, null counts, distinct-value samples, min/max), 5-10 head rows, optionally a few tail/random rows, and let the agent query. Never rely on in-context reading for sums, counts or joins at any size.
- **When to sample.** Sample for understanding (what the columns mean, what the values look like); never sample for computing. All aggregates should come from code or SQL over the full data, with the model seeing only the result.
- **Messy workbooks.** Run a structure pass first: list all sheets including hidden ones, used ranges, merged ranges, formula vs constant counts, candidate header rows and table boundaries. Present this with cell addresses in a sparse format. Then normalise each detected table into a dataframe or DuckDB table before querying.
- **Architecture default.** One agent, a small tool set (run Python or SQL in a sandbox, view a range with formulas and values, write/submit), an execute-observe-repair loop, and a generous turn budget. Add an evidence-fetching query step before any write. Heavier multi-agent structure is not supported by reproducible evidence.
- **Verification.** (1) Recalculate in a real engine (Excel or LibreOffice) after writing and read back the affected cells. (2) Assert invariants in code: row counts before and after, totals reconcile, no new #REF!/#NUM!/#DIV/0!, untouched cells unchanged (V2 penalises collateral edits). (3) For analytical answers, compute the result a second independent way (e.g. pandas and SQL) or run twice and compare; disagreement flags a likely silent error. (4) Echo back the interpreted columns, filters and row counts so the user can spot a wrong target.
- **Evaluation.** Build a private regression set of real files (including Mongolian-language ones) with known answers, run each case several times, and report median plus flip rate rather than best run. Public V1 scores above 90% do not predict performance on long multi-sheet work; the V2 figure (about 35%) is the more honest expectation for complex workbooks.
- **Model vs harness.** Near the top, harness quality (write-path fidelity, inspection tools) moved scores by more than 15 points (GRID: about 75% to 91%) while swapping top-tier models moved them by about 1 point. Invest in the tool layer first.

### Gaps
- No source gives an empirically derived token or row threshold for 2026 frontier models; the numeric cut-offs above are extrapolated from 2024-2025 studies and should be validated on the target model.
- No measured comparison was found of verification strategies (recalculate-and-read-back vs dual computation vs second-model review) on spreadsheet tasks.
- No published cost/latency trade-off data was found for spreadsheet agents other than the Vals per-task figures ($0.09 to $15.93, about 5 to 37 minutes per financial-model task).
