# Libraries and tooling for reading, writing, editing and analysing spreadsheet files (.xls, .xlsx, .xlsm, .csv) from an AI agent — state as of 16 November 2026

Notes on method: version numbers and release dates were read directly from the PyPI and npm registry JSON APIs on 2026-11-16. Where a claim comes from a vendor-authored benchmark or a community post rather than primary documentation, that is flagged inline. Anything I know from background knowledge but could not source in this session is placed under "Inferences" or "Gaps" and marked as unverified.

## 1. Python libraries: what each supports and does not support; current versions and maintenance

### Takeaway
No single Python library covers everything: openpyxl (3.1.5, last release June 2024) is the only mainstream open-source library that both reads and edits existing .xlsx/.xlsm with styles, but it never computes formulas and drops shapes; calamine-based readers (python-calamine 0.9.1, fastexcel 0.21.0, and the default engine of polars) are the fast read-only path for .xls/.xlsx/.xlsb; XlsxWriter is write-only for new files. Legacy writers (xlwt, xlutils) and pyxlsb/pycel are effectively unmaintained.

### Cited Findings

**Version and maintenance snapshot (registry data, 2026-11-16)**

| Package | Latest | Released | Notes |
|---|---|---|---|
| openpyxl | 3.1.5 | 2024-06-28 | MIT; no release for ~29 months — [PyPI](https://pypi.org/project/openpyxl/) |
| pandas | 3.1.1 | 2026-11-04 | requires Python >=3.11 — [PyPI](https://pypi.org/project/pandas/) |
| xlrd | 2.0.2 | 2025-06-14 | BSD; .xls only — [PyPI](https://pypi.org/project/xlrd/) |
| xlwt | 1.3.0 | 2017-08-22 | no release in 9 years — [PyPI](https://pypi.org/project/xlwt/) |
| xlutils | 2.0.0 | 2016-06-09 | no release in 10 years — [PyPI](https://pypi.org/project/xlutils/) |
| XlsxWriter | 3.3.1 | 2026-10-28 | actively released — [PyPI](https://pypi.org/project/XlsxWriter/) |
| pyxlsb | 1.0.10 | 2022-10-14 | LGPLv3+; no release in 4 years — [PyPI](https://pypi.org/project/pyxlsb/) |
| python-calamine | 0.9.1 | 2026-11-03 | requires Python >=3.11 — [PyPI](https://pypi.org/project/python-calamine/) |
| fastexcel | 0.21.0 | 2026-08-19 | requires Python >=3.10 — [PyPI](https://pypi.org/project/fastexcel/) |
| polars | 2.1.0 | 2026-10-25 | requires Python >=3.11 — [PyPI](https://pypi.org/project/polars/) |
| duckdb | 2.0.0 | 2026-10-21 | requires Python >=3.11 — [PyPI](https://pypi.org/project/duckdb/) |
| xlwings | 0.37.8 | 2026-10-23 | BSD 3-clause (open-source part) — [PyPI](https://pypi.org/project/xlwings/) |
| formulas | 1.3.4 | 2026-03-11 | EUPL 1.1+ — [PyPI](https://pypi.org/project/formulas/) |
| pycel | 1.0b30 | 2021-10-13 | still a beta; no release in 5 years — [PyPI](https://pypi.org/project/pycel/) |
| charset-normalizer | 3.5.2 | 2026-09-30 | MIT — [PyPI](https://pypi.org/project/charset-normalizer/) |
| chardet | 7.7.0 | 2026-10-18 | requires Python >=3.10 — [PyPI](https://pypi.org/project/chardet/) |
| xlsx2csv | 0.8.6 | 2026-01-31 | — [PyPI](https://pypi.org/project/xlsx2csv/) |
| pylightxl | 1.61 | 2023-01-01 | — [PyPI](https://pypi.org/project/pylightxl/) |

**openpyxl**
- Warning in the tutorial: "openpyxl does currently not read all possible items in an Excel file so shapes will be lost from existing files." — [openpyxl tutorial](https://openpyxl.readthedocs.io/en/stable/tutorial.html)
- Saving "will overwrite existing files without warning." — [openpyxl tutorial](https://openpyxl.readthedocs.io/en/stable/tutorial.html)
- `data_only` controls whether cells with formulas return "the formula (default) or the value stored the last time Excel read the sheet"; `keep_vba` preserves VBA content but "If they are preserved they are still not editable." — [openpyxl tutorial](https://openpyxl.readthedocs.io/en/stable/tutorial.html)
- Read-only mode "uses much less memory and is faster" but "not all features are available (charts, images, etc.)"; worksheets cannot be copied in read-only or write-only mode, and worksheet copy does not carry images or charts. — [openpyxl tutorial](https://openpyxl.readthedocs.io/en/stable/tutorial.html)
- Pivot tables: "openpyxl provides read-support for pivot tables so that they will be preserved in existing files", but "it is not intended that client code should be able to create pivot tables" and "there is currently no management API for pivot tables." — [openpyxl pivot docs](https://openpyxl.readthedocs.io/en/stable/pivot.html)
- Memory rule of thumb from the project itself: memory use is "approximately 50 times the original file size", e.g. about 2.5 GB for a 50 MB Excel file (normal, non-read-only mode). — [openpyxl performance](https://openpyxl.readthedocs.io/en/stable/performance.html)

**pandas (3.1.1)**
- `read_excel` engines: `openpyxl` (newer Excel formats), `calamine` (.xls, .xlsx, .xlsm, .xlsb, .ods), `odf` (.odf/.ods/.odt), `pyxlsb` (.xlsb), `xlrd` (old-style .xls). — [pandas.read_excel](https://pandas.pydata.org/docs/reference/api/pandas.read_excel.html)
- Default engine selection: .xls → xlrd, .xlsb → pyxlsb, OpenDocument → odf, otherwise openpyxl. — [pandas.read_excel](https://pandas.pydata.org/docs/reference/api/pandas.read_excel.html)
- Deprecation notice since 3.1.0: for xlsx/xlsm the default reader will change from `openpyxl` to `calamine` in a future version; pass `engine=` explicitly or set the `io.excel.xlsx.reader` option to pin behaviour. — [pandas.read_excel](https://pandas.pydata.org/docs/reference/api/pandas.read_excel.html)
- If `converters` are given they are applied instead of dtype conversion; `dtype=object` keeps data as stored in Excel. — [pandas.read_excel](https://pandas.pydata.org/docs/reference/api/pandas.read_excel.html)
- Write engines are only `openpyxl` or `xlsxwriter`; "Creating an ExcelWriter object with a file name that already exists will overwrite the existing file because the default mode is write"; "Once a workbook has been saved it is not possible to write further data without rewriting the whole workbook." Appending a sheet requires `pd.ExcelWriter(path, mode="a")`. — [pandas.DataFrame.to_excel](https://pandas.pydata.org/docs/reference/api/pandas.DataFrame.to_excel.html)
- pandas checks only that row count, column count and per-cell character count fit Excel's limits; "All other limitations must be checked by the user." — [pandas.DataFrame.to_excel](https://pandas.pydata.org/docs/reference/api/pandas.DataFrame.to_excel.html)

**xlrd (2.0.2)**
- "xlrd is a library for reading data and formatting information from Excel files in the historical `.xls` format" and "This library will no longer read anything other than `.xls` files." — [xlrd docs](https://xlrd.readthedocs.io/en/latest/)
- Not supported but "safely and reliably ignored": charts, macros, pictures and other embedded objects, VBA modules, formulas (only the results are extracted), comments, hyperlinks, autofilters, advanced filters, pivot tables, conditional formatting, data validation. Password-protected files cannot be opened. — [xlrd docs](https://xlrd.readthedocs.io/en/latest/)

**XlsxWriter (3.3.1)**
- Supports "formatting, images, charts, page setup, autofilters, conditional formatting and many others", but "It cannot read or modify existing Excel XLSX files." It "can be configured to use very little memory even for very large output files." — [XlsxWriter introduction](https://xlsxwriter.readthedocs.io/introduction.html)

**python-calamine / fastexcel / Rust calamine**
- python-calamine is a "Python binding for Rust's library for reading excel and odf file" (xlsx, xlsb, xls, ods); API is `CalamineWorkbook.from_path(...)`, `sheet_names`, `get_sheet_by_name(...).to_python()`; by default leading empty rows/columns are skipped unless `skip_empty_area=False`. "Pandas 2.2 and above have built-in support of python-calamine." — [python-calamine GitHub](https://github.com/dimastbk/python-calamine)
- The underlying Rust crate reads xls, xlsx, xlsm, xlsb, xla, xlam and ods; exposes cell values, formulas (`worksheet_formula`), VBA code (`vba_project`), defined names, XLSX-only cell styles (`worksheet_style()`), and raw picture data behind a feature flag. It cannot write files. — [tafia/calamine GitHub](https://github.com/tafia/calamine)
- A benchmark author observed that calamine returned an integer column as float (`1.0`) and that it loads the full dataset into memory without a streaming iterator (observation dated January 2024, may not hold for 0.9.x). — [Haki Benita, Fastest Way to Read Excel in Python](https://hakibenita.com/fast-excel-python)

**polars (2.1.0)**
- `read_excel` engines: `calamine` (default since 1.0, via the `fastexcel` module; reads .xlsx, .xlsb, .xls; "dramatically faster than the other options"), `openpyxl` (significantly slower, fallback), `xlsx2csv` (converts the sheet to in-memory CSV then calls `read_csv`). — [polars.read_excel](https://docs.pola.rs/api/python/stable/reference/api/polars.read_excel.html)
- Key parameters: `sheet_id` (0 loads all sheets and returns a `{sheetname: DataFrame}` dict), `sheet_name`, `table_name` (named Excel tables, 1.20+), `has_header`, `columns`, `schema_overrides`, `infer_schema_length`, `drop_empty_rows`, `drop_empty_cols`, `raise_if_empty` (raises `NoDataError`), `include_file_paths`; multiple paths/globs supported since 1.18. The reference page documents no lazy `scan_excel`. — [polars.read_excel](https://docs.pola.rs/api/python/stable/reference/api/polars.read_excel.html)

**DuckDB (2.0.0) excel extension**
- `read_xlsx` options: `header`, `sheet` (defaults to first sheet), `all_varchar` (default false), `ignore_errors` (default false; replaces uncastable cells with NULL), `range` (e.g. `A1:B2`), `stop_at_empty`, `empty_as_varchar`. `COPY ... TO` xlsx options: `header`, `sheet` (default `Sheet1`), `sheet_row_limit` (default 1048576; errors if exceeded). — [DuckDB excel extension](https://duckdb.org/docs/2.0/core_extensions/excel.html)
- "`.xls` files are not supported." — [DuckDB excel extension](https://duckdb.org/docs/2.0/core_extensions/excel.html)
- Types are inferred from the first data row only (TIMESTAMP/TIME/DATE/BOOLEAN from cell format; empty cells treated as DOUBLE unless `empty_as_varchar`); the docs warn "This can sometimes lead to issues if the first 'data row' is not representative of the rest of the sheet." — [DuckDB excel extension](https://duckdb.org/docs/2.0/core_extensions/excel.html)
- On write, numerics become DOUBLE, TIMESTAMP_TZ/TIME_TZ are converted to UTC with the timezone lost, BOOLEANs become 1/0 with a display format, other types are written as text. — [DuckDB excel extension](https://duckdb.org/docs/2.0/core_extensions/excel.html)

**xlwings (0.37.8)**
- Classic xlwings requires an installed Excel and therefore runs only on Windows and macOS; VBA UDF integration is Windows-only; it does not run on Linux. The PRO "File Reader" (since v0.28.0) runs on Linux without Excel. Python 3.11+ required. — [xlwings installation docs](https://docs.xlwings.org/en/latest/installation.html)

**Feature-fidelity scores (vendor-authored benchmark — treat with caution)**
- ExcelBench, which states it "is maintained by the authors of WolfXL, not an independent testing organization", scored libraries on 18 formatting/structure features in its 2026-04-29 snapshot: openpyxl 18/18, XlsxWriter 15/18 (write), xlsxwriter constant-memory 12/18, xlwt 4/18, pandas 3/18, openpyxl read-only 3/18, pylightxl 2/18, python-calamine 1/18, polars 0/18. — [SynthGL/ExcelBench](https://github.com/SynthGL/ExcelBench)

### Inferences
- Capability matrix an agent can rely on, derived from the cited docs:

| Capability | openpyxl | pandas | xlrd | XlsxWriter | calamine / fastexcel / polars | DuckDB | xlwings (classic) |
|---|---|---|---|---|---|---|---|
| Read .xlsx/.xlsm | yes | yes (via engine) | no | no | yes | .xlsx yes | yes (needs Excel) |
| Read legacy .xls | no | via xlrd or calamine | yes | no | yes | no | yes (needs Excel) |
| Write new .xlsx | yes | yes (openpyxl/xlsxwriter) | no | yes | polars writes via xlsxwriter (not verified in this session) | yes, values only | yes |
| Edit existing file in place | yes (with losses) | no — rewrites | no | no | no | no | yes, full fidelity |
| Styles / cond. formatting / validation | read+write | essentially none | read formatting only, ignores CF/DV | write | not exposed in Python bindings | none | via Excel |
| Charts | create; existing shapes lost | none | ignored | create | none | none | via Excel |
| Pivot tables | preserved, no creation API | none | ignored | none | none | none | via Excel |
| Macros/VBA | preserved only with `keep_vba`, not editable | none | ignored | (not verified) | Rust crate can read VBA; Python binding not documented | none | via Excel |
| Computes formulas | no | no | no (returns cached results) | no | no | no | yes (Excel does) |

- openpyxl's 29-month gap since the last release while pandas has announced it will switch its default xlsx reader to calamine suggests the Python ecosystem is consolidating on calamine for reading while openpyxl stays the default for editing; an agent stack should pin `engine=` explicitly to avoid behaviour changes (for example, int vs float typing differences).
- xlwt, xlutils, pyxlsb and pycel should be treated as unmaintained based on release dates alone (9, 10, 4 and 5 years since last release respectively).
- The pandas `to_excel` documentation listing only openpyxl and xlsxwriter as write engines implies pandas can no longer write .xls at all.

### Gaps
- I did not retrieve the pandas release note documenting when the xlwt writer was removed, nor the openpyxl statement on whether its repository is still actively developed; the "maintenance" judgement for openpyxl rests only on the release date.
- XlsxWriter's VBA support (embedding a pre-extracted `vbaProject.bin`) and polars' `write_excel` feature set were not verified in this session.
- Merged-cell behaviour per library (openpyxl exposes merged ranges; pandas/calamine return the value only in the top-left cell) was not confirmed from primary docs in this session.
- xlwings licensing boundaries (which features require a paid PRO licence) were not retrieved beyond the File Reader being a PRO feature.
- WolfXL (the vendor behind ExcelBench) claims 18/18 fidelity and openpyxl API compatibility; I found no independent verification and did not evaluate its licence or maturity.

## 2. JavaScript/TypeScript: SheetJS, ExcelJS, Papa Parse, csv-parse

### Takeaway
The `xlsx` package on npm is frozen at 0.18.5 (March 2022) and carries known vulnerabilities; current SheetJS (0.20.3) must be installed from cdn.sheetjs.com or vendored. ExcelJS (4.4.0, October 2023) has the richest open-source styling API in JS but has had no release in three years and a large unmerged backlog; Papa Parse and csv-parse are both actively released.

### Cited Findings
- npm registry state on 2026-11-16: `xlsx` 0.18.5 (published 2022-03-24, Apache-2.0); `exceljs` 4.4.0 (2023-10-19, MIT); `papaparse` 5.7.1 (2026-11-11, MIT); `csv-parse` 7.0.3 (2026-09-25, MIT); `csv-stringify` 6.9.0 (2026-09-25); `fast-csv` 5.0.8 (2026-10-05); `hyperformula` 3.5.0 (2026-10-09, GPL-3.0-only); `read-excel-file` 9.3.17 (2026-11-13); `xlsx-populate` 1.21.0 (2020-03-01). — [npm xlsx](https://www.npmjs.com/package/xlsx), [npm exceljs](https://www.npmjs.com/package/exceljs), [npm papaparse](https://www.npmjs.com/package/papaparse), [npm csv-parse](https://www.npmjs.com/package/csv-parse), [npm hyperformula](https://www.npmjs.com/package/hyperformula)
- SheetJS docs: "the registry is out of date. The latest version on that registry is 0.18.5." Recommended install: `npm rm --save xlsx` then `npm i --save https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`; "making a local copy of SheetJS modules ('vendoring') is strongly recommended". — [SheetJS Node.js installation](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/)
- CVE-2023-30533 (prototype pollution) affects SheetJS CE through 0.19.2, fixed in 0.19.3; the fixed version is not available on npm. — [SheetJS advisory CVE-2023-30533](https://cdn.sheetjs.com/advisories/CVE-2023-30533.html)
- CVE-2024-22363 (regular-expression denial of service) affects SheetJS CE through 0.20.1, fixed in 0.20.2. — [SheetJS advisory CVE-2024-22363](https://cdn.sheetjs.com/advisories/CVE-2024-22363.html)
- Some third-party vulnerability databases still list "no fixed version" for these CVEs because they only track the npm package. — [GitLab advisory database issue](https://gitlab.com/gitlab-org/security-products/gemnasium-db/-/issues/330)
- SheetJS CE format coverage: reads and writes XLSX/XLSM, XLSB, SpreadsheetML 2003, XLS BIFF2 through BIFF8, CSV/TXT, DIF, SYLK, PRN, ODS/FODS, Numbers, DBF, HTML, RTF; formats with row/column limits are silently truncated. — [SheetJS file formats](https://docs.sheetjs.com/docs/miscellany/formats/)
- ExcelJS repository: MIT, 15.5k stars, 671 open issues and 159 open pull requests at time of fetch. — [exceljs/exceljs GitHub](https://github.com/exceljs/exceljs)
- ExcelJS README features: worksheet properties and page setup, frozen/split views, auto filters, merged cells, defined names, data validations, cell comments, tables, styles (number formats, fonts, alignment, borders, fills, rich text, protection), conditional formatting (expression, cellIs, top10, colorScale, iconSet, dataBar), images, sheet protection, XLSX and CSV I/O, streaming XLSX reader/writer, formula values including shared and array formulas. Stated limits: images "are not supported in streaming mode"; in streaming, a worksheet cannot be removed once added and `unMergeCells()` is not supported. — [ExcelJS README](https://raw.githubusercontent.com/exceljs/exceljs/master/README.md)
- Vendor-authored ExcelBench (2026-10-03 snapshot, 21 features) scored ExcelJS 12/21 read and 15/21 write, SheetJS CE 9/21 read and 8/21 write; in its template-mutation test SheetJS preserved 8/17 features and ExcelJS failed to load the template. — [SynthGL/ExcelBench](https://github.com/SynthGL/ExcelBench)

### Inferences
- For a Node-based agent that must read legacy .xls, SheetJS CE is the only one of the four JS libraries that handles BIFF; ExcelJS is xlsx/csv only (its repo topics list only xlsx and csv, and .xls is not mentioned).
- Any dependency scanner that flags `xlsx@0.18.5` is correct; an agent that generates `npm install xlsx` is installing a vulnerable build. Generated code should use the CDN tarball URL or a vendored tarball.
- SheetJS CE's low fidelity scores are consistent with styling being outside the Community Edition's write path; it is best treated as a data-extraction/conversion library, not a formatting-preserving editor.
- ExcelJS's three-year release gap plus 159 open PRs indicates stalled maintenance; it remains usable but bugs are unlikely to be fixed upstream.

### Gaps
- I did not retrieve the SheetJS Pro vs Community feature boundary (styles, charts, pivot tables, VBA, images) from a primary source.
- I did not verify whether ExcelJS has open security advisories, nor confirm from its README that charts, pivot tables and macros are unsupported (the fetched portion of the README did not list them as features, and the "Known Issues" section was beyond the portion read).
- Papa Parse and csv-parse capability details (streaming, worker threads, delimiter auto-detect, BOM handling, `dynamicTyping`) were not fetched from primary docs in this session; only their versions and release dates are confirmed.
- HyperFormula (GPL-3.0-only, 3.5.0) is a JS formula engine that could serve recalculation in Node; its function coverage was not researched.

## 3. Handling the legacy binary .xls format in 2026

### Takeaway
.xls is readable but effectively not writable or editable with maintained open-source Python tooling: read with xlrd 2.x or calamine, and if the file must be edited or styled, convert it to .xlsx first (LibreOffice headless or Excel itself) and work on the converted copy.

### Cited Findings
- xlrd reads only .xls, and ignores charts, macros, pictures, VBA, comments, hyperlinks, autofilters, pivot tables, conditional formatting and data validation; formula text is not exposed, only cached results; password-protected files cannot be opened. — [xlrd docs](https://xlrd.readthedocs.io/en/latest/)
- pandas routes .xls to xlrd by default, and its calamine engine also reads .xls. — [pandas.read_excel](https://pandas.pydata.org/docs/reference/api/pandas.read_excel.html)
- polars' default calamine engine reads .xls. — [polars.read_excel](https://docs.pola.rs/api/python/stable/reference/api/polars.read_excel.html)
- The Rust calamine crate reads xls and xla, including formulas and VBA projects. — [tafia/calamine GitHub](https://github.com/tafia/calamine)
- DuckDB's excel extension: "`.xls` files are not supported." — [DuckDB excel extension](https://duckdb.org/docs/2.0/core_extensions/excel.html)
- Microsoft Graph's Excel REST API "supports only Office Open XML file formatted workbooks. The `.xls` extension workbooks aren't supported." — [Microsoft Graph Excel API](https://learn.microsoft.com/en-us/graph/api/resources/excel)
- The only Python .xls writer, xlwt, last released 1.3.0 on 2017-08-22. — [PyPI xlwt](https://pypi.org/project/xlwt/)
- SheetJS CE reads and writes BIFF2–BIFF8 .xls. — [SheetJS file formats](https://docs.sheetjs.com/docs/miscellany/formats/)
- LibreOffice headless conversion to CSV took 15.28 s for a 500K-row, 25 MB xlsx in one benchmark, and all type information was lost in the CSV output. — [Haki Benita](https://hakibenita.com/fast-excel-python)

### Inferences
- Recommended agent routing for .xls: (a) data extraction only → `pd.read_excel(path, engine="calamine")` or `pl.read_excel`; (b) need formatting info → xlrd; (c) need to edit/return a workbook → convert to .xlsx with `soffice --headless --convert-to xlsx`, edit with openpyxl, and return .xlsx (tell the user the format changed) rather than trying to write .xls.
- An agent should detect the real format from file signature rather than extension, since files named .xls are frequently HTML tables, CSV or xlsx in practice (not sourced in this session; common field experience).
- .xls has a much smaller grid than .xlsx, so converting a large .xlsx down to .xls can truncate data; SheetJS documents that formats with limits are silently truncated.

### Gaps
- The exact LibreOffice command-line syntax and fidelity of .xls → .xlsx conversion (macros, charts, pivot tables) were not verified from LibreOffice documentation in this session.
- xlrd security advisories for 2.x and its `formatting_info=True` behaviour were not checked.
- The .xls grid limit (65,536 rows by 256 columns) is well known but was not sourced in this session.

## 4. Formula handling and recalculation; avoiding loss of cached values

### Takeaway
None of the file libraries compute formulas; they either return the cached value Excel last stored or the formula text. Recalculation needs a real engine: Excel (COM/xlwings or Microsoft Graph), LibreOffice headless, or a Python interpreter such as `formulas`. An agent that writes formulas with openpyxl must run a recalculation pass before reading values back.

### Cited Findings
- openpyxl returns either the formula or "the value stored the last time Excel read the sheet" depending on `data_only`. — [openpyxl tutorial](https://openpyxl.readthedocs.io/en/stable/tutorial.html)
- xlrd does not expose formulas, only "results of formula calculations". — [xlrd docs](https://xlrd.readthedocs.io/en/latest/)
- `formulas` (1.3.4, EUPL 1.1+) "implements an interpreter for Excel formulas"; workflow is `ExcelModel().loads(path).finish()` → `calculate(inputs=..., outputs=...)` → `write(dirpath=...)`; circular references need `finish(circular=True)`; it implements 483 of 536 Excel functions (90.1%), with Automation, Cube, Database and Web categories having none implemented. — [vinci1it2000/formulas GitHub](https://github.com/vinci1it2000/formulas)
- pycel's latest release is 1.0b30 from October 2021. — [PyPI pycel](https://pypi.org/project/pycel/)
- Classic xlwings drives a real Excel installation and so only works on Windows and macOS. — [xlwings installation docs](https://docs.xlwings.org/en/latest/installation.html)
- Microsoft Graph Excel API: works on workbooks stored in OneDrive for Business, SharePoint or Group drives (OneDrive Consumer not supported); requires `Files.Read` / `Files.ReadWrite`; supports persistent sessions, non-persistent sessions ("useful for apps that need to do analysis or obtain the results of a calculation or a chart image, but not affect the document state") and sessionless calls; persistent sessions expire after about 5 minutes of inactivity and non-persistent after about 7. — [Microsoft Graph Excel API](https://learn.microsoft.com/en-us/graph/api/resources/excel)
- Graph ranges return `values`, `formulas`, `text`, `numberFormat` and `valueTypes` together; unbounded ranges (e.g. `C:C`) return null for cell-level properties; ranges over 5M cells return nulls for some properties; large ranges should be read/written in smaller pieces. Workbook functions can be called directly (e.g. `/workbook/functions/pmt`). — [Microsoft Graph Excel API](https://learn.microsoft.com/en-us/graph/api/resources/excel)
- LibreOffice community reports (not official documentation): by default LibreOffice may not recalculate Excel-format files on load, and a headless PDF conversion produced stale values unless the "Recalculation on File Load" setting was "Always". — [LibreOffice bug 107745](https://bugs.libreoffice.org/show_bug.cgi?id=107745), [Ask LibreOffice thread](https://ask.libreoffice.org/t/export-from-xlsx-to-pdf-dont-recalculate-all-cells/97587)
- A community tutorial describes the pattern of generating a workbook with Python, recalculating through headless LibreOffice, then validating with openpyxl `data_only=True`. — [HackerNoon](https://hackernoon.com/how-to-generate-recalculate-and-validate-excel-workbooks-with-python)
- Vendor-authored ExcelBench reports LibreOffice 26.8.0.3 computed 133/133 formulas in a 133-formula financial dependency graph (2026-10-27). — [SynthGL/ExcelBench](https://github.com/SynthGL/ExcelBench)

### Inferences
- Safe agent protocol to avoid losing cached values: (1) never save a workbook that was opened with `data_only=True` — doing so replaces formulas with static values (widely known openpyxl behaviour; not quoted from docs in this session); (2) open twice if both are needed — one handle with formulas for editing, one `data_only=True` handle for reading values; (3) after any openpyxl save, treat every formula's cached value as absent until a recalculation engine has re-saved the file; (4) scan the recalculated file for error values (`#REF!`, `#DIV/0!`, `#NAME?`, `#VALUE!`, `#N/A`) before reporting results.
- Engine choice by environment: Linux container/sandbox → LibreOffice headless (free, but verify recalculation actually happened, given the "never recalculate" default reports) or `formulas` (pure Python, 90% function coverage, no dynamic-array guarantees verified); Windows/macOS desktop with Excel → xlwings for exact Excel semantics; Microsoft 365 tenant → Graph with a non-persistent session to calculate without mutating the stored file.
- LibreOffice and Excel are different calculation engines, so a small share of functions (newer dynamic-array and Microsoft-365-only functions in particular) may evaluate differently or not at all; results from LibreOffice should be described as "recalculated with LibreOffice", not "as Excel shows".

### Gaps
- I did not find an official LibreOffice statement on whether `soffice --headless --convert-to xlsx` recalculates formulas on load, nor a documented command-line switch to force it; community scripts use a macro or UNO call to force hard recalculation.
- The Graph `workbook/application/calculate` endpoint (calculation types `Recalculate`, `Full`, `FullRebuild`) is not described on the page fetched; its existence and throttling limits were not verified in this session.
- No benchmark comparing recalculation latency across LibreOffice, `formulas`, and Excel was found.
- `formulas` support for dynamic arrays, LAMBDA/LET and structured table references was not verified.

## 5. CSV pitfalls: encoding, delimiters, locale, leading zeros, large files, formula injection

### Takeaway
CSV has no schema, so an agent must detect encoding and dialect explicitly, read as text first when identifiers matter, and sanitise on export. DuckDB's sniffer and pandas' options cover dialect and typing well; encoding detection remains probabilistic and needs a fallback chain.

### Cited Findings

**Encoding detection**
- charset-normalizer (MIT) and chardet each support 99 encodings; project-reported accuracy is 98% for charset-normalizer and 99% for chardet, with about 0.4 ms mean per file for both; on a 272 MiB file chardet took 3.4 s and charset-normalizer 0.3 s. These figures are from charset-normalizer's own README. — [jawah/charset_normalizer](https://github.com/jawah/charset_normalizer)
- Limitations stated by the project: detection should not be run on "very tiny content", and language detection is unreliable when text mixes languages sharing letters. API: `from_path(...).best()`, plus a chardet-compatible `detect()`; CLI `normalizer <file>` emits JSON with `encoding`, `language`, `chaos`, `coherence`. — [jawah/charset_normalizer](https://github.com/jawah/charset_normalizer)
- chardet's licence is listed by the charset-normalizer project as 0BSD and described there as disputed. — [jawah/charset_normalizer](https://github.com/jawah/charset_normalizer)

**Delimiter and dialect sniffing**
- pandas: `sep=None` "detects the separator from the first valid row of the file with Python's builtin sniffer tool, `csv.Sniffer`; it is supported only by the Python parsing engine". — [pandas IO user guide](https://pandas.pydata.org/docs/user_guide/io.html)
- DuckDB sniffer candidates: delimiters `,` `|` `;` and tab; quotes `"`, `'` or none; escapes `"`, `'`, `\` or none; it picks the dialect that parses every row into the same number of columns with the highest column count. Default sample size is 20,480 rows (`sample_size=-1` reads the whole file); non-seekable inputs such as .gz or stdin are sampled only from the start. — [DuckDB CSV auto detection](https://duckdb.org/docs/2.0/data/csv/auto_detection.html)
- DuckDB header detection compares first-row types to the rows below; if all columns are VARCHAR it cannot tell and assumes a header exists. — [DuckDB CSV auto detection](https://duckdb.org/docs/2.0/data/csv/auto_detection.html)
- `sniff_csv()` runs detection as a separate step and returns the detected properties plus a ready-to-run `read_csv` command in a `Prompt` column. — [DuckDB CSV auto detection](https://duckdb.org/docs/2.0/data/csv/auto_detection.html)

**Type, date and number locale**
- DuckDB type candidates in priority order: NULL, BOOLEAN, TIME, DATE, TIMESTAMP, TIMESTAMPTZ, BIGINT, HUGEINT, BIGNUM, DOUBLE, VARCHAR; `all_varchar` disables detection; `types` overrides per column. Date format preference order: ISO 8601, `%y-%m-%d`, `%Y-%m-%d`, `%d-%m-%y`, `%d-%m-%Y`, `%m-%d-%y`, `%m-%d-%Y`; ambiguity is resolved from other values in the column and otherwise by that order; override with `dateformat`/`timestampformat`. — [DuckDB CSV auto detection](https://duckdb.org/docs/2.0/data/csv/auto_detection.html)
- pandas: `decimal` ("use ',' for European data"), `thousands`, `dayfirst` ("DD/MM format dates, international and European format"), `date_format` (since 2.0.0), `on_bad_lines` = error/warn/skip. — [pandas IO user guide](https://pandas.pydata.org/docs/user_guide/io.html)

**Leading zeros and raw preservation**
- pandas: "Use `str` or `object` together with suitable `na_values` settings to preserve and not interpret dtype." — [pandas IO user guide](https://pandas.pydata.org/docs/user_guide/io.html)
- Excel stores numbers with 15 digits of precision. — [Microsoft: Excel specifications and limits](https://support.microsoft.com/en-us/office/excel-specifications-and-limits-1672b34d-7043-467e-8e27-269d656771c3)

**Large files**
- pandas: `chunksize` / `iterator` return a `TextFileReader` for chunked iteration; the pyarrow engine "is fastest on larger workloads" and multithreaded, but "Some features of the 'pyarrow' engine are unsupported or may not work correctly"; the python engine is the most feature-complete. — [pandas IO user guide](https://pandas.pydata.org/docs/user_guide/io.html)
- polars: `scan_csv` delays parsing and returns a `LazyFrame`, enabling query optimisations, versus eager `read_csv`. — [Polars CSV user guide](https://docs.pola.rs/user-guide/io/csv/)

**CSV / formula injection**
- "CSV Injection, also known as Formula Injection, occurs when websites embed untrusted input inside CSV files." Trigger characters at the start of a cell: `=`, `+`, `-`, `@`, tab (0x09), carriage return (0x0D), line feed (0x0A), and full-width variants such as `＝`, `＋`, `－`, `＠`. — [OWASP CSV Injection](https://community.owasp.org/attacks/CSV_Injection)
- OWASP mitigation: wrap each field in double quotes, prepend each field with a single quote, and escape every double quote with an additional double quote; an Excel-resistant variant is to "prefix any cell starting with `=`, `+`, `-`, or `@` with a tab character (0x09) inside the quoted field". OWASP warns these techniques "are not reliable in Microsoft Excel after saving and re-opening the CSV file." — [OWASP CSV Injection](https://community.owasp.org/attacks/CSV_Injection)

### Inferences
- Because DuckDB assumes a header when every column is text and pandas sniffs from the first valid row only, an agent should always print the detected dialect, header decision and first few rows and sanity-check them rather than trusting auto-detection silently; `sniff_csv()` is well suited to this because it returns the detected settings as data.
- Leading-zero identifiers (registration numbers, phone numbers, postal codes, bank accounts) and long digit strings beyond 15 digits are destroyed by numeric inference; the safe default for an agent is a first pass with everything as text (`dtype=str` in pandas, `all_varchar=true` in DuckDB, `infer_schema_length=0` in polars — the last not verified in this session) and then casting selected columns deliberately.
- Day-first vs month-first ambiguity cannot be resolved from a column where every day is 12 or less; DuckDB's fallback preference order places day-first before month-first, while pandas requires `dayfirst=True` explicitly, so the same file can parse differently in the two tools.
- Sanitising against formula injection changes the data (adds a quote or tab), so it should be applied only on export of untrusted text destined for a spreadsheet application, never on files that feed another program; the same risk applies to string cells written into .xlsx if they are written as formulas.
- Recommended encoding fallback chain for files from Mongolian/Russian-language sources: check for a UTF-8 BOM (`utf-8-sig`), attempt strict UTF-8, then run charset-normalizer, then try `cp1251`, and finally show the user a decoded sample of non-ASCII text for confirmation. Detection on short files is explicitly unreliable per the library's own README.

### Gaps
- Mongolian Cyrillic specifically: I found no source in this session on how charset-normalizer or chardet perform on Mongolian text. From background knowledge (unverified here): the letters Ө/ө and Ү/ү are not present in standard Windows-1251, so legacy Mongolian files often use non-standard cp1251 font hacks where other code points (commonly Є/є and Ї/ї) stand in for them; such files decode "successfully" as cp1251 but show the wrong letters and need a post-decode character mapping. This should be tested on real sample files before the agent design is finalised.
- Excel's own behaviour when opening CSV (needs a UTF-8 BOM to detect UTF-8; uses the OS regional list separator, so semicolon-delimited files are common in locales with decimal commas) was not sourced in this session.
- DuckDB `encoding`, `store_rejects`, `strict_mode` and `null_padding` options and polars `scan_csv` encoding restrictions, `decimal_comma`, `try_parse_dates` were not covered by the pages fetched.
- Papa Parse / csv-parse behaviour for BOM, delimiter guessing and streaming was not verified.

## 6. Large-file performance: measured numbers and Excel hard limits

### Takeaway
On every measurement found, calamine-based reading is roughly 6–13 times faster than openpyxl, and openpyxl's full-load mode costs about 50 times the file size in RAM. Most public numbers are single-machine tests on older library versions, so they indicate order of magnitude only.

### Cited Findings

**Excel hard limits**
- Worksheet size 1,048,576 rows by 16,384 columns; 32,767 characters per cell; column width 255 characters; number precision 15 digits; formula length 8,192 characters; 64 nested function levels; 65,530 hyperlinks per worksheet; 65,490 unique cell formats/styles; earliest date 1 January 1900 (1904 in the 1904 date system), latest 31 December 9999. — [Microsoft: Excel specifications and limits](https://support.microsoft.com/en-us/office/excel-specifications-and-limits-1672b34d-7043-467e-8e27-269d656771c3)
- DuckDB enforces `sheet_row_limit` 1,048,576 by default on xlsx export and errors if exceeded. — [DuckDB excel extension](https://duckdb.org/docs/2.0/core_extensions/excel.html)

**Read benchmark A — 25 MB xlsx, 500K rows by 5 columns (January 2024)**

| Method | Seconds | Type fidelity |
|---|---|---|
| pandas | 32.98 | date became `Timestamp` |
| tablib | 28.53 | date became `datetime` |
| openpyxl | 35.62 | date became `datetime` |
| openpyxl read-only | 24.79 | date became `datetime` |
| LibreOffice → CSV | 15.28 | everything a string |
| DuckDB `sql` (spatial `st_read`) | 11.36 | all types correct |
| DuckDB `execute` | 5.73 | everything a string |
| python-calamine | 3.58 | integer returned as float |

— [Haki Benita, Fastest Way to Read Excel in Python](https://hakibenita.com/fast-excel-python) (pandas here used its then-default openpyxl engine; DuckDB used the older spatial extension, not the current `read_xlsx`)

**Read benchmark B — 186 MB xlsx, 1M rows by 41 columns (28,056,975 non-empty cells)**
- calamine 0.22.1: 25.278 s (1,122,279 cells/s); excelize v2.8.0: 44.254 s; ClosedXML 0.102.1: 178.343 s; openpyxl 3.0.10: 238.554 s (117,612 cells/s). calamine reported as 9.43x faster than openpyxl. No numeric peak-memory figures are given. — [tafia/calamine GitHub](https://github.com/tafia/calamine) (benchmark published by the calamine project itself; old versions)

**Read/write benchmark C — small files (vendor-authored, 2026-10-27)**
- Summed p50 over 19 small feature workbooks, Apple M5 Pro, Python 3.13.9: openpyxl read 22.13 ms (baseline); python-calamine 1.75 ms (12.67x faster); polars 7.24 ms (3.06x); pandas 31.28 ms (0.71x). Write: openpyxl 28.09 ms; xlsxwriter 36.28 ms; xlsxwriter constant-memory 35.29 ms; pandas 32.80 ms. The authors state these mostly reflect per-call overhead, not large-file throughput. — [SynthGL/ExcelBench](https://github.com/SynthGL/ExcelBench)

**openpyxl's own figures**
- Memory "approximately 50 times the original file size" (about 2.5 GB for a 50 MB file). — [openpyxl performance](https://openpyxl.readthedocs.io/en/stable/performance.html)
- Write test, 1,000 rows by 50 columns (openpyxl 3.0.1, xlsxwriter 1.2.5, Python 3.8): xlsxwriter 0.54 s, xlsxwriter optimised 0.50 s, openpyxl 1.10 s, openpyxl optimised (write-only) 0.57 s. — [openpyxl performance](https://openpyxl.readthedocs.io/en/stable/performance.html)

**Other**
- polars documents its calamine engine as "dramatically faster than the other options". — [polars.read_excel](https://docs.pola.rs/api/python/stable/reference/api/polars.read_excel.html)
- A pull-request benchmark on the calamine repository reported calamine about 21.3 s vs openpyxl read-only about 134.4 s (roughly 6x) on Python 3.11; I saw this only as a search-result summary and did not open the PR. — [tafia/calamine PR 367 (mirror)](https://github.meowingcats01.workers.dev/tafia/calamine/pull/367)

### Inferences
- Order-of-magnitude planning numbers for an agent on .xlsx: openpyxl reads roughly 0.1M cells/s and calamine roughly 1M cells/s (benchmark B); a 500K-row sheet takes tens of seconds with openpyxl and a few seconds with calamine (benchmark A). An agent with a tool-call timeout of around two minutes should therefore default to calamine/polars for any sheet beyond roughly 100K rows and reserve openpyxl for files it must edit.
- openpyxl's 50x memory rule means a 50 MB workbook can exhaust a typical 2–4 GB sandbox; read-only mode or calamine is mandatory there, and write-only mode or XlsxWriter constant-memory for large outputs.
- Benchmark A shows speed and type fidelity trade off: the fastest paths returned strings or floats. An agent should verify dtypes after a fast read rather than assume them.
- Data larger than 1,048,576 rows cannot be delivered as a single Excel sheet at all; the agent should deliver CSV/Parquet or split across sheets and say so explicitly.

### Gaps
- No current (2026, library versions listed in section 1) independent large-file benchmark comparing openpyxl read-only, python-calamine, polars and DuckDB `read_xlsx` on the same file was found; no measured peak-memory comparison for these was found at all.
- DuckDB's native `read_xlsx` (which replaced the spatial-extension path used in benchmark A) has no timing in the sources I found.
- Whether python-calamine 0.9.x now offers streaming/iterative row reading (it did not in January 2024) was not verified.
- No CSV-specific benchmark (pandas C engine vs pyarrow engine vs polars vs DuckDB) was collected in this session.

## 7. Which operations lose data when round-tripping an existing workbook

### Takeaway
Any load-modify-save cycle through a library is a lossy re-serialisation, not an in-place edit. openpyxl is the least lossy open-source option but still drops shapes and (unless asked) VBA; pandas, XlsxWriter, polars and DuckDB do not round-trip at all — they write a fresh file containing only values.

### Cited Findings
- openpyxl: "shapes will be lost from existing files"; worksheet copies do not carry images or charts; saving overwrites the target without warning. — [openpyxl tutorial](https://openpyxl.readthedocs.io/en/stable/tutorial.html)
- openpyxl: VBA survives only if loaded with `keep_vba`, and even then is not editable. — [openpyxl tutorial](https://openpyxl.readthedocs.io/en/stable/tutorial.html)
- openpyxl: pivot tables are read so that "they will be preserved in existing files", with no creation or management API. — [openpyxl pivot docs](https://openpyxl.readthedocs.io/en/stable/pivot.html)
- pandas: writing to an existing filename overwrites the whole file in default mode; "it is not possible to write further data without rewriting the whole workbook." — [pandas.DataFrame.to_excel](https://pandas.pydata.org/docs/reference/api/pandas.DataFrame.to_excel.html)
- XlsxWriter "cannot read or modify existing Excel XLSX files." — [XlsxWriter introduction](https://xlsxwriter.readthedocs.io/introduction.html)
- xlrd silently ignores charts, macros, pictures, comments, hyperlinks, pivot tables, conditional formatting and data validation, so anything rebuilt from an xlrd read loses all of these. — [xlrd docs](https://xlrd.readthedocs.io/en/latest/)
- DuckDB export converts numerics to DOUBLE, drops timezones, and writes other types as text. — [DuckDB excel extension](https://duckdb.org/docs/2.0/core_extensions/excel.html)
- Vendor-authored template-mutation test (2026-10-03, 17 features, load an existing template, change it, save): openpyxl preserved 16/17 (dropped custom XML), LibreOffice 15/17, SheetJS 8/17, ExcelJS failed to load the template. — [SynthGL/ExcelBench](https://github.com/SynthGL/ExcelBench)
- Vendor-authored fidelity scores show pandas at 3/18 and polars at 0/18 features on write, i.e. essentially values only. — [SynthGL/ExcelBench](https://github.com/SynthGL/ExcelBench)
- SheetJS silently truncates when writing to formats with smaller row/column limits. — [SheetJS file formats](https://docs.sheetjs.com/docs/miscellany/formats/)

### Inferences
- Loss map for an agent, combining the above:

| Operation | What is lost |
|---|---|
| `pd.read_excel` → `df.to_excel` over the same path | Everything except cell values: formulas become values, all formatting, column widths, merged cells, validation, conditional formatting, charts, pivots, macros, other sheets not rewritten |
| `pd.ExcelWriter(mode="a")` (openpyxl) | Adds/replaces sheets, but the whole workbook still passes through openpyxl, so openpyxl's losses apply |
| openpyxl load → save | Shapes; VBA unless `keep_vba=True`; formula cached values (file needs recalculation); per the vendor test, custom XML parts |
| openpyxl load with `data_only=True` → save | All formulas replaced by their last cached values (unverified in docs this session, widely reported) |
| openpyxl read-only or write-only modes | Cannot edit in place at all; read-only exposes no charts/images |
| Convert .xlsx → .csv | Formulas, types, formatting, all but one sheet; dates and numbers become locale-dependent text |
| LibreOffice round-trip | Re-serialised by a different application; vendor test shows 15/17 features preserved |
| xlwings / Excel via COM, or Microsoft Graph | No structural loss — the real Excel engine performs the edit |

- Safe default policy for an agent editing a user's workbook: never write to the original path; work on a copy; open with openpyxl with `keep_vba=True` for .xlsm; before editing, inventory what the file contains (charts, images/shapes, pivot tables, macros, external links, data validation, conditional formatting) and warn the user if it contains elements the chosen library cannot preserve; after saving, re-open and diff sheet names, dimensions, formula counts and defined names against the original.
- When the user only needs analysis, prefer read-only tools (calamine/polars/DuckDB) so that no round-trip happens at all.
- For high-fidelity edits of complex workbooks (charts, shapes, slicers, pivot caches), the only loss-free routes found are driving real Excel (xlwings on Windows/macOS) or Microsoft Graph for files in OneDrive for Business/SharePoint.

### Gaps
- The openpyxl documentation on charts and images: the tutorial fetched only names shapes as lost; whether existing charts and images now survive a load/save in 3.1.x was not confirmed from primary docs in this session (historically they were dropped, and behaviour has changed across versions). This must be tested empirically on the pinned version.
- No primary documentation was found enumerating what openpyxl does with slicers, sparklines, external links, threaded comments, form controls or Power Query connections.
- The ExcelBench mutation results are from a competitor-authored benchmark and have not been independently reproduced.
- ExcelJS and SheetJS round-trip loss lists from their own documentation were not retrieved.
