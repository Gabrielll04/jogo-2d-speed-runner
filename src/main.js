/* ==========================================================================
   STARDUST RUNNER - ponto de entrada.

   Aqui moram: a checagem de WebGL, o loop principal, a maquina de estados
   das telas e a cola entre input, audio, HUD e jogo.
   ========================================================================== */

import './style.css';
import {
  NOME_JOGO, SEGUNDOS_ATE_ATTRACT, SEGUNDOS_ATE_VITRINE, RESOLUCOES, PONTOS
} from './config.js';
import { RenderizadorPixel } from './core/renderer.js';
import { Governador } from './core/quality.js';
import { input, alternarTelaCheia } from './core/input.js';
import { prefs, registrarPontuacao } from './core/storage.js';
import { audio } from './audio/audio.js';
import { Jogo, ESTADO } from './game/game.js';
import { Hud } from './ui/hud.js';
import { Telas } from './ui/screens.js';
import { enviarPontuacao, buscarTop, placarLigado } from './ui/leaderboard.js';

/* Fases da interface (o jogo tem o estado dele, isto aqui e o fluxo de telas) */
const FASE = {
  ATTRACT: 'attract',
  NICK: 'nick',
  CONTAGEM: 'contagem',
  JOGANDO: 'jogando',
  PAUSA: 'pausa',
  FIM: 'fim',
  CONFIG: 'config',
  ERRO: 'erro'
};

class Aplicacao {
  constructor() {
    this.renderizador = new RenderizadorPixel();
    this.fase = FASE.ATTRACT;
    this.faseAnterior = FASE.ATTRACT;
    this.tempoContagem = 0;
    this.passoContagem = 0;
    this.tempoAposMorteBot = 0;
    this.topRemoto = null;
    this.ultimoQuadro = 0;
    this.pausadoPorAba = false;
  }

  /* ------------------------------------------------------------------ */
  iniciar() {
    const qualidadeInicial = prefs.get('qualidade');
    if (!this.renderizador.iniciar(qualidadeInicial)) {
      this.mostrarErroWebGL();
      return;
    }

    this.governador = new Governador(this.renderizador);
    this.governador.manual = prefs.get('qualidadeManual');
    this.jogo = new Jogo();
    this.hud = new Hud();
    this.telas = new Telas({
      aoMudarAudio: () => this.aplicarPreferenciasAudio(),
      aoMudarVideo: () => this.aplicarPreferenciasVideo(),
      aoMudarQualidade: (indice) => {
        this.governador.aplicarManual(indice);
        this.jogo.mundo.aplicarQualidade(indice, this.governador.escalaParticulas);
        audio.sfxUi(true);
      },
      aoClicarSugestao: () => audio.sfxUi()
    });

    // A degradacao automatica vale so para esta sessao: se ela fosse gravada,
    // um engasgo momentaneo deixaria o jogo travado na qualidade baixa para
    // sempre. Quem escolhe na tela de configuracoes, esse sim fica gravado.
    this.governador.aoDegradar = (indice, escala) => {
      this.jogo.mundo.aplicarQualidade(indice, escala);
    };

    this.ligarEventosDoJogo();
    this.aplicarPreferenciasVideo();
    this.jogo.mundo.aplicarQualidade(qualidadeInicial, this.governador.escalaParticulas);

    input.aoAgir((acao, origem) => this.tratarAcao(acao, origem));
    input.noPrimeiroGesto(() => {
      if (audio.iniciar()) {
        this.aplicarPreferenciasAudio();
        audio.setIntensidade(this.fase === FASE.JOGANDO ? 'jogo' : 'menu');
      }
    });

    this.ligarEventosDeJanela();

    if (this.ehTouch()) document.getElementById('toque-guia').classList.remove('oculto');

    this.entrarAttract();
    this.ultimoQuadro = performance.now();
    requestAnimationFrame((t) => this.quadro(t));
  }

  ehTouch() {
    return ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  }

  mostrarErroWebGL() {
    const telas = { mostrar: () => {} };
    document.getElementById('tela-erro').classList.remove('oculto');
    document.getElementById('erro-texto').textContent =
      'Seu navegador nao suporta WebGL, que e o que o ' + NOME_JOGO + ' usa para desenhar. ' +
      'Tente o Chrome ou o Edge atualizados, e confira se a aceleracao de hardware esta ligada ' +
      'nas configuracoes do navegador.';
    this.telas = telas;
  }

