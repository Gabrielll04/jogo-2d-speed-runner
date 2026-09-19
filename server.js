/* ==========================================================================
   STARDUST RUNNER - servidor de evento

   Node puro (http, fs, path, os, url). ZERO dependencia de npm - da pra levar
   num pendrive e rodar em qualquer maquina com Node instalado, sem internet.

     node server.js            -> porta 3000
     PORT=8080 node server.js  -> outra porta

   Modulo ES (usa import): leve junto o package.json - sao tres itens no
   pendrive (dist/, server.js, package.json) e nenhum npm install.

   O que ele faz:
     GET  /              -> serve o dist/ (o jogo)
     POST /api/score     -> registra { nickname, score, distance, maxCombo, stardust }
     GET  /api/top       -> melhores pontuacoes (?limit=10)
     GET  /api/recent    -> ultimas pontuacoes registradas (?limit=12)
     GET  /placar        -> pagina de ranking para projetar no telao
   ========================================================================== */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const PORTA = Number(process.env.PORT) || 3000;
// Equivalente ao __dirname, que nao existe em modulo ES.
const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const PASTA_DIST = path.join(RAIZ, 'dist');
const ARQUIVO_SCORES = path.join(RAIZ, 'scores.json');
const LIMITE_CORPO = 4 * 1024;        // 4 KB ja e muito para um placar
const MAX_REGISTROS = 5000;

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
};

/* ==========================================================================
   Persistencia
   ========================================================================== */
let registros = [];

function carregar() {
  try {
    if (!fs.existsSync(ARQUIVO_SCORES)) return;
    const cru = fs.readFileSync(ARQUIVO_SCORES, 'utf8');
    const dados = JSON.parse(cru);
    if (Array.isArray(dados)) registros = dados.filter(valido);
  } catch (erro) {
    console.error('[placar] scores.json ilegivel, comecando do zero:', erro.message);
    try {
      fs.renameSync(ARQUIVO_SCORES, ARQUIVO_SCORES + '.quebrado-' + Date.now());
    } catch { /* segue o jogo */ }
    registros = [];
  }
}

let gravacaoPendente = null;

function salvar() {
  // Agrupa gravacoes: numa fila de alunos jogando, isso evita reescrever o
  // arquivo inteiro a cada segundo.
  if (gravacaoPendente) return;
  gravacaoPendente = setTimeout(() => {
    gravacaoPendente = null;
    const temporario = ARQUIVO_SCORES + '.tmp';
    try {
      fs.writeFileSync(temporario, JSON.stringify(registros, null, 1), 'utf8');
      fs.renameSync(temporario, ARQUIVO_SCORES);
    } catch (erro) {
      console.error('[placar] falha ao gravar scores.json:', erro.message);
    }
  }, 400);
}

function valido(r) {
  return r && typeof r.nickname === 'string' && Number.isFinite(r.score);
}

/** Remove caracteres de controle e sinais de marcacao do apelido. */
function limparTexto(texto, tamanho) {
  const cru = String(texto === undefined || texto === null ? '' : texto);
  let saida = '';
  for (const caractere of cru) {
    const codigo = caractere.codePointAt(0);
    if (codigo < 32 || codigo === 127) continue;
    if (caractere === '<' || caractere === '>' || caractere === '&') continue;
    saida += caractere;
  }
  return saida.trim().slice(0, tamanho);
}

function inteiroSeguro(valor, minimo, maximo) {
  const n = Math.round(Number(valor));
  if (!Number.isFinite(n)) return minimo;
  return Math.max(minimo, Math.min(maximo, n));
}

/* ==========================================================================
   Respostas
   ========================================================================== */
function responderJson(res, codigo, dados) {
  const corpo = JSON.stringify(dados);
  res.writeHead(codigo, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(corpo),
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(corpo);
}

function responderTexto(res, codigo, texto, tipo) {
  res.writeHead(codigo, {
    'Content-Type': tipo || 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(texto),
    'Cache-Control': 'no-store'
  });
  res.end(texto);
}

/* ==========================================================================
   Estatico
   ========================================================================== */
function servirEstatico(req, res, caminhoUrl) {
  let relativo;
  try {
    relativo = decodeURIComponent(caminhoUrl);
  } catch {
    responderTexto(res, 400, 'Caminho invalido.');
    return;
  }
  if (relativo === '/' || relativo === '') relativo = '/index.html';

  // Normaliza e garante que ninguem escape do dist/ com ../../
  const destino = path.normalize(path.join(PASTA_DIST, relativo));
  if (destino !== PASTA_DIST && !destino.startsWith(PASTA_DIST + path.sep)) {
    responderTexto(res, 403, 'Acesso negado.');
    return;
  }

  fs.stat(destino, (erro, info) => {
    if (erro || !info.isFile()) {
      if (!fs.existsSync(PASTA_DIST)) {
        responderTexto(res, 500,
          'A pasta dist/ nao existe.\n\n' +
          'Rode "npm run build" e copie a pasta dist/ para o lado deste server.js.');
        return;
      }
      responderTexto(res, 404, 'Nao encontrado: ' + relativo);
      return;
    }

    const tipo = TIPOS[path.extname(destino).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': tipo,
      'Content-Length': info.size,
      // O jogo e local: cache curto evita aluno pegando build velha.
      'Cache-Control': 'no-cache'
    });
    fs.createReadStream(destino).pipe(res);
  });
}

