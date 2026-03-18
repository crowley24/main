(function () {
    'use strict';

    var PLUGIN_ID = 'lampa_random_premium';
    var STORAGE_KEY = 'lampa_random_selected_genres';

    var ALL_GENRES = {
        28: 'Бойовик', 12: 'Пригоди', 16: 'Мультфільм', 35: 'Комедія', 80: 'Кримінал',
        99: 'Документальний', 18: 'Драма', 10751: 'Сімейний', 14: 'Фентезі', 36: 'Історія',
        27: 'Жахи', 10402: 'Музика', 9648: 'Містика', 10749: 'Мелодрама', 878: 'Фантастика',
        53: 'Трилер', 10752: 'Військовий', 37: 'Вестерн'
    };

    function tr(uk, ru) {
        return Lampa.Storage.get('language', 'uk') === 'uk' ? uk : ru;
    }

    function getSelectedGenres() {
        var saved = Lampa.Storage.get(STORAGE_KEY);
        if (!saved || !Array.isArray(saved)) return Object.keys(ALL_GENRES);
        return saved;
    }

    // Параметри для API (випадковий жанр)
    function getRandomParams() {
        var genres = getSelectedGenres();
        if (!genres.length) genres = Object.keys(ALL_GENRES);
        var random_genre = genres[Math.floor(Math.random() * genres.length)];
        var page = Math.floor(Math.random() * 20) + 1;
        var type = Math.random() > 0.3 ? 'movie' : 'tv';
        
        return {
            type: type,
            params: {
                with_genres: random_genre,
                'vote_average.gte': 6.5,
                'vote_count.gte': 300,
                page: page,
                language: Lampa.Storage.get('language', 'uk') === 'uk' ? 'uk-UA' : 'ru-RU'
            }
        };
    }

    // --- Функція для виведення на Головну ---
    function injectToMain() {
        var originalCall = Lampa.ContentRows.call;

        Lampa.ContentRows.call = function (screen, params, calls) {
            if (screen === 'main') {
                // Додаємо наш рядок на початок (unshift)
                calls.unshift(function (call) {
                    var config = getRandomParams();
                    var method = config.type === 'movie' ? 'discover/movie' : 'discover/tv';

                    Lampa.Api.sources.tmdb.get(method, config.params, function (json) {
                        if (json && json.results && json.results.length) {
                            // Додаємо тип до кожної картки, щоб Lampa знала, що це фільм чи серіал
                            json.results.forEach(function(i) { i.type = config.type; });
                            
                            call({
                                results: json.results,
                                title: tr('Випадкова добірка: ' + (ALL_GENRES[config.params.with_genres] || ''), 'Случайная подборка')
                            });
                        } else {
                            call({ results: [] });
                        }
                    }, function () {
                        call({ results: [] });
                    });
                });
            }
            originalCall.apply(this, arguments);
        };
    }

    // --- Функція для лівого меню (для налаштувань) ---
    function addMenuButton() {
        if ($('.menu__item[data-action="' + PLUGIN_ID + '"]').length) return;

        var button = $(
            '<li class="menu__item selector" data-action="' + PLUGIN_ID + '">' +
                '<div class="menu__ico">' +
                    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
                        '<rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2"/>' +
                        '<circle cx="8" cy="8" r="1.5" fill="currentColor"/><circle cx="16" cy="16" r="1.5" fill="currentColor"/>' +
                        '<circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="8" cy="16" r="1.5" fill="currentColor"/>' +
                        '<circle cx="16" cy="8" r="1.5" fill="currentColor"/>' +
                    '</svg>' +
                '</div>' +
                '<div class="menu__text">' + tr('Випадкова добірка', 'Мне повезёт') + '</div>' +
            '</li>'
        );

        button.on('hover:enter', function () {
            var config = getRandomParams();
            Lampa.Activity.push({
                url: 'discover/' + config.type + '?with_genres=' + config.params.with_genres + '&page=' + config.params.page,
                title: tr('Випадкова добірка', 'Мне повезёт'),
                component: 'category_full',
                source: 'tmdb',
                card_type: true
            });
        });

        button.on('hover:long', function() {
            var selected = getSelectedGenres();
            var items = Object.keys(ALL_GENRES).map(function(id) {
                return { title: ALL_GENRES[id], value: id, selected: selected.indexOf(id) !== -1 };
            });

            Lampa.Select.show({
                title: tr('Оберіть жанри', 'Выберите жанры'),
                items: items,
                onSelect: function (item) {
                    var current = getSelectedGenres();
                    var index = current.indexOf(item.value);
                    if (index > -1) current.splice(index, 1);
                    else current.push(item.value);
                    Lampa.Storage.set(STORAGE_KEY, current);
                    Lampa.Noty.show(tr('Оновлено! Перезапустіть для змін на головній', 'Обновлено! Перезагрузите для изменений'));
                },
                onBack: function() { Lampa.Controller.toggle('content'); }
            });
        });

        var historyBtn = $('.menu .menu__list .menu__item[data-action="history"]');
        if (historyBtn.length) historyBtn.after(button);
        else $('.menu .menu__list').eq(0).append(button);
    }

    // --- Старт плагіна ---
    function start() {
        addMenuButton();
        injectToMain();
    }

    if (window.appready) start();
    else Lampa.Listener.follow('app', function (e) { if (e.type === 'ready') start(); });

})();
