
(function () {
    'use strict';

    /*
     * @name MOB_INTERFACE
     * @version 3.2.1
     * @author Crowley24
     * @description Premium Mobile Interface — Logo Animation Only
     * @platforms Lampa | Mobile
     *
     * 3.2.1 CHANGES:
     * - Background fade mask moved lower (130%)
     * - More clear background around studio and movie logos
     * - Preserved native Lampa background image
     * - All other features preserved from 3.2.0
     */

    if (window.MOB_INTERFACE_V321_READY) return;
    window.MOB_INTERFACE_V321_READY = true;

    var detailsCache = {};
    var logoCache = {};
    var logoRequests = {};
    var logoImageCache = {};
    var logoImageRequests = {};

    var currentActiveId = null;
    var activeRenderToken = 0;
    var started = false;

    // --------------------------------------------------
    // SETTINGS
    // --------------------------------------------------

    var settings_list = [
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

    // --------------------------------------------------
    // TMDB LOGO LANGUAGE SELECTION
    // --------------------------------------------------

    function pickMovieLogo(logos, lang) {
        if (!logos || !logos.length) return null;

        var order = [lang, 'en', null];

        for (var i = 0; i < order.length; i++) {
            var found = logos.filter(function (logo) {
                return logo.iso_639_1 === order[i];
            })[0];

            if (found) return found;
        }

        return logos[0] || null;
    }

    // --------------------------------------------------
    // LOGO IMAGE PRELOAD
    // --------------------------------------------------

    function preloadMovieLogo(url, callback) {
        if (!url) {
            callback(null);
            return;
        }

        if (
            Object.prototype.hasOwnProperty.call(
                logoImageCache,
                url
            )
        ) {
            callback(logoImageCache[url]);
            return;
        }

        if (logoImageRequests[url]) {
            logoImageRequests[url].push(callback);
            return;
        }

        logoImageRequests[url] = [callback];

        var image = new Image();
        var completed = false;

        var timer = setTimeout(function () {
            finish(null, false);
        }, 20000);

        function finish(result, shouldCache) {
            if (completed) return;

            completed = true;
            clearTimeout(timer);

            var waiters = logoImageRequests[url] || [];

            delete logoImageRequests[url];

            if (shouldCache) {
                logoImageCache[url] = result;

                var keys = Object.keys(logoImageCache);

                if (keys.length > 100) {
                    delete logoImageCache[keys[0]];
                }
            }

            waiters.forEach(function (waiter) {
                try {
                    waiter(result);
                } catch (e) {}
            });
        }

        image.onload = function () {
            finish(image, true);
        };

        image.onerror = function () {
            finish(null, false);
        };

        image.src = url;

        if (image.complete && image.naturalWidth > 0) {
            finish(image, true);
        }
    }

    // --------------------------------------------------
    // TMDB LOGO REQUEST
    // --------------------------------------------------

    function ensureMovieLogo(movie, type, callback) {
        if (!movie || !movie.id) {
            callback(null);
            return;
        }

        var tmdb = Lampa.Api &&
            Lampa.Api.sources &&
            Lampa.Api.sources.tmdb;

        if (!tmdb || typeof tmdb.get !== 'function') {
            callback(null);
            return;
        }

        var lang = Lampa.Storage.field('tmdb_lang') || 'en';
        var langs = lang + ',en,null';

        var cacheKey = type + ':' + movie.id + ':' + lang;

        if (
            Object.prototype.hasOwnProperty.call(
                logoCache,
                cacheKey
            )
        ) {
            callback(logoCache[cacheKey]);
            return;
        }

        if (logoRequests[cacheKey]) {
            logoRequests[cacheKey].waiters.push(callback);
            return;
        }

        var request = {
            waiters: [callback],
            finished: false,
            timer: null
        };

        logoRequests[cacheKey] = request;

        function finish(url, shouldCache) {
            if (request.finished) return;

            request.finished = true;

            if (request.timer) {
                clearTimeout(request.timer);
                request.timer = null;
            }

            if (shouldCache) {
                logoCache[cacheKey] = url || null;

                var keys = Object.keys(logoCache);

                if (keys.length > 250) {
                    delete logoCache[keys[0]];
                }
            }

            var waiters = request.waiters.slice();

            request.waiters = [];

            delete logoRequests[cacheKey];

            waiters.forEach(function (waiter) {
                try {
                    waiter(url || null);
                } catch (e) {}
            });
        }

        request.timer = setTimeout(function () {
            finish(null, false);
        }, 20000);

        try {
            tmdb.get(
                type + '/' + movie.id + '/images',
                {
                    filter: {
                        include_image_language: langs
                    }
                },
                function (data) {
                    if (request.finished) return;

                    var logos = [];

                    if (data && data.logos) {
                        logos = data.logos;
                    } else if (
                        data &&
                        data.images &&
                        data.images.logos
                    ) {
                        logos = data.images.logos;
                    }

                    var logo = pickMovieLogo(logos, lang);

                    if (!logo || !logo.file_path) {
                        finish(null, true);
                        return;
                    }

                    var quality = Lampa.Storage.get(
                        'mobile_interface_logo_quality',
                        'w500'
                    );

                    var allowedQuality = [
                        'w300',
                        'w500',
                        'original'
                    ];

                    if (allowedQuality.indexOf(quality) === -1) {
                        quality = 'w500';
                    }

                    var logoUrl = Lampa.Api.img(
                        logo.file_path,
                        quality
                    );

                    finish(logoUrl, true);
                },
                function () {
                    finish(null, false);
                }
            );
        } catch (e) {
            finish(null, false);
        }
    }

    // --------------------------------------------------
    // MOVIE TYPE
    // --------------------------------------------------

    function getMovieType(movie) {
        return (
            movie &&
            (
                movie.name ||
                movie.first_air_date
            )
        ) ? 'tv' : 'movie';
    }

    // --------------------------------------------------
    // MOVIE LOGO DISPLAY
    // --------------------------------------------------

    function displayMovieLogo(movie, $render, renderToken) {
        if (
            !movie ||
            !movie.id ||
            !$render ||
            !$render.length
        ) {
            return;
        }

        var $title = $render.find(
            '.full-start-new__title'
        ).first();

        if (!$title.length) return;

        var nativeTitle = $title.contents().detach();

        $title
            .empty()
            .removeClass('mi320-logo-ready')
            .addClass('mi320-logo-pending');

        var type = getMovieType(movie);

        function isCurrent() {
            return (
                renderToken === activeRenderToken &&
                $render[0] &&
                document.body.contains($render[0])
            );
        }

        function restoreNativeTitle() {
            if (!isCurrent()) return;

            var $finalTitle = $render.find(
                '.full-start-new__title'
            ).first();

            if (!$finalTitle.length) return;

            $finalTitle
                .removeClass('mi320-logo-pending')
                .removeClass('mi320-logo-ready')
                .empty()
                .append(nativeTitle);
        }

        ensureMovieLogo(
            movie,
            type,
            function (logoUrl) {
                if (!isCurrent()) return;

                if (!logoUrl) {
                    restoreNativeTitle();
                    return;
                }

                preloadMovieLogo(
                    logoUrl,
                    function (image) {
                        if (!isCurrent()) return;

                        if (!image) {
                            restoreNativeTitle();
                            return;
                        }

                        var $finalTitle = $render.find(
                            '.full-start-new__title'
                        ).first();

                        if (!$finalTitle.length) return;

                        var $logo = $(image.cloneNode(false));

                        $logo
                            .addClass('mi320-movie-logo')
                            .attr(
                                'alt',
                                movie.title ||
                                movie.name ||
                                movie.original_title ||
                                movie.original_name ||
                                ''
                            );

                        $finalTitle
                            .empty()
                            .removeClass('mi320-logo-pending')
                            .addClass('mi320-logo-ready')
                            .append($logo);
                    }
                );
            }
        );
    }

    // --------------------------------------------------
    // IMAGE DARKNESS DETECTION
    // --------------------------------------------------

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

    // --------------------------------------------------
    // DUPLICATE HEADER METADATA CLEANUP
    // --------------------------------------------------

    function hideDuplicateHeaderMetadata($render) {
        if (!$render || !$render.length) return;

        var $right = $render.find(
            '.full-start-new__right'
        ).first();

        if (!$right.length) return;

        var root = $right[0];

        var title = $right.find(
            '.full-start-new__title'
        ).first()[0];

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

            if (
                element.matches &&
                element.matches(protectedSelector)
            ) {
                return true;
            }

            if (
                element.querySelector &&
                element.querySelector(protectedSelector)
            ) {
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
                element.classList.contains(
                    'mi312-header-meta-hidden'
                ) ||
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
                target.classList.add(
                    'mi312-header-meta-hidden'
                );
            }
        });
    }

    // --------------------------------------------------
    // STYLES
    // --------------------------------------------------

    function applyStyles() {
        var style = document.getElementById(
            'mobile-interface-styles'
        );

        if (!style) {
            style = document.createElement('style');
            style.id = 'mobile-interface-styles';
            document.head.appendChild(style);
        }

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

        var css = '';

        // --------------------------------------------------
        // PREMIUM LOGO ANIMATION
        // Only animated element in the interface
        // --------------------------------------------------

        css += '@keyframes mi320LogoReveal{';

        css += '0%{';
        css += 'opacity:0;';
        css += 'transform:translate3d(0,10px,0) scale(.975);';
        css += '}';

        css += '65%{';
        css += 'opacity:1;';
        css += 'transform:translate3d(0,-1px,0) scale(1.005);';
        css += '}';

        css += '100%{';
        css += 'opacity:1;';
        css += 'transform:translate3d(0,0,0) scale(1);';
        css += '}';

        css += '}';

        css += '@media screen and (max-width:480px){';

        // MAIN CARD

        css += '.full-start-new{';
        css += 'position:relative!important;';
        css += 'isolation:isolate;';
        css += 'background:transparent!important;';
        css += '}';

        css += '.full-start-new .full-start__reactions,';
        css += '.full-start-new [class*="reactions"]{';
        css += 'display:none!important;';
        css += '}';

        // DUPLICATE METADATA

        css += '.full-start-new .mi312-header-meta-hidden{';
        css += 'display:none!important;';
        css += 'visibility:hidden!important;';
        css += 'height:0!important;';
        css += 'min-height:0!important;';
        css += 'margin:0!important;';
        css += 'padding:0!important;';
        css += 'overflow:hidden!important;';
        css += '}';

        // AGE RATING

        css += '.full-start-new .full-start__age,';
        css += '.full-start-new .full-start-new__age,';
        css += '.full-start-new [class*="age"],';
        css += '.full-start-new [class*="pg"]{';
        css += 'display:none!important;';
        css += 'visibility:hidden!important;';
        css += '}';

        // STATUS AND DETAILS

        css += '.full-start-new .full-start__status,';
        css += '.full-start-new .full-start-new__status,';
        css += '.full-start-new .full-start-new__details,';
        css += '.full-start-new .full-start__info{';
        css += 'display:none!important;';
        css += '}';

        /*
         * NATIVE LAMPA BACKGROUND
         *
         * Не змінюємо:
         * - poster
         * - background image
         * - poster dimensions
         * - gradients
         * - blur settings
         */

        // BACKGROUND FADE — MOVED LOWER

        css += '.full-start__background{';
        css += 'mask-size:100% 130%!important;';
        css += '-webkit-mask-size:100% 130%!important;';
        css += 'mask-position:100% 0!important;';
        css += '-webkit-mask-position:100% 0!important;';
        css += '}';

        // MAIN CONTENT

        css += '.full-start-new .full-start-new__right{';
        css += 'position:relative!important;';
        css += 'z-index:3!important;';
        css += 'display:flex!important;';
        css += 'flex-direction:column!important;';
        css += 'align-items:center!important;';
        css += 'gap:' + blocksGap + '!important;';
        css += 'padding:0 14px!important;';
        css += 'background:none!important;';
        css += '}';

        // STUDIO LOGO — NO ENTRANCE ANIMATION

        css += '.full-start-new .studio-header-brand{';
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
        css += 'filter:drop-shadow(0 2px 6px rgba(0,0,0,.8));';
        css += '}';

        css += '.full-start-new .studio-header-brand img.is-dark-logo{';
        css += 'filter:brightness(0) invert(1) drop-shadow(0 2px 6px rgba(0,0,0,.8))!important;';
        css += '}';

        // MOVIE LOGO CONTAINER

        css += '.full-start-new .full-start-new__title{';
        css += 'animation:none!important;';
        css += 'order:2;';
        css += 'width:100%!important;';
        css += 'min-height:60px;';
        css += 'display:flex!important;';
        css += 'justify-content:center!important;';
        css += 'align-items:center!important;';
        css += 'margin:0!important;';
        css += 'overflow:visible!important;';
        css += 'opacity:1!important;';
        css += 'transform:none!important;';
        css += '}';

        // HIDE TITLE WHILE LOGO IS LOADING

        css += '.full-start-new .full-start-new__title.mi320-logo-pending{';
        css += 'display:none!important;';
        css += '}';

        css += '.full-start-new .full-start-new__title.mi320-logo-ready{';
        css += 'display:flex!important;';
        css += 'visibility:visible!important;';
        css += '}';

        // PREMIUM LOGO IMAGE

        css += '.full-start-new .full-start-new__title img.mi320-movie-logo{';
        css += 'display:block!important;';
        css += 'height:auto!important;';
        css += 'max-height:' + lHeight + 'px!important;';
        css += 'width:auto!important;';
        css += 'max-width:90vw!important;';
        css += 'object-fit:contain!important;';
        css += 'filter:drop-shadow(0 4px 14px rgba(0,0,0,.82));';
        css += 'margin:0!important;';
        css += 'opacity:1;';
        css += 'transform:translate3d(0,0,0) scale(1);';
        css += 'animation:mi320LogoReveal .72s cubic-bezier(.16,1,.3,1) both;';
        css += 'backface-visibility:hidden;';
        css += '}';

        // TAGLINE — STATIC

        css += '.full-start-new .full-start-new__tagline{';
        css += 'animation:none!important;';
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
        css += 'text-shadow:0 2px 10px rgba(0,0,0,.9);';
        css += '}';

        // METADATA — NO ANIMATION

        css += '.full-start-new .plugin-meta-row{';
        css += 'animation:none!important;';
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

        // METADATA SEPARATORS

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

        // NATIVE LAMPA RATINGS

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

        // BUTTON CONTAINER — STATIC

        css += '.full-start-new .full-start-new__buttons{';
        css += 'animation:none!important;';
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

        // BUTTONS

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
        css += 'opacity:.9;';
        css += '}';

        css += '.full-start-new .full-start__button:before{';
        css += 'display:none!important;';
        css += 'content:none!important;';
        css += '}';

        // SIMPLE PRESS FEEDBACK

        css += '.full-start-new .full-start__button:active{';
        css += 'transform:scale(.97);';
        css += 'background:rgba(255,255,255,.075)!important;';
        css += 'border-color:transparent!important;';
        css += 'box-shadow:none!important;';
        css += 'opacity:1;';
        css += '}';

        // BUTTON ICONS

        css += '.full-start-new .full-start__button svg,';
        css += '.full-start-new .full-start__button img{';
        css += 'position:relative;';
        css += 'z-index:1;';
        css += 'width:22px!important;';
        css += 'height:22px!important;';
        css += 'margin:0 0 5px!important;';
        css += 'fill:#fff!important;';
        css += 'filter:drop-shadow(0 2px 4px rgba(0,0,0,.6));';
        css += '}';

        // BUTTON LABELS

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
        css += '}';

        css += '.full-start-new .full-start__button:active span{';
        css += 'opacity:1!important;';
        css += '}';

        css += '}';

        // REDUCED MOTION

        css += '@media (prefers-reduced-motion:reduce){';

        css += '.full-start-new .full-start-new__title img.mi320-movie-logo{';
        css += 'animation:none!important;';
        css += 'opacity:1!important;';
        css += 'transform:none!important;';
        css += '}';

        css += '}';

        style.textContent = css;
    }

    // --------------------------------------------------
    // TIME FORMAT
    // --------------------------------------------------

    function formatTime(mins) {
        if (!mins) return '';

        var h = Math.floor(mins / 60);
        var m = mins % 60;

        return (h > 0 ? h + 'г ' : '') + m + 'хв';
    }

    // --------------------------------------------------
    // METADATA ROW
    // --------------------------------------------------

    function renderMeta(container, e) {
        container.find('.plugin-meta-row').remove();

        var movie = e.data.movie || {};

        var $metaRow = $(
            '<div class="plugin-meta-row"></div>'
        );

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

        // YEAR

        var date = movie.release_date ||
            movie.first_air_date ||
            '';

        addText(date ? date.substring(0, 4) : '');

        // COUNTRY

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

        // RUNTIME

        var runtime = movie.runtime || (
            movie.episode_run_time &&
            movie.episode_run_time.length
                ? movie.episode_run_time[0]
                : 0
        );

        if (runtime) {
            addText(formatTime(runtime));
        }

        // GENRES

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

        // NATIVE LAMPA RATINGS

        var $card = container.closest('.full-start-new');

        var $nativeRates = $card.find(
            '.full-start__rates'
        ).first();

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

    // --------------------------------------------------
    // TMDB DETAILS
    // Studio logos only — no backdrop handling
    // --------------------------------------------------

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

        // STUDIO LOGO

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
                    '<div class="studio-header-brand"></div>'
                );

                var $img = $('<img>').attr({
                    src: studioLogoUrl,
                    alt: studio.name || ''
                });

                $brand.append($img);

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

        hideDuplicateHeaderMetadata($render);
    }

    // --------------------------------------------------
    // LOAD TMDB DETAILS
    // --------------------------------------------------

    function loadMovieDetails(movie, $render, renderToken) {
        var movieId = movie.id;
        var type = getMovieType(movie);
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
            '?api_key=' + Lampa.TMDB.key();

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
                // TMDB error must not interrupt card rendering.
            }
        });
    }

    // --------------------------------------------------
    // INITIALIZATION
    // --------------------------------------------------

    function init() {
        Lampa.Listener.follow('full', function (e) {

            if (
                e.type === 'destroy' ||
                e.type === 'onBeforeDestroy'
            ) {
                activeRenderToken++;
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

            var renderToken = ++activeRenderToken;
            var movie = e.data.movie;
            var $render = e.object.activity.render();

            if (!$render || !$render.length) {
                return;
            }

            // METADATA

            renderMeta(
                $render.find('.full-start-new__right'),
                e
            );

            // HIDE DUPLICATE YEAR / COUNTRY

            hideDuplicateHeaderMetadata($render);

            // TMDB LOGO

            displayMovieLogo(
                movie,
                $render,
                renderToken
            );

            // TMDB DETAILS / STUDIO LOGO

            loadMovieDetails(
                movie,
                $render,
                renderToken
            );
        });
    }

    // --------------------------------------------------
    // SETTINGS
    // --------------------------------------------------

    function setupSettings() {
        Lampa.SettingsApi.addComponent({
            component: 'mobile_interface',
            name: 'Мобільний інтерфейс',
            icon: '<svg height="36" viewBox="0 0 24 24" width="36" xmlns="http://www.w3.org/2000/svg"><path d="M17 1.01L7 1c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99zM17 19H7V5h10v14z" fill="white"/></svg>'
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
                name: 'mobile_interface_logo_quality',
                type: 'select',
                values: {
                    w300: 'Оптимізована',
                    w500: 'Висока',
                    original: 'Оригінальна'
                },
                default: 'w500'
            },
            field: {
                name: 'Якість логотипу'
            }
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

    // --------------------------------------------------
    // START
    // --------------------------------------------------

    function startPlugin() {
        if (started) return;

        started = true;

        applyStyles();
        setupSettings();
        init();

        console.log(
            '[MOB_INTERFACE] 3.2.1 Premium Logo Animation initialized'
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
