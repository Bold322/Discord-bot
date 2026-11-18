"""Spreadsheet файлын товч тоймыг JSON-оор хэвлэнэ (.xlsx/.xlsm/.xlsb/.xls/.csv/.tsv).

Хэрэглээ:  python profile_spreadsheet.py <файлын зам> [анхны нэр] [input хавтас]

input хавтас өгвөл файлыг засварын скриптэд зориулж тэнд байрлуулна:
.xlsx/.xlsm/.csv-г хуулна, .xls/.xlsb-г зөвхөн утгатай .xlsx болгож хөрвүүлнэ.

Файлыг зөвхөн уншина: томьёо тооцохгүй, макро ажиллуулахгүй, юу ч бичихгүй.
Форматыг өргөтгөлөөр биш, файлын эхний байтуудаар тодорхойлно.
"""
import csv
import io
import json
import re
import shutil
import sys
from pathlib import Path

MAX_SHEETS = 8
MAX_COLS = 30
SAMPLE_ROWS = 6
MAX_CELL_CHARS = 60


def clip(value):
    if value is None:
        return ""
    text = str(value).strip().replace("\n", " ")
    return text if len(text) <= MAX_CELL_CHARS else text[: MAX_CELL_CHARS - 1] + "…"


def summarize_rows(rows):
    """rows: мөрүүдийн жагсаалт. Хоосон мөрийг алгасаж хэмжээ ба эхний мөрүүдийг буцаана."""
    non_empty = [(i, r) for i, r in enumerate(rows, 1) if any(str(c).strip() for c in r if c is not None)]
    width = max((len(r) for _, r in non_empty), default=0)
    return {
        "total_rows": len(rows),
        "non_empty_rows": len(non_empty),
        "columns": width,
        "columns_truncated": width > MAX_COLS,
        # row = файл дахь 1-ээс эхэлсэн мөрийн дугаар
        "first_rows": [{"row": i, "cells": [clip(c) for c in r[:MAX_COLS]]} for i, r in non_empty[:SAMPLE_ROWS]],
    }


def profile_workbook(path):
    from python_calamine import CalamineWorkbook

    wb = CalamineWorkbook.from_path(str(path))
    meta = {m.name: m for m in wb.sheets_metadata}
    sheets = []
    for name in wb.sheet_names[:MAX_SHEETS]:
        info = {"name": name}
        m = meta.get(name)
        if m is not None:
            info["type"] = str(m.typ).split(".")[-1]
            visible = str(m.visible).split(".")[-1]
            if visible != "Visible":
                info["hidden"] = True
        try:
            info.update(summarize_rows(wb.get_sheet_by_name(name).to_python()))
        except Exception as err:  # диаграмм sheet гэх мэт
            info["unreadable"] = str(err)[:120]
        sheets.append(info)
    return {"sheet_count": len(wb.sheet_names), "sheets": sheets}


def profile_delimited(raw):
    from charset_normalizer import from_bytes

    if raw.startswith(b"\xef\xbb\xbf"):
        encoding = "utf-8-sig"
    else:
        try:
            raw.decode("utf-8")
            encoding = "utf-8"
        except UnicodeDecodeError:
            best = from_bytes(raw).best()
            encoding = best.encoding if best else "cp1251"
    text = raw.decode(encoding, errors="replace")
    try:
        delimiter = csv.Sniffer().sniff(text[:20000], delimiters=",;\t|").delimiter
    except csv.Error:
        delimiter = ","
    rows = list(csv.reader(io.StringIO(text), delimiter=delimiter))
    return {"encoding": encoding, "delimiter": delimiter, "sheets": [{"name": "(csv)", **summarize_rows(rows)}]}


def safe_stem(name, fallback):
    stem = re.sub(r"[^\w \-]", "_", Path(name).stem, flags=re.UNICODE).strip(" .")[:60]
    return stem or fallback


def convert_to_xlsx(src, dest):
    """.xls/.xlsb → зөвхөн утгатай .xlsx (хэв маяг, томьёо хадгалагдахгүй)."""
    from openpyxl import Workbook
    from python_calamine import CalamineWorkbook

    src_wb = CalamineWorkbook.from_path(str(src))
    out = Workbook(write_only=True)
    for sheet_name in src_wb.sheet_names:
        ws = out.create_sheet(title=sheet_name[:31])
        try:
            for row in src_wb.get_sheet_by_name(sheet_name).to_python():
                ws.append([None if c == "" else c for c in row])
        except Exception:
            pass
    out.save(str(dest))


def place_input(path, name, kind, input_dir):
    """Файлыг input хавтаст аюулгүй нэрээр байрлуулж (нэр, хөрвүүлсэн эсэх)-ийг буцаана."""
    stem = safe_stem(name, path.name)
    if kind in ("xls", "xlsb"):
        target, converted = f"{stem}.xlsx", True
    else:
        target, converted = f"{stem}.{kind}", False
    dest = Path(input_dir) / target
    if dest.exists():
        dest = Path(input_dir) / f"{path.name}-{target}"
    if converted:
        convert_to_xlsx(path, dest)
    else:
        shutil.copyfile(path, dest)
    return dest.name, converted


def main():
    path = Path(sys.argv[1])
    name = sys.argv[2] if len(sys.argv) > 2 else path.name
    input_dir = sys.argv[3] if len(sys.argv) > 3 else None
    ext = Path(name).suffix.lower().lstrip(".")
    raw_head = path.open("rb").read(8)
    result = {"file_name": name, "size_bytes": path.stat().st_size}

    if raw_head.startswith(b"PK"):
        kind = ext if ext in ("xlsm", "xlsb") else "xlsx"
        result["format"] = "xlsx-family (zip)"
        result.update(profile_workbook(path))
    elif raw_head.startswith(b"\xd0\xcf\x11\xe0"):
        kind = "xls"
        result["format"] = "xls (legacy binary)"
        result.update(profile_workbook(path))
    else:
        kind = "tsv" if ext == "tsv" else "csv"
        result["format"] = "delimited text"
        result.update(profile_delimited(path.read_bytes()))

    if input_dir:
        input_name, converted = place_input(path, name, kind, input_dir)
        result["input_path"] = f"input/{input_name}"
        if converted:
            result["note"] = f"Original was .{kind}; input copy is a values-only .xlsx (formatting and formulas were not preserved)."

    json.dump(result, sys.stdout, ensure_ascii=False)


if __name__ == "__main__":
    main()
