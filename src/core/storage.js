/* ==========================================================================
   STORAGE - preferencias, apelido e recorde local (localStorage).
   Tudo com try/catch: em PC de escola o storage pode estar bloqueado e o
   jogo tem que continuar funcionando mesmo assim (so nao lembra nada).
   ========================================================================== */

import { RESOLUCAO_PADRAO } from '../config.js';

const CHAVE = 'stardust-runner/v1';

const PADRAO = {
  volume: 0.7,
  mudo: false,
  scanlines: true,
  tremor: true,
  movimentoReduzido: false,
  qualidade: RESOLUCAO_PADRAO,
  qualidadeManual: false,   // vira true quando o jogador escolhe na mao
  apelido: '',
  recorde: 0,
  recordeApelido: '',
  recordeDistancia: 0
};

let estado = { ...PADRAO };

function ler() {
  try {
    const cru = localStorage.getItem(CHAVE);
    if (!cru) return;
    const dados = JSON.parse(cru);
    if (dados && typeof dados === 'object') {
      for (const chave of Object.keys(PADRAO)) {
        if (chave in dados && typeof dados[chave] === typeof PADRAO[chave]) {
          estado[chave] = dados[chave];
        }
      }
    }
  } catch {
    /* storage indisponivel: seguimos com os padroes */
  }
}

function gravar() {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(estado));
  } catch {
    /* silencio: nao pode quebrar o jogo */
  }
}

ler();

export const prefs = {
  /** Leitura direta de uma preferencia. */
  get(chave) {
    return estado[chave];
  },
  /** Escreve e persiste. */
  set(chave, valor) {
    estado[chave] = valor;
    gravar();
  },
  /** Escreve varias de uma vez. */
  merge(objeto) {
    Object.assign(estado, objeto);
    gravar();
  },
  /** Snapshot imutavel (para debug). */
  tudo() {
    return { ...estado };
  }
};

/**
 * Registra uma pontuacao. Devolve true se foi recorde local.
 */
export function registrarPontuacao(apelido, pontos, distancia) {
  if (pontos > estado.recorde) {
    estado.recorde = pontos;
    estado.recordeApelido = apelido || 'ANONIMO';
    estado.recordeDistancia = Math.round(distancia);
    gravar();
    return true;
  }
  return false;
}
