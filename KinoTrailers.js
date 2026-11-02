(function () {
    'use strict';

    /*
     * КІНОТРЕЙЛЕРИ 2.1
     *
     * Lampa / Android TV / Mobile
     *
     * FEATURES:
     * - Random TMDB feed
     * - Movies and TV series
     * - Genre selection
     * - Smart TMDB logos
     * - YouTube autoplay
     * - One active + one prepared player
     * - Safe iframe bridge
     * - Metadata prefetch
     * - Mobile swipe
     * - Automatic trailer switching
     * - Native Lampa Favorites
     *
     * 2.1 CHANGES:
     * - Netflix-style Add to Favorites button
     * - Native Lampa.Favorite integration
     * - Favorite state detection
     * - Add / remove from Bookmarks
     * - Favorite button does not open movie card
     * - Remote control focus support
     */

    if (!window.Lampa || !window.$) return;
    if (window.trailers_feed_plugin) return;

    window.trailers_feed_plugin = true;

    var tmdb = Lampa.Api.sources.tmdb;

    var TYPES = {
        movie: 'Фільми',
        tv: 'Серіали'
    };

    var AHEAD = 3;
    var META_AHEAD = 10;
    var PREP_DELAY = 1200;
    var LOAD_TIMEOUT = 15000;
    var CACHE_TIMEOUT = 20000;

    var BASE = (
        (document.currentScript && document.currentScript.src) ||
        'https://smokingairlinestg.github.io/lampa-trailers/feed.js'
    ).split('?')[0].replace(/[^/]*$/, '');

    var bridgeMode = false;

    var isMobile =
        (Lampa.Platform && Lampa.Platform.is('mobile')) ||
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    var bridgeOrigin = '';

    try {
        bridgeOrigin = new URL(BASE, location.href).origin;
    } catch (e) {}

    // --------------------------------------------------
    // CSS
    // --------------------------------------------------

    var css = '' +
        '.tfeed{position:fixed;left:0;top:0;width:100%;height:100%;background:#000;overflow:hidden;z-index:9999}' +
        'body.tfeed--on .head{display:none}' +

        '.tfeed__bg,.tfeed__video{position:absolute;left:0;top:0;width:100%;height:100%;overflow:hidden}' +
        '.tfeed__bg{background-size:cover;background-position:center;transform:scale(1.01)}' +

        '.tfeed__yt{position:absolute;left:0;top:0;width:100%;height:100%;opacity:0;transition:opacity .4s ease}' +
        '.tfeed__yt--on{opacity:1}' +
        '.tfeed__yt iframe{position:absolute;left:0;top:-300px;width:100%;height:calc(100% + 600px);border:0;pointer-events:none}' +

        '.tfeed__frame{position:absolute;left:0;top:0;width:100%;height:100%;border:0;pointer-events:none}' +

        '.tfeed__chip{position:absolute;left:3em;top:2em;padding:.45em 1em;border-radius:2em;' +
            'background:rgba(0,0,0,.58);font-size:1.05em;cursor:pointer;z-index:20;' +
            'backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}' +

        '.tfeed__side{position:absolute;right:2.5em;top:50%;transform:translateY(-50%);z-index:10;' +
            'opacity:1;transition:opacity .4s ease}' +

        '.tfeed__side--hidden{opacity:0;pointer-events:none}' +

        '.tfeed__poster{width:5.5em;height:8.2em;margin:.6em 0;border-radius:.55em;' +
            'background-color:#222;background-size:cover;background-position:center;' +
            'opacity:.5;transition:opacity .3s,transform .3s,box-shadow .3s}' +

        '.tfeed__poster--now{opacity:1;transform:scale(1.06);box-shadow:0 0 0 .18em #fff}' +

        '.tfeed__info{position:absolute;left:0;right:0;bottom:0;padding:7em 12em 2.5em 3em;' +
            'background:linear-gradient(to top,rgba(0,0,0,.94) 0%,rgba(0,0,0,.65) 48%,transparent 100%);' +
            'z-index:5;cursor:pointer}' +

        '.tfeed__logo{display:block;max-width:30em;max-height:8em;margin-bottom:.5em;' +
            'object-fit:contain;object-position:left center}' +

        '.tfeed__title{font-size:2.6em;font-weight:700;text-shadow:0 2px 12px #000}' +

        '.tfeed__meta{font-size:1.25em;opacity:.82;margin-top:.4em}' +

        '.tfeed__descr{font-size:1.15em;opacity:.76;margin-top:.65em;max-width:70%;' +
            'display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}' +

        /*
         * NETFLIX STYLE FAVORITE BUTTON
         */

        '.tfeed__actions{display:flex;align-items:center;gap:.8em;margin-top:1.25em;position:relative;z-index:15}' +

        '.tfeed__favorite{' +
            'display:inline-flex;align-items:center;justify-content:center;gap:.65em;' +
            'min-height:2.8em;padding:.65em 1.35em;' +
            'border:0;border-radius:.35em;' +
            'background:#fff;color:#111;' +
            'font-size:1.08em;font-weight:700;' +
            'font-family:inherit;line-height:1;' +
            'cursor:pointer;outline:none;' +
            'transition:background .2s,transform .2s,box-shadow .2s' +
        '}' +

        '.tfeed__favorite svg{width:1.35em;height:1.35em;flex-shrink:0;display:block}' +

        '.tfeed__favorite--added{' +
            'background:rgba(255,255,255,.16);' +
            'color:#fff;' +
            'border:1px solid rgba(255,255,255,.5)' +
        '}' +

        '.tfeed__favorite.focus,.tfeed__favorite:focus{' +
            'transform:scale(1.04);' +
            'box-shadow:0 0 0 .18em rgba(255,255,255,.85)' +
        '}' +

        '.tfeed__favorite:active{transform:scale(.97)}' +

        '.tfeed__hint{font-size:1em;opacity:.5;margin-top:1.2em}' +

        '.tfeed__status{position:absolute;left:50%;top:45%;transform:translate(-50%,-50%);' +
            'font-size:1.25em;padding:.7em 1.2em;border-radius:2em;' +
            'background:rgba(0,0,0,.7);z-index:30;text-align:center;' +
            'backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}' +

        '.tfeed__status:empty{display:none}' +

        '@media screen and (max-width:768px){' +
            '.tfeed__info{padding:4em 8em 5em 1.5em;right:0}' +
            '.tfeed__title{font-size:1.8em}' +
            '.tfeed__logo{max-width:80%;max-height:5em}' +
            '.tfeed__chip{left:1.5em;top:1.5em;font-size:.9em}' +
            '.tfeed__side{right:1em}' +
            '.tfeed__poster{width:3.8em;height:5.7em;margin:.35em 0}' +
            '.tfeed__descr{font-size:.95em;max-width:95%;-webkit-line-clamp:3}' +
            '.tfeed__hint{display:none}' +
            '.tfeed__actions{margin-top:1em}' +
            '.tfeed__favorite{font-size:.95em;min-height:2.7em;padding:.65em 1.1em}' +
        '}';

    // --------------------------------------------------
    // HELPERS
    // --------------------------------------------------

    function pickTrailer(results) {
        var lang = Lampa.Storage.field('tmdb_lang');

        function rank(v) {
            return (
                (v.type === 'Trailer' ? 0 : v.type === 'Teaser' ? 2 : 4) +
                (v.iso_639_1 === lang ? 0 : 1)
            );
        }

        var yt = (results || []).filter(function (v) {
            return v.site === 'YouTube' && v.key;
        });

        yt.sort(function (a, b) {
            return rank(a) - rank(b);
        });

        return yt[0] || null;
    }

    function pickLogo(logos) {
        var order = [
            Lampa.Storage.field('tmdb_lang'),
            'en',
            null
        ];

        for (var i = 0; i < order.length; i++) {
            var found = logos.filter(function (l) {
                return l.iso_639_1 === order[i];
            })[0];

            if (found) return found;
        }

        return logos[0] || null;
    }

    function genreTitle(type, id) {
        if (!id) return 'Популярне';

        var genres = tmdb.genres[type] || [];

        var g = genres.filter(function (x) {
            return x.id === id;
        })[0];

        return g
            ? Lampa.Utils.capitalizeFirstLetter(Lampa.Lang.translate(g.title))
            : '';
    }

    function shuffleArray(array) {
        for (var i = array.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));

            var temp = array[i];
            array[i] = array[j];
            array[j] = temp;
        }

        return array;
    }

    function loadYT(cb) {
        if (window.YT && window.YT.Player) {
            cb(true);
            return;
        }

        if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
            var s = document.createElement('script');
            s.src = 'https://www.youtube.com/iframe_api';
            document.head.appendChild(s);
        }

        var waited = 0;

        var timer = setInterval(function () {
            waited += 100;

            if (window.YT && window.YT.Player) {
                clearInterval(timer);
                cb(true);
            } else if (waited >= LOAD_TIMEOUT) {
                clearInterval(timer);
                cb(false);
            }
        }, 100);
    }

    // --------------------------------------------------
    // FEED
    // --------------------------------------------------

    function Feed(object) {
        var hintText = isMobile
            ? 'Свайп вгору/вниз — гортати · Тап — відкрити'
            : '▲▼ гортати · OK — відкрити · → жанри · Назад — вихід';

        var html = $(
            '<div class="tfeed">' +
                '<div class="tfeed__bg"></div>' +
                '<div class="tfeed__video"></div>' +
                '<div class="tfeed__status"></div>' +
                '<div class="tfeed__chip"></div>' +
                '<div class="tfeed__side"></div>' +
                '<div class="tfeed__info">' +
                    '<img class="tfeed__logo">' +
                    '<div class="tfeed__title"></div>' +
                    '<div class="tfeed__meta"></div>' +
                    '<div class="tfeed__descr"></div>' +

                    '<div class="tfeed__actions">' +
                        '<button type="button" class="tfeed__favorite selector">' +
                            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                                '<path d="M12 5v14M5 12h14"/>' +
                            '</svg>' +
                            '<span>До обраного</span>' +
                        '</button>' +
                    '</div>' +

                    '<div class="tfeed__hint">' + hintText + '</div>' +
                '</div>' +
            '</div>'
        );

        var type;
        var genre;

        var items = [];
        var index = -1;

        var page = 0;
        var totalPages = 0;

        var loading = false;
        var waiters = [];

        var feedGen = 0;
        var seq = 0;

        var players = [];
        var cur = null;

        var frameId = '';
        var bridgeFrame = null;

        var nextTimer;
        var watchdog;
        var prepTimer;
        var posterHideTimer;

        var self = this;

        var touchStartY = 0;
        var touchStartX = 0;
        var touchStartTime = 0;
        var touchActive = false;

        // --------------------------------------------------
        // STATUS
        // --------------------------------------------------

        function status(text) {
            html.find('.tfeed__status').text(text || '');
        }

        // --------------------------------------------------
        // TIMERS
        // --------------------------------------------------

        function clearPlaybackTimers() {
            clearTimeout(nextTimer);
            clearTimeout(watchdog);
            clearTimeout(prepTimer);
        }

        // --------------------------------------------------
        // RESET
        // --------------------------------------------------

        function reset(newType, newGenre) {
            type = newType;
            genre = newGenre;

            Lampa.Storage.set('tfeed_type', type);
            Lampa.Storage.set('tfeed_genre', genre);

            items = [];
            index = -1;

            page = 0;
            totalPages = 0;

            loading = false;
            waiters = [];

            feedGen++;
            seq++;

            stopAll();

            html.find('.tfeed__side').empty();

            html.find('.tfeed__chip').text(
                TYPES[type] + ' · ' + genreTitle(type, genre)
            );

            updateFavoriteButton(null);
        }

        // --------------------------------------------------
        // WAITERS
        // --------------------------------------------------

        function flush(ok) {
            var list = waiters.slice();
            waiters = [];

            list.forEach(function (f) {
                try {
                    f(ok);
                } catch (e) {}
            });
        }

        // --------------------------------------------------
        // TMDB PAGINATION
        // --------------------------------------------------

        function loadPage(done) {
            if (done) waiters.push(done);

            if (loading) return;

            if (page > 0 && page >= totalPages) {
                flush(false);
                return;
            }

            loading = true;

            var gen = feedGen;

            var targetPage;

            if (page === 0) {
                targetPage = Math.floor(Math.random() * 15) + 1;
            } else {
                targetPage = page + 1;
            }

            function request(target, retry) {
                var params = {
                    page: target,
                    sort_by: 'popularity.desc',
                    filter: {
                        'vote_count.gte': 50
                    }
                };

                if (genre) {
                    params.genres = genre;
                }

                if (type === 'tv' && !genre) {
                    params.filter.without_genres = '10763,10767';
                }

                tmdb.get(
                    'discover/' + type,
                    params,

                    function (json) {
                        if (gen !== feedGen) return;

                        var pages = Math.max(1, json.total_pages || 1);

                        if (target > pages && !retry) {
                            request(pages, true);
                            return;
                        }

                        loading = false;

                        totalPages = pages;
                        page = Math.min(target, pages);

                        var newItems = (json.results || []).filter(function (m) {
                            return !m.adult && m.id;
                        });

                        shuffleArray(newItems);

                        var existing = {};

                        items.forEach(function (m) {
                            existing[m.id] = true;
                        });

                        newItems = newItems.filter(function (m) {
                            if (existing[m.id]) return false;

                            existing[m.id] = true;
                            return true;
                        });

                        items = items.concat(newItems);

                        flush(true);
                    },

                    function () {
                        if (gen !== feedGen) return;

                        loading = false;
                        flush(false);
                    }
                );
            }

            request(targetPage, false);
        }

        // --------------------------------------------------
        // SAFE CACHE
        // --------------------------------------------------

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
            }, CACHE_TIMEOUT);

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

        // --------------------------------------------------
        // TRAILER CACHE
        // --------------------------------------------------

        function ensureVideo(item, cb) {
            var t = type;

            cached(item, 'tfeed_video', function (done) {
                tmdb.videos(
                    {
                        method: t,
                        id: item.id
                    },

                    function (json) {
                        done(pickTrailer(json.results || []));
                    },

                    function () {
                        done(null);
                    }
                );
            }, cb);
        }

        // --------------------------------------------------
        // LOGO CACHE
        // --------------------------------------------------

        function ensureLogo(item, cb) {
            var t = type;

            cached(item, 'tfeed_logo', function (done) {
                var lang = Lampa.Storage.field('tmdb_lang');

                var langs = (lang || 'en') + ',en,null';

                tmdb.get(
                    t + '/' + item.id + '/images',

                    {
                        filter: {
                            include_image_language: langs
                        }
                    },

                    function (json) {
                        var logo = json.logos && json.logos.length
                            ? pickLogo(json.logos)
                            : null;

                        done(
                            logo
                                ? Lampa.Api.img(logo.file_path, 'w500')
                                : null
                        );
                    },

                    function () {
                        done(null);
                    }
                );
            }, cb);
        }

        // --------------------------------------------------
        // FAVORITES
        // --------------------------------------------------

        /*
         * Для Lampa потрібна повноцінна картка з методом
         * movie або tv та джерелом tmdb.
         *
         * Не змінюємо оригінальний об'єкт TMDB:
         * створюємо окрему копію для Favorite.
         */

        function favoriteCard(item) {
            if (!item) return null;

            var card = {};

            Object.keys(item).forEach(function (key) {
                card[key] = item[key];
            });

            card.method = type;
            card.source = 'tmdb';

            if (!card.title && card.name) {
                card.title = card.name;
            }

            if (!card.name && card.title) {
                card.name = card.title;
            }

            return card;
        }

        function isFavorite(item) {
            if (!item || !Lampa.Favorite) return false;

            try {
                var card = favoriteCard(item);

                var state = Lampa.Favorite.check(card);

                return !!(state && state.book);
            } catch (e) {
                return false;
            }
        }

        function updateFavoriteButton(item) {
            var button = html.find('.tfeed__favorite');

            if (!button.length) return;

            var icon;
            var label;

            if (!item) {
                button.prop('disabled', true);
                button.removeClass('tfeed__favorite--added');
                button.attr('aria-label', 'До обраного');

                icon =
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                        '<path d="M12 5v14M5 12h14"/>' +
                    '</svg>';

                label = 'До обраного';
            } else {
                button.prop('disabled', false);

                if (isFavorite(item)) {
                    button.addClass('tfeed__favorite--added');

                    icon =
                        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
                            '<path d="m5 12 4 4L19 6"/>' +
                        '</svg>';

                    label = 'В обраному';
                } else {
                    button.removeClass('tfeed__favorite--added');

                    icon =
                        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                            '<path d="M12 5v14M5 12h14"/>' +
                        '</svg>';

                    label = 'До обраного';
                }

                button.attr('aria-label', label);
            }

            button.html(icon + '<span>' + label + '</span>');
        }

        function toggleFavorite() {
            var item = items[index];

            if (!item) return;

            if (!Lampa.Favorite || typeof Lampa.Favorite.toggle !== 'function') {
                if (Lampa.Noty) {
                    Lampa.Noty.show('Функція обраного недоступна');
                }

                return;
            }

            try {
                var card = favoriteCard(item);

                Lampa.Favorite.toggle('book', card);

                updateFavoriteButton(item);

                if (Lampa.Noty) {
                    Lampa.Noty.show(
                        isFavorite(item)
                            ? 'Додано до обраного'
                            : 'Видалено з обраного'
                    );
                }
            } catch (e) {
                if (Lampa.Noty) {
                    Lampa.Noty.show('Не вдалося змінити обране');
                }
            }
        }

        // --------------------------------------------------
        // FULLSCREEN
        // --------------------------------------------------

        function fullscreen(on) {
            $('body').toggleClass('tfeed--on', on);
        }

        // --------------------------------------------------
        // PLAYER MANAGEMENT
        // --------------------------------------------------

        function findPlayer(item) {
            return players.filter(function (p) {
                return p.item === item && !p.dead;
            })[0] || null;
        }

        function makePlayer(item, play) {
            var p = {
                item: item,
                ready: false,
                wantPlay: play,
                dead: false,
                playSeq: 0,
                el: null,
                yt: null
            };

            p.el = $('<div class="tfeed__yt"><div></div></div>');

            html.find('.tfeed__video').append(p.el);

            var vars = {
                autoplay: play ? 1 : 0,
                controls: 0,
                rel: 0,
                modestbranding: 1,
                playsinline: 1,
                iv_load_policy: 3,
                disablekb: 1,
                fs: 0,
                enablejsapi: 1,
                mute: isMobile ? 1 : 0
            };

            if (/^https?:/.test(location.origin)) {
                vars.origin = location.origin;
            }

            p.yt = new window.YT.Player(
                p.el.children()[0],

                {
                    videoId: item.tfeed_video.key,
                    width: '100%',
                    height: '100%',

                    playerVars: vars,

                    events: {
                        onReady: function () {
                            if (p.dead) return;

                            p.ready = true;

                            var frame = p.yt.getIframe && p.yt.getIframe();

                            if (frame) {
                                frame.setAttribute('tabindex', '-1');
                            }

                            if (p.wantPlay && p.playSeq === seq) {
                                try {
                                    p.yt.playVideo();
                                } catch (e) {}
                            }
                        },

                        onStateChange: function (e) {
                            if (p.dead) return;

                            onPlayer(p, 'state', e.data);
                        },

                        onError: function (e) {
                            if (p.dead) return;

                            onPlayer(p, 'error', e.data);
                        }
                    }
                }
            );

            players.push(p);

            return p;
        }

        function killPlayer(p) {
            if (!p || p.dead) return;

            p.dead = true;
            p.wantPlay = false;

            if (p === cur) {
                cur = null;

                clearTimeout(nextTimer);
                clearTimeout(watchdog);
            }

            try {
                if (p.yt) {
                    p.yt.destroy();
                }
            } catch (e) {}

            try {
                if (p.el) {
                    p.el.remove();
                }
            } catch (e) {}

            var pos = players.indexOf(p);

            if (pos >= 0) {
                players.splice(pos, 1);
            }
        }

        // --------------------------------------------------
        // STOP ALL
        // --------------------------------------------------

        function stopBridge() {
            frameId = '';
            bridgeFrame = null;

            html.find('.tfeed__frame').remove();
        }

        function stopAll() {
            players.slice().forEach(killPlayer);

            cur = null;

            clearPlaybackTimers();

            clearTimeout(posterHideTimer);

            stopBridge();
        }

        // --------------------------------------------------
        // PREPARE NEXT PLAYER
        // --------------------------------------------------

        function prepare() {
            clearTimeout(prepTimer);

            if (bridgeMode || !cur || index < 0 || !items[index]) {
                return;
            }

            var keep = [items[index]];

            for (
                var i = index + 1;
                i < items.length;
                i++
            ) {
                var v = items[i].tfeed_video;

                if (v === undefined) {
                    ensureVideo(items[i], function () {
                        schedulePrepare();
                    });

                    break;
                }

                if (v) {
                    keep.push(items[i]);
                    break;
                }
            }

            players.slice().forEach(function (p) {
                if (keep.indexOf(p.item) < 0) {
                    killPlayer(p);
                }
            });

            var missing = keep.slice(1).filter(function (item) {
                return !findPlayer(item);
            })[0];

            if (missing) {
                makePlayer(missing, false);
            }
        }

        function schedulePrepare() {
            clearTimeout(prepTimer);

            prepTimer = setTimeout(
                prepare,
                PREP_DELAY
            );
        }

        // --------------------------------------------------
        // WATCHDOG
        // --------------------------------------------------

        function watch(my) {
            clearTimeout(watchdog);

            watchdog = setTimeout(function () {
                if (my !== seq) return;

                status('YouTube не відповідає · прогорніть далі');
            }, LOAD_TIMEOUT);
        }

        // --------------------------------------------------
        // PLAY ITEM
        // --------------------------------------------------

        function playItem(item) {
            var my = seq;

            if (bridgeMode) {
                playFrame(item);
                return;
            }

            loadYT(function (ok) {
                if (my !== seq) return;

                if (!ok) {
                    bridgeMode = true;
                    playFrame(item);
                    return;
                }

                var p = findPlayer(item);

                if (cur && cur !== p) {
                    try {
                        if (cur.yt && cur.ready) {
                            cur.yt.stopVideo();
                        }
                    } catch (e) {}
                }

                if (!p) {
                    p = makePlayer(item, true);
                }

                p.wantPlay = true;
                p.playSeq = my;

                cur = p;

                if (p.ready) {
                    try {
                        p.yt.playVideo();
                    } catch (e) {}
                }

                watch(my);
            });
        }

        // --------------------------------------------------
        // PLAYER EVENTS
        // --------------------------------------------------

        function onPlayer(p, kind, value) {
            if (p.dead) return;

            var active = p === cur;

            if (kind === 'error') {
                if (value === 153 && active) {
                    var item = p.item;
                    var my = seq;

                    bridgeMode = true;

                    players.slice().forEach(killPlayer);

                    if (item && items[index] === item && my === seq) {
                        playFrame(item);
                    }

                    return;
                }

                p.item.tfeed_video = null;

                if (!active) {
                    killPlayer(p);
                    schedulePrepare();
                    renderSide();
                    return;
                }
            }

            if (!active || p.playSeq !== seq) {
                return;
            }

            if (
                kind === 'state' &&
                value === window.YT.PlayerState.PLAYING
            ) {
                clearTimeout(watchdog);

                status('');

                if (
                    isMobile &&
                    p.yt &&
                    p.yt.isMuted &&
                    p.yt.isMuted()
                ) {
                    try {
                        p.yt.unMute();
                        p.yt.setVolume(100);
                    } catch (e) {}
                }

                p.el.addClass('tfeed__yt--on');

                schedulePrepare();
            }

            if (
                (kind === 'state' && value === window.YT.PlayerState.ENDED) ||
                kind === 'error'
            ) {
                var my = seq;
                var currentIndex = index;

                if (kind === 'error') {
                    status('Трейлер недоступний, гортаю далі…');
                }

                clearTimeout(nextTimer);

                nextTimer = setTimeout(function () {
                    if (my !== seq || currentIndex !== index || cur !== p) {
                        return;
                    }

                    show(index + 1, 1);
                }, kind === 'error' ? 1500 : 300);
            }
        }

        // --------------------------------------------------
        // IFRAME BRIDGE
        // --------------------------------------------------

        function playFrame(item) {
            stopBridge();

            var my = seq;

            frameId = 'tfeed_' + Math.random().toString(36).slice(2);

            var iframe = $(
                '<iframe class="tfeed__frame" tabindex="-1" ' +
                'allow="autoplay; encrypted-media"></iframe>'
            );

            iframe.attr(
                'src',
                BASE +
                'yt.html?id=' + frameId +
                '&v=' + encodeURIComponent(item.tfeed_video.key) +
                '&preload=0'
            );

            html.find('.tfeed__video').append(iframe);

            bridgeFrame = iframe[0];

            watch(my);
        }

        function onMessage(event) {
            if (!bridgeFrame || !frameId) return;

            if (event.source !== bridgeFrame.contentWindow) {
                return;
            }

            if (bridgeOrigin && event.origin !== bridgeOrigin) {
                return;
            }

            var data = event.data;

            if (!data || data.bridgeId !== frameId) {
                return;
            }

            if (data.type === 'ready') {
                // iframe завантажився.
            }

            if (
                (data.type === 'stateChange' &&
                    data.data &&
                    data.data.state === 0) ||
                data.type === 'error'
            ) {
                var my = seq;
                var currentFrame = frameId;
                var currentIndex = index;

                if (data.type === 'error') {
                    status('Трейлер недоступний, гортаю далі…');
                }

                clearTimeout(nextTimer);

                nextTimer = setTimeout(function () {
                    if (
                        my !== seq ||
                        currentFrame !== frameId ||
                        currentIndex !== index
                    ) {
                        return;
                    }

                    show(index + 1, 1);
                }, data.type === 'error' ? 1500 : 300);
            }
        }

        // --------------------------------------------------
        // SIDE POSTERS
        // --------------------------------------------------

        function renderSide() {
            var side = html.find('.tfeed__side').empty();

            for (
                var i = index, shown = 0;
                i < items.length && shown <= AHEAD;
                i++
            ) {
                if (i > index && items[i].tfeed_video === null) {
                    continue;
                }

                var poster = items[i].poster_path
                    ? 'url(' + Lampa.Api.img(items[i].poster_path, 'w200') + ')'
                    : 'none';

                side.append(
                    $('<div class="tfeed__poster"></div>')
                        .toggleClass('tfeed__poster--now', i === index)
                        .css('background-image', poster)
                );

                shown++;
            }
        }

        // --------------------------------------------------
        // PREFETCH
        // --------------------------------------------------

        function prefetch() {
            var end = Math.min(
                items.length,
                index + 1 + META_AHEAD
            );

            for (var i = index + 1; i < end; i++) {
                var item = items[i];

                ensureVideo(item, function () {
                    renderSide();
                    schedulePrepare();
                });

                ensureLogo(item, function (url) {
                    if (url) {
                        new Image().src = url;
                    }
                });

                if (!item.tfeed_warm) {
                    item.tfeed_warm = true;

                    if (item.poster_path) {
                        new Image().src = Lampa.Api.img(
                            item.poster_path,
                            'w200'
                        );
                    }

                    if (item.backdrop_path) {
                        new Image().src = Lampa.Api.img(
                            item.backdrop_path,
                            'w1280'
                        );
                    }
                }
            }
        }

        // --------------------------------------------------
        // INFO
        // --------------------------------------------------

        function info(item) {
            var date = item.release_date || item.first_air_date || '';

            var genres = tmdb.getGenresNameFromIds(
                type,
                item.genre_ids || []
            ).slice(0, 3).join(', ');

            var meta = [
                date.slice(0, 4),
                item.vote_average
                    ? '★ ' + item.vote_average.toFixed(1)
                    : '',
                genres
            ].filter(Boolean).join(' · ');

            var titleEl = html.find('.tfeed__title');
            var logoEl = html.find('.tfeed__logo');

            var movieTitle =
                item.title ||
                item.name ||
                item.original_title ||
                item.original_name ||
                '';

            html.find('.tfeed__meta').text(meta);
            html.find('.tfeed__descr').text(item.overview || '');

            html.find('.tfeed__bg').css(
                'background-image',
                item.backdrop_path
                    ? 'url(' + Lampa.Api.img(item.backdrop_path, 'w1280') + ')'
                    : 'none'
            );

            // Оновлюємо стан кнопки для поточного фільму.

            updateFavoriteButton(item);

            logoEl.hide().removeAttr('src');
            titleEl.text('').hide();

            var currentSeq = seq;

            ensureLogo(item, function (url) {
                if (items[index] !== item || currentSeq !== seq) {
                    return;
                }

                if (url) {
                    logoEl.attr('src', url).show();
                    titleEl.hide();
                } else {
                    logoEl.hide();
                    titleEl.text(movieTitle).show();
                }
            });
        }

        // --------------------------------------------------
        // POSTER VISIBILITY
        // --------------------------------------------------

        function showPosters() {
            var side = html.find('.tfeed__side');

            side.removeClass('tfeed__side--hidden');

            clearTimeout(posterHideTimer);

            posterHideTimer = setTimeout(function () {
                side.addClass('tfeed__side--hidden');
            }, 3000);
        }

        // --------------------------------------------------
        // SHOW ITEM
        // --------------------------------------------------

        function show(i, direction) {
            direction = direction || 1;

            if (i < 0) {
                return show(0, 1);
            }

            if (i >= items.length) {
                return loadPage(function (ok) {
                    if (ok && i < items.length) {
                        show(i, direction);
                    } else {
                        status(
                            TYPES[type] +
                            ' у цьому жанрі закінчилися'
                        );
                    }
                });
            }

            if (i >= items.length - META_AHEAD && page < totalPages) {
                loadPage();
            }

            index = i;

            var item = items[i];

            var my = ++seq;

            if (cur && cur.item !== item) {
                killPlayer(cur);
            }

            clearPlaybackTimers();

            stopBridge();

            status('');

            info(item);
            renderSide();
            showPosters();

            ensureVideo(item, function (trailer) {
                if (my !== seq || items[index] !== item) {
                    return;
                }

                if (trailer) {
                    playItem(item);
                } else {
                    show(index + direction, direction);
                }
            });

            prefetch();
        }

        // --------------------------------------------------
        // BEGIN
        // --------------------------------------------------

        function begin(done) {
            self.activity.loader(true);

            loadPage(function (ok) {
                self.activity.loader(false);

                if (ok && items.length) {
                    show(0, 1);
                } else {
                    status('Не вдалося завантажити список');
                }

                if (done) done();
            });
        }

        // --------------------------------------------------
        // GENRE PANEL
        // --------------------------------------------------

        function openPanel() {
            var list = ['movie', 'tv'].map(function (t) {
                return {
                    title: TYPES[t] + (t === type ? '  ✓' : ''),
                    tfeed_type: t
                };
            });

            list.push({
                title: 'Жанр',
                separator: true
            });

            [{ id: 0 }].concat(tmdb.genres[type] || []).forEach(function (g) {
                list.push({
                    title: genreTitle(type, g.id),
                    tfeed_genre: g.id,
                    selected: g.id === genre
                });
            });

            Lampa.Select.show({
                title: 'КіноТрейлери',
                items: list,

                onSelect: function (a) {
                    Lampa.Controller.toggle('content');

                    if (a.tfeed_type) {
                        if (a.tfeed_type === type) return;

                        var keep = (tmdb.genres[a.tfeed_type] || []).some(function (g) {
                            return g.id === genre;
                        });

                        reset(
                            a.tfeed_type,
                            keep ? genre : 0
                        );
                    } else {
                        if (a.tfeed_genre === genre) return;

                        reset(type, a.tfeed_genre);
                    }

                    begin();
                },

                onBack: function () {
                    Lampa.Controller.toggle('content');
                }
            });
        }

        // --------------------------------------------------
        // OPEN CARD
        // --------------------------------------------------

        function openCurrentCard() {
            var item = items[index];

            if (!item) return;

            Lampa.Activity.push({
                url: '',
                component: 'full',
                id: item.id,
                method: type,
                card: item,
                source: 'tmdb'
            });
        }

        // --------------------------------------------------
        // FAVORITE BUTTON FOCUS
        // --------------------------------------------------

        function isFavoriteButtonFocused() {
            var button = html.find('.tfeed__favorite');

            return button.hasClass('focus') ||
                button.hasClass('focused') ||
                button.is(':focus');
        }

        // --------------------------------------------------
        // CREATE
        // --------------------------------------------------

        this.create = function () {
            window.addEventListener('message', onMessage);

            html.find('.tfeed__chip').on('click', function (e) {
                e.stopPropagation();
                openPanel();
            });

            /*
             * Кнопка обраного:
             * - зупиняє спливання кліку;
             * - не відкриває повну картку;
             * - перемикає штатну закладку Lampa.
             */

            html.find('.tfeed__favorite')
                .on('click', function (e) {
                    e.preventDefault();
                    e.stopPropagation();

                    toggleFavorite();
                })
                .on('hover:enter', function (e) {
                    if (e && e.preventDefault) e.preventDefault();

                    toggleFavorite();
                });

            html.on('click', function (e) {
                if ($(e.target).closest('.tfeed__favorite').length) {
                    return;
                }

                if ($(e.target).closest('.tfeed__info').length) {
                    openCurrentCard();
                } else {
                    openPanel();
                }
            });

            // MOBILE SWIPE

            html[0].addEventListener(
                'touchstart',

                function (e) {
                    if (!e.touches || e.touches.length !== 1) {
                        touchActive = false;
                        return;
                    }

                    touchActive = true;

                    touchStartY = e.touches[0].clientY;
                    touchStartX = e.touches[0].clientX;
                    touchStartTime = Date.now();
                },

                { passive: true }
            );

            html[0].addEventListener(
                'touchend',

                function (e) {
                    if (!touchActive || !e.changedTouches || !e.changedTouches.length) {
                        return;
                    }

                    touchActive = false;

                    var deltaY = e.changedTouches[0].clientY - touchStartY;
                    var deltaX = e.changedTouches[0].clientX - touchStartX;
                    var deltaTime = Date.now() - touchStartTime;

                    if (
                        Math.abs(deltaY) > 30 &&
                        Math.abs(deltaY) > Math.abs(deltaX) &&
                        deltaTime < 500
                    ) {
                        if (deltaY < 0) {
                            show(index + 1, 1);
                        } else if (index > 0) {
                            show(index - 1, -1);
                        }
                    }
                },

                { passive: true }
            );

            reset(
                TYPES[object.type] ? object.type : 'movie',
                object.genre || 0
            );

            begin(function () {
                self.activity.toggle();
            });

            return this.render();
        };

        // --------------------------------------------------
        // START
        // --------------------------------------------------

        this.start = function () {
            Lampa.Controller.add('content', {
                toggle: function () {
                    Lampa.Controller.clear();
                },

                up: function () {
                    if (index > 0) {
                        show(index - 1, -1);
                    }
                },

                down: function () {
                    show(index + 1, 1);
                },

                left: function () {
                    Lampa.Controller.toggle('menu');
                },

                right: openPanel,

                enter: function () {
                    if (isFavoriteButtonFocused()) {
                        toggleFavorite();
                    } else {
                        openCurrentCard();
                    }
                },

                back: function () {
                    Lampa.Activity.backward();
                }
            });

            Lampa.Controller.toggle('content');

            fullscreen(true);

            if (index >= 0 && items[index]) {
                if (items[index].tfeed_video) {
                    playItem(items[index]);
                } else {
                    show(index, 1);
                }
            }
        };

        // --------------------------------------------------
        // PAUSE
        // --------------------------------------------------

        this.pause = function () {
            seq++;
            stopAll();
            fullscreen(false);
        };

        // --------------------------------------------------
        // STOP
        // --------------------------------------------------

        this.stop = function () {
            seq++;
            stopAll();
            fullscreen(false);
        };

        // --------------------------------------------------
        // RENDER
        // --------------------------------------------------

        this.render = function () {
            return html;
        };

        // --------------------------------------------------
        // DESTROY
        // --------------------------------------------------

        this.destroy = function () {
            seq++;
            feedGen++;

            stopAll();

            fullscreen(false);

            window.removeEventListener('message', onMessage);

            html.off();

            html.find('.tfeed__favorite').off();

            html.remove();
        };
    }

    // --------------------------------------------------
    // OPEN FEED
    // --------------------------------------------------

    function openFeed() {
        Lampa.Activity.push({
            url: '',
            title: 'КіноТрейлери',
            component: 'trailers_feed',
            page: 1,

            type: Lampa.Storage.get('tfeed_type', 'movie'),

            genre: parseInt(
                Lampa.Storage.get('tfeed_genre', 0),
                10
            ) || 0
        });
    }

    // --------------------------------------------------
    // INIT
    // --------------------------------------------------

    function start() {
        if (window.trailers_feed_plugin_started) return;

        window.trailers_feed_plugin_started = true;

        $('head').append('<style>' + css + '</style>');

        Lampa.Component.add('trailers_feed', Feed);

        var icon =
            '<svg viewBox="0 0 24 24" fill="currentColor">' +
            '<path d="M8 5v14l11-7z"/>' +
            '</svg>';

        if (Lampa.Menu.addButton) {
            Lampa.Menu.addButton(
                icon,
                'КіноТрейлери',
                openFeed
            );
        } else {
            var item = $(
                '<li class="menu__item selector">' +
                    '<div class="menu__ico">' + icon + '</div>' +
                    '<div class="menu__text">КіноТрейлери</div>' +
                '</li>'
            );

            item.on('hover:enter', openFeed);

            $('.menu .menu__list').eq(0).append(item);
        }
    }

    if (window.appready) {
        start();
    } else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') {
                start();
            }
        });
    }

})();
