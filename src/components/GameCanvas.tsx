import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type {
  EquippedLoadout,
  GameMode,
  GameOverPayload,
  GraphicsSettings,
  MapConfig,
  ObstacleKind,
  PlayMode,
} from '../types/game';
import { buildCharacterRig, type CharacterRig } from '../three/characterBuilder';
import { buildWorld, LANE_WIDTH, type WorldController } from '../three/worldBuilder';
import { soundEngine } from '../utils/audio';

interface GameCanvasProps {
  mode: GameMode;
  playMode: PlayMode;
  runKey: number;
  map: MapConfig;
  loadout: EquippedLoadout;
  settings: GraphicsSettings;
  onTimeUpdate: (timeMs: number) => void;
  onCoinStopTimer: (timeMs: number) => void;
  onCoinCountChange: (count: number) => void;
  onGameOver: (payload: GameOverPayload) => void;
}

const OBSTACLE_LABELS: Record<ObstacleKind, string> = {
  coin: 'Tocou em uma Moeda Proibida!',
  barrier_low: 'Colidiu com uma Barreira!',
  barrier_high: 'Colidiu com uma Barreira Alta!',
  bus: 'Colidiu com um Ônibus!',
  pillar: 'Colidiu com um Pilar!',
  pit: 'Caiu em um Buraco!',
  laser_low: 'Atingido por um Laser Baixo!',
  laser_high: 'Atingido por um Laser Alto!',
};

