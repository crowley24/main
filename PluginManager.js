
(function () {
'use strict';

/*
 * CROWLEY PLUGIN MANAGER 3.6.4 PREMIUM
 * Lampa / Android TV / Mobile
 * Fix: full-screen Select on portrait mobile devices
 */

var VERSION = '3.6.4';
var READY = 'crowley_plugin_manager_v364';
var ROOT = 'plugin_manager_page';
var STORAGE = 'plugins';
var STYLE_ID = 'crowley-pm364-style';

if (window[READY]) return;
window[READY] = true;

var initialized = false;
var attempts = 0;
var pending = false;
var selected = {};
var rows = {};
var menuDepth = 0;
var navigationLock = false;
var navigationTimer = null;
var decorationTimer = null;
var decorationGeneration = 0;

/* ===== SVG ICONS ===== */

function svgIcon(type, size) {
    size = size || 24;

    var paths = {
        play: '<circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4z"/>',
        layout: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 9v12"/>',
        movies: '<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M3 7 6 3h15l-3 4M8 3 5 7M15 3l-3 4m-5 4 5 3-5 3z"/>',
        tools: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="2"/><circle cx="15" cy="17" r="2"/>',
        grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'
    };

    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + size +
        '" height="' + size + '" viewBox="0 0 24 24" fill="none" ' +
        'stroke="currentColor" stroke-width="1.8" ' +
        'stroke-linecap="round" stroke-linejoin="round">' +
        (paths[type] || paths.grid) + '</svg>';
}

/* ===== PLUGIN CATALOG ===== */

var CATEGORIES = [
    {
        id: 'online',
        name: 'Онлайн-перегляд',
        icon: 'play',
        plugins: [
            {
                id: 'Uakino',
                name: 'UaKino',
                description: 'Автоматичне програвання фільмів та серіалів з uakino.ax',
                url: 'https://crowley24.github.io/main/Uakino.js'
            }
        ]
    },
    {
        id: 'interface',
        name: 'Інтерфейс',
        icon: 'layout',
        plugins: [
            {
                id: 'interface+',
                name: 'Interface+',
                description: 'Кастомізація головної сторінки в стилі Netflix',
                url: 'https://crowley24.github.io/main/Interface+.js'
            },
            {
                id: 'NewCard',
                name: 'NewCard',
                description: 'Сучасний ТВ-інтерфейс картки фільму',
                url: 'https://crowley24.github.io/main/NewCard.js'
            },
            {
                id: 'mob_interface',
                name: 'Mobile Interface',
                description: 'Мобільний інтерфейс картки фільму',
                url: 'https://crowley24.github.io/main/Mob_Interface.js'
            },
            {
                id: 'NewMenu_Mob',
                name: 'Mobile Menu',
                description: 'Оновлене мобільне меню',
                url: 'https://crowley24.github.io/main/NewMenu_Mob.js'
            },
            {
                id: 'custom_buttons',
                name: 'Custom Buttons',
                description: 'Налаштування кнопок картки фільму',
                url: 'https://crowley24.github.io/main/ButtonsManager+.js'
            },
            {
                id: 'InterfaceSize',
                name: 'Interface Size',
                description: 'Зміна розміру інтерфейсу',
                url: 'https://crowley24.github.io/main/InterfaceSize.js'
            },
            {
                id: 'InterfaceHide',
                name: 'Interface Hide',
                description: 'Приховування елементів інтерфейсу',
                url: 'https://crowley24.github.io/main/InterfaceHide.js'
            }
        ]
    },
    {
        id: 'movies',
        name: 'Фільми та персоналізація',
        icon: 'movies',
        plugins: [
            {
                id: 'Watching',
                name: 'Continue Watching',
                description: 'Продовження перегляду',
                url: 'https://crowley24.github.io/main/Watching.js'
            },
            {
                id: 'Channels_sort',
                name: 'Channels sort',
                description: 'Персоналізація каналів на головній сторінці через меню "Канали"',
                url: 'https://crowley24.github.io/main/Channels_sort.js'
            },
            {
                id: 'Bookmarks',
                name: 'Personal Bookmarks',
                description: 'Персональні папки в меню "Вибране"',
                url: 'https://crowley24.github.io/main/Bookmarks.js'
            },
            {
                id: 'UA-Finder',
                name: 'Finder UA',
                description: 'Бейдж українського дубляжу',
                url: 'https://crowley24.github.io/main/UA-Finder+Mod.js'
            },
            {
                id: 'Random',
                name: 'Random',
                description: 'Випадкова добірка фільмів',
                url: 'https://crowley24.github.io/main/Random.js'
            }
        ]
    },
    {
        id: 'tools',
        name: 'Додаткові інструменти',
        icon: 'tools',
        plugins: [
            {
                id: 'Clock',
                name: 'Clock',
                description: 'Годинник для Lampa',
                url: 'https://crowley24.github.io/main/Clock.js'
            },
            {
                id: 'Ukr',
                name: 'Ukrainisation',
                description: 'Українізація інтерфейсу',
                url: 'https://crowley24.github.io/main/Ukr.js'
            }
        ]
    }
];

/* ===== STORAGE ===== */

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
        if (list[i] && list[i].url === url) return list[i];
    }

    return null;
}

