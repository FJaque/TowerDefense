/* ============================================================
   UI: menú, mapa de niveles, HUD del juego y persistencia
   ============================================================ */
(function () {
  const TD = (window.TD = window.TD || {});
  const $ = (sel) => document.querySelector(sel);

  /* ---------- guardado ---------- */
  const SAVE_KEY = 'huerto-vs-zombis-save';
  const save = loadSave();
  function loadSave() {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (s && typeof s === 'object') return { unlocked: 1, stars: {}, muted: false, difficulty: 'normal', ...s };
    } catch (e) { /* guardado corrupto: se reinicia */ }
    return { unlocked: 1, stars: {}, muted: false, difficulty: 'normal' };
  }
  function persist() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* sin storage */ }
  }

  /* ---------- pantallas ---------- */
  let game = null;
  function show(id) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
    $(id).classList.add('active');
  }

  /* ---------- audio ---------- */
  function ensureAudio() {
    TD.audio.init();
    TD.audio.setMuted(save.muted);
    TD.audio.startMusic();
  }
  function updateMuteButtons() {
    document.querySelectorAll('.btn-mute').forEach((b) => {
      b.textContent = save.muted ? '🔇' : '🔊';
      b.setAttribute('aria-label', save.muted ? 'Activar sonido' : 'Silenciar');
    });
  }
  function toggleMute() {
    save.muted = !save.muted;
    persist();
    ensureAudio();
    updateMuteButtons();
  }

  /* ---------- menú principal ---------- */
  $('#btn-play').addEventListener('click', () => {
    ensureAudio();
    TD.audio.click();
    buildLevelMap();
    show('#screen-levels');
  });
  $('#btn-help').addEventListener('click', () => {
    ensureAudio();
    TD.audio.click();
    $('#overlay-help').classList.add('visible');
  });
  $('#help-close').addEventListener('click', () => {
    TD.audio.click();
    $('#overlay-help').classList.remove('visible');
  });
  document.querySelectorAll('.btn-mute').forEach((b) => b.addEventListener('click', toggleMute));
  $('#btn-reset').addEventListener('click', () => {
    if (confirm('¿Borrar todo el progreso guardado?')) {
      save.unlocked = 1; save.stars = {};
      persist();
      buildLevelMap();
    }
  });

  /* ---------- mapa de niveles ---------- */
  // posiciones (%) de cada nodo sobre el mapa, formando un caminito
  const NODE_POS = [
    [10, 78], [26, 64], [15, 44], [32, 27], [52, 36], [66, 58], [82, 72], [88, 34],
  ];

  function buildLevelMap() {
    const wrap = $('#level-nodes');
    wrap.innerHTML = '';

    // caminito punteado SVG
    const svg = $('#level-path');
    const pts = NODE_POS.map(([x, y]) => `${x},${y}`).join(' ');
    svg.innerHTML = `<polyline points="${pts}" fill="none" stroke="#d9c49a" stroke-width="2.6"
      stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="0.2 4.5" />`;

    TD.LEVELS.forEach((lv, i) => {
      const n = i + 1;
      const unlocked = n <= save.unlocked;
      const stars = save.stars[n] || 0;
      const el = document.createElement('button');
      el.className = 'level-node' + (unlocked ? '' : ' locked') + (stars ? ' done' : '');
      el.style.left = NODE_POS[i][0] + '%';
      el.style.top = NODE_POS[i][1] + '%';
      el.innerHTML = unlocked
        ? `<span class="num">${n}</span><span class="stars">${'★'.repeat(stars)}<span class="dim">${'★'.repeat(Math.max(0, 3 - stars))}</span></span>`
        : `<span class="num">🔒</span>`;
      el.title = unlocked ? `${n}. ${lv.name}` : 'Completa el nivel anterior para desbloquear';
      if (unlocked) {
        el.addEventListener('click', () => {
          TD.audio.click();
          startLevel(i);
        });
      }
      wrap.appendChild(el);

      const label = document.createElement('div');
      label.className = 'level-label' + (unlocked ? '' : ' locked');
      label.style.left = NODE_POS[i][0] + '%';
      label.style.top = NODE_POS[i][1] + '%';
      label.textContent = unlocked ? lv.name : '???';
      wrap.appendChild(label);
    });
  }

  $('#btn-levels-back').addEventListener('click', () => {
    TD.audio.click();
    show('#screen-menu');
  });

  /* ---------- selector de dificultad ---------- */
  const DIFF_HINTS = {
    facil: 'Zombis más débiles, más vidas y más dinero inicial.',
    normal: 'La experiencia equilibrada de siempre.',
    dificil: 'Zombis más duros, menos vidas y menos dinero. ¡Para valientes!',
  };
  function refreshDifficulty() {
    if (!TD.DIFFICULTIES[save.difficulty]) save.difficulty = 'normal';
    document.querySelectorAll('.diff-btn').forEach((b) => {
      b.classList.toggle('selected', b.dataset.diff === save.difficulty);
    });
    $('#diff-hint').textContent = DIFF_HINTS[save.difficulty];
  }
  document.querySelectorAll('.diff-btn').forEach((b) => {
    b.addEventListener('click', () => {
      TD.audio.click();
      save.difficulty = b.dataset.diff;
      persist();
      refreshDifficulty();
    });
  });
  refreshDifficulty();

  /* ---------- juego ---------- */
  const canvas = $('#game-canvas');
  let lastHud = {};

  function startLevel(index) {
    if (game) game.destroy();
    lastHud = {};
    game = new TD.Game(canvas, index, { sync: syncHud, onEnd }, save.difficulty);
    TD._game = game; // referencia para depuración

    // ajustar resolución del canvas (nítido en pantallas retina)
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = game.w * dpr;
    canvas.height = game.h * dpr;
    canvas.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
    // la cuadrícula se gira en vertical: ajustar proporción del lienzo
    canvas.style.aspectRatio = `${game.cols} / ${game.rows}`;

    buildShop();
    $('#hud-level-name').textContent = `${index + 1}. ${game.level.name} ${game.diff.icon}`;
    $('#overlay-end').classList.remove('visible');
    $('#overlay-pause').classList.remove('visible');
    $('#tower-panel').classList.remove('visible');
    $('#shop-info').classList.remove('visible');
    show('#screen-game');
    game.start();
  }

  function buildShop() {
    const shop = $('#shop');
    shop.innerHTML = '';
    for (const key of game.level.towers) {
      const def = TD.TOWERS[key];
      const card = document.createElement('button');
      card.className = 'shop-card';
      card.dataset.key = key;
      card.innerHTML = `
        <span class="icon">${def.icon}</span>
        <span class="name">${def.name}</span>
        <span class="cost">💰${def.cost}</span>`;
      card.addEventListener('click', () => {
        ensureAudio();
        if (game.placing === key) {
          game.cancelPlacing();
          hideShopInfo();
        } else if (game.money >= def.cost) {
          TD.audio.click();
          game.beginPlacing(key);
          showShopInfo(key);
        }
        refreshShop();
      });
      shop.appendChild(card);
    }
  }

  function showShopInfo(key) {
    const def = TD.TOWERS[key];
    const l0 = def.levels[0];
    const rangeTxt = l0.range > 0 ? `${l0.range} celdas` : '—';
    $('#shop-info').innerHTML = `
      <b>${def.icon} ${def.name}</b> · ${def.desc}<br>
      <span class="pill">📏 Alcance: ${rangeTxt}</span>
      <span class="pill">⚡ ${def.statLine(l0)}</span>
      <span class="pill hint">${game.isCoarse ? 'Toca una celda para previsualizar el rango y vuelve a tocar para plantar' : 'Pasa el ratón para ver el rango y haz clic para plantar'}</span>`;
    $('#shop-info').classList.add('visible');
  }
  function hideShopInfo() { $('#shop-info').classList.remove('visible'); }

  function refreshShop() {
    document.querySelectorAll('.shop-card').forEach((card) => {
      const def = TD.TOWERS[card.dataset.key];
      card.classList.toggle('selected', game.placing === card.dataset.key);
      card.classList.toggle('disabled', game.money < def.cost);
    });
  }

  /* HUD: solo tocar el DOM cuando cambian los valores */
  function syncHud(g) {
    const hud = {
      money: g.money,
      lives: g.lives,
      wave: `${Math.min(g.level.waves.length, Math.max(1, g.waveIdx + 1 + (g.state === 'prep' && g.waveIdx >= 0 ? 1 : 0)))}/${g.level.waves.length}`,
      speed: g.speed,
      state: g.state,
      countdown: Math.ceil(g.countdown),
      placing: g.placing,
      selected: g.selectedTower ? g.selectedTower.id + '-' + g.selectedTower.level + '-' + g.money : null,
    };
    if (hud.money !== lastHud.money) $('#hud-money').textContent = `💰 ${hud.money}`;
    if (hud.lives !== lastHud.lives) {
      $('#hud-lives').textContent = `🏠 ${hud.lives}`;
      $('#hud-lives').classList.toggle('low', hud.lives <= 3);
    }
    if (hud.wave !== lastHud.wave) $('#hud-wave').textContent = `🧟 ${hud.wave}`;
    if (hud.speed !== lastHud.speed) $('#btn-speed').textContent = `▶ x${hud.speed}`;
    if (hud.money !== lastHud.money || hud.placing !== lastHud.placing) refreshShop();

    const showNext = g.state === 'prep' && g.waveIdx >= 0;
    if (showNext !== lastHud.showNext) $('#btn-next-wave').classList.toggle('visible', showNext);
    lastHud.showNext = showNext;

    if (hud.selected !== lastHud.selected) updateTowerPanel(g);
    if (hud.placing !== lastHud.placing && !hud.placing) hideShopInfo();
    Object.assign(lastHud, hud);
  }

  function updateTowerPanel(g) {
    const panel = $('#tower-panel');
    const t = g.selectedTower;
    if (!t) { panel.classList.remove('visible'); return; }
    const def = t.def;
    const st = t.stats;
    const maxed = t.upgradeCost == null;
    const nextSt = maxed ? null : def.levels[t.level + 1];
    const rangeTxt = st.range > 0 ? `${st.range}` : '—';
    panel.innerHTML = `
      <div class="tp-head">
        <span class="tp-icon">${def.icon}</span>
        <div>
          <b>${def.name}</b> <span class="tp-lvl">Nv. ${t.level + 1}/3</span><br>
          <small>${def.statLine(st)} · 📏 ${rangeTxt}</small>
        </div>
        <button id="tp-close" class="tp-close" aria-label="Cerrar">✕</button>
      </div>
      <div class="tp-actions">
        <button id="tp-upgrade" class="btn small ${maxed || g.money < t.upgradeCost ? 'disabled' : ''}">
          ${maxed ? 'Nivel MÁX' : `⬆ Mejorar 💰${t.upgradeCost}`}
        </button>
        <button id="tp-sell" class="btn small danger">Vender +💰${t.sellValue}</button>
      </div>
      ${nextSt ? `<small class="tp-next">Siguiente: ${def.statLine(nextSt)}${nextSt.range > 0 ? ` · 📏 ${nextSt.range}` : ''}</small>` : ''}`;
    panel.classList.add('visible');
    $('#tp-upgrade').addEventListener('click', () => { game.upgradeSelected(); });
    $('#tp-sell').addEventListener('click', () => { game.sellSelected(); });
    $('#tp-close').addEventListener('click', () => { game.selectedTower = null; TD.audio.click(); });
  }

  function onEnd(g, won) {
    const n = g.levelIndex + 1;
    let stars = 0;
    if (won) {
      stars = g.lives >= g.maxLives * 0.9 ? 3 : g.lives >= g.maxLives * 0.5 ? 2 : 1;
      save.stars[n] = Math.max(save.stars[n] || 0, stars);
      save.unlocked = Math.max(save.unlocked, Math.min(TD.LEVELS.length, n + 1));
      persist();
    }
    const hasNext = won && n < TD.LEVELS.length;
    $('#end-title').textContent = won ? '¡Nivel superado! 🎉' : 'Los zombis llegaron a casa… 🧟';
    $('#end-stars').innerHTML = won
      ? '★'.repeat(stars) + `<span class="dim">${'★'.repeat(3 - stars)}</span>`
      : '';
    $('#end-sub').textContent = won
      ? (hasNext ? '¡Se ha desbloqueado el siguiente nivel!' : '¡Has completado todos los niveles! Eres la leyenda del huerto. 🌻')
      : '¡Replantea tus defensas e inténtalo de nuevo!';
    $('#btn-end-next').style.display = hasNext ? '' : 'none';
    $('#overlay-end').classList.add('visible');
  }

  /* controles del HUD */
  $('#btn-speed').addEventListener('click', () => {
    TD.audio.click();
    game.speed = game.speed >= 3 ? 1 : game.speed + 1;
  });
  $('#btn-next-wave').addEventListener('click', () => {
    TD.audio.click();
    game.callWaveEarly();
  });
  $('#btn-pause').addEventListener('click', () => {
    TD.audio.click();
    game.paused = true;
    $('#overlay-pause').classList.add('visible');
  });
  $('#btn-resume').addEventListener('click', () => {
    TD.audio.click();
    game.paused = false;
    $('#overlay-pause').classList.remove('visible');
  });
  $('#btn-restart').addEventListener('click', () => {
    TD.audio.click();
    startLevel(game.levelIndex);
  });
  $('#btn-quit').addEventListener('click', () => {
    TD.audio.click();
    game.destroy();
    buildLevelMap();
    show('#screen-levels');
  });
  $('#btn-end-retry').addEventListener('click', () => {
    TD.audio.click();
    startLevel(game.levelIndex);
  });
  $('#btn-end-next').addEventListener('click', () => {
    TD.audio.click();
    startLevel(game.levelIndex + 1);
  });
  $('#btn-end-map').addEventListener('click', () => {
    TD.audio.click();
    game.destroy();
    buildLevelMap();
    show('#screen-levels');
  });

  /* entrada en el canvas: convierte coordenadas de pantalla a lógicas */
  function canvasCoords(ev) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((ev.clientX - rect.left) / rect.width) * game.w,
      y: ((ev.clientY - rect.top) / rect.height) * game.h,
    };
  }
  canvas.addEventListener('pointermove', (ev) => {
    if (!game) return;
    const { x, y } = canvasCoords(ev);
    game.onPointerMove(x, y);
  });
  canvas.addEventListener('pointerdown', (ev) => {
    if (!game) return;
    ensureAudio();
    ev.preventDefault();
    const { x, y } = canvasCoords(ev);
    game.onTap(x, y);
  });
  window.addEventListener('keydown', (ev) => {
    if (!game) return;
    if (ev.key === 'Escape') { game.cancelPlacing(); game.selectedTower = null; hideShopInfo(); }
  });

  updateMuteButtons();

  // primer gesto en cualquier parte arranca el audio (requisito móvil)
  document.addEventListener('pointerdown', ensureAudio, { once: true });
})();
