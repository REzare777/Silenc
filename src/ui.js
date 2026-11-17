
import { FishView } from './fishview.js';
import { fishIcon, rarityOf } from './world/fish.js';
import { clickSlot, MAIN_SLOTS, BELT_SLOTS, TOTAL_SLOTS } from './inventory.js';

/** Русские окончания: plural(5,'рыба','рыбы','рыб') → 'рыб' */
export function plural(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}
/* ------------------------------------------------------------------ *
 *  Связь с DOM: HUD, меню, компас, подсказки
 * ------------------------------------------------------------------ */

export class UI {
  constructor() {
    this.el = {
      start: document.getElementById('start'),
      begin: document.getElementById('begin'),
      load: document.getElementById('load'),
      prompt: document.getElementById('prompt'),
      promptText: document.getElementById('promptText'),
      toast: document.getElementById('toast'),
      menu: document.getElementById('menu'),
      resume: document.getElementById('resume'),
      timebar: document.getElementById('timebar'),
      clock: document.getElementById('clock'),
      compass: document.getElementById('compass'),
      strip: document.getElementById('strip'),
      segQ: document.getElementById('segQ'),
      segT: document.getElementById('segT'),
      tBloom: document.getElementById('tBloom'),
      tSound: document.getElementById('tSound'),
      vol: document.getElementById('vol'),
      volVal: document.getElementById('volVal'),
      sens: document.getElementById('sens'),
      res: document.getElementById('res'),
      bob: document.getElementById('bob'),
      reticle: document.getElementById('reticle'),
      inv: document.getElementById('inv'),
      invGrid: document.getElementById('invGrid'),
      invBelt: document.getElementById('invBelt'),
      invCount: document.getElementById('invCount'),
      invTip: document.getElementById('invTip'),
      invHeld: document.getElementById('invHeld'),
      hotbar: document.getElementById('hotbar'),
      viewCard: document.getElementById('viewCard'),
      viewCanvas: document.getElementById('viewCanvas'),
      vName: document.getElementById('vName'),
      vRar: document.getElementById('vRar'),
      vWeight: document.getElementById('vWeight'),
      vLen: document.getElementById('vLen'),
      vValue: document.getElementById('vValue'),
      vWhere: document.getElementById('vWhere'),
      vDesc: document.getElementById('vDesc'),
      vClose: document.getElementById('vClose'),
      dogCmd: document.getElementById('dogCmd'),
      dogStatus: document.getElementById('dogStatus'),
      fish: document.getElementById('fish'),
      fZone: document.getElementById('fZone'),
      fMark: document.getElementById('fMark'),
      fTitle: document.getElementById('fTitle'),
      fDots: document.getElementById('fDots'),
      dialog: document.getElementById('dialog'),
      dlgName: document.getElementById('dlgName'),
      dlgTitle: document.getElementById('dlgTitle'),
      dlgText: document.getElementById('dlgText'),
      dlgTopics: document.getElementById('dlgTopics'),
      dlgPic: document.getElementById('dlgPic'),
    };
    this.onDialogTopic = null;
    this.onDialogClose = null;
    this.onStart = null;
    this.onTime = null;
    this.onQuality = null;
    this.onBloom = null;
    this.onSound = null;
    this.onVol = null;
    this.onSens = null;
    this.onRes = null;
    this.onBob = null;
    this.onInvToggle = null;
    this.toastTimer = null;
    this._buildCompass();
    this._bind();
  }

  _buildCompass() {
    const labels = { 0: 'С', 45: 'СВ', 90: 'В', 135: 'ЮВ', 180: 'Ю', 225: 'ЮЗ', 270: 'З', 315: 'СЗ' };
    const pxPerDeg = 3.2;
    const strip = this.el.strip;
    strip.style.width = `${721 * pxPerDeg}px`;
    let html = '';
    for (let d = -180; d <= 540; d += 15) {
      const norm = ((d % 360) + 360) % 360;
      const label = labels[norm];
      const card = label && label.length === 1;
      html += `<div class="tick ${card ? 'card' : ''}" style="left:${(d + 180) * pxPerDeg}px">
        ${label ? `<span>${label}</span>` : ''}<i></i></div>`;
    }
    strip.innerHTML = html;
    this.pxPerDeg = pxPerDeg;
  }

