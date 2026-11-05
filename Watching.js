(function () {
    'use strict';

    /*
     * CONTINUE WATCHING — STANDARD LAMPA BACKDROP
     *
     * Version: 1.1.0
     *
     * - Uses Lampa built-in TMDB API
     * - Synchronizes backdrop_path with standard TMDB data
     * - Preserves playback progress and all other history fields
     * - Session cache prevents repeated TMDB requests
     * - No direct image downloading
     */

    var READY_KEY = 'continue_watching_standard_backdrop_110';

    if (window[READY_KEY]) return;
    window[READY_KEY] = true;

    var CACHE = {};
    var PENDING = {};

    function getId(item) {
        if (!item) return null;

        var id =
            item.id ||
            item.tmdb_id ||
            item.tmdbId ||
            (item.movie && item.movie.id) ||
            (item.card_data && item.card_data.id);

        if (!id) return null;

        id = parseInt(id, 10);

        return isFinite(id) && id > 0 ? id : null;
    }

    function getType(item) {
        if (!item) return 'movie';

        var type =
            item.media_type ||
            item.type ||
            (item.movie && item.movie.media_type) ||
            (item.card_data && item.card_data.media_type);

        if (type === 'tv' || type === 'serial' || type === 'show') {
            return 'tv';
        }

        if (type === 'movie') return 'movie';

        if (
            item.first_air_date ||
            item.name && !item.title
        ) {
            return 'tv';
        }

        return 'movie';
    }

    function updateBackdrop(item) {
        var id = getId(item);

        if (!id) return;

        var type = getType(item);
        var key = type + '_' + id;

        if (CACHE[key]) {
            if (item.backdrop_path !== CACHE[key]) {
                item.backdrop_path = CACHE[key];
            }

            return;
        }

        if (PENDING[key]) {
            PENDING[key].push(item);
            return;
        }

        var tmdb = Lampa.Api &&
                   Lampa.Api.sources &&
                   Lampa.Api.sources.tmdb;

        if (!tmdb || typeof tmdb.get !== 'function') return;

        PENDING[key] = [item];

        tmdb.get(
            type + '/' + id,
            {},
            function (data) {
                var items = PENDING[key] || [];

                delete PENDING[key];

                if (
                    data &&
                    typeof data.backdrop_path === 'string' &&
                    data.backdrop_path.length
                ) {
                    var backdrop = data.backdrop_path;

                    CACHE[key] = backdrop;

                    items.forEach(function (movie) {
                        movie.backdrop_path = backdrop;
                    });
                }
            },
            function () {
                delete PENDING[key];
            }
        );
    }

    function start() {
        if (
            !Lampa.ContentRows ||
            typeof Lampa.ContentRows.call !== 'function'
        ) {
            return;
        }

        if (Lampa.ContentRows.__standardBackdrop110) return;

        var originalCall = Lampa.ContentRows.call;

        Lampa.ContentRows.call = function (screen, params, calls) {
            if (
                screen === 'main' &&
                Array.isArray(calls) &&
                Lampa.Favorite &&
                typeof Lampa.Favorite.continues === 'function'
            ) {
                var continues = Lampa.Favorite.continues('movie');

                if (continues && continues.length) {

                    continues.forEach(function (item) {
                        updateBackdrop(item);
                    });

                    calls.unshift(function (call) {
                        call({
                            results: continues,
                            title: Lampa.Lang.translate('title_continue')
                        });
                    });
                }
            }

            return originalCall.apply(this, arguments);
        };

        Lampa.ContentRows.__standardBackdrop110 = true;
    }

    if (window.appready) {
        start();
    } else {
        Lampa.Listener.follow('app', function (event) {
            if (event.type === 'ready') {
                start();
            }
        });
    }

})();
