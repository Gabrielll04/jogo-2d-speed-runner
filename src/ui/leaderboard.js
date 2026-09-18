/* ==========================================================================
   PLACAR EM REDE LOCAL (opcional)

   Com LEADERBOARD_URL vazia nada aqui toca a rede: as funcoes devolvem null
   na hora. Preenchida, cada chamada tem timeout curto e try/catch - o jogo
   NUNCA trava esperando o servidor.

   A base pode ser 'auto' (mesma origem que serviu o jogo), que e o modo
   recomendado quando quem serve o dist/ e o proprio server.js: nao precisa
   saber o IP da maquina nem rebuildar quando ele muda.
   ========================================================================== */

import { LEADERBOARD_URL, LEADERBOARD_TIMEOUT } from '../config.js';

/** Resolve a base das chamadas. Devolve null quando o placar esta desligado. */
function resolverBase() {
  if (!LEADERBOARD_URL) return null;
  if (LEADERBOARD_URL === 'auto') {
    // Ex.: o jogo aberto em http://10.93.71.59:3000/ chama a API no mesmo host.
    return window.location.origin;
  }
  return LEADERBOARD_URL.replace(/\/+$/, '');
}

const BASE = resolverBase();
export const placarLigado = BASE !== null;

/** Cada diagnostico aparece uma vez so: nada de poluir o console a cada morte. */
const jaAvisado = new Set();
function avisarUmaVez(chave, mensagem) {
  if (jaAvisado.has(chave)) return;
  jaAvisado.add(chave);
  console.warn('[placar] ' + mensagem);
}

/**
 * Diagnostico que vale o tempo de quem esta montando o evento: um 404 aqui
 * quase sempre significa "apontei para o servidor errado".
 */
function diagnosticar(rota, resposta) {
  if (resposta.status === 404) {
    avisarUmaVez('404',
      'o servidor em ' + BASE + ' respondeu 404 para ' + rota + '.\n' +
      'A API do placar fica no server.js (porta 3000 por padrao), nao no ' +
      'servidor de desenvolvimento do Vite (5173).\n' +
      'Rode "node server.js" e aponte LEADERBOARD_URL para a porta dele - ou ' +
      'use LEADERBOARD_URL = \'auto\' e abra o jogo pelo proprio server.js.');
  } else if (resposta.status >= 500) {
    avisarUmaVez('5xx', 'o servidor respondeu ' + resposta.status + ' em ' + rota + '.');
  }
}

function comTimeout(ms) {
  const controlador = new AbortController();
  const id = setTimeout(() => controlador.abort(), ms);
  return { sinal: controlador.signal, cancelar: () => clearTimeout(id) };
}

/** Envia uma pontuacao. Devolve true/false/null (null = placar desligado). */
export async function enviarPontuacao(dados) {
  if (!placarLigado) return null;
  const t = comTimeout(LEADERBOARD_TIMEOUT);
  try {
    const resposta = await fetch(BASE + '/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nickname: String(dados.nickname || 'ANONIMO').slice(0, 12),
        score: Math.round(dados.score) || 0,
        distance: Math.round(dados.distance) || 0,
        maxCombo: Math.round(dados.maxCombo) || 1,
        stardust: Math.round(dados.stardust) || 0
      }),
      signal: t.sinal
    });
    if (!resposta.ok) diagnosticar('/api/score', resposta);
    return resposta.ok;
  } catch (erro) {
    avisarUmaVez('rede',
      'nao deu para falar com ' + BASE + ' (' + (erro && erro.name) + ').\n' +
      'Confira se o server.js esta rodando nessa maquina e se o firewall ' +
      'liberou a porta para a rede privada.');
    return false;
  } finally {
    t.cancelar();
  }
}

/** Busca o top N. Devolve array ou null (desligado / falhou). */
export async function buscarTop(limite = 10) {
  if (!placarLigado) return null;
  const t = comTimeout(LEADERBOARD_TIMEOUT);
  try {
    const resposta = await fetch(BASE + '/api/top?limit=' + limite, { signal: t.sinal });
    if (!resposta.ok) {
      diagnosticar('/api/top', resposta);
      return null;
    }
    const dados = await resposta.json();
    return Array.isArray(dados) ? dados : (dados.top || null);
  } catch {
    return null;
  } finally {
    t.cancelar();
  }
}

/** Endereco em uso, para a tela de configuracoes e mensagens de erro. */
export const enderecoPlacar = BASE;
