(function() {  
    'use strict';  

    // == Lampac Clock Style Plugin ==  

    // Доступні стилі годинника
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
        return window.Lampa && Lampa.Storage ? Lampa.Storage.get('custom_clock_style', 'classic') : 'classic';
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

    // Реєстрація параметрів у налаштуваннях
    function addSettings() {
        if (!window.Lampa || !Lampa.SettingsApi) return;

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
            descr: 'Виберіть зовнішній вигляд годинника у шапці',
            onChange: function() {
                // Одразу оновлюємо годинник при зміні
                createClock();
            }
        });
    }

    // Запуск реєстрації налаштувань
    if (window.Lampa) {
        addSettings();
    }

    function init() {
        addSettings();
        setTimeout(createClock, 500);
    }

    if (window.Lampa && Lampa.Listener) {  
        Lampa.Listener.follow('app', function(e) {  
            if (e.type === 'ready') {  
                init();
            }  
        });  
    } else {  
        document.addEventListener('DOMContentLoaded', init);  
    }  
})();
