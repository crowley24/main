// IIFE - самовикликаюча функція для ізоляції плагіна
(function () {
  'use strict';

  function translate() {
    Lampa.Lang.add({
      bat_torserver: {
        en: 'TorServer selection',
        uk: 'Вибір TorServer',
        zh: 'TorServer 选择'
      },
      bat_torserver_description: {
        en: 'Click to select a server',
        uk: 'Натисніть для вибору сервера',
        zh: '点击选择服务器'
      },
      bat_torserver_current: {
        en: 'Current server:',
        uk: 'Поточний сервер:',
        zh: '当前服务器：'
      },
      bat_torserver_none: {
        en: 'Not selected',
        uk: 'Не вибрано',
        zh: '未选择'
      },
      bat_torserver_selected_label: {
        en: 'Selected:',
        uk: 'Обрано:',
        zh: '已选择：'
      },

      bat_check_servers: {
        en: 'Check servers availability',
        uk: 'Перевірити доступність серверів',
        zh: '检查服务器可用性'
      },
      bat_check_done: {
        en: 'Check completed',
        uk: 'Перевірку завершено',
        zh: '检查完成'
      },

      bat_status_checking: {
        en: 'Checking…',
        uk: 'Перевірка…',
        zh: '检查中…'
      },
      bat_status_ok: {
        en: 'Available',
        uk: 'Доступний',
        zh: '可用'
      },
      bat_status_bad: {
        en: 'Unavailable',
        uk: 'Недоступний',
        zh: '不可用'
      },
      bat_status_unknown: {
        en: 'Not checked',
        uk: 'Не перевірено',
        zh: '未检查'
      }
    });
  }

  // Список серверів з кодами країн (ISO alpha-2 в нижньому регістрі)
  var serversInfo = [
    {
      base: 's1',
      name: 'Kyiv - Ukraine #1',
      url: '194.113.32.79:8090',
      flag: 'ua'   // Україна
    },
     {
      base: 's2',
      name: 'Kyiv - Ukraine #2',
      url: '93.171.245.226:80',
      flag: 'ua'   // Україна
    },
     {
      base: 's3',
      name: 'Kyiv - Ukraine #3',
      url: '109.86.146.22:8090',
      flag: 'ua'   // Україна
    },
     {
      base: 's4',
      name: 'Kyiv - Ukraine #4',
      url: '178.158.212.246:5665',
      flag: 'ua'   // Україна
    },
    {
      base: 's5',
      name: 'Helsinki - Finland #1',
      url: '45.144.53.25:37940',
      flag: 'fi'   // Фінляндія
    },
    {
      base: 's6',
      name: 'Helsinki - Finland #3',
      url: '77.83.247.48:8090',
      flag: 'fi'
    },
    {
      base: 's7',
      name: 'Sweden #1',
      url: 'ts.maxvol.pro',
      flag: 'se'
    },
    {
      base: 's8',
      name: 'Swamps #1 (need VPN)',
      url: '188.235.146.53:8090',
      flag: 'ru'
    },
    {
      base: 's9',
      name: 'Swamps #2 (need VPN)',
      url: '91.144.129.100:8090',
      flag: 'ru'
    },    
    {
      base: 's10',
      name: 'Swamps #3 (need VPN)',
      url: '95.139.92.66:8090',
      flag: 'ru'
    },
    // Додай нові, наприклад:
    // { base: 'de1', name: 'Frankfurt - Germany', url: '...', flag: 'de' },
  ];

  var STORAGE_KEY = 'bat_torserver_selected';
  var NO_SERVER   = 'no_server';

  var COLOR_OK      = '#1aff00';
  var COLOR_BAD     = '#ff2e36';
  var COLOR_UNKNOWN = '#8c8c8c';

  var cache = {
    data: {},
    ttl: 40 * 1000,
    get: function(key) { 
      var v = this.data[key]; 
      return (v && Date.now() < v.expiresAt) ? v.value : null; 
    },
    set: function(key, value) { 
      this.data[key] = { value: value, expiresAt: Date.now() + this.ttl }; 
    }
  };

  function notifyDone() {
    var text = Lampa.Lang.translate('bat_check_done');
    if (Lampa.Noty && Lampa.Noty.show)     return Lampa.Noty.show(text);
    if (Lampa.Toast && Lampa.Toast.show)   return Lampa.Toast.show(text);
    alert(text);
  }

  function getSelectedBase() {
    return Lampa.Storage.get(STORAGE_KEY, NO_SERVER);
  }

  function getServerByBase(base) {
    if (base === NO_SERVER) return null;
    return serversInfo.find(function(s) { return s.base === base; });
  }

  function applySelectedServer(base) {
    var server = getServerByBase(base);
    if (!server) {
      Lampa.Storage.remove('torrserver_url');
      Lampa.Storage.remove('torrserver_address');
      return;
    }
    Lampa.Storage.set('torrserver_url', 'http://' + server.url);
    Lampa.Storage.set('torrserver_address', server.url);
  }

  function updateSelectedLabelInSettings() {
    var base = getSelectedBase();
    var server = getServerByBase(base);
    var name = server ? server.name : Lampa.Lang.translate('bat_torserver_none');
    var text = Lampa.Lang.translate('bat_torserver_selected_label') + ' ' + name;
    $('.bat-torserver-selected').text(text);
  }

  function checkServer(url, timeout) {
    return new Promise(function(resolve) {
      var start = Date.now();
      $.ajax({
        url: 'http://' + url + '/echo',
        method: 'GET',
        timeout: timeout || 5000,
        success: function() {
          resolve({ ok: true, time: Date.now() - start });
        },
        error: function(xhr) {
          var status = xhr.status || 0;
          resolve({ ok: false, status: status });
        }
      });
    });
  }

  function runHealthChecks() {
    var map = {};

    var requests = serversInfo.map(function(server) {
      return new Promise(function(resolve) {
        var cacheKey = 'ts_health::' + server.base;
        var cached = cache.get(cacheKey);
        if (cached) {
          map[server.base] = cached;
          resolve();
          return;
        }

        checkServer(server.url, 6000).then(function(result) {
          var val;
          if (result.ok) {
            val = { color: COLOR_OK, labelKey: 'bat_status_ok' };
          } else {
            val = { color: COLOR_BAD, labelKey: 'bat_status_bad' };
          }
          map[server.base] = val;
          cache.set(cacheKey, val);
          resolve();
        });
      });
    });

    return Promise.all(requests).then(function() { return map; });
  }

  function injectStyleOnce() {
    if (window.__bat_torserver_style__) return;
    window.__bat_torserver_style__ = true;

    var css = `
.bat-torserver-modal {
  display: flex;
  flex-direction: column;
  gap: 1em;
}
.bat-torserver-modal__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.bat-torserver-modal__current-label {
  font-size: 0.9em;
  opacity: 0.7;
}
.bat-torserver-modal__current-value {
  font-size: 1.1em;
}
.bat-torserver-modal__list {
  display: flex;
  flex-direction: column;
  gap: 0.6em;
}
.bat-torserver-modal__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1em;
  padding: 0.8em 1em;
  border-radius: 0.7em;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.08);
}
.bat-torserver-modal__item.is-selected,
.bat-torserver-modal__item.focus {
  border-color: #fff;
}
.bat-torserver-modal__left {
  display: flex;
  align-items: center;
  gap: 0.65em;
  min-width: 0;
}
.bat-torserver-modal__dot {
  width: 0.55em;
  height: 0.55em;
  border-radius: 50%;
  background: ${COLOR_UNKNOWN};
  box-shadow: 0 0 0.6em rgba(0,0,0,0.35);
}
.bat-flag img {
  width: 20px;
  height: 15px;
  vertical-align: middle;
  margin-right: 0.4em;
  border-radius: 2px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.3);
}
.bat-torserver-modal__name {
  font-size: 1em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.bat-torserver-modal__status {
  font-size: 0.85em;
  opacity: 0.75;
  text-align: right;
}
.bat-torserver-modal__actions {
  display: flex;
  gap: 0.6em;
  flex-wrap: wrap;
}
.bat-torserver-modal__action {
  padding: 0.55em 0.9em;
  border-radius: 0.6em;
  background: rgba(255,255,255,0.1);
  border: 1px solid rgba(255,255,255,0.2);
}
.bat-torserver-modal__action.focus {
  border-color: #fff;
}
    `;

    var style = document.createElement('style');
    style.type = 'text/css';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function buildServerItem(base, name, flagCode) {
    var flagHtml = flagCode ? `<img src="https://flagcdn.com/16x12/${flagCode}.png" alt="${flagCode.toUpperCase()}" />` : '';
    var $item = $(
      `<div class="bat-torserver-modal__item selector" data-base="${base}">
        <div class="bat-torserver-modal__left">
          <span class="bat-torserver-modal__dot"></span>
          <span class="bat-flag">&nbsp;&nbsp;&nbsp;${flagHtml}&nbsp;&nbsp;&nbsp;</span>
          <div class="bat-torserver-modal__name">${name}</div>
        </div>
        <div class="bat-torserver-modal__status">${Lampa.Lang.translate('bat_status_unknown')}</div>
      </div>`
    );
    return $item;
  }

  function setItemStatus($item, color, labelKey) {
    $item.find('.bat-torserver-modal__dot').css('background', color);
    $item.find('.bat-torserver-modal__status').text(Lampa.Lang.translate(labelKey));
  }

  function applySelection($list, base) {
    $list.find('.bat-torserver-modal__item').removeClass('is-selected');
    $list.find(`[data-base="${base}"]`).addClass('is-selected');
  }

  function updateCurrentLabel($modal, base) {
    var server = getServerByBase(base);
    var label = server ? server.name : Lampa.Lang.translate('bat_torserver_none');
    $modal.find('.bat-torserver-modal__current-value').text(label);
  }

  function openServerModal() {
    injectStyleOnce();

    var selected = getSelectedBase();

    var $modal = $(
      `<div class="bat-torserver-modal">
        <div class="bat-torserver-modal__head">
          <div class="bat-torserver-modal__current">
            <div class="bat-torserver-modal__current-label">${Lampa.Lang.translate('bat_torserver_current')}</div>
            <div class="bat-torserver-modal__current-value"></div>
          </div>
        </div><br>
        <div class="bat-torserver-modal__list"></div><br><br>
        <div class="bat-torserver-modal__actions">
          <div class="bat-torserver-modal__action selector">${Lampa.Lang.translate('bat_check_servers')}</div>
        </div>
      </div>`
    );

    updateCurrentLabel($modal, selected);

    var $list = $modal.find('.bat-torserver-modal__list');

    // Пункт "Не вибрано" — без прапора
    var $none = buildServerItem(NO_SERVER, Lampa.Lang.translate('bat_torserver_none'), null);
    $none.on('hover:enter', function () {
      Lampa.Storage.set(STORAGE_KEY, NO_SERVER);
      applySelectedServer(NO_SERVER);
      applySelection($list, NO_SERVER);
      updateCurrentLabel($modal, NO_SERVER);
      updateSelectedLabelInSettings();
    });
    $list.append($none);

    // Сервери з прапорами
    serversInfo.forEach(function(s) {
      var $item = buildServerItem(s.base, s.name, s.flag);
      $item.on('hover:enter', function () {
        Lampa.Storage.set(STORAGE_KEY, s.base);
        applySelectedServer(s.base);
        applySelection($list, s.base);
        updateCurrentLabel($modal, s.base);
        updateSelectedLabelInSettings();
      });
      $list.append($item);
    });

    applySelection($list, selected);

    var $btnCheck = $modal.find('.bat-torserver-modal__action');
    $btnCheck.on('hover:enter', function () {
      $list.find('.bat-torserver-modal__item').each(function () {
        var $it = $(this);
        var b = $it.data('base');
        if (b === NO_SERVER) {
          setItemStatus($it, COLOR_UNKNOWN, 'bat_status_unknown');
        } else {
          setItemStatus($it, '#f3d900', 'bat_status_checking');
        }
      });

      runHealthChecks().then(function(map) {
        $list.find('.bat-torserver-modal__item').each(function () {
          var $it = $(this);
          var b = $it.data('base');
          if (b === NO_SERVER) return;
          var st = map[b];
          if (st) setItemStatus($it, st.color, st.labelKey);
        });
        notifyDone();
      });
    });

    var first = $list.find('.bat-torserver-modal__item').first();

    Lampa.Modal.open({
      title: Lampa.Lang.translate('bat_torserver'),
      html: $modal,
      size: 'medium',
      scroll_to_center: true,
      select: first,
      onBack: function () {
        Lampa.Modal.close();
        Lampa.Controller.toggle('settings_component');
      }
    });

    $btnCheck.trigger('hover:enter');
  }

  function addSettingDynamically() {
    if (window.__bat_torserver_added__) return;
    window.__bat_torserver_added__ = true;

    console.log('[BAT-TS] Додаємо пункт з переміщенням на верх + жовтий колір');

    Lampa.SettingsApi.addParam({
      component: 'server',
      param: { name: 'bat_torserver_manage', type: 'button' },
      field: {
        name: Lampa.Lang.translate('bat_torserver'),
        description: Lampa.Lang.translate('bat_torserver_description'),
        default: "<div class='bat-torserver-selected' style='margin-top:0.35em;opacity:0.85'></div>"
      },
      onChange: openServerModal,
      onRender: function ($item) {
        setTimeout(function () {
          updateSelectedLabelInSettings();

          $item.find('.settings-param__name')
               .css('color', '#f3d900')
               .css('font-weight', 'bold');

          var $section = $item.closest('.settings__body, .settings-component');

          var $target = $section.find('[data-name="torrserv"], [data-name="torrserver_use"], [data-name="torrents_use"], [data-name*="use"]').first();

          if ($target.length) {
            $item.insertAfter($target);
            console.log('[BAT-TS] Пункт переміщено після "Використовувати TorServer"');
          } else {
            var $firstChild = $section.children('.settings-param').first();
            if ($firstChild.length) {
              $item.insertBefore($firstChild);
              console.log('[BAT-TS] Пункт переміщено на самий верх розділу');
            } else {
              $section.prepend($item);
              console.log('[BAT-TS] Пункт додано на початок (prepend)');
            }
          }

          $item.show();
        }, 400);
      }
    });
  }

  function tryAddWhenReady() {
    if (Lampa.Storage.field('torrserver_use') !== undefined) {
      addSettingDynamically();
    } else {
      setTimeout(tryAddWhenReady, 1500);
    }
  }

  function start() {
    translate();
    applySelectedServer(getSelectedBase());
    tryAddWhenReady();

    Lampa.Listener.follow('settings', function (e) {
      if (e.type === 'open' || e.type === 'ready') {
        tryAddWhenReady();
      }
    });
  }

  if (!window.plugin_bat_torserver_ready) {
    window.plugin_bat_torserver_ready = true;

    if (window.appready) start();
    else {
      Lampa.Listener.follow('app', function (e) {
        if (e.type === 'ready') start();
      });
    }
  }

})();
