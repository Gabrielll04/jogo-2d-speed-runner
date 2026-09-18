/* ==========================================================================
   OBSTACULOS - tres familias, cada uma com uma saida obrigatoria:

     BAIXO  (asteroide)        -> PULAR
     PORTAO (feixe de laser)   -> DESLIZAR
     PAREDE (satelite/detrito) -> TROCAR DE PISTA

   A forma E a cor dizem a acao, mesmo com 180 linhas de resolucao:

     ambar/laranja + pedra baixa e larga   -> PULE
     magenta + feixes altos e finos        -> DESLIZE
     metal claro com listras vermelhas,
     alto e fechando a pista inteira       -> DESVIE

   A barreira nasceu de um playtest: como satelite flutuante ela parecia
   transponivel e o pessoal tentava pular. Agora ela vai do chao ate acima
   da linha dos olhos, tem listras de perigo e nao balanca - objeto fixo,
   nao destroco a deriva.
   ========================================================================== */

import * as THREE from 'three';
import { CORES } from '../config.js';
import {
  texturaLaser, texturaHalo, texturaPerigo, texturaRocha
} from './../gfx/textures.js';
import { TIPO, CAIXAS } from './hitboxes.js';

// Reexportados para quem so quer desenhar/colidir sem saber de onde vem.
export { TIPO, CAIXAS };

/* -------------------------------------------------------------------------
   Geometrias e materiais compartilhados (criados uma unica vez).
   ------------------------------------------------------------------------- */
let recursos = null;

function garantirRecursos() {
  if (recursos) return recursos;

  const rochaGeo = new THREE.IcosahedronGeometry(0.82, 0);
  // Deforma os vertices: asteroide nao pode parecer bola de boliche.
  const pos = rochaGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const f = 0.78 + ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1 * 0.42;
    pos.setXYZ(i, pos.getX(i) * f, pos.getY(i) * f * 0.85, pos.getZ(i) * f);
  }
  rochaGeo.computeVertexNormals();

  // A textura de perigo cobre a barreira inteira: repete para as listras
  // sairem do tamanho certo em vez de esticadas.
  const perigo = texturaPerigo();
  perigo.repeat.set(1, 1);

  recursos = {
    /* ---------- PULE: rocha quente ---------- */
    rochaGeo,
    // Clara e quente: a versao anterior era cinza-arroxeada e sumia no
    // espaco preto - o pessoal batia sem ter visto a pedra. O emissive fica
    // baixo para as manchas e os veios da textura continuarem visiveis.
    rochaMat: new THREE.MeshLambertMaterial({
      map: texturaRocha(),
      color: 0xffc9a0,
      emissive: 0xff7a2a,
      emissiveIntensity: 0.22,
      flatShading: true
    }),
    veioMat: new THREE.MeshBasicMaterial({ color: 0xffa63d }),
    veioGeo: new THREE.BoxGeometry(0.2, 0.12, 1.0),
    brasaMat: new THREE.SpriteMaterial({
      map: texturaHalo(0xff8a3d, 0.22), transparent: true, opacity: 0.55,
      depthWrite: false, blending: THREE.AdditiveBlending
    }),

    /* ---------- DESLIZE: portao de laser ---------- */
    posteGeo: new THREE.BoxGeometry(0.16, 2.7, 0.16),
    posteMat: new THREE.MeshLambertMaterial({
      color: 0x2a1240, emissive: CORES.magenta, emissiveIntensity: 0.55, flatShading: true
    }),
    feixeGeo: new THREE.BoxGeometry(2.0, 0.34, 0.1),
    feixeMat: new THREE.MeshBasicMaterial({
      map: texturaLaser(), transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false
    }),

    /* ---------- DESVIE: barreira ---------- */
    barreiraGeo: new THREE.BoxGeometry(1.94, 2.55, 0.5),
    // Basic, nao Lambert: o emissive azulado da cena lavava o vermelho das
    // listras justamente na hora de gritar "bloqueado". O volume ja vem
    // pintado no gradiente da propria textura.
    barreiraMat: new THREE.MeshBasicMaterial({ map: perigo }),
    pilarGeo: new THREE.BoxGeometry(0.2, 2.95, 0.6),
    pilarMat: new THREE.MeshLambertMaterial({
      color: 0xd2ddf0, emissive: 0x39496b, emissiveIntensity: 1.0, flatShading: true
    }),
    luzGeo: new THREE.BoxGeometry(2.14, 0.16, 0.66),
    // Compartilhado por todas as barreiras: a piscada e atualizada uma unica
    // vez por quadro, no pool, em vez de uma vez por obstaculo.
    luzMat: new THREE.MeshBasicMaterial({ color: 0xff4d3d }),
    corLuz: new THREE.Color(0xff4d3d),
    haloBarreiraMat: new THREE.SpriteMaterial({
      map: texturaHalo(0xff3b30, 0.3), transparent: true, opacity: 0.38,
      depthWrite: false, blending: THREE.AdditiveBlending
    }),

    haloMat: new THREE.SpriteMaterial({
      map: texturaHalo(CORES.magenta, 0.25), transparent: true, opacity: 0.35,
      depthWrite: false, blending: THREE.AdditiveBlending
    })
  };
  return recursos;
}

