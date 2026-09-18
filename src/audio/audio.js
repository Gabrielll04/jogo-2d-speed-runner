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

const BPM = 100;
const PASSO = 60 / BPM / 4;          // duracao de uma semicolcheia
const PASSOS_POR_COMPASSO = 16;
const LOOKAHEAD_MS = 25;
const JANELA = 0.12;                 // segundos agendados a frente

/** Progressao: Am - F - C - G (4 compassos). */
const PROGRESSAO = [
  { raiz: 45, triade: [57, 60, 64] },
  { raiz: 41, triade: [53, 57, 60] },
  { raiz: 48, triade: [52, 55, 60] },
  { raiz: 43, triade: [55, 59, 62] }
];

/** Pentatonica de la menor para o lead. */
const PENTA = [69, 72, 74, 76, 79, 81, 84];

const PADRAO_KICK = [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0];
const PADRAO_HAT  = [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0];
const PADRAO_BAIXO= [1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 0];

function freq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export class MotorAudio {
  constructor() {
    this.ctx = null;
    this.pronto = false;
    this.mudo = false;
    this.volume = 0.7;
    this.intensidade = 'off';        // 'off' | 'menu' | 'jogo'
    this.passoAtual = 0;
    this.proximoTempo = 0;
    this.timer = null;
    this.pulso = 0;                  // 0..1, cai a cada quadro (visual no beat)
    this.pulsoGrave = 0;
    this.ruido = null;
  }

  /* ------------------------------------------------------------------ */
  /* Inicializacao (so depois do primeiro gesto do jogador)              */
  /* ------------------------------------------------------------------ */
  iniciar() {
    if (this.pronto) return true;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return false;
    try {
      this.ctx = new Ctx({ latencyHint: 'interactive' });
    } catch {
      return false;
    }

    this.mestre = this.ctx.createGain();
    this.mestre.gain.value = this.mudo ? 0 : this.volume;
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
    this.eco.delayTime.value = 3 * PASSO;
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
    this.retomar();
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
    if (this.mestre) {
      this.mestre.gain.setTargetAtTime(this.mudo ? 0 : this.volume, this.ctx.currentTime, 0.02);
    }
  }

  setMudo(v) {
    this.mudo = !!v;
    if (this.mestre) {
      this.mestre.gain.setTargetAtTime(this.mudo ? 0 : this.volume, this.ctx.currentTime, 0.02);
    }
  }

  /** 'off' | 'menu' (calma) | 'jogo' (completa) */
  setIntensidade(nivel) {
    if (this.intensidade === nivel) return;
    this.intensidade = nivel;
    if (!this.pronto) return;
    const alvo = nivel === 'off' ? 0 : (nivel === 'menu' ? 0.34 : 0.52);
    this.ganhoMusica.gain.setTargetAtTime(alvo, this.ctx.currentTime, 0.4);
    if (nivel !== 'off') this.ligarSequenciador();
  }

  ligarSequenciador() {
    if (this.timer) return;
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
    while (this.proximoTempo < agora + JANELA) {
      this.tocarPasso(this.passoAtual, this.proximoTempo);
      this.proximoTempo += PASSO;
      this.passoAtual = (this.passoAtual + 1) % (PASSOS_POR_COMPASSO * 4);
    }
  }

  tocarPasso(passo, tempo) {
    const compasso = Math.floor(passo / PASSOS_POR_COMPASSO);
    const local = passo % PASSOS_POR_COMPASSO;
    const acorde = PROGRESSAO[compasso % PROGRESSAO.length];
    const completo = this.intensidade === 'jogo';

    // Pad etereo: entra no comeco de cada compasso.
    if (local === 0) this.pad(acorde.triade, tempo, PASSO * 16);

    // Kick
    if (PADRAO_KICK[local]) {
      this.kick(tempo, completo ? 1 : 0.6);
      this.agendarPulso(tempo);
    }

    // Hats (no menu, so metade deles)
    if (PADRAO_HAT[local] && (completo || local % 4 === 2)) {
      this.hat(tempo, completo ? 0.32 : 0.18);
    }

    // Baixo em arpejo
    if (PADRAO_BAIXO[local]) {
      const oitava = (local === 7 || local === 14) ? 12 : 0;
      const quinta = (local === 4 || local === 12) ? 7 : 0;
      this.baixo(freq(acorde.raiz + oitava + quinta), tempo, PASSO * 1.6,
        completo ? 0.42 : 0.24);
    }

    // Lead esparso so na intensidade de jogo.
    if (completo && (local === 2 || local === 10 || (local === 6 && compasso % 2 === 1))) {
      const nota = PENTA[(passo * 7 + compasso * 3) % PENTA.length];
      this.lead(freq(nota), tempo, PASSO * 2.2, 0.16);
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
  sfxPulo() {
    if (!this.pronto) return;
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
    if (!this.pronto) return;
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

  /** Arpejo de 2 notas; sobe conforme o combo. */
  sfxColeta(nivelCombo = 0) {
    if (!this.pronto) return;
    const t = this.ctx.currentTime;
    const base = 74 + Math.min(nivelCombo, 4) * 2;
    [0, 4].forEach((intervalo, i) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      const inicio = t + i * 0.055;
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq(base + intervalo), inicio);
      g.gain.setValueAtTime(0.0001, inicio);
      g.gain.exponentialRampToValueAtTime(0.17, inicio + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.13);
      osc.connect(g); g.connect(this.ganhoSfx);
      osc.start(inicio); osc.stop(inicio + 0.15);
    });
  }

  /** Marco de combo: arpejo ascendente de 4 notas. */
  sfxCombo(nivel) {
    if (!this.pronto) return;
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
    if (!this.pronto) return;
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
    if (!this.pronto) return;
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
    if (!this.pronto) return;
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
    if (!this.pronto) return;
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
    if (!this.pronto) return;
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
