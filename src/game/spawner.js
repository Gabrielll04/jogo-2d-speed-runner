/* ==========================================================================
   SPAWNER - decide o que nasce la na frente.

   Trabalha em "distancia ate o proximo padrao": a cada quadro desconta o
   avanco do mundo e, quando zera, instancia um padrao inteiro de uma vez
   (obstaculos + trilha de poeira + power-up eventual).

   A poeira estelar e colocada SOBRE a rota viavel devolvida pelo validador.
   Ou seja: seguir o brilho e, por construcao, o caminho que da pra passar.
   ========================================================================== */

import {
  PISTAS, DIST_SPAWN, GAP_PADRAO_INICIAL, GAP_PADRAO_FINAL,
  COOLDOWN_POWERUP, DIST_PRIMEIRO_POWERUP, POWERUPS
} from '../config.js';
import { sortearPadrao, rotaViavel, montarCamadas, PORTAO } from './patterns.js';
import { entre, inteiro, escolher } from '../core/rng.js';

const CHAVES_POWERUP = Object.keys(POWERUPS);
const ESPACO_POEIRA = 2.4;

export class Spawner {
  constructor(rng, pools) {
    this.rng = rng;
    this.obstaculos = pools.obstaculos;
    this.poeira = pools.poeira;
    this.powerups = pools.powerups;
    this.reiniciar();
  }

  reiniciar() {
    this.distanciaAteProximo = 46;     // folga inicial: da tempo de se situar
    this.tempoSemPowerup = 0;
    this.ultimaPistaSegura = 1;
    this.padroesGerados = 0;
  }

  /**
   * dt          - delta em segundos
   * avancoZ     - unidades que o mundo andou neste quadro
   * dificuldade - 0..1
   * distancia   - metros percorridos (libera o primeiro power-up)
   */
  atualizar(dt, avancoZ, dificuldade, distancia) {
    this.tempoSemPowerup += dt;
    this.distanciaAteProximo -= avancoZ;
    if (this.distanciaAteProximo > 0) return;

    const padrao = sortearPadrao(this.rng, dificuldade);
    const gap = GAP_PADRAO_INICIAL + (GAP_PADRAO_FINAL - GAP_PADRAO_INICIAL) * dificuldade;

    this.instanciar(padrao, dificuldade, distancia, gap);

    this.distanciaAteProximo = padrao.comprimento + gap * entre(this.rng, 0.85, 1.2);
    this.padroesGerados++;
  }

  instanciar(padrao, dificuldade, distancia, gap) {
    const base = -DIST_SPAWN;

    // Rota garantida, partindo da ultima pista onde o jogador ficou seguro.
    let rota = rotaViavel(padrao, undefined, this.ultimaPistaSegura);
    if (!rota.viavel) rota = rotaViavel(padrao);
    const camadas = rota.camadas && rota.camadas.length ? rota.camadas : montarCamadas(padrao.itens);
    const caminho = rota.rota || camadas.map(() => 1);

    /* ---------- obstaculos ---------- */
    for (const item of padrao.itens) {
      this.obstaculos.criar(item.tipo, item.pista, PISTAS[item.pista], base - item.z);
    }

    /* ---------- poeira sobre a rota ---------- */
    for (let c = 0; c < camadas.length; c++) {
      const pista = caminho[c];
      const zCamada = camadas[c].z;
      const zAnterior = c === 0 ? zCamada - 9 : camadas[c - 1].z;
      const vao = zCamada - zAnterior;
      const quantos = Math.max(1, Math.floor(vao / ESPACO_POEIRA) - 1);
      const tipoCamada = camadas[c].pistas[pista];
      for (let i = 1; i <= quantos; i++) {
        const z = zAnterior + (vao * i) / (quantos + 1);
        // Em frente a um portao a poeira desce: convida a deslizar.
        const altura = tipoCamada === PORTAO && z > zCamada - 5 ? 0.42 : 0.9;
        this.poeira.criar(PISTAS[pista], altura, base - z);
      }
    }

    /* ---------- poeira no vao depois do padrao ---------- */
    const pistaFinal = caminho[caminho.length - 1] !== undefined
      ? caminho[caminho.length - 1]
      : 1;
    this.ultimaPistaSegura = pistaFinal;

    const zFim = padrao.comprimento;
    const quantosVao = Math.max(3, Math.floor((gap * 0.62) / ESPACO_POEIRA));
    const fazArco = this.rng() < 0.32;
    const pistaVao = this.rng() < 0.7
      ? pistaFinal
      : inteiro(this.rng, 0, PISTAS.length - 1);

    for (let i = 0; i < quantosVao; i++) {
      const z = zFim + 3 + i * ESPACO_POEIRA;
      const t = i / Math.max(1, quantosVao - 1);
      const altura = fazArco ? 0.9 + Math.sin(t * Math.PI) * 1.15 : 0.9;
      this.poeira.criar(PISTAS[pistaVao], altura, base - z);
    }

    /* ---------- power-up raro ---------- */
    if (distancia > DIST_PRIMEIRO_POWERUP
        && this.tempoSemPowerup > COOLDOWN_POWERUP
        && this.rng() < 0.55) {
      const chave = escolher(this.rng, CHAVES_POWERUP);
      const z = zFim + 3 + (quantosVao / 2) * ESPACO_POEIRA;
      this.powerups.criar(chave, PISTAS[pistaVao], base - z);
      this.tempoSemPowerup = 0;
    }
  }
}
