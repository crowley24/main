(function () {
    'use strict';

    /*
     * @name MOB_INTERFACE
     * @version 3.1.2
     * @author Crowley24
     * @description Minimal Cinematic Premium Mobile Interface
     * @platforms Lampa | Mobile
     *
     * 3.1.2 CHANGES:
     * - Removed duplicate year/country above movie logo
     * - Preserved year/country in metadata row
     * - Minimal transparent metadata design
     * - Removed metadata glass panel, background and border
     * - Thin elegant metadata separators
     * - Minimal transparent buttons
     * - Removed button backgrounds, borders and heavy shadows
     * - Subtle button press animation
     * - Improved logo shadows and glow
     * - Refined tagline typography
     * - Improved poster gradients
     * - Improved animations
     * - Age rating completely hidden
     * - No custom badges or custom ratings
     * - Native Lampa ratings preserved
     * - TMDB cache and async request protection
     * - Safe slideshow timer management
     */

    if (window.MOB_INTERFACE_V312_READY) return;
    window.MOB_INTERFACE_V312_READY = true;

    var slideshowTimer = null;
    var detailsCache = {};
    var currentActiveId = null;
    var activeRenderToken = 0;
    var started = false;

    var settings_list = [
        { id: 'mobile_interface_animation', default: true },
        { id: 'mobile_interface_ui_anim', default: true },
        { id: 'mobile_interface_ui_anim_effect', default: 'cinematic' },
        { id: 'mobile_interface_slideshow', default: true },
        { id: 'mobile_interface_slideshow_time', default: '10000' },
        { id: 'mobile_interface_slideshow_quality', default: 'w780' },
        { id: 'mobile_interface_logo_size_v2', default: '125' },
        { id: 'mobile_interface_logo_quality', default: 'w500' },
        { id: 'mobile_interface_show_tagline', default: true },
        { id: 'mobile_interface_blocks_gap', default: '8px' },
        { id: 'mobile_interface_ratings_size', default: '0.45em' },
        { id: 'mobile_interface_studios', default: true }
    ];

    settings_list.forEach(function (opt) {
        if (Lampa.Storage.get(opt.id, 'unset') === 'unset') {
            Lampa.Storage.set(opt.id, opt.default);
        }
    });

    function stopSlideshow() {
        if (slideshowTimer) {
            clearInterval(slideshowTimer);
            slideshowTimer = null;
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

    /*
     * DUPLICATE HEADER METADATA CLEANUP
     */

    function hideDuplicateHeaderMetadata($render) {
        if (!$render || !$render.length) return;

        var $right = $render.find('.full-start-new__right').first();

        if (!$right.length) return;

        var root = $right[0];

        var title = $right.find('.full-start-new__title').first()[0];

        if (!title) return;

        var protectedSelector = [
            '.full-start-new__title',
            '.full-start-new__tagline',
            '.full-start-new__buttons',
            '.studio-header-brand',
            '.plugin-meta-row',
            '.full-start__rates',
            '.full-start__button',
            'button',
            'a',
            'input',
            'img',
            'video',
            'svg'
        ].join(',');

        function isProtected(element) {
            if (!element || element === root) return true;

            if (element.matches && element.matches(protectedSelector)) {
                return true;
            }

            if (element.querySelector && element.querySelector(protectedSelector)) {
                return true;
            }

            return false;
        }

        function isYearCountryLine(element) {
            if (!element) return false;

            var text = String(element.textContent || '')
                .replace(/\s+/g, ' ')
                .trim();

            if (!text || text.length > 90) return false;

            var yearMatch = text.match(/\b(?:19|20)\d{2}\b/);

            if (!yearMatch) return false;

            var remaining = text
                .replace(/\b(?:19|20)\d{2}\b/g, '')
                .replace(/[•·|,;:\/\-–—()[\]]/g, '')
                .replace(/\s+/g, '')
                .trim();

            return /[\p{L}]/u.test(remaining);
        }

        var candidates = [];
        var elements = root.querySelectorAll('*');

        for (var i = 0; i < elements.length; i++) {
            var element = elements[i];

            if (
                element.classList.contains('mi312-header-meta-hidden') ||
                isProtected(element)
            ) {
                continue;
            }

            if (!isYearCountryLine(element)) continue;

            var position = element.compareDocumentPosition(title);

            var beforeTitle = !!(position & 4);

            if (!beforeTitle) continue;

            candidates.push(element);
        }

        candidates.forEach(function (element) {
            if (!element.parentElement) return;

            var target = element;
            var current = element;

            for (var depth = 0; depth < 3; depth++) {
                var parent = current.parentElement;

                if (!parent || parent === root) break;

                if (isProtected(parent)) break;

                var parentText = String(parent.textContent || '')
                    .replace(/\s+/g, ' ')
                    .trim();

                var childText = String(target.textContent || '')
                    .replace(/\s+/g, ' ')
                    .trim();

                if (parentText !== childText) break;

                target = parent;
                current = parent;
            }

            if (
                target &&
                target !== root &&
                !isProtected(target)
            ) {
                target.classList.add('mi312-header-meta-hidden');
            }
        });
    }

    /*
     * STYLES
     */

    function applyStyles() {
        var style = document.getElementById('mobile-interface-styles');

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
            'cinematic'
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

        var rSize = Lampa.Storage.get(
            'mobile_interface_ratings_size',
            '0.45em'
        );

        var animNames = [
            'fluid',
            'cyber',
            'cinematic',
            'elastic',
            'minimal'
        ];

        if (animNames.indexOf(animEffect) === -1) {
            animEffect = 'cinematic';
        }

        var animTiming = animEffect === 'elastic'
            ? 'cubic-bezier(0.34,1.56,0.64,1)'
            : 'cubic-bezier(0.16,1,0.3,1)';

        var enter = isUIAnim
            ? 'animation:anim_' + animEffect +
              ' .8s ' + animTiming + ' both;'
            : '';

        var css = '';

        /*
         * ANIMATIONS
         */

        css += '@keyframes kenBurnsEffect{';
        css += '0%{transform:scale(1)}';
        css += '50%{transform:scale(1.075)}';
        css += '100%{transform:scale(1)}';
        css += '}';

        css += '@keyframes anim_fluid{';
        css += '0%{opacity:0;transform:translate3d(0,22px,0) scale(.97);filter:blur(7px)}';
        css += '100%{opacity:1;transform:translate3d(0,0,0) scale(1);filter:blur(0)}';
        css += '}';

        css += '@keyframes anim_cyber{';
        css += '0%{opacity:0;transform:translate3d(-24px,0,0);filter:brightness(1.4)}';
        css += '100%{opacity:1;transform:translate3d(0,0,0);filter:brightness(1)}';
        css += '}';

        css += '@keyframes anim_cinematic{';
        css += '0%{opacity:0;transform:translate3d(0,18px,0) scale(1.025);filter:blur(6px)}';
        css += '100%{opacity:1;transform:translate3d(0,0,0) scale(1);filter:blur(0)}';
        css += '}';

        css += '@keyframes anim_elastic{';
        css += '0%{opacity:0;transform:scale(.88)}';
        css += '75%{opacity:1;transform:scale(1.025)}';
        css += '100%{opacity:1;transform:scale(1)}';
        css += '}';

        css += '@keyframes anim_minimal{';
        css += '0%{opacity:0;transform:translateY(9px)}';
        css += '100%{opacity:1;transform:translateY(0)}';
        css += '}';

        css += '@keyframes poster_fade_in{';
        css += '0%{opacity:0;transform:scale(1.025)}';
        css += '100%{opacity:1;transform:scale(1)}';
        css += '}';

        css += '@keyframes premium_glow{';
        css += '0%,100%{filter:drop-shadow(0 4px 16px rgba(0,0,0,.85))}';
        css += '50%{filter:drop-shadow(0 5px 23px rgba(255,255,255,.13))}';
        css += '}';

        css += '@media screen and (max-width:480px){';

        /*
         * MAIN CARD
         */

        css += '.full-start-new{';
        css += 'position:relative!important;';
        css += 'isolation:isolate;';
        css += 'background:transparent!important;';
        css += '}';

        css += '.full-start-new .full-start__reactions,';
        css += '.full-start-new [class*="reactions"]{';
        css += 'display:none!important;';
        css += '}';

        /*
         * DUPLICATE METADATA
         */

        css += '.full-start-new .mi312-header-meta-hidden{';
        css += 'display:none!important;';
        css += 'visibility:hidden!important;';
        css += 'height:0!important;';
        css += 'min-height:0!important;';
        css += 'margin:0!important;';
        css += 'padding:0!important;';
        css += 'overflow:hidden!important;';
        css += '}';

        /*
         * AGE RATING
         */

        css += '.full-start-new .full-start__age,';
        css += '.full-start-new .full-start-new__age,';
        css += '.full-start-new [class*="age"],';
        css += '.full-start-new [class*="pg"]{';
        css += 'display:none!important;';
        css += 'visibility:hidden!important;';
        css += '}';

        css += '.full-start-new .full-start__status,';
        css += '.full-start-new .full-start-new__status{';
        css += 'display:none!important;';
        css += '}';

        css += '.full-start-new .full-start-new__details,';
        css += '.full-start-new .full-start__info{';
        css += 'display:none!important;';
        css += '}';

        /*
         * CINEMATIC POSTER
         */

        css += '.full-start-new .full-start-new__poster{';
        css += 'position:relative!important;';
        css += 'overflow:hidden!important;';
        css += 'background:#050608;';
        css += 'z-index:1;';
        css += 'height:62vh!important;';
        css += 'min-height:390px;';

        if (isUIAnim) {
            css += 'animation:poster_fade_in .9s cubic-bezier(.16,1,.3,1) both;';
        }

        css += '}';

        css += '.full-start-new .full-start-new__poster:after{';
        css += 'content:"";';
        css += 'position:absolute;';
        css += 'inset:15% 0 0;';
        css += 'pointer-events:none;';
        css += 'z-index:2;';
        css += 'background:linear-gradient(';
        css += '180deg,';
        css += 'rgba(5,7,11,0) 0%,';
        css += 'rgba(5,7,11,.12) 22%,';
        css += 'rgba(5,7,11,.38) 48%,';
        css += 'rgba(5,7,11,.82) 78%,';
        css += '#050608 100%';
        css += ');';
        css += '}';

        css += '.full-start-new .full-start-new__poster img{';
        css += 'position:absolute;';
        css += 'inset:0;';
        css += 'width:100%;';
        css += 'height:100%;';
        css += 'object-fit:cover;';
        css += 'filter:saturate(1.06) contrast(1.045)!important;';
        css += 'transform-origin:center center!important;';
        css += 'transition:opacity 1.35s ease-in-out!important;';

        if (isPosterAnim) {
            css += 'animation:kenBurnsEffect 28s ease-in-out infinite!important;';
        }

        css += 'mask-image:linear-gradient(to bottom,#000 0%,#000 64%,transparent 100%)!important;';
        css += '-webkit-mask-image:linear-gradient(to bottom,#000 0%,#000 64%,transparent 100%)!important;';
        css += '}';

        /*
         * MAIN CONTENT
         */

        css += '.full-start-new .full-start-new__right{';
        css += 'position:relative!important;';
        css += 'z-index:3!important;';
        css += 'display:flex!important;';
        css += 'flex-direction:column!important;';
        css += 'align-items:center!important;';
        css += 'gap:' + blocksGap + '!important;';
        css += 'padding:0 14px!important;';
        css += 'margin-top:-168px!important;';
        css += 'background:none!important;';
        css += '}';

        /*
         * STUDIO LOGO
         */

        css += '.full-start-new .studio-header-brand{';
        css += enter;
        css += 'animation-delay:.04s;';
        css += 'order:1;';
        css += 'width:100%;';
        css += 'display:flex;';
        css += 'justify-content:center;';
        css += 'align-items:center;';
        css += 'margin:0 0 2px!important;';
        css += 'min-height:20px;';
        css += '}';

        css += '.full-start-new .studio-header-brand img{';
        css += 'height:20px!important;';
        css += 'width:auto;';
        css += 'max-width:120px;';
        css += 'object-fit:contain;';
        css += 'opacity:.94;';
        css += 'filter:drop-shadow(0 2px 8px rgba(0,0,0,.95));';
        css += 'transition:opacity .3s ease,filter .3s ease;';
        css += '}';

        css += '.full-start-new .studio-header-brand img.is-dark-logo{';
        css += 'filter:brightness(0) invert(1) drop-shadow(0 2px 6px rgba(0,0,0,.8))!important;';
        css += '}';

        /*
         * MOVIE LOGO
         */

        css += '.full-start-new .full-start-new__title{';
        css += enter;
        css += 'animation-delay:.1s;';
        css += 'order:2;';
        css += 'width:100%!important;';
        css += 'min-height:60px;';
        css += 'display:flex!important;';
        css += 'justify-content:center!important;';
        css += 'align-items:center!important;';
        css += 'margin:0!important;';
        css += 'overflow:visible!important;';
        css += '}';

        css += '.full-start-new .full-start-new__title img{';
        css += 'display:block;';
        css += 'height:auto!important;';
        css += 'max-height:' + lHeight + 'px!important;';
        css += 'width:auto!important;';
        css += 'max-width:90vw!important;';
        css += 'object-fit:contain!important;';
        css += 'filter:drop-shadow(0 5px 18px rgba(0,0,0,.95)) drop-shadow(0 0 12px rgba(255,255,255,.08));';
        css += 'margin:0!important;';
        css += 'transition:filter .4s ease,transform .4s ease;';
        css += '}';

        /*
         * TAGLINE
         */

        css += '.full-start-new .full-start-new__tagline{';
        css += enter;
        css += 'animation-delay:.17s;';
        css += 'order:3;';
        css += 'display:' + (showTagline ? 'block' : 'none') + '!important;';
        css += 'max-width:90%;';
        css += 'margin:1px 0 2px!important;';
        css += 'text-align:center!important;';
        css += 'font-family:Georgia,serif!important;';
        css += 'font-size:.91em!important;';
        css += 'line-height:1.5!important;';
        css += 'font-style:italic!important;';
        css += 'font-weight:400!important;';
        css += 'letter-spacing:.025em;';
        css += 'color:rgba(255,255,255,.82)!important;';
        css += 'text-shadow:0 2px 12px rgba(0,0,0,.95);';
        css += '}';

        /*
         * MINIMAL TRANSPARENT METADATA
         */

        css += '.full-start-new .plugin-meta-row{';
        css += enter;
        css += 'animation-delay:.23s;';
        css += 'order:4;';
        css += 'width:100%;';
        css += 'max-width:100%;';
        css += 'display:flex;';
        css += 'justify-content:center;';
        css += 'align-items:center;';
        css += 'flex-wrap:wrap;';
        css += 'gap:7px 9px;';
        css += 'margin:4px 0 0!important;';
        css += 'padding:3px 0;';
        css += 'box-sizing:border-box;';
        css += 'border:none!important;';
        css += 'border-radius:0!important;';
        css += 'background:transparent!important;';
        css += 'box-shadow:none!important;';
        css += 'backdrop-filter:none!important;';
        css += '-webkit-backdrop-filter:none!important;';
        css += 'font-family:Inter,-apple-system,system-ui,sans-serif;';
        css += 'font-size:calc(' + rSize + ' * 2.25);';
        css += 'line-height:1.5;';
        css += 'color:rgba(255,255,255,.91);';
        css += 'text-shadow:0 1px 5px rgba(0,0,0,.9);';
        css += '}';

        css += '.full-start-new .plugin-meta-row .info-text-item{';
        css += 'font-size:.88em;';
        css += 'font-weight:500;';
        css += 'white-space:normal;';
        css += 'text-align:center;';
        css += 'letter-spacing:.025em;';
        css += 'opacity:.94;';
        css += '}';

        /*
         * THIN METADATA SEPARATORS
         */

        css += '.full-start-new .plugin-meta-row .info-separator{';
        css += 'display:inline-block;';
        css += 'width:1px;';
        css += 'height:11px;';
        css += 'min-width:1px;';
        css += 'font-size:0;';
        css += 'line-height:0;';
        css += 'color:transparent;';
        css += 'background:rgba(255,255,255,.38);';
        css += 'margin:0 1px;';
        css += 'opacity:.8;';
        css += 'vertical-align:middle;';
        css += '}';

        /*
         * NATIVE LAMPA RATINGS
         */

        css += '.full-start-new .plugin-meta-row .full-start__rates{';
        css += 'display:inline-flex!important;';
        css += 'align-items:center;';
        css += 'justify-content:center;';
        css += 'flex-wrap:wrap;';
        css += 'gap:9px;';
        css += 'margin:0!important;';
        css += 'padding:0!important;';
        css += 'background:none!important;';
        css += '}';

        css += '.full-start-new .plugin-meta-row .rate--tmdb,';
        css += '.full-start-new .plugin-meta-row .rate--imdb,';
        css += '.full-start-new .plugin-meta-row .rate--kp{';
        css += 'display:inline-flex!important;';
        css += 'align-items:center;';
        css += 'margin:0!important;';
        css += 'padding:0!important;';
        css += 'font-size:.9em!important;';
        css += 'white-space:nowrap!important;';
        css += '}';

        /*
         * MINIMAL BUTTON CONTAINER
         */

        css += '.full-start-new .full-start-new__buttons{';
        css += enter;
        css += 'animation-delay:.31s;';
        css += 'order:6;';
        css += 'display:flex!important;';
        css += 'justify-content:space-around!important;';
        css += 'align-items:center!important;';
        css += 'gap:7px;';
        css += 'width:100%!important;';
        css += 'max-width:100%!important;';
        css += 'padding:3px 0 0!important;';
        css += 'box-sizing:border-box!important;';
        css += 'margin:7px 0 0!important;';
        css += 'background:transparent!important;';
        css += 'border:none!important;';
        css += 'box-shadow:none!important;';
        css += '}';

        /*
         * TRANSPARENT BUTTONS
         */

        css += '.full-start-new .full-start__button{';
        css += 'position:relative;';
        css += 'overflow:hidden;';
        css += 'background:transparent!important;';
        css += 'border:1px solid transparent!important;';
        css += 'border-radius:12px!important;';
        css += 'box-shadow:none!important;';
        css += 'display:flex!important;';
        css += 'flex-direction:column!important;';
        css += 'align-items:center!important;';
        css += 'justify-content:center!important;';
        css += 'flex:1 1 0!important;';
        css += 'min-width:0!important;';
        css += 'min-height:54px;';
        css += 'padding:8px 2px!important;';
        css += 'transition:transform .22s cubic-bezier(.16,1,.3,1),background .22s ease,color .22s ease,opacity .22s ease;';
        css += 'opacity:.9;';
        css += '}';

        /*
         * REMOVE BUTTON DECORATIVE GLASS
         */

        css += '.full-start-new .full-start__button:before{';
        css += 'display:none!important;';
        css += 'content:none!important;';
        css += '}';

        /*
         * SUBTLE PRESS EFFECT
         */

        css += '.full-start-new .full-start__button:active{';
        css += 'transform:scale(.94);';
        css += 'background:rgba(255,255,255,.075)!important;';
        css += 'border-color:transparent!important;';
        css += 'box-shadow:none!important;';
        css += 'opacity:1;';
        css += '}';

        /*
         * BUTTON ICONS
         */

        css += '.full-start-new .full-start__button svg,';
        css += '.full-start-new .full-start__button img{';
        css += 'position:relative;';
        css += 'z-index:1;';
        css += 'width:22px!important;';
        css += 'height:22px!important;';
        css += 'margin:0 0 5px!important;';
        css += 'fill:#fff!important;';
        css += 'filter:drop-shadow(0 2px 5px rgba(0,0,0,.65));';
        css += 'transition:transform .22s ease,filter .22s ease;';
        css += '}';

        /*
         * BUTTON LABELS
         */

        css += '.full-start-new .full-start__button span{';
        css += 'position:relative;';
        css += 'z-index:1;';
        css += 'font-size:8px!important;';
        css += 'line-height:1.2!important;';
        css += 'text-transform:uppercase!important;';
        css += 'opacity:.8!important;';
        css += 'font-weight:650;';
        css += 'letter-spacing:.065em;';
        css += 'text-shadow:0 1px 5px rgba(0,0,0,.8);';
        css += 'transition:opacity .22s ease;';
        css += '}';

        css += '.full-start-new .full-start__button:active svg,';
        css += '.full-start-new .full-start__button:active img{';
        css += 'transform:scale(.92);';
        css += '}';

        css += '.full-start-new .full-start__button:active span{';
        css += 'opacity:1!important;';
        css += '}';

        css += '}';

        /*
         * REDUCED MOTION
         */

        css += '@media (prefers-reduced-motion:reduce){';
        css += '.full-start-new *{';
        css += 'animation-duration:.01ms!important;';
        css += 'animation-iteration-count:1!important;';
        css += 'transition-duration:.01ms!important;';
        css += '}';
        css += '}';

        style.textContent = css;
    }

    /*
     * TIME FORMAT
     */

    function formatTime(mins) {
        if (!mins) return '';

        var h = Math.floor(mins / 60);
        var m = mins % 60;

        return (h > 0 ? h + 'г ' : '') + m + 'хв';
    }

    /*
     * METADATA ROW
     */

    function renderMeta(container, e) {
        container.find('.plugin-meta-row').remove();

        var movie = e.data.movie || {};
        var $metaRow = $('<div class="plugin-meta-row"></div>');

        function addText(value) {
            if (
                value === undefined ||
                value === null ||
                value === ''
            ) {
                return;
            }

            if ($metaRow.children().length) {
                $metaRow.append(
                    '<span class="info-separator">•</span>'
                );
            }

            $('<div class="info-text-item"></div>')
                .text(String(value))
                .appendTo($metaRow);
        }

        /*
         * YEAR
         */

        var date = movie.release_date ||
            movie.first_air_date ||
            '';

        addText(date ? date.substring(0, 4) : '');

        /*
         * COUNTRY
         */

        var country = '';

        if (
            movie.production_countries &&
            movie.production_countries.length
        ) {
            country =
                movie.production_countries[0].name ||
                movie.production_countries[0].iso_3166_1 ||
                '';
        } else if (
            movie.origin_country &&
            movie.origin_country.length
        ) {
            country = movie.origin_country[0];
        }

        addText(country);

        /*
         * RUNTIME
         */

        var runtime = movie.runtime || (
            movie.episode_run_time &&
            movie.episode_run_time.length
                ? movie.episode_run_time[0]
                : 0
        );

        if (runtime) {
            addText(formatTime(runtime));
        }

        /*
         * GENRES
         */

        if (movie.genres && movie.genres.length) {
            addText(
                movie.genres
                    .slice(0, 2)
                    .map(function (g) {
                        return g.name || '';
                    })
                    .filter(Boolean)
                    .join(', ')
            );
        }

        /*
         * NATIVE LAMPA RATINGS
         */

        var $card = container.closest('.full-start-new');
        var $nativeRates = $card.find('.full-start__rates').first();

        if (!$nativeRates.length) {
            var $rates = $card.find(
                '.rate--tmdb, .rate--imdb, .rate--kp'
            );

            if ($rates.length) {
                $nativeRates = $(
                    '<div class="full-start__rates"></div>'
                );

                $rates.each(function () {
                    $nativeRates.append(this);
                });
            }
        }

        if ($nativeRates.length) {
            if ($metaRow.children().length) {
                $metaRow.append(
                    '<span class="info-separator">•</span>'
                );
            }

            $nativeRates.appendTo($metaRow);
        }

        container.append($metaRow);
    }

    /*
     * TMDB DETAILS
     */

    function applyMovieDetailsData(
        data,
        movie,
        $render,
        renderToken
    ) {
        if (
            renderToken !== activeRenderToken ||
            !$render[0] ||
            !document.body.contains($render[0])
        ) {
            return;
        }

        /*
         * MOVIE LOGO
         */

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
                    .html(
                        $('<img>')
                            .attr('src', logoUrl)
                            .attr('alt', movie.title || movie.name || '')
                    );
            }
        }

        /*
         * STUDIO LOGO
         */

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
                    '">' +
                    '</div>'
                );

                var $img = $brand.find('img');

                $img.on('error', function () {
                    $brand.remove();
                });

                isImageDark(studioLogoUrl, function (isDark) {
                    if (
                        renderToken !== activeRenderToken ||
                        !$render[0] ||
                        !document.body.contains($render[0])
                    ) {
                        return;
                    }

                    if (isDark) {
                        $img.addClass('is-dark-logo');
                    }
                });

                $render.find('.full-start-new__title')
                    .before($brand);
            }
        }

        /*
         * BACKDROPS
         */

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
                    backdrops.slice(0, 15),
                    renderToken
                );
            }
        }

        /*
         * RECHECK DUPLICATE METADATA
         */

        hideDuplicateHeaderMetadata($render);
    }

    /*
     * LOAD TMDB DETAILS
     */

    function loadMovieDetails(movie, $render, renderToken) {
        var movieId = movie.id;

        var type = (
            movie.name ||
            movie.first_air_date
        ) ? 'tv' : 'movie';

        var cacheKey = type + ':' + movieId;

        currentActiveId = cacheKey;

        if (detailsCache[cacheKey]) {
            if (renderToken === activeRenderToken) {
                applyMovieDetailsData(
                    detailsCache[cacheKey],
                    movie,
                    $render,
                    renderToken
                );
            }

            return;
        }

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
            timeout: 12000,

            success: function (data) {
                if (
                    !data ||
                    renderToken !== activeRenderToken ||
                    currentActiveId !== cacheKey
                ) {
                    return;
                }

                detailsCache[cacheKey] = data;

                var cacheKeys = Object.keys(detailsCache);

                if (cacheKeys.length > 100) {
                    delete detailsCache[cacheKeys[0]];
                }

                applyMovieDetailsData(
                    data,
                    movie,
                    $render,
                    renderToken
                );
            },

            error: function () {
                // Помилка TMDB не повинна порушувати роботу картки.
            }
        });
    }

    /*
     * POSTER SLIDESHOW
     */

    function startPosterSlideshow($poster, items, renderToken) {
        if (
            !Lampa.Storage.get('mobile_interface_slideshow') ||
            !items ||
            !items.length ||
            !$poster ||
            !$poster.length
        ) {
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

        if (!intervalTime || intervalTime < 1000) {
            intervalTime = 10000;
        }

        slideshowTimer = setInterval(function () {
            if (
                renderToken !== activeRenderToken ||
                !$poster[0] ||
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

            var nextImg = new Image();

            nextImg.onload = function () {
                if (
                    renderToken !== activeRenderToken ||
                    !$poster[0] ||
                    !document.body.contains($poster[0])
                ) {
                    return;
                }

                var $current = $poster.find('img').first();

                var $next = $('<img>')
                    .attr('src', imgUrl)
                    .css({
                        opacity: 0,
                        transition: 'opacity 1.35s ease-in-out'
                    });

                $poster.append($next);

                requestAnimationFrame(function () {
                    if (renderToken !== activeRenderToken) {
                        return;
                    }

                    $next.css('opacity', 1);
                    $current.css('opacity', 0);
                });

                setTimeout(function () {
                    if ($current && $current.length) {
                        $current.remove();
                    }
                }, 1450);
            };

            nextImg.onerror = function () {};

            nextImg.src = imgUrl;

        }, intervalTime);
    }

    /*
     * INITIALIZATION
     */

    function init() {
        Lampa.Listener.follow('full', function (e) {

            if (
                e.type === 'destroy' ||
                e.type === 'onBeforeDestroy'
            ) {
                activeRenderToken++;
                stopSlideshow();
                currentActiveId = null;
                return;
            }

            if (
                window.innerWidth > 480 ||
                (
                    e.type !== 'complite' &&
                    e.type !== 'complete'
                )
            ) {
                return;
            }

            if (
                !e.data ||
                !e.data.movie ||
                !e.object ||
                !e.object.activity
            ) {
                return;
            }

            stopSlideshow();

            var renderToken = ++activeRenderToken;
            var movie = e.data.movie;
            var $render = e.object.activity.render();

            if (!$render || !$render.length) {
                return;
            }

            if (window.lampa_settings) {
                window.lampa_settings.blur_poster = false;
            }

            /*
             * METADATA
             */

            renderMeta(
                $render.find('.full-start-new__right'),
                e
            );

            /*
             * HIDE DUPLICATE YEAR/COUNTRY
             */

            hideDuplicateHeaderMetadata($render);

            /*
             * TMDB
             */

            loadMovieDetails(
                movie,
                $render,
                renderToken
            );
        });
    }

    /*
     * SETTINGS
     */

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
                default: 'cinematic'
            },
            field: {
                name: 'Стиль анімації появи'
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
            },
            onChange: function () {
                stopSlideshow();
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
            },
            onChange: function () {
                stopSlideshow();
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
            },
            onChange: applyStyles
        });
    }

    /*
     * START
     */

    function startPlugin() {
        if (started) return;

        started = true;

        applyStyles();
        setupSettings();
        init();

        console.log(
            '[MOB_INTERFACE] 3.1.2 Minimal Cinematic Premium initialized'
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
