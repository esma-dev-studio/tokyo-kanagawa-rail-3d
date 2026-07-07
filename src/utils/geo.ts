/**
 * 緯度経度 → Three.js シーン座標への変換。
 * 対象エリア(東京・神奈川)は狭域なので、中心点基準の正距円筒近似で十分。
 * シーン座標系: 1 unit = 1 km。X=東, Z=南(Three.jsの画面手前), Y=高さ。
 */

/** 投影の中心(東京都心と横浜の中間あたり) */
export const CENTER_LAT = 35.55;
export const CENTER_LON = 139.68;

/** 1度あたりの距離[km] */
const KM_PER_DEG_LAT = 110.95;
const KM_PER_DEG_LON = 111.32 * Math.cos((CENTER_LAT * Math.PI) / 180); // ≒ 90.6

/** 地面プレーンの一辺[km] */
export const GROUND_SIZE = 90;

/** 緯度経度をシーンの XZ 座標(km)へ変換する */
export function lonLatToXZ(lon: number, lat: number): { x: number; z: number } {
  return {
    x: (lon - CENTER_LON) * KM_PER_DEG_LON,
    z: -(lat - CENTER_LAT) * KM_PER_DEG_LAT, // 北をシーン奥(-Z)にする
  };
}
