
import { FishView } from './fishview.js';
import { rarityOf } from './world/fish.js';
import { clickSlot, MAIN_SLOTS, BELT_SLOTS, TOTAL_SLOTS } from './inventory.js';
import { itemIcon, itemBadge, itemDesc } from './game/items.js';

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
      loadGame: document.getElementById('loadGame'),
      load: document.getElementById('load'),
      death: document.getElementById('death'),
      deathFade: document.getElementById('deathFade'),
      deathReason: document.getElementById('deathReason'),
      deathLastMeta: document.getElementById('deathLastMeta'),
      deathLast: document.getElementById('deathLast'),
      deathLoad: document.getElementById('deathLoad'),
      deathTitle: document.getElementById('deathTitle'),
      slots: document.getElementById('slots'),
      slotsList: document.getElementById('slotsList'),
      slotsClose: document.getElementById('slotsClose'),
      slotsBtn: document.getElementById('slotsBtn'),
      trade: document.getElementById('trade'),
      tradeName: document.getElementById('tradeName'),
      tradeTitle: document.getElementById('tradeTitle'),
      tradeGreet: document.getElementById('tradeGreet'),
      tradeMine: document.getElementById('tradeMine'),
      tradeGoods: document.getElementById('tradeGoods'),
      tradeFoot: document.getElementById('tradeFoot'),
      tradeClose: document.getElementById('tradeClose'),
      prompt: document.getElementById('prompt'),
      promptText: document.getElementById('promptText'),
      toast: document.getElementById('toast'),
      menu: document.getElementById('menu'),
      resume: document.getElementById('resume'),
      saveBtn: document.getElementById('saveBtn'),
      loadInMenu: document.getElementById('loadInMenu'),
      continue: document.getElementById('continue'),
      contDay: document.getElementById('contDay'),
      dateText: document.getElementById('dateText'),
      timebar: document.getElementById('timebar'),
      clock: document.getElementById('clock'),
      compass: document.getElementById('compass'),
      strip: document.getElementById('strip'),
      segQ: document.getElementById('segQ'),
      segDiff: document.getElementById('segDiff'),
      bossBar: document.getElementById('bossBar'),
      bossName: document.getElementById('bossName'),
      bossFill: document.getElementById('bossFill'),
      segT: document.getElementById('segT'),
      tBloom: document.getElementById('tBloom'),
      tSound: document.getElementById('tSound'),
      vol: document.getElementById('vol'),
      volVal: document.getElementById('volVal'),
      mus: document.getElementById('mus'),
      musVal: document.getElementById('musVal'),
      sens: document.getElementById('sens'),
      res: document.getElementById('res'),
      bob: document.getElementById('bob'),
      reticle: document.getElementById('reticle'),
      barHp: document.getElementById('barHp'),
      barSt: document.getElementById('barSt'),
      barMp: document.getElementById('barMp'),
      barFuel: document.getElementById('barFuel'),
      numFuel: document.getElementById('numFuel'),
      rowFuel: document.getElementById('rowFuel'),
      veil: document.getElementById('veil'),
      threat: document.getElementById('threat'),
      dmg: document.getElementById('dmg'),
      sealBar: document.getElementById('sealBar'),
      sealText: document.getElementById('sealText'),
      questTrack: document.getElementById('questTrack'),
      qtTitle: document.getElementById('qtTitle'),
      qtGoal: document.getElementById('qtGoal'),
      questLog: document.getElementById('questLog'),
      questList: document.getElementById('questList'),
      questClose: document.getElementById('questClose'),
      bestiary: document.getElementById('bestiary'),
      bestList: document.getElementById('bestList'),
      bestClose: document.getElementById('bestClose'),
      bestBtn: document.getElementById('bestBtn'),
      numHp: document.getElementById('numHp'),
      numSt: document.getElementById('numSt'),
      numMp: document.getElementById('numMp'),
      numCoins: document.getElementById('numCoins'),
      rowHp: document.getElementById('rowHp'),
      rowSt: document.getElementById('rowSt'),
      rowMp: document.getElementById('rowMp'),
      invCoinsNum: document.getElementById('invCoinsNum'),
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
      note: document.getElementById('note'),
      noteInput: document.getElementById('noteInput'),
      noteOk: document.getElementById('noteOk'),
      noteCancel: document.getElementById('noteCancel'),
      noteCount: document.getElementById('noteCount'),
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
    this.onLoadGame = null;      // «Загрузить игру» на титульном экране
    this.onSlotLoad = null;      // загрузить выбранный слот
    this.onSlotSave = null;      // сохранить в выбранный слот
    this.onDeathLast = null;     // «Загрузить последнее сохранение»
    this.onDeathLoad = null;     // «Загрузить» — открыть список слотов
    this.onDeathTitle = null;    // «В начало» — на титульный экран
    this.onSlotsClose = null;
    this.onQuestClose = null;      // журнал дел закрыт (крестик или клик мимо)
    this.onBestClose = null;       // зверинец закрыт (крестик или клик мимо)
    this.onBestOpen = null;        // зверинец открыт (кнопка в меню)
    this.onTradeSell = null;      // игрок продаёт предмет
    this.onTradeBuy = null;       // игрок покупает предмет
    this.onTradeClose = null;
    this.slotList = null;        // данные слотов (заполняет main.js)
    this.onTime = null;
    this.onQuality = null;
    this.onBloom = null;
    this.onSound = null;
    this.onVol = null;
    this.onMus = null;
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

  /**
   * Скрыть панель подсказок по управлению.
   *
   * Панель занимает левую часть кадра и закрывает лук и оружие,
   * поэтому через несколько секунд после старта (или при первом
   * движении) она исчезает.
   *
   * @param {number} [delay] через сколько секунд скрыть
   */
  hideHintsSoon(delay = 14000) {
    const hints = document.getElementById('hints');
    if (!hints || hints.dataset.gone) return;
    const hide = () => {
      hints.classList.add('hide');
      hints.dataset.gone = '1';
    };
    setTimeout(hide, delay);
    const moveKeys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'];
    const onKey = (e) => {
      if (moveKeys.includes(e.code)) {
        hide();
        window.removeEventListener('keydown', onKey);
      }
    };
    window.addEventListener('keydown', onKey);
  }

  _bind() {
    this.el.begin.addEventListener('click', () => {
      if (this.onStart) this.onStart();
      this.hideHintsSoon();
    });
    this.el.loadGame.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.onLoadGame) this.onLoadGame();
    });
    this.el.deathLast.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.onDeathLast) this.onDeathLast();
    });
    this.el.deathLoad.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.onDeathLoad) this.onDeathLoad();
    });
    this.el.deathTitle.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.onDeathTitle) this.onDeathTitle();
    });
    this.el.slotsBtn && this.el.slotsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.onSlotsOpen) this.onSlotsOpen();
    });
    this.el.tradeClose.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.onTradeClose) this.onTradeClose();
    });
    this.el.trade.addEventListener('click', (e) => {
      if (e.target === this.el.trade && this.onTradeClose) this.onTradeClose();
    });
    this.el.slotsClose.addEventListener('click', (e) => {
      e.stopPropagation();
      this.hideSlots();
      if (this.onSlotsClose) this.onSlotsClose();
    });
    this.el.slots.addEventListener('click', (e) => {
      // клик мимо списка — закрыть окно
      if (e.target === this.el.slots) {
        this.hideSlots();
        if (this.onSlotsClose) this.onSlotsClose();
      }
    });
    // журнал дел: крестик и клик мимо карточки
    if (this.el.questClose) {
      this.el.questClose.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeQuestLog();
        if (this.onQuestClose) this.onQuestClose();
      });
    }
    if (this.el.questLog) {
      this.el.questLog.addEventListener('click', (e) => {
        if (e.target === this.el.questLog) {
          this.closeQuestLog();
          if (this.onQuestClose) this.onQuestClose();
        }
      });
    }
    // зверинец: крестик и клик мимо карточки
    if (this.el.bestClose) {
      this.el.bestClose.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeBestiary();
        if (this.onBestClose) this.onBestClose();
      });
    }
    if (this.el.bestiary) {
      this.el.bestiary.addEventListener('click', (e) => {
        if (e.target === this.el.bestiary) {
          this.closeBestiary();
          if (this.onBestClose) this.onBestClose();
        }
      });
    }
    if (this.el.bestBtn) {
      this.el.bestBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.onBestOpen) this.onBestOpen();
      });
    }
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
    if (this.el.segDiff) {
      this.el.segDiff.querySelectorAll('button').forEach((b) => {
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          this.el.segDiff.querySelectorAll('button').forEach((x) => x.classList.remove('on'));
          b.classList.add('on');
          if (this.onDifficulty) this.onDifficulty(b.dataset.diff);
        });
      });
    }
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
    if (this.el.mus) {
      this.el.mus.addEventListener('input', (e) => {
        e.stopPropagation();
        const v = Math.max(0, Math.min(100, +e.target.value)) / 100;
        this.setMusicVolume(v);
        if (this.onMus) this.onMus(v);
      });
    }
    this.el.resume.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.onResume) this.onResume();
    });
    this.el.saveBtn && this.el.saveBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.onSave) this.onSave();
    });
    this.el.loadInMenu && this.el.loadInMenu.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.onLoadInMenu) this.onLoadInMenu();
    });
    this.el.continue && this.el.continue.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.onContinue) this.onContinue();
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

  /**
   * Скрыть титульный экран.
   *
   * Класс `gone` гасит прозрачность плавно, но на него одного полагаться
   * нельзя: переход по opacity умеет «зависать» (особенно при тяжёлом
   * рендере), и тогда экран остаётся на месте. Поэтому через 0,75 с слой
   * убирается из раскладки в любом случае.
   */
  hideStart() {
    const el = this.el.start;
    if (!el) return;
    clearTimeout(this._startTimer);
    el.classList.add('gone');
    this._startTimer = setTimeout(() => {
      if (el.classList.contains('gone')) el.style.display = 'none';
    }, 750);
  }

  /** Показать титульный экран снова. */
  showStart() {
    const el = this.el.start;
    if (!el) return;
    clearTimeout(this._startTimer);
    el.style.display = '';
    el.classList.remove('gone');
  }
  setLoading(text) { this.el.load.textContent = text; }

  /**
   * Дата в углу: «День 7, осень».
   *
   * @param {string} text подпись
   */
  setDate(text) {
    if (this.el.dateText) this.el.dateText.textContent = text;
  }

  /**
   * Показать или спрятать кнопку «Продолжить» на титульном экране.
   *
   * @param {boolean} on показывать
   * @param {number|string} day номер дня в сохранении
   */
  setContinue(on, day) {
    if (!this.el.continue) return;
    this.el.continue.classList.toggle('hidden', !on);
    if (on && this.el.contDay) this.el.contDay.textContent = `· день ${day ?? 1}`;
  }

  /* ================================================================
   *  Экран смерти
   * ================================================================ */

  /**
   * Затемнить кадр — падение игрока.
   *
   * @param {number} k 0 — светло, 1 — черно
   */
  setDeathFade(k) {
    if (!this.el.deathFade) return;
    this.el.deathFade.style.opacity = String(Math.max(0, Math.min(1, k)) * 0.82);
  }

  /**
   * Показать экран «Погиб».
   *
   * @param {string} reason причина смерти
   * @param {object} [meta] данные последнего сохранения
   */
  showDeath(reason, meta) {
    if (!this.el.death) return;
    if (this.el.deathReason) this.el.deathReason.textContent = reason || 'Вы пали.';
    if (this.el.deathLastMeta) {
      this.el.deathLastMeta.textContent = meta && meta.exists
        ? `последнее сохранение — день ${meta.day}, ${meta.seasonName || meta.season} · ${meta.coins} зол.`
        : 'сохранений нет';
    }
    this.el.death.classList.add('on');
    // плавное появление: сначала фон, потом содержимое
    requestAnimationFrame(() => this.el.death.classList.add('shown'));
    document.body.classList.add('uiFocus');
    if (document.pointerLockElement) document.exitPointerLock();
  }

  /** Скрыть экран «Погиб». */
  hideDeath() {
    if (!this.el.death) return;
    this.el.death.classList.remove('on', 'shown');
    this.setDeathFade(0);
    document.body.classList.remove('uiFocus');
  }

  get deathOpen() {
    return this.el.death && this.el.death.classList.contains('on');
  }

  /* ================================================================
   *  Окно торговли
   * ================================================================ */

  /**
   * Открыть окно торговли.
   *
   * @param {object} data { name, title, greet, goods }
   */
  openTrade(data) {
    if (!this.el.trade) return;
    this.el.tradeName.textContent = data.name || '';
    this.el.tradeTitle.textContent = data.title || '';
    this.el.tradeGreet.textContent = data.greet || '';
    this.el.trade.classList.add('on');
    document.body.classList.add('uiFocus');
    if (document.pointerLockElement) document.exitPointerLock();
  }

  /** Закрыть окно торговли. */
  closeTrade() {
    if (!this.el.trade) return;
    this.el.trade.classList.remove('on');
    if (!this.deathOpen) document.body.classList.remove('uiFocus');
  }

  get tradeOpen() {
    return this.el.trade && this.el.trade.classList.contains('on');
  }

  /**
   * Перерисовать содержимое окна торговли.
   *
   * @param {object} data { mine: [{id,spec,count,price}], goods: [{id,name,price,...}] }
   */
  renderTrade(data) {
    if (!this.el.trade) return;
    this.el.tradeMine.innerHTML = '';
    this.el.tradeGoods.innerHTML = '';
    const mine = data.mine || [];
    const goods = data.goods || [];

    if (!mine.length) {
      const e = document.createElement('div');
      e.className = 'tradeEmpty';
      e.textContent = 'Нечего продавать.';
      this.el.tradeMine.appendChild(e);
    }
    for (const m of mine) {
      const row = document.createElement('div');
      row.className = 'tradeRow';
      const icon = itemIcon(m.spec, 68);
      if (icon) row.appendChild(icon);
      const info = document.createElement('div');
      info.className = 'tradeInfo';
      const b = document.createElement('b');
      b.textContent = m.spec.name + (m.count > 1 ? ` ×${m.count}` : '');
      const sp = document.createElement('span');
      sp.textContent = `даст ${m.price} зол.`;
      info.appendChild(b);
      info.appendChild(sp);
      row.appendChild(info);
      const btn = document.createElement('button');
      btn.className = 'tradeBtn';
      btn.textContent = 'Продать';
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.onTradeSell) this.onTradeSell(m.id);
      });
      row.appendChild(btn);
      this.el.tradeMine.appendChild(row);
    }

    for (const g of goods) {
      const row = document.createElement('div');
      row.className = 'tradeRow';
      row.dataset.id = g.id;
      const icon = itemIcon(g, 68);
      if (icon) row.appendChild(icon);
      const info = document.createElement('div');
      info.className = 'tradeInfo';
      const b = document.createElement('b');
      b.textContent = g.name;
      const sp = document.createElement('span');
      sp.textContent = g.dmg
        ? `урон ${g.dmg[0]}–${g.dmg[1]} · замах ${g.speed.toFixed(2)} с · ${g.price} зол.`
        : g.mana
          ? `${g.mana} маны за раз · ${g.price} зол.`
          : `${g.price} зол.`;
      info.appendChild(b);
      info.appendChild(sp);
      row.appendChild(info);
      const btn = document.createElement('button');
      btn.className = 'tradeBtn';
      btn.textContent = 'Купить';
      btn.disabled = !this.stats || this.stats.coins < g.price;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.onTradeBuy) this.onTradeBuy(g.id);
      });
      row.appendChild(btn);
      this.el.tradeGoods.appendChild(row);
    }

    const coins = this.stats ? this.stats.coins : 0;
    this.el.tradeFoot.textContent = `В кошельке: ${coins} зол.`;
  }

  /* ================================================================
   *  Окно загрузки (слоты)
   * ================================================================ */

  /**
   * Открыть окно загрузки.
   *
   * @param {Array} slots данные слотов (см. `listSlots` в game/save.js)
   */
  showSlots(slots) {
    if (!this.el.slots) return;
    this.slotList = slots || [];
    this._renderSlots();
    this.el.slots.classList.add('on');
    document.body.classList.add('uiFocus');
    if (document.pointerLockElement) document.exitPointerLock();
  }

  /** Закрыть окно загрузки. */
  hideSlots() {
    if (!this.el.slots) return;
    this.el.slots.classList.remove('on');
    if (!this.deathOpen) document.body.classList.remove('uiFocus');
  }

  get slotsOpen() {
    return this.el.slots && this.el.slots.classList.contains('on');
  }

  /**
   * Перерисовать список слотов.
   */
  _renderSlots() {
    const list = this.el.slotsList;
    if (!list) return;
    const fmt = (ts) => {
      if (!ts) return '';
      const d = new Date(ts);
      const p2 = (n) => String(n).padStart(2, '0');
      return `${p2(d.getDate())}.${p2(d.getMonth() + 1)} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
    };
    const seasonName = { spring: 'весна', summer: 'лето', autumn: 'осень', winter: 'зима' };
    let html = '';
    for (const s of this.slotList || []) {
      const meta = s.exists
        ? `День ${s.day}, ${seasonName[s.season] || s.season} · ${s.coins} зол.${s.at ? ' · ' + fmt(s.at) : ''}`
        : 'пусто';
      const isAuto = s.key === 'last';
      html += `<div class="slotRow ${isAuto ? 'auto' : ''} ${s.exists ? '' : 'empty'}" data-key="${s.key}" data-index="${s.index}">
        <div class="slotInfo"><b>${s.title}</b><span>${meta}</span></div>
        <div class="slotActs">
          <button data-act="load"${s.exists ? '' : ' disabled'}>Загрузить</button>
          ${isAuto ? '' : `<button data-act="save">Сохранить</button>`}
        </div>
      </div>`;
    }
    list.innerHTML = html;
    list.querySelectorAll('.slotActs button').forEach((b) => {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        const row = b.closest('.slotRow');
        const key = row.dataset.key;
        const index = +row.dataset.index;
        if (b.dataset.act === 'load') {
          if (this.onSlotLoad) this.onSlotLoad(key, index);
        } else if (this.onSlotSave) {
          this.onSlotSave(key, index);
        }
      });
    });
  }

  /** Часы в углу: текущий период и сколько осталось до следующего. */
  setClock(phase, remainSec) {
    if (!this.el.clock) return;
    const names = {
      morning: 'Утро', day: 'День', golden: 'Золотой час',
      dusk: 'Сумерки', night: 'Ночь',
    };
    const m = Math.max(0, Math.floor(remainSec / 60));
    const sec = Math.max(0, Math.floor(remainSec % 60));
    this.el.clock.innerHTML = `<b>${names[phase] || phase}</b> · до смены ${m}:${String(sec).padStart(2, '0')}`;
  }

  setTime(t) {
    this.el.timebar.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.tod === t));
    if (this.el.segT) this.el.segT.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.tod === t));
  }

  /* ---------------- характеристики ---------------- */

  /**
   * Обновить полоски жизни, сил и маны.
   *
   * @param {object} s объект характеристик (PlayerStats)
   */
  setVitals(s) {
    if (!s) return;
    const set = (bar, num, row, value, max) => {
      if (bar) bar.style.transform = `scaleX(${max ? Math.max(0, Math.min(1, value / max)) : 0})`;
      if (num) num.textContent = String(Math.ceil(value));
      if (row) row.classList.toggle('low', value <= max * 0.25);
    };
    set(this.el.barHp, this.el.numHp, this.el.rowHp, s.hp, s.maxHp);
    set(this.el.barSt, this.el.numSt, this.el.rowSt, s.stamina, s.maxStamina);
    set(this.el.barMp, this.el.numMp, this.el.rowMp, s.mana, s.maxMana);
  }

  /* ---------------- бой ---------------- */

  /**
   * Включить или выключить боевой интерфейс (полоса топлива).
   *
   * @param {boolean} on активен ли бой
   */
  setCombat(on) {
    document.body.classList.toggle('combat', !!on);
    if (!on) {
      if (this.el.veil) this.el.veil.classList.remove('on');
      if (this.el.threat) this.el.threat.classList.remove('on');
      if (this.el.reticle) this.el.reticle.classList.remove('target', 'swing');
      if (this.el.sealBar) this.el.sealBar.classList.remove('on');
    }
  }

  /**
   * Подсказка о печати: что мешает пройти дальше.
   *
   * Пустая строка — подсказки нет (например, все печати уже пали).
   *
   * @param {string} text текст подсказки
   */
  setSeal(text) {
    if (!this.el.sealBar || !this.el.sealText) return;
    if (!text) {
      this.el.sealBar.classList.remove('on');
      return;
    }
    if (this.el.sealText.textContent !== text) this.el.sealText.textContent = text;
    this.el.sealBar.classList.add('on');
  }

  /* --------------------- дела: журнал и трекер --------------------- */

  /**
   * Перерисовать журнал дел и трекер в углу экрана.
   *
   * @param {Array<object>} list дела: { id, title, giver, giverName, status,
   *   statusText, desc, objectives: [{label, text, done}], reward }
   */
  renderQuests(list) {
    const rows = Array.isArray(list) ? list : [];
    this._quests = rows;

    // «готово к сдаче» считаем сами: цель выполнена, когда все её пункты закрыты
    const readyOf = (q) => q.status === 'active'
      && q.objectives.length > 0
      && q.objectives.every((o) => o.done);

    // --- трекер: первое дело в работе (или готовое к сдаче) ---
    const track = rows.find(readyOf) || rows.find((q) => q.status === 'active');
    if (this.el.questTrack) {
      if (!track) {
        this.el.questTrack.classList.remove('on');
      } else {
        this.el.questTrack.classList.add('on');
        this.el.questTrack.classList.toggle('ready', readyOf(track));
        if (this.el.qtTitle) this.el.qtTitle.textContent = track.title;
        if (this.el.qtGoal) {
          const first = track.objectives.find((o) => !o.done) || track.objectives[0];
          this.el.qtGoal.innerHTML = first
            ? `${first.label} — <b>${first.text}</b>`
            : '';
        }
      }
    }

    // --- журнал: полный список ---
    if (!this.el.questList) return;
    this.el.questList.innerHTML = '';
    if (!rows.length) {
      const p = document.createElement('p');
      p.className = 'qLogEmpty';
      p.textContent = 'Пока никаких дел. Загляните к Хорту в трактир '
        + 'или к Торну в кузню — там всегда найдётся работа.';
      this.el.questList.appendChild(p);
      return;
    }
    for (const q of rows) {
      const item = document.createElement('div');
      const ready = readyOf(q);
      item.className = 'qItem'
        + (q.status === 'done' ? ' done' : '')
        + (ready ? ' ready' : '');

      const top = document.createElement('div');
      top.className = 'qTop';
      const b = document.createElement('b');
      b.textContent = q.title;
      const who = document.createElement('i');
      who.textContent = q.giverName || '';
      const st = document.createElement('span');
      st.className = 'qState';
      st.textContent = ready ? 'Готово к сдаче' : q.statusText;
      top.appendChild(b);
      top.appendChild(who);
      top.appendChild(st);
      item.appendChild(top);

      if (q.desc) {
        const d = document.createElement('p');
        d.className = 'qDesc';
        d.textContent = q.desc;
        item.appendChild(d);
      }

      const ul = document.createElement('ul');
      ul.className = 'qGoals';
      for (const o of q.objectives) {
        const li = document.createElement('li');
        if (o.done) li.classList.add('done');
        li.appendChild(document.createTextNode(o.label));
        const num = document.createElement('b');
        num.textContent = o.text;
        li.appendChild(num);
        ul.appendChild(li);
      }
      item.appendChild(ul);

      if (q.reward) {
        const r = document.createElement('div');
        r.className = 'qReward';
        r.innerHTML = 'Награда: <b></b>';
        r.querySelector('b').textContent = q.reward;
        item.appendChild(r);
      }

      this.el.questList.appendChild(item);
    }
  }

  /**
   * Открыть журнал дел.
   */
  openQuestLog() {
    if (!this.el.questLog) return;
    this.el.questLog.classList.add('on');
    document.body.classList.add('uiFocus');
  }

  /**
   * Закрыть журнал дел.
   */
  closeQuestLog() {
    if (!this.el.questLog) return;
    this.el.questLog.classList.remove('on');
    if (!this.deathOpen) document.body.classList.remove('uiFocus');
  }

  /** Открыт ли журнал дел. */
  get questLogOpen() {
    return !!(this.el.questLog && this.el.questLog.classList.contains('on'));
  }

  /* ---------------- зверинец ---------------- */

  /**
   * Нарисовать «Зверинец» — список пород с полными характеристиками.
   *
   * Породы идут по ступеням силы: мелочь, обычные, стража, владыка.
   * Внутри ступени — сначала самые опасные.
   *
   * @param {object[]} list породы (из `src/game/bestiary.js`)
   * @param {object[]} tiers ступени силы с названиями
   */
  renderBestiary(list, tiers) {
    if (!this.el.bestList) return;
    const rows = Array.isArray(list) ? list : [];
    const steps = Array.isArray(tiers) && tiers.length
      ? tiers
      : [{ id: 'trash', name: 'Мелочь', desc: '' }];
    this.el.bestList.innerHTML = '';

    if (!rows.length) {
      const p = document.createElement('p');
      p.className = 'qLogEmpty';
      p.textContent = 'Пока никто не описан. Загляните в подземелье под скалой.';
      this.el.bestList.appendChild(p);
      return;
    }

    for (const tier of steps) {
      const inTier = rows.filter((r) => r.tier === tier.id);
      if (!inTier.length) continue;

      const head = document.createElement('div');
      head.className = 'bTierHead';
      const name = document.createElement('b');
      name.textContent = tier.name;
      const desc = document.createElement('i');
      desc.textContent = tier.desc || '';
      head.appendChild(name);
      head.appendChild(desc);
      this.el.bestList.appendChild(head);

      for (const r of inTier) {
        this.el.bestList.appendChild(this._bestiaryItem(r));
      }
    }
  }

  /**
   * Карточка одной породы.
   *
   * @param {object} r порода (из `src/game/bestiary.js`)
   * @returns {HTMLElement} элемент карточки
   */
  _bestiaryItem(r) {
    const item = document.createElement('div');
    item.className = 'bItem ' + (r.tier || 'trash');
    item.dataset.monster = r.id;

    // --- заголовок: имя, где водится, ступень ---
    const top = document.createElement('div');
    top.className = 'bTop';
    const b = document.createElement('b');
    b.textContent = r.name;
    const where = document.createElement('i');
    where.className = 'bWhere';
    where.textContent = r.where || '';
    const state = document.createElement('span');
    state.className = 'bState';
    state.textContent = r.tierName || '';
    top.appendChild(b);
    top.appendChild(where);
    top.appendChild(state);
    item.appendChild(top);

    // --- описание породы ---
    if (r.desc) {
      const d = document.createElement('p');
      d.className = 'bDesc';
      d.textContent = r.desc;
      item.appendChild(d);
    }

    // --- характеристики ---
    const stats = document.createElement('div');
    stats.className = 'bStats';
    const stat = (label, value) => {
      const s = document.createElement('span');
      const u = document.createElement('u');
      u.textContent = label;
      const v = document.createElement('b');
      v.textContent = value;
      s.appendChild(u);
      s.appendChild(v);
      stats.appendChild(s);
    };
    stat('здоровье', String(r.hp));
    stat('урон', String(r.dmg));
    stat('скорость', r.speed.toFixed(1));
    stat('дальность', r.reach + ' м');
    stat('замах', r.cd.toFixed(1) + ' с');
    stat('стойкость', String(r.veil));
    if (r.armor) stat('броня', Math.round(r.armor * 100) + '%');
    if (r.guard) stat('щит', Math.round(r.guard * 100) + '%');
    stat('стая', String(r.sp));
    stat('вес', String(r.exp));
    item.appendChild(stats);

    // --- как бороться ---
    if (r.tip) {
      const tip = document.createElement('p');
      tip.className = 'bTip';
      const u = document.createElement('u');
      u.textContent = 'как бить';
      tip.appendChild(u);
      tip.appendChild(document.createTextNode(r.tip));
      item.appendChild(tip);
    }

    // --- добыча ---
    if (r.drops && r.drops.length) {
      const loot = document.createElement('div');
      loot.className = 'bLoot';
      const u = document.createElement('u');
      u.textContent = 'добыча';
      loot.appendChild(u);
      loot.appendChild(document.createTextNode(r.drops.join(' · ')));
      item.appendChild(loot);
    }

    return item;
  }

  /**
   * Открыть «Зверинец».
   */
  openBestiary() {
    if (!this.el.bestiary) return;
    this.el.bestiary.classList.add('on');
    document.body.classList.add('uiFocus');
  }

  /**
   * Закрыть «Зверинец».
   */
  closeBestiary() {
    if (!this.el.bestiary) return;
    this.el.bestiary.classList.remove('on');
    if (!this.deathOpen) document.body.classList.remove('uiFocus');
  }

  /** Открыт ли «Зверинец». */
  get bestiaryOpen() {
    return !!(this.el.bestiary && this.el.bestiary.classList.contains('on'));
  }

  /**
   * Факел в руках: показываем полоску топлива даже вне подземелья.
   *
   * @param {boolean} on взят ли факел в руку
   */
  setTorch(on) {    document.body.classList.toggle('hasTorch', !!on);
  }

  /**
   * Полоска топлива факела.
   *
   * @param {number} fuel сколько осталось
   * @param {number} max максимум
   */
  setFire(fuel, max) {
    if (!this.el.barFuel) return;
    const r = max ? Math.max(0, Math.min(1, fuel / max)) : 0;
    this.el.barFuel.style.transform = `scaleX(${r})`;
    if (this.el.numFuel) this.el.numFuel.textContent = String(Math.ceil(fuel));
    if (this.el.rowFuel) this.el.rowFuel.classList.toggle('low', r <= 0.1);
  }

  /**
   * Пипсы «veil» у цели под прицелом.
   *
   * @param {number} veil сколько осталось
   * @param {number} max сколько всего
   */
  setVeil(veil, max) {
    if (!this.el.veil) return;
    const dots = this.el.veil.children;
    if (!veil || veil <= 0) { this.el.veil.classList.remove('on'); return; }
    this.el.veil.classList.add('on');
    for (let i = 0; i < dots.length; i++) {
      dots[i].classList.toggle('full', i < veil);
    }
  }

  /**
   * Состояние прицела: цель под прицелом и замах.
   *
   * @param {boolean} target есть ли цель в конусе
   * @param {boolean} swing идёт ли замах
   */
  setReticle(target, swing) {
    if (!this.el.reticle) return;
    this.el.reticle.classList.toggle('target', !!target);
    this.el.reticle.classList.toggle('swing', !!swing);
  }

  /**
   * Слой угрозы: непрозрачность 0…1.
   *
   * @param {number} v уровень угрозы
   */
  /**
   * Полоска здоровья босса.
   *
   * @param {string|null} name имя босса (null — убрать полоску)
   * @param {number} ratio 0…1
   */
  setBoss(name, ratio) {
    const bar = this.el.bossBar;
    if (!bar) return;
    if (!name) {
      bar.classList.remove('on');
      return;
    }
    bar.classList.add('on');
    this.el.bossName.textContent = name;
    this.el.bossFill.style.transform = `scaleX(${Math.max(0, Math.min(1, ratio))})`;
  }

  /**
   * Подсветить выбранную сложность.
   *
   * @param {string} id идентификатор сложности
   */
  setDifficulty(id) {
    if (!this.el.segDiff) return;
    this.el.segDiff.querySelectorAll('button').forEach((x) => {
      x.classList.toggle('on', x.dataset.diff === id);
    });
  }

  setThreat(v) {
    if (!this.el.threat) return;
    const on = v > 0.02;
    this.el.threat.classList.toggle('on', on);
    this.el.threat.style.opacity = on ? String(Math.min(0.55, v * 0.55)) : '0';
  }

  /**
   * Вспышка урона по краям экрана.
   */
  flashDamage() {
    if (!this.el.dmg) return;
    this.el.dmg.classList.add('on');
    setTimeout(() => this.el.dmg && this.el.dmg.classList.remove('on'), 180);
  }

  /**
   * Цифра урона над зверем.
   *
   * Экранные координаты считает боевая система: у интерфейса нет камеры,
   * а проекция должна идти от того же кадра, который видит игрок.
   *
   * @param {number} sx экранная X
   * @param {number} sy экранная Y
   * @param {number} amount сколько урона
   * @param {boolean} [crit] критический ли удар
   */
  popDamage(sx, sy, amount, crit = false) {
    const el = document.createElement('div');
    el.className = crit ? 'dmgNum crit' : 'dmgNum';
    el.textContent = crit ? `${amount}!` : String(amount);
    el.style.left = `${Math.round(sx)}px`;
    el.style.top = `${Math.round(sy)}px`;
    document.body.appendChild(el);
    setTimeout(() => el.classList.add('go'), 70);
    setTimeout(() => el.remove(), 1150);
  }

  /**
   * Обновить счётчик монет (в HUD и в инвентаре).
   *
   * @param {number} n сколько монет
   */
  setCoins(n) {
    const v = String(Math.max(0, Math.round(n || 0)));
    if (this.el.numCoins) this.el.numCoins.textContent = v;
    if (this.el.invCoinsNum) this.el.invCoinsNum.textContent = v;
  }

  /** Громкость 0…1: обновляем положение ползунка и подпись (без побочных эффектов). */
  setVolume(v) {
    const pct = Math.round(Math.max(0, Math.min(1, v)) * 100);
    if (this.el.vol) this.el.vol.value = String(pct);
    if (this.el.volVal) this.el.volVal.textContent = `${pct}%`;
  }

  /** Громкость музыки 0…1: обновляем ползунок и подпись. */
  setMusicVolume(v) {
    const pct = Math.round(Math.max(0, Math.min(1, v)) * 100);
    if (this.el.mus) this.el.mus.value = String(pct);
    if (this.el.musVal) this.el.musVal.textContent = `${pct}%`;
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

  /* ---------- доска для записки ---------- */
  /**
   * Открыть окно записи на доске.
   *
   * @param {string} current уже написанный текст (если есть)
   * @param {Function} onSubmit обработчик записи
   */
  openNote(current = '', onSubmit = null) {
    this.el.note.classList.add('on');
    document.body.classList.add('uiFocus');
    const inp = this.el.noteInput;
    inp.value = current || '';
    this.onNoteSubmit = onSubmit;
    this._noteCount();
    inp.oninput = () => this._noteCount();
    inp.focus();
    inp.setSelectionRange(inp.value.length, inp.value.length);
    this.el.noteOk.onclick = () => {
      const v = inp.value.trim();
      this.closeNote();
      if (this.onNoteSubmit) this.onNoteSubmit(v);
    };
    this.el.noteCancel.onclick = () => {
      this.closeNote();
      if (this.onNoteCancel) this.onNoteCancel();
    };
  }

  /** Обновить счётчик символов. */
  _noteCount() {
    const n = this.el.noteInput.value.length;
    this.el.noteCount.textContent = `${n} / ${this.el.noteInput.maxLength}`;
  }

  /** Закрыть окно записи. */
  closeNote() {
    this.el.note.classList.remove('on');
    document.body.classList.remove('uiFocus');
    this.el.noteInput.blur();
  }

  /** Открыто ли окно записи. */
  get noteOpen() { return this.el.note.classList.contains('on'); }

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
    this.setDialogTopics(d.topics);
    this.el.dialog.classList.add('on');
    document.body.classList.add('uiFocus');
  }

  /**
   * Перерисовать темы разговора, не закрывая окно.
   *
   * Нужно, когда состояние изменилось прямо во время разговора: взял дело —
   * и темы должны обновиться сразу, а не после закрытия и нового открытия.
   *
   * @param {Array<object>} topics темы: { label, text, trade, act }
   */
  setDialogTopics(topics) {
    this.el.dlgTopics.innerHTML = '';
    for (const t of topics || []) {
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
      ? `${st.total} ${plural(st.total, 'предмет', 'предмета', 'предметов')} · ${st.kinds} ${plural(st.kinds, 'вид', 'вида', 'видов')}`
      : 'пусто';
    if (this.stats) this.setCoins(this.stats.coins);
    this._paintHeld();
  }

  /** Один слот сетки. */
  _slot(inv, i, kind) {
    const el = document.createElement('div');
    el.className = 'slot';
    const s = inv.slots[i];
    if (s) {
      const icon = itemIcon(s.spec, 128);
      if (icon) el.appendChild(icon);
      if (s.count > 1) {
        const c = document.createElement('span');
        c.className = 'cnt';
        c.textContent = s.count;
        el.appendChild(c);
      }
      const badge = itemBadge(s.spec, s);
      if (badge) {
        const b = document.createElement('span');
        b.className = 'badge';
        b.textContent = badge;
        el.appendChild(b);
      }
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
      const icon = itemIcon(s.spec, 96);
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
    const info = itemDesc(s.spec, s);
    const line = document.createElement('div');
    line.className = 'tl';
    line.textContent = info.rows.map(([k, v]) => `${k}: ${v}`).join(' · ');
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
    if (s.spec.tip) {
      const tip = document.createElement('div');
      tip.className = 'td';
      tip.textContent = s.spec.tip;
      t.appendChild(tip);
    }
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
    const info = itemDesc(spec, s);
    const pick = (label) => {
      const row = info.rows.find(([k]) => k === label);
      return row ? row[1] : '—';
    };
    this.el.vWeight.textContent = pick('Вес');
    this.el.vLen.textContent = pick('Длина') !== '—' ? pick('Длина') : pick('Урон');
    this.el.vValue.textContent = `${spec.value ?? spec.price ?? 0} зол.`;
    this.el.vWhere.textContent = info.rows
      .filter(([k]) => k !== 'Вес' && k !== 'Длина' && k !== 'Цена')
      .map(([k, v]) => `${k}: ${v}`)
      .join(' · ');
    this.el.vDesc.textContent = spec.desc || '';
    // подписи в карточке зависят от вида предмета
    const labels = spec.kind === 'weapon'
      ? ['Урон', 'Замах', 'Цена', 'Особенности']
      : spec.kind === 'fish'
        ? ['Вес', 'Длина', 'Цена', 'Где водится']
        : ['Вес', 'Цена', 'Куда', 'Описание'];
    const dts = this.el.viewCard ? this.el.viewCard.querySelectorAll('dt') : [];
    dts.forEach((dt, i) => { if (labels[i]) dt.textContent = labels[i]; });
    this.el.viewCard.classList.add('has');
    this.fishView.show(spec);
  }

  /** Стак, который «висит на курсоре». */
  _paintHeld() {
    const h = this.el.invHeld;
    const s = this.inv ? this.inv.held : null;
    if (!s) { h.classList.remove('on'); h.innerHTML = ''; return; }
    h.innerHTML = '';
    const icon = itemIcon(s.spec, 128);
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
