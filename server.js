/* ==========================================================================
   STARDUST RUNNER - servidor de evento

   Node puro: http, fs, path. ZERO dependencia de npm - da pra levar num
   pendrive e rodar em qualquer maquina com Node instalado, sem internet.

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
   ========================================================================== */
const PAGINA_PLACAR = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>PLACAR - STARDUST RUNNER</title>
<style>
  :root {
    --espaco-0:#02030a; --espaco-2:#0a0f2a; --ciano:#22e6ff;
    --magenta:#ff2f87; --dourado:#ffd23f; --texto:#e8f4ff; --fraco:#6d84a8;
    --fonte: ui-monospace, "Cascadia Mono", Consolas, monospace;
  }
  * { box-sizing:border-box; margin:0; padding:0; }
  body {
    min-height:100vh; background:var(--espaco-0); color:var(--texto);
    font-family:var(--fonte); padding:3vh 3vw; overflow-x:hidden;
  }
  /* Campo de estrelas em CSS puro: gradientes repetidos, custo zero. */
  body::before {
    content:""; position:fixed; inset:0; z-index:-2; opacity:.5;
    background-image:
      radial-gradient(1px 1px at 20% 30%, #fff, transparent),
      radial-gradient(1px 1px at 70% 60%, #cfe4ff, transparent),
      radial-gradient(1px 1px at 40% 80%, #fff, transparent),
      radial-gradient(2px 2px at 85% 20%, #9fd4ff, transparent),
      radial-gradient(1px 1px at 10% 70%, #ffd8ec, transparent);
    background-size: 340px 340px, 420px 420px, 260px 260px, 520px 520px, 300px 300px;
  }
  body::after {
    content:""; position:fixed; inset:0; z-index:-1; pointer-events:none;
    background:repeating-linear-gradient(to bottom,
      rgba(0,0,0,.20) 0px, rgba(0,0,0,.20) 1px,
      rgba(255,255,255,.02) 1px, rgba(255,255,255,.02) 3px);
    mix-blend-mode:multiply;
  }
  header { display:flex; align-items:flex-end; gap:1.4rem; margin-bottom:2.4vh; flex-wrap:wrap; }
  h1 {
    font-size:clamp(28px, 5vw, 62px); letter-spacing:.14em; font-weight:700;
    text-shadow: 2px 0 0 var(--magenta), -2px 0 0 var(--ciano);
  }
  h1 small { display:block; font-size:.32em; letter-spacing:.42em; color:var(--ciano); text-shadow:none; }
  .estado { margin-left:auto; font-size:clamp(11px,1.2vw,15px); letter-spacing:.2em; color:var(--fraco); }
  .estado b { color:var(--ciano); font-weight:400; }
  .colunas { display:grid; grid-template-columns: 1.6fr 1fr; gap:2vw; align-items:start; }
  @media (max-aspect-ratio:1/1) { .colunas { grid-template-columns:1fr; } }
  .painel {
    border:1px solid rgba(34,230,255,.4);
    background:linear-gradient(180deg, rgba(10,15,42,.92), rgba(2,3,10,.94));
    clip-path: polygon(18px 0, 100% 0, 100% calc(100% - 18px), calc(100% - 18px) 100%, 0 100%, 0 18px);
    padding:2.2vh 1.6vw;
  }
  .painel h2 {
    font-size:clamp(13px,1.5vw,19px); letter-spacing:.3em; color:var(--dourado);
    font-weight:700; margin-bottom:1.6vh;
  }
  ol { list-style:none; display:grid; gap:.5vh; }
  li {
    display:grid; grid-template-columns:2.6em 1fr auto auto; gap:1em; align-items:baseline;
    padding:.5vh .6vw; font-size:clamp(13px,1.9vw,26px);
  }
  li .pos { color:var(--fraco); }
  li .nome { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; letter-spacing:.06em; }
  li .dist { color:var(--fraco); font-size:.62em; letter-spacing:.14em; }
  li .pts { color:var(--dourado); font-variant-numeric:tabular-nums; }
  li.p1 { background:linear-gradient(90deg, rgba(255,210,63,.16), transparent); }
  li.p1 .pos, li.p1 .nome { color:var(--dourado); }
  li.p2 .pos, li.p2 .nome { color:var(--ciano); }
  li.p3 .pos, li.p3 .nome { color:var(--magenta); }
  li.novo { animation: entra .6s steps(5,end); }
  @keyframes entra {
    from { background:rgba(34,230,255,.35); transform:translateX(-6px); }
    to { background:transparent; transform:none; }
  }
  .feed li { grid-template-columns:1fr auto; font-size:clamp(11px,1.3vw,17px); }
  .feed .hora { color:var(--fraco); font-size:.8em; }
  .vazio { color:var(--fraco); font-size:clamp(12px,1.4vw,18px); letter-spacing:.14em; }
  footer { margin-top:2.4vh; color:var(--fraco); font-size:clamp(10px,1.1vw,14px); letter-spacing:.2em; }
</style>
</head>
<body>
  <header>
    <h1>PLACAR<small>STARDUST RUNNER</small></h1>
    <div class="estado">ATUALIZA A CADA 3 S &middot; <b id="total">0</b> CORRIDAS</div>
  </header>

  <div class="colunas">
    <section class="painel">
      <h2>TOP 10</h2>
      <ol id="top"><li class="vazio">AGUARDANDO OS PRIMEIROS CORREDORES...</li></ol>
    </section>
    <section class="painel">
      <h2>ULTIMAS CORRIDAS</h2>
      <ol id="feed" class="feed"><li class="vazio">NADA AINDA.</li></ol>
    </section>
  </div>

  <footer>SERVIDOR LOCAL &middot; SEM INTERNET &middot; DADOS EM scores.json</footer>

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

  function vazio(ol, mensagem) {
    var li = document.createElement('li');
    li.className = 'vazio';
    li.textContent = mensagem;
    ol.appendChild(li);
  }

  function desenharTop(lista) {
    var ol = document.getElementById('top');
    ol.textContent = '';
    if (!lista.length) { vazio(ol, 'AGUARDANDO OS PRIMEIROS CORREDORES...'); return; }
    lista.forEach(function (r, i) {
      var li = document.createElement('li');
      li.className = 'p' + (i + 1);
      var chave = r.nickname + ':' + r.score;
      if (!primeiraCarga && !vistos[chave]) li.className += ' novo';
      vistos[chave] = true;
      texto(li, 'pos', String(i + 1).padStart(2, '0'));
      texto(li, 'nome', r.nickname);
      texto(li, 'dist', r.distance + ' M  x' + r.maxCombo);
      texto(li, 'pts', Number(r.score).toLocaleString('pt-BR'));
      ol.appendChild(li);
    });
  }

  function desenharFeed(lista) {
    var ol = document.getElementById('feed');
    ol.textContent = '';
    if (!lista.length) { vazio(ol, 'NADA AINDA.'); return; }
    lista.forEach(function (r) {
      var li = document.createElement('li');
      texto(li, 'nome', r.nickname + '  ' + Number(r.score).toLocaleString('pt-BR'));
      texto(li, 'hora', hora(r.at));
      ol.appendChild(li);
    });
  }

  function atualizar() {
    Promise.all([
      fetch('/api/top?limit=10').then(function (r) { return r.json(); }),
      fetch('/api/recent?limit=12').then(function (r) { return r.json(); })
    ]).then(function (res) {
      desenharTop(res[0] || []);
      desenharFeed(res[1] || []);
      primeiraCarga = false;
    }).catch(function () { /* servidor reiniciando: tenta de novo em 3 s */ });

    fetch('/api/total').then(function (r) { return r.json(); }).then(function (d) {
      document.getElementById('total').textContent = d.total;
    }).catch(function () {});
  }

  atualizar();
  setInterval(atualizar, 3000);
</script>
</body>
</html>`;

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
    responderTexto(res, 200, PAGINA_PLACAR, 'text/html; charset=utf-8');
    return;
  }

  if (req.method === 'GET') {
    servirEstatico(req, res, caminho);
    return;
  }

  responderTexto(res, 405, 'Metodo nao suportado.');
});

servidor.listen(PORTA, () => {
  console.log('');
  console.log('  STARDUST RUNNER - servidor local');
  console.log('  --------------------------------');
  console.log('  jogo:   http://localhost:' + PORTA + '/');
  console.log('  placar: http://localhost:' + PORTA + '/placar');
  console.log('  rede:   http://SEU-IP-LOCAL:' + PORTA + '/   (outros PCs e celulares)');
  console.log('  dados:  ' + ARQUIVO_SCORES);
  console.log('');
  if (!fs.existsSync(PASTA_DIST)) {
    console.log('  ATENCAO: a pasta dist/ nao esta aqui. Rode "npm run build".');
    console.log('');
  }
});
