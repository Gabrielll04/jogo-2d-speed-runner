/* ==========================================================================
   COLISAO - AABB manual em 3 eixos. Sem engine de fisica: o jogo inteiro
   e uma sobreposicao de caixas, e isso e suficiente (e rapido).
   ========================================================================== */

import { JOGADOR, PONTOS } from '../config.js';

export function novaCaixa() {
  return { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 };
}

/** Preenche uma caixa a partir do centro do obstaculo e suas meias-medidas. */
export function caixaDoObstaculo(obstaculo, saida) {
  const c = obstaculo.caixa;
  const x = obstaculo.grupo.position.x;
  const z = obstaculo.grupo.position.z;
  saida.minX = x - c.meiaX;
  saida.maxX = x + c.meiaX;
  saida.minY = c.minY;
  saida.maxY = c.maxY;
  saida.minZ = z - c.meiaZ;
  saida.maxZ = z + c.meiaZ;
  return saida;
}

export function sobrepoe(a, b) {
  return a.minX < b.maxX && a.maxX > b.minX
      && a.minY < b.maxY && a.maxY > b.minY
      && a.minZ < b.maxZ && a.maxZ > b.minZ;
}

/** Sobreposicao simples entre o jogador e um coletavel esferico. */
export function pegouColetavel(caixaJogador, posicao, meiaCaixa) {
  return caixaJogador.minX < posicao.x + meiaCaixa
      && caixaJogador.maxX > posicao.x - meiaCaixa
      && caixaJogador.minY < posicao.y + meiaCaixa
      && caixaJogador.maxY > posicao.y - meiaCaixa
      && caixaJogador.minZ < posicao.z + meiaCaixa
      && caixaJogador.maxZ > posicao.z - meiaCaixa;
}

/**
 * Passou raspando? Chamado no quadro em que o obstaculo cruza o jogador.
 * Vale tanto de lado (pista vizinha) quanto por cima (pulo curto) ou por
 * baixo (deslize no limite).
 */
export function raspou(caixaJogador, caixaObstaculo) {
  const folgaX = Math.max(
    caixaObstaculo.minX - caixaJogador.maxX,
    caixaJogador.minX - caixaObstaculo.maxX
  );
  if (folgaX >= 0 && folgaX < PONTOS.margemQuaseAcidente) return true;

  const folgaY = Math.max(
    caixaObstaculo.minY - caixaJogador.maxY,
    caixaJogador.minY - caixaObstaculo.maxY
  );
  // So conta na vertical se estiver alinhado lateralmente (mesma pista).
  const alinhado = caixaJogador.maxX > caixaObstaculo.minX
                && caixaJogador.minX < caixaObstaculo.maxX;
  if (alinhado && folgaY >= 0 && folgaY < JOGADOR.meiaLargura) return true;

  return false;
}