/* -------------------------------------------------------------------------
   Um obstaculo do pool.
   ------------------------------------------------------------------------- */
class Obstaculo {
  constructor(tipo) {
    const r = garantirRecursos();
    this.tipo = tipo;
    this.grupo = new THREE.Group();
    this.grupo.visible = false;
    this.ativo = false;
    this.pista = 1;
    this.jaAvaliado = false;
    this.giro = 0;

    if (tipo === TIPO.BAIXO) {
      // Achatado de proposito: a silhueta baixa e larga ja diz "pule por
      // cima", e o topo do desenho bate com o topo da caixa de colisao.
      const rocha = new THREE.Mesh(r.rochaGeo, r.rochaMat);
      rocha.scale.set(1.08, 0.62, 1.08);
      rocha.position.y = 0.42;
      this.rocha = rocha;
      this.grupo.add(rocha);
      const veio = new THREE.Mesh(r.veioGeo, r.veioMat);
      veio.position.y = 0.42;
      this.grupo.add(veio);
      this.veio = veio;
      // Brasa: garante que a pedra se destaque do espaco preto mesmo longe.
      const brasa = new THREE.Sprite(r.brasaMat.clone());
      brasa.scale.setScalar(2.5);
      brasa.position.y = 0.38;
      this.brasa = brasa;
      this.grupo.add(brasa);
    } else if (tipo === TIPO.PORTAO) {
      for (const lado of [-1, 1]) {
        const poste = new THREE.Mesh(r.posteGeo, r.posteMat);
        poste.position.set(lado * 1.02, 1.35, 0);
        this.grupo.add(poste);
      }
      this.feixes = [];
      for (const altura of [1.22, 1.9, 2.42]) {
        const feixe = new THREE.Mesh(r.feixeGeo, r.feixeMat.clone());
        feixe.position.y = altura;
        this.feixes.push(feixe);
        this.grupo.add(feixe);
      }
      const halo = new THREE.Sprite(r.haloMat.clone());
      halo.scale.setScalar(3.4);
      halo.position.y = 1.8;
      this.grupo.add(halo);
      this.halo = halo;
    } else {
      // Placa macica do chao ate acima da linha dos olhos do jogador.
      const placa = new THREE.Mesh(r.barreiraGeo, r.barreiraMat);
      placa.position.y = 1.28;
      this.grupo.add(placa);

      // Pilares claros que passam do topo: reforcam a altura na silhueta.
      for (const lado of [-1, 1]) {
        const pilar = new THREE.Mesh(r.pilarGeo, r.pilarMat);
        pilar.position.set(lado * 1.02, 1.48, 0);
        this.grupo.add(pilar);
      }

      // Barra de alerta piscando no topo.
      const luz = new THREE.Mesh(r.luzGeo, r.luzMat);
      luz.position.y = 2.72;
      this.luz = luz;
      this.grupo.add(luz);

      const halo = new THREE.Sprite(r.haloBarreiraMat.clone());
      halo.scale.setScalar(4.2);
      halo.position.y = 1.6;
      this.haloBarreira = halo;
      this.grupo.add(halo);
    }
  }

