import type { CategoryFilter, ViewMode } from "../types/rail";

/** 下部のステータスバー(表示モード・路線数・駅数) */

const CATEGORY_LABEL: Record<CategoryFilter, string> = {
  all: "全路線",
  subway: "地下鉄のみ",
  jr: "JRのみ",
  private: "私鉄のみ",
};

const VIEW_LABEL: Record<ViewMode, string> = {
  tilt: "チルト",
  top: "俯瞰",
};

export function StatusBar(props: {
  category: CategoryFilter;
  viewMode: ViewMode;
  visibleLineCount: number;
  totalLineCount: number;
  visibleStationCount: number;
}) {
  return (
    <div className="status-bar ui-card">
      <div className="item">
        <span>表示モード</span>
        <span className="value accent">{CATEGORY_LABEL[props.category]}</span>
      </div>
      <div className="sep" />
      <div className="item">
        <span>視点</span>
        <span className="value">{VIEW_LABEL[props.viewMode]}</span>
      </div>
      <div className="sep" />
      <div className="item">
        <span>路線</span>
        <span className="value">
          {props.visibleLineCount}
          <span style={{ fontSize: 10, color: "var(--text-dim)" }}>
            /{props.totalLineCount}
          </span>
        </span>
      </div>
      <div className="sep" />
      <div className="item">
        <span>駅</span>
        <span className="value">{props.visibleStationCount}</span>
      </div>
    </div>
  );
}
