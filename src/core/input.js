/* ==========================================================================
   INPUT - teclado + toque, traduzidos para ACOES nomeadas.
   O resto do jogo nunca olha codigo de tecla: so escuta acoes.
   ========================================================================== */

const MAPA = {
  ArrowLeft: 'esquerda',
  KeyA: 'esquerda',
  ArrowRight: 'direita',
  KeyD: 'direita',
  ArrowUp: 'pular',
  KeyW: 'pular',
  Space: 'pular',
  ArrowDown: 'deslizar',
  KeyS: 'deslizar',
  Enter: 'confirmar',
  NumpadEnter: 'confirmar',
  Escape: 'voltar',
  KeyP: 'pausa',
  KeyM: 'mudo',
  KeyC: 'config',
  KeyF: 'telaCheia',
  F3: 'fps'
};

/** Teclas que nunca devem rolar a pagina / ativar atalho do navegador. */
const BLOQUEAR = new Set([
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'Enter', 'F3'
]);

const ouvintes = new Set();

/** Ultimo instante (ms, performance.now) em que houve QUALQUER input humano. */
let ultimoInput = 0;
/** Quando true, o teclado e ignorado (ex.: digitando o apelido). */
let capturaTexto = false;
/** True assim que o jogador interage pela primeira vez (libera o AudioContext). */
let houveGesto = false;
const aposPrimeiroGesto = [];

function emitir(acao, origem) {
  ultimoInput = performance.now();
  if (!houveGesto) {
    houveGesto = true;
    for (const fn of aposPrimeiroGesto) {
      try { fn(); } catch { /* ignora */ }
    }
    aposPrimeiroGesto.length = 0;
  }
  for (const fn of ouvintes) fn(acao, origem);
}

/* --------------------------- TECLADO --------------------------- */
window.addEventListener('keydown', (ev) => {
  if (ev.code === 'F3') ev.preventDefault();
  if (capturaTexto) {
    // Enter/Escape ainda passam: sao a saida da tela de apelido.
    if (ev.code === 'Enter' || ev.code === 'NumpadEnter') { emitir('confirmar', 'teclado'); }
    else if (ev.code === 'Escape') { emitir('voltar', 'teclado'); }
    else if (ev.code === 'Tab') { ev.preventDefault(); emitir('proximaSugestao', 'teclado'); }
    else { ultimoInput = performance.now(); }
    return;
  }
  const acao = MAPA[ev.code];
  if (BLOQUEAR.has(ev.code)) ev.preventDefault();
  if (!acao) { ultimoInput = performance.now(); return; }
  if (ev.repeat && (acao === 'pular' || acao === 'confirmar')) return;
  emitir(acao, 'teclado');
}, { passive: false });

/* --------------------------- TOQUE --------------------------- */
const LIMIAR = 26;          // pixels ate virar swipe
let toqueX = 0, toqueY = 0, toqueT = 0, toqueValido = false, jaDisparou = false;

function inicioToque(x, y) {
  toqueX = x; toqueY = y; toqueT = performance.now();
  toqueValido = true; jaDisparou = false;
  ultimoInput = toqueT;
}

function moveToque(x, y) {
  if (!toqueValido || jaDisparou) return;
  const dx = x - toqueX;
  const dy = y - toqueY;
  if (Math.abs(dx) < LIMIAR && Math.abs(dy) < LIMIAR) return;
  jaDisparou = true;
  if (Math.abs(dx) > Math.abs(dy)) emitir(dx > 0 ? 'direita' : 'esquerda', 'toque');
  else emitir(dy > 0 ? 'deslizar' : 'pular', 'toque');
}

function fimToque() {
  if (toqueValido && !jaDisparou && performance.now() - toqueT < 450) {
    emitir('confirmar', 'toque');
  }
  toqueValido = false;
}

window.addEventListener('touchstart', (ev) => {
  const t = ev.changedTouches[0];
  inicioToque(t.clientX, t.clientY);
}, { passive: true });

window.addEventListener('touchmove', (ev) => {
  const t = ev.changedTouches[0];
  moveToque(t.clientX, t.clientY);
}, { passive: true });

window.addEventListener('touchend', fimToque, { passive: true });
window.addEventListener('touchcancel', () => { toqueValido = false; }, { passive: true });

// Mouse tambem serve (util para testar e para telas touch que reportam mouse).
window.addEventListener('pointerdown', (ev) => {
  if (ev.pointerType === 'touch') return;
  if (ev.target && ev.target.tagName === 'INPUT') { ultimoInput = performance.now(); return; }
  if (ev.target && ev.target.classList && ev.target.classList.contains('sugestao')) {
    ultimoInput = performance.now();
    return;
  }
  inicioToque(ev.clientX, ev.clientY);
});
window.addEventListener('pointermove', (ev) => {
  if (ev.pointerType === 'touch') return;
  if (ev.buttons === 0) return;
  moveToque(ev.clientX, ev.clientY);
});
window.addEventListener('pointerup', (ev) => {
  if (ev.pointerType === 'touch') return;
  fimToque();
});

window.addEventListener('contextmenu', (ev) => ev.preventDefault());

/* --------------------------- API --------------------------- */
export const input = {
  /** Registra um ouvinte de acoes; devolve funcao para remover. */
  aoAgir(fn) {
    ouvintes.add(fn);
    return () => ouvintes.delete(fn);
  },
  /** Segundos desde o ultimo input humano. */
  ociosoSegundos() {
    return (performance.now() - ultimoInput) / 1000;
  },
  /** Marca atividade manualmente (ex.: clique num botao de sugestao). */
  marcarAtividade() {
    ultimoInput = performance.now();
  },
  /** Liga/desliga o modo "digitando texto". */
  setCapturaTexto(valor) {
    capturaTexto = !!valor;
  },
  /** Executa fn no primeiro gesto do jogador (exigencia do AudioContext). */
  noPrimeiroGesto(fn) {
    if (houveGesto) fn();
    else aposPrimeiroGesto.push(fn);
  },
  get houveGesto() {
    return houveGesto;
  }
};

/** Alterna tela cheia (com os prefixos que ainda aparecem no Edge antigo). */
export function alternarTelaCheia() {
  const el = document.documentElement;
  const estaCheia = document.fullscreenElement || document.webkitFullscreenElement;
  try {
    if (estaCheia) {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    } else {
      (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
    }
  } catch {
    /* alguns navegadores negam sem gesto: ignora */
  }
}
