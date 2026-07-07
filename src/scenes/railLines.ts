import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import type { PolylinePoint, RailLine } from "../types/rail";
import { lonLatToXZ } from "../utils/geo";
import { heightToY } from "../utils/height";

/**
 * 路線ライン(曲線)の描画。
 * - 路線は複数パーツ(分岐・飛び地)を持てる。パーツごとに Line2 を作るが、
 *   マテリアルは路線内で共有する
 * - 手書きデータ(smooth≠false)は Catmull-Rom 曲線で滑らかに補間し、
 *   実形状データ(smooth=false)は点列をそのまま使う
 * - 本体ライン(細・不透明) + ハロー(太・加算合成)の2本重ねで発光感を出す
 * - 高さ[m]は保持したまま、描画時に強調倍率を掛けて Y 座標へ変換する
 */

export interface RailPathObject {
  group: THREE.Group;
  /** 画面リサイズ時に解像度を渡す必要がある LineMaterial 一覧 */
  materials: LineMaterial[];
  setExaggeration(exaggeration: number): void;
  dispose(): void;
}

/** 駅間あたりの曲線分割数(手書きデータの滑らかさと頂点数のバランス) */
const SAMPLES_PER_SEGMENT = 8;

/** 1パーツ分の点列(y=高さm の生値)を作る */
function samplePart(line: RailLine, part: PolylinePoint[]): THREE.Vector3[] {
  const pts = part.map((p) => {
    const { x, z } = lonLatToXZ(p.longitude, p.latitude);
    return new THREE.Vector3(x, p.height, z);
  });
  // 実形状データは十分に密なのでそのまま使う
  if (line.smooth === false || pts.length < 3) return pts;
  // centripetal Catmull-Rom は行き過ぎ(オーバーシュート)が出にくい
  const curve = new THREE.CatmullRomCurve3(pts, line.isLoop === true, "centripetal");
  const segments = (line.isLoop ? pts.length : pts.length - 1) * SAMPLES_PER_SEGMENT;
  return curve.getPoints(segments);
}

export function buildRailPath(line: RailLine, exaggeration: number): RailPathObject {
  const group = new THREE.Group();

  const parts = line.polylineParts ?? (line.polyline ? [line.polyline] : []);
  const rawSampleSets = parts.map((part) => samplePart(line, part));

  const toPositions = (raw: THREE.Vector3[], exagg: number): number[] => {
    const arr: number[] = [];
    for (const p of raw) {
      arr.push(p.x, heightToY(p.y, exagg), p.z);
    }
    return arr;
  };

  // マテリアルは路線内の全パーツで共有
  const colorHex = new THREE.Color(line.lineColor).getHex();
  const coreMat = new LineMaterial({
    color: colorHex,
    linewidth: 3.2, // px
    transparent: true,
    opacity: 0.98,
  });
  const haloMat = new LineMaterial({
    color: colorHex,
    linewidth: 7,
    transparent: true,
    opacity: 0.1,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const geometries = rawSampleSets.map((raw) => {
    const geometry = new LineGeometry();
    geometry.setPositions(toPositions(raw, exaggeration));
    const core = new Line2(geometry, coreMat);
    core.renderOrder = 2;
    const halo = new Line2(geometry, haloMat);
    halo.renderOrder = 1;
    group.add(halo);
    group.add(core);
    return geometry;
  });

  return {
    group,
    materials: [coreMat, haloMat],
    setExaggeration(exagg: number) {
      geometries.forEach((geometry, i) => {
        geometry.setPositions(toPositions(rawSampleSets[i], exagg));
      });
    },
    dispose() {
      geometries.forEach((g) => g.dispose());
      coreMat.dispose();
      haloMat.dispose();
    },
  };
}
