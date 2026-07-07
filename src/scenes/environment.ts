import * as THREE from "three";
import boundaries from "../data/generated/boundaries.json";
import { GROUND_SIZE, lonLatToXZ } from "../utils/geo";

/**
 * 背景環境(地面プレーン・グリッド・県境・海岸線)の生成。
 * 建物や地形は出さず、「暗い基準面 + 薄いグリッド + うっすらした水際と県境」
 * だけで地表(GL±0)と位置関係を示す。
 *
 * 描画順のポイント:
 * 地面プレーンは半透明 + depthWrite無効 + renderOrder大 とし、
 * 「路線を描いた後に上から被せる」ことで、地下路線が地表面を
 * 透かして少し暗く見える(=沈んで見える)効果を作っている。
 */

export interface Environment {
  group: THREE.Group;
  /** 地図(地面・グリッド)の濃さ 0..1 */
  setMapOpacity(opacity: number): void;
}

const PLANE_BASE_OPACITY = 0.72; // 地表面の最大不透明度(地下の透け具合)
const GRID_MAJOR_BASE_OPACITY = 0.42; // 5kmグリッド
const GRID_MINOR_BASE_OPACITY = 0.16; // 1kmグリッド
const COAST_BASE_OPACITY = 0.5; // 海岸線・湖岸
const BORDER_BASE_OPACITY = 0.45; // 県境

/** [経度,緯度] の折れ線群を1つの LineSegments ジオメトリにまとめる(描画コール1回) */
function buildBoundaryLines(
  parts: number[][][],
  color: number,
  opacity: number,
  y: number
): { object: THREE.LineSegments; material: THREE.LineBasicMaterial } {
  const positions: number[] = [];
  for (const part of parts) {
    for (let i = 0; i < part.length - 1; i++) {
      const a = lonLatToXZ(part[i][0], part[i][1]);
      const b = lonLatToXZ(part[i + 1][0], part[i + 1][1]);
      positions.push(a.x, y, a.z, b.x, y, b.z);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
  });
  const object = new THREE.LineSegments(geo, material);
  return { object, material };
}

export function createEnvironment(): Environment {
  const group = new THREE.Group();

  // 地表面プレーン(GL±0)
  const planeMat = new THREE.MeshBasicMaterial({
    color: 0x0a1122,
    transparent: true,
    opacity: PLANE_BASE_OPACITY,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(GROUND_SIZE * 1.5, GROUND_SIZE * 1.5),
    planeMat
  );
  plane.rotation.x = -Math.PI / 2;
  plane.renderOrder = 10; // 路線より後に描いて地下を減光する
  group.add(plane);

  // 5km間隔の主グリッド
  const gridMajor = new THREE.GridHelper(
    GROUND_SIZE,
    GROUND_SIZE / 5,
    0x2a3d63,
    0x2a3d63
  );
  const gridMajorMat = gridMajor.material as THREE.LineBasicMaterial;
  gridMajorMat.transparent = true;
  gridMajorMat.opacity = GRID_MAJOR_BASE_OPACITY;
  gridMajorMat.depthWrite = false;
  gridMajor.position.y = 0.015;
  gridMajor.renderOrder = 11;
  group.add(gridMajor);

  // 1km間隔の細グリッド
  const gridMinor = new THREE.GridHelper(
    GROUND_SIZE,
    GROUND_SIZE,
    0x1a2740,
    0x1a2740
  );
  const gridMinorMat = gridMinor.material as THREE.LineBasicMaterial;
  gridMinorMat.transparent = true;
  gridMinorMat.opacity = GRID_MINOR_BASE_OPACITY;
  gridMinorMat.depthWrite = false;
  gridMinor.position.y = 0.01;
  gridMinor.renderOrder = 11;
  group.add(gridMinor);

  // 海岸線・湖岸(グリッドよりわずかに明るく)
  const coast = buildBoundaryLines(
    boundaries.coastlines,
    0x3d5f9e,
    COAST_BASE_OPACITY,
    0.02
  );
  coast.object.renderOrder = 12;
  group.add(coast.object);

  // 県境(海岸線・グリッドと見分けがつくよう、わずかに紫寄りの色にする)
  const border = buildBoundaryLines(
    boundaries.prefBorders,
    0x7a7fc4,
    BORDER_BASE_OPACITY,
    0.02
  );
  border.object.renderOrder = 12;
  group.add(border.object);

  return {
    group,
    setMapOpacity(opacity: number) {
      planeMat.opacity = PLANE_BASE_OPACITY * opacity;
      gridMajorMat.opacity = GRID_MAJOR_BASE_OPACITY * opacity;
      gridMinorMat.opacity = GRID_MINOR_BASE_OPACITY * opacity;
      coast.material.opacity = COAST_BASE_OPACITY * opacity;
      border.material.opacity = BORDER_BASE_OPACITY * opacity;
    },
  };
}