/* ==========================================================================
   API
   ========================================================================== */
function lerCorpo(req, aoTerminar) {
  let bruto = '';
  let excedeu = false;
  req.on('data', (parte) => {
    if (excedeu) return;
    bruto += parte;
    if (bruto.length > LIMITE_CORPO) {
      excedeu = true;
      aoTerminar(new Error('corpo grande demais'), null);
      req.destroy();
    }
  });
  req.on('end', () => {
    if (excedeu) return;
    try {
      aoTerminar(null, bruto ? JSON.parse(bruto) : {});
    } catch (erro) {
      aoTerminar(erro, null);
    }
  });
  req.on('error', (erro) => {
    if (!excedeu) aoTerminar(erro, null);
  });
}

function registrarScore(req, res) {
  lerCorpo(req, (erro, dados) => {
    if (erro || !dados) {
      responderJson(res, 400, { ok: false, erro: 'json invalido' });
      return;
    }

    const registro = {
      nickname: limparTexto(dados.nickname, 12).toUpperCase() || 'ANONIMO',
      score: inteiroSeguro(dados.score, 0, 99999999),
      distance: inteiroSeguro(dados.distance, 0, 9999999),
      maxCombo: inteiroSeguro(dados.maxCombo, 1, 999),
      stardust: inteiroSeguro(dados.stardust, 0, 999999),
      at: Date.now()
    };

    registros.push(registro);
    if (registros.length > MAX_REGISTROS) {
      registros = registros.slice(-MAX_REGISTROS);
    }
    salvar();

    const posicao = melhores(99999).findIndex(
      (r) => r.at === registro.at && r.nickname === registro.nickname
    ) + 1;

    console.log(
      '[placar] ' + registro.nickname.padEnd(12) +
      String(registro.score).padStart(8) + ' pts  ' +
      String(registro.distance).padStart(6) + ' m  posicao ' + posicao
    );

    responderJson(res, 200, { ok: true, posicao, total: registros.length });
  });
}

function melhores(limite) {
  // Um registro por apelido: o telao mostra pessoas, nao tentativas.
  const porApelido = new Map();
  for (const r of registros) {
    const atual = porApelido.get(r.nickname);
    if (!atual || r.score > atual.score) porApelido.set(r.nickname, r);
  }
  return [...porApelido.values()]
    .sort((a, b) => b.score - a.score || a.at - b.at)
    .slice(0, limite);
}

function ultimos(limite) {
  return registros.slice(-limite).reverse();
}

/* ==========================================================================
   Pagina do placar (mesmo tema do jogo)

   Esta tela e SO PLACAR: vai no projetor, ninguem joga nela. Por isso ela
   nao carrega o jogo, nao tem link para ele e nao responde a tecla nenhuma -
   so mostra o ranking, bem grande, para ser lido do fundo da sala.

   Visual de quadro de recordes de fliperama, com o mesmo tubo do jogo
   (scanlines + vinheta): sem selo de acompanhamento, sem endereco de onde
   jogar e sem contador de atualizado. Se a rede falhar, a pagina mantem o
   ultimo placar desenhado e tenta de novo em 3 s.
   ========================================================================== */
