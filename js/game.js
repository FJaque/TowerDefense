/* ============================================================
   Motor del juego: bucle, oleadas, entrada y renderizado
   ============================================================ */
(function () {
  const TD = (window.TD = window.TD || {});
  const CELL = TD.CELL;

  class Game {
    /**
     * @param levelIndex índice del nivel (0..n)
     * @param ui callbacks: sync(game), onEnd(game, won)
     */
    constructor(canvas, levelIndex, ui, diffKey) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.levelIndex = levelIndex;
      this.level = TD.LEVELS[levelIndex];
      this.ui = ui;
      this.diffKey = diffKey && TD.DIFFICULTIES[diffKey] ? diffKey : 'normal';
      this.diff = TD.DIFFICULTIES[this.diffKey];

      // en pantallas verticales se gira la cuadrícula (8x14 en vez de 14x8)
      this.portrait = window.innerHeight > window.innerWidth;
      this.cols = this.portrait ? TD.ROWS : TD.COLS;
      this.rows = this.portrait ? TD.COLS : TD.ROWS;
      this.w = this.cols * CELL;
      this.h = this.rows * CELL;

      // caminos en px y celdas de camino (transpuestos si es vertical)
      this.levelPaths = this.level.paths.map((wps) =>
        wps.map(([c, r]) => (this.portrait ? [r, c] : [c, r]))
      );
      this.paths = this.levelPaths.map((wps) => this.expandPath(wps));
      this.pathCells = new Set();
      for (const p of this.paths) for (const c of p.cells) this.pathCells.add(c);
      const lastWp = this.levelPaths[0][this.levelPaths[0].length - 1];
      this.houseCell = { col: lastWp[0], row: lastWp[1] };

      // estado (ajustado por dificultad)
      this.hpMult = this.level.hpMult * this.diff.hp;
      this.money = Math.round(this.level.money * this.diff.money);
      this.lives = this.diff.lives;
      this.maxLives = this.lives;
      this.enemies = [];
      this.towers = [];
      this.projectiles = [];
      this.particles = [];
      this.time = 0;
      this.speed = 1;
      this.paused = false;
      this.state = 'prep'; // prep | wave | won | lost
      this.waveIdx = -1;   // oleada actual (0-based); -1 = antes de la primera
      this.countdown = 9;  // segundos hasta la primera oleada
      this.spawners = [];
      this.houseShake = 0;

      // interacción
      this.placing = null;       // clave de torre en colocación
      this.hoverCell = null;     // {col,row}
      this.previewCell = null;   // celda con vista previa confirmable (táctil)
      this.selectedTower = null;
      this.isCoarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

      this.bgCanvas = this.makeBackground();
      this._raf = null;
      this._lastT = 0;
      this._destroyed = false;
    }

    /* ---------- geometría del camino ---------- */
    expandPath(wps) {
      const cells = [];
      const pts = wps.map(([c, r]) => ({ x: c * CELL + CELL / 2, y: r * CELL + CELL / 2 }));
      for (let i = 0; i < wps.length - 1; i++) {
        let [c0, r0] = wps[i];
        const [c1, r1] = wps[i + 1];
        const dc = Math.sign(c1 - c0), dr = Math.sign(r1 - r0);
        cells.push(`${c0},${r0}`);
        while (c0 !== c1 || r0 !== r1) {
          c0 += dc; r0 += dr;
          cells.push(`${c0},${r0}`);
        }
      }
      return { pts, cells };
    }

    isPath(col, row) { return this.pathCells.has(`${col},${row}`); }

    canBuild(col, row) {
      if (col < 0 || row < 0 || col >= this.cols || row >= this.rows) return false;
      if (this.isPath(col, row)) return false;
      return !this.towers.some((t) => t.col === col && t.row === row);
    }

    towerAt(col, row) {
      return this.towers.find((t) => t.col === col && t.row === row) || null;
    }

    /* ---------- bucle principal ---------- */
    start() {
      this._lastT = performance.now();
      const loop = (now) => {
        if (this._destroyed) return;
        let dt = Math.min(0.05, (now - this._lastT) / 1000);
        this._lastT = now;
        if (!this.paused && this.state !== 'won' && this.state !== 'lost') {
          for (let i = 0; i < this.speed; i++) this.update(dt);
        }
        this.render(now / 1000);
        this.ui.sync(this);
        this._raf = requestAnimationFrame(loop);
      };
      this._raf = requestAnimationFrame(loop);
    }

    destroy() {
      this._destroyed = true;
      if (this._raf) cancelAnimationFrame(this._raf);
    }

    /* ---------- lógica ---------- */
    update(dt) {
      this.time += dt;

      if (this.state === 'prep') {
        this.countdown -= dt;
        if (this.countdown <= 0) this.startWave();
      } else if (this.state === 'wave') {
        // generar zombis
        let active = false;
        for (const sp of this.spawners) {
          if (sp.spawned >= sp.n) continue;
          active = true;
          sp.timer -= dt;
          if (sp.timer <= 0) {
            sp.spawned++;
            sp.timer = sp.gap;
            const path = this.paths[Math.min(sp.p, this.paths.length - 1)];
            this.enemies.push(new TD.Enemy(sp.t, this.hpMult, path.pts));
          }
        }
        // ¿oleada terminada?
        if (!active && this.enemies.length === 0) {
          const bonus = 25 + this.waveIdx * 6;
          this.addMoney(bonus, this.w / 2, this.h / 2 - 40);
          if (this.waveIdx >= this.level.waves.length - 1) {
            this.state = 'won';
            TD.audio.win();
            this.ui.onEnd(this, true);
            return;
          }
          this.state = 'prep';
          this.countdown = 11;
        }
      }

      // entidades
      for (const t of this.towers) t.update(dt, this);
      for (const e of this.enemies) {
        e.update(dt, this.time);
        if (e.dead && !e.counted) this.onEnemyKilled(e);
        if (e.reached && !e.counted) {
          e.counted = true;
          this.lives -= e.dmg;
          this.houseShake = 0.5;
          TD.audio.lifeLost();
          if (this.lives <= 0) {
            this.lives = 0;
            this.state = 'lost';
            TD.audio.lose();
            this.ui.onEnd(this, false);
          }
        }
      }
      this.enemies = this.enemies.filter((e) => !e.dead && !e.reached);

      for (const p of this.projectiles) p.update(dt, this);
      this.projectiles = this.projectiles.filter((p) => !p.dead);

      for (const p of this.particles) p.update(dt);
      this.particles = this.particles.filter((p) => !p.dead);

      if (this.houseShake > 0) this.houseShake -= dt;
    }

    startWave() {
      this.waveIdx++;
      this.state = 'wave';
      this.spawners = this.level.waves[this.waveIdx].map((gr) => ({
        ...gr,
        spawned: 0,
        timer: gr.delay,
      }));
      TD.audio.wave();
    }

    callWaveEarly() {
      if (this.state !== 'prep') return;
      const bonus = Math.max(0, Math.floor(this.countdown) * 2);
      if (this.waveIdx >= 0 && bonus > 0) {
        this.addMoney(bonus, this.w / 2, this.h / 2 - 40);
      }
      this.countdown = 0;
    }

    onEnemyKilled(e) {
      if (e.counted) return;
      e.counted = true;
      this.addMoney(e.reward, e.x, e.y - 20);
      this.addParticle(new TD.Particle('splat', e.x, e.y, {}));
      TD.audio.death();
    }

    addMoney(amount, x, y) {
      this.money += amount;
      if (x != null) {
        this.addParticle(new TD.Particle('text', x, y, { text: `+${amount}`, color: '#e8a10a' }));
      }
    }

    addParticle(p) {
      if (this.particles.length < 120) this.particles.push(p);
    }

    /* ---------- acciones del jugador ---------- */
    beginPlacing(key) {
      this.placing = key;
      this.selectedTower = null;
      this.previewCell = null;
    }

    cancelPlacing() {
      this.placing = null;
      this.previewCell = null;
      this.hoverCell = null;
    }

    tryPlace(col, row) {
      const def = TD.TOWERS[this.placing];
      if (!def || this.money < def.cost || !this.canBuild(col, row)) return false;
      this.money -= def.cost;
      this.towers.push(new TD.Tower(this.placing, col, row));
      TD.audio.place();
      this.previewCell = null;
      // en escritorio seguimos colocando si alcanza el dinero; en táctil salimos
      if (this.isCoarse || this.money < def.cost) this.placing = null;
      return true;
    }

    upgradeSelected() {
      const t = this.selectedTower;
      if (!t) return;
      const c = t.upgradeCost;
      if (c == null || this.money < c) return;
      this.money -= c;
      t.upgrade();
      TD.audio.upgrade();
      this.addParticle(new TD.Particle('text', t.x, t.y - 34, { text: '¡Mejorada!', color: '#4c9a3f' }));
    }

    sellSelected() {
      const t = this.selectedTower;
      if (!t) return;
      this.addMoney(t.sellValue, t.x, t.y - 20);
      this.towers = this.towers.filter((x) => x !== t);
      this.selectedTower = null;
      TD.audio.sell();
    }

    /* entrada: coordenadas lógicas del canvas */
    onPointerMove(x, y) {
      if (this.placing && !this.isCoarse) {
        this.hoverCell = { col: Math.floor(x / CELL), row: Math.floor(y / CELL) };
      }
    }

    onTap(x, y) {
      const col = Math.floor(x / CELL);
      const row = Math.floor(y / CELL);

      if (this.placing) {
        if (this.isCoarse) {
          // táctil: primer toque = vista previa con rango, segundo = colocar
          if (this.previewCell && this.previewCell.col === col && this.previewCell.row === row) {
            this.tryPlace(col, row);
          } else if (this.canBuild(col, row)) {
            this.previewCell = { col, row };
            TD.audio.click();
          } else {
            this.previewCell = null;
          }
        } else {
          this.tryPlace(col, row);
        }
        return;
      }

      const t = this.towerAt(col, row);
      if (t) {
        this.selectedTower = this.selectedTower === t ? null : t;
        TD.audio.click();
      } else {
        this.selectedTower = null;
      }
    }

    /* ---------- renderizado ---------- */
    makeBackground() {
      const c = document.createElement('canvas');
      c.width = this.w;
      c.height = this.h;
      const ctx = c.getContext('2d');
      const rnd = TD.mulberry32(this.level.seed);

      // pradera a cuadros suaves
      for (let r = 0; r < this.rows; r++) {
        for (let cc = 0; cc < this.cols; cc++) {
          ctx.fillStyle = (r + cc) % 2 === 0 ? '#b5d99a' : '#a9d18c';
          ctx.fillRect(cc * CELL, r * CELL, CELL, CELL);
        }
      }

      // camino de tierra clarita
      for (const key of this.pathCells) {
        const [cc, r] = key.split(',').map(Number);
        ctx.fillStyle = '#e6cfa3';
        ctx.fillRect(cc * CELL, r * CELL, CELL, CELL);
      }
      // borde del camino
      ctx.strokeStyle = '#d4b988';
      ctx.lineWidth = 3;
      for (const key of this.pathCells) {
        const [cc, r] = key.split(',').map(Number);
        const neighbors = [[0, -1], [0, 1], [-1, 0], [1, 0]];
        for (const [dc, dr] of neighbors) {
          if (!this.pathCells.has(`${cc + dc},${r + dr}`)) {
            ctx.beginPath();
            if (dc === -1) { ctx.moveTo(cc * CELL + 1.5, r * CELL); ctx.lineTo(cc * CELL + 1.5, r * CELL + CELL); }
            if (dc === 1) { ctx.moveTo(cc * CELL + CELL - 1.5, r * CELL); ctx.lineTo(cc * CELL + CELL - 1.5, r * CELL + CELL); }
            if (dr === -1) { ctx.moveTo(cc * CELL, r * CELL + 1.5); ctx.lineTo(cc * CELL + CELL, r * CELL + 1.5); }
            if (dr === 1) { ctx.moveTo(cc * CELL, r * CELL + CELL - 1.5); ctx.lineTo(cc * CELL + CELL, r * CELL + CELL - 1.5); }
            ctx.stroke();
          }
        }
      }
      // huellas / piedritas en el camino
      ctx.fillStyle = 'rgba(180,150,105,0.5)';
      for (const key of this.pathCells) {
        const [cc, r] = key.split(',').map(Number);
        for (let i = 0; i < 2; i++) {
          if (rnd() < 0.5) {
            ctx.beginPath();
            ctx.arc(cc * CELL + 10 + rnd() * 44, r * CELL + 10 + rnd() * 44, 1.5 + rnd() * 2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // decoración en el césped (florecillas, matas)
      for (let r = 0; r < this.rows; r++) {
        for (let cc = 0; cc < this.cols; cc++) {
          if (this.isPath(cc, r)) continue;
          if (rnd() < 0.16) {
            const x = cc * CELL + 12 + rnd() * 40;
            const y = r * CELL + 12 + rnd() * 40;
            const kind = rnd();
            if (kind < 0.45) {
              // florecilla
              const colors = ['#f2b6c6', '#f7d774', '#c3a6e8', '#fefefe'];
              ctx.fillStyle = colors[Math.floor(rnd() * colors.length)];
              for (let i = 0; i < 5; i++) {
                const a = (i / 5) * Math.PI * 2;
                ctx.beginPath();
                ctx.ellipse(x + Math.cos(a) * 3.4, y + Math.sin(a) * 3.4, 2.6, 1.9, a, 0, Math.PI * 2);
                ctx.fill();
              }
              ctx.fillStyle = '#e8a10a';
              ctx.beginPath(); ctx.arc(x, y, 1.8, 0, Math.PI * 2); ctx.fill();
            } else if (kind < 0.8) {
              // mata de hierba
              ctx.strokeStyle = '#8fbf72';
              ctx.lineWidth = 1.6;
              for (let i = -2; i <= 2; i++) {
                ctx.beginPath();
                ctx.moveTo(x + i * 2, y + 4);
                ctx.quadraticCurveTo(x + i * 3, y - 2, x + i * 4, y - 5);
                ctx.stroke();
              }
            } else {
              // piedrecita
              ctx.fillStyle = '#c9cdb8';
              ctx.beginPath();
              ctx.ellipse(x, y, 4.5, 3.2, rnd(), 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
      }

      // entradas de zombis (portones oscuros) al inicio de cada camino
      for (const wps of this.levelPaths) {
        const [c0, r0] = wps[0];
        const x = c0 * CELL + CELL / 2, y = r0 * CELL + CELL / 2;
        ctx.fillStyle = '#6b5d52';
        TD.roundRect(ctx, x - 24, y - 26, 48, 48, 10);
        ctx.fill();
        ctx.fillStyle = '#4a4038';
        ctx.beginPath();
        ctx.ellipse(x, y + 4, 16, 19, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#efe6d8';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('¡GRR!', x, y - 30);
      }
      return c;
    }

    drawHouse(ctx, t) {
      const x = this.houseCell.col * CELL + CELL / 2;
      const y = this.houseCell.row * CELL + CELL / 2;
      const shake = this.houseShake > 0 ? Math.sin(t * 60) * 3 * this.houseShake : 0;
      ctx.save();
      ctx.translate(x + shake, y);
      // cuerpo
      ctx.fillStyle = '#f5e6c8';
      TD.roundRect(ctx, -24, -14, 48, 36, 4);
      ctx.fill();
      ctx.strokeStyle = '#d9c49a';
      ctx.lineWidth = 2;
      ctx.stroke();
      // tejado
      ctx.fillStyle = '#e2635f';
      ctx.beginPath();
      ctx.moveTo(-30, -12);
      ctx.lineTo(0, -34);
      ctx.lineTo(30, -12);
      ctx.closePath();
      ctx.fill();
      // puerta y ventana
      ctx.fillStyle = '#a9744c';
      TD.roundRect(ctx, -8, 2, 16, 20, 3);
      ctx.fill();
      ctx.fillStyle = '#9ad0ec';
      TD.roundRect(ctx, 10, -8, 11, 10, 2);
      ctx.fill();
      ctx.strokeStyle = '#f5e6c8';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(15.5, -8); ctx.lineTo(15.5, 2);
      ctx.moveTo(10, -3); ctx.lineTo(21, -3);
      ctx.stroke();
      // corazón si la casa está sana, humo si tocada
      if (this.lives > this.maxLives / 2) {
        const bob = Math.sin(t * 2) * 2;
        ctx.fillStyle = 'rgba(230,110,120,0.9)';
        ctx.font = '13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('❤', 0, -40 + bob);
      }
      ctx.restore();
    }

    render(t) {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.w, this.h);
      ctx.drawImage(this.bgCanvas, 0, 0);

      this.drawHouse(ctx, t);

      // rango de la torre seleccionada
      if (this.selectedTower) {
        this.drawRange(ctx, this.selectedTower.x, this.selectedTower.y, this.selectedTower.rangePx, true);
      }

      // entidades ordenadas por Y para profundidad
      const drawables = [...this.towers, ...this.enemies].sort((a, b) => a.y - b.y);
      for (const d of drawables) d.draw(ctx, t, d === this.selectedTower);

      for (const p of this.projectiles) p.draw(ctx);
      for (const p of this.particles) p.draw(ctx);

      // fantasma de colocación con círculo de rango
      const ghost = this.previewCell || (this.placing ? this.hoverCell : null);
      if (this.placing && ghost && ghost.col >= 0 && ghost.row >= 0 && ghost.col < this.cols && ghost.row < this.rows) {
        const def = TD.TOWERS[this.placing];
        const ok = this.canBuild(ghost.col, ghost.row) && this.money >= def.cost;
        const gx = ghost.col * CELL + CELL / 2;
        const gy = ghost.row * CELL + CELL / 2;
        if (def.levels[0].range > 0) {
          this.drawRange(ctx, gx, gy, def.levels[0].range * CELL, ok);
        }
        ctx.fillStyle = ok ? 'rgba(120,200,110,0.35)' : 'rgba(220,90,90,0.35)';
        ctx.fillRect(ghost.col * CELL, ghost.row * CELL, CELL, CELL);
        ctx.globalAlpha = 0.75;
        ctx.font = '34px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(def.icon, gx, gy);
        ctx.globalAlpha = 1;
        if (this.previewCell && ok) {
          ctx.fillStyle = 'rgba(60,120,50,0.92)';
          ctx.beginPath(); ctx.arc(gx, gy - 42, 13, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 14px sans-serif';
          ctx.fillText('✓', gx, gy - 41);
          ctx.font = 'bold 10px sans-serif';
          ctx.fillStyle = 'rgba(50,80,40,0.9)';
          ctx.fillText('toca de nuevo', gx, gy - 60);
        }
      }

      // aviso de estado en el propio canvas
      if (this.state === 'prep' && this.waveIdx < this.level.waves.length - 1) {
        const secs = Math.ceil(this.countdown);
        ctx.font = 'bold 17px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(70,90,60,0.85)';
        const label = this.waveIdx < 0
          ? `Primera oleada en ${secs}s — ¡planta tus defensas!`
          : `Siguiente oleada en ${secs}s`;
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth = 4;
        ctx.strokeText(label, this.w / 2, 30);
        ctx.fillText(label, this.w / 2, 30);
      }
    }

    drawRange(ctx, x, y, r, ok) {
      ctx.fillStyle = ok ? 'rgba(140,200,120,0.16)' : 'rgba(220,100,90,0.14)';
      ctx.strokeStyle = ok ? 'rgba(90,160,80,0.55)' : 'rgba(200,90,80,0.55)';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  TD.Game = Game;
})();
