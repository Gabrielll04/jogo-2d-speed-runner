/* ==========================================================================
   PLACAR EM REDE LOCAL (opcional)
   Com LEADERBOARD_URL vazia nada aqui toca a rede: as funcoes devolvem
   null na hora. Preenchida, cada chamada tem timeout curto e try/catch -
   o jogo NUNCA trava esperando o servidor.
   ========================================================================== */

import { LEADERBOARD_URL, LEADERBOARD_TIMEOUT } from '../config.js';

export const placarLigado = LEADERBOARD_URL !== '';

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
    const resposta = await fetch(LEADERBOARD_URL + '/api/score', {
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
    return resposta.ok;
  } catch {
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
    const resposta = await fetch(LEADERBOARD_URL + '/api/top?limit=' + limite, {
      signal: t.sinal
    });
    if (!resposta.ok) return null;
    const dados = await resposta.json();
    return Array.isArray(dados) ? dados : (dados.top || null);
  } catch {
    return null;
  } finally {
    t.cancelar();
  }
}
