import type { LineCategory, RailLine, StructureType } from "../types/rail";

/**
 * 路線データ記述用のヘルパー。
 * MVP では「駅名, 緯度, 経度, 高さ[m], 主要駅か」のタプル列から
 * stations と polyline(駅列と同一の点列)を生成する。
 * 将来 polyline を GeoJSON 由来の詳細形状に差し替える場合は、
 * このヘルパーを通さず RailLine を直接構築すればよい。
 */

/** [駅名, 緯度, 経度, 概算高さm, 主要駅フラグ] */
export type StationTuple = [string, number, number, number, boolean];

export interface BuildLineParams {
  operatorId: string;
  operatorName: string;
  lineId: string;
  lineName: string;
  lineColor: string;
  category: LineCategory;
  structureType: StructureType;
  isLoop?: boolean;
  stations: StationTuple[];
}

export function buildLine(params: BuildLineParams): RailLine {
  const { stations, ...rest } = params;
  return {
    ...rest,
    stations: stations.map(([name, lat, lon, , isMajor], i) => ({
      stationId: `${params.lineId}-${String(i + 1).padStart(2, "0")}`,
      stationName: name,
      latitude: lat,
      longitude: lon,
      isMajorStation: isMajor,
      order: i + 1,
    })),
    polyline: stations.map(([, lat, lon, height]) => ({
      latitude: lat,
      longitude: lon,
      height,
    })),
  };
}
