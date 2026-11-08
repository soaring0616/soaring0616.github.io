#!/usr/bin/env python3
"""
從臺灣福音書房「職事文摘多媒體資源」產生 digest/data/ 下的導覽索引。

  每期索引頁  https://ministrydigest.twgbr.org/8026-{卷2碼}{期2碼}/
  每篇出處頁  https://ministrydigest.twgbr.org/8026-{卷期}/webpg/{n-n-n}.html

抓的是**書目層的資料**（卷期、分類、篇題、頁碼、出處書名篇章、讀經經節、書號），
不存任何信息內文 —— 內文版權屬臺灣福音書房，一律連回原頁與書房產品頁。

書號是從出處頁底部「購書」按鈕的 onclick 取出來的，書房自己標好的：
  <li id="nbtab5" onclick="location.href = 'https://www.twgbr.org.tw/products?query=2418'">購書</li>

用法（只用標準函式庫）：
  python3 scripts/build_digest_index.py                  # 全部 80 期，用快取
  python3 scripts/build_digest_index.py --only 1101 1102 # 只處理指定幾期
  python3 scripts/build_digest_index.py --no-inner       # 只抓索引頁，不進出處頁（沒有書號）
  python3 scripts/build_digest_index.py --refresh        # 忽略快取重抓

輸出（刻意拆成「輕索引 + 一期一檔」，開頁只讀前兩個，點到哪一期才抓那一期）：
  data/index.json       輕索引：卷期 → 分類 → 篇題、頁碼、錨點、書號
  data/books.json       一本書一筆：書號、書名、被哪幾期哪幾篇引用（只存 期+錨點，不重複內容）
  data/issues/{期}.json 該期的細節：每篇的出處書名、篇章、讀經經節
"""
import argparse
import html
import json
import re
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

BASE = 'https://ministrydigest.twgbr.org'
PREFIX = '8026'
PRODUCT = 'https://www.twgbr.org.tw/products?query={}'

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'data'
CACHE = ROOT / '.cache'

# 實測存在的卷期：卷一只有 01、05-08，卷二到卷十各八期，卷十一出到第三期。
# 新的一期出來只要把它加進來（或直接跑 --only）。
ISSUES = (
    ['01{:02d}'.format(i) for i in (1, 5, 6, 7, 8)]
    + ['{:02d}{:02d}'.format(v, i) for v in range(2, 11) for i in range(1, 9)]
    + ['11{:02d}'.format(i) for i in (1, 2, 3)]
)

CN_NUM = '〇一二三四五六七八九十'


def cn(n: int) -> str:
    """阿拉伯數字轉中文（只需要處理 1-99）。"""
    if n < 10:
        return CN_NUM[n]
    if n == 10:
        return '十'
    tens, ones = divmod(n, 10)
    return ('' if tens == 1 else CN_NUM[tens]) + '十' + (CN_NUM[ones] if ones else '')


def fetch(url: str, cache_key: str, refresh: bool = False) -> str:
    """抓一頁，存進 .cache/。快取只是為了重跑時不要再去煩對方的站。"""
    path = CACHE / cache_key
    if path.exists() and not refresh:
        return path.read_text('utf8')
    last = None
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            raw = urllib.request.urlopen(req, timeout=60).read()
            break
        except (urllib.error.URLError, OSError) as exc:  # 連線問題就退讓再試
            last = exc
            time.sleep(1.5 * (attempt + 1))
    else:
        raise RuntimeError('抓不到 {}：{}'.format(url, last))
    text = raw.decode('utf-8-sig' if raw[:3] == b'\xef\xbb\xbf' else 'utf8', 'replace')
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, 'utf8')
    return text


def clean(s: str) -> str:
    return html.unescape(re.sub(r'<[^>]*>', '', s)).replace('　', ' ').strip()


# ---------------------------------------------------------------- 索引頁

PAGE_RE = re.compile(r'<div\s+data-role\s*=\s*"page"\s+id\s*=\s*"([^"]+)"', re.I)
ITEM_RE = re.compile(
    r'<li[^>]*>\s*<a\s+href\s*=\s*"([^"]+)"[^>]*>(.*?)</a>\s*</li>', re.I | re.S)
COUNT_RE = re.compile(r'<span[^>]*class\s*=\s*"ui-li-count"[^>]*>(.*?)</span>', re.I | re.S)


