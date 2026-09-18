/* ==========================================================================
   COLETAVEIS - poeira estelar e power-ups.
   Poeira: octaedro dourado girando com halo pulsante. Power-up: cristal
   maior com anel orbital na cor do efeito.
   ========================================================================== */

import * as THREE from 'three';
import { CORES, POWERUPS, RAIO_IMA } from '../config.js';
import { texturaHalo } from './../gfx/textures.js';

const MEIA_COLETA = 0.62;   // raio de coleta (AABB simplificado)

/* -------------------------------------------------------------------------
   POEIRA ESTELAR

   Sao dezenas de itens na tela ao mesmo tempo, entao NAO vira um Object3D
   por estrela: o pool inteiro custa exatamente 2 chamadas de desenho -
   um InstancedMesh com os octaedros e um THREE.Points com os halos.
   ------------------------------------------------------------------------- */
class Poeira {
  constructor(indice) {
    this.indice = indice;
    this.ativo = false;
    this.posicao = new THREE.Vector3(0, 0, 999);
    this.alturaBase = 0.9;
    this.fase = 0;
    this.giroX = 0;
    this.giroY = 0;
  }

  ativar(x, y, z) {
    this.ativo = true;
    this.posicao.set(x, y, z);
    this.alturaBase = y;
    this.fase = Math.random() * Math.PI * 2;
    this.giroX = Math.random() * Math.PI;
    this.giroY = Math.random() * Math.PI;
  }

  desativar() {
    this.ativo = false;
    this.posicao.set(0, -50, 999);
  }
}

export class PoolPoeira {
  constructor(cena, tamanho = 48) {
    this.grupo = new THREE.Group();
    cena.add(this.grupo);
    this.tamanho = tamanho;

    const geo = new THREE.OctahedronGeometry(0.3, 0);
    const mat = new THREE.MeshLambertMaterial({
      color: 0x8a6a14,
      emissive: CORES.dourado,
      emissiveIntensity: 1.15,
      flatShading: true
    });
    this.cristais = new THREE.InstancedMesh(geo, mat, tamanho);
    this.cristais.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.cristais.frustumCulled = false;
    this.grupo.add(this.cristais);

    // Halos: um unico Points aditivo com a textura de brilho.
    this.posHalo = new Float32Array(tamanho * 3);
    const geoHalo = new THREE.BufferGeometry();
    geoHalo.setAttribute('position', new THREE.BufferAttribute(this.posHalo, 3));
    geoHalo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 500);
    this.halos = new THREE.Points(geoHalo, new THREE.PointsMaterial({
      color: CORES.dourado,
      // Com atenuacao: o halo encolhe com a distancia igual ao cristal.
      size: 1.0,
      sizeAttenuation: true,
      map: texturaHalo(CORES.dourado, 0.18),
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    }));
    this.halos.frustumCulled = false;
    this.halos.renderOrder = 5;
    this.geoHalo = geoHalo;
    this.grupo.add(this.halos);

    this.itens = [];
    for (let i = 0; i < tamanho; i++) this.itens.push(new Poeira(i));
    this.ativos = [];
    this.dummy = new THREE.Object3D();
    this.escreverInstancias();
  }

  criar(x, y, z) {
    for (const p of this.itens) {
      if (!p.ativo) {
        p.ativar(x, y, z);
        this.ativos.push(p);
        return p;
      }
    }
    return null;
  }

  atualizar(dt, avancoZ, tempo, alvo, imaAtivo, zLimite) {
    for (let i = this.ativos.length - 1; i >= 0; i--) {
      const p = this.ativos[i];
      p.posicao.z += avancoZ;
      p.giroY += dt * 2.6;
      p.giroX += dt * 1.1;

      if (imaAtivo && alvo) {
        const dx = alvo.x - p.posicao.x;
        const dy = (alvo.y + 0.8) - p.posicao.y;
        const dz = alvo.z - p.posicao.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < RAIO_IMA && dist > 0.001) {
          const forca = Math.min(1, dt * 9 * (1 - dist / RAIO_IMA) * 2.2);
          p.posicao.x += dx * forca;
          p.posicao.y += dy * forca;
          p.posicao.z += dz * forca;
        }
      } else {
        p.posicao.y = p.alturaBase + Math.sin(tempo * 2.4 + p.fase) * 0.12;
      }

      if (p.posicao.z > zLimite) {
        p.desativar();
        this.ativos.splice(i, 1);
      }
    }
    this.escreverInstancias(tempo);
  }

  escreverInstancias(tempo = 0) {
    const d = this.dummy;
    for (let i = 0; i < this.tamanho; i++) {
      const p = this.itens[i];
      if (p.ativo) {
        d.position.copy(p.posicao);
        d.rotation.set(p.giroX, p.giroY, 0);
        const pulso = 0.9 + Math.sin(tempo * 4 + p.fase) * 0.15;
        d.scale.setScalar(pulso);
        this.posHalo[i * 3] = p.posicao.x;
        this.posHalo[i * 3 + 1] = p.posicao.y;
        this.posHalo[i * 3 + 2] = p.posicao.z;
      } else {
        // Instancia parada bem longe da camera: some sem custar teste extra.
        d.position.set(0, -500, 900);
        d.rotation.set(0, 0, 0);
        d.scale.setScalar(0.0001);
        this.posHalo[i * 3] = 0;
        this.posHalo[i * 3 + 1] = -500;
        this.posHalo[i * 3 + 2] = 900;
      }
      d.updateMatrix();
      this.cristais.setMatrixAt(i, d.matrix);
    }
    this.cristais.instanceMatrix.needsUpdate = true;
    this.geoHalo.attributes.position.needsUpdate = true;
  }

  remover(item) {
    const i = this.ativos.indexOf(item);
    if (i >= 0) this.ativos.splice(i, 1);
    item.desativar();
  }

  limpar() {
    for (const p of this.ativos) p.desativar();
    this.ativos.length = 0;
    this.escreverInstancias();
  }

  static get meiaCaixa() {
    return MEIA_COLETA;
  }
}

