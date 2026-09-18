/* ==========================================================================
   TRILHA - a grade synthwave flutuando no vazio.

   Composicao:
     - chao quase preto (da profundidade e recebe o fog)
     - 4 trilhos longitudinais emissivos, marcando as 3 pistas
     - travessas transversais em InstancedMesh (1 draw call) que deslizam
     - postes de neon nas bordas, tambem instanciados
   O truque do deslizamento e um offset em modulo: nada nasce, nada morre.
   ========================================================================== */

import * as THREE from 'three';
import { CORES, LARGURA_PISTA, FOG, Z_RECICLA } from '../config.js';
import { texturaHalo } from './textures.js';

const COMPRIMENTO = FOG.longe + 30;
const ESPACO_TRAVESSA = 4;
const TRAVESSAS = Math.ceil(COMPRIMENTO / ESPACO_TRAVESSA);
const ESPACO_POSTE = 16;
const POSTES_POR_LADO = Math.ceil(COMPRIMENTO / ESPACO_POSTE);

export class Trilha {
  constructor(cena) {
    this.grupo = new THREE.Group();
    cena.add(this.grupo);

    const larguraTotal = LARGURA_PISTA * 3;
    const meia = larguraTotal / 2;

    /* ---------- chao ---------- */
    const chao = new THREE.Mesh(
      new THREE.PlaneGeometry(larguraTotal + 0.6, COMPRIMENTO),
      new THREE.MeshBasicMaterial({ color: 0x0b1440 })
    );
    chao.rotation.x = -Math.PI / 2;
    chao.position.set(0, -0.02, Z_RECICLA - COMPRIMENTO / 2);
    chao.renderOrder = 0;
    this.grupo.add(chao);

    /* ---------- trilhos longitudinais ---------- */
    this.trilhos = [];
    const bordas = [-meia, -LARGURA_PISTA / 2, LARGURA_PISTA / 2, meia];
    bordas.forEach((x, i) => {
      const externo = (i === 0 || i === bordas.length - 1);
      const geo = new THREE.BoxGeometry(externo ? 0.14 : 0.08, 0.05, COMPRIMENTO);
      const mat = new THREE.MeshBasicMaterial({
        color: externo ? CORES.ciano : CORES.cianoMedio
      });
      const trilho = new THREE.Mesh(geo, mat);
      trilho.position.set(x, 0.01, Z_RECICLA - COMPRIMENTO / 2);
      trilho.renderOrder = 1;
      this.grupo.add(trilho);
      this.trilhos.push({ malha: trilho, externo });
    });

    /* ---------- travessas ---------- */
    const geoTravessa = new THREE.BoxGeometry(larguraTotal + 0.3, 0.04, 0.16);
    this.matTravessa = new THREE.MeshBasicMaterial({ color: 0x2ba8c9 });
    this.travessas = new THREE.InstancedMesh(geoTravessa, this.matTravessa, TRAVESSAS);
    this.travessas.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.travessas.frustumCulled = false;
    this.travessas.renderOrder = 1;
    this.grupo.add(this.travessas);

    /* ---------- postes de neon nas bordas ---------- */
    const geoPoste = new THREE.BoxGeometry(0.12, 1.1, 0.12);
    this.matPoste = new THREE.MeshBasicMaterial({ color: CORES.magenta });
    this.postes = new THREE.InstancedMesh(geoPoste, this.matPoste, POSTES_POR_LADO * 2);
    this.postes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.postes.frustumCulled = false;
    this.postes.renderOrder = 1;
    this.grupo.add(this.postes);

    /* ---------- brilho do horizonte ---------- */
    // Onde a pista mergulha no fog nasce uma mancha de luz. Custa um plano
    // aditivo e e o que tira a cena da sensacao de "preto com riscos".
    const zHorizonte = Z_RECICLA - FOG.longe + 6;
    this.brilhoHorizonte = new THREE.Mesh(
      new THREE.PlaneGeometry(170, 17),
      new THREE.MeshBasicMaterial({
        map: texturaHalo(0x2f7fff, 0.05),
        color: 0x6fd6ff,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false
      })
    );
    this.brilhoHorizonte.position.set(0, 0.2, zHorizonte);
    this.brilhoHorizonte.renderOrder = -5;
    this.grupo.add(this.brilhoHorizonte);

    // Faixa estreita e quente logo acima do chao: o "sol" do synthwave.
    this.faixaHorizonte = new THREE.Mesh(
      new THREE.PlaneGeometry(56, 5),
      new THREE.MeshBasicMaterial({
        map: texturaHalo(CORES.magenta, 0.04),
        color: 0xff8ac0,
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false
      })
    );
    this.faixaHorizonte.position.set(0, 0.25, zHorizonte + 2);
    this.faixaHorizonte.renderOrder = -4;
    this.grupo.add(this.faixaHorizonte);

    this.meiaLarguraExterna = meia + 0.55;
    this.dummy = new THREE.Object3D();
    this.offsetTravessa = 0;
    this.offsetPoste = 0;
    this.tempo = 0;
    this.pulso = 0;

    this.corTrilhoBase = new THREE.Color(CORES.ciano);
    this.corTrilhoInterno = new THREE.Color(CORES.cianoMedio);
    this.corTravessaBase = new THREE.Color(0x2ba8c9);
    this.corPosteBase = new THREE.Color(CORES.magenta);

    this.escreverInstancias();
  }

