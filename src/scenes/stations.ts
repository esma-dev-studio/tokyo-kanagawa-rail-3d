import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import type { LabelMode, RailLine, Station } from "../types/rail";
import { lonLatToXZ } from "../utils/geo";
import { heightToY } from "../utils/height";
import { labelThresholds, shouldShowLabel } from "../utils/labels";

/**
 * 駅の描画。
 * - 駅マーカー(球): 路線ごとに InstancedMesh 化して描画コールを抑える
 *   (48路線 × 約1000駅を個別Meshにするとドローコールが膨らむため)
 * - クリック判定: 見た目より大きい不可視のヒット球(こちらも Instanced)
 * - 支柱(GL±0 ⇔ 駅高さ): 1路線 = 1つの LineSegments
 * - 駅名ラベル(CSS2D/DOM): 同名駅は路線をまたいで1つに集約(重複防止)
 */

// ---- 共有ジオメトリ・マテリアル(全路線で使い回す) ----
const MINOR_GEO = new THREE.SphereGeometry(0.1, 10, 7);
const MAJOR_GEO = new THREE.SphereGeometry(0.16, 14, 10);
const HIT_GEO = new THREE.SphereGeometry(0.5, 6, 4);
// 白すぎるとブルームで白飛びするため、わずかに落とした色にする
const MINOR_MAT = new THREE.MeshBasicMaterial({ color: 0xaebfd8 });
const MAJOR_MAT = new THREE.MeshBasicMaterial({ color: 0xdde8f5 });
const HIT_MAT = new THREE.MeshBasicMaterial();

/** この路線でのこの駅の概算高さ[m](生成データは height を持つ。手書きは polyline から) */
export function stationHeightOf(line: RailLine, index: number): number {
  const st = line.stations[index];
  if (st.height !== undefined) return st.height;
  const poly = line.polyline;
  if (poly && poly.length > 0) return poly[Math.min(index, poly.length - 1)].height;
  return 0;
}

// ---- 駅名ラベルの路線横断レジストリ ----

interface LabelContributor {
  lineId: string;
  /** x,z: シーン座標 / y: 高さ[m](生値) */
  base: THREE.Vector3;
  isMajor: boolean;
}

export interface LabelEntry {
  object: CSS2DObject;
  element: HTMLDivElement;
  contributors: LabelContributor[];
}

export type LabelRegistry = Map<string, LabelEntry>;

export function createLabelRegistry(): LabelRegistry {
  return new Map();
}

export interface LineStationsObject {
  group: THREE.Group;
  /** クリック判定用の不可視 InstancedMesh(userData.stations に駅配列) */
  hitMesh: THREE.InstancedMesh;
  setExaggeration(exaggeration: number): void;
  dispose(): void;
}

/** hitMesh.userData の中身 */
export interface StationHitUserData {
  lineId: string;
  stations: Station[];
}

