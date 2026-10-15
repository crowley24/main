
(function () {
'use strict';

/*
 * INTERFACE+ 1.5.4 — COMPACT EDITION
 * TMDB Only • Ukrainian logos • Premium banners
 */

var VER = '1.5.4', FLAG = 'interface_plus_154';
if (window[FLAG]) return;
window[FLAG] = true;

var S = {
    hero: 'banner_hero_enabled',
    card: 'interface_plus_card_logo',
    quality: 'interface_plus_logo_quality',
    scale: 'interface_plus_logo_scale',
    size: 'interface_size',
    font: 'fontchanger_selected'
};

var CK = 'interface_plus_tmdb_cache_v154';
var DAY = 86400000, HOUR = 3600000;
var cache = {}, pending = {}, searches = {};
var epoch = 0, started = false, focusTimer;
var hero = null, card = null, cardToken = 0;
var lastFocus = '', currentFont = '', currentSize = '';

var TITLE = [
    '.full-start__title',
    '.full-start-new__title',
    '.full__title',
    '.full-card__title'
].join(',');

/* ---------- HELPERS ---------- */

function get(k, d) {
    try { return Lampa.Storage.get(k, d); }
    catch (e) { return d; }
}

function set(k, v) {
    try { Lampa.Storage.set(k, v); }
    catch (e) {}
}

function enabled(k) {
    var v = get(k, true);
    return v === true || v === 'true' || v === 1;
}

function str(v) {
    return String(v == null ? '' : v).trim();
}

function first() {
    for (var i = 0; i < arguments.length; i++) {
        var v = str(arguments[i]);
        if (v) return v;
    }
    return '';
}

function el(v) {
    return v && v.nodeType === 1 ? v :
        v && v[0] && v[0].nodeType === 1 ? v[0] : null;
}

function root(o) {
    try {
        return el(o.activity && o.activity.render ?
            o.activity.render(true) : o.render(true));
    } catch (e) { return null; }
}

function active() {
    try { return Lampa.Activity.active(); }
    catch (e) { return null; }
}

function full(o) {
    return /^(full|full_start|fullstart)$/.test(
        str(o && o.component).toLowerCase());
}

function type(d) {
    return d && (
        d.media_type === 'tv' || d.type === 'tv' ||
        d.type === 'series' || d.first_air_date ||
        d.number_of_seasons || (d.name && !d.title)
    ) ? 'tv' : 'movie';
}

function name(d) {
    return first(d && d.title, d && d.name,
        d && d.original_title, d && d.original_name);
}

function year(d) {
    var m = first(d && d.release_date,
        d && d.first_air_date, d && d.year)
        .match(/\b(19|20)\d{2}\b/);
    return m ? m[0] : '';
}

function norm(s) {
    return str(s).toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .replace(/\s+/g, ' ').trim();
}

function ident(d) {
    return [type(d), first(d && d.tmdb_id,
        d && d.tmdbId, d && d.id),
        norm(name(d)), year(d)].join('|');
}

function movie(o) {
    if (!o) return null;
    var a = [
        o.movie, o.data && o.data.movie, o.data,
        o.card, o.card_data,
        o.params && o.params.movie,
        o.params && o.params.data,
        o.activity && o.activity.movie,
        o.activity && o.activity.data
    ], best = null, score = -1;

    a.forEach(function (d) {
        if (!d || typeof d !== 'object' || !name(d)) return;
        var s = 10 + (year(d) ? 4 : 0) +
            (d.tmdb_id || d.tmdbId ? 5 : 0) +
            (d.id ? 2 : 0) + (d.backdrop_path ? 2 : 0);
        if (s > score) { best = d; score = s; }
    });
    return best;
}

function quality() {
    var q = str(get(S.quality, 'original'));
    return /^(w300|w500|original)$/.test(q) ? q : 'original';
}

function scale() {
    return Math.max(70, Math.min(120,
        parseInt(get(S.scale, '100'), 10) || 100)) / 100;
}

function img(path, size) {
    if (!path) return '';
    return 'https://image.tmdb.org/t/p/' +
        (size || quality()) + '/' +
        str(path).replace(/^\//, '').replace(/\.svg$/i, '.png');
}

function preload(src, cb) {
    if (!src) return cb(false);
    var i = new Image(), done = false;
    function end(ok) {
        if (done) return;
        done = true;
        i.onload = i.onerror = null;
        cb(ok);
    }
    i.onload = function () { end(true); };
    i.onerror = function () { end(false); };
    i.src = src;
    if (i.complete && i.naturalWidth) end(true);
}

/* ---------- TMDB API ---------- */

function api(path, params, cb) {
    var key = '';
    try { key = Lampa.TMDB.key(); } catch (e) {}
    if (!key || typeof $ === 'undefined') return cb(null, true);

    var url = 'https://api.themoviedb.org/3/' + path +
        '?api_key=' + encodeURIComponent(key);

    Object.keys(params || {}).forEach(function (k) {
        if (params[k] !== '' && params[k] != null)
            url += '&' + encodeURIComponent(k) + '=' +
                encodeURIComponent(params[k]);
    });

    $.ajax({
        url: url, type: 'GET', dataType: 'json', timeout: 12000,
        success: function (d) { cb(d, false); },
        error: function () { cb(null, true); }
    });
}

function details(t, id, cb) {
    api(t + '/' + id, {
        language: 'uk-UA',
        append_to_response: 'images',
        include_image_language: 'uk,en,null'
    }, cb);
}

function matching(a, b) {
    if (!a || !b) return false;
    var ya = year(a), yb = year(b);
    if (ya && yb && Math.abs(+ya - +yb) > 1) return false;

    var x = [a.title, a.name, a.original_title, a.original_name];
    var y = [b.title, b.name, b.original_title, b.original_name];

    return x.some(function (v) {
        return v && y.some(function (w) {
            return w && norm(v) === norm(w);
        });
    });
}

function search(d, cb) {
    var t = type(d), n = name(d), y = year(d);
    if (!n) return cb(null);

    var k = [t, norm(n), y].join('|');
    if (searches[k]) return searches[k].push(cb);
    searches[k] = [cb];

    var params = {
        query: n, language: 'uk-UA', include_adult: 'false'
    };
    if (y) params[t === 'tv' ? 'first_air_date_year' : 'year'] = y;

    api('search/' + t, params, function (res) {
        var list = res && Array.isArray(res.results) ?
            res.results.filter(function (x) {
                return matching(d, x);
            }) : [];

        list.sort(function (a, b) {
            return (+b.popularity || 0) - (+a.popularity || 0);
        });

        var callbacks = searches[k] || [];
        delete searches[k];
        callbacks.forEach(function (fn) {
            try { fn(list[0] || null); } catch (e) {}
        });
    });
}

function resolve(d, cb) {
    var t = type(d);
    var explicit = first(d.tmdb_id, d.tmdbId);
    var id = first(explicit, d.id);

    function fallback() {
        search(d, function (found) {
            if (!found) return cb(null, true);
            details(t, found.id, cb);
        });
    }

    if (!/^\d+$/.test(id)) return fallback();

    details(t, id, function (res, err) {
        if (!err && res &&
            (matching(d, res) ||
             (explicit && str(res.id) === explicit))) {
            cb(res, false);
        } else fallback();
    });
}

function pickLogo(list) {
    if (!Array.isArray(list)) return null;

    for (var i = 0; i < 2; i++) {
        var lang = i ? 'en' : 'uk';
        var a = list.filter(function (x) {
            return x && x.file_path && x.iso_639_1 === lang;
        });

        a.sort(function (x, y) {
            return (+y.vote_average || 0) -
                (+x.vote_average || 0) ||
                (+y.vote_count || 0) - (+x.vote_count || 0);
        });

        if (a.length) return a[0].file_path;
    }
    return '';
}

/* ---------- CACHE + LOGOS ---------- */

function readDB() {
    var v = get(CK, {});
    return v && typeof v === 'object' ? v : {};
}

function valid(v) {
    var ttl = v && v.failed ? 60000 :
        v && v.path ? DAY : HOUR;
    return !!(v && v.time && Date.now() - v.time < ttl);
}

function save(k, v) {
    cache[k] = v;
    if (v.failed) return;

    var db = readDB();
    db[k] = v;
    var keys = Object.keys(db);
    if (keys.length > 120) {
        keys.sort(function (a, b) {
            return (db[a].time || 0) - (db[b].time || 0);
        });
        keys.slice(0, keys.length - 120).forEach(function (x) {
            delete db[x];
        });
    }
    set(CK, db);
}

function logo(d, cb, force) {
    if (!d) return cb({ src: '', title: '' });
    var k = ident(d), fallback = name(d);

    if (!force) {
        var hit = valid(cache[k]) ? cache[k] : readDB()[k];
        if (valid(hit)) {
            cache[k] = hit;
            return cb({
                src: img(hit.path),
                title: hit.title || fallback
            });
        }
    }

    if (pending[k]) return pending[k].push(cb);
    pending[k] = [cb];
    var requestEpoch = epoch;

    resolve(d, function (res, err) {
        if (requestEpoch !== epoch) return;

        var v = {
            path: !err && res ? pickLogo(
                res.images && res.images.logos) : '',
            title: !err && res ?
                first(type(d) === 'tv' ? res.name : res.title,
                    fallback) : fallback,
            failed: !!err,
            time: Date.now()
        };

        save(k, v);
        var callbacks = pending[k] || [];
        delete pending[k];

        callbacks.forEach(function (fn) {
            try {
                fn({ src: img(v.path), title: v.title });
            } catch (e) {}
        });
    });
}

function clearCache() {
    epoch++;
    cache = {};
    pending = {};
    searches = {};

    [
        CK,
        'interface_plus_tmdb_only_cache_v153',
        'interface_plus_logo_cache_v152',
        'interface_plus_logo_cache_v151',
        'interface_plus_logo_cache_v150'
    ].forEach(function (k) { set(k, {}); });

    refresh(true);
    try { Lampa.Noty.show('Кеш логотипів очищено'); }
    catch (e) {}
}

/* ---------- STYLES ---------- */

var CSS = [
'.banner-host{position:relative}',
'.banner-enabled .banner-host .activity__body{padding-top:42vh!important;box-sizing:border-box}',
'.banner-hero{position:absolute;inset:0 0 auto;height:50vh;overflow:hidden;pointer-events:none;z-index:0;-webkit-mask-image:linear-gradient(180deg,#000 55%,transparent 100%);mask-image:linear-gradient(180deg,#000 55%,transparent 100%)}',
'.banner-hero__bg{position:absolute;inset:0;background-size:cover;background-position:center 20%;background-repeat:no-repeat;opacity:0;transition:opacity .35s ease}',
'.banner-hero__bg.show{opacity:1}',
'.banner-hero:after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(0,0,0,.85),rgba(0,0,0,.55) 40%,transparent 75%)}',
'.banner-hero__info{position:absolute;left:3em;bottom:5.5em;width:46%;z-index:2}',
'.banner-hero__logo{display:block;width:auto;height:auto;max-width:100%;max-height:7em;object-fit:contain;object-position:left center;opacity:0;transition:opacity .25s ease;filter:drop-shadow(0 4px 12px rgba(0,0,0,.6))}',
'.banner-hero__logo.ready{opacity:1}',
'.banner-hero__title{font-size:2.8em;font-weight:900;line-height:1.05;color:#f5f5f1;margin-bottom:.35em;text-shadow:0 3px 14px rgba(0,0,0,.7)}',
'.banner-hero__meta{font-size:1.15em;color:#f5f5f1;margin-bottom:.6em;display:flex;gap:.8em;align-items:center;flex-wrap:wrap}',
'.banner-hero__rate{padding:.1em .5em;border-radius:6px;font-weight:800;background:#1db954;color:#fff}',
'.banner-hero__descr{font-size:1.1em;line-height:1.45;color:#f5f5f1;opacity:.85;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}',
'.interface-plus-logo-title{position:relative}',
'.interface-plus-card-logo{display:block;width:auto;height:auto;max-width:100%;max-height:105px;object-fit:contain;object-position:left center;opacity:0;transition:opacity .25s ease;filter:drop-shadow(0 3px 10px rgba(0,0,0,.45))}',
'.interface-plus-card-logo.ready{opacity:1}',
'.interface-plus-logo-title.interface-plus-logo-active{font-size:0!important;line-height:0!important}',
'.interface-plus-logo-active>.interface-plus-original-title{display:none!important}',
'.interface-plus-logo-active>.interface-plus-card-logo{font-size:initial;line-height:normal}',
'@media(max-width:480px){.interface-plus-card-logo{max-height:75px}.banner-hero__info{left:1.5em;width:75%}.banner-hero__logo{max-height:5em}}'
].join('\n');

function style() {
    var e = document.getElementById('interface-plus-154-css');
    if (!e) {
        e = document.createElement('style');
        e.id = 'interface-plus-154-css';
        document.head.appendChild(e);
    }
    e.textContent = CSS;
}

/* ---------- HERO ---------- */

function makeHero(r) {
    if (!r) return null;
    if (r.__ipHero && r.contains(r.__ipHero)) return r.__ipHero;

    var h = document.createElement('div');
    h.className = 'banner-hero';
    h.innerHTML =
        '<div class="banner-hero__bg"></div>' +
        '<div class="banner-hero__info">' +
        '<img class="banner-hero__logo" alt=""/>' +
        '<div class="banner-hero__title"></div>' +
        '<div class="banner-hero__meta"></div>' +
        '<div class="banner-hero__descr"></div></div>';

    r.insertBefore(h, r.firstChild);
    r.classList.add('banner-host');

    h.parts = {
        bg: h.querySelector('.banner-hero__bg'),
        logo: h.querySelector('.banner-hero__logo'),
        title: h.querySelector('.banner-hero__title'),
        meta: h.querySelector('.banner-hero__meta'),
        descr: h.querySelector('.banner-hero__descr')
    };
    h.token = 0;
    r.__ipHero = h;
    return h;
}

function showHero(h, d, force) {
    if (!h || !d) return;
    var key = ident(d);
    if (!force && h.key === key) return;

    h.key = key;
    var token = ++h.token, p = h.parts;

    p.logo.classList.remove('ready');
    p.logo.style.display = 'none';
    p.logo.removeAttribute('src');
    p.logo.style.transform = 'scale(' + scale() + ')';
    p.logo.style.transformOrigin = 'left center';

    p.title.style.display = '';
    p.title.textContent = name(d);
    p.descr.textContent = d.overview || '';
    p.meta.textContent = '';

    var rate = +d.vote_average || 0;
    if (rate > 0) {
        var r = document.createElement('span');
        r.className = 'banner-hero__rate';
        r.textContent = rate.toFixed(1);
        p.meta.appendChild(r);
    }

    [year(d), type(d) === 'tv' ? 'Серіал' : 'Фільм']
        .filter(Boolean).forEach(function (v) {
            var e = document.createElement('span');
            e.textContent = v;
            p.meta.appendChild(e);
        });

    p.bg.classList.remove('show');
    p.bg.style.backgroundImage = 'none';

    if (d.backdrop_path) {
        var bg = img(d.backdrop_path, 'w1280');
        preload(bg, function (ok) {
            if (!ok || token !== h.token) return;
            p.bg.style.backgroundImage = 'url("' + bg + '")';
            requestAnimationFrame(function () {
                if (token === h.token) p.bg.classList.add('show');
            });
        });
    }

    logo(d, function (v) {
        if (token !== h.token) return;
        p.title.textContent = v.title || name(d);
        if (!v.src) return;

        preload(v.src, function (ok) {
            if (!ok || token !== h.token) return;
            p.logo.src = v.src;
            p.logo.style.display = 'block';
            requestAnimationFrame(function () {
                if (token !== h.token) return;
                p.logo.classList.add('ready');
                p.title.style.display = 'none';
            });
        });
    }, !!force);
}

function attachHero(o) {
    if (!enabled(S.hero) || !o ||
        !/^(main|category)$/.test(str(o.component))) return;
    makeHero(root(o));
}

function focus(e) {
    if (!enabled(S.hero) || !e.target ||
        !e.target.closest) return;

    var c = e.target.closest('.card');
    if (!c || !c.card_data) return;

    var a = c.closest('.activity');
    if (!a || !a.__ipHero) return;

    var d = c.card_data, key = ident(d);
    if (lastFocus === key) return;

    clearTimeout(focusTimer);
    focusTimer = setTimeout(function () {
        if (!enabled(S.hero) || !a.isConnected) return;
        lastFocus = key;
        hero = a.__ipHero;
        showHero(hero, d);
    }, 220);
}

function applyHero() {
    document.body.classList.toggle(
        'banner-enabled', enabled(S.hero));
    if (enabled(S.hero)) attachHero(active());
    else {
        clearTimeout(focusTimer);
        lastFocus = '';
    }
}

/* ---------- CARD LOGOS ---------- */

function titleNode(r) {
    return r && r.querySelector && r.querySelector(TITLE);
}

function restore(r) {
    if (!r) return;
    var list = [];
    if (r.classList &&
        r.classList.contains('interface-plus-logo-title')) list.push(r);

    if (r.querySelectorAll)
        Array.prototype.push.apply(list,
            r.querySelectorAll('.interface-plus-logo-title'));

    list.forEach(function (t) {
        var image = t.querySelector('.interface-plus-card-logo');
        if (image) {
            image.onload = image.onerror = null;
            image.remove();
        }
        var old = t.querySelector('.interface-plus-original-title');
        if (old) {
            while (old.firstChild)
                t.insertBefore(old.firstChild, old);
            old.remove();
        }
        t.classList.remove('interface-plus-logo-title',
            'interface-plus-logo-active');
    });
}

function stopCard(revert) {
    cardToken++;
    if (card && card.observer) card.observer.disconnect();
    if (revert && card) restore(card.root);
    card = null;
}

function cardOK(token, key) {
    return !!(card && cardToken === token &&
        card.key === key && card.root &&
        card.root.isConnected && enabled(S.card));
}

function cardText(token, key, value) {
    if (!cardOK(token, key)) return;
    var t = titleNode(card.root);
    if (!t) return;
    restore(t);
    if (value) t.textContent = value;
}

function cardLogo(token, key, src) {
    if (!cardOK(token, key)) return;
    var t = titleNode(card.root);
    if (!t) return;

    var image = t.querySelector('.interface-plus-card-logo');
    if (!image) {
        t.classList.add('interface-plus-logo-title');
        var old = document.createElement('span');
        old.className = 'interface-plus-original-title';
        while (t.firstChild) old.appendChild(t.firstChild);
        t.appendChild(old);

        image = document.createElement('img');
        image.className = 'interface-plus-card-logo';
        image.alt = '';
        image.draggable = false;
        t.appendChild(image);
    }

    image.style.transform = 'scale(' + scale() + ')';
    image.style.transformOrigin = 'left center';

    image.onload = function () {
        if (!cardOK(token, key)) return;
        image.classList.add('ready');
        t.classList.add('interface-plus-logo-active');
    };

    image.onerror = function () {
        if (cardOK(token, key)) cardText(token, key, card.title);
    };

    image.src = src;
    if (image.complete && image.naturalWidth) image.onload();
}

function startCard(o, override, force) {
    if (!enabled(S.card) || !full(o)) return;
    var d = override || movie(o), r = root(o);
    if (!d || !r) return;

    var key = ident(d);
    if (!force && card && card.key === key && card.root === r)
        return;

    stopCard(false);
    var token = cardToken;

    card = {
        root: r, key: key, title: name(d),
        src: '', observer: null
    };

    if (window.MutationObserver) {
        card.observer = new MutationObserver(function () {
            if (!cardOK(token, key) || !card.src) return;
            var t = titleNode(r);
            if (t && !t.querySelector('.interface-plus-card-logo'))
                cardLogo(token, key, card.src);
        });

        card.observer.observe(r, {
            childList: true, subtree: true
        });
    }

    logo(d, function (v) {
        if (!cardOK(token, key)) return;
        card.title = v.title || name(d);

        if (!v.src)
            return cardText(token, key, card.title);

        preload(v.src, function (ok) {
            if (!cardOK(token, key)) return;
            if (!ok) return cardText(token, key, card.title);
            card.src = v.src;
            cardLogo(token, key, v.src);
        });
    }, !!force);
}

function refresh(force) {
    lastFocus = '';
    if (hero) hero.key = '';
    var a = active();
    if (full(a)) {
        stopCard(true);
        startCard(a, null, !!force);
    }
}

/* ---------- FONTS ---------- */

var FONTS = {
    default: ['Roboto,Arial,sans-serif', ''],
    netflix: ['"Netflix Sans",Arial,sans-serif',
        'https://assets.nflxext.com/ffe/siteui/fonts/netflix-sans/v3/NetflixSans_W_Rg.woff2'],
    montserrat: ['"Montserrat",sans-serif',
        'https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&display=swap'],
    inter: ['"Inter",sans-serif',
        'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap'],
    nunito: ['"Nunito",sans-serif',
        'https://fonts.googleapis.com/css2?family=Nunito:wght@300;400;600;700&display=swap']
};

function font() {
    var k = str(get(S.font, 'default'));
    if (k === currentFont) return;
    currentFont = k;

    var f = FONTS[k] || FONTS.default;
    ['interface-plus-font-style',
     'interface-plus-font-face'].forEach(function (id) {
        var e = document.getElementById(id);
        if (e) e.remove();
    });

    if (f[1]) {
        var face = document.createElement('style');
        face.id = 'interface-plus-font-face';
        face.textContent = f[1].indexOf('googleapis.com') >= 0 ?
            '@import url("' + f[1] + '");' :
            '@font-face{font-family:"Netflix Sans";src:url("' +
            f[1] + '") format("woff2");font-weight:400}';
        document.head.appendChild(face);
    }

    var e = document.createElement('style');
    e.id = 'interface-plus-font-style';
    e.textContent = 'body,.body,*{font-family:' +
        f[0] + '!important}';
    document.head.appendChild(e);
}

/* ---------- INTERFACE SIZE ---------- */

function patchMaker(n) {
    if (!Lampa.Maker || !Lampa.Maker.map) return;

    ['Line', 'Category'].forEach(function (t) {
        var m = Lampa.Maker.map(t);
        if (!m || !m.Items || !m.Items.onInit) return;

        if (m.Items.__ipPatched) {
            m.Items.__ipCount = n;
            return;
        }

        var original = m.Items.onInit;
        m.Items.onInit = function () {
            original.apply(this, arguments);
            var count = m.Items.__ipCount || n;
            if (t === 'Line') this.view = count;
            else this.limit_view = count;
        };
        m.Items.__ipPatched = true;
        m.Items.__ipCount = n;
    });
}

function size() {
    var v = parseFloat(get(S.size, '10.6')) || 10.6;
    try {
        if (Lampa.Platform.screen('mobile')) v = 10.1;
    } catch (e) {}

    if (currentSize === String(v)) return;
    currentSize = String(v);
    document.body.style.fontSize = v + 'px';
    patchMaker(v <= 9.6 ? 8 : v <= 11.1 ? 7 : 6);
}

/* ---------- SETTINGS ---------- */

function settings() {
    if (!Lampa.SettingsApi) return;
    var api = Lampa.SettingsApi;

    api.addComponent({
        component: 'interface_plus_settings',
        name: 'Інтерфейс +',
        icon: '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm0 16H5V5h14v14zM7 10h2v7H7zm4-3h2v10h-2zm4 5h2v5h-2z"/></svg>'
    });

    function add(key, type, def, label, desc, values, cb) {
        api.addParam({
            component: 'interface_plus_settings',
            param: {
                name: key, type: type,
                default: def, values: values
            },
            field: { name: label, description: desc },
            onChange: cb
        });
    }

    add(S.hero, 'trigger', true, 'Динамічні банери',
        'Преміальні банери на головній сторінці',
        null, applyHero);

    add(S.card, 'trigger', true, 'Логотип у картці фільму',
        'Український або англійський логотип з TMDB',
        null, function () {
            if (enabled(S.card)) refresh(true);
            else stopCard(true);
        });

    add(S.quality, 'select', 'original', 'Якість логотипів',
        'Роздільна здатність зображень',
        { w300: '300px', w500: '500px', original: 'Original' },
        function () { refresh(false); });

    add(S.scale, 'select', '100', 'Розмір логотипів',
        'Масштаб логотипів',
        {
            '70': '70%', '80': '80%', '90': '90%',
            '100': '100%', '110': '110%', '120': '120%'
        }, function () { refresh(false); });

    add('interface_plus_clear_logo_cache', 'button', '',
        'Очистити кеш логотипів',
        'Повторно завантажити логотипи з TMDB',
        null, clearCache);

    add(S.size, 'select', '10.6', 'Розмір інтерфейсу',
        'Масштаб елементів',
        {
            '09.1': 'Міні', '09.6': 'Дуже малий',
            '10.1': 'Малий', '10.6': 'Середній'
        }, size);

    add(S.font, 'select', 'default', 'Шрифт інтерфейсу',
        'Стиль тексту',
        {
            default: 'Roboto', netflix: 'Netflix Sans',
            montserrat: 'Montserrat', inter: 'Inter',
            nunito: 'Nunito'
        }, function () {
            currentFont = '';
            font();
        });
}

/* ---------- EVENTS ---------- */

function listeners() {
    document.addEventListener('hover:focus', focus, true);

    if (Lampa.Listener) {
        Lampa.Listener.follow('activity', function (e) {
            if (!e) return;

            if (e.type === 'start') {
                requestAnimationFrame(function () {
                    attachHero(e.object);
                    if (full(e.object)) startCard(e.object);
                    else stopCard(false);
                });
            }

            if (e.type === 'destroy' && full(e.object))
                stopCard(false);
        });

        Lampa.Listener.follow('full', function (e) {
            if (!e || !/^(complete|complite)$/.test(e.type))
                return;

            requestAnimationFrame(function () {
                var a = active();
                if (full(a))
                    startCard(a, e.data && e.data.movie, true);
            });
        });
    }

    try {
        Lampa.Storage.listener.follow('change', function (e) {
            if (!e || !e.name) return;
            if (e.name === S.hero) applyHero();
            if (e.name === S.card) {
                if (enabled(S.card)) refresh(true);
                else stopCard(true);
            }
            if (e.name === S.font) {
                currentFont = '';
                font();
            }
            if (e.name === S.size) {
                currentSize = '';
                size();
            }
            if (e.name === S.quality || e.name === S.scale)
                refresh(false);
        });
    } catch (e) {}
}

/* ---------- START ---------- */

function init() {
    if (started || !window.Lampa || !Lampa.Storage)
        return;

    started = true;
    style();
    font();
    size();
    applyHero();
    settings();
    listeners();

    requestAnimationFrame(function () {
        var a = active();
        attachHero(a);
        if (full(a)) startCard(a);
    });

    console.log('[INTERFACE+] ' + VER + ' Compact Edition');
}

if (window.appready) {
    setTimeout(init, 400);
} else if (window.Lampa && Lampa.Listener) {
    Lampa.Listener.follow('app', function (e) {
        if (e.type === 'ready') setTimeout(init, 400);
    });
}

})();