def page_blocks(doc: str) -> dict:
    """把索引頁切成 data-role="page" 的區塊：{id: 區塊 HTML}。"""
    marks = [(m.group(1), m.start()) for m in PAGE_RE.finditer(doc)]
    blocks = {}
    for i, (pid, start) in enumerate(marks):
        end = marks[i + 1][1] if i + 1 < len(marks) else len(doc)
        blocks[pid] = doc[start:end]
    return blocks


def block_items(block: str) -> list:
    """區塊裡的清單項目，保持頁面上的順序。"""
    items = []
    for m in ITEM_RE.finditer(block):
        href, inner = m.group(1), m.group(2)
        cm = COUNT_RE.search(inner)
        page = clean(cm.group(1)) if cm else ''
        title = clean(COUNT_RE.sub('', inner))
        if not title:
            continue
        items.append({'href': href.strip(), 'title': title,
                      'page': int(page) if page.isdigit() else None})
    return items


def walk(blocks: dict, pid: str, seen: set) -> list:
    """沿著 #錨點 往下走，webpg 連結就是葉子。唱詩人那段有兩層，這樣遞迴剛好。"""
    out = []
    for it in block_items(blocks.get(pid, '')):
        href = it['href']
        if href.startswith('#'):
            child = href[1:]
            # 「返回／主選單」那種往上指的按鈕不是清單項目，但防一下循環
            if child in seen or child not in blocks:
                continue
            seen.add(child)
            node = {'title': it['title'], 'page': it['page'], 'anchor': child}
            node['children'] = walk(blocks, child, seen)
            out.append(node)
        elif 'webpg/' in href:
            rel = 'webpg/' + href.split('webpg/')[-1]
            out.append({'title': it['title'], 'page': it['page'], 'webpg': rel,
                        'audio': 'audio' in rel.lower()})
    return out


def parse_issue(code: str, doc: str) -> dict:
    blocks = page_blocks(doc)
    vol, num = int(code[:2]), int(code[2:])
    label = '第{}卷　第{}期'.format(cn(vol), cn(num))
    m = re.search(r'data-role\s*=\s*"list-divider"[^>]*>(.*?)</li>', doc, re.I | re.S)
    if m and clean(m.group(1)):
        label = clean(m.group(1))
    seen = {'home'}
    sections = []
    for sec in walk(blocks, 'home', seen):
        sec['articles'] = sec.pop('children')
        sections.append(sec)
    return {'code': '{}-{}'.format(PREFIX, code), 'id': code, 'vol': vol, 'issue': num,
            'label': label, 'url': '{}/{}-{}/'.format(BASE, PREFIX, code),
            'sections': sections}


# ---------------------------------------------------------------- 出處頁

BOOK_RE = re.compile(r"products\?query=([0-9A-Za-z\-]+)")
TITLE_RE = re.compile(r'<title>(.*?)</title>', re.I | re.S)
H4_RE = re.compile(r'<h4[^>]*>(.*?)</h4>', re.I | re.S)


def parse_inner(doc: str) -> dict:
    """出處頁裡我們要的三樣：書名、篇章、讀經經節，加上書號。不取內文。"""
    out = {}
    m = TITLE_RE.search(doc)
    if m and clean(m.group(1)):
        out['book_title'] = clean(m.group(1))
    m = H4_RE.search(doc)
    if m and clean(m.group(1)):
        out['chapter'] = clean(m.group(1))
    m = BOOK_RE.search(doc)
    if m:
        out['book_no'] = m.group(1)
    # 讀經那一行：<div class="O0">讀經：</div> 後面緊跟的那個 <p>
    m = re.search(r'讀經\s*[：:]\s*(?:</div>)?\s*(?:<p[^>]*>(.*?)</p>)', doc, re.I | re.S)
    if m:
        out['reading'] = clean(m.group(1))
    elif '讀經' in doc:
        m = re.search(r'讀經\s*[：:]\s*([^<]{4,200})', doc)
        if m:
            out['reading'] = clean(m.group(1))
    return out


def leaves(sections: list):
    """走過一期裡所有 webpg 葉子（抓取用）。"""
    def rec(nodes):
        for n in nodes:
            if 'webpg' in n:
                yield n
            for key in ('children', 'articles'):
                if n.get(key):
                    yield from rec(n[key])
    for sec in sections:
        yield from rec(sec.get('articles', []))