const PAGINA_PLACAR = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>PLACAR - STARDUST RUNNER</title>
<style>
  :root {
    --espaco-0:#02030a; --ciano:#22e6ff; --magenta:#ff2f87;
    --dourado:#ffd23f; --texto:#e8f4ff; --fraco:#6d84a8;
    --fonte: ui-monospace, "Cascadia Mono", Consolas, monospace;
  }
  * { box-sizing:border-box; margin:0; padding:0; }
  html, body { height:100%; }
  body {
    background:var(--espaco-0); color:var(--texto); font-family:var(--fonte);
    padding:2.6vh 2.4vw; overflow:hidden;
    display:flex; flex-direction:column; gap:2vh;
  }
  /* Campo de estrelas em CSS puro: gradientes repetidos, custo zero. */
  body::before {
    content:""; position:fixed; inset:0; z-index:-2; opacity:.55;
    background-image:
      radial-gradient(1px 1px at 20% 30%, #fff, transparent),
      radial-gradient(1px 1px at 70% 60%, #cfe4ff, transparent),
      radial-gradient(1px 1px at 40% 80%, #fff, transparent),
      radial-gradient(2px 2px at 85% 20%, #9fd4ff, transparent),
      radial-gradient(1px 1px at 10% 70%, #ffd8ec, transparent);
    background-size: 340px 340px, 420px 420px, 260px 260px, 520px 520px, 300px 300px;
  }
  /* Brilho de horizonte, o mesmo motivo do jogo. */
  body::after {
    content:""; position:fixed; left:-10vw; right:-10vw; bottom:-22vh; height:46vh;
    z-index:-2; pointer-events:none;
    background:radial-gradient(60% 100% at 50% 100%,
      rgba(34,230,255,.16), rgba(255,47,135,.07) 45%, transparent 72%);
  }

  /* ---------- cabecalho ---------- */
  header { display:flex; align-items:center; gap:1.6vw; flex-wrap:wrap; }
  h1 {
    font-size:clamp(26px, 3.4vw, 54px); letter-spacing:.12em; line-height:1;
    text-shadow: 2px 0 0 var(--magenta), -2px 0 0 var(--ciano);
  }
  h1 small {
    display:block; font-size:.3em; letter-spacing:.42em; color:var(--ciano);
    text-shadow:none; margin-top:.5em;
  }
  /* Scanlines + vinheta: o mesmo tubo do jogo, por cima de tudo. */
  html::before {
    content:""; position:fixed; inset:0; z-index:60; pointer-events:none;
    background:repeating-linear-gradient(
      to bottom,
      rgba(0,0,0,.22) 0px,
      rgba(0,0,0,.22) 1px,
      rgba(255,255,255,.02) 1px,
      rgba(255,255,255,.02) 3px
    );
    opacity:.5;
  }
  html::after {
    content:""; position:fixed; inset:0; z-index:61; pointer-events:none;
    box-shadow:inset 0 0 18vmin rgba(2,3,10,.9);
  }
  .contagem {
    margin-left:auto; text-align:right;
    font-size:clamp(11px,1.1vw,15px); letter-spacing:.2em; color:var(--fraco);
  }
  .contagem b { color:var(--texto); font-weight:400; font-size:1.5em; }

  /* ---------- colunas ---------- */
  .colunas {
    flex:1; min-height:0;
    display:grid; grid-template-columns: 2.5fr 1fr; gap:1.6vw;
  }
  .painel {
    min-height:0; display:flex; flex-direction:column;
    border:1px solid rgba(34,230,255,.34);
    background:linear-gradient(180deg, rgba(10,15,42,.9), rgba(2,3,10,.94));
    clip-path: polygon(20px 0, 100% 0, 100% calc(100% - 20px), calc(100% - 20px) 100%, 0 100%, 0 20px);
    padding:1.8vh 1.4vw;
  }
  .painel h2 {
    font-size:clamp(12px,1.2vw,18px); letter-spacing:.34em; color:var(--dourado);
    margin-bottom:1.2vh; flex:none;
  }
  ol { list-style:none; flex:1; min-height:0; display:flex; flex-direction:column; gap:.4vh; }

  /* ---------- linhas do top ---------- */
  .top li {
    flex:1; min-height:0;
    display:grid; grid-template-columns:2.2em 1fr auto; gap:1vw;
    align-items:center; padding:0 .6vw;
    font-size:clamp(14px, 2.4vh, 34px);
    border-left:.28em solid transparent;
  }
  .top .pos { color:var(--fraco); font-variant-numeric:tabular-nums; }
  .top .quem { min-width:0; }
  .top .nome {
    display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
    letter-spacing:.08em;
  }
  .top .detalhe {
    display:block; font-size:.5em; letter-spacing:.18em; color:var(--fraco); margin-top:.2em;
  }
  .top .pts {
    font-variant-numeric:tabular-nums; color:var(--dourado); letter-spacing:.04em;
  }
  .top li.p1 {
    border-left-color:var(--dourado);
    background:linear-gradient(90deg, rgba(255,210,63,.14), transparent 70%);
    font-size:clamp(18px, 3.4vh, 46px);
  }
  .top li.p1 .pos, .top li.p1 .nome { color:var(--dourado); }
  .top li.p2 { border-left-color:var(--ciano); }
  .top li.p2 .pos, .top li.p2 .nome { color:var(--ciano); }
  .top li.p3 { border-left-color:var(--magenta); }
  .top li.p3 .pos, .top li.p3 .nome { color:var(--magenta); }
  .top li.novo { animation: chega .9s steps(6,end); }
  @keyframes chega {
    0% { background:rgba(34,230,255,.4); transform:translateX(-.5em); }
    100% { background:transparent; transform:none; }
  }

  /* ---------- feed ---------- */
  .feed li {
    display:grid; grid-template-columns:1fr auto; gap:.6em; align-items:baseline;
    font-size:clamp(11px, 1.6vh, 20px); padding:.25vh 0;
    border-bottom:1px solid rgba(34,230,255,.08);
  }
  .feed .nome { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; letter-spacing:.06em; }
  .feed .pts { color:var(--dourado); font-variant-numeric:tabular-nums; }
  .feed li:first-child .nome { color:var(--ciano); }

  .aviso {
    flex:1; display:flex; flex-direction:column; justify-content:center; gap:1.2vh;
    color:var(--fraco); font-size:clamp(12px,1.5vh,20px); letter-spacing:.14em;
    line-height:1.7; text-align:center;
  }
  .aviso b { color:var(--ciano); font-weight:400; letter-spacing:.2em; }

  .rodape {
    flex:none; display:flex; gap:1vw; align-items:center; justify-content:center;
    color:var(--fraco); font-size:clamp(10px,1.05vw,15px); letter-spacing:.34em;
  }
  .rodape .pisca {
    color:var(--dourado);
    animation:piscar 1.2s steps(2,end) infinite;
  }
  @keyframes piscar { 0%,60%{opacity:1} 61%,100%{opacity:.2} }
</style>
</head>
<body>
  <header>
    <h1>STARDUST RUNNER<small>QUADRO DE RECORDES</small></h1>
    <div class="contagem"><b id="total">0</b><br />CORRIDAS</div>
  </header>

  <div class="colunas">
    <section class="painel">
      <h2>MELHORES DA REDE</h2>
      <ol id="top" class="top"></ol>
      <div id="top-vazio" class="aviso">
        NINGUEM CORREU AINDA.<br />
        AGUARDANDO A PRIMEIRA CORRIDA.
      </div>
    </section>

    <section class="painel">
      <h2>ULTIMAS</h2>
      <ol id="feed" class="feed"></ol>
      <div id="feed-vazio" class="aviso">AGUARDANDO A PRIMEIRA CORRIDA.</div>
    </section>
  </div>

  <footer class="rodape">
    <span class="pisca">★</span><span>STARDUST RUNNER</span><span class="pisca">★</span>
  </footer>

<script>
  var vistos = Object.create(null);
  var primeiraCarga = true;

  function texto(pai, classe, valor) {
    var s = document.createElement('span');
    s.className = classe;
    s.textContent = valor;
    pai.appendChild(s);
    return s;
  }

  function hora(ms) {
    var d = new Date(ms);
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  function mostrar(id, visivel) {
    document.getElementById(id).style.display = visivel ? '' : 'none';
  }

  function desenharTop(lista) {
    var ol = document.getElementById('top');
    mostrar('top-vazio', lista.length === 0);
    ol.style.display = lista.length === 0 ? 'none' : '';
    ol.textContent = '';
    lista.forEach(function (r, i) {
      var li = document.createElement('li');
      li.className = 'p' + (i + 1);
      var chave = r.nickname + ':' + r.score;
      if (!primeiraCarga && !vistos[chave]) li.className += ' novo';
      vistos[chave] = true;

      texto(li, 'pos', String(i + 1).padStart(2, '0'));
      var quem = document.createElement('span');
      quem.className = 'quem';
      texto(quem, 'nome', r.nickname);
      texto(quem, 'detalhe', r.distance + ' METROS   COMBO x' + r.maxCombo +
        '   ' + r.stardust + ' POEIRAS');
      li.appendChild(quem);
      texto(li, 'pts', Number(r.score).toLocaleString('pt-BR'));
      ol.appendChild(li);
    });
  }

  function desenharFeed(lista) {
    var ol = document.getElementById('feed');
    mostrar('feed-vazio', lista.length === 0);
    ol.style.display = lista.length === 0 ? 'none' : '';
    ol.textContent = '';
    lista.forEach(function (r) {
      var li = document.createElement('li');
      var esq = document.createElement('span');
      esq.className = 'nome';
      esq.textContent = r.nickname;
      li.appendChild(esq);
      var dir = document.createElement('span');
      dir.className = 'pts';
      dir.textContent = Number(r.score).toLocaleString('pt-BR') + '  ' + hora(r.at);
      li.appendChild(dir);
      ol.appendChild(li);
    });
  }

  // Sem selo de estado: so busca e desenha. Se a rede falhar, mantem o
  // ultimo placar na tela e tenta de novo em 3 s.
  function atualizar() {
    Promise.all([
      fetch('/api/top?limit=10', { cache: 'no-store' }).then(function (r) { return r.json(); }),
      fetch('/api/recent?limit=14', { cache: 'no-store' }).then(function (r) { return r.json(); }),
      fetch('/api/total', { cache: 'no-store' }).then(function (r) { return r.json(); })
    ]).then(function (res) {
      desenharTop(res[0] || []);
      desenharFeed(res[1] || []);
      document.getElementById('total').textContent = (res[2] || {}).total || 0;
      primeiraCarga = false;
    }).catch(function () { /* mantem o ultimo placar */ });
  }

  atualizar();
  setInterval(atualizar, 3000);
</script>
</body>
</html>`;

/** A pagina e estatica: os dados chegam via /api. Sem endereco, sem estado. */
function paginaPlacar() {
  return PAGINA_PLACAR;
}

/* ==========================================================================
   Servidor
   ========================================================================== */
carregar();

const servidor = http.createServer((req, res) => {
  const url = req.url || '/';
  const corte = url.indexOf('?');
  const caminho = corte >= 0 ? url.slice(0, corte) : url;
  const consulta = corte >= 0 ? url.slice(corte + 1) : '';
  const parametros = new URLSearchParams(consulta);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  if (req.method === 'POST' && caminho === '/api/score') {
    registrarScore(req, res);
    return;
  }

  if (req.method === 'GET' && caminho === '/api/top') {
    responderJson(res, 200, melhores(inteiroSeguro(parametros.get('limit') || 10, 1, 100)));
    return;
  }

  if (req.method === 'GET' && caminho === '/api/recent') {
    responderJson(res, 200, ultimos(inteiroSeguro(parametros.get('limit') || 12, 1, 100)));
    return;
  }

  if (req.method === 'GET' && caminho === '/api/total') {
    responderJson(res, 200, { total: registros.length });
    return;
  }

  if (req.method === 'GET' && (caminho === '/placar' || caminho === '/placar/')) {
    responderTexto(res, 200, paginaPlacar(req), 'text/html; charset=utf-8');
    return;
  }

  if (req.method === 'GET') {
    servirEstatico(req, res, caminho);
    return;
  }

  responderTexto(res, 405, 'Metodo nao suportado.');
});

/** IPv4 das placas de rede de verdade (sem loopback, sem interface virtual). */
function enderecosDaRede() {
  const saida = [];
  const interfaces = os.networkInterfaces();
  for (const nome of Object.keys(interfaces)) {
    for (const info of interfaces[nome] || []) {
      if (info.family === 'IPv4' && !info.internal) saida.push(info.address);
    }
  }
  return saida;
}

servidor.listen(PORTA, () => {
  const ips = enderecosDaRede();
  console.log('');
  console.log('  STARDUST RUNNER - servidor local');
  console.log('  --------------------------------');
  console.log('  jogo:   http://localhost:' + PORTA + '/');
  console.log('  placar: http://localhost:' + PORTA + '/placar');
  if (ips.length) {
    console.log('');
    console.log('  Nos outros PCs e celulares da rede, use um destes:');
    for (const ip of ips) console.log('    http://' + ip + ':' + PORTA + '/');
    console.log('');
    console.log('  Com LEADERBOARD_URL = \'auto\' no config.js, o jogo aberto por');
    console.log('  esses enderecos ja manda a pontuacao para ca - sem IP fixo.');
  } else {
    console.log('  (nenhuma placa de rede ativa: so da pra jogar nesta maquina)');
  }
  console.log('');
  console.log('  dados:  ' + ARQUIVO_SCORES);
  console.log('');
  if (!fs.existsSync(PASTA_DIST)) {
    console.log('  ATENCAO: a pasta dist/ nao esta aqui. Rode "npm run build".');
    console.log('');
  }
});
