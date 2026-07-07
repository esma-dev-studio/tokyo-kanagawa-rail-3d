import type { StationSelection } from "../types/rail";

/**
 * 駅クリック時のポップアップ。
 * 同名駅を通る表示中の路線を1枚にまとめて表示する。
 */

const POPUP_WIDTH = 280;

function badgeClass(structureLabel: string): string {
  if (structureLabel === "地下") return "badge underground";
  if (structureLabel === "高架") return "badge elevated";
  return "badge ground";
}

export function StationPopup(props: {
  selection: StationSelection;
  onClose(): void;
}) {
  const { selection } = props;

  // クリック位置の近くに出しつつ、画面外へはみ出さないよう補正
  const estHeight = 64 + selection.entries.length * 44;
  const left = Math.min(
    Math.max(selection.screenX + 14, 8),
    window.innerWidth - POPUP_WIDTH - 8
  );
  const top = Math.min(
    Math.max(selection.screenY - 20, 66),
    window.innerHeight - estHeight - 12
  );

  return (
    <div className="station-popup ui-card" style={{ left, top }}>
      <div className="popup-head">
        <h2>{selection.stationName}</h2>
        <button
          className="close-btn"
          onClick={props.onClose}
          aria-label="閉じる"
        >
          ✕
        </button>
      </div>
      {selection.entries.map((e) => (
        <div className="popup-entry" key={e.lineId}>
          <span className="bar" style={{ background: e.lineColor }} />
          <span className="lines">
            <span className="line-name">{e.lineName}</span>
            <div className="operator">{e.operatorName}</div>
          </span>
          <span className="depth">
            <span className={badgeClass(e.structureLabel)}>
              {e.structureLabel}
            </span>
            <span className="height-m">
              {e.height >= 0 ? "+" : "−"}
              {Math.abs(e.height)}m(概算)
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}
