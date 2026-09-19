/* ==========================================================================
   CURVA DE DIFICULDADE

   Modulo puro (nao importa Three.js) para o jogo e os testes usarem
   exatamente a mesma conta - o teste de ritmo so vale se medir o jogo de
   verdade, nao uma copia da formula que vai divergir na primeira mexida.

   Duas coisas crescem com a distancia: a VELOCIDADE e a DENSIDADE. O erro
   facil aqui, e que deixou o jogo punitivo no playtest, e medir o respiro
   entre obstaculos em UNIDADES: a mesma folga de 15 unidades vale 0,7 s a
   21 u/s e 0,33 s a 45 u/s. O jogador sente a dificuldade em tempo de
   reacao, entao o espacamento e calculado em TEMPO e convertido para
   unidades na hora de instanciar.
   ========================================================================== */

import {
  VELOCIDADE_INICIAL, VELOCIDADE_MAXIMA, DIST_TETO,
  GAP_TEMPO_INICIAL, GAP_TEMPO_FINAL,
  ESPACAMENTO_INICIAL, ESPACAMENTO_FINAL
} from '../config.js';

/**
 * 0 no comeco, 1 no teto. O expoente acima de 1 segura a subida nos
 * primeiros metros, que e onde o jogador casual ainda esta aprendendo os
 * tres obstaculos.
 */
export function curvaDificuldade(distancia) {
  const t = Math.min(1, Math.max(0, distancia / DIST_TETO));
  return Math.pow(t, 1.25);
}

export function velocidadeDe(dificuldade) {
  return VELOCIDADE_INICIAL + (VELOCIDADE_MAXIMA - VELOCIDADE_INICIAL) * dificuldade;
}

/** Respiro entre dois padroes, em segundos. */
export function gapEmSegundos(dificuldade) {
  return GAP_TEMPO_INICIAL + (GAP_TEMPO_FINAL - GAP_TEMPO_INICIAL) * dificuldade;
}

/**
 * Quanto os z internos de um padrao sao esticados. Em 1.0 as camadas ficam
 * como foram escritas no catalogo; acima disso elas se afastam para
 * compensar a velocidade maior e manter o intervalo de decisao humano.
 */
export function fatorEspacamento(dificuldade) {
  return ESPACAMENTO_INICIAL + (ESPACAMENTO_FINAL - ESPACAMENTO_INICIAL) * dificuldade;
}
