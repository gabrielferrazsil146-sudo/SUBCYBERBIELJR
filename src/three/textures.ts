import * as THREE from 'three';
import type { MapConfig } from '../types/game';

export function createTrackTexture(map: MapConfig, maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const baseColor = '#' + map.trackBaseHex.toString(16).padStart(6, '0');
  const lineColor = '#' + map.trackLineHex.toString(16).padStart(6, '0');
  const railColor = '#' + map.railHex.toString(16).padStart(6, '0');

  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, 512, 512);

  // Subtle brushed metal / asphalt panel joints
  for (let y = 0; y < 512; y += 64) {
    ctx.fillStyle = 'rgba(255,255,255,0.035)';
    ctx.fillRect(28, y, 456, 3);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(28, y + 3, 456, 2);
  }

  // Subtle lane center runner treads
  const laneCenters = [86, 256, 426];
  ctx.fillStyle = 'rgba(255,255,255,0.025)';
  for (const cx of laneCenters) {
    ctx.fillRect(cx - 38, 0, 76, 512);
    ctx.fillStyle = lineColor;
    ctx.globalAlpha = 0.12;
    ctx.fillRect(cx - 2, 0, 4, 512);
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(255,255,255,0.025)';
  }

  // Outer curbs
  ctx.fillStyle = railColor;
  ctx.fillRect(0, 0, 28, 512);
  ctx.fillRect(484, 0, 28, 512);

  // 3 Lane dividers (lanes are at 1/3 and 2/3 of track)
  const div1 = Math.round(512 * 0.34);
  const div2 = Math.round(512 * 0.66);

  ctx.fillStyle = lineColor;
  ctx.globalAlpha = 0.92;
  for (let y = 0; y < 512; y += 64) {
    ctx.fillRect(div1 - 5, y + 8, 10, 40);
    ctx.fillRect(div2 - 5, y + 8, 10, 40);
  }

  // Glowing side rails
  ctx.globalAlpha = 0.7;
  ctx.fillRect(24, 0, 6, 512);
  ctx.fillRect(482, 0, 6, 512);
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 6);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createHazardStripeTexture(
  primaryHex: string,
  secondaryHex: string,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = secondaryHex;
  ctx.fillRect(0, 0, 256, 128);

  ctx.fillStyle = primaryHex;
  for (let x = -128; x < 384; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 24, 0);
    ctx.lineTo(x + 24 + 128, 128);
    ctx.lineTo(x + 128, 128);
    ctx.closePath();
    ctx.fill();
  }

  // Top & bottom trim lines
  ctx.fillStyle = '#09090b';
  ctx.fillRect(0, 0, 256, 8);
  ctx.fillRect(0, 120, 256, 8);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createOverheadSignTexture(
  accentHex: string,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 192;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 512, 192);

  // Hazard border
  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 10;
  ctx.strokeRect(10, 10, 492, 172);

  // Downward chevron arrows signaling slide under
  ctx.fillStyle = accentHex;
  for (const cx of [128, 256, 384]) {
    ctx.beginPath();
    ctx.moveTo(cx - 38, 48);
    ctx.lineTo(cx, 94);
    ctx.lineTo(cx + 38, 48);
    ctx.lineTo(cx + 22, 48);
    ctx.lineTo(cx, 74);
    ctx.lineTo(cx - 22, 48);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(cx - 38, 96);
    ctx.lineTo(cx, 142);
    ctx.lineTo(cx + 38, 96);
    ctx.lineTo(cx + 22, 96);
    ctx.lineTo(cx, 122);
    ctx.lineTo(cx - 22, 96);
    ctx.closePath();
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createPillarPanelTexture(
  accentHex: string,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#111827';
  ctx.fillRect(0, 0, 256, 512);

  // Armored panel seams
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 6;
  ctx.strokeRect(14, 14, 228, 484);

  // Glowing cyber train / monolith windshield & vent slats
  ctx.fillStyle = accentHex;
  ctx.fillRect(36, 48, 184, 72);
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fillRect(46, 58, 164, 14);

  // Vertical glowing energy strips
  ctx.fillStyle = accentHex;
  ctx.fillRect(30, 150, 14, 300);
  ctx.fillRect(212, 150, 14, 300);

  // Center armored louver ribs
  ctx.fillStyle = '#1e293b';
  for (let y = 170; y < 440; y += 34) {
    ctx.fillRect(62, y, 132, 18);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createCoinFaceTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(108, 98, 12, 128, 128, 126);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.22, '#fef08a');
  grad.addColorStop(0.65, '#facc15');
  grad.addColorStop(1, '#d97706');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  // Clean classic coin inner ring
  ctx.strokeStyle = '#fef9c3';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(128, 128, 92, 0, Math.PI * 2);
  ctx.stroke();

  // Classic vertical embossed coin bar
  ctx.fillStyle = '#fef9c3';
  ctx.fillRect(114, 72, 28, 112);

  // Subtle diagonal specular gleam
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.moveTo(40, 20);
  ctx.lineTo(90, 20);
  ctx.lineTo(20, 120);
  ctx.lineTo(20, 70);
  ctx.closePath();
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createCapeTextTexture(
  label: string,
  bgHex: string,
  textHex: string,
  borderHex: string,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 768;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = bgHex;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = borderHex;
  ctx.lineWidth = 14;
  ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 3;
  ctx.strokeRect(40, 40, canvas.width - 80, canvas.height - 80);

  ctx.save();
  ctx.fillStyle = textHex;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const fontSize = label.length > 6 ? 78 : 96;
  ctx.font = `900 ${fontSize}px "Chakra Petch", "Arial Black", sans-serif`;
  ctx.shadowColor = borderHex;
  ctx.shadowBlur = 18;
  ctx.fillText(label, canvas.width / 2, canvas.height * 0.44);

  ctx.shadowBlur = 0;
  ctx.fillStyle = borderHex;
  ctx.fillRect(canvas.width / 2 - 90, canvas.height * 0.54, 180, 8);
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createConveyorTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#030712';
  ctx.fillRect(0, 0, 256, 512);

  for (let y = 0; y < 512; y += 64) {
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.moveTo(0, y + 18);
    ctx.lineTo(128, y);
    ctx.lineTo(256, y + 18);
    ctx.lineTo(256, y + 34);
    ctx.lineTo(128, y + 16);
    ctx.lineTo(0, y + 34);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(16, y + 44, 224, 5);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 2);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createEyewearTextTexture(label: string, maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#050505';
  ctx.fillRect(0, 0, 512, 160);

  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, 496, 144);

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '800 68px "Chakra Petch", sans-serif';
  ctx.fillText(label, 256, 84);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 60);
  grad.addColorStop(0, 'rgba(0,0,0,0.68)');
  grad.addColorStop(0.55, 'rgba(0,0,0,0.32)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createParticleTexture(kind: 'glow' | 'star' | 'flame'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  if (kind === 'star') {
    ctx.clearRect(0, 0, 64, 64);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    const cx = 32;
    const cy = 32;
    const spikes = 5;
    const outer = 28;
    const inner = 12;
    for (let i = 0; i < spikes * 2; i++) {
      const r = i % 2 === 0 ? outer : inner;
      const angle = (i * Math.PI) / spikes - Math.PI / 2;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  } else if (kind === 'flame') {
    const grad = ctx.createRadialGradient(32, 38, 3, 32, 32, 30);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.35, 'rgba(255,200,80,0.9)');
    grad.addColorStop(0.7, 'rgba(255,80,10,0.5)');
    grad.addColorStop(1, 'rgba(255,40,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
  } else {
    const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.45)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createSkyDomeTexture(mapId: string, maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  if (mapId === 'via_solar') {
    grad.addColorStop(0, '#1e1b4b');
    grad.addColorStop(0.32, '#7c2d12');
    grad.addColorStop(0.56, '#ea580c');
    grad.addColorStop(0.75, '#fbbf24');
    grad.addColorStop(1, '#78350f');
  } else if (mapId === 'floresta_cibernetica') {
    grad.addColorStop(0, '#042f2e');
    grad.addColorStop(0.38, '#065f46');
    grad.addColorStop(0.65, '#10b981');
    grad.addColorStop(0.85, '#34d399');
    grad.addColorStop(1, '#064e3b');
  } else if (mapId === 'glaciar_artico') {
    grad.addColorStop(0, '#091540');
    grad.addColorStop(0.35, '#1e3a8a');
    grad.addColorStop(0.62, '#0284c7');
    grad.addColorStop(0.82, '#67e8f9');
    grad.addColorStop(1, '#1e3a8a');
  } else if (mapId === 'distrito_vulcanico') {
    grad.addColorStop(0, '#1c0505');
    grad.addColorStop(0.35, '#5b1010');
    grad.addColorStop(0.62, '#c2410c');
    grad.addColorStop(0.82, '#fb923c');
    grad.addColorStop(1, '#450a0a');
  } else if (mapId === 'circuito_synth') {
    grad.addColorStop(0, '#1e0536');
    grad.addColorStop(0.34, '#581c87');
    grad.addColorStop(0.58, '#db2777');
    grad.addColorStop(0.78, '#fb923c');
    grad.addColorStop(1, '#2e1065');
  } else if (mapId === 'passarela_orbital') {
    grad.addColorStop(0, '#03071e');
    grad.addColorStop(0.35, '#1d2d6b');
    grad.addColorStop(0.62, '#2563eb');
    grad.addColorStop(0.82, '#38bdf8');
    grad.addColorStop(1, '#0f172a');
  } else if (mapId === 'nucleo_subterraneo') {
    grad.addColorStop(0, '#1a0924');
    grad.addColorStop(0.4, '#4c1d4b');
    grad.addColorStop(0.68, '#be185d');
    grad.addColorStop(0.85, '#fb923c');
    grad.addColorStop(1, '#271c2b');
  } else {
    // metropole_neon
    grad.addColorStop(0, '#0b1026');
    grad.addColorStop(0.35, '#1e1b4b');
    grad.addColorStop(0.62, '#312e81');
    grad.addColorStop(0.8, '#0891b2');
    grad.addColorStop(1, '#162447');
  }

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Add subtle stars / glowing horizon nebula wisps
  for (let i = 0; i < 90; i++) {
    const x = (i * 73) % 512;
    const y = (i * 41) % 260;
    const r = (i % 3) + 0.8;
    ctx.fillStyle = i % 5 === 0 ? 'rgba(255,240,180,0.75)' : 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Aurora ribbons for arctic & orbital & forest
  if (mapId === 'glaciar_artico' || mapId === 'floresta_cibernetica' || mapId === 'passarela_orbital') {
    const auroraGrad = ctx.createLinearGradient(0, 120, 512, 240);
    if (mapId === 'glaciar_artico') {
      auroraGrad.addColorStop(0, 'rgba(52,211,153,0.0)');
      auroraGrad.addColorStop(0.3, 'rgba(52,211,153,0.45)');
      auroraGrad.addColorStop(0.6, 'rgba(56,189,248,0.5)');
      auroraGrad.addColorStop(1, 'rgba(168,85,247,0.0)');
    } else if (mapId === 'floresta_cibernetica') {
      auroraGrad.addColorStop(0, 'rgba(16,185,129,0.0)');
      auroraGrad.addColorStop(0.5, 'rgba(110,231,183,0.38)');
      auroraGrad.addColorStop(1, 'rgba(34,211,238,0.0)');
    } else {
      auroraGrad.addColorStop(0, 'rgba(168,85,247,0.0)');
      auroraGrad.addColorStop(0.45, 'rgba(56,189,248,0.4)');
      auroraGrad.addColorStop(0.8, 'rgba(232,121,249,0.35)');
      auroraGrad.addColorStop(1, 'rgba(56,189,248,0.0)');
    }
    ctx.fillStyle = auroraGrad;
    ctx.beginPath();
    ctx.moveTo(0, 210);
    ctx.bezierCurveTo(140, 120, 320, 250, 512, 150);
    ctx.lineTo(512, 235);
    ctx.bezierCurveTo(320, 300, 140, 190, 0, 260);
    ctx.closePath();
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createBuildingWindowsTexture(
  bodyHex: string,
  winA: string,
  winB: string,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = bodyHex;
  ctx.fillRect(0, 0, 256, 512);

  // Vertical structural columns
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(0, 0, 14, 512);
  ctx.fillRect(242, 0, 14, 512);

  // Illuminated colorful windows grid
  for (let y = 20; y < 490; y += 26) {
    for (let x = 22; x < 230; x += 28) {
      const hash = ((x * 13 + y * 7) % 11);
      if (hash < 2) {
        ctx.fillStyle = 'rgba(15,23,42,0.85)';
      } else if (hash < 6) {
        ctx.fillStyle = winA;
      } else if (hash < 9) {
        ctx.fillStyle = winB;
      } else {
        ctx.fillStyle = '#fef08a';
      }
      ctx.fillRect(x, y, 18, 14);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createTerrainTexture(mapId: string, maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  if (mapId === 'circuito_synth') {
    ctx.fillStyle = '#1e0b36';
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = '#e879f9';
    ctx.lineWidth = 3;
    for (let i = 0; i <= 256; i += 32) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 256);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(256, i);
      ctx.stroke();
    }
  } else if (mapId === 'via_solar') {
    ctx.fillStyle = '#c26927';
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#e08b3e';
    for (let y = 0; y < 256; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y + 10);
      ctx.quadraticCurveTo(64, y, 128, y + 12);
      ctx.quadraticCurveTo(192, y + 24, 256, y + 10);
      ctx.lineTo(256, y + 20);
      ctx.lineTo(0, y + 20);
      ctx.closePath();
      ctx.fill();
    }
  } else if (mapId === 'floresta_cibernetica') {
    ctx.fillStyle = '#0d4f3c';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 65; i++) {
      const x = (i * 53) % 256;
      const y = (i * 97) % 256;
      ctx.fillStyle = i % 4 === 0 ? '#34d399' : i % 4 === 1 ? '#22d3ee' : '#15803d';
      ctx.beginPath();
      ctx.arc(x, y, 3 + (i % 4), 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (mapId === 'glaciar_artico') {
    ctx.fillStyle = '#bae6fd';
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    for (let i = 0; i < 12; i++) {
      ctx.beginPath();
      ctx.moveTo((i * 47) % 256, 0);
      ctx.lineTo(((i + 3) * 61) % 256, 256);
      ctx.stroke();
    }
  } else if (mapId === 'distrito_vulcanico') {
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#facc15';
    for (let i = 0; i < 16; i++) {
      ctx.beginPath();
      ctx.ellipse((i * 59) % 256, (i * 83) % 256, 26, 12, i * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(40,12,10,0.45)';
    for (let i = 0; i < 12; i++) {
      ctx.beginPath();
      ctx.arc((i * 71) % 256, (i * 43) % 256, 18, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (mapId === 'nucleo_subterraneo') {
    ctx.fillStyle = '#2e163b';
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = '#fb923c';
    ctx.lineWidth = 4;
    for (let i = 0; i <= 256; i += 64) {
      ctx.strokeRect(i + 4, 4, 56, 248);
    }
  } else if (mapId === 'passarela_orbital') {
    ctx.fillStyle = '#0b1840';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 55; i++) {
      ctx.fillStyle = i % 3 === 0 ? '#7dd3fc' : '#ffffff';
      ctx.fillRect((i * 67) % 256, (i * 89) % 256, 3, 3);
    }
  } else {
    // metropole_neon city plaza
    ctx.fillStyle = '#172554';
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = 'rgba(34,211,238,0.4)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 256; i += 32) {
      ctx.strokeRect(i, 0, 32, 256);
      ctx.strokeRect(0, i, 256, 32);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 3);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export interface OutfitTextureSet {
  torsoFront: THREE.CanvasTexture;
  torsoBack: THREE.CanvasTexture;
  face: THREE.CanvasTexture;
}

export function createOutfitTextures(
  suitId: string,
  primaryHex: string,
  secondaryHex: string,
  maxAnisotropy: number
): OutfitTextureSet {
  const makeTex = (draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    draw(c.getContext('2d')!, 256, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = maxAnisotropy;
    return t;
  };

  const drawSkinFace = (
    ctx: CanvasRenderingContext2D,
    skinHex: string,
    eyeHex: string,
    opts?: { maskHex?: string; mustache?: boolean; scar?: boolean; skull?: boolean; fangs?: boolean; mummy?: boolean; glasses?: boolean }
  ) => {
    ctx.fillStyle = skinHex;
    ctx.fillRect(0, 0, 256, 256);

    if (opts?.mummy) {
      // Layered mummy wrappings across face with dark shadow slit for eyes
      ctx.fillStyle = '#d6d3d1';
      ctx.fillRect(0, 0, 256, 256);
      ctx.strokeStyle = '#78716c';
      ctx.lineWidth = 6;
      for (let y = 16; y < 256; y += 36) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(256, y + (y % 72 === 16 ? 18 : -18));
        ctx.stroke();
      }
      ctx.fillStyle = '#1c1917';
      ctx.fillRect(24, 92, 208, 46);
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(58, 106, 36, 18);
      ctx.fillRect(162, 106, 36, 18);
      return;
    }

    if (opts?.skull) {
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, 256, 256);
      // Eye sockets
      ctx.fillStyle = '#09090b';
      ctx.beginPath();
      ctx.arc(82, 112, 30, 0, Math.PI * 2);
      ctx.arc(174, 112, 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = eyeHex;
      ctx.beginPath();
      ctx.arc(82, 112, 11, 0, Math.PI * 2);
      ctx.arc(174, 112, 11, 0, Math.PI * 2);
      ctx.fill();
      // Nose cavity
      ctx.fillStyle = '#09090b';
      ctx.beginPath();
      ctx.moveTo(128, 134);
      ctx.lineTo(114, 162);
      ctx.lineTo(142, 162);
      ctx.closePath();
      ctx.fill();
      // Grinning teeth
      ctx.fillStyle = '#09090b';
      ctx.fillRect(66, 182, 124, 34);
      ctx.fillStyle = '#f8fafc';
      for (let x = 72; x < 186; x += 22) {
        ctx.fillRect(x, 186, 15, 26);
      }
      return;
    }

    // Eyebrows & expressive eyes
    ctx.fillStyle = '#18181b';
    ctx.fillRect(54, 82, 48, 10);
    ctx.fillRect(154, 82, 48, 10);

    // Eyes
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(58, 98, 42, 28);
    ctx.fillRect(156, 98, 42, 28);
    ctx.fillStyle = eyeHex;
    ctx.fillRect(70, 102, 22, 22);
    ctx.fillRect(164, 102, 22, 22);
    ctx.fillStyle = '#09090b';
    ctx.fillRect(76, 108, 10, 10);
    ctx.fillRect(170, 108, 10, 10);

    if (opts?.glasses) {
      ctx.fillStyle = '#09090b';
      ctx.fillRect(36, 92, 80, 42);
      ctx.fillRect(140, 92, 80, 42);
      ctx.fillRect(116, 104, 24, 10);
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.fillRect(46, 98, 20, 8);
      ctx.fillRect(150, 98, 20, 8);
    }

    if (opts?.maskHex) {
      ctx.fillStyle = opts.maskHex;
      ctx.fillRect(0, 138, 256, 118);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(0, 138, 256, 8);
    } else {
      // Mouth / smile
      ctx.fillStyle = '#7f1d1d';
      ctx.fillRect(96, 178, 64, 14);
      if (opts?.fangs) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(100, 178);
        ctx.lineTo(108, 198);
        ctx.lineTo(116, 178);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(140, 178);
        ctx.lineTo(148, 198);
        ctx.lineTo(156, 178);
        ctx.fill();
      }
    }

    if (opts?.scar) {
      ctx.strokeStyle = '#15803d';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(160, 50);
      ctx.lineTo(192, 148);
      ctx.stroke();
    }
  };

  const torsoFront = makeTex((ctx, w, h) => {
    ctx.fillStyle = primaryHex;
    ctx.fillRect(0, 0, w, h);

    if (suitId === 'suit_policial') {
      // Police shirt, tie, golden badge, pockets & utility belt
      ctx.fillStyle = '#172554';
      ctx.fillRect(0, 0, w, h);
      // Collar & white undershirt V
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.moveTo(96, 0);
      ctx.lineTo(160, 0);
      ctx.lineTo(128, 56);
      ctx.closePath();
      ctx.fill();
      // Tie
      ctx.fillStyle = '#09090b';
      ctx.fillRect(118, 26, 20, 118);
      // Pockets
      ctx.fillStyle = '#1e40af';
      ctx.fillRect(28, 64, 56, 56);
      ctx.fillRect(172, 64, 56, 56);
      // Golden police badge
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(56, 86, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0ea5e9';
      ctx.beginPath();
      ctx.arc(56, 86, 8, 0, Math.PI * 2);
      ctx.fill();
      // Tactical belt
      ctx.fillStyle = '#09090b';
      ctx.fillRect(0, 204, w, 34);
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(108, 208, 40, 26);
    } else if (suitId === 'suit_bandido') {
      // Dark biker/bandit leather jacket, open red shirt, bandolier & belt
      ctx.fillStyle = '#18181b';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(96, 0, 64, 195);
      // Diagonal strap
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 22;
      ctx.beginPath();
      ctx.moveTo(0, 20);
      ctx.lineTo(256, 210);
      ctx.stroke();
      ctx.fillStyle = '#facc15';
      ctx.fillRect(116, 108, 22, 16);
      // Zippers & pockets
      ctx.fillStyle = '#a1a1aa';
      ctx.fillRect(88, 0, 6, 200);
      ctx.fillRect(162, 0, 6, 200);
      ctx.fillStyle = '#09090b';
      ctx.fillRect(0, 204, w, 34);
    } else if (suitId === 'suit_prisioneiro') {
      // Classic prison uniform stripes + prisoner ID badge
      ctx.fillStyle = '#ea580c';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#18181b';
      for (let y = 18; y < h; y += 52) {
        ctx.fillRect(0, y, w, 20);
      }
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(140, 62, 86, 44);
      ctx.fillStyle = '#09090b';
      ctx.font = 'bold 24px monospace';
      ctx.fillText('0074', 152, 92);
    } else if (suitId === 'suit_mumia') {
      // Wrapped mummy bandages
      ctx.fillStyle = '#e7e5e4';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#78716c';
      ctx.lineWidth = 8;
      for (let y = -20; y < h + 40; y += 34) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y + (y % 68 === 0 ? 28 : -28));
        ctx.stroke();
      }
      ctx.fillStyle = '#d97706';
      ctx.fillRect(108, 198, 40, 32);
    } else if (suitId === 'suit_futebol') {
      // Green & yellow jersey with #10 and team crest
      ctx.fillStyle = '#16a34a';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#facc15';
      ctx.fillRect(0, 0, 34, h);
      ctx.fillRect(222, 0, 34, h);
      // V-neck collar
      ctx.beginPath();
      ctx.moveTo(86, 0);
      ctx.lineTo(170, 0);
      ctx.lineTo(128, 44);
      ctx.closePath();
      ctx.fill();
      // Crest
      ctx.fillStyle = '#1d4ed8';
      ctx.beginPath();
      ctx.arc(68, 72, 18, 0, Math.PI * 2);
      ctx.fill();
      // #10
      ctx.fillStyle = '#facc15';
      ctx.textAlign = 'center';
      ctx.font = '900 76px sans-serif';
      ctx.fillText('10', 128, 168);
    } else if (suitId === 'suit_bombeiro') {
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(0, 0, w, h);
      // High-visibility yellow/silver reflective bands
      ctx.fillStyle = '#fde047';
      ctx.fillRect(0, 88, w, 28);
      ctx.fillRect(0, 184, w, 28);
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(0, 96, w, 12);
      ctx.fillRect(0, 192, w, 12);
      ctx.fillStyle = '#18181b';
      ctx.fillRect(116, 0, 24, h);
    } else if (suitId === 'suit_astronauta') {
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(58, 52, 140, 96);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(72, 66, 112, 68);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(84, 82, 24, 24);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(118, 82, 24, 24);
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(152, 82, 20, 24);
      ctx.fillStyle = '#1d4ed8';
      ctx.fillRect(0, 196, w, 24);
    } else if (suitId === 'suit_agente') {
      ctx.fillStyle = '#09090b';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(80, 0);
      ctx.lineTo(176, 0);
      ctx.lineTo(128, 145);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#e11d48';
      ctx.fillRect(118, 10, 20, 130);
    } else if (suitId === 'suit_pirata') {
      ctx.fillStyle = '#7f1d1d';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#fef3c7';
      ctx.beginPath();
      ctx.moveTo(86, 0);
      ctx.lineTo(170, 0);
      ctx.lineTo(128, 128);
      ctx.closePath();
      ctx.fill();
      // Gold coat buttons
      ctx.fillStyle = '#facc15';
      for (let y = 34; y < 180; y += 36) {
        ctx.beginPath();
        ctx.arc(62, y, 8, 0, Math.PI * 2);
        ctx.arc(194, y, 8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#451a03';
      ctx.fillRect(0, 198, w, 34);
      ctx.fillStyle = '#facc15';
      ctx.fillRect(108, 200, 40, 30);
    } else if (suitId === 'suit_vampiro') {
      ctx.fillStyle = '#1f122b';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#9f1239';
      ctx.fillRect(68, 24, 120, 190);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(96, 0);
      ctx.lineTo(160, 0);
      ctx.lineTo(128, 86);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#facc15';
      for (let y = 104; y < 190; y += 30) {
        ctx.beginPath();
        ctx.arc(128, y, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (suitId === 'suit_mago') {
      ctx.fillStyle = '#581c87';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(114, 0, 28, h);
      // Stars on robe
      for (const [sx, sy] of [[48, 60], [204, 80], [52, 160], [200, 185]]) {
        ctx.beginPath();
        ctx.arc(sx, sy, 10, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (suitId === 'suit_piloto') {
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(0, 0, w, h);
      // Checkered racing stripe
      for (let y = 0; y < h; y += 24) {
        ctx.fillStyle = (y / 24) % 2 === 0 ? '#ffffff' : '#09090b';
        ctx.fillRect(24, y, 22, 24);
        ctx.fillRect(210, y, 22, 24);
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(92, 68, 72, 34);
      ctx.fillStyle = '#09090b';
      ctx.font = 'bold 22px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('TURBO', 128, 92);
    } else if (suitId === 'suit_farao') {
      ctx.fillStyle = '#eab308';
      ctx.fillRect(0, 0, w, h);
      // Egyptian turquoise & lapis collar rings
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 18;
      ctx.beginPath();
      ctx.arc(128, 10, 86, 0, Math.PI);
      ctx.stroke();
      ctx.strokeStyle = '#1d4ed8';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(128, 10, 62, 0, Math.PI);
      ctx.stroke();
      ctx.fillStyle = '#06b6d4';
      ctx.fillRect(0, 198, w, 34);
    } else if (suitId === 'suit_cavaleiro') {
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#1d4ed8';
      ctx.fillRect(68, 24, 120, 210);
      ctx.fillStyle = '#facc15';
      ctx.fillRect(118, 44, 20, 110);
      ctx.fillRect(88, 76, 80, 20);
    } else if (suitId === 'suit_samurai') {
      ctx.fillStyle = '#991b1b';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#18181b';
      for (let y = 40; y < 220; y += 36) {
        ctx.fillRect(24, y, 208, 16);
      }
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(128, 70, 22, 0, Math.PI * 2);
      ctx.fill();
    } else if (suitId === 'suit_boxeador') {
      // Athletic skin + championship belt
      ctx.fillStyle = '#d97757';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(124, 30, 8, 140);
      ctx.fillRect(58, 86, 60, 8);
      ctx.fillRect(138, 86, 60, 8);
      ctx.fillStyle = '#18181b';
      ctx.fillRect(0, 184, w, 58);
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.ellipse(128, 212, 54, 26, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Stylish armored cyber suit jacket with seam lines & glowing core trim
      ctx.fillStyle = primaryHex;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(40, 32, 176, 150);
      ctx.fillStyle = secondaryHex;
      ctx.fillRect(116, 18, 24, 180);
      ctx.fillRect(0, 200, w, 24);
    }
  });

  const torsoBack = makeTex((ctx, w, h) => {
    ctx.fillStyle = primaryHex;
    ctx.fillRect(0, 0, w, h);
    if (suitId === 'suit_futebol') {
      ctx.fillStyle = '#16a34a';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#facc15';
      ctx.textAlign = 'center';
      ctx.font = '900 108px sans-serif';
      ctx.fillText('10', 128, 164);
    } else if (suitId === 'suit_policial') {
      ctx.fillStyle = '#172554';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#38bdf8';
      ctx.textAlign = 'center';
      ctx.font = '900 38px sans-serif';
      ctx.fillText('POLÍCIA', 128, 108);
      ctx.fillStyle = '#09090b';
      ctx.fillRect(0, 204, w, 34);
    } else if (suitId === 'suit_bombeiro') {
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#fde047';
      ctx.fillRect(0, 88, w, 28);
      ctx.fillRect(0, 184, w, 28);
    } else if (suitId === 'suit_prisioneiro') {
      ctx.fillStyle = '#ea580c';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#18181b';
      for (let y = 18; y < h; y += 52) {
        ctx.fillRect(0, y, w, 20);
      }
    } else if (suitId === 'suit_mumia') {
      ctx.fillStyle = '#e7e5e4';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#78716c';
      ctx.lineWidth = 8;
      for (let y = 0; y < h; y += 34) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y + 18);
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(46, 36, 164, 150);
      ctx.fillStyle = secondaryHex;
      ctx.fillRect(118, 36, 20, 150);
    }
  });

  const face = makeTex((ctx) => {
    if (suitId === 'suit_mumia') {
      drawSkinFace(ctx, '#e7e5e4', '#fbbf24', { mummy: true });
    } else if (suitId === 'suit_esqueleto') {
      drawSkinFace(ctx, '#f8fafc', '#22d3ee', { skull: true });
    } else if (suitId === 'suit_bandido') {
      drawSkinFace(ctx, '#f1c29b', '#1e293b', { maskHex: '#dc2626' });
    } else if (suitId === 'suit_ninja') {
      drawSkinFace(ctx, '#0f172a', '#ef4444', { maskHex: '#020617' });
    } else if (suitId === 'suit_zumbi') {
      drawSkinFace(ctx, '#4ade80', '#fde047', { scar: true, fangs: true });
    } else if (suitId === 'suit_vampiro') {
      drawSkinFace(ctx, '#e2e8f0', '#ef4444', { fangs: true });
    } else if (suitId === 'suit_agente') {
      drawSkinFace(ctx, '#f1c29b', '#0f172a', { glasses: true });
    } else if (suitId === 'suit_ciborgue') {
      drawSkinFace(ctx, '#94a3b8', '#22d3ee', { maskHex: '#334155' });
    } else if (suitId === 'suit_pirata') {
      drawSkinFace(ctx, '#eab68c', '#1e293b');
      // Pirate eyepatch over left eye
      ctx.fillStyle = '#09090b';
      ctx.fillRect(48, 86, 60, 48);
      ctx.strokeStyle = '#09090b';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(0, 62);
      ctx.lineTo(256, 134);
      ctx.stroke();
    } else if (suitId === 'suit_farao') {
      drawSkinFace(ctx, '#d99b66', '#06b6d4');
      // Pharaoh beard
      ctx.fillStyle = '#facc15';
      ctx.fillRect(114, 200, 28, 56);
    } else if (suitId === 'corpo_todo_preto') {
      ctx.fillStyle = '#040404';
      ctx.fillRect(0, 0, 256, 256);
    } else {
      drawSkinFace(ctx, '#f1c29b', secondaryHex);
    }
  });

  return { torsoFront, torsoBack, face };
}

