/* UAKino Lite для Lampa (з підтримкою локальної історії Lampa та синхронізацією з KinoHub) */  
(function () {  
    'use strict';  
    if (window.uakino_lite_ready) return;  
    window.uakino_lite_ready = true;  

    var API = 'https://uakino.ax';  
    var TIMEOUT = 15000;  
    var KINOHUB_API = 'https://kinohub.uk/api/history/set';

    // Змінні для керування частотою відправки історії в KinoHub
    var lastSyncTime = 0;
    var SYNC_INTERVAL = 30000; // Збереження кожні 30 секунд

    var uakinoFetch = (typeof window.fetch === 'function') ? function (u, o) {  
        var ctrl = typeof AbortController === 'function' ? new AbortController() : null;  
        if (ctrl) {  
            o = o || {};  
            o.signal = ctrl.signal;  
            setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, TIMEOUT);  
        }  
        return window.fetch(u, o);  
    } : function (url, opts) {  
        opts = opts || {};  
        return new Promise(function (resolve, reject) {  
            var x = new XMLHttpRequest();  
            x.open(opts.method || 'GET', url, true);  
            x.timeout = TIMEOUT;  
            if (opts.headers) for (var k in opts.headers) { try { x.setRequestHeader(k, opts.headers[k]); } catch (e) {} }  
            if (opts.cache === 'no-store') { try { x.setRequestHeader('Cache-Control', 'no-cache'); } catch (e) {} }  
            x.onload = function () {  
                resolve({  
                    ok: x.status >= 200 && x.status < 300,  
                    status: x.status,  
                    text: function () { return Promise.resolve(x.responseText); },  
                    json: function () {  
                        try { return Promise.resolve(JSON.parse(x.responseText)); } catch (e) { return Promise.reject(e); }  
                    }  
                });  
            };  
            x.onerror = function () { reject(new Error('network')); };  
            x.ontimeout = function () { reject(new Error('timeout')); };  
            x.send(opts.body || null);  
        });  
    };  

    var ICON = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="M10 9.5v5l4-2.5z" fill="currentColor"></path></svg>';  

    function sid() {  
        var s = Lampa.Storage.get('uakino_lite_sid', '');  
        if (!s) {  
            s = 'lp' + Math.random().toString(36).slice(2) + Date.now().toString(36);  
            Lampa.Storage.set('uakino_lite_sid', s);  
        }  
        return s;  
    }  

    function hevc() {  
        try {  
            if (Lampa.Platform.is('android')) return 1;  
            var t = 'video/mp4; codecs="hvc1.1.6.L153.90"';  
            if (window.MediaSource && MediaSource.isTypeSupported && MediaSource.isTypeSupported(t)) return 1;  
            if (document.createElement('video').canPlayType(t)) return 1;  
        } catch (e) {}  
        return 0;  
    }  

    function getJSON(url) {  
        return uakinoFetch(url, { cache: 'no-store' }).then(function (r) {  
            return r.json().then(function (j) {  
                if (!r.ok && !j.found && r.status !== 404) throw new Error(j.error || r.status);  
                return j;  
            });  
        });  
    }  

    function q(o) {  
        return Object.keys(o).filter(function (k) {  
            return o[k] !== undefined && o[k] !== null && o[k] !== '';  
        }).map(function (k) {  
            return k + '=' + encodeURIComponent(o[k]);  
        }).join('&');  
    }  

    /* --- ІНТЕГРАЦІЯ З KINOHUB --- */
    function sendKinoHubHistory(force) {
        try {
            var token = Lampa.Storage.get('kinohub_token') || Lampa.Storage.get('account_token');
            if (!token) return;

            var currentItem = Lampa.Player.data();
            if (!currentItem || !currentItem.movie) return;

            var now = Date.now();
            if (!force && (now - lastSyncTime < SYNC_INTERVAL)) return;
            lastSyncTime = now;

            var video = Lampa.Player.video();
            if (!video) return;

            var currentTime = video.currentTime || 0;
            var duration = video.duration || 0;
            if (!duration) return;

            var movie = currentItem.movie;
            var isTv = !!(movie.name || movie.number_of_seasons || movie.first_air_date || currentItem.season);

            var body = {
                card_id: movie.id,
                media: isTv ? 'tv' : 'movie',
                season: currentItem.season || (currentItem.uakino ? currentItem.uakino.season : 0) || 0,
                episode: currentItem.episode || (currentItem.uakino ? currentItem.uakino.episode : 0) || 0,
                time: Math.round(currentTime),
                duration: Math.round(duration),
                percent: Math.round((currentTime / duration) * 100) || 0
            };

            $.ajax({
                url: KINOHUB_API,
                type: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + token,
                    'Content-Type': 'application/json'
                },
                data: JSON.stringify(body),
                success: function () {
                    // Історія успішно надіслана на my.kinohub.uk
                },
                error: function (e) {
                    // Помилка відправки
                }
            });
        } catch (e) {}
    }

    // Слухачі подій плеєра Lampa
    Lampa.Player.listener.follow('timeupdate', function () {
        sendKinoHubHistory(false);
    });

    Lampa.Player.listener.follow('destroy', function () {
        sendKinoHubHistory(true);
    });

    Lampa.Player.listener.follow('ended', function () {
        sendKinoHubHistory(true);
    });
    /* ------------------------------ */

    function find(movie) {  
        var tv = !!(movie.name || movie.number_of_seasons || movie.first_air_date);  
        var date = movie.release_date || movie.first_air_date || '';  
        return getJSON(API + '/hls/api/lampa/find?' + q({  
            tmdb: movie.id,  
            imdb: movie.imdb_id,  
            type: tv ? 'tv' : 'movie',  
            year: date.slice(0, 4),  
            title: movie.title || movie.name,  
            orig: movie.original_title || movie.original_name  
        }));  
    }  

    function play(movieId, opt) {  
        return getJSON(API + '/hls/api/play?' + q({  
            movie: movieId,  
            s: sid(),  
            hevc: hevc(),  
            voice: opt.voice,  
            season: opt.season,  
            episode: opt.episode,  
            q: opt.q  
        }));  
    }  

    function m3u8(u) {  
        if (!u || /\.m3u8($|\?)/.test(u)) return u;  
        return u.replace(/(\?|#|$)/, '.m3u8$1');  
    }  

    function timeline(movie, s, e) {  
        try {  
            var orig = (movie.number_of_seasons || movie.name)  
                ? (movie.original_name || movie.name || '')  
                : (movie.original_title || movie.title || '');  
            var key = s != null ? [s, s > 10 ? ':' : '', e, orig].join('') : orig;  
            return Lampa.Timeline.view(Lampa.Utils.hash(key));  
        } catch (err) {  
            return undefined;  
        }  
    }  

    function addToHistory(movie) {  
        try {  
            if (movie && movie.id) Lampa.Favorite.add('history', movie, 100);  
        } catch (e) {}  
    }  

    function start(p, title, view, meta, movie) {  
        var url = p.manifest_abs || (API + p.manifest);  
        var item = {  
            title: title,  
            url: m3u8(url),  
            timeline: view,  
            uakino: meta,  
            movie: movie,  
            hls_type: 'hlsjs'  
        };  
        if (p.subs && p.subs.length) {  
            item.subtitles = p.subs.map(function (s) {  
                return { label: s.label, url: API + s.url };  
            });  
        }  
        Lampa.Player.play(item);  
        Lampa.Player.playlist([item]);  
    }  

    function select(title, items, cb) {  
        var enabled = Lampa.Controller.enabled() && Lampa.Controller.enabled().name;  
        Lampa.Select.show({  
            title: title,  
            items: items,  
            onSelect: cb,  
            onBack: function () {  
                Lampa.Controller.toggle(enabled || 'full_start');  
            }  
        });  
    }  

    function open(movie) {  
        Lampa.Loading.start(function () { Lampa.Loading.stop(); });  
        find(movie).then(function (f) {  
            if (!f.found) {  
                Lampa.Loading.stop();  
                Lampa.Noty.show('UAKino: цього фільму поки немає');  
                return;  
            }  
            addToHistory(movie);  
            play(f.movie_id, {}).then(function (p) {  
                Lampa.Loading.stop();  
                var name = movie.title || movie.name || f.title;  
                var voices = p.voices && p.voices.length ? p.voices : [null];  
                var has4k = !!p.alt4k && hevc() === 1;  

                var chooseVoice = function (cb) {  
                    if (voices.length < 2 && !has4k) return cb(voices[0]);  
                    var items = voices.map(function (v) {  
                        return { title: v || 'Українська', voice: v };  
                    });  
                    if (has4k) items.unshift({ title: '4K · найвища якість', voice: null, q: '2160' });  
                    select('Якість і озвучка', items, function (it) {  
                        cb(it.voice, it.q);  
                    });  
                };  

                if (!p.is_series) {  
                    chooseVoice(function (v, qq) {  
                        var meta = { movie: f.movie_id, voice: v };  
                        if (!qq && (voices.length < 2 || (p.current && v === p.current.voice))) {  
                            return start(p, name, timeline(movie), meta, movie);  
                        }  
                        Lampa.Loading.start(function () { Lampa.Loading.stop(); });  
                        play(f.movie_id, { voice: v, q: qq }).then(function (pp) {  
                            Lampa.Loading.stop();  
                            start(pp, name + (qq ? ' • 4K' : v ? ' • ' + v : ''), timeline(movie), meta, movie);  
                        }).catch(function (e) {  
                            Lampa.Loading.stop();  
                            Lampa.Noty.show('UAKino: ' + (e && e.message || 'помилка'));  
                        });  
                    });  
                    return;  
                }  

                chooseVoice(function (v) {  
                    var eps = (p.episodes || []).filter(function (e) {  
                        return (e.voice || null) === (v || null) && e.episode != null;  
                    }).map(function (e) {  
                        if (e.season == null) e.season = 1;  
                        return e;  
                    });  
                    var seasons = eps.map(function (e) { return e.season; }).filter(function (s, i, a) {  
                        return a.indexOf(s) === i;  
                    }).sort(function (a, b) { return a - b; });  

                    if (!eps.length) {  
                        Lampa.Noty.show('UAKino: серій не знайдено');  
                        return;  
                    }  

                    var chooseSeason = function (cb) {  
                        if (seasons.length < 2) return cb(seasons[0]);  
                        select('Сезон', seasons.map(function (s) {  
                            return { title: 'Сезон ' + s, season: s };  
                        }), function (it) { cb(it.season); });  
                    };  

                    chooseSeason(function (s) {  
                        var list = eps.filter(function (e) {  
                            return e.season === s;  
                        }).sort(function (a, b) { return a.episode - b.episode; });  

                        select('Сезон ' + s, list.map(function (e) {  
                            var own = e.title && !/^\s*(серія|епізод|episode)\s*\d+\s*$/i.test(e.title);  
                            return {  
                                title: 'Серія ' + e.episode + (own ? ' — ' + e.title : ''),  
                                ep: e  
                            };  
                        }), function (it) {  
                            Lampa.Loading.start(function () { Lampa.Loading.stop(); });  
                            var items = new Array(list.length), idx = list.indexOf(it.ep), k = 0;  

                            var next = function () {  
                                if (k >= list.length) return Promise.resolve();  
                                var j = k++, e = list[j];  
                                return play(f.movie_id, { voice: v, season: s, episode: e.episode }).then(function (pp) {  
                                    items[j] = {  
                                        title: name + ' • С' + s + ' Е' + e.episode,  
                                        url: m3u8(pp.manifest_abs || (API + pp.manifest)),  
                                        timeline: timeline(movie, s, e.episode),  
                                        movie: movie,  
                                        season: s,
                                        episode: e.episode,
                                        hls_type: 'hlsjs',  
                                        uakino: { movie: f.movie_id, voice: v, season: s, episode: e.episode }  
                                    };  
                                    if (pp.subs && pp.subs.length) {  
                                        items[j].subtitles = pp.subs.map(function (x) {  
                                            return { label: x.label, url: API + x.url };  
                                        });  
                                    }  
                                }).catch(function () {}).then(next);  
                            };  

                            Promise.all([next(), next(), next(), next()]).then(function () {  
                                Lampa.Loading.stop();  
                                var ok = items.filter(Boolean);  
                                if (!items[idx]) {  
                                    Lampa.Noty.show('UAKino: не вдалося відкрити серію');  
                                    return;  
                                }  
                                Lampa.Player.play(items[idx]);  
                                Lampa.Player.playlist(ok);  
                            });  
                        });  
                    });  
                });  
            }).catch(function (e) {  
                Lampa.Loading.stop();  
                Lampa.Noty.show('UAKino: помилка ' + (e && e.message || ''));  
            });  
        }).catch(function (e) {  
            Lampa.Loading.stop();  
            Lampa.Noty.show('UAKino: фільм не знайдено');  
        });  
    }  

    function addButton(render, movie) {  
        if (!render || !movie) return;  
        if (render.find('.view--uakino-lite').length) return;  
        var btn = $('<div class="full-start__button selector view--uakino-lite" data-subtitle="uakino.ax">' + ICON + '<span>UAKino</span></div>');  
        btn.on('hover:enter', function () {  
            open(movie);  
        });  
        var anchor = render.find('.view--torrent');  
        if (anchor.length) anchor.after(btn);  
        else render.find('.full-start-new__buttons, .full-start__buttons').first().append(btn);  
    }  

    Lampa.Listener.follow('full', function (e) {  
        if (e.type === 'complite') {  
            try { addButton(e.object.activity.render(), e.data.movie); } catch (err) { console.log('uakino lite error', err); }  
        }  
    });  

    try {  
        var act = Lampa.Activity.active();  
        if (act && act.component === 'full') {  
            addButton(act.activity.render(), act.card);  
        }  
    } catch (e) {}  

    try {  
        if (Lampa.Manifest) {  
            Lampa.Manifest.plugins = {  
                type: 'video',  
                version: '1.2',  
                name: 'UAKino Lite',  
                description: 'Перегляд через uakino.ax з підтримкою KinoHub',  
                onContextMenu: function (object) {  
                    return { name: 'UAKino', description: 'uakino.ax' };  
                },  
                onContextLauch: function (object) {  
                    open(object);  
                }  
            };  
        }  
    } catch (e) {}  

})();