/* -------------------------------------------------------------------------
   POWER-UPS
   ------------------------------------------------------------------------- */
class Powerup {
  constructor() {
    this.grupo = new THREE.Group();
    this.grupo.visible = false;
    this.ativo = false;
    this.chave = 'escudo';

    this.cristal = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.42, 0),
      new THREE.MeshLambertMaterial({
        color: 0x101a30, emissive: CORES.ciano, emissiveIntensity: 1, flatShading: true
      })
    );
    this.grupo.add(this.cristal);

    this.anel = new THREE.Mesh(
      new THREE.TorusGeometry(0.72, 0.06, 4, 18),
      new THREE.MeshBasicMaterial({
        color: CORES.ciano, transparent: true, opacity: 0.9,
        blending: THREE.AdditiveBlending, depthWrite: false
      })
    );
    this.anel.rotation.x = Math.PI / 2.4;
    this.grupo.add(this.anel);

    this.halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: texturaHalo(0xffffff, 0.2),
      transparent: true, opacity: 0.6,
      depthWrite: false, blending: THREE.AdditiveBlending
    }));
    this.halo.scale.setScalar(3);
    this.grupo.add(this.halo);
  }

  ativar(chave, x, z) {
    this.chave = chave;
    this.ativo = true;
    this.grupo.visible = true;
    this.grupo.position.set(x, 1.15, z);
    const cor = new THREE.Color(POWERUPS[chave].cor);
    this.cristal.material = this.cristal.material.clone();
    this.cristal.material.emissive = cor;
    this.anel.material = this.anel.material.clone();
    this.anel.material.color = cor;
    this.halo.material = this.halo.material.clone();
    this.halo.material.map = texturaHalo(POWERUPS[chave].cor, 0.2);
  }

  desativar() {
    this.ativo = false;
    this.grupo.visible = false;
    this.grupo.position.z = 999;
  }

  atualizar(dt, avancoZ, tempo) {
    this.grupo.position.z += avancoZ;
    this.cristal.rotation.y += dt * 1.8;
    this.cristal.rotation.z += dt * 0.7;
    this.anel.rotation.z += dt * 2.4;
    this.anel.rotation.y += dt * 1.2;
    const pulso = 0.9 + Math.sin(tempo * 5) * 0.16;
    this.halo.scale.setScalar(3 * pulso);
    this.grupo.position.y = 1.15 + Math.sin(tempo * 2.2) * 0.14;
  }
}

export class PoolPowerups {
  constructor(cena, tamanho = 3) {
    this.grupo = new THREE.Group();
    cena.add(this.grupo);
    this.itens = [];
    for (let i = 0; i < tamanho; i++) {
      const p = new Powerup();
      this.grupo.add(p.grupo);
      this.itens.push(p);
    }
    this.ativos = [];
  }

  criar(chave, x, z) {
    for (const p of this.itens) {
      if (!p.ativo) {
        p.ativar(chave, x, z);
        this.ativos.push(p);
        return p;
      }
    }
    return null;
  }

  atualizar(dt, avancoZ, tempo, zLimite) {
    for (let i = this.ativos.length - 1; i >= 0; i--) {
      const p = this.ativos[i];
      p.atualizar(dt, avancoZ, tempo);
      if (p.grupo.position.z > zLimite) {
        p.desativar();
        this.ativos.splice(i, 1);
      }
    }
  }

  remover(item) {
    const i = this.ativos.indexOf(item);
    if (i >= 0) this.ativos.splice(i, 1);
    item.desativar();
  }

  limpar() {
    for (const p of this.ativos) p.desativar();
    this.ativos.length = 0;
  }

  static get meiaCaixa() {
    return 0.8;
  }
}
