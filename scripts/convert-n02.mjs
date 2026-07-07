/**
 * 国土数値情報 鉄道データ(N02)GeoJSON → アプリ用路線データ(JSON)変換。
 *
 * 使い方:
 *   node scripts/convert-n02.mjs <N02のUTF-8 GeoJSONがあるディレクトリ>
 *
 * 処理の流れ(路線ごと):
 *   1. RailroadSection から対象路線の区間(LineString)を抽出
 *   2. 対象bboxでクリップ(境界をまたぐ区間は境界点で切断)
 *   3. 端点が一致する区間をつなぎ、連続した点列(パーツ)に統合
 *      (分岐がある路線は複数パーツになる)
 *   4. Douglas-Peucker で約20m精度に間引き
 *   5. 概算高さを付与(基準高さ + 駅単位/区間単位の上書きをなだらかに接続)
 *   6. Station から駅を抽出し、路線に沿った順序に並べて高さを対応付け
 *
 * 出力: src/data/generated/n02Lines.json
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BBOX, LINES, MAJOR_AUTO_LINE_COUNT, MAJOR_STATIONS_MANUAL } from "./n02.config.mjs";

const srcDir = process.argv[2];
if (!srcDir) {
  console.error("usage: node scripts/convert-n02.mjs <dir-with-N02-geojson>");
  process.exit(1);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// ---- 定数 ----
const KM_PER_DEG_LAT = 110.95;
const KM_PER_DEG_LON = 111.32 * Math.cos((35.55 * Math.PI) / 180);
const SIMPLIFY_TOLERANCE_KM = 0.02; // 約20m
const POINT_OVERRIDE_RADIUS_KM = 1.6; // 駅上書きの影響半径
const RANGE_RAMP_KM = 0.8; // 区間上書き端のランプ幅
const STITCH_DECIMALS = 5; // 端点一致判定の丸め(約1m)

// ---- 入力読み込み ----
const railFile = findFile("RailroadSection");
const stationFile = findFile("Station");
const rail = JSON.parse(readFileSync(railFile, "utf8"));
const stationGeo = JSON.parse(readFileSync(stationFile, "utf8"));

function findFile(kind) {
  // N02-24_RailroadSection.geojson のようなファイル名を年度に依存せず探す
  const name = readdirSync(srcDir).find((f) => f.includes(kind) && f.endsWith(".geojson"));
  if (!name) throw new Error(`${kind} geojson not found in ${srcDir}`);
  return join(srcDir, name);
}

// ---- 幾何ユーティリティ(座標は [lon, lat]) ----
const toKm = ([lon, lat]) => [lon * KM_PER_DEG_LON, lat * KM_PER_DEG_LAT];
const distKm = (a, b) => {
  const [ax, ay] = toKm(a);
  const [bx, by] = toKm(b);
  return Math.hypot(ax - bx, ay - by);
};

const inBbox = ([lon, lat]) =>
  lat >= BBOX.minLat && lat <= BBOX.maxLat && lon >= BBOX.minLon && lon <= BBOX.maxLon;

/** 線分をbboxでクリップ(Liang-Barsky)。返り値は [p0, p1] または null */
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

/** LineString をbboxでクリップし、内側の連続部分ごとの配列にする */
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
    // 出口側で切れた場合はランを閉じる
    if (p1[0] !== coords[i + 1][0] || p1[1] !== coords[i + 1][1]) {
      if (cur.length >= 2) runs.push(cur);
      cur = [];
    }
  }
  if (cur.length >= 2) runs.push(cur);
  return runs;
}

