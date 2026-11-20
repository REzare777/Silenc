import * as THREE from 'three';

/* ------------------------------------------------------------------ *
 *  Игрок: ходьба, обзор, столкновения
 * ------------------------------------------------------------------ */

const EYE = 1.68;
const RADIUS = 0.34;
const CLIMB_SPEED = 1.9;    // скорость подъёма по вертикальной лестнице, м/с

export class Player {
  constructor(camera, dom) {
    this.camera = camera;
    this.dom = dom;
    this.yaw = Math.PI;
    this.pitch = -0.05;
    this.pos = new THREE.Vector3(0, 0, 14);
    this.vel = new THREE.Vector3();
    this.y = 0;          // высота над землёй
    this.vy = 0;         // вертикальная скорость
    this.grounded = true;
    this.jumpSpeed = 4.7;
    this.gravity = 14.0;
    this.keys = new Set();
    this.enabled = false;      // мир живёт, игрок обновляется
    this.acceptInput = false;  // клавиатура и обзор активны
    this.sensitivity = 1;
    this.bob = 0;
    this.bobPhase = 0;
    this.bobScale = 0.5;      // покачивание камеры при ходьбе (0 = выключено)
    this.stepDistance = 0;
    this.onStep = null;
    this.speedWalk = 3.1;
    this.speedRun = 6.0;
    this.boxes = [];
    this.circles = [];
    this.dynamicCircles = [];
    this.platforms = [];      // ступени, крыльца, пороги
    this.floors = [];         // уровни пола локации: [{x0,x1,z0,z1,y}]
    this.climbs = [];         // вертикальные лестницы (зоны подъёма)
    this.climb = null;        // активный подъём { zone, feetY, phase, t }
    this.groundY = 0;        // высота поверхности под ногами
    this.camY = null;        // сглаженная высота камеры (без микроподпрыгиваний)
    this.bounds = 118;
    this.touchMove = { x: 0, y: 0 };
    this.lookOnly = false;      // обзор мышью без управления движением
    this.dragging = false;
    this.lookDelta = { x: 0, y: 0 };
    this._bind();
  }