  /* ------------------------------------------------------------------ */
  /* Preferencias                                                        */
  /* ------------------------------------------------------------------ */
  aplicarPreferenciasAudio() {
    audio.setVolume(prefs.get('volume'));
    audio.setMudo(prefs.get('mudo'));
  }

  aplicarPreferenciasVideo() {
    document.body.classList.toggle('sem-scanlines', !prefs.get('scanlines'));
    document.body.classList.toggle('movimento-reduzido', prefs.get('movimentoReduzido'));
    this.jogo.mundo.tremorHabilitado = prefs.get('tremor') && !prefs.get('movimentoReduzido');
  }

  /* ------------------------------------------------------------------ */
  /* Eventos do jogo -> HUD                                              */
  /* ------------------------------------------------------------------ */
  ligarEventosDoJogo() {
    this.jogo.eventos = {
      aviso: (texto, cor) => {
        if (this.fase === FASE.JOGANDO) this.hud.aviso(texto, cor);
      },
      pontos: () => {
        if (this.fase === FASE.JOGANDO) this.hud.bateScore();
      },
      combo: () => {},
      powerup: () => {},
      powerupFim: () => {},
      escudoQuebrou: () => {
        if (this.fase === FASE.JOGANDO) this.hud.flash();
      },
      morte: (resumo) => this.aoMorrer(resumo)
    };
  }

