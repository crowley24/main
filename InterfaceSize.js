(function () {  
  "use strict";  
  
  let manifest = {  
    type: 'interface',  
    version: '3.11.5',  
    name: 'Interface Size Precise',  
    component: 'interface_size_precise'  
  };  
  Lampa.Manifest.plugins = manifest;  
  
  const lang_data = {
    settings_param_interface_size_mini: 'Міні інтерфейс',  
    settings_param_interface_size_very_small: 'Дуже малий інтерфейс',  
    settings_param_interface_size_small: 'Малий інтерфейс',  
    settings_param_interface_size_medium: 'Середній інтерфейс',  
    settings_param_interface_size_standard: 'Стандартний інтерфейс',  
    settings_param_interface_size_large: 'Великий інтерфейс',  
    settings_param_interface_size_very_large: 'Дуже великий інтерфейс'
  };

  function init() {
    if (window.Lampa && Lampa.Lang) {
      Lampa.Lang.add(lang_data);
    }

    Lampa.Params.values['interface_size'] = {};

    Lampa.Params.select('interface_size', {  
      '09.1': lang_data.settings_param_interface_size_mini,        
      '09.6': lang_data.settings_param_interface_size_very_small, 
      '10.1': lang_data.settings_param_interface_size_small,       
      '10.6': lang_data.settings_param_interface_size_medium,    
      '11.1': lang_data.settings_param_interface_size_standard,    
      '11.6': lang_data.settings_param_interface_size_large,     
      '12.1': lang_data.settings_param_interface_size_very_large   
    }, '11.1');  

    updateSize();
  }
  
  const updateSize = () => {
    const iSize = Lampa.Platform.screen('mobile') ? 10.1 : parseFloat(Lampa.Storage.field('interface_size')) || 11.1;
    $('body').css({ fontSize: iSize + 'px' });  
  
    // Логіка карток
    let cardCount = 6;
    if (iSize <= 9.6) cardCount = 8;
    else if (iSize <= 11.1) cardCount = 7;

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
    // Затримка 500мс дає системі час завантажити стандартне меню, 
    // щоб ми могли його переписати
    setTimeout(init, 500); 
    Lampa.Storage.listener.follow('change', e => {  
      if (e.name == 'interface_size') updateSize();  
    });
  }
})();
