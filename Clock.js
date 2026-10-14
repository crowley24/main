(function() {  
    'use strict';  
 // == Lampac Clock Style Plugin ==  

    const clockStyles = {
        classic: {
            name: 'Класичний (Білий з помаранчевим)',
            render: (h, m, s) => `
                <span style="color:#ffffff; font-size:1em;">${h}</span>
                <span style="color:#ff9100; font-size:1em;">:${m}</span>
            `
        },
        neon: {
            name: 'Неоновий блакитний',
            render: (h, m, s) => `
                <span style="color:#00e5ff; font-size:1em; text-shadow: 0 0 10px rgba(0,229,255,0.6);">${h}</span>
                <span style="color:#ffffff; font-size:1em;">:${m}</span>
            `
        },
        seconds: {
            name: 'З секундами (Компактний)',
            render: (h, m, s) => `
                <span style="color:#ffffff; font-size:1em;">${h}:${m}</span>
                <span style="color:#888888; font-size:0.5em; margin-left:4px;">:${s}</span>
            `
        },
        gradient: {
            name: 'Градієнтний (Яскравий)',
            render: (h, m, s) => `
                <span style="background: linear-gradient(45deg, #ff416c, #ff4b2b); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-size:1em;">${h}:${m}</span>
            `
        }
    };

    function getSelectedStyle() {
        return (window.Lampa && Lampa.Storage) ? Lampa.Storage.get('custom_clock_style', 'classic') : 'classic';
    }

    function createClock() {  
        let oldClock = document.querySelector('.head__time');  
        if (!oldClock) return;  

        let customClock = document.querySelector('#custom-clock');
        if (!customClock) {
            customClock = document.createElement('div');  
            customClock.id = 'custom-clock';  
            customClock.style.display = 'flex';  
            customClock.style.alignItems = 'center';  
            customClock.style.fontFamily = 'Segoe UI, Roboto, sans-serif';  
            customClock.style.fontWeight = '600';  
            customClock.style.fontSize = '2.5em';  
            customClock.style.whiteSpace = 'nowrap';  
            customClock.style.cursor = 'pointer';

            const timeDisplay = document.createElement('div');  
            timeDisplay.className = 'time-display';
            timeDisplay.style.display = 'flex';  
            timeDisplay.style.alignItems = 'baseline';  

            customClock.appendChild(timeDisplay);  
            oldClock.parentNode.replaceChild(customClock, oldClock);  
        }

        const timeDisplay = customClock.querySelector('.time-display');

        function updateClock() {  
            const now = new Date();  
            let h = now.getHours().toString().padStart(2, '0');  
            let m = now.getMinutes().toString().padStart(2, '0');  
            let s = now.getSeconds().toString().padStart(2, '0');  

            let styleKey = getSelectedStyle();
            let styleObj = clockStyles[styleKey] || clockStyles.classic;

            if (timeDisplay) {
                timeDisplay.innerHTML = styleObj.render(h, m, s);  
            }
        }  

        updateClock();  
        if (!window.customClockInterval) {
            window.customClockInterval = setInterval(updateClock, 1000);  
        }
    }  

    // Додавання власного розділу/пункту в меню Налаштувань
    function registerSettings() {
        if (!window.Lampa || !Lampa.SettingsApi) return;

        // Варіант 1: Додаємо через SettingsApi
        Lampa.SettingsApi.addParam({
            component: 'interface',
            param: 'custom_clock_style',
            type: 'select',
            values: {
                classic: 'Класичний (Білий з помаранчевим)',
                neon: 'Неоновий блакитний',
                seconds: 'З секундами (Компактний)',
                gradient: 'Градієнтний (Яскравий)'
            },
            default: 'classic',
            name: 'Стиль годинника',
            descr: 'Зовнішній вигляд годинника у шапці',
            onChange: function() {
                createClock();
            }
        });

        // Варіант 2: Створюємо окремий пункт у головному меню Налаштувань (для гарантії)
        Lampa.SettingsComponent.add({
            title: 'Стиль годинника',
            component: 'custom_clock_settings',
            icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`
        });

        // Слухаємо відкриття нашого компонента налаштувань
        Lampa.Listener.follow('settings', function(e) {
            if (e.type === 'open' && e.name === 'custom_clock_settings') {
                let body = e.body;
                body.empty();

                Object.keys(clockStyles).forEach(function(key) {
                    let item = Lampa.Template.get('settings_param', {
                        name: clockStyles[key].name,
                        descr: key === getSelectedStyle() ? 'АКТИВНИЙ СТИЛЬ' : ''
                    });

                    item.on('hover:enter', function() {
                        Lampa.Storage.set('custom_clock_style', key);
                        createClock();
                        Lampa.Settings.update();
                    });

                    body.append(item);
                });
            }
        });
    }

    // Запуск при повній готовності Lampa
    function startPlugin() {
        registerSettings();
        createClock();
    }

    if (window.Lampa && Lampa.Listener) {  
        Lampa.Listener.follow('app', function(e) {  
            if (e.type === 'ready') {  
                setTimeout(startPlugin, 500);  
            }  
        });  
    } else {  
        document.addEventListener('DOMContentLoaded', function() {  
            setTimeout(startPlugin, 2000);  
        });  
    }  
})();