  /* ------------------------------------------------------------------ */
  /* Janela                                                              */
  /* ------------------------------------------------------------------ */
  ligarEventosDeJanela() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.pausadoPorAba = true;
        audio.suspender();
        if (this.fase === FASE.JOGANDO) this.pausar();
      } else {
        this.pausadoPorAba = false;
        this.ultimoQuadro = performance.now();
        audio.retomar();
      }
    });

    window.addEventListener('blur', () => {
      if (this.fase === FASE.JOGANDO) this.pausar();
    });

    this.renderizador.aoPerderContexto = () => {
      if (this.fase === FASE.JOGANDO) this.pausar();
      this.telas.abrirErro(
        'A placa de video reiniciou e o desenho foi perdido. Recarregue a pagina (F5) ' +
        'para voltar a correr.'
      );
      this.fase = FASE.ERRO;
    };
  }

  /* ------------------------------------------------------------------ */
  /* Maquina de estados                                                  */
  /* ------------------------------------------------------------------ */
  entrarAttract() {
    this.fase = FASE.ATTRACT;
    this.hud.mostrar(false);
    this.jogo.comecar(true);
    // Quem acabou de chegar aqui merece ver o menu inteiro; a vitrine so
    // entra depois de o PC ficar parado.
    this.telas.setVitrine(false);
    this.telas.abrirAttract(this.topRemoto);
    audio.setIntensidade('menu');
    this.tempoAposMorteBot = 0;
    this.atualizarPlacarRemoto();
  }

  async atualizarPlacarRemoto() {
    if (!placarLigado) return;
    const top = await buscarTop(10);
    if (top && this.fase === FASE.ATTRACT) {
      this.topRemoto = top;
      this.telas.desenharPlacar(top);
    }
  }

  entrarNickname() {
    this.fase = FASE.NICK;
    this.hud.mostrar(false);
    this.telas.abrirNickname();
    input.setCapturaTexto(true);
    audio.sfxUi(true);
  }

  entrarContagem() {
    input.setCapturaTexto(false);
    this.fase = FASE.CONTAGEM;
    this.jogo.comecar(false);
    this.jogo.estado = ESTADO.CONTAGEM;
    this.hud.reiniciar();
    this.hud.mostrar(true);
    this.telas.abrirContagem();
    this.passoContagem = 3;
    this.tempoContagem = 0;
    this.telas.setContagem('3');
    audio.sfxUi();
    audio.setIntensidade('jogo');
  }

  entrarJogo() {
    this.fase = FASE.JOGANDO;
    this.jogo.estado = ESTADO.JOGANDO;
    this.telas.esconderTudo();
    this.hud.mostrar(true);
  }

  pausar() {
    if (this.fase !== FASE.JOGANDO) return;
    this.fase = FASE.PAUSA;
    this.jogo.estado = ESTADO.PAUSADO;
    this.telas.abrirPausa();
    audio.setIntensidade('menu');
    audio.sfxUi();
  }

  despausar() {
    if (this.fase !== FASE.PAUSA) return;
    this.fase = FASE.JOGANDO;
    this.jogo.estado = ESTADO.JOGANDO;
    this.telas.esconderTudo();
    audio.setIntensidade('jogo');
    audio.sfxUi();
  }

  abrirConfig() {
    if (this.fase === FASE.CONFIG) return;
    this.faseAnterior = this.fase;
    if (this.fase === FASE.JOGANDO) {
      this.jogo.estado = ESTADO.PAUSADO;
    }
    if (this.fase === FASE.NICK) input.setCapturaTexto(false);
    this.fase = FASE.CONFIG;
    this.telas.abrirConfig();
    audio.sfxUi(true);
  }

  fecharConfig() {
    const destino = this.faseAnterior;
    this.fase = destino;
    audio.sfxUi();
    if (destino === FASE.ATTRACT) this.telas.abrirAttract(this.topRemoto);
    else if (destino === FASE.NICK) { this.telas.abrirNickname(); input.setCapturaTexto(true); }
    else if (destino === FASE.PAUSA) this.telas.abrirPausa();
    else if (destino === FASE.FIM) this.telas.mostrar('tela-fim');
    else if (destino === FASE.JOGANDO) {
      this.telas.esconderTudo();
      this.jogo.estado = ESTADO.JOGANDO;
    } else {
      this.telas.esconderTudo();
    }
  }

  aoMorrer(resumo) {
    if (resumo.bot) {
      this.tempoAposMorteBot = 2.6;
      return;
    }
    this.fase = FASE.FIM;
    this.hud.mostrar(false);
    audio.setIntensidade('menu');

    const apelido = prefs.get('apelido') || 'ANONIMO';
    const ehRecorde = registrarPontuacao(apelido, resumo.pontos, resumo.distancia);
    this.telas.abrirFim(resumo, ehRecorde);

    if (ehRecorde) {
      setTimeout(() => this.jogo.mundo.sacudir(0.4), 700);
    }

    if (placarLigado) {
      this.telas.statusEnvio('ENVIANDO PONTUACAO...', '');
      enviarPontuacao({
        nickname: apelido,
        score: resumo.pontos,
        distance: resumo.distancia,
        maxCombo: resumo.maiorMultiplicador,
        stardust: resumo.poeira
      }).then((ok) => {
        if (this.fase !== FASE.FIM) return;
        if (ok) this.telas.statusEnvio('PONTUACAO ENVIADA', 'ok');
        else this.telas.statusEnvio('OFFLINE - PONTUACAO SO NO LOCAL', 'falha');
        this.topRemoto = null;
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /* Entradas                                                            */
  /* ------------------------------------------------------------------ */
  tratarAcao(acao, origem) {
    if (this.fase === FASE.ERRO) return;

    // Atalhos globais
    if (acao === 'telaCheia') { alternarTelaCheia(); return; }
    if (acao === 'fps') { this.governador.alternarContador(); return; }
    if (acao === 'mudo') {
      prefs.set('mudo', !prefs.get('mudo'));
      this.aplicarPreferenciasAudio();
      if (this.fase === FASE.JOGANDO) {
        this.hud.aviso(prefs.get('mudo') ? 'SOM DESLIGADO' : 'SOM LIGADO', 'ciano');
      }
      return;
    }
    if (acao === 'config' && this.fase !== FASE.CONFIG) { this.abrirConfig(); return; }

    switch (this.fase) {
      case FASE.ATTRACT:
        if (acao === 'confirmar') {
          this.entrarNickname();
        } else if (this.telas.vitrine) {
          // Qualquer outra tecla tira a vitrine e traz o menu de volta.
          this.telas.setVitrine(false);
          audio.sfxUi();
        }
        break;

      case FASE.NICK:
        if (acao === 'confirmar') {
          prefs.set('apelido', this.telas.apelidoDigitado());
          this.entrarContagem();
        } else if (acao === 'voltar') {
          input.setCapturaTexto(false);
          this.entrarAttract();
        } else if (acao === 'proximaSugestao') {
          this.telas.proximaSugestao();
          audio.sfxUi();
        }
        break;

      case FASE.CONTAGEM:
        break;

      case FASE.JOGANDO:
        if (acao === 'pausa' || acao === 'voltar') this.pausar();
        else this.jogo.acao(acao);
        break;

      case FASE.PAUSA:
        if (acao === 'pausa' || acao === 'confirmar') this.despausar();
        else if (acao === 'voltar') this.entrarAttract();
        break;

      case FASE.FIM:
        if (acao === 'confirmar') this.entrarContagem();
        else if (acao === 'voltar') this.entrarAttract();
        break;

      case FASE.CONFIG:
        if (acao === 'voltar' || acao === 'config') this.fecharConfig();
        else if (acao === 'pular') { this.telas.navegarConfig(-1); audio.sfxUi(); }
        else if (acao === 'deslizar') { this.telas.navegarConfig(1); audio.sfxUi(); }
        else if (acao === 'esquerda') { this.telas.ajustarConfig(-1); audio.sfxUi(true); }
        else if (acao === 'direita') { this.telas.ajustarConfig(1); audio.sfxUi(true); }
        else if (acao === 'confirmar') this.fecharConfig();
        break;

      default:
        break;
    }
  }

  /* ------------------------------------------------------------------ */
  /* Loop                                                                */
  /* ------------------------------------------------------------------ */
  quadro(agora) {
    requestAnimationFrame((t) => this.quadro(t));
    if (this.fase === FASE.ERRO) return;

    // dt limitado: se a aba ficou parada, nao teleporta o jogo.
    let dt = (agora - this.ultimoQuadro) / 1000;
    this.ultimoQuadro = agora;
    if (!(dt > 0)) dt = 1 / 60;
    if (dt > 0.1) dt = 0.1;

    if (this.pausadoPorAba) return;

    audio.atualizar(dt);
    this.governador.atualizar(dt);

    this.avancarFluxo(dt);
    this.jogo.atualizar(dt);

    if (this.fase === FASE.JOGANDO) {
      this.hud.atualizar(dt, this.jogo.pontuacao, this.jogo.estadoPowerups());
    }

    this.renderizador.render(this.jogo.mundo.cena, this.jogo.mundo.camera);
  }

  avancarFluxo(dt) {
    /* --- contagem regressiva --- */
    if (this.fase === FASE.CONTAGEM) {
      this.tempoContagem += dt;
      if (this.tempoContagem >= 0.62) {
        this.tempoContagem = 0;
        this.passoContagem--;
        if (this.passoContagem > 0) {
          this.telas.setContagem(String(this.passoContagem));
          audio.sfxUi();
        } else if (this.passoContagem === 0) {
          this.telas.setContagem('VAI!');
          audio.sfxCombo(2);
        } else {
          this.entrarJogo();
        }
      }
      return;
    }

    /* --- attract parado: o menu sai e a partida do bot toma a tela --- */
    if (this.fase === FASE.ATTRACT
        && !this.telas.vitrine
        && input.ociosoSegundos() > SEGUNDOS_ATE_VITRINE) {
      this.telas.setVitrine(true);
    }

    /* --- bot morreu no attract: recomeca a demo --- */
    if (this.fase === FASE.ATTRACT && this.tempoAposMorteBot > 0) {
      this.tempoAposMorteBot -= dt;
      if (this.tempoAposMorteBot <= 0) {
        this.jogo.comecar(true);
        this.telas.abrirAttract(this.topRemoto);
      }
      return;
    }

    /* --- volta ao attract depois de 60 s sem ninguem mexer --- */
    const emMenu = this.fase === FASE.NICK || this.fase === FASE.FIM
                || this.fase === FASE.PAUSA || this.fase === FASE.CONFIG;
    if (emMenu && input.ociosoSegundos() > SEGUNDOS_ATE_ATTRACT) {
      input.setCapturaTexto(false);
      this.entrarAttract();
    }
  }
}

/* ========================================================================== */
const app = new Aplicacao();
app.iniciar();

// Atalhos de depuracao para os testes na escola: window.stardust.fps()
window.stardust = {
  versao: '1.0.0',
  jogo: () => app.jogo,
  fps: () => app.governador.fps,
  resolucoes: RESOLUCOES,
  combos: PONTOS.degrausCombo,
  // Entra no modo vitrine na hora, sem esperar os 30 s de ociosidade.
  forcarVitrine: () => app.telas.setVitrine(true)
};
