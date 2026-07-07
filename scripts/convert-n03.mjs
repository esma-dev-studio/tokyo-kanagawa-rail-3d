/**
 * 国土数値情報 行政区域データ(N03)GeoJSON → 県境・海岸線データ(JSON)変換。
 *
 * 使い方:
 *   node scripts/convert-n03.mjs <N03のgeojsonを含むフォルダ(複数都県分)>
 *   (フォルダ以下を再帰検索して *.geojson をすべて読み込む)
 *
 * 抽出ロジック:
 *   市区町村ポリゴンの全辺を「両端点を丸めた無向キー」で集計すると、
 *   - 異なる都道府県の2ポリゴンが共有する辺 → 県境
 *   - どのポリゴンとも共有されない辺(出現1回) → 海岸線(湖岸含む)
 *   - 同一都道府県内で共有される辺(出現2回) → 市区町村界(捨てる)
 *   になる。対象bboxに接する都県をすべて入力すれば、bbox内の
 *   「出現1回の辺」は水際だけになる。
 *
 * 出力: src/data/generated/boundaries.json
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BBOX } from "./n02.config.mjs";

const srcDir = process.argv[2];
if (!srcDir) {
  console.error("usage: node scripts/convert-n03.mjs <dir-with-N03-geojson>");
  process.exit(1);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const KM_PER_DEG_LAT = 110.95;
const KM_PER_DEG_LON = 111.32 * Math.cos((35.55 * Math.PI) / 180);
const KEY_DECIMALS = 6; // 端点一致判定の丸め(約0.1m)
const COAST_TOLERANCE_KM = 0.03; // 海岸線の簡略化(約30m)
const BORDER_TOLERANCE_KM = 0.05; // 県境の簡略化(約50m)

// ---- geojson 収集 ----
function listGeojson(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...listGeojson(p));
    else if (name.endsWith(".geojson")) out.push(p);
  }
  return out;
}
const files = listGeojson(srcDir);
if (files.length === 0) throw new Error("no geojson found");
console.log(`input files: ${files.length}`);

// ---- 辺の集計 ----
// bboxを少し広げた範囲で前処理フィルタ(境界ちょうどの辺の分類が壊れないように)
const PAD = 0.05;
const inWideBbox = ([lon, lat]) =>
  lat >= BBOX.minLat - PAD && lat <= BBOX.maxLat + PAD &&
  lon >= BBOX.minLon - PAD && lon <= BBOX.maxLon + PAD;

const keyOf = ([lon, lat]) => `${lon.toFixed(KEY_DECIMALS)},${lat.toFixed(KEY_DECIMALS)}`;

/** 無向辺キー → { a, b, count, prefs:Set } */
const edges = new Map();

function addRing(ring, pref) {
  for (let i = 0; i < ring.length - 1; i++) {
    const a = ring[i];
    const b = ring[i + 1];
    if (!inWideBbox(a) && !inWideBbox(b)) continue;
    const ka = keyOf(a);
    const kb = keyOf(b);
    if (ka === kb) continue;
    const key = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
    let e = edges.get(key);
    if (!e) {
      e = { a, b, count: 0, prefs: new Set() };
      edges.set(key, e);
    }
    e.count++;
    e.prefs.add(pref);
  }
}

for (const file of files) {
  const geo = JSON.parse(readFileSync(file, "utf8"));
  for (const f of geo.features) {
    const pref = f.properties.N03_001;
    const g = f.geometry;
    if (!g) continue;
    const polys = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
    for (const poly of polys) {
      for (const ring of poly) addRing(ring, pref);
    }
  }
  console.log(`read: ${file.split(/[\\/]/).pop()} (edges so far: ${edges.size})`);
}

// ---- 分類 ----
const borderSegs = [];
const coastSegs = [];
for (const e of edges.values()) {
  if (e.prefs.size >= 2) borderSegs.push([e.a, e.b]); // 県境
  else if (e.count === 1) coastSegs.push([e.a, e.b]); // 海岸線・湖岸
}
console.log(`classified: border=${borderSegs.length} coast=${coastSegs.length}`);

// ---- 連結 → クリップ → 簡略化(convert-n02 と同等のロジック) ----
const toKm = ([lon, lat]) => [lon * KM_PER_DEG_LON, lat * KM_PER_DEG_LAT];

