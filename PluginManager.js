
(function () {
    'use strict';

    /*
     * CROWLEY PLUGIN MANAGER 3.4.0
     * Lampa / Android TV / Mobile
     */

    var GLOBAL_KEY = 'crowley_plugin_manager_v34';

    if (window[GLOBAL_KEY]) return;
    window[GLOBAL_KEY] = true;

    var VERSION = '3.4.0';
    var ROOT = 'plugin_manager_page';
    var STORAGE_KEY = 'plugins';

    var initialized = false;
    var attempts = 0;
    var maxAttempts = 100;

    var pending = false;
    var activeCategory = null;
    var rootRows = {};
    var folderOpening = false;

    /* =====================================
       PLUGIN CATALOG
       ===================================== */

    var CATEGORIES = [
        {
            id: 'online',
            name: 'Онлайн-перегляд',
            icon: '▶',
            plugins: [
                {
                    id: 'Uakino',
                    name: 'UaKino',
                    description:
                        'Автоматичне програвання фільмів та серіалів з uakino.ax',
                    url:
                        'https://crowley24.github.io/main/Uakino.js'
                }
            ]
        },
        {
            id: 'interface',
            name: 'Інтерфейс',
            icon: '▣',
            plugins: [
                {
                    id: 'NewCard',
                    name: 'NewCard',
                    description:
                        'Сучасний ТВ-інтерфейс картки фільму',
                    url:
                        'https://crowley24.github.io/main/NewCard.js'
                },
                {
                    id: 'mob_interface',
                    name: 'Mobile Interface',
                    description:
                        'Адаптивний мобільний інтерфейс картки фільму',
                    url:
                        'https://crowley24.github.io/main/Mob_Interface.js'
                },
                {
                    id: 'NewMenu_Mob',
                    name: 'Mobile Menu',
                    description:
                        'Оновлене нижнє меню для мобільних пристроїв',
                    url:
                        'https://crowley24.github.io/main/NewMenu_Mob.js'
                },
                {
                    id: 'custom_buttons',
                    name: 'Custom Buttons',
                    description:
                        'Розширена кастомізація кнопок картки фільму',
                    url:
                        'http://crowley24.github.io/main/ButtonsManager+.js'
                },
                {
                    id: 'InterfaceSize',
                    name: 'Interface Size',
                    description:
                        'Зміна розміру інтерфейсу',
                    url:
                        'https://crowley24.github.io/main/InterfaceSize.js'
                },
                {
                    id: 'InterfaceHize',
                    name: 'Interface Hide',
                    description:
                        'Приховування елементів меню',
                    url:
                        'https://crowley24.github.io/interface_hide.js'
                }
            ]
        },
        {
            id: 'movies',
            name: 'Фільми та персоналізація',
            icon: '★',
            plugins: [
                {
                    id: 'UA-Finder',
                    name: 'Finder UA',
                    description:
                        'Бейдж українського дубляжу',
                    url:
                        'https://crowley24.github.io/main/UA-Finder+Mod.js'
                },
                {
                    id: 'Watching',
                    name: 'Continue Watching',
                    description:
                        'Історія перегляду на головній сторінці',
                    url:
                        'https://crowley24.github.io/Watching.js'
                },
                {
                    id: 'Random',
                    name: 'Random',
                    description:
                        'Випадкова добірка фільмів',
                    url:
                        'https://crowley24.github.io/main/Random.js'
                }
            ]
        },
        {
            id: 'tools',
            name: 'Додаткові інструменти',
            icon: '⚙',
            plugins: [
                {
                    id: 'Clock',
                    name: 'Clock',
                    description:
                        'Стильний годинник',
                    url:
                        'https://crowley24.github.io/main/Clock.js'
                },
                {
                    id: 'Ukr',
                    name: 'Ukrainisation',
                    description:
                        'Лагідна Українізація',
                    url:
                        'https://crowley24.github.io/main/Ukr.js'
                }
            ]
        }
    ];

    /* =====================================
       STORAGE
       ===================================== */

    function getPlugins() {
        var list = Lampa.Storage.get(STORAGE_KEY);

        return Array.isArray(list) ? list : [];
    }

    function savePlugins(list) {
        Lampa.Storage.set(STORAGE_KEY, list);
    }

    function findPlugin(url) {
        var list = getPlugins();

        for (var i = 0; i < list.length; i++) {
            if (
                list[i] &&
                list[i].url === url
            ) {
                return list[i];
            }
        }

        return null;
    }

    function isEnabled(item) {
        if (!item) return false;

        return !(
            item.status === 0 ||
            item.status === false ||
            item.status === '0' ||
            item.status === 'false'
        );
    }

    function getState(url) {
        var item = findPlugin(url);

        if (!item) return 'absent';

        return isEnabled(item)
            ? 'enabled'
            : 'disabled';
    }

    function getCount(category) {
        var count = 0;

        category.plugins.forEach(function (plugin) {
            if (findPlugin(plugin.url)) {
                count++;
            }
        });

        return count;
    }

    /* =====================================
       NOTIFICATIONS
       ===================================== */

    function notify(message) {
        if (
            Lampa.Noty &&
            typeof Lampa.Noty.show === 'function'
        ) {
            Lampa.Noty.show(message);
        }
    }

    /* =====================================
       STATE CHANGES
       ===================================== */

    function markPending() {
        pending = true;
        updateRootRows();
    }

    function installPlugin(plugin) {
        if (findPlugin(plugin.url)) return;

        var list = getPlugins();

        list.push({
            id: plugin.id,
            name: plugin.name,
            url: plugin.url,
            status: 1
        });

        savePlugins(list);
        markPending();

        notify('🟢 ' + plugin.name + ': встановлено');
    }

    function enablePlugin(plugin) {
        var list = getPlugins();

        list.forEach(function (item) {
            if (
                item &&
                item.url === plugin.url
            ) {
                item.status = 1;
            }
        });

        savePlugins(list);
        markPending();

        notify('🟢 ' + plugin.name + ': увімкнено');
    }

    function disablePlugin(plugin) {
        var list = getPlugins();

        list.forEach(function (item) {
            if (
                item &&
                item.url === plugin.url
            ) {
                item.status = 0;
            }
        });

        savePlugins(list);
        markPending();

        notify('🟠 ' + plugin.name + ': вимкнено');
    }

    function removePlugin(plugin) {
        var list = getPlugins().filter(
            function (item) {
                return item && item.url !== plugin.url;
            }
        );

        savePlugins(list);
        markPending();

        notify('🔴 ' + plugin.name + ': видалено');
    }

    /* =====================================
       SELECT HELPERS
       ===================================== */

    function showSelect(title, items, onSelect, onBack) {
        Lampa.Select.show({
            title: title,
            items: items,

            onSelect: function (item) {
                if (typeof onSelect === 'function') {
                    onSelect(item);
                }
            },

            onBack: function () {
                if (typeof onBack === 'function') {
                    onBack();
                }
            }
        });
    }

    /* =====================================
       PLUGIN ACTIONS
       ===================================== */

    function openPlugin(plugin, category) {
        var state = getState(plugin.url);
        var items = [];

        if (state === 'absent') {
            items.push({
                title: '🟢 Встановити',
                action: 'install'
            });
        } else {
            items.push({
                title:
                    state === 'enabled'
                        ? '🟠 Вимкнути'
                        : '🟢 Увімкнути',
                action:
                    state === 'enabled'
                        ? 'disable'
                        : 'enable'
            });

            items.push({
                title: '🔴 Видалити',
                action: 'remove'
            });
        }

        showSelect(
            plugin.name,
            items,

            function (item) {
                if (!item) return;

                switch (item.action) {
                    case 'install':
                        installPlugin(plugin);
                        break;

                    case 'enable':
                        enablePlugin(plugin);
                        break;

                    case 'disable':
                        disablePlugin(plugin);
                        break;

                    case 'remove':
                        confirmRemove(plugin, category);
                        return;
                }

                /*
                 * Select закривається штатно
                 * після вибору дії.
                 *
                 * Повернення до папки:
                 * через наступний цикл,
                 * щоб не конфліктувати
                 * із закриттям Select.
                 */

                setTimeout(function () {
                    openCategory(category);
                }, 80);
            },

            function () {
                setTimeout(function () {
                    openCategory(category);
                }, 80);
            }
        );
    }

    /* =====================================
       REMOVE CONFIRMATION
       ===================================== */

    function confirmRemove(plugin, category) {
        showSelect(
            'Видалити ' + plugin.name + '?',

            [
                {
                    title: 'Скасувати',
                    action: 'cancel'
                },
                {
                    title: '🔴 Видалити',
                    action: 'remove'
                }
            ],

            function (item) {
                if (
                    item &&
                    item.action === 'remove'
                ) {
                    removePlugin(plugin);
                }

                setTimeout(function () {
                    openCategory(category);
                }, 80);
            },

            function () {
                setTimeout(function () {
                    openCategory(category);
                }, 80);
            }
        );
    }

    /* =====================================
       CATEGORY MENU
       ===================================== */

    function categoryItems(category) {
        return category.plugins.map(function (plugin) {
            var state = getState(plugin.url);

            var marker =
                state === 'enabled'
                    ? '🟢'
                    : state === 'disabled'
                        ? '🟠'
                        : '🔴';

            return {
                title:
                    marker + ' ' + plugin.name,
                subtitle: plugin.description,
                plugin: plugin
            };
        });
    }

    function openCategory(category) {
        if (!category) return;

        activeCategory = category;

        showSelect(
            category.icon + ' ' + category.name,

            categoryItems(category),

            function (item) {
                if (!item || !item.plugin) return;

                openPlugin(
                    item.plugin,
                    category
                );
            },

            function () {
                activeCategory = null;
            }
        );
    }

    /* =====================================
       ROOT UI
       ===================================== */

    function updateRootRows() {
        CATEGORIES.forEach(function (category) {
            var item = rootRows[
                'folder_' + category.id
            ];

            if (!item || !item.length) return;

            var description = item.find(
                '.settings-param__descr'
            ).first();

            if (description.length) {
                description.text(
                    getCount(category) +
                    ' із ' +
                    category.plugins.length +
                    ' встановлено'
                );
            }
        });

        var restart = rootRows.restart;

        if (restart && restart.length) {
            var title = restart.find(
                '.settings-param__name'
            ).first();

            if (title.length) {
                title.text(
                    pending
                        ? '♻️ Застосувати зміни'
                        : '♻️ Перезапуск Lampa'
                );
            }
        }
    }

    function restartLampa() {
        notify('♻️ Перезапуск Lampa...');

        setTimeout(function () {
            window.location.reload();
        }, 450);
    }

    /* =====================================
       ROOT COMPONENT
       ===================================== */

    function registerComponent() {
        Lampa.SettingsApi.addComponent({
            component: ROOT,
            name: 'Менеджер Плагінів',

            icon:
                '<svg width="40" height="40" ' +
                'viewBox="0 0 24 24" fill="none">' +
                '<path d="M12 6V18M6 12H18" ' +
                'stroke="white" stroke-width="2"/>' +
                '</svg>'
        });
    }

    function registerFolders() {
        CATEGORIES.forEach(function (category) {
            Lampa.SettingsApi.addParam({
                component: ROOT,

                param: {
                    name:
                        'crowley_pm34_folder_' +
                        category.id,
                    type: 'button'
                },

                field: {
                    name:
                        category.icon + '  ' +
                        category.name,
                    description:
                        getCount(category) +
                        ' із ' +
                        category.plugins.length +
                        ' встановлено'
                },

                onRender: function (item) {
                    rootRows[
                        'folder_' + category.id
                    ] = item;

                    updateRootRows();
                },

                onChange: function () {
                    openCategory(category);
                }
            });
        });
    }

    function registerRestart() {
        Lampa.SettingsApi.addParam({
            component: ROOT,

            param: {
                name: 'crowley_pm34_restart',
                type: 'button'
            },

            field: {
                name: '♻️ Перезапуск Lampa',
                description:
                    'Застосувати встановлення та зміни'
            },

            onRender: function (item) {
                rootRows.restart = item;
                updateRootRows();
            },

            onChange: function () {
                restartLampa();
            }
        });
    }

    /* =====================================
       INIT
       ===================================== */

    function init() {
        if (initialized) return true;

        if (
            !window.Lampa ||
            !Lampa.SettingsApi ||
            !Lampa.SettingsApi.addComponent ||
            !Lampa.SettingsApi.addParam ||
            !Lampa.Storage ||
            !Lampa.Select ||
            !Lampa.Select.show
        ) {
            return false;
        }

        initialized = true;

        registerComponent();
        registerFolders();
        registerRestart();

        return true;
    }

    /* =====================================
       WAIT FOR LAMPA
       ===================================== */

    function waitForLampa() {
        if (init()) return;

        attempts++;

        if (attempts < maxAttempts) {
            setTimeout(waitForLampa, 200);
        } else {
            window[GLOBAL_KEY] = false;
        }
    }

    waitForLampa();

})();
