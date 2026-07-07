import { useEffect, useRef } from "react";
import { RailScene } from "../scenes/RailScene";
import { RAIL_LINES } from "../data/railData";
import type { StationSelection } from "../types/rail";

/**
 * RailScene(Three.js)のライフサイクルを React に接続するフック。
 * シーンはマウント時に1度だけ生成し、以後は ref 経由でメソッドを呼ぶ。
 */
export function useRailScene(
  onStationClick: (selection: StationSelection | null) => void
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<RailScene | null>(null);
  // コールバックは ref 経由にして、シーンの再生成なしで最新を呼べるようにする
  const clickRef = useRef(onStationClick);
  clickRef.current = onStationClick;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const scene = new RailScene(container, RAIL_LINES, {
      onStationClick: (s) => clickRef.current(s),
    });
    sceneRef.current = scene;
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  return { containerRef, sceneRef };
}
