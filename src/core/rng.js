/* ==========================================================================
   RNG - gerador pseudoaleatorio com semente (mulberry32).
   Usado nas texturas procedurais para que um planeta "semente 7" seja
   sempre o mesmo planeta, e no spawner para dar pra reproduzir um bug.
   ========================================================================== */

export function criarRng(semente) {
  let a = semente >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Numero real em [min, max). */
export function entre(rng, min, max) {
  return min + rng() * (max - min);
}

/** Inteiro em [min, max]. */
export function inteiro(rng, min, max) {
  return Math.floor(min + rng() * (max - min + 1));
}

/** Escolhe um item de um array. */
export function escolher(rng, lista) {
  return lista[Math.floor(rng() * lista.length) % lista.length];
}

/**
 * Escolhe um item usando pesos (array de numeros do mesmo tamanho).
 */
export function escolherComPeso(rng, lista, pesos) {
  let total = 0;
  for (let i = 0; i < pesos.length; i++) total += pesos[i];
  let sorteio = rng() * total;
  for (let i = 0; i < lista.length; i++) {
    sorteio -= pesos[i];
    if (sorteio <= 0) return lista[i];
  }
  return lista[lista.length - 1];
}

/** Interpolacao linear. */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Prende um valor no intervalo. */
export function limitar(v, min, max) {
  return v < min ? min : (v > max ? max : v);
}

/** Suaviza um valor 0..1 (curva S). */
export function suavizar(t) {
  return t * t * (3 - 2 * t);
}

/**
 * Aproximacao de um lerp independente de framerate.
 * fator = quanto sobra do erro apos 1 segundo (ex.: 0.001 = bem rapido)
 */
export function amortecer(atual, alvo, fator, dt) {
  return alvo + (atual - alvo) * Math.pow(fator, dt);
}
