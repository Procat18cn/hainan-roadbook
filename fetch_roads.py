# -*- coding: utf-8 -*-
"""从 OSM Overpass 抽取海南岛骨干路网(高速/国道/省道主干)，简化后输出 data/hainan-roads.json
仅供构建期使用；成品 HTML 已内嵌结果，运行时不需要本脚本。"""
import json, os, sys, math, urllib.request, urllib.parse

ROOT = os.path.dirname(os.path.abspath(__file__))
BBOX = "(18.05,108.50,20.20,111.15)"
QUERY = f"""[out:json][timeout:180];
(
  way["highway"~"^(motorway|trunk)$"]{BBOX};
  way["highway"="primary"]{BBOX};
);
(._;>;);
out body qt;"""

ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.osm.jp/api/interpreter",
]

def fetch():
    last = None
    for ep in ENDPOINTS:
        try:
            print("trying", ep, flush=True)
            data = urllib.parse.urlencode({"data": QUERY}).encode()
            req = urllib.request.Request(ep, data=data,
                headers={"User-Agent": "hainan-roadbook-builder/1.0 (trip planning, one-shot extract)"})
            with urllib.request.urlopen(req, timeout=240) as r:
                raw = r.read()
            print("received bytes:", len(raw), flush=True)
            return json.loads(raw)
        except Exception as e:
            print("fail:", ep, repr(e), flush=True)
            last = e
    raise last

def dp_simplify(pts, tol):
    """Douglas-Peucker，pts=[(lon,lat),...]"""
    if len(pts) < 3:
        return pts
    def seg_dist(p, a, b):
        ax, ay = a; bx, by = b; px, py = p
        dx, dy = bx - ax, by - ay
        if dx == 0 and dy == 0:
            return math.hypot(px - ax, py - ay)
        t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)
        t = max(0.0, min(1.0, t))
        return math.hypot(px - (ax + t * dx), py - (ay + t * dy))
    # 迭代式标记
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        i, j = stack.pop()
        if j <= i + 1:
            continue
        dmax, idx = -1.0, -1
        for k in range(i + 1, j):
            d = seg_dist(pts[k], pts[i], pts[j])
            if d > dmax:
                dmax, idx = d, k
        if dmax > tol:
            keep[idx] = True
            stack.append((i, idx)); stack.append((idx, j))
    return [p for p, k in zip(pts, keep) if k]

def classify(tags):
    hw = tags.get("highway", "")
    ref = (tags.get("ref") or "").strip()
    if hw in ("motorway", "trunk"):
        return "e"   # 高速/快速
    if ref.upper().startswith("G"):
        return "n"   # 国道
    return "p"       # 省道及其他主干

def main():
    data = fetch()
    nodes = {}
    ways = []
    for el in data.get("elements", []):
        if el["type"] == "node":
            nodes[el["id"]] = (el["lon"], el["lat"])
        elif el["type"] == "way":
            ways.append(el)
    print("nodes:", len(nodes), "ways:", len(ways), flush=True)
    out = {"e": [], "n": [], "p": []}
    tol = {"e": 0.0035, "n": 0.004, "p": 0.0045}
    for w in ways:
        tags = w.get("tags", {})
        cls = classify(tags)
        pts = [nodes[nid] for nid in w.get("nodes", []) if nid in nodes]
        if len(pts) < 2:
            continue
        pts = dp_simplify(pts, tol[cls])
        # 量化到3位小数并去重相邻点
        line, last = [], None
        for x, y in pts:
            q = (round(x, 3), round(y, 3))
            if q != last:
                line.append(q); last = q
        if len(line) >= 2:
            out[cls].append(line)
    for k in out:
        print(k, len(out[k]), "lines", sum(len(l) for l in out[k]), "pts", flush=True)
    with open(os.path.join(ROOT, "data", "hainan-roads.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print("written data/hainan-roads.json", flush=True)

if __name__ == "__main__":
    main()
