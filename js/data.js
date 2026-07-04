/* ============================================================
   Datos del juego: torres, enemigos y niveles
   ============================================================ */
(function () {
  const TD = (window.TD = window.TD || {});

  TD.CELL = 64; // tamaño lógico de celda en px
  TD.COLS = 14;
  TD.ROWS = 8;

  /* ---------- Torres (plantas) ---------- */
  // range se expresa en celdas. Cada torre tiene 3 niveles.
  TD.TOWERS = {
    girasol: {
      name: 'Girasol',
      icon: '🌻',
      desc: 'Genera soles (monedas) cada pocos segundos. ¡La base de tu economía!',
      cost: 50,
      upCosts: [60, 110],
      levels: [
        { range: 0, gen: 25, genRate: 7 },
        { range: 0, gen: 40, genRate: 7 },
        { range: 0, gen: 60, genRate: 6 },
      ],
      statLine: (l) => `+${l.gen}💰 cada ${l.genRate}s`,
    },
    lanzaguisantes: {
      name: 'Lanzaguisantes',
      icon: '🫛',
      desc: 'Dispara guisantes al zombi más avanzado. Fiable y económico.',
      cost: 100,
      upCosts: [80, 140],
      levels: [
        { range: 2.6, dmg: 20, rate: 0.75 },
        { range: 2.8, dmg: 32, rate: 0.7 },
        { range: 3.0, dmg: 50, rate: 0.6 },
      ],
      statLine: (l) => `${l.dmg} daño / ${l.rate}s`,
    },
    mentahelada: {
      name: 'Menta Helada',
      icon: '🌿',
      desc: 'Aura de frío: ralentiza a todos los zombis cercanos y les hace un poco de daño.',
      cost: 120,
      upCosts: [90, 150],
      levels: [
        { range: 2.0, slow: 0.35, dmg: 6, rate: 1.5 },
        { range: 2.3, slow: 0.45, dmg: 10, rate: 1.4 },
        { range: 2.6, slow: 0.55, dmg: 16, rate: 1.2 },
      ],
      statLine: (l) => `Ralentiza ${Math.round(l.slow * 100)}%`,
    },
    bocadragon: {
      name: 'Boca de Dragón',
      icon: '🌺',
      desc: 'Escupe fuego con daño en área. Ideal contra grupos apretados.',
      cost: 175,
      upCosts: [130, 220],
      levels: [
        { range: 1.9, dmg: 30, rate: 1.1, splash: 0.95 },
        { range: 2.1, dmg: 48, rate: 1.0, splash: 1.05 },
        { range: 2.3, dmg: 75, rate: 0.9, splash: 1.2 },
      ],
      statLine: (l) => `${l.dmg} daño en área`,
    },
    setavenenosa: {
      name: 'Seta Venenosa',
      icon: '🍄',
      desc: 'Sus esporas envenenan: daño mantenido durante varios segundos.',
      cost: 150,
      upCosts: [110, 190],
      levels: [
        { range: 2.4, dmg: 10, rate: 1.4, poisonDps: 9, poisonDur: 4 },
        { range: 2.6, dmg: 14, rate: 1.3, poisonDps: 14, poisonDur: 4.5 },
        { range: 2.9, dmg: 20, rate: 1.2, poisonDps: 20, poisonDur: 5 },
      ],
      statLine: (l) => `${l.dmg} + ${l.poisonDps}/s veneno`,
    },
    cactus: {
      name: 'Cactus',
      icon: '🌵',
      desc: 'Francotirador del desierto: enorme alcance y mucho daño, pero lento.',
      cost: 200,
      upCosts: [160, 260],
      levels: [
        { range: 4.2, dmg: 90, rate: 2.2 },
        { range: 4.6, dmg: 150, rate: 2.0 },
        { range: 5.0, dmg: 240, rate: 1.8 },
      ],
      statLine: (l) => `${l.dmg} daño / ${l.rate}s`,
    },
  };

  TD.SELL_RATIO = 0.7;

  /* ---------- Enemigos (zombis) ---------- */
  // speed en px/s (a escala de celda 64), dmg = vidas que quita al llegar
  TD.ENEMIES = {
    normal:   { name: 'Zombi',          hp: 100,  speed: 42, reward: 20,  dmg: 1, radius: 15, scale: 1.0 },
    cono:     { name: 'Zombi Cono',     hp: 220,  speed: 38, reward: 30,  dmg: 1, radius: 15, scale: 1.0 },
    corredor: { name: 'Zombi Corredor', hp: 85,   speed: 88, reward: 25,  dmg: 1, radius: 13, scale: 0.9 },
    cubo:     { name: 'Zombi Cubo',     hp: 520,  speed: 32, reward: 45,  dmg: 2, radius: 16, scale: 1.05 },
    gigante:  { name: 'Zombi Gigante',  hp: 1500, speed: 22, reward: 120, dmg: 5, radius: 22, scale: 1.5 },
  };

  /* ---------- Niveles ---------- */
  // g(tipo, cantidad, separación_s, retraso_s, camino)
  const g = (t, n, gap, delay, p) => ({ t, n, gap: gap || 1.2, delay: delay || 0, p: p || 0 });

  TD.LEVELS = [
    {
      name: 'El Jardín',
      subtitle: 'Los primeros zombis huelen tus tomates…',
      seed: 11,
      paths: [[[0, 4], [4, 4], [4, 2], [9, 2], [9, 5], [13, 5]]],
      towers: ['girasol', 'lanzaguisantes'],
      money: 220, lives: 10, hpMult: 1.0,
      waves: [
        [g('normal', 4, 1.5)],
        [g('normal', 6, 1.1)],
        [g('normal', 5, 1.0), g('cono', 2, 2.5, 5)],
        [g('normal', 8, 0.9), g('cono', 3, 2.2, 6)],
        [g('cono', 5, 1.6), g('normal', 7, 0.8, 3)],
      ],
    },
    {
      name: 'El Huerto',
      subtitle: 'Aparecen zombis rápidos. ¡Prueba la Menta Helada!',
      seed: 22,
      paths: [[[0, 1], [11, 1], [11, 6], [0, 6]]],
      towers: ['girasol', 'lanzaguisantes', 'mentahelada'],
      money: 240, lives: 10, hpMult: 1.15,
      waves: [
        [g('normal', 6, 1.2)],
        [g('normal', 5, 1.0), g('cono', 3, 2.0, 4)],
        [g('corredor', 4, 1.0), g('normal', 5, 1.1, 3)],
        [g('cono', 5, 1.6), g('corredor', 4, 0.9, 5)],
        [g('normal', 10, 0.7), g('cono', 4, 1.8, 4)],
        [g('cono', 6, 1.4), g('corredor', 6, 0.8, 4), g('normal', 6, 0.9, 8)],
      ],
    },
    {
      name: 'El Bosquecito',
      subtitle: 'Zombis con cubo: duros de pelar. La Boca de Dragón ayuda.',
      seed: 33,
      paths: [[[0, 6], [3, 6], [3, 1], [7, 1], [7, 6], [11, 6], [11, 1], [13, 1]]],
      towers: ['girasol', 'lanzaguisantes', 'mentahelada', 'bocadragon'],
      money: 260, lives: 10, hpMult: 1.3,
      waves: [
        [g('normal', 7, 1.1)],
        [g('cono', 4, 1.6), g('corredor', 4, 0.9, 4)],
        [g('normal', 9, 0.8), g('cono', 4, 1.6, 5)],
        [g('cubo', 2, 3.0), g('normal', 7, 0.9, 3)],
        [g('corredor', 8, 0.7), g('cono', 5, 1.5, 5)],
        [g('cubo', 3, 2.5), g('corredor', 6, 0.8, 5)],
        [g('cubo', 3, 2.2), g('cono', 8, 1.2, 4), g('corredor', 6, 0.7, 10)],
      ],
    },
    {
      name: 'La Pradera',
      subtitle: 'La horda crece. Las esporas venenosas hacen su magia.',
      seed: 44,
      paths: [[[6, 0], [6, 5], [2, 5], [2, 2], [11, 2], [11, 6], [13, 6]]],
      towers: ['girasol', 'lanzaguisantes', 'mentahelada', 'bocadragon', 'setavenenosa'],
      money: 280, lives: 10, hpMult: 1.5,
      waves: [
        [g('normal', 8, 1.0)],
        [g('cono', 5, 1.4), g('corredor', 5, 0.8, 4)],
        [g('cubo', 2, 2.5), g('normal', 8, 0.8, 3)],
        [g('corredor', 10, 0.6)],
        [g('cono', 7, 1.2), g('cubo', 2, 2.5, 6)],
        [g('normal', 12, 0.6), g('cono', 5, 1.3, 5)],
        [g('cubo', 4, 2.0), g('corredor', 8, 0.7, 6)],
        [g('cubo', 4, 1.8), g('cono', 8, 1.1, 5), g('corredor', 8, 0.6, 12)],
      ],
    },
    {
      name: 'Dos Senderos',
      subtitle: '¡Dos caminos! Y algo enorme se acerca… El Cactus llega al rescate.',
      seed: 55,
      paths: [
        [[0, 2], [5, 2], [5, 5], [13, 5]],
        [[0, 7], [9, 7], [9, 5], [13, 5]],
      ],
      towers: ['girasol', 'lanzaguisantes', 'mentahelada', 'bocadragon', 'setavenenosa', 'cactus'],
      money: 320, lives: 10, hpMult: 1.7,
      waves: [
        [g('normal', 5, 1.1, 0, 0), g('normal', 5, 1.1, 2, 1)],
        [g('cono', 4, 1.5, 0, 0), g('corredor', 5, 0.8, 3, 1)],
        [g('cubo', 2, 2.5, 0, 1), g('normal', 8, 0.8, 2, 0)],
        [g('corredor', 7, 0.7, 0, 0), g('corredor', 7, 0.7, 2, 1)],
        [g('cono', 6, 1.2, 0, 1), g('cubo', 3, 2.2, 4, 0)],
        [g('normal', 10, 0.6, 0, 0), g('cono', 6, 1.2, 3, 1), g('cubo', 2, 2.5, 8, 0)],
        [g('cubo', 4, 1.8, 0, 0), g('corredor', 10, 0.6, 4, 1)],
        [g('gigante', 1, 1, 0, 0), g('cono', 8, 1.1, 4, 1), g('corredor', 8, 0.6, 10, 0)],
      ],
    },
    {
      name: 'La Colina',
      subtitle: 'Un camino larguísimo… y una horda igual de larga.',
      seed: 66,
      paths: [[[0, 1], [12, 1], [12, 3], [1, 3], [1, 5], [12, 5], [12, 7]]],
      towers: ['girasol', 'lanzaguisantes', 'mentahelada', 'bocadragon', 'setavenenosa', 'cactus'],
      money: 340, lives: 10, hpMult: 1.9,
      waves: [
        [g('normal', 9, 0.9)],
        [g('cono', 6, 1.3), g('corredor', 6, 0.7, 4)],
        [g('cubo', 3, 2.2), g('normal', 9, 0.8, 3)],
        [g('corredor', 12, 0.55)],
        [g('cono', 8, 1.1), g('cubo', 3, 2.0, 6)],
        [g('gigante', 1, 1), g('normal', 10, 0.7, 4)],
        [g('cubo', 5, 1.7), g('corredor', 9, 0.6, 6)],
        [g('cono', 10, 1.0), g('cubo', 4, 1.8, 6)],
        [g('gigante', 2, 8), g('cono', 8, 1.0, 4), g('corredor', 10, 0.55, 12)],
      ],
    },
    {
      name: 'El Pantano',
      subtitle: 'Dos senderos embarrados y zombis por todas partes.',
      seed: 77,
      paths: [
        [[0, 1], [6, 1], [6, 6], [13, 6]],
        [[0, 6], [3, 6], [3, 3], [10, 3], [10, 6], [13, 6]],
      ],
      towers: ['girasol', 'lanzaguisantes', 'mentahelada', 'bocadragon', 'setavenenosa', 'cactus'],
      money: 380, lives: 10, hpMult: 2.1,
      waves: [
        [g('normal', 6, 1.0, 0, 0), g('normal', 6, 1.0, 2, 1)],
        [g('corredor', 6, 0.7, 0, 0), g('cono', 5, 1.3, 2, 1)],
        [g('cubo', 3, 2.0, 0, 1), g('normal', 9, 0.7, 2, 0)],
        [g('corredor', 8, 0.6, 0, 0), g('corredor', 8, 0.6, 1, 1)],
        [g('cono', 7, 1.1, 0, 0), g('cubo', 3, 2.0, 5, 1)],
        [g('normal', 12, 0.55, 0, 1), g('cono', 7, 1.1, 3, 0)],
        [g('cubo', 5, 1.6, 0, 0), g('corredor', 10, 0.55, 4, 1)],
        [g('gigante', 1, 1, 0, 1), g('cono', 9, 1.0, 4, 0)],
        [g('cubo', 5, 1.5, 0, 1), g('cono', 9, 0.9, 3, 0), g('corredor', 10, 0.5, 10, 1)],
        [g('gigante', 2, 9, 0, 0), g('cubo', 4, 1.6, 4, 1), g('corredor', 12, 0.5, 12, 0)],
      ],
    },
    {
      name: 'La Última Defensa',
      subtitle: 'Toda la horda contra tu casa. ¡Que no pase ni uno!',
      seed: 88,
      paths: [[[0, 0], [12, 0], [12, 2], [1, 2], [1, 4], [12, 4], [12, 6], [0, 6]]],
      towers: ['girasol', 'lanzaguisantes', 'mentahelada', 'bocadragon', 'setavenenosa', 'cactus'],
      money: 420, lives: 10, hpMult: 2.4,
      waves: [
        [g('normal', 10, 0.8)],
        [g('cono', 7, 1.2), g('corredor', 7, 0.6, 4)],
        [g('cubo', 4, 1.8), g('normal', 10, 0.7, 3)],
        [g('corredor', 14, 0.5)],
        [g('cono', 9, 1.0), g('cubo', 4, 1.8, 6)],
        [g('gigante', 1, 1), g('corredor', 8, 0.6, 5)],
        [g('normal', 16, 0.45), g('cono', 8, 1.0, 5)],
        [g('cubo', 6, 1.4), g('corredor', 10, 0.5, 6)],
        [g('gigante', 2, 10), g('cono', 10, 0.9, 5)],
        [g('cubo', 7, 1.3), g('cono', 10, 0.9, 4), g('corredor', 12, 0.45, 10)],
        [g('gigante', 2, 8), g('cubo', 5, 1.5, 5), g('corredor', 12, 0.45, 12)],
        [g('gigante', 3, 7), g('cubo', 6, 1.3, 6), g('cono', 12, 0.8, 10), g('corredor', 14, 0.4, 18)],
      ],
    },
  ];

  /* PRNG determinista para la decoración de cada mapa */
  TD.mulberry32 = function (a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
})();
