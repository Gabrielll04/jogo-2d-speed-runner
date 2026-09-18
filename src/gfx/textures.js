/* ==========================================================================
   TEXTURAS PROCEDURAIS
   Tudo desenhado em <canvas> em tempo de execucao. Nenhum arquivo, nenhuma
   requisicao. As texturas sao pequenas de proposito (64..128 px): quando o
   mundo ja e renderizado em 320x180, textura grande e desperdicio.
   ========================================================================== */

import * as THREE from 'three';
import { criarRng, entre, inteiro } from '../core/rng.js';

const cache = new Map();

function novoCanvas(largura, altura) {
  const cv = document.createElement('canvas');
  cv.width = largura;
  cv.height = altura;
  return cv;
}

function finalizar(canvas, { repetirX = false, nitido = true } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = nitido ? THREE.NearestFilter : THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.wrapS = repetirX ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.wrapT = repetirX ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  if ('colorSpace' in tex) tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function memo(chave, gerar) {
  if (!cache.has(chave)) cache.set(chave, gerar());
  return cache.get(chave);
}

function hex(cor) {
  return '#' + cor.toString(16).padStart(6, '0');
}

function rgba(cor, alfa) {
  const r = (cor >> 16) & 255;
  const g = (cor >> 8) & 255;
  const b = cor & 255;
  return 'rgba(' + r + ',' + g + ',' + b + ',' + alfa + ')';
}

/* --------------------------------------------------------------------------
   HALO / BRILHO - gradiente radial. Base de todo sprite aditivo do jogo.
   -------------------------------------------------------------------------- */
export function texturaHalo(cor = 0xffffff, dureza = 0.18) {
  return memo('halo' + cor + dureza, () => {
    const s = 64;
    const cv = novoCanvas(s, s);
    const ctx = cv.getContext('2d');
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, rgba(0xffffff, 1));
    g.addColorStop(dureza, rgba(cor, 0.95));
    g.addColorStop(0.45, rgba(cor, 0.35));
    g.addColorStop(1, rgba(cor, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    return finalizar(cv, { nitido: false });
  });
}

/* --------------------------------------------------------------------------
   PARTICULA - quadradinho com nucleo branco. Chunky de proposito.
   -------------------------------------------------------------------------- */
export function texturaParticula() {
  return memo('particula', () => {
    const s = 16;
    const cv = novoCanvas(s, s);
    const ctx = cv.getContext('2d');
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.75)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    return finalizar(cv, { nitido: false });
  });
}

/* --------------------------------------------------------------------------
   ESTRELA DO CAMPO ESTELAR - ponto com cruz de brilho, bem pequeno.
   -------------------------------------------------------------------------- */
export function texturaPonto() {
  return memo('ponto', () => {
    const s = 16;
    const cv = novoCanvas(s, s);
    const ctx = cv.getContext('2d');
    ctx.fillStyle = 'rgba(255,255,255,0)';
    ctx.fillRect(0, 0, s, s);
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2.2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.3, 'rgba(210,235,255,0.6)');
    g.addColorStop(1, 'rgba(160,200,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    // cruz de difracao: 1px, bem discreta
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(0, s / 2 - 0.5, s, 1);
    ctx.fillRect(s / 2 - 0.5, 0, 1, s);
    return finalizar(cv, { nitido: false });
  });
}

/* --------------------------------------------------------------------------
   NEBULOSA - manchas radiais sobrepostas + ruido. Sempre escura e sutil:
   ela e pano de fundo, nao protagonista.
   -------------------------------------------------------------------------- */
export function texturaNebulosa(semente, cores) {
  return memo('nebulosa' + semente + cores.join('-'), () => {
    const s = 128;
    const cv = novoCanvas(s, s);
    const ctx = cv.getContext('2d');
    const rng = criarRng(semente * 7919 + 13);

    ctx.clearRect(0, 0, s, s);
    ctx.globalCompositeOperation = 'lighter';

    for (let i = 0; i < 16; i++) {
      const cor = cores[i % cores.length];
      const cx = entre(rng, s * 0.18, s * 0.82);
      const cy = entre(rng, s * 0.18, s * 0.82);
      const raio = entre(rng, s * 0.12, s * 0.42);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, raio);
      g.addColorStop(0, rgba(cor, entre(rng, 0.16, 0.30)));
      g.addColorStop(0.5, rgba(cor, 0.08));
      g.addColorStop(1, rgba(cor, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
    }

    // Ruido grosso: quebra o gradiente perfeito e "suja" a nuvem.
    const img = ctx.getImageData(0, 0, s, s);
    const dados = img.data;
    for (let i = 0; i < dados.length; i += 4) {
      const n = 0.72 + rng() * 0.56;
      dados[i] = Math.min(255, dados[i] * n);
      dados[i + 1] = Math.min(255, dados[i + 1] * n);
      dados[i + 2] = Math.min(255, dados[i + 2] * n);
    }
    ctx.putImageData(img, 0, 0);

    // Mascara circular: evita a borda reta do quadrado aparecer.
    ctx.globalCompositeOperation = 'destination-in';
    const mascara = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    mascara.addColorStop(0, 'rgba(0,0,0,1)');
    mascara.addColorStop(0.62, 'rgba(0,0,0,0.82)');
    mascara.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = mascara;
    ctx.fillRect(0, 0, s, s);

    return finalizar(cv, { nitido: false });
  });
}

/* --------------------------------------------------------------------------
   PLANETAS - tres receitas: gasoso (faixas), rochoso (crateras) e gelado
   (calotas + rachaduras). Textura equiretangular simples 128x64.
   -------------------------------------------------------------------------- */
const RECEITAS_PLANETA = [
  { tipo: 'gasoso',  base: 0x1d4f63, faixa: 0x2e7f96, detalhe: 0x8fe3f0 },
  { tipo: 'gasoso',  base: 0x5c2f1c, faixa: 0x8a4a26, detalhe: 0xe0a05a },
  { tipo: 'rochoso', base: 0x3a2b45, faixa: 0x55406a, detalhe: 0x9c7fc4 },
  { tipo: 'rochoso', base: 0x4a3018, faixa: 0x6d4726, detalhe: 0xb98b4e },
  { tipo: 'gelado',  base: 0x1b3560, faixa: 0x2b4f86, detalhe: 0xcfe8ff },
  { tipo: 'gasoso',  base: 0x47324f, faixa: 0x6b4677, detalhe: 0xd9a6e8 },
  { tipo: 'rochoso', base: 0x23404a, faixa: 0x356070, detalhe: 0x7fc4c9 },
  { tipo: 'gelado',  base: 0x5a4a1c, faixa: 0x87702a, detalhe: 0xffe9a8 }
];

export function numeroDeReceitas() {
  return RECEITAS_PLANETA.length;
}

export function texturaPlaneta(indiceReceita) {
  const receita = RECEITAS_PLANETA[indiceReceita % RECEITAS_PLANETA.length];
  return memo('planeta' + indiceReceita, () => {
    const L = 128, A = 64;
    const cv = novoCanvas(L, A);
    const ctx = cv.getContext('2d');
    const rng = criarRng(indiceReceita * 104729 + 7);

    ctx.fillStyle = hex(receita.base);
    ctx.fillRect(0, 0, L, A);

    if (receita.tipo === 'gasoso') {
      // Faixas horizontais de gas com ondulacao.
      let y = 0;
      while (y < A) {
        const altura = inteiro(rng, 2, 7);
        const mistura = rng();
        ctx.fillStyle = mistura > 0.72 ? hex(receita.detalhe)
          : (mistura > 0.35 ? hex(receita.faixa) : hex(receita.base));
        ctx.globalAlpha = entre(rng, 0.45, 0.95);
        for (let x = 0; x < L; x++) {
          const onda = Math.round(Math.sin((x / L) * Math.PI * entre(rng, 1, 1.02) + y) * 1.2);
          ctx.fillRect(x, y + onda, 1, altura);
        }
        y += altura;
      }
      ctx.globalAlpha = 1;
      // Grande mancha (tipo tempestade)
      const mx = entre(rng, 20, L - 20);
      const my = entre(rng, A * 0.35, A * 0.7);
      ctx.fillStyle = hex(receita.detalhe);
      ctx.globalAlpha = 0.65;
      ctx.beginPath();
      ctx.ellipse(mx, my, entre(rng, 7, 13), entre(rng, 3, 6), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    } else if (receita.tipo === 'rochoso') {
      // Manchas de terreno + crateras com borda clara.
      for (let i = 0; i < 70; i++) {
        ctx.fillStyle = rng() > 0.5 ? hex(receita.faixa) : hex(receita.base);
        ctx.globalAlpha = entre(rng, 0.25, 0.7);
        const w = inteiro(rng, 4, 22);
        const h = inteiro(rng, 3, 10);
        ctx.fillRect(inteiro(rng, 0, L), inteiro(rng, 0, A), w, h);
      }
      ctx.globalAlpha = 1;
      for (let i = 0; i < 26; i++) {
        const cx = entre(rng, 0, L);
        const cy = entre(rng, 4, A - 4);
        const r = entre(rng, 1.5, 4.5);
        ctx.fillStyle = hex(receita.detalhe);
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = hex(receita.base);
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.arc(cx + r * 0.2, cy + r * 0.2, r * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else {
      // Gelado: campo claro, rachaduras e veios.
      for (let i = 0; i < 40; i++) {
        ctx.strokeStyle = hex(receita.faixa);
        ctx.globalAlpha = entre(rng, 0.25, 0.6);
        ctx.lineWidth = 1;
        ctx.beginPath();
        let x = entre(rng, 0, L);
        let y = entre(rng, 0, A);
        ctx.moveTo(x, y);
        for (let s = 0; s < 5; s++) {
          x += entre(rng, -14, 14);
          y += entre(rng, -5, 5);
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // Calotas polares (todo mundo ganha, fica legivel mesmo pixelado).
    const calota = inteiro(rng, 3, 7);
    ctx.fillStyle = hex(receita.detalhe);
    ctx.globalAlpha = 0.85;
    ctx.fillRect(0, 0, L, calota);
    ctx.fillRect(0, A - calota, L, calota);
    ctx.globalAlpha = 0.4;
    ctx.fillRect(0, calota, L, 2);
    ctx.fillRect(0, A - calota - 2, L, 2);
    ctx.globalAlpha = 1;

    // Sombreado do terminador: lado direito mais escuro.
    const sombra = ctx.createLinearGradient(0, 0, L, 0);
    sombra.addColorStop(0, 'rgba(2,3,10,0.45)');
    sombra.addColorStop(0.35, 'rgba(2,3,10,0)');
    sombra.addColorStop(0.75, 'rgba(2,3,10,0.15)');
    sombra.addColorStop(1, 'rgba(2,3,10,0.6)');
    ctx.fillStyle = sombra;
    ctx.fillRect(0, 0, L, A);

    return finalizar(cv, { repetirX: true, nitido: true });
  });
}

export function corDaReceita(indice) {
  return RECEITAS_PLANETA[indice % RECEITAS_PLANETA.length].detalhe;
}

/* --------------------------------------------------------------------------
   ANEL PLANETARIO - faixas concentricas com falhas.
   -------------------------------------------------------------------------- */
export function texturaAnel(semente) {
  return memo('anel' + semente, () => {
    const L = 64, A = 8;
    const cv = novoCanvas(L, A);
    const ctx = cv.getContext('2d');
    const rng = criarRng(semente * 31337 + 5);
    ctx.clearRect(0, 0, L, A);
    let x = 0;
    while (x < L) {
      const w = inteiro(rng, 1, 5);
      const alfa = rng() > 0.25 ? entre(rng, 0.2, 0.75) : 0;
      const tom = rng() > 0.5 ? 0xd8c79a : 0x8fb6c9;
      ctx.fillStyle = rgba(tom, alfa);
      ctx.fillRect(x, 0, w, A);
      x += w;
    }
    return finalizar(cv, { nitido: true });
  });
}

/* --------------------------------------------------------------------------
   DISCO DE ACRECAO - anel quente girando ao redor do buraco negro.
   -------------------------------------------------------------------------- */
export function texturaDisco() {
  return memo('disco', () => {
    const L = 64, A = 8;
    const cv = novoCanvas(L, A);
    const ctx = cv.getContext('2d');
    for (let x = 0; x < L; x++) {
      const t = x / L;
      const pulso = 0.55 + 0.45 * Math.sin(t * Math.PI * 6);
      const g = ctx.createLinearGradient(0, 0, 0, A);
      g.addColorStop(0, rgba(0xff2f87, 0.05 * pulso));
      g.addColorStop(0.5, rgba(0xffd23f, 0.95 * pulso));
      g.addColorStop(1, rgba(0xff2f87, 0.05 * pulso));
      ctx.fillStyle = g;
      ctx.fillRect(x, 0, 1, A);
    }
    return finalizar(cv, { repetirX: true, nitido: true });
  });
}

/* --------------------------------------------------------------------------
   LISTRAS DE PERIGO - a linguagem universal de "nao passa por aqui".
   Diagonais claras sobre metal escuro, para a barreira que exige trocar de
   pista. Repete em X para envolver a estrutura inteira.
   -------------------------------------------------------------------------- */
export function texturaPerigo() {
  return memo('perigo', () => {
    const L = 32, A = 32;
    const cv = novoCanvas(L, A);
    const ctx = cv.getContext('2d');

    // Vermelho sobre claro, como cancela de obra: e a leitura mais imediata
    // de "bloqueado" que existe, e destaca contra o espaco preto.
    ctx.fillStyle = '#dbe4f5';
    ctx.fillRect(0, 0, L, A);

    // Faixas a 45 graus com periodo 16 px. Como 32 e multiplo de 16, o
    // desenho fecha nas emendas: da pra repetir sem virar xadrez. Faixa
    // grossa de proposito - em 320x180 uma listra fina vira ruido.
    ctx.fillStyle = '#ff3b30';
    for (let i = -A; i < L + A; i += 16) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 8, 0);
      ctx.lineTo(i + 8 - A, A);
      ctx.lineTo(i - A, A);
      ctx.closePath();
      ctx.fill();
    }

    // Sombreado vertical: da volume sem precisar de luz.
    const g = ctx.createLinearGradient(0, 0, 0, A);
    g.addColorStop(0, 'rgba(255,255,255,0.18)');
    g.addColorStop(0.55, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.28)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, L, A);
    return finalizar(cv, { repetirX: true, nitido: true });
  });
}

/* --------------------------------------------------------------------------
   ROCHA QUENTE - crosta clara com veios incandescentes. O asteroide precisa
   saltar do fundo escuro, senao o jogador perde por nao ter visto a pedra.
   -------------------------------------------------------------------------- */
export function texturaRocha() {
  return memo('rocha', () => {
    const L = 64, A = 32;
    const cv = novoCanvas(L, A);
    const ctx = cv.getContext('2d');
    const rng = criarRng(20260215);

    ctx.fillStyle = '#9a7f74';
    ctx.fillRect(0, 0, L, A);

    // Manchas de crosta, do claro ao escuro.
    for (let i = 0; i < 90; i++) {
      const tom = rng();
      ctx.fillStyle = tom > 0.7 ? '#c4a693' : (tom > 0.4 ? '#7d6459' : '#5d4a45');
      ctx.globalAlpha = entre(rng, 0.3, 0.8);
      ctx.fillRect(inteiro(rng, 0, L), inteiro(rng, 0, A), inteiro(rng, 2, 9), inteiro(rng, 2, 7));
    }
    ctx.globalAlpha = 1;

    // Veios de magma: o que garante leitura contra o espaco preto.
    for (let i = 0; i < 9; i++) {
      let x = entre(rng, 0, L);
      let y = entre(rng, 0, A);
      ctx.strokeStyle = rng() > 0.5 ? '#ff8a3d' : '#ffd23f';
      ctx.lineWidth = entre(rng, 1, 2.4);
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let n = 0; n < 4; n++) {
        x += entre(rng, -12, 12);
        y += entre(rng, -6, 6);
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    return finalizar(cv, { repetirX: true, nitido: true });
  });
}

/* --------------------------------------------------------------------------
   FEIXE DE LASER - listras verticais que percorrem o portao.
   -------------------------------------------------------------------------- */
export function texturaLaser() {
  return memo('laser', () => {
    const L = 32, A = 16;
    const cv = novoCanvas(L, A);
    const ctx = cv.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, A);
    g.addColorStop(0, rgba(0xff2f87, 0.0));
    g.addColorStop(0.28, rgba(0xff2f87, 0.85));
    g.addColorStop(0.5, rgba(0xffffff, 1));
    g.addColorStop(0.72, rgba(0xff2f87, 0.85));
    g.addColorStop(1, rgba(0xff2f87, 0.0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, L, A);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let x = 0; x < L; x += 6) ctx.fillRect(x, 0, 2, A);
    return finalizar(cv, { repetirX: true, nitido: true });
  });
}

/** Libera tudo (usado se o contexto WebGL for perdido). */
export function limparCacheTexturas() {
  for (const tex of cache.values()) tex.dispose();
  cache.clear();
}
