#!/usr/bin/env python3
"""
從蒙特利公園市召會的詩歌目錄頁產生 public/data/hymn_index.json。

  大本   https://churchinmontereypark.org/Docs/Hymn/firstBookHymnIndex.html
  補充本 https://churchinmontereypark.org/Docs/Hymn/secondBookHymnIndex.html

大本目錄是「大類 → 細目 → 號碼」（例如 讚美主／祂的受苦：80–89），
補充本目錄是「大類 → 號碼 + 標題」。這就是詩歌本前面的目錄，
hymnal.net 每首詩頁面上的 Category / Subcategory 也是同一套。

用法（只用標準函式庫，不需要安裝任何套件）：
  python3 scripts/build_hymn_index.py            # 從網路抓
  python3 scripts/build_hymn_index.py first.html second.html   # 用已下載的檔案

輸出一行一首，方便 diff：
  {"book": "hymnal", "no": 80, "section": "讚美主", "sub": "祂的受苦"}
  {"book": "supplement", "no": 1, "section": "讚美的話", "title": "開口讚美"}
"""
import html
import json
import re
import sys
import urllib.request
from pathlib import Path

FIRST = 'https://churchinmontereypark.org/Docs/Hymn/firstBookHymnIndex.html'
SECOND = 'https://churchinmontereypark.org/Docs/Hymn/secondBookHymnIndex.html'
OUT = Path(__file__).resolve().parent.parent / 'public' / 'data' / 'hymn_index.json'


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    return urllib.request.urlopen(req, timeout=60).read().decode('utf8')


def to_lines(body: str) -> list[str]:
    body = html.unescape(body)
    body = re.sub(r'<br\s*/?>', '\n', body)
    body = re.sub(r'<[^>]+>', '', body)
    return [re.sub(r'\s+', ' ', l).strip() for l in body.split('\n') if l.strip()]


def parse_first(page: str) -> list[dict]:
    """大本：每個 <a name="N"> 是一個大類；每行是「細目 [號碼] [號碼]…」，細目可省略（沿用上一個）。"""
    body = page[page.find('<a name="1"></a>'):]
    body = html.unescape(body)
    # 把 hymnal.net 連結換成 [號碼]，順便確認連結號碼與顯示號碼一致
    def link(m: re.Match) -> str:
        assert m.group(1) == m.group(2), f'連結 {m.group(1)} 與顯示 {m.group(2)} 不一致'
        return f' [{m.group(2)}] '
    body = re.sub(r'<a href="[^"]*hymnal\.net[^"]*/ch/(\d+)"[^>]*>\s*(\d+)\s*(?:<br>\s*)?</a>', link, body)
    body = re.sub(r'<a name="(\d+)"></a>', r'\n@@ ', body)
    lines = to_lines(body)

    out: list[dict] = []
    section = sub = None
    for line in lines:
        if line.startswith('@@'):
            section = line[2:].strip()
            sub = None
            continue
        if section is None or section == '附':
            continue  # 「附」是附錄，不是正式號碼
        # 逐一掃 token：文字 = 新的細目；[n] 或純數字 = 詩歌號碼
        for tok in re.findall(r'\[\d+\]|\d+|[^\[\]\d]+', line):
            tok = tok.strip()
            if not tok:
                continue
            if re.fullmatch(r'\[\d+\]|\d+', tok):
                no = int(tok.strip('[]'))
                out.append({'book': 'hymnal', 'no': no, 'section': section, 'sub': sub})
            else:
                sub = tok
    return out


def parse_second(page: str) -> list[dict]:
    """補充本：每個 <a name="N"> 是一個大類；每行是「0001 標題」。"""
    body = page[page.find('<a name="1">'):]
    body = re.sub(r'<a name="\d+">\s*(?:<br>)?\s*</a>', '\n@@ ', body)
    lines = to_lines(body)
    out: list[dict] = []
    section = None
    for line in lines:
        if line.startswith('@@'):
            section = line[2:].strip()
            continue
        m = re.fullmatch(r'(\d{4})\s+(.+)', line)
        if m and section:
            out.append({'book': 'supplement', 'no': int(m.group(1)), 'section': section, 'title': m.group(2).strip()})
    return out


def main() -> None:
    if len(sys.argv) == 3:
        first, second = Path(sys.argv[1]).read_text('utf8'), Path(sys.argv[2]).read_text('utf8')
    else:
        first, second = fetch(FIRST), fetch(SECOND)
    entries = parse_first(first) + parse_second(second)

    seen: set[tuple[str, int]] = set()
    for e in entries:
        key = (e['book'], e['no'])
        assert key not in seen, f'重複：{key}'
        seen.add(key)
    hymnal = sorted(e['no'] for e in entries if e['book'] == 'hymnal')
    missing = sorted(set(range(1, hymnal[-1] + 1)) - set(hymnal))
    print(f'大本 {len(hymnal)} 首（1–{hymnal[-1]}），缺：{missing or "無"}')
    supp = [e['no'] for e in entries if e['book'] == 'supplement']
    print(f'補充本 {len(supp)} 首（{min(supp)}–{max(supp)}）')

    entries.sort(key=lambda e: (e['book'] != 'hymnal', e['no']))
    with OUT.open('w', encoding='utf8') as f:
        f.write('[\n')
        f.write(',\n'.join(json.dumps(e, ensure_ascii=False) for e in entries))
        f.write('\n]\n')
    print(f'寫入 {OUT}')


if __name__ == '__main__':
    main()
