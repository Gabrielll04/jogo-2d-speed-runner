/* ==========================================================================
   Teste do catalogo de padroes. Roda com `npm run test:padroes` (Node puro,
   sem navegador). Se algum padrao ficar sem rota, este script sai com
   codigo 1 - e o jogo nunca vai pro evento com padrao impossivel.
   ========================================================================== */

import {
  PADROES, validarCatalogo, rotaViavel, montarCamadas, espelhar, PAREDE
} from './patterns.js';
import { VELOCIDADE_MAXIMA } from '../config.js';

let falhas = 0;

function verificar(condicao, descricao) {
  if (condicao) {
    console.log('  ok   ' + descricao);
  } else {
    console.log('  FALHA ' + descricao);
    falhas++;
  }
}

console.log('\nCATALOGO (' + PADROES.length + ' padroes declarados)');
const { validos, problemas } = validarCatalogo(VELOCIDADE_MAXIMA);
for (const p of problemas) console.log('  FALHA ' + p.nome + ': ' + p.motivo);
verificar(problemas.length === 0, 'todo padrao tem rota viavel na velocidade maxima');
verificar(validos.length >= PADROES.length, 'catalogo valido com ' + validos.length + ' variantes');

console.log('\nROTAS');
for (const p of validos) {
  const r = rotaViavel(p, VELOCIDADE_MAXIMA);
  const camadas = montarCamadas(p.itens);
  verificar(
    r.viavel && r.rota.length === camadas.length,
    p.nome + ' -> rota [' + (r.rota || []).join(' ') + ']'
  );
}

console.log('\nCONTRAPROVA (o validador precisa saber dizer NAO)');
const impossivel = {
  nome: 'muro-fechado',
  comprimento: 12,
  peso: [1, 1, 1],
  itens: [
    { z: 0, pista: 0, tipo: PAREDE },
    { z: 0, pista: 1, tipo: PAREDE },
    { z: 0, pista: 2, tipo: PAREDE }
  ]
};
verificar(!rotaViavel(impossivel, VELOCIDADE_MAXIMA).viavel, 'muro de 3 paredes e rejeitado');

const longeDemais = {
  nome: 'troca-tripla-instantanea',
  comprimento: 12,
  peso: [1, 1, 1],
  itens: [
    { z: 0, pista: 1, tipo: PAREDE },
    { z: 0, pista: 2, tipo: PAREDE },
    { z: 2, pista: 0, tipo: PAREDE },
    { z: 2, pista: 1, tipo: PAREDE }
  ]
};
verificar(
  !rotaViavel(longeDemais, VELOCIDADE_MAXIMA).viavel,
  'troca obrigatoria em 2 unidades de z e rejeitada'
);

const espelhado = espelhar(PADROES[0]);
verificar(
  espelhado.itens[0].pista === 2 - PADROES[0].itens[0].pista,
  'espelhamento inverte a pista'
);

console.log('\n' + (falhas === 0 ? 'TUDO CERTO' : falhas + ' FALHA(S)') + '\n');
process.exit(falhas === 0 ? 0 : 1);
