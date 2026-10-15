
(function () {
    'use strict';

    /*
     * @name MOB_INTERFACE
     * @version 3.0.1
     * @author Crowley24
     * @description Мобільний інтерфейс Lampa
     * @platforms Lampa | Mobile
     *
     * Зміни:
     * - CSS обмежений карткою фільму
     * - Plugin Manager не зачіпається
     * - захист від повторної ініціалізації
     * - оригінальний дизайн 3.0 збережено
     */

    if (window.MOB_INTERFACE_V301_READY) return;
    window.MOB_INTERFACE_V301_READY = true;

    var slideshowTimer = null;
    var pluginPath = 'https://crowley24.github.io/Icons/';
    var detailsCache = {};
    var currentActiveId = null;
    var started = false;

    var settings_list = [
        { id: 'mobile_interface_animation', default: true },
        { id: 'mobile_interface_ui_anim', default: true },
        { id: 'mobile_interface_ui_anim_effect', default: 'fluid' },
        { id: 'mobile_interface_badge_anim', default: 'pulse' },
        { id: 'mobile_interface_slideshow', default: true },
        { id: 'mobile_interface_slideshow_time', default: '10000' },
        { id: 'mobile_interface_slideshow_quality', default: 'w780' },
        { id: 'mobile_interface_logo_size_v2', default: '125' },
        { id: 'mobile_interface_logo_quality', default: 'w500' },
        { id: 'mobile_interface_show_tagline', default: true },
        { id: 'mobile_interface_blocks_gap', default: '8px' },
        { id: 'mobile_interface_ratings_size', default: '0.45em' },
        { id: 'mobile_interface_studios', default: true },
        { id: 'mobile_interface_quality', default: true }
    ];

    settings_list.forEach(function (opt) {
        if (Lampa.Storage.get(opt.id, 'unset') === 'unset') {
            Lampa.Storage.set(opt.id, opt.default);
        }
    });

    var eliteBadgesConfig = [
        {
            id: '4k-ultra-hd',
            pattern: /\b(4k|2160p|uhd|ultra\s*hd)\b/i,
            imageURL: 'https://raw.githubusercontent.com/leonevz/Elite-Badges/main/Badges/4k_ultra_hd.png',
            group: 'resolution',
            priority: 3
        },
        {
            id: '1080p-full-hd',
            pattern: /\b(1080p|fhd|full\s*hd)\b/i,
            imageURL: 'https://raw.githubusercontent.com/leonevz/Elite-Badges/main/Badges/1080p_full_hd.png',
            group: 'resolution',
            priority: 2
        },
        {
            id: '720p-hd',
            pattern: /\b720p\b/i,
            imageURL: 'https://raw.githubusercontent.com/leonevz/Elite-Badges/main/Badges/720p_hd.png',
            group: 'resolution',
            priority: 1
        },
        {
            id: 'dolby-vision',
            pattern: /\b(dolby\s*vision|dovi|dv)\b/i,
            imageURL: 'https://raw.githubusercontent.com/leonevz/Elite-Badges/main/Badges/dolby_vision.png'
        },
        {
            id: 'hdr',
            pattern: /\b(hdr10\+|hdr10\s*plus\b|hdr\s*10\s*\+|hdr10|hdr\s*10|hdr)\b/i,
            imageURL: 'https://raw.githubusercontent.com/leonevz/Elite-Badges/main/Badges/hdr.png',
            group: 'hdr'
        },
        {
            id: 'sdr',
            pattern: /\bsdr\b/i,
            imageURL: 'https://raw.githubusercontent.com/leonevz/Elite-Badges/main/Badges/SDR_transparent_4x.png'
        },
        {
            id: 'dolby-atmos',
            pattern: /\b(dolby\s*atmos|atmos)\b/i,
            imageURL: 'https://raw.githubusercontent.com/leonevz/Elite-Badges/main/Badges/dolby_atmos.png'
        },
        {
            id: 'truehd',
            pattern: /\b(truehd|true\s*hd|dolby\s*truehd)\b/i,
            imageURL: 'https://raw.githubusercontent.com/leonevz/Elite-Badges/main/Badges/truehd.png'
        },
        {
            id: 'dolby-digital-plus',
            pattern: /\b(ddp[\s._-]*[0-9][\s._-]*[0-9]|ddp|dd\+|dolby[\s._-]*digital[\s._-]*plus|e-?ac-?3)(?![a-z])/i,
            imageURL: 'https://raw.githubusercontent.com/leonevz/Elite-Badges/main/Badges/dolby_digital_plus.png'
        },
        {
            id: 'dolby-digital',
            pattern: /\b(dd[\s._-]*[0-9][\s._-]*[0-9]|dd|dolby[\s._-]*digital|ac-?3)(?![\s._-]*plus|\+|p|[a-z])/i,
            imageURL: 'https://raw.githubusercontent.com/leonevz/Elite-Badges/main/Badges/dolby_digital.png'
        },
        {
            id: 'dts-hd-master-audio',
            pattern: /\b(dts[\s._-]*hd[\s._-]*ma|dtshd\s*ma|dts[\s._-]*hd[\s._-]*master)\b/i,
            imageURL: 'https://raw.githubusercontent.com/leonevz/Elite-Badges/main/Badges/dts_hd_master_audio.png'
        },
        {
            id: 'dts-hd',
            pattern: /\b(dts[\s._-]*hd|dtshd)(?![\s._-]*(ma|master)|ma)\b/i,
            imageURL: 'https://raw.githubusercontent.com/leonevz/Elite-Badges/main/Badges/dts_hd.png'
        },
        {
            id: 'dts',
            pattern: /\bdts\b(?![\s._:-]*(x|hd))/i,
            imageURL: 'https://raw.githubusercontent.com/leonevz/Elite-Badges/main/Badges/dts.png'
        }
    ];

    var ratingIcons = {
        tmdb: 'https://upload.wikimedia.org/wikipedia/commons/8/89/Tmdb.new.logo.svg',
        cub: 'https://raw.githubusercontent.com/yumata/lampa/9381985ad4371d2a7d5eb5ca8e3daf0f32669eb7/img/logo-icon.svg'
    };

    function stopSlideshow() {
        if (slideshowTimer) {
            clearInterval(slideshowTimer);
            slideshowTimer = null;
        }

        if (window.mobileInterfaceBgInterval) {
            clearInterval(window.mobileInterfaceBgInterval);
            window.mobileInterfaceBgInterval = null;
        }
    }

    function isImageDark(imgSrc, callback) {
        var img = new Image();

        img.crossOrigin = 'Anonymous';

        img.onload = function () {
            try {
                var canvas = document.createElement('canvas');
                var ctx = canvas.getContext('2d');

                canvas.width = 40;
                canvas.height = 40;

                ctx.drawImage(img, 0, 0, 40, 40);

                var imgData = ctx.getImageData(0, 0, 40, 40);
                var data = imgData.data;

                var totalBrightness = 0;
                var hasColor = false;
                var count = 0;

                for (var i = 0; i < data.length; i += 4) {
                    var alpha = data[i + 3];

                    if (alpha > 50) {
                        var r = data[i];
                        var g = data[i + 1];
                        var b = data[i + 2];

                        var brightness =
                            (r * 299 + g * 587 + b * 114) / 1000;

                        totalBrightness += brightness;
                        count++;

                        if (
                            Math.max(r, g, b) -
                            Math.min(r, g, b) > 30
                        ) {
                            hasColor = true;
                        }
                    }
                }

                var avgBrightness = count > 0
                    ? totalBrightness / count
                    : 255;

                callback(avgBrightness < 110 && !hasColor);

            } catch (e) {
                callback(false);
            }
        };

        img.onerror = function () {
            callback(false);
        };

        img.src = imgSrc;
    }

    function applyStyles() {
        var style = document.getElementById(
            'mobile-interface-styles'
        );

        if (!style) {
            style = document.createElement('style');
            style.id = 'mobile-interface-styles';
            document.head.appendChild(style);
        }

        var isPosterAnim = Lampa.Storage.get(
            'mobile_interface_animation'
        );

        var isUIAnim = Lampa.Storage.get(
            'mobile_interface_ui_anim'
        );

        var animEffect = Lampa.Storage.get(
            'mobile_interface_ui_anim_effect',
            'fluid'
        );

        var badgeAnim = Lampa.Storage.get(
            'mobile_interface_badge_anim',
            'pulse'
        );

        var rSize = Lampa.Storage.get(
            'mobile_interface_ratings_size',
            '0.45em'
        );

        var lHeight = Lampa.Storage.get(
            'mobile_interface_logo_size_v2',
            '125'
        );

        var showTagline = Lampa.Storage.get(
            'mobile_interface_show_tagline'
        );

        var blocksGap = Lampa.Storage.get(
            'mobile_interface_blocks_gap',
            '8px'
        );

        var css = '';

        css += '@keyframes kenBurnsEffect {';
        css += '0% { transform: scale(1); }';
        css += '50% { transform: scale(1.08); }';
        css += '100% { transform: scale(1); }';
        css += '}';

        css += '@keyframes anim_fluid {';
        css += '0% { opacity: 0; transform: translate3d(0,25px,0) scale(0.95); filter: blur(10px); }';
        css += '100% { opacity: 1; transform: translate3d(0,0,0) scale(1); filter: blur(0); }';
        css += '}';

        css += '@keyframes anim_cyber {';
        css += '0% { opacity: 0; transform: translate3d(-40px,0,0) scale(0.9); filter: brightness(1.5); }';
        css += '100% { opacity: 1; transform: translate3d(0,0,0) scale(1); filter: brightness(1); }';
        css += '}';

        css += '@keyframes anim_cinematic {';
        css += '0% { opacity: 0; transform: translate3d(0,15px,0) scale(1.08); filter: blur(6px); }';
        css += '100% { opacity: 1; transform: translate3d(0,0,0) scale(1); filter: blur(0); }';
        css += '}';

        css += '@keyframes anim_elastic {';
        css += '0% { opacity: 0; transform: scale(0.7); }';
        css += '70% { opacity: 1; transform: scale(1.04); }';
        css += '100% { opacity: 1; transform: scale(1); }';
        css += '}';

        css += '@keyframes anim_minimal {';
        css += '0% { opacity: 0; transform: translate3d(0,10px,0); }';
        css += '100% { opacity: 1; transform: translate3d(0,0,0); }';
        css += '}';

        css += '@keyframes wave_cascade {';
        css += '0% { opacity: 0; transform: scale(0.5) translateY(10px); filter: blur(4px); }';
        css += '100% { opacity: 1; transform: scale(1) translateY(0); filter: blur(0); }';
        css += '}';

        css += '@keyframes badge_anim_pulse {';
        css += '0%,100% { transform: scale(1); }';
        css += '50% { transform: scale(1.1); }';
        css += '}';

        css += '@keyframes badge_anim_breathe {';
        css += '0%,100% { transform: scale(1); opacity: 0.85; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3)); }';
        css += '50% { transform: scale(1.06); opacity: 1; filter: drop-shadow(0 0 10px rgba(255,255,255,0.6)); }';
        css += '}';

        css += '@keyframes badge_anim_spin_slow {';
        css += '0% { transform: rotate(0deg); }';
        css += '25% { transform: rotate(4deg); }';
        css += '75% { transform: rotate(-4deg); }';
        css += '100% { transform: rotate(0deg); }';
        css += '}';

        css += '@keyframes badge_anim_float {';
        css += '0%,100% { transform: translateY(0); }';
        css += '50% { transform: translateY(-4px); }';
        css += '}';

        css += '@keyframes poster_fade_in {';
        css += '0% { opacity: 0; transform: scale(1.05); }';
        css += '100% { opacity: 1; transform: scale(1); }';
        css += '}';

        css += '@media screen and (max-width:480px) {';

        /*
         * ВАЖЛИВО:
         * Усі правила приховування обмежені
         * виключно карткою .full-start-new.
         *
         * Plugin Manager більше не зачіпаємо.
         */

        css += '.full-start-new .full-start__reactions,';
        css += '.full-start-new [class*="reactions"] {';
        css += 'display:none!important;';
        css += '}';

        css += '.full-start-new .full-start-new__details,';
        css += '.full-start-new .full-start__info,';
        css += '.full-start-new .full-start__age,';
        css += '.full-start-new .full-start-new__age,';
        css += '.full-start-new .full-start__status,';
        css += '.full-start-new .full-start-new__status,';
        css += '.full-start-new [class*="age"],';
        css += '.full-start-new [class*="pg"],';
        css += '.full-start-new [class*="rating-count"],';
        css += '.full-start-new [class*="status"] {';
        css += 'display:none!important;';
        css += '}';

        /*
         * Оригінальне приховування першого блоку.
         * Обмежено безпосередньою областю картки.
         */

        css += '.full-start-new .full-start-new__right > div:first-child {';
        css += 'display:none!important;';
        css += '}';

        css += '.full-start-new .rate--tmdb,';
        css += '.full-start-new .rate--imdb,';
        css += '.full-start-new .rate--kp,';
        css += '.full-start-new .full-start__rates {';
        css += 'display:none!important;';
        css += '}';

        /*
         * Фон обмежено карткою.
         * Глобальний .background не змінюємо.
         */

        css += '.full-start-new {';
        css += 'position:relative!important;';
        css += '}';

        css += '.full-start-new__poster {';
        css += 'position:relative!important;';
        css += 'overflow:hidden!important;';
        css += 'background:#000;';
        css += 'z-index:1;';
        css += 'height:62vh!important;';

        if (isUIAnim) {
            css += 'animation:poster_fade_in 0.9s cubic-bezier(0.16,1,0.3,1) forwards;';
        }

        css += '}';

        css += '.full-start-new__poster img {';
        css += 'filter:none!important;';

        if (isPosterAnim) {
            css += 'animation:kenBurnsEffect 25s ease-in-out infinite!important;';
        }

        css += 'transform-origin:center center!important;';
        css += 'transition:opacity 1.2s ease-in-out!important;';
        css += 'position:absolute;';
        css += 'top:0;';
        css += 'left:0;';
        css += 'width:100%;';
        css += 'height:100%;';
        css += 'object-fit:cover;';
        css += 'mask-image:linear-gradient(to bottom,#000 0%,#000 55%,transparent 100%)!important;';
        css += '-webkit-mask-image:linear-gradient(to bottom,#000 0%,#000 55%,transparent 100%)!important;';
        css += '}';

        css += '.full-start-new__right {';
        css += 'background:none!important;';
        css += 'margin-top:-160px!important;';
        css += 'z-index:2!important;';
        css += 'display:flex!important;';
        css += 'flex-direction:column!important;';
        css += 'align-items:center!important;';
        css += 'padding:0 10px!important;';
        css += 'gap:' + blocksGap + '!important;';
        css += 'position:relative!important;';
        css += '}';

        var chosenAnimName = 'anim_' + animEffect;

        var animTiming = animEffect === 'elastic'
            ? 'cubic-bezier(0.34,1.56,0.64,1)'
            : 'cubic-bezier(0.16,1,0.3,1)';

        var uiAnimClass = isUIAnim
            ? 'animation:' + chosenAnimName +
              ' 0.8s ' + animTiming +
              ' forwards;opacity:0;' +
              'will-change:transform,opacity,filter;' +
              'transform:translateZ(0);'
            : '';

        css += '.full-start-new .quality-row-inline {';
        css += 'position:absolute;';
        css += 'top:30px;';
        css += 'right:12px;';
        css += 'z-index:99;';
        css += 'display:flex;';
        css += 'flex-direction:column;';
        css += 'align-items:flex-end;';
        css += 'gap:4px;';
        css += 'pointer-events:none;';
        css += '}';

        css += '.full-start-new .studio-header-brand {';
        css += uiAnimClass;
        css += 'animation-delay:0.08s;';
        css += 'order:1;';
        css += 'width:100%;';
        css += 'display:flex;';
        css += 'justify-content:flex-start;';
        css += 'align-items:center;';
        css += 'padding-left:5vw;';
        css += 'margin-bottom:-2px!important;';
        css += '}';

        css += '.full-start-new .studio-header-brand img {';
        css += 'height:18px!important;';
        css += 'width:auto;';
        css += 'max-width:110px;';
        css += 'object-fit:contain;';
        css += 'filter:drop-shadow(0 2px 5px rgba(0,0,0,0.9));';
        css += 'opacity:0.95;';
        css += '}';

        css += '.full-start-new .studio-header-brand img.is-dark-logo {';
        css += 'filter:brightness(0) invert(1) drop-shadow(0 2px 4px rgba(0,0,0,0.8))!important;';
        css += '}';

        css += '.full-start-new .full-start-new__title {';
        css += uiAnimClass;
        css += 'animation-delay:0.15s;';
        css += 'width:100%!important;';
        css += 'display:flex!important;';
        css += 'justify-content:center!important;';
        css += 'align-items:center!important;';
        css += 'margin:0!important;';
        css += 'min-height:50px;';
        css += 'order:2;';
        css += 'overflow:visible!important;';
        css += '}';

        css += '.full-start-new .full-start-new__title img {';
        css += 'height:auto!important;';
        css += 'max-height:' + lHeight + 'px!important;';
        css += 'width:auto!important;';
        css += 'max-width:90vw!important;';
        css += 'object-fit:contain!important;';
        css += 'filter:drop-shadow(0 4px 20px rgba(0,0,0,0.9));';
        css += 'margin:0!important;';
        css += '}';

        css += '.full-start-new .full-start-new__tagline {';
        css += uiAnimClass;
        css += 'animation-delay:0.22s;';
        css += 'display:' + (showTagline ? 'block' : 'none') + '!important;';
        css += 'font-style:italic!important;';
        css += 'font-size:0.9em!important;';
        css += 'margin:0!important;';
        css += 'color:rgba(255,255,255,0.8)!important;';
        css += 'text-align:center!important;';
        css += 'order:3;';
        css += '}';

        css += '.full-start-new .plugin-meta-row {';
        css += uiAnimClass;
        css += 'animation-delay:0.28s;';
        css += 'display:flex;';
        css += 'justify-content:center;';
        css += 'align-items:center;';
        css += 'flex-wrap:nowrap;';
        css += 'gap:8px;';
        css += 'margin:0!important;';
        css += 'font-size:calc(' + rSize + ' * 2.5);';
        css += 'width:100%;';
        css += 'order:4;';
        css += 'color:rgba(255,255,255,0.85);';
        css += 'font-family:Inter,-apple-system,system-ui,sans-serif;';
        css += '}';

        var loopAnimName = badgeAnim !== 'none'
            ? 'badge_anim_' + badgeAnim
            : '';

        var loopDuration = badgeAnim === 'spin_slow'
            ? '4s'
            : (badgeAnim === 'breathe' ? '3s' : '2.5s');

        css += '.full-start-new .wave-item {';
        css += 'transform-origin:center center;';
        css += 'filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));';

        if (isUIAnim) {
            css += 'opacity:0;';
            css += 'animation:wave_cascade 0.5s cubic-bezier(0.16,1,0.3,1) forwards';

            if (badgeAnim !== 'none') {
                css += ',' + loopAnimName + ' ' +
                    loopDuration + ' ease-in-out infinite';

                css += ';animation-delay:';
                css += 'calc(0.35s + (var(--item-index) * 0.08s)),';
                css += 'calc(1s + (var(--item-index) * 0.15s))';
            } else {
                css += ';animation-delay:';
                css += 'calc(0.35s + (var(--item-index) * 0.08s))';
            }

            css += ';will-change:transform,opacity,filter;';
        } else if (badgeAnim !== 'none') {
            css += 'animation:' + loopAnimName + ' ' +
                loopDuration + ' ease-in-out infinite;';
            css += 'animation-delay:calc(var(--item-index) * 0.15s);';
        }

        css += '}';

        css += '.full-start-new .quality-row-inline .plugin-rating-item {';
        css += 'display:flex;';
        css += 'align-items:center;';
        css += 'gap:4px;';
        css += 'font-weight:700;';
        css += 'color:#fff;';
        css += 'font-size:0.95em;';
        css += 'padding:2px 0;';
        css += '}';

        css += '.full-start-new .quality-row-inline .plugin-rating-item img {';
        css += 'height:1em;';
        css += 'width:auto;';
        css += '}';

        css += '.full-start-new .quality-item {';
        css += 'transform-origin:center center;';
        css += 'filter:drop-shadow(0 2px 5px rgba(0,0,0,0.8));';
        css += 'height:1.15em;';
        css += 'display:flex;';
        css += 'align-items:center;';
        css += 'justify-content:flex-end;';

        if (isUIAnim) {
            css += 'opacity:0;';
            css += 'animation:wave_cascade 0.5s cubic-bezier(0.16,1,0.3,1) forwards';

            if (badgeAnim !== 'none') {
                css += ',' + loopAnimName + ' ' +
                    loopDuration + ' ease-in-out infinite';

                css += ';animation-delay:';
                css += 'calc(0.35s + (var(--item-index) * 0.08s)),';
                css += 'calc(1s + (var(--item-index) * 0.15s))';
            } else {
                css += ';animation-delay:';
                css += 'calc(0.35s + (var(--item-index) * 0.08s))';
            }

            css += ';will-change:transform,opacity,filter;';
        } else if (badgeAnim !== 'none') {
            css += 'animation:' + loopAnimName + ' ' +
                loopDuration + ' ease-in-out infinite;';
            css += 'animation-delay:calc(var(--item-index) * 0.15s);';
        }

        css += '}';

        css += '.full-start-new .quality-item img {';
        css += 'height:100%;';
        css += 'width:auto;';
        css += 'max-width:60px;';
        css += 'object-fit:contain;';
        css += '}';

        css += '.full-start-new .info-text-item {';
        css += 'opacity:0.9;';
        css += 'font-weight:500;';
        css += 'font-size:0.85em;';
        css += 'white-space:nowrap;';
        css += '}';

        css += '.full-start-new .info-separator {';
        css += 'opacity:0.35;';
        css += 'font-size:0.8em;';
        css += 'margin:0 -2px;';
        css += '}';

        css += '.full-start-new .full-start-new__buttons {';
        css += uiAnimClass;
        css += 'animation-delay:0.42s;';
        css += 'display:flex!important;';
        css += 'justify-content:space-around!important;';
        css += 'align-items:center!important;';
        css += 'width:100%!important;';
        css += 'max-width:100%!important;';
        css += 'padding:0 4px!important;';
        css += 'box-sizing:border-box!important;';
        css += 'margin-top:4px!important;';
        css += 'order:6;';
        css += '}';

        css += '.full-start-new .full-start__button {';
        css += 'background:none!important;';
        css += 'border:none!important;';
        css += 'box-shadow:none!important;';
        css += 'display:flex!important;';
        css += 'flex-direction:column!important;';
        css += 'align-items:center!important;';
        css += 'width:42px!important;';
        css += 'min-width:36px!important;';
        css += 'padding:0!important;';
        css += 'transition:transform 0.2s ease,opacity 0.2s ease;';
        css += '}';

        css += '.full-start-new .full-start__button:active {';
        css += 'transform:scale(0.9);';
        css += 'opacity:0.7;';
        css += '}';

        css += '.full-start-new .full-start__button svg,';
        css += '.full-start-new .full-start__button img {';
        css += 'width:24px!important;';
        css += 'height:24px!important;';
        css += 'margin-bottom:4px!important;';
        css += 'fill:#fff!important;';
        css += 'filter:drop-shadow(0 2px 8px rgba(0,0,0,0.5));';
        css += '}';

        css += '.full-start-new .full-start__button span {';
        css += 'font-size:9px!important;';
        css += 'text-transform:uppercase!important;';
        css += 'opacity:0.75!important;';
        css += 'font-weight:600;';
        css += 'letter-spacing:0.05em;';
        css += '}';

        css += '}';

        style.textContent = css;
    }

    function getRatingColor(val) {
        var n = parseFloat(val);

        if (n >= 7.5) return '#2ecc71';
        if (n >= 6) return '#feca57';
        if (n > 0) return '#ff4d4d';

        return '#fff';
    }

    function formatTime(mins) {
        if (!mins) return '';

        var h = Math.floor(mins / 60);
        var m = mins % 60;

        return (h > 0 ? h + 'г ' : '') + m + 'хв';
    }

    function getCubRating(e) {
        if (!e.data || !e.data.reactions ||
            !e.data.reactions.result) {
            return null;
        }

        var reactionCoef = {
            fire: 10,
            nice: 7.5,
            think: 5,
            bore: 2.5,
            shit: 0
        };

        var sum = 0;
        var cnt = 0;

        e.data.reactions.result.forEach(function (r) {
            if (r.counter) {
                sum += r.counter * reactionCoef[r.type];
                cnt += r.counter;
            }
        });

        if (cnt >= 5) {
            var isTv = e.object.method === 'tv';
            var avg = isTv ? 7.4 : 6.5;
            var m = isTv ? 50 : 150;

            return (
                (avg * m + sum) / (m + cnt)
            ).toFixed(1);
        }

        return null;
    }

    function renderMeta(container, e) {
        container.find('.plugin-meta-row').remove();

        var sep = '<span class="info-separator">•</span>';
        var $metaRow = $('<div class="plugin-meta-row"></div>');

        var year = (
            e.data.movie.release_date ||
            e.data.movie.first_air_date ||
            ''
        ).substring(0, 4);

        if (year) {
            $metaRow.append(
                '<div class="info-text-item">' +
                year +
                '</div>'
            );
        }

        var country = '';

        if (
            e.data.movie.production_countries &&
            e.data.movie.production_countries.length > 0
        ) {
            country =
                e.data.movie.production_countries[0].name ||
                e.data.movie.production_countries[0].iso_3166_1;
        } else if (
            e.data.movie.origin_country &&
            e.data.movie.origin_country.length > 0
        ) {
            country = e.data.movie.origin_country[0];
        }

        if (country) {
            if ($metaRow.children().length > 0) {
                $metaRow.append(sep);
            }

            $metaRow.append(
                '<div class="info-text-item">' +
                country +
                '</div>'
            );
        }

        var runtime =
            e.data.movie.runtime ||
            (
                e.data.movie.episode_run_time
                    ? e.data.movie.episode_run_time[0]
                    : 0
            );

        if (runtime) {
            if ($metaRow.children().length > 0) {
                $metaRow.append(sep);
            }

            $metaRow.append(
                '<div class="info-text-item">' +
                formatTime(runtime) +
                '</div>'
            );
        }

        if (
            e.data.movie.genres &&
            e.data.movie.genres.length > 0
        ) {
            if ($metaRow.children().length > 0) {
                $metaRow.append(sep);
            }

            var genres = e.data.movie.genres
                .slice(0, 2)
                .map(function (g) {
                    return g.name;
                })
                .join(', ');

            $metaRow.append(
                '<div class="info-text-item">' +
                genres +
                '</div>'
            );
        }

        container.append($metaRow);
    }

    function applyMovieDetailsData(data, movie, $render) {
        if (
            data.images &&
            data.images.logos &&
            data.images.logos.length > 0
        ) {
            var lang = Lampa.Storage.get('language') || 'uk';

            var logo = data.images.logos.filter(function (l) {
                return l.iso_639_1 === lang;
            })[0] || data.images.logos.filter(function (l) {
                return l.iso_639_1 === 'en';
            })[0] || data.images.logos[0];

            if (logo) {
                var logoUrl = Lampa.TMDB.image(
                    '/t/p/' +
                    Lampa.Storage.get(
                        'mobile_interface_logo_quality',
                        'w500'
                    ) +
                    logo.file_path.replace('.svg', '.png')
                );

                $render.find('.full-start-new__title')
                    .html('<img src="' + logoUrl + '">');
            }
        }

        if (Lampa.Storage.get('mobile_interface_studios')) {
            $render.find('.studio-header-brand').remove();

            var studio = null;

            if (data.networks && data.networks.length > 0) {
                studio = data.networks.find(function (n) {
                    return n.logo_path;
                });
            }

            if (
                !studio &&
                data.production_companies &&
                data.production_companies.length > 0
            ) {
                studio = data.production_companies.find(
                    function (c) {
                        return c.logo_path;
                    }
                );
            }

            if (studio && studio.logo_path) {
                var studioLogoUrl = Lampa.TMDB.image(
                    '/t/p/w200' + studio.logo_path
                );

                var $brand = $(
                    '<div class="studio-header-brand">' +
                    '<img src="' + studioLogoUrl +
                    '" alt="' + (studio.name || '') +
                    '"></div>'
                );

                var $img = $brand.find('img');

                $img.on('error', function () {
                    $brand.remove();
                });

                isImageDark(studioLogoUrl, function (isDark) {
                    if (isDark) {
                        $img.addClass('is-dark-logo');
                    }
                });

                $render.find('.full-start-new__title')
                    .before($brand);
            }
        }

        if (data.images && data.images.backdrops) {
            var backdrops = data.images.backdrops.filter(
                function (elem) {
                    return elem.aspect_ratio > 1.5 &&
                        (
                            !elem.iso_639_1 ||
                            elem.iso_639_1 === 'xx'
                        );
                }
            );

            if (backdrops.length === 0) {
                backdrops = data.images.backdrops.filter(
                    function (elem) {
                        return elem.aspect_ratio > 1.5;
                    }
                );
            }

            if (backdrops.length > 0) {
                backdrops.sort(function (a, b) {
                    return (
                        b.vote_average || 0
                    ) - (
                        a.vote_average || 0
                    );
                });

                startPosterSlideshow(
                    $render.find('.full-start-new__poster'),
                    backdrops.slice(0, 15)
                );
            }
        }
    }

    function loadMovieDetails(movie, $render) {
        var movieId = movie.id;

        currentActiveId = movieId;

        if (detailsCache[movieId]) {
            applyMovieDetailsData(
                detailsCache[movieId],
                movie,
                $render
            );
            return;
        }

        var type = (
            movie.name ||
            movie.first_air_date
        ) ? 'tv' : 'movie';

        var url =
            'https://api.themoviedb.org/3/' +
            type + '/' + movieId +
            '?api_key=' + Lampa.TMDB.key() +
            '&append_to_response=images' +
            '&include_image_language=uk,en,null';

        $.ajax({
            url: url,
            type: 'GET',
            dataType: 'json',

            success: function (data) {
                if (currentActiveId !== movieId) {
                    return;
                }

                detailsCache[movieId] = data;

                applyMovieDetailsData(
                    data,
                    movie,
                    $render
                );
            }
        });
    }

    function getEliteBadges(results) {
        var foundBadges = [];

        if (!results) return foundBadges;

        var combinedText = '';

        results.slice(0, 15).forEach(function (item) {
            combinedText += ' ' +
                (item.Title || item.title || '');
        });

        var matchedBadges = [];

        eliteBadgesConfig.forEach(function (badge) {
            if (
                badge.pattern &&
                badge.pattern.test(combinedText)
            ) {
                matchedBadges.push(badge);
            }
        });

        var highestResolution = null;

        matchedBadges.forEach(function (b) {
            if (b.group === 'resolution') {
                if (
                    !highestResolution ||
                    b.priority > highestResolution.priority
                ) {
                    highestResolution = b;
                }
            }
        });

        matchedBadges.forEach(function (badge) {
            if (
                badge.group !== 'resolution' ||
                badge.id === highestResolution.id
            ) {
                foundBadges.push(badge.imageURL);
            }
        });

        var hasUkr = /ukr|укр/i.test(combinedText);
        var hasDub = /dub|дуб/i.test(combinedText);

        if (hasUkr) {
            foundBadges.push(pluginPath + 'UKR.svg');
        }

        if (hasDub) {
            foundBadges.push(pluginPath + 'DUB.svg');
        }

        return foundBadges.filter(function (elem, pos, arr) {
            return arr.indexOf(elem) === pos;
        });
    }

    function startPosterSlideshow($poster, items) {
        if (!Lampa.Storage.get('mobile_interface_slideshow')) {
            return;
        }

        var index = 0;

        stopSlideshow();

        var intervalTime = parseInt(
            Lampa.Storage.get(
                'mobile_interface_slideshow_time',
                '10000'
            ),
            10
        );

        slideshowTimer = setInterval(function () {
            if (
                !$poster ||
                $poster.length === 0 ||
                !document.body.contains($poster[0])
            ) {
                stopSlideshow();
                return;
            }

            index = (index + 1) % items.length;

            var imgUrl = Lampa.TMDB.image(
                '/t/p/' +
                Lampa.Storage.get(
                    'mobile_interface_slideshow_quality',
                    'w780'
                ) +
                items[index].file_path
            );

            var $current = $poster.find('img').first();
            var nextImg = new Image();

            nextImg.onload = function () {
                var $next = $(
                    '<img src="' + imgUrl +
                    '" style="opacity:0;transition:opacity 1.2s ease-in-out;">'
                );

                $poster.append($next);

                setTimeout(function () {
                    $next.css('opacity', '1');
                    $current.css('opacity', '0');

                    setTimeout(function () {
                        if ($current && $current.length) {
                            $current.remove();
                        }
                    }, 1200);
                }, 100);
            };

            nextImg.src = imgUrl;
        }, intervalTime);

        window.mobileInterfaceBgInterval = slideshowTimer;
    }

    function init() {
        Lampa.Listener.follow('full', function (e) {
            if (
                e.type === 'destroy' ||
                e.type === 'onBeforeDestroy'
            ) {
                stopSlideshow();
                currentActiveId = null;
            }

            if (
                window.innerWidth <= 480 &&
                (
                    e.type === 'complite' ||
                    e.type === 'complete'
                )
            ) {
                stopSlideshow();

                if (
                    !e.data ||
                    !e.data.movie ||
                    !e.object ||
                    !e.object.activity
                ) {
                    return;
                }

                var movie = e.data.movie;
                var $render = e.object.activity.render();

                if (!$render || !$render.length) {
                    return;
                }

                if (window.lampa_settings) {
                    window.lampa_settings.blur_poster = false;
                }

                renderMeta(
                    $render.find('.full-start-new__right'),
                    e
                );

                loadMovieDetails(movie, $render);

                var $mainContainer = $render.find(
                    '.full-start-new'
                );

                if ($mainContainer.length === 0) {
                    $mainContainer = $render;
                }

                $mainContainer.find(
                    '.quality-row-inline'
                ).remove();

                var $qRow = $(
                    '<div class="quality-row-inline"></div>'
                );

                $mainContainer.append($qRow);

                var globalIndex = 0;

                var tmdb = parseFloat(
                    e.data.movie.vote_average || 0
                ).toFixed(1);

                if (tmdb > 0) {
                    var $tmdbItem = $(
                        '<div class="plugin-rating-item wave-item">' +
                        '<img src="' + ratingIcons.tmdb + '">' +
                        '<span style="color:' +
                        getRatingColor(tmdb) + '">' +
                        tmdb +
                        '</span></div>'
                    );

                    $tmdbItem.css(
                        '--item-index',
                        globalIndex++
                    );

                    $qRow.append($tmdbItem);
                }

                var cub = getCubRating(e);

                if (cub) {
                    var $cubItem = $(
                        '<div class="plugin-rating-item wave-item">' +
                        '<img src="' + ratingIcons.cub + '">' +
                        '<span style="color:' +
                        getRatingColor(cub) + '">' +
                        cub +
                        '</span></div>'
                    );

                    $cubItem.css(
                        '--item-index',
                        globalIndex++
                    );

                    $qRow.append($cubItem);
                }

                if (
                    Lampa.Storage.get('mobile_interface_quality') &&
                    Lampa.Parser &&
                    Lampa.Parser.get
                ) {
                    Lampa.Parser.get({
                        search: movie.title || movie.name,
                        movie: movie,
                        page: 1
                    }, function (res) {
                        if (
                            res &&
                            Array.isArray(res.Results)
                        ) {
                            var eliteBadgesList =
                                getEliteBadges(res.Results);

                            eliteBadgesList.forEach(
                                function (imgUrl) {
                                    var $badge = $(
                                        '<div class="quality-item wave-item">' +
                                        '<img src="' + imgUrl + '">' +
                                        '</div>'
                                    );

                                    $badge.css(
                                        '--item-index',
                                        globalIndex++
                                    );

                                    $qRow.append($badge);
                                }
                            );
                        }
                    });
                }
            }
        });
    }

    function setupSettings() {
        Lampa.SettingsApi.addComponent({
            component: 'mobile_interface',
            name: 'Мобільний інтерфейс',
            icon: '<svg height="36" viewBox="0 0 24 24" width="36" xmlns="http://www.w3.org/2000/svg"><path d="M17 1.01L7 1c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99zM17 19H7V5h10v14z" fill="white"/></svg>'
        });

        Lampa.SettingsApi.addParam({
            component: 'mobile_interface',
            param: {
                name: 'mobile_interface_animation',
                type: 'trigger',
                default: true
            },
            field: {
                name: 'Зум-ефект постера (Ken Burns)'
            },
            onChange: applyStyles
        });

        Lampa.SettingsApi.addParam({
            component: 'mobile_interface',
            param: {
                name: 'mobile_interface_ui_anim',
                type: 'trigger',
                default: true
            },
            field: {
                name: 'Плавна анімація появи елементів'
            },
            onChange: applyStyles
        });

        Lampa.SettingsApi.addParam({
            component: 'mobile_interface',
            param: {
                name: 'mobile_interface_ui_anim_effect',
                type: 'select',
                values: {
                    fluid: 'Apple Fluid',
                    cyber: 'Cyber Neon',
                    cinematic: 'Cinematic Depth',
                    elastic: 'Elastic Spring',
                    minimal: 'Minimal Fade'
                },
                default: 'fluid'
            },
            field: {
                name: 'Стиль анімації появи'
            },
            onChange: applyStyles
        });

        Lampa.SettingsApi.addParam({
            component: 'mobile_interface',
            param: {
                name: 'mobile_interface_badge_anim',
                type: 'select',
                values: {
                    none: 'Без анімації',
                    pulse: 'Пульсація',
                    breathe: 'Дихання',
                    spin_slow: 'Гойдання',
                    float: 'Підстрибування'
                },
                default: 'pulse'
            },
            field: {
                name: 'Анімація бейджів'
            },
            onChange: applyStyles
        });

        Lampa.SettingsApi.addParam({
            component: 'mobile_interface',
            param: {
                name: 'mobile_interface_slideshow',
                type: 'trigger',
                default: true
            },
            field: {
                name: 'Автозміна фонових кадрів'
            }
        });

        Lampa.SettingsApi.addParam({
            component: 'mobile_interface',
            param: {
                name: 'mobile_interface_slideshow_time',
                type: 'select',
                values: {
                    '10000': '10 сек',
                    '15000': '15 сек',
                    '20000': '20 сек'
                },
                default: '10000'
            },
            field: {
                name: 'Інтервал зміни фону'
            }
        });

        Lampa.SettingsApi.addParam({
            component: 'mobile_interface',
            param: {
                name: 'mobile_interface_logo_size_v2',
                type: 'select',
                values: {
                    '125': 'Малий',
                    '150': 'Середній',
                    '180': 'Стандартний',
                    '210': 'Великий'
                },
                default: '125'
            },
            field: {
                name: 'Висота логотипу тайтлу'
            },
            onChange: applyStyles
        });

        Lampa.SettingsApi.addParam({
            component: 'mobile_interface',
            param: {
                name: 'mobile_interface_show_tagline',
                type: 'trigger',
                default: true
            },
            field: {
                name: 'Відображати слоган'
            },
            onChange: applyStyles
        });

        Lampa.SettingsApi.addParam({
            component: 'mobile_interface',
            param: {
                name: 'mobile_interface_blocks_gap',
                type: 'select',
                values: {
                    '8px': 'Компактний',
                    '12px': 'Стандартний',
                    '18px': 'Просторий',
                    '24px': 'Панорамний'
                },
                default: '8px'
            },
            field: {
                name: 'Відступи між блоками'
            },
            onChange: applyStyles
        });

        Lampa.SettingsApi.addParam({
            component: 'mobile_interface',
            param: {
                name: 'mobile_interface_ratings_size',
                type: 'select',
                values: {
                    '0.4em': 'Дрібний',
                    '0.45em': 'Звичайний',
                    '0.5em': 'Великий',
                    '0.55em': 'Дуже великий'
                },
                default: '0.45em'
            },
            field: {
                name: 'Розмір шрифту інфо-блоків'
            },
            onChange: applyStyles
        });

        Lampa.SettingsApi.addParam({
            component: 'mobile_interface',
            param: {
                name: 'mobile_interface_studios',
                type: 'trigger',
                default: true
            },
            field: {
                name: 'Показувати логотип студії'
            }
        });

        Lampa.SettingsApi.addParam({
            component: 'mobile_interface',
            param: {
                name: 'mobile_interface_quality',
                type: 'trigger',
                default: true
            },
            field: {
                name: 'Бейджі якості та звуку'
            }
        });
    }

    function startPlugin() {
        if (started) return;
        started = true;

        applyStyles();
        setupSettings();
        init();

        console.log(
            '[MOB_INTERFACE] 3.0.1 initialized'
        );
    }

    if (window.appready) {
        startPlugin();
    } else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') {
                startPlugin();
            }
        });
    }

})();
