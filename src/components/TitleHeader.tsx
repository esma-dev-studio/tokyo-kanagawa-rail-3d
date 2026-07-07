/** 画面上部のタイトルヘッダー */
export function TitleHeader(props: {
  lineCount: number;
  maxHeight: number;
  minHeight: number;
}) {
  return (
    <header className="app-header">
      <div className="app-title">
        <div className="eyebrow">TOKYO × KANAGAWA</div>
        <h1>
          RAIL <span className="thin">NETWORK 3D</span>
        </h1>
        <div className="sub">
          東京・神奈川 鉄道路線 立体マップ — 全{props.lineCount}路線(サンプル)
        </div>
      </div>
      <div className="header-meta">
        <div>
          HEIGHT RANGE <span className="em">+{props.maxHeight}m</span> /{" "}
          <span className="em">−{Math.abs(props.minHeight)}m</span>
        </div>
        <div>高さ・深さは概算値(視認性優先)</div>
      </div>
    </header>
  );
}
