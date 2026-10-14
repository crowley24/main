
(function () {
    'use strict';

    /*
     * CROWLEY PLUGIN MANAGER 3.5.1
     * Lampa / Android TV / Mobile
     */

    var VERSION = '3.0';
    var READY = 'crowley_plugin_manager_v351';
    var ROOT = 'plugin_manager_page';
    var STORAGE = 'plugins';
    var PENDING_KEY = 'crowley_pm_pending_v3.0';

    if (window[READY]) return;
    window[READY] = true;

    var initialized = false;
    var attempts = 0;

    var selected = {};
    var rows = {};
    var pending = false;

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
                        'Мобільний інтерфейс картки фільму',
                    url:
                        'https://crowley24.github.io/main/Mob_Interface.js'
                },
                {
                    id: 'NewMenu_Mob',
                    name: 'Mobile Menu',
                    description:
                        'Оновлене мобільне меню',
                    url:
                        'https://crowley24.github.io/main/NewMenu_Mob.js'
                },
                {
                    id: 'custom_buttons',
                    name: 'Custom Buttons',
                    description:
                        'Налаштування кнопок картки фільму',
                    url:
                        'https://crowley24.github.io/main/ButtonsManager+.js'
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
                        'Приховування елементів інтерфейсу',
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
                        'Продовження перегляду',
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
                        'Годинник для Lampa',
                    url:
                        'https://crowley24.github.io/main/Clock.js'
                },
                {
                    id: 'Ukr',
                    name: 'Ukrainisation',
                    description:
                        'Українізація інтерфейсу',
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
        var data = Lampa.Storage.get(STORAGE);

        return Array.isArray(data) ? data : [];
    }

    function savePlugins(data) {
        Lampa.Storage.set(STORAGE, data);
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

    function getState(plugin) {
        var item = findPlugin(plugin.url);

        if (!item) return 'absent';

        return isEnabled(item)
            ? 'enabled'
            : 'disabled';
    }

    function getCount(category) {
        var count = 0;

        category.plugins.forEach(function (plugin) {
            if (findPlugin(plugin.url)) count++;
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
       HTTPS MIGRATION
       ===================================== */

    function migrateCustomButtons() {
        var oldUrl =
            'http://crowley24.github.io/main/ButtonsManager+.js';

        var newUrl =
            'https://crowley24.github.io/main/ButtonsManager+.js';

        var list = getPlugins();
        var hasNew = false;
        var changed = false;

        list.forEach(function (item) {
            if (
                item &&
                item.url === newUrl
            ) {
                hasNew = true;
            }
        });

        if (hasNew) {
            var filtered = list.filter(
                function (item) {
                    return item && item.url !== oldUrl;
                }
            );

            if (filtered.length !== list.length) {
                savePlugins(filtered);
            }

            return;
        }

        list.forEach(function (item) {
            if (
                item &&
                item.url === oldUrl
            ) {
                item.url = newUrl;
                changed = true;
            }
        });

        if (changed) {
            savePlugins(list);
        }
    }

    /* =====================================
       RESTART STATE
       ===================================== */

    function markPending() {
        pending = true;

        /*
         * This marker is kept until
         * the next page reload.
         *
         * Plugin state changes themselves
         * are already stored by Lampa.
         */

        updateRestartRow();
    }

    function restartLampa() {
        if (!pending) return;

        notify('♻️ Застосування змін...');

        window.location.reload();
    }

    /* =====================================
       PLUGIN ACTIONS
       ===================================== */

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

        notify(
            '🟢 ' + plugin.name + ': встановлено'
        );
    }

    function enablePlugin(plugin) {
        var list = getPlugins();
        var changed = false;

        list.forEach(function (item) {
            if (
                item &&
                item.url === plugin.url &&
                !isEnabled(item)
            ) {
                item.status = 1;
                changed = true;
            }
        });

        if (!changed) return;

        savePlugins(list);
        markPending();

        notify(
            '🟢 ' + plugin.name + ': увімкнено'
        );
    }

    function disablePlugin(plugin) {
        var list = getPlugins();
        var changed = false;

        list.forEach(function (item) {
            if (
                item &&
                item.url === plugin.url &&
                isEnabled(item)
            ) {
                item.status = 0;
                changed = true;
            }
        });

        if (!changed) return;

        savePlugins(list);
        markPending();

        notify(
            '🟠 ' + plugin.name + ': вимкнено'
        );
    }

    function removePlugin(plugin) {
        var list = getPlugins();

        var filtered = list.filter(
            function (item) {
                return item && item.url !== plugin.url;
            }
        );

        if (filtered.length === list.length) {
            return;
        }

        savePlugins(filtered);
        markPending();

        notify(
            '🔴 ' + plugin.name + ': видалено'
        );
    }

    /* =====================================
       NAVIGATION
       ===================================== */

    /*
     * IMPORTANT:
     *
     * Lampa.Select uses its own
     * "select" controller.
     *
     * When the last Select window closes,
     * we must restore "settings_component".
     *
     * Otherwise the Select controller may
     * remain active and intercept Back.
     */

    function restoreSettingsController() {
        if (
            Lampa.Controller &&
            typeof Lampa.Controller.toggle === 'function'
        ) {
            Lampa.Controller.toggle(
                'settings_component'
            );
        }
    }

    function showSelect(options) {
        Lampa.Select.show(options);
    }

    /* =====================================
       CATEGORY MENU
       ===================================== */

    function buildCategoryItems(category) {
        return category.plugins.map(
            function (plugin) {
                var state = getState(plugin);

                var marker =
                    state === 'enabled'
                        ? '🟢'
                        : state === 'disabled'
                            ? '🟠'
                            : '🔴';

                return {
                    title:
                        marker + ' ' + plugin.name,

                    subtitle:
                        plugin.description,

                    plugin: plugin,

                    selected:
                        selected[category.id] === plugin.id
                };
            }
        );
    }

    function openCategory(category) {
        if (!category) return;

        showSelect({
            title:
                category.icon + ' ' +
                category.name,

            items:
                buildCategoryItems(category),

            onSelect: function (item) {
                if (
                    !item ||
                    !item.plugin
                ) return;

                selected[category.id] =
                    item.plugin.id;

                openPlugin(
                    item.plugin,
                    category
                );
            },

            onBack: function () {
                /*
                 * CATEGORY -> ROOT SETTINGS
                 *
                 * This is the crucial fix.
                 */

                updateFolderRows();
                updateRestartRow();

                restoreSettingsController();
            }
        });
    }

    /* =====================================
       PLUGIN MENU
       ===================================== */

    function openPlugin(plugin, category) {
        var state = getState(plugin);
        var items = [];

        if (state === 'absent') {
            items.push({
                title: '🟢 Встановити',
                action: 'install'
            });
        } else {
            if (state === 'enabled') {
                items.push({
                    title: '🟠 Вимкнути',
                    action: 'disable'
                });
            } else {
                items.push({
                    title: '🟢 Увімкнути',
                    action: 'enable'
                });
            }

            items.push({
                title: '🔴 Видалити',
                action: 'remove'
            });
        }

        showSelect({
            title: plugin.name,

            items: items,

            onSelect: function (item) {
                if (!item) {
                    openCategory(category);
                    return;
                }

                if (item.action === 'remove') {
                    confirmRemove(
                        plugin,
                        category
                    );

                    return;
                }

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
                }

                selected[category.id] =
                    plugin.id;

                openCategory(category);
            },

            onBack: function () {
                /*
                 * PLUGIN -> CATEGORY
                 */

                selected[category.id] =
                    plugin.id;

                openCategory(category);
            }
        });
    }

    /* =====================================
       REMOVE CONFIRMATION
       ===================================== */

    function confirmRemove(plugin, category) {
        showSelect({
            title:
                'Видалити ' + plugin.name + '?',

            items: [
                {
                    title: 'Скасувати',
                    action: 'cancel'
                },
                {
                    title: '🔴 Видалити',
                    action: 'remove'
                }
            ],

            onSelect: function (item) {
                if (
                    item &&
                    item.action === 'remove'
                ) {
                    removePlugin(plugin);
                }

                selected[category.id] =
                    plugin.id;

                openCategory(category);
            },

            onBack: function () {
                /*
                 * CONFIRMATION -> PLUGIN
                 */

                openPlugin(
                    plugin,
                    category
                );
            }
        });
    }

    /* =====================================
       ROOT ROWS
       ===================================== */

    function updateFolderRow(category) {
        var row = rows[
            'folder_' + category.id
        ];

        if (!row || !row.length) return;

        var description = row.find(
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
    }

    function updateFolderRows() {
        CATEGORIES.forEach(function (category) {
            updateFolderRow(category);
        });
    }

    /* =====================================
       SMART RESTART
       ===================================== */

    function injectStyles() {
        if (
            document.getElementById(
                'crowley-pm351-style'
            )
        ) return;

        var style = document.createElement('style');

        style.id = 'crowley-pm351-style';

        style.textContent = `
            .crowley-pm351-hidden {
                display: none !important;
            }

            .crowley-pm351-restart
            .settings-param__name {
                color: #ffad24;
            }
        `;

        document.head.appendChild(style);
    }

    function updateRestartRow() {
        var row = rows.restart;

        if (!row || !row.length) return;

        row.toggleClass(
            'crowley-pm351-hidden',
            !pending
        );
    }

    /* =====================================
       SETTINGS COMPONENT
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
                        'crowley_pm351_folder_' +
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
                    rows[
                        'folder_' + category.id
                    ] = item;

                    updateFolderRow(category);
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
                name:
                    'crowley_pm351_restart',

                type: 'button'
            },

            field: {
                name:
                    '♻️ Застосувати зміни',

                description:
                    'Перезапустити Lampa'
            },

            onRender: function (item) {
                rows.restart = item;

                item.addClass(
                    'crowley-pm351-restart'
                );

                updateRestartRow();
            },

            onChange: function () {
                restartLampa();
            }
        });
    }

    /* =====================================
       INITIALIZATION
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
            !Lampa.Select.show ||
            !Lampa.Controller ||
            !Lampa.Controller.toggle
        ) {
            return false;
        }

        initialized = true;

        migrateCustomButtons();

        injectStyles();

        registerComponent();
        registerFolders();
        registerRestart();

        return true;
    }

    function waitForLampa() {
        if (init()) return;

        attempts++;

        if (attempts < 100) {
            setTimeout(
                waitForLampa,
                200
            );
        } else {
            window[READY] = false;
        }
    }

    waitForLampa();

})();
