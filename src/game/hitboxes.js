/* ==========================================================================
   TIPOS E CAIXAS DE COLISAO

   Modulo deliberadamente puro (nao importa Three.js): assim o validador de
   padroes e os testes rodam em Node, sem navegador. Quem desenha o obstaculo
   e o obstacles.js; quem diz "que espaco ele ocupa" e este arquivo.

   Cada familia tem uma saida obrigatoria, e a caixa e que garante isso:
     BAIXO  vai de 0 a 0.85   -> passa por CIMA (pular)
     PORTAO vai de 1.02 a 2.6 -> passa por BAIXO (deslizar)
     PAREDE vai de 0 a 2.8    -> nao passa (trocar de pista)
   ========================================================================== */

export const TIPO = {
  BAIXO: 'baixo',
  PORTAO: 'portao',
  PAREDE: 'parede'
};

/** Meias-dimensoes (e alturas absolutas) da caixa de cada tipo. */
export const CAIXAS = {
  [TIPO.BAIXO]:  { meiaX: 0.80, minY: 0.00, maxY: 0.85, meiaZ: 0.62 },
  [TIPO.PORTAO]: { meiaX: 1.00, minY: 1.02, maxY: 2.60, meiaZ: 0.32 },
  [TIPO.PAREDE]: { meiaX: 0.88, minY: 0.00, maxY: 2.80, meiaZ: 0.48 }
};
