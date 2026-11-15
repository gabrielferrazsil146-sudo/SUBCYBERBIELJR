import * as THREE from 'three';
import type { MapConfig, ObstacleKind, QualityLevel } from '../types/game';
import {
  createBuildingWindowsTexture,
  createCoinFaceTexture,
  createContactShadowTexture,
  createHazardStripeTexture,
  createOverheadSignTexture,
  createPillarPanelTexture,
  createSkyDomeTexture,
  createTerrainTexture,
  createTrackTexture,
} from './textures';

export const LANE_WIDTH = 2.65;
export const LANE_POSITIONS = [-LANE_WIDTH, 0, LANE_WIDTH] as const;
export const SEGMENT_LENGTH = 36;
export const SEGMENT_COUNT = 6;

export interface ActiveObstacle {
  id: number;
  kind: ObstacleKind;
  mesh: THREE.Group;
  lane: number;
  x: number;
  z: number;
  prevZ: number;
  halfWidth: number;
  minY: number;
  maxY: number;
  halfDepth: number;
  spinTarget?: THREE.Object3D;
  pulseTargets?: THREE.Mesh[];
}

export interface WorldController {
  group: THREE.Group;
  obstacles: ActiveObstacle[];
  setTrainingMode: (enabled: boolean) => void;
  update: (dt: number, elapsed: number, speed: number, isPlaying: boolean) => void;
  consumeObstacle: (id: number) => void;
  resetObstacles: () => void;
  dispose: () => void;
}

