/* ==========================================================================
   JOGO - as regras. O mundo desenha, aqui a gente decide.

   Fluxo de um quadro:
     1. calcula velocidade e dificuldade a partir da distancia
     2. aplica entradas (jogador humano ou bot do attract)
     3. simula jogador, spawner, coletaveis e buraco negro
     4. testa colisoes (AABB) e raspadas
     5. atualiza pontuacao e power-ups
   ========================================================================== */

import {
  JOGADOR, CORES,
  POWERUPS, FATOR_DILATACAO, BURACO_NEGRO, PONTOS, Z_RECICLA,
  INTERVALO_CAMERA_CINEMA
} from '../config.js';
import { Mundo } from './world.js';
import { Spawner } from './spawner.js';
import { Pontuacao } from './score.js';
import { Bot } from './bot.js';
import { curvaDificuldade, velocidadeDe } from './dificuldade.js';
import { PoolPoeira, PoolPowerups } from './collectibles.js';
import {
  novaCaixa, caixaDoObstaculo, sobrepoe, pegouColetavel, raspou
} from './collision.js';
import { criarRng, entre, amortecer } from '../core/rng.js';
import { audio } from '../audio/audio.js';

export const ESTADO = {
  ATTRACT: 'attract',
  NICK: 'nick',
  CONTAGEM: 'contagem',
  JOGANDO: 'jogando',
  PAUSADO: 'pausado',
  FIM: 'fim'
};

export class Jogo {
  constructor() {
    this.mundo = new Mundo();
    this.rng = criarRng((Date.now() ^ 0x5bf03635) >>> 0);
    this.spawner = new Spawner(this.rng, {
      obstaculos: this.mundo.obstaculos,
      poeira: this.mundo.poeira,
      powerups: this.mundo.powerups
    });
    this.pontuacao = new Pontuacao();
    this.bot = new Bot(this.rng);

    this.caixaJogador = novaCaixa();
    this.caixaObstaculo = novaCaixa();

    this.estado = ESTADO.ATTRACT;
    this.modoBot = true;
    this.eventos = {};
    this.reiniciarPartida();
  }

  /* ------------------------------------------------------------------ */
  reiniciarPartida() {
    this.mundo.reiniciar();
    this.spawner.reiniciar();
    this.pontuacao.reiniciar();
    this.bot.reiniciar();

    this.velocidade = velocidadeDe(0);
    this.tempoPartida = 0;
    this.invulneravel = 0;
    this.temEscudo = false;
    this.ativos = { ima: 0, tempo: 0, supernova: 0 };
    this.puxao = 0;
    this.proximoBuracoNegro = entre(this.rng, BURACO_NEGRO.intervaloMin, BURACO_NEGRO.intervaloMax);
    this.tempoProximaTomada = INTERVALO_CAMERA_CINEMA;
    this.mundo.tomadaCinema = 3;   // comeca na tomada de jogo: ja da pra ler a pista
    this.mundo.tempoCinema = 0;
    this.morreu = false;
  }

  /** Comeca uma partida (humana ou do bot do attract). */
  comecar(modoBot) {
    this.modoBot = modoBot;
    this.reiniciarPartida();
    this.mundo.setCinema(modoBot);
    this.estado = modoBot ? ESTADO.JOGANDO : ESTADO.CONTAGEM;
    audio.setIntensidade(modoBot ? 'menu' : 'jogo');
  }

  /* ------------------------------------------------------------------ */
  /* Entradas                                                            */
  /* ------------------------------------------------------------------ */
  acao(nome) {
    if (this.estado !== ESTADO.JOGANDO || this.modoBot) return;
    const jog = this.mundo.jogador;
    if (nome === 'esquerda' && jog.trocarPista(-1)) audio.sfxUi();
    else if (nome === 'direita' && jog.trocarPista(1)) audio.sfxUi();
    else if (nome === 'pular' && jog.pular()) audio.sfxPulo();
    else if (nome === 'deslizar' && jog.deslizar()) audio.sfxDeslize();
  }