  _bind() {
    this.el.begin.addEventListener('click', () => {
      if (this.onStart) this.onStart();
    });
    this.el.timebar.querySelectorAll('button').forEach((b) => {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        const t = b.dataset.tod;
        this.setTime(t);
        if (this.onTime) this.onTime(t);
      });
    });
    if (this.el.segT) {
      this.el.segT.querySelectorAll('button').forEach((b) => {
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          this.el.segT.querySelectorAll('button').forEach((x) => x.classList.remove('on'));
          b.classList.add('on');
          this.setTime(b.dataset.tod);
          if (this.onTime) this.onTime(b.dataset.tod);
        });
      });
    }
    this.el.segQ.querySelectorAll('button').forEach((b) => {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        this.el.segQ.querySelectorAll('button').forEach((x) => x.classList.remove('on'));
        b.classList.add('on');
        if (this.onQuality) this.onQuality(b.dataset.q);
      });
    });
    this.el.tBloom.addEventListener('click', (e) => {
      e.stopPropagation();
      const on = !this.el.tBloom.classList.contains('on');
      this.el.tBloom.classList.toggle('on', on);
      if (this.onBloom) this.onBloom(on);
    });
    this.el.tSound.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleSound();
    });
    if (this.el.vol) {
      this.el.vol.addEventListener('input', (e) => {
        e.stopPropagation();
        const v = Math.max(0, Math.min(100, +e.target.value)) / 100;
        this.setVolume(v);
        // ползунок в ноль — это «звук выключен»; вверх — включаем звук обратно
        this.syncSoundToggle();
        if (this.onVol) this.onVol(v);
      });
    }
    this.el.resume.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.onResume) this.onResume();
    });
    this.el.sens.addEventListener('input', (e) => {
      if (this.onSens) this.onSens(+e.target.value / 100);
    });
    this.el.res.addEventListener('input', (e) => {
      if (this.onRes) this.onRes(+e.target.value / 100);
    });
    this.el.bob.addEventListener('input', (e) => {
      if (this.onBob) this.onBob(+e.target.value / 100);
    });
    this.el.vClose && this.el.vClose.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeInv();
    });
    // курсор в инвентаре: следим за мышью, гасим контекстное меню
    this._mx = innerWidth / 2; this._my = innerHeight / 2;
    addEventListener('mousemove', (e) => {
      this._mx = e.clientX; this._my = e.clientY;
      if (!this.invOpen) return;
      this._moveHeld();
      this._moveTip();
    });
    this.el.inv.addEventListener('contextmenu', (e) => e.preventDefault());
    // клик мимо сетки — предмет на курсоре возвращается в инвентарь
    this.el.inv.addEventListener('mousedown', (e) => {
      if (e.target !== this.el.inv) return;
      e.preventDefault();
      if (this.inv && this.inv.held) {
        this.inv.dropHeld();
        this.renderInventory(this.inv);
      }
    });
    this.fishView = new FishView(this.el.viewCanvas);
  }

  hideStart() { this.el.start.classList.add('gone'); }
  setLoading(text) { this.el.load.textContent = text; }

  /** Часы в углу: текущий период и сколько осталось до следующего. */
  setClock(phase, remainSec) {
    if (!this.el.clock) return;
    const names = {
      morning: 'Утро', day: 'День', golden: 'Золотой час',
      dusk: 'Вечер', night: 'Ночь',
    };
    const m = Math.max(0, Math.floor(remainSec / 60));
    const sec = Math.max(0, Math.floor(remainSec % 60));
    this.el.clock.innerHTML = `<b>${names[phase] || phase}</b> · до смены ${m}:${String(sec).padStart(2, '0')}`;
  }

  setTime(t) {
    this.el.timebar.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.tod === t));
    if (this.el.segT) this.el.segT.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.tod === t));
  }

  /** Громкость 0…1: обновляем положение ползунка и подпись (без побочных эффектов). */
  setVolume(v) {
    const pct = Math.round(Math.max(0, Math.min(1, v)) * 100);
    if (this.el.vol) this.el.vol.value = String(pct);
    if (this.el.volVal) this.el.volVal.textContent = `${pct}%`;
  }

  /** Тумблер «Звук» показывает mute-состояние: 0 % — выключен, иначе звук включён. */
  syncSoundToggle() {
    if (!this.el.vol || !this.el.tSound) return;
    const on = +this.el.vol.value > 0;
    const changed = this.el.tSound.classList.contains('on') !== on;
    this.el.tSound.classList.toggle('on', on);
    if (changed && this.onSound) this.onSound(on);
  }

  /**
   * Переключение звука (тумблер или клавиша M).
   * Если ползунок стоит в нуле, включение поднимает его до разумного уровня —
   * иначе «звук включён», но слышать нечего.
   */
  toggleSound() {
    const wantOn = !this.el.tSound.classList.contains('on');
    if (wantOn && this.el.vol && +this.el.vol.value === 0) {
      this.setVolume(0.8);
      this.el.tSound.classList.add('on');
      if (this.onVol) this.onVol(0.8);
      if (this.onSound) this.onSound(true);
      return;
    }
    this.el.tSound.classList.toggle('on', wantOn);
    if (this.onSound) this.onSound(wantOn);
  }

  setPrompt(text) {
    if (text) {
      this.el.promptText.textContent = text;
      this.el.prompt.classList.add('on');
    } else {
      this.el.prompt.classList.remove('on');
    }
  }

  toast(text, ms = 2200) {
    this.el.toast.textContent = text;
    this.el.toast.classList.add('on');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.el.toast.classList.remove('on'), ms);
  }

  /* ---------- панель команд пса ---------- */
  openDogMenu(status = '') {
    this.el.dogCmd.classList.add('on');
    document.body.classList.add('uiFocus');
    this.el.dogStatus.textContent = status;
    const btns = this.el.dogCmd.querySelectorAll('.dogBtns button');
    btns.forEach((b) => {
      b.onclick = () => this.onDogCommand && this.onDogCommand(b.dataset.cmd);
    });
  }
  closeDogMenu() {
    this.el.dogCmd.classList.remove('on');
    document.body.classList.remove('uiFocus');
  }
  get dogMenuOpen() { return this.el.dogCmd.classList.contains('on'); }
  setDogStatus(t) { this.el.dogStatus.textContent = t; }

  openMenu() { this.el.menu.classList.add('on'); }
  closeMenu() { this.el.menu.classList.remove('on'); }
  get menuOpen() { return this.el.menu.classList.contains('on'); }
  toggleOptions(force) {
    const on = force !== undefined ? force : !this.menuOpen;
    this.el.menu.classList.toggle('on', on);
    return on;
  }


  photoMode(on) {
    document.body.classList.toggle('photo', on);
  }

  /* --------------------- ловля --------------------- */

  showFishing(o) {
    this.el.fish.classList.add('on');
    document.body.classList.add('fishing');   // подсказки клавиш уступают место полоске
    this.setFishing(o);
  }

  setFishing(o) {
    this.el.fMark.style.left = (o.mark * 100) + '%';
    this.el.fZone.style.left = ((o.zonePos - o.zone / 2) * 100) + '%';
    this.el.fZone.style.width = (o.zone * 100) + '%';
    if (o.title) this.el.fTitle.textContent = o.title;
    this.el.fDots.innerHTML = '';
    for (let i = 0; i < o.need; i++) {
      const d = document.createElement('i');
      if (i < o.stage) d.className = 'on';
      this.el.fDots.appendChild(d);
    }
  }

  hideFishing() {
    this.el.fish.classList.remove('on');
    document.body.classList.remove('fishing');
  }
  get fishingOpen() { return this.el.fish.classList.contains('on'); }

  /* --------------------- диалог с персонажем --------------------- */

  /**
   * Открыть диалоговое окно.
   *
   * @param {object} d { name, title, text, topics, portrait }
   */
  openDialog(d) {
    this.el.dlgName.textContent = d.name || '';
    this.el.dlgTitle.textContent = d.title || '';
    this.el.dlgText.textContent = d.text || '';
    // портрет
    this.el.dlgPic.innerHTML = '';
    if (d.portrait) this.el.dlgPic.appendChild(d.portrait);
    // темы для разговора
    this.el.dlgTopics.innerHTML = '';
    for (const t of d.topics || []) {
      const b = document.createElement('button');
      b.textContent = t.label;
      b.addEventListener('click', () => this.onDialogTopic && this.onDialogTopic(t));
      this.el.dlgTopics.appendChild(b);
    }
    const bye = document.createElement('button');
    bye.className = 'dlgBye';
    bye.textContent = 'Покинуть';
    bye.addEventListener('click', () => this.onDialogClose && this.onDialogClose());
    this.el.dlgTopics.appendChild(bye);
    this.el.dialog.classList.add('on');
    document.body.classList.add('uiFocus');
  }

  /** Заменить реплику в открытом диалоге. */
  setDialogText(text) {
    this.el.dlgText.textContent = text || '';
  }

  /** Закрыть диалоговое окно. */
  closeDialog() {
    this.el.dialog.classList.remove('on');
    document.body.classList.remove('uiFocus');
  }

  get dialogOpen() { return this.el.dialog.classList.contains('on'); }

  /* --------------------- инвентарь: слоты, стаки, перетаскивание --------------------- */

  /** Перерисовать сетки: 9×3 хранилище, 9 пояса и пояс в HUD. */
  renderInventory(inv) {
    this.inv = inv;
    this.el.invGrid.innerHTML = '';
    this.el.invBelt.innerHTML = '';
    this.el.hotbar.innerHTML = '';
    for (let i = 0; i < MAIN_SLOTS; i++) this.el.invGrid.appendChild(this._slot(inv, i, 'main'));
    for (let i = MAIN_SLOTS; i < TOTAL_SLOTS; i++) this.el.invBelt.appendChild(this._slot(inv, i, 'belt'));
    for (let i = 0; i < BELT_SLOTS; i++) this.el.hotbar.appendChild(this._hudSlot(inv, MAIN_SLOTS + i));
    const st = inv.stats();
    this.el.invCount.textContent = st.total
      ? `${st.total} ${plural(st.total, 'рыба', 'рыбы', 'рыб')} · ${st.kinds} ${plural(st.kinds, 'вид', 'вида', 'видов')}`
      : 'пусто';
    this._paintHeld();
  }

  /** Один слот сетки. */
  _slot(inv, i, kind) {
    const el = document.createElement('div');
    el.className = 'slot';
    const s = inv.slots[i];
    if (s) {
      const icon = fishIcon(s.spec, 128);
      if (icon) el.appendChild(icon);
      if (s.count > 1) {
        const c = document.createElement('span');
        c.className = 'cnt';
        c.textContent = s.count;
        el.appendChild(c);
      }
      const b = document.createElement('span');
      b.className = 'badge';
      b.textContent = s.best.weight.toFixed(2) + 'кг';
      el.appendChild(b);
    } else {
      el.classList.add('empty');
    }
    if (kind === 'belt' && i - MAIN_SLOTS === inv.sel) el.classList.add('sel');
    el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      clickSlot(inv, i, e.button, e.shiftKey);
      this.renderInventory(inv);
    });
    el.addEventListener('mouseenter', () => this._hover(inv, i));
    el.addEventListener('mouseleave', () => this._hideTip());
    return el;
  }

  /** Слот пояса в HUD — без мыши, только отображение. */
  _hudSlot(inv, i) {
    const el = document.createElement('div');
    el.className = 'slot hudslot';
    const s = inv.slots[i];
    if (s) {
      const icon = fishIcon(s.spec, 96);
      if (icon) el.appendChild(icon);
      if (s.count > 1) {
        const c = document.createElement('span');
        c.className = 'cnt';
        c.textContent = s.count;
        el.appendChild(c);
      }
    } else {
      el.classList.add('empty');
    }
    if (i - MAIN_SLOTS === inv.sel) el.classList.add('sel');
    return el;
  }

  /** Наведение: подсказка + 3D-превью. */
  _hover(inv, i) {
    const s = inv.slots[i];
    if (!s) { this._hideTip(); return; }
    this._showTip(s);
    this._showPreview(s);
  }

  _showTip(s) {
    const t = this.el.invTip;
    const r = rarityOf(s.spec.rarity);
    t.innerHTML = '';
    const name = document.createElement('b');
    name.textContent = s.spec.name;
    name.style.color = r ? r.color : '#e9e6df';
    t.appendChild(name);
    const rar = document.createElement('i');
    rar.textContent = r ? r.label : '';
    rar.style.color = r ? r.color : '#e9e6df';
    t.appendChild(rar);
    const line = document.createElement('div');
    line.className = 'tl';
    line.textContent = `${s.best.weight.toFixed(2)} кг · ${Math.round(s.best.length)} см · ${s.spec.value} зол.`;
    t.appendChild(line);
    if (s.count > 1) {
      const c = document.createElement('div');
      c.className = 'tl';
      c.textContent = `В стаке: ${s.count} шт.`;
      t.appendChild(c);
    }
    const d = document.createElement('div');
    d.className = 'td';
    d.textContent = s.spec.desc || '';
    t.appendChild(d);
    t.classList.add('on');
    this._moveTip();
  }

  _moveTip() {
    const t = this.el.invTip;
    const w = t.offsetWidth || 200, h = t.offsetHeight || 90;
    let x = this._mx + 18, y = this._my + 16;
    if (x + w > innerWidth - 8) x = this._mx - w - 14;
    if (y + h > innerHeight - 8) y = innerHeight - h - 8;
    t.style.left = Math.max(8, x) + 'px';
    t.style.top = Math.max(8, y) + 'px';
  }

  _hideTip() { this.el.invTip.classList.remove('on'); }

  /** 3D-превью выбранной рыбы + подробности. */
  _showPreview(s) {
    const spec = s.spec;
    const r = rarityOf(spec.rarity);
    this.el.vName.textContent = spec.name;
    this.el.vRar.textContent = r ? r.label : spec.rarity;
    this.el.vRar.style.color = r ? r.color : '#e9e6df';
    this.el.vWeight.textContent = s.best.weight.toFixed(2) + ' кг';
    this.el.vLen.textContent = Math.round(s.best.length) + ' см';
    this.el.vValue.textContent = spec.value + ' зол.';
    this.el.vWhere.textContent = `${spec.lengthMin}–${spec.lengthMax} см, ${spec.weightMin}–${spec.weightMax} кг`;
    this.el.vDesc.textContent = spec.desc || '';
    this.el.viewCard.classList.add('has');
    this.fishView.show(spec);
  }

  /** Стак, который «висит на курсоре». */
  _paintHeld() {
    const h = this.el.invHeld;
    const s = this.inv ? this.inv.held : null;
    if (!s) { h.classList.remove('on'); h.innerHTML = ''; return; }
    h.innerHTML = '';
    const icon = fishIcon(s.spec, 128);
    if (icon) h.appendChild(icon);
    if (s.count > 1) {
      const c = document.createElement('span');
      c.className = 'cnt';
      c.textContent = s.count;
      h.appendChild(c);
    }
    h.classList.add('on');
    this._moveHeld();
  }

  _moveHeld() {
    const h = this.el.invHeld;
    if (!h.classList.contains('on')) return;
    h.style.left = this._mx + 'px';
    h.style.top = this._my + 'px';
  }

  openInv() {
    this.el.inv.classList.add('on');
    document.body.classList.add('uiFocus');
  }

  closeInv() {
    this.el.inv.classList.remove('on');
    document.body.classList.remove('uiFocus');
    this._hideTip();
    this._paintHeld();
    this.fishView.hide();
    this.el.viewCard.classList.remove('has');
  }

  get invOpen() { return this.el.inv.classList.contains('on'); }

  updateCompass(yaw) {
    const deg = ((-yaw * 180) / Math.PI + 360000) % 360;
    const w = this.el.compass.clientWidth / 2;
    this.el.strip.style.transform = `translateX(${w - (deg + 180) * this.pxPerDeg}px)`;
  }
}
