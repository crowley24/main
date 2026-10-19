
(function () {
    'use strict';

    /*
     * INTERFACE+ 1.6.0 — CINEMATIC PREMIUM
     * Lampa / Android TV / Mobile
     *
     * TMDB only
     * Ukrainian -> English -> text fallback
     * Cinematic hero / card logos / cache
     */

    var VERSION = '1.6.0';
    var FLAG = '__interface_plus_160';

    if (window[FLAG]) return;

    var previous = window.__interface_plus_runtime;
    if (previous && typeof previous.destroy === 'function') {
        try { previous.destroy(); } catch (e) {}
    }

    window[FLAG] = true;

    var S = {
        hero: 'banner_hero_enabled',
        card: 'interface_plus_card_logo',
        quality: 'interface_plus_logo_quality',
        scale: 'interface_plus_logo_scale',
        size: 'interface_size',
        font: 'fontchanger_selected'
    };

    var CACHE_KEY = 'interface_plus_tmdb_cache_v160';
    var DAY = 86400000;
    var HOUR = 3600000;
    var MAX_CACHE = 120;

    var cache = {};
    var pending = {};
    var searches = {};
    var epoch = 0;

    var started = false;
    var destroyed = false;
    var focusTimer = null;
    var refreshTimer = null;
    var hero = null;
    var card = null;
    var cardToken = 0;
    var lastFocus = '';
    var currentFont = '';
    var currentSize = '';

    var listeners = [];
    var styles = [];

    var TITLE_SELECTORS = [
        '.full-start__title',
        '.full-start-new__title',
        '.full__title',
        '.full-card__title'
    ].join(',');

    /* ========================================
       HELPERS
    ======================================== */

    function get(k, d) {
        try {
            return Lampa.Storage.get(k, d);
        } catch (e) {
            return d;
        }
    }

    function set(k, v) {
        try {
            Lampa.Storage.set(k, v);
        } catch (e) {}
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

    function element(v) {
        if (v && v.nodeType === 1) return v;
        if (v && v[0] && v[0].nodeType === 1) return v[0];
        return null;
    }

    function activityRoot(o) {
        if (!o) return null;

        try {
            if (o.activity && o.activity.render) {
                return element(o.activity.render(true));
            }

            if (o.render) {
                return element(o.render(true));
            }
        } catch (e) {}

        return null;
    }

    function active() {
        try {
            return Lampa.Activity.active();
        } catch (e) {
            return null;
        }
    }

    function isFull(o) {
        return /^(full|full_start|fullstart)$/.test(
            str(o && o.component).toLowerCase()
        );
    }

    function isHome(o) {
        return /^(main|category)$/.test(
            str(o && o.component).toLowerCase()
        );
    }

    function mediaType(d) {
        if (!d) return 'movie';

        return (
            d.media_type === 'tv' ||
            d.type === 'tv' ||
            d.type === 'series' ||
            d.first_air_date ||
            d.number_of_seasons ||
            (d.name && !d.title)
        ) ? 'tv' : 'movie';
    }

    function mediaName(d) {
        return first(
            d && d.title,
            d && d.name,
            d && d.original_title,
            d && d.original_name
        );
    }

    function mediaYear(d) {
        var m = first(
            d && d.release_date,
            d && d.first_air_date,
            d && d.year
        ).match(/\b(19|20)\d{2}\b/);

        return m ? m[0] : '';
    }

    function normalize(s) {
        s = str(s).toLowerCase();

        try {
            s = s.normalize('NFKD');
        } catch (e) {}

        return s
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9\u0400-\u052f]+/gi, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function mediaKey(d) {
        return [
            mediaType(d),
            first(d && d.tmdb_id, d && d.tmdbId, d && d.id),
            normalize(mediaName(d)),
            mediaYear(d)
        ].join('|');
    }

    function mediaFromActivity(o) {
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
            if (!mediaName(d)) return;

            var s = 10;

            if (mediaYear(d)) s += 4;
            if (d.tmdb_id || d.tmdbId) s += 5;
            if (d.id) s += 2;
            if (d.backdrop_path) s += 2;
            if (d.overview) s += 1;

            if (s > score) {
                best = d;
                score = s;
            }
        });

        return best;
    }

    function quality() {
        var q = str(get(S.quality, 'original'));

        return /^(w300|w500|original)$/.test(q)
            ? q
            : 'original';
    }

    function logoScale() {
        var n = parseInt(get(S.scale, '100'), 10);

        if (!n) n = 100;

        return Math.max(70, Math.min(120, n)) / 100;
    }

    function imageUrl(path, size) {
        if (!path) return '';

        return 'https://image.tmdb.org/t/p/' +
            (size || quality()) + '/' +
            str(path)
                .replace(/^\//, '')
                .replace(/\.svg$/i, '.png');
    }

    function preload(src, cb) {
        if (!src) {
            cb(false);
            return;
        }

        var image = new Image();
        var completed = false;

        function finish(ok) {
            if (completed) return;

            completed = true;
            image.onload = null;
            image.onerror = null;

            cb(ok);
        }

        image.onload = function () {
            finish(true);
        };

        image.onerror = function () {
            finish(false);
        };

        image.src = src;

        if (image.complete && image.naturalWidth) {
            finish(true);
        }
    }

    function raf(fn) {
        if (window.requestAnimationFrame) {
            requestAnimationFrame(fn);
        } else {
            setTimeout(fn, 16);
        }
    }

    /* ========================================
       TMDB API
    ======================================== */

    function tmdbApi(path, params, cb) {
        var key = '';

        try {
            key = Lampa.TMDB.key();
        } catch (e) {}

        if (!key || typeof $ === 'undefined') {
            cb(null, true);
            return;
        }

        var url = 'https://api.themoviedb.org/3/' +
            path + '?api_key=' + encodeURIComponent(key);

        Object.keys(params || {}).forEach(function (k) {
            if (params[k] !== '' && params[k] != null) {
                url += '&' + encodeURIComponent(k) +
                    '=' + encodeURIComponent(params[k]);
            }
        });

        $.ajax({
            url: url,
            type: 'GET',
            dataType: 'json',
            timeout: 12000,

            success: function (data) {
                cb(data, false);
            },

            error: function () {
                cb(null, true);
            }
        });
    }

    function tmdbDetails(type, id, cb) {
        tmdbApi(type + '/' + id, {
            language: 'uk-UA',
            append_to_response: 'images',
            include_image_language: 'uk,en,null'
        }, cb);
    }

    function matches(a, b) {
        if (!a || !b) return false;

        var ya = mediaYear(a);
        var yb = mediaYear(b);

        if (ya && yb && Math.abs(+ya - +yb) > 1) {
            return false;
        }

        var x = [
            a.title,
            a.name,
            a.original_title,
            a.original_name
        ];

        var y = [
            b.title,
            b.name,
            b.original_title,
            b.original_name
        ];

        return x.some(function (v) {
            return v && y.some(function (w) {
                return w && normalize(v) === normalize(w);
            });
        });
    }

    function tmdbSearch(d, cb) {
        var type = mediaType(d);
        var name = mediaName(d);
        var year = mediaYear(d);

        if (!name) {
            cb(null);
            return;
        }

        var key = [
            type,
            normalize(name),
            year
        ].join('|');

        if (searches[key]) {
            searches[key].push(cb);
            return;
        }

        searches[key] = [cb];

        var params = {
            query: name,
            language: 'uk-UA',
            include_adult: 'false'
        };

        if (year) {
            params[
                type === 'tv'
                    ? 'first_air_date_year'
                    : 'year'
            ] = year;
        }

        tmdbApi('search/' + type, params, function (res) {
            var list = res && Array.isArray(res.results)
                ? res.results.filter(function (item) {
                    return matches(d, item);
                })
                : [];

            list.sort(function (a, b) {
                return (+b.popularity || 0) -
                    (+a.popularity || 0);
            });

            var callbacks = searches[key] || [];
            delete searches[key];

            callbacks.forEach(function (fn) {
                try {
                    fn(list[0] || null);
                } catch (e) {}
            });
        });
    }

    function resolveMedia(d, cb) {
        var type = mediaType(d);

        var explicit = first(
            d.tmdb_id,
            d.tmdbId
        );

        function fallback() {
            tmdbSearch(d, function (found) {
                if (!found) {
                    cb(null, true);
                    return;
                }

                tmdbDetails(type, found.id, cb);
            });
        }

        if (!/^\d+$/.test(explicit)) {
            fallback();
            return;
        }

        tmdbDetails(type, explicit, function (res, err) {
            if (!err && res && (
                matches(d, res) ||
                str(res.id) === explicit
            )) {
                cb(res, false);
            } else {
                fallback();
            }
        });
    }

    /* ========================================
       SMART LOGO ENGINE
    ======================================== */

    function rankedLogos(list) {
        if (!Array.isArray(list)) return [];

        var result = [];

        ['uk', 'en'].forEach(function (lang) {
            var items = list.filter(function (x) {
                return x &&
                    x.file_path &&
                    x.iso_639_1 === lang;
            });

            items.sort(function (a, b) {
                return (+b.vote_average || 0) -
                    (+a.vote_average || 0) ||
                    (+b.vote_count || 0) -
                    (+a.vote_count || 0);
            });

            items.forEach(function (x) {
                if (result.indexOf(x.file_path) < 0) {
                    result.push(x.file_path);
                }
            });
        });

        return result.slice(0, 8);
    }

    function readCache() {
        var data = get(CACHE_KEY, {});

        return data && typeof data === 'object'
            ? data
            : {};
    }

    function cacheValid(v) {
        if (!v || !v.time) return false;

        var ttl = v.failed
            ? 60000
            : v.logos && v.logos.length
                ? DAY
                : HOUR;

        return Date.now() - v.time < ttl;
    }

    function saveCache(key, value) {
        cache[key] = value;

        if (value.failed) return;

        var db = readCache();
        db[key] = value;

        var keys = Object.keys(db);

        if (keys.length > MAX_CACHE) {
            keys.sort(function (a, b) {
                return (db[a].time || 0) -
                    (db[b].time || 0);
            });

            keys.slice(
                0,
                keys.length - MAX_CACHE
            ).forEach(function (k) {
                delete db[k];
            });
        }

        set(CACHE_KEY, db);
    }

    function getLogoData(d, cb, force) {
        if (!d) {
            cb({
                logos: [],
                title: ''
            });
            return;
        }

        var key = mediaKey(d);
        var fallback = mediaName(d);

        if (!force) {
            var hit = cacheValid(cache[key])
                ? cache[key]
                : readCache()[key];

            if (cacheValid(hit)) {
                cache[key] = hit;

                cb({
                    logos: hit.logos || [],
                    title: hit.title || fallback
                });
                return;
            }
        }

        if (pending[key]) {
            pending[key].push(cb);
            return;
        }

        pending[key] = [cb];

        var requestEpoch = epoch;

        resolveMedia(d, function (res, err) {
            if (requestEpoch !== epoch || destroyed) {
                return;
            }

            var value = {
                logos: !err && res
                    ? rankedLogos(
                        res.images && res.images.logos
                    )
                    : [],

                title: !err && res
                    ? first(
                        mediaType(d) === 'tv'
                            ? res.name
                            : res.title,
                        fallback
                    )
                    : fallback,

                failed: !!err,
                time: Date.now()
            };

            saveCache(key, value);

            var callbacks = pending[key] || [];
            delete pending[key];

            callbacks.forEach(function (fn) {
                try {
                    fn({
                        logos: value.logos,
                        title: value.title
                    });
                } catch (e) {}
            });
        });
    }

    function loadBestLogo(paths, cb) {
        var index = 0;

        function next() {
            if (!paths || index >= paths.length) {
                cb('');
                return;
            }

            var src = imageUrl(paths[index++]);

            preload(src, function (ok) {
                if (ok) {
                    cb(src);
                } else {
                    next();
                }
            });
        }

        next();
    }

    /* ========================================
       CINEMATIC CSS
    ======================================== */

    var CSS = [
        '.ip160-host{position:relative!important}',

        '.ip160-host.ip160-enabled .activity__body{' +
            'position:relative;z-index:2;' +
            'padding-top:43vh!important}',

        '.ip160-hero{' +
            'position:absolute;' +
            'top:0;left:0;right:0;' +
            'height:55vh;' +
            'overflow:hidden;' +
            'pointer-events:none;' +
            'z-index:0;' +
            'background:#101014}',

        '.ip160-background{' +
            'position:absolute;inset:0;' +
            'background-size:cover;' +
            'background-position:center 24%;' +
            'background-repeat:no-repeat;' +
            'opacity:0;' +
            'transform:scale(1.035);' +
            'transition:opacity .7s ease,' +
            'transform 7s ease}',

        '.ip160-background.visible{' +
            'opacity:1;' +
            'transform:scale(1)}',

        '.ip160-hero:after{' +
            'content:"";' +
            'position:absolute;inset:0;' +
            'background:' +
            'linear-gradient(90deg,' +
            'rgba(8,8,12,.94) 0%,' +
            'rgba(8,8,12,.75) 27%,' +
            'rgba(8,8,12,.28) 65%,' +
            'rgba(8,8,12,.05) 100%),' +
            'linear-gradient(0deg,' +
            'rgba(8,8,12,1) 0%,' +
            'rgba(8,8,12,.1) 55%,' +
            'rgba(8,8,12,.12) 100%)}',

        '.ip160-content{' +
            'position:absolute;' +
            'left:4%;' +
            'bottom:18%;' +
            'width:46%;' +
            'max-width:780px;' +
            'z-index:3;' +
            'color:#fff}',

        '.ip160-logo{' +
            'display:none;' +
            'width:auto;height:auto;' +
            'max-width:100%;' +
            'max-height:8em;' +
            'object-fit:contain;' +
            'object-position:left center;' +
            'opacity:0;' +
            'transition:opacity .35s ease;' +
            'filter:drop-shadow(0 4px 14px ' +
            'rgba(0,0,0,.65))}',

        '.ip160-logo.ready{opacity:1}',

        '.ip160-title{' +
            'font-size:3.3em;' +
            'font-weight:900;' +
            'line-height:1.08;' +
            'letter-spacing:-.025em;' +
            'color:#f5f5f1;' +
            'text-shadow:0 4px 18px ' +
            'rgba(0,0,0,.65);' +
            'margin-bottom:.35em}',

        '.ip160-meta{' +
            'display:flex;' +
            'align-items:center;' +
            'flex-wrap:wrap;' +
            'gap:.85em;' +
            'font-size:1.15em;' +
            'font-weight:600;' +
            'color:#e8e8e8;' +
            'margin-top:1em;' +
            'margin-bottom:.7em}',

        '.ip160-rating{' +
            'background:#1db954;' +
            'color:white;' +
            'border-radius:5px;' +
            'padding:.12em .55em;' +
            'font-weight:800}',

        '.ip160-description{' +
            'font-size:1.16em;' +
            'line-height:1.48;' +
            'color:#eee;' +
            'opacity:.88;' +
            'display:-webkit-box;' +
            '-webkit-line-clamp:3;' +
            '-webkit-box-orient:vertical;' +
            'overflow:hidden;' +
            'text-shadow:0 2px 8px ' +
            'rgba(0,0,0,.5)}',

        '.ip160-card-title{' +
            'position:relative}',

        '.ip160-card-logo{' +
            'display:block;' +
            'width:auto;height:auto;' +
            'max-width:100%;' +
            'max-height:105px;' +
            'object-fit:contain;' +
            'object-position:left center;' +
            'opacity:0;' +
            'transition:opacity .25s ease;' +
            'filter:drop-shadow(0 3px 10px ' +
            'rgba(0,0,0,.45))}',

        '.ip160-card-logo.ready{' +
            'opacity:1}',

        '.ip160-card-title.ip160-active{' +
            'font-size:0!important;' +
            'line-height:0!important}',

        '.ip160-active>.ip160-original{' +
            'display:none!important}',

        '.ip160-active>.ip160-card-logo{' +
            'font-size:initial;' +
            'line-height:normal}',

        '@media(max-width:700px){' +
            '.ip160-hero{height:48vh}' +
            '.ip160-content{' +
                'left:5%;width:85%;bottom:16%}' +
            '.ip160-title{font-size:2.4em}' +
            '.ip160-logo{max-height:5.5em}' +
            '.ip160-description{' +
                '-webkit-line-clamp:2;' +
                'font-size:1em}' +
            '.ip160-card-logo{max-height:75px}' +
            '.ip160-host.ip160-enabled ' +
            '.activity__body{' +
                'padding-top:37vh!important}' +
        '}',

        '@media(prefers-reduced-motion:reduce){' +
            '.ip160-background,' +
            '.ip160-logo,' +
            '.ip160-card-logo{' +
                'transition:none!important;' +
                'transform:none!important}' +
        '}'
    ].join('\n');

    function injectStyle(id, css) {
        var node = document.getElementById(id);

        if (!node) {
            node = document.createElement('style');
            node.id = id;
            document.head.appendChild(node);
        }

        node.textContent = css;

        if (styles.indexOf(id) < 0) {
            styles.push(id);
        }
    }

    /* ========================================
       CINEMATIC HERO
    ======================================== */

    function createHero(root) {
        if (!root) return null;

        if (root.__ip160Hero &&
            root.contains(root.__ip160Hero)) {
            return root.__ip160Hero;
        }

        var h = document.createElement('div');
        h.className = 'ip160-hero';

        h.innerHTML =
            '<div class="ip160-background"></div>' +
            '<div class="ip160-background"></div>' +
            '<div class="ip160-content">' +
                '<img class="ip160-logo" alt=""/>' +
                '<div class="ip160-title"></div>' +
                '<div class="ip160-meta"></div>' +
                '<div class="ip160-description"></div>' +
            '</div>';

        root.insertBefore(h, root.firstChild);

        root.classList.add('ip160-host');

        h.parts = {
            backgrounds: h.querySelectorAll(
                '.ip160-background'
            ),
            logo: h.querySelector('.ip160-logo'),
            title: h.querySelector('.ip160-title'),
            meta: h.querySelector('.ip160-meta'),
            description: h.querySelector(
                '.ip160-description'
            )
        };

        h.token = 0;
        h.index = 0;
        h.key = '';

        root.__ip160Hero = h;

        return h;
    }

    function heroBackground(h, path, token) {
        if (!path) {
            Array.prototype.forEach.call(
                h.parts.backgrounds,
                function (bg) {
                    bg.classList.remove('visible');
                }
            );
            return;
        }

        var src = imageUrl(path, 'w1280');

        preload(src, function (ok) {
            if (!ok || token !== h.token) return;

            var next = 1 - h.index;
            var incoming = h.parts.backgrounds[next];
            var outgoing = h.parts.backgrounds[h.index];

            incoming.classList.remove('visible');
            incoming.style.backgroundImage =
                'url("' + src + '")';

            raf(function () {
                if (token !== h.token) return;

                incoming.classList.add('visible');
                outgoing.classList.remove('visible');
                h.index = next;
            });
        });
    }

    function showHero(h, d, force) {
        if (!h || !d || destroyed) return;

        var key = mediaKey(d);

        if (!force && h.key === key) return;

        h.key = key;

        var token = ++h.token;
        var p = h.parts;

        p.logo.classList.remove('ready');
        p.logo.style.display = 'none';
        p.logo.removeAttribute('src');

        p.title.style.display = '';
        p.title.textContent = mediaName(d);

        p.description.textContent =
            d.overview || '';

        p.meta.textContent = '';

        var rating = +d.vote_average || 0;

        if (rating > 0) {
            var r = document.createElement('span');
            r.className = 'ip160-rating';
            r.textContent = rating.toFixed(1);
            p.meta.appendChild(r);
        }

        [
            mediaYear(d),
            mediaType(d) === 'tv'
                ? 'Серіал'
                : 'Фільм'
        ].filter(Boolean).forEach(function (value) {
            var span = document.createElement('span');
            span.textContent = value;
            p.meta.appendChild(span);
        });

        heroBackground(
            h,
            d.backdrop_path,
            token
        );

        getLogoData(d, function (data) {
            if (token !== h.token || destroyed) return;

            p.title.textContent =
                data.title || mediaName(d);

            loadBestLogo(data.logos, function (src) {
                if (token !== h.token || destroyed) {
                    return;
                }

                if (!src) return;

                p.logo.style.transform =
                    'scale(' + logoScale() + ')';

                p.logo.style.transformOrigin =
                    'left center';

                p.logo.src = src;
                p.logo.style.display = 'block';

                raf(function () {
                    if (token !== h.token) return;

                    p.logo.classList.add('ready');
                    p.title.style.display = 'none';
                });
            });
        }, !!force);
    }

    function attachHero(o) {
        if (!enabled(S.hero) || !isHome(o)) {
            return;
        }

        var root = activityRoot(o);
        if (!root) return;

        root.classList.add('ip160-enabled');

        hero = createHero(root);
    }

    function focusHandler(e) {
        if (!enabled(S.hero) ||
            !e.target ||
            !e.target.closest) {
            return;
        }

        var item = e.target.closest('.card');

        if (!item || !item.card_data) return;

        var activity = item.closest('.activity');

        if (!activity || !activity.__ip160Hero) {
            return;
        }

        var d = item.card_data;
        var key = mediaKey(d);

        clearTimeout(focusTimer);

        focusTimer = setTimeout(function () {
            if (!enabled(S.hero) ||
                !activity.isConnected) {
                return;
            }

            var h = activity.__ip160Hero;

            if (lastFocus === key && h.key === key) {
                return;
            }

            lastFocus = key;
            hero = h;

            showHero(h, d);
        }, 180);
    }

    function applyHero() {
        var on = enabled(S.hero);

        document.querySelectorAll(
            '.ip160-host'
        ).forEach(function (root) {
            root.classList.toggle(
                'ip160-enabled',
                on
            );

            if (root.__ip160Hero) {
                root.__ip160Hero.style.display =
                    on ? '' : 'none';
            }
        });

        if (on) {
            attachHero(active());
        } else {
            clearTimeout(focusTimer);
            lastFocus = '';
        }
    }

    /* ========================================
       CARD LOGOS
    ======================================== */

    function titleNode(root) {
        return root && root.querySelector
            ? root.querySelector(TITLE_SELECTORS)
            : null;
    }

    function restoreTitle(root) {
        if (!root) return;

        var nodes = [];

        if (root.classList &&
            root.classList.contains(
                'ip160-card-title'
            )) {
            nodes.push(root);
        }

        if (root.querySelectorAll) {
            Array.prototype.push.apply(
                nodes,
                root.querySelectorAll(
                    '.ip160-card-title'
                )
            );
        }

        nodes.forEach(function (node) {
            var image = node.querySelector(
                '.ip160-card-logo'
            );

            if (image) {
                image.onload = null;
                image.onerror = null;
                image.remove();
            }

            var original = node.querySelector(
                '.ip160-original'
            );

            if (original) {
                while (original.firstChild) {
                    node.insertBefore(
                        original.firstChild,
                        original
                    );
                }

                original.remove();
            }

            node.classList.remove(
                'ip160-card-title',
                'ip160-active'
            );
        });
    }

    function stopCard(restore) {
        cardToken++;

        if (card && card.observer) {
            card.observer.disconnect();
        }

        if (restore && card) {
            restoreTitle(card.root);
        }

        card = null;
    }

    function cardValid(token, key) {
        return !!(
            card &&
            cardToken === token &&
            card.key === key &&
            card.root &&
            card.root.isConnected &&
            enabled(S.card) &&
            !destroyed
        );
    }

    function showCardText(token, key, value) {
        if (!cardValid(token, key)) return;

        var title = titleNode(card.root);
        if (!title) return;

        restoreTitle(title);

        if (value) {
            title.textContent = value;
        }
    }

    function insertCardLogo(token, key, src) {
        if (!cardValid(token, key)) return;

        var title = titleNode(card.root);
        if (!title) return;

        var image = title.querySelector(
            '.ip160-card-logo'
        );

        if (!image) {
            title.classList.add(
                'ip160-card-title'
            );

            var original = document.createElement(
                'span'
            );

            original.className = 'ip160-original';

            while (title.firstChild) {
                original.appendChild(
                    title.firstChild
                );
            }

            title.appendChild(original);

            image = document.createElement('img');
            image.className = 'ip160-card-logo';
            image.alt = '';
            image.draggable = false;

            title.appendChild(image);
        }

        image.style.transform =
            'scale(' + logoScale() + ')';

        image.style.transformOrigin =
            'left center';

        image.onload = function () {
            if (!cardValid(token, key)) return;

            image.classList.add('ready');
            title.classList.add('ip160-active');
        };

        image.onerror = function () {
            if (!cardValid(token, key)) return;

            showCardText(
                token,
                key,
                card.title
            );
        };

        image.src = src;

        if (image.complete && image.naturalWidth) {
            image.onload();
        }
    }

    function startCard(o, override, force) {
        if (!enabled(S.card) || !isFull(o)) {
            return;
        }

        var d = override || mediaFromActivity(o);
        var root = activityRoot(o);

        if (!d || !root) return;

        var key = mediaKey(d);

        if (!force &&
            card &&
            card.key === key &&
            card.root === root) {
            return;
        }

        stopCard(true);

        var token = cardToken;

        card = {
            root: root,
            key: key,
            title: mediaName(d),
            src: '',
            observer: null
        };

        if (window.MutationObserver) {
            var scheduled = false;

            card.observer = new MutationObserver(
                function () {
                    if (scheduled ||
                        !cardValid(token, key) ||
                        !card.src) {
                        return;
                    }

                    scheduled = true;

                    raf(function () {
                        scheduled = false;

                        if (!cardValid(token, key)) {
                            return;
                        }

                        var title = titleNode(root);

                        if (title &&
                            !title.querySelector(
                                '.ip160-card-logo'
                            )) {
                            insertCardLogo(
                                token,
                                key,
                                card.src
                            );
                        }
                    });
                }
            );

            card.observer.observe(root, {
                childList: true,
                subtree: true
            });
        }

        getLogoData(d, function (data) {
            if (!cardValid(token, key)) return;

            card.title =
                data.title || mediaName(d);

            loadBestLogo(data.logos, function (src) {
                if (!cardValid(token, key)) return;

                if (!src) {
                    showCardText(
                        token,
                        key,
                        card.title
                    );
                    return;
                }

                card.src = src;

                insertCardLogo(
                    token,
                    key,
                    src
                );
            });
        }, !!force);
    }

    /* ========================================
       FONTS
    ======================================== */

    var FONTS = {
        default: {
            family: 'Roboto,Arial,sans-serif',
            url: ''
        },

        netflix: {
            family: '"Netflix Sans",Arial,sans-serif',
            url: 'https://assets.nflxext.com/ffe/siteui/fonts/netflix-sans/v3/NetflixSans_W_Rg.woff2'
        },

        montserrat: {
            family: '"Montserrat",Arial,sans-serif',
            url: 'https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&display=swap'
        },

        inter: {
            family: '"Inter",Arial,sans-serif',
            url: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap'
        },

        nunito: {
            family: '"Nunito",Arial,sans-serif',
            url: 'https://fonts.googleapis.com/css2?family=Nunito:wght@300;400;600;700&display=swap'
        }
    };

    function applyFont() {
        var key = str(get(S.font, 'default'));

        if (key === currentFont) return;

        currentFont = key;

        var f = FONTS[key] || FONTS.default;

        [
            'ip160-font-face',
            'ip160-font-style'
        ].forEach(function (id) {
            var node = document.getElementById(id);

            if (node) node.remove();
        });

        if (f.url) {
            var css = '';

            if (f.url.indexOf(
                'googleapis.com'
            ) >= 0) {
                css = '@import url("' +
                    f.url + '");';
            } else {
                css =
                    '@font-face{' +
                    'font-family:"Netflix Sans";' +
                    'src:url("' + f.url + '") ' +
                    'format("woff2");' +
                    'font-weight:400;' +
                    'font-style:normal}';
            }

            injectStyle(
                'ip160-font-face',
                css
            );
        }

        injectStyle(
            'ip160-font-style',
            'body,.body,' +
            '.activity,.settings,' +
            '.ip160-hero{' +
            'font-family:' +
            f.family +
            '!important}'
        );
    }

    /* ========================================
       INTERFACE SIZE
    ======================================== */

    function patchMaker(count) {
        if (!Lampa.Maker ||
            !Lampa.Maker.map) {
            return;
        }

        ['Line', 'Category'].forEach(
            function (type) {
                var maker = Lampa.Maker.map(type);

                if (!maker ||
                    !maker.Items ||
                    !maker.Items.onInit) {
                    return;
                }

                var items = maker.Items;

                if (items.__ip160Patched) {
                    items.__ip160Count = count;
                    return;
                }

                var original = items.onInit;

                items.onInit = function () {
                    original.apply(this, arguments);

                    var n =
                        items.__ip160Count || count;

                    if (type === 'Line') {
                        this.view = n;
                    } else {
                        this.limit_view = n;
                    }
                };

                items.__ip160Patched = true;
                items.__ip160Count = count;
            }
        );
    }

    function applySize() {
        var value = parseFloat(
            get(S.size, '10.6')
        ) || 10.6;

        try {
            if (Lampa.Platform.screen('mobile')) {
                value = 10.1;
            }
        } catch (e) {}

        if (currentSize === String(value)) {
            return;
        }

        currentSize = String(value);

        document.body.style.fontSize =
            value + 'px';

        patchMaker(
            value <= 9.6
                ? 8
                : value <= 11.1
                    ? 7
                    : 6
        );
    }

    /* ========================================
       REFRESH / CACHE
    ======================================== */

    function refresh(force) {
        clearTimeout(refreshTimer);

        refreshTimer = setTimeout(function () {
            lastFocus = '';

            var a = active();

            if (hero) {
                hero.key = '';
            }

            if (isFull(a)) {
                stopCard(true);
                startCard(a, null, !!force);
            }

            if (isHome(a)) {
                attachHero(a);

                if (hero && hero.key) {
                    hero.key = '';
                }
            }
        }, 100);
    }

    function clearCache() {
        epoch++;

        cache = {};
        pending = {};
        searches = {};

        [
            CACHE_KEY,
            'interface_plus_tmdb_cache_v154',
            'interface_plus_tmdb_only_cache_v153',
            'interface_plus_logo_cache_v152',
            'interface_plus_logo_cache_v151',
            'interface_plus_logo_cache_v150'
        ].forEach(function (key) {
            set(key, {});
        });

        refresh(true);

        try {
            Lampa.Noty.show(
                'Кеш логотипів очищено'
            );
        } catch (e) {}
    }

    /* ========================================
       SETTINGS
    ======================================== */

    function registerSettings() {
        if (!Lampa.SettingsApi) return;

        var api = Lampa.SettingsApi;

        api.addComponent({
            component: 'interface_plus_settings',
            name: 'Інтерфейс +',
            icon:
                '<svg viewBox="0 0 24 24" ' +
                'width="24" height="24" ' +
                'fill="currentColor">' +
                '<path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm0 16H5V5h14v14zM7 10h2v7H7zm4-3h2v10h-2zm4 5h2v5h-2z"/>' +
                '</svg>'
        });

        function add(
            key,
            type,
            def,
            label,
            description,
            values,
            callback
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
                    name: label,
                    description: description
                },

                onChange: callback
            });
        }

        add(
            S.hero,
            'trigger',
            true,
            'Кінематографічні банери',
            'Преміальний дизайн головної сторінки',
            null,
            applyHero
        );

        add(
            S.card,
            'trigger',
            true,
            'Логотип у картці',
            'Український або англійський логотип TMDB',
            null,
            function () {
                if (enabled(S.card)) {
                    refresh(false);
                } else {
                    stopCard(true);
                }
            }
        );

        add(
            S.quality,
            'select',
            'original',
            'Якість логотипів',
            'Роздільна здатність зображень',
            {
                w300: '300px',
                w500: '500px',
                original: 'Original'
            },
            function () {
                refresh(false);
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
                refresh(false);
            }
        );

        add(
            'interface_plus_clear_logo_cache',
            'button',
            '',
            'Очистити кеш логотипів',
            'Повторне завантаження з TMDB',
            null,
            clearCache
        );

        add(
            S.size,
            'select',
            '10.6',
            'Розмір інтерфейсу',
            'Масштаб елементів Lampa',
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
            function () {
                currentFont = '';
                applyFont();
            }
        );
    }

    /* ========================================
       EVENTS
    ======================================== */

    function registerListeners() {
        document.addEventListener(
            'hover:focus',
            focusHandler,
            true
        );

        if (Lampa.Listener) {
            Lampa.Listener.follow(
                'activity',
                function (e) {
                    if (!e || destroyed) return;

                    if (e.type === 'start') {
                        raf(function () {
                            if (destroyed) return;

                            attachHero(e.object);

                            if (isFull(e.object)) {
                                startCard(e.object);
                            } else {
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
                }
            );

            Lampa.Listener.follow(
                'full',
                function (e) {
                    if (!e || destroyed) return;

                    if (!/^(complete|complite)$/.test(
                        e.type
                    )) {
                        return;
                    }

                    raf(function () {
                        if (destroyed) return;

                        var a = active();

                        if (isFull(a)) {
                            startCard(
                                a,
                                e.data && e.data.movie,
                                false
                            );
                        }
                    });
                }
            );
        }

        try {
            Lampa.Storage.listener.follow(
                'change',
                function (e) {
                    if (!e ||
                        !e.name ||
                        destroyed) {
                        return;
                    }

                    if (e.name === S.hero) {
                        applyHero();
                    }

                    if (e.name === S.card) {
                        if (enabled(S.card)) {
                            refresh(false);
                        } else {
                            stopCard(true);
                        }
                    }

                    if (e.name === S.font) {
                        currentFont = '';
                        applyFont();
                    }

                    if (e.name === S.size) {
                        currentSize = '';
                        applySize();
                    }

                    if (
                        e.name === S.quality ||
                        e.name === S.scale
                    ) {
                        refresh(false);
                    }
                }
            );
        } catch (e) {}
    }

    /* ========================================
       DESTROY
    ======================================== */

    function destroy() {
        destroyed = true;
        epoch++;

        clearTimeout(focusTimer);
        clearTimeout(refreshTimer);

        stopCard(true);

        document.removeEventListener(
            'hover:focus',
            focusHandler,
            true
        );

        document.querySelectorAll(
            '.ip160-hero'
        ).forEach(function (node) {
            node.remove();
        });

        document.querySelectorAll(
            '.ip160-host'
        ).forEach(function (node) {
            node.classList.remove(
                'ip160-host',
                'ip160-enabled'
            );

            delete node.__ip160Hero;
        });

        styles.forEach(function (id) {
            var node = document.getElementById(id);

            if (node) node.remove();
        });

        delete window[FLAG];
    }

    window.__interface_plus_runtime = {
        version: VERSION,
        destroy: destroy
    };

    /* ========================================
       INITIALIZATION
    ======================================== */

    function init() {
        if (
            started ||
            destroyed ||
            !window.Lampa ||
            !Lampa.Storage
        ) {
            return;
        }

        started = true;

        injectStyle(
            'ip160-main-style',
            CSS
        );

        applyFont();
        applySize();
        registerSettings();
        registerListeners();
        applyHero();

        raf(function () {
            if (destroyed) return;

            var a = active();

            attachHero(a);

            if (isFull(a)) {
                startCard(a);
            }
        });

        console.log(
            '[INTERFACE+] ' +
            VERSION +
            ' Cinematic Premium'
        );
    }

    if (window.appready) {
        setTimeout(init, 400);
    } else if (
        window.Lampa &&
        Lampa.Listener
    ) {
        Lampa.Listener.follow(
            'app',
            function (e) {
                if (e.type === 'ready') {
                    setTimeout(init, 400);
                }
            }
        );
    } else {
        var attempts = 0;

        var wait = setInterval(function () {
            attempts++;

            if (
                window.Lampa &&
                Lampa.Storage
            ) {
                clearInterval(wait);
                setTimeout(init, 400);
            }

            if (attempts > 100) {
                clearInterval(wait);
            }
        }, 200);
    }

})();
