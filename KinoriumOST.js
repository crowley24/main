(function () {
    'use strict';

    /*
     * KINORIUM OST 1.5.3
     *
     * Lampa / Android TV / Mobile
     * Cloudflare Worker 1.6.2+
     *
     * Sources:
     * - Kinorium
     * - Custom catalog: OSTMusic and YouTube
     * - Direct audio files
     *
     * FEATURES:
     * - Custom catalog support
     * - Automatic movie and series soundtrack search
     * - YouTube and HTML5 Audio playback
     * - Volume control and smooth fade-in
     * - Adjustable startup delay
     * - Automatic repeat
     * - Playback retry
     * - Startup timeout
     * - Track title diagnostics
     * - Navigation and stale-request protection
     * - Minimal premium notifications
     */

    var VERSION = '1.5.3';

    var WORKER =
        'https://kinorium-ost.unclezhenya24.workers.dev/';

    var PREFIX = 'kinorium_ost_';

    var DEFAULTS = {
        enabled: true,
        repeat: true,
        volume: 65,
        delay: 2000,
        fade: true,
        fadeDuration: 3000,
        debug: false
    };

    var MAX_PLAY_RETRIES = 1;
    var RETRY_DELAY = 1000;
    var PLAY_START_TIMEOUT = 20000;
    var NOTICE_DURATION = 3500;

    var state = {
        initialized: false,

        audio: null,
        request: null,

        youtubePlayer: null,
        youtubeContainer: null,
        youtubeReady: false,
        youtubeLoading: false,
        youtubeApiTimer: null,
        youtubeVolumeTimer: null,
        youtubeVideoId: '',
        youtubeGeneration: 0,

        startTimer: null,
        fadeTimer: null,
        navigationTimer: null,
        retryTimer: null,
        playTimeoutTimer: null,

        movie: null,
        movieKey: '',
        track: null,

        token: 0,

        cardActive: false,
        openedAt: 0,
        navigationGraceUntil: 0,
        lastActivity: '',

        readyResult: null,

        playbackStarted: false,
        playbackState: 'idle',
        playAttempt: 0,

        fadeStartedAt: 0,
        fadeStartVolume: 0,
        fadeTargetVolume: 0,
        fadeDurationMs: 0,

        notice: null,
        noticeTimer: null,
        noticeToken: 0
    };

    /*
     * STORAGE
     */

    function storageGet(key) {
        var name = PREFIX + key;
        var fallback = DEFAULTS[key];

        try {
            if (
                window.Lampa &&
                Lampa.Storage &&
                typeof Lampa.Storage.get === 'function'
            ) {
                var value = Lampa.Storage.get(name, fallback);

                return value === undefined || value === null
                    ? fallback
                    : value;
            }
        } catch (e) {}

        try {
            var raw = localStorage.getItem(name);

            return raw === null ? fallback : JSON.parse(raw);
        } catch (e) {
            return fallback;
        }
    }

    function storageSet(key, value) {
        var name = PREFIX + key;

        try {
            if (
                window.Lampa &&
                Lampa.Storage &&
                typeof Lampa.Storage.set === 'function'
            ) {
                Lampa.Storage.set(name, value);
                return;
            }
        } catch (e) {}

        try {
            localStorage.setItem(name, JSON.stringify(value));
        } catch (e) {}
    }

    function setting(key) {
        var value = storageGet(key);

        if (
            key === 'enabled' ||
            key === 'repeat' ||
            key === 'fade' ||
            key === 'debug'
        ) {
            return (
                value === true ||
                value === 1 ||
                value === '1' ||
                value === 'true'
            );
        }

        return value;
    }

    function log() {
        if (!setting('debug')) return;

        var args = Array.prototype.slice.call(arguments);

        args.unshift('[Kinorium OST ' + VERSION + ']');

        console.log.apply(console, args);
    }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function numberSetting(key, minimum, maximum) {
        var value = Number(setting(key));

        if (!isFinite(value)) value = DEFAULTS[key];

        return clamp(value, minimum, maximum);
    }

    function targetVolume() {
        return numberSetting('volume', 0, 100);
    }

    function targetAudioVolume() {
        return targetVolume() / 100;
    }

    function delayMs() {
        return numberSetting('delay', 0, 10000);
    }

    function fadeMs() {
        return numberSetting('fadeDuration', 0, 10000);
    }

    function normalize(value) {
        return String(value || '')
            .toLowerCase()
            .trim()
            .replace(/\s+/g, ' ');
    }

    function extractYear(value) {
        var match = String(value || '').match(
            /\b(?:18|19|20)\d{2}\b/
        );

        return match ? Number(match[0]) : 0;
    }

    /*
     * SOURCE DETECTION
     */

    function getYouTubeVideoId(value) {
        var url = String(value || '').trim();
        var match;

        match = url.match(
            /(?:youtube\.com\/watch\?(?:[^#]*&)?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/
        );

        if (match) return match[1];

        try {
            var parsed = new URL(url);

            var host = parsed.hostname.toLowerCase();

            if (
                host === 'youtube.com' ||
                host === 'www.youtube.com' ||
                host === 'm.youtube.com' ||
                host === 'music.youtube.com'
            ) {
                var id = parsed.searchParams.get('v');

                if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) {
                    return id;
                }
            }
        } catch (e) {}

        return '';
    }

    function isYouTubeResult(result) {
        if (!result) return false;

        var source = String(result.source || '').toLowerCase();

        var trackSource = String(
            result.track && result.track.source || ''
        ).toLowerCase();

        if (source === 'youtube' || trackSource === 'youtube') {
            return true;
        }

        return !!getYouTubeVideoId(result.audioUrl || '');
    }

    /*
     * NOTIFICATIONS
     */

    function removeNotice() {
        state.noticeToken++;

        if (state.noticeTimer !== null) {
            clearTimeout(state.noticeTimer);
            state.noticeTimer = null;
        }

        if (state.notice) {
            try {
                state.notice.remove();
            } catch (e) {
                if (state.notice.parentNode) {
                    state.notice.parentNode.removeChild(state.notice);
                }
            }

            state.notice = null;
        }
    }

    /*
     * PREMIUM NOTICE DESIGN 1.5.3
     *
     * - No technical branding
     * - No movie title or year in playback notifications
     * - Track / artist information
     * - Dark translucent background
     * - Soft accent colors
     * - Compact icon and two-line layout
     * - Smooth entrance and exit
     */

    function showNotice(title, message, type, duration) {
        if (!setting('debug')) {
            removeNotice();
            return;
        }

        if (!state.cardActive || !document.body) return;

        removeNotice();

        var noticeToken = state.noticeToken;

        var colors = {
            info: '#8db9e8',
            success: '#77d5b3',
            warning: '#e5bd73',
            error: '#e58b83'
        };

        var icons = {
            info: '\u266a',
            success: '\u266b',
            warning: '\u26a0',
            error: '\u2715'
        };

        var accent = colors[type] || colors.info;
        var panel = document.createElement('div');

        panel.setAttribute('data-kinorium-ost-notice', 'true');

        var styles = {
            position: 'fixed',
            top: 'max(22px, env(safe-area-inset-top))',
            right: 'max(22px, env(safe-area-inset-right))',
            zIndex: '2147483000',
            width: 'min(370px, calc(100vw - 32px))',
            boxSizing: 'border-box',
            padding: '15px 16px 13px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, rgba(29,35,45,0.96), rgba(17,21,29,0.97))',
            border: '1px solid rgba(255,255,255,0.10)',
            color: '#f5f7fa',
            fontFamily: 'Arial, sans-serif',
            boxShadow: '0 14px 42px rgba(0,0,0,0.42)',
            opacity: '0',
            transform: 'translateY(-10px) scale(0.985)',
            transition: 'opacity 240ms ease, transform 240ms cubic-bezier(0.2,0.75,0.25,1)',
            pointerEvents: 'none',
            overflow: 'hidden',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)'
        };

        Object.keys(styles).forEach(function (key) {
            panel.style[key] = styles[key];
        });

        var content = document.createElement('div');

        content.style.display = 'flex';
        content.style.alignItems = 'center';
        content.style.gap = '12px';

        var iconBox = document.createElement('div');

        iconBox.style.width = '46px';
        iconBox.style.height = '46px';
        iconBox.style.minWidth = '46px';
        iconBox.style.boxSizing = 'border-box';
        iconBox.style.display = 'flex';
        iconBox.style.alignItems = 'center';
        iconBox.style.justifyContent = 'center';
        iconBox.style.borderRadius = '12px';
        iconBox.style.background = 'rgba(119,213,179,0.10)';
        iconBox.style.border = '1px solid ' + accent + '33';
        iconBox.style.color = accent;
        iconBox.style.fontSize = '25px';
        iconBox.style.lineHeight = '1';

        var icon = document.createElement('span');

        icon.textContent = icons[type] || icons.info;

        iconBox.appendChild(icon);

        var textBox = document.createElement('div');

        textBox.style.minWidth = '0';
        textBox.style.flex = '1';

        if (title) {
            var heading = document.createElement('div');

            heading.textContent = String(title);
            heading.style.color = '#f5f7fa';
            heading.style.fontSize = '14px';
            heading.style.fontWeight = '600';
            heading.style.lineHeight = '1.4';
            heading.style.overflowWrap = 'anywhere';

            textBox.appendChild(heading);
        }

        if (message) {
            var description = document.createElement('div');

            description.textContent = String(message);
            description.style.color = '#a6afbd';
            description.style.fontSize = '12px';
            description.style.lineHeight = '1.5';
            description.style.marginTop = title ? '3px' : '0';
            description.style.overflowWrap = 'anywhere';

            textBox.appendChild(description);
        }

        content.appendChild(iconBox);
        content.appendChild(textBox);

        panel.appendChild(content);

        var bottomLine = document.createElement('div');

        bottomLine.style.height = '2px';
        bottomLine.style.marginTop = '12px';
        bottomLine.style.borderRadius = '2px';
        bottomLine.style.background =
            'linear-gradient(90deg, ' + accent + ', transparent)';

        panel.appendChild(bottomLine);

        document.body.appendChild(panel);
        state.notice = panel;

        var reveal = function () {
            if (
                state.notice !== panel ||
                state.noticeToken !== noticeToken
            ) return;

            panel.style.opacity = '1';
            panel.style.transform = 'translateY(0) scale(1)';
        };

        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(reveal);
        } else {
            reveal();
        }

        state.noticeTimer = setTimeout(function () {
            if (
                state.notice !== panel ||
                state.noticeToken !== noticeToken
            ) return;

            panel.style.opacity = '0';
            panel.style.transform = 'translateY(-8px) scale(0.985)';

            state.noticeTimer = setTimeout(function () {
                if (
                    state.notice === panel &&
                    state.noticeToken === noticeToken
                ) {
                    removeNotice();
                }
            }, 260);
        }, Math.max(500, duration || NOTICE_DURATION));
    }

    function getTrackTitle(result) {
        var track = result && result.track
            ? result.track
            : state.track;

        if (typeof track === 'string') return track.trim();

        if (track && typeof track === 'object') {
            return String(
                track.name ||
                track.title ||
                track.track ||
                track.trackName ||
                track.track_name ||
                ''
            ).trim();
        }

        return String(
            result && (
                result.trackName ||
                result.trackTitle ||
                result.track_title ||
                result.title
            ) || ''
        ).trim();
    }

    function getTrackArtist(result) {
        var track = result && result.track;

        if (!track || typeof track !== 'object') return '';

        return String(
            track.artist ||
            track.artistName ||
            track.artist_name ||
            track.performer ||
            ''
        ).trim();
    }

    /*
     * SUCCESS NOTIFICATION
     *
     * Shows the track and artist when available.
     * Movie title and release year are deliberately omitted.
     * Successful-playback notification remains enabled in debug mode.
     */

    function diagnosticPlaying(result) {
        if (!setting('debug') || !state.cardActive) return;

        var trackTitle = getTrackTitle(result);
        var artist = getTrackArtist(result);

        var heading = '';

        if (trackTitle && artist) {
            heading = artist + ' — ' + trackTitle;
        } else if (trackTitle) {
            heading = trackTitle;
        } else if (artist) {
            heading = artist;
        } else {
            heading = 'Саундтрек';
        }

        showNotice(
            heading,
            '',
            'success',
            4000
        );
    }

    function diagnosticNotFound(result) {
        var message = 'Не вдалося знайти відповідний саундтрек.';

        if (
            result &&
            result.found &&
            (!result.playable || !result.audioUrl)
        ) {
            message = 'Запис знайдено, але доступного аудіо немає.';
        } else if (result && result.reason) {
            var reason = String(result.reason).toLowerCase();

            if (reason.indexOf('network') !== -1) {
                message = 'Не вдалося отримати відповідь через мережу.';
            }
        }

        showNotice('Саундтрек недоступний', message, 'warning');
    }

    function diagnosticFailure(reason, code) {
        var title = 'Помилка відтворення';
        var message = 'Не вдалося запустити аудіо.';

        switch (reason) {
            case 'media_error':
                title = 'Помилка аудіо';
                message = 'Медіаджерело повернуло помилку.';
                if (code) message += ' Код: ' + code + '.';
                break;

            case 'youtube_error':
                title = 'Помилка YouTube';
                message = youtubeErrorText(code);
                break;

            case 'startup_timeout':
                title = 'Аудіо не запустилося';
                message = 'Минув час очікування початку відтворення.';
                break;

            case 'worker_http':
                title = 'Помилка сервера';
                message = 'Worker повернув HTTP-помилку ' + code + '.';
                break;

            case 'worker_timeout':
                title = 'Сервер не відповідає';
                message = 'Перевищено час очікування Worker.';
                break;

            case 'network':
                title = 'Помилка мережі';
                message = 'Не вдалося з’єднатися з Worker.';
                break;

            case 'invalid_json':
                title = 'Помилка відповіді';
                message = 'Worker повернув JSON невідомого формату.';
                break;

            case 'blocked':
                title = 'Запуск заблоковано';
                message = 'Середовище Lampa заборонило автоматичний запуск.';
                break;

            case 'youtube_api_timeout':
                title = 'YouTube недоступний';
                message = 'Не вдалося завантажити YouTube Player API.';
                break;
        }

        showNotice(title, message, 'error', 4500);
    }

    function youtubeErrorText(code) {
        switch (Number(code)) {
            case 2:
                return 'Некоректний ідентифікатор відео.';
            case 5:
                return 'Відео не підтримується HTML5-плеєром YouTube.';
            case 100:
                return 'Відео видалене або недоступне.';
            case 101:
            case 150:
                return 'Власник відео заборонив вбудоване відтворення.';
            case 153:
                return 'YouTube не отримав належний HTTP Referer або ідентифікацію клієнта.';
            default:
                return 'YouTube повернув помилку ' + (code || 'невідомо') + '.';
        }
    }

    /*
     * MOVIE DATA
     */

    function movieFromData(data) {
        if (!data || typeof data !== 'object') return null;

        var movie = data;

        for (var i = 0; i < 4; i++) {
            if (movie.data && typeof movie.data === 'object') {
                movie = movie.data;
                continue;
            }

            if (movie.movie && typeof movie.movie === 'object') {
                movie = movie.movie;
                continue;
            }

            if (movie.card && typeof movie.card === 'object') {
                movie = movie.card;
                continue;
            }

            break;
        }

        var type = String(movie.media_type || movie.type || '').toLowerCase();

        var series = (
            type === 'tv' ||
            type === 'series' ||
            type === 'serial' ||
            (!movie.release_date && !!movie.first_air_date)
        );

        var title = String(
            series
                ? (
                    movie.original_name ||
                    movie.name ||
                    movie.original_title ||
                    movie.title ||
                    ''
                )
                : (
                    movie.original_title ||
                    movie.title ||
                    movie.original_name ||
                    movie.name ||
                    ''
                )
        ).trim();

        var year = extractYear(
            series
                ? (
                    movie.first_air_date ||
                    movie.release_date ||
                    movie.year
                )
                : (
                    movie.release_date ||
                    movie.first_air_date ||
                    movie.year
                )
        );

        if (!title) return null;

        return {
            title: title,
            year: year,
            series: series,
            tmdbId: String(movie.id || movie.tmdb_id || '')
        };
    }

    function getMovieKey(movie) {
        return [
            normalize(movie.title),
            movie.year,
            movie.series ? 'tv' : 'movie',
            movie.tmdbId
        ].join('|');
    }

    /*
     * ACTIVITY MONITORING
     */

    function getActiveActivity() {
        try {
            if (
                !window.Lampa ||
                !Lampa.Activity ||
                typeof Lampa.Activity.active !== 'function'
            ) return '';

            var active = Lampa.Activity.active();

            if (!active) return '';

            if (typeof active === 'string') return active.toLowerCase();

            var fields = [
                active.component,
                active.type,
                active.name,
                active.activity
            ];

            for (var i = 0; i < fields.length; i++) {
                if (typeof fields[i] === 'string' && fields[i]) {
                    return fields[i].toLowerCase();
                }
            }
        } catch (e) {
            log('Activity error:', e);
        }

        return '';
    }

    function isNonFullActivity(value) {
        if (!value) return false;

        var known = [
            'main',
            'home',
            'category',
            'catalog',
            'search',
            'favorite',
            'favorites',
            'bookmarks',
            'settings',
            'feed',
            'history',
            'timetable',
            'my_list'
        ];

        for (var i = 0; i < known.length; i++) {
            if (
                value === known[i] ||
                value.indexOf(known[i] + '/') === 0
            ) return true;
        }

        return false;
    }

    /*
     * TIMERS
     */

    function clearTimer(name) {
        if (state[name] !== null) {
            clearTimeout(state[name]);
            state[name] = null;
        }
    }

    function clearStartTimer() {
        clearTimer('startTimer');
    }

    function clearFadeTimer() {
        if (state.fadeTimer !== null) {
            clearInterval(state.fadeTimer);
            state.fadeTimer = null;
        }
    }

    function clearRetryTimer() {
        clearTimer('retryTimer');
    }

    function clearPlayTimeout() {
        clearTimer('playTimeoutTimer');
    }

    function clearPlaybackTimers() {
        clearStartTimer();
        clearFadeTimer();
        clearRetryTimer();
        clearPlayTimeout();
    }

    /*
     * REQUEST MANAGEMENT
     */

    function abortRequest() {
        var xhr = state.request;
        state.request = null;

        if (!xhr) return;

        try {
            xhr.onreadystatechange = null;
            xhr.onerror = null;
            xhr.ontimeout = null;
            xhr.onabort = null;
            xhr.abort();
        } catch (e) {}
    }

    /*
     * YOUTUBE API LOADER
     */

    function loadYouTubeAPI(callback) {
        if (window.YT && window.YT.Player) {
            callback();
            return;
        }

        if (typeof state.youtubeApiTimer === 'function') {
            // No-op: the API loader uses a timer ID below.
        }

        if (!document.querySelector(
            'script[src*="youtube.com/iframe_api"]'
        )) {
            var script = document.createElement('script');

            script.src = 'https://www.youtube.com/iframe_api';
            script.async = true;

            var first = document.getElementsByTagName('script')[0];

            if (first && first.parentNode) {
                first.parentNode.insertBefore(script, first);
            } else {
                document.head.appendChild(script);
            }
        }

        var started = Date.now();

        if (state.youtubeApiTimer !== null) {
            clearInterval(state.youtubeApiTimer);
        }

        state.youtubeApiTimer = setInterval(function () {
            if (window.YT && window.YT.Player) {
                clearInterval(state.youtubeApiTimer);
                state.youtubeApiTimer = null;
                callback();
                return;
            }

            if (Date.now() - started > 15000) {
                clearInterval(state.youtubeApiTimer);
                state.youtubeApiTimer = null;

                if (state.cardActive) {
                    setPlaybackState('error', 'youtube_api_timeout');
                    diagnosticFailure('youtube_api_timeout', 0);
                }
            }
        }, 200);
    }

    /*
     * YOUTUBE PLAYER
     */

    function removeYouTubePlayer() {
        state.youtubeGeneration++;

        if (state.youtubeVolumeTimer !== null) {
            clearInterval(state.youtubeVolumeTimer);
            state.youtubeVolumeTimer = null;
        }

        var player = state.youtubePlayer;

        state.youtubePlayer = null;
        state.youtubeReady = false;
        state.youtubeLoading = false;
        state.youtubeVideoId = '';

        if (player) {
            try {
                player.stopVideo();
            } catch (e) {}

            try {
                player.destroy();
            } catch (e) {}
        }

        if (state.youtubeContainer) {
            try {
                state.youtubeContainer.remove();
            } catch (e) {
                if (state.youtubeContainer.parentNode) {
                    state.youtubeContainer.parentNode.removeChild(
                        state.youtubeContainer
                    );
                }
            }

            state.youtubeContainer = null;
        }
    }

    function setYouTubeVolume(value) {
        if (!state.youtubePlayer || !state.youtubeReady) return;

        try {
            state.youtubePlayer.setVolume(
                Math.round(clamp(value, 0, 100))
            );
        } catch (e) {}
    }

    function startYouTubeFade(token, generation) {
        if (state.youtubeVolumeTimer !== null) {
            clearInterval(state.youtubeVolumeTimer);
            state.youtubeVolumeTimer = null;
        }

        var duration = fadeMs();
        var target = targetVolume();

        if (!setting('fade') || duration <= 0) {
            setYouTubeVolume(target);
            return;
        }

        var startedAt = Date.now();

        setYouTubeVolume(0);

        state.youtubeVolumeTimer = setInterval(function () {
            if (
                token !== state.token ||
                generation !== state.youtubeGeneration ||
                !state.cardActive ||
                !state.youtubePlayer
            ) {
                clearInterval(state.youtubeVolumeTimer);
                state.youtubeVolumeTimer = null;
                return;
            }

            var progress = clamp(
                (Date.now() - startedAt) / duration,
                0,
                1
            );

            var eased = progress * progress * (3 - 2 * progress);

            setYouTubeVolume(target * eased);

            if (progress >= 1) {
                setYouTubeVolume(target);

                clearInterval(state.youtubeVolumeTimer);
                state.youtubeVolumeTimer = null;
            }
        }, 50);
    }

    function playYouTube(result, token) {
        var videoId = getYouTubeVideoId(result.audioUrl);

        if (!videoId) {
            setPlaybackState('error', 'invalid_youtube_url');
            diagnosticFailure('youtube_error', 2);
            return;
        }

        clearPlaybackTimers();
        destroyAudioOnly();

        removeYouTubePlayer();

        state.playbackStarted = false;
        state.youtubeLoading = true;
        state.youtubeVideoId = videoId;

        setPlaybackState('starting');

        var generation = state.youtubeGeneration;

        var container = document.createElement('div');

        container.setAttribute('data-kinorium-ost-youtube', 'true');

        container.style.position = 'fixed';
        container.style.left = '0';
        container.style.bottom = '0';
        container.style.width = '320px';
        container.style.height = '180px';
        container.style.opacity = '0.01';
        container.style.pointerEvents = 'none';
        container.style.overflow = 'hidden';
        container.style.zIndex = '-1';

        var playerElement = document.createElement('div');

        playerElement.id = 'kinorium-ost-youtube-' + token + '-' + generation;

        container.appendChild(playerElement);
        document.body.appendChild(container);

        state.youtubeContainer = container;

        state.playTimeoutTimer = setTimeout(function () {
            state.playTimeoutTimer = null;

            if (
                token !== state.token ||
                generation !== state.youtubeGeneration ||
                !state.cardActive ||
                state.playbackStarted
            ) return;

            setPlaybackState('error', 'startup_timeout');
            diagnosticFailure('startup_timeout', 0);

            removeYouTubePlayer();
        }, PLAY_START_TIMEOUT);

        loadYouTubeAPI(function () {
            if (
                token !== state.token ||
                generation !== state.youtubeGeneration ||
                !state.cardActive
            ) return;

            try {
                state.youtubePlayer = new window.YT.Player(
                    playerElement.id,
                    {
                        width: '320',
                        height: '180',
                        videoId: videoId,
                        playerVars: {
                            autoplay: 1,
                            controls: 0,
                            disablekb: 1,
                            fs: 0,
                            playsinline: 1,
                            rel: 0,
                            enablejsapi: 1
                        },
                        events: {
                            onReady: function (event) {
                                if (
                                    token !== state.token ||
                                    generation !== state.youtubeGeneration ||
                                    !state.cardActive
                                ) return;

                                state.youtubeReady = true;
                                state.youtubeLoading = false;

                                try {
                                    event.target.setVolume(
                                        setting('fade') ? 0 : targetVolume()
                                    );

                                    event.target.playVideo();
                                } catch (e) {
                                    log('YouTube play exception:', e);
                                }
                            },

                            onStateChange: function (event) {
                                if (
                                    token !== state.token ||
                                    generation !== state.youtubeGeneration ||
                                    !state.cardActive
                                ) return;

                                // YT.PlayerState.PLAYING === 1
                                if (event.data === 1) {
                                    clearPlayTimeout();

                                    if (!state.playbackStarted) {
                                        state.playbackStarted = true;
                                        setPlaybackState('playing');

                                        if (setting('fade')) {
                                            startYouTubeFade(
                                                token,
                                                generation
                                            );
                                        } else {
                                            setYouTubeVolume(targetVolume());
                                        }

                                        diagnosticPlaying(state.readyResult);
                                    }
                                }

                                // YT.PlayerState.ENDED === 0
                                if (
                                    event.data === 0 &&
                                    setting('repeat') &&
                                    state.youtubePlayer
                                ) {
                                    try {
                                        state.youtubePlayer.seekTo(0, true);
                                        state.youtubePlayer.playVideo();
                                    } catch (e) {
                                        log('YouTube repeat error:', e);
                                    }
                                }

                                // YT.PlayerState.PAUSED === 2
                                if (
                                    event.data === 2 &&
                                    state.playbackStarted
                                ) {
                                    log('YouTube paused');
                                }
                            },

                            onError: function (event) {
                                if (
                                    token !== state.token ||
                                    generation !== state.youtubeGeneration ||
                                    !state.cardActive
                                ) return;

                                clearPlayTimeout();

                                log('YouTube error:', event.data);

                                handleYouTubeFailure(
                                    token,
                                    generation,
                                    event.data
                                );
                            }
                        }
                    }
                );
            } catch (e) {
                log('YouTube Player construction error:', e);

                clearPlayTimeout();

                setPlaybackState('error', 'youtube_error');
                diagnosticFailure('youtube_error', 0);

                removeYouTubePlayer();
            }
        });
    }

    function handleYouTubeFailure(token, generation, code) {
        if (
            token !== state.token ||
            generation !== state.youtubeGeneration ||
            !state.cardActive
        ) return;

        state.playbackStarted = false;

        clearPlayTimeout();

        if (
            state.playAttempt < MAX_PLAY_RETRIES &&
            state.readyResult
        ) {
            state.playAttempt++;

            setPlaybackState('retry_wait');

            removeYouTubePlayer();

            state.retryTimer = setTimeout(function () {
                state.retryTimer = null;

                if (
                    token !== state.token ||
                    !state.cardActive ||
                    !state.readyResult
                ) return;

                playYouTube(state.readyResult, token);
            }, RETRY_DELAY);

            return;
        }

        setPlaybackState('error', 'youtube_error');

        diagnosticFailure('youtube_error', code);

        removeYouTubePlayer();
    }

    /*
     * HTML5 AUDIO
     */

    function destroyAudioOnly() {
        clearFadeTimer();
        clearPlayTimeout();

        var player = state.audio;
        state.audio = null;

        if (!player) return;

        try {
            player.pause();
            player.loop = false;
            player.removeAttribute('src');
            player.load();
        } catch (e) {}
    }

    function destroyAudio() {
        destroyAudioOnly();
    }

    function startAudioFade(player, token, startVolume) {
        clearFadeTimer();

        if (
            token !== state.token ||
            !state.cardActive ||
            state.audio !== player
        ) return;

        var target = targetAudioVolume();
        var duration = fadeMs();

        if (!setting('fade') || duration <= 0) {
            player.volume = target;
            return;
        }

        var initial = typeof startVolume === 'number'
            ? startVolume
            : player.volume;

        initial = clamp(initial, 0, 1);

        var startedAt = Date.now();

        state.fadeTimer = setInterval(function () {
            if (
                token !== state.token ||
                !state.cardActive ||
                state.audio !== player
            ) {
                clearFadeTimer();
                return;
            }

            if (player.paused) return;

            var progress = clamp(
                (Date.now() - startedAt) / duration,
                0,
                1
            );

            var eased = progress * progress * (3 - 2 * progress);

            player.volume = clamp(
                initial + (target - initial) * eased,
                0,
                1
            );

            if (progress >= 1) {
                player.volume = target;
                clearFadeTimer();
            }
        }, 50);
    }

    function createAudio(token) {
        var player = new Audio();

        player.preload = 'auto';
        player.loop = setting('repeat');
        player.volume = setting('fade') ? 0 : targetAudioVolume();

        state.audio = player;

        player.addEventListener('playing', function () {
            if (
                token !== state.token ||
                state.audio !== player ||
                !state.cardActive
            ) return;

            clearPlayTimeout();

            if (!state.playbackStarted) {
                state.playbackStarted = true;
                setPlaybackState('playing');

                if (setting('fade')) {
                    startAudioFade(player, token, player.volume);
                } else {
                    player.volume = targetAudioVolume();
                }

                diagnosticPlaying(state.readyResult);
            }
        });

        player.addEventListener('error', function () {
            if (
                token !== state.token ||
                state.audio !== player ||
                !state.cardActive
            ) return;

            clearPlayTimeout();

            var code = player.error ? player.error.code : 0;

            log('Audio error:', code);

            handleAudioFailure(token, player, 'media_error', code);
        });

        player.addEventListener('ended', function () {
            if (
                token !== state.token ||
                state.audio !== player ||
                !state.cardActive
            ) return;

            if (setting('repeat')) {
                try {
                    player.currentTime = 0;
                    player.play();
                } catch (e) {
                    log('Audio repeat error:', e);
                }
            }
        });

        return player;
    }

    function handleAudioFailure(token, player, reason, code) {
        if (
            token !== state.token ||
            state.audio !== player ||
            !state.cardActive
        ) return;

        state.playbackStarted = false;

        clearFadeTimer();
        clearPlayTimeout();

        if (
            reason === 'media_error' &&
            state.playAttempt < MAX_PLAY_RETRIES &&
            state.readyResult
        ) {
            state.playAttempt++;

            setPlaybackState('retry_wait');

            destroyAudioOnly();

            state.retryTimer = setTimeout(function () {
                state.retryTimer = null;

                if (
                    token !== state.token ||
                    !state.cardActive ||
                    !state.readyResult
                ) return;

                startAudioAttempt(state.readyResult, token);
            }, RETRY_DELAY);

            return;
        }

        setPlaybackState('error', reason);

        destroyAudioOnly();

        diagnosticFailure(reason, code);
    }

    function startAudioAttempt(result, token) {
        if (
            token !== state.token ||
            !state.cardActive ||
            !result ||
            !result.audioUrl
        ) return;

        clearRetryTimer();
        clearPlayTimeout();
        clearFadeTimer();

        destroyAudioOnly();

        state.playbackStarted = false;

        setPlaybackState('starting');

        var player = createAudio(token);

        player.src = result.audioUrl;

        state.playTimeoutTimer = setTimeout(function () {
            state.playTimeoutTimer = null;

            if (
                token !== state.token ||
                !state.cardActive ||
                state.audio !== player ||
                state.playbackStarted
            ) return;

            handleAudioFailure(
                token,
                player,
                'startup_timeout',
                0
            );
        }, PLAY_START_TIMEOUT);

        try {
            player.load();

            var promise = player.play();

            if (promise && typeof promise.catch === 'function') {
                promise.catch(function (error) {
                    if (
                        token !== state.token ||
                        state.audio !== player ||
                        !state.cardActive
                    ) return;

                    clearPlayTimeout();

                    log(
                        'Audio play rejected:',
                        error && error.name,
                        error && error.message
                    );

                    if (
                        error &&
                        (
                            error.name === 'NotAllowedError' ||
                            error.name === 'SecurityError'
                        )
                    ) {
                        setPlaybackState('blocked');
                        destroyAudioOnly();
                        diagnosticFailure('blocked', 0);
                        return;
                    }

                    handleAudioFailure(
                        token,
                        player,
                        'media_error',
                        player.error ? player.error.code : 0
                    );
                });
            }
        } catch (e) {
            log('Audio play exception:', e);

            handleAudioFailure(
                token,
                player,
                'media_error',
                player.error ? player.error.code : 0
            );
        }
    }

    /*
     * SHARED PLAYBACK
     */

    function setPlaybackState(nextState, details) {
        if (state.playbackState === nextState) return;

        log(
            'Playback state:',
            state.playbackState,
            '->',
            nextState,
            details || ''
        );

        state.playbackState = nextState;
    }

    function playResult(result, token) {
        if (
            token !== state.token ||
            !state.cardActive ||
            !result
        ) return;

        if (
            !result.audioUrl ||
            result.playable === false
        ) {
            setPlaybackState('error', 'missing_audio_url');
            diagnosticNotFound(result);
            return;
        }

        state.track = result.track || null;
        state.playAttempt = 0;

        if (isYouTubeResult(result)) {
            log(
                'Starting YouTube:',
                getTrackTitle(result),
                result.audioUrl
            );

            playYouTube(result, token);
        } else {
            log(
                'Starting direct audio:',
                getTrackTitle(result),
                result.audioUrl
            );

            startAudioAttempt(result, token);
        }
    }

    function playAudio(result, token) {
        playResult(result, token);
    }

    function tryStart(token) {
        if (
            token !== state.token ||
            !state.cardActive ||
            state.playbackStarted ||
            !state.readyResult
        ) return;

        if (
            state.playbackState === 'starting' ||
            state.playbackState === 'retry_wait' ||
            state.playbackState === 'blocked' ||
            state.playbackState === 'error'
        ) return;

        var elapsed = Date.now() - state.openedAt;
        var remaining = delayMs() - elapsed;

        if (remaining > 0) {
            clearStartTimer();

            state.startTimer = setTimeout(function () {
                state.startTimer = null;
                tryStart(token);
            }, remaining);

            return;
        }

        playAudio(state.readyResult, token);
    }

    /*
     * GLOBAL STOP
     */

    function stopPlayback(reason) {
        var wasActive = Boolean(
            state.cardActive ||
            state.audio ||
            state.youtubePlayer ||
            state.request ||
            state.startTimer ||
            state.retryTimer ||
            state.playTimeoutTimer
        );

        state.token++;

        clearPlaybackTimers();
        abortRequest();

        if (state.youtubeApiTimer !== null) {
            clearInterval(state.youtubeApiTimer);
            state.youtubeApiTimer = null;
        }

        destroyAudioOnly();
        removeYouTubePlayer();
        removeNotice();

        state.movie = null;
        state.movieKey = '';
        state.track = null;

        state.cardActive = false;
        state.openedAt = 0;
        state.navigationGraceUntil = 0;

        state.readyResult = null;

        state.playbackStarted = false;
        state.playbackState = 'idle';
        state.playAttempt = 0;

        if (wasActive) log('Stopped:', reason || 'unknown');
    }

    /*
     * WORKER REQUEST
     */

    function buildWorkerURL(movie) {
        var url = WORKER +
            '?title=' + encodeURIComponent(movie.title);

        if (movie.year) {
            url += '&year=' + encodeURIComponent(movie.year);
        }

        if (movie.series) {
            url += '&type=tv';
        }

        if (setting('debug')) {
            url += '&debug=1';
        }

        return url;
    }

    function fetchSoundtrack(movie, token) {
        if (
            token !== state.token ||
            !state.cardActive
        ) return;

        abortRequest();

        var xhr = new XMLHttpRequest();

        state.request = xhr;

        var url = buildWorkerURL(movie);

        setPlaybackState('searching');

        log(
            'Worker request:',
            movie.title,
            movie.year || '(year missing)',
            movie.series ? 'TV' : 'Movie',
            url
        );

        xhr.open('GET', url, true);
        xhr.timeout = 20000;

        function isCurrentRequest() {
            return (
                token === state.token &&
                state.cardActive &&
                state.request === xhr
            );
        }

        xhr.onreadystatechange = function () {
            if (xhr.readyState !== 4) return;
            if (!isCurrentRequest()) return;

            state.request = null;

            if (xhr.status < 200 || xhr.status >= 300) {
                setPlaybackState('error', 'worker_http');
                diagnosticFailure('worker_http', xhr.status);
                return;
            }

            var result;

            try {
                result = JSON.parse(xhr.responseText);
            } catch (e) {
                setPlaybackState('error', 'invalid_json');
                diagnosticFailure('invalid_json', 0);
                return;
            }

            if (
                !result ||
                !result.success ||
                !result.found ||
                !result.playable ||
                !result.audioUrl
            ) {
                setPlaybackState('not_found');

                log(
                    'No playable soundtrack:',
                    movie.title,
                    result ? result.reason : 'empty_response',
                    result
                );

                diagnosticNotFound(result);
                return;
            }

            if (!isCurrentCardToken(token)) return;

            state.readyResult = result;

            setPlaybackState('ready');

            log(
                'Soundtrack ready:',
                getTrackTitle(result),
                'Source:',
                result.source || 'unknown'
            );

            tryStart(token);
        };

        xhr.onerror = function () {
            if (!isCurrentRequest()) return;

            state.request = null;
            setPlaybackState('error', 'network');
            diagnosticFailure('network', 0);
        };

        xhr.ontimeout = function () {
            if (!isCurrentRequest()) return;

            state.request = null;
            setPlaybackState('error', 'worker_timeout');
            diagnosticFailure('worker_timeout', 0);
        };

        try {
            xhr.send();
        } catch (e) {
            if (!isCurrentRequest()) return;

            state.request = null;
            setPlaybackState('error', 'network');
            diagnosticFailure('network', 0);
        }
    }

    function isCurrentCardToken(token) {
        return (
            token === state.token &&
            state.cardActive &&
            !!state.movie
        );
    }

    /*
     * CARD SCHEDULER
     */

    function schedulePlayback(movie) {
        if (!movie || !movie.title) return;

        if (!setting('enabled')) return;

        var key = getMovieKey(movie);

        if (state.cardActive && state.movieKey === key) return;

        stopPlayback('new_movie');

        state.movie = movie;
        state.movieKey = key;
        state.cardActive = true;

        state.openedAt = Date.now();
        state.navigationGraceUntil = state.openedAt + 1200;
        state.lastActivity = getActiveActivity();

        state.readyResult = null;
        state.playbackStarted = false;
        state.playbackState = 'idle';
        state.playAttempt = 0;

        log(
            'Card opened:',
            movie.title,
            movie.year || '(year missing)',
            movie.series ? 'TV' : 'Movie',
            'Activity:',
            state.lastActivity || '(unknown)'
        );

        fetchSoundtrack(movie, state.token);
    }

    /*
     * NAVIGATION
     */

    function monitorNavigation() {
        if (!state.cardActive) return;

        var activity = getActiveActivity();

        if (!activity) return;

        if (activity !== state.lastActivity) {
            log('Activity:', state.lastActivity, '->', activity);
            state.lastActivity = activity;
        }

        if (Date.now() < state.navigationGraceUntil) return;

        if (isNonFullActivity(activity)) {
            stopPlayback('activity_changed_to_' + activity);
        }
    }

    function handleActivityEvent(event) {
        if (!state.cardActive) return;

        if (Date.now() < state.navigationGraceUntil) return;

        var activity = getActiveActivity();

        if (isNonFullActivity(activity)) {
            stopPlayback('activity_event_' + activity);
        }
    }

    function handleFullEvent(event) {
        if (!event) return;

        var type = String(
            event.type ||
            event.action ||
            ''
        ).toLowerCase();

        if (
            type === 'complite' ||
            type === 'complete' ||
            type === 'ready' ||
            type === 'open' ||
            type === 'start'
        ) {
            var movie = movieFromData(
                event.data ||
                event.movie ||
                event.card ||
                event
            );

            if (movie) schedulePlayback(movie);

            return;
        }

        if (
            type === 'destroy' ||
            type === 'close' ||
            type === 'stop' ||
            type === 'back'
        ) {
            stopPlayback('full_event_' + type);
        }
    }

    /*
     * LIVE SETTINGS
     */

    function applyVolume() {
        if (state.audio && state.playbackStarted) {
            if (setting('fade') && state.fadeTimer) {
                startAudioFade(
                    state.audio,
                    state.token,
                    state.audio.volume
                );
            } else {
                state.audio.volume = targetAudioVolume();
            }
        }

        if (state.youtubePlayer && state.youtubeReady) {
            if (setting('fade') && state.playbackStarted) {
                startYouTubeFade(
                    state.token,
                    state.youtubeGeneration
                );
            } else {
                setYouTubeVolume(targetVolume());
            }
        }
    }

    function applyRepeat() {
        if (state.audio) {
            state.audio.loop = setting('repeat');
        }
    }

    function applyFadeSetting() {
        if (state.audio) {
            if (!state.playbackStarted) {
                state.audio.volume = setting('fade')
                    ? 0
                    : targetAudioVolume();
            } else {
                applyVolume();
            }
        }

        if (state.youtubePlayer && state.youtubeReady) {
            if (!state.playbackStarted) {
                setYouTubeVolume(setting('fade') ? 0 : targetVolume());
            } else {
                applyVolume();
            }
        }
    }

    function applyFadeDuration() {
        applyVolume();
    }

    function applyDelay() {
        if (
            state.cardActive &&
            state.readyResult &&
            !state.playbackStarted &&
            state.playbackState === 'ready'
        ) {
            clearStartTimer();
            tryStart(state.token);
        }
    }

    /*
     * SETTINGS
     */

    function registerSettings() {
        if (
            !Lampa.SettingsApi ||
            typeof Lampa.SettingsApi.addParam !== 'function'
        ) return;

        try {
            Lampa.SettingsApi.addComponent({
                component: 'kinorium_ost',
                name: 'Kinorium OST',
                icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>'
            });
        } catch (e) {}

        function addParam(param) {
            try {
                Lampa.SettingsApi.addParam({
                    component: 'kinorium_ost',
                    param: param.param,
                    field: param.field,
                    onChange: param.onChange
                });
            } catch (e) {
                log('Settings error:', e);
            }
        }

        function changedValue(value) {
            if (
                value &&
                typeof value === 'object' &&
                Object.prototype.hasOwnProperty.call(value, 'value')
            ) {
                return value.value;
            }

            return value;
        }

        function addTrigger(key, title, description, callback) {
            addParam({
                param: {
                    name: PREFIX + key,
                    type: 'trigger',
                    default: DEFAULTS[key]
                },
                field: {
                    name: title,
                    description: description
                },
                onChange: function (value) {
                    var next = changedValue(value);

                    var enabled = (
                        next === true ||
                        next === 1 ||
                        next === '1' ||
                        next === 'true'
                    );

                    storageSet(key, enabled);

                    if (callback) callback(enabled);
                }
            });
        }

        function addSelect(key, title, description, values, callback) {
            addParam({
                param: {
                    name: PREFIX + key,
                    type: 'select',
                    values: values,
                    default: String(DEFAULTS[key])
                },
                field: {
                    name: title,
                    description: description
                },
                onChange: function (value) {
                    var next = Number(changedValue(value));

                    if (!isFinite(next)) return;

                    storageSet(key, next);

                    if (callback) callback(next);
                }
            });
        }

        addTrigger(
            'enabled',
            'Увімкнути Kinorium OST',
            'Автоматично відтворювати саундтреки фільмів і серіалів',
            function (enabled) {
                if (!enabled) stopPlayback('disabled');
            }
        );

        addTrigger(
            'repeat',
            'Повторювати композицію',
            'Повторювати композицію після завершення',
            applyRepeat
        );

        addSelect(
            'volume',
            'Гучність',
            'Максимальна гучність фонового аудіо',
            {
                '10': '10%',
                '20': '20%',
                '30': '30%',
                '40': '40%',
                '50': '50%',
                '60': '60%',
                '65': '65%',
                '70': '70%',
                '80': '80%',
                '90': '90%',
                '100': '100%'
            },
            applyVolume
        );

        addSelect(
            'delay',
            'Мінімальна затримка',
            'Час від відкриття картки до запуску музики',
            {
                '0': 'Без затримки',
                '500': '0,5 секунди',
                '1000': '1 секунда',
                '1500': '1,5 секунди',
                '2000': '2 секунди',
                '3000': '3 секунди',
                '4000': '4 секунди',
                '5000': '5 секунд'
            },
            applyDelay
        );

        addTrigger(
            'fade',
            'Плавне наростання звуку',
            'Поступово збільшувати гучність після запуску',
            applyFadeSetting
        );

        addSelect(
            'fadeDuration',
            'Тривалість наростання',
            'Час досягнення встановленої гучності',
            {
                '500': '0,5 секунди',
                '1000': '1 секунда',
                '1500': '1,5 секунди',
                '2000': '2 секунди',
                '3000': '3 секунди',
                '4000': '4 секунди',
                '5000': '5 секунд'
            },
            applyFadeDuration
        );

        addTrigger(
            'debug',
            'Режим діагностики',
            'Показувати назву композиції та причини помилок',
            function (enabled) {
                if (!enabled) {
                    removeNotice();
                    return;
                }

                if (!state.cardActive) return;

                if (state.playbackStarted) {
                    diagnosticPlaying(state.readyResult);
                }
            }
        );
    }

    /*
     * INITIALIZATION
     */

    function init() {
        if (state.initialized) return;

        if (
            !window.Lampa ||
            !Lampa.Listener ||
            typeof Lampa.Listener.follow !== 'function'
        ) {
            setTimeout(init, 500);
            return;
        }

        state.initialized = true;

        registerSettings();

        Lampa.Listener.follow('full', handleFullEvent);
        Lampa.Listener.follow('activity', handleActivityEvent);

        state.navigationTimer = setInterval(
            monitorNavigation,
            250
        );

        window.addEventListener('pagehide', function () {
            stopPlayback('pagehide');
        });

        window.addEventListener('beforeunload', function () {
            stopPlayback('beforeunload');
        });

        console.log('[Kinorium OST] ' + VERSION + ' initialized');
    }

    init();

})();