  ativar(pista, x, z) {
    this.ativo = true;
    this.pista = pista;
    this.jaAvaliado = false;
    this.grupo.visible = true;
    this.grupo.position.set(x, 0, z);
    this.giro = (Math.random() - 0.5) * 1.6;
    this.grupo.rotation.set(0, 0, 0);
    if (this.tipo === TIPO.BAIXO) {
      this.rocha.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    }
  }

  desativar() {
    this.ativo = false;
    this.grupo.visible = false;
    this.grupo.position.z = 999;
  }

  atualizar(dt, avancoZ, tempo) {
    this.grupo.position.z += avancoZ;
    if (this.tipo === TIPO.BAIXO) {
      this.rocha.rotation.x += dt * this.giro * 0.6;
      this.rocha.rotation.y += dt * this.giro;
      this.veio.rotation.copy(this.rocha.rotation);
      this.brasa.material.opacity = 0.42 + Math.abs(Math.sin(tempo * 3.1 + this.giro)) * 0.3;
    } else if (this.tipo === TIPO.PORTAO) {
      // Feixes correm e piscam fora de fase: parece energia de verdade.
      for (let i = 0; i < this.feixes.length; i++) {
        const f = this.feixes[i];
        f.material.opacity = 0.6 + Math.abs(Math.sin(tempo * 7 + i * 1.3)) * 0.4;
        if (f.material.map) f.material.map.offset.x = (tempo * 1.6 + i * 0.3) % 1;
        f.scale.x = 1 + Math.sin(tempo * 9 + i) * 0.03;
      }
      this.halo.material.opacity = 0.22 + Math.abs(Math.sin(tempo * 4)) * 0.2;
    } else {
      // Barreira NAO balanca: coisa fixa e intransponivel nao fica a deriva.
      this.haloBarreira.material.opacity = 0.2 + Math.abs(Math.sin(tempo * 3.6)) * 0.22;
    }
  }

  get caixa() {
    return CAIXAS[this.tipo];
  }
}

/* -------------------------------------------------------------------------
   Pool. Nunca aloca durante a partida.
   ------------------------------------------------------------------------- */
export class PoolObstaculos {
  constructor(cena, porTipo = 9) {
    this.grupo = new THREE.Group();
    cena.add(this.grupo);
    this.pools = {};
    this.ativos = [];

    for (const tipo of Object.values(TIPO)) {
      const lista = [];
      for (let i = 0; i < porTipo; i++) {
        const o = new Obstaculo(tipo);
        this.grupo.add(o.grupo);
        lista.push(o);
      }
      this.pools[tipo] = lista;
    }
  }

  /** Pega um obstaculo livre do tipo pedido (ou null se o pool estourou). */
  criar(tipo, pista, x, z) {
    const lista = this.pools[tipo];
    for (const o of lista) {
      if (!o.ativo) {
        o.ativar(pista, x, z);
        this.ativos.push(o);
        return o;
      }
    }
    return null;
  }

  atualizar(dt, avancoZ, tempo, zLimite) {
    // Piscada dos satelites: um material, uma escrita por quadro.
    const r = garantirRecursos();
    r.luzMat.color.copy(r.corLuz).multiplyScalar(0.45 + Math.abs(Math.sin(tempo * 3.4)) * 0.55);

    for (let i = this.ativos.length - 1; i >= 0; i--) {
      const o = this.ativos[i];
      o.atualizar(dt, avancoZ, tempo);
      if (o.grupo.position.z > zLimite) {
        o.desativar();
        this.ativos.splice(i, 1);
      }
    }
  }

  limpar() {
    for (const o of this.ativos) o.desativar();
    this.ativos.length = 0;
  }
}
