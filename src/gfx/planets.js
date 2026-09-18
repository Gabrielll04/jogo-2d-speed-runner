/* ==========================================================================
   CORPOS CELESTES - planetas low-poly, estrelas distantes e o buraco negro.

   Planetas sao poucos objetos grandes que passam devagar ao fundo: custam
   quase nada e sao os responsaveis pela sensacao de "estamos viajando".
   ========================================================================== */

import * as THREE from 'three';
import { CORES, BURACO_NEGRO } from '../config.js';
import {
  texturaPlaneta, texturaAnel, texturaHalo, texturaDisco,
  numeroDeReceitas, corDaReceita
} from './textures.js';
import { criarRng, entre, inteiro } from '../core/rng.js';

const Z_NASCE = -400;
const Z_MORRE = 45;

/* --------------------------------------------------------------------------
   PLANETAS
   -------------------------------------------------------------------------- */
class Planeta {
  constructor(indice, rng) {
    this.grupo = new THREE.Group();
    this.receita = indice % numeroDeReceitas();

    const raio = entre(rng, 9, 26);
    this.raio = raio;

    // 12x8 segmentos + flatShading: facetas visiveis, do jeito que a gente quer.
    const geo = new THREE.SphereGeometry(raio, 12, 8);
    const mat = new THREE.MeshLambertMaterial({
      map: texturaPlaneta(this.receita),
      flatShading: true,
      fog: false
    });
    this.corpo = new THREE.Mesh(geo, mat);
    this.grupo.add(this.corpo);

    // Contorno emissivo fraco: destaca a silhueta contra o preto do espaco.
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: texturaHalo(corDaReceita(this.receita), 0.55),
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false
    }));
    halo.scale.setScalar(raio * 3.1);
    this.grupo.add(halo);

    // Cerca de um terco dos planetas ganha anel.
    if (rng() < 0.38) {
      const anelGeo = new THREE.RingGeometry(raio * 1.35, raio * 2.1, 28, 1);
      const anelMat = new THREE.MeshBasicMaterial({
        map: texturaAnel(indice + 3),
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
        depthWrite: false,
        fog: false
      });
      const anel = new THREE.Mesh(anelGeo, anelMat);
      anel.rotation.x = Math.PI / 2 - entre(rng, 0.25, 0.7);
      anel.rotation.z = entre(rng, 0, Math.PI);
      this.grupo.add(anel);
    }

    this.giro = entre(rng, 0.02, 0.09) * (rng() > 0.5 ? 1 : -1);
    this.parallax = entre(rng, 0.16, 0.34);
    this.reposicionar(rng, true);
  }

  reposicionar(rng, inicial) {
    const lado = rng() > 0.5 ? 1 : -1;
    this.grupo.position.x = lado * entre(rng, 26, 92);
    this.grupo.position.y = entre(rng, -14, 52);
    this.grupo.position.z = inicial
      ? entre(rng, Z_NASCE, -80)
      : Z_NASCE - entre(rng, 0, 90);
    this.corpo.rotation.y = entre(rng, 0, Math.PI * 2);
    this.corpo.rotation.z = entre(rng, -0.35, 0.35);
  }

  atualizar(dt, avancoZ, rng) {
    this.corpo.rotation.y += this.giro * dt;
    this.grupo.position.z += avancoZ * this.parallax;
    if (this.grupo.position.z > Z_MORRE) this.reposicionar(rng, false);
  }
}

/* --------------------------------------------------------------------------
   ESTRELA DISTANTE - esfera emissiva + halo aditivo.
   -------------------------------------------------------------------------- */
