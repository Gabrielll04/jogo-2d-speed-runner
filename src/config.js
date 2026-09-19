/* ==========================================================================
   CONFIG - todas as constantes de tuning do jogo em um lugar so.
   Mexer aqui muda o jogo inteiro sem caçar numero magico no meio do codigo.
   ========================================================================== */

/** Nome exibido em todas as telas. */
export const NOME_JOGO = 'STARDUST RUNNER';

/**
 * Placar em rede local (opcional, DESLIGADO por padrao).
 *
 *   ''      -> zero requisicoes de rede, jogo 100% offline (padrao)
 *   'auto'  -> usa a MESMA origem que serviu o jogo. E a opcao recomendada
 *              quando o jogo e servido pelo server.js: funciona em qualquer
 *              IP e qualquer porta, sem precisar rebuildar o dist/
 *   url     -> endereco fixo, ex.: 'http://192.168.0.10:3000'
 *
 * ATENCAO a porta: a API do placar vive no server.js (porta 3000 por padrao),
 * NAO no servidor de desenvolvimento do Vite (5173). Apontar para a 5173 da
 * 404 em /api/score, porque o Vite nao conhece essa rota.
 */
export const LEADERBOARD_URL = 'auto';

/** Tempo maximo (ms) que uma chamada ao placar pode demorar antes de desistir. */
export const LEADERBOARD_TIMEOUT = 3000;

/* -------------------------------------------------------------------------
   PALETA
   ------------------------------------------------------------------------- */
export const CORES = {
  espacoFundo: 0x02030a,
  espacoMedio: 0x060a1c,
  espacoAlto: 0x0a0f2a,
  ciano: 0x22e6ff,
  // Tom intermediario: as divisorias de pista com o ciano escuro sumiam
  // contra o chao, e o conjunto ficava apagado demais no projetor.
  cianoMedio: 0x1fb4d6,
  cianoEscuro: 0x0d6f85,
  magenta: 0xff2f87,
  dourado: 0xffd23f,
  texto: 0xe8f4ff,
  violeta: 0x9a7bff,
  nebulaA: 0x1b2a6b,
  nebulaB: 0x5a1f6b,
  nebulaC: 0x6b1f45
};

/* -------------------------------------------------------------------------
   RENDERIZACAO PIXELADA
   Degraus de resolucao interna. O indice 1 (320x180) e o padrao.
   ------------------------------------------------------------------------- */
export const RESOLUCOES = [
  { largura: 480, altura: 270, rotulo: 'ALTA' },
  { largura: 320, altura: 180, rotulo: 'MEDIA' },
  { largura: 256, altura: 144, rotulo: 'BAIXA' }
];
export const RESOLUCAO_PADRAO = 1;

/** Multiplicador de particulas por degrau de qualidade. */
export const PARTICULAS_POR_QUALIDADE = [1.0, 0.7, 0.45];
/** Teto absoluto de particulas vivas (pool). */
export const MAX_PARTICULAS = 150;

/* -------------------------------------------------------------------------
   PISTA E CAMERA
   ------------------------------------------------------------------------- */
export const LARGURA_PISTA = 2.2;
export const PISTAS = [-LARGURA_PISTA, 0, LARGURA_PISTA];
export const TEMPO_TROCA_PISTA = 0.12;   // segundos (~120 ms)

export const CAMERA = {
  // FOV fechado de proposito: com 68 graus os obstaculos a 30 unidades ficam
  // colados no ponto de fuga e o jogador quase nao tem tempo de ler a pista.
  fov: 60,
  perto: 0.1,
  longe: 220,
  // Camera alta e mergulhada: a pista se espalha na vertical e o jogador
  // le os obstaculos com antecedencia em vez de ve-los brotar do horizonte.
  altura: 4.4,
  recuo: 6.5,
  alvoAltura: 0.5,
  alvoFrente: -16
};

export const FOG = { perto: 46, longe: 138 };

/** Distancia (em unidades de mundo) em que as coisas nascem a frente. */
export const DIST_SPAWN = 128;
/** Atras deste z o objeto ja passou pela camera e volta pro pool.
    Fica logo depois da camera (que esta em CAMERA.recuo) para que nada
    apareca gigante e borrado no canto da tela depois de ultrapassado. */
export const Z_RECICLA = 9;

/* -------------------------------------------------------------------------
   MOVIMENTO DO JOGADOR
   ------------------------------------------------------------------------- */
