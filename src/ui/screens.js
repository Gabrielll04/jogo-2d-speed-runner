/* ==========================================================================
   TELAS - attract, apelido, contagem, pausa, fim e configuracoes.
   Todas sao overlays de DOM sobre o canvas, no mesmo tema da galaxia.
   ========================================================================== */

import { NOME_JOGO, SUGESTOES_NICK, RESOLUCOES, PONTOS } from '../config.js';
import { prefs } from '../core/storage.js';
import { montarLogo } from './logo.js';
import { placarLigado } from './leaderboard.js';
import { criarRng, inteiro } from '../core/rng.js';

const el = (id) => document.getElementById(id);
const TELAS = ['tela-attract', 'tela-nick', 'tela-partida', 'tela-pausa', 'tela-fim', 'tela-config', 'tela-erro'];

export class Telas {
  constructor(callbacks) {
    this.cb = callbacks;
    this.rng = criarRng((Date.now() ^ 0x1f2e3d4c) >>> 0);
    this.atual = null;
    this.configSelecionada = 0;
    this.sugestaoAtual = 0;

    montarLogo(el('logo-slot'));
    document.title = NOME_JOGO;

    this.inputNick = el('input-nick');
    this.inputNick.addEventListener('input', () => {
      this.inputNick.value = this.limparApelido(this.inputNick.value);
    });

    el('sugestoes-lista').addEventListener('click', (ev) => {
      const alvo = ev.target.closest('.sugestao');
      if (!alvo) return;
      this.inputNick.value = alvo.textContent;
      this.inputNick.focus();
      if (this.cb.aoClicarSugestao) this.cb.aoClicarSugestao();
    });

    this.montarConfig();
  }

  limparApelido(texto) {
    return texto
      .toUpperCase()
      .replace(/[^A-Z0-9ÁÀÂÃÉÊÍÓÔÕÚÇ _.-]/g, '')
      .slice(0, 12);
  }

  /* ------------------------------------------------------------------ */
  mostrar(nome) {
    for (const t of TELAS) {
      const node = el(t);
      if (!node) continue;
      const visivel = t === nome;
      node.classList.toggle('oculto', !visivel);
    }
    this.atual = nome;
  }

  esconderTudo() {
    this.mostrar(null);
  }

  /* ------------------------------------------------------------------ */
  /* ATTRACT                                                             */
  /* ------------------------------------------------------------------ */
  abrirAttract(topRemoto) {
    this.mostrar('tela-attract');
    this.desenharPlacar(topRemoto);
    this.setVitrine(this.vitrine);
  }

  /**
   * Modo vitrine: o menu sai da frente e a partida do bot vira o assunto
   * da tela. Chamado quando o PC fica parado no attract.
   */
  setVitrine(ativo) {
    this.vitrine = !!ativo;
    el('tela-attract').classList.toggle('vitrine', this.vitrine);
    el('chamada-texto').textContent = this.vitrine
      ? 'APERTE ENTER!'
      : 'PRESSIONE ENTER PARA COMECAR';
  }

  desenharPlacar(topRemoto) {
    const lista = el('lista-placar');
    const titulo = el('titulo-placar');

    if (topRemoto && topRemoto.length) {
      titulo.textContent = 'TOP 10 DA REDE';
      lista.innerHTML = topRemoto.slice(0, 10).map((linha, i) =>
        '<li><i>' + String(i + 1).padStart(2, '0') + '</i>' +
        '<b>' + this.escapar(linha.nickname || 'ANONIMO') + '</b>' +
        '<u>' + Number(linha.score || 0).toLocaleString('pt-BR') + '</u></li>'
      ).join('');
      return;
    }

    titulo.textContent = placarLigado ? 'RECORDE LOCAL (REDE OFFLINE)' : 'RECORDE LOCAL';
    const recorde = prefs.get('recorde');
    if (!recorde) {
      lista.innerHTML = '<li class="placar-vazio">NINGUEM CORREU AINDA. SEJA O PRIMEIRO.</li>';
      return;
    }
    lista.innerHTML =
      '<li class="destaque"><i>01</i><b>' +
      this.escapar(prefs.get('recordeApelido') || 'ANONIMO') +
      '</b><u>' + recorde.toLocaleString('pt-BR') + '</u></li>' +
      '<li><i></i><b>MELHOR DISTANCIA</b><u>' +
      (prefs.get('recordeDistancia') || 0) + ' M</u></li>';
  }

