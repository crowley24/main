(function () {  
  "use strict";  
  
  let manifest = {  
    type: 'interface',  
    version: '3.12.0',  
    name: 'Interface Size Fixed',  
    component: 'interface_size_precise'  
  };  
  Lampa.Manifest.plugins = manifest;  
  
  function init() {
    // Очищуємо старі значення
    Lampa.Params.values['interface_size'] = {};

    // Додаємо новий список вибору від 8px до 12px
    Lampa.Params.select('interface_size', {  
      '8': '8px',
      '9': '9px',
      '10': '10px',       
      '11': '11px',    
      '12': '12px'   
    }, '11'); // 11px за замовчуванням 

    updateSize();
  }
  
  const updateSize = () => {
    // Отримуємо значення з пам'яті, якщо мобільний — примусово 10px
    const iSize = Lampa.Platform.screen('mobile') ? 10 : parseInt(Lampa.Storage.field('interface_size')) || 11;
    
    // Встановлюємо розмір шрифту для всього інтерфейсу
    $('body').css({ fontSize: iSize + 'px' });  
  
    // Логіка кількості карток у рядку залежно від розміру
    let cardCount = 6;
    if (iSize <= 8) cardCount = 9;      // Для 8px — 9 карток
    else if (iSize <= 9) cardCount = 8; // Для 9px — 8 карток
    else if (iSize <= 11) cardCount = 7;// Для 10-11px — 7 карток
    else cardCount = 6;                 // Для 12px — 6 карток

    if (Lampa.Maker && Lampa.Maker.map) {
      ['Line', 'Category'].forEach(type => {
        const original = Lampa.Maker.map(type).Items.onInit;
        Lampa.Maker.map(type).Items.onInit = function() {
          original.call(this);
          if(type === 'Line') this.view = cardCount;
          else this.limit_view = cardCount;
        };
      });
    }
  };  
  
  if (window.Lampa) {
    // Затримка для переписування стандартного меню
    setTimeout(init, 500); 
    
    Lampa.Storage.listener.follow('change', e => {  
      if (e.name == 'interface_size') updateSize();  
    });
  }
})();
