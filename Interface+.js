(function () {
'use strict';

/*
 * INTERFACE+ 1.5.6 — TMDB ONLY (SMOOTH & CLEAN HERO)
 * Dynamic hero banners + TMDB logos
 * Ukrainian > English > Ukrainian text
 */

var VERSION = '1.5.6';
var READY_KEY = 'interface_plus_tmdb_only_156';

if (window[READY_KEY]) return;
window[READY_KEY] = true;

var P = 'interface_plus_';

var S = {
    hero: 'banner_hero_enabled',
    size: 'interface_size',
    font: 'fontchanger_selected',
    card: P + 'card_logo',
    quality: P + 'logo_quality',
    scale: P + 'logo_scale'
};

var CACHE_KEY = P + 'tmdb_only_cache_v156';
var CACHE_LIMIT = 200;

var TTL_LOGO = 24 * 60 * 60 * 1000;
var TTL_EMPTY = 60 * 60 * 1000;
var TTL_ERROR = 60 * 1000;

var memoryCache = {};
var pending = {};
var searchPending = {};
var generation = 0;

var initialized = false;
var focusTimer = null;
var activeHero = null;
var activeCard = null;
var activeCardToken = 0;
var lastFocusKey = '';

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

function titleMatches(a, b) {
    var x = normalizeTitle(a);
    var y = normalizeTitle(b);

    if (!x || !y) return false;
    return x === y;
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

function logoQuality() {
    var q = text(storageGet(S.quality, 'original'));
    return /^(w300|w500|original)$/.test(q) ? q : 'original';
}

function logoScale() {
    var v = parseInt(storageGet(S.scale, '100'), 10);
    if (!v || isNaN(v)) v = 100;
    return Math.max(70, Math.min(120, v)) / 100;
}

/* =========================
   CACHE
========================= */

function readCache() {
    var db = storageGet(CACHE_KEY, {});
    return db && typeof db === 'object' ? db : {};
}

function cacheTTL(v) {
    if (v && v.failed) return TTL_ERROR;
    if (v && v.path) return TTL_LOGO;
    return TTL_EMPTY;
}

function validCache(v) {
    return !!(v && v.time && Date.now() - v.time < cacheTTL(v));
}

function cached(key) {
    if (memoryCache[key] && validCache(memoryCache[key])) {
        return memoryCache[key];
    }

    var db = readCache();
    if (validCache(db[key])) {
        memoryCache[key] = db[key];
        return db[key];
    }

    return null;
}

function saveCache(key, value) {
    memoryCache[key] = value;
    if (value.failed) return;

    var db = readCache();
    db[key] = value;

    var keys = Object.keys(db);
    if (keys.length > CACHE_LIMIT) {
        keys.sort(function (a, b) {
            return (db[a].time || 0) - (db[b].time || 0);
        });
        keys.slice(0, keys.length - CACHE_LIMIT).forEach(function (k) {
            delete db[k];
        });
    }

    storageSet(CACHE_KEY, db);
}

function clearCache() {
    generation++;
    memoryCache = {};
    pending = {};
    searchPending = {};
    storageSet(CACHE_KEY, {});
    refreshAll(true);

    try {
        Lampa.Noty.show('Кеш логотипів TMDB очищено');
    } catch (e) {}
}

/* =========================
   TMDB API
========================= */

function tmdbKey() {
    try {
        return Lampa.TMDB.key();
    } catch (e) {
        return '';
    }
}

function apiURL(path, params) {
    var url = 'https://api.themoviedb.org/3/' + path + '?api_key=' + encodeURIComponent(tmdbKey());
    Object.keys(params || {}).forEach(function (k) {
        var v = params[k];
        if (v !== undefined && v !== null && v !== '') {
            url += '&' + encodeURIComponent(k) + '=' + encodeURIComponent(v);
        }
    });
    return url;
}

function apiGet(path, params, callback) {
    if (!tmdbKey() || typeof $ === 'undefined') {
        callback(null, true);
        return;
    }

    $.ajax({
        url: apiURL(path, params),
        type: 'GET',
        dataType: 'json',
        timeout: 6000,
        success: function (data) { callback(data, false); },
        error: function () { callback(null, true); }
    });
}

function numericId(v) {
    var s = text(v);
    return /^\d+$/.test(s) ? s : '';
}

function explicitTMDBId(d) {
    if (!d) return '';
    var id = d.tmdb_id || d.tmdbId || '';
    if (id && typeof id === 'object') id = id.id;
    return numericId(id);
}

function possibleTMDBId(d) {
    if (!d) return '';
    return explicitTMDBId(d) || numericId(d.id);
}

/* =========================
   TMDB TITLE VERIFICATION
========================= */

function matchesDetails(details, d) {
    if (!details || !details.id) return false;

    var expectedYear = movieYear(d);
    var actualYear = movieYear(details);

    if (expectedYear && actualYear && Math.abs(parseInt(expectedYear, 10) - parseInt(actualYear, 10)) > 1) {
        return false;
    }

    var expected = [d.title, d.name, d.original_title, d.original_name].filter(Boolean);
    var actual = [details.title, details.name, details.original_title, details.original_name].filter(Boolean);

    for (var i = 0; i < expected.length; i++) {
        for (var j = 0; j < actual.length; j++) {
            if (titleMatches(expected[i], actual[j])) return true;
        }
    }

    return false;
}

/* =========================
   TMDB SEARCH
========================= */

function searchMovie(d, callback) {
    var type = movieType(d);
    var name = movieTitle(d);
    var year = movieYear(d);

    if (!name) {
        callback(null);
        return;
    }

    var searchKey = [type, normalizeTitle(name), year].join('|');

    if (searchPending[searchKey]) {
        searchPending[searchKey].push(callback);
        return;
    }

    searchPending[searchKey] = [callback];

    function finish(result) {
        var callbacks = searchPending[searchKey] || [];
        delete searchPending[searchKey];
        callbacks.forEach(function (fn) {
            try { fn(result); } catch (e) {}
        });
    }

    var params = { query: name, language: 'uk-UA', include_adult: 'false' };
    if (year) params[type === 'tv' ? 'first_air_date_year' : 'year'] = year;

    apiGet('search/' + type, params, function (json, failed) {
        if (failed || !json || !Array.isArray(json.results)) {
            finish(null);
            return;
        }

        var list = json.results.filter(function (item) { return matchesDetails(item, d); });
        if (!list.length) {
            finish(null);
            return;
        }

        list.sort(function (a, b) { return (Number(b.popularity) || 0) - (Number(a.popularity) || 0); });
        finish(list[0]);
    });
}

/* =========================
   STRICT LOGO PICKER
========================= */

function chooseLogo(list) {
    if (!Array.isArray(list)) return null;

    var languages = ['uk', 'en'];
    for (var i = 0; i < languages.length; i++) {
        var lang = languages[i];
        var candidates = list.filter(function (x) { return x && x.file_path && x.iso_639_1 === lang; });

        if (!candidates.length) continue;

        candidates.sort(function (a, b) {
            var av = Number(a.vote_average) || 0;
            var bv = Number(b.vote_average) || 0;
            if (bv !== av) return bv - av;
            return (Number(b.vote_count) || 0) - (Number(a.vote_count) || 0);
        });

        return candidates[0];
    }

    return null;
}

function imageURL(path, size) {
    if (!path) return '';
    var p = text(path);
    if (/\.svg$/i.test(p)) p = p.replace(/\.svg$/i, '.png');
    return 'https://image.tmdb.org/t/p/' + (size || logoQuality()) + (p.charAt(0) === '/' ? '' : '/') + p;
}

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

    img.onload = function () { done(true); };
    img.onerror = function () { done(false); };
    img.src = url;

    if (img.complete && img.naturalWidth) {
        done(true);
    }
}

/* =========================
   FETCH DETAILS
========================= */

function requestDetails(type, id, callback) {
    apiGet(type + '/' + id, {
        language: 'uk-UA',
        append_to_response: 'images',
        include_image_language: 'uk,en,null'
    }, callback);
}

function resolveTMDB(d, callback) {
    var type = movieType(d);
    var id = possibleTMDBId(d);
    var explicit = explicitTMDBId(d);

    if (!id) {
        searchMovie(d, function (result) {
            if (!result) {
                callback(null, true);
                return;
            }
            requestDetails(type, result.id, callback);
        });
        return;
    }

    requestDetails(type, id, function (details, failed) {
        if (!failed && details && (matchesDetails(details, d) || (explicit && String(details.id) === explicit))) {
            callback(details, false);
            return;
        }

        searchMovie(d, function (result) {
            if (!result) {
                callback(null, true);
                return;
            }
            requestDetails(type, result.id, callback);
        });
    });
}

/* =========================
   LOGO SERVICE
========================= */

function loadLogo(d, callback, force) {
    if (!d) {
        callback({ src: '', title: '' });
        return;
    }

    var k = identity(d);
    var fallback = movieTitle(d);

    if (!force) {
        var hit = cached(k);
        if (hit) {
            callback({
                src: imageURL(hit.path),
                title: hit.title || fallback
            });
            return;
        }
    }

    if (pending[k]) {
        pending[k].push(callback);
        return;
    }

    pending[k] = [callback];
    var requestGeneration = generation;

    function finish(path, title, failed) {
        if (requestGeneration !== generation) return;

        var value = {
            path: path || '',
            title: title || fallback,
            failed: !!failed,
            time: Date.now()
        };

        saveCache(k, value);

        var callbacks = pending[k] || [];
        delete pending[k];

        var result = {
            src: imageURL(value.path),
            title: value.title
        };

        callbacks.forEach(function (fn) {
            try { fn(result); } catch (e) {}
        });
    }

    resolveTMDB(d, function (json, failed) {
        if (failed || !json || !json.id) {
            finish('', fallback, true);
            return;
        }

        var title = first(movieType(d) === 'tv' ? json.name : json.title, fallback);
        var logos = json.images && json.images.logos;
        var selected = chooseLogo(logos);

        finish(selected ? selected.file_path : '', title, false);
    });
}

/* =========================
   CSS
========================= */

var CSS = [
'.banner-host{position:relative}',
'.banner-enabled .banner-host .activity__body{padding-top:42vh!important;box-sizing:border-box}',
'.banner-hero{position:absolute;top:0;left:0;right:0;height:50vh;overflow:hidden;pointer-events:none;z-index:0;-webkit-mask-image:linear-gradient(180deg,#000 55%,transparent 100%);mask-image:linear-gradient(180deg,#000 55%,transparent 100%)}',
'.banner-hero__bg{position:absolute;inset:0;background-position:center 20%;background-repeat:no-repeat;background-size:cover;opacity:0;transition:opacity .2s ease}',
'.banner-hero__bg.show{opacity:1}',
'.banner-hero:after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(0,0,0,.85),rgba(0,0,0,.55) 40%,transparent 75%)}',
'.banner-hero__info{position:absolute;left:3em;bottom:5.5em;width:46%;z-index:2}',
'.banner-hero__logo{display:none;width:auto;height:auto;max-width:100%;max-height:7em;object-fit:contain;object-position:left center;opacity:0;transition:opacity .15s ease;filter:drop-shadow(0 4px 12px rgba(0,0,0,.6))}',
'.banner-hero__logo.ready{opacity:1}',
'.banner-hero__title{font-size:2.8em;font-weight:900;line-height:1.05;color:#f5f5f1;margin-bottom:.35em;text-shadow:0 3px 14px rgba(0,0,0,.7)}',
'.banner-hero__meta{font-size:1.15em;color:#f5f5f1;margin-bottom:.6em;display:flex;gap:.8em;align-items:center;flex-wrap:wrap}',
'.banner-hero__rate{padding:.1em .5em;border-radius:6px;font-weight:800;background:#1db954;color:#fff}',
'.banner-hero__descr{font-size:1.1em;line-height:1.45;color:#f5f5f1;opacity:.85;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}',
'.interface-plus-logo-title{position:relative}',
'.interface-plus-card-logo{display:block;width:auto;height:auto;max-width:100%;max-height:105px;object-fit:contain;object-position:left center;opacity:0;transition:opacity .15s ease;filter:drop-shadow(0 3px 10px rgba(0,0,0,.45))}',
'.interface-plus-card-logo.ready{opacity:1}',
'.interface-plus-logo-title.interface-plus-logo-active{font-size:0!important;line-height:0!important}',
'.interface-plus-logo-title.interface-plus-logo-active>.interface-plus-original-title{display:none!important}',
'.interface-plus-logo-title.interface-plus-logo-active>.interface-plus-card-logo{font-size:initial;line-height:normal}',
'@media(max-width:480px){.interface-plus-card-logo{max-height:75px}.banner-hero__info{left:1.5em;width:75%}.banner-hero__logo{max-height:5em}}'
].join('\n');

function installStyle() {
    var el = document.getElementById('interface-plus-tmdb-only-style');
    if (!el) {
        el = document.createElement('style');
        el.id = 'interface-plus-tmdb-only-style';
        document.head.appendChild(el);
    }
    el.textContent = CSS;
}

/* =========================
   HERO (SMOOTH & INSTANT CLEAN)
========================= */

function createHero(root) {
    if (!root) return null;
    if (root.__interfacePlusHero && root.contains(root.__interfacePlusHero)) {
        return root.__interfacePlusHero;
    }

    var hero = document.createElement('div');
    hero.className = 'banner-hero';
    hero.innerHTML = '<div class="banner-hero__bg"></div>' +
        '<div class="banner-hero__info">' +
        '<img class="banner-hero__logo" alt=""/>' +
        '<div class="banner-hero__title"></div>' +
        '<div class="banner-hero__meta"></div>' +
        '<div class="banner-hero__descr"></div>' +
        '</div>';

    root.insertBefore(hero, root.firstChild);
    root.classList.add('banner-host');

    hero.parts = {
        bg: hero.querySelector('.banner-hero__bg'),
        logo: hero.querySelector('.banner-hero__logo'),
        title: hero.querySelector('.banner-hero__title'),
        meta: hero.querySelector('.banner-hero__meta'),
        descr: hero.querySelector('.banner-hero__descr')
    };

    hero.token = 0;
    root.__interfacePlusHero = hero;
    return hero;
}

function showHero(hero, d, force) {
    if (!hero || !d) return;

    var key = identity(d);
    if (!force && hero.movieKey === key) return;

    hero.movieKey = key;
    hero.token++;

    var token = hero.token;
    var p = hero.parts;

    // МИТТЄВО ОЧИЩАЄМО ТА ХОВАЄМО СТАРЕ ЛОГОТИП
    p.logo.classList.remove('ready');
    p.logo.style.display = 'none';
    p.logo.src = '';

    // Встановлюємо початковий стан
    p.title.style.display = '';
    p.title.textContent = movieTitle(d);
    p.logo.style.transform = 'scale(' + logoScale() + ')';
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
    type.textContent = movieType(d) === 'tv' ? 'Серіал' : 'Фільм';
    p.meta.appendChild(type);
    p.descr.textContent = d.overview || '';
    p.bg.classList.remove('show');

    if (d.backdrop_path) {
        var bg = imageURL(d.backdrop_path, 'w1280');
        preload(bg, function (ok) {
            if (!ok || hero.token !== token) return;
            p.bg.style.backgroundImage = 'url("' + bg + '")';
            p.bg.classList.add('show');
        });
    }

    function applyLogo(src, titleText) {
        if (hero.token !== token) return;

        if (titleText) {
            p.title.textContent = titleText;
        }

        if (!src) {
            p.title.style.display = '';
            p.logo.style.display = 'none';
            return;
        }

        preload(src, function (ok) {
            if (hero.token !== token || !ok) {
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

    var fastCached = cached(key);
    if (fastCached && fastCached.path) {
        applyLogo(imageURL(fastCached.path), fastCached.title || movieTitle(d));
        return;
    }

    loadLogo(d, function (result) {
        if (hero.token !== token) return;
        applyLogo(result.src, result.title || movieTitle(d));
    }, !!force);
}

function attachHero(o) {
    if (!heroEnabled() || !o) return;
    var c = text(o.component).toLowerCase();
    if (c !== 'main' && c !== 'category') return;

    var root = renderActivity(o);
    if (root) createHero(root);
}

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

    clearTimeout(focusTimer);

    // Легка 50мс затримка запобігає "дьорганню" при швидкому затисканні кнопок пульта
    focusTimer = setTimeout(function () {
        if (!heroEnabled()) return;
        lastFocusKey = key;
        activeHero = root.__interfacePlusHero;
        showHero(activeHero, d);
    }, 50);
}

function applyHero() {
    var on = heroEnabled();
    document.body.classList.toggle('banner-enabled', on);

    if (!on) {
        clearTimeout(focusTimer);
        lastFocusKey = '';
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

    if (root.classList && root.classList.contains('interface-plus-logo-title')) {
        titles.push(root);
    }

    if (root.querySelectorAll) {
        Array.prototype.push.apply(titles, root.querySelectorAll('.interface-plus-logo-title'));
    }

    titles.forEach(function (t) {
        var logo = t.querySelector('.interface-plus-card-logo');
        if (logo) {
            logo.onload = null;
            logo.onerror = null;
            logo.remove();
        }

        var original = t.querySelector('.interface-plus-original-title');
        if (original) {
            while (original.firstChild) {
                t.insertBefore(original.firstChild, original);
            }
            original.remove();
        }

        t.classList.remove('interface-plus-logo-title', 'interface-plus-logo-active');
    });
}

function findTitle(root) {
    return root && root.querySelector && root.querySelector(TITLE_SELECTOR);
}

function prepareLogo(title) {
    if (!title) return null;
    var logo = title.querySelector('.interface-plus-card-logo');
    if (logo) return logo;

    title.classList.add('interface-plus-logo-title');

    var original = document.createElement('span');
    original.className = 'interface-plus-original-title';

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
    if (restore && activeCard && activeCard.root) {
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
    var hit = cached(identity(d));
    if (!hit || !hit.path) return false;

    var title = findTitle(root);
    if (!title) return false;

    var logo = prepareLogo(title);
    if (!logo) return false;

    logo.style.transform = 'scale(' + logoScale() + ')';
    logo.style.transformOrigin = 'left center';
    logo.src = imageURL(hit.path);
    logo.classList.add('ready');
    title.classList.add('interface-plus-logo-active');
    return true;
}

function startCard(o, override, force) {
    if (!cardEnabled() || !isFull(o)) return;

    var d = override || getMovie(o);
    var root = renderActivity(o);

    if (!d || !root) return;

    var key = identity(d);

    if (!force && activeCard && activeCard.key === key && activeCard.root === root) {
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

    if (!force && showCardLogoInstant(root, d)) {
        return;
    }

    if (window.MutationObserver) {
        var observer = new MutationObserver(function () {
            if (!cardCurrent(token, key)) return;
            var title = findTitle(root);
            if (!title) return;

            if (activeCard.src && !title.querySelector('.interface-plus-card-logo')) {
                var logo = prepareLogo(title);
                if (logo) {
                    logo.style.transform = 'scale(' + logoScale() + ')';
                    logo.style.transformOrigin = 'left center';
                    logo.src = activeCard.src;
                    logo.classList.add('ready');
                    title.classList.add('interface-plus-logo-active');
                }
            }
        });

        observer.observe(root, { childList: true, subtree: true });
        activeCard.observer = observer;
    }

    loadLogo(d, function (result) {
        if (!cardCurrent(token, key)) return;

        activeCard.title = result.title || movieTitle(d);
        if (!result.src) return;

        activeCard.src = result.src;
        var title = findTitle(root);
        if (!title) return;

        var logo = prepareLogo(title);
        if (!logo) return;

        logo.style.transform = 'scale(' + logoScale() + ')';
        logo.style.transformOrigin = 'left center';
        logo.src = result.src;
        logo.classList.add('ready');
        title.classList.add('interface-plus-logo-active');
    }, !!force);
}

function refreshCard(force) {
    if (!cardEnabled()) {
        stopCard(true);
        return;
    }
    var a = activeActivity();
    if (isFull(a)) startCard(a, null, !!force);
}

function refreshAll(force) {
    lastFocusKey = '';
    if (activeHero && activeHero.movieKey) activeHero.movieKey = '';

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
    default: { family: 'Roboto, Arial, sans-serif', url: '' },
    netflix: { family: '"Netflix Sans", Arial, sans-serif', url: 'https://assets.nflxext.com/ffe/siteui/fonts/netflix-sans/v3/NetflixSans_W_Rg.woff2' },
    montserrat: { family: '"Montserrat", sans-serif', url: 'https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&display=swap' },
    inter: { family: '"Inter", sans-serif', url: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap' },
    nunito: { family: '"Nunito", sans-serif', url: 'https://fonts.googleapis.com/css2?family=Nunito:wght@300;400;600;700&display=swap' }
};

function applyFont() {
    var name = text(storageGet(S.font, 'default'));
    if (currentFont === name) return;
    currentFont = name;

    var font = FONTS[name] || FONTS.default;
    var old = document.getElementById('interface-plus-font-style');
    if (old) old.remove();
    old = document.getElementById('interface-plus-font-face');
    if (old) old.remove();

    if (font.url) {
        var face = document.createElement('style');
        face.id = 'interface-plus-font-face';
        if (font.url.indexOf('googleapis.com') !== -1) {
            face.textContent = '@import url("' + font.url + '");';
        } else {
            face.textContent = '@font-face{font-family:"Netflix Sans";src:url("' + font.url + '") format("woff2");font-weight:400}';
        }
        document.head.appendChild(face);
    }

    var style = document.createElement('style');
    style.id = 'interface-plus-font-style';
    style.textContent = 'body,.body,*{font-family:' + font.family + '!important}';
    document.head.appendChild(style);
}

function patchMaker(count) {
    if (!Lampa.Maker || !Lampa.Maker.map) return;

    ['Line', 'Category'].forEach(function (type) {
        var maker = Lampa.Maker.map(type);
        if (!maker || !maker.Items || !maker.Items.onInit) return;

        if (maker.Items.__interfacePlusPatched) {
            maker.Items.__interfacePlusCount = count;
            return;
        }

        var original = maker.Items.onInit;
        maker.Items.onInit = function () {
            original.apply(this, arguments);
            var n = maker.Items.__interfacePlusCount || count;
            if (type === 'Line') this.view = n;
            else this.limit_view = n;
        };

        maker.Items.__interfacePlusPatched = true;
        maker.Items.__interfacePlusCount = count;
    });
}

function applySize() {
    var value = parseFloat(storageGet(S.size, '10.6')) || 10.6;
    var mobile = false;

    try {
        mobile = !!(Lampa.Platform && Lampa.Platform.screen && Lampa.Platform.screen('mobile'));
    } catch (e) {}

    if (mobile) value = 10.1;
    if (String(value) === currentSize) return;

    currentSize = String(value);
    document.body.style.fontSize = value + 'px';
    patchMaker(value <= 9.6 ? 8 : value <= 11.1 ? 7 : 6);
}

/* =========================
   SETTINGS & LISTENERS
========================= */

function addSettings() {
    if (!Lampa.SettingsApi) return;
    var api = Lampa.SettingsApi;

    api.addComponent({
        component: 'interface_plus_settings',
        name: 'Інтерфейс +',
        icon: '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm0 16H5V5h14v14zM7 10h2v7H7zm4-3h2v10h-2zm4 5h2v5h-2z"/></svg>'
    });

    function add(key, type, def, name, description, values, change) {
        api.addParam({
            component: 'interface_plus_settings',
            param: { name: key, type: type, default: def, values: values },
            field: { name: name, description: description || '' },
            onChange: change
        });
    }

    add(S.hero, 'trigger', true, 'Динамічні банери', 'Преміальні банери на головній сторінці', null, applyHero);
    add(S.card, 'trigger', true, 'Логотип у картці фільму', 'Логотипи тільки з TMDB', null, function () { refreshCard(true); });
    add(S.quality, 'select', 'original', 'Якість логотипів', 'Роздільна здатність зображень TMDB', { w300: '300px', w500: '500px', original: 'Original' }, function () { refreshAll(false); });
    add(S.scale, 'select', '100', 'Розмір логотипів', 'Масштаб логотипів', { '70': '70%', '80': '80%', '90': '90%', '100': '100%', '110': '110%', '120': '120%' }, function () { refreshAll(false); });
    add('interface_plus_clear_logo_cache', 'button', '', 'Очистити кеш логотипів', 'Повторно отримати логотипи з TMDB', null, clearCache);
    add(S.size, 'select', '10.6', 'Розмір інтерфейсу', 'Масштаб елементів інтерфейсу', { '09.1': 'Міні', '09.6': 'Дуже малий', '10.1': 'Малий', '10.6': 'Середній' }, applySize);
    add(S.font, 'select', 'default', 'Шрифт інтерфейсу', 'Стиль тексту', { default: 'Roboto', netflix: 'Netflix Sans', montserrat: 'Montserrat', inter: 'Inter', nunito: 'Nunito' }, applyFont);
}

function installListeners() {
    document.addEventListener('hover:focus', onFocus, true);

    if (!Lampa.Listener) return;

    Lampa.Listener.follow('activity', function (e) {
        if (!e) return;
        if (e.type === 'start') {
            requestAnimationFrame(function () {
                attachHero(e.object);
                if (isFull(e.object)) startCard(e.object);
                else stopCard(false);
            });
        }
        if (e.type === 'destroy' && isFull(e.object)) {
            stopCard(false);
        }
    });

    Lampa.Listener.follow('full', function (e) {
        if (!e) return;
        if (e.type !== 'complete' && e.type !== 'complite') return;
        var d = e.data && e.data.movie;
        requestAnimationFrame(function () {
            var a = activeActivity();
            if (isFull(a)) startCard(a, d || null, true);
        });
    });

    try {
        if (Lampa.Storage.listener && Lampa.Storage.listener.follow) {
            Lampa.Storage.listener.follow('change', function (e) {
                if (!e || !e.name) return;
                if (e.name === S.hero) applyHero();
                if (e.name === S.card) refreshCard(true);
                if (e.name === S.font) { currentFont = ''; applyFont(); }
                if (e.name === S.size) { currentSize = ''; applySize(); }
                if (e.name === S.quality || e.name === S.scale) refreshAll(false);
            });
        }
    } catch (e) {}
}

/* =========================
   INITIALIZE
========================= */

function init() {
    if (initialized || !window.Lampa || !Lampa.Storage) return;
    initialized = true;

    installStyle();
    applyFont();
    applySize();
    applyHero();

    addSettings();
    installListeners();

    requestAnimationFrame(function () {
        var a = activeActivity();
        attachHero(a);
        if (isFull(a)) startCard(a);
    });

    log('TMDB Only smooth initialized');
}

/* =========================
   START
========================= */

if (window.appready) {
    setTimeout(init, 150);
} else if (window.Lampa && Lampa.Listener) {
    Lampa.Listener.follow('app', function (e) {
        if (e.type === 'ready') setTimeout(init, 150);
    });
}

})();
