(function () {    
  "use strict";    
    
  let manifest = {    
    type: 'interface',    
    version: '3.11.0',    
    name: 'Interface Size Precise',    
    component: 'interface_size_precise'    
  };    
  Lampa.Manifest.plugins = manifest;    
    
  // Додаємо переклади для нового параметра  
  if (Lampa.Lang && Lampa.Lang.add) {  
    Lampa.Lang.add({  
      settings_interface_text_size: 'Розмір тексту',  
      settings_interface_text_size_descr: 'Незалежний розмір тексту елементів інтерфейсу'  
    });  
  }  
    
  // Розширені опції розміру з дробовими значеннями    
  Lampa.Params.select('interface_size', {     
    '09': '9',     
    '09.5': '9.5',     
    '10': '10',     
    '10.5': '10.5',     
    '11': '11',     
    '11.5': '11.5',     
    '12': '12'    
  }, '12');    
    
  // Новий параметр для розміру тексту    
  Lampa.Params.select('text_size', {     
    '08': '8',     
    '09': '9',     
    '10': '10',     
    '11': '11',     
    '12': '12',     
    '13': '13',     
    '14': '14',     
    '15': '15',     
    '16': '16'    
  }, '12');    
      
  const getInterfaceSize = () => Lampa.Platform.screen('mobile') ? 10 : parseFloat(Lampa.Storage.field('interface_size')) || 12;    
  const getTextSize = () => parseFloat(Lampa.Storage.field('text_size')) || 12;    
      
  // Розрахунок кількості карток залежно від розміру інтерфейсу    
  const getCardCount = (interfaceSize) => {    
    if (interfaceSize <= 9) return 8;        
    if (interfaceSize <= 9.5) return 8;      
    if (interfaceSize <= 10) return 7;       
    if (interfaceSize <= 10.5) return 7;     
    if (interfaceSize <= 11) return 7;       
    if (interfaceSize <= 11.5) return 6;     
    return 6;                           
  };    
      
  const updateSize = () => {    
    const interfaceSize = getInterfaceSize();    
    const textSize = getTextSize();    
      
    // Застосовуємо розмір інтерфейсу до body (впливає на компоненти)    
    $('body').css({ fontSize: interfaceSize + 'px' });    
      
    // Застосовуємо розмір тексту до текстових елементів    
    $('.settings-param__name, .settings-param__value, .settings-param__descr, .full-descr__text, .card__title, .card__genres, .filter__name, .filter__value').css({   
      fontSize: (textSize / interfaceSize) + 'em'   
    });    
        
    // Оновлюємо кількість карток для Line та Category    
    const cardCount = getCardCount(interfaceSize);    
        
    const originalLine = Lampa.Maker.map('Line').Items.onInit;    
    Lampa.Maker.map('Line').Items.onInit = function () {     
      originalLine.call(this);     
      this.view = cardCount;     
    };    
        
    const originalCategory = Lampa.Maker.map('Category').Items.onInit;    
    Lampa.Maker.map('Category').Items.onInit = function () {     
      originalCategory.call(this);     
      this.limit_view = cardCount;     
    };    
  };    
      
  updateSize();    
      
  Lampa.Storage.listener.follow('change', e => {    
    if (e.name == 'interface_size' || e.name == 'text_size') updateSize();    
  });    
})();
