/* ==========================================================================
   PADROES DE OBSTACULOS + VALIDADOR DE ROTA

   REGRA DE OURO: nenhum padrao pode chegar ao jogo sem uma rota viavel.
   O validador roda no pior cenario possivel (velocidade maxima do jogo) e
   faz uma busca em largura pelas camadas do padrao. Se nao existir caminho,
   o padrao e descartado no carregamento - e o teste `npm run test:padroes`
   quebra, entao o erro nao chega no evento da escola.

   Vocabulario:
     camada  = conjunto de obstaculos que estao praticamente no mesmo z
     rota    = pista escolhida em cada camada
   ========================================================================== */

import {
  VELOCIDADE_MAXIMA, TEMPO_TROCA_PISTA, JOGADOR, PISTAS
} from '../config.js';
import { TIPO } from './hitboxes.js';

export const BAIXO = TIPO.BAIXO;
export const PORTAO = TIPO.PORTAO;
export const PAREDE = TIPO.PAREDE;

/** Quanto tempo o jogador fica no ar depois de pular. */
const TEMPO_NO_AR = (2 * JOGADOR.impulsoPulo) / JOGADOR.gravidade;
/** Tolerancia para considerar dois obstaculos "no mesmo z". */
const TOLERANCIA_CAMADA = 1.2;

/* -------------------------------------------------------------------------
   CATALOGO
   z e relativo ao inicio do padrao (cresce para frente).
   peso = [facil, medio, dificil] - a chance de sortear em cada faixa.
   ------------------------------------------------------------------------- */
export const PADROES = [
  {
    nome: 'pedra-solta',
    comprimento: 10,
    peso: [10, 6, 3],
    espelhavel: true,
    itens: [{ z: 0, pista: 0, tipo: BAIXO }]
  },
  {
    nome: 'pedra-central',
    comprimento: 10,
    peso: [9, 6, 3],
    espelhavel: false,
    itens: [{ z: 0, pista: 1, tipo: BAIXO }]
  },
  {
    nome: 'portao-solto',
    comprimento: 10,
    peso: [8, 7, 4],
    espelhavel: true,
    itens: [{ z: 0, pista: 0, tipo: PORTAO }]
  },
  {
    nome: 'destroco-lateral',
    comprimento: 11,
    peso: [8, 7, 5],
    espelhavel: true,
    itens: [{ z: 0, pista: 0, tipo: PAREDE }]
  },
  {
    nome: 'funil',
    comprimento: 14,
    peso: [5, 8, 7],
    espelhavel: false,
    itens: [
      { z: 0, pista: 0, tipo: PAREDE },
      { z: 0, pista: 2, tipo: PAREDE }
    ]
  },
  {
    nome: 'desvio-duplo',
    comprimento: 22,
    peso: [4, 8, 8],
    espelhavel: true,
    itens: [
      { z: 0, pista: 0, tipo: PAREDE },
      { z: 0, pista: 1, tipo: PAREDE },
      { z: 12, pista: 2, tipo: PAREDE },
      { z: 12, pista: 1, tipo: PAREDE }
    ]
  },
  {
    nome: 'cortina-de-laser',
    comprimento: 13,
    peso: [3, 7, 8],
    espelhavel: false,
    itens: [
      { z: 0, pista: 0, tipo: PORTAO },
      { z: 0, pista: 1, tipo: PORTAO },
      { z: 0, pista: 2, tipo: PORTAO }
    ]
  },
  {
    nome: 'chuva-de-rochas',
    comprimento: 13,
    peso: [4, 8, 7],
    espelhavel: false,
    itens: [
      { z: 0, pista: 0, tipo: BAIXO },
      { z: 0, pista: 1, tipo: BAIXO },
      { z: 0, pista: 2, tipo: BAIXO }
    ]
  },
  {
    nome: 'escolha-sua-dor',
    comprimento: 13,
    peso: [3, 7, 9],
    espelhavel: true,
    itens: [
      { z: 0, pista: 0, tipo: BAIXO },
      { z: 0, pista: 1, tipo: PAREDE },
      { z: 0, pista: 2, tipo: PORTAO }
    ]
  },
  {
    nome: 'tunel-baixo',
    comprimento: 15,
    peso: [2, 6, 9],
    espelhavel: true,
    itens: [
      { z: 0, pista: 0, tipo: PORTAO },
      { z: 0, pista: 1, tipo: PORTAO },
      { z: 0, pista: 2, tipo: PAREDE }
    ]
  },
  {
    nome: 'zigue-zague',
    comprimento: 34,
    peso: [2, 7, 9],
    espelhavel: true,
    itens: [
      { z: 0, pista: 0, tipo: PAREDE },
      { z: 11, pista: 1, tipo: PAREDE },
      { z: 22, pista: 2, tipo: PAREDE }
    ]
  },
  {
    nome: 'salto-duplo',
    comprimento: 40,
    peso: [3, 7, 8],
    espelhavel: false,
    itens: [
      { z: 0, pista: 0, tipo: BAIXO },
      { z: 0, pista: 1, tipo: BAIXO },
      { z: 0, pista: 2, tipo: BAIXO },
      { z: 28, pista: 0, tipo: BAIXO },
      { z: 28, pista: 1, tipo: BAIXO },
      { z: 28, pista: 2, tipo: BAIXO }
    ]
  },
  {
    nome: 'agacha-e-pula',
    comprimento: 36,
    peso: [1, 5, 9],
    espelhavel: false,
    itens: [
      { z: 0, pista: 0, tipo: PORTAO },
      { z: 0, pista: 1, tipo: PORTAO },
      { z: 0, pista: 2, tipo: PORTAO },
      { z: 24, pista: 0, tipo: BAIXO },
      { z: 24, pista: 1, tipo: BAIXO },
      { z: 24, pista: 2, tipo: BAIXO }
    ]
  },
  {
    nome: 'corredor-estreito',
    comprimento: 30,
    peso: [1, 5, 9],
    espelhavel: true,
    itens: [
      { z: 0, pista: 0, tipo: PAREDE },
      { z: 0, pista: 1, tipo: PORTAO },
      { z: 0, pista: 2, tipo: PAREDE },
      { z: 14, pista: 0, tipo: PAREDE },
      { z: 14, pista: 1, tipo: BAIXO },
      { z: 14, pista: 2, tipo: PAREDE }
    ]
  },
  {
    nome: 'porta-e-pedra',
    comprimento: 26,
    peso: [3, 7, 7],
    espelhavel: true,
    itens: [
      { z: 0, pista: 0, tipo: PORTAO },
      { z: 0, pista: 1, tipo: PAREDE },
      { z: 14, pista: 1, tipo: BAIXO },
      { z: 14, pista: 2, tipo: PAREDE }
    ]
  },
  {
    nome: 'lixo-espacial',
    comprimento: 28,
    peso: [2, 6, 8],
    espelhavel: true,
    itens: [
      { z: 0, pista: 2, tipo: PAREDE },
      { z: 9, pista: 1, tipo: BAIXO },
      { z: 18, pista: 0, tipo: PAREDE },
      { z: 18, pista: 1, tipo: PORTAO }
    ]
  },
  {
    nome: 'muralha-quebrada',
    comprimento: 32,
    peso: [1, 4, 9],
    espelhavel: true,
    itens: [
      { z: 0, pista: 1, tipo: PAREDE },
      { z: 0, pista: 2, tipo: PAREDE },
      { z: 10, pista: 0, tipo: PAREDE },
      { z: 10, pista: 1, tipo: PORTAO },
      { z: 20, pista: 1, tipo: PAREDE },
      { z: 20, pista: 2, tipo: BAIXO }
    ]
  }
];