function stitch(segments) {
  const key = keyOf;
  const adj = new Map();
  segments.forEach((seg, i) => {
    for (const end of [0, 1]) {
      const k = key(end === 0 ? seg[0] : seg[seg.length - 1]);
      if (!adj.has(k)) adj.set(k, []);
      adj.get(k).push({ i, end });
    }
  });
  const used = new Set();
  const parts = [];
  const takeNext = (k) => (adj.get(k) ?? []).find((c) => !used.has(c.i)) ?? null;
  for (let s = 0; s < segments.length; s++) {
    if (used.has(s)) continue;
    used.add(s);
    let path = [...segments[s]];
    for (;;) {
      const c = takeNext(key(path[path.length - 1]));
      if (!c) break;
      used.add(c.i);
      const seg = segments[c.i];
      const pts = c.end === 0 ? seg : [...seg].reverse();
      path = path.concat(pts.slice(1));
    }
    for (;;) {
      const c = takeNext(key(path[0]));
      if (!c) break;
      used.add(c.i);
      const seg = segments[c.i];
      const pts = c.end === 1 ? seg : [...seg].reverse();
      path = pts.slice(0, -1).concat(path);
    }
    parts.push(path);
  }
  return parts;
}

function clipSeg(a, b) {
  let t0 = 0;
  let t1 = 1;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const checks = [
    [-dx, a[0] - BBOX.minLon],
    [dx, BBOX.maxLon - a[0]],
    [-dy, a[1] - BBOX.minLat],
    [dy, BBOX.maxLat - a[1]],
  ];
  for (const [p, q] of checks) {
    if (p === 0) {
      if (q < 0) return null;
    } else {
      const r = q / p;
      if (p < 0) {
        if (r > t1) return null;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return null;
        if (r < t1) t1 = r;
      }
    }
  }
  return [
    [a[0] + t0 * dx, a[1] + t0 * dy],
    [a[0] + t1 * dx, a[1] + t1 * dy],
  ];
}

function clipLine(coords) {
  const runs = [];
  let cur = [];
  for (let i = 0; i < coords.length - 1; i++) {
    const clipped = clipSeg(coords[i], coords[i + 1]);
    if (!clipped) {
      if (cur.length >= 2) runs.push(cur);
      cur = [];
      continue;
    }
    const [p0, p1] = clipped;
    if (cur.length === 0) cur.push(p0);
    cur.push(p1);
    if (p1[0] !== coords[i + 1][0] || p1[1] !== coords[i + 1][1]) {
      if (cur.length >= 2) runs.push(cur);
      cur = [];
    }
  }
  if (cur.length >= 2) runs.push(cur);
  return runs;
}

function simplify(coords, tolKm) {
  if (coords.length <= 2) return coords;
  const pts = coords.map(toKm);
  const keep = new Array(coords.length).fill(false);
  keep[0] = keep[coords.length - 1] = true;
  const stack = [[0, coords.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    if (b - a < 2) continue;
    const [ax, ay] = pts[a];
    const [bx, by] = pts[b];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let maxD = -1;
    let maxI = -1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = pts[i];
      let d;
      if (len2 === 0) {
        d = Math.hypot(px - ax, py - ay);
      } else {
        const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
        d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
      }
      if (d > maxD) {
        maxD = d;
        maxI = i;
      }
    }
    if (maxD > tolKm) {
      keep[maxI] = true;
      stack.push([a, maxI], [maxI, b]);
    }
  }
  return coords.filter((_, i) => keep[i]);
}

const lengthKm = (part) => {
  let sum = 0;
  for (let i = 1; i < part.length; i++) {
    const [ax, ay] = toKm(part[i - 1]);
    const [bx, by] = toKm(part[i]);
    sum += Math.hypot(bx - ax, by - ay);
  }
  return sum;
};

function buildParts(segs, tolKm, minLenKm) {
  return stitch(segs)
    .flatMap((part) => clipLine(part))
    .map((part) => simplify(part, tolKm))
    .filter((part) => lengthKm(part) >= minLenKm);
}

const borders = buildParts(borderSegs, BORDER_TOLERANCE_KM, 1.0);
const coasts = buildParts(coastSegs, COAST_TOLERANCE_KM, 1.5); // 小さな池・島は捨てる

// ---- 出力 ----
const round5 = (v) => Math.round(v * 1e5) / 1e5;
const pack = (parts) => parts.map((part) => part.map(([lon, lat]) => [round5(lon), round5(lat)]));

const out = {
  meta: {
    source: "国土数値情報 行政区域データ(N03-2025)(国土交通省)",
    sourceUrl: "https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N03-2025.html",
    note: "県境・海岸線(湖岸含む)を抽出・簡略化したもの。座標は [経度, 緯度]",
    generatedBy: "scripts/convert-n03.mjs",
  },
  prefBorders: pack(borders),
  coastlines: pack(coasts),
};

const outPath = join(root, "src", "data", "generated", "boundaries.json");
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(out));

const count = (parts) => parts.reduce((n, p) => n + p.length, 0);
console.log(`prefBorders: ${borders.length} parts / ${count(borders)} pts`);
console.log(`coastlines : ${coasts.length} parts / ${count(coasts)} pts`);
console.log(`output: ${outPath}`);
