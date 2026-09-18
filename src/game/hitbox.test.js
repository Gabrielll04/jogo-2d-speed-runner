/* ==========================================================================
   Teste das caixas de colisao e das janelas de acao.

   Simula a fisica do jogador (a mesma de gfx/player.js, que aqui nao da pra
   importar porque arrasta o Three junto) contra as caixas reais de
   game/obstacles.js. Responde as perguntas que decidem se o jogo e justo:

     - pular realmente passa por cima do asteroide?
     - deslizar realmente passa por baixo do feixe de laser?
     - a janela de acerto e humana ou exige precisao de frame?

   Roda em Node puro: `npm run test:hitbox`.
   ========================================================================== */

import { JOGADOR, PISTAS, VELOCIDADE_INICIAL, VELOCIDADE_MAXIMA } from '../config.js';
import { CAIXAS, TIPO } from './hitboxes.js';
import { novaCaixa, sobrepoe } from './collision.js';

const DT = 1 / 60;

/**
 * Simula a passagem do jogador por um obstaculo.
 *
 * opcoes:
 *   tipo            - TIPO.BAIXO | TIPO.PORTAO | TIPO.PAREDE
 *   pistaJogador    - 0..2
 *   pistaObstaculo  - 0..2
 *   velocidade      - unidades/s
 *   acao            - 'nada' | 'pular' | 'deslizar'
 *   antecipacao     - a quantos segundos do impacto a acao e disparada
 *
 * Devolve true se houve colisao.
 */
function simular(opcoes) {
  const {
    tipo, pistaJogador = 1, pistaObstaculo = 1,
    velocidade = VELOCIDADE_INICIAL, acao = 'nada', antecipacao = 0.25
  } = opcoes;

  const caixaObstaculo = CAIXAS[tipo];
  const x = PISTAS[pistaJogador];
  const xObs = PISTAS[pistaObstaculo];

  let z = -40;                 // obstaculo comeca longe e vem vindo
  let y = 0;
  let vy = 0;
  let noChao = true;
  let deslizando = false;
  let tempoDeslize = 0;
  let disparou = false;

  const cj = novaCaixa();
  const co = novaCaixa();

  while (z < 6) {
    const tempoAteImpacto = -z / velocidade;
    if (!disparou && acao !== 'nada' && tempoAteImpacto <= antecipacao) {
      disparou = true;
      if (acao === 'pular' && noChao) {
        vy = JOGADOR.impulsoPulo;
        noChao = false;
      } else if (acao === 'deslizar') {
        deslizando = true;
        tempoDeslize = JOGADOR.duracaoDeslize;
      }
    }

    // fisica do jogador
    if (!noChao) {
      vy -= JOGADOR.gravidade * DT;
      y += vy * DT;
      if (y <= 0) { y = 0; vy = 0; noChao = true; }
    }
    if (deslizando) {
      tempoDeslize -= DT;
      if (tempoDeslize <= 0) deslizando = false;
    }

    z += velocidade * DT;

    // caixas
    const altura = deslizando ? JOGADOR.alturaDeslize : JOGADOR.alturaEmPe;
    cj.minX = x - JOGADOR.meiaLargura;
    cj.maxX = x + JOGADOR.meiaLargura;
    cj.minY = y;
    cj.maxY = y + altura;
    cj.minZ = -JOGADOR.meiaProfundidade;
    cj.maxZ = JOGADOR.meiaProfundidade;

    co.minX = xObs - caixaObstaculo.meiaX;
    co.maxX = xObs + caixaObstaculo.meiaX;
    co.minY = caixaObstaculo.minY;
    co.maxY = caixaObstaculo.maxY;
    co.minZ = z - caixaObstaculo.meiaZ;
    co.maxZ = z + caixaObstaculo.meiaZ;

    if (sobrepoe(cj, co)) return true;
  }
  return false;
}

/** Mede a janela (em segundos) de antecipacoes que salvam o jogador. */
function janelaDeAcerto(tipo, acao, velocidade) {
  const passo = 0.01;
  let melhores = [];
  for (let a = 0.02; a <= 1.2; a += passo) {
    if (!simular({ tipo, acao, velocidade, antecipacao: a })) melhores.push(a);
  }
  if (!melhores.length) return { largura: 0, de: 0, ate: 0 };
  return {
    largura: Number((melhores[melhores.length - 1] - melhores[0] + passo).toFixed(3)),
    de: Number(melhores[0].toFixed(2)),
    ate: Number(melhores[melhores.length - 1].toFixed(2))
  };
}

/* ========================================================================== */
let falhas = 0;
function verificar(condicao, descricao) {
  console.log((condicao ? '  ok   ' : '  FALHA ') + descricao);
  if (!condicao) falhas++;
}

console.log('\nASTEROIDE (tem que dar pra pular)');
for (const v of [VELOCIDADE_INICIAL, 30, VELOCIDADE_MAXIMA]) {
  const j = janelaDeAcerto(TIPO.BAIXO, 'pular', v);
  verificar(
    j.largura >= 0.18,
    'a ' + v + ' u/s a janela do pulo e de ' + (j.largura * 1000).toFixed(0) +
    ' ms (de ' + j.de + ' s a ' + j.ate + ' s antes do impacto)'
  );
}
verificar(simular({ tipo: TIPO.BAIXO, acao: 'nada' }), 'parado no chao, o asteroide acerta');

console.log('\nPORTAO DE LASER (tem que dar pra deslizar)');
for (const v of [VELOCIDADE_INICIAL, 30, VELOCIDADE_MAXIMA]) {
  const j = janelaDeAcerto(TIPO.PORTAO, 'deslizar', v);
  verificar(
    j.largura >= 0.18,
    'a ' + v + ' u/s a janela do deslize e de ' + (j.largura * 1000).toFixed(0) +
    ' ms (de ' + j.de + ' s a ' + j.ate + ' s antes do impacto)'
  );
}
verificar(simular({ tipo: TIPO.PORTAO, acao: 'nada' }), 'em pe, o feixe acerta');
verificar(
  simular({ tipo: TIPO.PORTAO, acao: 'pular', antecipacao: 0.25 }),
  'pular NAO salva do feixe (e por baixo que se passa)'
);

console.log('\nSATELITE / PAREDE (so trocando de pista)');
verificar(simular({ tipo: TIPO.PAREDE, acao: 'nada' }), 'em pe, a parede acerta');
verificar(
  simular({ tipo: TIPO.PAREDE, acao: 'pular', antecipacao: 0.25 }),
  'pular NAO salva da parede'
);
verificar(
  simular({ tipo: TIPO.PAREDE, acao: 'deslizar', antecipacao: 0.3 }),
  'deslizar NAO salva da parede'
);
verificar(
  !simular({ tipo: TIPO.PAREDE, pistaJogador: 0, pistaObstaculo: 1 }),
  'na pista vizinha, a parede nao encosta'
);

console.log('\nFOLGA ENTRE PISTAS');
const folga = (PISTAS[1] - PISTAS[0]) - CAIXAS[TIPO.PAREDE].meiaX - JOGADOR.meiaLargura;
verificar(
  folga > 0.3,
  'sobra ' + folga.toFixed(2) + ' u entre o jogador e a parede da pista do lado ' +
  '(o puxao do buraco negro consome no maximo 0.46)'
);

console.log('\n' + (falhas === 0 ? 'TUDO CERTO' : falhas + ' FALHA(S)') + '\n');
process.exit(falhas === 0 ? 0 : 1);
