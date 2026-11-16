/**
 * ============================================================================
 *  ДИАЛОГИ
 * ============================================================================
 *
 *  Простое диалоговое окно: персонаж, его имя, реплика и несколько тем,
 *  на которые можно переключиться. Окно открывается по клавише **E**, когда
 *  игрок рядом с персонажем.
 *
 *  Пока окно открыто, игра стоит: мышь освобождается, управление игроком
 *  выключается. Закрыть окно — **Esc** (или кнопка «Покинуть»).
 *
 *  @module game/dialog
 */

import { barkeepIcon } from '../world/npc.js';

/**
 * Сценарии диалогов.
 *
 * `greet` — первая реплика, `topics` — темы, на которые можно ответить.
 */
const SCRIPTS = {
  barkeep: {
    name: 'Хорт',
    title: 'бармен трактира «Уставший вепрь»',
    greet: 'Заходи, гость. Стойка справа, эль — в кружке, а на цену лучше не смотреть… С чем угодно, только не с отсчётом.',
    topics: [
      {
        label: 'Что у вас есть?',
        text: 'Эль тёмный, сидр яблочный и настойка из слив — с холма привезли. Платить можно и медью, и добрым словом, но второе я принимаю с осторожностью.',
      },
      {
        label: 'Как вас зовут?',
        text: 'Хорт. Третий год стою за этой стойкой. Был кузнецом, но дым над кузницей мне надоел — тут тепло и людей больше.',
      },
      {
        label: 'Кто здесь бывает?',
        text: 'Кузнец с холма, лекарь из Чёрной рощи, да ваш пёс — он у меня тоже зимовал пару раз. Больше никого: трактир невелик, а поговорить все хотят.',
      },
      {
        label: 'Почему у вас так темно?',
        text: 'Потому что окна завешены, а свечи я экономлю. Свет нужен не столешнице, а тем, кто за этими стенами живёт.',
      },
      {
        label: 'А ночью вы здесь?',
        text: 'Нет. С закатом я ухожу домой, за долиню — там меня ждёт жена и очень недовольная курица. Ночью в трактире только вы, лютня и ветер в трубе.',
      },
      {
        label: 'Можно переночевать?',
        text: 'На втором этаже три комнаты — с кроватями, ночником и ковриком. Ступайте наверх, выберите дверь, что вам по душе, и постучитесь.',
      },
      {
        label: 'А лютню вашу кто играет?',
        text: 'Я, когда трактир пуст. Плохо, конечно, но слушатели не жалуются — им вообще ни о чём не известно.',
      },
    ],
  },
};

/**
 * Создаёт подсистему диалогов.
 *
 * @param {object} ctx контекст игры
 * @returns {object} система диалогов
 */
export function createDialog(ctx) {
  let openId = null;

  /** Портрет персонажа (рисуется один раз и переиспользуется). */
  const portraits = { barkeep: barkeepIcon(112) };

  /**
   * Открыть диалог с персонажем.
   *
   * @param {string} id идентификатор сценария
   * @returns {boolean} удалось ли открыть
   */
  function open(id) {
    const s = SCRIPTS[id];
    if (!s) return false;
    openId = id;

    // игра встаёт на паузу: курсор свободен, игрок не слушает клавиши
    ctx.mode = 'dialog';
    ctx.player.acceptInput = false;
    ctx.player.keys.clear();
    if (document.pointerLockElement) document.exitPointerLock();

    const npc = ctx.systems.locations?.npcs?.[id];
    if (npc) npc.talk(true);

    ctx.ui.openDialog({
      name: s.name,
      title: s.title,
      text: s.greet,
      portrait: portraits[id] || null,
      topics: s.topics.map((t) => ({ label: t.label, text: t.text })),
    });
    return true;
  }

  /** Закрыть диалог и вернуть управление. */
  function close() {
    if (!openId) return;
    const npc = ctx.systems.locations?.npcs?.[openId];
    if (npc) npc.talk(false);
    openId = null;
    ctx.ui.closeDialog();
    ctx.mode = 'play';
    ctx.player.acceptInput = true;
    ctx.player.keys.clear();
    ctx.player.requestLock();
  }

  // кнопки внутри окна
  ctx.ui.onDialogTopic = (topic) => {
    if (!openId) return;
    ctx.ui.setDialogText(topic.text);
  };
  ctx.ui.onDialogClose = () => close();

  return {
    open,
    close,
    /** Открыт ли сейчас диалог. */
    get isOpen() { return !!openId; },
    /** Имя текущего собеседника. */
    get who() { return openId ? SCRIPTS[openId].name : ''; },
  };
}
