(function () {
    'use strict';

    if (window.banner_hero_plugin) return;
    window.banner_hero_plugin = true;

    var VERSION = '1.3.0';

    var SETTING = 'banner_hero_enabled';
    var SIZE_SETTING = 'interface_size';
    var FONT_SETTING = 'fontchanger_selected';

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
        font_nunito: 'Nunito (М\'який стиль)'
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

        '.banner-hero__rate{padding:.1em .5em;border-radius:6px;font-weight:800;background:#1db954;color:#fff}',

        '.banner-hero__descr{font-size:1.1em;line-height:1.45;color:#f5f5f1;opacity:.85;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}'
    ].join('\n');

    function injectStyle() {
        if (document.getElementById('banner-hero-style')) return;

        var style = document.createElement('style');
        style.id = 'banner-hero-style';
        style.textContent = CSS;

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
       НАЛАШТУВАННЯ
    ========================= */

    function isEnabled() {
        var val = Lampa.Storage.get(SETTING, true);

        return val === true || val === 'true';
    }

    /* =========================
       РОЗМІР ІНТЕРФЕЙСУ
    ========================= */

    function updateSize() {
        var isMobile =
            Lampa.Platform &&
            Lampa.Platform.screen &&
            Lampa.Platform.screen('mobile');

        var iSize = isMobile
            ? 10.1
            : parseFloat(
                Lampa.Storage.field(SIZE_SETTING)
            ) || 10.6;

        var currentSize =
            document.body.getAttribute(
                'data-banner-interface-size'
            );

        if (currentSize === String(iSize)) {
            return;
        }

        document.body.setAttribute(
            'data-banner-interface-size',
            String(iSize)
        );

        document.body.style.fontSize =
            iSize + 'px';

        var cardCount = 6;

        if (iSize <= 9.6) {
            cardCount = 8;
        } else if (iSize <= 11.1) {
            cardCount = 7;
        }

        patchMaker(cardCount);
    }

    function patchMaker(cardCount) {
        if (!Lampa.Maker || !Lampa.Maker.map) {
            return;
        }

        ['Line', 'Category'].forEach(
            function (type) {
                var mapItem =
                    Lampa.Maker.map(type);

                if (
                    !mapItem ||
                    !mapItem.Items ||
                    !mapItem.Items.onInit
                ) {
                    return;
                }

                if (
                    mapItem.Items
                        .__bannerHeroPatched
                ) {
                    mapItem.Items
                        .__bannerHeroCardCount =
                        cardCount;

                    return;
                }

                var original =
                    mapItem.Items.onInit;

                mapItem.Items.onInit =
                    function () {
                        original.call(this);

                        var count =
                            mapItem.Items
                                .__bannerHeroCardCount ||
                            cardCount;

                        if (type === 'Line') {
                            this.view = count;
                        } else {
                            this.limit_view =
                                count;
                        }
                    };

                mapItem.Items
                    .__bannerHeroPatched = true;

                mapItem.Items
                    .__bannerHeroCardCount =
                    cardCount;
            }
        );
    }

    /* =========================
       LOGO (w500)
    ========================= */

    function loadLogo(data, done) {
        if (!data || !data.id) {
            done('');
            return;
        }

        if (
            data.source &&
            data.source !== 'tmdb'
        ) {
            done('');
            return;
        }

        var type =
            data.name && !data.title
                ? 'tv'
                : 'movie';

        var key =
            type + '_' + data.id;

        if (
            Object.prototype.hasOwnProperty.call(
                logos,
                key
            )
        ) {
            done(logos[key]);
            return;
        }

        if (
            !Lampa.TMDB ||
            !Lampa.TMDB.api ||
            !Lampa.TMDB.key
        ) {
            logos[key] = '';
            done('');
            return;
        }

        var url =
            Lampa.TMDB.api(
                type +
                '/' +
                data.id +
                '/images?api_key=' +
                Lampa.TMDB.key() +
                '&include_image_language=uk,en,null'
            );

        var network =
            new Lampa.Reguest();

        network.silent(
            url,

            function (json) {
                var list =
                    json &&
                    Array.isArray(json.logos)
                        ? json.logos
                        : [];

                var pick = null;

                ['uk', 'en', null].some(
                    function (lang) {
                        for (
                            var i = 0;
                            i < list.length;
                            i++
                        ) {
                            if (
                                list[i]
                                    .iso_639_1 ===
                                lang
                            ) {
                                pick = list[i];
                                return true;
                            }
                        }

                        return false;
                    }
                );

                pick =
                    pick ||
                    list[0];

                if (
                    pick &&
                    pick.file_path
                ) {
                    var path =
                        pick.file_path
                            .replace(
                                '.svg',
                                '.png'
                            );

                    logos[key] =
                        Lampa.TMDB.image(
                            't/p/w500' +
                            path
                        );
                } else {
                    logos[key] = '';
                }

                done(logos[key]);
            },

            function () {
                logos[key] = '';
                done('');
            }
        );
    }

    /* =========================
       BACKDROP
    ========================= */

    function loadBackdrop(
        data,
        done
    ) {
        if (
            !data ||
            !data.id ||
            !data.backdrop_path
        ) {
            done('');
            return;
        }

        var key =
            String(data.id);

        if (
            Object.prototype.hasOwnProperty.call(
                backdrops,
                key
            )
        ) {
            done(backdrops[key]);
            return;
        }

        var src =
            Lampa.Api.img(
                data.backdrop_path,
                'w1280'
            );

        var img =
            new Image();

        img.onload =
            function () {
                backdrops[key] =
                    src;

                done(src);
            };

        img.onerror =
            function () {
                backdrops[key] =
                    '';

                done('');
            };

        img.src = src;
    }

    /* =========================
       HERO
    ========================= */

    function heroFor(activity) {
        if (!activity) {
            return null;
        }

        if (
            activity.__bannerHero &&
            activity.__bannerHero.parentNode ===
                activity
        ) {
            return activity.__bannerHero;
        }

        var hero =
            activity.querySelector(
                '.banner-hero'
            );

        if (hero) {
            cacheHeroElements(hero);

            activity.__bannerHero =
                hero;

            activity.classList.add(
                'banner-host'
            );

            return hero;
        }

        hero =
            document.createElement(
                'div'
            );

        hero.className =
            'banner-hero';

        hero.innerHTML =
            '<div class="banner-hero__bg"></div>' +
            '<div class="banner-hero__info">' +
                '<img class="banner-hero__logo" />' +
                '<div class="banner-hero__title"></div>' +
                '<div class="banner-hero__meta"></div>' +
                '<div class="banner-hero__descr"></div>' +
            '</div>';

        activity.insertBefore(
            hero,
            activity.firstChild
        );

        activity.classList.add(
            'banner-host'
        );

        cacheHeroElements(hero);

        activity.__bannerHero =
            hero;

        return hero;
    }

    function cacheHeroElements(
        hero
    ) {
        if (
            hero.__bannerElements
        ) {
            return;
        }

        hero.__bannerElements = {
            bg:
                hero.querySelector(
                    '.banner-hero__bg'
                ),

            logo:
                hero.querySelector(
                    '.banner-hero__logo'
                ),

            title:
                hero.querySelector(
                    '.banner-hero__title'
                ),

            meta:
                hero.querySelector(
                    '.banner-hero__meta'
                ),

            descr:
                hero.querySelector(
                    '.banner-hero__descr'
                )
        };
    }

    /* =========================
       ПОКАЗ БАНЕРА
    ========================= */

    function showHero(
        hero,
        data
    ) {
        if (
            !hero ||
            !data
        ) {
            return;
        }

        var id =
            data.id;

        if (
            hero.bannerId === id &&
            hero.bannerData
        ) {
            return;
        }

        cacheHeroElements(hero);

        var el =
            hero.__bannerElements;

        hero.bannerId =
            id;

        hero.bannerData =
            data;

        var title =
            data.title ||
            data.name ||
            '';

        el.title.textContent =
            title;

        el.title.style.display =
            '';

        el.logo.style.display =
            'none';

        var meta = [];

        var vote =
            parseFloat(
                data.vote_average
            );

        if (vote) {
            meta.push(
                '<span class="banner-hero__rate">' +
                vote.toFixed(1) +
                '</span>'
            );
        }

        var year =
            (
                data.release_date ||
                data.first_air_date ||
                ''
            ) + '';

        year =
            year.slice(0, 4);

        if (year) {
            meta.push(
                '<span>' +
                year +
                '</span>'
            );
        }

        meta.push(
            '<span>' +
            (
                data.name &&
                !data.title
                    ? 'Серіал'
                    : 'Фільм'
            ) +
            '</span>'
        );

        el.meta.innerHTML =
            meta.join('');

        el.descr.textContent =
            data.overview ||
            '';

        el.bg.classList.remove(
            'show'
        );

        loadBackdrop(
            data,
            function (src) {
                if (
                    hero.bannerId !== id ||
                    !src
                ) {
                    return;
                }

                el.bg.style.backgroundImage =
                    'url("' +
                    src +
                    '")';

                requestAnimationFrame(
                    function () {
                        if (
                            hero.bannerId ===
                            id
                        ) {
                            el.bg.classList.add(
                                'show'
                            );
                        }
                    }
                );
            }
        );

        loadLogo(
            data,
            function (src) {
                if (
                    hero.bannerId !== id ||
                    !src
                ) {
                    return;
                }

                el.logo.onload =
                    function () {
                        if (
                            hero.bannerId !==
                            id
                        ) {
                            return;
                        }

                        el.logo.style.display =
                            'block';

                        el.title.style.display =
                            'none';
                    };

                el.logo.src =
                    src;
            }
        );
    }

    /* =========================
       FOCUS
    ========================= */

    function onCardFocus(e) {
        if (!isEnabled()) {
            return;
        }

        var card =
            e.target;

        if (
            !card ||
            !card.classList ||
            !card.classList.contains(
                'card'
            ) ||
            !card.card_data
        ) {
            return;
        }

        var data =
            card.card_data;

        if (!data.id) {
            return;
        }

        if (
            lastCardId ===
            data.id
        ) {
            return;
        }

        var activity =
            card.closest
                ? card.closest(
                    '.activity'
                )
                : null;

        if (
            !activity ||
            !activity.classList.contains(
                'banner-host'
            )
        ) {
            return;
        }

        clearTimeout(
            focusTimer
        );

        focusTimer =
            setTimeout(
                function () {
                    lastCardId =
                        data.id;

                    lastActivity =
                        activity;

                    var hero =
                        activity.__bannerHero ||
                        heroFor(
                            activity
                        );

                    lastHero =
                        hero;

                    showHero(
                        hero,
                        data
                    );
                },
                220
            );
    }

    /* =========================
       ACTIVITY
    ========================= */

    function attach(
        object
    ) {
        if (
            !isEnabled() ||
            !object ||
            ['main', 'category']
                .indexOf(
                    object.component
                ) < 0
        ) {
            return;
        }

        var render =
            object.activity &&
            object.activity.render &&
            object.activity.render(
                true
            );

        var el =
            render &&
            render.jquery
                ? render[0]
                : render;

        if (
            el &&
            el.classList
        ) {
            heroFor(el);
        }
    }

    /* =========================
       APPLY
    ========================= */

    function apply() {
        var on =
            isEnabled();

        document.body.classList.toggle(
            'banner-enabled',
            on
        );

        if (!on) {
            clearTimeout(
                focusTimer
            );

            lastCardId =
                null;

            lastActivity =
                null;

            lastHero =
                null;
        }
    }

    /* =========================
       INIT
    ========================= */

    function init() {
        if (
            window.Lampa &&
            Lampa.Lang
        ) {
            Lampa.Lang.add(
                lang_data
            );
        }

        /* =====================
           PARAMS
        ===================== */

        if (Lampa.Params) {
            if (
                !Lampa.Params.values
            ) {
                Lampa.Params.values =
                    {};
            }

            Lampa.Params.values[
                SIZE_SETTING
            ] = {
                '09.1':
                    lang_data
                        .settings_param_interface_size_mini,

                '09.6':
                    lang_data
                        .settings_param_interface_size_very_small,

                '10.1':
                    lang_data
                        .settings_param_interface_size_small,

                '10.6':
                    lang_data
                        .settings_param_interface_size_medium
            };

            if (
                Lampa.Params.select
            ) {
                Lampa.Params.select(
                    SIZE_SETTING,
                    Lampa.Params.values[
                        SIZE_SETTING
                    ],
                    '10.6'
                );
            }
        }

        injectStyle();
        apply();
        updateSize();

        var savedFont = Lampa.Storage.get(FONT_SETTING, 'default');
        applyFont(savedFont);

        /* =====================
           FOCUS LISTENER
        ===================== */

        document.addEventListener(
            'hover:focus',
            onCardFocus,
            true
        );

        /* =====================
           ACTIVITY
        ===================== */

        Lampa.Listener.follow(
            'activity',
            function (e) {
                if (
                    e.type ===
                    'start'
                ) {
                    requestAnimationFrame(
                        function () {
                            attach(
                                e.object
                            );
                        }
                    );
                }
            }
        );

        if (
            Lampa.Activity &&
            Lampa.Activity.active
        ) {
            requestAnimationFrame(
                function () {
                    attach(
                        Lampa.Activity.active()
                    );
                }
            );
        }

        /* =====================
           SETTINGS API
        ===================== */

        if (
            Lampa.SettingsApi
        ) {
            Lampa.SettingsApi.addComponent({
                component:
                    'interface_plus_settings',

                name:
                    lang_data
                        .banner_settings_name,

                icon:
                    '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">' +
                    '<path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM7 10h2v7H7zm4-3h2v10h-2zm4 5h2v5h-2z"/>' +
                    '</svg>'
            });

            Lampa.SettingsApi.addParam({
                component:
                    'interface_plus_settings',

                param: {
                    name:
                        SETTING,

                    type:
                        'trigger',

                    default:
                        true
                },

                field: {
                    name:
                        lang_data
                            .banner_enable_name,

                    description:
                        lang_data
                            .banner_enable_descr
                },

                onChange:
                    apply
            });

            Lampa.SettingsApi.addParam({
                component:
                    'interface_plus_settings',

                param: {
                    name:
                        SIZE_SETTING,

                    type:
                        'select',

                    values:
                        Lampa.Params.values[
                            SIZE_SETTING
                        ],

                    default:
                        '10.6'
                },

                field: {
                    name:
                        'Розмір інтерфейсу',

                    description:
                        'Виберіть бажаний масштаб елементів інтерфейсу'
                },

                onChange:
                    updateSize
            });

            var fontValues = {
                default: lang_data.font_default,
                netflix: lang_data.font_netflix,
                montserrat: lang_data.font_montserrat,
                inter: lang_data.font_inter,
                nunito: lang_data.font_nunito
            };

            Lampa.SettingsApi.addParam({
                component:
                    'interface_plus_settings',
                param: {
                    name: FONT_SETTING,
                    type: 'select',
                    values: fontValues,
                    default: 'default'
                },
                field: {
                    name: lang_data.font_setting_name,
                    description: lang_data.font_setting_descr
                },
                onChange: function (value) {
                    applyFont(value);
                }
            });
        }
    }

    /* =========================
       START
    ========================= */

    if (window.appready) {
        setTimeout(
            init,
            500
        );
    } else {
        Lampa.Listener.follow(
            'app',
            function (e) {
                if (
                    e.type ===
                    'ready'
                ) {
                    setTimeout(
                        init,
                        500
                    );
                }
            }
        );
    }

    /* =========================
       STORAGE
    ========================= */

    if (
        window.Lampa &&
        Lampa.Storage &&
        Lampa.Storage.listener
    ) {
        Lampa.Storage.listener.follow(
            'change',
            function (e) {
                if (
                    e.name ===
                    SIZE_SETTING
                ) {
                    updateSize();
                }

                if (
                    e.name ===
                    SETTING
                ) {
                    apply();
                }

                if (
                    e.name ===
                    FONT_SETTING
                ) {
                    applyFont(e.value);
                }
            }
        );
    }

})();