  escreverInstancias() {
    const d = this.dummy;
    for (let i = 0; i < TRAVESSAS; i++) {
      d.position.set(0, 0.012, Z_RECICLA - i * ESPACO_TRAVESSA + this.offsetTravessa);
      d.rotation.set(0, 0, 0);
      d.scale.set(1, 1, 1);
      d.updateMatrix();
      this.travessas.setMatrixAt(i, d.matrix);
    }
    this.travessas.instanceMatrix.needsUpdate = true;

    for (let i = 0; i < POSTES_POR_LADO; i++) {
      const z = Z_RECICLA - i * ESPACO_POSTE + this.offsetPoste;
      for (let lado = 0; lado < 2; lado++) {
        d.position.set(lado === 0 ? -this.meiaLarguraExterna : this.meiaLarguraExterna, 0.5, z);
        d.rotation.set(0, 0, 0);
        d.scale.set(1, 1, 1);
        d.updateMatrix();
        this.postes.setMatrixAt(i * 2 + lado, d.matrix);
      }
    }
    this.postes.instanceMatrix.needsUpdate = true;
  }

  /**
   * dt      - delta em segundos
   * avancoZ - unidades que o mundo andou
   * pulso   - 0..1 vindo do beat da musica (o neon respira junto)
   */
  atualizar(dt, avancoZ, pulso) {
    this.tempo += dt;
    this.pulso = pulso;

    this.offsetTravessa = (this.offsetTravessa + avancoZ) % ESPACO_TRAVESSA;
    this.offsetPoste = (this.offsetPoste + avancoZ) % ESPACO_POSTE;
    this.escreverInstancias();

    // Respiro do neon: sutil, nunca pisca-pisca.
    const brilho = 0.82 + pulso * 0.3 + Math.sin(this.tempo * 2.1) * 0.06;
    for (const t of this.trilhos) {
      const base = t.externo ? this.corTrilhoBase : this.corTrilhoInterno;
      t.malha.material.color.copy(base).multiplyScalar(brilho);
    }
    this.matTravessa.color.copy(this.corTravessaBase).multiplyScalar(0.7 + pulso * 0.55);
    this.matPoste.color.copy(this.corPosteBase).multiplyScalar(0.55 + pulso * 0.5);
    this.brilhoHorizonte.material.opacity = 0.36 + pulso * 0.14
      + Math.sin(this.tempo * 0.7) * 0.04;
    this.faixaHorizonte.material.opacity = 0.34 + pulso * 0.22;
  }
}