/* -------------------------------------------------------------------------
   VALIDADOR
   ------------------------------------------------------------------------- */

/** Agrupa os itens do padrao em camadas ordenadas por z. */
export function montarCamadas(itens) {
  const ordenados = [...itens].sort((a, b) => a.z - b.z);
  const camadas = [];
  for (const item of ordenados) {
    const ultima = camadas[camadas.length - 1];
    if (ultima && Math.abs(item.z - ultima.z) <= TOLERANCIA_CAMADA) {
      ultima.pistas[item.pista] = item.tipo;
    } else {
      const pistas = new Array(PISTAS.length).fill(null);
      pistas[item.pista] = item.tipo;
      camadas.push({ z: item.z, pistas });
    }
  }
  return camadas;
}

/** Quantas pistas da para atravessar entre dois z, na pior velocidade. */
function trocasPossiveis(deltaZ, velocidade) {
  const tempo = deltaZ / velocidade;
  return Math.floor(tempo / TEMPO_TROCA_PISTA);
}

/**
 * Procura uma rota viavel pelo padrao.
 * Devolve { viavel, rota } onde rota[i] e a pista usada na camada i.
 * A busca e exaustiva (no maximo 3 pistas x poucas camadas), entao e exata.
 */
export function rotaViavel(padrao, velocidade = VELOCIDADE_MAXIMA, pistaInicial = null) {
  const camadas = montarCamadas(padrao.itens);
  if (camadas.length === 0) return { viavel: true, rota: [], camadas };

  const distanciaNoAr = TEMPO_NO_AR * velocidade;
  const iniciais = pistaInicial === null ? PISTAS.map((_, i) => i) : [pistaInicial];

  // Estado: { camada, pista, zFimDoPulo }  (zFimDoPulo = ate onde ele voa)
  const inicio = [];
  for (const p of iniciais) inicio.push({ pista: p, zFimDoPulo: -Infinity, rota: [] });

  let fronteira = inicio;
  for (let c = 0; c < camadas.length; c++) {
    const camada = camadas[c];
    const zAnterior = c === 0 ? camada.z - 40 : camadas[c - 1].z;
    const alcance = c === 0 ? PISTAS.length : trocasPossiveis(camada.z - zAnterior, velocidade);
    const nova = [];
    const vistos = new Set();

    for (const estado of fronteira) {
      for (let destino = 0; destino < PISTAS.length; destino++) {
        if (Math.abs(destino - estado.pista) > alcance) continue;
        const tipo = camada.pistas[destino];
        let zFimDoPulo = estado.zFimDoPulo;

        if (tipo === PAREDE) continue;                 // nao tem como passar
        if (tipo === BAIXO) {
          // Precisa estar no chao para pular de novo.
          if (camada.z < estado.zFimDoPulo) continue;
          zFimDoPulo = camada.z + distanciaNoAr;
        } else if (tipo === PORTAO) {
          // Precisa estar no chao para deslizar por baixo do feixe.
          if (camada.z < estado.zFimDoPulo) continue;
          zFimDoPulo = -Infinity;
        }

        const chave = destino + '|' + (zFimDoPulo === -Infinity ? 'chao' : zFimDoPulo.toFixed(1));
        if (vistos.has(chave)) continue;
        vistos.add(chave);
        nova.push({ pista: destino, zFimDoPulo, rota: estado.rota.concat(destino) });
      }
    }

    if (nova.length === 0) return { viavel: false, rota: null, camadas, falhouEm: c };
    fronteira = nova;
  }

  return { viavel: true, rota: fronteira[0].rota, camadas };
}

