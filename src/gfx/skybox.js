/* ==========================================================================
   FUNDO ESPACIAL - campo de estrelas em duas camadas (parallax), nebulosas
   e um cometa ocasional. Tudo barato: dois THREE.Points e meia duzia de
   sprites grandes que so deslizam. Zero fisica, zero luz.
   ========================================================================== */

import * as THREE from 'three';
import { CORES } from '../config.js';
import { texturaPonto, texturaNebulosa, texturaHalo } from './textures.js';
import { criarRng, entre, escolher } from '../core/rng.js';

const PROFUNDIDADE = 460;

/** Uma camada de estrelas. */
function criarCamada(quantidade, tamanho, semente, espalhamentoXY, opacidade) {
  const rng = criarRng(semente);
  const posicoes = new Float32Array(quantidade * 3);
  const cores = new Float32Array(quantidade * 3);
  const tons = [0xffffff, 0xcfe4ff, 0x9fd4ff, 0xffe9c0, 0xffc0d8];

  for (let i = 0; i < quantidade; i++) {
    posicoes[i * 3]     = entre(rng, -espalhamentoXY, espalhamentoXY);
    posicoes[i * 3 + 1] = entre(rng, -espalhamentoXY * 0.45, espalhamentoXY * 0.8);
    posicoes[i * 3 + 2] = entre(rng, -PROFUNDIDADE, 30);
    const cor = escolher(rng, tons);
    const brilho = entre(rng, 0.45, 1.0);
    cores[i * 3]     = (((cor >> 16) & 255) / 255) * brilho;
    cores[i * 3 + 1] = (((cor >> 8) & 255) / 255) * brilho;
    cores[i * 3 + 2] = ((cor & 255) / 255) * brilho;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(posicoes, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(cores, 3));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), PROFUNDIDADE * 2);

  const mat = new THREE.PointsMaterial({
    size: tamanho,
    sizeAttenuation: false,      // estrela tem sempre o mesmo tamanho em pixels
    map: texturaPonto(),
    vertexColors: true,
    transparent: true,
    opacity: opacidade,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    fog: false
  });

  const pontos = new THREE.Points(geo, mat);
  pontos.frustumCulled = false;
  return { pontos, posicoes, geo, quantidade };
}

export class FundoEspacial {
  constructor(cena) {
    this.grupo = new THREE.Group();
    this.grupo.renderOrder = -10;
    cena.add(this.grupo);

    // Camada distante: muitas estrelas pequenas, quase paradas.
    this.camadaLonge = criarCamada(420, 1.6, 1234, 320, 0.85);
    this.camadaLonge.pontos.renderOrder = -10;
    // Camada proxima: menos estrelas, maiores e mais rapidas.
    this.camadaPerto = criarCamada(160, 3.0, 9876, 220, 1.0);
    this.camadaPerto.pontos.renderOrder = -9;

    this.grupo.add(this.camadaLonge.pontos);
    this.grupo.add(this.camadaPerto.pontos);

    this.criarNebulosas();
    this.criarCometa();

    this.tempo = 0;
    this.proximoCometa = entre(criarRng(42), 8, 20);
  }

  criarNebulosas() {
    const rng = criarRng(777);
    const paletas = [
      [CORES.nebulaA, 0x2a4fa0],
      [CORES.nebulaB, 0x7a2f8f],
      [CORES.nebulaC, 0x8f2f5a],
      [0x123a5e, CORES.nebulaA]
    ];
    this.nebulosas = [];
    for (let i = 0; i < 5; i++) {
      const tex = texturaNebulosa(i + 1, paletas[i % paletas.length]);
      const mat = new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        opacity: entre(rng, 0.42, 0.7),
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
        fog: false
      });
      const sprite = new THREE.Sprite(mat);
      const escala = entre(rng, 90, 190);
      sprite.scale.set(escala, escala * entre(rng, 0.6, 0.95), 1);
      sprite.position.set(
        entre(rng, -150, 150),
        entre(rng, -30, 90),
        entre(rng, -PROFUNDIDADE, -120)
      );
      sprite.renderOrder = -11;
      sprite.userData.deriva = entre(rng, 0.03, 0.1);
      this.grupo.add(sprite);
      this.nebulosas.push(sprite);
    }
  }

  criarCometa() {
    this.cometa = new THREE.Group();
    this.cometa.visible = false;

    const nucleo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: texturaHalo(0xdfefff, 0.1),
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      fog: false
    }));
    nucleo.scale.set(7, 7, 1);

    const cauda = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        map: texturaHalo(0x8fd8ff, 0.02),
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
        fog: false
      })
    );
    cauda.scale.set(64, 5, 1);
    cauda.position.x = -32;

    this.cometa.add(cauda);
    this.cometa.add(nucleo);
    this.cometa.renderOrder = -8;
    this.grupo.add(this.cometa);

    this.cometaT = 0;
    this.cometaDuracao = 3.2;
  }

  dispararCometa() {
    const rng = criarRng(Math.floor(Math.random() * 100000));
    const alturaInicio = entre(rng, 10, 80);
    const direcao = rng() > 0.5 ? 1 : -1;
    this.cometaDe = new THREE.Vector3(-direcao * 210, alturaInicio, entre(rng, -360, -200));
    this.cometaPara = new THREE.Vector3(direcao * 210, alturaInicio - entre(rng, 20, 70), this.cometaDe.z);
    this.cometa.rotation.z = Math.atan2(
      this.cometaPara.y - this.cometaDe.y,
      this.cometaPara.x - this.cometaDe.x
    ) + (direcao > 0 ? 0 : Math.PI);
    this.cometa.scale.setScalar(direcao > 0 ? 1 : 1);
    this.cometaT = 0;
    this.cometaDuracao = entre(rng, 2.4, 4.0);
    this.cometa.visible = true;
  }

  /**
   * avancoZ - unidades que o mundo andou neste quadro.
   * dt      - delta em segundos.
   */
  atualizar(dt, avancoZ) {
    this.tempo += dt;

    // Parallax: quanto mais longe, menos a estrela anda.
    this.moverCamada(this.camadaLonge, avancoZ * 0.05);
    this.moverCamada(this.camadaPerto, avancoZ * 0.14);

    for (const neb of this.nebulosas) {
      neb.position.z += avancoZ * 0.02;
      neb.position.x -= neb.userData.deriva * dt * 6;
      if (neb.position.z > -60) neb.position.z -= PROFUNDIDADE - 60;
      if (neb.position.x < -190) neb.position.x = 190;
    }

    // Cometa
    if (this.cometa.visible) {
      this.cometaT += dt;
      const t = this.cometaT / this.cometaDuracao;
      if (t >= 1) {
        this.cometa.visible = false;
        this.proximoCometa = this.tempo + entre(criarRng(Math.floor(this.tempo * 97)), 14, 34);
      } else {
        this.cometa.position.lerpVectors(this.cometaDe, this.cometaPara, t);
        const fade = Math.sin(Math.PI * Math.min(1, t * 1.15));
        this.cometa.children[0].material.opacity = 0.55 * fade;
        this.cometa.children[1].material.opacity = fade;
      }
    } else if (this.tempo > this.proximoCometa) {
      this.dispararCometa();
    }
  }

  moverCamada(camada, avanco) {
    const pos = camada.posicoes;
    for (let i = 0; i < camada.quantidade; i++) {
      const idx = i * 3 + 2;
      pos[idx] += avanco;
      if (pos[idx] > 30) pos[idx] -= PROFUNDIDADE + 30;
    }
    camada.geo.attributes.position.needsUpdate = true;
  }
}
