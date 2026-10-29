/**
 * IPTV for Lampa 3.3.2
 * Custom EPG Edition — Optimized for Fast Switching & Full Features
 */
(function () {
    'use strict';

    if (!window.Lampa || !window.$) return;
    if (window.plugin_iptv_player_332_ready) return;

    window.plugin_iptv_player_332_ready = true;

    var ICON =
        '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<rect x="3" y="6" width="18" height="13" rx="2"/>' +
        '<path d="M8 2l4 4 4-4"/>' +
        '</svg>';

    var EPG_URL =
        'https://iptv-epg-proxy.unclezhenya24.workers.dev/epg.xml';

    var CACHE_LIMIT = 2000000;
    var CACHE_TTL = 24 * 3600 * 1000;

    var EPG_TTL = 6 * 3600 * 1000;
    var EPG_CACHE_LIMIT = 1500000;
    var BATCH_SIZE = 40;

    var EPG_HISTORY = 24 * 3600 * 1000;
    var EPG_FUTURE = 12 * 3600 * 1000;

    var EPG_CACHE_PROGRAM_LIMITS = [30, 20, 12, 8, 5, 3, 1];

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

        current: null,
        playlist: [],
        playlistIndex: -1,

        activeGroup: null,
        panelFocus: 'channels',
        started: false
    };

    var groupPositions = Object.create(null);

    /* =====================================================
       UTILITIES
       ===================================================== */

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
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
            .replace(/[^a-z0-9а-яёіїєґ]+/g, '');
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

    function safeNumber(v, fallback) {
        var n = Number(v);

        return isFinite(n) ? n : fallback;
    }

    function getCatchupDays(channel) {
        var days = safeNumber(
            channel && channel.catchup ? channel.catchup.days : 0,
            0
        );

        return days > 0 ? days : 3;
    }

    function formatBytes(bytes) {
        bytes = Number(bytes) || 0;

        if (bytes < 1024) return bytes + ' Б';

        if (bytes < 1024 * 1024) {
            return (bytes / 1024).toFixed(1) + ' КБ';
        }

        return (bytes / (1024 * 1024)).toFixed(2) + ' МБ';
    }

    /* =====================================================
       PROGRAM PROGRESS
       ===================================================== */

    function programProgress(program, at) {
        if (!program ||
            !program.start ||
            !program.stop ||
            program.stop <= program.start) {
            return 0;
        }

        at = at || Date.now();

        return Math.max(
            0,
            Math.min(
                100,
                Math.round(
                    (at - program.start) /
                    (program.stop - program.start) * 100
                )
            )
        );
    }

    /* =====================================================
       ARCHIVE URL HANDLING
       ===================================================== */

    function normalizeCatchupVariables(template) {
        var aliases = {
            utc: 'start',
            lutc: 'timestamp',
            current_utc: 'timestamp',
            utcend: 'end',
            durationfs: 'duration'
        };

        return String(template || '').replace(
            /(^|[^$])\{([a-z_][a-z0-9_-]*)\}/gi,
            function (full, prefix, name) {
                var normalized =
                    aliases[name.toLowerCase()] || name.toLowerCase();

                return prefix + '${' + normalized + '}';
            }
        );
    }

    function setCatchupQuery(template, name, value) {
        var hashIndex = template.indexOf('#');

        var hash = hashIndex >= 0
            ? template.slice(hashIndex)
            : '';

        var base = hashIndex >= 0
            ? template.slice(0, hashIndex)
            : template;

        var expression = new RegExp(
            '([?&])' + name + '=[^&#]*',
            'i'
        );

        if (expression.test(base)) {
            base = base.replace(
                expression,
                function (full, separator) {
                    return separator + name + '=' + value;
                }
            );
        } else {
            base += (base.indexOf('?') >= 0 ? '&' : '?') +
                name + '=' + value;
        }

        return base + hash;
    }

    function shiftTemplate(url) {
        var template = normalizeCatchupVariables(url);

        template = setCatchupQuery(
            template,
            'utc',
            '${start}'
        );

        template = setCatchupQuery(
            template,
            'lutc',
            '${timestamp}'
        );

        return template;
    }

    function appendCatchupSource(url, source) {
        url = String(url || '');
        source = normalizeCatchupVariables(source || '');

        if (!source) return url;

        if (/^https?:\/\//i.test(source)) {
            return source;
        }

        if (source.charAt(0) === '?' ||
            source.charAt(0) === '&') {
            return url + source;
        }

        if (source.charAt(0) === '/') {
            var match = /^(https?:\/\/[^/]+)(\/.*)?$/i.exec(url);

            if (match) {
                return match[1] + source;
            }
        }

        return url + source;
    }

    function catchupTemplate(channel) {
        if (!channel || !channel.url) return false;

        var catchup = channel.catchup || {};

        var type = String(catchup.type || '')
            .trim()
            .toLowerCase();

        var source = normalizeCatchupVariables(
            catchup.source || ''
        );

        var url = normalizeCatchupVariables(channel.url);

        if (type === 'disabled' || type === 'none') {
            return false;
        }

        if (type === 'flussonic' || type === 'fs') {
            var flussonic = url.replace(
                /\/(video\d*|mono\d*)\.(m3u8|ts)(\?[^#]*)?(#.*)?$/i,
                '/$1-${start}-${duration}.$2$3$4'
            );

            return flussonic !== url ? flussonic : false;
        }

        if (type === 'append') {
            return source
                ? appendCatchupSource(channel.url, source)
                : shiftTemplate(channel.url);
        }

        if (type === 'shift') {
            return source || shiftTemplate(channel.url);
        }

        if (type === 'default') {
            return source || shiftTemplate(channel.url);
        }

        return source || shiftTemplate(channel.url);
    }

    function buildArchiveUrl(channel, program) {
        var template = catchupTemplate(channel);

        if (!template || !program) return false;

        if (!program.start || !program.stop ||
            program.stop <= program.start) {
            return false;
        }

        var start = Math.floor(program.start / 1000);
        var end = Math.floor(program.stop / 1000);
        var now = Math.floor(Date.now() / 1000);

        var duration = Math.max(1, end - start);

        var values = {
            start: start,
            utc: start,
            end: end,
            utcend: end,
            timestamp: now,
            lutc: now,
            duration: duration,
            durationfs: duration
        };

        return normalizeCatchupVariables(template).replace(
            /\$\{([^}]+)\}/g,
            function (full, expression) {
                if (Object.prototype.hasOwnProperty.call(
                    values,
                    expression
                )) {
                    return encodeURIComponent(values[expression]);
                }

                return full;
            }
        );
    }

    function canArchive(channel, program) {
        if (!channel || !program ||
            !program.start ||
            !program.stop ||
            program.stop <= program.start) {
            return false;
        }

        if (program.start > Date.now()) return false;

        var template = catchupTemplate(channel);

        if (!template) return false;

        var days = getCatchupDays(channel);
        var oldest = Date.now() - days * 86400000;

        return program.start >= oldest;
    }

    /* =====================================================
       PLAYLIST MANAGEMENT
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

            var m = /^https?:\/\/([^/?#]+)/i.exec(url);

            var name = (lists.length
                ? 'Плейлист ' + (lists.length + 1)
                : 'Основний') + (m ? ' (' + m[1] + ')' : '');

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
       M3U PARSER
       ===================================================== */

    function capture(pattern, text) {
        var m = pattern.exec(text);

        return m && m[1] != null ? m[1] : '';
    }

    function parseM3U(text) {
        text = String(text || '').replace(/^\uFEFF/, '');

        var lines = text.split(/\r?\n/);
        var header = lines[0] || '';

        var headerCatchup = {
            type: capture(/catchup="([^"]*)"/i, header),
            source: capture(/catchup-source="([^"]*)"/i, header),
            days: capture(/catchup-days="([^"]*)"/i, header)
        };

        var channels = [];
        var order = [];
        var groups = Object.create(null);
        var cur = null;

        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();

            if (!line) continue;

            if (line.indexOf('#EXTINF') === 0) {
                var group = capture(/group-title="([^"]*)"/i, line);
                var logo = capture(/tvg-logo="([^"]*)"/i, line);
                var id = capture(/tvg-id="([^"]*)"/i, line);

                var recDays =
                    capture(/tvg-rec="([^"]*)"/i, line) ||
                    headerCatchup.days;

                var channelDays = capture(
                    /catchup-days="([^"]*)"/i,
                    line
                );

                var days = parseFloat(
                    channelDays || recDays
                ) || 0;

                var type =
                    capture(/catchup="([^"]*)"/i, line) ||
                    headerCatchup.type;

                var source =
                    capture(/catchup-source="([^"]*)"/i, line) ||
                    headerCatchup.source;

                cur = {
                    name: line.substring(
                        line.lastIndexOf(',') + 1
                    ).trim() || 'Без назви',

                    group: group || 'Без групи',
                    logo: logo || '',
                    id: id || '',

                    catchup: {
                        type: type,
                        source: source,
                        days: days
                    }
                };
            } else if (line.charAt(0) === '#') {
                if (cur && line.indexOf('#EXTGRP:') === 0) {
                    cur.group = line.substring(8).trim() ||
                        cur.group;
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

    /* =====================================================
       DOWNLOAD & PLAYLIST CACHE
       ===================================================== */

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
                if (xhr.status >= 200 &&
                    xhr.status < 300 &&
                    xhr.responseText) {
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

        if (!force &&
            STATE.loaded &&
            STATE.loadedId === list.id) {
            if (!skipEpg) maybeLoadEpg(false);

            return done();
        }

        var cacheKey = 'iptv_cache_' + list.id;
        var timeKey = 'iptv_cache_t_' + list.id;

        var cached = sget(cacheKey, '');

        var age = Date.now() -
            (parseInt(sget(timeKey, 0), 10) || 0);

        if (!force &&
            cached &&
            age < CACHE_TTL &&
            applyParsed(String(cached))) {
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
            } else {
                noty('IPTV: плейлист завеликий для кешування');
            }

            if (!skipEpg) maybeLoadEpg(force);

            done();
        }, function (reason) {
            if (cached && applyParsed(String(cached))) {
                STATE.loadedId = list.id;

                noty('Відкрито збережений плейлист: ' + reason);

                if (!skipEpg) maybeLoadEpg(false);
            } else {
                STATE.loaded = false;

                noty('Помилка плейлиста: ' + reason);
            }

            done();
        });
    }

    /* =====================================================
       XMLTV PARSER
       ===================================================== */

    function parseXmltvTime(s) {
        var m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?\s*([+-]\d{4})?/.exec(
            String(s || '')
        );

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

            var offset =
                parseInt(m[7].substr(1, 2), 10) * 60 +
                parseInt(m[7].substr(3, 2), 10);

            t -= sign * offset * 60000;
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

        if (doc.getElementsByTagName('parsererror').length) {
            throw new Error('Некоректний XMLTV');
        }

        var names = result.names;
        var progs = result.progs;

        var now = Date.now();
        var from = now - EPG_HISTORY;
        var to = now + EPG_FUTURE;

        var channels = doc.getElementsByTagName('channel');

        for (var i = 0; i < channels.length; i++) {
            var id = channels[i].getAttribute('id');

            if (!id) continue;

            var display =
                channels[i].getElementsByTagName('display-name');

            for (var j = 0; j < display.length; j++) {
                var key = norm(display[j].textContent);

                if (key && !names[key]) {
                    names[key] = id;
                }
            }
        }

        var programmes =
            doc.getElementsByTagName('programme');

        for (var k = 0; k < programmes.length; k++) {
            var p = programmes[k];

            var cid = p.getAttribute('channel');
            var start = parseXmltvTime(p.getAttribute('start'));
            var stop = parseXmltvTime(p.getAttribute('stop'));

            if (!cid ||
                !start ||
                !stop ||
                stop <= start ||
                stop < from ||
                start > to) {
                continue;
            }

            var title = xmlText(p, 'title');

            if (!title) continue;

            if (!progs[cid]) progs[cid] = [];

            progs[cid].push({
                start: start,
                stop: stop,
                title: title,
                desc: xmlText(p, 'desc')
            });
        }
    }

    /* =====================================================
       EPG ID MATCHING
       ===================================================== */

    function epgIds() {
        var seen = Object.create(null);
        var ids = [];

        STATE.channels.forEach(function (ch) {
            var id = String(ch.id || '').trim();

            if (id && id.length <= 250 && !seen[id]) {
                seen[id] = true;
                ids.push(id);
            }
        });

        return ids;
    }

    function idsSignature(ids) {
        return ids.slice().sort().join('\n');
    }

    function findEpgId(ch) {
        if (!STATE.epg || !ch) return null;

        var progs = STATE.epg.progs || {};
        var names = STATE.epg.names || {};

        var id = String(ch.id || '').trim();

        if (id && progs[id]) {
            return id;
        }

        var key = norm(ch.name);

        if (key && names[key]) {
            id = names[key];

            if (progs[id]) return id;
        }

        if (key) {
            var matches = [];

            Object.keys(names).forEach(function (nameKey) {
                if (nameKey === key && names[nameKey]) {
                    matches.push(names[nameKey]);
                }
            });

            for (var i = 0; i < matches.length; i++) {
                if (progs[matches[i]]) return matches[i];
            }
        }

        return id && progs[id] ? id : null;
    }

    /* =====================================================
       EPG CACHE — COMPACT STORAGE
       ===================================================== */

    function loadEpgCache(ids) {
        var cache = sget(EPG_KEY, null);

        if (!cache ||
            cache.signature !== idsSignature(ids) ||
            !cache.data ||
            !cache.t ||
            !cache.data.progs ||
            !cache.data.names) {
            return false;
        }

        if (Date.now() - cache.t > EPG_TTL) {
            return false;
        }

        var now = Date.now();
        var from = now - EPG_HISTORY;
        var to = now + EPG_FUTURE;
        var validData = {
            names: Object.create(null),
            progs: Object.create(null),
            t: cache.t,
            signature: cache.signature
        };

        var idSet = toSet(ids);
        var cachedNames = cache.data.names || {};
        var cachedProgs = cache.data.progs || {};

        Object.keys(cachedNames).forEach(function (key) {
            var id = cachedNames[key];

            if (idSet[id]) {
                validData.names[key] = id;
            }
        });

        Object.keys(cachedProgs).forEach(function (id) {
            if (!idSet[id] || !Array.isArray(cachedProgs[id])) {
                return;
            }

            var filtered = cachedProgs[id].filter(function (p) {
                return p &&
                    p.start >= from &&
                    p.start <= to &&
                    p.stop > p.start &&
                    p.title;
            }).map(function (p) {
                return {
                    start: p.start,
                    stop: p.stop,
                    title: p.title,
                    desc: p.desc || ''
                };
            });

            if (filtered.length) {
                validData.progs[id] = filtered;
            }
        });

        STATE.epg = validData;
        STATE.epg.t = cache.t;

        STATE.epgStats = cache.stats || {};

        STATE.epgStats.cacheUsed = true;
        STATE.epgStats.cacheSaved = true;
        STATE.epgStats.cacheError = '';
        STATE.epgStats.message = 'Використовується кеш EPG';

        return true;
    }

    function makeCompactEpg(ids, data, perChannelLimit) {
        var now = Date.now();
        var from = now - EPG_HISTORY;
        var to = now + EPG_FUTURE;

        var idSet = toSet(ids);
        var compact = {
            names: Object.create(null),
            progs: Object.create(null),
            t: data && data.t ? data.t : now,
            signature: data && data.signature
                ? data.signature
                : idsSignature(ids)
        };

        var names = data && data.names ? data.names : {};
        var progs = data && data.progs ? data.progs : {};

        Object.keys(names).forEach(function (key) {
            var id = names[key];

            if (idSet[id]) {
                compact.names[key] = id;
            }
        });

        ids.forEach(function (id) {
            var list = progs[id];

            if (!Array.isArray(list) || !list.length) return;

            var filtered = list.filter(function (p) {
                return p &&
                    p.start >= from &&
                    p.start <= to &&
                    p.stop > p.start &&
                    p.title;
            }).sort(function (a, b) {
                return a.start - b.start;
            });

            if (perChannelLimit > 0 &&
                filtered.length > perChannelLimit) {
                filtered = filtered.slice(-perChannelLimit);
            }

            if (!filtered.length) return;

            compact.progs[id] = filtered.map(function (p) {
                return {
                    start: p.start,
                    stop: p.stop,
                    title: String(p.title || ''),
                    desc: String(p.desc || '')
                };
            });
        });

        return compact;
    }

    function saveEpgCache(ids, data, stats) {
        var signature = idsSignature(ids);
        var lastSize = 0;
        var lastError = '';
        var saved = false;

        for (var attempt = 0;
            attempt < EPG_CACHE_PROGRAM_LIMITS.length;
            attempt++) {

            var limit = EPG_CACHE_PROGRAM_LIMITS[attempt];

            var compact = makeCompactEpg(
                ids,
                data,
                limit
            );

            var obj = {
                signature: signature,
                t: Date.now(),
                data: compact,
                stats: null
            };

            var snapshotStats = {};

            Object.keys(stats || {}).forEach(function (key) {
                snapshotStats[key] = stats[key];
            });

            snapshotStats.cacheUsed = false;
            snapshotStats.cacheSaved = true;
            snapshotStats.cacheError = '';
            snapshotStats.cacheLimit = EPG_CACHE_LIMIT;

            obj.stats = snapshotStats;

            var serialized;

            try {
                serialized = JSON.stringify(obj);
                lastSize = serialized.length;
            } catch (e) {
                lastError = 'Помилка JSON: ' + String(e);
                break;
            }

            if (lastSize > EPG_CACHE_LIMIT) {
                lastError = 'Дані перевищують ліміт кешу';
                continue;
            }

            try {
                Lampa.Storage.set(EPG_KEY, obj);

                var check = Lampa.Storage.get(EPG_KEY, null);

                if (!check ||
                    check.signature !== signature ||
                    !check.t ||
                    !check.data ||
                    !check.data.progs ||
                    check.t !== obj.t) {
                    lastError = 'Storage не підтвердив запис';
                    continue;
                }

                saved = true;
                lastError = '';
                break;
            } catch (e2) {
                lastError = 'Помилка Storage: ' + String(e2);
            }
        }

        stats.cacheSize = lastSize;
        stats.cacheLimit = EPG_CACHE_LIMIT;
        stats.cacheSaved = saved;
        stats.cacheError = saved ? '' : (
            lastError || 'Не вдалося зберегти кеш'
        );

        return saved;
    }

    /* =====================================================
       EPG WORKER REQUEST
       ===================================================== */

    function postEpg(ids, ok, fail) {
        var xhr = new XMLHttpRequest();

        xhr.open('POST', EPG_URL, true);
        xhr.timeout = 45000;

        xhr.setRequestHeader(
            'Content-Type',
            'application/json'
        );

        xhr.onload = function () {
            if (xhr.status >= 200 &&
                xhr.status < 300 &&
                xhr.responseText) {
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

    /* =====================================================
       EPG REQUEST COMPLETION
       ===================================================== */

    function epgDone() {
        STATE.epgLoading = false;

        var waiters = STATE.epgWaiters.splice(0);

        var forceAgain = STATE.epgForcePending;

        STATE.epgForcePending = false;

        waiters.forEach(function (fn) {
            try {
                fn();
            } catch (e) {}
        });

        if (forceAgain) {
            maybeLoadEpg(true);
        }
    }

    function cloneEpgData(data) {
        var copy = {
            names: Object.assign(
                Object.create(null),
                data && data.names ? data.names : {}
            ),
            progs: Object.create(null),
            t: data && data.t ? data.t : Date.now(),
            signature: data && data.signature
                ? data.signature
                : ''
        };

        var sourceProgs = data && data.progs
            ? data.progs
            : {};

        Object.keys(sourceProgs).forEach(function (id) {
            copy.progs[id] = Array.isArray(sourceProgs[id])
                ? sourceProgs[id].slice()
                : [];
        });

        return copy;
    }

    function maybeLoadEpg(force, callback) {
        if (callback) {
            STATE.epgWaiters.push(callback);
        }

        if (STATE.epgLoading) {
            if (force) STATE.epgForcePending = true;
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
                cacheSaved: false,
                cacheSize: 0,
                cacheLimit: EPG_CACHE_LIMIT,
                cacheError: '',
                message: 'У M3U немає tvg-id'
            };

            if (force) {
                noty('EPG: у плейлисті немає tvg-id');
            }

            return epgDone();
        }

        var signature = idsSignature(ids);

        if (!force &&
            STATE.epg &&
            STATE.epg.signature === signature &&
            Date.now() - STATE.epg.t < EPG_TTL) {
            return epgDone();
        }

        if (!force && loadEpgCache(ids)) {
            return epgDone();
        }

        STATE.epgLoading = true;

        noty('EPG: завантаження програми...');

        var batches = [];

        for (var i = 0; i < ids.length; i += BATCH_SIZE) {
            batches.push(ids.slice(i, i + BATCH_SIZE));
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
            cacheSaved: false,
            cacheSize: 0,
            cacheLimit: EPG_CACHE_LIMIT,
            cacheError: '',
            message: 'Завантаження EPG'
        };

        var oldEpg = STATE.epg
            ? cloneEpgData(STATE.epg)
            : null;

        var failedIds = Object.create(null);
        var pos = 0;
        var successfulBatches = 0;

        function next() {
            if (pos >= batches.length) {
                if (oldEpg && stats.failedBatches) {
                    Object.keys(failedIds).forEach(function (id) {
                        if (oldEpg.progs[id] &&
                            !result.progs[id]) {
                            result.progs[id] = oldEpg.progs[id];
                        }
                    });

                    Object.keys(oldEpg.names).forEach(function (key) {
                        if (!result.names[key]) {
                            result.names[key] = oldEpg.names[key];
                        }
                    });
                }

                Object.keys(result.progs).forEach(function (id) {
                    result.progs[id].sort(function (a, b) {
                        return a.start - b.start;
                    });
                });

                var withPrograms = 0;

                ids.forEach(function (id) {
                    if (result.progs[id] &&
                        result.progs[id].length) {
                        withPrograms++;
                    }
                });

                stats.programChannels = withPrograms;

                stats.noProgramChannels = Math.max(
                    0,
                    stats.requested - withPrograms
                );

                if (successfulBatches > 0) {
                    STATE.epg = result;
                    STATE.epg.t = Date.now();

                    stats.message = stats.failedBatches
                        ? 'Часткове оновлення EPG'
                        : 'EPG успішно оновлено';

                    stats.cacheSaved = saveEpgCache(
                        ids,
                        result,
                        stats
                    );

                    if (!stats.cacheSaved) {
                        stats.message += '; кеш не збережено: ' +
                            (stats.cacheError || 'невідома причина');
                    }

                    STATE.epgStats = stats;

                    noty(
                        'EPG: файлів ' + stats.found +
                        ', із програмами ' +
                        stats.programChannels + ' із ' +
                        stats.requested
                    );
                } else if (oldEpg) {
                    STATE.epg = oldEpg;

                    stats.cacheUsed = true;
                    stats.message =
                        'Оновлення не вдалося; залишено попередні дані';

                    STATE.epgStats = stats;

                    noty(
                        'EPG: оновлення не вдалося. ' +
                        'Залишено попередні дані'
                    );
                } else {
                    STATE.epgStats = stats;

                    stats.message =
                        'Не знайдено даних EPG; перевір tvg-id і Worker';

                    noty(
                        'EPG: не знайдено програм. Перевір tvg-id'
                    );
                }

                epgDone();
                return;
            }

            var batch = batches[pos++];

            postEpg(batch, function (xml, found, missing) {
                try {
                    parseEpgXml(xml, result);

                    stats.found += found;
                    stats.missing += missing;

                    successfulBatches++;
                } catch (e) {
                    stats.failedBatches++;
                    stats.missing += batch.length;

                    batch.forEach(function (id) {
                        failedIds[id] = true;
                    });
                }

                next();
            }, function () {
                stats.failedBatches++;
                stats.missing += batch.length;

                batch.forEach(function (id) {
                    failedIds[id] = true;
                });

                next();
            });
        }

        next();
    }

    /* =====================================================
       CURRENT PROGRAM
       ===================================================== */

    function getCurrentProgram(ch) {
        if (!STATE.epg || !ch) return null;

        var id = findEpgId(ch);

        if (!id) return null;

        var list = STATE.epg.progs[id];

        if (!list || !list.length) return null;

        var now = Date.now();

        for (var i = 0; i < list.length; i++) {
            if (list[i].start <= now &&
                now < list[i].stop) {
                return list[i];
            }
        }

        return null;
    }

    function nowTitle(ch) {
        var current = getCurrentProgram(ch);

        if (!current) return '';

        return fmtTime(current.start) + '–' +
            fmtTime(current.stop) + '  ' +
            current.title;
    }

    /* =====================================================
       FAVORITES MANAGEMENT
       ===================================================== */

    function isFav(url) {
        return !!toSet(sget('iptv_fav', []))[url];
    }

    function toggleFav(ch) {
        var favs = sget('iptv_fav', []);
        if (!Array.isArray(favs)) favs = [];

        var index = favs.indexOf(ch.url);
        if (index >= 0) {
            favs.splice(index, 1);
            noty('Видалено з обраного');
        } else {
            favs.push(ch.url);
            noty('Додано в обране');
        }

        sset('iptv_fav', favs);
    }

    /* =====================================================
       FULL EPG / TELEPROGRAM LIST VIEW
       ===================================================== */

    function showFullEpg(ch) {
        if (!STATE.epg || !STATE.epg.progs) {
            return noty('Телепрограма не завантажена');
        }

        var id = findEpgId(ch);
        var list = id ? STATE.epg.progs[id] : null;

        if (!list || !list.length) {
            return noty('Для цього каналу немає телепрограми');
        }

        var now = Date.now();

        selectShow({
            title: ch.name + ' — Телепрограма',
            items: list.map(function (p) {
                var isCurrent = p.start <= now && now < p.stop;
                var isPast = p.stop <= now;

                return {
                    title: (isCurrent ? '▶ [ЗАРАЗ] ' : '') + fmtTime(p.start) + ' – ' + fmtTime(p.stop) + '  ' + p.title,
                    subtitle: p.desc ? p.desc : (isPast ? 'Минула передача' : 'Майбутня передача'),
                    program: p
                };
            }),
            onSelect: function (item) {
                if (item.program.desc) {
                    selectShow({
                        title: fmtTime(item.program.start) + ' – ' + fmtTime(item.program.stop) + '  ' + item.program.title,
                        items: [
                            { title: item.program.desc }
                        ],
                        onBack: function () {
                            showFullEpg(ch);
                        },
                        onSelect: function () {}
                    });
                }
            },
            onBack: function () {
                Lampa.Controller.toggle('content');
            }
        });
    }

    /* =====================================================
       CONTEXT MENU FOR CHANNEL
       ===================================================== */

    function showChannelMenu(ch, refreshCallback) {
        var favorite = isFav(ch.url);

        selectShow({
            title: ch.name,
            items: [
                {
                    title: favorite ? '⭐ Видалити з обраного' : '⭐ Додати в обране',
                    action: 'fav'
                },
                {
                    title: '📅 Телепрограма каналу',
                    action: 'epg'
                },
                {
                    title: '📺 Архів передач',
                    action: 'archive'
                }
            ],
            onSelect: function (item) {
                if (item.action === 'fav') {
                    toggleFav(ch);
                    if (typeof refreshCallback === 'function') {
                        refreshCallback();
                    }
                } else if (item.action === 'epg') {
                    showFullEpg(ch);
                } else if (item.action === 'archive') {
                    showArchivePrograms(ch);
                }
            },
            onBack: function () {
                Lampa.Controller.toggle('content');
            }
        });
    }

    /* =====================================================
       ARCHIVE UI
       ===================================================== */

    function showArchivePrograms(ch) {
        if (!STATE.epg || !STATE.epg.progs) {
            return noty('Телепрограма не завантажена');
        }

        var id = findEpgId(ch);

        var list = id ? STATE.epg.progs[id] : null;

        if (!list || !list.length) {
            return noty('Для цього каналу немає програми передач');
        }

        var recent = list.filter(function (p) {
            return p.start <= Date.now();
        }).slice().reverse();

        if (!recent.length) {
            return noty('Немає минулих передач для архіву');
        }

        var original = ch.original || ch;

        selectShow({
            title: ch.name + ' — Архів',

            items: recent.map(function (p) {
                var available = canArchive(original, p);

                return {
                    title: fmtTime(p.start) + ' – ' +
                        fmtTime(p.stop) + '  ' + p.title,

                    subtitle: available
                        ? 'Архів доступний за налаштуваннями'
                        : 'Архів може бути недоступний',

                    program: p,
                    available: available
                };
            }),

            onSelect: function (item) {
                if (!item.available) {
                    return noty(
                        'Передача поза межами доступного архіву ' +
                        'або архів не налаштований'
                    );
                }

                var archiveUrl = buildArchiveUrl(
                    original,
                    item.program
                );

                if (!archiveUrl) {
                    return noty(
                        'Не вдалося сформувати URL архіву'
                    );
                }

                Lampa.Player.play({
                    url: archiveUrl,
                    title: ch.name + ' — ' + item.program.title,
                    address: archiveUrl
                });
            },

            onBack: function () {
                Lampa.Controller.toggle('content');
            }
        });
    }

    /* =====================================================
       CHANNEL HELPERS
       ===================================================== */

    function displayName(ch) {
        var names = sget('iptv_names', {});

        return names && names[ch.url] || ch.name;
    }

    function buildView() {
        var hiddenG = toSet(
            sget('iptv_hidden_groups', [])
        );

        var sort = sget('iptv_sort_az', false) === true ||
            sget('iptv_sort_az', false) === 'true' ||
            sget('iptv_sort_az', false) === 1 ||
            sget('iptv_sort_az', false) === '1';

        var groups = Object.create(null);
        var order = [];
        var all = [];

        STATE.channels.forEach(function (c) {
            if (isHidden(c.url) || hiddenG[c.group]) return;

            var ch = {
                name: displayName(c),
                url: c.url,
                group: c.group,
                logo: c.logo,
                id: c.id,
                catchup: c.catchup,
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
            order: order
        };
    }

    function isHidden(url) {
        return !!toSet(sget('iptv_hidden', []))[url];
    }

    /* =====================================================
       CHANNEL PLAYBACK
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

        if (epg) title += ' · ' + epg;

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
        var logoSize = sget('iptv_ui_logo_size', 'normal');
        var showProgress = sget('iptv_ui_progress', true);

        var logoWidth = logoSize === 'small' ? '3.4em' : (logoSize === 'large' ? '5.4em' : '4.4em');
        var logoHeight = logoSize === 'small' ? '2.4em' : (logoSize === 'large' ? '4em' : '3.2em');

        var css = [
            '.iptv-v33{display:flex;height:100%;width:100%;overflow:hidden;background:var(--color-background,#0f0f0f)}',
            '.iptv-v33__side{width:290px;max-width:32%;display:flex;flex-direction:column;background:rgba(0,0,0,.28);border-right:1px solid rgba(255,255,255,.07);flex-shrink:0}',
            '.iptv-v33__side-head{padding:1.1em 1em .55em;font-size:1.2em;font-weight:600;opacity:.85}',
            '.iptv-v33__side-list{flex:1;overflow:auto;padding:.2em .55em 1.2em;will-change:transform}',
            '.iptv-v33__grp{padding:.7em .9em;border-radius:.4em;margin:.15em 0;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:.45em;font-size:1.15em !important;font-weight:500}',
            '.iptv-v33__grp.focus,.iptv-v33__grp:hover{background:rgba(255,255,255,.09)}',
            '.iptv-v33__grp.active{background:rgba(33,150,243,.25);color:#90caf9}',
            '.iptv-v33__grp-count{opacity:.5;font-size:.9em;flex-shrink:0}',
            '.iptv-v33__main{flex:1;display:flex;flex-direction:column;min-width:0}',
            '.iptv-v33__head{padding:1.05em 1.3em .65em;display:flex;align-items:center;justify-content:space-between;gap:1em}',
            '.iptv-v33__title{font-size:1.5em;font-weight:700}',
            '.iptv-v33__meta{opacity:.55;font-size:1em}',
            '.iptv-v33__list{flex:1;overflow:auto;padding:.25em .9em 1.4em;will-change:transform}',
            '.iptv-v33__ch{display:flex;align-items:center;gap:.9em;padding:.6em .9em;border-radius:.42em;margin:.15em 0;cursor:pointer;transform:translateZ(0)}',
            '.iptv-v33__ch.focus,.iptv-v33__ch:hover{background:rgba(255,255,255,.08)}',
            '.iptv-v33__ch-num{width:2.2em;text-align:right;opacity:.45;font-size:1em;flex-shrink:0}',
            '.iptv-v33__ch-logo{width:' + logoWidth + ';height:' + logoHeight + ';background:rgba(255,255,255,.06);border-radius:.35em;display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden}',
            '.iptv-v33__ch-logo img{max-width:90%;max-height:85%;object-fit:contain}',
            '.iptv-v33__ch-logo span{font-size:1.2em;opacity:.35}',
            '.iptv-v33__ch-body{flex:1;min-width:0}',
            '.iptv-v33__ch-name{font-size:1.3em !important;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
            '.iptv-v33__ch-epg{font-size:1.05em !important;opacity:.75;margin-top:.18em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
            '.iptv-v33__progress{height:4px;margin-top:7px;background:rgba(255,255,255,.15);border-radius:2px;overflow:hidden;' + (showProgress ? '' : 'display:none;') + '}',
            '.iptv-v33__progress-bar{height:100%;background:#4cc986;border-radius:2px}',
            '.iptv-v33__ch.focus .iptv-v33__progress-bar{background:#10141d}',
            '.iptv-v33__empty{padding:2em;text-align:center;opacity:.5;font-size:1.2em}'
        ].join('');

        var s = document.getElementById('iptv-v33-style');
        if (!s) {
            s = document.createElement('style');
            s.id = 'iptv-v33-style';
            document.head.appendChild(s);
        }
        s.textContent = css;
    }

    /* =====================================================
       MAIN PANEL UI
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

            if (STATE.activeGroup === '__fav__') {
                return view.all.filter(function (c) {
                    return isFav(c.url);
                });
            }

            if (STATE.activeGroup === '__all__' ||
                !STATE.activeGroup) {
                return view.all;
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
                list.length + ' каналів · затисніть ОК для меню'
            );

            if (!list.length) {
                chList.append(
                    '<div class="iptv-v33__empty">Немає каналів</div>'
                );

                return;
            }

            list.forEach(function (ch, i) {
                var currentProg = getCurrentProgram(ch);
                var progress = programProgress(currentProg);

                var epgText = currentProg
                    ? fmtTime(currentProg.start) + '–' +
                        fmtTime(currentProg.stop) + '  ' +
                        currentProg.title
                    : (ch.group || '');

                var row = $(
                    '<div class="iptv-v33__ch selector" data-index="' +
                    i + '">' +

                    '<div class="iptv-v33__ch-num">' +
                    (i + 1) +
                    '</div>' +

                    '<div class="iptv-v33__ch-logo"></div>' +

                    '<div class="iptv-v33__ch-body">' +

                    '<div class="iptv-v33__ch-name">' +
                    esc(ch.name + (isFav(ch.url) ? ' ★' : '')) +
                    '</div>' +

                    '<div class="iptv-v33__ch-epg">' +
                    esc(epgText) +
                    '</div>' +

                    (currentProg
                        ? '<div class="iptv-v33__progress">' +
                            '<div class="iptv-v33__progress-bar" style="width:' +
                            progress + '%"></div>' +
                          '</div>'
                        : '') +

                    '</div></div>'
                );

                var logoContainer = row.find(
                    '.iptv-v33__ch-logo'
                );

                if (ch.logo) {
                    var img = $('<img alt="">').attr(
                        'src',
                        ch.logo
                    );

                    img.on('error', function () {
                        logoContainer.empty().append('<span>📺</span>');
                    });

                    logoContainer.append(img);
                } else {
                    logoContainer.append('<span>📺</span>');
                }

                row.on('hover:enter click', function () {
                    groupPositions[STATE.activeGroup] = focusIndex;
                    playChannel(ch, list);
                });

                row.on('hover:long', function () {
                    showChannelMenu(ch, function () {
                        renderChannels();
                    });
                });

                chList.append(row);
                channelItems.push(row);
            });

            if (groupPositions[STATE.activeGroup] != null) {
                focusIndex = Math.min(
                    groupPositions[STATE.activeGroup],
                    Math.max(0, channelItems.length - 1)
                );
            } else {
                focusIndex = 0;
            }
        }

        function renderGroups() {
            grpList.empty();
            groupItems = [];

            var items = [
                {
                    id: '__fav__',
                    title: '★ Обране',
                    count: view.all.filter(function (c) {
                        return isFav(c.url);
                    }).length
                },
                {
                    id: '__all__',
                    title: 'Усі канали',
                    count: view.all.length
                }
            ];

            view.order.forEach(function (g) {
                items.push({
                    id: g,
                    title: g,
                    count: view.groups[g].length
                });
            });

            items.forEach(function (g, i) {
                var row = $(
                    '<div class="iptv-v33__grp selector' +
                    (STATE.activeGroup === g.id ? ' active' : '') +
                    '" data-index="' + i + '">' +

                    '<span>' + esc(g.title) + '</span>' +

                    '<span class="iptv-v33__grp-count">' +
                    g.count +
                    '</span>' +

                    '</div>'
                );

                row.on('hover:enter click', function () {
                    groupPositions[STATE.activeGroup] = focusIndex;

                    STATE.activeGroup = g.id;
                    sset('iptv_last_group', g.id);

                    renderGroups();
                    renderChannels();

                    STATE.panelFocus = 'channels';
                    
                    applyFocus();
                });

                grpList.append(row);
                groupItems.push(row);
            });

            groupFocus = Math.min(
                groupFocus,
                Math.max(0, groupItems.length - 1)
            );
        }

        function applyFocus() {
            channelItems.forEach(function (el) {
                el.removeClass('focus');
            });

            groupItems.forEach(function (el) {
                el.removeClass('focus');
            });

            var isGroups = STATE.panelFocus === 'groups';
            var el = isGroups
                ? groupItems[groupFocus]
                : channelItems[focusIndex];

            if (el && el[0]) {
                el.addClass('focus');

                var container = isGroups ? grpList[0] : chList[0];
                var node = el[0];

                if (container && node) {
                    var containerTop = container.scrollTop;
                    var containerHeight = container.clientHeight;
                    var nodeTop = node.offsetTop;
                    var nodeHeight = node.offsetHeight;

                    if (nodeTop < containerTop) {
                        container.scrollTop = nodeTop;
                    } else if (nodeTop + nodeHeight > containerTop + containerHeight) {
                        container.scrollTop = nodeTop + nodeHeight - containerHeight;
                    }
                }
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

            STATE.activeGroup = mode === 'fav'
                ? '__fav__'
                : mode === 'all'
                    ? '__all__'
                    : (view.groups[last]
                        ? last
                        : (view.order[0] || '__all__'));

            STATE.panelFocus = 'channels';

            renderGroups();
            renderChannels();
            applyFocus();

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
                        groupPositions[STATE.activeGroup] = focusIndex;
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
                            groupPositions[STATE.activeGroup] = focusIndex;
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
                            groupPositions[STATE.activeGroup] = focusIndex;
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

                    if (el) el.trigger('hover:enter');
                },

                long: function () {
                    if (STATE.panelFocus === 'channels') {
                        var list = currentChannels();
                        var ch = list[focusIndex];
                        if (ch) {
                            showChannelMenu(ch, function () {
                                renderChannels();
                            });
                        }
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
       PLAYLIST SETTINGS
       ===================================================== */

    function showLists(backFn) {
        var lists = getLists();
        var active = activeList();

        var items = lists.map(function (l) {
            return {
                title: (active && active.id === l.id ? '● ' : '') +
                    l.name,

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

                        items: getLists().map(function (l) {
                            return {
                                title: l.name,
                                id: l.id
                            };
                        }),

                        onBack: function () {
                            showLists(backFn);
                        },

                        onSelect: function (it) {
                            var rest = getLists().filter(
                                function (l) {
                                    return l.id !== it.id;
                                }
                            );

                            sset('iptv_lists', rest);

                            if (sget('iptv_active', '') === it.id) {
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
        if (!Lampa.SettingsApi ||
            !Lampa.SettingsApi.addComponent) {
            return;
        }

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

        Lampa.SettingsApi.addParam({
            component: 'iptv_player_33',
            param: {
                name: 'iptv_ui_logo_size',
                type: 'select',
                values: {
                    small: 'Компактні',
                    normal: 'Стандартні',
                    large: 'Великі'
                },
                default: 'normal'
            },
            field: {
                name: 'Розмір логотипів',
                description: 'Змінити розмір іконок каналів у списку'
            },
            onChange: function() {
                injectStyle();
            }
        });

        Lampa.SettingsApi.addParam({
            component: 'iptv_player_33',
            param: {
                name: 'iptv_ui_progress',
                type: 'trigger',
                default: true
            },
            field: {
                name: 'Шкала прогресу передачі',
                description: 'Показувати смужку виконання поточної програми'
            },
            onChange: function() {
                injectStyle();
            }
        });

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
            'Примусове оновлення телепрограми',
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
                            title: 'Каналів із tvg-id: ' +
                                ids.length
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
                            title: 'Кеш збережено: ' +
                                (st.cacheSaved ? 'Так' : 'Ні')
                        },
                        {
                            title: 'Розмір кешу: ' +
                                (st.cacheSize || 0) + ' символів'
                        },
                        {
                            title: 'Розмір кешу: ' +
                                formatBytes(st.cacheSize || 0)
                        },
                        {
                            title: 'Ліміт кешу: ' +
                                (st.cacheLimit || EPG_CACHE_LIMIT) +
                                ' символів'
                        },
                        {
                            title: 'Причина помилки: ' +
                                (st.cacheError || 'немає')
                        },
                        {
                            title: st.message || 'EPG Proxy 2.0.2'
                        }
                    ],

                    onSelect: function () {}
                });
            }
        );

        Lampa.SettingsApi.addParam({
            component: 'iptv_player_33',

            param: {
                name: 'iptv_sort_az',
                type: 'trigger',
                default: false
            },

            field: {
                name: 'Сортувати за алфавітом',
                description: 'Вимкнено — порядок M3U'
            }
        });

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
       MENU BUTTON
       ===================================================== */

    function addMenuButton() {
        var menu = $('.menu .menu__list').eq(0);

        if (!menu.length) return false;

        menu.find(
            '[data-action="iptv_player_33"]'
        ).remove();

        var item = $(
            '<li class="menu__item selector" data-action="iptv_player_33">' +

            '<div class="menu__ico">' +
            ICON +
            '</div>' +

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
            console.log('[IPTV 3.3.2] Settings error:', e);
        }

        try {
            addMenuButton();
        } catch (e) {
            console.log('[IPTV 3.3.2] Menu error:', e);
        }

        console.log(
            '[IPTV 3.3.2] Custom EPG Edition ready — Optimized Fast Switching'
        );
    }

    if (window.appready) {
        start();
    } else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') start();
        });
    }

})();
