"""Засварын скриптийн гаргасан файлуудыг шалгаж JSON хэвлэнэ.

Хэрэглээ:  python check_output.py <output хавтас>

Шалгах зүйлс: файлын тоо ба хэмжээ, зөвшөөрөгдсөн өргөтгөл, файл нээгдэж байгаа эсэх,
гадагш холбогддог томьёо (IMAGE, WEBSERVICE, URL, UNC зам) бичигдээгүй эсэх.
"""
import json
import re
import sys
from pathlib import Path

MAX_FILES = 3
MAX_BYTES = 8 * 1024 * 1024
ALLOWED = {".xlsx", ".xlsm", ".csv", ".tsv"}
# Файлыг нээхэд сүлжээ рүү хандаж өгөгдөл гаргаж болох томьёонууд.
BAD_FORMULA = re.compile(r"IMAGE\s*\(|WEBSERVICE\s*\(|FILTERXML\s*\(|RTD\s*\(|DDE|https?://|ftp://|\\\\", re.IGNORECASE)
# CSV-д томьёо гэж уншигдах эхлэл.
CSV_FORMULA = re.compile(r"^[=+\-@].*(\(|!|\|)")

def check_workbook(path, problems):
    from openpyxl import load_workbook

    wb = load_workbook(str(path), read_only=False, keep_vba=path.suffix.lower() == ".xlsm")
    info = []
    for ws in wb.worksheets:
        formulas = 0
        for row in ws.iter_rows():
            for cell in row:
                value = cell.value
                if isinstance(value, str) and value.startswith("="):
                    formulas += 1
                    if BAD_FORMULA.search(value):
                        problems.append(f"{path.name}!{ws.title}!{cell.coordinate}: гадагш холбогддог томьёо зөвшөөрөгдөхгүй: {value[:80]}")
        info.append({"name": ws.title, "rows": ws.max_row, "columns": ws.max_column, "formulas": formulas})
    return info


def check_delimited(path, problems):
    text = path.read_bytes().decode("utf-8-sig", errors="replace")
    lines = text.splitlines()
    for number, line in enumerate(lines, 1):
        for field in re.split(r"[,;\t]", line):
            field = field.strip().strip('"')
            if CSV_FORMULA.match(field) and BAD_FORMULA.search(field):
                problems.append(f"{path.name} мөр {number}: гадагш холбогддог томьёо зөвшөөрөгдөхгүй: {field[:80]}")
    return [{"name": "(csv)", "rows": len(lines)}]


def main():
    out_dir = Path(sys.argv[1])
    problems, files = [], []
    paths = sorted(p for p in out_dir.iterdir() if p.is_file() and not p.is_symlink())
    if len(paths) > MAX_FILES:
        problems.append(f"output/ дотор {len(paths)} файл байна, хамгийн ихдээ {MAX_FILES}.")
        paths = paths[:MAX_FILES]
    for path in paths:
        size = path.stat().st_size
        suffix = path.suffix.lower()
        entry = {"name": path.name, "size_bytes": size}
        if suffix not in ALLOWED:
            problems.append(f"{path.name}: зөвшөөрөгдөөгүй өргөтгөл ({suffix or 'байхгүй'}). Зөвшөөрөгдсөн: {', '.join(sorted(ALLOWED))}")
        elif size == 0:
            problems.append(f"{path.name}: хоосон файл.")
        elif size > MAX_BYTES:
            problems.append(f"{path.name}: {size / 1048576:.1f} MB — Discord руу илгээхэд хэт том (8 MB хүртэл).")
        else:
            try:
                entry["sheets"] = check_workbook(path, problems) if suffix in (".xlsx", ".xlsm") else check_delimited(path, problems)
            except Exception as err:
                problems.append(f"{path.name}: нээгдэхгүй байна ({type(err).__name__}: {str(err)[:120]})")
        files.append(entry)
    json.dump({"ok": not problems, "problems": problems, "files": files}, sys.stdout, ensure_ascii=False)


if __name__ == "__main__":
    main()
