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

O **attract mode** tem dois estágios:

1. **Menu** — logo, controles, placar e a legenda dos obstáculos, com o bot
   jogando ao fundo.
2. **Vitrine** — depois de **30 segundos** sem ninguém encostar no teclado, o
   menu sai da frente: some o painel, o escurecimento quase desaparece e a
   partida do bot toma a tela inteira, com a marca no alto e um
   "APERTE ENTER!" piscando embaixo. Qualquer tecla traz o menu de volta;
   ENTER começa a partida direto.

De qualquer outra tela (apelido, pausa, fim), 60 segundos parados devolvem o
jogo ao attract. Para deixar redondo, abra o Chrome assim:

```
chrome.exe --kiosk --autoplay-policy=no-user-gesture-required http://localhost:3000/
```

> Sem Node no PC da escola? Qualquer servidor estático serve para o jogo em si
> (o `dist/` é só HTML + JS + CSS). O que exige o `server.js` é o placar
> compartilhado. **Não funciona abrindo `dist/index.html` com duplo clique**:
> o navegador bloqueia módulos ES em `file://`. Precisa ser servido por HTTP.

---

## Placar em rede local

O jogo junta as pontuações de todos os PCs num ranking só e mostra numa
página de telão. Quem serve o jogo e quem guarda as pontuações é o **mesmo**
`server.js`.

### O ajuste que importa

Em `src/config.js`:

```js
export const LEADERBOARD_URL = 'auto';
```

| Valor    | O que faz                                                        |
|----------|------------------------------------------------------------------|
| `'auto'` | usa a **mesma origem** que serviu o jogo (padrão, recomendado)    |
| `''`     | desliga: zero requisições de rede, jogo 100% offline              |
| uma URL  | endereço fixo, ex.: `'http://192.168.0.10:3000'`                  |

Com `'auto'` você não precisa saber o IP da máquina nem gerar build nova
quando ele mudar: o jogo aberto em `http://10.93.71.59:3000/` manda a
pontuação para `http://10.93.71.59:3000/api/score` sozinho.

> ### Cuidado com a porta
>
> A API do placar vive no **`server.js`, porta 3000**. O `npm run dev` sobe o
> **Vite na porta 5173**, que não conhece `/api/score` e responde **404**.
> Apontar `LEADERBOARD_URL` para a 5173 é o erro mais fácil de cometer — e
> agora o próprio jogo avisa no console do navegador quando isso acontece.
>
> Para testar o placar durante o desenvolvimento, deixe os dois rodando: o
> `vite.config.js` tem um proxy que encaminha `/api/*` do Vite para a 3000.

### Como usar no evento

1. Num PC, com `dist/`, `server.js` e `package.json` na mesma pasta:
   `node server.js`. Ele imprime os endereços da rede — anote um.
2. Nos outros PCs, abra `http://<esse-ip>:3000/`.
3. No projetor, abra `http://<esse-ip>:3000/placar`.

### Endpoints

| Método | Rota                  | O que faz                                     |
|--------|-----------------------|-----------------------------------------------|
| GET    | `/`                   | serve o `dist/` (o jogo)                      |
| POST   | `/api/score`          | registra `{nickname, score, distance, maxCombo, stardust}` |
| GET    | `/api/top?limit=10`   | melhor pontuação de cada apelido, ordenada    |
| GET    | `/api/recent?limit=14`| últimas corridas, mais nova primeiro          |
| GET    | `/api/total`          | total de corridas registradas                 |
| GET    | `/placar`             | página de ranking para o projetor             |

Toda chamada do jogo tem timeout de 3 s e `try/catch`: se o servidor cair no
meio do evento, o jogo continua rodando e a tela de fim mostra
"OFFLINE — PONTUAÇÃO SÓ NO LOCAL".

Os dados ficam em `scores.json`, ao lado do `server.js`. Para zerar o ranking,
apague o arquivo e reinicie o servidor.

### A tela do projetor

Um **quadro de recordes de fliperama**: não carrega o jogo, não tem link para
ele e não escuta teclado. Ninguém consegue começar uma partida por ali.

- Top 10 dominando a tela, com o primeiro lugar em destaque e cada nome
  acompanhado de distância, combo e poeiras.
- Feed das últimas corridas na lateral.
- Linha nova no top 10 entra piscando.
- Scanlines e vinheta por cima de tudo: o mesmo tubo do jogo.

Recarrega os dados a cada 3 s — não precisa apertar F5. Se a rede falhar, a
página **mantém o último placar desenhado** e tenta de novo no ciclo seguinte,
em vez de piscar uma tela vazia no meio do evento.

Ela existe em dois lugares, para o caso de o `dist/` ser servido por outra
coisa que não o `server.js`:

