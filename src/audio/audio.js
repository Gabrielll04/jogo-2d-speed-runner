/* ==========================================================================
   AUDIO - 100% sintetizado com Web Audio API. Nenhum arquivo de som.

   Estrutura de ganho:
     [osciladores] -> ganhoSfx  ---\
     [musica]      -> ganhoMusica --> ganhoMestre -> destino

   A trilha e um loop synthwave espacial em la menor a 100 BPM, montado por
   um agendador com lookahead (o jeito certo de fazer sequenciador no
   navegador: setTimeout so decide O QUE agendar, quem toca no tempo certo
   e o proprio relogio do AudioContext).
   ========================================================================== */

const LOOKAHEAD_MS = 25;
const JANELA = 0.12;                 // segundos agendados a frente
const PASSOS_POR_COMPASSO = 16;

/* ==========================================================================
   A TRILHA

   Uma so, do menu ao fim de jogo: synthwave espacial em la menor a 100 BPM.
   Houve uma tentativa de dar ao menu uma faixa chiptune propria e ela foi
   reprovada no playtest - repetitiva e irritante depois de alguns minutos,
   que e justamente quanto tempo um PC de evento passa parado no attract.
   O que separa o menu da partida e o volume (VOLUME_ATTRACT), nao a musica,
   e isso tem uma vantagem: a faixa corre continua quando o jogo comeca, sem
   corte no meio da frase.
   ========================================================================== */
const TRILHA = {
  nome: 'jogo',
  bpm: 100,
  ganho: 0.52,
  progressao: [
    { raiz: 45, triade: [57, 60, 64] },   // La menor
    { raiz: 41, triade: [53, 57, 60] },   // Fa
    { raiz: 48, triade: [52, 55, 60] },   // Do
    { raiz: 43, triade: [55, 59, 62] }    // Sol
  ],
  kick:  [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0],
  caixa: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
  hat:   [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0],
  baixo: [1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 0]
};

/** Pentatonica de la menor para o lead esparso da trilha de jogo. */
const PENTA = [69, 72, 74, 76, 79, 81, 84];

/** Exportada para o gerador de previa (audio/preview.js) e para testes. */
export const TRILHAS = { jogo: TRILHA };

