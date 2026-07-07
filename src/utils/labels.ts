import type { LabelMode } from "../types/rail";

/**
 * 駅名ラベルの表示制御。
 * 「どこまで遠くの駅ラベルを出すか」のしきい値を視点距離(ズーム)に連動させる。
 * 遠くを俯瞰しているときは広く、近くへズームしたときは周辺だけに絞ることで、
 * 地平線付近に遠方ラベルが帯状に密集するのを防ぐ。
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export interface LabelThresholds {
  /** 主要駅ラベルを表示するカメラ距離の上限[km] */
  major: number;
  /** 一般駅ラベルを表示するカメラ距離の上限[km](全駅モード時) */
  minor: number;
}

/** viewDist: カメラから注視点までの距離[km] */
export function labelThresholds(viewDist: number): LabelThresholds {
  return {
    major: clamp(viewDist * 2.2, 10, 95),
    minor: clamp(viewDist * 1.3, 5, 26),
  };
}

export function shouldShowLabel(
  mode: LabelMode,
  isMajor: boolean,
  labelDist: number,
  thresholds: LabelThresholds
): boolean {
  if (mode === "none") return false;
  if (isMajor) return labelDist < thresholds.major;
  if (mode !== "all") return false;
  return labelDist < thresholds.minor;
}