/** Versao espelhada (pista 0 <-> 2) de um padrao. */
export function espelhar(padrao) {
  return {
    ...padrao,
    nome: padrao.nome + '-espelhado',
    espelhado: true,
    itens: padrao.itens.map((i) => ({ ...i, pista: PISTAS.length - 1 - i.pista }))
  };
}

/**
 * Valida o catalogo inteiro (normal + espelhado).
 * Devolve { validos, problemas }.
 */
export function validarCatalogo(velocidade = VELOCIDADE_MAXIMA) {
  const validos = [];
  const problemas = [];

  for (const padrao of PADROES) {
    const variantes = padrao.espelhavel ? [padrao, espelhar(padrao)] : [padrao];
    for (const variante of variantes) {
      const r = rotaViavel(variante, velocidade);
      if (!r.viavel) {
        problemas.push({
          nome: variante.nome,
          motivo: 'sem rota viavel na camada ' + r.falhouEm
        });
        continue;
      }
      // Sanidade extra: o comprimento tem que cobrir o ultimo obstaculo.
      const maiorZ = variante.itens.reduce((m, i) => Math.max(m, i.z), 0);
      if (variante.comprimento < maiorZ + 4) {
        problemas.push({
          nome: variante.nome,
          motivo: 'comprimento ' + variante.comprimento + ' menor que o ultimo obstaculo (' + maiorZ + ')'
        });
        continue;
      }
      validos.push({ ...variante, camadas: r.camadas, rotaSugerida: r.rota });
    }
  }

  return { validos, problemas };
}

/** Catalogo ja filtrado, pronto para uso no jogo. */
const catalogo = validarCatalogo();
if (catalogo.problemas.length > 0 && typeof console !== 'undefined') {
  for (const p of catalogo.problemas) {
    console.error('[PADRAO INVALIDO] ' + p.nome + ': ' + p.motivo);
  }
}
export const PADROES_VALIDOS = catalogo.validos;
export const PROBLEMAS_CATALOGO = catalogo.problemas;

/**
 * Sorteia um padrao de acordo com a dificuldade (0 = inicio, 1 = teto).
 * Interpola os tres pesos declarados em cada padrao.
 */
export function sortearPadrao(rng, dificuldade) {
  const d = Math.max(0, Math.min(1, dificuldade));
  let total = 0;
  const pesos = new Array(PADROES_VALIDOS.length);

  for (let i = 0; i < PADROES_VALIDOS.length; i++) {
    const p = PADROES_VALIDOS[i].peso;
    // d=0 -> peso[0]; d=0.5 -> peso[1]; d=1 -> peso[2]
    let peso;
    if (d < 0.5) peso = p[0] + (p[1] - p[0]) * (d / 0.5);
    else peso = p[1] + (p[2] - p[1]) * ((d - 0.5) / 0.5);
    peso = Math.max(0.01, peso);
    pesos[i] = peso;
    total += peso;
  }

  let sorteio = rng() * total;
  for (let i = 0; i < PADROES_VALIDOS.length; i++) {
    sorteio -= pesos[i];
    if (sorteio <= 0) return PADROES_VALIDOS[i];
  }
  return PADROES_VALIDOS[PADROES_VALIDOS.length - 1];
}