function isEnabled(item) {
    if (!item) return false;

    return item.status !== 0 &&
        item.status !== false &&
        item.status !== '0' &&
        item.status !== 'false';
}

function getState(plugin) {
    var item = findPlugin(plugin.url);
    return !item ? 'absent' : (isEnabled(item) ? 'enabled' : 'disabled');
}

function getCount(category) {
    var count = 0;

    category.plugins.forEach(function (plugin) {
        if (findPlugin(plugin.url)) count++;
    });

    return count;
}

function notify(message) {
    if (Lampa.Noty && Lampa.Noty.show) Lampa.Noty.show(message);
}

/* ===== HTTP TO HTTPS MIGRATION ===== */

function migrateCustomButtons() {
    var oldUrl = 'http://crowley24.github.io/main/ButtonsManager+.js';
    var newUrl = 'https://crowley24.github.io/main/ButtonsManager+.js';
    var list = getPlugins();
    var hasNew = false;
    var changed = false;

    list.forEach(function (item) {
        if (item && item.url === newUrl) hasNew = true;
    });

    if (hasNew) {
        var filtered = list.filter(function (item) {
            return item && item.url !== oldUrl;
        });

        if (filtered.length !== list.length) savePlugins(filtered);
        return;
    }

    list.forEach(function (item) {
        if (item && item.url === oldUrl) {
            item.url = newUrl;
            changed = true;
        }
    });

    if (changed) savePlugins(list);
}

/* ===== PLUGIN ACTIONS ===== */

function markPending() {
    pending = true;
    updateRestartRow();
}

function restartLampa() {
    if (!pending) return;
    notify('Застосування змін...');
    window.location.reload();
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
    notify(plugin.name + ': встановлено');
}

function setPluginEnabled(plugin, enabled) {
    var list = getPlugins();
    var changed = false;

    list.forEach(function (item) {
        if (item && item.url === plugin.url && isEnabled(item) !== enabled) {
            item.status = enabled ? 1 : 0;
            changed = true;
        }
    });

    if (!changed) return;

    savePlugins(list);
    markPending();
    notify(plugin.name + (enabled ? ': увімкнено' : ': вимкнено'));
}

function removePlugin(plugin) {
    var list = getPlugins();

    var filtered = list.filter(function (item) {
        return item && item.url !== plugin.url;
    });

    if (filtered.length === list.length) return;

    savePlugins(filtered);
    markPending();
    notify(plugin.name + ': видалено');
}

/* ===== MOBILE ORIENTATION ===== */

/*
 * На телефоні у вертикальній орієнтації використовуємо
 * штатний повноекранний режим Lampa.Select.
 *
 * На ТВ та в горизонтальному режимі нічого не змінюємо.
 */

function isMobilePortrait() {
    var width = window.innerWidth || document.documentElement.clientWidth || 0;
    var height = window.innerHeight || document.documentElement.clientHeight || 0;

    return width > 0 && height > width && width <= 600;
}

/* ===== PREMIUM STYLES ===== */

