// https://xyzlib.github.io/lampa-plugins/pr.js


(function () {
  "use strict";

  var manifest = {
    //id: 'com.example.myplugin',
    version: "0.0.1",
    author: "@xyzlib",
    name: "xyzlib->pr",
    description: "xyzlib:pr description",
    url: "https://xyzlib.github.io/lampa-plugins/pr.js",
    //icon: '',
  };

  function pluginXYZ() {
    var EXPIRE_PR = 1000 * 60 * 60 * 24 * 365;

    var originalOpen = XMLHttpRequest.prototype.open;
    var originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url) {
      this._url = url;
      return originalOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function (body) {
      if (this._url && this._url.includes("/users/")) {
        this.addEventListener("readystatechange", function () {
          // readyState 4 — запрос завершен
          if (this.readyState === 4) {
            try {
              //console.log(`[lampa-pr]: 1 [XHR Response] от ${this._url}:`, this.responseText);
              //console.log(`[lampa-pr]: 2 [XHR Response] от ${this._url}:`, this);

              var originalData = JSON.parse(this.responseText);
              //console.log(`[lampa-pr]: 3 [XHR Response] originalData:`, originalData);

              if (originalData && originalData.user) {
                originalData.user.premium = Date.now() + EXPIRE_PR;
              }
              var modifiedJSON = JSON.stringify(originalData);

              Object.defineProperty(this, "responseText", {
                get: () => modifiedJSON,
                configurable: true,
              });

              Object.defineProperty(this, "response", {
                get: () => modifiedJSON,
                configurable: true,
              });
            } catch (e) {
              console.error("[lampa-pr] Error:", e);
            }
          }
        });
      }

      return originalSend.apply(this, arguments);
    };

    Lampa.Account.updateUser();
  }

  function initializePlugin() {
    //Lampa.Manifest.plugins = manifest;

    var updateplugins = false;
    var plugins = Lampa.Storage.get("plugins", "[]");
    plugins.forEach(function (plug) {
      //console.log(manifest.name, "plug.url = " + plug.url);
      if (plug.url.indexOf("xyzlib.github.io") >= 0) {
        updateplugins = true;
        plug.author = manifest.author;
        plug.name = manifest.name;
        plug.version = manifest.version;
      }
    });
    if (updateplugins) {
      Lampa.Storage.set("plugins", plugins);
    }

    pluginXYZ();
  }

  function startPlugin() {
    //console.log(manifest.name, "Плагин запущен");
    window.plugin__xyzlib_pr = true;
    if (window.appready) {
      initializePlugin();
    } else {
      Lampa.Listener.follow("app", function (e) {
        if (e.type === "ready") {
          initializePlugin();
        }
      });
    }
  }

  if (!window.plugin__xyzlib_pr) {
    startPlugin();
  }
})();
