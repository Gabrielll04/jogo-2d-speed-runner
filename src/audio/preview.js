/* ==========================================================================
   PREVIA DA TRILHA

   Renderiza a trilha num OfflineAudioContext e devolve um WAV. Serve para
   ouvir a musica sem abrir o jogo e para conferir numericamente se ela esta
   estourando (clipping) ou baixa demais.

   Nada do jogo importa este arquivo, entao ele nao entra no bundle final.
   ========================================================================== */

import { MotorAudio, TRILHAS } from './audio.js';

const TAXA = 44100;

/** Renderiza `segundos` da trilha e devolve o AudioBuffer. */
export async function renderizarTrilha(nome, segundos) {
  const trilha = TRILHAS[nome];
  if (!trilha) throw new Error('trilha desconhecida: ' + nome);

  const offline = new OfflineAudioContext(1, Math.ceil(TAXA * segundos), TAXA);
  const motor = new MotorAudio();
  motor.iniciar(offline);
  motor.trilha = trilha;
  motor.mudo = false;
  motor.mestre.gain.value = 0.9;
  motor.ganhoMusica.gain.value = trilha.ganho;

  // Agenda a trilha inteira de uma vez: no contexto offline nao existe
  // relogio correndo, entao o lookahead do jogo nao se aplica aqui.
  const passo = motor.passo;
  let tempo = 0.05;
  let indice = 0;
  while (tempo < segundos - 0.2) {
    motor.tocarPasso(indice % 64, tempo, passo);
    tempo += passo;
    indice++;
  }
  return offline.startRendering();
}

/** Converte um AudioBuffer mono em WAV PCM 16 bits. */
export function paraWav(buffer) {
  const amostras = buffer.getChannelData(0);
  const bytes = new ArrayBuffer(44 + amostras.length * 2);
  const vista = new DataView(bytes);

  const texto = (deslocamento, valor) => {
    for (let i = 0; i < valor.length; i++) vista.setUint8(deslocamento + i, valor.charCodeAt(i));
  };

  texto(0, 'RIFF');
  vista.setUint32(4, 36 + amostras.length * 2, true);
  texto(8, 'WAVE');
  texto(12, 'fmt ');
  vista.setUint32(16, 16, true);
  vista.setUint16(20, 1, true);              // PCM
  vista.setUint16(22, 1, true);              // mono
  vista.setUint32(24, buffer.sampleRate, true);
  vista.setUint32(28, buffer.sampleRate * 2, true);
  vista.setUint16(32, 2, true);
  vista.setUint16(34, 16, true);
  texto(36, 'data');
  vista.setUint32(40, amostras.length * 2, true);

  for (let i = 0; i < amostras.length; i++) {
    const v = Math.max(-1, Math.min(1, amostras[i]));
    vista.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true);
  }
  return new Uint8Array(bytes);
}

/** Numeros para saber se a mixagem esta sa: pico, RMS e amostras estouradas. */
export function medir(buffer) {
  const a = buffer.getChannelData(0);
  let pico = 0;
  let soma = 0;
  let estouradas = 0;
  for (let i = 0; i < a.length; i++) {
    const v = Math.abs(a[i]);
    if (v > pico) pico = v;
    if (v >= 0.999) estouradas++;
    soma += a[i] * a[i];
  }
  return {
    pico: Number(pico.toFixed(3)),
    rms: Number(Math.sqrt(soma / a.length).toFixed(4)),
    estouradas,
    segundos: Number((a.length / buffer.sampleRate).toFixed(1))
  };
}