export function buildLineStations(
  line: RailLine,
  exaggeration: number,
  registry: LabelRegistry,
  labelsGroup: THREE.Group
): LineStationsObject {
  const group = new THREE.Group();
  const n = line.stations.length;

  // 駅ごとの基準位置(y=メートル生値)
  const bases = line.stations.map((st, i) => {
    const { x, z } = lonLatToXZ(st.longitude, st.latitude);
    return new THREE.Vector3(x, stationHeightOf(line, i), z);
  });

  const majorIdx: number[] = [];
  const minorIdx: number[] = [];
  line.stations.forEach((st, i) => (st.isMajorStation ? majorIdx : minorIdx).push(i));

  // マーカー(Instanced)
  const minorMesh = new THREE.InstancedMesh(MINOR_GEO, MINOR_MAT, minorIdx.length);
  const majorMesh = new THREE.InstancedMesh(MAJOR_GEO, MAJOR_MAT, majorIdx.length);
  const hitMesh = new THREE.InstancedMesh(HIT_GEO, HIT_MAT, n);
  minorMesh.renderOrder = 3;
  majorMesh.renderOrder = 3;
  hitMesh.visible = false; // 描画しない(可視性に関係なくレイキャストは当たる)
  hitMesh.userData = { lineId: line.lineId, stations: line.stations } satisfies StationHitUserData;
  group.add(minorMesh, majorMesh, hitMesh);

  // 支柱(GL±0 ⇔ 駅高さ)
  const pillarPositions = new Float32Array(n * 6);
  const pillarGeo = new THREE.BufferGeometry();
  pillarGeo.setAttribute("position", new THREE.BufferAttribute(pillarPositions, 3));
  const pillarMat = new THREE.LineBasicMaterial({
    color: new THREE.Color(line.lineColor),
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
  });
  const pillars = new THREE.LineSegments(pillarGeo, pillarMat);
  pillars.renderOrder = 1;
  group.add(pillars);

  // 位置の一括更新(初期化・強調倍率変更の両方で使う)
  const m = new THREE.Matrix4();
  const applyPositions = (exagg: number) => {
    const setAll = (mesh: THREE.InstancedMesh, indices: number[]) => {
      indices.forEach((stIdx, i) => {
        const b = bases[stIdx];
        m.makeTranslation(b.x, heightToY(b.y, exagg), b.z);
        mesh.setMatrixAt(i, m);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    };
    setAll(minorMesh, minorIdx);
    setAll(majorMesh, majorIdx);
    setAll(hitMesh, Array.from({ length: n }, (_, i) => i));
    bases.forEach((b, i) => {
      pillarPositions.set([b.x, 0, b.z, b.x, heightToY(b.y, exagg), b.z], i * 6);
    });
    pillarGeo.attributes.position.needsUpdate = true;
    pillarGeo.computeBoundingSphere();
  };
  applyPositions(exaggeration);

  // 駅名ラベル(同名駅はレジストリで集約)
  line.stations.forEach((st, i) => {
    const contributor: LabelContributor = {
      lineId: line.lineId,
      base: bases[i],
      isMajor: st.isMajorStation,
    };
    const existing = registry.get(st.stationName);
    if (existing) {
      existing.contributors.push(contributor);
      return;
    }
    // CSS2DRenderer は外側要素の transform を毎フレーム上書きするため、
    // 「持ち上げ」用のオフセットは内側の要素に持たせる
    const wrapper = document.createElement("div");
    const el = document.createElement("div");
    el.className = "sta-label" + (st.isMajorStation ? " sta-label--major" : "");
    el.textContent = st.stationName;
    wrapper.appendChild(el);
    const obj = new CSS2DObject(wrapper);
    obj.position.set(bases[i].x, heightToY(bases[i].y, exaggeration), bases[i].z);
    labelsGroup.add(obj);
    registry.set(st.stationName, { object: obj, element: el, contributors: [contributor] });
  });

  return {
    group,
    hitMesh,
    setExaggeration: applyPositions,
    dispose() {
      minorMesh.dispose();
      majorMesh.dispose();
      hitMesh.dispose();
      pillarGeo.dispose();
      pillarMat.dispose();
    },
  };
}

/**
 * ラベルの更新(間引き実行を想定)。
 * - 非表示路線しか通らない駅のラベルは消す
 * - 表示モードとカメラ距離で表示候補を絞る
 * - 候補をスクリーンに投影し、重なるものは優先度の低い方を隠す
 *   (優先度: 主要駅 > 一般駅、カメラに近い駅 > 遠い駅)
 * - 位置は「表示中の路線のうち最初の寄与」の高さに追従させる
 */
export function updateLabels(
  registry: LabelRegistry,
  visibleLineIds: ReadonlySet<string>,
  mode: LabelMode,
  exaggeration: number,
  camera: THREE.Camera,
  viewDistKm: number,
  viewportW: number,
  viewportH: number
): void {
  const camPos = new THREE.Vector3();
  camera.getWorldPosition(camPos);
  const tmp = new THREE.Vector3();
  const thresholds = labelThresholds(viewDistKm);

  interface Candidate {
    entry: LabelEntry;
    isMajor: boolean;
    dist: number;
    sx: number;
    sy: number;
  }
  const candidates: Candidate[] = [];

  registry.forEach((entry) => {
    const active = entry.contributors.filter((c) => visibleLineIds.has(c.lineId));
    if (active.length === 0) {
      entry.object.visible = false;
      return;
    }
    // 寄与のどれかが主要駅なら主要駅として扱う
    const isMajor = active.some((c) => c.isMajor);
    const rep = active[0];
    tmp.set(rep.base.x, heightToY(rep.base.y, exaggeration), rep.base.z);
    entry.object.position.copy(tmp);
    entry.element.classList.toggle("sta-label--major", isMajor);

    const dist = camPos.distanceTo(tmp);
    if (!shouldShowLabel(mode, isMajor, dist, thresholds)) {
      entry.object.visible = false;
      return;
    }
    // スクリーン投影(画面外・カメラ背後は非表示)
    const ndc = tmp.clone().project(camera);
    if (ndc.z > 1 || ndc.x < -1.05 || ndc.x > 1.05 || ndc.y < -1.05 || ndc.y > 1.05) {
      entry.object.visible = false;
      return;
    }
    candidates.push({
      entry,
      isMajor,
      dist,
      sx: ((ndc.x + 1) / 2) * viewportW,
      sy: ((-ndc.y + 1) / 2) * viewportH,
    });
  });

  // 優先度順に貪欲配置し、既配置と重なるラベルは隠す
  candidates.sort((a, b) =>
    a.isMajor !== b.isMajor ? (a.isMajor ? -1 : 1) : a.dist - b.dist
  );
  const placed: { x1: number; y1: number; x2: number; y2: number }[] = [];
  const MARGIN = 3;
  for (const c of candidates) {
    const fontW = c.isMajor ? 13 : 11.5;
    const w = c.entry.element.textContent!.length * fontW + 8;
    const h = c.isMajor ? 20 : 17;
    // ラベル箱はアンカーの15px上に中心が来る(.sta-label の translateY と対応)
    const box = {
      x1: c.sx - w / 2 - MARGIN,
      y1: c.sy - 15 - h / 2 - MARGIN,
      x2: c.sx + w / 2 + MARGIN,
      y2: c.sy - 15 + h / 2 + MARGIN,
    };
    const collides = placed.some(
      (p) => box.x1 < p.x2 && box.x2 > p.x1 && box.y1 < p.y2 && box.y2 > p.y1
    );
    c.entry.object.visible = !collides;
    if (!collides) placed.push(box);
  }
}
