/* ============================================================
   Entidades: Enemy (zombi), Tower (planta), Projectile, Particle
   ============================================================ */
(function () {
  const TD = (window.TD = window.TD || {});
  const CELL = TD.CELL;

  let ENTITY_ID = 1;

  /* =============== ZOMBI =============== */
  class Enemy {
    constructor(type, hpMult, waypoints) {
      const def = TD.ENEMIES[type];
      this.id = ENTITY_ID++;
      this.type = type;
      this.def = def;
      this.maxHp = Math.round(def.hp * hpMult);
      this.hp = this.maxHp;
      this.baseSpeed = def.speed;
      this.reward = Math.round(def.reward * (1 + (hpMult - 1) * 0.6));
      this.dmg = def.dmg;
      this.radius = def.radius;
      this.scale = def.scale;
      this.waypoints = waypoints;
      this.wpIndex = 1;
      this.x = waypoints[0].x;
      this.y = waypoints[0].y;
      this.dist = 0;          // distancia recorrida (para priorizar objetivos)
      this.slow = 0;          // factor de ralentización 0..1
      this.slowUntil = 0;
      this.poison = null;     // {dps, until}
      this.dead = false;
      this.reached = false;
      this.hitFlash = 0;
      this.wobbleSeed = Math.random() * Math.PI * 2;
    }

    update(dt, now) {
      if (this.dead || this.reached) return;

      if (this.poison) {
        this.hp -= this.poison.dps * dt;
        if (now > this.poison.until) this.poison = null;
        if (this.hp <= 0) { this.dead = true; return; }
      }
      if (now > this.slowUntil) this.slow = 0;

      let speed = this.baseSpeed * (1 - this.slow);
      let remaining = speed * dt;
      while (remaining > 0 && this.wpIndex < this.waypoints.length) {
        const wp = this.waypoints[this.wpIndex];
        const dx = wp.x - this.x;
        const dy = wp.y - this.y;
        const d = Math.hypot(dx, dy);
        if (d <= remaining) {
          this.x = wp.x; this.y = wp.y;
          this.dist += d;
          remaining -= d;
          this.wpIndex++;
        } else {
          this.x += (dx / d) * remaining;
          this.y += (dy / d) * remaining;
          this.dist += remaining;
          remaining = 0;
        }
      }
      if (this.wpIndex >= this.waypoints.length) this.reached = true;
      if (this.hitFlash > 0) this.hitFlash -= dt;
    }

    takeDamage(dmg) {
      this.hp -= dmg;
      this.hitFlash = 0.1;
      if (this.hp <= 0) this.dead = true;
    }

    applyPoison(dps, dur, now) {
      if (!this.poison || this.poison.dps <= dps) {
        this.poison = { dps, until: now + dur };
      }
    }

    applySlow(factor, now) {
      if (factor >= this.slow) {
        this.slow = factor;
        this.slowUntil = now + 0.35;
      }
    }

    draw(ctx, t) {
      const s = this.scale;
      const wob = Math.sin(this.dist * 0.09 + this.wobbleSeed);
      const x = this.x, y = this.y + Math.abs(wob) * -2 * s;

      ctx.save();
      ctx.translate(x, y);

      // sombra
      ctx.fillStyle = 'rgba(60,80,50,0.18)';
      ctx.beginPath();
      ctx.ellipse(0, 16 * s, 12 * s, 4.5 * s, 0, 0, Math.PI * 2);
      ctx.fill();

      // piernas
      ctx.strokeStyle = '#5d6d55';
      ctx.lineWidth = 4 * s;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-3 * s, 6 * s); ctx.lineTo(-3 * s - wob * 4 * s, 15 * s);
      ctx.moveTo(3 * s, 6 * s); ctx.lineTo(3 * s + wob * 4 * s, 15 * s);
      ctx.stroke();

      // cuerpo
      const bodyColors = {
        normal: '#8a9b7c', cono: '#8a9b7c', corredor: '#9bb08a',
        cubo: '#84937a', gigante: '#7c8f6e',
      };
      ctx.fillStyle = this.hitFlash > 0 ? '#ffffff' : bodyColors[this.type];
      roundRect(ctx, -8 * s, -6 * s, 16 * s, 15 * s, 5 * s);
      ctx.fill();

      // brazos hacia delante (zombi clásico)
      ctx.strokeStyle = this.hitFlash > 0 ? '#ffffff' : '#7f8f72';
      ctx.lineWidth = 3.6 * s;
      ctx.beginPath();
      ctx.moveTo(-6 * s, -2 * s); ctx.lineTo(-13 * s, -1 * s + wob * 2 * s);
      ctx.moveTo(6 * s, -2 * s); ctx.lineTo(13 * s, -1 * s - wob * 2 * s);
      ctx.stroke();

      // cabeza
      ctx.fillStyle = this.hitFlash > 0 ? '#ffffff' : '#adc19b';
      ctx.beginPath();
      ctx.arc(0, -13 * s, 8.5 * s, 0, Math.PI * 2);
      ctx.fill();

      // cara
      ctx.fillStyle = '#3c4636';
      ctx.beginPath();
      ctx.arc(-3 * s, -14 * s, 1.5 * s, 0, Math.PI * 2);
      ctx.arc(3.4 * s, -13.4 * s, 1.9 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#3c4636';
      ctx.lineWidth = 1.2 * s;
      ctx.beginPath();
      ctx.moveTo(-3 * s, -9.5 * s);
      ctx.quadraticCurveTo(0, -8 * s, 3.5 * s, -10 * s);
      ctx.stroke();

      // sombrero según tipo
      if (this.type === 'cono') {
        ctx.fillStyle = '#e8a15c';
        ctx.beginPath();
        ctx.moveTo(0, -30 * s);
        ctx.lineTo(-7 * s, -18 * s);
        ctx.lineTo(7 * s, -18 * s);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#c9853f';
        ctx.lineWidth = 1.2 * s;
        ctx.stroke();
      } else if (this.type === 'cubo') {
        ctx.fillStyle = '#9aa7b5';
        roundRect(ctx, -7.5 * s, -27 * s, 15 * s, 10 * s, 2 * s);
        ctx.fill();
        ctx.strokeStyle = '#7a8795';
        ctx.lineWidth = 1.3 * s;
        ctx.stroke();
      } else if (this.type === 'corredor') {
        ctx.strokeStyle = '#e2635f';
        ctx.lineWidth = 3 * s;
        ctx.beginPath();
        ctx.moveTo(-8 * s, -17 * s);
        ctx.lineTo(8 * s, -17 * s);
        ctx.stroke();
      } else if (this.type === 'gigante') {
        // cicatriz y ceño para el gigante
        ctx.strokeStyle = '#57654c';
        ctx.lineWidth = 1.4 * s;
        ctx.beginPath();
        ctx.moveTo(-5 * s, -19 * s); ctx.lineTo(-1 * s, -16 * s);
        ctx.stroke();
      }

      // efectos de estado
      if (this.slow > 0) {
        ctx.strokeStyle = 'rgba(120,190,255,0.9)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(0, -6 * s, 14 * s, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(190,230,255,0.95)';
        for (let i = 0; i < 3; i++) {
          const a = t * 1.5 + (i * Math.PI * 2) / 3;
          ctx.fillRect(Math.cos(a) * 14 * s - 1.5, -6 * s + Math.sin(a) * 14 * s - 1.5, 3, 3);
        }
      }
      if (this.poison) {
        ctx.fillStyle = 'rgba(170,110,200,0.8)';
        for (let i = 0; i < 2; i++) {
          const ph = (t * 1.2 + i * 0.5) % 1;
          ctx.globalAlpha = 1 - ph;
          ctx.beginPath();
          ctx.arc(-4 * s + i * 8 * s, -20 * s - ph * 10, 2.4, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      // barra de vida
      if (this.hp < this.maxHp) {
        const w = 26 * s;
        const pct = Math.max(0, this.hp / this.maxHp);
        ctx.fillStyle = 'rgba(50,60,45,0.55)';
        roundRect(ctx, -w / 2, -30 * s - (this.type === 'cono' ? 6 * s : 0), w, 4, 2);
        ctx.fill();
        ctx.fillStyle = pct > 0.5 ? '#7ecb63' : pct > 0.25 ? '#e8c95c' : '#e2635f';
        roundRect(ctx, -w / 2, -30 * s - (this.type === 'cono' ? 6 * s : 0), w * pct, 4, 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  /* =============== TORRE (PLANTA) =============== */
  class Tower {
    constructor(key, col, row) {
      this.id = ENTITY_ID++;
      this.key = key;
      this.def = TD.TOWERS[key];
      this.col = col;
      this.row = row;
      this.x = col * CELL + CELL / 2;
      this.y = row * CELL + CELL / 2;
      this.level = 0;
      this.cooldown = 0;
      this.genTimer = 0;
      this.angle = -Math.PI / 2;
      this.invested = this.def.cost;
      this.recoil = 0;
      this.plantSeed = Math.random() * 10;
    }

    get stats() { return this.def.levels[this.level]; }
    get rangePx() { return this.stats.range * CELL; }
    get upgradeCost() {
      return this.level < this.def.levels.length - 1 ? this.def.upCosts[this.level] : null;
    }
    get sellValue() { return Math.round(this.invested * TD.SELL_RATIO); }

    upgrade() {
      const c = this.upgradeCost;
      if (c == null) return false;
      this.invested += c;
      this.level++;
      return true;
    }

    update(dt, game) {
      const st = this.stats;
      if (this.recoil > 0) this.recoil -= dt * 4;

      // Girasol: genera dinero
      if (this.key === 'girasol') {
        this.genTimer += dt;
        if (this.genTimer >= st.genRate) {
          this.genTimer = 0;
          game.addMoney(st.gen, this.x, this.y - 26);
          TD.audio.coin();
        }
        return;
      }

      // Menta: aura de ralentización continua + pulso de daño
      if (this.key === 'mentahelada') {
        for (const e of game.enemies) {
          if (!e.dead && !e.reached && dist(this, e) <= this.rangePx) {
            e.applySlow(st.slow, game.time);
          }
        }
        this.cooldown -= dt;
        if (this.cooldown <= 0) {
          let hitAny = false;
          for (const e of game.enemies) {
            if (!e.dead && !e.reached && dist(this, e) <= this.rangePx) {
              e.takeDamage(st.dmg);
              hitAny = true;
              if (e.dead) game.onEnemyKilled(e);
            }
          }
          if (hitAny) { this.recoil = 1; TD.audio.freeze(); }
          this.cooldown = st.rate;
        }
        return;
      }

      // Torres que disparan
      this.cooldown -= dt;
      const target = this.findTarget(game);
      if (target) {
        this.angle = Math.atan2(target.y - this.y, target.x - this.x);
        if (this.cooldown <= 0) {
          this.fire(target, game);
          this.cooldown = st.rate;
          this.recoil = 1;
        }
      }
    }

    findTarget(game) {
      let best = null;
      for (const e of game.enemies) {
        if (e.dead || e.reached) continue;
        if (dist(this, e) <= this.rangePx + e.radius * 0.5) {
          if (!best || e.dist > best.dist) best = e; // el más avanzado
        }
      }
      return best;
    }

    fire(target, game) {
      const st = this.stats;
      const kinds = { lanzaguisantes: 'pea', bocadragon: 'fire', setavenenosa: 'spore', cactus: 'spike' };
      const kind = kinds[this.key] || 'pea';
      game.projectiles.push(new Projectile(this, target, kind, st));
      const sfx = { pea: 'shoot', fire: 'fire', spore: 'spore', spike: 'spike' };
      TD.audio[sfx[kind]]();
    }

    draw(ctx, t, selected) {
      const x = this.x, y = this.y;
      const sway = Math.sin(t * 1.6 + this.plantSeed) * 0.05;

      ctx.save();
      ctx.translate(x, y + 8);

      // sombra
      ctx.fillStyle = 'rgba(60,90,50,0.16)';
      ctx.beginPath();
      ctx.ellipse(0, 14, 15, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // maceta / base de tierra
      ctx.fillStyle = '#b98a5e';
      roundRect(ctx, -12, 6, 24, 10, 4);
      ctx.fill();
      ctx.fillStyle = '#8f6844';
      roundRect(ctx, -12, 6, 24, 4, 3);
      ctx.fill();

      ctx.rotate(sway);
      const drawFn = PLANT_DRAWERS[this.key];
      if (drawFn) drawFn(ctx, t, this);
      ctx.restore();

      // insignia de nivel
      if (this.level > 0) {
        ctx.fillStyle = '#fff8e6';
        ctx.strokeStyle = '#e0b64f';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x + 16, y - 14, 8, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#a97d1d';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('★'.slice(0, 1), x + 16, y - 13.5);
        if (this.level === 2) {
          ctx.font = 'bold 8px sans-serif';
          ctx.fillText('★★', x + 16, y - 13.5);
        }
      }
    }
  }

  /* Dibujo de cada planta (coordenadas relativas a la base) */
  const PLANT_DRAWERS = {
    girasol(ctx, t, tw) {
      stem(ctx);
      // pétalos
      const petals = 10;
      ctx.fillStyle = '#f7c948';
      for (let i = 0; i < petals; i++) {
        const a = (i / petals) * Math.PI * 2 + t * 0.15;
        ctx.save();
        ctx.translate(0, -22);
        ctx.rotate(a);
        ctx.beginPath();
        ctx.ellipse(11, 0, 7, 3.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      // centro con carita
      ctx.fillStyle = '#9c6b3a';
      ctx.beginPath(); ctx.arc(0, -22, 9, 0, Math.PI * 2); ctx.fill();
      face(ctx, 0, -23, 1);
    },
    lanzaguisantes(ctx, t, tw) {
      stem(ctx);
      const a = tw.angle;
      const rec = Math.max(0, tw.recoil) * 3;
      // cabeza
      ctx.fillStyle = '#79c25e';
      ctx.beginPath(); ctx.arc(0, -22, 12, 0, Math.PI * 2); ctx.fill();
      // hoja en la cabeza
      ctx.fillStyle = '#5aa843';
      ctx.beginPath(); ctx.ellipse(-2, -35, 5, 3, -0.5, 0, Math.PI * 2); ctx.fill();
      // cañón orientado al objetivo
      ctx.save();
      ctx.translate(0, -22);
      ctx.rotate(a);
      ctx.fillStyle = '#69b350';
      roundRect(ctx, 4 - rec, -5.5, 13, 11, 5);
      ctx.fill();
      ctx.fillStyle = '#3f7031';
      ctx.beginPath(); ctx.arc(16 - rec, 0, 4.2, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      face(ctx, -3, -24, 0.9);
    },
    mentahelada(ctx, t, tw) {
      // arbusto de menta
      ctx.fillStyle = '#7fd4c1';
      ctx.beginPath(); ctx.arc(-8, -14, 9, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(8, -14, 9, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(0, -24, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#a8e8da';
      ctx.beginPath(); ctx.arc(-3, -27, 4, 0, Math.PI * 2); ctx.fill();
      face(ctx, 0, -20, 1);
      // pulso de escarcha
      const pulse = (t * 0.8 + tw.plantSeed) % 1;
      ctx.strokeStyle = `rgba(160,225,255,${0.7 * (1 - pulse)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, -18, 14 + pulse * 16, 0, Math.PI * 2);
      ctx.stroke();
      // copos
      ctx.fillStyle = 'rgba(220,245,255,0.95)';
      for (let i = 0; i < 3; i++) {
        const a = t + (i * Math.PI * 2) / 3;
        ctx.fillRect(Math.cos(a) * 16 - 1.5, -18 + Math.sin(a) * 16 - 1.5, 3, 3);
      }
    },
    bocadragon(ctx, t, tw) {
      stem(ctx);
      const a = tw.angle;
      const open = 0.25 + Math.max(0, tw.recoil) * 0.35;
      ctx.save();
      ctx.translate(0, -24);
      ctx.rotate(a);
      // cabeza de flor
      ctx.fillStyle = '#ef8354';
      ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
      // mandíbulas
      ctx.fillStyle = '#e2635f';
      ctx.beginPath();
      ctx.moveTo(2, 0);
      ctx.lineTo(16, -9 * open - 2);
      ctx.quadraticCurveTo(10, -1, 2, 0);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(2, 0);
      ctx.lineTo(16, 9 * open + 2);
      ctx.quadraticCurveTo(10, 1, 2, 0);
      ctx.fill();
      // llama al disparar
      if (tw.recoil > 0.4) {
        ctx.fillStyle = 'rgba(255,190,80,0.85)';
        ctx.beginPath(); ctx.arc(19, 0, 5 + tw.recoil * 3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
      // pétalos traseros
      ctx.fillStyle = '#f4a259';
      ctx.beginPath(); ctx.ellipse(-8, -32, 5, 3.4, -0.6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(-11, -24, 5, 3.4, 0.3, 0, Math.PI * 2); ctx.fill();
    },
    setavenenosa(ctx, t, tw) {
      // tallo grueso
      ctx.fillStyle = '#e8dcc8';
      roundRect(ctx, -6, -18, 12, 24, 5);
      ctx.fill();
      // sombrero
      ctx.fillStyle = '#a86bc9';
      ctx.beginPath();
      ctx.ellipse(0, -18, 17, 12, 0, Math.PI, 0);
      ctx.quadraticCurveTo(10, -12, 0, -12);
      ctx.quadraticCurveTo(-10, -12, -17, -18);
      ctx.fill();
      // lunares
      ctx.fillStyle = '#e6ccf2';
      ctx.beginPath(); ctx.arc(-7, -22, 2.6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(4, -25, 2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(9, -19, 1.8, 0, Math.PI * 2); ctx.fill();
      face(ctx, 0, -6, 0.9);
      // esporas flotando
      ctx.fillStyle = 'rgba(190,140,220,0.7)';
      for (let i = 0; i < 2; i++) {
        const ph = (t * 0.5 + i * 0.5 + tw.plantSeed) % 1;
        ctx.globalAlpha = 0.8 * (1 - ph);
        ctx.beginPath();
        ctx.arc(-6 + i * 12, -30 - ph * 12, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    },
    cactus(ctx, t, tw) {
      // cuerpo alto
      ctx.fillStyle = '#5f9e59';
      roundRect(ctx, -8, -38, 16, 44, 8);
      ctx.fill();
      // brazos
      roundRect(ctx, -18, -26, 8, 16, 4); ctx.fill();
      roundRect(ctx, 10, -32, 8, 16, 4); ctx.fill();
      ctx.fillStyle = '#4c8a48';
      roundRect(ctx, -18, -14, 12, 6, 3); ctx.fill();
      roundRect(ctx, 6, -20, 12, 6, 3); ctx.fill();
      // espinas
      ctx.strokeStyle = '#dcedc8';
      ctx.lineWidth = 1.4;
      for (let i = 0; i < 5; i++) {
        const yy = -34 + i * 8;
        ctx.beginPath();
        ctx.moveTo(-8, yy); ctx.lineTo(-11, yy - 2);
        ctx.moveTo(8, yy + 4); ctx.lineTo(11, yy + 2);
        ctx.stroke();
      }
      // flor arriba
      ctx.fillStyle = '#f2a0c0';
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.ellipse(Math.cos(a) * 4, -40 + Math.sin(a) * 4, 3.6, 2.4, a, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#f7c948';
      ctx.beginPath(); ctx.arc(0, -40, 2.6, 0, Math.PI * 2); ctx.fill();
      face(ctx, 0, -24, 1);
    },
  };

  function stem(ctx) {
    ctx.strokeStyle = '#5aa843';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 6);
    ctx.quadraticCurveTo(2, -6, 0, -14);
    ctx.stroke();
    // hojitas
    ctx.fillStyle = '#6db553';
    ctx.beginPath(); ctx.ellipse(-6, -2, 6, 3, -0.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(6, 0, 6, 3, 0.5, 0, Math.PI * 2); ctx.fill();
  }

  function face(ctx, x, y, s) {
    ctx.fillStyle = '#2f3b2a';
    ctx.beginPath();
    ctx.arc(x - 3 * s, y, 1.4 * s, 0, Math.PI * 2);
    ctx.arc(x + 3 * s, y, 1.4 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2f3b2a';
    ctx.lineWidth = 1.2 * s;
    ctx.beginPath();
    ctx.arc(x, y + 2.5 * s, 2.6 * s, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }

  /* =============== PROYECTIL =============== */
  class Projectile {
    constructor(tower, target, kind, st) {
      this.x = tower.x;
      this.y = tower.y - 16;
      this.target = target;
      this.lastX = target.x;
      this.lastY = target.y;
      this.kind = kind;
      this.dmg = st.dmg;
      this.splash = (st.splash || 0) * CELL;
      this.poisonDps = st.poisonDps || 0;
      this.poisonDur = st.poisonDur || 0;
      this.speed = kind === 'spike' ? 620 : 430;
      this.dead = false;
      this.trail = 0;
    }

    update(dt, game) {
      if (this.dead) return;
      let tx = this.lastX, ty = this.lastY;
      if (this.target && !this.target.dead && !this.target.reached) {
        tx = this.lastX = this.target.x;
        ty = this.lastY = this.target.y - 8;
      }
      const dx = tx - this.x, dy = ty - this.y;
      const d = Math.hypot(dx, dy);
      const step = this.speed * dt;
      if (d <= step + 6) {
        this.impact(game, tx, ty);
        return;
      }
      this.x += (dx / d) * step;
      this.y += (dy / d) * step;
    }

    impact(game, ix, iy) {
      this.dead = true;
      const now = game.time;
      const applyTo = (e) => {
        e.takeDamage(this.dmg);
        if (this.poisonDps) e.applyPoison(this.poisonDps, this.poisonDur, now);
        if (e.dead) game.onEnemyKilled(e);
      };
      if (this.splash > 0) {
        for (const e of game.enemies) {
          if (e.dead || e.reached) continue;
          if (Math.hypot(e.x - ix, e.y - iy) <= this.splash + e.radius) applyTo(e);
        }
        game.addParticle(new Particle('boom', ix, iy, { r: this.splash }));
      } else {
        const t = this.target;
        if (t && !t.dead && !t.reached && Math.hypot(t.x - ix, t.y - iy) < 40) {
          applyTo(t);
        }
        game.addParticle(new Particle(this.kind === 'spore' ? 'poof-purple' : 'poof', ix, iy, {}));
      }
      TD.audio.hit();
    }

    draw(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);
      if (this.kind === 'pea') {
        ctx.fillStyle = '#6fbf4e';
        ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.beginPath(); ctx.arc(-1.5, -1.5, 1.7, 0, Math.PI * 2); ctx.fill();
      } else if (this.kind === 'fire') {
        ctx.fillStyle = '#ff9f45';
        ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffd166';
        ctx.beginPath(); ctx.arc(0, 0, 3.2, 0, Math.PI * 2); ctx.fill();
      } else if (this.kind === 'spore') {
        ctx.fillStyle = '#b57edc';
        ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#e3c7f2';
        ctx.beginPath(); ctx.arc(1.5, -1.5, 1.8, 0, Math.PI * 2); ctx.fill();
      } else if (this.kind === 'spike') {
        const a = Math.atan2(this.lastY - this.y, this.lastX - this.x);
        ctx.rotate(a);
        ctx.fillStyle = '#8bc34a';
        ctx.beginPath();
        ctx.moveTo(7, 0); ctx.lineTo(-5, -3); ctx.lineTo(-5, 3);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
  }

  /* =============== PARTÍCULA =============== */
  class Particle {
    constructor(type, x, y, opts) {
      this.type = type;
      this.x = x; this.y = y;
      this.opts = opts || {};
      this.life = 0;
      this.maxLife =
        type === 'text' ? 1.1 :
        type === 'boom' ? 0.4 :
        type === 'splat' ? 0.6 : 0.35;
      this.vx = (Math.random() - 0.5) * 30;
      this.vy = type === 'text' ? -38 : (Math.random() - 0.5) * 30;
      this.dead = false;
    }

    update(dt) {
      this.life += dt;
      if (this.life >= this.maxLife) this.dead = true;
      if (this.type === 'text') { this.y += this.vy * dt; }
      else { this.x += this.vx * dt; this.y += this.vy * dt; }
    }

    draw(ctx) {
      const p = this.life / this.maxLife;
      ctx.save();
      ctx.globalAlpha = 1 - p;
      if (this.type === 'text') {
        ctx.font = 'bold 15px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = this.opts.color || '#e8a10a';
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 3;
        ctx.strokeText(this.opts.text, this.x, this.y);
        ctx.fillText(this.opts.text, this.x, this.y);
      } else if (this.type === 'boom') {
        ctx.strokeStyle = 'rgba(255,160,70,0.9)';
        ctx.lineWidth = 4 * (1 - p);
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.opts.r * (0.4 + p * 0.7), 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,210,120,0.35)';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.opts.r * p, 0, Math.PI * 2);
        ctx.fill();
      } else if (this.type === 'splat') {
        ctx.fillStyle = 'rgba(140,160,120,0.8)';
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 + this.x;
          ctx.beginPath();
          ctx.arc(this.x + Math.cos(a) * 14 * p, this.y + Math.sin(a) * 14 * p, 3.5 * (1 - p), 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (this.type === 'poof' || this.type === 'poof-purple') {
        ctx.fillStyle = this.type === 'poof' ? 'rgba(200,230,170,0.8)' : 'rgba(200,150,220,0.8)';
        ctx.beginPath();
        ctx.arc(this.x, this.y, 4 + p * 8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  /* utilidades */
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  TD.Enemy = Enemy;
  TD.Tower = Tower;
  TD.Projectile = Projectile;
  TD.Particle = Particle;
  TD.roundRect = roundRect;
})();
