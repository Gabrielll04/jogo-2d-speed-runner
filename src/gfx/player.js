/* ==========================================================================
   JOGADOR - corredor cosmico low-poly.
   Um cristal alongado com nucleo pulsante, duas aletas e um propulsor.
   Formas chunky e alto contraste: precisa ser legivel com 180 linhas.
   ========================================================================== */

import * as THREE from 'three';
import { CORES, PISTAS, JOGADOR, TEMPO_TROCA_PISTA } from '../config.js';
import { texturaHalo } from './textures.js';

function easeOutCubic(t) {
  const u = 1 - t;
  return 1 - u * u * u;
}

export class Jogador {
  constructor(cena, particulas) {
    this.particulas = particulas;
    this.grupo = new THREE.Group();
    cena.add(this.grupo);

    /* ---------- corpo ---------- */
    this.corpo = new THREE.Group();
    this.grupo.add(this.corpo);

    const casco = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.52, 0),
      new THREE.MeshLambertMaterial({
        color: 0x0d2740,
        emissive: CORES.ciano,
        emissiveIntensity: 0.35,
        flatShading: true
      })
    );
    casco.scale.set(1, 1.55, 0.85);
    casco.position.y = 0.82;
    this.casco = casco;
    this.corpo.add(casco);

    // Nucleo: esfera brilhante que pulsa. E o ponto focal do personagem.
    this.nucleo = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xd8fbff })
    );
    this.nucleo.position.y = 0.86;
    this.corpo.add(this.nucleo);

    this.halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: texturaHalo(CORES.ciano, 0.15),
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    }));
    this.halo.scale.setScalar(2.1);
    this.halo.position.y = 0.86;
    this.corpo.add(this.halo);

    // Aletas magenta: dao direcao e leem bem em silhueta.
    const geoAleta = new THREE.BoxGeometry(0.1, 0.44, 0.3);
    const matAleta = new THREE.MeshLambertMaterial({
      color: 0x3a0f22,
      emissive: CORES.magenta,
      emissiveIntensity: 0.6,
      flatShading: true
    });
    for (const lado of [-1, 1]) {
      const aleta = new THREE.Mesh(geoAleta, matAleta);
      aleta.position.set(lado * 0.42, 0.62, 0.06);
      aleta.rotation.z = lado * 0.42;
      this.corpo.add(aleta);
    }

    // Propulsor: cone invertido logo abaixo do casco.
    this.propulsor = new THREE.Mesh(
      new THREE.ConeGeometry(0.26, 0.6, 6),
      new THREE.MeshBasicMaterial({
        color: CORES.ciano,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    this.propulsor.rotation.x = Math.PI;
    this.propulsor.position.set(0, 0.24, 0.42);
    this.corpo.add(this.propulsor);

    /* ---------- bolha de escudo ---------- */
    // Octaedro em vez de icosaedro: 12 arestas em vez de 30. A bolha fica
    // legivel com 180 linhas de resolucao e nao esconde o jogador.
    this.escudo = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.2, 0),
      new THREE.MeshBasicMaterial({
        color: CORES.ciano,
        wireframe: true,
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    this.escudo.position.y = 0.82;
    this.escudo.visible = false;
    this.grupo.add(this.escudo);

    /* ---------- sombra falsa no chao ---------- */
    this.sombra = new THREE.Mesh(
      new THREE.PlaneGeometry(1.1, 1.6),
      new THREE.MeshBasicMaterial({
        map: texturaHalo(0x1a6fa0, 0.05),
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    this.sombra.rotation.x = -Math.PI / 2;
    this.sombra.position.y = 0.03;
    this.grupo.add(this.sombra);

    this.reiniciar();
  }

  reiniciar() {
    this.pista = 1;
    this.pistaDestino = 1;
    this.x = PISTAS[1];
    this.xDe = PISTAS[1];
    this.xPara = PISTAS[1];
    this.tTroca = 1;
    this.deslocamentoExterno = 0;   // puxao do buraco negro
    this.y = 0;
    this.vy = 0;
    this.noChao = true;
    this.deslizando = false;
    this.tempoDeslize = 0;
    this.inclinacao = 0;
    this.tempo = 0;
    this.visivel = true;
    this.grupo.visible = true;
    this.escudo.visible = false;
    this.piscando = 0;
    this.corpo.scale.set(1, 1, 1);
    this.grupo.position.set(this.x, 0, 0);
  }

  /* ---------------------------------------------------------------- */
  /* Acoes                                                             */
  /* ---------------------------------------------------------------- */
  trocarPista(direcao) {
    const destino = Math.max(0, Math.min(PISTAS.length - 1, this.pistaDestino + direcao));
    if (destino === this.pistaDestino) return false;
    this.pistaDestino = destino;
    this.xDe = this.x;
    this.xPara = PISTAS[destino];
    this.tTroca = 0;
    return true;
  }

  pular() {
    if (!this.noChao) return false;
    this.vy = JOGADOR.impulsoPulo;
    this.noChao = false;
    this.deslizando = false;
    this.tempoDeslize = 0;
    return true;
  }

  deslizar() {
    if (this.deslizando) return false;
    this.deslizando = true;
    this.tempoDeslize = JOGADOR.duracaoDeslize;
    // Deslizar no ar puxa o jogador pro chao: responde na hora.
    if (!this.noChao && this.vy > 0) this.vy = -JOGADOR.impulsoPulo * 0.5;
    return true;
  }

  /* ---------------------------------------------------------------- */
  /* Simulacao                                                         */
  /* ---------------------------------------------------------------- */
  atualizar(dt, velocidade, pulsoAudio) {
    this.tempo += dt;

    /* --- troca de pista com easing --- */
    if (this.tTroca < 1) {
      this.tTroca = Math.min(1, this.tTroca + dt / TEMPO_TROCA_PISTA);
      this.x = this.xDe + (this.xPara - this.xDe) * easeOutCubic(this.tTroca);
      if (this.tTroca >= 1) this.pista = this.pistaDestino;
    }

    /* --- pulo --- */
    if (!this.noChao) {
      this.vy -= JOGADOR.gravidade * dt;
      this.y += this.vy * dt;
      if (this.y <= 0) {
        this.y = 0;
        this.vy = 0;
        this.noChao = true;
        this.particulas.emitir(this.x, 0.1, 0, {
          quantidade: 5, cor: CORES.ciano, velocidade: 2.4,
          dirY: 0.6, vida: 0.3, tamanho: 0.14, espalhamento: 0.5
        });
      }
    }

    /* --- deslize --- */
    if (this.deslizando) {
      this.tempoDeslize -= dt;
      if (this.tempoDeslize <= 0) this.deslizando = false;
    }

    /* --- inclinacao ao trocar de pista --- */
    const alvoInclinacao = this.tTroca < 1
      ? -Math.sign(this.xPara - this.xDe) * JOGADOR.inclinacaoMax * (1 - this.tTroca)
      : 0;
    this.inclinacao += (alvoInclinacao - this.inclinacao) * Math.min(1, dt * 14);

    /* --- postura visual --- */
    const alvoEscalaY = this.deslizando ? 0.45 : 1;
    const alvoEscalaXZ = this.deslizando ? 1.28 : 1;
    this.corpo.scale.y += (alvoEscalaY - this.corpo.scale.y) * Math.min(1, dt * 18);
    this.corpo.scale.x += (alvoEscalaXZ - this.corpo.scale.x) * Math.min(1, dt * 18);
    this.corpo.scale.z = this.corpo.scale.x;
    this.corpo.rotation.x = this.deslizando ? -0.5 : (this.noChao ? 0 : -0.2);

    /* --- bob de corrida (so no chao, e com passo ligado a velocidade) --- */
    const bob = this.noChao && !this.deslizando
      ? Math.abs(Math.sin(this.tempo * velocidade * 0.55)) * 0.07
      : 0;

    const xFinal = this.x + this.deslocamentoExterno;
    this.grupo.position.set(xFinal, this.y + bob, 0);
    this.grupo.rotation.z = this.inclinacao;
    this.corpo.rotation.y = Math.sin(this.tempo * 1.7) * 0.08;

    /* --- nucleo pulsando no beat --- */
    const escalaNucleo = 1 + pulsoAudio * 0.45 + Math.sin(this.tempo * 6) * 0.06;
    this.nucleo.scale.setScalar(escalaNucleo);
    this.halo.scale.setScalar(2.1 * (0.85 + pulsoAudio * 0.4));
    this.halo.material.opacity = 0.6 + pulsoAudio * 0.35;

    /* --- propulsor --- */
    const forca = 0.6 + Math.random() * 0.5;
    this.propulsor.scale.set(1, forca, 1);
    this.propulsor.material.opacity = 0.55 + forca * 0.35;

    /* --- sombra acompanha e encolhe no pulo --- */
    this.sombra.position.x = 0;
    const alturaRel = Math.min(1, this.y / 2);
    this.sombra.scale.setScalar(1 - alturaRel * 0.45);
    this.sombra.material.opacity = 0.5 * (1 - alturaRel * 0.6);
    this.sombra.position.y = 0.03 - this.y - bob;

    /* --- rastro do propulsor --- */
    if (Math.random() < 0.85) {
      this.particulas.emitir(xFinal, this.y + 0.32 + bob, 0.5, {
        quantidade: 1,
        cor: this.deslizando ? CORES.dourado : CORES.ciano,
        velocidade: 1.2, dirZ: 1, dirY: 0.25, variacao: 0.5,
        vida: 0.42, tamanho: 0.2, espalhamento: 0.22, arrasto: 2.6
      });
    }

    /* --- piscada de invulnerabilidade --- */
    if (this.piscando > 0) {
      this.piscando -= dt;
      this.grupo.visible = Math.floor(this.piscando * 14) % 2 === 0;
      if (this.piscando <= 0) this.grupo.visible = true;
    }

    /* --- escudo --- */
    if (this.escudo.visible) {
      this.escudo.rotation.y += dt * 1.1;
      this.escudo.rotation.x += dt * 0.5;
      this.escudo.material.opacity = 0.35 + Math.sin(this.tempo * 5) * 0.12 + pulsoAudio * 0.2;
      this.escudo.position.y = 0.82 + (this.deslizando ? -0.25 : 0);
    }
  }

  setEscudo(ativo) {
    this.escudo.visible = ativo;
  }

  piscar(segundos) {
    this.piscando = segundos;
  }

  /* ---------------------------------------------------------------- */
  /* Caixa de colisao (AABB) - muda com pulo e deslize                 */
  /* ---------------------------------------------------------------- */
  caixa(saida) {
    const altura = this.deslizando ? JOGADOR.alturaDeslize : JOGADOR.alturaEmPe;
    const cx = this.x + this.deslocamentoExterno;
    saida.minX = cx - JOGADOR.meiaLargura;
    saida.maxX = cx + JOGADOR.meiaLargura;
    saida.minY = this.y;
    saida.maxY = this.y + altura;
    saida.minZ = -JOGADOR.meiaProfundidade;
    saida.maxZ = JOGADOR.meiaProfundidade;
    return saida;
  }
}
