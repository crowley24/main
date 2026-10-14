/**
 * Channels Sort — плагін для Lampa
 * Версія: 1.9.0 (https://gist.githack.com/trigor74/c37b068491b42c98325bbe66188ef2e5/raw/channels_sort.js)
 * Змінює порядок каналів (рядків) на головній сторінці та сторінках категорій.
 *
 * Канали виявляються автоматично при першому завантаженні кожного розділу.
 * Порядок зберігається окремо для кожного розділу (Головна / Фільми / Серіали / тощо).
 * Налаштування вбудовані у секцію «Канали» стандартних налаштувань Lampa.
 *
 * При активному порядку: збираються ВСІ батчі Lampa, після чого відсортовані канали
 * рендеряться першими, а решта підтягується при прокрутці. Це дозволяє поставити
 * будь-який канал (навіть із батчу 4-5) на першу позицію.
 */
(function () {
    'use strict';

    if (window.__channels_sort_loaded) return;
    window.__channels_sort_loaded = true;

    var STORAGE_DISCOVERED = 'channels_sort_discovered'; // об'єкт {screenKey: [titles]}
    var STORAGE_ORDER      = 'channels_sort_order';      // об'єкт {screenKey: [titles]}
    var STORAGE_HIDDEN     = 'channels_sort_hidden';     // об'єкт {screenKey: [titles]}
    var STORAGE_DISABLED   = 'channels_sort_disabled';   // об'єкт {screenKey: true}

    // П.4: Локалізація плагіна через систему Lampa.Lang
    var _lang = {
        cs_screen_main:    { uk: 'Головна сторінка',                ru: 'Главная страница',                          en: 'Home' },
        cs_screen_movie:   { uk: 'Фільми',                           ru: 'Фильмы',                                    en: 'Movies' },
        cs_screen_tv:      { uk: 'Серіали',                          ru: 'Сериалы',                                   en: 'TV Shows' },
        cs_no_channels:    { uk: 'Спочатку відкрийте різні розділи — канали виявляться автоматично',
                             ru: 'Сначала откройте разные разделы — каналы определятся автоматически',
                             en: 'Open different sections first — channels will be discovered automatically' },
        cs_select_section: { uk: 'Виберіть розділ',                  ru: 'Выберите раздел',                           en: 'Select section' },
        cs_reset_section:  { uk: 'Скинути порядок для цього розділу', ru: 'Сбросить порядок для этого раздела',       en: 'Reset order for this section' },
        cs_modal_title:    { uk: 'Канали: ',                          ru: 'Каналы: ',                                  en: 'Channels: ' },
        cs_sep_title:      { uk: 'Сортування каналів',                ru: 'Сортировка каналов',                        en: 'Channels Sort' },
        cs_editor_name:    { uk: 'Редактор порядку',                  ru: 'Редактор порядка',                          en: 'Order Editor' },
        cs_editor_desc:    { uk: 'Відкрити редактор порядку каналів (окремо для кожного розділу)',
                             ru: 'Открыть редактор порядка каналов (отдельно для каждого раздела)',
                             en: 'Open channel order editor (separately for each section)' },
        cs_reset_all_name: { uk: 'Скинути всі порядки',              ru: 'Сбросить все порядки',                      en: 'Reset All Orders' },
        cs_reset_all_desc: { uk: 'Повернути стандартний порядок каналів в усіх розділах',
                             ru: 'Восстановить стандартный порядок каналов во всех разделах',
                             en: 'Restore default channel order in all sections' },
        cs_reset_all_done: { uk: 'Порядок каналів скинуто в усіх розділах',
                             ru: 'Порядок каналов сброшен во всех разделах',
                             en: 'Channel order reset in all sections' },
        cs_clear_name:     { uk: 'Очистити список каналів',           ru: 'Очистить список каналов',                  en: 'Clear Channel List' },
        cs_clear_desc:     { uk: 'Видалити всі збережені назви каналів для повторного виявлення',
                             ru: 'Удалить все сохранённые названия каналов для повторного обнаружения',
                             en: 'Delete all saved channel names for re-discovery' },
        cs_clear_done:     { uk: 'Список каналів очищено',            ru: 'Список каналов очищен',                    en: 'Channel list cleared' },
        cs_clear_all:      { uk: 'Очистити всі розділи',              ru: 'Очистить все разделы',                      en: 'Clear all sections' },
        cs_sort_label:     { uk: 'Сортування',                        ru: 'Сортировка',                                en: 'Sorting' },
        cs_sort_on:        { uk: 'Увімкнено',                          ru: 'Включено',                                  en: 'On' },
        cs_sort_off:       { uk: 'Вимкнено',                           ru: 'Выключено',                                 en: 'Off' },
        cs_edit_order:     { uk: 'Редагувати порядок',                ru: 'Редактировать порядок',                     en: 'Edit order' }
    };

    function t(key) { return Lampa.Lang.translate(key); }

    function registerLang() { Lampa.Lang.add(_lang); }

    // П.1: інжекція CSS — стилі ідентичні animeworld/dorama для уніфікованого вигляду.
    // Використовує id-guard щоб не дублювати стилі якщо animeworld вже їх завантажив.
    function injectStyles() {
        if (document.getElementById('channels-sort-styles')) return;
        var style = document.createElement('style');
        style.id = 'channels-sort-styles';
        style.textContent = [
            '.menu-edit-list { padding: 1em; }',
            '.menu-edit-list__item { display: flex; align-items: center; justify-content: space-between; margin: 0.3em 0; padding: 0.5em; background: rgba(255,255,255,0.05); border-radius: 5px; }',
            '.menu-edit-list__title { flex: 1; font-size: 1.1em; padding-left: 0.5em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }',
            '.menu-edit-list__move { width: 1.8em; height: 1.8em; display: flex; align-items: center; justify-content: center; cursor: pointer; font-weight: bold; user-select: none; background: rgba(255,255,255,0.1); border-radius: 3px; margin-left: 0.3em; }',
            '.menu-edit-list__move.focus { background: #fff; color: #000; }',
            '.menu-edit-list__toggle { width: 1.8em; height: 1.8em; display: flex; align-items: center; justify-content: center; cursor: pointer; margin-left: 0.5em; border: 2px solid rgba(255,255,255,0.5); border-radius: 3px; }',
            '.menu-edit-list__item.selector.focus .menu-edit-list__toggle { border-color: #fff; background: rgba(255,255,255,0.2); }',
            '.item-hidden { opacity: 0.4; }',
            '.folder-reset-button { background: rgba(200,100,100,0.3); margin-top: 1em; border-radius: 5px; padding: 1em; text-align: center; cursor: pointer; }',
            '.folder-reset-button.focus { background: #fff; color: #000; }',
            '.menu-edit-list__item.selector.focus { background: rgba(255,255,255,0.28); border-radius: 5px; }',
            '.menu-edit-list__item.selector.focus .menu-edit-list__title { color: #fff; }',
            /* Власний wrapper для кнопок: групує ▲ і ▼ разом праворуч */
            '.cs-btns { display: flex; flex-shrink: 0; margin-left: 0.5em; }',
            '.cs-btns .menu-edit-list__move { margin-left: 0.2em; }',
            /* cs-sort-list: toggle зліва, кнопки ▲▼ справа, назва займає середину */
            '.cs-sort-list .menu-edit-list__item { display: block; position: relative; padding-left: 2.5em; padding-right: 7em; margin-bottom: 0; box-sizing: border-box; }',
            '.cs-sort-list .menu-edit-list__title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }',
            '.cs-sort-list .cs-toggle { position: absolute; left: 0.5em; top: 0; bottom: 0; width: 1.8em; display: flex; align-items: center; justify-content: center; font-weight: bold; cursor: pointer; }',
            '.cs-sort-list .cs-toggle.cs-toggle--on { color: #4caf50; }',
            '.cs-sort-list .cs-toggle.cs-toggle--off { color: #f44336; }',
            '.cs-sort-list .cs-toggle.focus { background: rgba(255,255,255,0.15); border-radius: 3px; }',
            '.cs-sort-list .cs-btns { position: absolute; right: 0.5em; top: 0; bottom: 0; display: flex; align-items: center; margin-left: 0; }',
            '.cs-sort-list .menu-edit-list__item.cs-hidden { opacity: 0.35; }',
            '.cs-sort-list .menu-edit-list__item.cs-active { background: rgba(255,255,255,0.15); border-radius: 4px; }',
            '.cs-remove.focus { background: #f44336; color: #fff; }'
        ].join(' ');
        document.head.appendChild(style);
    }

    // Словник: назва каналу → ім'я плагіну (заповнюється через перехват ContentRows.add)
    var _pluginInfoMap = {};

    // ── Ключ розділу ──────────────────────────────────────────────────────────

    function getScreenKey(apiMethod, params) {
        // Джерело даних (tmdb, anime_world, dorama тощо). Для "рідних" джерел TMDB
        // (tmdb/cub або коли source не вказано — стандартні екрани Фільми/Серіали/Головна)
        // ключ формується так само, як раніше. Категорії сторонніх джерел
        // (AnimeWorld, Dorama) мають той самий url ('tv'/'movie'), що й справжні
        // розділи Фільми/Серіали — без префіксу джерела вони отримали б однаковий
        // screenKey, що змішує списки каналів і вмикає для них важку (повільну)
        // логіку сортування з чужим order.
        var source = (params && params.source) || 'tmdb';
        var prefix = (source === 'tmdb' || source === 'cub') ? '' : source + '_';

        if (apiMethod === 'main') return prefix + 'main';
        var url = (params && params.url) || '';
        if (!url || url === 'movie') return prefix + 'movie';
        if (url === 'tv') return prefix + 'tv';
        // Для нестандартних категорій — нормалізована версія URL
        return prefix + 'cat_' + url.replace(/[^a-z0-9]/gi, '_').substring(0, 20);
    }

    function getScreenLabel(key) {
        var map = { main: 'cs_screen_main', movie: 'cs_screen_movie', tv: 'cs_screen_tv' };
        if (map[key]) return t(map[key]);

        // Ключі з префіксом джерела: <source>_main / <source>_movie / <source>_tv
        var m = key.match(/^(.+)_(main|movie|tv)$/);
        if (m && map[m[2]]) {
            var sourceLabel = m[1].replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
            return sourceLabel + ' — ' + t(map[m[2]]);
        }
        return key;
    }

    // ── Сховище ──────────────────────────────────────────────────────────────

    function isPlainObject(v) {
        return v && typeof v === 'object' && !Array.isArray(v);
    }

    function getAllDiscovered() {
        var v = Lampa.Storage.get(STORAGE_DISCOVERED, {});
        return isPlainObject(v) ? v : {};
    }

    function getAllOrders() {
        var v = Lampa.Storage.get(STORAGE_ORDER, {});
        return isPlainObject(v) ? v : {};
    }

    function getDiscovered(screenKey) {
        var v = getAllDiscovered()[screenKey];
        return Array.isArray(v) ? v : [];
    }

    function getOrder(screenKey) {
        var v = getAllOrders()[screenKey];
        return Array.isArray(v) ? v : [];
    }

    function setOrder(screenKey, arr) {
        var all = getAllOrders();
        all[screenKey] = arr;
        Lampa.Storage.set(STORAGE_ORDER, all);
    }

    function getAllHidden() {
        var v = Lampa.Storage.get(STORAGE_HIDDEN, {});
        return isPlainObject(v) ? v : {};
    }
    function getHidden(screenKey) {
        var v = getAllHidden()[screenKey];
        return Array.isArray(v) ? v : [];
    }
    function setHidden(screenKey, arr) {
        var all = getAllHidden();
        all[screenKey] = arr;
        Lampa.Storage.set(STORAGE_HIDDEN, all);
    }

    function getAllDisabled() {
        var v = Lampa.Storage.get(STORAGE_DISABLED, {});
        return isPlainObject(v) ? v : {};
    }
    function isDisabled(screenKey) {
        return !!getAllDisabled()[screenKey];
    }
    function setDisabled(screenKey, val) {
        var all = getAllDisabled();
        if (val) all[screenKey] = true;
        else delete all[screenKey];
        Lampa.Storage.set(STORAGE_DISABLED, all);
    }

    // Порядок сортування з урахуванням перемикача "Сортування" розділу
    function getEffectiveOrder(screenKey) {
        if (isDisabled(screenKey)) return [];
        return getOrder(screenKey);
    }

    function addDiscovered(screenKey, title) {
        if (!title) return;
        var all = getAllDiscovered();
        if (!Array.isArray(all[screenKey])) all[screenKey] = [];
        if (all[screenKey].indexOf(title) === -1) {
            all[screenKey].push(title);
            Lampa.Storage.set(STORAGE_DISCOVERED, all);
        }
    }

    // Повертає всі screenKey, для яких є виявлені канали
    function getKnownScreenKeys() {
        var all = getAllDiscovered();
        var keys = [];
        for (var k in all) {
            if (all.hasOwnProperty(k) && Array.isArray(all[k]) && all[k].length) keys.push(k);
        }
        return keys;
    }

    // ── Перехват ContentRows.add для запису інфо про плагін ───────────────────

    function interceptContentRows() {
        if (!Lampa.ContentRows || typeof Lampa.ContentRows.add !== 'function') return;
        var origAdd = Lampa.ContentRows.add;
        Lampa.ContentRows.add = function (row) {
            if (row && row.title && row.name) {
                _pluginInfoMap[row.title] = row.name;
            }
            return origAdd.call(this, row);
        };
    }

    // ── Сортування масиву data ────────────────────────────────────────────────

    function sortData(screenKey, data) {
        if (!Array.isArray(data) || !data.length) return data;

        // Виявляємо нові канали для цього розділу
        data.forEach(function (d) {
            if (d && d.title) addDiscovered(screenKey, d.title);
        });

        var order = getEffectiveOrder(screenKey);
        if (!order.length) return data;

        // Сортуємо; канали без позиції йдуть в кінець
        return data.slice().sort(function (a, b) {
            var ia = order.indexOf(a.title);
            var ib = order.indexOf(b.title);
            if (ia === -1) ia = 99999;
            if (ib === -1) ib = 99999;
            return ia - ib;
        });
    }

    // ── Перехоплення Api.main та Api.category ─────────────────────────────────

    function makeWrapper(screenKey, oncomplite) {
        if (typeof oncomplite !== 'function') return oncomplite;
        return function (data) {
            return oncomplite(sortData(screenKey, data));
        };
    }

    function wrapLoadPart(key, loadPart) {
        if (typeof loadPart !== 'function') return loadPart;
        // Кожен наступний батч (onNext при прокрутці) теж проходить через sortData
        return function (resolve, reject) {
            return loadPart(makeWrapper(key, resolve), reject);
        };
    }

    // Розмір порції несортованих каналів при кожній прокрутці
    var UNSORTED_BATCH_SIZE = 6;

    // Коли порядок задано: збираємо батчі до знаходження всіх відсортованих каналів
    // (або до кінця parts_data), потім відсортовані — першими, решта (несортовані) —
    // підтягуються при прокрутці порціями UNSORTED_BATCH_SIZE.
    // Коли порядку немає: звичайна поведінка + виявлення каналів.
    function makeApiWrapper(origFn, getKey) {
        return function (params, oncomplite, onerror) {
            var key = getKey(params);
            var order = getEffectiveOrder(key);

            if (!order.length) {
                var lp = origFn.call(this, params, makeWrapper(key, oncomplite), onerror);
                return wrapLoadPart(key, lp);
            }

            var allData = [];
            var unsortedQueue = [];
            var collected = false;
            var lazyLp = null;

            // Для lazy-зупинки: відстежуємо унікальні знайдені канали з order
            var orderTitlesSet = {};
            order.forEach(function (t) { if (t) orderTitlesSet[t] = true; });
            var orderTotalUniq = Object.keys(orderTitlesSet).length;
            var foundOrderTitles = {};

            function trackOrderItems(data) {
                if (!data) return;
                data.forEach(function (d) {
                    if (d && d.title && orderTitlesSet[d.title]) foundOrderTitles[d.title] = true;
                });
            }

            // Рекурсивно завантажує наступні батчі.
            // П.3: зупиняється достроково, якщо всі канали з order вже знайдені;
            // решта parts_data зберігається у lazyLp для ледачого завантаження при прокрутці.
            // loadPart — замикання над parts_data; нічого не повертає.
            function fetchAllBatches(lp) {
                if (typeof lp !== 'function') { finalize(); return; }

                if (Object.keys(foundOrderTitles).length >= orderTotalUniq) {
                    lazyLp = lp;
                    finalize();
                    return;
                }

                lp(
                    function (data) {
                        if (data && data.length) {
                            trackOrderItems(data);
                            allData = allData.concat(data);
                        }
                        fetchAllBatches(lp);
                    },
                    finalize // partEmpty — більше нема функцій у parts_data
                );
            }

            // Після збору достатніх (або всіх) батчів: розділяємо та доставляємо відсортовані
            function finalize() {
                if (collected) return;
                collected = true;

                var hidden = getHidden(key);
                var sorted = [];
                allData.forEach(function (d) {
                    if (!d) return;
                    if (d.title) addDiscovered(key, d.title);
                    if (d.title && hidden.indexOf(d.title) !== -1) return; // приховано
                    if (d.title && order.indexOf(d.title) !== -1) sorted.push(d);
                    else unsortedQueue.push(d);
                });

                sorted.sort(function (a, b) {
                    return order.indexOf(a.title) - order.indexOf(b.title);
                });

                // П.2: якщо відсортованих менше ніж UNSORTED_BATCH_SIZE — доповнюємо несортованими,
                // щоб перший екран не виглядав пустим при 1–2 закріплених каналах.
                var first = sorted.slice();
                if (first.length < UNSORTED_BATCH_SIZE) {
                    var needed = UNSORTED_BATCH_SIZE - first.length;
                    first = first.concat(unsortedQueue.splice(0, needed));
                }
                if (first.length) oncomplite(first);
            }

            // П.1: захист від race condition — якщо перший батч прийшов синхронно,
            // firstLoadPart ще undefined, тому відкладаємо fetchAllBatches через прапор.
            var firstLoadPart;
            var calledSync = false;

            firstLoadPart = origFn.call(this, params, function (batch0) {
                if (batch0 && batch0.length) {
                    trackOrderItems(batch0);
                    allData = allData.concat(batch0);
                }
                if (typeof firstLoadPart === 'undefined') {
                    calledSync = true;
                } else {
                    fetchAllBatches(firstLoadPart);
                }
            }, onerror);

            if (calledSync) fetchAllBatches(firstLoadPart);

            // Замикання над unsortedQueue — Lampa викликає його на кожній прокрутці.
            // П.3: якщо черга порожня, але є lazyLp — ліниво довантажуємо наступний батч.
            return function nextUnsortedBatch(resolve, reject) {
                if (unsortedQueue.length) {
                    resolve(unsortedQueue.splice(0, UNSORTED_BATCH_SIZE));
                    return;
                }
                if (lazyLp) {
                    lazyLp(
                        function (data) {
                            if (data && data.length) {
                                var hidden = getHidden(key);
                                data.forEach(function (d) {
                                    if (d && d.title) addDiscovered(key, d.title);
                                });
                                var visible = data.filter(function (d) {
                                    return !d || !d.title || hidden.indexOf(d.title) === -1;
                                });
                                if (visible.length) {
                                    resolve(visible);
                                } else {
                                    nextUnsortedBatch(resolve, reject); // всі приховані — наступний батч
                                }
                            } else {
                                nextUnsortedBatch(resolve, reject); // пустий батч — спробуємо наступний
                            }
                        },
                        function () {
                            lazyLp = null;
                            if (typeof reject === 'function') reject();
                        }
                    );
                    return;
                }
                if (typeof reject === 'function') reject();
            };
        };
    }

    function interceptApi() {
        if (!Lampa.Api) return;

        if (typeof Lampa.Api.main === 'function') {
            Lampa.Api.main = makeApiWrapper(Lampa.Api.main, function (params) {
                return getScreenKey('main', params);
            });
        }

        if (typeof Lampa.Api.category === 'function') {
            Lampa.Api.category = makeApiWrapper(Lampa.Api.category, function (params) {
                return getScreenKey('category', params);
            });
        }
    }

    // ── Авто-виявлення каналів із відомих джерел ──────────────────────────────
    // Дозволяє бачити канали в редакторі ще до того, як вони були завантажені
    // прокруткою. Джерела: TMDB keyword-канали та плагіни через ContentRows.

    function autoDiscoverChannels() {
        var all = getAllDiscovered();
        var changed = false;

        function addTitle(screenKey, title) {
            if (!title) return;
            if (!Array.isArray(all[screenKey])) all[screenKey] = [];
            if (all[screenKey].indexOf(title) === -1) {
                all[screenKey].push(title);
                changed = true;
            }
        }

        // Канали плагінів (зареєстровані через ContentRows.add)
        // Додаємо до 'main' — плагіни зазвичай відображаються там
        Object.keys(_pluginInfoMap).forEach(function (title) {
            addTitle('main', title);
        });

        // Keyword-канали (жанри типу "Фентезі", "Детектив" тощо) з TMDB
        if (Lampa.TMDB && Lampa.TMDB.keywords) {
            ['movie', 'tv'].forEach(function (type) {
                var screenKey = type; // 'movie' або 'tv'
                var keywords = Lampa.TMDB.keywords[type] || [];
                keywords.forEach(function (kw) {
                    var title = Lampa.Lang && Lampa.Lang.translate ? Lampa.Lang.translate(kw.title) : kw.title;
                    if (!title || title === kw.title) return; // переклад не знайдено — пропускаємо
                    addTitle(screenKey, title);
                });
            });
        }

        if (changed) Lampa.Storage.set(STORAGE_DISCOVERED, all);
    }

    // ── Редактор: вибір розділу ────────────────────────────────────────────────

    function openEditor() {
        var keys = getKnownScreenKeys();

        if (!keys.length) {
            Lampa.Noty.show(t('cs_no_channels'));
            return;
        }

        showSectionSelect(keys);
    }

    // Для кожного розділу показуємо заголовок з назвою, а під ним — перемикач
    // сортування та редактор порядку каналів.
    function showSectionSelect(keys) {
        var items = [];

        keys.forEach(function (key) {
            var disabled = isDisabled(key);

            items.push({
                title: getScreenLabel(key),
                separator: true
            });

            items.push({
                title: t('cs_sort_label'),
                subtitle: disabled ? t('cs_sort_off') : t('cs_sort_on'),
                screenKey: key,
                checkbox: true,
                checked: !disabled
            });

            items.push({
                title: t('cs_edit_order'),
                screenKey: key
            });
        });

        Lampa.Select.show({
            title: t('cs_select_section'),
            items: items,
            onBack: function () {
                Lampa.Controller.toggle('settings_component');
            },
            // Перемикач "Сортування": Lampa сама перемикає checkbox і не закриває список
            onCheck: function (item, domItem) {
                setDisabled(item.screenKey, !item.checked);
                item.subtitle = item.checked ? t('cs_sort_on') : t('cs_sort_off');
                domItem.find('.selectbox-item__subtitle').text(item.subtitle);
            },
            onSelect: function (item) {
                openScreenEditor(item.screenKey);
            }
        });
    }

    function clearSection(screenKey) {
        var disc = getAllDiscovered(); delete disc[screenKey]; Lampa.Storage.set(STORAGE_DISCOVERED, disc);
        var ord  = getAllOrders();     delete ord[screenKey];  Lampa.Storage.set(STORAGE_ORDER, ord);
        var hid  = getAllHidden();     delete hid[screenKey];  Lampa.Storage.set(STORAGE_HIDDEN, hid);
        var dis  = getAllDisabled();   delete dis[screenKey];  Lampa.Storage.set(STORAGE_DISABLED, dis);
    }

    function openClearPicker() {
        var keys = getKnownScreenKeys();
        var items = [{ title: t('cs_clear_all'), clearAll: true }].concat(
            keys.map(function (key) { return { title: getScreenLabel(key), screenKey: key }; })
        );
        Lampa.Select.show({
            title: t('cs_clear_name'),
            items: items,
            onBack: function () { Lampa.Controller.toggle('settings_component'); },
            onSelect: function (item) {
                if (item.clearAll) {
                    Lampa.Storage.set(STORAGE_DISCOVERED, {});
                    Lampa.Storage.set(STORAGE_ORDER, {});
                    Lampa.Storage.set(STORAGE_HIDDEN, {});
                    Lampa.Storage.set(STORAGE_DISABLED, {});
                } else {
                    clearSection(item.screenKey);
                }
                Lampa.Noty.show(t('cs_clear_done'));
                setTimeout(function () { window.location.reload(); }, 500);
            }
        });
    }

    // ── Редактор: порядок каналів для одного розділу ──────────────────────────

    // П.7: екранування спецсимволів для безпечної вставки в HTML-атрибути.
    function escAttr(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    // П.4: прокручує Scroll-компонент лише якщо рядок виходить за межі видимої зони.
    // Lampa не використовує native scroll — інстанс зберігається на DOM: html.Scroll = _self.
    function scrollIfNeeded(row) {
        var scrollEl = row.closest('.scroll')[0];
        if (!scrollEl || !scrollEl.Scroll) return;
        var c = scrollEl.getBoundingClientRect();
        var r = row[0].getBoundingClientRect();
        if (r.top < c.top || r.bottom > c.bottom) scrollEl.Scroll.update(row);
    }

    function openScreenEditor(screenKey) {
        var discovered  = getDiscovered(screenKey);
        var savedOrder  = getOrder(screenKey);

        // Формуємо поточний список: збережений порядок, потім невідомі
        var currentOrder = [];
        savedOrder.forEach(function (t) {
            if (discovered.indexOf(t) >= 0) currentOrder.push(t);
        });
        discovered.forEach(function (t) {
            if (currentOrder.indexOf(t) === -1) currentOrder.push(t);
        });

        var list = $('<div class="menu-edit-list cs-sort-list"></div>');
        var _changed = false;

        // Виділення активного рядка (пряме прив'язування, бо hover:* не спливають в Lampa)
        var $activeRow = null;
        function setActiveRow($row) {
            if ($activeRow) $activeRow.removeClass('cs-active');
            $activeRow = ($row && $row.length) ? $row : null;
            if ($activeRow) $activeRow.addClass('cs-active');
        }

        function updateOrder() {
            var newOrder = [];
            list.find('.menu-edit-list__item[data-channel]').each(function () {
                newOrder.push($(this).data('channel'));
            });
            setOrder(screenKey, newOrder);
            _changed = true;
        }

        // Повністю прибирає канал зі збережених списків (порядок/прихований/виявлені),
        // щоб він не заважав у редакторі — пізніше з'явиться знову при гортанні сторінки.
        function removeChannel(title) {
            var disc = getAllDiscovered();
            if (Array.isArray(disc[screenKey])) {
                var di = disc[screenKey].indexOf(title);
                if (di !== -1) disc[screenKey].splice(di, 1);
                Lampa.Storage.set(STORAGE_DISCOVERED, disc);
            }

            var hid = getAllHidden();
            if (Array.isArray(hid[screenKey])) {
                var hi = hid[screenKey].indexOf(title);
                if (hi !== -1) hid[screenKey].splice(hi, 1);
                Lampa.Storage.set(STORAGE_HIDDEN, hid);
            }
        }

        currentOrder.forEach(function (title) {
            var pluginInfo = _pluginInfoMap[title] || '';
            var subtitleHtml = pluginInfo
                ? '<span style="display:block;font-size:0.72em;opacity:0.5;font-weight:normal;margin-top:0.15em;">' + pluginInfo + '</span>'
                : '<span style="display:block;font-size:0.72em;margin-top:0.15em;visibility:hidden;" aria-hidden="true">&nbsp;</span>';

            var isHidden = getHidden(screenKey).indexOf(title) !== -1;

            var row = $(
                '<div class="menu-edit-list__item' + (isHidden ? ' cs-hidden' : '') + '" data-channel="' + escAttr(title) + '">' +
                    '<div class="cs-toggle ' + (isHidden ? 'cs-toggle--off' : 'cs-toggle--on') + ' selector">' + (isHidden ? '✕' : '✓') + '</div>' +
                    '<div class="menu-edit-list__title">' + title + subtitleHtml + '</div>' +
                    '<div class="cs-btns">' +
                        '<div class="menu-edit-list__move move-up selector">▲</div>' +
                        '<div class="menu-edit-list__move move-down selector">▼</div>' +
                        '<div class="menu-edit-list__move cs-remove selector">✕</div>' +
                    '</div>' +
                '</div>'
            );

            row.find('.cs-toggle').on('hover:focus hover:enter', function () {
                setActiveRow(row);
            });
            row.find('.cs-toggle').on('hover:enter', function () {
                var hiddenList = getHidden(screenKey);
                var idx = hiddenList.indexOf(title);
                if (idx === -1) {
                    hiddenList.push(title);
                    row.addClass('cs-hidden');
                    row.find('.cs-toggle').text('✕').removeClass('cs-toggle--on').addClass('cs-toggle--off');
                } else {
                    hiddenList.splice(idx, 1);
                    row.removeClass('cs-hidden');
                    row.find('.cs-toggle').text('✓').removeClass('cs-toggle--off').addClass('cs-toggle--on');
                }
                setHidden(screenKey, hiddenList);
                _changed = true;
            });

            row.find('.move-up').on('hover:focus hover:enter', function () {
                setActiveRow(row);
            });
            row.find('.move-down').on('hover:focus hover:enter', function () {
                setActiveRow(row);
            });

            row.find('.move-up').on('hover:enter', function () {
                var prev = row.prev('.menu-edit-list__item[data-channel]');
                if (prev.length) {
                    row.insertBefore(prev);
                    updateOrder();
                    scrollIfNeeded(row);
                }
            });

            row.find('.move-down').on('hover:enter', function () {
                var next = row.next('.menu-edit-list__item[data-channel]');
                if (next.length) {
                    row.insertAfter(next);
                    updateOrder();
                    scrollIfNeeded(row);
                }
            });

            row.find('.cs-remove').on('hover:focus', function () {
                setActiveRow(row);
            });
            row.find('.cs-remove').on('hover:enter', function () {
                var next = row.next('.menu-edit-list__item[data-channel]');
                var prev = row.prev('.menu-edit-list__item[data-channel]');
                var target = next.length ? next : prev;

                removeChannel(title);
                row.remove();
                updateOrder();

                if (target.length) {
                    Lampa.Controller.collectionFocus(target.find('.cs-remove')[0], list[0]);
                } else {
                    setActiveRow(null);
                }
            });

            list.append(row);
        });

        var resetBtn = $('<div class="selector folder-reset-button">' + t('cs_reset_section') + '</div>');
        resetBtn.on('hover:focus hover:enter', function () {
            setActiveRow(null);
        });
        resetBtn.on('hover:enter', function () {
            setOrder(screenKey, []);
            setHidden(screenKey, []);
            Lampa.Modal.close();
            window.location.reload();
        });
        list.append(resetBtn);

        Lampa.Modal.open({
            title: t('cs_modal_title') + getScreenLabel(screenKey),
            html: list,
            size: 'small',
            onBack: function () {
                Lampa.Modal.close();
                if (_changed) {
                    window.location.reload();
                } else {
                    Lampa.Controller.toggle('settings_component');
                }
            }
        });

        // Патч Scroll.update: Lampa Controller при кожному hover:focus автоматично викликає
        // Scroll.update(), що скролить елемент до самого верху. Замінюємо на мінімальний скрол:
        // обчислюємо delta (скільки пікселів потрібно прокрутити щоб елемент з'явився на краю)
        // і прикладаємо її безпосередньо до translate3d, не делегуючи оригінальний метод.
        setTimeout(function () {
            var scrollEl = list.closest('.scroll')[0];
            if (!scrollEl || !scrollEl.Scroll) return;
            var body = scrollEl.querySelector('.scroll__body');
            if (!body) return;
            var _orig = scrollEl.Scroll.update.bind(scrollEl.Scroll);
            scrollEl.Scroll.update = function (elem, force) {
                if (force) { _orig(elem, force); return; }
                var c = scrollEl.getBoundingClientRect();
                var el = (elem && elem[0]) ? elem[0] : elem;
                if (!el) { _orig(elem, force); return; }
                var r = el.getBoundingClientRect();
                var delta = 0;
                if      (r.bottom > c.bottom) delta = c.bottom - r.bottom; // виходить знизу
                else if (r.top    < c.top)    delta = c.top    - r.top;    // виходить зверху
                if (!delta) return;
                var t = window.getComputedStyle(body).transform;
                var currentY = (t && t !== 'none') ? new DOMMatrix(t).m42 : 0;
                body.style.transform = 'translate3d(0,' + (currentY + delta) + 'px,0)';
            };
        }, 0);
    }

    // ── Вбудовування у секцію «Канали» ────────────────────────────────────────

    // content_rows.settings() видаляє та перебудовує свої params при кожному відкритті
    // головного меню налаштувань (e.name === 'main'). Ми додаємо свої params одразу після
    // через setTimeout(0), поки користувач ще не натиснув «Канали».

    function addParamsToContentRows() {
        Lampa.SettingsApi.addParam({
            component: 'content_rows',
            param: { name: 'channels_sort_sep', type: 'title', default: '' },
            field: { name: t('cs_sep_title') }
        });

        Lampa.SettingsApi.addParam({
            component: 'content_rows',
            param: { name: 'channels_sort_edit', type: 'button', default: '' },
            field: {
                name: t('cs_editor_name'),
                description: t('cs_editor_desc')
            },
            onChange: openEditor
        });

        Lampa.SettingsApi.addParam({
            component: 'content_rows',
            param: { name: 'channels_sort_reset_all', type: 'button', default: '' },
            field: {
                name: t('cs_reset_all_name'),
                description: t('cs_reset_all_desc')
            },
            onChange: function () {
                Lampa.Storage.set(STORAGE_ORDER, {});
                Lampa.Storage.set(STORAGE_HIDDEN, {});
                Lampa.Noty.show(t('cs_reset_all_done'));
                setTimeout(function () { window.location.reload(); }, 500);
            }
        });

        Lampa.SettingsApi.addParam({
            component: 'content_rows',
            param: { name: 'channels_sort_clear', type: 'button', default: '' },
            field: {
                name: t('cs_clear_name'),
                description: t('cs_clear_desc')
            },
            onChange: openClearPicker
        });
    }

    function createSettings() {
        Lampa.Settings.listener.follow('open', function (e) {
            if (e.name === 'main') {
                // content_rows.settings() вже виконалась синхронно — додаємо після неї
                setTimeout(addParamsToContentRows, 0);
            }
        });
    }

    // ── Старт плагіна ─────────────────────────────────────────────────────────

    function startPlugin() {
        registerLang();
        injectStyles();
        interceptApi();
        createSettings();
        autoDiscoverChannels();
    }

    var _timer = setInterval(function () {
        if (typeof Lampa === 'undefined') return;
        clearInterval(_timer);
        // Перехоплюємо ContentRows.add якомога раніше — до того як плагіни реєструють канали
        interceptContentRows();
        if (window.appready) {
            startPlugin();
        } else {
            Lampa.Listener.follow('app', function (e) {
                if (e.type === 'ready') startPlugin();
            });
        }
    }, 100);
})();
