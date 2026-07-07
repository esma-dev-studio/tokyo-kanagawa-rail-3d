/**
 * 鉄道路線データの型定義。
 * 将来 GTFS / ODPT / 公共交通オープンデータ等から生成したデータに
 * 差し替えられるよう、描画ロジックとは独立したプレーンな構造にしている。
 */

/** 路線の種別 */
export type LineCategory = "subway" | "jr" | "private";

/** 路線の主構造(駅単位の高低は polyline の height で上書き表現する) */
export type StructureType = "underground" | "ground" | "elevated";

/** 事業者 */
export interface Operator {
  operatorId: string;
  operatorName: string;
}

/** 駅 */
export interface Station {
  stationId: string;
  stationName: string;
  latitude: number;
  longitude: number;
  /** 主要駅(マーカー拡大・ラベル優先表示の対象) */
  isMajorStation: boolean;
  /** 路線内の並び順 */
  order: number;
  /**
   * この路線でのこの駅の概算高さ[m]。
   * 省略時は polyline の同順位置の height を使う(手書きサンプルデータ互換)。
   */
  height?: number;
}

/** 路線形状の1点。height は地表面からの概算高さ[m](負=地下) */
export interface PolylinePoint {
  latitude: number;
  longitude: number;
  height: number;
}

/** 路線 */
export interface RailLine {
  operatorId: string;
  operatorName: string;
  lineId: string;
  lineName: string;
  /** 表示色(公式色に近い色。暗背景での視認性を優先して微調整あり) */
  lineColor: string;
  category: LineCategory;
  structureType: StructureType;
  /** 環状線なら true(始点と終点を接続して描画する。smooth な手書きデータ用) */
  isLoop?: boolean;
  /**
   * 点列をスプライン補間するか。
   * 手書きの駅列データ(疎)は true(既定)、実形状データ(密)は false。
   */
  smooth?: boolean;
  stations: Station[];
  /**
   * 路線形状(単一パス)。手書きサンプルデータ用。
   * polylineParts がある場合はそちらが優先される。
   */
  polyline?: PolylinePoint[];
  /**
   * 路線形状(複数パス)。分岐や飛び地区間を持つ実形状データ用。
   * 国土数値情報 N02 から scripts/convert-n02.mjs で生成する。
   */
  polylineParts?: PolylinePoint[][];
}

/** 駅ラベルの表示モード */
export type LabelMode = "none" | "major" | "all";

/** 種別フィルター */
export type CategoryFilter = "all" | LineCategory;

/** 視点モード */
export type ViewMode = "tilt" | "top";

/** 駅クリック時にポップアップへ渡す情報(同名駅は路線横断でまとめる) */
export interface StationSelection {
  stationName: string;
  /** クリック位置(スクリーン座標) */
  screenX: number;
  screenY: number;
  entries: {
    lineId: string;
    lineName: string;
    operatorName: string;
    lineColor: string;
    /** 概算高さ[m] */
    height: number;
    /** 地下 / 地上 / 高架 */
    structureLabel: string;
  }[];
}
