/* ==========================================================================
   RENDERER - o coracao do visual pixelado.

   Ideia: o WebGL desenha num canvas MINUSCULO (ex. 320x180) e o CSS estica
   esse canvas para a janela inteira com image-rendering: pixelated.
   A escala e sempre um NUMERO INTEIRO, entao cada pixel interno vira um
   quadrado perfeito - nada de pixel esticado. O que sobra vira letterbox
   (barra preta), preservando 16:9.

   Isso e, ao mesmo tempo, a estetica e a principal ferramenta de
   performance: uma GPU integrada preenche 320x180 sem suar.
   ========================================================================== */

import * as THREE from 'three';
import { RESOLUCOES } from '../config.js';

const palco = document.getElementById('palco');
const canvas = document.getElementById('cena');

export class RenderizadorPixel {
  constructor() {
    this.indiceResolucao = 1;
    this.renderer = null;
    this.suportado = false;
    this.webgl2 = false;
    this.aoPerderContexto = null;
    this.aoRecuperarContexto = null;
  }

  /** Cria o renderer. Devolve false se o navegador nao tem WebGL. */
  iniciar(indiceResolucao) {
    this.indiceResolucao = indiceResolucao;
    try {
      const contexto = canvas.getContext('webgl2', { antialias: false, alpha: false })
        || canvas.getContext('webgl', { antialias: false, alpha: false });
      if (!contexto) return false;
      this.webgl2 = (typeof WebGL2RenderingContext !== 'undefined')
        && (contexto instanceof WebGL2RenderingContext);

      this.renderer = new THREE.WebGLRenderer({
        canvas,
        context: contexto,
        antialias: false,     // os pixels visiveis SAO a estetica
        alpha: false,
        depth: true,
        stencil: false,
        powerPreference: 'high-performance',
        failIfMajorPerformanceCaveat: false
      });
      this.renderer.setPixelRatio(1);          // travado: nada de retina aqui
      this.renderer.autoClear = true;
      this.renderer.sortObjects = true;
      if ('outputColorSpace' in this.renderer) {
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      }
      this.renderer.setClearColor(0x02030a, 1);
      this.suportado = true;
    } catch {
      this.suportado = false;
      return false;
    }

    canvas.addEventListener('webglcontextlost', (ev) => {
      ev.preventDefault();
      if (this.aoPerderContexto) this.aoPerderContexto();
    }, false);

    canvas.addEventListener('webglcontextrestored', () => {
      this.aplicarResolucao();
      if (this.aoRecuperarContexto) this.aoRecuperarContexto();
    }, false);

    this.aplicarResolucao();
    window.addEventListener('resize', () => this.ajustarLayout());
    window.addEventListener('orientationchange', () => {
      setTimeout(() => this.ajustarLayout(), 120);
    });
    return true;
  }

  get resolucao() {
    return RESOLUCOES[this.indiceResolucao];
  }

  /** Troca o degrau de resolucao interna (0 = melhor, 2 = pior). */
  setResolucao(indice) {
    const novo = Math.max(0, Math.min(RESOLUCOES.length - 1, indice));
    if (novo === this.indiceResolucao) return false;
    this.indiceResolucao = novo;
    this.aplicarResolucao();
    return true;
  }

  aplicarResolucao() {
    if (!this.renderer) return;
    const { largura, altura } = this.resolucao;
    // updateStyle = false: o CSS e quem manda no tamanho aparente.
    this.renderer.setSize(largura, altura, false);
    this.ajustarLayout();
  }

  /**
   * Posiciona o palco (canvas + HUD) centralizado, com escala inteira.
   * O HUD vive dentro do palco, entao ele nunca invade as barras pretas.
   */
  ajustarLayout() {
    const { largura, altura } = this.resolucao;
    const jw = window.innerWidth;
    const jh = window.innerHeight;
    const bruto = Math.min(jw / largura, jh / altura);
    // Escala inteira sempre que couber pelo menos 1x; abaixo disso (janela
    // muito pequena) cai para fracionaria so pra nao sumir da tela.
    const escala = bruto >= 1 ? Math.floor(bruto) : bruto;
    const w = Math.round(largura * escala);
    const h = Math.round(altura * escala);

    palco.style.width = w + 'px';
    palco.style.height = h + 'px';
    palco.style.left = Math.round((jw - w) / 2) + 'px';
    palco.style.top = Math.round((jh - h) / 2) + 'px';

    // Unidade base do HUD: 1% da altura do palco. Assim a tipografia
    // acompanha o tamanho da janela sem ficar minuscula no projetor.
    document.documentElement.style.setProperty('--u', (h / 100).toFixed(3) + 'px');
  }

  render(cena, camera) {
    this.renderer.render(cena, camera);
  }

  /** Numeros para o contador de F3. */
  estatisticas() {
    const info = this.renderer.info;
    return {
      chamadas: info.render.calls,
      triangulos: info.render.triangles,
      texturas: info.memory.textures,
      geometrias: info.memory.geometries
    };
  }

  dispose() {
    if (this.renderer) this.renderer.dispose();
  }
}

export { canvas, palco };
