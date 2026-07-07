import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import type { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import type {
  LabelMode,
  RailLine,
  StationSelection,
  ViewMode,
} from "../types/rail";
import { EXAGGERATION_DEFAULT, structureLabelOf } from "../utils/height";
import { createEnvironment, type Environment } from "./environment";
import { buildRailPath, type RailPathObject } from "./railLines";
import {
  buildLineStations,
  createLabelRegistry,
  stationHeightOf,
  updateLabels,
  type LabelRegistry,
  type LineStationsObject,
  type StationHitUserData,
} from "./stations";

/**
 * Three.js シーンの統括クラス。
 * React とは独立して動作し、React 側からはメソッド呼び出しで状態を渡す
 * (React の再レンダリングと WebGL の描画ループを切り離すため)。
 */

interface LineObjects {
  line: RailLine;
  /** 表示/非表示をまとめて切り替える親グループ */
  group: THREE.Group;
  path: RailPathObject;
  stations: LineStationsObject;
}

export interface RailSceneCallbacks {
  /** 駅クリック時(null は空クリック=ポップアップを閉じる) */
  onStationClick(selection: StationSelection | null): void;
}

export class RailScene {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private labelRenderer: CSS2DRenderer;
  private composer: EffectComposer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private environment: Environment;
  private lineObjects: LineObjects[] = [];
  private labelRegistry: LabelRegistry;
  private lineMaterials: LineMaterial[] = [];
  private resizeObserver: ResizeObserver;
  private rafId = 0;
  private frame = 0;
  private disposed = false;

  // 表示状態
  private visibleLineIds: Set<string>;
  private labelMode: LabelMode = "major";
  private exaggeration = EXAGGERATION_DEFAULT;

  // 視点アニメーション(俯瞰⇔チルト・北向きリセット)
  private viewAnim: {
    fromPhi: number;
    toPhi: number;
    fromTheta: number;
    toTheta: number;
    start: number;
  } | null = null;

  // 方位コンパス(画面上の北方向を指す DOM 要素)
  private compassEl: HTMLElement | null = null;

  // クリック/ホバー判定
  private raycaster = new THREE.Raycaster();
  private pointerDown = { x: 0, y: 0, button: -1 };
  private callbacks: RailSceneCallbacks;

  constructor(
    container: HTMLElement,
    private lines: RailLine[],
    callbacks: RailSceneCallbacks
  ) {
    this.container = container;
    this.callbacks = callbacks;
    this.visibleLineIds = new Set(lines.map((l) => l.lineId));

    const w = container.clientWidth || 800;
    const h = container.clientHeight || 600;

    // --- レンダラー ---
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    container.appendChild(this.renderer.domElement);

    // 駅名ラベル用の DOM レンダラー(ブルームの影響を受けず文字が滲まない)
    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.setSize(w, h);
    this.labelRenderer.domElement.className = "label-layer";
    container.appendChild(this.labelRenderer.domElement);

    // --- シーン・カメラ ---
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x030610);
    this.scene.fog = new THREE.FogExp2(0x030610, 0.0055);

    this.camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 600);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    // パンは画面基準ではなく地面(XZ平面)に沿わせ、注視点が地表から浮き沈みしないようにする
    this.controls.screenSpacePanning = false;
    this.controls.minDistance = 4;
    this.controls.maxDistance = 150;
    this.controls.minPolarAngle = 0.05;
    this.controls.maxPolarAngle = 1.5;
    this.controls.target.set(3, 0, -7); // 都心をやや画面奥・右寄りに置く
    this.setCameraSpherical(28, 1.02, -0.1);
    this.controls.update();

    // Shift+左ドラッグで視点移動(パン)
    window.addEventListener("keydown", this.onKeyChange);
    window.addEventListener("keyup", this.onKeyChange);

    // --- 環境(地面・グリッド) ---
    this.environment = createEnvironment();
    this.scene.add(this.environment.group);

    // --- 路線・駅 ---
    this.labelRegistry = createLabelRegistry();
    const labelsGroup = new THREE.Group();
    this.scene.add(labelsGroup);

    for (const line of lines) {
      const group = new THREE.Group();
      const path = buildRailPath(line, this.exaggeration);
      const stations = buildLineStations(
        line,
        this.exaggeration,
        this.labelRegistry,
        labelsGroup
      );
      group.add(path.group);
      group.add(stations.group);
      this.scene.add(group);
      this.lineObjects.push({ line, group, path, stations });
      this.lineMaterials.push(...path.materials);
    }

    // --- ポストプロセス(ブルームで路線を発光させる) ---
    const rt = new THREE.WebGLRenderTarget(w, h, {
      samples: 4, // MSAA(ポストプロセス使用時のジャギー防止)
      type: THREE.HalfFloatType,
    });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(
      new UnrealBloomPass(new THREE.Vector2(w, h), 0.36, 0.4, 0.5)
    );
    this.composer.addPass(new OutputPass());

    this.applyResolution(w, h);

    // --- イベント ---
    this.renderer.domElement.addEventListener("pointerdown", this.onPointerDown);
    this.renderer.domElement.addEventListener("pointerup", this.onPointerUp);
    this.renderer.domElement.addEventListener("pointermove", this.onPointerMove);

    this.resizeObserver = new ResizeObserver(() => this.onResize());
    this.resizeObserver.observe(container);

    this.refreshLabels();
    this.tick();

    // 開発時のみ: ブラウザコンソールからの動作確認用
    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__railScene = this;
    }
  }

  // ------------------------------------------------------------ 公開 API

  setLineVisibility(visibleIds: ReadonlySet<string>): void {
    this.visibleLineIds = new Set(visibleIds);
    for (const obj of this.lineObjects) {
      obj.group.visible = this.visibleLineIds.has(obj.line.lineId);
    }
    this.refreshLabels();
  }

  setLabelMode(mode: LabelMode): void {
    this.labelMode = mode;
    this.refreshLabels();
  }

  setExaggeration(exaggeration: number): void {
    this.exaggeration = exaggeration;
    for (const obj of this.lineObjects) {
      obj.path.setExaggeration(exaggeration);
      obj.stations.setExaggeration(exaggeration);
    }
    this.refreshLabels();
  }

  setMapOpacity(opacity01: number): void {
    this.environment.setMapOpacity(opacity01);
  }

  /** 俯瞰(真上)⇔チルトをアニメーションで切り替える */
  setViewMode(mode: ViewMode): void {
    const sph = this.currentSpherical();
    this.viewAnim = {
      fromPhi: sph.phi,
      toPhi: mode === "top" ? 0.1 : 1.02,
      fromTheta: sph.theta,
      toTheta: sph.theta,
      start: performance.now(),
    };
  }

  /** 北が画面上になるようカメラをアニメーションで戻す */
  resetNorth(): void {
    const sph = this.currentSpherical();
    // 最短方向で 0 へ回す(±πをまたぐ場合の逆回転を防ぐ)
    let from = sph.theta;
    if (from > Math.PI) from -= Math.PI * 2;
    if (from < -Math.PI) from += Math.PI * 2;
    this.viewAnim = {
      fromPhi: sph.phi,
      toPhi: sph.phi,
      fromTheta: from,
      toTheta: 0,
      start: performance.now(),
    };
  }

  /** コンパス表示用の DOM 要素を登録する(針の回転を毎フレーム反映) */
  bindCompass(el: HTMLElement | null): void {
    this.compassEl = el;
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.rafId);
    this.resizeObserver.disconnect();
    window.removeEventListener("keydown", this.onKeyChange);
    window.removeEventListener("keyup", this.onKeyChange);
    this.renderer.domElement.removeEventListener("pointerdown", this.onPointerDown);
    this.renderer.domElement.removeEventListener("pointerup", this.onPointerUp);
    this.renderer.domElement.removeEventListener("pointermove", this.onPointerMove);
    this.controls.dispose();
    for (const obj of this.lineObjects) {
      obj.path.dispose();
      obj.stations.dispose();
    }
    this.composer.dispose();
    this.renderer.dispose();
    this.container.innerHTML = "";
  }

  // ------------------------------------------------------------ 内部処理

  private setCameraSpherical(radius: number, phi: number, theta: number): void {
    const offset = new THREE.Vector3().setFromSphericalCoords(radius, phi, theta);
    this.camera.position.copy(this.controls.target).add(offset);
    this.camera.lookAt(this.controls.target);
  }

  /** 現在のカメラ位置(ターゲット基準)を球面座標で返す */
  private currentSpherical(): THREE.Spherical {
    const offset = this.camera.position.clone().sub(this.controls.target);
    return new THREE.Spherical().setFromVector3(offset);
  }

  /**
   * コンパス針の更新。
   * ワールドの北(-Z)がスクリーン上でどの向きに見えるかを投影で求めるので、
   * チルト角やカメラ実装の座標規約に依存しない。
   */
  private updateCompass(): void {
    if (!this.compassEl) return;
    const center = this.controls.target.clone().project(this.camera);
    const north = this.controls.target
      .clone()
      .add(new THREE.Vector3(0, 0, -1))
      .project(this.camera);
    // スクリーン座標系(x右+, y下+)での北方向ベクトル
    const dx = north.x - center.x;
    const dy = -(north.y - center.y);
    const angleRad = Math.atan2(dx, -dy); // 真上=0、時計回り+
    this.compassEl.style.transform = `rotate(${angleRad}rad)`;
  }

  /** 描画ループ */
  private tick = (): void => {
    if (this.disposed) return;
    this.rafId = requestAnimationFrame(this.tick);
    this.frame++;

    // 視点切替アニメーション(0.7秒 / ease-in-out)
    if (this.viewAnim) {
      const a = this.viewAnim;
      const t = Math.min((performance.now() - a.start) / 700, 1);
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const sph = this.currentSpherical();
      sph.phi = a.fromPhi + (a.toPhi - a.fromPhi) * e;
      sph.theta = a.fromTheta + (a.toTheta - a.fromTheta) * e;
      sph.makeSafe();
      this.camera.position
        .copy(this.controls.target)
        .add(new THREE.Vector3().setFromSpherical(sph));
      if (t >= 1) this.viewAnim = null;
    }

    this.controls.update();
    if (this.frame % 2 === 0) this.updateCompass();

    // ラベルの表示判定は毎フレームやる必要がないため間引く
    if (this.frame % 5 === 0) this.refreshLabels();

    this.composer.render();
    this.labelRenderer.render(this.scene, this.camera);
  };

  private refreshLabels(): void {
    updateLabels(
      this.labelRegistry,
      this.visibleLineIds,
      this.labelMode,
      this.exaggeration,
      this.camera,
      this.camera.position.distanceTo(this.controls.target),
      this.container.clientWidth,
      this.container.clientHeight
    );
  }

  private onResize(): void {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.labelRenderer.setSize(w, h);
    this.applyResolution(w, h);
  }

  /** LineMaterial は画面解像度を知らないと線幅(px)を計算できない */
  private applyResolution(w: number, h: number): void {
    for (const mat of this.lineMaterials) {
      mat.resolution.set(w, h);
    }
  }

  private onKeyChange = (e: KeyboardEvent): void => {
    // Shift 押下中は左ドラッグをパンに切り替える
    this.controls.mouseButtons.LEFT = e.shiftKey
      ? THREE.MOUSE.PAN
      : THREE.MOUSE.ROTATE;
  };

  private onPointerDown = (e: PointerEvent): void => {
    this.pointerDown = { x: e.clientX, y: e.clientY, button: e.button };
  };

  private onPointerUp = (e: PointerEvent): void => {
    // ドラッグ(回転・パン)とクリックを移動量で区別する
    const moved =
      Math.abs(e.clientX - this.pointerDown.x) +
      Math.abs(e.clientY - this.pointerDown.y);
    if (this.pointerDown.button !== 0 || moved > 6) return;

    const hit = this.raycastStations(e);
    if (!hit) {
      this.callbacks.onStationClick(null);
      return;
    }
    this.callbacks.onStationClick(
      this.buildSelection(hit.stationName, e.clientX, e.clientY)
    );
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (this.frame % 4 !== 0) return; // ホバー判定は間引く
    const hit = this.raycastStations(e);
    this.renderer.domElement.style.cursor = hit ? "pointer" : "grab";
  };

  /** ポインタ位置で表示中路線の駅ヒット球(Instanced)をレイキャストする */
  private raycastStations(
    e: PointerEvent
  ): { stationName: string; lineId: string } | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    this.raycaster.setFromCamera(ndc, this.camera);

    const candidates: THREE.Object3D[] = [];
    for (const obj of this.lineObjects) {
      if (!this.visibleLineIds.has(obj.line.lineId)) continue;
      candidates.push(obj.stations.hitMesh);
    }
    const hits = this.raycaster.intersectObjects(candidates, false);
    for (const hit of hits) {
      if (hit.instanceId === undefined) continue;
      const data = hit.object.userData as StationHitUserData;
      const station = data.stations[hit.instanceId];
      if (station) return { stationName: station.stationName, lineId: data.lineId };
    }
    return null;
  }

  /** 同名駅を通る表示中の全路線をまとめてポップアップ情報にする */
  private buildSelection(
    stationName: string,
    screenX: number,
    screenY: number
  ): StationSelection {
    const entries: StationSelection["entries"] = [];
    for (const line of this.lines) {
      if (!this.visibleLineIds.has(line.lineId)) continue;
      const idx = line.stations.findIndex((s) => s.stationName === stationName);
      if (idx < 0) continue;
      const height = stationHeightOf(line, idx);
      entries.push({
        lineId: line.lineId,
        lineName: line.lineName,
        operatorName: line.operatorName,
        lineColor: line.lineColor,
        height,
        structureLabel: structureLabelOf(height),
      });
    }
    return { stationName, screenX, screenY, entries };
  }
}