function freq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export class MotorAudio {
  constructor() {
    this.ctx = null;
    this.pronto = false;
    this.mudo = false;
    this.volume = 0.7;
    this.atenuacao = 1;              // o attract toca mais baixo que a partida
    this.intensidade = 'off';        // 'off' | 'menu' | 'jogo'
    this.trilha = TRILHA;
    this.passoAtual = 0;
    this.ultimaColeta = 0;           // para nao empilhar o som de poeira
    this.proximoTempo = 0;
    this.timer = null;
    this.pulso = 0;                  // 0..1, cai a cada quadro (visual no beat)
    this.pulsoGrave = 0;
    this.ruido = null;
  }

  /* ------------------------------------------------------------------ */
  /* Inicializacao (so depois do primeiro gesto do jogador)              */
  /* ------------------------------------------------------------------ */
  /**
   * ctxExterno - contexto ja pronto (usado pelo gerador de previa, que
   * renderiza a trilha num OfflineAudioContext). Vazio no jogo.
   */
  iniciar(ctxExterno) {
    if (this.pronto) return true;
    if (ctxExterno) {
      this.ctx = ctxExterno;
    } else {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return false;
      try {
        this.ctx = new Ctx({ latencyHint: 'interactive' });
      } catch {
        return false;
      }
    }

    this.mestre = this.ctx.createGain();
    this.mestre.gain.value = this.mudo ? 0 : this.volume * this.atenuacao;
    this.mestre.connect(this.ctx.destination);

    // Compressor leve: segura os picos quando tudo toca junto.
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -14;
    this.compressor.ratio.value = 4;
    this.compressor.attack.value = 0.004;
    this.compressor.release.value = 0.22;
    this.compressor.connect(this.mestre);

    this.ganhoMusica = this.ctx.createGain();
    this.ganhoMusica.gain.value = 0;
    this.ganhoMusica.connect(this.compressor);

    this.ganhoSfx = this.ctx.createGain();
    this.ganhoSfx.gain.value = 0.85;
    this.ganhoSfx.connect(this.compressor);

    // Eco curto usado pelo lead e por alguns SFX: caracteriza o synthwave.
    this.eco = this.ctx.createDelay(0.6);
    this.eco.delayTime.value = 3 * (60 / TRILHA.bpm / 4);
    this.ecoRetorno = this.ctx.createGain();
    this.ecoRetorno.gain.value = 0.32;
    this.ecoFiltro = this.ctx.createBiquadFilter();
    this.ecoFiltro.type = 'lowpass';
    this.ecoFiltro.frequency.value = 2200;
    this.eco.connect(this.ecoFiltro);
    this.ecoFiltro.connect(this.ecoRetorno);
    this.ecoRetorno.connect(this.eco);
    this.eco.connect(this.compressor);

    this.ruido = this.criarRuido();
    this.pronto = true;

    if (!ctxExterno) {
      // O contexto pode nascer suspenso (politica de autoplay). Quando ele
      // acordar - no primeiro gesto, ou logo de cara no modo quiosque - a
      // trilha entra sozinha a partir daqui.
      this.ctx.onstatechange = () => {
        if (this.ctx.state === 'running' && this.intensidade !== 'off') {
          this.proximoTempo = this.ctx.currentTime + 0.06;
          this.ligarSequenciador();
        }
      };
      this.retomar();
    }
    return true;
  }

  criarRuido() {
    const tamanho = Math.floor(this.ctx.sampleRate * 1.0);
    const buffer = this.ctx.createBuffer(1, tamanho, this.ctx.sampleRate);
    const dados = buffer.getChannelData(0);
    for (let i = 0; i < tamanho; i++) dados[i] = Math.random() * 2 - 1;
    return buffer;
  }

  retomar() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  suspender() {
    if (this.ctx && this.ctx.state === 'running') {
      this.ctx.suspend().catch(() => {});
    }
  }

  /* ------------------------------------------------------------------ */
  /* Controles                                                           */
  /* ------------------------------------------------------------------ */
  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    this.aplicarGanhoMestre(0.02);
  }

  setMudo(v) {
    this.mudo = !!v;
    this.aplicarGanhoMestre(0.02);
  }

  /**
   * True quando existe audio para tocar mas o navegador esta segurando por
   * falta de gesto. E o caso classico do PC do evento aberto e deixado em
   * paz: a politica de autoplay mantem o contexto suspenso e a maquina fica
   * muda sem nenhum erro no console.
   */
  get bloqueado() {
    return this.pronto && !this.mudo && this.ctx.state !== 'running';
  }

  /** Multiplicador de 0 a 1 por cima do volume (o attract usa < 1). */
  setAtenuacao(v) {
    const novo = Math.max(0, Math.min(1, v));
    if (novo === this.atenuacao) return;
    this.atenuacao = novo;
    this.aplicarGanhoMestre(0.25);
  }

  aplicarGanhoMestre(suavidade) {
    if (!this.mestre) return;
    const alvo = this.mudo ? 0 : this.volume * this.atenuacao;
    this.mestre.gain.setTargetAtTime(alvo, this.ctx.currentTime, suavidade || 0.05);
  }

  /**
   * Estado para diagnostico (window.stardust.audio()). No evento, saber se o
   * contexto esta 'suspended' responde na hora por que a maquina esta muda.
   */
  diagnostico() {
    return {
      pronto: this.pronto,
      contexto: this.ctx ? this.ctx.state : 'inexistente',
      intensidade: this.intensidade,
      trilha: this.trilha ? this.trilha.nome : null,
      volume: this.volume,
      atenuacao: this.atenuacao,
      mudo: this.mudo,
      nivel: this.medirNivel()
    };
  }

  /** RMS instantaneo na saida: > 0 prova que esta saindo som de verdade. */
  medirNivel() {
    if (!this.pronto) return 0;
    if (!this.analisador) {
      this.analisador = this.ctx.createAnalyser();
      this.analisador.fftSize = 1024;
      this.mestre.connect(this.analisador);
      this.amostras = new Float32Array(this.analisador.fftSize);
    }
    this.analisador.getFloatTimeDomainData(this.amostras);
    let soma = 0;
    for (let i = 0; i < this.amostras.length; i++) soma += this.amostras[i] * this.amostras[i];
    return Number(Math.sqrt(soma / this.amostras.length).toFixed(5));
  }

  /**
   * 'off' desliga a musica; qualquer outro valor ('menu' ou 'jogo') liga.
   * Os dois tocam a MESMA faixa - o que muda entre o attract e a partida e
   * a atenuacao de volume, nao a trilha. Por isso a troca nao reinicia nada:
   * a musica atravessa a contagem regressiva sem corte.
   */
  setIntensidade(nivel) {
    if (this.intensidade === nivel) return;
    this.intensidade = nivel;
    if (!this.pronto) return;

    const alvo = nivel === 'off' ? 0 : TRILHA.ganho;
    this.ganhoMusica.gain.setTargetAtTime(alvo, this.ctx.currentTime, 0.4);
    if (nivel !== 'off') this.ligarSequenciador();
  }

  /** Duracao de uma semicolcheia na trilha atual. */
  get passo() {
    return 60 / this.trilha.bpm / 4;
  }

  ligarSequenciador() {
    if (this.timer) return;
    // Nada de agendar notas num contexto suspenso: alem de nao soar, cada
    // tentativa rende um aviso de autoplay no console.
    if (this.ctx.state !== 'running') return;
    this.proximoTempo = this.ctx.currentTime + 0.06;
    this.timer = setInterval(() => this.agendar(), LOOKAHEAD_MS);
  }

  desligarSequenciador() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Decaimento do pulso visual. Chamar uma vez por quadro. */
  atualizar(dt) {
    this.pulso = Math.max(0, this.pulso - dt * 4.2);
    this.pulsoGrave = Math.max(0, this.pulsoGrave - dt * 2.4);
  }

  /* ------------------------------------------------------------------ */
  /* Sequenciador                                                        */
  /* ------------------------------------------------------------------ */
  agendar() {
    if (!this.pronto || this.intensidade === 'off') return;
    const agora = this.ctx.currentTime;
    const passo = this.passo;
    while (this.proximoTempo < agora + JANELA) {
      this.tocarPasso(this.passoAtual, this.proximoTempo, passo);
      this.proximoTempo += passo;
      this.passoAtual = (this.passoAtual + 1) % (PASSOS_POR_COMPASSO * 4);
    }
  }

  tocarPasso(passo, tempo, duracaoPasso) {
    const trilha = this.trilha;
    const compasso = Math.floor(passo / PASSOS_POR_COMPASSO);
    const local = passo % PASSOS_POR_COMPASSO;
    const acorde = trilha.progressao[compasso % trilha.progressao.length];

    /* ---------- bateria ---------- */
    if (trilha.kick[local]) {
      this.kick(tempo, 1);
      this.agendarPulso(tempo);
    }
    if (trilha.caixa[local]) this.caixa(tempo, 0.18);
    if (trilha.hat[local]) {
      // Acento nos tempos fortes.
      this.hat(tempo, local % 4 === 0 ? 0.26 : 0.13);
    }

    /* ---------- baixo em arpejo ---------- */
    if (trilha.baixo[local]) {
      const oitava = (local === 7 || local === 14) ? 12 : 0;
      const quinta = (local === 4 || local === 12) ? 7 : 0;
      this.baixo(freq(acorde.raiz + oitava + quinta), tempo, duracaoPasso * 1.6, 0.42);
    }

    /* ---------- pad etereo + lead esparso ---------- */
    if (local === 0) this.pad(acorde.triade, tempo, duracaoPasso * 16);
    if (local === 2 || local === 10 || (local === 6 && compasso % 2 === 1)) {
      const nota = PENTA[(passo * 7 + compasso * 3) % PENTA.length];
      this.lead(freq(nota), tempo, duracaoPasso * 2.2, 0.16);
    }
  }

  agendarPulso(tempo) {
    const atraso = Math.max(0, (tempo - this.ctx.currentTime) * 1000);
    setTimeout(() => {
      this.pulso = 1;
      this.pulsoGrave = 1;
    }, atraso);
  }

  /* ------------------------------------------------------------------ */
  /* Instrumentos                                                        */
  /* ------------------------------------------------------------------ */
  kick(tempo, ganho) {
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, tempo);
    osc.frequency.exponentialRampToValueAtTime(42, tempo + 0.11);
    g.gain.setValueAtTime(0.0001, tempo);
    g.gain.exponentialRampToValueAtTime(ganho, tempo + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, tempo + 0.24);
    osc.connect(g);
    g.connect(this.ganhoMusica);
    osc.start(tempo);
    osc.stop(tempo + 0.26);
  }

  hat(tempo, ganho) {
    const fonte = this.ctx.createBufferSource();
    fonte.buffer = this.ruido;
    fonte.playbackRate.value = 1.6;
    const filtro = this.ctx.createBiquadFilter();
    filtro.type = 'highpass';
    filtro.frequency.value = 7200;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(ganho, tempo);
    g.gain.exponentialRampToValueAtTime(0.0001, tempo + 0.05);
    fonte.connect(filtro);
    filtro.connect(g);
    g.connect(this.ganhoMusica);
    fonte.start(tempo, Math.random() * 0.4, 0.08);
  }

  /** Caixa: ruido curto com um tom por baixo. E ela que da o "tec" arcade. */
  caixa(tempo, ganho) {
    const fonte = this.ctx.createBufferSource();
    fonte.buffer = this.ruido;
    const filtro = this.ctx.createBiquadFilter();
    filtro.type = 'bandpass';
    filtro.frequency.value = 1900;
    filtro.Q.value = 0.9;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(ganho, tempo);
    g.gain.exponentialRampToValueAtTime(0.0001, tempo + 0.13);
    fonte.connect(filtro);
    filtro.connect(g);
    g.connect(this.ganhoMusica);
    fonte.start(tempo, Math.random() * 0.3, 0.16);

    const corpo = this.ctx.createOscillator();
    const gc = this.ctx.createGain();
    corpo.type = 'triangle';
    corpo.frequency.setValueAtTime(220, tempo);
    corpo.frequency.exponentialRampToValueAtTime(140, tempo + 0.08);
    gc.gain.setValueAtTime(ganho * 0.5, tempo);
    gc.gain.exponentialRampToValueAtTime(0.0001, tempo + 0.1);
    corpo.connect(gc);
    gc.connect(this.ganhoMusica);
    corpo.start(tempo);
    corpo.stop(tempo + 0.12);
  }

  baixo(f, tempo, duracao, ganho) {
    const osc = this.ctx.createOscillator();
    const sub = this.ctx.createOscillator();
    const filtro = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = f;
    sub.type = 'square';
    sub.frequency.value = f / 2;
    filtro.type = 'lowpass';
    filtro.frequency.setValueAtTime(1500, tempo);
    filtro.frequency.exponentialRampToValueAtTime(420, tempo + duracao);
    filtro.Q.value = 6;
    g.gain.setValueAtTime(0.0001, tempo);
    g.gain.exponentialRampToValueAtTime(ganho, tempo + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, tempo + duracao);
    osc.connect(filtro);
    sub.connect(filtro);
    filtro.connect(g);
    g.connect(this.ganhoMusica);
    osc.start(tempo); osc.stop(tempo + duracao + 0.02);
    sub.start(tempo); sub.stop(tempo + duracao + 0.02);
  }

  pad(triade, tempo, duracao) {
    const g = this.ctx.createGain();
    const filtro = this.ctx.createBiquadFilter();
    filtro.type = 'lowpass';
    filtro.frequency.value = 1100;
    filtro.Q.value = 0.8;
    g.gain.setValueAtTime(0.0001, tempo);
    g.gain.linearRampToValueAtTime(0.09, tempo + duracao * 0.35);
    g.gain.linearRampToValueAtTime(0.0001, tempo + duracao);
    filtro.connect(g);
    g.connect(this.ganhoMusica);

    for (const nota of triade) {
      for (const detune of [-6, 6]) {
        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = freq(nota);
        osc.detune.value = detune;
        osc.connect(filtro);
        osc.start(tempo);
        osc.stop(tempo + duracao + 0.05);
      }
    }
  }

  lead(f, tempo, duracao, ganho) {
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(f, tempo);
    g.gain.setValueAtTime(0.0001, tempo);
    g.gain.exponentialRampToValueAtTime(ganho, tempo + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, tempo + duracao);
    osc.connect(g);
    g.connect(this.ganhoMusica);
    g.connect(this.eco);
    osc.start(tempo);
    osc.stop(tempo + duracao + 0.02);
  }

  /* ------------------------------------------------------------------ */
  /* Efeitos sonoros                                                     */
  /* ------------------------------------------------------------------ */

  /** Todo efeito passa por aqui: sem contexto rodando, nem monta o grafo. */
  get podeTocar() {
    return this.pronto && this.ctx.state === 'running';
  }

  sfxPulo() {
    if (!this.podeTocar) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(920, t + 0.14);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.3, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    osc.connect(g); g.connect(this.ganhoSfx);
    osc.start(t); osc.stop(t + 0.22);
  }

  sfxDeslize() {
    if (!this.podeTocar) return;
    const t = this.ctx.currentTime;
    const fonte = this.ctx.createBufferSource();
    fonte.buffer = this.ruido;
    const filtro = this.ctx.createBiquadFilter();
    filtro.type = 'bandpass';
    filtro.Q.value = 3.5;
    filtro.frequency.setValueAtTime(2200, t);
    filtro.frequency.exponentialRampToValueAtTime(380, t + 0.34);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.32, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.36);
    fonte.connect(filtro); filtro.connect(g); g.connect(this.ganhoSfx);
    fonte.start(t, Math.random() * 0.3, 0.4);
  }

  /**
   * Arpejo de 2 notas; sobe conforme o combo.
   *
   * Some coisas acontecem muito: uma fileira de poeira dispara isto oito
   * vezes seguidas, e com o ima pode ser uma rajada. Por isso o ganho e
   * baixo e cai ainda mais quando as coletas se atropelam - senao o
   * detalhe vira o som mais alto do jogo e cobre a musica.
   */
  sfxColeta(nivelCombo = 0) {
    if (!this.podeTocar) return;
    const t = this.ctx.currentTime;
    const desde = t - this.ultimaColeta;
    this.ultimaColeta = t;
    const atropelo = desde < 0.12 ? 0.55 : (desde < 0.25 ? 0.8 : 1);
    const pico = 0.115 * atropelo;

    const base = 74 + Math.min(nivelCombo, 4) * 2;
    [0, 4].forEach((intervalo, i) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      const inicio = t + i * 0.05;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq(base + intervalo), inicio);
      g.gain.setValueAtTime(0.0001, inicio);
      g.gain.exponentialRampToValueAtTime(pico, inicio + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.11);
      osc.connect(g); g.connect(this.ganhoSfx);
      osc.start(inicio); osc.stop(inicio + 0.13);
    });
  }

  /** Marco de combo: arpejo ascendente de 4 notas. */
  sfxCombo(nivel) {
    if (!this.podeTocar) return;
    const t = this.ctx.currentTime;
    const base = 69 + nivel * 3;
    [0, 4, 7, 12].forEach((intervalo, i) => {
      const inicio = t + i * 0.06;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq(base + intervalo), inicio);
      g.gain.setValueAtTime(0.0001, inicio);
      g.gain.exponentialRampToValueAtTime(0.16, inicio + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.2);
      osc.connect(g);
      g.connect(this.ganhoSfx);
      g.connect(this.eco);
      osc.start(inicio); osc.stop(inicio + 0.22);
    });
  }

  sfxPowerup() {
    if (!this.podeTocar) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < 6; i++) {
      const inicio = t + i * 0.038;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq(69 + i * 3), inicio);
      g.gain.setValueAtTime(0.0001, inicio);
      g.gain.exponentialRampToValueAtTime(0.15, inicio + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.16);
      osc.connect(g); g.connect(this.ganhoSfx); g.connect(this.eco);
      osc.start(inicio); osc.stop(inicio + 0.18);
    }
  }

  sfxDano() {
    if (!this.podeTocar) return;
    const t = this.ctx.currentTime;
    const fonte = this.ctx.createBufferSource();
    fonte.buffer = this.ruido;
    const filtro = this.ctx.createBiquadFilter();
    filtro.type = 'lowpass';
    filtro.frequency.setValueAtTime(3200, t);
    filtro.frequency.exponentialRampToValueAtTime(220, t + 0.5);
    const gr = this.ctx.createGain();
    gr.gain.setValueAtTime(0.5, t);
    gr.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    fonte.connect(filtro); filtro.connect(gr); gr.connect(this.ganhoSfx);
    fonte.start(t, 0, 0.6);

    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(34, t + 0.5);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.42, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    osc.connect(g); g.connect(this.ganhoSfx);
    osc.start(t); osc.stop(t + 0.62);
  }

  sfxQuaseAcidente() {
    if (!this.podeTocar) return;
    const t = this.ctx.currentTime;
    const fonte = this.ctx.createBufferSource();
    fonte.buffer = this.ruido;
    fonte.playbackRate.value = 0.8;
    const filtro = this.ctx.createBiquadFilter();
    filtro.type = 'bandpass';
    filtro.Q.value = 6;
    filtro.frequency.setValueAtTime(500, t);
    filtro.frequency.exponentialRampToValueAtTime(4200, t + 0.2);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.26, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    fonte.connect(filtro); filtro.connect(g); g.connect(this.ganhoSfx);
    fonte.start(t, Math.random() * 0.3, 0.32);
  }

  sfxUi(agudo = false) {
    if (!this.podeTocar) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(agudo ? 1400 : 880, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.1, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    osc.connect(g); g.connect(this.ganhoSfx);
    osc.start(t); osc.stop(t + 0.06);
  }

  /** Som grave e longo do buraco negro se aproximando. */
  sfxBuracoNegro() {
    if (!this.podeTocar) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const filtro = this.ctx.createBiquadFilter();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(48, t);
    osc.frequency.linearRampToValueAtTime(30, t + 2.4);
    filtro.type = 'lowpass';
    filtro.frequency.value = 220;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.3, t + 0.9);
    g.gain.linearRampToValueAtTime(0.0001, t + 2.6);
    osc.connect(filtro); filtro.connect(g); g.connect(this.ganhoSfx);
    osc.start(t); osc.stop(t + 2.7);
  }
}

export const audio = new MotorAudio();
