/* ==========================================================================
   LOGO - desenhado em SVG na hora, pixel a pixel.
   A estrela e uma astroide (|x|^n + |y|^n <= 1) rasterizada numa grade
   impar, entao ela nasce simetrica e com as pontas afiadas mesmo pequena.
   ========================================================================== */

import { NOME_JOGO } from '../config.js';

const GRADE = 17;

function estrelaSvg() {
  const celula = 100 / GRADE;
  const partes = [];
  const meio = (GRADE - 1) / 2;

  for (let y = 0; y < GRADE; y++) {
    for (let x = 0; x < GRADE; x++) {
      const nx = (x - meio) / meio;
      const ny = (y - meio) / meio;
      const d = Math.pow(Math.abs(nx), 0.5) + Math.pow(Math.abs(ny), 0.5);
      if (d > 1.02) continue;

      let cor;
      if (d < 0.42) cor = '#ffffff';
      else if (d < 0.7) cor = '#ffd23f';
      else cor = '#ff9a1f';

      partes.push(
        '<rect x="' + (x * celula).toFixed(2) + '" y="' + (y * celula).toFixed(2) +
        '" width="' + (celula + 0.2).toFixed(2) + '" height="' + (celula + 0.2).toFixed(2) +
        '" fill="' + cor + '"/>'
      );
    }
  }

  // Quatro faiscas soltas ao redor: dao vida sem custar nada.
  const faisca = (cx, cy, tam, cor, opacidade) =>
    '<rect x="' + cx + '" y="' + cy + '" width="' + tam + '" height="' + tam +
    '" fill="' + cor + '" opacity="' + opacidade + '"/>';

  partes.push(faisca(4, 12, celula * 0.8, '#22e6ff', 0.9));
  partes.push(faisca(88, 20, celula * 0.7, '#22e6ff', 0.75));
  partes.push(faisca(12, 84, celula * 0.7, '#ff2f87', 0.8));
  partes.push(faisca(82, 78, celula * 0.9, '#ffd23f', 0.7));

  return '<svg class="logo-estrela" viewBox="0 0 100 100" aria-hidden="true">' +
    partes.join('') + '</svg>';
}

/** Monta o logo dentro de um elemento. */
export function montarLogo(destino) {
  const palavras = NOME_JOGO.split(' ');
  const linha1 = palavras[0] || NOME_JOGO;
  const linha2 = palavras.slice(1).join(' ');

  destino.innerHTML =
    '<div class="logo">' +
      estrelaSvg() +
      '<div class="logo-texto">' +
        '<span class="logo-linha1">' + linha1 + '</span>' +
        (linha2 ? '<span class="logo-linha2">' + linha2 + '</span>' : '') +
        '<div class="logo-barra"></div>' +
      '</div>' +
    '</div>';
}
