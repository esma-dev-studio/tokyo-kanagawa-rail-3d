import { useEffect, useRef } from "react";
import type { RailScene } from "../scenes/RailScene";

/**
 * 右下の方位コンパス。
 * 針はカメラの回転に追従して常にワールドの北を指す。
 * クリックすると北が画面上になるようカメラを戻す。
 */
export function Compass(props: {
  sceneRef: React.MutableRefObject<RailScene | null>;
}) {
  const needleRef = useRef<HTMLDivElement>(null);

  // 針要素をシーンに登録(回転はシーン側が毎フレーム反映する)。
  // シーン生成はこのコンポーネントのマウントより後になるため、生成されるまでリトライする
  useEffect(() => {
    let raf = 0;
    const tryBind = () => {
      const scene = props.sceneRef.current;
      if (scene && needleRef.current) {
        scene.bindCompass(needleRef.current);
      } else {
        raf = requestAnimationFrame(tryBind);
      }
    };
    tryBind();
    return () => {
      cancelAnimationFrame(raf);
      props.sceneRef.current?.bindCompass(null);
    };
  }, [props.sceneRef]);

  return (
    <button
      className="compass ui-card"
      onClick={() => props.sceneRef.current?.resetNorth()}
      title="クリックで北を上に戻す"
      aria-label="コンパス(クリックで北を上に戻す)"
    >
      <div className="needle" ref={needleRef}>
        <svg viewBox="0 0 40 40" width="40" height="40">
          {/* 北向きの針(上半分がアクセント色) */}
          <polygon points="20,5 24.5,20 15.5,20" fill="#5b9dff" />
          <polygon points="20,35 24.5,20 15.5,20" fill="#54627e" />
          <circle cx="20" cy="20" r="2.2" fill="#e8eef9" />
          <text
            x="20"
            y="3.5"
            textAnchor="middle"
            fontSize="7"
            fontWeight="700"
            fill="#8fa1bd"
            letterSpacing="0.05em"
          >
            N
          </text>
        </svg>
      </div>
      <span className="compass-label">北</span>
    </button>
  );
}