def anchor_of(node: dict) -> str:
    """錨點。直接連音檔的「新詩分享」沒有錨點，就用檔名；規則要和 js/app.js 一致。"""
    return node.get('anchor') or re.sub(r'[^A-Za-z0-9_.-]', '_', node.get('webpg', ''))


def flatten(sections: list) -> list:
    """把巢狀結構攤成「一篇一筆」，規則與前端 js/app.js 的 collect() 相同：
    一個節點底下直接掛著出處頁就算一篇；唱詩人的「每週一詩」多一層，要遞迴；
    「新詩分享」直接連音檔、沒有子節點，自己算一篇。"""
    out = []

    def rec(section, nodes):
        for n in nodes:
            kids = n.get('children') or n.get('articles') or []
            leaf = [k for k in kids if k.get('webpg')]
            if n.get('webpg') and not kids:
                out.append((section, n, [n]))
            elif leaf:
                out.append((section, n, leaf))
                groups = [k for k in kids if not k.get('webpg')]
                if groups:
                    rec(section, groups)
            elif kids:
                rec(section, kids)

    for sec in sections:
        rec(sec['title'], sec.get('articles', []))
    return out


def exists(code: str) -> bool:
    url = '{}/{}-{}/'.format(BASE, PREFIX, code)
    try:
        req = urllib.request.Request(url, method='HEAD', headers={'User-Agent': 'Mozilla/5.0'})
        return urllib.request.urlopen(req, timeout=30).status == 200
    except Exception:
        return False


def discover() -> list:
    """從索引裡最新的一期往前探，回傳新出的期數。沒有新的就回空的。

    一卷八期，第八期之後跳下一卷第一期。遇到不存在的就停 ——
    所以中間有缺號的情況（卷一缺 02-04）要用 --only 補。
    """
    path = DATA / 'index.json'
    if not path.exists():
        return list(ISSUES)
    rows = json.loads(path.read_text('utf8'))
    if not rows:
        return list(ISSUES)
    vol, num = max((r['vol'], r['issue']) for r in rows)
    found = []
    for _ in range(10):
        num += 1
        if num > 8:
            vol, num = vol + 1, 1
        code = '{:02d}{:02d}'.format(vol, num)
        if not exists(code):
            break
        found.append(code)
    return found