  escapar(texto) {
    return String(texto).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  /* ------------------------------------------------------------------ */
  /* APELIDO                                                             */
  /* ------------------------------------------------------------------ */
  abrirNickname() {
    this.mostrar('tela-nick');
    const salvo = prefs.get('apelido');
    this.sugestoes = this.sortearSugestoes();
    this.sugestaoAtual = 0;
    el('sugestoes-lista').innerHTML = this.sugestoes
      .map((s) => '<button type="button" class="sugestao">' + s.toUpperCase() + '</button>')
      .join('');
    this.inputNick.value = salvo ? salvo : this.sugestoes[0].toUpperCase();
    setTimeout(() => {
      this.inputNick.focus();
      this.inputNick.select();
    }, 30);
  }

  sortearSugestoes() {
    const pool = [...SUGESTOES_NICK];
    const saida = [];
    for (let i = 0; i < 3 && pool.length; i++) {
      saida.push(pool.splice(inteiro(this.rng, 0, pool.length - 1), 1)[0]);
    }
    return saida;
  }

  proximaSugestao() {
    if (!this.sugestoes || !this.sugestoes.length) return;
    this.sugestaoAtual = (this.sugestaoAtual + 1) % this.sugestoes.length;
    this.inputNick.value = this.sugestoes[this.sugestaoAtual].toUpperCase();
    this.inputNick.select();
  }

  apelidoDigitado() {
    const valor = this.limparApelido(this.inputNick.value).trim();
    return valor || 'ANONIMO';
  }

  /* ------------------------------------------------------------------ */
  /* CONTAGEM                                                            */
  /* ------------------------------------------------------------------ */
  abrirContagem() {
    this.mostrar('tela-partida');
  }

  setContagem(texto) {
    const node = el('contagem');
    node.textContent = texto;
    node.classList.remove('contagem');
    void node.offsetWidth;
    node.classList.add('contagem');
  }

  /* ------------------------------------------------------------------ */
  /* FIM DE PARTIDA                                                      */
  /* ------------------------------------------------------------------ */
  abrirFim(resumo, ehRecorde) {
    this.mostrar('tela-fim');
    el('fim-titulo').textContent = ehRecorde ? 'VOCE VOOU' : 'FIM DE LINHA';
    el('fim-recorde').classList.toggle('oculto', !ehRecorde);
    el('fim-envio').textContent = '';
    el('fim-envio').className = 'fim-envio';

    el('fim-dist').textContent = '0';
    el('fim-poeira').textContent = '0';
    el('fim-combo').textContent = 'x1';
    el('fim-score').textContent = '0';

    // Contagem animada: o numero sobe em ~900 ms com desaceleracao.
    this.animarNumero(el('fim-score'), resumo.pontos, 900, (v) => v.toLocaleString('pt-BR'));
    this.animarNumero(el('fim-dist'), resumo.distancia, 700, (v) => String(v));
    this.animarNumero(el('fim-poeira'), resumo.poeira, 700, (v) => String(v));
    setTimeout(() => {
      el('fim-combo').textContent = 'x' + resumo.maiorMultiplicador;
    }, 620);
  }

  animarNumero(node, alvo, duracao, formatar) {
    const inicio = performance.now();
    const passo = (agora) => {
      const t = Math.min(1, (agora - inicio) / duracao);
      const suave = 1 - Math.pow(1 - t, 3);
      node.textContent = formatar(Math.round(alvo * suave));
      if (t < 1) requestAnimationFrame(passo);
    };
    requestAnimationFrame(passo);
  }

  statusEnvio(texto, classe) {
    const node = el('fim-envio');
    node.textContent = texto;
    node.className = 'fim-envio' + (classe ? ' ' + classe : '');
  }

  /* ------------------------------------------------------------------ */
  /* PAUSA / ERRO                                                        */
  /* ------------------------------------------------------------------ */
  abrirPausa() { this.mostrar('tela-pausa'); }

  abrirErro(mensagem) {
    this.mostrar('tela-erro');
    el('erro-texto').textContent = mensagem;
  }

  /* ------------------------------------------------------------------ */
  /* CONFIGURACOES                                                       */
  /* ------------------------------------------------------------------ */
  montarConfig() {
    this.itensConfig = [
      {
        rotulo: 'VOLUME',
        valor: () => prefs.get('mudo') ? 'MUDO' : Math.round(prefs.get('volume') * 100) + '%',
        ajustar: (delta) => {
          if (prefs.get('mudo') && delta > 0) {
            prefs.set('mudo', false);
          } else {
            const novo = Math.max(0, Math.min(1, prefs.get('volume') + delta * 0.1));
            prefs.set('volume', Number(novo.toFixed(2)));
            if (novo === 0) prefs.set('mudo', true);
            else prefs.set('mudo', false);
          }
          this.cb.aoMudarAudio();
        }
      },
      {
        rotulo: 'LINHAS DE TUBO',
        valor: () => prefs.get('scanlines') ? 'LIGADAS' : 'DESLIGADAS',
        ajustar: () => {
          prefs.set('scanlines', !prefs.get('scanlines'));
          this.cb.aoMudarVideo();
        }
      },
      {
        rotulo: 'TREMOR DE TELA',
        valor: () => prefs.get('tremor') ? 'LIGADO' : 'DESLIGADO',
        ajustar: () => {
          prefs.set('tremor', !prefs.get('tremor'));
          this.cb.aoMudarVideo();
        }
      },
      {
        rotulo: 'MOVIMENTO REDUZIDO',
        valor: () => prefs.get('movimentoReduzido') ? 'LIGADO' : 'DESLIGADO',
        ajustar: () => {
          prefs.set('movimentoReduzido', !prefs.get('movimentoReduzido'));
          this.cb.aoMudarVideo();
        }
      },
      {
        rotulo: 'QUALIDADE GRAFICA',
        valor: () => {
          const r = RESOLUCOES[prefs.get('qualidade')];
          return r.rotulo + ' (' + r.largura + 'x' + r.altura + ')';
        },
        ajustar: (delta) => {
          // Seta para a direita = mais qualidade = indice MENOR na lista.
          const novo = Math.max(0, Math.min(RESOLUCOES.length - 1, prefs.get('qualidade') - delta));
          prefs.merge({ qualidade: novo, qualidadeManual: true });
          this.cb.aoMudarQualidade(novo);
        }
      }
    ];
  }

  abrirConfig() {
    this.mostrar('tela-config');
    this.configSelecionada = 0;
    this.desenharConfig();
  }

  desenharConfig() {
    el('lista-config').innerHTML = this.itensConfig.map((item, i) =>
      '<li class="' + (i === this.configSelecionada ? 'sel' : '') + '">' +
        '<span>' + item.rotulo + '</span>' +
        '<span class="valor">' + item.valor() + '</span>' +
      '</li>'
    ).join('');
  }

  navegarConfig(delta) {
    this.configSelecionada =
      (this.configSelecionada + delta + this.itensConfig.length) % this.itensConfig.length;
    this.desenharConfig();
  }

  ajustarConfig(delta) {
    this.itensConfig[this.configSelecionada].ajustar(delta);
    this.desenharConfig();
  }

  get degrausCombo() {
    return PONTOS.degrausCombo;
  }
}
