# -*- coding: utf-8 -*-
"""把 src/ 源码与 data/ 数据打包成单文件 HTML。
用法: python build.py
"""
import json, os

ROOT = os.path.dirname(os.path.abspath(__file__))

def rd(*p):
    with open(os.path.join(ROOT, *p), encoding="utf-8") as f:
        return f.read()

def main():
    tpl = rd("src", "template.html")
    lcss = rd("src", "leaflet.css")
    ljs = rd("src", "leaflet.js")
    app_css = rd("src", "style.css")
    app_files = ["util.js", "store.js", "mapview.js", "panel.js", "poster.js", "main.js"]
    app_js = "\n\n".join(rd("src", f) for f in app_files)

    geo = json.loads(rd("data", "hainan-counties.json"))
    roads = json.loads(rd("data", "hainan-roads.json"))
    data_js = (
        "window.HAINAN_GEO = " + json.dumps(geo, ensure_ascii=False, separators=(",", ":")) + ";\n"
        + "window.HAINAN_ROADS = " + json.dumps(roads, ensure_ascii=False, separators=(",", ":")) + ";"
    )

    if "</script" in app_js or "</script" in data_js:
        raise SystemExit("app/data JS 中包含 </script>，会导致 HTML 提前闭合，请检查")

    out = (tpl
           .replace("{{LEAFLET_CSS}}", lcss)
           .replace("{{APP_CSS}}", app_css)
           .replace("{{LEAFLET_JS}}", ljs)
           .replace("{{DATA_JS}}", data_js)
           .replace("{{APP_JS}}", app_js))

    dst = os.path.join(ROOT, "海南自驾规划.html")
    with open(dst, "w", encoding="utf-8") as f:
        f.write(out)
    print("written:", dst, f"{os.path.getsize(dst)/1024:.0f} KB")

if __name__ == "__main__":
    main()