function detectSoftwareGl(): boolean {
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  mode,
  playMode,
  runKey,
  map,
  loadout,
  settings,
  onTimeUpdate,
  onCoinStopTimer,
  onCoinCountChange,
  onGameOver,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [webglError, setWebglError] = useState<string | null>(null);

  // Latest props stored in refs so WebGLRenderer is created once and never torn down on UI updates
  const modeRef = useRef<GameMode>(mode);
  const playModeRef = useRef<PlayMode>(playMode);
  const mapRef = useRef<MapConfig>(map);
  const settingsRef = useRef<GraphicsSettings>(settings);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  const onCoinStopTimerRef = useRef(onCoinStopTimer);
  const onCoinCountChangeRef = useRef(onCoinCountChange);
  const onGameOverRef = useRef(onGameOver);

  modeRef.current = mode;
  playModeRef.current = playMode;
  mapRef.current = map;
  settingsRef.current = settings;
  onTimeUpdateRef.current = onTimeUpdate;
  onCoinStopTimerRef.current = onCoinStopTimer;
  onCoinCountChangeRef.current = onCoinCountChange;
  onGameOverRef.current = onGameOver;

  // Scene & rebuild hooks
  const sceneObjectsRef = useRef<{
    scene: THREE.Scene;
    renderer: THREE.WebGLRenderer;
    camera: THREE.PerspectiveCamera;
    keyLight: THREE.DirectionalLight;
    hemiLight: THREE.HemisphereLight;
    charRig: CharacterRig | null;
    world: WorldController | null;
    maxAnisotropy: number;
    isSoftwareGl: boolean;
  } | null>(null);

  // Runner physics state
  const runnerStateRef = useRef({
    targetLane: 0, // -1, 0, 1
    currentX: 0,
    prevX: 0,
    y: 0,
    prevY: 0,
    vy: 0,
    isJumping: false,
    isSliding: false,
    slideTimer: 0,
    elapsedSec: 0,
    lastUiEmit: 0,
    timerStopped: false,
    stoppedTimeMs: null as number | null,
    coinsCollected: 0,
    ended: false,
  });

  // Reset run state whenever a new run starts
  useEffect(() => {
    if (mode === 'playing') {
      const r = runnerStateRef.current;
      r.targetLane = 0;
      r.currentX = 0;
      r.prevX = 0;
      r.y = 0;
      r.prevY = 0;
      r.vy = 0;
      r.isJumping = false;
      r.isSliding = false;
      r.slideTimer = 0;
      r.elapsedSec = 0;
      r.lastUiEmit = 0;
      r.timerStopped = false;
      r.stoppedTimeMs = null;
      r.coinsCollected = 0;
      r.ended = false;
      onTimeUpdateRef.current(0);
      onCoinCountChangeRef.current(0);
      sceneObjectsRef.current?.world?.resetObstacles();
    } else if (mode === 'lobby') {
      const r = runnerStateRef.current;
      r.targetLane = 0;
      r.currentX = 0;
      r.prevX = 0;
      r.y = 0;
      r.prevY = 0;
      r.vy = 0;
      r.isJumping = false;
      r.isSliding = false;
      r.timerStopped = false;
      r.stoppedTimeMs = null;
      r.coinsCollected = 0;
      r.ended = false;
      sceneObjectsRef.current?.world?.resetObstacles();
    }
  }, [mode, runKey]);

  // Helper actions for controls
  const triggerMoveLeft = () => {
    if (modeRef.current !== 'playing' || runnerStateRef.current.ended) return;
    if (runnerStateRef.current.targetLane > -1) {
      runnerStateRef.current.targetLane -= 1;
      soundEngine.playLaneShift();
    }
  };

  const triggerMoveRight = () => {
    if (modeRef.current !== 'playing' || runnerStateRef.current.ended) return;
    if (runnerStateRef.current.targetLane < 1) {
      runnerStateRef.current.targetLane += 1;
      soundEngine.playLaneShift();
    }
  };

  const triggerJump = () => {
    if (modeRef.current !== 'playing' || runnerStateRef.current.ended) return;
    const r = runnerStateRef.current;
    if (!r.isJumping) {
      r.isJumping = true;
      r.isSliding = false;
      r.slideTimer = 0;
      r.vy = 14.6;
      soundEngine.playJump();
    }
  };

  const triggerSlide = () => {
    if (modeRef.current !== 'playing' || runnerStateRef.current.ended) return;
    const r = runnerStateRef.current;
    if (r.isJumping) {
      // Fast-fall slam into slide
      r.vy = -30;
    }
    r.isSliding = true;
    r.slideTimer = 0.72;
    soundEngine.playSlide();
  };

  // Keyboard & Mobile Swipe Listeners (with non-passive touch handling for instant mobile response)
  useEffect(() => {
    const container = containerRef.current;

    const onKeyDown = (e: KeyboardEvent) => {
      if (modeRef.current !== 'playing') return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        triggerMoveLeft();
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        triggerMoveRight();
      } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ') {
        e.preventDefault();
        triggerJump();
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        triggerSlide();
      }
    };

    let activeTouchId: number | null = null;
    let startX = 0;
    let startY = 0;
    let lastSwipeTime = 0;
    let handledThisStroke = false;
    const SWIPE_THRESHOLD = 18;

    const handleSwipeDelta = (dx: number, dy: number): boolean => {
      if (Math.abs(dx) < SWIPE_THRESHOLD && Math.abs(dy) < SWIPE_THRESHOLD) {
        return false;
      }
      if (Math.abs(dx) >= Math.abs(dy)) {
        if (dx < 0) triggerMoveLeft();
        else triggerMoveRight();
      } else {
        if (dy < 0) triggerJump();
        else triggerSlide();
      }
      return true;
    };

    const onTouchStart = (e: TouchEvent) => {
      if (modeRef.current !== 'playing') return;
      if (e.touches.length > 0 && activeTouchId === null) {
        const t = e.touches[0];
        activeTouchId = t.identifier;
        startX = t.clientX;
        startY = t.clientY;
        handledThisStroke = false;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (modeRef.current !== 'playing') return;
      // Prevent browser scrolling, pull-to-refresh, or back-swipe hijacking
      if (e.cancelable) e.preventDefault();
      if (activeTouchId === null) return;

      let touch: Touch | null = null;
      for (let i = 0; i < e.touches.length; i++) {
        if (e.touches[i].identifier === activeTouchId) {
          touch = e.touches[i];
          break;
        }
      }
      if (!touch) return;

      const now = performance.now();
      if (handledThisStroke && now - lastSwipeTime < 150) return;

      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      if (handleSwipeDelta(dx, dy)) {
        handledThisStroke = true;
        lastSwipeTime = now;
        // Reset origin so continuous rapid swipes without lifting also work
        startX = touch.clientX;
        startY = touch.clientY;
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (modeRef.current !== 'playing' || activeTouchId === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === activeTouchId) {
          if (!handledThisStroke) {
            const dx = t.clientX - startX;
            const dy = t.clientY - startY;
            const swiped = handleSwipeDelta(dx, dy);
            if (!swiped && Math.abs(dx) < 12 && Math.abs(dy) < 12) {
              const vw = window.innerWidth || 1;
              if (t.clientX < vw * 0.34) triggerMoveLeft();
              else if (t.clientX > vw * 0.66) triggerMoveRight();
            }
          }
          activeTouchId = null;
          handledThisStroke = false;
          break;
        }
      }
    };

    const onTouchCancel = () => {
      activeTouchId = null;
      handledThisStroke = false;
    };

    // Pointer fallback for touchscreens/emulators that route gestures through PointerEvents
    let pointerActiveId: number | null = null;
    let pStartX = 0;
    let pStartY = 0;
    let pHandled = false;

    const onPointerDown = (e: PointerEvent) => {
      if (modeRef.current !== 'playing' || e.pointerType === 'touch') return;
      if (e.pointerType === 'pen' || e.buttons === 1) {
        pointerActiveId = e.pointerId;
        pStartX = e.clientX;
        pStartY = e.clientY;
        pHandled = false;
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (modeRef.current !== 'playing' || e.pointerType === 'touch') return;
      if (pointerActiveId !== e.pointerId || pHandled) return;
      if (handleSwipeDelta(e.clientX - pStartX, e.clientY - pStartY)) {
        pHandled = true;
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (pointerActiveId === e.pointerId) {
        if (!pHandled && modeRef.current === 'playing' && e.pointerType !== 'touch') {
          handleSwipeDelta(e.clientX - pStartX, e.clientY - pStartY);
        }
        pointerActiveId = null;
        pHandled = false;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    const target: EventTarget = container ?? window;
    target.addEventListener('touchstart', onTouchStart as EventListener, { passive: false });
    target.addEventListener('touchmove', onTouchMove as EventListener, { passive: false });
    target.addEventListener('touchend', onTouchEnd as EventListener, { passive: false });
    target.addEventListener('touchcancel', onTouchCancel as EventListener, { passive: true });
    target.addEventListener('pointerdown', onPointerDown as EventListener);
    target.addEventListener('pointermove', onPointerMove as EventListener);
    target.addEventListener('pointerup', onPointerUp as EventListener);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      target.removeEventListener('touchstart', onTouchStart as EventListener);
      target.removeEventListener('touchmove', onTouchMove as EventListener);
      target.removeEventListener('touchend', onTouchEnd as EventListener);
      target.removeEventListener('touchcancel', onTouchCancel as EventListener);
      target.removeEventListener('pointerdown', onPointerDown as EventListener);
      target.removeEventListener('pointermove', onPointerMove as EventListener);
      target.removeEventListener('pointerup', onPointerUp as EventListener);
    };
  }, []);

  // Initialize Three.js WebGLRenderer once
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareGl();
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglError('WebGL indisponível neste dispositivo.');
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);

    const maxAnisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy() || 1);

    const canvas = renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    container.appendChild(canvas);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setWebglError('Contexto gráfico WebGL pausado. Recarregando...');
    };
    const handleContextRestored = () => {
      setWebglError(null);
    };
    canvas.addEventListener('webglcontextlost', handleContextLost);
    canvas.addEventListener('webglcontextrestored', handleContextRestored);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      60,
      (container.clientWidth || window.innerWidth) / (container.clientHeight || window.innerHeight),
      0.1,
      320
    );

    // Studio environment reflection for metallic/chrome suits
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    roomEnv.dispose();
    pmremGenerator.dispose();

    // 3-point lighting rig
    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x090d16, 0.75);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xe0f2fe, 1.55);
    keyLight.position.set(10, 18, 12);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 55;
    keyLight.shadow.camera.left = -14;
    keyLight.shadow.camera.right = 14;
    keyLight.shadow.camera.top = 18;
    keyLight.shadow.camera.bottom = -14;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 0.6);
    rimLight.position.set(-8, 10, -14);
    scene.add(rimLight);

    sceneObjectsRef.current = {
      scene,
      renderer,
      camera,
      keyLight,
      hemiLight,
      charRig: null,
      world: null,
      maxAnisotropy,
      isSoftwareGl,
    };

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    // Main loop with software WebGL pacing
    let frameId = 0;
    let disposed = false;
    let lastNow = performance.now();

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (gl && typeof gl.fenceSync === 'function') {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          if (disposed) return;
          const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (state === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl.deleteSync(sync);
            frameId = window.setTimeout(cb, 80);
          }
        };
        frameId = window.setTimeout(poll, 5);
      } else {
        frameId = window.setTimeout(cb, 80);
      }
    }

    function tick() {
      if (disposed) return;
      const now = performance.now();
      const dt = Math.min(0.05, Math.max(0.001, (now - lastNow) / 1000));
      lastNow = now;
      const totalSec = now / 1000;

      const ctx = sceneObjectsRef.current;
      if (ctx && ctx.charRig && ctx.world) {
        const currentMode = modeRef.current;
        const currentMap = mapRef.current;
        const r = runnerStateRef.current;

        if (currentMode === 'lobby') {
          // Stationary hero standing in the foreground while track & camera create dynamic motion
          ctx.charRig.root.position.set(0, 0, 0.7);
          ctx.charRig.root.rotation.y = Math.PI + Math.sin(totalSec * 0.55) * 0.52;
          ctx.charRig.contactShadow.position.y = 0.02;
          ctx.charRig.contactShadow.scale.setScalar(1);
          ctx.charRig.update(totalSec, dt, 10, 0, false, false, true);

          ctx.world.update(dt, totalSec, 18, false);

          const camTargetX = Math.sin(totalSec * 0.55) * 1.4;
          const camTargetY = 2.0 + Math.cos(totalSec * 0.85) * 0.18;
          const camTargetZ = 4.65 + Math.sin(totalSec * 0.4) * 0.35;
          camera.position.x = THREE.MathUtils.damp(camera.position.x, camTargetX, 4, dt);
          camera.position.y = THREE.MathUtils.damp(camera.position.y, camTargetY, 4, dt);
          camera.position.z = THREE.MathUtils.damp(camera.position.z, camTargetZ, 4, dt);
          camera.rotation.z = THREE.MathUtils.damp(camera.rotation.z, Math.sin(totalSec * 0.55) * 0.035, 4, dt);
          camera.fov = THREE.MathUtils.damp(camera.fov, 54, 5, dt);
          camera.updateProjectionMatrix();
          camera.lookAt(0, 1.18, 0.5);
        } else if (currentMode === 'playing') {
          if (!r.ended) {
            r.elapsedSec += dt;

            // Speed ramps smoothly with survival time
            const speed = Math.min(
              currentMap.maxSpeed,
              currentMap.baseSpeed + r.elapsedSec * 0.34
            );

            // Lane movement with crisp exponential damping so burlas between coin gaps respond fast
            const targetX = r.targetLane * LANE_WIDTH;
            r.prevX = r.currentX;
            r.currentX = THREE.MathUtils.damp(r.currentX, targetX, 24, dt);
            const lateralVel = (r.currentX - r.prevX) / dt;

            // Jump & gravity
            r.prevY = r.y;
            if (r.isJumping) {
              r.vy -= 36 * dt;
              r.y += r.vy * dt;
              if (r.y <= 0) {
                r.y = 0;
                r.vy = 0;
                r.isJumping = false;
              }
            }

            // Slide timer
            if (r.isSliding) {
              r.slideTimer -= dt;
              if (r.slideTimer <= 0) {
                r.isSliding = false;
                r.slideTimer = 0;
              }
            }

            ctx.charRig.root.rotation.y = 0;
            ctx.charRig.root.position.set(r.currentX, r.y, 0);
            ctx.charRig.contactShadow.position.y = 0.02 - r.y;
            ctx.charRig.contactShadow.scale.setScalar(Math.max(0.45, 1 - r.y * 0.18));

            ctx.charRig.update(
              totalSec,
              dt,
              speed,
              lateralVel,
              r.isJumping,
              r.isSliding,
              false
            );

            ctx.world.update(dt, r.elapsedSec, speed, true);

            // Chase camera with subtle FOV speed boost & lateral bank
            const targetCamX = r.currentX * 0.68;
            const targetCamY = 4.1 + r.y * 0.45;
            const targetCamZ = 6.8;
            const targetFov = 60 + Math.min(14, (speed - currentMap.baseSpeed) * 0.45);

            camera.position.x = THREE.MathUtils.damp(camera.position.x, targetCamX, 10, dt);
            camera.position.y = THREE.MathUtils.damp(camera.position.y, targetCamY, 10, dt);
            camera.position.z = THREE.MathUtils.damp(camera.position.z, targetCamZ, 10, dt);
            camera.rotation.z = THREE.MathUtils.damp(camera.rotation.z, -lateralVel * 0.004, 8, dt);
            camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 6, dt);
            camera.updateProjectionMatrix();
            camera.lookAt(r.currentX * 0.55, 1.35 + r.y * 0.35, -8);

            // Emit stopwatch time ONLY if not stopped by a coin
            if (!r.timerStopped && r.elapsedSec - r.lastUiEmit >= 0.03) {
              r.lastUiEmit = r.elapsedSec;
              onTimeUpdateRef.current(Math.floor(r.elapsedSec * 1000));
            }

            // Continuous Swept Z/X/Y Collision Check (prevents tunneling AND prevents false magnetic coin grabs during lane switches)
            const playerHeight = r.isSliding ? 0.92 : 1.85;
            const obsList = ctx.world.obstacles;
            for (let i = obsList.length - 1; i >= 0; i--) {
              const obs = obsList[i];
              const isCoin = obs.kind === 'coin';
              const pHalfW = isCoin ? 0.26 : 0.34;
              const pHalfD = isCoin ? 0.20 : 0.28;
              const zLimit = obs.halfDepth + pHalfD;
              const xLimit = obs.halfWidth + pHalfW;

              // Find time sub-interval t in [0, 1] where coin Z overlaps player Z
              const dz = obs.z - obs.prevZ;
              let t0 = 0;
              let t1 = 1;
              if (Math.abs(dz) > 0.0001) {
                const tA = (-zLimit - obs.prevZ) / dz;
                const tB = (zLimit - obs.prevZ) / dz;
                t0 = Math.max(0, Math.min(tA, tB));
                t1 = Math.min(1, Math.max(tA, tB));
              } else if (Math.abs(obs.z) > zLimit) {
                continue;
              }
              if (t0 > t1) continue;

              // Narrow t to sub-interval where player X overlaps obstacle X
              const dx = r.currentX - r.prevX;
              if (Math.abs(dx) > 0.0001) {
                const txA = (obs.x - xLimit - r.prevX) / dx;
                const txB = (obs.x + xLimit - r.prevX) / dx;
                t0 = Math.max(t0, Math.min(txA, txB));
                t1 = Math.min(t1, Math.max(txA, txB));
                if (t0 > t1) continue;
              } else if (Math.abs(obs.x - r.currentX) > xLimit) {
                continue;
              }

              // Check Y overlap over the overlapping [t0, t1] window
              const yA = r.prevY + (r.y - r.prevY) * t0;
              const yB = r.prevY + (r.y - r.prevY) * t1;
              const spanMinY = Math.min(yA, yB);
              const spanMaxY = Math.max(yA, yB) + playerHeight;

              const hitY =
                obs.kind === 'pit'
                  ? spanMinY < 0.28
                  : spanMaxY > obs.minY && spanMinY < obs.maxY;

              if (!hitY) continue;

              if (isCoin) {
                // Touching a coin increments coin count & stops the stopwatch on the 1st coin, while player keeps running!
                ctx.world.consumeObstacle(obs.id);
                r.coinsCollected += 1;
                onCoinCountChangeRef.current(r.coinsCollected);
                if (!r.timerStopped) {
                  r.timerStopped = true;
                  const exactMs = Math.max(10, Math.round(r.elapsedSec * 1000));
                  r.stoppedTimeMs = exactMs;
                  onTimeUpdateRef.current(exactMs);
                  onCoinStopTimerRef.current(exactMs);
                }
                soundEngine.playGameOver(true);
              } else {
                triggerTrapHit(obs.kind, r.elapsedSec);
                break;
              }
            }
          }
        } else if (currentMode === 'gameover') {
          // Subtle idle particles while frozen at impact point
          ctx.charRig.update(totalSec, dt, 0, 0, r.isJumping, r.isSliding, true);
        }
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    function triggerTrapHit(kind: ObstacleKind, finalElapsedSec: number) {
      const r = runnerStateRef.current;
      if (r.ended) return;
      r.ended = true;
      const exactMs =
        r.timerStopped && r.stoppedTimeMs !== null
          ? r.stoppedTimeMs
          : Math.max(10, Math.round(finalElapsedSec * 1000));
      onTimeUpdateRef.current(exactMs);
      soundEngine.playGameOver(false);
      onGameOverRef.current({
        timeMs: exactMs,
        coinsCollected: r.coinsCollected,
        reason: OBSTACLE_LABELS[kind],
        hitType: kind,
        mapId: mapRef.current.id,
        mapName: mapRef.current.name,
        playMode: playModeRef.current,
      });
    }

    if (isSoftwareGl) {
      afterDraw(tick);
    } else {
      frameId = requestAnimationFrame(tick);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', onResize);
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);

      sceneObjectsRef.current?.charRig?.dispose();
      sceneObjectsRef.current?.world?.dispose();
      envTarget.dispose();
      renderer.dispose();
      if (canvas.parentElement === container) {
        container.removeChild(canvas);
      }
      sceneObjectsRef.current = null;
    };
  }, []);

  // Rebuild world, lighting, sky/fog, and quality settings whenever map or graphics settings change
  useEffect(() => {
    const ctx = sceneObjectsRef.current;
    if (!ctx) return;

    const { scene, renderer, keyLight, hemiLight, maxAnisotropy, isSoftwareGl } = ctx;

    // Apply quality settings
    const dpr = window.devicePixelRatio || 1;
    if (isSoftwareGl) {
      renderer.setPixelRatio(1);
      renderer.shadowMap.enabled = false;
    } else if (settings.quality === 'baixa') {
      renderer.setPixelRatio(Math.min(dpr, 1));
      renderer.shadowMap.enabled = false;
    } else if (settings.quality === 'media') {
      renderer.setPixelRatio(Math.min(dpr, 1.5));
      renderer.shadowMap.enabled = true;
      keyLight.shadow.mapSize.set(1024, 1024);
    } else {
      renderer.setPixelRatio(Math.min(dpr, 2));
      renderer.shadowMap.enabled = true;
      keyLight.shadow.mapSize.set(2048, 2048);
    }

    // Apply sky, fog, and lighting for map OR "Sem Texturas" grayscale mode
    if (settings.noTextures) {
      scene.background = new THREE.Color(0x09090b);
      scene.fog = new THREE.FogExp2(0x09090b, settings.quality === 'baixa' ? 0.018 : 0.014);
      keyLight.color.setHex(0xffffff);
      hemiLight.color.setHex(0xe4e4e7);
      hemiLight.groundColor.setHex(0x09090b);
    } else {
      scene.background = new THREE.Color(map.skyHex);
      const fogScale = settings.quality === 'baixa' ? 1.35 : 1.0;
      scene.fog = new THREE.FogExp2(map.fogHex, map.fogDensity * fogScale);
      keyLight.color.setHex(map.keyLightHex);
      hemiLight.color.setHex(map.hemiSkyHex);
      hemiLight.groundColor.setHex(map.hemiGroundHex);
    }

    if (ctx.world) {
      scene.remove(ctx.world.group);
      ctx.world.dispose();
    }
    const world = buildWorld(
      map,
      settings.noTextures,
      settings.quality,
      maxAnisotropy,
      playModeRef.current === 'training'
    );
    scene.add(world.group);
    ctx.world = world;
  }, [map, settings.quality, settings.noTextures]);

  // Update training vs normal obstacle mode immediately without rebuilding scenery
  useEffect(() => {
    sceneObjectsRef.current?.world?.setTrainingMode(playMode === 'training');
  }, [playMode]);

  // Rebuild character rig whenever loadout or noTextures changes
  useEffect(() => {
    const ctx = sceneObjectsRef.current;
    if (!ctx) return;

    if (ctx.charRig) {
      ctx.scene.remove(ctx.charRig.root);
      ctx.charRig.dispose();
    }
    const rig = buildCharacterRig(loadout, settings.noTextures, ctx.maxAnisotropy);
    ctx.scene.add(rig.root);
    ctx.charRig = rig;
  }, [loadout, settings.noTextures]);

  if (webglError) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#080B10] text-slate-200 p-6 text-center">
        <p className="font-display text-xl font-bold text-cyan-400 mb-2">Cyber Surfers</p>
        <p className="text-sm text-slate-400 max-w-md">{webglError}</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 w-full h-full overflow-hidden ${
        mode === 'playing' ? 'touch-none' : ''
      }`}
    />
  );
};
