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
      new THREE.MeshBasicMaterial({ color: 0x050a1e })
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
        color: externo ? CORES.ciano : CORES.cianoEscuro
      });
      const trilho = new THREE.Mesh(geo, mat);
      trilho.position.set(x, 0.01, Z_RECICLA - COMPRIMENTO / 2);
      trilho.renderOrder = 1;
      this.grupo.add(trilho);
      this.trilhos.push({ malha: trilho, externo });
    });

    /* ---------- travessas ---------- */
    const geoTravessa = new THREE.BoxGeometry(larguraTotal + 0.3, 0.04, 0.16);
    this.matTravessa = new THREE.MeshBasicMaterial({ color: 0x137a94 });
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

    this.meiaLarguraExterna = meia + 0.55;
    this.dummy = new THREE.Object3D();
    this.offsetTravessa = 0;
    this.offsetPoste = 0;
    this.tempo = 0;
    this.pulso = 0;

    this.corTrilhoBase = new THREE.Color(CORES.ciano);
    this.corTrilhoInterno = new THREE.Color(CORES.cianoEscuro);
    this.corTravessaBase = new THREE.Color(0x137a94);
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
  }
}