# ---------------------------------------------------------------- 主流程

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', nargs='*', help='只處理這幾期（例如 1101 1102）')
    ap.add_argument('--no-inner', action='store_true', help='不進出處頁，不取書號')
    ap.add_argument('--discover', action='store_true',
                    help='只抓比索引裡最新一期更新的期數（給定時任務用）')
    ap.add_argument('--refresh', action='store_true', help='忽略快取重抓')
    ap.add_argument('--workers', type=int, default=6, help='同時連線數（預設 6）')
    args = ap.parse_args()

    if args.discover:
        codes = discover()
        if not codes:
            print('沒有新的一期，索引不動。', file=sys.stderr)
            return 0
        print('發現新的一期：{}'.format('、'.join(codes)), file=sys.stderr)
    else:
        codes = args.only if args.only else ISSUES
    issues = []
    for code in codes:
        url = '{}/{}-{}/'.format(BASE, PREFIX, code)
        try:
            doc = fetch(url, '{}/index.html'.format(code), args.refresh)
        except RuntimeError as exc:
            print('! {}'.format(exc), file=sys.stderr)
            continue
        issue = parse_issue(code, doc)
        issues.append(issue)
        print('{} {} 分類{} 篇{} 出處{}'.format(
            issue['code'], issue['label'], len(issue['sections']),
            sum(len(s['articles']) for s in issue['sections']),
            sum(1 for _ in leaves(issue['sections']))), file=sys.stderr)

    if not args.no_inner:
        jobs = [(iss, leaf) for iss in issues for leaf in leaves(iss['sections'])
                if not leaf['audio']]
        print('== 出處頁 {} 頁 =='.format(len(jobs)), file=sys.stderr)

        def pull(job):
            iss, leaf = job
            url = '{}{}'.format(iss['url'], leaf['webpg'])
            try:
                return leaf, parse_inner(fetch(
                    url, '{}/{}'.format(iss['id'], leaf['webpg'].replace('/', '_')),
                    args.refresh))
            except RuntimeError as exc:
                print('! {}'.format(exc), file=sys.stderr)
                return leaf, {}

        done = 0
        with ThreadPoolExecutor(max_workers=args.workers) as pool:
            for leaf, info in pool.map(pull, jobs):
                leaf.update(info)
                done += 1
                if done % 200 == 0:
                    print('  {}/{}'.format(done, len(jobs)), file=sys.stderr)

    DATA.mkdir(parents=True, exist_ok=True)
    (DATA / 'issues').mkdir(exist_ok=True)

    def dump(path: Path, obj):
        # indent=1：檔案大一點但 git diff 看得懂；上線走 gzip，實際傳輸小很多
        path.write_text(json.dumps(obj, ensure_ascii=False, indent=1), 'utf8')

    # 一期一檔的細節（出處書名、篇章、讀經經節）
    for iss in issues:
        detail = {'id': iss['id'], 'label': iss['label'], 'url': iss['url'], 'sections': []}
        rows = flatten(iss['sections'])
        for sec in iss['sections']:
            arts = []
            for section, node, leaf in rows:
                if section != sec['title']:
                    continue
                reading = next((l['reading'] for l in leaf if l.get('reading')), '')
                arts.append({
                    'title': node['title'], 'page': node.get('page'),
                    'anchor': anchor_of(node), 'reading': reading,
                    'sources': [{
                        'label': l['title'], 'book': l.get('book_title', ''),
                        'chapter': l.get('chapter', ''), 'no': l.get('book_no', ''),
                        'audio': bool(l.get('audio')), 'webpg': l['webpg'],
                    } for l in leaf],
                })
            detail['sections'].append({'title': sec['title'], 'articles': arts})
        dump(DATA / 'issues' / '{}.json'.format(iss['id']), detail)

    # 輕索引：只有篇題、頁碼、錨點與書號。--only 時併回原有的，不要蓋掉其他期
    index_path = DATA / 'index.json'
    existing = {}
    if index_path.exists():
        for row in json.loads(index_path.read_text('utf8')):
            existing[row['id']] = row
    for iss in issues:
        rows = flatten(iss['sections'])
        existing[iss['id']] = {
            'id': iss['id'], 'vol': iss['vol'], 'issue': iss['issue'],
            'label': iss['label'], 'url': iss['url'],
            'sections': [{
                'title': sec['title'],
                'articles': [{
                    'title': node['title'], 'page': node.get('page'),
                    'anchor': anchor_of(node),
                    'books': sorted({l['book_no'] for l in leaf if l.get('book_no')}),
                } for section, node, leaf in rows if section == sec['title']],
            } for sec in iss['sections']],
        }
    index = sorted(existing.values(), key=lambda r: (r['vol'], r['issue']))
    dump(index_path, index)

    # 以書為主角的反查表。引用會跨期，所以從 data/issues/ 全部重建；
    # 只存「期 + 錨點」，篇題由前端從輕索引接回來，不重複內容。
    titles, refs = {}, {}
    for f in sorted((DATA / 'issues').glob('*.json')):
        detail = json.loads(f.read_text('utf8'))
        for sec in detail['sections']:
            for art in sec['articles']:
                for src in art['sources']:
                    if not src['no']:
                        continue
                    if src['book'] and src['no'] not in titles:
                        titles[src['no']] = src['book']
                    refs.setdefault(src['no'], []).append(
                        {'issue': detail['id'], 'anchor': art['anchor']})
    books = [{
        'no': no,
        'title': titles.get(no, ''),
        'product': PRODUCT.format(no),
        'refs': sorted({(r['issue'], r['anchor']) for r in rs}),
    } for no, rs in refs.items()]
    for b in books:
        b['refs'] = [{'issue': i, 'anchor': a} for i, a in b['refs']]
    books.sort(key=lambda b: (-len(b['refs']), b['no']))
    dump(DATA / 'books.json', books)

    old = DATA / 'issues.json'
    if old.exists():
        old.unlink()   # 舊的單一大檔，已拆成 issues/ 一期一檔

    print('== 期 {} / 書 {} / 引用 {} =='.format(
        len(index), len(books), sum(len(b['refs']) for b in books)), file=sys.stderr)
    return 0


if __name__ == '__main__':
    sys.exit(main())