  /* ------------------------------------------------------------------ */
  /* Loop                                                                */
  /* ------------------------------------------------------------------ */
  atualizar(dt) {
    const rodando = this.estado === ESTADO.JOGANDO;
    const dilatacao = this.ativos.tempo > 0;
    const escala = dilatacao ? FATOR_DILATACAO : 1;
    const dtJogo = rodando ? dt * escala : 0;

    if (rodando) {
      this.tempoPartida += dt;
      this.atualizarDificuldade();
    }

    const avancoZ = this.velocidade * dtJogo;

    if (rodando) {
      if (this.modoBot) this.pilotarBot(dt);
      this.mundo.jogador.atualizar(dtJogo, this.velocidade, audio.pulso);
      this.spawner.atualizar(dtJogo, avancoZ, this.dificuldade, this.pontuacao.distancia);
      this.atualizarBuracoNegro(dt, avancoZ);
    }

    // O cenario continua vivo mesmo parado (attract, pausa): so nao avanca.
    this.mundo.atualizar(dt, avancoZ, this.velocidade, audio.pulso, dilatacao);

    this.mundo.poeira.atualizar(
      dtJogo, avancoZ, this.mundo.tempo,
      this.mundo.jogador.grupo.position, this.ativos.ima > 0, Z_RECICLA
    );

    if (!rodando) {
      if (this.modoBot) this.atualizarTomadas(dt);
      return;
    }

    this.pontuacao.atualizar(dtJogo, avancoZ);
    this.atualizarPowerups(dt);
    this.testarColisoes();

    if (this.invulneravel > 0) this.invulneravel -= dt;
    if (this.modoBot) this.atualizarTomadas(dt);
  }

  atualizarDificuldade() {
    // A curva vive em game/dificuldade.js para o teste de ritmo medir
    // exatamente a mesma conta que o jogo roda.
    this.dificuldade = curvaDificuldade(this.pontuacao.distancia);
    this.velocidade = velocidadeDe(this.dificuldade);
  }

  atualizarTomadas(dt) {
    this.tempoProximaTomada -= dt;
    if (this.tempoProximaTomada <= 0) {
      this.tempoProximaTomada = INTERVALO_CAMERA_CINEMA * entre(this.rng, 0.7, 1.4);
      this.mundo.proximaTomada(this.rng);
    }
  }

  pilotarBot(dt) {
    const jog = this.mundo.jogador;
    const d = this.bot.decidir(
      dt, jog, this.mundo.obstaculos.ativos, this.mundo.poeira.ativos, this.velocidade
    );
    if (d.trocar !== 0) jog.trocarPista(d.trocar);
    if (d.pular) jog.pular();
    if (d.deslizar) jog.deslizar();
  }