function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    var style = document.createElement('style');
    style.id = STYLE_ID;

    style.textContent = `
        .crowley-pm-hidden {
            display: none !important;
        }

        /* Category rows */

        .crowley-pm-folder {
            position: relative;
            transition: background-color .18s ease;
        }

        .crowley-pm-folder .settings-param__name {
            display: flex;
            align-items: center;
            gap: 12px;
            font-weight: 500;
            letter-spacing: .1px;
        }

        .crowley-pm-folder .crowley-pm-icon {
            display: inline-flex;
            flex: 0 0 22px;
            width: 22px;
            align-items: center;
            justify-content: center;
            opacity: .88;
        }

        .crowley-pm-icon svg {
            display: block;
            width: 22px;
            height: 22px;
        }

        .crowley-pm-folder .settings-param__descr {
            padding-left: 34px;
            font-size: .82em;
            line-height: 1.35;
            opacity: .65;
            letter-spacing: .1px;
        }

        /* Plugin list */

        .crowley-pm-select-row {
            position: relative;
            transition: background-color .16s ease;
        }

        .crowley-pm-select-row.focus,
        .crowley-pm-select-row.focused {
            border-radius: 10px;
        }

        /* Status dot aligned with title */

        .crowley-pm-select-row .crowley-pm-plugin-title {
            display: inline-flex !important;
            align-items: center !important;
            gap: 9px !important;
            padding-left: 4px !important;
            vertical-align: middle;
            position: relative;
            box-sizing: border-box;
        }

        .crowley-pm-plugin-title::before {
            content: '';
            display: inline-block;
            position: static !important;
            flex: 0 0 6px;
            width: 6px;
            height: 6px;
            border-radius: 50%;
            transform: none !important;
            pointer-events: none;
        }

        .crowley-pm-status-enabled .crowley-pm-plugin-title::before {
            background: #36c58b;
            box-shadow: 0 0 0 2px rgba(54,197,139,.12);
        }

        .crowley-pm-status-disabled .crowley-pm-plugin-title::before {
            background: #e5a54b;
            box-shadow: 0 0 0 2px rgba(229,165,75,.12);
        }

        .crowley-pm-status-absent .crowley-pm-plugin-title::before {
            background: #9096a1;
            box-shadow: 0 0 0 2px rgba(144,150,161,.12);
        }

        /* Elegant descriptions */

        .crowley-pm-select-row .selectbox-item__subtitle,
        .crowley-pm-select-row .select__subtitle,
        .crowley-pm-select-row .selector-item__subtitle {
            font-size: .82em;
            font-style: italic;
            font-weight: 400;
            opacity: .68;
            line-height: 1.4;
            letter-spacing: .1px;
        }

        /* Remove action */

        .crowley-pm-action-danger {
            color: #e58b8b;
        }

        /* Restart button */

        .crowley-pm-restart .settings-param__name {
            color: #e8b86b;
        }

        /* Mobile category rows */

        @media (max-width: 600px) {
            .crowley-pm-folder .settings-param__name {
                gap: 9px;
            }

            .crowley-pm-folder .crowley-pm-icon {
                flex-basis: 19px;
                width: 19px;
            }

            .crowley-pm-icon svg {
                width: 19px;
                height: 19px;
            }

            .crowley-pm-folder .settings-param__descr {
                padding-left: 28px;
            }

            .crowley-pm-select-row .crowley-pm-plugin-title {
                gap: 8px !important;
            }

            .crowley-pm-select-row .selectbox-item__subtitle,
            .crowley-pm-select-row .select__subtitle,
            .crowley-pm-select-row .selector-item__subtitle {
                font-size: .8em;
            }
        }

        @media (prefers-reduced-motion: reduce) {
            .crowley-pm-folder,
            .crowley-pm-select-row {
                transition: none !important;
            }
        }
    `;

    document.head.appendChild(style);
}

/* ===== SELECT DECORATION ===== */

function findTitleElement(element, titleText) {
    var selectors = [
        '.selectbox-item__title',
        '.selectbox-item__name',
        '.select__title',
        '.selector-item__title',
        '.selectbox__title'
    ];

    for (var i = 0; i < selectors.length; i++) {
        var found = element.querySelector(selectors[i]);

        if (found && found.textContent.trim() === titleText) {
            return found;
        }
    }

    var descendants = element.querySelectorAll('*');

    for (var j = 0; j < descendants.length; j++) {
        var node = descendants[j];

        if (
            node.children.length === 0 &&
            node.textContent.trim() === titleText
        ) {
            return node;
        }
    }

    return null;
}