export const JOGADOR = {
  meiaLargura: 0.42,
  meiaProfundidade: 0.5,
  alturaEmPe: 1.62,
  alturaDeslize: 0.72,
  gravidade: 48,
  impulsoPulo: 12.2,
  duracaoDeslize: 0.55,
  invulneravel: 1.5,          // segundos apos perder o escudo
  inclinacaoMax: 0.42         // radianos ao trocar de pista
};

/* -------------------------------------------------------------------------
   DIFICULDADE
   A curva e suave e tem teto: passado DIST_TETO nada mais acelera.
   ------------------------------------------------------------------------- */
export const VELOCIDADE_INICIAL = 21;
export const VELOCIDADE_MAXIMA = 45;
export const DIST_TETO = 3200;           // metros ate a dificuldade estabilizar

/**
 * Respiro entre dois padroes, em SEGUNDOS (nao em unidades).
 * Medir em unidades foi o que deixou o jogo punitivo: a mesma folga vale
 * o dobro de tempo na velocidade inicial e some quando o jogo acelera.
 */
export const GAP_TEMPO_INICIAL = 1.4;
export const GAP_TEMPO_FINAL = 0.82;

/**
 * Quanto os z internos de um padrao sao esticados conforme a dificuldade.
 * 1.0 = como escrito no catalogo. Acima disso, as camadas se afastam para
 * compensar a velocidade e manter o intervalo de decisao humano.
 */
export const ESPACAMENTO_INICIAL = 1.0;
export const ESPACAMENTO_FINAL = 1.5;

/* -------------------------------------------------------------------------
   PONTUACAO
   ------------------------------------------------------------------------- */
export const PONTOS = {
  porMetro: 1,
  poeira: 50,
  quaseAcidente: 25,
  degrausCombo: [1, 2, 3, 5, 8],
  janelaCombo: 3.0,            // segundos sem coletar -> combo quebra
  margemQuaseAcidente: 0.62    // folga lateral que conta como "raspou"
};

/* -------------------------------------------------------------------------
   POWER-UPS
   ------------------------------------------------------------------------- */
export const POWERUPS = {
  escudo:    { duracao: 0,   rotulo: 'BOLHA',      cor: 0x22e6ff, classe: 'escudo' },
  ima:       { duracao: 6.0, rotulo: 'IMA',        cor: 0xffd23f, classe: 'ima' },
  tempo:     { duracao: 4.0, rotulo: 'DILATACAO',  cor: 0x9a7bff, classe: 'tempo' },
  supernova: { duracao: 6.0, rotulo: 'SUPERNOVA',  cor: 0xff2f87, classe: 'supernova' }
};
export const COOLDOWN_POWERUP = 17;      // segundos entre dois power-ups
export const DIST_PRIMEIRO_POWERUP = 260;
export const RAIO_IMA = 9.5;
export const FATOR_DILATACAO = 0.55;     // camera lenta

/* -------------------------------------------------------------------------
   BURACO NEGRO (evento de ambiente)
   ------------------------------------------------------------------------- */
export const BURACO_NEGRO = {
  distMinima: 520,             // metros antes do primeiro
  intervaloMin: 26,            // segundos
  intervaloMax: 48,
  puxaoMax: 0.46,              // deslocamento lateral maximo (unidades)
  alcance: 46,                 // distancia em z na qual a forca age
  lateral: 15                  // quao longe do centro da pista ele fica
};

/* -------------------------------------------------------------------------
   ATTRACT MODE
   ------------------------------------------------------------------------- */
export const SEGUNDOS_ATE_ATTRACT = 60;
/**
 * Dentro do attract, quantos segundos parados ate o menu sair da frente e
 * deixar a partida do bot ocupar a tela inteira (modo vitrine). Qualquer
 * tecla traz o menu de volta; ENTER comeca a partida direto.
 */
export const SEGUNDOS_ATE_VITRINE = 30;
export const INTERVALO_CAMERA_CINEMA = 11;   // segundos entre tomadas do bot

/* -------------------------------------------------------------------------
   GOVERNADOR DE QUALIDADE
   ------------------------------------------------------------------------- */
export const GOVERNADOR = {
  limiteAmarelo: 45,
  tempoAmarelo: 3,
  limiteVermelho: 30,
  tempoVermelho: 5
};

/** Sugestoes de apelido geradas quando o jogador ainda nao tem um. */
export const SUGESTOES_NICK = [
  'NeonFox', 'AstroByte', 'VoidRunner', 'PixelNova', 'OrbitaZero', 'LuaCrua',
  'CometaX', 'Quasar', 'Nebulosa', 'FotonBR', 'GravidadeZ', 'SolarPunk',
  'AnelDeGas', 'Meteorito', 'CianoWave', 'Estelar'
];
