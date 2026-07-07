import type { StructureType } from "../types/rail";

/**
 * 高さ表現のロジック。
 * 実高さ[m]はデータ側(polyline.height)が持ち、ここでは
 * 「m → シーン座標」への変換と、高さから種別ラベルへの判定を担う。
 */

/** 深さ強調倍率のUIレンジ */
export const EXAGGERATION_MIN = 10;
export const EXAGGERATION_MAX = 200;
export const EXAGGERATION_DEFAULT = 80;

/**
 * 高さ[m] → シーンY座標[unit]。
 * 1 unit = 1km なので、素の縮尺では高低差がほぼ見えない。
 * 視認性優先で倍率(exaggeration)を掛けて誇張する。
 */
export function heightToY(heightMeters: number, exaggeration: number): number {
  return (heightMeters / 1000) * exaggeration;
}

/** 高さ[m]から 地下/地上/高架 を判定する(ポップアップ・凡例用) */
export function structureLabelOf(heightMeters: number): string {
  if (heightMeters < -3) return "地下";
  if (heightMeters > 4.5) return "高架";
  return "地上";
}

/** structureType の日本語表記(路線一覧用) */
export const STRUCTURE_TYPE_LABEL: Record<StructureType, string> = {
  underground: "地下",
  ground: "地上",
  elevated: "高架",
};
