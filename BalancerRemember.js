(function () {
    'use strict';

    function startPlugin() {
        Lampa.Settings.listener.follow('open', function (e) {
            if (e.name == 'online') {
                // Отримуємо список встановлених джерел через внутрішні налаштування Lampa
                // Зазвичай вони зберігаються в налаштуваннях 'online_balansers' або доступні в об'єктах
                var installed_plugins = Lampa.Storage.field('online_balansers') || [];
                
                var balancers = [{title: 'Не використовувати', id: 'none'}];

                // Формуємо список тільки з тих, що реально встановлені
                installed_plugins.forEach(function(p) {
                    if (p.name && p.status) {
                        balancers.push({
                            title: p.name.charAt(0).toUpperCase() + p.name.slice(1),
                            id: p.name.toLowerCase()
                        });
                    }
                });

                // Якщо список порожній (Lampa ще не завантажила конфіг), додаємо базові
                if (balancers.length <= 1) {
                    ['rezka', 'filmix', 'videocdn', 'kinobase', 'alloha'].forEach(function(b) {
                        balancers.push({title: b.charAt(0).toUpperCase() + b.slice(1), id: b});
                    });
                }

                var current = Lampa.Storage.get('my_fav_balanser', 'none');
                var current_name = balancers.find(b => b.id == current)?.title || 'Не вибрано';

                var item = $(`<div class="settings-line selector">
                    <div class="settings-line__title">Пріоритетне джерело (Auto)</div>
                    <div class="settings-line__value">${current_name}</div>
                </div>`);

                item.on('hover:enter', function () {
                    Lampa.Select.show({
                        title: 'Виберіть джерело зі встановлених',
                        items: balancers,
                        onSelect: function (a) {
                            Lampa.Storage.set('my_fav_balanser', a.id);
                            item.find('.settings-line__value').text(a.title);
                            Lampa.Noty.show('Тепер ' + a.title + ' пріоритетний');
                            Lampa.Select.close();
                        },
                        onBack: function () {
                            Lampa.Select.close();
                        }
                    });
                });

                e.body.append(item);
            }
        });

        // Логіка підміни
        Lampa.Listener.follow('activity', function (e) {
            if (e.type == 'start' && e.component == 'online') {
                var fav = Lampa.Storage.get('my_fav_balanser', 'none');
                if (fav !== 'none') {
                    Lampa.Storage.set('online_balanser', fav);
                    if (e.object && e.object.movie) {
                        var cache = Lampa.Storage.cache('online_last_balanser', 500, {});
                        cache[e.object.movie.id] = fav;
                        Lampa.Storage.set('online_last_balanser', cache);
                    }
                }
            }
        });
    }

    if (window.appready) startPlugin();
    else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type == 'ready') startPlugin();
        });
    }
})();
