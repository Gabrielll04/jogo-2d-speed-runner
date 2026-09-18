# STARDUST RUNNER

Endless runner 3D de três pistas com tema de galáxia, renderizado em baixa
resolução com upscale nearest-neighbor — **3D pixelado retrô**. Feito para
rodar a 60 fps em PC escolar com GPU integrada, **100% offline**, sem nenhum
asset externo: toda a geometria, as texturas, a música e os efeitos sonoros
são gerados em tempo de execução.

```
Vite + JavaScript puro + Three.js     zero CDN, zero fonte baixada,
Web Audio API (som sintetizado)       zero imagem, zero modelo 3D
```

---

## Sumário

- [Rodando o projeto](#rodando-o-projeto)
- [Deploy offline na escola](#deploy-offline-na-escola)
- [Placar em rede local](#placar-em-rede-local)
- [Controles](#controles)
- [Como o jogo funciona](#como-o-jogo-funciona)
- [Ajustes finos (config.js)](#ajustes-finos-configjs)
- [Estrutura de pastas](#estrutura-de-pastas)
- [Testes](#testes)
- [Solução de problemas](#solução-de-problemas)

---

## Rodando o projeto

Precisa de **Node.js 18 ou mais novo**.

```bash
npm install     # instala Vite e Three.js (única vez que usa internet)
npm run dev     # servidor de desenvolvimento em http://localhost:5173
npm run build   # gera a pasta dist/ pronta para o evento
npm run preview # confere a build como ela vai rodar de verdade
```

O `npm run dev` já aceita conexões da rede local (`host: true`), então dá para
abrir no celular usando o IP da máquina — útil para testar o controle por toque.

---

## Deploy offline na escola

O objetivo aqui é: **nenhuma internet, nenhum `npm install` no PC da escola.**

### 1. Na sua máquina, gere a build

```bash
npm run build
```

### 2. Copie três itens para o pendrive

```
dist/            <- o jogo compilado
server.js        <- servidor local (Node puro, sem dependências)
package.json     <- só para o Node saber que server.js é um módulo ES
```

Nada de `node_modules/`. Nada de `src/`.

### 3. No PC da escola

Coloque os três itens numa pasta qualquer e rode:

```bash
node server.js
```

Saída esperada:

```
  STARDUST RUNNER - servidor local
  --------------------------------
  jogo:   http://localhost:3000/
  placar: http://localhost:3000/placar
```

Abra `http://localhost:3000/` no Chrome ou no Edge. Pressione **F** para tela
cheia e pronto — a aba Network fica vazia de requisições externas.

Para usar outra porta: `PORT=8080 node server.js` (no Windows,
`set PORT=8080 && node server.js`).

### Modo quiosque (PC do evento rodando sozinho)

O jogo já tem **attract mode**: depois de 60 segundos sem ninguém tocar no
teclado, um bot começa a jogar sozinho com câmeras cinematográficas, e a tela
volta a convidar "PRESSIONE ENTER". Para deixar redondo, abra o Chrome assim:

```
chrome.exe --kiosk --autoplay-policy=no-user-gesture-required http://localhost:3000/
```

> Sem Node no PC da escola? Qualquer servidor estático serve para o jogo em si
> (o `dist/` é só HTML + JS + CSS). O que exige o `server.js` é o placar
> compartilhado. **Não funciona abrindo `dist/index.html` com duplo clique**:
> o navegador bloqueia módulos ES em `file://`. Precisa ser servido por HTTP.

---

## Placar em rede local

Desligado por padrão. Ligado, ele junta as pontuações de vários PCs num
ranking só, e dá uma página de telão para projetar.

### Ligar

1. Descubra o IP do PC que vai ser o servidor (`ipconfig` no Windows).
2. Em `src/config.js`, preencha:

```js
export const LEADERBOARD_URL = 'http://192.168.0.10:3000';
```

3. `npm run build` de novo e distribua o `dist/` atualizado.

Com a constante vazia, o jogo **não faz uma única requisição de rede**. Com ela
preenchida, toda chamada tem timeout de 3 s e `try/catch` silencioso: se o
servidor cair no meio do evento, o jogo continua rodando e a tela de fim mostra
"OFFLINE — PONTUAÇÃO SÓ NO LOCAL".

### Endpoints

| Método | Rota                  | O que faz                                     |
|--------|-----------------------|-----------------------------------------------|
| GET    | `/`                   | serve o `dist/` (o jogo)                      |
| POST   | `/api/score`          | registra `{nickname, score, distance, maxCombo, stardust}` |
| GET    | `/api/top?limit=10`   | melhor pontuação de cada apelido, ordenada    |
| GET    | `/api/recent?limit=12`| últimas corridas, mais nova primeiro          |
| GET    | `/api/total`          | total de corridas registradas                 |
| GET    | `/placar`             | página de ranking (atualiza a cada 3 s)       |

Os dados ficam em `scores.json`, ao lado do `server.js`. É um JSON comum: dá
para abrir, editar e apagar entre um evento e outro. Para zerar o ranking,
apague o arquivo e reinicie o servidor.

### Página do telão

`http://localhost:3000/placar` — mesmo tema neon do jogo, top 10 à esquerda,
feed das últimas corridas à direita, e cada entrada nova pisca ao aparecer.
Projete numa tela e deixe rodando.

---

## Controles

| Tecla                    | Ação                                    |
|--------------------------|-----------------------------------------|
| `←` `→` ou `A` `D`       | trocar de pista                         |
| `↑` `W` `Espaço`         | pular                                   |
| `↓` `S`                  | deslizar (hitbox reduzida por ~0,5 s)   |
| `Enter`                  | confirmar / começar / jogar de novo     |
| `Esc`                    | voltar (e pausar durante a partida)     |
| `P`                      | pausar                                  |
| `M`                      | mudo                                    |
| `C`                      | configurações                           |
| `F`                      | tela cheia                              |
| `F3`                     | contador de FPS, draw calls e resolução |
| `Tab` (tela de apelido)  | próxima sugestão de apelido             |

**No celular:** arraste para os lados para trocar de pista, para cima para
pular, para baixo para deslizar; toque simples confirma nos menus.

---

## Como o jogo funciona

### O efeito pixelado

O WebGL desenha num canvas de **320×180** (ou 480×270 / 256×144). O CSS estica
esse canvas para a janela com `image-rendering: pixelated`, sempre em **escala
inteira** — 320×180 vira 1280×720 (4×), 1600×900 (5×), 1920×1080 (6×). Por isso
todo pixel vira um quadrado perfeito, em qualquer tamanho de janela; o que
sobra vira letterbox preto, preservando 16:9.

`antialias: false` e `setPixelRatio(1)` não são economia: são a estética. Não
há pós-processamento — o brilho vem de cores emissivas e sprites aditivos, que
pixelam muito melhor que um bloom borrado.

O HUD e os menus são **DOM em resolução nativa**, posicionados exatamente sobre
o retângulo do canvas. Texto nítido, mundo pixelado.

### Dificuldade e a regra de ouro

A velocidade vai de 21 a 45 unidades/s numa curva suave com teto em 3200 m. O
espaço entre padrões encolhe de 30 para 15 unidades no mesmo ritmo.

Os obstáculos não são sorteados um a um: vêm de um **catálogo de padrões**
(`src/game/patterns.js`), cada um com pesos para fácil/médio/difícil. Todo
padrão passa por um **validador de rota** que faz busca em largura pelas
camadas, na velocidade máxima do jogo, considerando quantas trocas de pista
cabem no espaço entre elas e quanto tempo o jogador passa no ar depois de
pular. Padrão sem rota viável não entra no jogo — e `npm run test:padroes`
quebra a build se alguém escrever um.

A poeira estelar é distribuída **em cima da rota viável** que o validador
devolveu. Seguir o brilho é, por construção, seguir o caminho que dá para
passar.

### Power-ups

| Power-up             | Efeito                                          |
|----------------------|-------------------------------------------------|
| BOLHA (escudo)       | absorve um dano, dá 1,5 s de invulnerabilidade  |
| ÍMÃ DE POEIRA        | atrai a poeira estelar por 6 s                  |
| DILATAÇÃO TEMPORAL   | câmera lenta por 4 s                            |
| SUPERNOVA x2         | pontuação dobrada por 6 s                       |

São raros: cooldown de 17 s entre um e outro, e o primeiro só depois de 260 m.

### Pontuação

```
distância          1 ponto por metro
poeira estelar    50 x multiplicador
raspada           25 x multiplicador
combo             x1 -> x2 -> x3 -> x5 -> x8   (sobe a cada 5 coletas,
                                                quebra com 3 s sem coletar)
```

O recorde local fica no `localStorage`, junto com o apelido e as preferências.

### Buraco negro

A partir de 520 m aparece de vez em quando **ao lado da pista** — nunca em cima
dela. Enquanto está perto, puxa o jogador lateralmente por alguns segundos:
não mata, mas faz você raspar em obstáculo que passaria limpo. Tensão barata de
renderizar e cara de ignorar.

### Performance

- Nenhuma sombra, nenhum reflexo, nenhum `EffectComposer`.
- Duas luzes no total: uma ambiente e uma direcional.
- Pooling em tudo que se repete; a poeira inteira custa **2 draw calls**
  (um `InstancedMesh` + um `Points`), e as travessas da pista, mais um.
- Em 320×180, um quadro típico fica em torno de **60 draw calls e 2 mil
  triângulos**.
- **Governador de qualidade**: abaixo de 45 fps por 3 s, cai um degrau de
  resolução e corta as partículas pela metade; abaixo de 30 fps por 5 s, cai
  dois. Um aviso discreto avisa o que aconteceu. A queda vale só para a sessão
  — quem fixa a qualidade em Configurações é que fica gravado.

### Áudio

Tudo sintetizado com Web Audio API: kick, hats, baixo em arpejo, pad etéreo e
um lead com eco, num loop synthwave em lá menor a 100 BPM com progressão
Am–F–C–G. O sequenciador usa lookahead (o `setInterval` só decide o que
agendar; quem toca no tempo certo é o relógio do `AudioContext`). Duas
intensidades: calma nos menus, completa no jogo. O neon da pista e o núcleo do
jogador pulsam no kick.

O `AudioContext` só é criado no **primeiro input do jogador**, como os
navegadores exigem.

---

## Ajustes finos (config.js)

Quase tudo que dá para balancear está em `src/config.js`:

| Constante                            | Para que serve                          |
|--------------------------------------|-----------------------------------------|
| `NOME_JOGO`                          | nome exibido em todas as telas          |
| `LEADERBOARD_URL`                    | placar em rede (vazio = offline total)  |
| `RESOLUCOES` / `RESOLUCAO_PADRAO`    | degraus de resolução interna            |
| `LARGURA_PISTA`, `PISTAS`            | geometria das três pistas               |
| `CAMERA`, `FOG`                      | enquadramento e alcance de visão        |
| `JOGADOR`                            | pulo, deslize, hitbox, inclinação       |
| `VELOCIDADE_INICIAL/MAXIMA`, `DIST_TETO` | curva de dificuldade                |
| `GAP_PADRAO_INICIAL/FINAL`           | respiro entre padrões                   |
| `PONTOS`                             | pontuação, combos, margem de raspada    |
| `POWERUPS`, `COOLDOWN_POWERUP`       | duração e raridade dos power-ups        |
| `BURACO_NEGRO`                       | frequência, alcance e força do puxão    |
| `SEGUNDOS_ATE_ATTRACT`               | ociosidade até voltar para a demo       |
| `GOVERNADOR`                         | limiares do ajuste automático de fps    |
| `SUGESTOES_NICK`                     | apelidos sugeridos                      |

Mexeu? Rode `npm test` e `npm run build` — o teste de hitbox avisa se o pulo
ficou apertado demais e o de padrões avisa se algum virou impossível.

---

## Estrutura de pastas

```
index.html              estrutura das telas (HUD e menus em DOM)
server.js               servidor do evento (http + fs + path, zero npm)
src/
  main.js               bootstrap, loop principal, máquina de estados
  config.js             TODAS as constantes de tuning
  style.css             tema "galáxia neon pixelada"
  core/
    renderer.js         pipeline pixelado: baixa resolução -> escala inteira
    input.js            teclado e toque traduzidos em ações nomeadas
    quality.js          governador de fps + contador do F3
    storage.js          preferências, apelido e recorde (localStorage)
    rng.js              aleatório com semente e utilidades de interpolação
  audio/
    audio.js            SFX e trilha synthwave, 100% sintetizados
  gfx/
    textures.js         texturas procedurais desenhadas em <canvas>
    track.js            pista neon (InstancedMesh para travessas e postes)
    skybox.js           estrelas em parallax, nebulosas, cometa
    planets.js          planetas low-poly, estrelas distantes, buraco negro
    player.js           o corredor cósmico
    particles.js        pool único de partículas (ShaderMaterial + Points)
  game/
    game.js             as regras: estados, colisões, power-ups, dano
    world.js            a cena 3D e a câmera
    patterns.js         catálogo de padrões + validador de rota
    hitboxes.js         tipos e caixas de colisão (módulo puro, sem Three)
    patterns.test.js    teste do catálogo (roda em Node puro)
    hitbox.test.js      teste das janelas de pulo e deslize
    spawner.js          o que nasce lá na frente
    obstacles.js        pools dos três tipos de obstáculo
    collectibles.js     poeira estelar e power-ups
    collision.js        AABB manual e detecção de raspada
    score.js            pontuação e combo
    bot.js              o piloto do attract mode
  ui/
    hud.js              HUD (escreve no DOM só quando o valor muda)
    screens.js          attract, apelido, pausa, fim, configurações
    logo.js             logo desenhado em SVG, pixel a pixel
    leaderboard.js      cliente do placar (com timeout e fallback)
```

---

## Testes

```bash
npm test              # roda os dois testes abaixo
npm run test:padroes  # catálogo de padrões e validador de rota
npm run test:hitbox   # caixas de colisão e janelas de ação
```

Rodam em **Node puro**, sem navegador — por isso `game/hitboxes.js`,
`game/collision.js`, `game/patterns.js` e `config.js` não importam Three.js.

**`test:padroes`** valida o catálogo inteiro (padrões normais e espelhados) na
velocidade máxima, imprime a rota encontrada para cada um e faz a
**contraprova**: um padrão com três paredes lado a lado e um que exigiria troca
dupla instantânea precisam ser rejeitados.

**`test:hitbox`** simula a física do pulo e do deslize contra as caixas reais e
mede a **janela de acerto** de cada ação. Ele existe porque erro de balanço não
aparece lendo código: foi esse teste que mostrou que, na velocidade inicial, a
janela para pular o asteroide era de 90 ms — precisão de 5 quadros. Hoje o
mínimo exigido é 180 ms, e a janela real fica em torno de 240 ms para o pulo e
480 ms para o deslize.

Saída típica:

```
ASTEROIDE (tem que dar pra pular)
  ok   a 21 u/s a janela do pulo e de 240 ms (de 0.14 s a 0.37 s antes do impacto)
  ok   a 45 u/s a janela do pulo e de 280 ms (de 0.13 s a 0.4 s antes do impacto)
```

---

## Solução de problemas

**"Seu navegador não suporta WebGL"** — ative a aceleração de hardware nas
configurações do Chrome/Edge (`chrome://settings/system`) e atualize o driver
de vídeo. O jogo detecta e mostra a mensagem em vez de quebrar.

**Abri o `dist/index.html` com duplo clique e a tela ficou preta** — o
navegador bloqueia módulos ES em `file://`. Sirva por HTTP: `node server.js`.

**Está engasgando** — pressione `F3` para ver o fps real. O governador já
derruba a resolução sozinho, mas dá para fixar em BAIXA na tela `C`
(Configurações). Feche as outras abas: num PC integrado, uma aba com vídeo
rodando come mais GPU que o jogo inteiro.

**O som não começa** — é proposital: o `AudioContext` só nasce depois do
primeiro input. Aperte qualquer tecla. Se continuar mudo, confira o `M` e o
volume em Configurações.

**O placar não recebe nada** — confirme que `LEADERBOARD_URL` foi preenchida
**antes** do `npm run build`, que o IP está certo e que o firewall do Windows
liberou a porta 3000 na rede privada.

**A tela pisca ao trocar de janela** — o jogo pausa sozinho em
`visibilitychange` e ao perder o foco. Aperte `P` para voltar.