  /* ------------------------------------------------------------------ */
  /* Buraco negro                                                        */
  /* ------------------------------------------------------------------ */
  atualizarBuracoNegro(dt, avancoZ) {
    const bn = this.mundo.buracoNegro;

    if (!bn.ativo) {
      this.proximoBuracoNegro -= dt;
      if (this.proximoBuracoNegro <= 0 && this.pontuacao.distancia > BURACO_NEGRO.distMinima) {
        bn.surgir();
        audio.sfxBuracoNegro();
        this.emitir('aviso', 'SINGULARIDADE A VISTA', 'magenta');
        this.proximoBuracoNegro = entre(
          this.rng, BURACO_NEGRO.intervaloMin, BURACO_NEGRO.intervaloMax
        );
      }
    }

    const forca = bn.atualizar(dt, avancoZ, this.mundo.tempo);
    this.puxao = amortecer(this.puxao, forca, 0.001, dt);
    this.mundo.jogador.deslocamentoExterno = this.puxao;

    if (Math.abs(this.puxao) > 0.12 && Math.random() < 0.5) {
      const jog = this.mundo.jogador;
      this.mundo.particulas.emitir(jog.x + this.puxao, jog.y + 0.9, 0.2, {
        quantidade: 1, cor: CORES.violeta, velocidade: 3,
        dirX: Math.sign(this.puxao), dirY: 0.2, variacao: 0.8,
        vida: 0.5, tamanho: 0.16, arrasto: 1.2
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /* Power-ups                                                           */
  /* ------------------------------------------------------------------ */
  atualizarPowerups(dt) {
    for (const chave of ['ima', 'tempo', 'supernova']) {
      if (this.ativos[chave] > 0) {
        this.ativos[chave] -= dt;
        if (this.ativos[chave] <= 0) {
          this.ativos[chave] = 0;
          if (chave === 'supernova') this.pontuacao.setDobrado(false);
          this.emitir('powerupFim', chave);
        }
      }
    }
  }

  aplicarPowerup(chave) {
    audio.sfxPowerup();
    const jog = this.mundo.jogador;
    this.mundo.particulas.emitir(jog.x, jog.y + 0.9, 0, {
      quantidade: 16, cor: POWERUPS[chave].cor, velocidade: 5,
      vida: 0.7, tamanho: 0.24, espalhamento: 0.9, arrasto: 2.2
    });

    if (chave === 'escudo') {
      this.temEscudo = true;
      jog.setEscudo(true);
      this.emitir('aviso', 'BOLHA ATIVA', 'ciano');
    } else {
      this.ativos[chave] = POWERUPS[chave].duracao;
      if (chave === 'supernova') this.pontuacao.setDobrado(true);
      const rotulos = {
        ima: 'IMA DE POEIRA',
        tempo: 'DILATACAO TEMPORAL',
        supernova: 'SUPERNOVA x2'
      };
      this.emitir('aviso', rotulos[chave], chave === 'supernova' ? 'magenta' : 'ciano');
    }
    this.emitir('powerup', chave);
  }

  /* ------------------------------------------------------------------ */
  /* Colisoes                                                            */
  /* ------------------------------------------------------------------ */
  testarColisoes() {
    const jog = this.mundo.jogador;
    const cx = jog.caixa(this.caixaJogador);

    /* ---------- obstaculos ---------- */
    for (const o of this.mundo.obstaculos.ativos) {
      const co = caixaDoObstaculo(o, this.caixaObstaculo);
      if (sobrepoe(cx, co)) {
        this.sofrerDano(o);
        if (this.morreu) return;
        continue;
      }
      // Raspou: avaliado uma unica vez, no quadro em que o obstaculo passa.
      if (!o.jaAvaliado && o.grupo.position.z > 0) {
        o.jaAvaliado = true;
        if (raspou(cx, co)) this.registrarRaspada(o);
      }
    }

    /* ---------- poeira ---------- */
    const meiaPoeira = PoolPoeira.meiaCaixa;
    for (let i = this.mundo.poeira.ativos.length - 1; i >= 0; i--) {
      const p = this.mundo.poeira.ativos[i];
      if (pegouColetavel(cx, p.posicao, meiaPoeira)) {
        this.coletarPoeira(p);
      }
    }

    /* ---------- power-ups ---------- */
    const meiaPu = PoolPowerups.meiaCaixa;
    for (let i = this.mundo.powerups.ativos.length - 1; i >= 0; i--) {
      const p = this.mundo.powerups.ativos[i];
      if (pegouColetavel(cx, p.grupo.position, meiaPu)) {
        const chave = p.chave;
        this.mundo.powerups.remover(p);
        this.aplicarPowerup(chave);
      }
    }
  }

  coletarPoeira(p) {
    const pos = p.posicao;
    this.mundo.particulas.emitir(pos.x, pos.y, pos.z, {
      quantidade: 4, cor: CORES.dourado, velocidade: 3.4,
      vida: 0.4, tamanho: 0.18, espalhamento: 0.35, arrasto: 3
    });
    this.mundo.poeira.remover(p);

    const r = this.pontuacao.coletarPoeira();
    audio.sfxColeta(this.pontuacao.nivelCombo);
    if (r.subiu) {
      audio.sfxCombo(this.pontuacao.nivelCombo);
      this.emitir('aviso', 'COMBO x' + PONTOS.degrausCombo[this.pontuacao.nivelCombo], 'dourado');
      this.emitir('combo', this.pontuacao.nivelCombo);
      this.mundo.sacudir(0.16);
    }
    this.emitir('pontos', r.ganho);
  }

  registrarRaspada(o) {
    const ganho = this.pontuacao.registrarRaspada();
    audio.sfxQuaseAcidente();
    this.emitir('aviso', 'RASPOU!', 'ciano');
    this.emitir('pontos', ganho);
    this.mundo.sacudir(0.12);
    this.mundo.particulas.emitir(
      o.grupo.position.x, 1.0, 0.4,
      {
        quantidade: 7, cor: CORES.ciano, velocidade: 4.5,
        dirZ: 0.8, vida: 0.35, tamanho: 0.16, espalhamento: 0.5, arrasto: 3.5
      }
    );
  }

  sofrerDano(o) {
    if (this.invulneravel > 0) return;
    const jog = this.mundo.jogador;

    if (this.temEscudo) {
      this.temEscudo = false;
      jog.setEscudo(false);
      this.invulneravel = JOGADOR.invulneravel;
      jog.piscar(JOGADOR.invulneravel);
      audio.sfxDano();
      this.mundo.sacudir(0.75);
      this.mundo.particulas.emitir(jog.x, jog.y + 0.9, 0, {
        quantidade: 20, cor: CORES.ciano, velocidade: 7,
        vida: 0.6, tamanho: 0.26, espalhamento: 1.1, arrasto: 2.4
      });
      // O obstaculo que quebrou a bolha some: nada de bater duas vezes.
      o.desativar();
      const i = this.mundo.obstaculos.ativos.indexOf(o);
      if (i >= 0) this.mundo.obstaculos.ativos.splice(i, 1);
      this.emitir('escudoQuebrou');
      this.emitir('aviso', 'BOLHA ESTOUROU', 'magenta');
      return;
    }

    this.morrer();
  }

  morrer() {
    if (this.morreu) return;
    this.morreu = true;
    const jog = this.mundo.jogador;

    audio.sfxDano();
    this.mundo.sacudir(1.3);
    this.mundo.particulas.emitir(jog.x, jog.y + 0.9, 0, {
      quantidade: 30, cor: CORES.magenta, velocidade: 9,
      vida: 0.9, tamanho: 0.3, espalhamento: 1.2, arrasto: 1.6, gravidade: 5
    });
    this.mundo.particulas.emitir(jog.x, jog.y + 0.9, 0, {
      quantidade: 14, cor: CORES.dourado, velocidade: 5,
      vida: 1.1, tamanho: 0.22, espalhamento: 1.0, arrasto: 1.2
    });
    jog.grupo.visible = false;

    this.estado = ESTADO.FIM;
    this.emitir('morte', this.resumo());
  }

  resumo() {
    return {
      pontos: Math.round(this.pontuacao.pontos),
      distancia: Math.round(this.pontuacao.distancia),
      poeira: this.pontuacao.poeiraColetada,
      raspadas: this.pontuacao.raspadas,
      maiorMultiplicador: this.pontuacao.maiorMultiplicador,
      duracao: this.tempoPartida,
      bot: this.modoBot
    };
  }

  /* ------------------------------------------------------------------ */
  emitir(nome, a, b) {
    const fn = this.eventos[nome];
    if (fn) fn(a, b);
  }

  /** Estado dos power-ups para o HUD. */
  estadoPowerups() {
    const lista = [];
    if (this.temEscudo) {
      lista.push({ chave: 'escudo', restante: 1, total: 1, infinito: true });
    }
    for (const chave of ['ima', 'tempo', 'supernova']) {
      if (this.ativos[chave] > 0) {
        lista.push({
          chave,
          restante: this.ativos[chave],
          total: POWERUPS[chave].duracao,
          infinito: false
        });
      }
    }
    return lista;
  }
}
