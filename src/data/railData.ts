import type { RailLine } from "../types/rail";
import n02 from "./generated/n02Lines.json";

/**
 * 表示対象の全路線。
 * 実データは国土数値情報 鉄道データ(N02)から scripts/convert-n02.mjs で生成した
 * src/data/generated/n02Lines.json(順序: 地下鉄 → JR → 私鉄)。
 *
 * 路線の追加・調整は scripts/n02.config.mjs を編集して再変換する。
 * (手書きデータで路線を足したい場合は data/buildLine.ts を使って
 *  RailLine を構築し、この配列に concat すればよい)
 */
export const RAIL_LINES: RailLine[] = n02.lines as unknown as RailLine[];

/** 出典クレジット(UI表示用) */
export const DATA_SOURCE_CREDIT =
  "国土数値情報 鉄道・行政区域データ(国土交通省)を加工";