class EstrelaDistante {
  constructor(cor, rng) {
    this.grupo = new THREE.Group();
    const raio = entre(rng, 1.6, 4.2);

    const nucleo = new THREE.Mesh(
      new THREE.SphereGeometry(raio, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false })
    );
    this.grupo.add(nucleo);

    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: texturaHalo(cor, 0.12),
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false
    }));
    halo.scale.setScalar(raio * 9);
    this.halo = halo;
    this.grupo.add(halo);

    this.fase = entre(rng, 0, Math.PI * 2);
    this.escalaHalo = raio * 9;
    this.parallax = entre(rng, 0.1, 0.2);
    this.reposicionar(rng, true);
  }

  reposicionar(rng, inicial) {
    this.grupo.position.x = (rng() > 0.5 ? 1 : -1) * entre(rng, 30, 130);
    this.grupo.position.y = entre(rng, 6, 70);
    this.grupo.position.z = inicial ? entre(rng, Z_NASCE, -120) : Z_NASCE;
  }

  atualizar(dt, avancoZ, rng, tempo) {
    this.grupo.position.z += avancoZ * this.parallax;
    const pulso = 0.9 + Math.sin(tempo * 1.6 + this.fase) * 0.12;
    this.halo.scale.setScalar(this.escalaHalo * pulso);
    if (this.grupo.position.z > Z_MORRE) this.reposicionar(rng, false);
  }
}

/* --------------------------------------------------------------------------
   BURACO NEGRO
   Esfera preta + discos de acrecao girando + particulas espiralando.
   Nasce SEMPRE ao lado da trilha (nunca em cima) e, enquanto esta perto,
   aplica uma forca lateral no jogador. Tensao sem ser letal.
   -------------------------------------------------------------------------- */
export class BuracoNegro {
  constructor() {
    this.grupo = new THREE.Group();
    this.grupo.visible = false;
    this.ativo = false;
    this.lado = 1;

    const horizonte = new THREE.Mesh(
      new THREE.SphereGeometry(2.6, 14, 10),
      new THREE.MeshBasicMaterial({ color: 0x000000, fog: false })
    );
    this.grupo.add(horizonte);

    // Dois toros finos com a textura quente, inclinados em angulos diferentes.
    this.discos = [];
    for (let i = 0; i < 2; i++) {
      const geo = new THREE.TorusGeometry(4.4 + i * 1.5, 0.34 - i * 0.12, 6, 30);
      const mat = new THREE.MeshBasicMaterial({
        map: texturaDisco(),
        transparent: true,
        opacity: 0.95 - i * 0.3,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false
      });
      const disco = new THREE.Mesh(geo, mat);
      disco.rotation.x = Math.PI / 2 - 0.42 - i * 0.16;
      disco.rotation.y = i * 0.3;
      this.discos.push(disco);
      this.grupo.add(disco);
    }

    const brilho = new THREE.Sprite(new THREE.SpriteMaterial({
      map: texturaHalo(CORES.magenta, 0.35),
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false
    }));
    brilho.scale.setScalar(22);
    this.grupo.add(brilho);

    // Particulas em espiral sendo sugadas (geometria propria, local).
    this.quantidadeParticulas = 90;
    const pos = new Float32Array(this.quantidadeParticulas * 3);
    const geoPart = new THREE.BufferGeometry();
    geoPart.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geoPart.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 40);
    this.posParticulas = pos;
    this.anguloParticulas = new Float32Array(this.quantidadeParticulas);
    this.raioParticulas = new Float32Array(this.quantidadeParticulas);
    this.alturaParticulas = new Float32Array(this.quantidadeParticulas);
    this.velParticulas = new Float32Array(this.quantidadeParticulas);

    const rng = criarRng(4242);
    for (let i = 0; i < this.quantidadeParticulas; i++) {
      this.anguloParticulas[i] = entre(rng, 0, Math.PI * 2);
      this.raioParticulas[i] = entre(rng, 5, 17);
      this.alturaParticulas[i] = entre(rng, -3.5, 3.5);
      this.velParticulas[i] = entre(rng, 0.6, 2.1);
    }

    this.particulas = new THREE.Points(geoPart, new THREE.PointsMaterial({
      color: CORES.dourado,
      size: 2.2,
      sizeAttenuation: false,
      map: texturaHalo(CORES.dourado, 0.2),
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false
    }));
    this.particulas.frustumCulled = false;
    this.geoParticulas = geoPart;
    this.grupo.add(this.particulas);