  _bind() {
    this._onKeyDown = (e) => {
      if (!this.enabled || !this.acceptInput) return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (this.grounded) {
          this.vy = this.jumpSpeed;
          this.grounded = false;
          if (this.onJump) this.onJump();
        }
        return;
      }
      this.keys.add(e.code);
    };
    this._onKeyUp = (e) => this.keys.delete(e.code);
    this._onMouse = (e) => {
      if (!this.enabled) return;
      if (!this.acceptInput && !this.lookOnly) return;      // lookOnly — только обзор
      if (document.pointerLockElement === this.dom) {
        this.yaw -= e.movementX * 0.0022 * this.sensitivity;
        this.pitch -= e.movementY * 0.0022 * this.sensitivity;
        this.pitch = Math.max(-1.35, Math.min(1.25, this.pitch));
      } else if (this.dragging) {
        // запасной вариант: осмотр перетаскиванием (если захват мыши запрещён)
        this.yaw -= e.movementX * 0.0032 * this.sensitivity;
        this.pitch -= e.movementY * 0.0032 * this.sensitivity;
        this.pitch = Math.max(-1.35, Math.min(1.25, this.pitch));
      }
    };
    this._onDown = (e) => {
      if (!this.enabled || !this.acceptInput || e.button !== 0) return;
      if (document.pointerLockElement === this.dom) return;
      this.dragging = true;
    };
    this._onUp = () => { this.dragging = false; };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    document.addEventListener('mousemove', this._onMouse);
    document.addEventListener('mousedown', this._onDown);
    document.addEventListener('mouseup', this._onUp);
    window.addEventListener('blur', () => { this.keys.clear(); this.dragging = false; });
  }

  requestLock() {
    if (!this.dom.requestPointerLock) return;
    try {
      const p = this.dom.requestPointerLock();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch (e) { /* захват может быть запрещён — работаем без него */ }
  }

  /**
   * Высота винтовой поверхности под точкой.
   * Спираль много значна по (x,z), поэтому виток угадывается по текущей высоте
   * игрока и запоминается — иначе при подъёме высота прыгала бы на целый виток.
   *
   * @param {number} cur высота, по которой ищется виток (рост игрока)
   */
  spiralHeight(sp, x, z, cur) {
    const dx = x - sp.cx, dz = z - sp.cz;
    const r = Math.hypot(dx, dz);
    if (r < sp.rIn) return null;
    const TAU = Math.PI * 2;
    const N = sp.steps;
    const dA = TAU * sp.turns / N;          // угловой шаг ступени
    const rise = (sp.y1 - sp.y0) / N;
    let a = Math.atan2(dx, dz);
    if (a < 0) a += TAU;
    const evalTurn = (k) => {
      const off = ((a - sp.a0 - k * TAU) % TAU + TAU) % TAU;
      let u = (k * TAU + off) / dA;          // номер ступени вдоль спирали
      if (u < -0.5 || u > N + 0.5) return null;
      u = Math.min(Math.max(u, 0.5), N - 0.5);   // концы спирали — зажимаем
      const y = sp.y0 + (u + 0.5) * rise;
      const t = (y - sp.y0) / (sp.y1 - sp.y0);
      const rOut = sp.rOut0 + (sp.rOut1 - sp.rOut0) * t - 0.05;
      if (r > rOut) return null;
      return y;
    };
    let y = evalTurn(sp.m);
    if (y === null || Math.abs(y - cur) > 0.75) {
      let best = null, bestD = Infinity;
      for (let k = 0; k <= sp.turns; k++) {
        const yy = evalTurn(k);
        if (yy === null) continue;
        const dd = Math.abs(yy - cur);
        if (dd < bestD) { bestD = dd; best = yy; sp.m = k; }
      }
      y = best;
    }
    // Ни один виток не подошёл (игрок замер на краю или чуть промахнулся):
    // лучше «залипнуть» на ближайшей ступени, чем провалиться сквозь
    // лестницу. Поэтому берём ступень текущего витка по углу.
    if (y === null) {
      const off = ((a - sp.a0 - sp.m * TAU) % TAU + TAU) % TAU;
      let u = (sp.m * TAU + off) / dA;
      u = Math.min(Math.max(u, 0.5), N - 0.5);
      y = sp.y0 + (u + 0.5) * rise;
    }
    return y;
  }

  /**
   * Уровни пола локации — прямоугольники с базовой высотой земли.
   * Нужны там, где в одной сцене есть несколько этажей (например,
   * подземелье: верхний ярус и зал Врат на 4.6 м ниже).
   *
   * @param {Array<{x0:number,x1:number,z0:number,z1:number,y:number}>} list
   */
  setFloors(list) {
    this.floors = list || [];
  }

  /** Базовый уровень земли под точкой. */
  floorAt(x, z) {
    for (const f of this.floors) {
      if (x >= f.x0 && x <= f.x1 && z >= f.z0 && z <= f.z1) return f.y;
    }
    return 0;
  }

  /**
   * Высота поверхности под точкой (ступени, крыльца, настилы).
   *
   * Опорная высота (`refY`) — это высота НОГ игрока, а не высота той опоры,
   * на которой он стоял секунду назад. Разница критична: пока игрок в прыжке
   * или падает, его ноги выше прежней опоры, и «потолки» (настилы над головой,
   * верхние витки винтовой лестницы) не должны приниматься за пол.
   *
   * @param {number} x мировая X
   * @param {number} z мировая Z
   * @param {number|null} [refY] высота ног; по умолчанию — текущая
   * @param {number} [tol] насколько поверхность может быть выше ног и всё
   *   равно считаться полом (ступень); 0 — строго под ногами
   * @returns {number} высота пола
   */
  groundAt(x, z, refY = null, tol = 0.46) {
    let g = this.floorAt(x, z);
    const cur = refY === null ? this.groundY + this.y : refY;
    for (const p of this.platforms) {
      // винтовая лестница — непрерывная поверхность
      if (p.sp) {
        const y = this.spiralHeight(p.sp, x, z, cur);
        if (y === null || y > cur + tol) continue;
        if (y > g) g = y;
        continue;
      }
      // наклонная лестница — ровная плоскость между двумя точками
      if (p.ramp) {
        const r = p.ramp;
        const dx = r.x1 - r.x0, dz = r.z1 - r.z0;
        const L2 = dx * dx + dz * dz;
        if (L2 < 1e-6) continue;
        const t = ((x - r.x0) * dx + (z - r.z0) * dz) / L2;
        if (t < 0 || t > 1) continue;
        const lat = Math.hypot(x - (r.x0 + dx * t), z - (r.z0 + dz * t));
        if (lat > r.halfWidth) continue;
        const y = r.y0 + (r.y1 - r.y0) * t;
        if (y > cur + tol) continue;
        if (r.only && cur < y - 0.3) continue;
        if (y > g) g = y;
        continue;
      }
      // площадка выше головы — это «потолок», а не пол (например, галерея над входом)
      if (p.y > cur + tol) continue;
      // «только сверху»: настил над лестницей не должен подбрасывать игрока снизу
      if (p.only && cur < p.y - 0.3) continue;
      const c = Math.cos(p.ang || 0), s = Math.sin(p.ang || 0);
      const dx = x - p.cx, dz = z - p.cz;
      const lx = c * dx - s * dz, lz = s * dx + c * dz;
      if (lx >= -p.hx && lx <= p.hx && lz >= -p.hz && lz <= p.hz && p.y > g) g = p.y;
    }
    return g;
  }

  setPlatforms(list) {
    this.platforms = list || [];
  }

  setColliders(boxes, circles) {
    this.boxes = boxes || [];
    this.circles = circles || [];
  }

  /* ---------------- вертикальная лестница ---------------- */

  /**
   * Зоны подъёма. Каждая зона — вертикальная лестница:
   *   x, z   — точка, у которой висит игрок;
   *   r      — радиус захвата лестницы;
   *   y0, y1 — нижняя и верхняя точки (мировые высоты);
   *   exitX, exitZ — куда игрок встаёт, вылезя наверх.
   */
  setClimbs(list) {
    this.climbs = list || [];
  }

  /** Лестница, к которой игрок может присоединиться (по XZ и высоте). */
  climbZoneAt(feet) {
    for (const c of this.climbs) {
      const dx = this.pos.x - c.x, dz = this.pos.z - c.z;
      if (dx * dx + dz * dz > c.r * c.r) continue;
      if (Math.abs(feet - c.y0) <= 0.9 || Math.abs(feet - c.y1) <= 0.9) return c;
    }
    return null;
  }

  /**
   * Захват лестницы.
   *   dir = +1 — только что схватились снизу (идём вверх);
   *   dir = -1 — схватились сверху (идём вниз).
   * Стартовая высота чуть смещена от края, чтобы не сработать
   * мгновенный сход/перехват в тот же кадр.
   */
  startClimb(zone, dir) {
    const h = dir > 0 ? zone.y0 + 0.06 : zone.y1 - 0.06;
    this.climb = { zone, h, dir, phase: 'climb', t: 0, fx: this.pos.x, fz: this.pos.z };
    this.vel.set(0, 0, 0);
    this.vy = 0;
    this.grounded = false;
  }

  /**
   * Подъём по вертикальной лестнице:
   *   W — вверх, S — вниз;
   *   наверху — перелезание на настил (mantle), внизу — сход на пол.
   */
  updateClimb(dt, fwd) {
    const c = this.climb;
    const z = c.zone;

    if (c.phase === 'mantle') {
      // плавный перехват настила: игрок перешагивает через край люка
      c.t = Math.min(1, c.t + dt / 0.34);
      const e = c.t * c.t * (3 - 2 * c.t);
      this.pos.x = c.fx + (z.exitX - c.fx) * e;
      this.pos.z = c.fz + (z.exitZ - c.fz) * e;
      this.groundY = z.y1;
      this.y = 0;
      this.camY = z.y1;
      this.vel.set(0, 0, 0);
      this.vy = 0;
      if (c.t >= 1) {
        this.climb = null;
        this.grounded = true;
        if (this.onClimbTop) this.onClimbTop();
      }
      return;
    }

    if (fwd > 0) c.h += CLIMB_SPEED * dt;
    else if (fwd < 0) c.h -= CLIMB_SPEED * dt;
    c.h = Math.max(z.y0, Math.min(z.y1, c.h));
    // держим игрока у лестницы
    const k = Math.min(1, 10 * dt);
    this.pos.x += (z.x - this.pos.x) * k;
    this.pos.z += (z.z - this.pos.z) * k;
    this.groundY = z.y0;
    this.y = c.h - z.y0;
    this.camY = this.groundY + this.y;
    this.vel.set(0, 0, 0);
    this.vy = 0;
    this.grounded = false;
    this.bob = 0;
    this.roll = 0;

    if (c.h >= z.y1 - 0.001) {
      // вылезли наверху — перелезаем на настил
      c.phase = 'mantle';
      c.t = 0;
      c.fx = this.pos.x;
      c.fz = this.pos.z;
    } else if (c.h <= z.y0 + 0.001) {
      // дошли до низа — сходим на пол
      this.climb = null;
      this.pos.x = z.x;
      this.pos.z = z.z;
      this.groundY = z.y0;
      this.y = 0;
      this.camY = z.y0;
      this.grounded = true;
    }
  }

  /** Подсказка про лестницу (показывается в HUD). */
  climbHint() {
    if (this.climb) return this.climb.phase === 'mantle' ? '' : 'W — вверх, S — вниз';
    const feet = this.groundY + this.y;
    const z = this.climbZoneAt(feet);
    if (!z) return null;
    if (Math.abs(feet - z.y0) < 0.95) return 'Смотрите вверх и жмите W — забраться';
    if (Math.abs(feet - z.y1) < 0.95) return 'Смотрите вниз и жмите S — спуститься';
    return null;
  }

  applyCamera() {
    this.camera.position.set(this.pos.x, EYE + (this.camY ?? this.groundY + this.y) + this.bob, this.pos.z);
    this.camera.rotation.set(0, 0, 0);
    this.camera.rotateY(this.yaw);
    this.camera.rotateX(this.pitch);
    this.camera.rotateZ(this.roll);
  }

  /**
   * Сглаженная высота камеры.
   *
   * Физика меняет опору мгновенно (ступил — ноги на ступени), а камера
   * едет к новой высоте мягко: иначе на лестнице каждый шаг дёргал кадр.
   * В полёте сглаживание выключено — там камера должна идти за прыжком точно.
   *
   * @param {number} dt кадр
   */
  updateCamY(dt) {
    const target = this.groundY + this.y;
    if (!this.grounded) { this.camY = target; return; }
    if (!Number.isFinite(this.camY) || Math.abs(target - this.camY) > 1.5) {
      this.camY = target;             // телепорт или смена локации — без рывка
      return;
    }
    const diff = target - this.camY;
    const rate = diff < 0 ? 26 : 16;  // вниз быстрее: не «зависать» над ступенью
    this.camY += diff * Math.min(1, rate * dt);
    if (Math.abs(target - this.camY) < 0.003) this.camY = target;
  }

  update(dt) {
    if (!this.enabled) return;
    const k = this.keys;
    let fwd = 0, strafe = 0;
    if (this.acceptInput) {
      if (k.has('KeyW') || k.has('ArrowUp')) fwd += 1;
      if (k.has('KeyS') || k.has('ArrowDown')) fwd -= 1;
      if (k.has('KeyA') || k.has('ArrowLeft')) strafe -= 1;
      if (k.has('KeyD') || k.has('ArrowRight')) strafe += 1;
    }
    if (this.touchMove.x || this.touchMove.y) {
      strafe += this.touchMove.x;
      fwd -= this.touchMove.y;
    }
    const run = k.has('ShiftLeft') || k.has('ShiftRight');
    const len = Math.hypot(fwd, strafe);
    if (len > 1) { fwd /= len; strafe /= len; }

    /* ---- вертикальная лестница: захват ---- */
    // внизу лестницы: W + взгляд вверх; наверху: S + взгляд вниз
    if (this.climbs.length && fwd !== 0 && !this.climb) {
      const feet = this.groundY + this.y;
      for (const c of this.climbs) {
        const dx = this.pos.x - c.x, dz = this.pos.z - c.z;
        if (dx * dx + dz * dz > c.r * c.r) continue;
        if (fwd > 0 && this.pitch > 0.1 && Math.abs(feet - c.y0) < 0.9) {
          this.startClimb(c, 1);
          break;
        }
        if (fwd < 0 && this.pitch < -0.1 && Math.abs(feet - c.y1) < 0.9) {
          this.startClimb(c, -1);
          break;
        }
      }
    }

    // уже висим на лестнице — вертикальное движение, гравитация отключена
    if (this.climb) {
      this.updateClimb(dt, fwd);
      this.applyCamera();
      return;
    }

    const speed = run ? this.speedRun : this.speedWalk;
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const dirX = (-sin * fwd) + (cos * strafe);
    const dirZ = (-cos * fwd) + (-sin * strafe);

    const targetX = dirX * speed;
    const targetZ = dirZ * speed;
    const accel = len > 0 ? 14 : 11;
    this.vel.x += (targetX - this.vel.x) * Math.min(1, accel * dt);
    this.vel.z += (targetZ - this.vel.z) * Math.min(1, accel * dt);

    const prevX = this.pos.x, prevZ = this.pos.z;
    if (this.acceptInput) {
      // мелкие шаги, чтобы не проскакивать сквозь тонкие преграды
      const dx = this.vel.x * dt, dz = this.vel.z * dt;
      const steps = Math.min(6, Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.22)));
      for (let i = 0; i < steps; i++) {
        this.pos.x += dx / steps;
        this.pos.z += dz / steps;
        this.resolve();
      }
    } else {
      this.vel.x = 0; this.vel.z = 0;
    }

    // Опора под ногами. Здесь же решается, что делать с перепадом высоты:
    //   · ступень или пологий спуск — ноги идут по поверхности;
    //   · обрыв — игрок падает с прежней высоты;
    //   · в полёте — высота ног сохраняется, опорой становится место приземления.
    // Раньше любой спуск трактовался как «падение с края», и высота `y`
    // копилась кадр за кадром: игрок на лестнице «вырастал» над ступенями.
    const feet = this.groundY + this.y;
    if (this.grounded) {
      const gh = this.groundAt(this.pos.x, this.pos.z);
      if (gh - this.groundY > 0.46) {
        // слишком крутой подъём — не пускаем
        this.pos.x = prevX; this.pos.z = prevZ;
        this.vel.x *= 0.2; this.vel.z *= 0.2;
        this.groundY = this.groundAt(prevX, prevZ);
      } else if (this.groundY - gh > 0.62) {
        // съехали с края — падаем вниз с прежней высоты
        this.y = feet - gh;
        this.groundY = gh;
        this.grounded = false;
        this.vy = Math.min(this.vy, 0);
      } else {
        // ступень или пологий спуск — ноги следуют за поверхностью
        this.groundY = gh;
        this.y = 0;
      }
    } else {
      // в полёте: летим вверх — полом считаются только поверхности не выше ног,
      // падаем — можно приземлиться и на ступень чуть выше ног
      const rising = this.vy > 0.01;
      const gh = this.groundAt(this.pos.x, this.pos.z, feet, rising ? 0 : 0.46);
      this.groundY = gh;
      this.y = feet - gh;
    }

    // границы мира
    const B = this.bounds;
    this.pos.x = Math.max(-B, Math.min(B, this.pos.x));
    this.pos.z = Math.max(-B, Math.min(B, this.pos.z));

    // шаги
    const moved = Math.hypot(this.pos.x - prevX, this.pos.z - prevZ);
    this.stepDistance += moved;
    const stride = run ? 1.55 : 1.15;
    if (this.stepDistance > stride) {
      this.stepDistance = 0;
      if (this.onStep) this.onStep(run);
    }

    // прыжок и гравитация
    if (!this.grounded) {
      this.vy -= this.gravity * dt;
      this.y += this.vy * dt;
      if (this.y <= 0) {
        this.y = 0;
        this.vy = 0;
        if (!this.grounded) {
          this.grounded = true;
          if (this.onLand) this.onLand();
        }
      }
    }

    // покачивание
    const sp = Math.hypot(this.vel.x, this.vel.z);
    this.bobPhase += moved * (run ? 4.6 : 5.4);
    const airK = this.grounded ? 1 : 0.35;
    const bobK = this.bobScale * Math.min(1, sp / 2.4) * airK;
    this.bob = Math.sin(this.bobPhase * 2) * 0.045 * bobK;
    this.roll = Math.sin(this.bobPhase) * 0.012 * bobK;

    this.updateCamY(dt);
    this.applyCamera();
  }

  /**
   * Препятствие действует только в своём высотном диапазоне (y0..y1).
   *
   * @param {object} c коллайдер
   * @param {boolean} [round] круглый коллайдер без заданной высоты: он
   *   считается «земным» (до 2,5 м от пола). Иначе бочка на первом этаже
   *   держала игрока на втором — получалась невидимая стена.
   */
  blocksAt(c, round = false) {
    if (c.y0 === undefined && c.y1 === undefined) {
      if (!round) return true;
      const feet = this.y + this.groundY;
      return feet < 2.5;
    }
    const feet = this.y + this.groundY;
    const head = feet + 1.75;
    return (c.y1 === undefined || feet < c.y1) && (c.y0 === undefined || head > c.y0);
  }

  resolve() {
    // круглые препятствия
    for (const c of this.circles) {
      if (!Number.isFinite(c.x) || !Number.isFinite(c.z) || !Number.isFinite(c.r)) continue;
      if (!this.blocksAt(c, true)) continue;
      // мягкие (вода): пропускаем на настиле и в проёме к пирсу
      if (c.soft) {
        if (this.groundY > 0.25) continue;
        if (c.gap) {
          const g = c.gap;
          if (this.pos.x > g.minX && this.pos.x < g.maxX &&
              this.pos.z > g.minZ && this.pos.z < g.maxZ) continue;
        }
      }
      const dx = this.pos.x - c.x, dz = this.pos.z - c.z;
      const rr = c.r + RADIUS;
      const d2 = dx * dx + dz * dz;
      if (d2 < rr * rr && d2 > 1e-6) {
        const d = Math.sqrt(d2);
        const push = (rr - d);
        this.pos.x += (dx / d) * push;
        this.pos.z += (dz / d) * push;
      }
    }
    // движущиеся препятствия (животные)
    if (this.dynamicCircles) {
      for (const c of this.dynamicCircles) {
        const dx = this.pos.x - c.x, dz = this.pos.z - c.z;
        const rr = c.r + RADIUS;
        const d2 = dx * dx + dz * dz;
        if (d2 < rr * rr && d2 > 1e-6) {
          const d = Math.sqrt(d2);
          const push = rr - d;
          this.pos.x += (dx / d) * push;
          this.pos.z += (dz / d) * push;
        }
      }
    }
    // прямоугольные препятствия (повёрнутые — стены под любым углом)
    for (const b of this.boxes) {
      if (!Number.isFinite(b.hx) || !Number.isFinite(b.hz) ||
          !Number.isFinite(b.cx) || !Number.isFinite(b.cz)) continue;
      if (!this.blocksAt(b)) continue;
      const c = Math.cos(b.ang || 0), s = Math.sin(b.ang || 0);
      const dx = this.pos.x - b.cx, dz = this.pos.z - b.cz;
      // в локальные оси прямоугольника
      const lx = c * dx - s * dz;
      const lz = s * dx + c * dz;
      if (lx < -b.hx - RADIUS || lx > b.hx + RADIUS ||
          lz < -b.hz - RADIUS || lz > b.hz + RADIUS) continue;
      const qx = Math.max(-b.hx, Math.min(lx, b.hx));
      const qz = Math.max(-b.hz, Math.min(lz, b.hz));
      let ex = lx - qx, ez = lz - qz;
      const d2 = ex * ex + ez * ez;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        if (d < RADIUS) {
          const push = (RADIUS - d) / d;
          ex *= push; ez *= push;
        } else continue;
      } else {
        // центр внутри — выталкиваем по кратчайшей оси
        const l = lx + b.hx, r = b.hx - lx, f = lz + b.hz, bk = b.hz - lz;
        const m = Math.min(l, r, f, bk);
        ex = 0; ez = 0;
        if (m === l) ex = -(b.hx + RADIUS) - lx;
        else if (m === r) ex = (b.hx + RADIUS) - lx;
        else if (m === f) ez = -(b.hz + RADIUS) - lz;
        else ez = (b.hz + RADIUS) - lz;
      }
      // обратно в мировые оси
      this.pos.x += c * ex + s * ez;
      this.pos.z += -s * ex + c * ez;
    }
  }

  teleport(x, z, yaw) {
    this.pos.set(x, 0, z);
    this.y = 0; this.vy = 0; this.grounded = true;
    // прежняя опора обнуляется: иначе после перехода в другую локацию
    // «полом» могла считаться старая высота (например, верхний ярус звонарной)
    this.groundY = 0;
    this.groundY = this.groundAt(x, z, 0, 0.46);
    this.camY = null;
    if (yaw !== undefined) this.yaw = yaw;
    this.vel.set(0, 0, 0);
  }
}

/* ---------- плавная кинематографическая камера для заставки ---------- */
export class CinematicCam {
  constructor(camera) {
    this.camera = camera;
    this.t = 0;
    this.center = new THREE.Vector3(0, 3, 0);
    this.radius = 34;
    this.height = 12;
    this.active = false;
  }
  update(dt, focus) {
    if (!this.active) return;
    this.t += dt * 0.035;
    const a = this.t;
    const r = this.radius + Math.sin(a * 0.7) * 6;
    const x = focus.x + Math.cos(a) * r;
    const z = focus.z + Math.sin(a) * r * 0.85;
    const y = this.height + Math.sin(a * 0.9) * 3.5;
    this.camera.position.set(x, y, z);
    this.camera.lookAt(focus.x, 2.6, focus.z);
  }
}