function decorateSelect(items) {
    var retries = 0;
    var generation = ++decorationGeneration;

    clearTimeout(decorationTimer);

    function retry() {
        retries++;

        if (retries < 10) {
            decorationTimer = setTimeout(apply, 70);
        }
    }

    function apply() {
        if (menuDepth <= 0 || generation !== decorationGeneration) return;

        var roots = document.querySelectorAll(
            '.selectbox, .select, .select-modal'
        );

        var root = null;
        var candidates = null;

        for (var r = roots.length - 1; r >= 0; r--) {
            var candidateRoot = roots[r];

            if (!candidateRoot.getClientRects().length) continue;

            var foundRows = candidateRoot.querySelectorAll(
                '.selectbox-item, .select__item, .selector-item'
            );

            if (foundRows.length >= items.length) {
                root = candidateRoot;
                candidates = foundRows;
                break;
            }
        }

        if (!root || !candidates) {
            retry();
            return;
        }

        var oldRows = root.querySelectorAll('.crowley-pm-select-row');

        for (var x = 0; x < oldRows.length; x++) {
            oldRows[x].classList.remove(
                'crowley-pm-select-row',
                'crowley-pm-status-enabled',
                'crowley-pm-status-disabled',
                'crowley-pm-status-absent',
                'crowley-pm-action-danger'
            );
        }

        var oldTitles = root.querySelectorAll('.crowley-pm-plugin-title');

        for (var y = 0; y < oldTitles.length; y++) {
            oldTitles[y].classList.remove('crowley-pm-plugin-title');
        }

        var matched = 0;
        var expected = 0;

        for (var i = 0; i < items.length && i < candidates.length; i++) {
            var element = candidates[i];
            var item = items[i];

            element.classList.add('crowley-pm-select-row');

            if (item.pmState) {
                expected++;

                var title = findTitleElement(element, item.title);

                if (title) {
                    element.classList.add('crowley-pm-status-' + item.pmState);
                    title.classList.add('crowley-pm-plugin-title');
                    matched++;
                }
            }

            if (item.action === 'remove') {
                element.classList.add('crowley-pm-action-danger');
            }
        }

        if (expected > 0 && matched < expected) retry();
    }

    decorationTimer = setTimeout(apply, 60);
}

/* ===== NAVIGATION ===== */

function restoreSettingsController() {
    menuDepth = 0;
    decorationGeneration++;

    clearTimeout(decorationTimer);

    updateFolderRows();
    updateRestartRow();

    if (Lampa.Controller && Lampa.Controller.toggle) {
        Lampa.Controller.toggle('settings_component');
    }
}

function showSelect(options) {
    if (!Lampa.Select || !Lampa.Select.show) return;

    /*
     * Основне виправлення:
     * Lampa.Select має вбудований режим fullsize.
     * Вмикаємо його тільки на вузькому екрані у портретній
     * орієнтації, щоб список не відкривався за нижнім краєм.
     */
    options.fullsize = isMobilePortrait();

    menuDepth = 1;

    var originalBack = options.onBack;
    var originalSelect = options.onSelect;

    options.onBack = function () {
        if (navigationLock) return;

        navigationLock = true;

        try {
            if (typeof originalBack === 'function') {
                originalBack();
            } else {
                restoreSettingsController();
            }
        } finally {
            clearTimeout(navigationTimer);

            navigationTimer = setTimeout(function () {
                navigationLock = false;
            }, 120);
        }
    };

    options.onSelect = function (item) {
        if (typeof originalSelect === 'function') {
            originalSelect(item);
        }
    };

    Lampa.Select.show(options);
    decorateSelect(options.items || []);
}

/* ===== CATEGORY MENU ===== */

function buildCategoryItems(category) {
    return category.plugins.map(function (plugin) {
        return {
            title: plugin.name,
            subtitle: plugin.description,
            plugin: plugin,
            pmState: getState(plugin),
            selected: selected[category.id] === plugin.id
        };
    });
}

