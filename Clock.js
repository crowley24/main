(function() {  
    'use strict';  

    // == Lampac Clock Style Plugin ==  
    // Кастомний годинник з вибором стилю в налаштуваннях

    // Доступні стилі годинника
    const clockStyles = {
        classic: {
            name: 'Класичний (Білий з помаранчевим розділювачем)',
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
            name: 'Градієнтний (Плавний перехід)',
            render: (h, m, s) => `
                <span style="background: linear-gradient(45deg, #ff416c, #ff4b2b); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-size:1em;">${h}:${m}</span>
            `
        }
    };

    function getSelectedStyle() {
        return window.Lampa && Lampa.Storage ? Lampa.Storage.get('custom_clock_style', 'classic') : 'classic';
    }

    function createClock() {  
        let oldClock = document.querySelector('.head__time');  
        if (!oldClock) {  
            console.warn('[ClockPlugin] .head__time не знайдено');  
            return;  
        }  

        if (document.querySelector('#custom-clock')) return;  

        const clock = document.createElement('div');  
        clock.id = 'custom-clock';  
        clock.style.display = 'flex';  
        clock.style.alignItems = 'center';  
        clock.style.fontFamily = 'Segoe UI, Roboto, sans-serif';  
        clock.style.fontWeight = '600';  
        clock.style.fontSize = '2.5em';  
        clock.style.whiteSpace = 'nowrap';  

        const timeDisplay = document.createElement('div');  
        timeDisplay.style.display = 'flex';  
        timeDisplay.style.alignItems = 'baseline';  

        clock.appendChild(timeDisplay);  
        oldClock.parentNode.replaceChild(clock, oldClock);  

        function updateClock() {  
            const now = new Date();  
            let h = now.getHours().toString().padStart(2, '0');  
            let m = now.getMinutes().toString().padStart(2, '0');  
            let s = now.getSeconds().toString().padStart(2, '0');  

            let styleKey = getSelectedStyle();
            let styleObj = clockStyles[styleKey] || clockStyles.classic;

            timeDisplay.innerHTML = styleObj.render(h, m, s);  
        }  

        updateClock();  
        setInterval(updateClock, 1000);  
    }  

    // Додаємо пункт в налаштування Lampa
    function addSettings() {
        if (!window.Lampa || !window.Lampa.SettingsApi) return;

        Lampa.SettingsApi.addParam({
            component: 'interface',
            param: 'custom_clock_style',
            type: 'select',
            values: Object.keys(clockStyles).reduce((acc, key) => {
                acc[key] = clockStyles[key].name;
                return acc;
            }, {}),
            default: 'classic',
            name: 'Стиль годинника',
            descr: 'Виберіть зовнішній вигляд кастомного годинника в шапці'
        });
    }

    // Запуск після завантаження Lampa  
    if (window.Lampa && window.Lampa.Listener) {  
        Lampa.Listener.follow('app', function(e) {  
            if (e.type === 'ready') {  
                addSettings();
                setTimeout(createClock, 1000);  
            }  
        });  
    } else {  
        document.addEventListener('DOMContentLoaded', function() {  
            setTimeout(createClock, 3000);  
        });  
    }  
})();
