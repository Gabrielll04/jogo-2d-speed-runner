/* ==========================================================================
   PARTICULAS - um unico THREE.Points com pool fixo.
   Nada de criar/destruir objeto por faisca: as particulas mortas apenas
   recebem tamanho 0 e voltam para a pilha de livres.
   ========================================================================== */

import * as THREE from 'three';
import { MAX_PARTICULAS } from '../config.js';
import { texturaParticula } from './textures.js';

const VERT = `
attribute float tamanho;
attribute vec3 tom;
varying vec3 vTom;
void main() {
  vTom = tom;
  vec4 posVista = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * posVista;
  gl_PointSize = tamanho * (110.0 / max(-posVista.z, 1.0));
}`;

const FRAG = `
uniform sampler2D mapa;
varying vec3 vTom;
void main() {
  vec4 t = texture2D(mapa, gl_PointCoord);
  if (t.a < 0.02) discard;
  gl_FragColor = vec4(vTom * t.rgb, t.a);
}`;

export class SistemaParticulas {
  constructor() {
    this.capacidade = MAX_PARTICULAS;
    this.escala = 1;

    this.posicoes = new Float32Array(this.capacidade * 3);
    this.tamanhos = new Float32Array(this.capacidade);
    this.tons = new Float32Array(this.capacidade * 3);

    this.vx = new Float32Array(this.capacidade);
    this.vy = new Float32Array(this.capacidade);
    this.vz = new Float32Array(this.capacidade);
    this.vida = new Float32Array(this.capacidade);
    this.vidaMax = new Float32Array(this.capacidade);
    this.tamanhoBase = new Float32Array(this.capacidade);
    this.gravidade = new Float32Array(this.capacidade);
    this.arrasto = new Float32Array(this.capacidade);
    this.comMundo = new Uint8Array(this.capacidade);
    this.ativa = new Uint8Array(this.capacidade);

    this.livres = [];
    for (let i = this.capacidade - 1; i >= 0; i--) this.livres.push(i);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.posicoes, 3));
    geo.setAttribute('tamanho', new THREE.BufferAttribute(this.tamanhos, 1));
    geo.setAttribute('tom', new THREE.BufferAttribute(this.tons, 3));
    geo.setDrawRange(0, this.capacidade);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 400);

    const mat = new THREE.ShaderMaterial({
      uniforms: { mapa: { value: texturaParticula() } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    this.malha = new THREE.Points(geo, mat);
    this.malha.frustumCulled = false;
    this.malha.renderOrder = 6;
    this.geo = geo;
  }

  /** Reduz o teto de particulas vivas (governador de qualidade). */
  setEscala(fator) {
    this.escala = Math.max(0.2, Math.min(1, fator));
  }

  get limiteAtual() {
    return Math.floor(this.capacidade * this.escala);
  }

  emitir(x, y, z, opcoes) {
    const o = opcoes || {};
    const quantidade = Math.max(1, Math.round((o.quantidade || 1) * this.escala));
    for (let n = 0; n < quantidade; n++) {
      if (this.livres.length === 0) return;
      if (this.capacidade - this.livres.length >= this.limiteAtual) return;
      const i = this.livres.pop();
      const esp = o.espalhamento === undefined ? 0.2 : o.espalhamento;

      this.posicoes[i * 3]     = x + (Math.random() - 0.5) * esp;
      this.posicoes[i * 3 + 1] = y + (Math.random() - 0.5) * esp;
      this.posicoes[i * 3 + 2] = z + (Math.random() - 0.5) * esp;

      const vel = o.velocidade || 2;
      const dirX = o.dirX === undefined ? (Math.random() - 0.5) * 2 : o.dirX;
      const dirY = o.dirY === undefined ? (Math.random() - 0.5) * 2 : o.dirY;
      const dirZ = o.dirZ === undefined ? (Math.random() - 0.5) * 2 : o.dirZ;
      const variacao = o.variacao === undefined ? 0.6 : o.variacao;

      this.vx[i] = (dirX + (Math.random() - 0.5) * variacao) * vel;
      this.vy[i] = (dirY + (Math.random() - 0.5) * variacao) * vel;
      this.vz[i] = (dirZ + (Math.random() - 0.5) * variacao) * vel;

      const vida = (o.vida || 0.5) * (0.7 + Math.random() * 0.6);
      this.vida[i] = vida;
      this.vidaMax[i] = vida;
      this.tamanhoBase[i] = (o.tamanho || 0.18) * (0.7 + Math.random() * 0.7);
      this.gravidade[i] = o.gravidade === undefined ? 0 : o.gravidade;
      this.arrasto[i] = o.arrasto === undefined ? 1.8 : o.arrasto;
      this.comMundo[i] = o.comMundo === false ? 0 : 1;
      this.ativa[i] = 1;

      const cor = o.cor || 0xffffff;
      this.tons[i * 3]     = ((cor >> 16) & 255) / 255;
      this.tons[i * 3 + 1] = ((cor >> 8) & 255) / 255;
      this.tons[i * 3 + 2] = (cor & 255) / 255;
      this.tamanhos[i] = this.tamanhoBase[i];
    }
  }

  /**
   * dt        - delta em segundos
   * avancoZ   - quanto o mundo andou neste quadro (particulas do mundo seguem)
   */
  atualizar(dt, avancoZ) {
    for (let i = 0; i < this.capacidade; i++) {
      if (!this.ativa[i]) continue;
      this.vida[i] -= dt;
      if (this.vida[i] <= 0) {
        this.ativa[i] = 0;
        this.tamanhos[i] = 0;
        this.livres.push(i);
        continue;
      }
      const amortecimento = Math.max(0, 1 - this.arrasto[i] * dt);
      this.vx[i] *= amortecimento;
      this.vy[i] *= amortecimento;
      this.vz[i] *= amortecimento;
      this.vy[i] -= this.gravidade[i] * dt;

      this.posicoes[i * 3]     += this.vx[i] * dt;
      this.posicoes[i * 3 + 1] += this.vy[i] * dt;
      this.posicoes[i * 3 + 2] += this.vz[i] * dt + (this.comMundo[i] ? avancoZ : 0);

      const t = this.vida[i] / this.vidaMax[i];
      this.tamanhos[i] = this.tamanhoBase[i] * (0.25 + t * 0.75);

      // Passou da camera: recolhe.
      if (this.posicoes[i * 3 + 2] > 16) {
        this.ativa[i] = 0;
        this.tamanhos[i] = 0;
        this.livres.push(i);
      }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.tamanho.needsUpdate = true;
    this.geo.attributes.tom.needsUpdate = true;
  }

  limpar() {
    for (let i = 0; i < this.capacidade; i++) {
      if (this.ativa[i]) {
        this.ativa[i] = 0;
        this.tamanhos[i] = 0;
        this.livres.push(i);
      }
    }
    this.geo.attributes.tamanho.needsUpdate = true;
  }

  get vivas() {
    return this.capacidade - this.livres.length;
  }
}
