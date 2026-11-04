
(function () {
    'use strict';

    /*
     * INTERFACE+ 1.6.3 — KINOTRAYLERY LOGO ENGINE
     * TMDB ONLY
     *
     * 1.6.3 CHANGES:
     * - Completely replaced previous logo engine
     * - Logo loading algorithm from КіноТрейлери 2.3
     * - TMDB images endpoint through Lampa API
     * - Language priority: Lampa language -> English -> null -> first logo
     * - Fixed logo resolution: w500
     * - Per-item cache with shared pending requests
     * - 20-second request timeout
     * - Prefetch logos for up to 10 upcoming cards
     * - Same logo engine for Hero and full movie card
     * - Preserved cinematic backdrop and all interface settings
     */

    var VERSION = '1.6.3';
    var READY_KEY = 'interface_plus_tmdb_only_163';

    if (window[READY_KEY]) return;
    window[READY_KEY] = true;

    var P = 'interface_plus_';

    var S = {
        hero: 'banner_hero_enabled',
        size: 'interface_size',
        font: 'fontchanger_selected',
        card: P + 'card_logo',
        scale: P + 'logo_scale'
    };

    /*
     * Logo engine from КіноТрейлери 2.3
     */

    var LOGO_SIZE = 'w500';
    var LOGO_CACHE_TIMEOUT = 20000;
    var LOGO_PREFETCH_AHEAD = 10;

    var logoItems = {};

    var BACKDROP_SIZE = 'w1280';

    var backdropCache = {};
    var backdropCacheOrder = [];
    var backdropPending = {};
    var BACKDROP_CACHE_LIMIT = 12;

    var generation = 0;

    var initialized = false;
    var focusTimer = null;
    var activeHero = null;
    var activeCard = null;
    var activeCardToken = 0;
    var lastFocusKey = '';

    var screenBackground = null;

    var currentFont = '';
    var currentSize = '';

    var TITLE_SELECTOR = [
        '.full-start__title',
        '.full-start-new__title',
        '.full__title',
        '.full-card__title'
    ].join(',');

    /* =========================
       UTILITIES
    ========================= */

    function log() {
        try {
            console.log.apply(
                console,
                ['[INTERFACE+ ' + VERSION + ']'].concat(
                    Array.prototype.slice.call(arguments)
                )
            );
        } catch (e) {}
    }

    function storageGet(key, fallback) {
        try {
            return Lampa.Storage.get(key, fallback);
        } catch (e) {
            return fallback;
        }
    }

    function storageSet(key, value) {
        try {
            Lampa.Storage.set(key, value);
        } catch (e) {}
    }

    function enabled(key, fallback) {
        var v = storageGet(key, fallback);

        return v === true ||
               v === 'true' ||
               v === 1 ||
               v === '1';
    }

    function text(v) {
        return String(v == null ? '' : v).trim();
    }

    function first() {
        for (var i = 0; i < arguments.length; i++) {
            var v = text(arguments[i]);

            if (v) return v;
        }

        return '';
    }

    function node(v) {
        if (v && v.nodeType === 1) return v;

        if (v && v[0] && v[0].nodeType === 1) {
            return v[0];
        }

        return null;
    }

    function renderActivity(o) {
        var r = null;

        try {
            if (o && o.activity && o.activity.render) {
                r = o.activity.render(true);
            }
        } catch (e) {}

        if (!r) {
            try {
                if (o && o.render) {
                    r = o.render(true);
                }
            } catch (e) {}
        }

        return node(r);
    }

    function activeActivity() {
        try {
            return Lampa.Activity.active();
        } catch (e) {
            return null;
        }
    }

    function isFull(o) {
        var c = text(o && o.component).toLowerCase();

        return c === 'full' ||
               c === 'full_start' ||
               c === 'fullstart';
    }

    function movieType(d) {
        if (!d) return 'movie';

        if (
            d.media_type === 'tv' ||
            d.type === 'tv' ||
            d.type === 'series' ||
            d.first_air_date ||
            d.number_of_seasons ||
            (d.name && !d.title)
        ) {
            return 'tv';
        }

        return 'movie';
    }

    function movieYear(d) {
        var date = first(
            d && d.release_date,
            d && d.first_air_date,
            d && d.year
        );

        var match = date.match(/\b(19|20)\d{2}\b/);

        return match ? match[0] : '';
    }

    function movieTitle(d) {
        return first(
            d && d.title,
            d && d.name,
            d && d.original_title,
            d && d.original_name
        );
    }

    function normalizeTitle(s) {
        return text(s)
            .toLowerCase()
            .normalize('NFKD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^\p{L}\p{N}]+/gu, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function identity(d) {
        if (!d) return '';

        return [
            movieType(d),
            first(d.tmdb_id, d.tmdbId, d.id),
            normalizeTitle(movieTitle(d)),
            movieYear(d)
        ].join('|');
    }

    function getMovie(o) {
        if (!o) return null;

        var candidates = [
            o.movie,
            o.data && o.data.movie,
            o.data,
            o.card,
            o.card_data,
            o.params && o.params.movie,
            o.params && o.params.data,
            o.activity && o.activity.movie,
            o.activity && o.activity.data
        ];

        var best = null;
        var score = -1;

        candidates.forEach(function (d) {
            if (!d || typeof d !== 'object') return;

            var s = 0;

            if (movieTitle(d)) s += 10;
            if (movieYear(d)) s += 4;
            if (d.tmdb_id || d.tmdbId) s += 5;
            if (d.id) s += 2;
            if (d.backdrop_path) s += 2;
            if (d.overview) s += 1;

            if (s > score && movieTitle(d)) {
                best = d;
                score = s;
            }
        });

        return best;
    }

    /* =========================
       SETTINGS
    ========================= */

    function heroEnabled() {
        return enabled(S.hero, true);
    }

    function cardEnabled() {
        return enabled(S.card, true);
    }

    function logoScale() {
        var v = parseInt(storageGet(S.scale, '100'), 10);

        if (!v || isNaN(v)) v = 100;

        return Math.max(70, Math.min(120, v)) / 100;
    }

    /* =========================
       KINOTRAYLERY LOGO PICKER
    ========================= */

    function pickLogo(logos) {
        var lang = '';

        try {
            lang = Lampa.Storage.field('tmdb_lang');
        } catch (e) {}

        var order = [
            lang || 'en',
            'en',
            null
        ];

        for (var i = 0; i < order.length; i++) {
            var found = (logos || []).filter(function (l) {
                return l.iso_639_1 === order[i] && l.file_path;
            })[0];

            if (found) return found;
        }

        return (logos || []).filter(function (l) {
            return l && l.file_path;
        })[0] || null;
    }

    /* =========================
       KINOTRAYLERY CACHE
    ========================= */

    function getLogoHolder(item) {
        var key = identity(item);

        if (!key) return {};

        if (!logoItems[key]) {
            logoItems[key] = {};
        }

        return logoItems[key];
    }

    function cached(item, key, request, cb) {
        if (item[key] !== undefined) {
            cb(item[key]);
            return;
        }

        if (item[key + '_wait']) {
            item[key + '_wait'].push(cb);
            return;
        }

        item[key + '_wait'] = [cb];

        var completed = false;

        var timer = setTimeout(function () {
            finish(null);
        }, LOGO_CACHE_TIMEOUT);

        function finish(value) {
            if (completed) return;

            completed = true;

            clearTimeout(timer);

            item[key] = value || null;

            var list = item[key + '_wait'] || [];

            item[key + '_wait'] = null;

            list.forEach(function (f) {
                try {
                    f(item[key]);
                } catch (e) {}
            });
        }

        try {
            request(finish);
        } catch (e) {
            finish(null);
        }
    }

    /* =========================
       KINOTRAYLERY LOGO SERVICE
    ========================= */

    function ensureLogo(item, cb) {
        cb = cb || function () {};

        if (!item) {
            cb(null);
            return;
        }

        var type = movieType(item);
        var holder = getLogoHolder(item);

        cached(
            holder,
            'tfeed_logo',

            function (done) {
                var id = first(
                    item.tmdb_id,
                    item.tmdbId,
                    item.id
                );

                if (
                    id &&
                    typeof id === 'object'
                ) {
                    id = id.id;
                }

                id = text(id);

                if (!/^\d+$/.test(id)) {
                    done(null);
                    return;
                }

                var lang = 'en';

                try {
                    lang = Lampa.Storage.field('tmdb_lang') || 'en';
                } catch (e) {}

                var langs = lang + ',en,null';

                var tmdb = Lampa.Api.sources.tmdb;

                if (!tmdb || !tmdb.get) {
                    done(null);
                    return;
                }

                tmdb.get(
                    type + '/' + id + '/images',

                    {
                        filter: {
                            include_image_language: langs
                        }
                    },

                    function (json) {
                        var logo = json &&
                                   json.logos &&
                                   json.logos.length
                            ? pickLogo(json.logos)
                            : null;

                        done(
                            logo
                                ? Lampa.Api.img(
                                    logo.file_path,
                                    LOGO_SIZE
                                )
                                : null
                        );
                    },

                    function () {
                        done(null);
                    }
                );
            },

            cb
        );
    }

    function clearLogoCache() {
        generation++;

        logoItems = {};

        refreshAll(true);

        try {
            Lampa.Noty.show(
                'Кеш логотипів TMDB очищено'
            );
        } catch (e) {}
    }

    /* =========================
       IMAGE PRELOAD
    ========================= */

    function preload(url, callback) {
        if (!url) {
            callback(false);
            return;
        }

        var img = new Image();
        var completed = false;

        function done(ok) {
            if (completed) return;

            completed = true;

            img.onload = null;
            img.onerror = null;

            callback(ok);
        }

        img.onload = function () {
            done(true);
        };

        img.onerror = function () {
            done(false);
        };

        img.src = url;

        if (img.complete && img.naturalWidth) {
            done(true);
        }
    }

    /* =========================
       BACKDROP CACHE
    ========================= */

    function rememberBackdrop(url) {
        if (!url) return;

        var oldIndex = backdropCacheOrder.indexOf(url);

        if (oldIndex !== -1) {
            backdropCacheOrder.splice(oldIndex, 1);
        }

        backdropCache[url] = true;
        backdropCacheOrder.push(url);

        while (
            backdropCacheOrder.length >
            BACKDROP_CACHE_LIMIT
        ) {
            var old = backdropCacheOrder.shift();

            if (old) {
                delete backdropCache[old];
            }
        }
    }

    function preloadBackdrop(url, callback) {
        callback = callback || function () {};

        if (!url) {
            callback(false);
            return;
        }

        if (backdropCache[url]) {
            callback(true);
            return;
        }

        if (backdropPending[url]) {
            backdropPending[url].push(callback);
            return;
        }

        backdropPending[url] = [callback];

        var img = new Image();
        var completed = false;

        function finish(ok) {
            if (completed) return;

            completed = true;

            img.onload = null;
            img.onerror = null;

            if (ok) {
                rememberBackdrop(url);
            }

            var callbacks = backdropPending[url] || [];

            delete backdropPending[url];

            callbacks.forEach(function (fn) {
                try {
                    fn(ok);
                } catch (e) {}
            });
        }

        img.onload = function () {
            finish(true);
        };

        img.onerror = function () {
            finish(false);
        };

        img.src = url;

        if (img.complete && img.naturalWidth) {
            finish(true);
        }
    }

    function imageURL(path, size) {
        if (!path) return '';

        var p = text(path);

        return 'https://image.tmdb.org/t/p/' +
            (size || 'w500') +
            (p.charAt(0) === '/' ? '' : '/') +
            p;
    }

    /*
     * Start loading the next backdrop
     * immediately when the card receives focus.
     */

    function prefetchHeroBackdrop(d) {
        if (!d || !d.backdrop_path) return;

        var url = imageURL(
            d.backdrop_path,
            BACKDROP_SIZE
        );

        if (!url || backdropCache[url]) return;

        preloadBackdrop(url, function () {});
    }

    /* =========================
       LOGO PREFETCH
    ========================= */

    function prefetchLogoItem(item) {
        if (!item) return;

        ensureLogo(item, function (url) {
            if (url) {
                new Image().src = url;
            }
        });
    }

    function prefetchNearbyLogos(card, root) {
        if (!card || !root) return;

        var cards = root.querySelectorAll('.card');

        var currentIndex = Array.prototype.indexOf.call(
            cards,
            card
        );

        if (currentIndex < 0) return;

        var end = Math.min(
            cards.length,
            currentIndex + 1 + LOGO_PREFETCH_AHEAD
        );

        for (
            var i = currentIndex;
            i < end;
            i++
        ) {
            var element = cards[i];

            if (!element || !element.card_data) continue;

            prefetchLogoItem(element.card_data);
        }
    }

    /* =========================
       FULLSCREEN BACKGROUND
    ========================= */

    function ensureBackgroundLayers(layer) {
        if (!layer) return;

        var bgA = layer.querySelector(
            '.banner-screen-bg__image--a'
        );

        var bgB = layer.querySelector(
            '.banner-screen-bg__image--b'
        );

        var vignette = layer.querySelector(
            '.banner-screen-bg__vignette'
        );

        if (bgA && bgB && vignette) return;

        layer.innerHTML =
            '<div class="banner-screen-bg__image banner-screen-bg__image--a"></div>' +
            '<div class="banner-screen-bg__image banner-screen-bg__image--b"></div>' +
            '<div class="banner-screen-bg__vignette"></div>';
    }

    function ensureScreenBackground() {
        if (
            screenBackground &&
            screenBackground.isConnected
        ) {
            ensureBackgroundLayers(screenBackground);

            return screenBackground;
        }

        var existing = document.getElementById(
            'interface-plus-screen-background'
        );

        if (existing) {
            screenBackground = existing;

            ensureBackgroundLayers(screenBackground);

            return screenBackground;
        }

        var layer = document.createElement('div');

        layer.id = 'interface-plus-screen-background';
        layer.className = 'banner-screen-bg';

        ensureBackgroundLayers(layer);

        document.body.appendChild(layer);

        screenBackground = layer;

        return screenBackground;
    }

    function clearHeroBackgrounds() {
        if (!screenBackground) {
            screenBackground = document.getElementById(
                'interface-plus-screen-background'
            );
        }

        if (!screenBackground) return;

        var images = screenBackground.querySelectorAll(
            '.banner-screen-bg__image'
        );

        Array.prototype.forEach.call(
            images,
            function (bg) {
                bg.classList.remove('show');
                bg.style.backgroundImage = 'none';
            }
        );

        if (activeHero) {
            activeHero.activeBgIndex = 0;
        }
    }

    function hideHeroBackground() {
        if (!screenBackground) {
            screenBackground = document.getElementById(
                'interface-plus-screen-background'
            );
        }

        if (!screenBackground) return;

        screenBackground.style.display = 'none';

        clearHeroBackgrounds();
    }

    function showHeroBackground() {
        var layer = ensureScreenBackground();

        if (!layer) return;

        layer.style.display = 'block';
    }

    /* =========================
       CSS
    ========================= */

    var CSS = [

        '#interface-plus-screen-background{' +
            'position:fixed;' +
            'inset:0;' +
            'width:100%;' +
            'height:100%;' +
            'overflow:hidden;' +
            'pointer-events:none;' +
            'z-index:0;' +
            'display:none;' +
            'background:#000;' +
        '}',

        '.banner-screen-bg__image{' +
            'position:absolute;' +
            'inset:0;' +
            'width:100%;' +
            'height:100%;' +
            'background-position:center 65%;' +
            'background-repeat:no-repeat;' +
            'background-size:cover;' +
            'opacity:0;' +
            'filter:none;' +
            'transform:none;' +
            'transition:opacity .18s ease;' +
            'will-change:opacity;' +
        '}',

        '.banner-screen-bg__image.show{' +
            'opacity:1;' +
        '}',

        '.banner-screen-bg__vignette{' +
            'position:absolute;' +
            'inset:0;' +
            'width:100%;' +
            'height:100%;' +
            'z-index:1;' +
            'pointer-events:none;' +
            'background:' +
                'linear-gradient(' +
                    'to bottom,' +
                    'rgba(0,0,0,0) 0vh,' +
                    'rgba(0,0,0,0) 35vh,' +
                    'rgba(0,0,0,.04) 40vh,' +
                    'rgba(0,0,0,.12) 45vh,' +
                    'rgba(0,0,0,.30) 50vh,' +
                    'rgba(0,0,0,.60) 55vh,' +
                    'rgba(0,0,0,.88) 59vh,' +
                    '#000 63vh,' +
                    '#000 100%' +
                ');' +
        '}',

        '.banner-host{' +
            'position:relative;' +
            'z-index:1;' +
        '}',

        '.banner-enabled .banner-host .activity__body{' +
            'padding-top:42vh!important;' +
            'box-sizing:border-box;' +
        '}',

        '.banner-hero{' +
            'position:absolute;' +
            'top:0;' +
            'left:0;' +
            'right:0;' +
            'height:50vh;' +
            'overflow:visible;' +
            'pointer-events:none;' +
            'z-index:2;' +
        '}',

        '.banner-hero__info{' +
            'position:absolute;' +
            'left:3em;' +
            'bottom:5.5em;' +
            'width:46%;' +
            'z-index:2;' +
        '}',

        '.banner-hero__logo{' +
            'display:none;' +
            'width:auto;' +
            'height:auto;' +
            'max-width:100%;' +
            'max-height:7em;' +
            'object-fit:contain;' +
            'object-position:left center;' +
            'opacity:0;' +
            'transition:opacity .15s ease;' +
            'filter:drop-shadow(0 4px 12px rgba(0,0,0,.6));' +
        '}',

        '.banner-hero__logo.ready{' +
            'opacity:1;' +
        '}',

        '.banner-hero__title{' +
            'font-size:2.8em;' +
            'font-weight:900;' +
            'line-height:1.05;' +
            'color:#f5f5f1;' +
            'margin-bottom:.35em;' +
            'text-shadow:0 3px 14px rgba(0,0,0,.7);' +
        '}',

        '.banner-hero__meta{' +
            'font-size:1.15em;' +
            'color:#f5f5f1;' +
            'margin-bottom:.6em;' +
            'display:flex;' +
            'gap:.8em;' +
            'align-items:center;' +
            'flex-wrap:wrap;' +
        '}',

        '.banner-hero__rate{' +
            'padding:.1em .5em;' +
            'border-radius:6px;' +
            'font-weight:800;' +
            'background:#1db954;' +
            'color:#fff;' +
        '}',

        '.banner-hero__descr{' +
            'font-size:1.1em;' +
            'line-height:1.45;' +
            'color:#f5f5f1;' +
            'opacity:.85;' +
            'display:-webkit-box;' +
            '-webkit-line-clamp:3;' +
            '-webkit-box-orient:vertical;' +
            'overflow:hidden;' +
        '}',

        '.interface-plus-logo-title{' +
            'position:relative;' +
        '}',

        '.interface-plus-card-logo{' +
            'display:block;' +
            'width:auto;' +
            'height:auto;' +
            'max-width:100%;' +
            'max-height:105px;' +
            'object-fit:contain;' +
            'object-position:left center;' +
            'opacity:0;' +
            'transition:opacity .15s ease;' +
            'filter:drop-shadow(0 3px 10px rgba(0,0,0,.45));' +
        '}',

        '.interface-plus-card-logo.ready{' +
            'opacity:1;' +
        '}',

        '.interface-plus-logo-title.interface-plus-logo-active{' +
            'font-size:0!important;' +
            'line-height:0!important;' +
        '}',

        '.interface-plus-logo-title.interface-plus-logo-active>' +
        '.interface-plus-original-title{' +
            'display:none!important;' +
        '}',

        '.interface-plus-logo-title.interface-plus-logo-active>' +
        '.interface-plus-card-logo{' +
            'font-size:initial;' +
            'line-height:normal;' +
        '}',

        '@media(max-width:480px){' +

            '.interface-plus-card-logo{' +
                'max-height:75px;' +
            '}' +

            '.banner-hero__info{' +
                'left:1.5em;' +
                'width:75%;' +
            '}' +

            '.banner-hero__logo{' +
                'max-height:5em;' +
            '}' +

            '.banner-screen-bg__image{' +
                'background-position:center 60%;' +
            '}' +

        '}'

    ].join('\n');

    function installStyle() {
        var el = document.getElementById(
            'interface-plus-tmdb-only-style'
        );

        if (!el) {
            el = document.createElement('style');
            el.id = 'interface-plus-tmdb-only-style';

            document.head.appendChild(el);
        }

        el.textContent = CSS;
    }

    /* =========================
       HERO CREATION
    ========================= */

    function createHero(root) {
        if (!root) return null;

        if (
            root.__interfacePlusHero &&
            root.contains(root.__interfacePlusHero)
        ) {
            ensureScreenBackground();

            return root.__interfacePlusHero;
        }

        var layer = ensureScreenBackground();

        var hero = document.createElement('div');

        hero.className = 'banner-hero';

        hero.innerHTML =
            '<div class="banner-hero__info">' +
                '<img class="banner-hero__logo" alt=""/>' +
                '<div class="banner-hero__title"></div>' +
                '<div class="banner-hero__meta"></div>' +
                '<div class="banner-hero__descr"></div>' +
            '</div>';

        root.insertBefore(hero, root.firstChild);

        root.classList.add('banner-host');

        hero.parts = {
            bgA: layer.querySelector(
                '.banner-screen-bg__image--a'
            ),

            bgB: layer.querySelector(
                '.banner-screen-bg__image--b'
            ),

            logo: hero.querySelector(
                '.banner-hero__logo'
            ),

            title: hero.querySelector(
                '.banner-hero__title'
            ),

            meta: hero.querySelector(
                '.banner-hero__meta'
            ),

            descr: hero.querySelector(
                '.banner-hero__descr'
            )
        };

        hero.token = 0;
        hero.root = root;
        hero.activeBgIndex = 0;

        root.__interfacePlusHero = hero;

        return hero;
    }

    /* =========================
       FAST BACKDROP SWITCH
    ========================= */

    function switchHeroBackdrop(hero, url, token) {
        if (!hero || !url) return;

        if (backdropCache[url]) {
            applyBackdrop(hero, url, token);
            return;
        }

        preloadBackdrop(url, function (ok) {
            if (!ok) return;
            if (hero.token !== token) return;

            applyBackdrop(hero, url, token);
        });
    }

    function applyBackdrop(hero, url, token) {
        if (!hero || hero.token !== token) return;

        var p = hero.parts;

        var current = hero.activeBgIndex || 0;
        var next = current === 0 ? 1 : 0;

        var currentLayer =
            current === 0 ? p.bgA : p.bgB;

        var nextLayer =
            next === 0 ? p.bgA : p.bgB;

        if (!nextLayer) return;

        nextLayer.classList.remove('show');

        nextLayer.style.backgroundImage =
            'url("' + url + '")';

        void nextLayer.offsetWidth;

        nextLayer.classList.add('show');

        if (
            currentLayer &&
            currentLayer !== nextLayer
        ) {
            currentLayer.classList.remove('show');
        }

        hero.activeBgIndex = next;
    }

    /* =========================
       SHOW HERO
    ========================= */

    function showHero(hero, d, force) {
        if (!hero || !d) return;

        var key = identity(d);

        if (!force && hero.movieKey === key) return;

        hero.movieKey = key;
        hero.token++;

        var token = hero.token;
        var p = hero.parts;

        showHeroBackground();

        p.logo.classList.remove('ready');
        p.logo.style.display = 'none';
        p.logo.removeAttribute('src');

        p.title.style.display = '';
        p.title.textContent = movieTitle(d);

        p.logo.style.transform =
            'scale(' + logoScale() + ')';

        p.logo.style.transformOrigin = 'left center';

        p.meta.textContent = '';

        var rating = Number(d.vote_average) || 0;

        if (rating > 0) {
            var rate = document.createElement('span');

            rate.className = 'banner-hero__rate';
            rate.textContent = rating.toFixed(1);

            p.meta.appendChild(rate);
        }

        var year = movieYear(d);

        if (year) {
            var y = document.createElement('span');

            y.textContent = year;

            p.meta.appendChild(y);
        }

        var type = document.createElement('span');

        type.textContent =
            movieType(d) === 'tv' ?
                'Серіал' :
                'Фільм';

        p.meta.appendChild(type);

        p.descr.textContent = d.overview || '';

        if (d.backdrop_path) {
            var bg = imageURL(
                d.backdrop_path,
                BACKDROP_SIZE
            );

            switchHeroBackdrop(
                hero,
                bg,
                token
            );
        } else {
            if (p.bgA) {
                p.bgA.classList.remove('show');
                p.bgA.style.backgroundImage = 'none';
            }

            if (p.bgB) {
                p.bgB.classList.remove('show');
                p.bgB.style.backgroundImage = 'none';
            }

            hero.activeBgIndex = 0;
        }

        function applyLogo(src) {
            if (hero.token !== token) return;

            if (!src) {
                p.title.style.display = '';
                p.logo.style.display = 'none';

                return;
            }

            preload(src, function (ok) {
                if (hero.token !== token) return;

                if (!ok) {
                    p.title.style.display = '';
                    p.logo.style.display = 'none';

                    return;
                }

                p.logo.src = src;
                p.logo.style.display = 'block';

                requestAnimationFrame(function () {
                    if (hero.token !== token) return;

                    p.logo.classList.add('ready');
                    p.title.style.display = 'none';
                });
            });
        }

        ensureLogo(d, function (url) {
            if (hero.token !== token) return;

            applyLogo(url);
        });
    }

    /* =========================
       ATTACH HERO
    ========================= */

    function attachHero(o) {
        if (!heroEnabled() || !o) return;

        var c = text(o.component).toLowerCase();

        if (c !== 'main' && c !== 'category') return;

        var root = renderActivity(o);

        if (!root) return;

        var previousRoot =
            activeHero && activeHero.root;

        if (previousRoot && previousRoot !== root) {
            clearHeroBackgrounds();
            lastFocusKey = '';
        }

        activeHero = createHero(root);

        showHeroBackground();
    }

    /* =========================
       FOCUS HANDLER
    ========================= */

    function onFocus(e) {
        if (!heroEnabled()) return;

        var target = e.target;

        if (!target || !target.closest) return;

        var item = target.closest('.card');

        if (!item || !item.card_data) return;

        var root = item.closest('.activity');

        if (!root || !root.__interfacePlusHero) return;

        var d = item.card_data;
        var key = identity(d);

        if (lastFocusKey === key) return;

        /*
         * Start backdrop and logo preloading
         * immediately when focus changes.
         */

        prefetchHeroBackdrop(d);
        prefetchNearbyLogos(item, root);

        clearTimeout(focusTimer);

        focusTimer = setTimeout(function () {
            if (!heroEnabled()) return;

            lastFocusKey = key;

            activeHero = root.__interfacePlusHero;

            showHero(activeHero, d);
        }, 50);
    }

    function applyHero() {
        var on = heroEnabled();

        document.body.classList.toggle(
            'banner-enabled',
            on
        );

        if (!on) {
            clearTimeout(focusTimer);

            lastFocusKey = '';

            hideHeroBackground();

            return;
        }

        attachHero(activeActivity());
    }

    /* =========================
       CARD TITLE
    ========================= */

    function restoreTitle(root) {
        if (!root) return;

        var titles = [];

        if (
            root.classList &&
            root.classList.contains(
                'interface-plus-logo-title'
            )
        ) {
            titles.push(root);
        }

        if (root.querySelectorAll) {
            Array.prototype.push.apply(
                titles,
                root.querySelectorAll(
                    '.interface-plus-logo-title'
                )
            );
        }

        titles.forEach(function (t) {
            var logo = t.querySelector(
                '.interface-plus-card-logo'
            );

            if (logo) {
                logo.onload = null;
                logo.onerror = null;
                logo.remove();
            }

            var original = t.querySelector(
                '.interface-plus-original-title'
            );

            if (original) {
                while (original.firstChild) {
                    t.insertBefore(
                        original.firstChild,
                        original
                    );
                }

                original.remove();
            }

            t.classList.remove(
                'interface-plus-logo-title',
                'interface-plus-logo-active'
            );
        });
    }

    function findTitle(root) {
        return root &&
               root.querySelector &&
               root.querySelector(TITLE_SELECTOR);
    }

    function prepareLogo(title) {
        if (!title) return null;

        var logo = title.querySelector(
            '.interface-plus-card-logo'
        );

        if (logo) return logo;

        title.classList.add(
            'interface-plus-logo-title'
        );

        var original = document.createElement('span');

        original.className =
            'interface-plus-original-title';

        while (title.firstChild) {
            original.appendChild(title.firstChild);
        }

        title.appendChild(original);

        logo = document.createElement('img');

        logo.className = 'interface-plus-card-logo';
        logo.alt = '';
        logo.draggable = false;

        title.appendChild(logo);

        return logo;
    }

    function stopCard(restore) {
        activeCardToken++;

        if (activeCard && activeCard.observer) {
            activeCard.observer.disconnect();
        }

        if (
            restore &&
            activeCard &&
            activeCard.root
        ) {
            restoreTitle(activeCard.root);
        }

        activeCard = null;
    }

    function cardCurrent(token, key) {
        return !!(
            activeCard &&
            activeCardToken === token &&
            activeCard.key === key &&
            activeCard.root &&
            activeCard.root.isConnected &&
            cardEnabled()
        );
    }

    function showCardLogoInstant(root, d) {
        var holder = getLogoHolder(d);
        var hit = holder.tfeed_logo;

        if (!hit) return false;

        var title = findTitle(root);

        if (!title) return false;

        var logo = prepareLogo(title);

        if (!logo) return false;

        logo.style.transform =
            'scale(' + logoScale() + ')';

        logo.style.transformOrigin = 'left center';

        logo.src = hit;

        logo.classList.add('ready');

        title.classList.add(
            'interface-plus-logo-active'
        );

        return true;
    }

    function startCard(o, override, force) {
        if (!cardEnabled() || !isFull(o)) return;

        var d = override || getMovie(o);
        var root = renderActivity(o);

        if (!d || !root) return;

        var key = identity(d);

        if (
            !force &&
            activeCard &&
            activeCard.key === key &&
            activeCard.root === root
        ) {
            return;
        }

        stopCard(false);

        var token = activeCardToken;

        activeCard = {
            root: root,
            key: key,
            data: d,
            title: movieTitle(d),
            src: '',
            observer: null
        };

        if (
            showCardLogoInstant(root, d)
        ) {
            return;
        }

        if (window.MutationObserver) {
            var observer = new MutationObserver(
                function () {
                    if (!cardCurrent(token, key)) return;

                    var title = findTitle(root);

                    if (!title) return;

                    if (
                        activeCard.src &&
                        !title.querySelector(
                            '.interface-plus-card-logo'
                        )
                    ) {
                        var logo = prepareLogo(title);

                        if (logo) {
                            logo.style.transform =
                                'scale(' + logoScale() + ')';

                            logo.style.transformOrigin =
                                'left center';

                            logo.src = activeCard.src;

                            logo.classList.add('ready');

                            title.classList.add(
                                'interface-plus-logo-active'
                            );
                        }
                    }
                }
            );

            observer.observe(root, {
                childList: true,
                subtree: true
            });

            activeCard.observer = observer;
        }

        ensureLogo(d, function (url) {
            if (!cardCurrent(token, key)) return;

            activeCard.src = url || '';

            if (!url) return;

            var title = findTitle(root);

            if (!title) return;

            var logo = prepareLogo(title);

            if (!logo) return;

            logo.style.transform =
                'scale(' + logoScale() + ')';

            logo.style.transformOrigin =
                'left center';

            logo.src = url;

            logo.classList.add('ready');

            title.classList.add(
                'interface-plus-logo-active'
            );
        });
    }

    function refreshCard(force) {
        if (!cardEnabled()) {
            stopCard(true);
            return;
        }

        var a = activeActivity();

        if (isFull(a)) {
            startCard(a, null, !!force);
        }
    }

    function refreshAll(force) {
        lastFocusKey = '';

        if (activeHero && activeHero.movieKey) {
            activeHero.movieKey = '';
        }

        var a = activeActivity();

        if (isFull(a)) {
            stopCard(true);
            startCard(a, null, !!force);
        }
    }

    /* =========================
       FONTS & SIZE
    ========================= */

    var FONTS = {
        default: {
            family: 'Roboto, Arial, sans-serif',
            url: ''
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

    function applyFont() {
        var name = text(
            storageGet(S.font, 'default')
        );

        if (currentFont === name) return;

        currentFont = name;

        var font = FONTS[name] || FONTS.default;

        var old = document.getElementById(
            'interface-plus-font-style'
        );

        if (old) old.remove();

        old = document.getElementById(
            'interface-plus-font-face'
        );

        if (old) old.remove();

        if (font.url) {
            var face = document.createElement('style');

            face.id = 'interface-plus-font-face';

            if (
                font.url.indexOf('googleapis.com') !== -1
            ) {
                face.textContent =
                    '@import url("' + font.url + '");';
            } else {
                face.textContent =
                    '@font-face{' +
                        'font-family:"Netflix Sans";' +
                        'src:url("' + font.url + '") format("woff2");' +
                        'font-weight:400' +
                    '}';
            }

            document.head.appendChild(face);
        }

        var style = document.createElement('style');

        style.id = 'interface-plus-font-style';

        style.textContent =
            'body,.body,*{font-family:' +
            font.family +
            '!important}';

        document.head.appendChild(style);
    }

    function patchMaker(count) {
        if (!Lampa.Maker || !Lampa.Maker.map) return;

        ['Line', 'Category'].forEach(function (type) {
            var maker = Lampa.Maker.map(type);

            if (
                !maker ||
                !maker.Items ||
                !maker.Items.onInit
            ) {
                return;
            }

            if (maker.Items.__interfacePlusPatched) {
                maker.Items.__interfacePlusCount = count;

                return;
            }

            var original = maker.Items.onInit;

            maker.Items.onInit = function () {
                original.apply(this, arguments);

                var n =
                    maker.Items.__interfacePlusCount ||
                    count;

                if (type === 'Line') {
                    this.view = n;
                } else {
                    this.limit_view = n;
                }
            };

            maker.Items.__interfacePlusPatched = true;
            maker.Items.__interfacePlusCount = count;
        });
    }

    function applySize() {
        var value = parseFloat(
            storageGet(S.size, '10.6')
        ) || 10.6;

        var mobile = false;

        try {
            mobile = !!(
                Lampa.Platform &&
                Lampa.Platform.screen &&
                Lampa.Platform.screen('mobile')
            );
        } catch (e) {}

        if (mobile) value = 10.1;

        if (String(value) === currentSize) return;

        currentSize = String(value);

        document.body.style.fontSize =
            value + 'px';

        patchMaker(
            value <= 9.6 ? 8 :
            value <= 11.1 ? 7 :
            6
        );
    }

    /* =========================
       SETTINGS
    ========================= */

    function addSettings() {
        if (!Lampa.SettingsApi) return;

        var api = Lampa.SettingsApi;

        api.addComponent({
            component: 'interface_plus_settings',
            name: 'Інтерфейс +',

            icon:
                '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">' +
                    '<path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm0 16H5V5h14v14zM7 10h2v7H7zm4-3h2v10h-2zm4 5h2v5h-2z"/>' +
                '</svg>'
        });

        function add(
            key,
            type,
            def,
            name,
            description,
            values,
            change
        ) {
            api.addParam({
                component: 'interface_plus_settings',

                param: {
                    name: key,
                    type: type,
                    default: def,
                    values: values
                },

                field: {
                    name: name,
                    description: description || ''
                },

                onChange: change
            });
        }

        add(
            S.hero,
            'trigger',
            true,
            'Динамічні банери',
            'Преміальні банери на головній сторінці',
            null,
            applyHero
        );

        add(
            S.card,
            'trigger',
            true,
            'Логотип у картці фільму',
            'Логотипи тільки з TMDB',
            null,
            function () {
                refreshCard(true);
            }
        );

        add(
            S.scale,
            'select',
            '100',
            'Розмір логотипів',
            'Масштаб логотипів',
            {
                '70': '70%',
                '80': '80%',
                '90': '90%',
                '100': '100%',
                '110': '110%',
                '120': '120%'
            },
            function () {
                refreshAll(false);
            }
        );

        add(
            'interface_plus_clear_logo_cache',
            'button',
            '',
            'Очистити кеш логотипів',
            'Повторно отримати логотипи з TMDB',
            null,
            clearLogoCache
        );

        add(
            S.size,
            'select',
            '10.6',
            'Розмір інтерфейсу',
            'Масштаб елементів інтерфейсу',
            {
                '09.1': 'Міні',
                '09.6': 'Дуже малий',
                '10.1': 'Малий',
                '10.6': 'Середній'
            },
            applySize
        );

        add(
            S.font,
            'select',
            'default',
            'Шрифт інтерфейсу',
            'Стиль тексту',
            {
                default: 'Roboto',
                netflix: 'Netflix Sans',
                montserrat: 'Montserrat',
                inter: 'Inter',
                nunito: 'Nunito'
            },
            applyFont
        );
    }

    /* =========================
       LISTENERS
    ========================= */

    function installListeners() {
        document.addEventListener(
            'hover:focus',
            onFocus,
            true
        );

        if (!Lampa.Listener) return;

        Lampa.Listener.follow(
            'activity',
            function (e) {
                if (!e) return;

                if (e.type === 'start') {
                    requestAnimationFrame(function () {
                        if (isFull(e.object)) {
                            hideHeroBackground();

                            stopCard(false);
                            startCard(e.object);
                        } else {
                            attachHero(e.object);

                            stopCard(false);
                        }
                    });
                }

                if (
                    e.type === 'destroy' &&
                    isFull(e.object)
                ) {
                    stopCard(false);
                }

                if (e.type === 'destroy') {
                    var component = text(
                        e.object && e.object.component
                    ).toLowerCase();

                    if (
                        component === 'main' ||
                        component === 'category'
                    ) {
                        hideHeroBackground();
                    }
                }
            }
        );

        Lampa.Listener.follow(
            'full',
            function (e) {
                if (!e) return;

                if (
                    e.type !== 'complete' &&
                    e.type !== 'complite'
                ) {
                    return;
                }

                var d = e.data && e.data.movie;

                requestAnimationFrame(function () {
                    hideHeroBackground();

                    var a = activeActivity();

                    if (isFull(a)) {
                        startCard(
                            a,
                            d || null,
                            true
                        );
                    }
                });
            }
        );

        try {
            if (
                Lampa.Storage.listener &&
                Lampa.Storage.listener.follow
            ) {
                Lampa.Storage.listener.follow(
                    'change',
                    function (e) {
                        if (!e || !e.name) return;

                        if (e.name === S.hero) {
                            applyHero();
                        }

                        if (e.name === S.card) {
                            refreshCard(true);
                        }

                        if (e.name === S.font) {
                            currentFont = '';
                            applyFont();
                        }

                        if (e.name === S.size) {
                            currentSize = '';
                            applySize();
                        }

                        if (e.name === S.scale) {
                            refreshAll(false);
                        }
                    }
                );
            }
        } catch (e) {}
    }

    /* =========================
       INITIALIZE
    ========================= */

    function init() {
        if (
            initialized ||
            !window.Lampa ||
            !Lampa.Storage
        ) {
            return;
        }

        initialized = true;

        installStyle();
        ensureScreenBackground();

        applyFont();
        applySize();
        applyHero();

        addSettings();
        installListeners();

        requestAnimationFrame(function () {
            var a = activeActivity();

            if (isFull(a)) {
                hideHeroBackground();
                startCard(a);
            } else {
                attachHero(a);
            }
        });

        log('Kinotraylery logo engine initialized');
    }

    /* =========================
       START
    ========================= */

    if (window.appready) {
        setTimeout(init, 150);
    } else if (window.Lampa && Lampa.Listener) {
        Lampa.Listener.follow(
            'app',
            function (e) {
                if (e.type === 'ready') {
                    setTimeout(init, 150);
                }
            }
        );
    }

})();
