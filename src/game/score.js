/* ==========================================================================
   PONTUACAO E COMBO
     - distancia rende pontos continuamente
     - poeira estelar rende 50 x multiplicador
     - raspada rende 25 x multiplicador
   O combo sobe a cada 5 coletas e cai se o jogador passar 3 s sem coletar.
   ========================================================================== */

import { PONTOS } from '../config.js';

const COLETAS_POR_DEGRAU = 5;

export class Pontuacao {
  constructor() {
    this.reiniciar();
  }

  reiniciar() {
    this.pontos = 0;
    this.distancia = 0;
    this.poeiraColetada = 0;
    this.raspadas = 0;
    this.nivelCombo = 0;
    this.coletasNoNivel = 0;
    this.tempoCombo = 0;
    this.maiorMultiplicador = 1;
    this.dobrado = false;
    this.restoDistancia = 0;
  }

  get multiplicador() {
    const base = PONTOS.degrausCombo[this.nivelCombo];
    return this.dobrado ? base * 2 : base;
  }

  get comboRestante() {
    return Math.max(0, this.tempoCombo / PONTOS.janelaCombo);
  }

  /** Avanco em metros neste quadro. */
  atualizar(dt, metros) {
    this.distancia += metros;
    this.restoDistancia += metros * PONTOS.porMetro;
    if (this.restoDistancia >= 1) {
      const inteiros = Math.floor(this.restoDistancia);
      this.pontos += inteiros;
      this.restoDistancia -= inteiros;
    }

    if (this.nivelCombo > 0 || this.coletasNoNivel > 0) {
      this.tempoCombo -= dt;
      if (this.tempoCombo <= 0) {
        this.nivelCombo = 0;
        this.coletasNoNivel = 0;
        this.tempoCombo = 0;
        return 'quebrou';
      }
    }
    return null;
  }

  /** Devolve { ganho, subiu } - subiu indica marco de combo. */
  coletarPoeira() {
    const ganho = PONTOS.poeira * this.multiplicador;
    this.pontos += ganho;
    this.poeiraColetada++;
    this.tempoCombo = PONTOS.janelaCombo;
    this.coletasNoNivel++;

    let subiu = false;
    if (this.coletasNoNivel >= COLETAS_POR_DEGRAU
        && this.nivelCombo < PONTOS.degrausCombo.length - 1) {
      this.nivelCombo++;
      this.coletasNoNivel = 0;
      subiu = true;
    }
    if (this.multiplicador > this.maiorMultiplicador) {
      this.maiorMultiplicador = this.multiplicador;
    }
    return { ganho, subiu };
  }

  registrarRaspada() {
    const ganho = PONTOS.quaseAcidente * this.multiplicador;
    this.pontos += ganho;
    this.raspadas++;
    this.tempoCombo = Math.max(this.tempoCombo, PONTOS.janelaCombo * 0.6);
    return ganho;
  }

  setDobrado(v) {
    this.dobrado = v;
    if (this.multiplicador > this.maiorMultiplicador) {
      this.maiorMultiplicador = this.multiplicador;
    }
  }
}
