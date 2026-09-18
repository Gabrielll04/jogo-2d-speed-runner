/* ==========================================================================
   MUNDO - monta a cena 3D inteira e cuida da camera.

   Regras de performance que valem para tudo aqui dentro:
     - nenhuma sombra, nenhum reflexo, nenhum pos-processamento
     - no maximo 2 luzes (1 ambiente + 1 direcional)
     - tudo que se repete e pool ou InstancedMesh
   ========================================================================== */

import * as THREE from 'three';
import { CORES, CAMERA, FOG, Z_RECICLA, DIST_SPAWN } from '../config.js';
import { Trilha } from '../gfx/track.js';
import { FundoEspacial } from '../gfx/skybox.js';
import { AmbienteProfundo, BuracoNegro } from '../gfx/planets.js';
import { SistemaParticulas } from '../gfx/particles.js';
import { Jogador } from '../gfx/player.js';
import { PoolObstaculos } from './obstacles.js';
import { PoolPoeira, PoolPowerups } from './collectibles.js';
import { amortecer, entre } from '../core/rng.js';

export class Mundo {
  constructor() {
    this.cena = new THREE.Scene();
    this.cena.background = new THREE.Color(CORES.espacoFundo);
    this.cena.fog = new THREE.Fog(CORES.espacoMedio, FOG.perto, FOG.longe);

    this.camera = new THREE.PerspectiveCamera(
      CAMERA.fov, 16 / 9, CAMERA.perto, CAMERA.longe
    );
    this.camera.position.set(0, CAMERA.altura, CAMERA.recuo);

    /* ---------- luzes (so duas, e de proposito) ---------- */
    this.luzAmbiente = new THREE.AmbientLight(0x6d81c4, 2.0);
    this.cena.add(this.luzAmbiente);
    this.luzSol = new THREE.DirectionalLight(0xfff0e6, 1.8);
    this.luzSol.position.set(-0.7, 1.0, 0.45);
    this.cena.add(this.luzSol);

    /* ---------- cenario ---------- */
    this.fundo = new FundoEspacial(this.cena);
    this.profundo = new AmbienteProfundo(this.cena, 4);
    this.trilha = new Trilha(this.cena);

    this.buracoNegro = new BuracoNegro();
    this.cena.add(this.buracoNegro.grupo);

    /* ---------- entidades ---------- */
    this.particulas = new SistemaParticulas();
    this.cena.add(this.particulas.malha);

    this.obstaculos = new PoolObstaculos(this.cena, 9);
    this.poeira = new PoolPoeira(this.cena, 48);
    this.powerups = new PoolPowerups(this.cena, 3);
    this.jogador = new Jogador(this.cena, this.particulas);

    /* ---------- estado de camera ---------- */
    this.alvoOlhar = new THREE.Vector3(0, CAMERA.alvoAltura, CAMERA.alvoFrente);
    this.olharAtual = this.alvoOlhar.clone();
    this.tremor = 0;
    this.tremorHabilitado = true;
    this.deslocamentoCamera = new THREE.Vector3();
    this.posicaoBase = this.camera.position.clone();
    this.rolagem = 0;
    this.modoCinema = false;
    this.tempoCinema = 0;
    this.tomadaCinema = 0;
    this.tempo = 0;
    this.campoDeVisaoBase = CAMERA.fov;
  }

  /* ------------------------------------------------------------------ */
  reiniciar() {
    this.obstaculos.limpar();
    this.poeira.limpar();
    this.powerups.limpar();
    this.particulas.limpar();
    this.buracoNegro.recolher();
    this.jogador.reiniciar();
    this.tremor = 0;
    this.posicaoBase.set(0, CAMERA.altura, CAMERA.recuo);
    this.rolagem = 0;
    this.camera.fov = this.campoDeVisaoBase;
    this.camera.updateProjectionMatrix();
  }

  /** Sacode a camera (se o jogador nao tiver desligado isso). */
  sacudir(forca) {
    if (!this.tremorHabilitado) return;
    this.tremor = Math.min(1.4, this.tremor + forca);
  }

  /* ------------------------------------------------------------------ */
  /* Atualizacao visual                                                  */
  /* ------------------------------------------------------------------ */
  atualizar(dt, avancoZ, velocidade, pulsoAudio, dilatacao) {
    this.tempo += dt;

    this.fundo.atualizar(dt, avancoZ);
    this.profundo.atualizar(dt, avancoZ);
    this.trilha.atualizar(dt, avancoZ, pulsoAudio);

    this.obstaculos.atualizar(dt, avancoZ, this.tempo, Z_RECICLA);
    this.powerups.atualizar(dt, avancoZ, this.tempo, Z_RECICLA);
    this.particulas.atualizar(dt, avancoZ);

    this.atualizarCamera(dt, velocidade, pulsoAudio, dilatacao);
  }