| Como o jogo está sendo servido | Quem desenha o placar |
|---|---|
| `node server.js` | a rota `/placar` do próprio servidor (HTML pronto) |
| Vite (`npm run dev`), `npm run preview` ou qualquer estático | `src/placar.js`, que assume a página quando a URL termina em `/placar` |

Nos dois casos os dados vêm da mesma API. No modo Vite, o proxy de `/api`
encaminha para o `server.js` na porta 3000.

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

A velocidade vai de 21 a 45 unidades/s numa curva com teto em 3200 m, que
segura a subida nos primeiros metros — a 500 m o jogo ainda está a 23 u/s.

**O respiro entre obstáculos é medido em segundos, não em unidades.** Essa foi
a correção de um playtest em que o jogo ficava punitivo: uma folga fixa de 15
unidades vale 0,7 s a 21 u/s e só 0,33 s a 45 u/s, então a dificuldade crescia
duas vezes (mais rápido **e** mais denso). Hoje o `spawner` converte o gap de
tempo em distância na hora de instanciar, e também estica os `z` internos do
padrão conforme a velocidade sobe. O resultado, medido pelo
[teste de ritmo](#testes):

| | antes | agora |
|---|---|---|
| pior intervalo entre decisões | 0,20 s | 0,46 s |
| 5% piores (p05)               | 0,22 s | 0,49 s |
| intervalo típico (mediana)    | 0,63 s | 1,28 s |

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

### Os três obstáculos

Forma **e** cor dizem a ação, porque num mundo escuro e a 45 unidades por
segundo não dá tempo de interpretar:

| Obstáculo | Cor              | Forma                          | Ação      |
|-----------|------------------|--------------------------------|-----------|
| Pedra     | âmbar quente     | baixa e larga, com veios de magma | **pule**  |
| Laser     | magenta          | feixes altos e finos entre postes | **deslize** |
| Barreira  | listras vermelhas sobre claro | alta, maciça, fechando a pista | **desvie** |

As três cores aparecem como legenda na tela de abertura, antes da primeira
corrida. Os dois primeiros vieram de playtest: a pedra era cinza-arroxeada e
sumia no espaço preto, e a barreira era um satélite flutuante que o pessoal
tentava pular — agora ela vai do chão até acima da linha dos olhos e usa
listras de cancela de obra.

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

Tudo sintetizado com Web Audio API — nenhum arquivo de som. São **duas
trilhas diferentes**, não a mesma música em volumes diferentes:

| | Menu | Jogo |
|---|---|---|
| estilo | chiptune de fliperama | synthwave espacial |
| tom | Dó maior | Lá menor |
| andamento | 124 BPM | 100 BPM |
| progressão | I–V–vi–IV | Am–F–C–G |
| o que puxa | melodia em onda quadrada, com arpejo de 16 avos e caixa marcando o 2 e o 4 | pad etéreo, baixo em arpejo e lead esparso com eco |

As duas compartilham o mesmo conjunto de notas (lá menor e seu relativo
maior), então a troca entre uma e outra muda o humor sem soar como mudança de
assunto. Ao trocar, a faixa volta ao começo da frase e sobe do zero em 0,25 s
— a música nova entra no tempo certo, em vez de continuar do meio do compasso
da anterior.

O sequenciador usa lookahead: o `setInterval` só decide *o que* agendar, e
quem toca no tempo certo é o relógio do `AudioContext`. O neon da pista e o
núcleo do jogador pulsam no kick.

O `AudioContext` só é criado no **primeiro input do jogador**, como os
navegadores exigem.

#### Ouvindo as trilhas sem abrir o jogo

```bash
npm run dev
# abra http://localhost:5173/previa-audio.html
```

A página renderiza cada trilha num `OfflineAudioContext`, toca ali mesmo,
deixa baixar o `.wav` e mostra pico, RMS e quantas amostras estouraram. Foi
com ela que os níveis das duas faixas foram igualados (o menu ficava 5 dB
acima do jogo e dava um susto quando a partida começava; hoje são ~3 dB, que
é o tanto que um chamariz de fliperama pede). A página não entra no `dist/`.

#### Mixagem dos efeitos

O som da poeira estelar é o que mais toca no jogo — uma fileira dispara oito
vezes seguidas, e com o ímã vira rajada. Ele é de propósito discreto e **cai
ainda mais quando as coletas se atropelam**: sem isso, o detalhe vira o som
mais alto da partida e cobre a música.

---

## Ajustes finos (config.js)

Quase tudo que dá para balancear está em `src/config.js`:

| Constante                            | Para que serve                          |
|--------------------------------------|-----------------------------------------|
| `NOME_JOGO`                          | nome exibido em todas as telas          |
| `LEADERBOARD_URL`                    | `'auto'`, vazio (offline) ou URL fixa   |
| `RESOLUCOES` / `RESOLUCAO_PADRAO`    | degraus de resolução interna            |
| `LARGURA_PISTA`, `PISTAS`            | geometria das três pistas               |
| `CAMERA`, `FOG`                      | enquadramento e alcance de visão        |
| `JOGADOR`                            | pulo, deslize, hitbox, inclinação       |
| `VELOCIDADE_INICIAL/MAXIMA`, `DIST_TETO` | curva de dificuldade                |
| `PONTOS`                             | pontuação, combos, margem de raspada    |
| `POWERUPS`, `COOLDOWN_POWERUP`       | duração e raridade dos power-ups        |
| `BURACO_NEGRO`                       | frequência, alcance e força do puxão    |
| `SEGUNDOS_ATE_ATTRACT`               | ociosidade até voltar para a demo       |
| `SEGUNDOS_ATE_VITRINE`               | ociosidade até o menu sair da frente    |
| `GAP_TEMPO_INICIAL/FINAL`            | respiro entre padrões, em segundos      |
| `ESPACAMENTO_INICIAL/FINAL`          | esticamento dos `z` dentro do padrão    |
| `GOVERNADOR`                         | limiares do ajuste automático de fps    |
| `SUGESTOES_NICK`                     | apelidos sugeridos                      |

Mexeu? Rode `npm test` e `npm run build` — o teste de hitbox avisa se o pulo
ficou apertado demais e o de padrões avisa se algum virou impossível.

---

## Estrutura de pastas

```
index.html              estrutura das telas (HUD e menus em DOM)
previa-audio.html       página para ouvir e medir as trilhas (só em dev)
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
    audio.js            SFX e as duas trilhas, 100% sintetizados
    preview.js          renderiza uma trilha em WAV (fora do bundle)
  gfx/
    textures.js         texturas procedurais desenhadas em <canvas>
    track.js            pista neon (InstancedMesh para travessas e postes)
    skybox.js           estrelas em parallax, nebulosas, cometa
    planets.js          planetas low-poly, estrelas distantes, buraco negro
    player.js           o corredor cósmico
    particles.js        pool único de partículas (ShaderMaterial + Points)
  game/
    game.js             as regras: estados, colisões, power-ups, dano
    dificuldade.js      curva de velocidade e de ritmo (módulo puro)
    world.js            a cena 3D e a câmera
    patterns.js         catálogo de padrões + validador de rota
    hitboxes.js         tipos e caixas de colisão (módulo puro, sem Three)
    patterns.test.js    teste do catálogo (roda em Node puro)
    hitbox.test.js      teste das janelas de pulo e deslize
    pacing.test.js      teste do ritmo entre decisões
    spawner.js          o que nasce lá na frente
    obstacles.js        pools dos três tipos de obstáculo
    collectibles.js     poeira estelar e power-ups
    collision.js        AABB manual e detecção de raspada
    score.js            pontuação e combo
    bot.js              o piloto do attract mode
  placar.js           quadro de recordes quando a URL termina em /placar
  ui/
    hud.js              HUD (escreve no DOM só quando o valor muda)
    screens.js          attract, apelido, pausa, fim, configurações
    logo.js             logo desenhado em SVG, pixel a pixel
    leaderboard.js      cliente do placar (com timeout e fallback)
```

---

## Testes

```bash
npm test              # roda os três testes abaixo
npm run test:padroes  # catálogo de padrões e validador de rota
npm run test:hitbox   # caixas de colisão e janelas de ação
npm run test:ritmo    # quanto tempo existe entre uma decisão e a próxima
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

**`test:ritmo`** roda o `spawner` de verdade com pools de mentira e mede o
intervalo de **tempo** entre decisões consecutivas ao longo de 12 corridas de
4000 m. Ele tem piso **e teto**: reprova um jogo punitivo (decisão chegando em
menos de 0,42 s) e também reprova um jogo frouxo (mediana acima de 1,9 s), que
é o jeito fácil de "resolver" dificuldade espalhando tudo até sobrar pista
vazia.

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

**O placar não recebe nada** — abra o console do navegador (F12) na hora de
morrer: o jogo diz o que aconteceu. Um **404** quase sempre significa que
`LEADERBOARD_URL` aponta para a porta do Vite (5173) em vez da do `server.js`
(3000) — com `'auto'` isso não acontece. Se o erro for de rede, confira se o
`server.js` está rodando e se o firewall do Windows liberou a porta 3000 na
rede privada.

**A tela do projetor não atualiza** — ela guarda o último placar quando a rede
falha, então uma lista parada pode ser tanto "ninguém pontuou" quanto "perdi o
servidor". Para separar os dois casos, abra `http://<ip>:3000/api/total` no
navegador: se responder, o servidor está de pé e o problema é o jogo não estar
conseguindo enviar (veja o item acima).

**A tela pisca ao trocar de janela** — o jogo pausa sozinho em
`visibilitychange` e ao perder o foco. Aperte `P` para voltar.
