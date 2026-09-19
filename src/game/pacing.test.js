/* ==========================================================================
   Teste de RITMO - o jogo esta punitivo?

   O spawner so chama criar() nos pools, entao da pra rodar ele de verdade
   em Node com pools de mentira e medir o que o jogador sente: quanto TEMPO
   existe entre um obstaculo e o proximo.

   O que se mede nao e distancia entre obstaculos, e o intervalo entre
   DECISOES: obstaculos no mesmo z sao uma escolha so (qual pista), e o que
   cansa e ter que decidir de novo logo em seguida.

   Roda em Node puro: `npm run test:ritmo`.
   ========================================================================== */

import { Spawner } from './spawner.js';
import { curvaDificuldade, velocidadeDe } from './dificuldade.js';
import { criarRng } from '../core/rng.js';
import { DIST_SPAWN, VELOCIDADE_INICIAL, VELOCIDADE_MAXIMA } from '../config.js';

const TOLERANCIA_CAMADA = 1.5;

/** Pool de mentira: so anota o que o spawner mandou criar. */
function poolFalso(registro, rotulo) {
  return {
    criar(a, b, c, d) {
      // obstaculos: (tipo, pista, x, z) | poeira: (x, y, z) | powerup: (chave, x, z)
      if (rotulo === 'obstaculo') registro.push({ tipo: a, z: d });
      return {};
    }
  };
}

/**
 * Roda uma corrida inteira e devolve os intervalos de decisao, em segundos.
 * ateMetros - quanto simular
 */
function correr(semente, ateMetros) {
  const obstaculos = [];
  const rng = criarRng(semente);
  const spawner = new Spawner(rng, {
    obstaculos: poolFalso(obstaculos, 'obstaculo'),
    poeira: poolFalso(obstaculos, 'poeira'),
    powerups: poolFalso(obstaculos, 'powerup')
  });

  const dt = 1 / 60;
  let distancia = 0;
  // Velocidade no instante em que cada obstaculo nasceu: o intervalo de
  // tempo entre dois deles depende da velocidade em que serao cruzados.
  const velocidadePorZ = [];

  while (distancia < ateMetros) {
    const dificuldade = curvaDificuldade(distancia);
    const velocidade = velocidadeDe(dificuldade);
    const avanco = velocidade * dt;

    const antes = obstaculos.length;
    spawner.atualizar(dt, avanco, dificuldade, distancia);
    for (let i = antes; i < obstaculos.length; i++) {
      // z do spawner e relativo ao mundo (negativo, a frente). Converte para
      // "metros de corrida em que o jogador vai encontrar esse obstaculo".
      obstaculos[i].metros = distancia + (-obstaculos[i].z - DIST_SPAWN) + DIST_SPAWN;
      velocidadePorZ.push(velocidade);
    }
    distancia += avanco;
  }

  // Agrupa em camadas (obstaculos praticamente no mesmo ponto da corrida).
  const ordenados = obstaculos
    .filter((o) => o.tipo)
    .sort((a, b) => a.metros - b.metros);
  const camadas = [];
  for (const o of ordenados) {
    const ultima = camadas[camadas.length - 1];
    if (ultima && o.metros - ultima.metros <= TOLERANCIA_CAMADA) continue;
    camadas.push(o);
  }

  const intervalos = [];
  for (let i = 1; i < camadas.length; i++) {
    const deltaMetros = camadas[i].metros - camadas[i - 1].metros;
    const velocidade = velocidadeDe(curvaDificuldade(camadas[i].metros));
    intervalos.push(deltaMetros / velocidade);
  }
  return { intervalos, camadas };
}

function percentil(lista, p) {
  const ordenada = [...lista].sort((a, b) => a - b);
  return ordenada[Math.min(ordenada.length - 1, Math.floor(ordenada.length * p))];
}

/* ========================================================================== */
let falhas = 0;
function verificar(condicao, descricao) {
  console.log((condicao ? '  ok   ' : '  FALHA ') + descricao);
  if (!condicao) falhas++;
}

console.log('\nRITMO (intervalo entre decisoes, 12 corridas de 4000 m)');

let todos = [];
for (let s = 1; s <= 12; s++) {
  todos = todos.concat(correr(s * 7919, 4000).intervalos);
}

const minimo = Math.min(...todos);
const p05 = percentil(todos, 0.05);
const mediana = percentil(todos, 0.5);

console.log('  amostras: ' + todos.length);
console.log('  minimo ' + minimo.toFixed(2) + ' s   ' +
  'p05 ' + p05.toFixed(2) + ' s   mediana ' + mediana.toFixed(2) + ' s');

verificar(minimo >= 0.42,
  'nenhuma decisao chega com menos de 0,42 s (o pior caso foi ' + minimo.toFixed(2) + ' s)');
verificar(p05 >= 0.48,
  '95% das decisoes tem 0,48 s ou mais (p05 = ' + p05.toFixed(2) + ' s)');
verificar(mediana >= 1.0,
  'o ritmo tipico da tempo de respirar: mediana de ' + mediana.toFixed(2) + ' s');
// Teto tambem e criterio: sem isso, "resolver o jogo punitivo" viraria
// espalhar tudo ate virar um passeio vazio.
verificar(mediana <= 1.9,
  'e o jogo nao virou um passeio: mediana abaixo de 1,9 s');

console.log('\nRITMO POR TRECHO (uma corrida longa)');
const corrida = correr(4242, 4000);
const faixas = [[0, 500], [500, 1500], [1500, 3000], [3000, 4000]];
for (const [de, ate] of faixas) {
  const dentro = [];
  for (let i = 1; i < corrida.camadas.length; i++) {
    const m = corrida.camadas[i].metros;
    if (m < de || m >= ate) continue;
    const delta = m - corrida.camadas[i - 1].metros;
    dentro.push(delta / velocidadeDe(curvaDificuldade(m)));
  }
  if (!dentro.length) continue;
  const med = percentil(dentro, 0.5);
  const pior = Math.min(...dentro);
  verificar(pior >= 0.42,
    de + '-' + ate + ' m: mediana ' + med.toFixed(2) + ' s, pior ' + pior.toFixed(2) + ' s');
}

console.log('\nCURVA');
for (const m of [0, 250, 500, 1000, 2000, 3200]) {
  const d = curvaDificuldade(m);
  console.log('  ' + String(m).padStart(4) + ' m -> dificuldade ' + d.toFixed(2) +
    '   velocidade ' + velocidadeDe(d).toFixed(1) + ' u/s');
}
verificar(velocidadeDe(curvaDificuldade(0)) === VELOCIDADE_INICIAL, 'comeca na velocidade inicial');
verificar(
  Math.abs(velocidadeDe(curvaDificuldade(99999)) - VELOCIDADE_MAXIMA) < 0.01,
  'a velocidade tem teto em ' + VELOCIDADE_MAXIMA + ' u/s'
);
verificar(
  velocidadeDe(curvaDificuldade(500)) < VELOCIDADE_INICIAL + 4,
  'nos primeiros 500 m a velocidade quase nao sobe (' +
  velocidadeDe(curvaDificuldade(500)).toFixed(1) + ' u/s)'
);

console.log('\n' + (falhas === 0 ? 'TUDO CERTO' : falhas + ' FALHA(S)') + '\n');
process.exit(falhas === 0 ? 0 : 1);
