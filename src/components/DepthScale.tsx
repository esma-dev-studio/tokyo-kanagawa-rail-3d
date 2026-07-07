/** 右側の簡易深度・高度スケール */

const TICKS = [
  { label: "+20m", gl: false },
  { label: "+10m", gl: false },
  { label: "GL ±0", gl: true },
  { label: "−10m", gl: false },
  { label: "−20m", gl: false },
  { label: "−30m", gl: false },
  { label: "−40m", gl: false },
];

export function DepthScale() {
  return (
    <div className="depth-scale">
      <div className="scale-title">HEIGHT</div>
      {TICKS.map((t) => (
        <div key={t.label} className={"row" + (t.gl ? " gl" : "")}>
          <span>{t.label}</span>
          <span className="tick" />
        </div>
      ))}
      <div className="scale-note">概算値・強調倍率適用前</div>
    </div>
  );
}