function openCategory(category) {
    if (!category) return;

    showSelect({
        title: category.name,
        items: buildCategoryItems(category),

        onSelect: function (item) {
            if (!item || !item.plugin) return;

            selected[category.id] = item.plugin.id;
            openPlugin(item.plugin, category);
        },

        onBack: function () {
            restoreSettingsController();
        }
    });
}

/* ===== PLUGIN ACTION MENU ===== */

function openPlugin(plugin, category) {
    var state = getState(plugin);
    var items = [];

    if (state === 'absent') {
        items.push({
            title: 'Встановити',
            action: 'install'
        });
    } else {
        items.push({
            title: state === 'enabled' ? 'Вимкнути' : 'Увімкнути',
            action: state === 'enabled' ? 'disable' : 'enable'
        });

        items.push({
            title: 'Видалити',
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
                confirmRemove(plugin, category);
                return;
            }

            switch (item.action) {
                case 'install':
                    installPlugin(plugin);
                    break;
                case 'enable':
                    setPluginEnabled(plugin, true);
                    break;
                case 'disable':
                    setPluginEnabled(plugin, false);
                    break;
            }

            selected[category.id] = plugin.id;
            openCategory(category);
        },

        onBack: function () {
            selected[category.id] = plugin.id;
            openCategory(category);
        }
    });
}

/* ===== REMOVE CONFIRMATION ===== */

function confirmRemove(plugin, category) {
    showSelect({
        title: 'Видалити ' + plugin.name + '?',

        items: [
            { title: 'Скасувати', action: 'cancel' },
            { title: 'Видалити', action: 'remove' }
        ],

        onSelect: function (item) {
            if (item && item.action === 'remove') {
                removePlugin(plugin);
            }

            selected[category.id] = plugin.id;
            openCategory(category);
        },

        onBack: function () {
            openPlugin(plugin, category);
        }
    });
}

/* ===== CATEGORY ROWS ===== */

function updateFolderRow(category) {
    var row = rows['folder_' + category.id];
    if (!row || !row.length) return;

    var description = row.find('.settings-param__descr').first();

    if (description.length) {
        description.text(
            getCount(category) + ' із ' +
            category.plugins.length + ' встановлено'
        );
    }
}

function updateFolderRows() {
    CATEGORIES.forEach(updateFolderRow);
}

function decorateFolderRow(row, category) {
    if (!row || !row.length) return;

    row.addClass('crowley-pm-folder');

    var name = row.find('.settings-param__name').first();

    if (!name.length || name.find('.crowley-pm-icon').length) return;

    var original = name.text();
    name.empty();

    var icon = document.createElement('span');
    icon.className = 'crowley-pm-icon';
    icon.innerHTML = svgIcon(category.icon, 22);

    var label = document.createElement('span');
    label.className = 'crowley-pm-label';
    label.textContent = original;

    name.append(icon);
    name.append(label);
}

/* ===== RESTART ROW ===== */

function updateRestartRow() {
    var row = rows.restart;
    if (!row || !row.length) return;

    row.toggleClass('crowley-pm-hidden', !pending);
}

/* ===== SETTINGS COMPONENT ===== */

function registerComponent() {
    Lampa.SettingsApi.addComponent({
        component: ROOT,
        name: 'Менеджер Плагінів',
        icon: svgIcon('grid', 40)
    });
}

function registerFolders() {
    CATEGORIES.forEach(function (category) {
        Lampa.SettingsApi.addParam({
            component: ROOT,

            param: {
                name: 'crowley_pm363_folder_' + category.id,
                type: 'button'
            },

            field: {
                name: category.name,
                description:
                    getCount(category) + ' із ' +
                    category.plugins.length + ' встановлено'
            },

            onRender: function (item) {
                rows['folder_' + category.id] = item;
                decorateFolderRow(item, category);
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
            name: 'crowley_pm363_restart',
            type: 'button'
        },

        field: {
            name: 'Застосувати зміни',
            description: 'Перезапустити Lampa'
        },

        onRender: function (item) {
            rows.restart = item;
            item.addClass('crowley-pm-restart');
            updateRestartRow();
        },

        onChange: function () {
            restartLampa();
        }
    });
}

/* ===== INITIALIZATION ===== */

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
        setTimeout(waitForLampa, 200);
    } else {
        window[READY] = false;
    }
}

waitForLampa();

})();
