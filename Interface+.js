(function () {
    'use strict';

    if (window.banner_hero_plugin) return;
    window.banner_hero_plugin = true;

    var VERSION = '1.4.0';

    var SETTING = 'banner_hero_enabled';
    var SIZE_SETTING = 'interface_size';
    var FONT_SETTING = 'fontchanger_selected';
    var COLOR_SETTING = 'interface_plus_main_color';
    var HIGHLIGHT_SETTING = 'interface_plus_highlight';
    var DIMMING_SETTING = 'interface_plus_dimming';

    /* =========================
       КЕШ
    ========================= */

    var logos = Object.create(null);
    var backdrops = Object.create(null);

    var focusTimer = null;
    var lastCardId = null;
    var lastActivity = null;
    var lastHero = null;

    /* =========================
       ЛОКАЛІЗАЦІЯ
    ========================= */

    var lang_data = {
        banner_settings_name: 'Інтерфейс +',
        banner_enable_name: 'Динамічні банери',
        banner_enable_descr: 'Показувати великий банер з фоном і логотипом над рядами карток',

        settings_param_interface_size_mini: 'Міні інтерфейс',
        settings_param_interface_size_very_small: 'Дуже малий інтерфейс',
        settings_param_interface_size_small: 'Малий інтерфейс',
        settings_param_interface_size_medium: 'Середній інтерфейс',

        font_setting_name: 'Шрифт інтерфейсу',
        font_setting_descr: 'Виберіть стиль шрифту для всього інтерфейсу',
        font_default: 'За замовчуванням (Roboto)',
        font_netflix: 'Netflix Sans',
        font_montserrat: 'Montserrat',
        font_inter: 'Inter (Сучасний UI)',
        font_nunito: 'Nunito (М\'який стиль)',

        main_color: 'Колір виділення',
        main_color_descr: 'Виберіть акцентний колір для інтерфейсу',
        enable_highlight: 'Показати білу рамку фокусу',
        enable_highlight_descr: 'Вмикає додаткову білу рамку навколо виділених елементів',
        enable_dimming: 'Колір затемнення елементів',
        enable_dimming_descr: 'Змінює колір фону додаткових елементів під обраний колір',

        default_color: 'Стандартний (Lampa)',
        classic_blue: 'Класичний синій',
        sky_blue: 'Небесно-блакитний',
        vibrant_green: 'Насичений зелений',
        emerald: 'Смарагдовий',
        amber: 'Бурштиновий / Оранжевий',
        cinematic_red: 'Червоний (Кінотеатральний)',
        purple: 'Пурпуровий',
        violet: 'Фіолетовий',
        warm_yellow: 'Теплий жовтий',
        zinc_gray: 'Строгий сірий (Zinc)'
    };

    /* =========================
       ПАЛІТРА КОЛЬОРІВ
    ========================= */

    var colors = {
        '#353535': lang_data.default_color,
        '#2b7fff': lang_data.classic_blue,
        '#00a6f4': lang_data.sky_blue,
        '#00c950': lang_data.vibrant_green,
        '#00bc7d': lang_data.emerald,
        '#fe9a00': lang_data.amber,
        '#fb2c36': lang_data.cinematic_red,
        '#ad46ff': lang_data.purple,
        '#8e51ff': lang_data.violet,
        '#f0b100': lang_data.warm_yellow,
        '#71717b': lang_data.zinc_gray
    };

    /* =========================
       КОНФІГУРАЦІЯ ШРИФТІВ
    ========================= */

    var fonts = {
        default: {
            family: 'Roboto, Arial, sans-serif',
            url: null
        },
        netflix: {
            family: '"Netflix Sans", Arial, sans-serif',
            url: 'https://assets.nflxext.com/ffe/siteui/fonts/netflix-sans/v3/NetflixSans_W_Rg.woff2'
        },
        montserrat: {
            family: '"Montserrat", sans-serif',
            url: 'https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&display=swap'
        },
        inter: {
            family: '"Inter", sans-serif',
            url: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap'
        },
        nunito: {
            family: '"Nunito", sans-serif',
            url: 'https://fonts.googleapis.com/css2?family=Nunito:wght@300;400;600;700&display=swap'
        }
    };

    /* =========================
       CSS
    ========================= */

    var CSS = [
        '.banner-host{position:relative}',
        '.banner-host .activity__body{padding-top:42vh;box-sizing:border-box}',
        '.banner-hero{position:absolute;left:0;right:0;top:0;height:50vh;overflow:hidden;pointer-events:none;z-index:0;-webkit-mask-image:linear-gradient(180deg,#000 55%,transparent 100%);mask-image:linear-gradient(180deg,#000 55%,transparent 100%)}',
        '.banner-hero__bg{position:absolute;inset:0;background-size:cover;background-position:center 20%;background-repeat:no-repeat;opacity:0;transition:opacity .35s ease;will-change:opacity}',
        '.banner-hero__bg.show{opacity:1}',
        '.banner-hero::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(0,0,0,.85) 0%,rgba(0,0,0,.6) 35%,rgba(0,0,0,0) 70%);pointer-events:none}',
        '.banner-hero__info{position:absolute;left:3em;bottom:5.5em;width:46%;z-index:1}',
        '.banner-hero__logo{max-width:100%;max-height:7em;display:none;margin-bottom:.6em;filter:drop-shadow(0 4px 12px rgba(0,0,0,.6))}',
        '.banner-hero__title{font-size:2.8em;font-weight:900;line-height:1.05;color:#f5f5f1;margin-bottom:.35em;text-shadow:0 3px 14px rgba(0,0,0,.7)}',
        '.banner-hero__meta{font-size:1.15em;color:#f5f5f1;margin-bottom:.6em;display:flex;gap:.8em;align-items:center;flex-wrap:wrap}',
        '.banner-hero__rate{padding:.1em .5em;border-radius:6px;font-weight:800;background:var(--main-color, #1db954);color:#fff}',
        '.banner-hero__descr{font-size:1.1em;line-height:1.45;color:#f5f5f1;opacity:.85;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}'
    ].join('\n');

    function injectStyle() {
        if (document.getElementById('banner-hero-style')) return;

        var style = document.createElement('style');
        style.id = 'banner-hero-style';
        style.textContent = CSS;

        document.head.appendChild(style);
    }

    function hexToRgb(hex) {
        if (!hex || hex === 'default') hex = '#353535';
        var cleanHex = hex.replace('#', '');
        var r = parseInt(cleanHex.substring(0, 2), 16);
        var g = parseInt(cleanHex.substring(2, 4), 16);
        var b = parseInt(cleanHex.substring(4, 6), 16);
        return r + ', ' + g + ', ' + b;
    }

    /* =========================
       ЗАСТОСУВАННЯ КОЛЬОРІВ ТА СТИЛІВ UI
    ========================= */

    function applyColors() {
        var mainColor = Lampa.Storage.get(COLOR_SETTING, '#353535');
        var highlightEnabled = Lampa.Storage.get(HIGHLIGHT_SETTING, true);
        var dimmingEnabled = Lampa.Storage.get(DIMMING_SETTING, true);

        var rgbColor = hexToRgb(mainColor);
        var focusBorderColor = mainColor === '#353535' ? '#ffffff' : 'var(--main-color)';
        
        var highlightStyles = highlightEnabled ? (
            '-webkit-box-shadow: inset 0 0 0 0.15em #fff !important;' +
            'box-shadow: inset 0 0 0 0.15em #fff !important;'
        ) : '';

        var dimmingStyles = dimmingEnabled ? (
            '.full-start__rate { background: rgba(var(--main-color-rgb), 0.15) !important; }' +
            '.reaction { background-color: rgba(var(--main-color-rgb), 0.3) !important; }' +
            '.full-start__button { background-color: rgba(var(--main-color-rgb), 0.3) !important; }' +
            '.card__vote { background: rgba(var(--main-color-rgb), 0.5) !important; }' +
            '.items-line__more { background: rgba(var(--main-color-rgb), 0.3) !important; }'
        ) : '';

        var oldStyle = document.getElementById('interface-plus-color-style');
        if (oldStyle) oldStyle.remove();

        var style = document.createElement('style');
        style.id = 'interface-plus-color-style';
        style.textContent = [
            ':root {' +
            '--main-color: ' + mainColor + ' !important;' +
            '--main-color-rgb: ' + rgbColor + ' !important;' +
            '}',
            '.console__tab.focus, .menu__item.focus, .menu__item.traverse, .menu__item:hover, .full-person.focus, .full-start__button.focus, .full-descr__tag.focus, .simple-button.focus, .head__action.focus, .head__action:hover, .player-panel .button.focus, .search-source.active, .timetable__item.focus::before, .navigation-tabs__button.focus, .broadcast__device.focus, .iptv-menu__list-item.focus, .iptv-program__timeline>div, .radio-item.focus, .lang__selector-item.focus, .simple-keyboard .hg-button.focus, .modal__button.focus, .search-history-key.focus, .simple-keyboard-mic.focus, .full-review-add.focus, .full-review.focus, .tag-count.focus, .settings-folder.focus, .settings-param.focus, .selectbox-item.focus, .selectbox-item:hover, .noty, .radio-player.focus { background: var(--main-color) !important; color: #fff !important; ' + highlightStyles + ' }',
            '.color_square.focus, .hex-input.focus { border: 0.3em solid ' + focusBorderColor + ' !important; transform: scale(1.08) !important; }',
            dimmingStyles
        ].join('\n');

        document.head.appendChild(style);
    }

    /* =========================
       ЗАСТОСУВАННЯ ШРИФТУ
    ========================= */

    function applyFont(fontKey) {
        var font = fonts[fontKey] || fonts.default;

        var oldStyle = document.getElementById('interface-plus-font-style');
        if (oldStyle) oldStyle.remove();

        var oldFontFace = document.getElementById('interface-plus-fontface');
        if (oldFontFace) oldFontFace.remove();

        if (font.url) {
            var fontFaceStyle = document.createElement('style');
            fontFaceStyle.id = 'interface-plus-fontface';

            if (font.url.includes('googleapis.com')) {
                fontFaceStyle.textContent = '@import url("' + font.url + '");';
            } else {
                var fontName = font.family.split(',')[0].replace(/"/g, '');
                fontFaceStyle.textContent = '@font-face { font-family: ' + fontName + '; src: url("' + font.url + '") format("woff2"); font-weight: 400; font-style: normal; }';
            }

            document.head.appendChild(fontFaceStyle);
        }

        var style = document.createElement('style');
        style.id = 'interface-plus-font-style';
        style.textContent = `
            body, .body, * {
                font-family: ${font.family} !important;
            }
            .full-start__title,
            .full-start__tagline,
            .card__title,
            .card__view,
            .menu__item,
            .settings__title,
            .settings__label,
            .button,
            .selector,
            .filter__item,
            .scroll__title {
                font-family: ${font.family} !important;
            }
        `;

        document.head.appendChild(style);
    }

    /* =========================
       НАЛАШТУВАННЯ ТА РОЗМІР
    ========================= */

    function isEnabled() {
        var val = Lampa.Storage.get(SETTING, true);
        return val === true || val === 'true';
    }

    function updateSize() {
        var isMobile = Lampa.Platform && Lampa.Platform.screen && Lampa.Platform.screen('mobile');
        var iSize = isMobile ? 10.1 : parseFloat(Lampa.Storage.field(SIZE_SETTING)) || 10.6;
        var currentSize = document.body.getAttribute('data-banner-interface-size');

        if (currentSize === String(iSize)) return;

        document.body.setAttribute('data-banner-interface-size', String(iSize));
        document.body.style.fontSize = iSize + 'px';

        var cardCount = 6;
        if (iSize <= 9.6) {
            cardCount = 8;
        } else if (iSize <= 11.1) {
            cardCount = 7;
        }

        patchMaker(cardCount);
    }

    function patchMaker(cardCount) {
        if (!Lampa.Maker || !Lampa.Maker.map) return;

        ['Line', 'Category'].forEach(function (type) {
            var mapItem = Lampa.Maker.map(type);
            if (!mapItem || !mapItem.Items || !mapItem.Items.onInit) return;

            if (mapItem.Items.__bannerHeroPatched) {
                mapItem.Items.__bannerHeroCardCount = cardCount;
                return;
            }

            var original = mapItem.Items.onInit;
            mapItem.Items.onInit = function () {
                original.call(this);
                var count = mapItem.Items.__bannerHeroCardCount || cardCount;
                if (type === 'Line') {
                    this.view = count;
                } else {
                    this.limit_view = count;
                }
            };

            mapItem.Items.__bannerHeroPatched = true;
            mapItem.Items.__bannerHeroCardCount = cardCount;
        });
    }

    /* =========================
       TMDB ЛОГО ТА ФОНИ
    ========================= */

    function loadLogo(data, done) {
        if (!data || !data.id || (data.source && data.source !== 'tmdb')) {
            done('');
            return;
        }

        var type = data.name && !data.title ? 'tv' : 'movie';
        var key = type + '_' + data.id;

        if (Object.prototype.hasOwnProperty.call(logos, key)) {
            done(logos[key]);
            return;
        }

        if (!Lampa.TMDB || !Lampa.TMDB.api || !Lampa.TMDB.key) {
            logos[key] = '';
            done('');
            return;
        }

        var url = Lampa.TMDB.api(type + '/' + data.id + '/images?api_key=' + Lampa.TMDB.key() + '&include_image_language=uk,en,null');
        var network = new Lampa.Reguest();

        network.silent(url, function (json) {
            var list = json && Array.isArray(json.logos) ? json.logos : [];
            var pick = null;

            ['uk', 'en', null].some(function (lang) {
                for (var i = 0; i < list.length; i++) {
                    if (list[i].iso_639_1 === lang) {
                        pick = list[i];
                        return true;
                    }
                }
                return false;
            });

            pick = pick || list[0];

            if (pick && pick.file_path) {
                var path = pick.file_path.replace('.svg', '.png');
                logos[key] = Lampa.TMDB.image('t/p/w500' + path);
            } else {
                logos[key] = '';
            }

            done(logos[key]);
        }, function () {
            logos[key] = '';
            done('');
        });
    }

    function loadBackdrop(data, done) {
        if (!data || !data.id || !data.backdrop_path) {
            done('');
            return;
        }

        var key = String(data.id);
        if (Object.prototype.hasOwnProperty.call(backdrops, key)) {
            done(backdrops[key]);
            return;
        }

        var src = Lampa.Api.img(data.backdrop_path, 'w1280');
        var img = new Image();

        img.onload = function () {
            backdrops[key] = src;
            done(src);
        };
        img.onerror = function () {
            backdrops[key] = '';
            done('');
        };
        img.src = src;
    }

    /* =========================
       HERO БАНЕР
    ========================= */

    function heroFor(activity) {
        if (!activity) return null;

        if (activity.__bannerHero && activity.__bannerHero.parentNode === activity) {
            return activity.__bannerHero;
        }

        var hero = activity.querySelector('.banner-hero');
        if (hero) {
            cacheHeroElements(hero);
            activity.__bannerHero = hero;
            activity.classList.add('banner-host');
            return hero;
        }

        hero = document.createElement('div');
        hero.className = 'banner-hero';
        hero.innerHTML =
            '<div class="banner-hero__bg"></div>' +
            '<div class="banner-hero__info">' +
                '<img class="banner-hero__logo" />' +
                '<div class="banner-hero__title"></div>' +
                '<div class="banner-hero__meta"></div>' +
                '<div class="banner-hero__descr"></div>' +
            '</div>';

        activity.insertBefore(hero, activity.firstChild);
        activity.classList.add('banner-host');

        cacheHeroElements(hero);
        activity.__bannerHero = hero;
        return hero;
    }

    function cacheHeroElements(hero) {
        if (hero.__bannerElements) return;

        hero.__bannerElements = {
            bg: hero.querySelector('.banner-hero__bg'),
            logo: hero.querySelector('.banner-hero__logo'),
            title: hero.querySelector('.banner-hero__title'),
            meta: hero.querySelector('.banner-hero__meta'),
            descr: hero.querySelector('.banner-hero__descr')
        };
    }

    function showHero(hero, data) {
        if (!hero || !data) return;

        var id = data.id;
        if (hero.bannerId === id && hero.bannerData) return;

        cacheHeroElements(hero);
        var el = hero.__bannerElements;

        hero.bannerId = id;
        hero.bannerData = data;

        el.title.textContent = data.title || data.name || '';
        el.title.style.display = '';
        el.logo.style.display = 'none';

        var meta = [];
        var vote = parseFloat(data.vote_average);
        if (vote) {
            meta.push('<span class="banner-hero__rate">' + vote.toFixed(1) + '</span>');
        }

        var year = ((data.release_date || data.first_air_date || '') + '').slice(0, 4);
        if (year) {
            meta.push('<span>' + year + '</span>');
        }

        meta.push('<span>' + (data.name && !data.title ? 'Серіал' : 'Фільм') + '</span>');
        el.meta.innerHTML = meta.join('');
        el.descr.textContent = data.overview || '';
        el.bg.classList.remove('show');

        loadBackdrop(data, function (src) {
            if (hero.bannerId !== id || !src) return;
            el.bg.style.backgroundImage = 'url("' + src + '")';
            requestAnimationFrame(function () {
                if (hero.bannerId === id) el.bg.classList.add('show');
            });
        });

        loadLogo(data, function (src) {
            if (hero.bannerId !== id || !src) return;
            el.logo.onload = function () {
                if (hero.bannerId !== id) return;
                el.logo.style.display = 'block';
                el.title.style.display = 'none';
            };
            el.logo.src = src;
        });
    }

    function onCardFocus(e) {
        if (!isEnabled()) return;

        var card = e.target;
        if (!card || !card.classList || !card.classList.contains('card') || !card.card_data) return;

        var data = card.card_data;
        if (!data.id || lastCardId === data.id) return;

        var activity = card.closest ? card.closest('.activity') : null;
        if (!activity || !activity.classList.contains('banner-host')) return;

        clearTimeout(focusTimer);
        focusTimer = setTimeout(function () {
            lastCardId = data.id;
            lastActivity = activity;
            var hero = activity.__bannerHero || heroFor(activity);
            lastHero = hero;
            showHero(hero, data);
        }, 220);
    }

    function attach(object) {
        if (!isEnabled() || !object || ['main', 'category'].indexOf(object.component) < 0) return;

        var render = object.activity && object.activity.render && object.activity.render(true);
        var el = render && render.jquery ? render[0] : render;

        if (el && el.classList) heroFor(el);
    }

    function apply() {
        var on = isEnabled();
        document.body.classList.toggle('banner-enabled', on);

        if (!on) {
            clearTimeout(focusTimer);
            lastCardId = null;
            lastActivity = null;
            lastHero = null;
        }
    }

    /* =========================
       ІНІЦІАЛІЗАЦІЯ
    ========================= */

    function init() {
        if (window.Lampa && Lampa.Lang) {
            Lampa.Lang.add(lang_data);
        }

        if (Lampa.Params) {
            if (!Lampa.Params.values) Lampa.Params.values = {};
            Lampa.Params.values[SIZE_SETTING] = {
                '09.1': lang_data.settings_param_interface_size_mini,
                '09.6': lang_data.settings_param_interface_size_very_small,
                '10.1': lang_data.settings_param_interface_size_small,
                '10.6': lang_data.settings_param_interface_size_medium
            };

            if (Lampa.Params.select) {
                Lampa.Params.select(SIZE_SETTING, Lampa.Params.values[SIZE_SETTING], '10.6');
            }
        }

        injectStyle();
        apply();
        updateSize();

        var savedFont = Lampa.Storage.get(FONT_SETTING, 'default');
        applyFont(savedFont);
        applyColors();

        document.addEventListener('hover:focus', onCardFocus, true);

        Lampa.Listener.follow('activity', function (e) {
            if (e.type === 'start') {
                requestAnimationFrame(function () {
                    attach(e.object);
                });
            }
        });

        if (Lampa.Activity && Lampa.Activity.active) {
            requestAnimationFrame(function () {
                attach(Lampa.Activity.active());
            });
        }

        /* =========================
           SETTINGS API
        ========================= */

        if (Lampa.SettingsApi) {
            Lampa.SettingsApi.addComponent({
                component: 'interface_plus_settings',
                name: lang_data.banner_settings_name,
                icon: '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM7 10h2v7H7zm4-3h2v10h-2zm4 5h2v5h-2z"/></svg>'
            });

            Lampa.SettingsApi.addParam({
                component: 'interface_plus_settings',
                param: { name: SETTING, type: 'trigger', default: true },
                field: { name: lang_data.banner_enable_name, description: lang_data.banner_enable_descr },
                onChange: apply
            });

            Lampa.SettingsApi.addParam({
                component: 'interface_plus_settings',
                param: { name: SIZE_SETTING, type: 'select', values: Lampa.Params.values[SIZE_SETTING], default: '10.6' },
                field: { name: 'Розмір інтерфейсу', description: 'Виберіть бажаний масштаб елементів інтерфейсу' },
                onChange: updateSize
            });

            var fontValues = {
                default: lang_data.font_default,
                netflix: lang_data.font_netflix,
                montserrat: lang_data.font_montserrat,
                inter: lang_data.font_inter,
                nunito: lang_data.font_nunito
            };

            Lampa.SettingsApi.addParam({
                component: 'interface_plus_settings',
                param: { name: FONT_SETTING, type: 'select', values: fontValues, default: 'default' },
                field: { name: lang_data.font_setting_name, description: lang_data.font_setting_descr },
                onChange: function (value) { applyFont(value); }
            });

            // Налаштування вибору кольору
            Lampa.SettingsApi.addParam({
                component: 'interface_plus_settings',
                param: { name: COLOR_SETTING, type: 'select', values: colors, default: '#353535' },
                field: { name: lang_data.main_color, description: lang_data.main_color_descr },
                onChange: function () { applyColors(); }
            });

            Lampa.SettingsApi.addParam({
                component: 'interface_plus_settings',
                param: { name: HIGHLIGHT_SETTING, type: 'trigger', default: true },
                field: { name: lang_data.enable_highlight, description: lang_data.enable_highlight_descr },
                onChange: function () { applyColors(); }
            });

            Lampa.SettingsApi.addParam({
                component: 'interface_plus_settings',
                param: { name: DIMMING_SETTING, type: 'trigger', default: true },
                field: { name: lang_data.enable_dimming, description: lang_data.enable_dimming_descr },
                onChange: function () { applyColors(); }
            });
        }
    }

    if (window.appready) {
        setTimeout(init, 500);
    } else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') {
                setTimeout(init, 500);
            }
        });
    }

    if (window.Lampa && Lampa.Storage && Lampa.Storage.listener) {
        Lampa.Storage.listener.follow('change', function (e) {
            if (e.name === SIZE_SETTING) updateSize();
            if (e.name === SETTING) apply();
            if (e.name === FONT_SETTING) applyFont(e.value);
            if (e.name === COLOR_SETTING || e.name === HIGHLIGHT_SETTING || e.name === DIMMING_SETTING) applyColors();
        });
    }

})();
