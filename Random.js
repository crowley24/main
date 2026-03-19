(function () {  
    'use strict';  
  
    var PLUGIN_ID = 'lampa_random_pro';  
    var STORAGE_KEY = 'lampa_random_pro_settings';  
    var CACHE_KEY = 'lampa_random_pro_cache';  
    var CACHE_DURATION = 5 * 60 * 1000;  
      
    var menuAdded = false;  
      
    var ALL_GENRES = {  
        28: 'Бойовик', 12: 'Пригоди', 16: 'Мультфільм', 35: 'Комедія', 80: 'Кримінал',  
        99: 'Документальний', 18: 'Драма', 10751: 'Сімейний', 14: 'Фентезі', 36: 'Історія',  
        27: 'Жахи', 10402: 'Музика', 9648: 'Містика', 10749: 'Мелодрама', 878: 'Фантастика',  
        53: 'Трилер', 10752: 'Військовий', 37: 'Вестерн'  
    };  
  
    // Описи логік підборки  
    var LOGIC_DESCRIPTIONS = {  
        strict: {  
            title: 'Тільки вибрані (Strict)',  
            description: 'Показує фільми/серіали, що містять ВСІ обрані жанри. Максимально точна фільтрація.'  
        },  
        smart: {  
            title: 'Розумний (Smart)',  
            description: 'Інтелектуальний підбір з урахуванням популярності жанрів. Частіше показує трендові жанри.'  
        },  
        trends: {  
            title: 'Тренди (Популярне)',  
            description: 'Показує тільки популярний контент без фільтрації по жанрах. Сортування за популярністю.'  
        },  
        random: {  
            title: 'Один із вибраних (Mix)',  
            description: 'Випадковий вибір одного з обраних жанрів для кожної підбірки.'  
        }  
    };  
  
    function tr(uk, ru) {  
        return Lampa.Storage.get('language', 'uk') === 'uk' ? uk : ru;  
    }  
  
    function getSettings() {  
        var def = {  
            genres: [],  
            type: 'all',   
            mode: 'smart',   
            years: 'all',    
            minRating: 6.5,  
            maxResults: 20,  
            useCache: true,  
            excludeWatched: false  
        };  
        var saved = Lampa.Storage.get(STORAGE_KEY);  
        return Object.assign(def, saved || {});  
    }  
  
    function saveSettings(data) {  
        Lampa.Storage.set(STORAGE_KEY, data);  
        clearCache();  
    }  
  
    function getCache() {  
        if (!getSettings().useCache) return null;  
        var cached = Lampa.Storage.get(CACHE_KEY);  
        if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {  
            return cached.data;  
        }  
        return null;  
    }  
  
    function setCache(data, config) {  
        if (!getSettings().useCache) return;  
        Lampa.Storage.set(CACHE_KEY, {  
            data: data,  
            config: config,  
            timestamp: Date.now()  
        });  
    }  
  
    function clearCache() {  
        Lampa.Storage.set(CACHE_KEY, null);  
    }  
  
    function getRandomConfig() {  
        var s = getSettings();  
        var lang = Lampa.Storage.get('language', 'uk') === 'uk' ? 'uk-UA' : 'ru-RU';  
        var type = s.type === 'all' ? (Math.random() > 0.5 ? 'movie' : 'tv') : s.type;  
        var currentYear = new Date().getFullYear();  
  
        var params = {  
            'vote_average.gte': s.minRating,  
            'vote_count.gte': 150, // Збільшено для кращої якості  
            'language': lang,  
            'sort_by': 'popularity.desc',  
            'page': Math.floor(Math.random() * 15) + 1  
        };  
  
        // ВИПРАВЛЕНО: Правильний формат дат та логіка фільтра по роках  
        if (s.years === 'new') {  
            var startDate = new Date();  
            startDate.setFullYear(currentYear - 5);  
            var dateGte = startDate.toISOString().split('T')[0];  
            var dateLte = new Date().toISOString().split('T')[0];  
              
            if (type === 'movie') {  
                params['primary_release_date.gte'] = dateGte;  
                params['primary_release_date.lte'] = dateLte;  
            } else {  
                params['first_air_date.gte'] = dateGte;  
                params['first_air_date.lte'] = dateLte;  
            }  
        } else if (s.years === 'retro') {  
            if (type === 'movie') {  
                params['primary_release_date.lte'] = '2005-12-31';  
            } else {  
                params['first_air_date.lte'] = '2005-12-31';  
            }  
        } else if (s.years === '90s') {  
            if (type === 'movie') {  
                params['primary_release_date.gte'] = '1990-01-01';  
                params['primary_release_date.lte'] = '1999-12-31';  
            } else {  
                params['first_air_date.gte'] = '1990-01-01';  
                params['first_air_date.lte'] = '1999-12-31';  
            }  
        }  
  
        // Режими жанрів  
        if (s.mode !== 'trends' && s.genres.length > 0) {  
            if (s.mode === 'strict') {  
                params.with_genres = s.genres.join(',');  
            } else if (s.mode === 'smart') {  
                var popularGenres = [28, 12, 35, 18, 53, 878];  
                var availablePopular = s.genres.filter(function(g) {  
                    return popularGenres.indexOf(parseInt(g)) !== -1;  
                });  
                  
                if (availablePopular.length > 0 && Math.random() > 0.4) {  
                    params.with_genres = availablePopular[Math.floor(Math.random() * availablePopular.length)];  
                } else {  
                    params.with_genres = s.genres[Math.floor(Math.random() * s.genres.length)];  
                }  
            } else {  
                params.with_genres = s.genres[Math.floor(Math.random() * s.genres.length)];  
            }  
        }  
  
        return { type: type, params: params };  
    }  
  
    function filterByYearAndRating(results, settings) {  
        var currentYear = new Date().getFullYear();  
          
        return results.filter(function(item) {  
            // ВИПРАВЛЕНО: Додаткова перевірка рейтингу на клієнті  
            if (item.vote_average < settings.minRating) return false;  
              
            // ВИПРАВЛЕНО: Додаткова перевірка років на клієнті  
            if (settings.years === 'new') {  
                var itemYear = item.release_date ? parseInt(item.release_date.split('-')[0]) :   
                              item.first_air_date ? parseInt(item.first_air_date.split('-')[0]) : null;  
                if (itemYear && (itemYear < currentYear - 5 || itemYear > currentYear)) return false;  
            } else if (settings.years === 'retro') {  
                var itemYear = item.release_date ? parseInt(item.release_date.split('-')[0]) :   
                              item.first_air_date ? parseInt(item.first_air_date.split('-')[0]) : null;  
                if (itemYear && itemYear > 2005) return false;  
            } else if (settings.years === '90s') {  
                var itemYear = item.release_date ? parseInt(item.release_date.split('-')[0]) :   
                              item.first_air_date ? parseInt(item.first_air_date.split('-')[0]) : null;  
                if (itemYear && (itemYear < 1990 || itemYear > 1999)) return false;  
            }  
              
            return true;  
        });  
    }  
  
    function filterStrict(results, settings) {  
        if (settings.mode !== 'strict' || settings.genres.length === 0) return results;  
          
        return results.filter(function(item) {  
            return settings.genres.every(function(gId) {  
                return item.genre_ids && item.genre_ids.indexOf(parseInt(gId)) !== -1;  
            });  
        });  
    }  
  
    function filterWatched(results) {  
        if (!getSettings().excludeWatched) return results;  
          
        var watched = Lampa.Storage.get('files_watched') || {};  
        return results.filter(function(item) {  
            return !watched[item.id];  
        });  
    }  
  
    function injectToMain() {  
        if (Lampa.ContentRows.call.__random_pro) return;  
        Lampa.ContentRows.call.__random_pro = true;  
  
        var original = Lampa.ContentRows.call;  
        Lampa.ContentRows.call = function (screen, params, calls) {  
            if (screen === 'main') {  
                calls.unshift(function (call) {  
                    var config = getRandomConfig();  
                    var settings = getSettings();  
                    var cacheKey = JSON.stringify(config);  
                      
                    var cached = getCache();  
                    if (cached && cached.key === cacheKey) {  
                        call({  
                            results: cached.results,  
                            title: tr('Випадкова добірка', 'Случайная подборка') + ' 📋'  
                        });  
                        return;  
                    }  
  
                    var method = config.type === 'movie' ? 'discover/movie' : 'discover/tv';  
  
                    Lampa.Api.sources.tmdb.get(method, config.params, function (json) {  
                        if (json && json.results) {  
                            var filtered = json.results;  
                              
                            // ВИПРАВЛЕНО: Послідовна фільтрація з перевіркою на клієнті  
                            filtered = filterByYearAndRating(filtered, settings);  
                            filtered = filterStrict(filtered, settings);  
                            filtered = filterWatched(filtered);  
                              
                            // Сортування за рейтингом  
                            filtered.sort(function(a, b) {  
                                return (b.vote_average || 0) - (a.vote_average || 0);  
                            });  
                              
                            filtered.forEach(function (i) { i.type = config.type; });  
  
                            var results = filtered.slice(0, settings.maxResults);  
                              
                            setCache({ results: results, key: cacheKey }, config);  
  
                            call({  
                                results: results,  
                                title: tr('Випадкова добірка', 'Случайная подборка') + ' ✨'  
                            });  
                        } else call({ results: [] });  
                    }, function () { call({ results: [] }); });  
                });  
            }  
            original.apply(this, arguments);  
        };  
    }  
  
    function openSettings() {  
        var s = getSettings();  
        var items = [];  
  
        // Тип контенту  
        items.push({  
            title: '🎬 ' + tr('Тип: ', 'Тип: ') + (s.type === 'all' ? tr('Усе', 'Все') : (s.type === 'movie' ? tr('Фільми', 'Фильмы') : tr('Серіали', 'Сериалы'))),  
            value: 'type'  
        });  
  
        // Режим логіки з детальним описом  
        var modeInfo = LOGIC_DESCRIPTIONS[s.mode];  
        items.push({  
            title: '🎯 ' + tr('Логіка: ', 'Логика: ') + modeInfo.title,  
            subtitle: modeInfo.description,  
            value: 'mode'  
        });  
  
        // Фільтр по роках  
        var yearsTitle = s.years === 'new' ? tr('Останні 5 років', 'Последние 5 лет') :   
                         s.years === 'retro' ? tr('Класика (до 2005)', 'Классика') :  
                         s.years === '90s' ? tr('90-ті', '90-е') : tr('Будь-які', 'Любые');  
        items.push({  
            title: '📅 ' + tr('Роки: ', 'Годы: ') + yearsTitle,  
            value: 'years'  
        });  
  
        // Мінімальний рейтинг  
        items.push({  
            title: '⭐ ' + tr('Рейтинг: ', 'Рейтинг: ') + s.minRating.toFixed(1),  
            subtitle: tr('Мінімальний рейтинг фільмів', 'Минимальный рейтинг фильмов'),  
            value: 'rating'  
        });  
  
        // Кількість результатів  
        items.push({  
            title: '📊 ' + tr('Результатів: ', 'Результатов: ') + s.maxResults,  
            value: 'maxResults'  
        });  
  
        // Опції  
        items.push({  
            title: (s.useCache ? '✅ ' : '🚫 ') + tr('Використовувати кеш', 'Использовать кеш'),  
            subtitle: tr('Прискорює завантаження', 'Ускоряет загрузку'),  
            value: 'cache'  
        });  
  
        items.push({  
            title: (s.excludeWatched ? '✅ ' : '🚫 ') + tr('Виключити переглянуті', 'Исключить просмотренные'),  
            subtitle: tr('Не показувати переглянуті фільми', 'Не показывать просмотренные фильмы'),  
            value: 'watched'  
        });  
  
        items.push({   
            title: '--- ' + tr('Виберіть жанри нижче', 'Выберите жанры ниже') + ' ---',   
            subtitle: tr('Оберіть жанри для фільтрації', 'Выберите жанры для фильтрации'),  
            value: 'none'   
        });  
  
        // Жанри  
        Object.keys(ALL_GENRES).sort(function(a,b){return ALL_GENRES[a].localeCompare(ALL_GENRES[b])}).forEach(function (id) {  
            items.push({  
                title: (s.genres.indexOf(id) !== -1 ? '● ' : '○ ') + ALL_GENRES[id],  
                value: 'g_' + id  
            });  
        });  
  
        Lampa.Select.show({  
            title: '⚙️ PRO Random ' + tr('Налаштування', 'Настройки'),  
            items: items,  
            onSelect: function (item) {  
                if (item.value === 'none') return;  
                var s = getSettings();  
  
                if (item.value === 'type') {  
                    s.type = s.type === 'movie' ? 'tv' : s.type === 'tv' ? 'all' : 'movie';  
                } else if (item.value === 'mode') {  
                    var modes = ['strict', 'smart', 'trends', 'random'];  
                    var currentIndex = modes.indexOf(s.mode);  
                    s.mode = modes[(currentIndex + 1) % modes.length];  
                } else if (item.value === 'years') {  
                    s.years = s.years === 'all' ? 'new' : s.years === 'new' ? 'retro' : s.years === 'retro' ? '90s' : 'all';  
                } else if (item.value === 'rating') {  
                    s.minRating = s.minRating >= 8.5 ? 5.0 : s.minRating + 0.5;  
                } else if (item.value === 'maxResults') {  
                    s.maxResults = s.maxResults >= 50 ? 10 : s.maxResults + 10;  
                } else if (item.value === 'cache') {  
                    s.useCache = !s.useCache;  
                } else if (item.value === 'watched') {  
                    s.excludeWatched = !s.excludeWatched;  
                } else if (item.value.indexOf('g_') === 0) {  
                    var id = item.value.replace('g_', '');  
                    var idx = s.genres.indexOf(id);  
                    if (idx > -1) s.genres.splice(idx, 1);  
                    else s.genres.push(id);  
                }  
  
                saveSettings(s);  
                openSettings();  
            },  
            onBack: function () { Lampa.Controller.toggle('content'); }  
        });  
    }  
  
    function addButton() {  
        if (menuAdded) return;  
          
        if ($('.menu__item[data-action="' + PLUGIN_ID + '"]').length) {  
            menuAdded = true;  
            return;  
        }  
  
        var button = $('<li class="menu__item selector" data-action="' + PLUGIN_ID + '">' +  
            '<div class="menu__ico">🎲</div>' +  
            '<div class="menu__text">PRO Random</div>' +  
            '</li>');  
  
        button.on('hover:enter', function () {  
            var config = getRandomConfig();  
            var s = getSettings();  
              
            var url = 'discover/' + config.type + '?v=' + Date.now();  
              
            Lampa.Activity.push({  
                url: url,  
                title: '🎲 ' + tr('Рандом: ', 'Рандом: ') + (config.type === 'movie' ? tr('Фільми', 'Фильмы') : tr('Серіали', 'Сериалы')),  
                component: 'category_full',  
                page: config.params.page,  
                genres: config.params.with_genres,  
                params: config.params,  
                source: 'tmdb'  
            });  
        });  
  
        button.on('hover:long', function () {   
            openSettings();   
        });  
          
        $('.menu .menu__list').eq(0).append(button);  
        menuAdded = true;  
    }  
  
    function start() {  
        addButton();  
        injectToMain();  
    }  
  
    if (window.appready) start();  
    else Lampa.Listener.follow('app', function (e) {   
        if (e.type === 'ready') {  
            menuAdded = false; // Скидаємо при оновленні  
            start();   
        }  
    });  
  
})();  
  
