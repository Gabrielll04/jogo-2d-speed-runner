/* ==========================================================================
   BOT DO ATTRACT MODE
   Joga sozinho nos PCs do evento. Nao e perfeito de proposito: erra de vez
   em quando, raspa nos obstaculos e morre - o que faz a demo parecer uma
   partida de verdade, nao um replay.
   ========================================================================== */

import { PISTAS, JOGADOR } from '../config.js';
import { TIPO } from './obstacles.js';

/** Instante ideal (em segundos antes do impacto) para cada acao. */
const ANTECIPACAO_PULO = 0.22;
const ANTECIPACAO_DESLIZE = 0.26;
/** Janela em que uma parede a frente vira emergencia. */
const JANELA_EMERGENCIA = 2.0;
/** Folga minima (em unidades) que a pista de destino precisa ter para o bot
    trocar so por causa de poeira. Sem isso ele entra em beco sem saida. */
const FOLGA_PARA_POEIRA = 52;

export class Bot {
  constructor(rng) {
    this.rng = rng;
    this.reiniciar();
  }

  reiniciar() {
    this.cooldownTroca = 0;
    this.pistaDesejada = 1;
    this.erroPendente = 0;
    this.tempoAteErrar = 14 + this.rng() * 22;
  }

  /**
   * Decide as acoes do quadro. Devolve { trocar: -1|0|1, pular, deslizar }.
   */
  decidir(dt, jogador, obstaculos, poeiras, velocidade) {
    this.cooldownTroca = Math.max(0, this.cooldownTroca - dt);
    this.tempoAteErrar -= dt;

    const decisao = { trocar: 0, pular: false, deslizar: false };
    const pistaAtual = jogador.pistaDestino;

    // Mapa de ameacas por pista: distancia do obstaculo mais proximo a frente.
    const ameaca = [Infinity, Infinity, Infinity];
    const tipoAmeaca = [null, null, null];
    for (const o of obstaculos) {
      const z = o.grupo.position.z;
      if (z > 1 || z < -80) continue;
      const d = -z;
      if (d < ameaca[o.pista]) {
        ameaca[o.pista] = d;
        tipoAmeaca[o.pista] = o.tipo;
      }
    }

    const dAtual = ameaca[pistaAtual];
    const tAtual = tipoAmeaca[pistaAtual];
    const tempoAtual = dAtual / velocidade;

    if (tAtual === TIPO.PAREDE && tempoAtual < JANELA_EMERGENCIA) {
      // Emergencia: parede na cara. Nenhum cooldown segura essa troca.
      const destino = this.melhorPista(pistaAtual, ameaca, tipoAmeaca, velocidade);
      if (destino !== pistaAtual) {
        decisao.trocar = Math.sign(destino - pistaAtual);
        this.cooldownTroca = 0.14;
      }
    } else if (tAtual === TIPO.BAIXO && tempoAtual < ANTECIPACAO_PULO) {
      decisao.pular = true;
    } else if (tAtual === TIPO.PORTAO && tempoAtual < ANTECIPACAO_DESLIZE) {
      decisao.deslizar = true;
    } else if (dAtual > 30 && this.cooldownTroca <= 0) {
      // Caminho livre: vai atras da poeira, mas so para pista bem folgada.
      const destino = this.pistaComMaisPoeira(pistaAtual, poeiras, ameaca, tipoAmeaca);
      if (destino !== pistaAtual) {
        decisao.trocar = Math.sign(destino - pistaAtual);
        this.cooldownTroca = 0.55 + this.rng() * 0.5;
      }
    }

    /* ---------- erro proposital: o bot e humano ---------- */
    if (this.tempoAteErrar <= 0) {
      this.tempoAteErrar = 16 + this.rng() * 26;
      if (this.rng() < 0.55) {
        decisao.pular = false;
        decisao.deslizar = false;
        decisao.trocar = 0;
      }
    }

    return decisao;
  }

  /**
   * Escolhe a pista de destino FINAL (nao so a vizinha) e devolve o primeiro
   * passo nessa direcao. E o que permite ao bot resolver padroes que exigem
   * duas trocas seguidas, tipo o "desvio-duplo".
   */
  melhorPista(atual, ameaca, tipos, velocidade) {
    // Espaco que o mundo anda enquanto ele atravessa uma pista, com folga.
    const custoPorPista = velocidade * 0.3;
    let melhor = atual;
    let melhorNota = -Infinity;

    for (let p = 0; p < PISTAS.length; p++) {
      const passos = Math.abs(p - atual);
      let nota = Math.min(ameaca[p], 90) - passos * 6;
      if (tipos[p] === TIPO.PAREDE) nota -= 200;

      // Pistas no meio do caminho: so atrapalham se a parede delas estiver
      // perto demais para ele passar por cima do caminho a tempo.
      const direcao = Math.sign(p - atual);
      for (let i = atual + direcao; direcao !== 0 && i !== p; i += direcao) {
        if (tipos[i] === TIPO.PAREDE && ameaca[i] < custoPorPista * (passos + 1)) {
          nota -= 200;
        }
      }

      if (nota > melhorNota) {
        melhorNota = nota;
        melhor = p;
      }
    }

    if (melhor === atual) return atual;
    return atual + Math.sign(melhor - atual);
  }

  pistaComMaisPoeira(atual, poeiras, ameaca, tipos) {
    const contagem = [0, 0, 0];
    for (const p of poeiras) {
      const z = p.posicao.z;
      if (z > 0 || z < -46) continue;
      let indice = 0;
      let melhorDist = Infinity;
      for (let i = 0; i < PISTAS.length; i++) {
        const d = Math.abs(p.posicao.x - PISTAS[i]);
        if (d < melhorDist) { melhorDist = d; indice = i; }
      }
      if (melhorDist < JOGADOR.meiaLargura * 2) contagem[indice]++;
    }

    let melhor = atual;
    let melhorNota = contagem[atual] + 0.5;   // inercia: so troca se valer
    for (let p = 0; p < PISTAS.length; p++) {
      if (Math.abs(p - atual) !== 1) continue;
      if (tipos[p] === TIPO.PAREDE && ameaca[p] < FOLGA_PARA_POEIRA) continue;
      if (contagem[p] > melhorNota) {
        melhorNota = contagem[p];
        melhor = p;
      }
    }
    return melhor;
  }
}
