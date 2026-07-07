import { useCallback, useEffect, useMemo, useState } from "react";
import { Compass } from "./components/Compass";
import { ControlPanel } from "./components/ControlPanel";
import { DepthScale } from "./components/DepthScale";
import { StationPopup } from "./components/StationPopup";
import { StatusBar } from "./components/StatusBar";
import { TitleHeader } from "./components/TitleHeader";
import { RAIL_LINES } from "./data/railData";
import { useRailScene } from "./hooks/useRailScene";
import type {
  CategoryFilter,
  LabelMode,
  StationSelection,
  ViewMode,
} from "./types/rail";
import { EXAGGERATION_DEFAULT } from "./utils/height";

export default function App() {
  // ---- UI 状態 ----
  const [lineOn, setLineOn] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(RAIL_LINES.map((l) => [l.lineId, true]))
  );
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [labelMode, setLabelMode] = useState<LabelMode>("major");
  const [exaggeration, setExaggeration] = useState(EXAGGERATION_DEFAULT);
  const [mapOpacity, setMapOpacity] = useState(65); // %
  const [viewMode, setViewMode] = useState<ViewMode>("tilt");
  const [selection, setSelection] = useState<StationSelection | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);

  const onStationClick = useCallback(
    (s: StationSelection | null) => setSelection(s),
    []
  );
  const { containerRef, sceneRef } = useRailScene(onStationClick);

  // 種別フィルターと路線ごとのトグルを合成した「実際に表示する路線」
  const visibleLineIds = useMemo(() => {
    const ids = RAIL_LINES.filter(
      (l) =>
        (category === "all" || l.category === category) &&
        (lineOn[l.lineId] ?? true)
    ).map((l) => l.lineId);
    return new Set(ids);
  }, [category, lineOn]);

  // ---- UI 状態を Three.js シーンへ反映 ----
  useEffect(() => {
    sceneRef.current?.setLineVisibility(visibleLineIds);
    // 非表示になった路線しか通らない駅のポップアップは閉じる
    setSelection((sel) =>
      sel && sel.entries.every((e) => !visibleLineIds.has(e.lineId))
        ? null
        : sel
    );
  }, [visibleLineIds, sceneRef]);

  useEffect(() => {
    sceneRef.current?.setLabelMode(labelMode);
  }, [labelMode, sceneRef]);

  useEffect(() => {
    sceneRef.current?.setExaggeration(exaggeration);
  }, [exaggeration, sceneRef]);

  useEffect(() => {
    sceneRef.current?.setMapOpacity(mapOpacity / 100);
  }, [mapOpacity, sceneRef]);

  useEffect(() => {
    sceneRef.current?.setViewMode(viewMode);
  }, [viewMode, sceneRef]);

  // ESC でポップアップを閉じる
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelection(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ---- 表示統計 ----
  const stats = useMemo(() => {
    const visibleLines = RAIL_LINES.filter((l) => visibleLineIds.has(l.lineId));
    const stationNames = new Set<string>();
    for (const l of visibleLines) {
      for (const s of l.stations) stationNames.add(s.stationName);
    }
    return {
      lineCount: visibleLines.length,
      stationCount: stationNames.size,
    };
  }, [visibleLineIds]);

  // データ全体の高さレンジ(ヘッダー表示用)
  const heightRange = useMemo(() => {
    let min = 0;
    let max = 0;
    for (const l of RAIL_LINES) {
      const parts = l.polylineParts ?? (l.polyline ? [l.polyline] : []);
      for (const part of parts) {
        for (const p of part) {
          min = Math.min(min, p.height);
          max = Math.max(max, p.height);
        }
      }
    }
    return { min: Math.round(min), max: Math.round(max) };
  }, []);

  return (
    <>
      {/* 3D キャンバス */}
      <div className="canvas-root" ref={containerRef} />
      <div className="vignette" />

      {/* UI オーバーレイ */}
      <TitleHeader
        lineCount={RAIL_LINES.length}
        maxHeight={heightRange.max}
        minHeight={heightRange.min}
      />

      <button className="panel-toggle" onClick={() => setPanelOpen((v) => !v)}>
        {panelOpen ? "PANEL ◂" : "PANEL ▸"}
      </button>

      {panelOpen && (
        <ControlPanel
          lines={RAIL_LINES}
          lineOn={lineOn}
          onToggleLine={(id) =>
            setLineOn((prev) => ({ ...prev, [id]: !(prev[id] ?? true) }))
          }
          category={category}
          onCategory={setCategory}
          labelMode={labelMode}
          onLabelMode={setLabelMode}
          exaggeration={exaggeration}
          onExaggeration={setExaggeration}
          mapOpacity={mapOpacity}
          onMapOpacity={setMapOpacity}
          viewMode={viewMode}
          onViewMode={setViewMode}
        />
      )}

      <DepthScale />

      <Compass sceneRef={sceneRef} />

      <StatusBar
        category={category}
        viewMode={viewMode}
        visibleLineCount={stats.lineCount}
        totalLineCount={RAIL_LINES.length}
        visibleStationCount={stats.stationCount}
      />

      {selection && selection.entries.length > 0 && (
        <StationPopup selection={selection} onClose={() => setSelection(null)} />
      )}
    </>
  );
}