    this.rng = criarRng(99);
  }

  /** Coloca o buraco negro de volta no comeco do corredor, de um dos lados. */
  surgir() {
    this.lado = this.rng() > 0.5 ? 1 : -1;
    this.grupo.position.set(
      this.lado * entre(this.rng, BURACO_NEGRO.lateral, BURACO_NEGRO.lateral + 5),
      entre(this.rng, 1.5, 5.5),
      -150
    );
    this.grupo.visible = true;
    this.ativo = true;
  }

  recolher() {
    this.grupo.visible = false;
    this.ativo = false;
  }

  /**
   * Devolve a forca lateral (unidades de deslocamento) que o jogador sofre.
   * Positiva = puxa para +x.
   */
  atualizar(dt, avancoZ, tempo) {
    if (!this.ativo) return 0;

    this.grupo.position.z += avancoZ;
    if (this.grupo.position.z > 40) {
      this.recolher();
      return 0;
    }

    this.discos[0].rotation.z += dt * 1.9;
    this.discos[1].rotation.z -= dt * 1.25;

    for (let i = 0; i < this.quantidadeParticulas; i++) {
      this.anguloParticulas[i] += dt * this.velParticulas[i] * (18 / (this.raioParticulas[i] + 2));
      this.raioParticulas[i] -= dt * this.velParticulas[i] * 1.5;
      this.alturaParticulas[i] *= (1 - dt * 0.5);
      if (this.raioParticulas[i] < 3) {
        this.raioParticulas[i] = entre(this.rng, 13, 20);
        this.alturaParticulas[i] = entre(this.rng, -4, 4);
        this.anguloParticulas[i] = entre(this.rng, 0, Math.PI * 2);
      }
      const r = this.raioParticulas[i];
      const a = this.anguloParticulas[i];
      this.posParticulas[i * 3] = Math.cos(a) * r;
      this.posParticulas[i * 3 + 1] = this.alturaParticulas[i] + Math.sin(a) * r * 0.32;
      this.posParticulas[i * 3 + 2] = Math.sin(a) * r * 0.75;
    }
    this.geoParticulas.attributes.position.needsUpdate = true;

    // Forca: pico quando o buraco negro esta na altura do jogador (z ~ 0).
    const dz = Math.abs(this.grupo.position.z);
    if (dz > BURACO_NEGRO.alcance) return 0;
    const intensidade = 1 - dz / BURACO_NEGRO.alcance;
    return this.lado * BURACO_NEGRO.puxaoMax * intensidade * intensidade;
  }
}

/* --------------------------------------------------------------------------
   AMBIENTE PROFUNDO - junta planetas e estrelas distantes.
   -------------------------------------------------------------------------- */
export class AmbienteProfundo {
  constructor(cena, quantidadePlanetas = 4) {
    this.grupo = new THREE.Group();
    cena.add(this.grupo);
    this.rng = criarRng(20240915);
    this.tempo = 0;

    this.planetas = [];
    for (let i = 0; i < quantidadePlanetas; i++) {
      const p = new Planeta(inteiro(this.rng, 0, 99), this.rng);
      this.planetas.push(p);
      this.grupo.add(p.grupo);
    }

    this.estrelas = [];
    const tons = [CORES.ciano, CORES.dourado, CORES.magenta];
    for (let i = 0; i < 3; i++) {
      const e = new EstrelaDistante(tons[i], this.rng);
      this.estrelas.push(e);
      this.grupo.add(e.grupo);
    }
  }

  atualizar(dt, avancoZ) {
    this.tempo += dt;
    for (const p of this.planetas) p.atualizar(dt, avancoZ, this.rng);
    for (const e of this.estrelas) e.atualizar(dt, avancoZ, this.rng, this.tempo);
  }

  /** O governador pode pedir menos planetas em maquinas fracas. */
  setQuantidade(n) {
    for (let i = 0; i < this.planetas.length; i++) {
      this.planetas[i].grupo.visible = i < n;
    }
  }
}
