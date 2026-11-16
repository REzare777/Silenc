/**
 * ============================================================================
 *  Настройки: качество, свечение, звук, чувствительность
 * ============================================================================
 *
 *  Все настройки живут в одном окне (Esc или O) — отдельного «режима
 *  свободного курсора» в игре нет.
 *
 *  Громкость и её состояние разделены:
 *   * тумблер «Звук» включает и выключает звук;
 *   * ползунок задаёт уровень 0…100 %;
 *   * выключение тумблером **не сбрасывает** выбранный уровень;
 *   * уровень сохраняется в `localStorage['wv.volume']` и восстанавливается
 *     при следующем запуске.
 *
 *  @module game/settings
 */

/**
 * Прочитать сохранённую громкость и применить её.
 *
 * @param {object} ctx контекст игры
 * @returns {number} громкость от 0 до 1
 */
export function loadVolume(ctx) {
  let v = 0.8;
  try {
    const raw = localStorage.getItem('wv.volume');
    if (raw !== null && raw !== '') {
      const n = Number(raw);
      if (Number.isFinite(n)) v = Math.max(0, Math.min(1, n));
    }
  } catch (e) { /* localStorage недоступен — просто берём значение по умолчанию */ }
  ctx.ambience.volume = v;
  ctx.ui.setVolume(v);
  if (ctx.ui.el.tSound) ctx.ui.el.tSound.classList.toggle('on', v > 0);
  return v;
}

/**
 * Применить уровень качества графики.
 *
 * @param {object} ctx контекст игры
 * @param {'low'|'med'|'high'} q уровень качества
 */
export function setQuality(ctx, q) {
  const shadows = q !== 'low';
  ctx.renderer.setPixelRatio(
    q === 'low' ? Math.min(devicePixelRatio, 1)
      : q === 'med' ? Math.min(devicePixelRatio, 1.5)
        : Math.min(devicePixelRatio, 2),
  );
  ctx.renderer.shadowMap.enabled = shadows;
  ctx.bloom.enabled = q !== 'low';
  if (ctx.scene.userData.flowers) ctx.scene.userData.flowers.visible = q !== 'low';
  ctx.scene.traverse((o) => {
    if (o.isMesh) o.castShadow = shadows;
    if (o.isMesh && o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) m.needsUpdate = true;
    }
  });
  ctx.composer.setSize(innerWidth, innerHeight);
}

/**
 * Подписать интерфейс на настройки и применить сохранённые значения.
 *
 * @param {object} ctx контекст игры
 */
export function bindSettings(ctx) {

  ctx.ui.onTime = (t) => ctx.env.setTimeOfDay(t);
  ctx.ui.onQuality = (q) => setQuality(ctx, q);
  ctx.ui.onBloom = (on) => { ctx.bloom.enabled = on; };
  ctx.ui.onSound = (on) => { ctx.ambience.start(); ctx.ambience.setMuted(!on); };
  ctx.ui.onVol = (v) => {
    ctx.ambience.start();
    ctx.ambience.setVolume(v);
    try { localStorage.setItem('wv.volume', String(v)); } catch (e) { /* без localStorage — просто не сохраняем */ }
  };
  ctx.ui.onSens = (v) => { ctx.player.sensitivity = v; };
  ctx.ui.onBob = (v) => { ctx.player.bobScale = v; };
  ctx.ui.onRes = (v) => {
    ctx.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5) * v);
    ctx.composer.setSize(innerWidth, innerHeight);
  };
}
