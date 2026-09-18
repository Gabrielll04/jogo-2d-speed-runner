/* ==========================================================================
   HUD - vive no DOM, em resolucao nativa (texto nitido sobre o 3D pixelado).
   Escreve no DOM so quando o valor realmente muda: nada de innerHTML por
   quadro, que e o jeito classico de perder 10 fps a toa.
   ========================================================================== */

import { PONTOS, POWERUPS } from '../config.js';

const el = (id) => document.getElementById(id);

export class Hud {
  constructor() {
    this.raiz = el('hud');
    this.elScore = el('hud-score');
    this.elDist = el('hud-dist');
    this.elMult = el('hud-mult');
    this.elBarra = el('hud-combo-barra').firstElementChild;
    this.elPowerups = el('hud-powerups');
    this.elAvisos = el('hud-avisos');
    this.elFlash = el('hud-flash');

    this.exibido = 0;
    this.ultimoTextoScore = '';
    this.ultimoTextoDist = '';
    this.ultimoMult = -1;
    this.assinaturaPowerups = '';
  }

  mostrar(visivel) {
    this.raiz.classList.toggle('oculto', !visivel);
    if (!visivel) {
      this.elAvisos.innerHTML = '';
      this.elPowerups.innerHTML = '';
      this.assinaturaPowerups = '';
    }
  }

  reiniciar() {
    this.exibido = 0;
    this.ultimoMult = -1;
    this.assinaturaPowerups = '';
    this.elAvisos.innerHTML = '';
    this.elPowerups.innerHTML = '';
    this.elBarra.style.width = '0%';
  }

  atualizar(dt, pontuacao, listaPowerups) {
    /* --- score sobe contando, nunca pula --- */
    const alvo = pontuacao.pontos;
    if (Math.abs(alvo - this.exibido) < 1) this.exibido = alvo;
    else this.exibido += (alvo - this.exibido) * Math.min(1, dt * 9);

    const textoScore = Math.floor(this.exibido).toLocaleString('pt-BR');
    if (textoScore !== this.ultimoTextoScore) {
      this.elScore.textContent = textoScore;
      this.ultimoTextoScore = textoScore;
    }

    const textoDist = Math.floor(pontuacao.distancia) + ' M';
    if (textoDist !== this.ultimoTextoDist) {
      this.elDist.textContent = textoDist;
      this.ultimoTextoDist = textoDist;
    }

    /* --- multiplicador --- */
    const mult = pontuacao.multiplicador;
    if (mult !== this.ultimoMult) {
      this.elMult.textContent = 'x' + mult;
      this.elMult.classList.toggle('ativo', mult > 1);
      if (mult > this.ultimoMult && this.ultimoMult >= 0) {
        this.elMult.classList.remove('sobe');
        void this.elMult.offsetWidth;
        this.elMult.classList.add('sobe');
      }
      this.ultimoMult = mult;
    }
    this.elBarra.style.width = (pontuacao.comboRestante * 100).toFixed(0) + '%';

    /* --- power-ups --- */
    const assinatura = listaPowerups
      .map((p) => p.chave + Math.ceil(p.restante * 4))
      .join(',');
    if (assinatura !== this.assinaturaPowerups) {
      this.assinaturaPowerups = assinatura;
      this.desenharPowerups(listaPowerups);
    }
  }

  desenharPowerups(lista) {
    if (lista.length === 0) {
      this.elPowerups.innerHTML = '';
      return;
    }
    let html = '';
    for (const p of lista) {
      const info = POWERUPS[p.chave];
      const proporcao = p.infinito ? 1 : Math.max(0, p.restante / p.total);
      html +=
        '<div class="pu ' + info.classe + '">' +
          '<span>' + info.rotulo + '</span>' +
          '<span class="pu-tempo"><i style="width:' + (proporcao * 100).toFixed(0) + '%"></i></span>' +
        '</div>';
    }
    this.elPowerups.innerHTML = html;
  }

  /** Texto flutuante no centro da tela. */
  aviso(texto, cor) {
    const div = document.createElement('div');
    div.className = 'aviso' + (cor ? ' ' + cor : '');
    div.textContent = texto;
    this.elAvisos.appendChild(div);
    // Segura no maximo 3 avisos ao mesmo tempo.
    while (this.elAvisos.children.length > 3) {
      this.elAvisos.removeChild(this.elAvisos.firstChild);
    }
    setTimeout(() => {
      if (div.parentNode) div.parentNode.removeChild(div);
    }, 950);
  }

  flash() {
    this.elFlash.classList.remove('dispara');
    void this.elFlash.offsetWidth;
    this.elFlash.classList.add('dispara');
  }

  bateScore() {
    this.elScore.classList.remove('bate');
    void this.elScore.offsetWidth;
    this.elScore.classList.add('bate');
  }

  get degrausCombo() {
    return PONTOS.degrausCombo;
  }
}