/** 端点が一致する区間同士をつないで連続パーツにまとめる */
function stitch(segments) {
  const key = (p) => `${p[0].toFixed(STITCH_DECIMALS)},${p[1].toFixed(STITCH_DECIMALS)}`;
  const adj = new Map(); // 端点キー → {seg, end}[]
  segments.forEach((seg, i) => {
    for (const end of [0, 1]) {
      const k = key(end === 0 ? seg[0] : seg[seg.length - 1]);
      if (!adj.has(k)) adj.set(k, []);
      adj.get(k).push({ i, end });
    }
  });
  const used = new Set();
  const parts = [];

  const takeNext = (k, excludeIdx) => {
    const cands = adj.get(k) ?? [];
    for (const c of cands) {
      if (!used.has(c.i) && c.i !== excludeIdx) return c;
    }
    return null;
  };

  for (let s = 0; s < segments.length; s++) {
    if (used.has(s)) continue;
    used.add(s);
    let path = [...segments[s]];
    // 末尾方向へ延長
    for (;;) {
      const c = takeNext(key(path[path.length - 1]), -1);
      if (!c) break;
      used.add(c.i);
      const seg = segments[c.i];
      const pts = c.end === 0 ? seg : [...seg].reverse();
      path = path.concat(pts.slice(1));
    }
    // 先頭方向へ延長
    for (;;) {
      const c = takeNext(key(path[0]), -1);
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

/** Douglas-Peucker 簡略化(km空間での垂直距離) */
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

/** パーツ各点の累積距離[km] */
function arcLengths(part) {
  const arcs = [0];
  for (let i = 1; i < part.length; i++) {
    arcs.push(arcs[i - 1] + distKm(part[i - 1], part[i]));
  }
  return arcs;
}

/**
 * 点に最も近いパーツ上の位置(線分への射影)を探す。
 * 簡略化後は頂点間隔が数kmになるため、頂点ではなく線分距離で判定する。
 * → {partIdx, arc(弧長km), d(距離km)}
 */
function nearestOnParts(parts, partArcs, coord) {
  const c = toKm(coord);
  let best = { partIdx: -1, arc: 0, d: Infinity };
  parts.forEach((part, pi) => {
    for (let i = 0; i < part.length - 1; i++) {
      const a = toKm(part[i]);
      const b = toKm(part[i + 1]);
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const len2 = dx * dx + dy * dy;
      let t = len2 === 0 ? 0 : ((c[0] - a[0]) * dx + (c[1] - a[1]) * dy) / len2;
      t = Math.max(0, Math.min(1, t));
      const d = Math.hypot(c[0] - (a[0] + t * dx), c[1] - (a[1] + t * dy));
      if (d < best.d) {
        best = { partIdx: pi, arc: partArcs[pi][i] + t * Math.sqrt(len2), d };
      }
    }
  });
  return best;
}

/** パーツ上の弧長位置における高さ(頂点間は線形補間) */
function heightAtArc(arcs, heights, arc) {
  if (arc <= arcs[0]) return heights[0];
  for (let i = 1; i < arcs.length; i++) {
    if (arc <= arcs[i]) {
      const t = (arc - arcs[i - 1]) / (arcs[i] - arcs[i - 1] || 1);
      return heights[i - 1] * (1 - t) + heights[i] * t;
    }
  }
  return heights[heights.length - 1];
}

// ---- 駅データの索引(事業者+路線名 → 駅リスト) ----
// 駅名は NFKC 正規化する(N02 には「塚」U+FA10 のような互換漢字が含まれる)
const stationIndex = new Map();
for (const f of stationGeo.features) {
  const p = f.properties;
  const key = `${p.N02_004}\t${p.N02_003}`;
  if (!stationIndex.has(key)) stationIndex.set(key, []);
  const coords = f.geometry.coordinates;
  const mid = coords[Math.floor(coords.length / 2)];
  stationIndex.get(key).push({ name: p.N02_005.normalize("NFKC"), coord: mid });
}

// ---- 路線ごとの変換 ----
const converted = [];
for (const cfg of LINES) {
  // 1-2. 区間抽出 + クリップ
  const segments = [];
  for (const f of rail.features) {
    const p = f.properties;
    if (p.N02_004 !== cfg.n02Operator || !cfg.n02Lines.includes(p.N02_003)) continue;
    if (f.geometry.type !== "LineString") continue;
    segments.push(...clipLine(f.geometry.coordinates));
  }
  if (segments.length === 0) {
    console.error(`WARN: no sections for ${cfg.lineName}`);
    continue;
  }

  // 3-4. 接続 + 簡略化(短すぎる孤立パーツはノイズとして除去)
  let parts = stitch(segments)
    .map((p) => simplify(p, SIMPLIFY_TOLERANCE_KM))
    .filter((p) => {
      const arcs = arcLengths(p);
      return arcs[arcs.length - 1] > 0.5; // 500m未満は除去
    })
    .sort((a, b) => arcLengths(b).at(-1) - arcLengths(a).at(-1));

  const partArcs = parts.map(arcLengths);

  // 駅の抽出(名前で重複排除し、bbox内のみ)
  const stationsRaw = [];
  const seen = new Set();
  for (const n02Line of cfg.n02Lines) {
    for (const st of stationIndex.get(`${cfg.n02Operator}\t${n02Line}`) ?? []) {
      if (seen.has(st.name) || !inBbox(st.coord)) continue;
      seen.add(st.name);
      stationsRaw.push(st);
    }
  }

  // 駅を路線上へ射影(順序付けと高さ対応に使う)
  const projected = stationsRaw
    .map((st) => ({ ...st, proj: nearestOnParts(parts, partArcs, st.coord) }))
    .filter((st) => st.proj.d < 1.0); // 路線から1km以上離れた駅は対象外

  // 5. 高さ付与
  const heights = parts.map((part) => part.map(() => cfg.baseHeight));

  const arcOfStation = (name) => {
    const st = projected.find((s) => s.name === name.normalize("NFKC"));
    if (!st) {
      console.error(`WARN: override station not found: ${cfg.lineName} ${name}`);
      return null;
    }
    return { partIdx: st.proj.partIdx, arc: st.proj.arc };
  };

  // 区間上書き(from〜to を指定高さに、端はランプ)
  for (const r of cfg.rangeOverrides ?? []) {
    const a = arcOfStation(r.from);
    const b = arcOfStation(r.to);
    if (!a || !b || a.partIdx !== b.partIdx) continue;
    const lo = Math.min(a.arc, b.arc);
    const hi = Math.max(a.arc, b.arc);
    const arcs = partArcs[a.partIdx];
    heights[a.partIdx] = heights[a.partIdx].map((h, i) => {
      const arc = arcs[i];
      if (arc < lo - RANGE_RAMP_KM || arc > hi + RANGE_RAMP_KM) return h;
      if (arc >= lo && arc <= hi) return r.height;
      const t = arc < lo ? (lo - arc) / RANGE_RAMP_KM : (arc - hi) / RANGE_RAMP_KM;
      return r.height * (1 - t) + h * t;
    });
  }

  // 駅単位の上書き(影響半径内をなだらかに接続)
  for (const [name, h] of Object.entries(cfg.pointOverrides ?? {})) {
    const a = arcOfStation(name);
    if (!a) continue;
    const arcs = partArcs[a.partIdx];
    heights[a.partIdx] = heights[a.partIdx].map((cur, i) => {
      const w = Math.max(0, 1 - Math.abs(arcs[i] - a.arc) / POINT_OVERRIDE_RADIUS_KM);
      return cur * (1 - w) + h * w;
    });
  }

  // 6. 駅の並び順(パーツ順→パーツ内の弧長順)と高さ
  projected.sort((s1, s2) =>
    s1.proj.partIdx !== s2.proj.partIdx
      ? s1.proj.partIdx - s2.proj.partIdx
      : s1.proj.arc - s2.proj.arc
  );

  converted.push({
    cfg,
    parts,
    heights,
    stations: projected.map((st) => ({
      name: st.name,
      lon: st.coord[0],
      lat: st.coord[1],
      height:
        Math.round(
          heightAtArc(partArcs[st.proj.partIdx], heights[st.proj.partIdx], st.proj.arc) * 10
        ) / 10,
    })),
  });
}

// ---- 主要駅判定(手動リスト + 乗り入れ路線数) ----
const lineCountByStation = new Map();
for (const line of converted) {
  for (const st of line.stations) {
    lineCountByStation.set(st.name, (lineCountByStation.get(st.name) ?? 0) + 1);
  }
}
const isMajor = (name) =>
  MAJOR_STATIONS_MANUAL.includes(name) ||
  (lineCountByStation.get(name) ?? 0) >= MAJOR_AUTO_LINE_COUNT;

// ---- 出力 ----
const round6 = (v) => Math.round(v * 1e6) / 1e6;
const outLines = converted.map(({ cfg, parts, heights, stations }) => ({
  operatorId: cfg.operatorId,
  operatorName: cfg.operatorName,
  lineId: cfg.lineId,
  lineName: cfg.lineName,
  lineColor: cfg.color,
  category: cfg.category,
  structureType: cfg.structureType,
  smooth: false, // 実形状データなのでスプライン補間しない
  stations: stations.map((st, i) => ({
    stationId: `${cfg.lineId}-${String(i + 1).padStart(3, "0")}`,
    stationName: st.name,
    latitude: round6(st.lat),
    longitude: round6(st.lon),
    isMajorStation: isMajor(st.name),
    order: i + 1,
    height: st.height,
  })),
  polylineParts: parts.map((part, pi) =>
    part.map(([lon, lat], vi) => ({
      latitude: round6(lat),
      longitude: round6(lon),
      height: Math.round(heights[pi][vi] * 10) / 10,
    }))
  ),
}));

const out = {
  meta: {
    source: "国土数値情報 鉄道データ(N02-24)(国土交通省)",
    sourceUrl: "https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N02-2024.html",
    note: "高さ・深さはアプリ側で付与した視認性優先の概算値(元データに高度情報はない)",
    generatedBy: "scripts/convert-n02.mjs",
  },
  lines: outLines,
};

const outPath = join(root, "src", "data", "generated", "n02Lines.json");
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(out));

// ---- サマリー ----
for (const l of outLines) {
  const pts = l.polylineParts.reduce((n, p) => n + p.length, 0);
  console.log(
    `${l.lineName.padEnd(12, "　")} parts=${l.polylineParts.length} pts=${String(pts).padStart(5)} stations=${String(l.stations.length).padStart(3)}`
  );
}
console.log(`\ntotal lines: ${outLines.length}`);
console.log(`output: ${outPath}`);
