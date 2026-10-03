(function () {
    'use strict';

    // Додаємо переклади для інтерфейсу та кольорів
    Lampa.Lang.add({
        color_plugin: { ru: 'Настройка цветов', en: 'Color settings', uk: 'Налаштування кольорів' },
        color_plugin_enabled: { ru: 'Включить плагин', en: 'Enable plugin', uk: 'Увімкнути плагін' },
        color_plugin_enabled_description: { ru: 'Изменяет вид некоторых элементов интерфейса Lampa', en: 'Changes the appearance of some Lampa interface elements', uk: 'Змінює вигляд деяких елементів інтерфейсу Lampa' },
        main_color: { ru: 'Цвет выделения', en: 'Highlight color', uk: 'Колір виділення' },
        main_color_description: { ru: 'Выберите стандартный или один из лучших цветов для интерфейса', en: 'Select a standard or one of the best colors for the interface', uk: 'Виберіть стандартний або один з найкращих кольорів для інтерфейсу' },
        enable_highlight: { ru: 'Показать рамку', en: 'Show border', uk: 'Показати рамку' },
        enable_highlight_description: { ru: 'Включает белую рамку вокруг некоторых выделенных элементов интерфейса', en: 'Enables a white border around some highlighted interface elements', uk: 'Вмикає білу рамку навколо деяких виділених елементів інтерфейсу' },
        enable_dimming: { ru: 'Применить цвет затемнения', en: 'Apply dimming color', uk: 'Застосувати колір затемнення' },
        enable_dimming_description: { ru: 'Изменяет цвет затемненных элементов интерфейса на темный оттенок выбранного цвета выделения', en: 'Changes the color of dimmed interface elements to a dark shade of the selected highlight color', uk: 'Змінює колір затемнених елементів інтерфейсу на темний відтінок вибраного кольору виділення' },
        default_color: { ru: 'По умолчанию (Стандартный)', en: 'Default', uk: 'За замовчуванням (Стандартний)' },
        custom_hex_input: { ru: 'Введи HEX-код цвета', en: 'Enter HEX color code', uk: 'Введи HEX-код кольору' },
        hex_input_hint: { ru: 'Используйте формат #FFFFFF, например #123524', en: 'Use the format #FFFFFF, for example #123524', uk: 'Використовуйте формат #FFFFFF, наприклад #123524' }
    });

    // Об'єкт для налаштувань і добірної палітри топ-кольорів
    var ColorPlugin = {
        settings: {
            main_color: Lampa.Storage.get('color_plugin_main_color', '#353535'),
            enabled: Lampa.Storage.get('color_plugin_enabled', 'true') === 'true',
            highlight_enabled: Lampa.Storage.get('color_plugin_highlight_enabled', 'true') === 'true',
            dimming_enabled: Lampa.Storage.get('color_plugin_dimming_enabled', 'true') === 'true'
        },
        // 15 найкращих збалансованих кольорів, що ідеально пасують для кінотеатрального інтерфейсу
        colors: {
            '#353535': { name: { ru: 'Стандартный (Lampa)', en: 'Default (Lampa)', uk: 'Стандартний (Lampa)' }, isDefault: true },
            '#2b7fff': { name: { ru: 'Классический синий', en: 'Classic Blue', uk: 'Класичний синій' } },
            '#00a6f4': { name: { ru: 'Небесно-голубой', en: 'Sky Blue', uk: 'Небесно-блакитний' } },
            '#00c950': { name: { ru: 'Насыщенный зеленый', en: 'Vibrant Green', uk: 'Насичений зелений' } },
            '#00bc7d': { name: { ru: 'Изумрудный', en: 'Emerald', uk: 'Смарагдовий' }, },
            '#00bba7': { name: { ru: 'Бирюзовый', en: 'Teal', uk: 'Бірюзовий' } },
            '#fe9a00': { name: { ru: 'Янтарный / Оранжевый', en: 'Amber', uk: 'Бурштиновий / Оранжевий' } },
            '#fb2c36': { name: { ru: 'Красный (Кино)', en: 'Cinematic Red', uk: 'Червоний (Кінотеатральний)' } },
            '#ff2056': { name: { ru: 'Розово-малиновый', en: 'Rose', uk: 'Рожево-малиновий' } },
            '#e12afb': { name: { ru: 'Фуксия', en: 'Fuchsia', uk: 'Фуксія' } },
            '#ad46ff': { name: { ru: 'Пурпурный', en: 'Purple', uk: 'Пурпуровий' } },
            '#8e51ff': { name: { ru: 'Фиолетовый', en: 'Violet', uk: 'Фіолетовий' } },
            '#615fff': { name: { ru: 'Индиго', en: 'Indigo', uk: 'Індиго' } },
            '#f0b100': { name: { ru: 'Теплый желтый', en: 'Warm Yellow', uk: 'Теплий жовтий' } },
            '#71717b': { name: { ru: 'Строгий серый (Zinc)', en: 'Zinc Gray', uk: 'Строгий сірий (Zinc)' } }
        }
    };

    var isSaving = false;

    function hexToRgb(hex) {
        if (!hex || hex === 'default') hex = '#353535';
        var cleanHex = hex.replace('#', '');
        var r = parseInt(cleanHex.substring(0, 2), 16);
        var g = parseInt(cleanHex.substring(2, 4), 16);
        var b = parseInt(cleanHex.substring(4, 6), 16);
        return r + ', ' + g + ', ' + b;
    }

    function rgbToHex(rgb) {
        var matches = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
        if (!matches) return rgb;
        function hex(n) { return ('0' + parseInt(n).toString(16)).slice(-2); }
        return '#' + hex(matches[1]) + hex(matches[2]) + hex(matches[3]);
    }

    function isValidHex(color) {
        return /^#[0-9A-Fa-f]{6}$/.test(color);
    }

    function updateDateElementStyles() {
        var elements = document.querySelectorAll('div[style*="position: absolute; left: 1em; top: 1em;"]');
        for (var i = 0; i < elements.length; i++) {
            var element = elements[i];
            if (element.querySelector('div[style*="font-size: 2.6em"]')) {
                element.style.background = 'var(--main-color)';
            }
        }
    }

    function updateCanvasFillStyle(context) {
        if (context && context.fillStyle) {
            var rgbColor = hexToRgb(ColorPlugin.settings.main_color);
            context.fillStyle = 'rgba(' + rgbColor + ', 1)';
        }
    }

    function updatePluginIcon() {
        var svgIcon = '<svg width="24px" height="24px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="#ffffff"><path fill-rule="evenodd" clip-rule="evenodd" d="M8 1.003a7 7 0 0 0-7 7v.43c.09 1.51 1.91 1.79 3 .7a1.87 1.87 0 0 1 2.64 2.64c-1.1 1.16-.79 3.07.8 3.2h.6a7 7 0 1 0 0-14l-.04.03zm0 13h-.52a.58.58 0 0 1-.36-.14.56.56 0 0 1-.15-.3 1.24 1.24 0 0 1 .35-1.08 2.87 2.87 0 0 0 0-4 2.87 2.87 0 0 0-4.06 0 1 1 0 0 1-.9.34.41.41 0 0 1-.22-.12.42.42 0 0 1-.1-.29v-.37a6 6 0 1 1 6 6l-.04-.04zM9 3.997a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 7.007a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-7-5a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm7-1a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM13 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/></svg>';
        if (!Lampa.SettingsApi || !Lampa.SettingsApi.components) {
            var menuItem = document.querySelector('.menu__item[data-component="color_plugin"] .menu__ico');
            if (menuItem) { menuItem.innerHTML = svgIcon; }
            return;
        }
        var component = Lampa.SettingsApi.components.find(function(c) { return c.component === 'color_plugin'; });
        if (component) {
            component.icon = svgIcon;
            if (Lampa.Settings && Lampa.Settings.render) { Lampa.Settings.render(); }
        }
    }

    function saveSettings() {
        if (isSaving) return;
        isSaving = true;
        Lampa.Storage.set('color_plugin_main_color', ColorPlugin.settings.main_color);
        Lampa.Storage.set('color_plugin_enabled', ColorPlugin.settings.enabled.toString());
        Lampa.Storage.set('color_plugin_highlight_enabled', ColorPlugin.settings.highlight_enabled.toString());
        Lampa.Storage.set('color_plugin_dimming_enabled', ColorPlugin.settings.dimming_enabled.toString());
        
        localStorage.setItem('color_plugin_main_color', ColorPlugin.settings.main_color);
        localStorage.setItem('color_plugin_enabled', ColorPlugin.settings.enabled.toString());
        localStorage.setItem('color_plugin_highlight_enabled', ColorPlugin.settings.highlight_enabled.toString());
        localStorage.setItem('color_plugin_dimming_enabled', ColorPlugin.settings.dimming_enabled.toString());
        isSaving = false;
    }

    function applyStyles() {
        if (!ColorPlugin.settings.enabled) {
            var oldStyle = document.getElementById('color-plugin-styles');
            if (oldStyle) oldStyle.remove();
            return;
        }
        var style = document.getElementById('color-plugin-styles');
        if (!style) {
            style = document.createElement('style');
            style.id = 'color-plugin-styles';
            document.head.appendChild(style);
        }
        var rgbColor = hexToRgb(ColorPlugin.settings.main_color);
        var focusBorderColor = ColorPlugin.settings.main_color === '#353535' ? '#ffffff' : 'var(--main-color)';
        var highlightStyles = ColorPlugin.settings.highlight_enabled ? (
            '-webkit-box-shadow: inset 0 0 0 0.15em #fff !important;' +
            'box-shadow: inset 0 0 0 0.15em #fff !important;'
        ) : '';
        
        var dimmingStyles = ColorPlugin.settings.dimming_enabled ? (
            '.full-start__rate { background: rgba(var(--main-color-rgb), 0.15) !important; }' +
            '.full-start__rate > div:first-child { background: rgba(var(--main-color-rgb), 0.15) !important; }' +
            '.reaction { background-color: rgba(var(--main-color-rgb), 0.3) !important; }' +
            '.full-start__button { background-color: rgba(var(--main-color-rgb), 0.3) !important; }' +
            '.card__vote { background: rgba(var(--main-color-rgb), 0.5) !important; }' +
            '.items-line__more { background: rgba(var(--main-color-rgb), 0.3) !important; }' +
            '.card__icons-inner { background: rgba(var(--main-color-rgb), 0.5) !important; }' +
            '.simple-button--filter > div { background-color: rgba(var(--main-color-rgb), 0.3) !important; }'
        ) : '';

        style.innerHTML = [
            ':root {' +
            '--main-color: ' + ColorPlugin.settings.main_color + ' !important;' +
            '--main-color-rgb: ' + rgbColor + ' !important;' +
            '}',
            '.modal__title { font-size: 1.7em !important; }',
            '.modal__head { margin-bottom: 0 !important; }',
            '.modal .scroll__content { padding: 1.0em 0 !important; }',
            '.menu__ico, .menu__ico:hover, .menu__ico.traverse, .head__action, .head__action.focus, .head__action:hover, .settings-param__ico { color: #ffffff !important; fill: #ffffff !important; }',
            '.console__tab.focus, .menu__item.focus, .menu__item.traverse, .menu__item:hover, .full-person.focus, .full-start__button.focus, .full-descr__tag.focus, .simple-button.focus, .head__action.focus, .head__action:hover, .player-panel .button.focus, .search-source.active, .timetable__item.focus::before, .navigation-tabs__button.focus, .broadcast__device.focus, .iptv-menu__list-item.focus, .iptv-program__timeline>div, .radio-item.focus, .lang__selector-item.focus, .simple-keyboard .hg-button.focus, .modal__button.focus, .search-history-key.focus, .simple-keyboard-mic.focus, .full-review-add.focus, .full-review.focus, .tag-count.focus, .settings-folder.focus, .settings-param.focus, .selectbox-item.focus, .selectbox-item:hover, .noty, .radio-player.focus { background: var(--main-color) !important; color: #fff !important; ' + highlightStyles + ' }',
            '.color_square.focus, .hex-input.focus { border: 0.3em solid ' + focusBorderColor + ' !important; transform: scale(1.08) !important; }',
            dimmingStyles,
            /* Стилі елементів у модальному вікні вибору кольору */
            '.color-picker-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; padding: 10px; max-height: 65vh; overflow-y: auto; }',
            '.color-picker-item { display: flex; align-items: center; background: rgba(255, 255, 255, 0.08); border-radius: 8px; padding: 10px 14px; cursor: pointer; border: 2px solid transparent; }',
            '.color-picker-item.focus { background: var(--main-color) !important; border-color: #fff !important; color: #fff !important; transform: scale(1.03); }',
            '.color-preview-box { width: 30px; height: 30px; border-radius: 6px; margin-right: 14px; box-shadow: 0 2px 5px rgba(0,0,0,0.3); flex-shrink: 0; border: 1px solid rgba(255,255,255,0.2); }',
            '.color-name-text { font-size: 1.1em; font-weight: bold; color: #fff; }',
            '.color-picker-custom { grid-column: span 2; background: rgba(255, 255, 255, 0.12); justify-content: center; border: 2px dashed rgba(255,255,255,0.4); }'
        ].join('');

        updateDateElementStyles();
    }

    // Створення зручного та красивого модального вікна вибору кольорів списком
    function openColorPicker() {
        var keys = Object.keys(ColorPlugin.colors);
        var htmlItems = '';

        keys.forEach(function(hexKey) {
            var itemData = ColorPlugin.colors[hexKey];
            var langCode = (Lampa.Storage.get('language') || 'ru');
            var displayName = itemData.name[langCode] || itemData.name['ru'] || hexKey;
            
            var previewBg = itemData.isDefault ? 'linear-gradient(135deg, #353535 50%, #ffffff 50%)' : hexKey;

            htmlItems += '<div class="color-picker-item selector" tabindex="0" data-color="' + hexKey + '">' +
                '<div class="color-preview-box" style="background: ' + previewBg + ';"></div>' +
                '<div class="color-name-text">' + displayName + '</div>' +
            '</div>';
        });

        // Додаємо опцію введення власного HEX-коду в кінець списку
        htmlItems += '<div class="color-picker-item selector color-picker-custom" tabindex="0" data-color="custom">' +
            '<div class="color-name-text">✏️ ' + Lampa.Lang.translate('custom_hex_input') + '</div>' +
        '</div>';

        var modalHtml = $('<div class="color-picker-grid">' + htmlItems + '</div>');

        try {
            Lampa.Modal.open({
                title: Lampa.Lang.translate('main_color'),
                size: 'medium',
                align: 'center',
                html: modalHtml,
                className: 'color-picker-modal',
                onBack: function () {
                    saveSettings();
                    Lampa.Modal.close();
                    Lampa.Controller.toggle('settings_component');
                    Lampa.Controller.enable('menu');
                },
                onSelect: function (a) {
                    if (a.length > 0 && a[0] instanceof HTMLElement) {
                        var selectedColor = a[0].getAttribute('data-color');
                        
                        if (selectedColor === 'custom') {
                            Lampa.Modal.close();
                            var inputOptions = {
                                name: 'color_plugin_custom_hex',
                                value: Lampa.Storage.get('color_plugin_custom_hex', ''),
                                placeholder: '#FFFFFF'
                            };
                            Lampa.Input.edit(inputOptions, function (value) {
                                if (!value || !isValidHex(value)) {
                                    Lampa.Noty.show('Невірний формат HEX (наприклад: #353535)');
                                } else {
                                    ColorPlugin.settings.main_color = value;
                                    Lampa.Storage.set('color_plugin_custom_hex', value);
                                    applyStyles();
                                    updateCanvasFillStyle(window.draw_context);
                                    saveSettings();
                                    if (Lampa.Settings && Lampa.Settings.render) { Lampa.Settings.render(); }
                                }
                                Lampa.Controller.toggle('settings_component');
                                Lampa.Controller.enable('menu');
                            });
                            return;
                        }

                        ColorPlugin.settings.main_color = selectedColor;
                        applyStyles();
                        updateCanvasFillStyle(window.draw_context);
                        saveSettings();
                        Lampa.Modal.close();
                        Lampa.Controller.toggle('settings_component');
                        Lampa.Controller.enable('menu');
                        if (Lampa.Settings && Lampa.Settings.render) { Lampa.Settings.render(); }
                    }
                }
            });
        } catch (e) {}
    }

    function updateParamsVisibility() {
        var params = ['color_plugin_main_color', 'color_plugin_highlight_enabled', 'color_plugin_dimming_enabled'];
        params.forEach(function(paramName) {
            var element = document.querySelector('.settings-param[data-name="' + paramName + '"]');
            if (element) {
                element.style.display = ColorPlugin.settings.enabled ? 'block' : 'none';
            }
        });
    }

    function initPlugin() {
        setTimeout(function() {
            ColorPlugin.settings.main_color = Lampa.Storage.get('color_plugin_main_color', '#353535') || localStorage.getItem('color_plugin_main_color') || '#353535';
            ColorPlugin.settings.enabled = (Lampa.Storage.get('color_plugin_enabled', 'true') === 'true' || localStorage.getItem('color_plugin_enabled') === 'true');
            ColorPlugin.settings.highlight_enabled = (Lampa.Storage.get('color_plugin_highlight_enabled', 'true') === 'true' || localStorage.getItem('color_plugin_highlight_enabled') === 'true');
            ColorPlugin.settings.dimming_enabled = (Lampa.Storage.get('color_plugin_dimming_enabled', 'true') === 'true' || localStorage.getItem('color_plugin_dimming_enabled') === 'true');

            if (Lampa.SettingsApi) {
                Lampa.SettingsApi.addComponent({
                    component: 'color_plugin',
                    name: Lampa.Lang.translate('color_plugin'),
                    icon: '<svg width="24px" height="24px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="#ffffff"><path fill-rule="evenodd" clip-rule="evenodd" d="M8 1.003a7 7 0 0 0-7 7v.43c.09 1.51 1.91 1.79 3 .7a1.87 1.87 0 0 1 2.64 2.64c-1.1 1.16-.79 3.07.8 3.2h.6a7 7 0 1 0 0-14l-.04.03zm0 13h-.52a.58.58 0 0 1-.36-.14.56.56 0 0 1-.15-.3 1.24 1.24 0 0 1 .35-1.08 2.87 2.87 0 0 0 0-4 2.87 2.87 0 0 0-4.06 0 1 1 0 0 1-.9.34.41.41 0 0 1-.22-.12.42.42 0 0 1-.1-.29v-.37a6 6 0 1 1 6 6l-.04-.04zM9 3.997a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 7.007a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-7-5a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm7-1a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM13 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/></svg>'
                });

                // Увімкнення плагіна
                Lampa.SettingsApi.addParam({
                    component: 'color_plugin',
                    param: { name: 'color_plugin_enabled', type: 'trigger', default: ColorPlugin.settings.enabled.toString() },
                    field: { name: Lampa.Lang.translate('color_plugin_enabled'), description: Lampa.Lang.translate('color_plugin_enabled_description') },
                    onChange: function (value) {
                        ColorPlugin.settings.enabled = value === 'true';
                        saveSettings();
                        applyStyles();
                        updateParamsVisibility();
                        if (Lampa.Settings && Lampa.Settings.render) { Lampa.Settings.render(); }
                    }
                });

                // Вибір кольору (відкриває модальне вікно зі списком)
                Lampa.SettingsApi.addParam({
                    component: 'color_plugin',
                    param: { name: 'color_plugin_main_color', type: 'button' },
                    field: { name: Lampa.Lang.translate('main_color'), description: Lampa.Lang.translate('main_color_description') },
                    onRender: function (item) { if (item && typeof item.css === 'function') { item.css('display', ColorPlugin.settings.enabled ? 'block' : 'none'); } },
                    onChange: function () { openColorPicker(); }
                });

                // Показати рамку
                Lampa.SettingsApi.addParam({
                    component: 'color_plugin',
                    param: { name: 'color_plugin_highlight_enabled', type: 'trigger', default: ColorPlugin.settings.highlight_enabled.toString() },
                    field: { name: Lampa.Lang.translate('enable_highlight'), description: Lampa.Lang.translate('enable_highlight_description') },
                    onRender: function (item) { if (item && typeof item.css === 'function') { item.css('display', ColorPlugin.settings.enabled ? 'block' : 'none'); } },
                    onChange: function (value) {
                        ColorPlugin.settings.highlight_enabled = value === 'true';
                        saveSettings();
                        applyStyles();
                    }
                });

                // Застосувати колір затемнення
                Lampa.SettingsApi.addParam({
                    component: 'color_plugin',
                    param: { name: 'color_plugin_dimming_enabled', type: 'trigger', default: ColorPlugin.settings.dimming_enabled.toString() },
                    field: { name: Lampa.Lang.translate('enable_dimming'), description: Lampa.Lang.translate('enable_dimming_description') },
                    onRender: function (item) { if (item && typeof item.css === 'function') { item.css('display', ColorPlugin.settings.enabled ? 'block' : 'none'); } },
                    onChange: function (value) {
                        ColorPlugin.settings.dimming_enabled = value === 'true';
                        saveSettings();
                        applyStyles();
                    }
                });

                applyStyles();
                updatePluginIcon();
                updateParamsVisibility();
            }
        }, 100);
    }

    if (window.appready && Lampa.SettingsApi && Lampa.Storage) {
        initPlugin();
    } else {
        Lampa.Listener.follow('app', function (event) {
            if (event.type === 'ready' && Lampa.SettingsApi && Lampa.Storage) {
                initPlugin();
            }
        });
    }

    Lampa.Listener.follow('settings_component', function (event) {
        if (event.type === 'open') {
            updateParamsVisibility();
        }
    });

})();
