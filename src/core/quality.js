/* ==========================================================================
   GOVERNADOR DE QUALIDADE
   Mede FPS em janelas de 1 segundo. Se o PC nao aguenta, derruba um degrau
   de resolucao interna e corta as particulas pela metade. Nunca sobe
   sozinho de volta (evita ficar oscilando na frente da turma).
   ========================================================================== */

import { GOVERNADOR, RESOLUCOES, PARTICULAS_POR_QUALIDADE } from '../config.js';

const elFps = document.getElementById('fps');
const elAviso = document.getElementById('aviso-qualidade');

export class Governador {
  constructor(renderizador) {
    this.renderizador = renderizador;
    this.quadros = 0;
    this.acumulado = 0;
    this.fps = 60;
    this.segundosAbaixoAmarelo = 0;
    this.segundosAbaixoVermelho = 0;
    this.mostrarFps = false;
    this.escalaParticulas = PARTICULAS_POR_QUALIDADE[renderizador.indiceResolucao];
    this.aoDegradar = null;
    this.manual = false;       // se o jogador escolheu a qualidade na mao
    this.tempoAviso = 0;
  }

  /** Chamado uma vez por quadro com o delta real (segundos). */
  atualizar(dt) {
    this.quadros++;
    this.acumulado += dt;

    if (this.acumulado >= 1) {
      this.fps = this.quadros / this.acumulado;
      this.quadros = 0;
      this.acumulado = 0;

      if (!this.manual) this.avaliar();
      if (this.mostrarFps) this.desenharContador();
    }

    if (this.tempoAviso > 0) {
      this.tempoAviso -= dt;
      if (this.tempoAviso <= 0) elAviso.classList.remove('visivel');
    }
  }

  avaliar() {
    const indice = this.renderizador.indiceResolucao;
    const ultimo = RESOLUCOES.length - 1;

    if (this.fps < GOVERNADOR.limiteVermelho) {
      this.segundosAbaixoVermelho += 1;
      this.segundosAbaixoAmarelo += 1;
    } else if (this.fps < GOVERNADOR.limiteAmarelo) {
      this.segundosAbaixoVermelho = 0;
      this.segundosAbaixoAmarelo += 1;
    } else {
      this.segundosAbaixoVermelho = 0;
      this.segundosAbaixoAmarelo = 0;
      return;
    }

    if (indice >= ultimo) return;   // ja estamos no degrau mais baixo

    const quedaForte = this.segundosAbaixoVermelho >= GOVERNADOR.tempoVermelho;
    const quedaLeve = this.segundosAbaixoAmarelo >= GOVERNADOR.tempoAmarelo;
    if (!quedaForte && !quedaLeve) return;

    const passos = quedaForte ? 2 : 1;
    const destino = Math.min(ultimo, indice + passos);
    if (this.renderizador.setResolucao(destino)) {
      this.escalaParticulas = PARTICULAS_POR_QUALIDADE[destino];
      this.segundosAbaixoAmarelo = 0;
      this.segundosAbaixoVermelho = 0;
      if (this.aoDegradar) this.aoDegradar(destino, this.escalaParticulas);
      this.avisar('QUALIDADE AJUSTADA: ' + RESOLUCOES[destino].rotulo);
    }
  }

  /** Aplica um degrau escolhido pelo jogador nas configuracoes. */
  aplicarManual(indice) {
    this.manual = true;
    if (this.renderizador.setResolucao(indice)) {
      this.escalaParticulas = PARTICULAS_POR_QUALIDADE[indice];
      if (this.aoDegradar) this.aoDegradar(indice, this.escalaParticulas);
    } else {
      this.escalaParticulas = PARTICULAS_POR_QUALIDADE[indice];
    }
    this.segundosAbaixoAmarelo = 0;
    this.segundosAbaixoVermelho = 0;
  }

  avisar(texto) {
    elAviso.textContent = texto;
    elAviso.classList.add('visivel');
    this.tempoAviso = 3.2;
  }

  alternarContador() {
    this.mostrarFps = !this.mostrarFps;
    elFps.classList.toggle('oculto', !this.mostrarFps);
    if (this.mostrarFps) this.desenharContador();
  }

  desenharContador() {
    const e = this.renderizador.estatisticas();
    const r = this.renderizador.resolucao;
    elFps.textContent =
      this.fps.toFixed(0) + ' FPS  ' + r.largura + 'x' + r.altura + '\n' +
      'draw ' + e.chamadas + '  tri ' + (e.triangulos / 1000).toFixed(1) + 'k\n' +
      'tex ' + e.texturas + '  geo ' + e.geometrias + '  ' +
      (this.renderizador.webgl2 ? 'GL2' : 'GL1');
  }
}
