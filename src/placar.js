/* ==========================================================================
   PLACAR (rota /placar no frontend)

   Quando o jogo e aberto em ".../placar" (ex.: pelo Vite em dev/preview ou
   por um servidor estatico sem a rota do server.js), cai aqui em vez de
   iniciar o jogo: o mesmo quadro de recordes que o server.js serve em
   /placar, com o tubo do jogo (scanlines + vinheta).

   SO PLACAR: nao carrega o mundo 3D, nao escuta teclado (Enter nao comeca
   nada) e nao tem link para o jogo - so mostra o ranking, bem grande.
   ========================================================================== */

export function ehRotaPlacar() {
  return /(^|\/)placar\/?$/.test(window.location.pathname);
}

export function iniciarPlacar() {
  document.title = 'PLACAR - STARDUST RUNNER';

  // Some com o palco do jogo (canvas + HUD + menus) e assume o body.
  document.body.classList.remove('sem-scanlines', 'movimento-reduzido');
  document.body.innerHTML =
    '<header class="placar-topo">' +
      '<h1 class="placar-titulo">STARDUST RUNNER<small>QUADRO DE RECORDES</small></h1>' +
      '<div class="contagem"><b id="total">0</b><br />CORRIDAS</div>' +
    '</header>' +
    '<div class="colunas">' +
      '<section class="painel">' +
        '<h2>MELHORES DA REDE</h2>' +
        '<ol id="top" class="top"></ol>' +
        '<div id="top-vazio" class="aviso">NINGUEM CORREU AINDA.<br />AGUARDANDO A PRIMEIRA CORRIDA.</div>' +
      '</section>' +
      '<section class="painel">' +
        '<h2>ULTIMAS</h2>' +
        '<ol id="feed" class="feed"></ol>' +
        '<div id="feed-vazio" class="aviso">AGUARDANDO A PRIMEIRA CORRIDA.</div>' +
      '</section>' +
    '</div>' +
    '<footer class="placar-rodape">' +
      '<span class="pisca">★</span><span>STARDUST RUNNER</span><span class="pisca">★</span>' +
    '</footer>';

  const css = document.createElement('style');
  css.textContent =
    'html,body{height:100%}' +
    'body{background:#02030a!important;color:#e8f4ff!important;font-family:ui-monospace,"Cascadia Mono",Consolas,monospace!important;' +
    'padding:2.6vh 2.4vw!important;overflow:hidden!important;display:flex!important;flex-direction:column!important;gap:2vh!important;' +
    'touch-action:auto!important;user-select:none!important}' +
    'body::before{content:"";position:fixed;inset:0;z-index:-2;opacity:.55;' +
    'background-image:radial-gradient(1px 1px at 20% 30%,#fff,transparent),radial-gradient(1px 1px at 70% 60%,#cfe4ff,transparent),' +
    'radial-gradient(1px 1px at 40% 80%,#fff,transparent),radial-gradient(2px 2px at 85% 20%,#9fd4ff,transparent),' +
    'radial-gradient(1px 1px at 10% 70%,#ffd8ec,transparent);' +
    'background-size:340px 340px,420px 420px,260px 260px,520px 520px,300px 300px}' +
    'body::after{content:"";position:fixed;left:-10vw;right:-10vw;bottom:-22vh;height:46vh;z-index:-2;pointer-events:none;' +
    'background:radial-gradient(60% 100% at 50% 100%,rgba(34,230,255,.16),rgba(255,47,135,.07) 45%,transparent 72%)}' +
    'html::before{content:"";position:fixed;inset:0;z-index:60;pointer-events:none;' +
    'background:repeating-linear-gradient(to bottom,rgba(0,0,0,.22) 0px,rgba(0,0,0,.22) 1px,' +
    'rgba(255,255,255,.02) 1px,rgba(255,255,255,.02) 3px);opacity:.5}' +
    'html::after{content:"";position:fixed;inset:0;z-index:61;pointer-events:none;' +
    'box-shadow:inset 0 0 18vmin rgba(2,3,10,.9)}' +
    '.placar-topo{display:flex;align-items:center;gap:1.6vw;flex-wrap:wrap}' +
    '.placar-titulo{font-size:clamp(26px,3.4vw,54px);letter-spacing:.12em;line-height:1;' +
    'text-shadow:2px 0 0 #ff2f87,-2px 0 0 #22e6ff;margin:0;padding:0}' +
    '.placar-titulo small{display:block;font-size:.3em;letter-spacing:.42em;color:#22e6ff;text-shadow:none;margin-top:.5em}' +
    '.contagem{margin-left:auto;text-align:right;font-size:clamp(11px,1.1vw,15px);letter-spacing:.2em;color:#6d84a8}' +
    '.contagem b{color:#e8f4ff;font-weight:400;font-size:1.5em}' +
    '.colunas{flex:1;min-height:0;display:grid;grid-template-columns:2.5fr 1fr;gap:1.6vw}' +
    '.painel{min-height:0;display:flex;flex-direction:column;border:1px solid rgba(34,230,255,.34);' +
    'background:linear-gradient(180deg,rgba(10,15,42,.9),rgba(2,3,10,.94));' +
    'clip-path:polygon(20px 0,100% 0,100% calc(100% - 20px),calc(100% - 20px) 100%,0 100%,0 20px);padding:1.8vh 1.4vw}' +
    '.painel h2{font-size:clamp(12px,1.2vw,18px);letter-spacing:.34em;color:#ffd23f;margin:0 0 1.2vh;flex:none}' +
    '.painel ol{list-style:none;flex:1;min-height:0;display:flex;flex-direction:column;gap:.4vh;margin:0;padding:0}' +
    '.top li{flex:1;min-height:0;display:grid;grid-template-columns:2.2em 1fr auto;gap:1vw;align-items:center;' +
    'padding:0 .6vw;font-size:clamp(14px,2.4vh,34px);border-left:.28em solid transparent}' +
    '.top .pos{color:#6d84a8;font-variant-numeric:tabular-nums}' +
    '.top .quem{min-width:0}' +
    '.top .nome{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;letter-spacing:.08em}' +
    '.top .detalhe{display:block;font-size:.5em;letter-spacing:.18em;color:#6d84a8;margin-top:.2em}' +
    '.top .pts{font-variant-numeric:tabular-nums;color:#ffd23f;letter-spacing:.04em}' +
    '.top li.p1{border-left-color:#ffd23f;background:linear-gradient(90deg,rgba(255,210,63,.14),transparent 70%);' +
    'font-size:clamp(18px,3.4vh,46px)}' +
    '.top li.p1 .pos,.top li.p1 .nome{color:#ffd23f}' +
    '.top li.p2{border-left-color:#22e6ff}' +
    '.top li.p2 .pos,.top li.p2 .nome{color:#22e6ff}' +
    '.top li.p3{border-left-color:#ff2f87}' +
    '.top li.p3 .pos,.top li.p3 .nome{color:#ff2f87}' +
    '.top li.novo{animation:placar-chega .9s steps(6,end)}' +
    '@keyframes placar-chega{0%{background:rgba(34,230,255,.4);transform:translateX(-.5em)}100%{background:transparent;transform:none}}' +
    '.feed li{display:grid;grid-template-columns:1fr auto;gap:.6em;align-items:baseline;' +
    'font-size:clamp(11px,1.6vh,20px);padding:.25vh 0;border-bottom:1px solid rgba(34,230,255,.08)}' +
    '.feed .nome{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;letter-spacing:.06em}' +
    '.feed .pts{color:#ffd23f;font-variant-numeric:tabular-nums}' +
    '.feed li:first-child .nome{color:#22e6ff}' +
    '.aviso{flex:1;display:flex;flex-direction:column;justify-content:center;gap:1.2vh;color:#6d84a8;' +
    'font-size:clamp(12px,1.5vh,20px);letter-spacing:.14em;line-height:1.7;text-align:center}' +
    '.placar-rodape{flex:none;display:flex;gap:1vw;align-items:center;justify-content:center;color:#6d84a8;' +
    'font-size:clamp(10px,1.05vw,15px);letter-spacing:.34em}' +
    '.placar-rodape .pisca{color:#ffd23f;animation:placar-piscar 1.2s steps(2,end) infinite}' +
    '@keyframes placar-piscar{0%,60%{opacity:1}61%,100%{opacity:.2}}';
  document.head.appendChild(css);

  const vistos = Object.create(null);
  let primeiraCarga = true;

  function texto(pai, classe, valor) {
    const s = document.createElement('span');
    s.className = classe;
    s.textContent = valor;
    pai.appendChild(s);
    return s;
  }

  function hora(ms) {
    const d = new Date(ms);
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  function mostrar(id, visivel) {
    document.getElementById(id).style.display = visivel ? '' : 'none';
  }

  function desenharTop(lista) {
    const ol = document.getElementById('top');
    mostrar('top-vazio', lista.length === 0);
    ol.style.display = lista.length === 0 ? 'none' : '';
    ol.textContent = '';
    lista.forEach((r, i) => {
      const li = document.createElement('li');
      li.className = 'p' + (i + 1);
      const chave = r.nickname + ':' + r.score;
      if (!primeiraCarga && !vistos[chave]) li.className += ' novo';
      vistos[chave] = true;

      texto(li, 'pos', String(i + 1).padStart(2, '0'));
      const quem = document.createElement('span');
      quem.className = 'quem';
      texto(quem, 'nome', r.nickname);
      texto(quem, 'detalhe', r.distance + ' METROS   COMBO x' + r.maxCombo + '   ' + r.stardust + ' POEIRAS');
      li.appendChild(quem);
      texto(li, 'pts', Number(r.score).toLocaleString('pt-BR'));
      ol.appendChild(li);
    });
  }

  function desenharFeed(lista) {
    const ol = document.getElementById('feed');
    mostrar('feed-vazio', lista.length === 0);
    ol.style.display = lista.length === 0 ? 'none' : '';
    ol.textContent = '';
    lista.forEach((r) => {
      const li = document.createElement('li');
      const esq = document.createElement('span');
      esq.className = 'nome';
      esq.textContent = r.nickname;
      li.appendChild(esq);
      const dir = document.createElement('span');
      dir.className = 'pts';
      dir.textContent = Number(r.score).toLocaleString('pt-BR') + '  ' + hora(r.at);
      li.appendChild(dir);
      ol.appendChild(li);
    });
  }

  function atualizar() {
    // Relativo de proposito: no dev o proxy do Vite encaminha /api para a 3000.
    // Sem selo de estado: se falhar, mantem o ultimo placar e tenta em 3 s.
    Promise.all([
      fetch('/api/top?limit=10', { cache: 'no-store' }).then((r) => r.json()),
      fetch('/api/recent?limit=14', { cache: 'no-store' }).then((r) => r.json()),
      fetch('/api/total', { cache: 'no-store' }).then((r) => r.json())
    ]).then((res) => {
      desenharTop(res[0] || []);
      desenharFeed(res[1] || []);
      document.getElementById('total').textContent = (res[2] || {}).total || 0;
      primeiraCarga = false;
    }).catch(() => { /* mantem o ultimo placar */ });
  }

  atualizar();
  setInterval(atualizar, 3000);

  // De proposito: nenhum listener de teclado aqui. Enter nao faz nada.
}
