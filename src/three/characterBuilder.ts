import * as THREE from 'three';
import type { EquippedLoadout } from '../types/game';
import {
  createCapeTextTexture,
  createContactShadowTexture,
  createConveyorTexture,
  createEyewearTextTexture,
  createOutfitTextures,
  createParticleTexture,
} from './textures';

export interface CharacterRig {
  root: THREE.Group;
  bodyRoot: THREE.Group;
  hips: THREE.Group;
  torso: THREE.Mesh;
  headGroup: THREE.Group;
  leftArmPivot: THREE.Group;
  rightArmPivot: THREE.Group;
  leftLegPivot: THREE.Group;
  rightLegPivot: THREE.Group;
  contactShadow: THREE.Mesh;
  update: (
    time: number,
    dt: number,
    speed: number,
    lateralVel: number,
    isJumping: boolean,
    isSliding: boolean,
    isLobby: boolean
  ) => void;
  dispose: () => void;
}

interface ParticleState {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  baseHue: number;
  orbitAngle: number;
  orbitRadius: number;
}

const _tmpColor = new THREE.Color();

function toCssHex(hex: number): string {
  return '#' + hex.toString(16).padStart(6, '0');
}

export function buildCharacterRig(
  loadout: EquippedLoadout,
  noTextures: boolean,
  maxAnisotropy: number
): CharacterRig {
  const disposables: Array<{ dispose: () => void }> = [];
  const track = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  const root = new THREE.Group();
  const bodyRoot = new THREE.Group();
  root.add(bodyRoot);

  // Contact shadow grounded at y = 0.02
  const shadowGeo = track(new THREE.PlaneGeometry(1.4, 1.4));
  const shadowMat = track(
    new THREE.MeshBasicMaterial({
      map: noTextures ? null : track(createContactShadowTexture()),
      color: noTextures ? 0x050505 : 0xffffff,
      transparent: true,
      opacity: noTextures ? 0.35 : 0.78,
      depthWrite: false,
    })
  );
  const contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = 0.02;
  root.add(contactShadow);

  // Determine suit palette & skin/pants colors
  let primaryHex = 0x1e293b;
  let secondaryHex = 0x06b6d4;
  let underHex = 0x0f172a;
  let skinHex = 0xf1c29b;
  let sleeveHex = 0x1e293b;
  let gloveHex = 0x06b6d4;
  let pantsHex = 0x0f172a;
  let bootHex = 0x06b6d4;
  let metalness = 0.3;
  let roughness = 0.45;
  let emissiveHex = 0x000000;
  let emissiveIntensity = 0;
  let isCyberArmorSuit = true;

  switch (loadout.suit) {
    case 'suit_mumia':
      primaryHex = 0xe7e5e4;
      secondaryHex = 0xd97706;
      underHex = 0xa8a29e;
      skinHex = 0xd6d3d1;
      sleeveHex = 0xe7e5e4;
      gloveHex = 0xd6d3d1;
      pantsHex = 0xe7e5e4;
      bootHex = 0xa8a29e;
      metalness = 0.05;
      roughness = 0.88;
      isCyberArmorSuit = false;
      break;
    case 'suit_bandido':
      primaryHex = 0x18181b;
      secondaryHex = 0xdc2626;
      underHex = 0x09090b;
      skinHex = 0xf1c29b;
      sleeveHex = 0x18181b;
      gloveHex = 0x27272a;
      pantsHex = 0x18181b;
      bootHex = 0x451a03;
      metalness = 0.15;
      roughness = 0.65;
      isCyberArmorSuit = false;
      break;
    case 'suit_prisioneiro':
      primaryHex = 0xea580c;
      secondaryHex = 0x18181b;
      underHex = 0x27272a;
      skinHex = 0xf1c29b;
      sleeveHex = 0xea580c;
      gloveHex = 0xf1c29b;
      pantsHex = 0xea580c;
      bootHex = 0x18181b;
      metalness = 0.08;
      roughness = 0.72;
      isCyberArmorSuit = false;
      break;
    case 'suit_futebol':
      primaryHex = 0x16a34a;
      secondaryHex = 0xfacc15;
      underHex = 0x1d4ed8;
      skinHex = 0xf1c29b;
      sleeveHex = 0x16a34a;
      gloveHex = 0xf1c29b;
      pantsHex = 0x1d4ed8;
      bootHex = 0x09090b;
      metalness = 0.08;
      roughness = 0.65;
      isCyberArmorSuit = false;
      break;
    case 'suit_ninja':
      primaryHex = 0x0f172a;
      secondaryHex = 0xef4444;
      underHex = 0x020617;
      skinHex = 0x0f172a;
      sleeveHex = 0x0f172a;
      gloveHex = 0xef4444;
      pantsHex = 0x0f172a;
      bootHex = 0x020617;
      metalness = 0.22;
      roughness = 0.55;
      isCyberArmorSuit = false;
      break;
    case 'suit_ciborgue':
      primaryHex = 0x64748b;
      secondaryHex = 0x22d3ee;
      underHex = 0x334155;
      skinHex = 0x94a3b8;
      sleeveHex = 0x475569;
      gloveHex = 0x22d3ee;
      pantsHex = 0x334155;
      bootHex = 0x22d3ee;
      metalness = 0.85;
      roughness = 0.22;
      isCyberArmorSuit = true;
      break;
    case 'suit_samurai':
      primaryHex = 0x991b1b;
      secondaryHex = 0xfacc15;
      underHex = 0x18181b;
      skinHex = 0xf1c29b;
      sleeveHex = 0x991b1b;
      gloveHex = 0x18181b;
      pantsHex = 0x18181b;
      bootHex = 0x7f1d1d;
      metalness = 0.6;
      roughness = 0.3;
      isCyberArmorSuit = false;
      break;
    case 'suit_astronauta':
      primaryHex = 0xf8fafc;
      secondaryHex = 0xeab308;
      underHex = 0xcbd5e1;
      skinHex = 0xf8fafc;
      sleeveHex = 0xf8fafc;
      gloveHex = 0xeab308;
      pantsHex = 0xf1f5f9;
      bootHex = 0x94a3b8;
      metalness = 0.25;
      roughness = 0.35;
      isCyberArmorSuit = false;
      break;
    case 'suit_pirata':
      primaryHex = 0x7f1d1d;
      secondaryHex = 0xf59e0b;
      underHex = 0x1c1917;
      skinHex = 0xeab68c;
      sleeveHex = 0x7f1d1d;
      gloveHex = 0xf59e0b;
      pantsHex = 0x1c1917;
      bootHex = 0x451a03;
      metalness = 0.18;
      roughness = 0.65;
      isCyberArmorSuit = false;
      break;
    case 'suit_cavaleiro':
      primaryHex = 0x94a3b8;
      secondaryHex = 0x2563eb;
      underHex = 0x475569;
      skinHex = 0x94a3b8;
      sleeveHex = 0x94a3b8;
      gloveHex = 0x64748b;
      pantsHex = 0x64748b;
      bootHex = 0x94a3b8;
      metalness = 0.88;
      roughness = 0.2;
      isCyberArmorSuit = false;
      break;
    case 'suit_bombeiro':
      primaryHex = 0xdc2626;
      secondaryHex = 0xfde047;
      underHex = 0x450a0a;
      skinHex = 0xf1c29b;
      sleeveHex = 0xdc2626;
      gloveHex = 0x18181b;
      pantsHex = 0xb91c1c;
      bootHex = 0xfde047;
      metalness = 0.15;
      roughness = 0.48;
      isCyberArmorSuit = false;
      break;
    case 'suit_policial':
      primaryHex = 0x172554;
      secondaryHex = 0x38bdf8;
      underHex = 0x0f172a;
      skinHex = 0xf1c29b;
      sleeveHex = 0x172554;
      gloveHex = 0x09090b;
      pantsHex = 0x1e3a8a;
      bootHex = 0x09090b;
      metalness = 0.22;
      roughness = 0.52;
      isCyberArmorSuit = false;
      break;
    case 'suit_esqueleto':
      primaryHex = 0x09090b;
      secondaryHex = 0xf8fafc;
      underHex = 0x050505;
      skinHex = 0xf8fafc;
      sleeveHex = 0x09090b;
      gloveHex = 0xf8fafc;
      pantsHex = 0x09090b;
      bootHex = 0xf8fafc;
      metalness = 0.1;
      roughness = 0.78;
      isCyberArmorSuit = false;
      break;
    case 'suit_mago':
      primaryHex = 0x581c87;
      secondaryHex = 0xfbbf24;
      underHex = 0x2e1065;
      skinHex = 0xf1c29b;
      sleeveHex = 0x581c87;
      gloveHex = 0xfbbf24;
      pantsHex = 0x3b0764;
      bootHex = 0x78350f;
      metalness = 0.2;
      roughness = 0.55;
      isCyberArmorSuit = false;
      break;
    case 'suit_agente':
      primaryHex = 0x111827;
      secondaryHex = 0xe11d48;
      underHex = 0x030712;
      skinHex = 0xf1c29b;
      sleeveHex = 0x111827;
      gloveHex = 0xf1c29b;
      pantsHex = 0x111827;
      bootHex = 0x030712;
      metalness = 0.15;
      roughness = 0.5;
      isCyberArmorSuit = false;
      break;
    case 'suit_piloto':
      primaryHex = 0xef4444;
      secondaryHex = 0xffffff;
      underHex = 0x18181b;
      skinHex = 0xef4444;
      sleeveHex = 0xef4444;
      gloveHex = 0xffffff;
      pantsHex = 0xdc2626;
      bootHex = 0xffffff;
      metalness = 0.35;
      roughness = 0.32;
      isCyberArmorSuit = false;
      break;
    case 'suit_skatista':
      primaryHex = 0x0d9488;
      secondaryHex = 0xf97316;
      underHex = 0x1e293b;
      skinHex = 0xf1c29b;
      sleeveHex = 0x0d9488;
      gloveHex = 0xf1c29b;
      pantsHex = 0x334155;
      bootHex = 0xf97316;
      metalness = 0.1;
      roughness = 0.68;
      isCyberArmorSuit = false;
      break;
    case 'suit_zumbi':
      primaryHex = 0x3f3f46;
      secondaryHex = 0x4ade80;
      underHex = 0x14532d;
      skinHex = 0x4ade80;
      sleeveHex = 0x3f3f46;
      gloveHex = 0x4ade80;
      pantsHex = 0x27272a;
      bootHex = 0x18181b;
      metalness = 0.08;
      roughness = 0.82;
      isCyberArmorSuit = false;
      break;
    case 'suit_vampiro':
      primaryHex = 0x1f122b;
      secondaryHex = 0xbe123c;
      underHex = 0x09050e;
      skinHex = 0xe2e8f0;
      sleeveHex = 0x1f122b;
      gloveHex = 0xe2e8f0;
      pantsHex = 0x09050e;
      bootHex = 0x4c0519;
      metalness = 0.2;
      roughness = 0.52;
      isCyberArmorSuit = false;
      break;
    case 'suit_farao':
      primaryHex = 0xeab308;
      secondaryHex = 0x06b6d4;
      underHex = 0x422006;
      skinHex = 0xd99b66;
      sleeveHex = 0xd99b66;
      gloveHex = 0xeab308;
      pantsHex = 0xfef3c7;
      bootHex = 0xeab308;
      metalness = 0.72;
      roughness = 0.26;
      isCyberArmorSuit = false;
      break;
    case 'suit_motociclista':
      primaryHex = 0x171717;
      secondaryHex = 0xfb923c;
      underHex = 0x0a0a0a;
      skinHex = 0x171717;
      sleeveHex = 0x171717;
      gloveHex = 0xfb923c;
      pantsHex = 0x171717;
      bootHex = 0xfb923c;
      metalness = 0.42;
      roughness = 0.36;
      isCyberArmorSuit = false;
      break;
    case 'suit_boxeador':
      primaryHex = 0xd97757;
      secondaryHex = 0xfacc15;
      underHex = 0x7f1d1d;
      skinHex = 0xd97757;
      sleeveHex = 0xd97757;
      gloveHex = 0xdc2626;
      pantsHex = 0xb91c1c;
      bootHex = 0xfacc15;
      metalness = 0.14;
      roughness = 0.55;
      isCyberArmorSuit = false;
      break;
    case 'suit_cromo':
      primaryHex = 0xcbd5e1;
      secondaryHex = 0xf59e0b;
      sleeveHex = 0xcbd5e1;
      gloveHex = 0xf59e0b;
      pantsHex = 0x475569;
      bootHex = 0xf59e0b;
      metalness = 0.85;
      roughness = 0.2;
      break;
    case 'suit_carmesim':
      primaryHex = 0x18181b;
      secondaryHex = 0xef4444;
      sleeveHex = 0x18181b;
      gloveHex = 0xef4444;
      pantsHex = 0x09090b;
      bootHex = 0xef4444;
      metalness = 0.5;
      roughness = 0.35;
      break;
    case 'suit_artico':
      primaryHex = 0xf1f5f9;
      secondaryHex = 0x38bdf8;
      sleeveHex = 0xf1f5f9;
      gloveHex = 0x38bdf8;
      pantsHex = 0xcbd5e1;
      bootHex = 0x38bdf8;
      metalness = 0.25;
      roughness = 0.3;
      break;
    case 'suit_dourado':
      primaryHex = 0xeab308;
      secondaryHex = 0x1e293b;
      sleeveHex = 0xeab308;
      gloveHex = 0x1e293b;
      pantsHex = 0x1e293b;
      bootHex = 0xeab308;
      metalness = 0.9;
      roughness = 0.18;
      break;
    case 'suit_espectro':
      primaryHex = 0x1e1b4b;
      secondaryHex = 0xa855f7;
      sleeveHex = 0x1e1b4b;
      gloveHex = 0xa855f7;
      pantsHex = 0x0f172a;
      bootHex = 0xa855f7;
      metalness = 0.6;
      roughness = 0.3;
      break;
    case 'corpo_colorido':
      primaryHex = 0x22c55e;
      secondaryHex = 0xec4899;
      sleeveHex = 0x22c55e;
      gloveHex = 0xec4899;
      pantsHex = 0x3b82f6;
      bootHex = 0xec4899;
      metalness = 0.45;
      roughness = 0.25;
      emissiveHex = 0x38bdf8;
      emissiveIntensity = 0.45;
      break;
    case 'corpo_fogo':
      primaryHex = 0xdc2626;
      secondaryHex = 0xfbbf24;
      sleeveHex = 0xdc2626;
      gloveHex = 0xfbbf24;
      pantsHex = 0x991b1b;
      bootHex = 0xfbbf24;
      metalness = 0.2;
      roughness = 0.35;
      emissiveHex = 0xf97316;
      emissiveIntensity = 0.9;
      break;
    case 'corpo_todo_preto':
      primaryHex = 0x040404;
      secondaryHex = 0x0a0a0a;
      underHex = 0x030303;
      skinHex = 0x040404;
      sleeveHex = 0x040404;
      gloveHex = 0x050505;
      pantsHex = 0x040404;
      bootHex = 0x050505;
      metalness = 0.05;
      roughness = 0.92;
      isCyberArmorSuit = false;
      break;
  }

  if (noTextures) {
    if (loadout.suit === 'corpo_todo_preto') {
      primaryHex = 0x060606;
      secondaryHex = 0x141414;
      underHex = 0x050505;
      skinHex = 0x060606;
      sleeveHex = 0x060606;
      gloveHex = 0x141414;
      pantsHex = 0x060606;
      bootHex = 0x141414;
    } else {
      primaryHex = 0xd4d4d8;
      secondaryHex = 0x27272a;
      underHex = 0x52525b;
      skinHex = 0xe4e4e7;
      sleeveHex = 0xd4d4d8;
      gloveHex = 0x27272a;
      pantsHex = 0x52525b;
      bootHex = 0x27272a;
    }
    emissiveHex = 0x000000;
    emissiveIntensity = 0;
  }

  const primaryMat = track(
    new THREE.MeshStandardMaterial({
      color: primaryHex,
      metalness,
      roughness,
      emissive: emissiveHex,
      emissiveIntensity,
    })
  );

  const accentMat = track(
    new THREE.MeshStandardMaterial({
      color: secondaryHex,
      metalness: 0.4,
      roughness: 0.25,
      emissive: noTextures || loadout.suit === 'corpo_todo_preto' ? 0x000000 : secondaryHex,
      emissiveIntensity: noTextures || loadout.suit === 'corpo_todo_preto' ? 0 : 0.45,
    })
  );

  const darkUnderMat = track(
    new THREE.MeshStandardMaterial({
      color: underHex,
      metalness: 0.1,
      roughness: 0.78,
    })
  );

  const skinMat = track(
    new THREE.MeshStandardMaterial({
      color: skinHex,
      metalness: 0.05,
      roughness: 0.7,
    })
  );

  const sleeveMat = track(
    new THREE.MeshStandardMaterial({
      color: sleeveHex,
      metalness,
      roughness,
    })
  );

  const gloveMat = track(
    new THREE.MeshStandardMaterial({
      color: gloveHex,
      metalness: 0.2,
      roughness: 0.5,
    })
  );

  const pantsMat = track(
    new THREE.MeshStandardMaterial({
      color: pantsHex,
      metalness: 0.1,
      roughness: 0.72,
    })
  );

  const bootMat = track(
    new THREE.MeshStandardMaterial({
      color: bootHex,
      metalness: 0.25,
      roughness: 0.45,
    })
  );

  const useAnimatedBodyMat =
    loadout.suit === 'corpo_colorido' ||
    loadout.suit === 'corpo_fogo' ||
    loadout.suit === 'corpo_todo_preto';

  const outfitTex =
    noTextures || useAnimatedBodyMat
      ? null
      : createOutfitTextures(
          loadout.suit,
          toCssHex(primaryHex),
          toCssHex(secondaryHex),
          maxAnisotropy
        );

  if (outfitTex) {
    track(outfitTex.torsoFront);
    track(outfitTex.torsoBack);
    track(outfitTex.face);
  }

  // Hips & Torso
  const hips = new THREE.Group();
  hips.position.y = 0.95;
  bodyRoot.add(hips);

  const torsoGeo = track(new THREE.BoxGeometry(0.62, 0.72, 0.34));
  let torso: THREE.Mesh;
  if (outfitTex) {
    const tFrontMat = track(
      new THREE.MeshStandardMaterial({ map: outfitTex.torsoFront, roughness: roughness, metalness })
    );
    const tBackMat = track(
      new THREE.MeshStandardMaterial({ map: outfitTex.torsoBack, roughness: roughness, metalness })
    );
    torso = new THREE.Mesh(torsoGeo, [
      primaryMat,
      primaryMat,
      primaryMat,
      primaryMat,
      tBackMat, // +Z back
      tFrontMat, // -Z front
    ]);
  } else {
    torso = new THREE.Mesh(torsoGeo, primaryMat);
  }
  torso.position.y = 0.36;
  torso.castShadow = true;
  hips.add(torso);

  // Futuristic chest armor plates ONLY on cyber armor suits so costume shirts/badges show cleanly
  if (isCyberArmorSuit) {
    const chestPlateGeo = track(new THREE.BoxGeometry(0.5, 0.34, 0.38));
    const chestPlate = new THREE.Mesh(chestPlateGeo, darkUnderMat);
    chestPlate.position.set(0, 0.44, 0.01);
    hips.add(chestPlate);

    const coreStripGeo = track(new THREE.BoxGeometry(0.12, 0.26, 0.4));
    const coreStrip = new THREE.Mesh(coreStripGeo, accentMat);
    coreStrip.position.set(0, 0.44, 0.01);
    hips.add(coreStrip);
  }

  // Shoulder pads on armored/uniform suits
  if (
    isCyberArmorSuit ||
    loadout.suit === 'suit_cavaleiro' ||
    loadout.suit === 'suit_samurai' ||
    loadout.suit === 'suit_policial' ||
    loadout.suit === 'suit_astronauta' ||
    loadout.suit === 'suit_motociclista'
  ) {
    const padGeo = track(new THREE.BoxGeometry(0.22, 0.14, 0.36));
    const padMat = loadout.suit === 'suit_policial' ? primaryMat : accentMat;
    const leftPad = new THREE.Mesh(padGeo, padMat);
    leftPad.position.set(-0.38, 0.68, 0);
    hips.add(leftPad);
    const rightPad = new THREE.Mesh(padGeo, padMat);
    rightPad.position.set(0.38, 0.68, 0);
    hips.add(rightPad);
  }

  // Head Group (head sits from y=0.01 to y=0.43 inside headGroup)
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.8, 0);
  hips.add(headGroup);

  const headGeo = track(new THREE.BoxGeometry(0.42, 0.42, 0.42));
  let headMesh: THREE.Mesh;
  if (outfitTex) {
    const faceMat = track(
      new THREE.MeshStandardMaterial({ map: outfitTex.face, roughness: 0.62, metalness: 0.05 })
    );
    const headBaseMat =
      loadout.suit === 'suit_mumia' ||
      loadout.suit === 'suit_esqueleto' ||
      loadout.suit === 'suit_astronauta' ||
      loadout.suit === 'suit_cavaleiro' ||
      loadout.suit === 'suit_piloto' ||
      loadout.suit === 'suit_motociclista'
        ? primaryMat
        : skinMat;
    headMesh = new THREE.Mesh(headGeo, [
      headBaseMat,
      headBaseMat,
      headBaseMat,
      headBaseMat,
      headBaseMat, // +Z back
      faceMat, // -Z front
    ]);
  } else {
    headMesh = new THREE.Mesh(headGeo, primaryMat);
  }
  headMesh.position.y = 0.22;
  headMesh.castShadow = true;
  headGroup.add(headMesh);

  // Default cyber visor ONLY for cyber/helmet suits (hidden if custom eyewear equipped)
  const visorGeo = track(new THREE.BoxGeometry(0.38, 0.12, 0.08));
  const visorMesh = new THREE.Mesh(visorGeo, accentMat);
  visorMesh.position.set(0, 0.24, -0.2);
  visorMesh.visible =
    isCyberArmorSuit ||
    loadout.suit === 'suit_piloto' ||
    loadout.suit === 'suit_motociclista';
  headGroup.add(visorMesh);

  const dynamicUpdaters: Array<(
    t: number,
    dt: number,
    speed: number,
    lateralVel: number,
    isLobby: boolean,
    isSliding: boolean
  ) => void> = [];

  // ==============================================================
  // BESPOKE 3D COSTUME GEOMETRY FOR ALL CHARACTERS
  // ==============================================================
  const hasCustomHair = Boolean(loadout.hair);
  const goldMat = track(
    new THREE.MeshStandardMaterial({
      color: noTextures ? 0xe4e4e7 : 0xfacc15,
      metalness: 0.85,
      roughness: 0.22,
    })
  );
  const darkLeatherMat = track(
    new THREE.MeshStandardMaterial({
      color: noTextures ? 0x27272a : 0x451a03,
      roughness: 0.72,
      metalness: 0.15,
    })
  );
  const whiteClothMat = track(
    new THREE.MeshStandardMaterial({
      color: noTextures ? 0xf4f4f5 : 0xf8fafc,
      roughness: 0.65,
      metalness: 0.05,
    })
  );

  if (loadout.suit === 'suit_policial') {
    // 3D Gold badge + belt + flashing red/blue shoulder lights + peaked police cap
    const badge = new THREE.Mesh(track(new THREE.CylinderGeometry(0.065, 0.065, 0.04, 6)), goldMat);
    badge.rotation.x = Math.PI / 2;
    badge.position.set(-0.16, 0.52, -0.19);
    hips.add(badge);

    const belt = new THREE.Mesh(track(new THREE.BoxGeometry(0.66, 0.1, 0.38)), darkUnderMat);
    belt.position.y = 0.08;
    hips.add(belt);
    const buckle = new THREE.Mesh(track(new THREE.BoxGeometry(0.12, 0.11, 0.4)), goldMat);
    buckle.position.y = 0.08;
    hips.add(buckle);

    const sirenRedMat = track(
      new THREE.MeshStandardMaterial({
        color: noTextures ? 0xf4f4f5 : 0xef4444,
        emissive: noTextures ? 0 : 0xef4444,
        emissiveIntensity: 1.1,
      })
    );
    const sirenBlueMat = track(
      new THREE.MeshStandardMaterial({
        color: noTextures ? 0xa1a1aa : 0x38bdf8,
        emissive: noTextures ? 0 : 0x38bdf8,
        emissiveIntensity: 1.1,
      })
    );
    const sirenL = new THREE.Mesh(track(new THREE.BoxGeometry(0.14, 0.09, 0.14)), sirenRedMat);
    sirenL.position.set(-0.38, 0.78, 0);
    hips.add(sirenL);
    const sirenR = new THREE.Mesh(track(new THREE.BoxGeometry(0.14, 0.09, 0.14)), sirenBlueMat);
    sirenR.position.set(0.38, 0.78, 0);
    hips.add(sirenR);

    dynamicUpdaters.push((t) => {
      if (noTextures) return;
      const pulse = Math.sin(t * 10) > 0;
      sirenRedMat.emissiveIntensity = pulse ? 1.5 : 0.2;
      sirenBlueMat.emissiveIntensity = pulse ? 0.2 : 1.5;
    });

    if (!hasCustomHair) {
      // Police peaked cap
      const capTop = new THREE.Mesh(track(new THREE.CylinderGeometry(0.28, 0.24, 0.14, 12)), primaryMat);
      capTop.position.set(0, 0.49, 0);
      headGroup.add(capTop);
      const capBand = new THREE.Mesh(track(new THREE.CylinderGeometry(0.245, 0.245, 0.06, 12)), darkUnderMat);
      capBand.position.set(0, 0.43, 0);
      headGroup.add(capBand);
      const capVisor = new THREE.Mesh(track(new THREE.BoxGeometry(0.36, 0.04, 0.2)), darkUnderMat);
      capVisor.position.set(0, 0.41, -0.22);
      headGroup.add(capVisor);
      const capStar = new THREE.Mesh(track(new THREE.OctahedronGeometry(0.05, 0)), goldMat);
      capStar.position.set(0, 0.5, -0.24);
      headGroup.add(capStar);
    }
  } else if (loadout.suit === 'suit_bandido') {
    // Bandit scarf collar, diagonal bandolier, loot sack on back & beanie
    const scarf = new THREE.Mesh(track(new THREE.BoxGeometry(0.48, 0.14, 0.48)), accentMat);
    scarf.position.y = 0.08;
    headGroup.add(scarf);

    const strap = new THREE.Mesh(track(new THREE.BoxGeometry(0.1, 0.76, 0.39)), darkLeatherMat);
    strap.position.set(0, 0.38, 0);
    strap.rotation.z = 0.58;
    hips.add(strap);

    if (!loadout.cape) {
      const sack = new THREE.Mesh(track(new THREE.DodecahedronGeometry(0.26, 0)), darkLeatherMat);
      sack.position.set(0, 0.38, 0.27);
      sack.scale.set(1, 1.25, 0.85);
      hips.add(sack);
      const tieCord = new THREE.Mesh(track(new THREE.CylinderGeometry(0.09, 0.14, 0.1, 8)), goldMat);
      tieCord.position.set(0, 0.64, 0.27);
      hips.add(tieCord);
    }

    if (!hasCustomHair) {
      const beanie = new THREE.Mesh(track(new THREE.SphereGeometry(0.25, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55)), darkUnderMat);
      beanie.position.set(0, 0.38, 0);
      headGroup.add(beanie);
      const cuff = new THREE.Mesh(track(new THREE.BoxGeometry(0.45, 0.08, 0.45)), darkUnderMat);
      cuff.position.set(0, 0.4, 0);
      headGroup.add(cuff);
    }
  } else if (loadout.suit === 'suit_prisioneiro') {
    // Prison stripes + broken metallic wrist shackles + inmate cap
    const chainMat = track(new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.85, roughness: 0.25 }));
    const shackleL = new THREE.Mesh(track(new THREE.TorusGeometry(0.11, 0.025, 8, 14)), chainMat);
    shackleL.rotation.x = Math.PI / 2;
    shackleL.position.set(-0.2, -0.66, 0);
    hips.add(shackleL);
    if (!hasCustomHair) {
      const cap = new THREE.Mesh(track(new THREE.BoxGeometry(0.44, 0.1, 0.44)), primaryMat);
      cap.position.y = 0.45;
      headGroup.add(cap);
    }
  } else if (loadout.suit === 'suit_mumia') {
    // 3D crossed mummy wraps on torso & dangling cloth ribbon
    const wrapMat = track(new THREE.MeshStandardMaterial({ color: noTextures ? 0xe4e4e7 : 0xd6d3d1, roughness: 0.9 }));
    for (let i = 0; i < 4; i++) {
      const band = new THREE.Mesh(track(new THREE.BoxGeometry(0.66, 0.085, 0.4)), wrapMat);
      band.position.y = 0.14 + i * 0.16;
      band.rotation.z = (i % 2 === 0 ? 1 : -1) * 0.11;
      hips.add(band);
    }
    const danglingStrip = new THREE.Mesh(track(new THREE.BoxGeometry(0.1, 0.55, 0.04)), wrapMat);
    danglingStrip.position.set(0.24, 0.25, 0.22);
    danglingStrip.rotation.z = 0.18;
    hips.add(danglingStrip);
  } else if (loadout.suit === 'suit_futebol') {
    // Soccer socks + cleats + sporty hair tuft if no custom hair
    const sockGeo = track(new THREE.BoxGeometry(0.24, 0.34, 0.26));
    const sockMat = track(new THREE.MeshStandardMaterial({ color: noTextures ? 0xd4d4d8 : 0x16a34a, roughness: 0.6 }));
    // Attach socks near bottom of legs
    const beltTrim = new THREE.Mesh(track(new THREE.BoxGeometry(0.64, 0.07, 0.36)), accentMat);
    beltTrim.position.y = 0.04;
    hips.add(beltTrim);
    const sockL = new THREE.Mesh(sockGeo, sockMat);
    sockL.position.set(-0.18, -0.52, 0);
    hips.add(sockL);
    const sockR = new THREE.Mesh(sockGeo, sockMat);
    sockR.position.set(0.18, -0.52, 0);
    hips.add(sockR);
    if (!hasCustomHair) {
      const hair = new THREE.Mesh(track(new THREE.BoxGeometry(0.44, 0.12, 0.44)), darkUnderMat);
      hair.position.set(0, 0.45, 0.01);
      headGroup.add(hair);
    }
  } else if (loadout.suit === 'suit_ninja') {
    // Ninja hood + diagonal katana scabbard on back + long red scarf
    const katana = new THREE.Mesh(track(new THREE.BoxGeometry(0.08, 1.05, 0.08)), darkUnderMat);
    katana.position.set(0.04, 0.48, 0.23);
    katana.rotation.z = -0.62;
    hips.add(katana);
    const hilt = new THREE.Mesh(track(new THREE.CylinderGeometry(0.05, 0.05, 0.18, 8)), goldMat);
    hilt.position.set(-0.28, 0.92, 0.23);
    hilt.rotation.z = -0.62;
    hips.add(hilt);

    const scarfRing = new THREE.Mesh(track(new THREE.BoxGeometry(0.48, 0.13, 0.48)), accentMat);
    scarfRing.position.y = 0.06;
    headGroup.add(scarfRing);

    const scarfTail = new THREE.Mesh(track(new THREE.BoxGeometry(0.14, 0.05, 0.58)), accentMat);
    scarfTail.position.set(0.1, 0.05, 0.38);
    scarfTail.rotation.x = 0.25;
    headGroup.add(scarfTail);
  } else if (loadout.suit === 'suit_samurai') {
    // Samurai waist plates (kusazuri) + Kabuto helmet with gold crescent horns
    const waistPlate = new THREE.Mesh(track(new THREE.BoxGeometry(0.7, 0.2, 0.42)), primaryMat);
    waistPlate.position.y = 0.05;
    hips.add(waistPlate);
    if (!hasCustomHair) {
      const kabuto = new THREE.Mesh(track(new THREE.CylinderGeometry(0.28, 0.34, 0.18, 8)), primaryMat);
      kabuto.position.y = 0.46;
      headGroup.add(kabuto);
      const hornL = new THREE.Mesh(track(new THREE.BoxGeometry(0.06, 0.28, 0.05)), goldMat);
      hornL.position.set(-0.14, 0.6, -0.18);
      hornL.rotation.z = 0.45;
      headGroup.add(hornL);
      const hornR = new THREE.Mesh(track(new THREE.BoxGeometry(0.06, 0.28, 0.05)), goldMat);
      hornR.position.set(0.14, 0.6, -0.18);
      hornR.rotation.z = -0.45;
      headGroup.add(hornR);
    }
  } else if (loadout.suit === 'suit_astronauta') {
    // Space backpack + rounded helmet dome + gold reflective visor
    const pack = new THREE.Mesh(track(new THREE.BoxGeometry(0.48, 0.54, 0.24)), darkUnderMat);
    pack.position.set(0, 0.42, 0.24);
    hips.add(pack);
    const thrusterMat = track(new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: noTextures ? 0 : 0x38bdf8, emissiveIntensity: 0.8 }));
    for (const sx of [-0.14, 0.14]) {
      const nozzle = new THREE.Mesh(track(new THREE.CylinderGeometry(0.06, 0.08, 0.14, 8)), thrusterMat);
      nozzle.position.set(sx, 0.14, 0.28);
      hips.add(nozzle);
    }
    if (!hasCustomHair) {
      const dome = new THREE.Mesh(track(new THREE.BoxGeometry(0.5, 0.48, 0.5)), primaryMat);
      dome.position.y = 0.22;
      headGroup.add(dome);
      const goldVisor = new THREE.Mesh(track(new THREE.BoxGeometry(0.4, 0.26, 0.08)), goldMat);
      goldVisor.position.set(0, 0.25, -0.23);
      headGroup.add(goldVisor);
    }
  } else if (loadout.suit === 'suit_pirata') {
    // Captain tricorne hat + gold belt buckle + sash
    const belt = new THREE.Mesh(track(new THREE.BoxGeometry(0.66, 0.12, 0.38)), darkLeatherMat);
    belt.position.y = 0.08;
    hips.add(belt);
    const buckle = new THREE.Mesh(track(new THREE.BoxGeometry(0.14, 0.13, 0.4)), goldMat);
    buckle.position.y = 0.08;
    hips.add(buckle);
    if (!hasCustomHair) {
      const hatBrim = new THREE.Mesh(track(new THREE.CylinderGeometry(0.42, 0.42, 0.05, 3)), darkUnderMat);
      hatBrim.position.set(0, 0.45, -0.02);
      hatBrim.rotation.y = Math.PI;
      headGroup.add(hatBrim);
      const hatCrown = new THREE.Mesh(track(new THREE.CylinderGeometry(0.24, 0.26, 0.2, 8)), darkUnderMat);
      hatCrown.position.y = 0.54;
      headGroup.add(hatCrown);
      const skullPin = new THREE.Mesh(track(new THREE.SphereGeometry(0.06, 8, 8)), whiteClothMat);
      skullPin.position.set(0, 0.55, -0.24);
      headGroup.add(skullPin);
    }
  } else if (loadout.suit === 'suit_cavaleiro') {
    // Knight helmet + plume + steel belt
    const belt = new THREE.Mesh(track(new THREE.BoxGeometry(0.66, 0.1, 0.38)), goldMat);
    belt.position.y = 0.08;
    hips.add(belt);
    if (!hasCustomHair) {
      const helm = new THREE.Mesh(track(new THREE.BoxGeometry(0.48, 0.48, 0.48)), primaryMat);
      helm.position.y = 0.23;
      headGroup.add(helm);
      const visorSlit = new THREE.Mesh(track(new THREE.BoxGeometry(0.38, 0.1, 0.08)), darkUnderMat);
      visorSlit.position.set(0, 0.25, -0.23);
      headGroup.add(visorSlit);
      const plume = new THREE.Mesh(track(new THREE.BoxGeometry(0.1, 0.2, 0.46)), accentMat);
      plume.position.set(0, 0.54, 0.04);
      headGroup.add(plume);
    }
  } else if (loadout.suit === 'suit_bombeiro') {
    // Yellow oxygen tank + firefighter helmet with visor
    const tank = new THREE.Mesh(track(new THREE.CylinderGeometry(0.12, 0.12, 0.5, 10)), accentMat);
    tank.position.set(0, 0.42, 0.24);
    hips.add(tank);
    if (!hasCustomHair) {
      const helm = new THREE.Mesh(track(new THREE.CylinderGeometry(0.27, 0.3, 0.22, 12)), primaryMat);
      helm.position.y = 0.48;
      headGroup.add(helm);
      const brim = new THREE.Mesh(track(new THREE.CylinderGeometry(0.35, 0.37, 0.05, 12)), accentMat);
      brim.position.set(0, 0.41, 0.04);
      headGroup.add(brim);
    }
  } else if (loadout.suit === 'suit_esqueleto') {
    // 3D sculpted ribcage & spine
    for (let i = 0; i < 4; i++) {
      const rib = new THREE.Mesh(track(new THREE.BoxGeometry(0.5, 0.06, 0.39)), accentMat);
      rib.position.y = 0.2 + i * 0.13;
      hips.add(rib);
    }
  } else if (loadout.suit === 'suit_mago') {
    // Pointed wizard hat with gold band + floating arcane orb
    const belt = new THREE.Mesh(track(new THREE.BoxGeometry(0.66, 0.1, 0.38)), goldMat);
    belt.position.y = 0.08;
    hips.add(belt);
    if (!hasCustomHair) {
      const brim = new THREE.Mesh(track(new THREE.CylinderGeometry(0.46, 0.46, 0.04, 16)), primaryMat);
      brim.position.y = 0.44;
      headGroup.add(brim);
      const cone = new THREE.Mesh(track(new THREE.ConeGeometry(0.24, 0.56, 12)), primaryMat);
      cone.position.y = 0.72;
      cone.rotation.x = 0.18;
      headGroup.add(cone);
      const hatBand = new THREE.Mesh(track(new THREE.CylinderGeometry(0.25, 0.25, 0.06, 12)), goldMat);
      hatBand.position.y = 0.47;
      headGroup.add(hatBand);
    }
  } else if (loadout.suit === 'suit_agente') {
    // Crisp collar + briefcase held in left hand (if no weapon conflict)
    const lapel = new THREE.Mesh(track(new THREE.BoxGeometry(0.4, 0.14, 0.38)), whiteClothMat);
    lapel.position.set(0, 0.65, -0.02);
    hips.add(lapel);
  } else if (loadout.suit === 'suit_farao') {
    // Iconic Nemes striped headdress + golden Usekh collar + royal kilt
    const collar = new THREE.Mesh(track(new THREE.CylinderGeometry(0.36, 0.42, 0.12, 12)), accentMat);
    collar.position.set(0, 0.72, 0);
    hips.add(collar);
    const kilt = new THREE.Mesh(track(new THREE.BoxGeometry(0.66, 0.22, 0.39)), goldMat);
    kilt.position.y = 0.06;
    hips.add(kilt);
    if (!hasCustomHair) {
      const crown = new THREE.Mesh(track(new THREE.BoxGeometry(0.54, 0.2, 0.48)), goldMat);
      crown.position.set(0, 0.46, 0.02);
      headGroup.add(crown);
      const sideFlapL = new THREE.Mesh(track(new THREE.BoxGeometry(0.12, 0.45, 0.24)), accentMat);
      sideFlapL.position.set(-0.27, 0.24, 0.02);
      headGroup.add(sideFlapL);
      const sideFlapR = new THREE.Mesh(track(new THREE.BoxGeometry(0.12, 0.45, 0.24)), accentMat);
      sideFlapR.position.set(0.27, 0.24, 0.02);
      headGroup.add(sideFlapR);
      const cobra = new THREE.Mesh(track(new THREE.ConeGeometry(0.05, 0.16, 6)), goldMat);
      cobra.position.set(0, 0.56, -0.23);
      headGroup.add(cobra);
    }
  } else if (loadout.suit === 'suit_vampiro') {
    // High dramatic Dracula pointed collar + crimson bowtie
    const highCollar = new THREE.Mesh(track(new THREE.BoxGeometry(0.6, 0.32, 0.08)), accentMat);
    highCollar.position.set(0, 0.76, 0.18);
    hips.add(highCollar);
    if (!hasCustomHair) {
      const slickHair = new THREE.Mesh(track(new THREE.BoxGeometry(0.45, 0.14, 0.46)), darkUnderMat);
      slickHair.position.set(0, 0.45, 0.01);
      headGroup.add(slickHair);
    }
  } else if (loadout.suit === 'suit_skatista') {
    // Backwards cap + skateboard strapped on back (when no cape)
    if (!loadout.cape) {
      const board = new THREE.Mesh(track(new THREE.BoxGeometry(0.26, 0.96, 0.06)), accentMat);
      board.position.set(0, 0.42, 0.24);
      board.rotation.z = 0.35;
      hips.add(board);
    }
    if (!hasCustomHair) {
      const cap = new THREE.Mesh(track(new THREE.BoxGeometry(0.45, 0.13, 0.45)), accentMat);
      cap.position.y = 0.45;
      headGroup.add(cap);
      const visor = new THREE.Mesh(track(new THREE.BoxGeometry(0.36, 0.04, 0.2)), accentMat);
      visor.position.set(0, 0.42, 0.24);
      headGroup.add(visor);
    }
  } else if (loadout.suit === 'suit_boxeador') {
    // Huge golden championship belt
    const belt = new THREE.Mesh(track(new THREE.BoxGeometry(0.66, 0.16, 0.38)), darkUnderMat);
    belt.position.y = 0.08;
    hips.add(belt);
    const plate = new THREE.Mesh(track(new THREE.CylinderGeometry(0.14, 0.14, 0.06, 12)), goldMat);
    plate.rotation.x = Math.PI / 2;
    plate.position.set(0, 0.08, -0.19);
    hips.add(plate);
  } else if (loadout.suit === 'suit_piloto' || loadout.suit === 'suit_motociclista') {
    if (!hasCustomHair) {
      const helmet = new THREE.Mesh(track(new THREE.BoxGeometry(0.48, 0.46, 0.48)), primaryMat);
      helmet.position.y = 0.23;
      headGroup.add(helmet);
      const stripe = new THREE.Mesh(track(new THREE.BoxGeometry(0.12, 0.48, 0.5)), accentMat);
      stripe.position.y = 0.24;
      headGroup.add(stripe);
    }
  } else if (loadout.suit === 'suit_ciborgue') {
    const antenna = new THREE.Mesh(track(new THREE.CylinderGeometry(0.02, 0.02, 0.28, 6)), accentMat);
    antenna.position.set(0.24, 0.48, 0);
    headGroup.add(antenna);
  }

  // Legs
  const legGeo = track(new THREE.BoxGeometry(0.22, 0.72, 0.24));
  const bootGeo = track(new THREE.BoxGeometry(0.25, 0.2, 0.34));

  const leftLegPivot = new THREE.Group();
  leftLegPivot.position.set(-0.18, 0.02, 0);
  hips.add(leftLegPivot);
  const leftLeg = new THREE.Mesh(legGeo, pantsMat);
  leftLeg.position.y = -0.36;
  leftLeg.castShadow = true;
  leftLegPivot.add(leftLeg);
  const leftBoot = new THREE.Mesh(bootGeo, bootMat);
  leftBoot.position.set(0, -0.78, -0.04);
  leftLegPivot.add(leftBoot);

  const rightLegPivot = new THREE.Group();
  rightLegPivot.position.set(0.18, 0.02, 0);
  hips.add(rightLegPivot);
  const rightLeg = new THREE.Mesh(legGeo, pantsMat);
  rightLeg.position.y = -0.36;
  rightLeg.castShadow = true;
  rightLegPivot.add(rightLeg);
  const rightBoot = new THREE.Mesh(bootGeo, bootMat);
  rightBoot.position.set(0, -0.78, -0.04);
  rightLegPivot.add(rightBoot);

  // Arms
  const armGeo = track(new THREE.BoxGeometry(0.18, 0.62, 0.2));
  const isBoxer = loadout.suit === 'suit_boxeador';
  const gloveGeo = track(
    isBoxer ? new THREE.SphereGeometry(0.17, 10, 10) : new THREE.BoxGeometry(0.2, 0.18, 0.22)
  );

  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(-0.42, 0.64, 0);
  hips.add(leftArmPivot);
  const leftArm = new THREE.Mesh(armGeo, sleeveMat);
  leftArm.position.y = -0.28;
  leftArm.castShadow = true;
  leftArmPivot.add(leftArm);
  const leftGlove = new THREE.Mesh(gloveGeo, gloveMat);
  leftGlove.position.y = -0.58;
  leftArmPivot.add(leftGlove);

  // Secret Agent Briefcase in left hand
  if (loadout.suit === 'suit_agente') {
    const briefcase = new THREE.Mesh(track(new THREE.BoxGeometry(0.1, 0.34, 0.44)), darkUnderMat);
    briefcase.position.set(-0.04, -0.74, 0);
    leftArmPivot.add(briefcase);
  }

  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(0.42, 0.64, 0);
  hips.add(rightArmPivot);
  const rightArm = new THREE.Mesh(armGeo, sleeveMat);
  rightArm.position.y = -0.28;
  rightArm.castShadow = true;
  rightArmPivot.add(rightArm);
  const rightGlove = new THREE.Mesh(gloveGeo, gloveMat);
  rightGlove.position.y = -0.58;
  rightArmPivot.add(rightGlove);

  // ==============================================================
  // DYNAMIC COSMETIC ATTACHMENTS & PARTICLE ANIMATORS
  // ==============================================================

  const particleSystems: Array<{
    particles: ParticleState[];
    update: (t: number, dt: number, speed: number, lateralVel: number) => void;
  }> = [];

  const glowTex = noTextures ? null : track(createParticleTexture('glow'));
  const flameTex = noTextures ? null : track(createParticleTexture('flame'));
  const starTex = noTextures ? null : track(createParticleTexture('star'));

  function attachParticleEmitter(
    parent: THREE.Object3D,
    count: number,
    kind: 'flame' | 'star' | 'glow',
    opts: {
      colorHex: number;
      rainbow?: boolean;
      chameleonMovement?: boolean;
      size: number;
      spreadX: number;
      spreadZ: number;
      baseY: number;
      riseSpeed: number;
      orbit?: boolean;
      upDown?: boolean;
    }
  ) {
    const tex = kind === 'flame' ? flameTex : kind === 'star' ? starTex : glowTex;
    const planeGeo = track(new THREE.PlaneGeometry(opts.size, opts.size));
    const list: ParticleState[] = [];

    for (let i = 0; i < count; i++) {
      const mat = track(
        new THREE.MeshBasicMaterial({
          map: tex,
          color: noTextures ? 0xffffff : opts.colorHex,
          transparent: true,
          opacity: 0.9,
          depthWrite: false,
          side: THREE.DoubleSide,
          blending: noTextures ? THREE.NormalBlending : THREE.AdditiveBlending,
        })
      );
      const mesh = new THREE.Mesh(planeGeo, mat);
      const angle = (i / count) * Math.PI * 2;
      const radius = 0.25 + (i % 3) * 0.14;
      mesh.position.set(
        (Math.random() - 0.5) * opts.spreadX,
        opts.baseY + Math.random() * 0.8,
        (Math.random() - 0.5) * opts.spreadZ
      );
      parent.add(mesh);
      list.push({
        mesh,
        vx: (Math.random() - 0.5) * 0.4,
        vy: opts.riseSpeed * (0.7 + Math.random() * 0.6),
        vz: 0.6 + Math.random() * 0.8,
        life: Math.random(),
        maxLife: 0.55 + Math.random() * 0.55,
        baseHue: i / count,
        orbitAngle: angle,
        orbitRadius: radius,
      });
    }

    particleSystems.push({
      particles: list,
      update: (t, dt, _speed, lateralVel) => {
        for (let i = 0; i < list.length; i++) {
          const p = list[i];
          const mat = p.mesh.material as THREE.MeshBasicMaterial;

          if (opts.upDown) {
            p.orbitAngle += dt * 2.2;
            const wave = Math.sin(t * 3.4 + p.baseHue * Math.PI * 2);
            p.mesh.position.set(
              Math.cos(p.orbitAngle) * (0.4 + p.orbitRadius * 0.35),
              opts.baseY + 0.18 + wave * 0.26,
              Math.sin(p.orbitAngle) * (0.4 + p.orbitRadius * 0.35)
            );
            p.mesh.rotation.z = t * 2.5 + i;
            if (!noTextures && opts.rainbow) {
              _tmpColor.setHSL((t * 0.45 + p.baseHue) % 1, 0.95, 0.6);
              mat.color.copy(_tmpColor);
            }
            mat.opacity = 0.9;
            continue;
          }

          if (opts.orbit) {
            p.orbitAngle += dt * 3.2;
            p.life += dt;
            if (p.life > p.maxLife) p.life = 0;
            const prog = p.life / p.maxLife;
            p.mesh.position.set(
              Math.cos(p.orbitAngle) * p.orbitRadius,
              opts.baseY + prog * 1.3,
              Math.sin(p.orbitAngle) * p.orbitRadius
            );
            const scale = 1 - prog * 0.55;
            p.mesh.scale.setScalar(scale);
            mat.opacity = (1 - prog) * 0.95;
          } else {
            p.life += dt;
            if (p.life > p.maxLife) {
              p.life = 0;
              p.mesh.position.set(
                (Math.random() - 0.5) * opts.spreadX,
                opts.baseY,
                (Math.random() - 0.5) * opts.spreadZ
              );
            }
            p.mesh.position.x += p.vx * dt;
            p.mesh.position.y += p.vy * dt;
            p.mesh.position.z += p.vz * dt;
            const prog = p.life / p.maxLife;
            p.mesh.scale.setScalar(1.15 - prog * 0.65);
            mat.opacity = (1 - prog) * 0.92;
          }

          if (!noTextures) {
            if (opts.chameleonMovement) {
              const moveFactor = Math.min(1, Math.abs(lateralVel) * 0.18);
              const hue = (0.04 + moveFactor * 0.55 + Math.abs(Math.sin(t * 1.4 + p.baseHue)) * 0.35) % 1;
              _tmpColor.setHSL(hue, 1.0, 0.55);
              mat.color.copy(_tmpColor);
            } else if (opts.rainbow) {
              _tmpColor.setHSL((t * 0.6 + p.baseHue) % 1, 0.95, 0.58);
              mat.color.copy(_tmpColor);
            }
          }
        }
      },
    });
  }

  // Suit special animations
  if (loadout.suit === 'corpo_colorido' && !noTextures) {
    dynamicUpdaters.push((t) => {
      _tmpColor.setHSL((t * 0.45) % 1, 0.92, 0.52);
      primaryMat.color.copy(_tmpColor);
      primaryMat.emissive.copy(_tmpColor);
      _tmpColor.setHSL((t * 0.45 + 0.5) % 1, 1.0, 0.58);
      accentMat.color.copy(_tmpColor);
      accentMat.emissive.copy(_tmpColor);
    });
  } else if (loadout.suit === 'corpo_fogo') {
    attachParticleEmitter(hips, 18, 'flame', {
      colorHex: 0xff6b00,
      size: 0.48,
      spreadX: 0.65,
      spreadZ: 0.45,
      baseY: 0.05,
      riseSpeed: 1.8,
      orbit: true,
    });
    if (!noTextures) {
      dynamicUpdaters.push((t) => {
        primaryMat.emissiveIntensity = 0.75 + Math.sin(t * 18) * 0.25;
      });
    }
  }

  // Extra Body Aura: Efeito de Fogo Intenso
  if (loadout.aura === 'efeito_fogo_intenso') {
    attachParticleEmitter(hips, 24, 'flame', {
      colorHex: 0xff5500,
      size: 0.56,
      spreadX: 0.85,
      spreadZ: 0.85,
      baseY: -0.5,
      riseSpeed: 2.3,
      orbit: true,
    });
  }

  // ==============================================================
  // CAPES & LONG TRENCH COAT (CLEANLY BEHIND BACK WITH NEGATIVE X ROTATION)
  // ==============================================================
  if (loadout.cape) {
    const isTrench = loadout.cape === 'sobretudo_chamas_camaleao';
    const capeGroup = new THREE.Group();
    // Placed cleanly behind shoulders & backpack/torso (z = +0.26)
    capeGroup.position.set(0, 0.72, 0.26);
    hips.add(capeGroup);

    const capeGeo = track(
      isTrench
        ? new THREE.BoxGeometry(0.78, 1.32, 0.06)
        : new THREE.PlaneGeometry(0.82, 1.24, 4, 8)
    );
    capeGeo.translate(0, isTrench ? -0.66 : -0.62, 0);

    let capeMat: THREE.MeshStandardMaterial;
    let conveyorTex: THREE.CanvasTexture | null = null;

    if (loadout.cape === 'capa_preta_bieljr') {
      const tex = noTextures
        ? null
        : track(createCapeTextTexture('biel.jr', '#070709', '#f8fafc', '#38bdf8', maxAnisotropy));
      capeMat = track(
        new THREE.MeshStandardMaterial({
          map: tex,
          color: noTextures ? 0x111111 : 0xffffff,
          roughness: 0.6,
          metalness: 0.15,
          side: THREE.DoubleSide,
        })
      );
    } else if (loadout.cape === 'capa_preta_lenda') {
      const tex = noTextures
        ? null
        : track(createCapeTextTexture('LENDA', '#070709', '#facc15', '#eab308', maxAnisotropy));
      capeMat = track(
        new THREE.MeshStandardMaterial({
          map: tex,
          color: noTextures ? 0x111111 : 0xffffff,
          roughness: 0.55,
          metalness: 0.2,
          side: THREE.DoubleSide,
        })
      );
    } else if (loadout.cape === 'capa_esteira_preto_azul') {
      conveyorTex = noTextures ? null : track(createConveyorTexture(maxAnisotropy));
      capeMat = track(
        new THREE.MeshStandardMaterial({
          map: conveyorTex,
          color: noTextures ? 0x27272a : 0xffffff,
          emissive: noTextures ? 0x000000 : 0x0284c7,
          emissiveIntensity: noTextures ? 0 : 0.45,
          roughness: 0.3,
          metalness: 0.4,
          side: THREE.DoubleSide,
        })
      );
    } else if (loadout.cape === 'capa_colorida_brilho') {
      capeMat = track(
        new THREE.MeshStandardMaterial({
          color: noTextures ? 0xe4e4e7 : 0xec4899,
          emissive: noTextures ? 0x000000 : 0xec4899,
          emissiveIntensity: noTextures ? 0 : 0.8,
          roughness: 0.2,
          metalness: 0.4,
          side: THREE.DoubleSide,
        })
      );
    } else if (loadout.cape === 'capa_fogo_forte') {
      capeMat = track(
        new THREE.MeshStandardMaterial({
          color: noTextures ? 0x52525b : 0xea580c,
          emissive: noTextures ? 0x000000 : 0xf97316,
          emissiveIntensity: noTextures ? 0 : 0.95,
          roughness: 0.35,
          metalness: 0.1,
          side: THREE.DoubleSide,
        })
      );
      attachParticleEmitter(capeGroup, 20, 'flame', {
        colorHex: 0xff6a00,
        size: 0.52,
        spreadX: 0.72,
        spreadZ: 0.25,
        baseY: -1.1,
        riseSpeed: 2.2,
      });
    } else {
      // sobretudo_chamas_camaleao
      capeMat = track(
        new THREE.MeshStandardMaterial({
          color: noTextures ? 0x27272a : 0x0f172a,
          roughness: 0.45,
          metalness: 0.3,
          side: THREE.DoubleSide,
        })
      );
      // Flanking side coat lapels placed outside the arms/hips
      const sidePanelGeo = track(new THREE.BoxGeometry(0.08, 1.24, 0.34));
      sidePanelGeo.translate(0, -0.62, 0);
      const leftPanel = new THREE.Mesh(sidePanelGeo, capeMat);
      leftPanel.position.set(-0.39, 0, -0.14);
      capeGroup.add(leftPanel);
      const rightPanel = new THREE.Mesh(sidePanelGeo, capeMat);
      rightPanel.position.set(0.39, 0, -0.14);
      capeGroup.add(rightPanel);

      attachParticleEmitter(capeGroup, 22, 'flame', {
        colorHex: 0xf97316,
        chameleonMovement: true,
        size: 0.48,
        spreadX: 0.85,
        spreadZ: 0.35,
        baseY: -1.2,
        riseSpeed: 1.9,
      });
    }

    // Shoulder clasp bar connecting cape cleanly to top of shoulders
    const claspGeo = track(new THREE.BoxGeometry(0.76, 0.08, 0.14));
    const clasp = new THREE.Mesh(claspGeo, capeMat);
    clasp.position.set(0, 0.02, -0.04);
    capeGroup.add(clasp);

    const capeMesh = new THREE.Mesh(capeGeo, capeMat);
    capeMesh.castShadow = true;
    capeGroup.add(capeMesh);

    if (loadout.cape === 'capa_colorida_brilho') {
      attachParticleEmitter(capeGroup, 10, 'glow', {
        colorHex: 0xffffff,
        rainbow: true,
        size: 0.3,
        spreadX: 0.75,
        spreadZ: 0.2,
        baseY: -1.1,
        riseSpeed: 1.2,
      });
    }

    dynamicUpdaters.push((t, dt, speed, lateralVel, isLobby) => {
      // NEGATIVE X rotation sends bottom (-Y) backward (+Z) behind the character!
      const baseAngle = isLobby ? 0.24 : Math.min(0.84, 0.32 + speed * 0.013);
      capeGroup.rotation.x = -(baseAngle + Math.sin(t * 11) * 0.08);
      capeGroup.rotation.z = THREE.MathUtils.clamp(-lateralVel * 0.04, -0.3, 0.3);

      if (conveyorTex) {
        conveyorTex.offset.y -= dt * 2.4;
      }
      if (loadout.cape === 'capa_colorida_brilho' && !noTextures) {
        _tmpColor.setHSL((t * 0.55) % 1, 0.95, 0.56);
        capeMat.color.copy(_tmpColor);
        capeMat.emissive.copy(_tmpColor);
      }
      if (loadout.cape === 'sobretudo_chamas_camaleao' && !noTextures) {
        const moveIntensity = Math.min(1, Math.abs(lateralVel) * 0.16);
        _tmpColor.setHSL((0.58 + moveIntensity * 0.38 + Math.sin(t * 2) * 0.08) % 1, 0.85, 0.35);
        capeMat.emissive.copy(_tmpColor);
        capeMat.emissiveIntensity = 0.28 + moveIntensity * 0.45;
      }
    });
  }

  // ==============================================================
  // HAIR & HATS (CLEANLY ABOVE & BEHIND HEAD, ZERO CLIPPING!)
  // ==============================================================
  if (loadout.hair) {
    const hairGroup = new THREE.Group();
    // Head top is y=0.43; place hairGroup at y=0.44 so crown sits cleanly on top
    hairGroup.position.set(0, 0.44, 0);
    headGroup.add(hairGroup);

    if (loadout.hair === 'chapeu_estrela') {
      const brimGeo = track(new THREE.CylinderGeometry(0.42, 0.42, 0.05, 16));
      const crownGeo = track(new THREE.CylinderGeometry(0.25, 0.28, 0.28, 16));
      const bandGeo = track(new THREE.CylinderGeometry(0.285, 0.285, 0.06, 16));
      const hatMat = track(
        new THREE.MeshStandardMaterial({
          color: noTextures ? 0x18181b : 0x111827,
          roughness: 0.45,
          metalness: 0.3,
        })
      );
      const bandMat = track(
        new THREE.MeshStandardMaterial({
          color: noTextures ? 0xf4f4f5 : 0xfacc15,
          emissive: noTextures ? 0x000000 : 0xf59e0b,
          emissiveIntensity: noTextures ? 0 : 0.45,
          roughness: 0.25,
        })
      );
      const brim = new THREE.Mesh(brimGeo, hatMat);
      brim.position.y = 0.02;
      hairGroup.add(brim);
      const crown = new THREE.Mesh(crownGeo, hatMat);
      crown.position.y = 0.17;
      hairGroup.add(crown);
      const band = new THREE.Mesh(bandGeo, bandMat);
      band.position.y = 0.08;
      hairGroup.add(band);

      attachParticleEmitter(hairGroup, 12, 'star', {
        colorHex: 0xfacc15,
        rainbow: true,
        upDown: true,
        size: 0.22,
        spreadX: 0.6,
        spreadZ: 0.6,
        baseY: 0.25,
        riseSpeed: 0.5,
      });
    } else if (loadout.hair === 'cabelo_loiro_chao' || loadout.hair === 'cabelo_verde_estrelas') {
      const isBlonde = loadout.hair === 'cabelo_loiro_chao';
      const baseColor = noTextures ? (isBlonde ? 0xe4e4e7 : 0x52525b) : isBlonde ? 0xfacc15 : 0x22c55e;
      const emissiveColor = noTextures ? 0x000000 : isBlonde ? 0xca8a04 : 0x16a34a;

      const longHairMat = track(
        new THREE.MeshStandardMaterial({
          color: baseColor,
          emissive: emissiveColor,
          emissiveIntensity: noTextures ? 0 : 0.3,
          roughness: 0.32,
          metalness: 0.18,
        })
      );

      // Sculpted top hair crown & front bangs clearly sitting outside head
      const topGeo = track(new THREE.BoxGeometry(0.5, 0.16, 0.52));
      const topMesh = new THREE.Mesh(topGeo, longHairMat);
      topMesh.position.set(0, 0.06, 0.02);
      hairGroup.add(topMesh);

      // Side locks framing the face
      const sideLockGeo = track(new THREE.BoxGeometry(0.09, 0.52, 0.16));
      const sideL = new THREE.Mesh(sideLockGeo, longHairMat);
      sideL.position.set(-0.24, -0.2, 0.02);
      hairGroup.add(sideL);
      const sideR = new THREE.Mesh(sideLockGeo, longHairMat);
      sideR.position.set(0.24, -0.2, 0.02);
      hairGroup.add(sideR);

      // Cascading multi-strand hair cleanly BEHIND head, torso & cape (z = +0.29)
      // Head top is y ~ 2.19 above floor, so length 2.16 reaches right down to the floor!
      const length = isBlonde ? 2.16 : 1.54;
      const strandGroup = new THREE.Group();
      strandGroup.position.set(0, 0.06, 0.29);
      hairGroup.add(strandGroup);

      // Layered wide hair curtain + flared bottom tips
      for (let i = -3; i <= 3; i++) {
        const w = 0.115;
        const strandLen = length - Math.abs(i) * 0.04;
        const sGeo = track(new THREE.BoxGeometry(w, strandLen, 0.09));
        sGeo.translate(0, -strandLen / 2, 0);
        const sMesh = new THREE.Mesh(sGeo, longHairMat);
        sMesh.position.set(i * 0.085, 0, Math.abs(i) * 0.01);
        sMesh.castShadow = true;
        strandGroup.add(sMesh);
      }

      if (!isBlonde) {
        attachParticleEmitter(strandGroup, 14, 'star', {
          colorHex: 0xfde047,
          rainbow: false,
          size: 0.22,
          spreadX: 0.65,
          spreadZ: 0.25,
          baseY: -1.3,
          riseSpeed: 1.4,
        });
      }

      dynamicUpdaters.push((t, _dt, speed, lateralVel, isLobby, isSliding) => {
        // NEGATIVE X rotation makes hair sweep BACKWARD (+Z) cleanly outside the body/cape!
        const angle = isSliding
          ? 0.65
          : isLobby
            ? 0.25
            : Math.min(0.76, 0.34 + speed * 0.011);
        strandGroup.rotation.x = -(angle + Math.sin(t * 9.5) * 0.06);
        strandGroup.rotation.z = THREE.MathUtils.clamp(-lateralVel * 0.045, -0.35, 0.35);
      });
    } else {
      // Sculpted spiky detailed cyber hair sitting cleanly outside top & back of head
      const isRainbow =
        loadout.hair === 'cabelo_colorido_adm' || loadout.hair === 'cabelo_colorido_jogador';
      const isPink = loadout.hair === 'cabelo_rosa_brilhante';
      const isBlue = loadout.hair === 'cabelo_azul_detalhado';
      const isGreen = loadout.hair === 'cabelo_verde_detalhado';

      const spikeColors = noTextures
        ? [0xd4d4d8, 0xa1a1aa, 0xf4f4f5]
        : isRainbow
          ? [0xf43f5e, 0xf59e0b, 0x22c55e, 0x06b6d4, 0xa855f7]
          : isPink
            ? [0xec4899, 0xf472b6, 0xdb2777]
            : isBlue
              ? [0x0284c7, 0x38bdf8, 0x1d4ed8]
              : isGreen
                ? [0x16a34a, 0x4ade80, 0x15803d]
                : [0x38bdf8];

      const spikeMats = spikeColors.map((c) =>
        track(
          new THREE.MeshStandardMaterial({
            color: c,
            emissive: noTextures ? 0x000000 : c,
            emissiveIntensity: noTextures ? 0 : isPink || isRainbow ? 0.55 : 0.28,
            roughness: 0.28,
            metalness: 0.2,
          })
        )
      );

      // Full hair crown + back-of-head & side hair volume cleanly outside head box
      const baseCap = new THREE.Mesh(track(new THREE.BoxGeometry(0.49, 0.14, 0.5)), spikeMats[0]);
      baseCap.position.set(0, 0.05, 0.02);
      hairGroup.add(baseCap);

      const backHair = new THREE.Mesh(
        track(new THREE.BoxGeometry(0.47, 0.36, 0.12)),
        spikeMats[1 % spikeMats.length]
      );
      backHair.position.set(0, -0.15, 0.24);
      hairGroup.add(backHair);

      const sideBurnGeo = track(new THREE.BoxGeometry(0.07, 0.24, 0.16));
      const burnL = new THREE.Mesh(sideBurnGeo, spikeMats[0]);
      burnL.position.set(-0.235, -0.1, 0.04);
      hairGroup.add(burnL);
      const burnR = new THREE.Mesh(sideBurnGeo, spikeMats[0]);
      burnR.position.set(0.235, -0.1, 0.04);
      hairGroup.add(burnR);

      const spikeGeo = track(new THREE.ConeGeometry(0.095, 0.38, 5));
      const spikeCount = loadout.hair === 'cabelo_colorido_adm' || isBlue || isGreen ? 12 : 9;
      for (let i = 0; i < spikeCount; i++) {
        const mat = spikeMats[i % spikeMats.length];
        const spike = new THREE.Mesh(spikeGeo, mat);
        const angle = (i / spikeCount) * Math.PI * 2;
        const radius = i % 2 === 0 ? 0.19 : 0.09;
        spike.position.set(Math.cos(angle) * radius, 0.22, Math.sin(angle) * radius + 0.03);
        spike.rotation.z = -Math.cos(angle) * 0.48;
        spike.rotation.x = Math.sin(angle) * 0.48 + 0.22;
        hairGroup.add(spike);
      }

      if (isPink || loadout.hair === 'cabelo_colorido_adm') {
        attachParticleEmitter(hairGroup, 10, 'glow', {
          colorHex: isPink ? 0xf472b6 : 0xffffff,
          rainbow: !isPink,
          size: 0.2,
          spreadX: 0.55,
          spreadZ: 0.55,
          baseY: 0.12,
          riseSpeed: 0.85,
        });
      }
    }
  }

  // ==============================================================
  // EYEWEAR (Óculos preto "biel.jr")
  // ==============================================================
  if (loadout.eyewear === 'oculos_bieljr') {
    visorMesh.visible = false;
    const tex = noTextures ? null : track(createEyewearTextTexture('biel.jr', maxAnisotropy));
    const glassGeo = track(new THREE.BoxGeometry(0.45, 0.14, 0.1));
    const glassMat = track(
      new THREE.MeshStandardMaterial({
        map: tex,
        color: noTextures ? 0x111111 : 0xffffff,
        roughness: 0.18,
        metalness: 0.5,
      })
    );
    const glasses = new THREE.Mesh(glassGeo, glassMat);
    glasses.position.set(0, 0.25, -0.22);
    headGroup.add(glasses);
  }

  // ==============================================================
  // HEADBAND (Faixa Preta)
  // ==============================================================
  if (loadout.headband === 'faixa_preta') {
    const bandMat = track(
      new THREE.MeshStandardMaterial({
        color: 0x060606,
        roughness: 0.7,
        metalness: 0.1,
      })
    );
    const wrapGeo = track(new THREE.BoxGeometry(0.46, 0.085, 0.46));
    const wrap = new THREE.Mesh(wrapGeo, bandMat);
    wrap.position.set(0, 0.34, 0);
    headGroup.add(wrap);

    const tailGroup = new THREE.Group();
    tailGroup.position.set(0, 0.34, 0.24);
    headGroup.add(tailGroup);

    const tailGeo = track(new THREE.BoxGeometry(0.06, 0.03, 0.48));
    tailGeo.translate(0, 0, 0.24);
    const tailL = new THREE.Mesh(tailGeo, bandMat);
    tailL.position.x = -0.05;
    tailL.rotation.y = -0.18;
    tailGroup.add(tailL);
    const tailR = new THREE.Mesh(tailGeo, bandMat);
    tailR.position.x = 0.05;
    tailR.rotation.y = 0.18;
    tailGroup.add(tailR);

    dynamicUpdaters.push((t) => {
      tailGroup.rotation.x = 0.18 + Math.sin(t * 14) * 0.16;
    });
  }

  // ==============================================================
  // WEAPONS (Faca Colorida / Martelo)
  // ==============================================================
  if (loadout.weapon === 'faca_colorida') {
    const knifeGroup = new THREE.Group();
    knifeGroup.position.set(0, -0.62, -0.08);
    knifeGroup.rotation.x = Math.PI / 2;
    rightArmPivot.add(knifeGroup);

    const handleGeo = track(new THREE.CylinderGeometry(0.035, 0.035, 0.18, 8));
    const handleMat = track(new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.6 }));
    const handle = new THREE.Mesh(handleGeo, handleMat);
    knifeGroup.add(handle);

    const bladeGeo = track(new THREE.ConeGeometry(0.065, 0.42, 4));
    const bladeMat = track(
      new THREE.MeshStandardMaterial({
        color: noTextures ? 0xf4f4f5 : 0x22d3ee,
        emissive: noTextures ? 0x000000 : 0x22d3ee,
        emissiveIntensity: noTextures ? 0 : 0.75,
        metalness: 0.8,
        roughness: 0.15,
      })
    );
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.position.y = 0.28;
    knifeGroup.add(blade);

    if (!noTextures) {
      dynamicUpdaters.push((t) => {
        _tmpColor.setHSL((t * 0.75) % 1, 0.95, 0.55);
        bladeMat.color.copy(_tmpColor);
        bladeMat.emissive.copy(_tmpColor);
      });
    }
  } else if (loadout.weapon === 'martelo_cyber') {
    const hammerGroup = new THREE.Group();
    hammerGroup.position.set(0, -0.62, -0.1);
    hammerGroup.rotation.x = Math.PI / 2;
    rightArmPivot.add(hammerGroup);

    const shaftGeo = track(new THREE.CylinderGeometry(0.038, 0.038, 0.72, 10));
    const shaftMat = track(new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.35 }));
    const shaft = new THREE.Mesh(shaftGeo, shaftMat);
    shaft.position.y = 0.22;
    hammerGroup.add(shaft);

    const headBlockGeo = track(new THREE.BoxGeometry(0.28, 0.26, 0.46));
    const headBlockMat = track(
      new THREE.MeshStandardMaterial({
        color: noTextures ? 0x94a3b8 : 0x64748b,
        metalness: 0.85,
        roughness: 0.22,
      })
    );
    const headBlock = new THREE.Mesh(headBlockGeo, headBlockMat);
    headBlock.position.y = 0.58;
    hammerGroup.add(headBlock);

    const hammerCoreGeo = track(new THREE.BoxGeometry(0.3, 0.12, 0.18));
    const hammerCore = new THREE.Mesh(hammerCoreGeo, accentMat);
    hammerCore.position.y = 0.58;
    hammerGroup.add(hammerCore);
  }

  // ==============================================================
  // PER-FRAME ANIMATION UPDATE
  // ==============================================================
  const update = (
    time: number,
    dt: number,
    speed: number,
    lateralVel: number,
    isJumping: boolean,
    isSliding: boolean,
    isLobby: boolean
  ) => {
    if (isLobby) {
      hips.position.y = 0.95 + Math.sin(time * 2.4) * 0.03;
      hips.rotation.set(0, 0, 0);
      leftLegPivot.rotation.x = 0.06;
      rightLegPivot.rotation.x = -0.06;
      leftArmPivot.rotation.set(0.1, 0, 0.12);
      rightArmPivot.rotation.set(-0.1, 0, -0.12);
      bodyRoot.rotation.x = 0;
      bodyRoot.scale.set(1, 1, 1);
    } else if (isSliding) {
      bodyRoot.rotation.x = -0.75;
      hips.position.y = 0.48;
      leftLegPivot.rotation.x = 0.4;
      rightLegPivot.rotation.x = -0.2;
      leftArmPivot.rotation.x = -0.8;
      rightArmPivot.rotation.x = -0.8;
      bodyRoot.scale.set(1, 0.72, 1);
    } else if (isJumping) {
      bodyRoot.rotation.x = 0.12;
      bodyRoot.scale.set(1, 1, 1);
      hips.position.y = 0.98;
      leftLegPivot.rotation.x = 0.55;
      rightLegPivot.rotation.x = -0.45;
      leftArmPivot.rotation.x = -0.9;
      rightArmPivot.rotation.x = -0.7;
    } else {
      bodyRoot.rotation.x = 0.12;
      bodyRoot.scale.set(1, 1, 1);
      const strideFreq = 11 + speed * 0.22;
      const swing = Math.sin(time * strideFreq);
      hips.position.y = 0.95 + Math.abs(Math.cos(time * strideFreq)) * 0.07;
      hips.rotation.z = THREE.MathUtils.clamp(-lateralVel * 0.035, -0.22, 0.22);
      leftLegPivot.rotation.x = swing * 0.85;
      rightLegPivot.rotation.x = -swing * 0.85;
      leftArmPivot.rotation.x = -swing * 0.75;
      rightArmPivot.rotation.x = swing * 0.75;
      leftArmPivot.rotation.z = 0.1;
      rightArmPivot.rotation.z = -0.1;
    }

    for (let i = 0; i < dynamicUpdaters.length; i++) {
      dynamicUpdaters[i](time, dt, speed, lateralVel, isLobby, isSliding);
    }
    for (let i = 0; i < particleSystems.length; i++) {
      particleSystems[i].update(time, dt, speed, lateralVel);
    }
  };

  const dispose = () => {
    for (let i = 0; i < disposables.length; i++) {
      disposables[i].dispose();
    }
  };

  return {
    root,
    bodyRoot,
    hips,
    torso,
    headGroup,
    leftArmPivot,
    rightArmPivot,
    leftLegPivot,
    rightLegPivot,
    contactShadow,
    update,
    dispose,
  };
}
