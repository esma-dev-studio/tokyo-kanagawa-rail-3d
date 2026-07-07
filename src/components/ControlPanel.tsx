import { Fragment } from "react";
import { DATA_SOURCE_CREDIT } from "../data/railData";
import type {
  CategoryFilter,
  LabelMode,
  LineCategory,
  RailLine,
  ViewMode,
} from "../types/rail";
import {
  EXAGGERATION_MAX,
  EXAGGERATION_MIN,
  STRUCTURE_TYPE_LABEL,
} from "../utils/height";

/** 左側の操作パネル */

const CATEGORY_OPTIONS: { value: CategoryFilter; label: string }[] = [
  { value: "all", label: "全路線" },
  { value: "subway", label: "地下鉄" },
  { value: "jr", label: "JR" },
  { value: "private", label: "私鉄" },
];

const LABEL_OPTIONS: { value: LabelMode; label: string }[] = [
  { value: "none", label: "なし" },
  { value: "major", label: "主要駅" },
  { value: "all", label: "全駅" },
];

const CATEGORY_CAPTION: Record<LineCategory, string> = {
  subway: "SUBWAY 地下鉄",
  jr: "JR",
  private: "PRIVATE 私鉄",
};

export interface ControlPanelProps {
  lines: RailLine[];
  lineOn: Record<string, boolean>;
  onToggleLine(lineId: string): void;
  category: CategoryFilter;
  onCategory(c: CategoryFilter): void;
  labelMode: LabelMode;
  onLabelMode(m: LabelMode): void;
  exaggeration: number;
  onExaggeration(v: number): void;
  mapOpacity: number; // 0..100
  onMapOpacity(v: number): void;
  viewMode: ViewMode;
  onViewMode(v: ViewMode): void;
}

export function ControlPanel(p: ControlPanelProps) {
  return (
    <div className="control-panel ui-card">
      {/* 路線一覧と表示/非表示 */}
      <section>
        <div className="sec-title">
          LINES <span className="jp">路線</span>
        </div>
        {p.lines.map((line, i) => {
          const inCategory =
            p.category === "all" || line.category === p.category;
          const isNewGroup =
            i === 0 || p.lines[i - 1].category !== line.category;
          return (
            <Fragment key={line.lineId}>
              {isNewGroup && (
                <div className="line-group-caption">
                  {CATEGORY_CAPTION[line.category]}
                </div>
              )}
              <div className={"line-row" + (inCategory ? "" : " disabled")}>
                <span
                  className="line-chip"
                  style={{
                    background: line.lineColor,
                    boxShadow: `0 0 8px ${line.lineColor}66`,
                  }}
                />
                <span className="name">{line.lineName}</span>
                <span className="meta">
                  {line.stations.length}駅・{STRUCTURE_TYPE_LABEL[line.structureType]}
                </span>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={p.lineOn[line.lineId] ?? true}
                    onChange={() => p.onToggleLine(line.lineId)}
                  />
                  <span className="track" />
                </label>
              </div>
            </Fragment>
          );
        })}
      </section>

      {/* 種別フィルター */}
      <section>
        <div className="sec-title">
          FILTER <span className="jp">種別</span>
        </div>
        <div className="segmented">
          {CATEGORY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={p.category === opt.value ? "active" : ""}
              onClick={() => p.onCategory(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      {/* 駅名ラベル表示 */}
      <section>
        <div className="sec-title">
          LABELS <span className="jp">駅名表示</span>
        </div>
        <div className="segmented">
          {LABEL_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={p.labelMode === opt.value ? "active" : ""}
              onClick={() => p.onLabelMode(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      {/* 深さの強調倍率 */}
      <section>
        <div className="sec-title">
          DEPTH <span className="jp">深さ表現</span>
        </div>
        <div className="slider-row">
          <span>深さの強調倍率</span>
          <span className="value">×{p.exaggeration}</span>
        </div>
        <input
          type="range"
          min={EXAGGERATION_MIN}
          max={EXAGGERATION_MAX}
          step={5}
          value={p.exaggeration}
          onChange={(e) => p.onExaggeration(Number(e.target.value))}
        />
      </section>

      {/* 地図の濃さ */}
      <section>
        <div className="sec-title">
          MAP <span className="jp">地図</span>
        </div>
        <div className="slider-row">
          <span>地図の濃さ</span>
          <span className="value">{p.mapOpacity}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={p.mapOpacity}
          onChange={(e) => p.onMapOpacity(Number(e.target.value))}
        />
      </section>

      {/* 視点切替 */}
      <section>
        <div className="sec-title">
          VIEW <span className="jp">視点</span>
        </div>
        <div className="segmented">
          <button
            className={p.viewMode === "tilt" ? "active" : ""}
            onClick={() => p.onViewMode("tilt")}
          >
            チルト
          </button>
          <button
            className={p.viewMode === "top" ? "active" : ""}
            onClick={() => p.onViewMode("top")}
          >
            俯瞰(真上)
          </button>
        </div>
      </section>

      <div className="panel-note">
        <div className="warn">深度・高度は視認性優先の概算値です。</div>
        <div>路線形状・駅位置: {DATA_SOURCE_CREDIT}</div>
        <div>ドラッグ: 回転 / 右ドラッグ・Shift+ドラッグ: 移動</div>
        <div>Ctrl+ドラッグ: 上下移動(地下に潜って見上げられる)</div>
        <div>ホイール: 拡大縮小 / 駅クリック: 詳細表示</div>
      </div>
    </div>
  );
}