export function buildWorld(
  map: MapConfig,
  noTextures: boolean,
  quality: QualityLevel,
  maxAnisotropy: number,
  initialTrainingMode = false
): WorldController {
  const disposables: Array<{ dispose: () => void }> = [];
  const track = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  const group = new THREE.Group();
  const segments: THREE.Group[] = [];
  const obstacles: ActiveObstacle[] = [];
  let nextObstacleId = 1;
  let spawnCursorZ = -48;
  let patternStep = 0;
  let patternsSince3LaneCoins = 0;
  let patternsSinceUnderWithCoins = 0;
  let isTrainingMode = initialTrainingMode;
  let lastTrainingPattern = '';

  const accentColorStr = '#' + map.trackLineHex.toString(16).padStart(6, '0');

  // Procedural Textures (omitted in "Sem Texturas" mode)
  const trackTex = noTextures ? null : track(createTrackTexture(map, maxAnisotropy));
  const hazardTex = noTextures
    ? null
    : track(createHazardStripeTexture('#f59e0b', '#111827', maxAnisotropy));
  const overheadTex = noTextures
    ? null
    : track(createOverheadSignTexture(accentColorStr, maxAnisotropy));
  const pillarTex = noTextures
    ? null
    : track(createPillarPanelTexture(accentColorStr, maxAnisotropy));
  const coinTex = noTextures ? null : track(createCoinFaceTexture(maxAnisotropy));
  const shadowTex = noTextures ? null : track(createContactShadowTexture());

  // Track & Scenery Materials
  const trackMat = track(
    new THREE.MeshStandardMaterial({
      map: trackTex,
      color: noTextures ? 0x27272a : 0xffffff,
      roughness: noTextures ? 0.92 : 0.36,
      metalness: noTextures ? 0.04 : 0.3,
    })
  );

  const railMat = track(
    new THREE.MeshStandardMaterial({
      color: noTextures ? 0x52525b : map.railHex,
      roughness: 0.4,
      metalness: 0.5,
    })
  );

  const glowMat = track(
    new THREE.MeshStandardMaterial({
      color: noTextures ? 0xf4f4f5 : map.sceneryGlowHex,
      emissive: noTextures ? 0x000000 : map.sceneryGlowHex,
      emissiveIntensity: noTextures ? 0 : 1.0,
      roughness: 0.2,
    })
  );

  const sceneryMat = track(
    new THREE.MeshStandardMaterial({
      color: noTextures ? 0x18181b : map.sceneryHex,
      roughness: 0.65,
      metalness: 0.25,
    })
  );

  const sceneryAltMat = track(
    new THREE.MeshStandardMaterial({
      color: noTextures ? 0x3f3f46 : map.sceneryGlowHex,
      emissive: noTextures ? 0x000000 : map.sceneryGlowHex,
      emissiveIntensity: noTextures ? 0 : 0.35,
      roughness: 0.3,
      metalness: 0.4,
      transparent: !noTextures && map.id === 'glaciar_artico',
      opacity: !noTextures && map.id === 'glaciar_artico' ? 0.85 : 1,
    })
  );

  // Obstacle Materials
  const steelMat = track(
    new THREE.MeshStandardMaterial({
      color: noTextures ? 0x3f3f46 : 0x1e293b,
      roughness: 0.35,
      metalness: 0.72,
    })
  );

  const darkChassisMat = track(
    new THREE.MeshStandardMaterial({
      color: noTextures ? 0x18181b : 0x090d16,
      roughness: 0.65,
      metalness: 0.35,
    })
  );

  const hazardMat = track(
    new THREE.MeshStandardMaterial({
      map: hazardTex,
      color: noTextures ? 0xf4f4f5 : 0xffffff,
      roughness: 0.38,
      metalness: 0.25,
    })
  );

  const overheadSignMat = track(
    new THREE.MeshStandardMaterial({
      map: overheadTex,
      color: noTextures ? 0xe4e4e7 : 0xffffff,
      emissive: noTextures ? 0x000000 : map.sceneryGlowHex,
      emissiveIntensity: noTextures ? 0 : 0.35,
      roughness: 0.3,
    })
  );

  const pillarBodyMat = track(
    new THREE.MeshStandardMaterial({
      map: pillarTex,
      color: noTextures ? 0x52525b : 0xffffff,
      roughness: 0.32,
      metalness: 0.6,
    })
  );

  const headlightMat = track(
    new THREE.MeshStandardMaterial({
      color: noTextures ? 0xffffff : 0xfef08a,
      emissive: noTextures ? 0x000000 : 0xfacc15,
      emissiveIntensity: noTextures ? 0 : 1.4,
      roughness: 0.15,
    })
  );

  const warningBeaconMat = track(
    new THREE.MeshStandardMaterial({
      color: noTextures ? 0xffffff : 0xf97316,
      emissive: noTextures ? 0x000000 : 0xea580c,
      emissiveIntensity: noTextures ? 0 : 1.1,
      roughness: 0.2,
    })
  );

  const busPalette = (() => {
    switch (map.id) {
      case 'metropole_neon':
        return { body: 0x2563eb, roof: 0xf8fafc, accent: 0x22d3ee, emissive: 0x0ea5e9, win: 0x7dd3fc };
      case 'distrito_vulcanico':
        return { body: 0x1c1917, roof: 0x450a0a, accent: 0xf97316, emissive: 0xea580c, win: 0xfdba74 };
      case 'via_solar':
        return { body: 0xd97706, roof: 0xfef3c7, accent: 0x0284c7, emissive: 0x38bdf8, win: 0xbae6fd };
      case 'nucleo_subterraneo':
        return { body: 0x3b173d, roof: 0x1e293b, accent: 0xfb7185, emissive: 0xf43f5e, win: 0xfbcfe8 };
      case 'passarela_orbital':
        return { body: 0xe2e8f0, roof: 0x1e3a8a, accent: 0x38bdf8, emissive: 0x0ea5e9, win: 0x0f172a };
      case 'floresta_cibernetica':
        return { body: 0x15803d, roof: 0x166534, accent: 0x4ade80, emissive: 0x22c55e, win: 0xa7f3d0 };
      case 'glaciar_artico':
        return { body: 0xe0f2fe, roof: 0xffffff, accent: 0x38bdf8, emissive: 0x0284c7, win: 0x0369a1 };
      default: // circuito_synth
        return { body: 0x4c1d95, roof: 0x2e1065, accent: 0xf472b6, emissive: 0xec4899, win: 0xf0abfc };
    }
  })();

  const busBodyMat = track(
    new THREE.MeshStandardMaterial({
      color: noTextures ? 0x52525b : busPalette.body,
      roughness: 0.34,
      metalness: 0.45,
    })
  );

  const busRoofMat = track(
    new THREE.MeshStandardMaterial({
      color: noTextures ? 0xd4d4d8 : busPalette.roof,
      roughness: 0.4,
      metalness: 0.25,
    })
  );

  const busAccentMat = track(
    new THREE.MeshStandardMaterial({
      color: noTextures ? 0xf4f4f5 : busPalette.accent,
      emissive: noTextures ? 0x000000 : busPalette.emissive,
      emissiveIntensity: noTextures ? 0 : 0.85,
      roughness: 0.22,
    })
  );

  const busWindowMat = track(
    new THREE.MeshStandardMaterial({
      color: noTextures ? 0x18181b : busPalette.win,
      emissive: noTextures ? 0x000000 : busPalette.win,
      emissiveIntensity: noTextures ? 0 : 0.28,
      roughness: 0.12,
      metalness: 0.75,
    })
  );

  const busTaillightMat = track(
    new THREE.MeshStandardMaterial({
      color: noTextures ? 0xd4d4d8 : 0xef4444,
      emissive: noTextures ? 0x000000 : 0xdc2626,
      emissiveIntensity: noTextures ? 0 : 1.1,
      roughness: 0.2,
    })
  );

  const laserCoreMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: noTextures ? 0x000000 : 0xff2a55,
      emissiveIntensity: noTextures ? 0 : 2.0,
      roughness: 0.1,
    })
  );

  const laserSheathMat = track(
    new THREE.MeshBasicMaterial({
      color: noTextures ? 0xa1a1aa : 0xff0033,
      transparent: true,
      opacity: noTextures ? 0.45 : 0.38,
      blending: noTextures ? THREE.NormalBlending : THREE.AdditiveBlending,
      depthWrite: false,
    })
  );

  const pitWallMat = track(
    new THREE.MeshStandardMaterial({
      color: noTextures ? 0x09090b : 0x05070c,
      roughness: 0.85,
      metalness: 0.2,
    })
  );

  const pitVoidMat = track(
    new THREE.MeshBasicMaterial({
      color: noTextures ? 0x030303 : map.sceneryGlowHex,
      transparent: !noTextures,
      opacity: noTextures ? 1 : 0.35,
    })
  );

  // Coin Materials & Geometries
  const coinDiscGeo = track(new THREE.CylinderGeometry(0.46, 0.46, 0.12, 24));
  coinDiscGeo.rotateX(Math.PI / 2);
  const coinBevelGeo = track(new THREE.TorusGeometry(0.47, 0.055, 10, 26));
  const coinHazardAuraGeo = track(new THREE.TorusGeometry(0.54, 0.022, 8, 26));
  const coinShadowGeo = track(new THREE.PlaneGeometry(1.0, 1.0));

  const coinFaceMat = track(
    new THREE.MeshStandardMaterial({
      map: coinTex,
      color: noTextures ? 0xfafafa : 0xffffff,
      emissive: noTextures ? 0x000000 : 0xd97706,
      emissiveIntensity: noTextures ? 0 : 0.35,
      metalness: noTextures ? 0.1 : 0.82,
      roughness: noTextures ? 0.25 : 0.22,
    })
  );

  const coinRimMat = track(
    new THREE.MeshStandardMaterial({
      color: noTextures ? 0xe4e4e7 : 0xfacc15,
      emissive: noTextures ? 0x000000 : 0xf59e0b,
      emissiveIntensity: noTextures ? 0 : 0.45,
      metalness: noTextures ? 0.2 : 0.92,
      roughness: 0.18,
    })
  );

  const coinDangerAuraMat = track(
    new THREE.MeshBasicMaterial({
      color: noTextures ? 0xfafafa : 0xfef9c3,
      transparent: true,
      opacity: noTextures ? 0.55 : 0.72,
      blending: noTextures ? THREE.NormalBlending : THREE.AdditiveBlending,
      depthWrite: false,
    })
  );

  const contactShadowMat = track(
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      color: noTextures ? 0x050505 : 0xffffff,
      transparent: true,
      opacity: noTextures ? 0.35 : 0.72,
      depthWrite: false,
    })
  );

  // ==============================================================
  // SKY DOME & DISTANT HORIZON LANDMARKS (RICH COLORFUL ATMOSPHERE)
  // ==============================================================
  const horizonGroup = new THREE.Group();
  group.add(horizonGroup);

  if (!noTextures) {
    // Rich gradient sky dome surrounding the entire horizon
    const skyTex = track(createSkyDomeTexture(map.id, maxAnisotropy));
    const skyDomeGeo = track(new THREE.SphereGeometry(175, 24, 16));
    const skyDomeMat = track(
      new THREE.MeshBasicMaterial({
        map: skyTex,
        side: THREE.BackSide,
        fog: false,
        depthWrite: false,
      })
    );
    const skyDome = new THREE.Mesh(skyDomeGeo, skyDomeMat);
    horizonGroup.add(skyDome);

    if (map.id === 'circuito_synth') {
      // Iconic retro striped Synthwave sun
      const sunGroup = new THREE.Group();
      sunGroup.position.set(0, 22, -152);
      const sunMat = track(
        new THREE.MeshBasicMaterial({ color: 0xfb923c, fog: false })
      );
      const sunDisc = new THREE.Mesh(track(new THREE.CircleGeometry(22, 40)), sunMat);
      sunGroup.add(sunDisc);
      const stripeCutMat = track(new THREE.MeshBasicMaterial({ color: 0x3b0764, fog: false }));
      for (let s = 0; s < 5; s++) {
        const cut = new THREE.Mesh(
          track(new THREE.PlaneGeometry(46, 1.2 + s * 0.45)),
          stripeCutMat
        );
        cut.position.set(0, -4 - s * 3.4, 0.2);
        sunGroup.add(cut);
      }
      horizonGroup.add(sunGroup);
    } else if (map.id === 'passarela_orbital') {
      // Giant ringed colorful planet in orbital sky
      const planet = new THREE.Mesh(
        track(new THREE.SphereGeometry(18, 24, 24)),
        track(new THREE.MeshBasicMaterial({ color: 0x38bdf8, fog: false }))
      );
      planet.position.set(-28, 34, -148);
      horizonGroup.add(planet);

      const planetRing = new THREE.Mesh(
        track(new THREE.RingGeometry(23, 35, 48)),
        track(
          new THREE.MeshBasicMaterial({
            color: 0xe879f9,
            transparent: true,
            opacity: 0.55,
            side: THREE.DoubleSide,
            fog: false,
          })
        )
      );
      planetRing.position.copy(planet.position);
      planetRing.rotation.set(1.2, 0.35, 0.25);
      horizonGroup.add(planetRing);

      const moon2 = new THREE.Mesh(
        track(new THREE.SphereGeometry(7, 16, 16)),
        track(new THREE.MeshBasicMaterial({ color: 0xfde047, fog: false }))
      );
      moon2.position.set(36, 26, -142);
      horizonGroup.add(moon2);
    } else if (map.id === 'distrito_vulcanico') {
      // Erupting twin volcano silhouettes with glowing lava craters
      const volcMat = track(new THREE.MeshBasicMaterial({ color: 0x2b0a0a, fog: false }));
      const craterMat = track(new THREE.MeshBasicMaterial({ color: 0xf97316, fog: false }));
      for (const [vx, vh, vr] of [[-46, 42, 34], [48, 38, 30]]) {
        const cone = new THREE.Mesh(track(new THREE.ConeGeometry(vr, vh, 12)), volcMat);
        cone.position.set(vx, vh / 2 - 4, -145);
        horizonGroup.add(cone);
        const lavaGlow = new THREE.Mesh(track(new THREE.CircleGeometry(7, 16)), craterMat);
        lavaGlow.position.set(vx, vh - 3, -144);
        horizonGroup.add(lavaGlow);
      }
    } else if (map.id === 'glaciar_artico') {
      // Colorful aurora ribbon arches & frosty moon
      const auroraColors = [0x34d399, 0x38bdf8, 0xc084fc];
      auroraColors.forEach((col, idx) => {
        const arch = new THREE.Mesh(
          track(new THREE.TorusGeometry(45 + idx * 7, 1.4, 8, 32, Math.PI)),
          track(
            new THREE.MeshBasicMaterial({
              color: col,
              transparent: true,
              opacity: 0.42,
              fog: false,
            })
          )
        );
        arch.position.set((idx - 1) * 14, 14, -135);
        horizonGroup.add(arch);
      });
    } else {
      // Glowing sun/moon orb + halo ring
      const orbColor =
        map.id === 'via_solar'
          ? 0xfde047
          : map.id === 'floresta_cibernetica'
            ? 0x6ee7b7
            : map.id === 'nucleo_subterraneo'
              ? 0xfb7185
              : 0x22d3ee;
      const orb = new THREE.Mesh(
        track(new THREE.CircleGeometry(19, 32)),
        track(
          new THREE.MeshBasicMaterial({
            color: orbColor,
            transparent: true,
            opacity: 0.52,
            fog: false,
          })
        )
      );
      orb.position.set(0, 21, -155);
      horizonGroup.add(orb);

      const ring = new THREE.Mesh(
        track(new THREE.RingGeometry(22, 23.2, 48)),
        track(
          new THREE.MeshBasicMaterial({
            color: orbColor,
            transparent: true,
            opacity: 0.45,
            side: THREE.DoubleSide,
            fog: false,
          })
        )
      );
      ring.position.set(0, 21, -154);
      horizonGroup.add(ring);
    }
  }

  // Ambient floating sky particles / fireflies / snow / embers
  const starCount = quality === 'baixa' ? 45 : quality === 'media' ? 110 : 180;
  const starPositions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    starPositions[i * 3] = (Math.random() - 0.5) * 95;
    starPositions[i * 3 + 1] = 1.5 + Math.random() * 36;
    starPositions[i * 3 + 2] = -Math.random() * 145;
  }
  const starGeo = track(new THREE.BufferGeometry());
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  const starMat = track(
    new THREE.PointsMaterial({
      color: noTextures
        ? 0xd4d4d8
        : map.id === 'glaciar_artico'
          ? 0xffffff
          : map.id === 'via_solar' || map.id === 'distrito_vulcanico'
            ? 0xfde047
            : map.sceneryGlowHex,
      size: quality === 'baixa' ? 0.35 : 0.48,
      transparent: true,
      opacity: 0.85,
    })
  );
  const stars = new THREE.Points(starGeo, starMat);
  horizonGroup.add(stars);

  // ==============================================================
  // SHARED SCENERY MATERIALS & GEOMETRIES FOR ALL 8 MAPS
  // ==============================================================
  const floorGeo = track(new THREE.PlaneGeometry(8.8, SEGMENT_LENGTH));
  const terrainTex = noTextures ? null : track(createTerrainTexture(map.id, maxAnisotropy));
  const terrainFloorGeo = track(new THREE.PlaneGeometry(66, SEGMENT_LENGTH));
  const terrainMat = track(
    new THREE.MeshStandardMaterial({
      map: terrainTex,
      color: noTextures ? 0x18181b : 0xffffff,
      roughness: 0.82,
      metalness: 0.1,
    })
  );

  const railGeo = track(new THREE.BoxGeometry(0.5, 0.56, SEGMENT_LENGTH));
  const stripGeo = track(new THREE.BoxGeometry(0.14, 0.08, SEGMENT_LENGTH));
  const untexturedLaneGeo = track(new THREE.BoxGeometry(0.12, 0.03, 2.6));
  const archPillarGeo = track(new THREE.BoxGeometry(0.55, 7.6, 0.7));
  const archTopGeo = track(new THREE.BoxGeometry(10.6, 0.55, 0.8));
  const archLightGeo = track(new THREE.BoxGeometry(9.6, 0.14, 0.85));

  // Colorful map-specific decoration materials (created once, shared across segments)
  const bldgTexA = noTextures
    ? null
    : track(createBuildingWindowsTexture('#1e1b4b', '#22d3ee', '#f472b6', maxAnisotropy));
  const bldgTexB = noTextures
    ? null
    : track(createBuildingWindowsTexture('#0f172a', '#facc15', '#38bdf8', maxAnisotropy));
  const bldgMatA = track(
    new THREE.MeshStandardMaterial({
      map: bldgTexA,
      color: noTextures ? 0x27272a : 0xffffff,
      roughness: 0.45,
      metalness: 0.3,
    })
  );
  const bldgMatB = track(
    new THREE.MeshStandardMaterial({
      map: bldgTexB,
      color: noTextures ? 0x3f3f46 : 0xffffff,
      roughness: 0.45,
      metalness: 0.3,
    })
  );

  const pinkNeonMat = track(
    new THREE.MeshStandardMaterial({
      color: noTextures ? 0xd4d4d8 : 0xf472b6,
      emissive: noTextures ? 0 : 0xec4899,
      emissiveIntensity: noTextures ? 0 : 0.9,
      roughness: 0.25,
    })
  );
  const goldNeonMat = track(
    new THREE.MeshStandardMaterial({
      color: noTextures ? 0xe4e4e7 : 0xfacc15,
      emissive: noTextures ? 0 : 0xf59e0b,
      emissiveIntensity: noTextures ? 0 : 0.75,
      roughness: 0.25,
    })
  );
  const woodBarkMat = track(
    new THREE.MeshStandardMaterial({
      color: noTextures ? 0x27272a : 0x78350f,
      roughness: 0.88,
    })
  );
  const lushLeafMat = track(
    new THREE.MeshStandardMaterial({
      color: noTextures ? 0x52525b : 0x16a34a,
      emissive: noTextures ? 0 : 0x059669,
      emissiveIntensity: noTextures ? 0 : 0.2,
      roughness: 0.65,
    })
  );
  const aquaLeafMat = track(
    new THREE.MeshStandardMaterial({
      color: noTextures ? 0xa1a1aa : 0x34d399,
      emissive: noTextures ? 0 : 0x10b981,
      emissiveIntensity: noTextures ? 0 : 0.35,
      roughness: 0.5,
    })
  );
  const snowWhiteMat = track(
    new THREE.MeshStandardMaterial({
      color: noTextures ? 0xf4f4f5 : 0xf8fafc,
      roughness: 0.6,
    })
  );
  const desertRockMat = track(
    new THREE.MeshStandardMaterial({
      color: noTextures ? 0x52525b : 0xc2410c,
      roughness: 0.85,
    })
  );
  const cactusGreenMat = track(
    new THREE.MeshStandardMaterial({
      color: noTextures ? 0x71717a : 0x22c55e,
      roughness: 0.65,
    })
  );
  const solarPanelMat = track(
    new THREE.MeshStandardMaterial({
      color: noTextures ? 0x3f3f46 : 0x0284c7,
      emissive: noTextures ? 0 : 0x0369a1,
      emissiveIntensity: noTextures ? 0 : 0.35,
      metalness: 0.8,
      roughness: 0.2,
    })
  );

  // Shared reusable decoration geometries
  const lampPostGeo = track(new THREE.CylinderGeometry(0.1, 0.14, 5.2, 8));
  const lampArmGeo = track(new THREE.BoxGeometry(1.1, 0.14, 0.14));
  const lampBulbGeo = track(new THREE.SphereGeometry(0.24, 10, 10));
  const treeTrunkGeo = track(new THREE.CylinderGeometry(0.32, 0.56, 5.4, 8));
  const canopySphereGeo = track(new THREE.DodecahedronGeometry(2.1, 1));
  const mushroomStemGeo = track(new THREE.CylinderGeometry(0.22, 0.32, 1.5, 8));
  const mushroomCapGeo = track(new THREE.ConeGeometry(1.15, 0.9, 10));
  const cactusTrunkGeo = track(new THREE.CylinderGeometry(0.35, 0.4, 3.6, 8));
  const cactusArmGeo = track(new THREE.CylinderGeometry(0.22, 0.24, 1.4, 8));
  const mesaGeo = track(new THREE.CylinderGeometry(3.2, 5.4, 11, 7));
  const crystalGeo = track(new THREE.OctahedronGeometry(1.2, 0));

  function buildSegment(index: number): THREE.Group {
    const seg = new THREE.Group();
    seg.position.z = -index * SEGMENT_LENGTH;

    // Continuous colorful ground/water/grid flanking BOTH sides of the track (no black void!)
    const leftGround = new THREE.Mesh(terrainFloorGeo, terrainMat);
    leftGround.rotation.x = -Math.PI / 2;
    leftGround.position.set(-37.4, -0.45, 0);
    leftGround.receiveShadow = true;
    seg.add(leftGround);

    const rightGround = new THREE.Mesh(terrainFloorGeo, terrainMat);
    rightGround.rotation.x = -Math.PI / 2;
    rightGround.position.set(37.4, -0.45, 0);
    rightGround.receiveShadow = true;
    seg.add(rightGround);

    const floor = new THREE.Mesh(floorGeo, trackMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    seg.add(floor);

    if (noTextures) {
      for (let zOff = -SEGMENT_LENGTH / 2 + 2; zOff < SEGMENT_LENGTH / 2; zOff += 5) {
        const dL = new THREE.Mesh(untexturedLaneGeo, glowMat);
        dL.position.set(-LANE_WIDTH / 2, 0.02, zOff);
        seg.add(dL);
        const dR = new THREE.Mesh(untexturedLaneGeo, glowMat);
        dR.position.set(LANE_WIDTH / 2, 0.02, zOff);
        seg.add(dR);
      }
    }

    const leftRail = new THREE.Mesh(railGeo, railMat);
    leftRail.position.set(-4.65, 0.28, 0);
    seg.add(leftRail);
    const rightRail = new THREE.Mesh(railGeo, railMat);
    rightRail.position.set(4.65, 0.28, 0);
    seg.add(rightRail);

    const leftStrip = new THREE.Mesh(stripGeo, glowMat);
    leftStrip.position.set(-4.4, 0.58, 0);
    seg.add(leftStrip);
    const rightStrip = new THREE.Mesh(stripGeo, glowMat);
    rightStrip.position.set(4.4, 0.58, 0);
    seg.add(rightStrip);

    // Overhead cyber gate arch once per segment
    const archL = new THREE.Mesh(archPillarGeo, railMat);
    archL.position.set(-5.0, 3.8, 0);
    seg.add(archL);
    const archR = new THREE.Mesh(archPillarGeo, railMat);
    archR.position.set(5.0, 3.8, 0);
    seg.add(archR);
    const archTop = new THREE.Mesh(archTopGeo, railMat);
    archTop.position.set(0, 7.6, 0);
    seg.add(archTop);
    const archGlow = new THREE.Mesh(archLightGeo, glowMat);
    archGlow.position.set(0, 7.28, 0);
    seg.add(archGlow);

    // Rich colorful flanking scenery props for EVERY map
    const propStep = quality === 'baixa' ? 18 : 12;
    for (let zOff = -SEGMENT_LENGTH / 2 + 6; zOff < SEGMENT_LENGTH / 2; zOff += propStep) {
      for (const side of [-1, 1]) {
        if (map.id === 'metropole_neon') {
          // Illuminated skyscrapers with glowing colored windows + rooftop beacons + streetlamps
          const h = 13 + ((index * 7 + Math.abs(zOff) * 3) % 14);
          const bMat = (index + Math.abs(zOff) + (side > 0 ? 1 : 0)) % 2 === 0 ? bldgMatA : bldgMatB;
          const bMesh = new THREE.Mesh(track(new THREE.BoxGeometry(6.2, h, 7.4)), bMat);
          bMesh.position.set(side * 10.6, h / 2 - 0.5, zOff);
          seg.add(bMesh);

          const roofTrim = new THREE.Mesh(
            track(new THREE.BoxGeometry(6.5, 0.4, 7.7)),
            side > 0 ? pinkNeonMat : glowMat
          );
          roofTrim.position.set(side * 10.6, h - 0.5, zOff);
          seg.add(roofTrim);

          const billboard = new THREE.Mesh(
            track(new THREE.BoxGeometry(0.35, 2.4, 4.2)),
            side > 0 ? glowMat : pinkNeonMat
          );
          billboard.position.set(side * 7.2, 4.8, zOff);
          seg.add(billboard);

          // Cyber streetlamp along curb
          const post = new THREE.Mesh(lampPostGeo, steelMat);
          post.position.set(side * 5.6, 2.5, zOff + 4);
          seg.add(post);
          const arm = new THREE.Mesh(lampArmGeo, steelMat);
          arm.position.set(side * 5.3, 5.1, zOff + 4);
          seg.add(arm);
          const bulb = new THREE.Mesh(lampBulbGeo, side > 0 ? pinkNeonMat : glowMat);
          bulb.position.set(side * 4.85, 5.0, zOff + 4);
          seg.add(bulb);
        } else if (map.id === 'via_solar') {
          // Terracotta canyon mesas + green saguaro cacti with flowers + blue solar arrays
          const mesa = new THREE.Mesh(mesaGeo, desertRockMat);
          mesa.position.set(side * 14.2, 4.5, zOff);
          seg.add(mesa);

          const mesaCap = new THREE.Mesh(track(new THREE.CylinderGeometry(3.4, 3.4, 1.0, 7)), goldNeonMat);
          mesaCap.position.set(side * 14.2, 10.2, zOff);
          seg.add(mesaCap);

          // Saguaro cactus
          const cactus = new THREE.Mesh(cactusTrunkGeo, cactusGreenMat);
          cactus.position.set(side * 6.8, 1.4, zOff - 3);
          seg.add(cactus);
          const armL = new THREE.Mesh(cactusArmGeo, cactusGreenMat);
          armL.position.set(side * 6.8 - 0.55, 2.0, zOff - 3);
          armL.rotation.z = 0.5;
          seg.add(armL);
          const bloom = new THREE.Mesh(lampBulbGeo, pinkNeonMat);
          bloom.position.set(side * 6.8, 3.3, zOff - 3);
          seg.add(bloom);

          // Solar collector wing
          const panel = new THREE.Mesh(track(new THREE.BoxGeometry(3.0, 0.16, 4.2)), solarPanelMat);
          panel.position.set(side * 7.8, 2.6, zOff + 3);
          panel.rotation.z = side * 0.42;
          seg.add(panel);
        } else if (map.id === 'nucleo_subterraneo') {
          // Reactor turbine towers + glowing neon energy crystals + overhead conduits
          const tower = new THREE.Mesh(track(new THREE.CylinderGeometry(0.95, 1.25, 9.0, 10)), sceneryMat);
          tower.position.set(side * 7.4, 4.2, zOff);
          seg.add(tower);

          for (const ry of [2.4, 4.8, 7.2]) {
            const ring = new THREE.Mesh(
              track(new THREE.TorusGeometry(1.15, 0.14, 8, 16)),
              ry === 4.8 ? pinkNeonMat : glowMat
            );
            ring.rotation.x = Math.PI / 2;
            ring.position.set(side * 7.4, ry, zOff);
            seg.add(ring);
          }

          const crystal = new THREE.Mesh(crystalGeo, side > 0 ? glowMat : pinkNeonMat);
          crystal.position.set(side * 5.8, 1.3, zOff + 4);
          crystal.scale.set(0.8, 1.6, 0.8);
          seg.add(crystal);
        } else if (map.id === 'passarela_orbital') {
          // Space station solar wing arrays + radar satellite towers + floating beacons
          const mast = new THREE.Mesh(track(new THREE.CylinderGeometry(0.28, 0.45, 7.8, 8)), steelMat);
          mast.position.set(side * 6.6, 2.6, zOff);
          seg.add(mast);

          const wing = new THREE.Mesh(track(new THREE.BoxGeometry(5.2, 0.12, 2.4)), solarPanelMat);
          wing.position.set(side * 9.5, 4.8, zOff);
          wing.rotation.x = 0.35;
          seg.add(wing);

          const dish = new THREE.Mesh(track(new THREE.ConeGeometry(1.2, 0.8, 12, 1, true)), snowWhiteMat);
          dish.position.set(side * 6.6, 6.8, zOff);
          dish.rotation.x = -0.6;
          seg.add(dish);

          const beacon = new THREE.Mesh(crystalGeo, side > 0 ? glowMat : pinkNeonMat);
          beacon.position.set(side * 5.8, 3.8, zOff + 4);
          beacon.scale.setScalar(0.55);
          seg.add(beacon);
        } else if (map.id === 'floresta_cibernetica') {
          // Multi-part lush trees with round vivid canopies + glowing spotted mushrooms + hanging lanterns
          const trunk = new THREE.Mesh(treeTrunkGeo, woodBarkMat);
          trunk.position.set(side * 8.4, 2.4, zOff);
          seg.add(trunk);

          const crown1 = new THREE.Mesh(canopySphereGeo, lushLeafMat);
          crown1.position.set(side * 8.4, 6.0, zOff);
          seg.add(crown1);

          const crown2 = new THREE.Mesh(canopySphereGeo, aquaLeafMat);
          crown2.position.set(side * 7.4, 7.4, zOff + 1.0);
          crown2.scale.setScalar(0.75);
          seg.add(crown2);

          const lantern = new THREE.Mesh(lampBulbGeo, goldNeonMat);
          lantern.position.set(side * 6.5, 4.4, zOff);
          seg.add(lantern);

          // Giant bioluminescent glowing mushroom
          const mStem = new THREE.Mesh(mushroomStemGeo, snowWhiteMat);
          mStem.position.set(side * 5.9, 0.5, zOff + 4.5);
          seg.add(mStem);
          const mCap = new THREE.Mesh(mushroomCapGeo, side > 0 ? pinkNeonMat : glowMat);
          mCap.position.set(side * 5.9, 1.45, zOff + 4.5);
          seg.add(mCap);
        } else if (map.id === 'glaciar_artico') {
          // Snow-capped arctic mountains + sapphire icebergs + frosted pine trees
          const mtnH = 11 + (Math.abs(zOff) % 6);
          const mtn = new THREE.Mesh(track(new THREE.ConeGeometry(4.8, mtnH, 6)), sceneryAltMat);
          mtn.position.set(side * 12.6, mtnH / 2 - 0.5, zOff);
          seg.add(mtn);
          const snowCap = new THREE.Mesh(track(new THREE.ConeGeometry(2.2, mtnH * 0.42, 6)), snowWhiteMat);
          snowCap.position.set(side * 12.6, mtnH * 0.78 - 0.5, zOff);
          seg.add(snowCap);

          // Frosted arctic pine tree
          const pTrunk = new THREE.Mesh(track(new THREE.CylinderGeometry(0.25, 0.35, 2.2, 6)), woodBarkMat);
          pTrunk.position.set(side * 6.6, 0.8, zOff + 3.5);
          seg.add(pTrunk);
          const pineBot = new THREE.Mesh(track(new THREE.ConeGeometry(1.7, 2.8, 7)), lushLeafMat);
          pineBot.position.set(side * 6.6, 2.5, zOff + 3.5);
          seg.add(pineBot);
          const pineTop = new THREE.Mesh(track(new THREE.ConeGeometry(1.2, 2.0, 7)), snowWhiteMat);
          pineTop.position.set(side * 6.6, 3.8, zOff + 3.5);
          seg.add(pineTop);
        } else if (map.id === 'distrito_vulcanico') {
          // Obsidian rock spires with glowing magma cores + fiery braziers + ruby crystals
          const spire = new THREE.Mesh(track(new THREE.ConeGeometry(3.2, 10.5, 6)), sceneryMat);
          spire.position.set(side * 10.6, 4.6, zOff);
          seg.add(spire);

          const magmaVein = new THREE.Mesh(track(new THREE.BoxGeometry(0.45, 7.5, 0.5)), goldNeonMat);
          magmaVein.position.set(side * 8.6, 3.6, zOff);
          seg.add(magmaVein);

          // Steel brazier stand with glowing fire orb
          const brazier = new THREE.Mesh(track(new THREE.CylinderGeometry(0.55, 0.35, 3.0, 8)), steelMat);
          brazier.position.set(side * 5.8, 1.3, zOff + 4);
          seg.add(brazier);
          const fireOrb = new THREE.Mesh(track(new THREE.DodecahedronGeometry(0.65, 0)), glowMat);
          fireOrb.position.set(side * 5.8, 3.2, zOff + 4);
          seg.add(fireOrb);
        } else {
          // circuito_synth: Neon Synthwave Palm Trees + Equalizer Light Towers + Glowing Pyramids
          const palmTrunk = new THREE.Mesh(track(new THREE.CylinderGeometry(0.22, 0.36, 5.4, 8)), pinkNeonMat);
          palmTrunk.position.set(side * 6.8, 2.4, zOff);
          palmTrunk.rotation.z = side * -0.14;
          seg.add(palmTrunk);

          for (let f = 0; f < 5; f++) {
            const frond = new THREE.Mesh(
              track(new THREE.BoxGeometry(2.4, 0.14, 0.55)),
              f % 2 === 0 ? glowMat : pinkNeonMat
            );
            frond.position.set(side * 7.2, 5.0, zOff);
            frond.rotation.y = (f / 5) * Math.PI * 2;
            frond.rotation.z = 0.25;
            seg.add(frond);
          }

          // Equalizer bars & neon pyramid
          const eqStack = new THREE.Mesh(track(new THREE.BoxGeometry(0.9, 6.2, 0.9)), sceneryMat);
          eqStack.position.set(side * 9.8, 2.8, zOff + 4.5);
          seg.add(eqStack);
          const eqBar = new THREE.Mesh(track(new THREE.BoxGeometry(1.05, 1.4, 1.05)), goldNeonMat);
          eqBar.position.set(side * 9.8, 5.0, zOff + 4.5);
          seg.add(eqBar);

          const pyramid = new THREE.Mesh(track(new THREE.ConeGeometry(4.8, 8.8, 4)), sceneryMat);
          pyramid.position.set(side * 14.5, 3.8, zOff);
          pyramid.rotation.y = Math.PI / 4;
          seg.add(pyramid);
        }
      }
    }

    return seg;
  }

  for (let i = 0; i < SEGMENT_COUNT; i++) {
    const seg = buildSegment(i);
    segments.push(seg);
    group.add(seg);
  }

  // ==============================================================
  // COMPOSITE 3D OBSTACLE BUILDERS
  // ==============================================================
  function createObstacleMesh(
    kind: ObstacleKind,
    laneIndex: number,
    zPos: number,
    coinYCenter = 0.54
  ): ActiveObstacle {
    const mesh = new THREE.Group();
    const x = LANE_POSITIONS[laneIndex];
    mesh.position.set(x, 0, zPos);

    let halfWidth = 0.85;
    let minY = 0;
    let maxY = 1.6;
    let halfDepth = 0.35;
    let spinTarget: THREE.Object3D | undefined;

    if (kind === 'coin') {
      // Multi-part forbidden coin resting directly on the track floor (when coinYCenter = 0.54)
      if (coinYCenter < 1.15) {
        const shadow = new THREE.Mesh(coinShadowGeo, contactShadowMat);
        shadow.rotation.x = -Math.PI / 2;
        shadow.position.y = 0.025;
        mesh.add(shadow);
      }

      const coinWrap = new THREE.Group();
      coinWrap.position.y = coinYCenter;

      const disc = new THREE.Mesh(coinDiscGeo, coinFaceMat);
      disc.castShadow = true;
      coinWrap.add(disc);

      const rim = new THREE.Mesh(coinBevelGeo, coinRimMat);
      coinWrap.add(rim);

      const dangerHalo = new THREE.Mesh(coinHazardAuraGeo, coinDangerAuraMat);
      coinWrap.add(dangerHalo);

      mesh.add(coinWrap);
      spinTarget = coinWrap;
      // Match visual disc proportions (0.46 radius, 0.12 thickness) so players can weave through open spaces between coins
      halfWidth = 0.40;
      minY = Math.max(0.04, coinYCenter - 0.48);
      maxY = coinYCenter + 0.48;
      halfDepth = 0.15;
    } else if (kind === 'barrier_low') {
      // Composite A-Frame Steel Hurdle with diagonal hazard stripes & corner beacons
      const shadow = new THREE.Mesh(track(new THREE.PlaneGeometry(2.5, 1.1)), contactShadowMat);
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = 0.025;
      mesh.add(shadow);

      const legGeo = track(new THREE.BoxGeometry(0.18, 0.96, 0.56));
      const footGeo = track(new THREE.BoxGeometry(0.32, 0.1, 0.72));
      for (const sx of [-1.02, 1.02]) {
        const leg = new THREE.Mesh(legGeo, steelMat);
        leg.position.set(sx, 0.48, 0);
        mesh.add(leg);
        const foot = new THREE.Mesh(footGeo, darkChassisMat);
        foot.position.set(sx, 0.05, 0);
        mesh.add(foot);
        const beacon = new THREE.Mesh(track(new THREE.CylinderGeometry(0.1, 0.12, 0.16, 8)), warningBeaconMat);
        beacon.position.set(sx, 1.04, 0);
        mesh.add(beacon);
      }

      const plank = new THREE.Mesh(track(new THREE.BoxGeometry(2.15, 0.52, 0.24)), hazardMat);
      plank.position.y = 0.66;
      plank.castShadow = true;
      mesh.add(plank);

      const lowerRail = new THREE.Mesh(track(new THREE.BoxGeometry(2.1, 0.14, 0.16)), steelMat);
      lowerRail.position.y = 0.24;
      mesh.add(lowerRail);

      halfWidth = 0.96;
      minY = 0;
      maxY = 0.96;
      halfDepth = 0.34;
    } else if (kind === 'barrier_high') {
      // Industrial Overhead Gantry Gate with downward clearance arrows
      const postGeo = track(new THREE.BoxGeometry(0.22, 2.75, 0.28));
      const baseGeo = track(new THREE.BoxGeometry(0.42, 0.14, 0.48));
      for (const sx of [-1.14, 1.14]) {
        const post = new THREE.Mesh(postGeo, steelMat);
        post.position.set(sx, 1.38, 0);
        post.castShadow = true;
        mesh.add(post);
        const base = new THREE.Mesh(baseGeo, darkChassisMat);
        base.position.set(sx, 0.07, 0);
        mesh.add(base);
      }

      const signBack = new THREE.Mesh(track(new THREE.BoxGeometry(2.38, 1.02, 0.32)), steelMat);
      signBack.position.y = 1.9;
      signBack.castShadow = true;
      mesh.add(signBack);

      const signFace = new THREE.Mesh(track(new THREE.PlaneGeometry(2.22, 0.86)), overheadSignMat);
      signFace.position.set(0, 1.9, 0.17);
      mesh.add(signFace);

      const topStrip = new THREE.Mesh(track(new THREE.BoxGeometry(2.56, 0.16, 0.38)), hazardMat);
      topStrip.position.y = 2.52;
      mesh.add(topStrip);

      halfWidth = 0.98;
      minY = 1.12;
      maxY = 2.65;
      halfDepth = 0.32;
    } else if (kind === 'pillar') {
      // Sleek Armored Cyber-Train / Monorail Car (multi-part hero obstacle)
      const shadow = new THREE.Mesh(track(new THREE.PlaneGeometry(2.6, 3.6)), contactShadowMat);
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = 0.025;
      mesh.add(shadow);

      // Undercarriage chassis + wheels
      const chassis = new THREE.Mesh(track(new THREE.BoxGeometry(1.96, 0.38, 2.9)), darkChassisMat);
      chassis.position.y = 0.24;
      mesh.add(chassis);

      // Main armored body
      const hull = new THREE.Mesh(track(new THREE.BoxGeometry(2.12, 2.45, 2.75)), pillarBodyMat);
      hull.position.y = 1.62;
      hull.castShadow = true;
      mesh.add(hull);

      // Sloped aerodynamic nose cap facing player (+Z)
      const nose = new THREE.Mesh(track(new THREE.BoxGeometry(2.04, 1.2, 0.45)), steelMat);
      nose.position.set(0, 1.05, 1.45);
      nose.rotation.x = -0.22;
      mesh.add(nose);

      // Bright front headlight bar
      const headlight = new THREE.Mesh(track(new THREE.BoxGeometry(1.65, 0.2, 0.14)), headlightMat);
      headlight.position.set(0, 0.92, 1.65);
      mesh.add(headlight);

      // Roof HVAC & glowing trim rails
      const roofUnit = new THREE.Mesh(track(new THREE.BoxGeometry(1.4, 0.26, 1.9)), steelMat);
      roofUnit.position.y = 2.96;
      mesh.add(roofUnit);

      const roofTrim = new THREE.Mesh(track(new THREE.BoxGeometry(2.2, 0.14, 2.82)), glowMat);
      roofTrim.position.y = 2.84;
      mesh.add(roofTrim);

      halfWidth = 0.95;
      minY = 0;
      maxY = 3.1;
      halfDepth = 1.45;
    } else if (kind === 'pit') {
      // Deep 3D Recessed Void Shaft with glowing plasma core & hazard curbs
      const floorVoid = new THREE.Mesh(track(new THREE.PlaneGeometry(2.3, 3.8)), pitVoidMat);
      floorVoid.rotation.x = -Math.PI / 2;
      floorVoid.position.y = 0.015;
      mesh.add(floorVoid);

      const innerShaft = new THREE.Mesh(track(new THREE.BoxGeometry(2.26, 0.12, 3.7)), pitWallMat);
      innerShaft.position.y = 0.025;
      mesh.add(innerShaft);

      // Raised side hazard curbs
      const curbSideGeo = track(new THREE.BoxGeometry(0.18, 0.14, 3.9));
      const curbL = new THREE.Mesh(curbSideGeo, hazardMat);
      curbL.position.set(-1.14, 0.07, 0);
      mesh.add(curbL);
      const curbR = new THREE.Mesh(curbSideGeo, hazardMat);
      curbR.position.set(1.14, 0.07, 0);
      mesh.add(curbR);

      const curbEndGeo = track(new THREE.BoxGeometry(2.46, 0.16, 0.24));
      const curbFront = new THREE.Mesh(curbEndGeo, warningBeaconMat);
      curbFront.position.set(0, 0.08, 1.9);
      mesh.add(curbFront);
      const curbBack = new THREE.Mesh(curbEndGeo, warningBeaconMat);
      curbBack.position.set(0, 0.08, -1.9);
      mesh.add(curbBack);

      halfWidth = 0.94;
      minY = -1;
      maxY = 0.25;
      halfDepth = 1.75;
    } else if (kind === 'laser_low' || kind === 'laser_high') {
      // Twin armored emitter pylons + core laser + glowing outer sheath
      const postGeo = track(new THREE.CylinderGeometry(0.12, 0.18, 2.45, 8));
      const baseGeo = track(new THREE.CylinderGeometry(0.28, 0.32, 0.16, 8));
      const nozzleGeo = track(new THREE.SphereGeometry(0.14, 10, 10));

      const heights = kind === 'laser_low' ? [0.64] : [1.52, 2.04];

      for (const sx of [-1.18, 1.18]) {
        const base = new THREE.Mesh(baseGeo, darkChassisMat);
        base.position.set(sx, 0.08, 0);
        mesh.add(base);
        const post = new THREE.Mesh(postGeo, steelMat);
        post.position.set(sx, 1.24, 0);
        mesh.add(post);
        for (const yh of heights) {
          const nozzle = new THREE.Mesh(nozzleGeo, laserCoreMat);
          nozzle.position.set(sx * 0.9, yh, 0);
          mesh.add(nozzle);
        }
      }

      const coreGeo = track(new THREE.CylinderGeometry(0.055, 0.055, 2.34, 8));
      coreGeo.rotateZ(Math.PI / 2);
      const sheathGeo = track(new THREE.CylinderGeometry(0.16, 0.16, 2.34, 10));
      sheathGeo.rotateZ(Math.PI / 2);

      for (const yh of heights) {
        const core = new THREE.Mesh(coreGeo, laserCoreMat);
        core.position.y = yh;
        mesh.add(core);
        const sheath = new THREE.Mesh(sheathGeo, laserSheathMat);
        sheath.position.y = yh;
        mesh.add(sheath);
      }

      halfWidth = 1.02;
      minY = kind === 'laser_low' ? 0 : 1.1;
      maxY = kind === 'laser_low' ? 0.94 : 2.35;
      halfDepth = 0.25;
    } else if (kind === 'bus') {
      // Sleek Jumpable Bus with distinct map-themed personality & decoration
      const shadow = new THREE.Mesh(track(new THREE.PlaneGeometry(2.55, 4.35)), contactShadowMat);
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = 0.025;
      mesh.add(shadow);

      // Undercarriage chassis & 4 wheels
      const chassis = new THREE.Mesh(track(new THREE.BoxGeometry(1.94, 0.24, 3.6)), darkChassisMat);
      chassis.position.y = 0.34;
      mesh.add(chassis);

      const wheelGeo = track(new THREE.CylinderGeometry(0.34, 0.34, 0.22, 12));
      wheelGeo.rotateZ(Math.PI / 2);
      const hubGeo = track(new THREE.CylinderGeometry(0.16, 0.16, 0.24, 8));
      hubGeo.rotateZ(Math.PI / 2);
      for (const wx of [-0.94, 0.94]) {
        for (const wz of [-1.2, 1.2]) {
          const tire = new THREE.Mesh(wheelGeo, darkChassisMat);
          tire.position.set(wx, 0.34, wz);
          mesh.add(tire);
          const hub = new THREE.Mesh(hubGeo, busAccentMat);
          hub.position.set(wx, 0.34, wz);
          mesh.add(hub);
        }
      }

      // Main bus cabin (kept at sleek ~1.96m jumpable height)
      const hull = new THREE.Mesh(track(new THREE.BoxGeometry(2.06, 1.34, 3.7)), busBodyMat);
      hull.position.y = 1.12;
      hull.castShadow = true;
      mesh.add(hull);

      // Painted roof cap
      const roof = new THREE.Mesh(track(new THREE.BoxGeometry(2.02, 0.14, 3.64)), busRoofMat);
      roof.position.y = 1.85;
      mesh.add(roof);

      // Front bumper facing player (+Z)
      const bumper = new THREE.Mesh(track(new THREE.BoxGeometry(2.12, 0.24, 0.26)), steelMat);
      bumper.position.set(0, 0.42, 1.88);
      mesh.add(bumper);

      // Front panoramic windshield + side passenger windows
      const windshield = new THREE.Mesh(track(new THREE.BoxGeometry(1.76, 0.62, 0.08)), busWindowMat);
      windshield.position.set(0, 1.32, 1.84);
      mesh.add(windshield);

      const sideWindowGeo = track(new THREE.BoxGeometry(0.06, 0.48, 2.75));
      for (const sx of [-1.02, 1.02]) {
        const win = new THREE.Mesh(sideWindowGeo, busWindowMat);
        win.position.set(sx, 1.34, -0.08);
        mesh.add(win);

        // Glowing side trim stripe
        const stripe = new THREE.Mesh(track(new THREE.BoxGeometry(0.08, 0.14, 3.56)), busAccentMat);
        stripe.position.set(sx, 0.86, 0);
        mesh.add(stripe);
      }

      // Twin front headlights & digital route sign
      const lampGeo = track(new THREE.BoxGeometry(0.32, 0.18, 0.12));
      for (const lx of [-0.7, 0.7]) {
        const lamp = new THREE.Mesh(lampGeo, headlightMat);
        lamp.position.set(lx, 0.72, 1.86);
        mesh.add(lamp);
        const tail = new THREE.Mesh(lampGeo, busTaillightMat);
        tail.position.set(lx, 0.72, -1.86);
        mesh.add(tail);
      }
      const routeSign = new THREE.Mesh(track(new THREE.BoxGeometry(1.24, 0.16, 0.1)), busAccentMat);
      routeSign.position.set(0, 1.7, 1.85);
      mesh.add(routeSign);

      // Map-specific bus personality & decorations
      if (map.id === 'metropole_neon') {
        // City transit bus: twin roof AC units + taxi/city side stripe
        for (const az of [-0.85, 0.65]) {
          const ac = new THREE.Mesh(track(new THREE.BoxGeometry(1.18, 0.12, 0.76)), steelMat);
          ac.position.set(0, 1.97, az);
          mesh.add(ac);
        }
      } else if (map.id === 'distrito_vulcanico') {
        // Magma armored bus: fiery lava grille, obsidian armor spikes & twin volcanic exhaust pipes
        const lavaGrille = new THREE.Mesh(track(new THREE.BoxGeometry(1.1, 0.26, 0.14)), warningBeaconMat);
        lavaGrille.position.set(0, 0.66, 1.88);
        mesh.add(lavaGrille);
        for (const ex of [-0.82, 0.82]) {
          const stack = new THREE.Mesh(track(new THREE.CylinderGeometry(0.11, 0.14, 0.42, 8)), steelMat);
          stack.position.set(ex, 1.96, -1.35);
          mesh.add(stack);
          const ember = new THREE.Mesh(track(new THREE.SphereGeometry(0.12, 8, 8)), warningBeaconMat);
          ember.position.set(ex, 2.12, -1.35);
          mesh.add(ember);
        }
        const magmaRidge = new THREE.Mesh(track(new THREE.BoxGeometry(0.65, 0.14, 2.6)), busAccentMat);
        magmaRidge.position.set(0, 1.96, 0.1);
        mesh.add(magmaRidge);
      } else if (map.id === 'via_solar') {
        // Solar canyon coach: roof-mounted tilted solar collector arrays
        for (const pz of [-0.9, 0.5]) {
          const panel = new THREE.Mesh(track(new THREE.BoxGeometry(1.75, 0.08, 1.15)), solarPanelMat);
          panel.position.set(0, 1.98, pz);
          panel.rotation.x = 0.12;
          mesh.add(panel);
        }
      } else if (map.id === 'nucleo_subterraneo') {
        // Reactor armored bus: hazard front bar & glowing side reactor conduits
        const hazFront = new THREE.Mesh(track(new THREE.BoxGeometry(2.08, 0.2, 0.18)), hazardMat);
        hazFront.position.set(0, 0.62, 1.88);
        mesh.add(hazFront);
        const turbine = new THREE.Mesh(track(new THREE.CylinderGeometry(0.55, 0.62, 0.16, 12)), busAccentMat);
        turbine.position.set(0, 1.97, -0.2);
        mesh.add(turbine);
      } else if (map.id === 'passarela_orbital') {
        // Space shuttle bus: side thruster pods & dorsal aero fin
        const fin = new THREE.Mesh(track(new THREE.BoxGeometry(0.12, 0.24, 1.4)), busAccentMat);
        fin.position.set(0, 2.0, -0.8);
        mesh.add(fin);
        for (const sx of [-1.1, 1.1]) {
          const pod = new THREE.Mesh(track(new THREE.CylinderGeometry(0.16, 0.18, 1.6, 8)), steelMat);
          pod.rotation.x = Math.PI / 2;
          pod.position.set(sx, 0.68, -0.4);
          mesh.add(pod);
        }
      } else if (map.id === 'floresta_cibernetica') {
        // Eco botanical bus: living moss & glowing leaves along the roof
        for (const lz of [-1.0, 0, 1.0]) {
          const bush = new THREE.Mesh(track(new THREE.DodecahedronGeometry(0.32, 0)), lz === 0 ? aquaLeafMat : lushLeafMat);
          bush.scale.set(2.2, 0.45, 1.1);
          bush.position.set(0, 1.96, lz);
          mesh.add(bush);
        }
      } else if (map.id === 'glaciar_artico') {
        // Arctic snow-breaker bus: V-shaped snowplow front & crystal ice spires on roof
        const plow = new THREE.Mesh(track(new THREE.ConeGeometry(1.15, 0.65, 4)), steelMat);
        plow.rotation.x = Math.PI / 2;
        plow.rotation.y = Math.PI / 4;
        plow.scale.set(1.25, 1, 0.42);
        plow.position.set(0, 0.45, 1.95);
        mesh.add(plow);
        for (const iz of [-0.9, 0.2, 1.1]) {
          const iceSpike = new THREE.Mesh(track(new THREE.ConeGeometry(0.22, 0.26, 5)), busAccentMat);
          iceSpike.position.set((iz > 0 ? 0.35 : -0.35), 2.0, iz);
          mesh.add(iceSpike);
        }
      } else {
        // circuito_synth: retro equalizer roof lightbars & sunset fins
        for (let b = -1; b <= 1; b++) {
          const eqBar = new THREE.Mesh(
            track(new THREE.BoxGeometry(0.38, 0.16, 1.8)),
            b === 0 ? goldNeonMat : pinkNeonMat
          );
          eqBar.position.set(b * 0.55, 1.96, -0.2);
          mesh.add(eqBar);
        }
      }

      halfWidth = 0.94;
      minY = 0;
      maxY = 1.98;
      halfDepth = 1.85;
    }

    group.add(mesh);

    const obs: ActiveObstacle = {
      id: nextObstacleId++,
      kind,
      mesh,
      lane: laneIndex - 1,
      x,
      z: zPos,
      prevZ: zPos,
      halfWidth,
      minY,
      maxY,
      halfDepth,
      spinTarget,
    };
    obstacles.push(obs);
    return obs;
  }

  // Spawn a clean, well-spaced aligned row of stationary coins along a lane
  function spawnCoinTrail(laneIndex: number, startZ: number, count = 3, spacing = 3.8) {
    for (let c = 0; c < count; c++) {
      createObstacleMesh('coin', laneIndex, startZ - c * spacing);
    }
  }

  const SPECIAL_3LANE_COIN_PATTERNS = new Set([
    'underWithTopCoins',
    'tripleLaneCoins',
    'coinWall',
  ]);

  function pickPattern(): string {
    if (isTrainingMode) {
      const trainingPool: Array<[string, number]> = [
        ['underWithTopCoins', lastTrainingPattern === 'underWithTopCoins' ? 3 : 6],
        ['tripleLaneCoins', lastTrainingPattern === 'tripleLaneCoins' ? 1 : 3],
        ['coinWall', lastTrainingPattern === 'coinWall' ? 1 : 3],
      ];
      const total = trainingPool.reduce((acc, [, w]) => acc + w, 0);
      let r = Math.random() * total;
      for (const [key, w] of trainingPool) {
        r -= w;
        if (r <= 0) {
          lastTrainingPattern = key;
          return key;
        }
      }
      lastTrainingPattern = 'underWithTopCoins';
      return 'underWithTopCoins';
    }

    const entries = Object.entries(map.patternWeights).filter(([key]) => {
      if (key === 'underWithTopCoins') {
        return patternStep >= 6 && patternsSince3LaneCoins >= 13 && patternsSinceUnderWithCoins >= 13;
      }
      if (SPECIAL_3LANE_COIN_PATTERNS.has(key)) {
        return patternStep >= 6 && patternsSince3LaneCoins >= 13;
      }
      return true;
    });

    const pool = entries.length > 0 ? entries : Object.entries(map.patternWeights);
    const total = pool.reduce((acc, [, w]) => acc + w, 0);
    let r = Math.random() * total;
    for (const [key, w] of pool) {
      r -= w;
      if (r <= 0) return key;
    }
    return 'busDodge';
  }

  // Organized, readable patterns with generous spacing and cooldowns on 3-lane coin specials
  function spawnPatternAt(zPos: number, elapsed: number): number {
    patternStep++;
    const difficulty = Math.min(1, elapsed / 80);
    const pattern = pickPattern();
    if (pattern === 'underWithTopCoins') {
      patternsSinceUnderWithCoins = 0;
      patternsSince3LaneCoins = 0;
    } else if (SPECIAL_3LANE_COIN_PATTERNS.has(pattern)) {
      patternsSince3LaneCoins = 0;
      patternsSinceUnderWithCoins++;
    } else {
      patternsSince3LaneCoins++;
      patternsSinceUnderWithCoins++;
    }
    const safeLane = Math.floor(Math.random() * 3); // 0, 1, 2

    if (pattern === 'underWithTopCoins') {
      // All 3 pass-under gates share the exact same 5-coin arc starting on the ground, curving high over the gate, and landing on the ground:
      // Mid coins at y=2.52 clear a standing/jump-start head height (1.85m), keeping the burla smooth and fair.
      const arc: Array<[number, number]> = [
        [9.0, 0.54],
        [4.5, 2.52],
        [0, 3.15],
        [-4.5, 2.52],
        [-9.0, 0.54],
      ];
      for (let l = 0; l < 3; l++) {
        createObstacleMesh('barrier_high', l, zPos);
        for (const [dz, cy] of arc) {
          createObstacleMesh('coin', l, zPos + dz, cy);
        }
      }
      return 26;
    }

    if (pattern === 'tripleLaneCoins') {
      // All 3 lanes have aligned, wide-spaced rows of 3 coins — jump over or weave cleanly through the gaps!
      for (let l = 0; l < 3; l++) {
        spawnCoinTrail(l, zPos, 3, 4.2);
      }
      return 19;
    }

    if (pattern === 'busDodge') {
      // 1 or 2 themed jumpable buses; always keeps at least 1 open lane AND players can jump over buses
      const busCount = difficulty > 0.25 && Math.random() < 0.65 ? 2 : 1;
      if (busCount === 1) {
        const busLane = (safeLane + 1) % 3;
        createObstacleMesh('bus', busLane, zPos - 2);
        if (Math.random() < 0.42) {
          const coinLane = (safeLane + 2) % 3;
          spawnCoinTrail(coinLane, zPos, 4, 3.8);
          return 21;
        }
        return 14;
      }

      for (let l = 0; l < 3; l++) {
        if (l !== safeLane) {
          createObstacleMesh('bus', l, zPos - 2);
        }
      }
      return 16;
    }

    if (pattern === 'coinWall') {
      // All 3 lanes have aligned, well-spaced rows of 4 coins (3.6m apart, jump over or weave through gaps!)
      for (let l = 0; l < 3; l++) {
        spawnCoinTrail(l, zPos, 4, 3.6);
      }
      return 21;
    }

    if (pattern === 'lowHighCombo') {
      const jumpOrSlide: ObstacleKind = Math.random() < 0.5 ? 'barrier_low' : 'barrier_high';
      for (let l = 0; l < 3; l++) {
        if (l === safeLane) {
          createObstacleMesh(jumpOrSlide, l, zPos);
        } else if (l === (safeLane + 1) % 3) {
          createObstacleMesh('bus', l, zPos - 1.5);
        }
      }
      return 14;
    }

    if (pattern === 'laserSweep') {
      for (let l = 0; l < 3; l++) {
        if (l !== safeLane) {
          const laserType: ObstacleKind = Math.random() < 0.5 ? 'laser_low' : 'laser_high';
          createObstacleMesh(laserType, l, zPos);
        }
      }
      return 12;
    }

    // pitJump: clean chasm in 1 lane + well-spaced coin row in 1 side lane
    const pitLane = (safeLane + 1) % 3;
    const coinLane = (safeLane + 2) % 3;
    createObstacleMesh('pit', pitLane, zPos - 2);
    spawnCoinTrail(coinLane, zPos, 4, 3.6);
    return 20;
  }

  function consumeObstacle(id: number) {
    const idx = obstacles.findIndex((o) => o.id === id);
    if (idx !== -1) {
      group.remove(obstacles[idx].mesh);
      obstacles.splice(idx, 1);
    }
  }

  function resetObstacles() {
    for (const obs of obstacles) {
      group.remove(obs.mesh);
    }
    obstacles.length = 0;
    spawnCursorZ = -48;
    patternStep = 0;
    patternsSince3LaneCoins = 0;
    patternsSinceUnderWithCoins = 0;
    lastTrainingPattern = '';
  }

  function setTrainingMode(enabled: boolean) {
    if (isTrainingMode === enabled) return;
    isTrainingMode = enabled;
    resetObstacles();
  }

  function update(dt: number, elapsed: number, speed: number, isPlaying: boolean) {
    const stepZ = speed * dt;
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      seg.position.z += stepZ;
      if (seg.position.z > SEGMENT_LENGTH) {
        seg.position.z -= SEGMENT_COUNT * SEGMENT_LENGTH;
      }
    }

    if (!isPlaying) return;

    for (let i = obstacles.length - 1; i >= 0; i--) {
      const obs = obstacles[i];
      obs.prevZ = obs.z;
      obs.z += stepZ;
      obs.mesh.position.z = obs.z;

      if (obs.z > 14) {
        group.remove(obs.mesh);
        obstacles.splice(i, 1);
      }
    }

    spawnCursorZ += stepZ;
    const baseGap = Math.max(13, 21 - Math.min(8, elapsed * 0.11));
    while (spawnCursorZ > -165) {
      const consumed = spawnPatternAt(spawnCursorZ, elapsed);
      spawnCursorZ -= consumed + baseGap + Math.random() * 4.0;
    }
  }

  const dispose = () => {
    resetObstacles();
    for (let i = 0; i < disposables.length; i++) {
      disposables[i].dispose();
    }
  };

  return {
    group,
    obstacles,
    setTrainingMode,
    update,
    consumeObstacle,
    resetObstacles,
    dispose,
  };
}
