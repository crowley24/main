/**
 * IPTV for Lampa 3.3.1 — Custom EPG Edition
 *
 * Base: IPTV 3.2 / Custom EPG 3.3
 * EPG Proxy 2.0.2 — POST batches
 *
 * Changes in 3.3.1:
 * - Fixed forced EPG refresh sequence
 * - EPG cache TTL: 6 hours
 * - Improved EPG diagnostics
 * - Preserves previously loaded EPG if refresh fails
 * - Handles queued forced refresh requests
 * - Keeps existing IPTV interface and features
 */
(function () {
    'use strict';

    if (!window.Lampa || !window.$) return;
    if (window.plugin_iptv_player_331_ready) return;
    window.plugin_iptv_player_331_ready = true;

    var ICON = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M8 2l4 4 4-4"/></svg>';

    var EPG_URL = 'https://iptv-epg-proxy.unclezhenya24.workers.dev/epg.xml';

    var CACHE_LIMIT = 2000000;
    var CACHE_TTL = 24 * 3600 * 1000;

    // Кеш EPG оновлюється кожні 6 годин.
    var EPG_TTL = 6 * 3600 * 1000;
    var EPG_CACHE_LIMIT = 1500000;

    // Worker 2.0.2 приймає максимум 40 ID за один запит.
    var BATCH_SIZE = 40;

    var UNLOCK_MS = 30 * 60 * 1000;
    var EPG_KEY = 'iptv_33_epg_cache';

    var STATE = {
        channels: [],
        groupOrder: [],
        loaded: false,
        loadedId: null,

        epg: null,
        epgLoading: false,
        epgWaiters: [],
        epgForcePending: false,
        epgStats: null,

        unlockedUntil: 0,
        current: null,
        playlist: [],
        playlistIndex: -1,
        activeGroup: null,
        panelFocus: 'channels',
        started: false
    };

    /* =====================================================
       UTILITIES
       ===================================================== */

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function noty(t) {
        try {
            Lampa.Noty.show(t);
        } catch (e) {}
    }

    function sget(k, d) {
        try {
            var v = Lampa.Storage.get(k, d);
            return v == null ? d : v;
        } catch (e) {
            return d;
        }
    }

    function sset(k, v) {
        try {
            Lampa.Storage.set(k, v);
        } catch (e) {}
    }

    function toSet(arr) {
        var o = Object.create(null);

        (Array.isArray(arr) ? arr : []).forEach(function (x) {
            o[x] = true;
        });

        return o;
    }

    function pad(n) {
        return n < 10 ? '0' + n : '' + n;
    }

    function fmtTime(t) {
        var d = new Date(t);

        return pad(d.getHours()) + ':' + pad(d.getMinutes());
    }

    function norm(s) {
        return String(s || '')
            .toLowerCase()
            .replace(/[^a-z0-9а-яіїєґ]+/g, '');
    }

    function truthy(v) {
        return v === true ||
            v === 'true' ||
            v === 1 ||
            v === '1';
    }

    function flag(k, def) {
        return truthy(sget(k, def));
    }

    function gridMode() {
        return flag('iptv_grid', false);
    }

    function ask(title, value, cb) {
        if (!Lampa.Input || !Lampa.Input.edit) {
            noty('IPTV: введення недоступне');
            cb(null);
            return;
        }

        Lampa.Input.edit({
            value: value || '',
            free: true,
            title: title
        }, function (v) {
            setTimeout(function () {
                cb(v == null ? null : String(v).trim());
            }, 200);
        });
    }

    function selectShow(o) {
        Lampa.Select.show(o);
    }

    /* =====================================================
       PLAYLISTS
       ===================================================== */

    function getLists() {
        var lists = sget('iptv_lists', []);

        if (!Array.isArray(lists)) lists = [];

        if (!lists.length) {
            var old = String(sget('iptv_url', '') || '').trim();

            if (old) {
                lists = [{
                    id: 'l1',
                    name: 'Основний',
                    url: old
                }];

                sset('iptv_lists', lists);
                sset('iptv_active', 'l1');
            }
        }

        return lists;
    }

    function activeList() {
        var lists = getLists();
        var id = sget('iptv_active', '');

        for (var i = 0; i < lists.length; i++) {
            if (lists[i].id === id) return lists[i];
        }

        return lists[0] || null;
    }

    function addPlaylist(cb) {
        ask('Посилання на плейлист M3U', '', function (url) {
            if (!url) return cb(false);

            if (!/^https?:\/\//i.test(url)) {
                noty('Посилання має починатися з http:// або https://');
                return cb(false);
            }

            var lists = getLists();

            if (lists.some(function (l) {
                return l.url === url;
            })) {
                noty('Цей плейлист уже додано');
                return cb(false);
            }

            var m = /^https?:\/\/([^\/?#]+)/i.exec(url);

            var name = (
                lists.length
                    ? 'Плейлист ' + (lists.length + 1)
                    : 'Основний'
            ) + (m ? ' (' + m[1] + ')' : '');

            var id = 'l' + Date.now();

            lists.push({
                id: id,
                name: name,
                url: url
            });

            sset('iptv_lists', lists);
            sset('iptv_active', id);

            STATE.loaded = false;
            STATE.loadedId = null;

            noty('Плейлист додано');
            cb(true);
        });
    }

    /* =====================================================
       M3U
       ===================================================== */

    function parseM3U(text) {
        var lines = String(text).split(/\r?\n/);
        var channels = [];
        var order = [];
        var groups = Object.create(null);
        var cur = null;

        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();

            if (!line) continue;

            if (line.indexOf('#EXTINF') === 0) {
                var g = /group-title="([^"]*)"/i.exec(line);
                var logo = /tvg-logo="([^"]*)"/i.exec(line);
                var tid = /tvg-id="([^"]*)"/i.exec(line);

                cur = {
                    name: line.substring(
                        line.lastIndexOf(',') + 1
                    ).trim() || 'Без назви',

                    group: g && g[1] || 'Без групи',
                    logo: logo && logo[1] || '',
                    id: tid && tid[1] || ''
                };
            } else if (line.charAt(0) === '#') {
                if (cur && line.indexOf('#EXTGRP:') === 0) {
                    cur.group = line.substring(8).trim() || cur.group;
                }
            } else if (cur) {
                cur.url = line;
                channels.push(cur);

                if (!groups[cur.group]) {
                    groups[cur.group] = true;
                    order.push(cur.group);
                }

                cur = null;
            }
        }

        return {
            channels: channels,
            order: order
        };
    }

    function applyParsed(text) {
        var p = parseM3U(text);

        STATE.channels = p.channels;
        STATE.groupOrder = p.order;
        STATE.loaded = p.channels.length > 0;

        return STATE.loaded;
    }

    function proxiedUrl(url) {
        var p = String(sget('iptv_proxy', '') || '').trim();

        return p ? p + encodeURIComponent(url) : null;
    }

    function download(url, ok, fail) {
        var alt = proxiedUrl(url);

        function attempt(target, viaProxy) {
            var xhr = new XMLHttpRequest();

            xhr.open('GET', target, true);
            xhr.timeout = 40000;

            function bad(reason) {
                if (!viaProxy && alt) {
                    return attempt(alt, true);
                }

                fail(reason);
            }

            xhr.onload = function () {
                if (
                    xhr.status >= 200 &&
                    xhr.status < 300 &&
                    xhr.responseText
                ) {
                    ok(xhr.responseText);
                } else {
                    bad('HTTP ' + xhr.status);
                }
            };

            xhr.onerror = function () {
                bad('мережа або CORS');
            };

            xhr.ontimeout = function () {
                bad('таймаут');
            };

            try {
                xhr.send();
            } catch (e) {
                bad(String(e));
            }
        }

        attempt(url, false);
    }

    function loadPlaylist(force, done, skipEpg) {
        var list = activeList();

        if (!list) {
            return addPlaylist(function (ok) {
                if (ok) {
                    loadPlaylist(true, done, skipEpg);
                } else {
                    done();
                }
            });
        }

        if (
            !force &&
            STATE.loaded &&
            STATE.loadedId === list.id
        ) {
            if (!skipEpg) maybeLoadEpg(false);

            return done();
        }

        var cacheKey = 'iptv_cache_' + list.id;
        var timeKey = 'iptv_cache_t_' + list.id;

        var cached = sget(cacheKey, '');
        var age = Date.now() - (
            parseInt(sget(timeKey, 0), 10) || 0
        );

        if (
            !force &&
            cached &&
            age < CACHE_TTL &&
            applyParsed(String(cached))
        ) {
            STATE.loadedId = list.id;

            if (!skipEpg) maybeLoadEpg(false);

            return done();
        }

        noty('IPTV: завантаження плейлиста...');

        download(list.url, function (text) {
            if (!applyParsed(text)) {
                noty('IPTV: канали не знайдено');
                return done();
            }

            STATE.loadedId = list.id;

            if (text.length < CACHE_LIMIT) {
                sset(cacheKey, text);
                sset(timeKey, Date.now());
            }

            if (!skipEpg) maybeLoadEpg(force);

            done();

        }, function (reason) {
            if (cached && applyParsed(String(cached))) {
                STATE.loadedId = list.id;

                noty(
                    'Відкрито збережений плейлист: ' + reason
                );

                if (!skipEpg) maybeLoadEpg(false);
            } else {
                STATE.loaded = false;
                noty('Помилка плейлиста: ' + reason);
            }

            done();
        });
    }

    /* =====================================================
       EPG PROXY 2.0.2
       ===================================================== */

    function parseXmltvTime(s) {
        var m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?\s*([+-]\d{4})?/
            .exec(String(s));

        if (!m) return 0;

        var t = Date.UTC(
            +m[1],
            +m[2] - 1,
            +m[3],
            +m[4],
            +m[5],
            +(m[6] || 0)
        );

        if (m[7]) {
            var sign = m[7].charAt(0) === '-' ? -1 : 1;

            t -= sign * (
                parseInt(m[7].substr(1, 2), 10) * 60 +
                parseInt(m[7].substr(3, 2), 10)
            ) * 60000;
        }

        return t;
    }

    function xmlText(node, tag) {
        var el = node.getElementsByTagName(tag)[0];

        return el
            ? String(el.textContent || '').trim()
            : '';
    }

    function parseEpgXml(text, result) {
        var doc = new DOMParser().parseFromString(
            text,
            'application/xml'
        );

        if (
            doc.getElementsByTagName('parsererror').length
        ) {
            throw new Error('Некоректний XMLTV');
        }

        var names = result.names;
        var progs = result.progs;

        var now = Date.now();
        var from = now - 2 * 3600000;
        var to = now + 36 * 3600000;

        var channels = doc.getElementsByTagName('channel');

        for (var i = 0; i < channels.length; i++) {
            var id = channels[i].getAttribute('id');

            if (!id) continue;

            var display = channels[i].getElementsByTagName(
                'display-name'
            );

            for (var j = 0; j < display.length; j++) {
                var key = norm(display[j].textContent);

                if (key) names[key] = id;
            }
        }

        var programmes = doc.getElementsByTagName('programme');

        for (var k = 0; k < programmes.length; k++) {
            var p = programmes[k];

            var cid = p.getAttribute('channel');
            var start = parseXmltvTime(p.getAttribute('start'));
            var stop = parseXmltvTime(p.getAttribute('stop'));

            if (
                !cid ||
                !start ||
                !stop ||
                stop < from ||
                start > to
            ) continue;

            var title = xmlText(p, 'title');

            if (!title) continue;

            if (!progs[cid]) progs[cid] = [];

            progs[cid].push([
                start,
                stop,
                title
            ]);
        }
    }

    function epgIds() {
        var seen = Object.create(null);
        var ids = [];

        STATE.channels.forEach(function (ch) {
            var id = String(ch.id || '').trim();

            if (
                id &&
                id.length <= 250 &&
                !/[\u0000-\u001f\u007f]/.test(id) &&
                !seen[id]
            ) {
                seen[id] = true;
                ids.push(id);
            }
        });

        return ids;
    }

    function idsSignature(ids) {
        return ids.slice().sort().join('\n');
    }

    function loadEpgCache(ids) {
        var cache = sget(EPG_KEY, null);

        if (
            !cache ||
            cache.signature !== idsSignature(ids) ||
            !cache.data ||
            !cache.t
        ) return false;

        if (Date.now() - cache.t > EPG_TTL) {
            return false;
        }

        STATE.epg = cache.data;
        STATE.epg.t = cache.t;
        STATE.epgStats = cache.stats || null;

        if (STATE.epgStats) {
            STATE.epgStats.cacheUsed = true;
            STATE.epgStats.message = 'Використовується кеш EPG';
        }

        return true;
    }

    function saveEpgCache(ids, data, stats) {
        var obj = {
            signature: idsSignature(ids),
            t: Date.now(),
            data: data,
            stats: stats
        };

        try {
            var serialized = JSON.stringify(obj);

            if (serialized.length <= EPG_CACHE_LIMIT) {
                sset(EPG_KEY, obj);
            }
        } catch (e) {
            console.warn('[IPTV 3.3.1] EPG cache save error', e);
        }
    }

    function postEpg(ids, ok, fail) {
        var xhr = new XMLHttpRequest();

        xhr.open('POST', EPG_URL, true);
        xhr.timeout = 45000;

        xhr.setRequestHeader(
            'Content-Type',
            'application/json'
        );

        xhr.onload = function () {
            if (
                xhr.status >= 200 &&
                xhr.status < 300 &&
                xhr.responseText
            ) {
                ok(
                    xhr.responseText,
                    parseInt(
                        xhr.getResponseHeader('X-EPG-Found'),
                        10
                    ) || 0,
                    parseInt(
                        xhr.getResponseHeader('X-EPG-Missing'),
                        10
                    ) || 0
                );
            } else {
                var message = 'HTTP ' + xhr.status;

                try {
                    var body = JSON.parse(xhr.responseText);

                    if (body.error) {
                        message += ': ' + body.error;
                    }
                } catch (e) {}

                fail(message);
            }
        };

        xhr.onerror = function () {
            fail('мережа або CORS');
        };

        xhr.ontimeout = function () {
            fail('таймаут');
        };

        try {
            xhr.send(JSON.stringify({
                ids: ids
            }));
        } catch (e) {
            fail(String(e));
        }
    }

    function epgDone() {
        STATE.epgLoading = false;

        var waiters = STATE.epgWaiters.splice(0);
        var forceAgain = STATE.epgForcePending;

        STATE.epgForcePending = false;

        waiters.forEach(function (fn) {
            try {
                fn();
            } catch (e) {
                console.warn('[IPTV 3.3.1] EPG callback error', e);
            }
        });

        if (forceAgain) {
            maybeLoadEpg(true);
        }
    }

    function maybeLoadEpg(force, callback) {
        if (callback) {
            STATE.epgWaiters.push(callback);
        }

        if (STATE.epgLoading) {
            if (force) {
                STATE.epgForcePending = true;
            }

            return;
        }

        var ids = epgIds();

        if (!ids.length) {
            STATE.epgStats = {
                requested: 0,
                found: 0,
                missing: 0,
                programChannels: 0,
                noProgramChannels: 0,
                failedBatches: 0,
                batches: 0,
                cacheUsed: false,
                message: 'У M3U немає tvg-id'
            };

            if (force) {
                noty('EPG: у плейлисті немає tvg-id');
            }

            return epgDone();
        }

        var signature = idsSignature(ids);

        if (
            !force &&
            STATE.epg &&
            STATE.epg.signature === signature &&
            Date.now() - STATE.epg.t < EPG_TTL
        ) {
            return epgDone();
        }

        if (!force && loadEpgCache(ids)) {
            return epgDone();
        }

        STATE.epgLoading = true;

        noty('EPG: завантаження програми...');

        var batches = [];

        for (var i = 0; i < ids.length; i += BATCH_SIZE) {
            batches.push(
                ids.slice(i, i + BATCH_SIZE)
            );
        }

        var result = {
            names: Object.create(null),
            progs: Object.create(null),
            t: Date.now(),
            signature: signature
        };

        var stats = {
            requested: ids.length,
            found: 0,
            missing: 0,
            programChannels: 0,
            noProgramChannels: 0,
            failedBatches: 0,
            batches: batches.length,
            cacheUsed: false,
            message: 'Завантаження завершено'
        };

        var pos = 0;

        function next() {
            if (pos >= batches.length) {
                Object.keys(result.progs).forEach(function (id) {
                    result.progs[id].sort(function (a, b) {
                        return a[0] - b[0];
                    });
                });

                var withPrograms = 0;

                ids.forEach(function (id) {
                    if (
                        result.progs[id] &&
                        result.progs[id].length
                    ) {
                        withPrograms++;
                    }
                });

                stats.programChannels = withPrograms;
                stats.noProgramChannels = Math.max(
                    0,
                    stats.requested - withPrograms
                );

                STATE.epgStats = stats;

                if (stats.found > 0) {
                    STATE.epg = result;

                    stats.message = stats.failedBatches
                        ? 'Часткове завантаження: є помилкові пакети'
                        : 'EPG успішно оновлено';

                    saveEpgCache(ids, result, stats);

                    noty(
                        'EPG: файлів ' +
                        stats.found +
                        ', із програмами ' +
                        stats.programChannels +
                        ' із ' +
                        stats.requested
                    );
                } else {
                    if (STATE.epg) {
                        stats.cacheUsed = true;
                        stats.message =
                            'Оновлення не вдалося; збережено попередні дані';

                        noty(
                            'EPG: оновлення не вдалося. ' +
                            'Залишено попередні дані'
                        );
                    } else {
                        stats.message =
                            'Не знайдено даних EPG; перевір tvg-id';

                        noty(
                            'EPG: не знайдено програм. Перевір tvg-id'
                        );
                    }
                }

                epgDone();
                return;
            }

            var batch = batches[pos];
            pos++;

            postEpg(batch, function (xml, found, missing) {
                try {
                    parseEpgXml(xml, result);

                    stats.found += found;
                    stats.missing += missing;
                } catch (e) {
                    stats.failedBatches++;
                    stats.missing += batch.length;

                    console.warn(
                        '[IPTV 3.3.1] EPG XML parse error',
                        e
                    );
                }

                next();

            }, function (reason) {
                stats.failedBatches++;
                stats.missing += batch.length;

                console.warn(
                    '[IPTV 3.3.1] EPG batch ' +
                    pos +
                    ': ' +
                    reason
                );

                next();
            });
        }

        next();
    }

    function nowTitle(ch) {
        if (!STATE.epg || !ch) return '';

        var id = ch.id;

        if (!STATE.epg.progs[id]) {
            id = STATE.epg.names[norm(ch.name)];
        }

        var list = STATE.epg.progs[id];

        if (!list) return '';

        var now = Date.now();

        for (var i = 0; i < list.length; i++) {
            if (
                list[i][0] <= now &&
                now < list[i][1]
            ) {
                return fmtTime(list[i][0]) +
                    '–' +
                    fmtTime(list[i][1]) +
                    '  ' +
                    list[i][2];
            }
        }

        return '';
    }

    /* =====================================================
       FAVORITES, HIDING, PIN
       ===================================================== */

    function isFav(url) {
        return !!toSet(sget('iptv_fav', []))[url];
    }

    function toggleFav(url) {
        var arr = sget('iptv_fav', []);

        if (!Array.isArray(arr)) arr = [];

        arr = arr.slice();

        var i = arr.indexOf(url);

        if (i < 0) {
            arr.push(url);
        } else {
            arr.splice(i, 1);
        }

        sset('iptv_fav', arr);
    }

    function isHidden(url) {
        return !!toSet(sget('iptv_hidden', []))[url];
    }

    function displayName(ch) {
        var names = sget('iptv_names', {});

        return names && names[ch.url] || ch.name;
    }

    function hasPin() {
        return !!String(
            sget('iptv_pin', '') || ''
        ).replace(/^p/, '');
    }

    function isUnlocked() {
        return Date.now() < STATE.unlockedUntil;
    }

    function askPin(cb) {
        ask('Введіть PIN', '', function (v) {
            if (
                v !== null &&
                v === String(
                    sget('iptv_pin', '') || ''
                ).replace(/^p/, '')
            ) {
                STATE.unlockedUntil = Date.now() + UNLOCK_MS;
                cb(true);
            } else {
                noty('Неправильний PIN');
                cb(false);
            }
        });
    }

    /* =====================================================
       CHANNEL VIEW
       ===================================================== */

    function buildView() {
        var hiddenG = toSet(
            sget('iptv_hidden_groups', [])
        );

        var locked = toSet(
            sget('iptv_locked', [])
        );

        var sort = flag('iptv_sort_az', false);

        var groups = Object.create(null);
        var order = [];
        var all = [];

        STATE.channels.forEach(function (c) {
            if (
                isHidden(c.url) ||
                hiddenG[c.group]
            ) return;

            var ch = {
                name: displayName(c),
                url: c.url,
                group: c.group,
                logo: c.logo,
                id: c.id,
                original: c
            };

            all.push(ch);

            if (!groups[ch.group]) {
                groups[ch.group] = [];
                order.push(ch.group);
            }

            groups[ch.group].push(ch);
        });

        if (sort) {
            all.sort(function (a, b) {
                return a.name.localeCompare(b.name);
            });

            order.sort(function (a, b) {
                return a.localeCompare(b);
            });

            Object.keys(groups).forEach(function (g) {
                groups[g].sort(function (a, b) {
                    return a.name.localeCompare(b.name);
                });
            });
        }

        return {
            all: all,
            groups: groups,
            order: order,
            locked: locked
        };
    }

    /* =====================================================
       PLAYBACK
       ===================================================== */

    function playChannel(ch, list) {
        if (!ch || !ch.url) return;

        STATE.playlist = list || [];

        STATE.playlistIndex = STATE.playlist.findIndex(
            function (c) {
                return c.url === ch.url;
            }
        );

        STATE.current = ch;

        var hist = sget('iptv_hist', []);

        if (!Array.isArray(hist)) hist = [];

        hist = hist.filter(function (u) {
            return u !== ch.url;
        });

        hist.unshift(ch.url);

        sset('iptv_hist', hist.slice(0, 30));

        sset(
            'iptv_last_group',
            STATE.activeGroup || ch.group || ''
        );

        var title = ch.name;
        var epg = nowTitle(ch);

        if (epg) {
            title += ' · ' + epg;
        }

        Lampa.Player.play({
            url: ch.url,
            title: title,
            address: ch.url
        });
    }

    /* =====================================================
       STYLES
       ===================================================== */

    function injectStyle() {
        if (
            document.getElementById('iptv-v33-style')
        ) return;

        var css = [
            '.iptv-v33{display:flex;height:100%;width:100%;overflow:hidden;background:var(--color-background,#0f0f0f)}',
            '.iptv-v33__side{width:260px;max-width:30%;display:flex;flex-direction:column;background:rgba(0,0,0,.28);border-right:1px solid rgba(255,255,255,.07);flex-shrink:0}',
            '.iptv-v33__side-head{padding:1.1em 1em .55em;font-size:1.08em;font-weight:600;opacity:.8}',
            '.iptv-v33__side-list{flex:1;overflow:auto;padding:.2em .55em 1.2em}',
            '.iptv-v33__grp{padding:.62em .8em;border-radius:.4em;margin:.1em 0;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:.45em}',
            '.iptv-v33__grp.focus,.iptv-v33__grp:hover{background:rgba(255,255,255,.09)}',
            '.iptv-v33__grp.active{background:rgba(33,150,243,.25);color:#90caf9}',
            '.iptv-v33__grp-count{opacity:.45;font-size:.84em;flex-shrink:0}',
            '.iptv-v33__main{flex:1;display:flex;flex-direction:column;min-width:0}',
            '.iptv-v33__head{padding:1.05em 1.3em .65em;display:flex;align-items:center;justify-content:space-between;gap:1em}',
            '.iptv-v33__title{font-size:1.4em;font-weight:700}',
            '.iptv-v33__meta{opacity:.5;font-size:.9em}',
            '.iptv-v33__list{flex:1;overflow:auto;padding:.25em .9em 1.4em}',
            '.iptv-v33__ch{display:flex;align-items:center;gap:.85em;padding:.68em .85em;border-radius:.42em;margin:.12em 0;cursor:pointer}',
            '.iptv-v33__ch.focus,.iptv-v33__ch:hover{background:rgba(255,255,255,.08)}',
            '.iptv-v33__ch-num{width:2.1em;text-align:right;opacity:.4;font-size:.88em;flex-shrink:0}',
            '.iptv-v33__ch-body{flex:1;min-width:0}',
            '.iptv-v33__ch-name{font-size:1.06em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
            '.iptv-v33__ch-epg{font-size:.8em;opacity:.65;margin-top:.12em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
            '.iptv-v33__ch-fav{color:#ffc107;margin-left:.35em}',
            '.iptv-v33__grid{display:flex;flex-wrap:wrap;gap:.75em;padding:.4em .2em 1.5em}',
            '.iptv-v33__tile{width:140px;background:rgba(255,255,255,.05);border-radius:.5em;overflow:hidden;cursor:pointer;transition:background .15s,transform .12s}',
            '.iptv-v33__tile.focus,.iptv-v33__tile:hover{background:rgba(255,255,255,.12);transform:scale(1.03)}',
            '.iptv-v33__tile-logo{height:80px;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.25)}',
            '.iptv-v33__tile-logo img{max-width:90%;max-height:70px;object-fit:contain}',
            '.iptv-v33__tile-logo span{font-size:1.6em;opacity:.35}',
            '.iptv-v33__tile-name{padding:.45em .5em .55em;font-size:.88em;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
            '.iptv-v33__empty{padding:2em;text-align:center;opacity:.5}'
        ].join('');

        var s = document.createElement('style');

        s.id = 'iptv-v33-style';
        s.textContent = css;

        document.head.appendChild(s);
    }

    /* =====================================================
       TWO-PANEL INTERFACE
       ===================================================== */

    function MainPanel() {
        var html = $('<div class="iptv-v33"></div>');

        var side = $('<div class="iptv-v33__side"></div>');
        var main = $('<div class="iptv-v33__main"></div>');

        var chList = $('<div class="iptv-v33__list"></div>');
        var grpList = $('<div class="iptv-v33__side-list"></div>');

        var titleEl = $('<div class="iptv-v33__title"></div>');
        var metaEl = $('<div class="iptv-v33__meta"></div>');

        var view;
        var channelItems = [];
        var groupItems = [];
        var focusIndex = 0;
        var groupFocus = 0;
        var destroyed = false;

        function currentChannels() {
            if (!view) return [];

            var all = view.all.filter(function (c) {
                return !view.locked[c.group] ||
                    !hasPin() ||
                    isUnlocked();
            });

            if (STATE.activeGroup === '__fav__') {
                return all.filter(function (c) {
                    return isFav(c.url);
                });
            }

            if (
                STATE.activeGroup === '__all__' ||
                !STATE.activeGroup
            ) {
                return all;
            }

            return view.groups[STATE.activeGroup] || [];
        }

        function renderChannels() {
            chList.empty();
            channelItems = [];

            var list = currentChannels();

            titleEl.text(
                STATE.activeGroup === '__fav__'
                    ? '★ Обране'
                    : STATE.activeGroup === '__all__'
                        ? 'Усі канали'
                        : (STATE.activeGroup || 'Канали')
            );

            metaEl.text(
                list.length +
                ' каналів · ' +
                (gridMode() ? 'плитки' : 'список')
            );

            if (!list.length) {
                chList.append(
                    '<div class="iptv-v33__empty">Немає каналів</div>'
                );
                return;
            }

            if (gridMode()) {
                var grid = $('<div class="iptv-v33__grid"></div>');

                list.forEach(function (ch, i) {
                    var tile = $(
                        '<div class="iptv-v33__tile selector" data-index="' + i + '">' +
                            '<div class="iptv-v33__tile-logo"></div>' +
                            '<div class="iptv-v33__tile-name"></div>' +
                        '</div>'
                    );

                    var logo = tile.find('.iptv-v33__tile-logo');

                    if (ch.logo) {
                        var img = $('<img alt="">').attr(
                            'src',
                            ch.logo
                        );

                        img.on('error', function () {
                            logo.empty().append('<span>📺</span>');
                        });

                        logo.append(img);
                    } else {
                        logo.append('<span>📺</span>');
                    }

                    tile.find('.iptv-v33__tile-name').text(
                        ch.name +
                        (isFav(ch.url) ? ' ★' : '')
                    );

                    tile.on('hover:enter click', function () {
                        playChannel(ch, list);
                    });

                    tile.on('hover:long', function () {
                        toggleFav(ch.url);
                        renderChannels();
                        renderGroups();
                        applyFocus();
                    });

                    grid.append(tile);
                    channelItems.push(tile);
                });

                chList.append(grid);

            } else {
                list.forEach(function (ch, i) {
                    var row = $(
                        '<div class="iptv-v33__ch selector" data-index="' + i + '">' +
                            '<div class="iptv-v33__ch-num"></div>' +
                            '<div class="iptv-v33__ch-body">' +
                                '<div class="iptv-v33__ch-name"></div>' +
                                '<div class="iptv-v33__ch-epg"></div>' +
                            '</div>' +
                        '</div>'
                    );

                    row.find('.iptv-v33__ch-num').text(i + 1);

                    row.find('.iptv-v33__ch-name').text(
                        ch.name +
                        (isFav(ch.url) ? ' ★' : '')
                    );

                    row.find('.iptv-v33__ch-epg').text(
                        nowTitle(ch) || ch.group || ''
                    );

                    row.on('hover:enter click', function () {
                        playChannel(ch, list);
                    });

                    row.on('hover:long', function () {
                        toggleFav(ch.url);
                        renderChannels();
                        renderGroups();
                        applyFocus();
                    });

                    chList.append(row);
                    channelItems.push(row);
                });
            }

            focusIndex = Math.min(
                focusIndex,
                Math.max(0, channelItems.length - 1)
            );
        }

        function renderGroups() {
            grpList.empty();
            groupItems = [];

            var visible = view.all.filter(function (c) {
                return !view.locked[c.group] ||
                    !hasPin() ||
                    isUnlocked();
            });

            var items = [
                {
                    id: '__fav__',
                    title: '★ Обране',
                    count: visible.filter(function (c) {
                        return isFav(c.url);
                    }).length
                },
                {
                    id: '__all__',
                    title: 'Усі канали',
                    count: visible.length
                }
            ];

            view.order.forEach(function (g) {
                items.push({
                    id: g,
                    title: (
                        view.locked[g] &&
                        hasPin() &&
                        !isUnlocked()
                            ? '🔒 '
                            : ''
                    ) + g,
                    count: view.groups[g].length
                });
            });

            items.forEach(function (g, i) {
                var row = $(
                    '<div class="iptv-v33__grp selector' +
                    (STATE.activeGroup === g.id ? ' active' : '') +
                    '" data-index="' + i + '">' +
                        '<span></span>' +
                        '<span class="iptv-v33__grp-count"></span>' +
                    '</div>'
                );

                row.find('span').eq(0).text(g.title);
                row.find('span').eq(1).text(g.count);

                row.on('hover:enter click', function () {
                    function change() {
                        STATE.activeGroup = g.id;

                        sset('iptv_last_group', g.id);

                        renderGroups();
                        renderChannels();

                        STATE.panelFocus = 'channels';
                        focusIndex = 0;

                        applyFocus();
                    }

                    if (
                        g.id !== '__fav__' &&
                        g.id !== '__all__' &&
                        view.locked[g.id] &&
                        hasPin() &&
                        !isUnlocked()
                    ) {
                        askPin(function (ok) {
                            if (ok) change();
                        });
                    } else {
                        change();
                    }
                });

                grpList.append(row);
                groupItems.push(row);
            });
        }

        function applyFocus() {
            channelItems.forEach(function (el) {
                el.removeClass('focus');
            });

            groupItems.forEach(function (el) {
                el.removeClass('focus');
            });

            var el = STATE.panelFocus === 'groups'
                ? groupItems[groupFocus]
                : channelItems[focusIndex];

            if (el) {
                el.addClass('focus');

                try {
                    el[0].scrollIntoView({
                        block: 'nearest'
                    });
                } catch (e) {}
            }
        }

        this.create = function () {
            injectStyle();

            side.append(
                '<div class="iptv-v33__side-head">Групи</div>'
            ).append(grpList);

            main.append(
                $('<div class="iptv-v33__head"></div>')
                    .append(titleEl)
                    .append(metaEl)
            ).append(chList);

            html.append(side).append(main);

            view = buildView();

            var mode = sget('iptv_start', 'last');
            var last = sget('iptv_last_group', '');

            STATE.activeGroup =
                mode === 'fav'
                    ? '__fav__'
                    : mode === 'all'
                        ? '__all__'
                        : (
                            last === '__fav__' ||
                            last === '__all__' ||
                            view.groups[last]
                                ? last
                                : (view.order[0] || '__all__')
                        );

            STATE.panelFocus = 'channels';

            renderGroups();
            renderChannels();

            if (STATE.epgLoading) {
                STATE.epgWaiters.push(function () {
                    if (!destroyed) {
                        renderChannels();
                        applyFocus();
                    }
                });
            }

            return html;
        };

        this.start = function () {
            Lampa.Controller.add('content', {
                toggle: function () {
                    Lampa.Controller.collectionSet(html);
                    applyFocus();
                },

                left: function () {
                    if (STATE.panelFocus === 'channels') {
                        STATE.panelFocus = 'groups';
                        applyFocus();
                    } else {
                        Lampa.Controller.toggle('menu');
                    }
                },

                right: function () {
                    if (STATE.panelFocus === 'groups') {
                        STATE.panelFocus = 'channels';
                        applyFocus();
                    }
                },

                up: function () {
                    if (STATE.panelFocus === 'channels') {
                        if (focusIndex > 0) {
                            focusIndex--;
                        } else {
                            return Lampa.Controller.toggle('head');
                        }
                    } else {
                        if (groupFocus > 0) {
                            groupFocus--;
                        } else {
                            return Lampa.Controller.toggle('head');
                        }
                    }

                    applyFocus();
                },

                down: function () {
                    if (STATE.panelFocus === 'channels') {
                        if (focusIndex < channelItems.length - 1) {
                            focusIndex++;
                        }
                    } else if (groupFocus < groupItems.length - 1) {
                        groupFocus++;
                    }

                    applyFocus();
                },

                enter: function () {
                    var el = STATE.panelFocus === 'groups'
                        ? groupItems[groupFocus]
                        : channelItems[focusIndex];

                    if (el) {
                        el.trigger('hover:enter');
                    }
                },

                back: function () {
                    Lampa.Activity.backward();
                }
            });

            Lampa.Controller.toggle('content');
        };

        this.pause = function () {};

        this.stop = function () {};

        this.render = function () {
            return html;
        };

        this.destroy = function () {
            destroyed = true;
            html.remove();
        };
    }

    /* =====================================================
       PLAYLIST MANAGEMENT
       ===================================================== */

    function showLists(backFn) {
        var lists = getLists();
        var active = activeList();

        var items = lists.map(function (l) {
            return {
                title: (
                    active && active.id === l.id
                        ? '● '
                        : ''
                ) + l.name,

                subtitle: l.url,
                act: 'pick',
                id: l.id,
                name: l.name
            };
        });

        items.push({
            title: '+ Додати плейлист',
            act: 'add'
        });

        if (lists.length) {
            items.push({
                title: 'Видалити плейлист',
                act: 'del'
            });
        }

        selectShow({
            title: 'Плейлисти',
            items: items,
            onBack: backFn,

            onSelect: function (item) {
                if (item.act === 'pick') {
                    sset('iptv_active', item.id);

                    STATE.loaded = false;
                    STATE.loadedId = null;

                    noty('Активний: ' + item.name);

                    showLists(backFn);

                } else if (item.act === 'add') {
                    addPlaylist(function () {
                        showLists(backFn);
                    });

                } else if (item.act === 'del') {
                    selectShow({
                        title: 'Видалити плейлист',

                        items: lists.map(function (l) {
                            return {
                                title: l.name,
                                id: l.id
                            };
                        }),

                        onBack: function () {
                            showLists(backFn);
                        },

                        onSelect: function (it) {
                            var rest = getLists().filter(function (l) {
                                return l.id !== it.id;
                            });

                            sset('iptv_lists', rest);

                            if (
                                sget('iptv_active', '') === it.id
                            ) {
                                sset(
                                    'iptv_active',
                                    rest[0] ? rest[0].id : ''
                                );
                            }

                            STATE.loaded = false;
                            STATE.loadedId = null;

                            noty('Плейлист видалено');

                            showLists(backFn);
                        }
                    });
                }
            }
        });
    }

    /* =====================================================
       SETTINGS
       ===================================================== */

    function addSettings() {
        if (
            !Lampa.SettingsApi ||
            !Lampa.SettingsApi.addComponent ||
            !Lampa.SettingsApi.addParam
        ) return;

        Lampa.SettingsApi.addComponent({
            component: 'iptv_player_33',
            name: 'IPTV',
            icon: ICON
        });

        function button(name, title, desc, fn) {
            Lampa.SettingsApi.addParam({
                component: 'iptv_player_33',

                param: {
                    name: name,
                    type: 'button'
                },

                field: {
                    name: title,
                    description: desc || ''
                },

                onChange: fn
            });
        }

        function toggle(name, title, desc, def) {
            Lampa.SettingsApi.addParam({
                component: 'iptv_player_33',

                param: {
                    name: name,
                    type: 'trigger',
                    default: def
                },

                field: {
                    name: title,
                    description: desc || ''
                }
            });
        }

        Lampa.SettingsApi.addParam({
            component: 'iptv_player_33',

            param: {
                name: 'iptv_start',
                type: 'select',

                values: {
                    last: 'Остання група',
                    fav: 'Обране',
                    all: 'Усі канали'
                },

                default: 'last'
            },

            field: {
                name: 'Відкривати при вході',
                description: 'Початкова група каналів'
            }
        });

        toggle(
            'iptv_grid',
            'Плитки з логотипами',
            'Вимкнено — список каналів',
            false
        );

        button(
            'iptv_s_lists_33',
            'Плейлисти',
            'Додати, вибрати або видалити',
            function () {
                showLists(function () {});
            }
        );

        button(
            'iptv_s_epg_33',
            'Оновити EPG',
            'Примусове оновлення через Cloudflare Worker 2.0.2',
            function () {
                loadPlaylist(false, function () {
                    if (STATE.loaded) {
                        maybeLoadEpg(true);
                    }
                }, true);
            }
        );

        button(
            'iptv_s_epgclear_33',
            'Очистити кеш EPG',
            'Видалити збережену телепрограму',
            function () {
                sset(EPG_KEY, null);

                STATE.epg = null;
                STATE.epgStats = null;

                noty('Кеш EPG очищено');
            }
        );

        button(
            'iptv_s_epgdiag_33',
            'Діагностика EPG',
            'Статистика каналів, програм, пакетів і кешу',
            function () {
                var st = STATE.epgStats;
                var ids = epgIds();

                if (!st) {
                    noty(
                        'EPG: немає статистики. Каналів із tvg-id: ' +
                        ids.length
                    );
                    return;
                }

                selectShow({
                    title: 'Діагностика EPG',

                    items: [
                        {
                            title: 'Каналів із tvg-id: ' + ids.length
                        },
                        {
                            title: 'Запитано у Worker: ' +
                                (st.requested || 0)
                        },
                        {
                            title: 'Файлів знайдено: ' +
                                (st.found || 0)
                        },
                        {
                            title: 'Файлів відсутні: ' +
                                (st.missing || 0)
                        },
                        {
                            title: 'Каналів із програмами: ' +
                                (st.programChannels || 0)
                        },
                        {
                            title: 'Без розібраної програми: ' +
                                (st.noProgramChannels || 0)
                        },
                        {
                            title: 'Помилкових пакетів: ' +
                                (st.failedBatches || 0)
                        },
                        {
                            title: 'Усього пакетів: ' +
                                (st.batches || 0)
                        },
                        {
                            title: 'Використовується кеш: ' +
                                (st.cacheUsed ? 'Так' : 'Ні')
                        },
                        {
                            title: st.message || 'EPG Proxy 2.0.2'
                        }
                    ],

                    onSelect: function () {}
                });
            }
        );

        toggle(
            'iptv_sort_az',
            'Сортувати за алфавітом',
            'Вимкнено — порядок M3U',
            false
        );

        button(
            'iptv_s_proxy_33',
            'CORS-проксі для M3U',
            'Не використовується для EPG Worker',
            function () {
                ask(
                    'Префікс CORS-проксі',
                    String(sget('iptv_proxy', '') || ''),
                    function (v) {
                        if (v !== null) {
                            sset('iptv_proxy', v);
                            STATE.loaded = false;
                        }
                    }
                );
            }
        );

        button(
            'iptv_s_reload_33',
            'Оновити плейлист і EPG',
            'Примусове оновлення плейлиста та телепрограми',
            function () {
                loadPlaylist(true, function () {
                    if (STATE.loaded) {
                        maybeLoadEpg(true);
                    }
                }, true);
            }
        );
    }

    /* =====================================================
       OPEN IPTV
       ===================================================== */

    function open() {
        loadPlaylist(false, function () {
            if (!STATE.loaded) {
                noty(
                    'Додайте плейлист у Налаштування → IPTV'
                );
                return;
            }

            Lampa.Activity.push({
                url: '',
                title: 'IPTV',
                component: 'iptv_main_33',
                page: 1
            });
        });
    }

    /* =====================================================
       SIDE MENU
       ===================================================== */

    function addMenuButton() {
        var menu = $('.menu .menu__list').eq(0);

        if (!menu.length) return false;

        menu.find(
            '[data-action="iptv_player_33"]'
        ).remove();

        var item = $(
            '<li class="menu__item selector" data-action="iptv_player_33">' +
                '<div class="menu__ico">' + ICON + '</div>' +
                '<div class="menu__text">IPTV</div>' +
            '</li>'
        );

        item.on('hover:enter click', open);

        menu.append(item);

        return true;
    }

    /* =====================================================
       INITIALIZATION
       ===================================================== */

    function start() {
        if (STATE.started) return;

        if (!$('.menu .menu__list').length) {
            setTimeout(start, 500);
            return;
        }

        STATE.started = true;

        Lampa.Component.add(
            'iptv_main_33',
            MainPanel
        );

        try {
            addSettings();
        } catch (e) {
            console.error(
                '[IPTV 3.3.1] settings',
                e
            );
        }

        try {
            addMenuButton();
        } catch (e) {
            console.error(
                '[IPTV 3.3.1] menu',
                e
            );
        }

        console.log(
            '[IPTV 3.3.1] Custom EPG Edition ready'
        );
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
