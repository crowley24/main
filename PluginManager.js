
(function () {
    'use strict';

    if (window.crowley_plugin_manager_ready) return;
    window.crowley_plugin_manager_ready = true;

    /* ========================================
       CROWLEY PLUGIN MANAGER 2.0
       Lampa — керування плагінами
       ======================================== */

    var VERSION = '2.0.0';
    var COMPONENT = 'plugin_manager_page';

    var AVAILABLE_PLUGINS = [
        {
            name: 'UaKino',
            description: 'Автоматичне програвання фільмів та серіалів з uakino.ax',
            url: 'https://crowley24.github.io/main/Uakino.js',
            id: 'Uakino'
        },
        {
            name: 'NewCard',
            description: 'Сучасний ТВ-інтерфейс картки фільму з гнучкими налаштуваннями відображення та покращеною візуальною структурою',
            url: 'https://crowley24.github.io/main/NewCard.js',
            id: 'NewCard'
        },
        {
            name: 'Mobile Interface',
            description: 'Оптимізований мобільний інтерфейс картки фільму з адаптивним дизайном та розширеними налаштуваннями',
            url: 'https://crowley24.github.io/main/Mob_Interface.js',
            id: 'mob_interface'
        },
        {
            name: 'Mobile Menu',
            description: 'Оновлене нижнє меню для мобільних пристроїв',
            url: 'https://crowley24.github.io/NewMenu_Mob.js',
            id: 'NewMenu_Mob'
        },
        {
            name: 'Custom Buttons',
            description: 'Розширена кастомізація кнопок у картці фільму з додатковими елементами керування (ko31k.giyhub.io)',
            url: 'http://crowley24.github.io/main/ButtonsManager+.js',
            id: 'custom_buttons'
        },
        {
            name: 'Finder UA',
            description: 'Відображення бейджа на картці фільму при наявності українського дубляжу',
            url: 'https://crowley24.github.io/main/UA-Finder+Mod.js',
            id: 'UA-Finder'
        },
        {
            name: 'Continue Watching',
            description: 'Відображення на головній сторінці інформаційної панелі з історією перегляду',
            url: 'https://crowley24.github.io/Watching.js',
            id: 'Watching'
        },
        {
            name: 'Interface Size',
            description: 'Зміна розміру інтерфейсу',
            url: 'https://crowley24.github.io/main/InterfaceSize.js',
            id: 'InterfaceSize'
        },
        {
            name: 'Interface Hide',
            description: 'Приховування елементів меню',
            url: 'https://crowley24.github.io/interface_hide.js',
            id: 'InterfaceHize'
        },
        {
            name: 'Clock',
            description: 'Стильний годинник',
            url: 'https://crowley24.github.io/main/Clock.js',
            id: 'Clock'
        },
        {
            name: 'Ukrainisation',
            description: 'Лагідна Українізація',
            url: 'https://crowley24.github.io/main/Ukr.js',
            id: 'Ukr'
        },
        {
            name: 'Random',
            description: 'Випадкова добірка фільмів',
            url: 'https://crowley24.github.io/main/Random.js',
            id: 'Random'
        }
    ];

    /* ========================================
       STORAGE
       ======================================== */

    function getPlugins() {
        var plugins = Lampa.Storage.get('plugins');

        return Array.isArray(plugins) ? plugins : [];
    }

    function savePlugins(plugins) {
        Lampa.Storage.set('plugins', plugins);
    }

    function findPlugin(url) {
        var plugins = getPlugins();

        for (var i = 0; i < plugins.length; i++) {
            if (plugins[i] && plugins[i].url === url) {
                return plugins[i];
            }
        }

        return null;
    }

    function isEnabled(plugin) {
        if (!plugin) return false;

        return !(
            plugin.status === 0 ||
            plugin.status === false ||
            plugin.status === '0' ||
            plugin.status === 'false'
        );
    }

    function getPluginState(url) {
        var plugin = findPlugin(url);

        if (!plugin) return 'not_installed';

        return isEnabled(plugin)
            ? 'enabled'
            : 'disabled';
    }

    /* ========================================
       NOTIFICATIONS
       ======================================== */

    function notify(message) {
        if (Lampa.Noty && Lampa.Noty.show) {
            Lampa.Noty.show(message);
        }
    }

    /* ========================================
       HOT LOAD
       ======================================== */

    function loadPlugin(url) {
        var scripts = document.querySelectorAll(
            'script[data-crowley-plugin]'
        );

        for (var i = 0; i < scripts.length; i++) {
            if (
                scripts[i].getAttribute(
                    'data-crowley-plugin'
                ) === url
            ) {
                return;
            }
        }

        var script = document.createElement('script');

        script.src = url +
            (url.indexOf('?') === -1 ? '?' : '&') +
            'v=' + Date.now();

        script.async = true;

        script.setAttribute(
            'data-crowley-plugin',
            url
        );

        script.onload = function () {
            notify('⚡ Плагін завантажено');
        };

        script.onerror = function () {
            notify('❌ Помилка завантаження плагіна');
            if (script.parentNode) {
                script.parentNode.removeChild(script);
            }
        };

        document.body.appendChild(script);
    }

    /* ========================================
       RELOAD
       ======================================== */

    function softReload() {
        notify('♻️ Перезапуск Lampa...');

        setTimeout(function () {
            window.location.reload();
        }, 800);
    }

    /* ========================================
       INSTALL
       ======================================== */

    function installPlugin(plugin) {
        var plugins = getPlugins();

        if (findPlugin(plugin.url)) {
            return;
        }

        plugins.push({
            id: plugin.id,
            name: plugin.name,
            url: plugin.url,
            status: 1
        });

        savePlugins(plugins);

        notify('🟢 Плагін встановлено');

        updateIndicators();

        loadPlugin(plugin.url);
    }

    /* ========================================
       ENABLE
       ======================================== */

    function enablePlugin(plugin) {
        var plugins = getPlugins();
        var found = false;

        plugins.forEach(function (item) {
            if (item.url === plugin.url) {
                item.status = 1;
                found = true;
            }
        });

        if (!found) {
            installPlugin(plugin);
            return;
        }

        savePlugins(plugins);

        notify('🟢 Плагін увімкнено');

        updateIndicators();

        /*
         * Якщо плагін був вимкнений,
         * для надійної активації
         * потрібен перезапуск Lampa.
         */
        notify('♻️ Перезапустіть Lampa для застосування');
    }

    /* ========================================
       DISABLE
       ======================================== */

    function disablePlugin(plugin) {
        var plugins = getPlugins();

        plugins.forEach(function (item) {
            if (item.url === plugin.url) {
                item.status = 0;
            }
        });

        savePlugins(plugins);

        notify('🟠 Плагін вимкнено');

        updateIndicators();

        notify('♻️ Перезапустіть Lampa для застосування');
    }

    /* ========================================
       REMOVE
       ======================================== */

    function removePlugin(plugin) {
        var plugins = getPlugins().filter(
            function (item) {
                return item.url !== plugin.url;
            }
        );

        savePlugins(plugins);

        notify('🔴 Плагін видалено');

        updateIndicators();

        notify('♻️ Перезапустіть Lampa для застосування');
    }

    /* ========================================
       INDICATOR COLORS
       ======================================== */

    var COLORS = {
        enabled: '#11e400',
        disabled: '#ffad24',
        not_installed: '#ff3030'
    };

    var STATUS_TEXT = {
        enabled: 'Увімкнено',
        disabled: 'Вимкнено',
        not_installed: 'Не встановлено'
    };

    /* ========================================
       INDICATOR CSS
       ======================================== */

    function injectStyles() {
        if (
            document.getElementById(
                'crowley-plugin-manager-style'
            )
        ) {
            return;
        }

        var style = document.createElement('style');

        style.id = 'crowley-plugin-manager-style';

        style.textContent = `
            .crowley-plugin-indicator {
                display: inline-block;
                width: 10px;
                height: 10px;
                min-width: 10px;
                margin-left: 10px;
                border-radius: 50%;
                vertical-align: middle;
                box-sizing: border-box;
                transition:
                    background-color .2s ease,
                    box-shadow .2s ease;
            }

            .crowley-plugin-indicator.enabled {
                background: #11e400;
                box-shadow:
                    0 0 6px rgba(17,228,0,.4);
            }

            .crowley-plugin-indicator.disabled {
                background: #ffad24;
                box-shadow:
                    0 0 6px rgba(255,173,36,.35);
            }

            .crowley-plugin-indicator.not_installed {
                background: #ff3030;
                box-shadow:
                    0 0 6px rgba(255,48,48,.3);
            }

            .crowley-plugin-status {
                display: inline-block;
                margin-left: 9px;
                font-size: .72em;
                font-weight: 400;
                opacity: .75;
                vertical-align: middle;
            }
        `;

        document.head.appendChild(style);
    }

    /* ========================================
       APPLY INDICATOR
       ======================================== */

    function applyIndicator(item, plugin) {
        if (!item || !item.length) return;

        var title = item.find(
            '.settings-param__name'
        ).first();

        if (!title.length) return;

        var state = getPluginState(plugin.url);

        var indicator = title.find(
            '.crowley-plugin-indicator'
        );

        if (!indicator.length) {
            indicator = $(
                '<span class="crowley-plugin-indicator"></span>'
            );

            title.append(indicator);
        }

        indicator.removeClass(
            'enabled disabled not_installed'
        );

        indicator.addClass(state);

        indicator.attr(
            'title',
            STATUS_TEXT[state]
        );
    }

    /* ========================================
       UPDATE INDICATORS
       ======================================== */

    var renderedItems = {};

    function updateIndicators() {
        AVAILABLE_PLUGINS.forEach(function (plugin) {
            var item = renderedItems[plugin.id];

            if (item && item.length) {
                applyIndicator(item, plugin);
            }
        });
    }

    /* ========================================
       ACTION MENU
       ======================================== */

    function showPluginMenu(plugin) {
        var state = getPluginState(plugin.url);
        var items = [];

        if (state === 'not_installed') {
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

        items.push({
            title: '♻️ Перезапустити Lampa',
            action: 'reload'
        });

        if (!Lampa.Select || !Lampa.Select.show) {
            notify('❌ Меню вибору недоступне');
            return;
        }

        Lampa.Select.show({
            title: plugin.name,
            items: items,
            onSelect: function (selected) {
                if (!selected) return;

                switch (selected.action) {
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
                        removePlugin(plugin);
                        break;

                    case 'reload':
                        softReload();
                        break;
                }
            },
            onBack: function () {}
        });
    }

    /* ========================================
       SETTINGS COMPONENT
       ======================================== */

    function registerComponent() {
        Lampa.SettingsApi.addComponent({
            component: COMPONENT,
            name: 'Менеджер Плагінів',
            icon:
                '<svg width="40" height="40" ' +
                'viewBox="0 0 24 24" fill="none">' +
                '<path d="M12 6V18M6 12H18" ' +
                'stroke="white" stroke-width="2" ' +
                'stroke-linecap="round"/>' +
                '</svg>'
        });
    }

    /* ========================================
       RELOAD BUTTON
       ======================================== */

    function registerReloadButton() {
        Lampa.SettingsApi.addParam({
            component: COMPONENT,
            param: {
                name: 'crowley_reload_all',
                type: 'button'
            },
            field: {
                name: '♻️ Оновити застосунок',
                description: 'Перезапуск Lampa для застосування змін'
            },
            onChange: function () {
                softReload();
            }
        });
    }

    /* ========================================
       PLUGIN LIST
       ======================================== */

    function registerPlugins() {
        AVAILABLE_PLUGINS.forEach(function (plugin) {
            Lampa.SettingsApi.addParam({
                component: COMPONENT,

                param: {
                    name: plugin.id,
                    type: 'button'
                },

                field: {
                    name: plugin.name,
                    description: plugin.description
                },

                onRender: function (item) {
                    renderedItems[plugin.id] = item;

                    applyIndicator(
                        item,
                        plugin
                    );
                },

                onChange: function () {
                    showPluginMenu(plugin);
                }
            });
        });
    }

    /* ========================================
       INITIALIZATION
       ======================================== */

    function init() {
        if (
            !window.Lampa ||
            !Lampa.SettingsApi ||
            !Lampa.Storage
        ) {
            return false;
        }

        injectStyles();

        registerComponent();
        registerReloadButton();
        registerPlugins();

        return true;
    }

    /* ========================================
       WAIT FOR LAMPA
       ======================================== */

    var attempts = 0;
    var maxAttempts = 100;

    function waitForLampa() {
        if (init()) {
            return;
        }

        attempts++;

        if (attempts < maxAttempts) {
            setTimeout(waitForLampa, 200);
        } else {
            window.crowley_plugin_manager_ready = false;
        }
    }

    waitForLampa();

})();
