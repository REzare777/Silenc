# Публикация «Шёпот-Долины» в интернете

Три независимые площадки. Каждая даёт свой адрес и свой путь в поисковики,
поэтому лучше использовать все три — тогда игра находится и по названию,
и по описанию, и по ссылке.

---

## 1. GitHub Pages — основной адрес (сделано автоматически)

Адрес: **https://rezare777.github.io/Silenc/**

Каждый `git push` в ветку `main` собирает игру и выкладывает её заново
(воркфайл `.github/workflows/pages.yml`).

Чтобы включить (один раз, вручную):

1. Откройте репозиторий → **Settings → Pages**.
2. В поле **Source** выберите **GitHub Actions**.
3. Сохраните.

После этого либо подождите, пока workflow отработает сам (вкладка **Actions**),
либо запустите его вручную: **Actions → Публикация игры на GitHub Pages → Run workflow**.

Проверить: `https://rezare777.github.io/Silenc/` отдаёт игру, а
`https://rezare777.github.io/Silenc/og-image.png` — обложку.

Если захотите свой домен (например `shyopot-dolina.ru`), в **Settings → Pages**
заполните поле **Custom domain** и добавьте CNAME-запись у доменщика.

---

## 2. itch.io — крупнейший каталог инди-игр

Страница: **https://rezare777.itch.io/**

Здесь игру находят **прямым поиском по названию** в каталоге, а кнопка
**Play** открывает игру в браузере.

Как загрузить:

1. Зарегистрируйтесь на itch.io (обычная почта).
2. **Create new project → HTML / Play in browser**.
3. Загрузите архив `itch-upload.zip` из папки `publish/` этого репозитория
   (внутри — однофайловая игра и обложка).
4. Заполните описание и теги — готовый текст лежит в `publish/itch-description.md`.
5. Обложка: файл `publish/cover-itch.png` (630×500, как требует itch.io).
6. Нажмите **Build & publish**.

Полезно: в настройках проекта включите **Auto-launch on itch.io** — тогда игра
стартует сразу при открытии страницы, без лишнего клика.

---

## 3. Поисковики — Google, Яндекс, Bing

Страница уже размечена: `og:`-теги, `application/ld+json` (тип `VideoGame`),
`robots.txt`, `sitemap.xml`, скрытый текстовый блок для роботов.

Чтобы ускорить индексацию:

- **Google Search Console** → https://search.google.com/search-console
  → «Добавить ресурс» → «URL-адрес» → `https://rezare777.github.io/Silenc/`
  → «Карта сайта» → `https://rezare777.github.io/Silenc/sitemap.xml`.
- **Яндекс.Вебмастер** → https://webmaster.yandex.ru → добавить сайт → тот же адрес
  → «Карта сайта» → тот же путь.
- **Bing Webmaster Tools** → https://www.bing.com/webmaster → добавить сайт.

Индексация занимает от нескольких дней до пары недель. Проверить выдачу можно
запросом `site:rezare777.github.io`.

Полезно также завести **собственный домен** — адрес с собственным именем
(`shyopot-dolina.ru`) ищется и запоминается лучше, чем длинный `github.io`.

---

## 4. Прочие каталоги (по желанию)

| Площадка | Что нужно |
|---|---|
| **Poki** | загрузить zip с `index.html`; играется в iframe |
| **CrazyGames** | нужен аккаунт разработчика и проверка модерации |
| ** itch.io jam** | участие в конкурсах, страница проекта остаётся навсегда |

---

## Чек-лист «игра в интернете готова»

- [x] исходники в GitHub: `https://github.com/REzare777/Silenc`
- [x] SEO-разметка в `index.html` (og, JSON-LD VideoGame, canonical)
- [x] `public/robots.txt` и `public/sitemap.xml`
- [x] обложка `public/og-image.png` (1200×630)
- [x] автодеплой на GitHub Pages через Actions
- [ ] **Pages включён вручную** (Settings → Pages → GitHub Actions)
- [ ] страница заведена на itch.io
- [ ] сайт добавлен в Google Search Console и Яндекс.Вебмастер
- [ ] (по желанию) подключён свой домен
