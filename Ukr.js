(function() {  
    'use strict';  
      
    setTimeout(function() {  
        // Перевірка наявності jQuery  
        if (typeof $ === 'undefined') {  
            console.error('jQuery не завантажено');  
            return;  
        }  
  
        const UKRAINE_FLAG_SVG = '<span class="flag-container"><svg class="flag-svg" viewBox="0 0 20 15"><rect width="20" height="7.5" y="0" fill="#0057B7"/><rect width="20" height="7.5" y="7.5" fill="#FFD700"/></svg></span>';  
  
        // 1. Додавання CSS стилів  
        if (!document.getElementById('ukrainization-style')) {  
            try {  
                const css = `  
                    /* Стилі прапорців та перекладу */  
                    .flag-container { display: inline-flex; align-items: center; vertical-align: middle; height: 1.27em; margin-left: 3px; }  
                    .flag-svg { display: inline-block; vertical-align: middle; margin-right: 2px; border-radius: 2px; width: 22px; height: 15px; }  
                    .ua-flag-processed { position: relative; }  
                      
                    @media (max-width: 767px) {  
                        .flag-svg { width: 16px; height: 12px; }  
                    }  
                `;  
                const style = document.createElement('style');  
                style.id = 'ukrainization-style';  
                style.textContent = css;  
                document.head.appendChild(style);  
            } catch (e) {  
                console.error('Помилка додавання CSS:', e);  
            }  
        }  
  
        // 2. Логіка заміни тексту (Українізація)  
        const REPLACEMENTS = [  
            [/Uaflix/g, 'UAFlix'],  
            [/Zetvideo/g, 'UaFlix'],  
            [/Нет истории просмотра/g, 'Історія перегляду відсутня'],  
            [/Дублированный|Дубляж/g, 'Дубльований'],  
            [/Многоголосый|многоголосый/g, 'багатоголосий'],  
            [/двухголосый/g, 'двоголосий'],  
            [/(Украинский|Український|Украинская|Українська)/g, UKRAINE_FLAG_SVG + ' Українською'],  
            [/1\+1/g, UKRAINE_FLAG_SVG + ' 1+1'],  
            [/\bUkr\b/gi, UKRAINE_FLAG_SVG + ' Українською'],  
            [/\bUa\b/gi, UKRAINE_FLAG_SVG + ' UA']  
        ];  
  
        function translateNode(node) {  
            try {  
                if (node.nodeType === 3) { // Text node  
                    let text = node.nodeValue;  
                    let changed = false;  
                    REPLACEMENTS.forEach(([pattern, replacement]) => {  
                        if (pattern.test(text)) {  
                            text = text.replace(pattern, replacement);  
                            changed = true;  
                        }  
                    });  
                    if (changed) {  
                        const span = document.createElement('span');  
                        span.className = 'ua-flag-processed';  
                        span.innerHTML = text;  
                        node.parentNode.replaceChild(span, node);  
                    }  
                } else if (node.nodeType === 1 && !node.classList.contains('ua-flag-processed')) {  
                    node.childNodes.forEach(translateNode);  
                }  
            } catch (e) {  
                console.error('Помилка перекладу вузла:', e);  
            }  
        }  
  
        // 3. Запуск спостереження за DOM для перекладу  
        try {  
            const observer = new MutationObserver((mutations) => {  
                try {  
                    mutations.forEach(mutation => {  
                        mutation.addedNodes.forEach(node => {  
                            translateNode(node);  
                        });  
                    });  
                } catch (e) {  
                    console.error('Помилка в MutationObserver callback:', e);  
                }  
            });  
  
            observer.observe(document.body, { childList: true, subtree: true });  
        } catch (e) {  
            console.error('Помилка налаштування MutationObserver:', e);  
        }  
  
        // 4. Початковий запуск  
        try {  
            translateNode(document.body);  
        } catch (e) {  
            console.error('Помилка початкового запуску:', e);  
        }  
  
        // 5. Реєстрація плагіна  
        try {  
            window.plugin && window.plugin('ukrainization_plugin', {  
                type: 'component',  
                name: 'Українізація',  
                version: '1.0.0',  
                author: 'Devin',  
                description: 'Автоматична українізація інтерфейсу з прапорцями'  
            });  
        } catch (e) {  
            console.error('Помилка реєстрації плагіна:', e);  
        }  
  
    }, 2000);  
})();
