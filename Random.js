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

    function showGenreSettings() {
        var selected = getSelectedGenres();
        var items = Object.keys(ALL_GENRES).map(function(id) {
            return {
                title: ALL_GENRES[id],
                value: id,
                selected: selected.indexOf(id) !== -1
            };
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
                showGenreSettings(); 
            },
            onBack: function() {
                Lampa.Controller.toggle('content');
            }
        });
    }

    function getRandomUrl() {
        var genres = getSelectedGenres();
        if (!genres.length) genres = Object.keys(ALL_GENRES);
        var random_genre = genres[Math.floor(Math.random() * genres.length)];
        var page = Math.floor(Math.random() * 25) + 1;
        var type = Math.random() > 0.3 ? 'movie' : 'tv';
        var lang = Lampa.Storage.get('language', 'uk') === 'uk' ? 'uk-UA' : 'ru-RU';
        
        return 'discover/' + type + '?with_genres=' + random_genre + 
               '&vote_average.gte=6.5&vote_count.gte=300' +
               '&page=' + page + 
               '&language=' + lang;
    }

    function addMenuButton() {
        // Перевірка на дублікат за унікальним ID
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
            Lampa.Activity.push({
                url: getRandomUrl(),
                title: tr('Випадкова добірка', 'Мне повезёт'),
                component: 'category_full',
                source: 'tmdb',
                card_type: true
            });
        });

        button.on('hover:long', function() {
            showGenreSettings();
        });

        // ─── ЛОГІКА РОЗМІЩЕННЯ ВИЩЕ ────────────────────────────────
        // Шукаємо кнопку "Історія" (history)
        var historyBtn = $('.menu .menu__list .menu__item[data-action="history"]');
        
        if (historyBtn.length) {
            // Вставляємо ОДРАЗУ ПІСЛЯ Історії
            historyBtn.after(button);
        } else {
            // Якщо Історії немає, шукаємо "Головна" (main)
            var mainBtn = $('.menu .menu__list .menu__item[data-action="main"]');
            if (mainBtn.length) {
                mainBtn.after(button);
            } else {
                // Якщо нічого не знайшли, просто в початок списку
                $('.menu .menu__list').prepend(button);
            }
        }
    }

    if (window.appready) {
        addMenuButton();
    } else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') addMenuButton();
        });
    }
})();