  atualizarCamera(dt, velocidade, pulsoAudio, dilatacao) {
    const jog = this.jogador;
    const base = this.posicaoBase;

    if (this.modoCinema) {
      this.cameraCinematografica(dt);
      this.rolagem = amortecer(this.rolagem, 0, 0.002, dt);
    } else {
      // A camera segue o jogador com atraso: da peso ao movimento.
      const alvoX = (jog.x + jog.deslocamentoExterno) * 0.42;
      base.x = amortecer(base.x, alvoX, 0.0012, dt);
      base.y = amortecer(base.y, CAMERA.altura + jog.y * 0.28 + pulsoAudio * 0.05, 0.0009, dt);
      base.z = amortecer(base.z, CAMERA.recuo, 0.002, dt);

      this.alvoOlhar.set(
        (jog.x + jog.deslocamentoExterno) * 0.6,
        CAMERA.alvoAltura + jog.y * 0.35,
        CAMERA.alvoFrente
      );
      this.rolagem = amortecer(this.rolagem, -jog.inclinacao * 0.3, 0.002, dt);
    }

    this.olharAtual.lerp(this.alvoOlhar, Math.min(1, dt * 9));

    /* --- tremor: vive num offset separado, nunca acumula na posicao base --- */
    if (this.tremor > 0) {
      this.tremor = Math.max(0, this.tremor - dt * 2.6);
      const f = this.tremor * this.tremor * 0.42;
      this.deslocamentoCamera.set(
        (Math.random() - 0.5) * f,
        (Math.random() - 0.5) * f,
        (Math.random() - 0.5) * f * 0.5
      );
    } else {
      this.deslocamentoCamera.multiplyScalar(0.7);
    }

    this.camera.position.copy(base).add(this.deslocamentoCamera);
    this.camera.lookAt(this.olharAtual);
    this.camera.rotateZ(this.rolagem);

    /* --- FOV reage a velocidade e a dilatacao temporal --- */
    const fovAlvo = this.campoDeVisaoBase
      + Math.min(9, (velocidade - 21) * 0.34)
      - (dilatacao ? 7 : 0);
    if (Math.abs(this.camera.fov - fovAlvo) > 0.05) {
      this.camera.fov = amortecer(this.camera.fov, fovAlvo, 0.02, dt);
      this.camera.updateProjectionMatrix();
    }
  }

  /**
   * Tomadas cinematograficas do attract: a camera passeia, mas sempre
   * mantendo o jogador em quadro (ou revelando o buraco negro ao lado).
   */
  cameraCinematografica(dt) {
    this.tempoCinema += dt;
    const jog = this.jogador;
    const t = this.tempoCinema;
    const base = this.posicaoBase;

    switch (this.tomadaCinema) {
      case 0: // lateral baixa, quase raspando a pista
        base.set(
          jog.x + Math.sin(t * 0.3) * 3.4 + 3.2,
          1.05,
          2.6
        );
        this.alvoOlhar.set(jog.x, 1.0, -16);
        break;
      case 1: // por cima, mostrando a trilha desaparecendo no fog
        base.set(jog.x * 0.3, 7.4 + Math.sin(t * 0.4) * 0.6, 7.5);
        this.alvoOlhar.set(0, 0.4, -34);
        break;
      case 2: { // revela o que tem ao lado (buraco negro, se houver)
        const bn = this.buracoNegro;
        const olhar = bn.ativo ? bn.grupo.position : { x: -26, y: 14, z: -70 };
        base.set(jog.x * 0.5, 3.0, 5.6);
        this.alvoOlhar.set(olhar.x * 0.55, olhar.y * 0.5 + 1, olhar.z * 0.45);
        break;
      }
      default: // padrao de jogo, so que mais fechada
        base.set(jog.x * 0.5, CAMERA.altura - 0.5, CAMERA.recuo - 1.4);
        this.alvoOlhar.set(jog.x * 0.6, CAMERA.alvoAltura, CAMERA.alvoFrente);
        break;
    }
  }

  proximaTomada(rng) {
    this.tomadaCinema = Math.floor(entre(rng, 0, 4)) % 4;
    this.tempoCinema = 0;
  }

  setCinema(ativo) {
    this.modoCinema = ativo;
    if (!ativo) {
      this.posicaoBase.set(0, CAMERA.altura, CAMERA.recuo);
      this.rolagem = 0;
    }
  }

  /** Reduz custo do cenario quando o governador derruba a qualidade. */
  aplicarQualidade(indice, escalaParticulas) {
    this.particulas.setEscala(escalaParticulas);
    this.profundo.setQuantidade(indice === 0 ? 4 : (indice === 1 ? 3 : 2));
    this.fundo.camadaLonge.pontos.visible = indice < 2;
  }

  get zDeSpawn() {
    return -DIST_SPAWN;
  }
}
