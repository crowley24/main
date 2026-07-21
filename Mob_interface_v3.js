(function () {
    'use strict';

    /**
     * ПЕРЕМІННІ ТА КЕШУВАННЯ
     */
    var logoCache = {}; 
    var slideshowTimer = null; 
    var pluginPath = 'https://crowley38.github.io/Icons/';
    
    var settings_list = [
        { id: 'mobile_interface_animation', default: true },
        { id: 'mobile_interface_ui_anim', default: true },
        { id: 'mobile_interface_slideshow', default: true },
        { id: 'mobile_interface_slideshow_time', default: '10000' },
        { id: 'mobile_interface_slideshow_quality', default: 'w780' },
        { id: 'mobile_interface_logo_size_v2', default: '125' },
        { id: 'mobile_interface_logo_quality', default: 'w500' },
        { id: 'mobile_interface_show_tagline', default: true },
        { id: 'mobile_interface_blocks_gap', default: '8px' },
        { id: 'mobile_interface_ratings_size', default: '0.45em' },
        { id: 'mobile_interface_studios', default: true },
        { id: 'mobile_interface_studios_bg_opacity', default: '0.15' },
        { id: 'mobile_interface_quality', default: true }
    ];

    settings_list.forEach(function (opt) {
        if (Lampa.Storage.get(opt.id, 'unset') === 'unset') {
            Lampa.Storage.set(opt.id, opt.default);
        }
    });

    var svgIcons = {
        '4K': pluginPath + '4K.svg',
        '2K': pluginPath + '2K.svg',
        'FULL HD': pluginPath + 'FULL HD.svg',
        'HD': pluginPath + 'HD.svg',
        'HDR': pluginPath + 'HDR.svg',
        'Dolby Vision': pluginPath + 'Dolby Vision.svg',
        '7.1': pluginPath + '7.1.svg',
        '5.1': pluginPath + '5.1.svg',
        '4.0': pluginPath + '4.0.svg',
        '2.0': pluginPath + '2.0.svg',
        'DUB': pluginPath + 'DUB.svg',
        'UKR': pluginPath + 'UKR.svg'
    };

    var ratingIcons = {
        tmdb: 'https://upload.wikimedia.org/wikipedia/commons/8/89/Tmdb.new.logo.svg',
        cub: 'https://raw.githubusercontent.com/yumata/lampa/9381985ad4371d2a7d5eb5ca8e3daf0f32669eb7/img/logo-icon.svg'
    };

    function stopSlideshow() {
        if (slideshowTimer) {
            clearInterval(slideshowTimer);
            slideshowTimer = null;
        }
    }

    /**
     * СТИЛІ ІНТЕРФЕЙСУ (CSS)
     */
    function applyStyles() {
        var oldStyle = document.getElementById('mobile-interface-styles');
        if (oldStyle) oldStyle.parentNode.removeChild(oldStyle);

        var isPosterAnim = Lampa.Storage.get('mobile_interface_animation');
        var isUIAnim = Lampa.Storage.get('mobile_interface_ui_anim');
        var bgOpacity = Lampa.Storage.get('mobile_interface_studios_bg_opacity', '0.15');
        var rSize = Lampa.Storage.get('mobile_interface_ratings_size', '0.45em');
        var lHeight = Lampa.Storage.get('mobile_interface_logo_size_v2', '125'); 
        var showTagline = Lampa.Storage.get('mobile_interface_show_tagline');
        var blocksGap = Lampa.Storage.get('mobile_interface_blocks_gap', '8px');
        
        var style = document.createElement('style');
        style.id = 'mobile-interface-styles';
        
        var css = '';
        
        // Плавна панорамна анімація Ken Burns
        css += '@keyframes kenBurnsEffect { 0% { transform: scale(1); } 50% { transform: scale(1.08); } 100% { transform: scale(1); } } ';
        
        // Преміальна анімація появи UI (Scale + Blur + Fade + Slide)
        css += '@keyframes premium_ui_reveal { ';
        css += '  0% { opacity: 0; transform: translateY(22px) scale(0.96); filter: blur(8px); } ';
        css += '  100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0px); } ';
        css += '} ';

        // Анімація м'якої появи постера
        css += '@keyframes poster_fade_in { ';
        css += '  0% { opacity: 0; transform: scale(1.04); } ';
        css += '  100% { opacity: 1; transform: scale(1); } ';
        css += '} ';
        
        css += '@media screen and (max-width: 480px) { ';
        css += '.full-start-new__details, .full-start__info, .full-start__age, .full-start-new__age, .full-start__status, .full-start-new__status, [class*="age"], [class*="pg"], [class*="rating-count"], [class*="status"] { display:none !important; } ';
        css += '.rate--tmdb, .rate--imdb, .rate--kp, .full-start__rates { display: none !important; } ';
        css += '.background { background: #000 !important; } ';
        
        // Постер
        css += '.full-start-new__poster { position: relative !important; overflow: hidden !important; background: #000; z-index: 1; height: 62vh !important; pointer-events: none !important; ';
        css += (isUIAnim ? 'animation: poster_fade_in 0.9s cubic-bezier(0.16, 1, 0.3, 1) forwards; ' : '') + '} ';
        
        css += '.full-start-new__poster img { filter: none !important; ';
        css += (isPosterAnim ? 'animation: kenBurnsEffect 25s ease-in-out infinite !important; ' : '');
        css += 'transform-origin: center center !important; transition: opacity 1.2s ease-in-out !important; position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; ';
        css += 'mask-image: linear-gradient(to bottom, #000 0%, #000 55%, transparent 100%) !important; -webkit-mask-image: linear-gradient(to bottom, #000 0%, #000 55%, transparent 100%) !important; } ';
        
        css += '.full-start-new__right { background: none !important; margin-top: -160px !important; z-index: 2 !important; display: flex !important; flex-direction: column !important; align-items: center !important; padding: 0 10px !important; gap: ' + blocksGap + ' !important; } ';
        
        var uiAnimClass = isUIAnim ? 'animation: premium_ui_reveal 0.75s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; will-change: transform, opacity, filter; ' : '';

        // Послідовність елементів (Staggering)
        css += '.full-start-new__right > div:first-child { ' + uiAnimClass + ' animation-delay: 0.08s; margin: 0 0 -5px 0 !important; font-size: 0.9em !important; opacity: 0; order: 1; } ';

        // Логотип / Назва
        css += '.full-start-new__title { ' + uiAnimClass + ' animation-delay: 0.16s; width: 100% !important; display: flex !important; justify-content: center !important; align-items: center !important; margin: 0 !important; min-height: 60px; order: 2; overflow: visible !important; } ';
        css += '.full-start-new__title img { height: auto !important; max-height: ' + lHeight + 'px !important; width: auto !important; max-width: 90vw !important; object-fit: contain !important; filter: drop-shadow(0 4px 20px rgba(0,0,0,0.9)); margin: 0 !important; } ';
        
        // Слоган
        css += '.full-start-new__tagline { ' + uiAnimClass + ' animation-delay: 0.24s; display: ' + (showTagline ? 'block' : 'none') + ' !important; font-style: italic !important; opacity: 0; font-size: 1.05em !important; margin: -2px 0 0 0 !important; color: rgba(255,255,255,0.85) !important; text-align: center !important; order: 3; } ';
        
        // Блок студій
        css += '.plugin-info-block { ' + uiAnimClass + ' animation-delay: 0.32s; display: flex; flex-direction: column; align-items: center; gap: ' + blocksGap + '; margin: 0 !important; width: 100%; order: 4; } ';
        
        // Рейтинги, тривалість, жанри
        css += '.plugin-ratings-row { ' + uiAnimClass + ' animation-delay: 0.40s; display: flex; justify-content: center; align-items: center; flex-wrap: nowrap; gap: 12px; margin: 0 !important; font-size: calc(' + rSize + ' * 2.8); width: 100%; order: 5; color: #fff; font-family: "Inter", -apple-system, system-ui, sans-serif; letter-spacing: 0.02em; } ';
        
        // Іконки якості
        css += '.quality-row-inline { ' + uiAnimClass + ' animation-delay: 0.48s; display: flex; justify-content: center; align-items: center; gap: 8px; width: 100%; order: 6; margin-top: 2px !important; opacity: 0.75; } '; 
        
        css += '.plugin-rating-item { display: flex; align-items: center; gap: 4px; font-weight: 700; } ';
        css += '.plugin-rating-item img { height: 1.1em; width: auto; } ';
        css += '.info-text-item { opacity: 0.9; font-weight: 500; font-size: 0.85em; white-space: nowrap; } ';
        css += '.info-separator { opacity: 0.3; font-size: 0.8em; margin: 0 -2px; } ';
        css += '.quality-item { height: 1.4em; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3)); } '; 
        css += '.quality-item img { height: 100%; width: auto; object-fit: contain; } ';

        // Стилі студій
        css += '.studio-row { display: flex; justify-content: center; align-items: center; flex-wrap: nowrap !important; overflow: hidden; gap: 12px; width: 100%; } ';
        css += '.studio-item { height: 2.2em !important; padding: 4px 10px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; ';
        if (bgOpacity !== '0') {
            css += 'background: rgba(255, 255, 255, ' + bgOpacity + '); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); ';
        }
        css += '} ';
        css += '.studio-item img { height: 100%; width: auto; max-height: 100%; object-fit: contain; filter: drop-shadow(0 1px 3px rgba(0,0,0,0.5)); } ';

        // Кнопки дій
        css += '.full-start-new__buttons { ' + uiAnimClass + ' animation-delay: 0.56s; display: flex !important; justify-content: center !important; gap: 12px !important; width: 100% !important; margin-top: 6px !important; order: 7; } ';
        css += '.full-start-new .full-start__button { background: none !important; border: none !important; box-shadow: none !important; display: flex !important; flex-direction: column !important; align-items: center !important; width: 60px !important; transition: transform 0.2s ease, opacity 0.2s ease; } ';
        css += '.full-start-new .full-start__button:active { transform: scale(0.9); opacity: 0.7; } ';
        css += '.full-start-new .full-start__button svg, .full-start-new .full-start__button img { width: 24px !important; height: 24px !important; margin-bottom: 5px !important; fill: #fff !important; filter: drop-shadow(0 2px 8px rgba(0,0,0,0.5)); } ';
        css += '.full-start-new .full-start__button span { font-size: 8px !important; text-transform: uppercase !important; opacity: 0.75 !important; font-weight: 600; letter-spacing: 0.05em; } ';
        css += '} ';

        style.textContent = css;
        document.head.appendChild(style);
    }

    /**
     * ЛОГІКА РЕЙТИНГІВ ТА ІНФОРМАЦІЇ
     */
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
        if (!e.data || !e.data.reactions || !e.data.reactions.result) return null;
        var reactionCoef = { fire: 10, nice: 7.5, think: 5, bore: 2.5, shit: 0 };
        var sum = 0, cnt = 0;
        e.data.reactions.result.forEach(function(r) {
            if (r.counter) { sum += (r.counter * reactionCoef[r.type]); cnt += r.counter; }
        });
        if (cnt >= 5) {
            var isTv = e.object.method === 'tv', avg = isTv ? 7.4 : 6.5, m = isTv ? 50 : 150;
            return ((avg * m + sum) / (m + cnt)).toFixed(1);
        }
        return null;
    }

    function renderRatings(container, e) {
        container.find('.plugin-ratings-row').remove();
        container.find('.quality-row-inline').remove();
        
        var $row = $('<div class="plugin-ratings-row"></div>');
        var sep = '<span class="info-separator">•</span>';
        
        var tmdb = parseFloat(e.data.movie.vote_average || 0).toFixed(1);
        if (tmdb > 0) {
            $row.append('<div class="plugin-rating-item"><img src="'+ratingIcons.tmdb+'"> <span style="color:'+getRatingColor(tmdb)+'">'+tmdb+'</span></div>');
        }
        
        var cub = getCubRating(e);
        if (cub) {
            if ($row.children().length > 0) $row.append(sep);
            $row.append('<div class="plugin-rating-item"><img src="' + ratingIcons.cub + '"> <span style="color:' + getRatingColor(cub) + '">' + cub + '</span></div>');
        }
        
        var runtime = e.data.movie.runtime || (e.data.movie.episode_run_time ? e.data.movie.episode_run_time[0] : 0);
        if (runtime) {
            if ($row.children().length > 0) $row.append(sep);
            $row.append('<div class="info-text-item">' + formatTime(runtime) + '</div>');
        }

        if (e.data.movie.genres && e.data.movie.genres.length > 0) {
            if ($row.children().length > 0) $row.append(sep);
            var genres = e.data.movie.genres.slice(0, 2).map(function(g) { return g.name; }).join(', ');
            $row.append('<div class="info-text-item">' + genres + '</div>');
        }

        var $qRow = $('<div class="quality-row-inline"></div>');
        var $target = container.find('.plugin-info-block'); 
        $target.after($qRow).after($row);
    }

    function renderStudioLogos($container, data) {
        if (!Lampa.Storage.get('mobile_interface_studios')) return;
        $container.empty();
        
        var logos = [];
        [data.networks, data.production_companies].forEach(function(source) {
            if (source && Array.isArray(source)) {
                source.forEach(function(item) {
                    if (item && item.logo_path) {
                        var url = Lampa.TMDB.image('/t/p/w200' + item.logo_path);
                        if (!logos.some(function(l) { return l.url === url; })) {
                            logos.push({ url: url, name: item.name });
                        }
                    }
                });
            }
        });

        if (logos.length === 0) {
            $container.parent().hide();
            return;
        }

        $container.parent().show();
        logos.slice(0, 4).forEach(function(logo) {
            var $item = $('<div class="studio-item"><img src="' + logo.url + '" alt="' + (logo.name || '') + '" loading="lazy"></div>');
            $item.find('img').on('error', function() {
                $item.remove();
            });
            $container.append($item);
        });
    }

    function getBestResults(results) {
        var best = { resolution: null, hdr: false, dolbyVision: false, dub: false, ukr: false };
        if (!results) return best;
        results.slice(0, 15).forEach(function(item) {
            var t = (item.Title || '').toLowerCase();
            if (t.indexOf('ukr')>=0 || t.indexOf('укр')>=0) best.ukr = true;
            var res = t.indexOf('4k')>=0 ? '4K' : t.indexOf('2k')>=0 ? '2K' : t.indexOf('1080')>=0 ? 'FULL HD' : t.indexOf('720')>=0 ? 'HD' : null;
            if (res && (!best.resolution || ['HD', 'FULL HD', '2K', '4K'].indexOf(res) > ['HD', 'FULL HD', '2K', '4K'].indexOf(best.resolution))) best.resolution = res;
            if (t.indexOf('vision')>=0 || t.indexOf(' dv ')>=0) best.dolbyVision = true;
            if (t.indexOf('hdr')>=0) best.hdr = true;
            if (t.indexOf('dub')>=0 || t.indexOf('дуб')>=0) best.dub = true;
        });
        return best;
    }

    function loadMovieLogo(movie, $container) {
        var movieId = movie.id + (movie.name ? '_tv' : '_movie');
        if (logoCache[movieId]) { 
            $container.html('<img src="' + logoCache[movieId] + '">'); 
            return; 
        }
        $.ajax({
            url: 'https://api.themoviedb.org/3/' + (movie.name ? 'tv' : 'movie') + '/' + movie.id + '/images?api_key=' + Lampa.TMDB.key(),
            success: function(res) {
                var lang = Lampa.Storage.get('language') || 'uk';
                var logo = res.logos.filter(function(l) { return l.iso_639_1 === lang; })[0] || 
                           res.logos.filter(function(l) { return l.iso_639_1 === 'en'; })[0] || 
                           res.logos[0];
                
                if (logo) {
                    var url = Lampa.TMDB.image('/t/p/' + Lampa.Storage.get('mobile_interface_logo_quality', 'w500') + logo.file_path.replace('.svg', '.png'));
                    logoCache[movieId] = url; 
                    $container.html('<img src="' + url + '">');
                }

                if (res.backdrops && res.backdrops.length > 1) {
                    var cleanBackdrops = res.backdrops.filter(function(b) {
                        return b.aspect_ratio > 1.5; 
                    });

                    if (cleanBackdrops.length > 0) {
                        startPosterSlideshow($('.full-start-new__poster'), cleanBackdrops.slice(0, 15));
                    }
                }
            }
        });
    }

    function startPosterSlideshow($poster, items) {
        if (!Lampa.Storage.get('mobile_interface_slideshow')) return;
        var index = 0; 
        stopSlideshow();

        slideshowTimer = setInterval(function() {
            index = (index + 1) % items.length;
            var imgUrl = Lampa.TMDB.image('/t/p/' + Lampa.Storage.get('mobile_interface_slideshow_quality', 'w780') + items[index].file_path);
            var $current = $poster.find('img').first();
            var nextImg = new Image();
            nextImg.onload = function() {
                var $next = $('<img src="' + imgUrl + '" style="opacity: 0; transition: opacity 1.2s ease-in-out;">');
                $poster.append($next);
                setTimeout(function() { 
                    $next.css('opacity', '1'); 
                    $current.css('opacity', '0'); 
                    setTimeout(function(){ $current.remove(); }, 1200); 
                }, 100);
            }; 
            nextImg.src = imgUrl;
        }, parseInt(Lampa.Storage.get('mobile_interface_slideshow_time', '10000')));
    }

    function init() {
        Lampa.Listener.follow('full', function (e) {
            if (e.type === 'destroy') {
                stopSlideshow();
            }
            
            if (window.innerWidth <= 480 && (e.type === 'complite' || e.type === 'complete')) {
                stopSlideshow(); 
                
                var movie = e.data.movie, $render = e.object.activity.render();
                
                if (window.lampa_settings) window.lampa_settings.blur_poster = false;

                loadMovieLogo(movie, $render.find('.full-start-new__title'));
                
                // Гарантоване перестворення контейнерів
                $render.find('.plugin-info-block').remove();
                var $info = $('<div class="plugin-info-block"><div class="studio-row"></div></div>');
                $render.find('.full-start-new__right').append($info);
                
                renderStudioLogos($info.find('.studio-row'), movie);
                renderRatings($render.find('.full-start-new__right'), e);

                if (Lampa.Storage.get('mobile_interface_quality') && Lampa.Parser && Lampa.Parser.get) {
                    Lampa.Parser.get({ search: movie.title || movie.name, movie: movie, page: 1 }, function(res) {
                        if (res && Array.isArray(res.Results)) {
                            var b = getBestResults(res.Results), list = [];
                            if (b.resolution) list.push(b.resolution);
                            if (b.dolbyVision) list.push('Dolby Vision'); else if (b.hdr) list.push('HDR');
                            if (b.dub) list.push('DUB'); if (b.ukr) list.push('UKR');
                            
                            var $qRow = $render.find('.quality-row-inline');
                            $qRow.empty();
                            list.forEach(function(t) { 
                                if (svgIcons[t]) $qRow.append('<div class="quality-item"><img src="' + svgIcons[t] + '"></div>'); 
                            });
                        }
                    });
                }
            }
        });
    }

    /**
     * ПАНЕЛЬ НАЛАШТУВАНЬ
     */
    function setupSettings() {
        Lampa.SettingsApi.addComponent({ component: 'mobile_interface', name: 'Мобільний інтерфейс', icon: '<svg height="36" viewBox="0 0 24 24" width="36" xmlns="http://www.w3.org/2000/svg"><path d="M17 1.01L7 1c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99zM17 19H7V5h10v14z" fill="white"/></svg>' });
        Lampa.SettingsApi.addParam({ component: 'mobile_interface', param: { name: 'mobile_interface_animation', type: 'trigger', default: true }, field: { name: 'Анімація постера' }, onChange: applyStyles });
        Lampa.SettingsApi.addParam({ component: 'mobile_interface', param: { name: 'mobile_interface_ui_anim', type: 'trigger', default: true }, field: { name: 'Анімація елементів' }, onChange: applyStyles });
        Lampa.SettingsApi.addParam({ component: 'mobile_interface', param: { name: 'mobile_interface_slideshow', type: 'trigger', default: true }, field: { name: 'Слайд-шоу постера' } });
        Lampa.SettingsApi.addParam({ component: 'mobile_interface', param: { name: 'mobile_interface_slideshow_time', type: 'select', values: { '10000': '10с', '15000': '15с', '20000': '20с' }, default: '10000' }, field: { name: 'Інтервал слайд-шоу' } });
        Lampa.SettingsApi.addParam({ component: 'mobile_interface', param: { name: 'mobile_interface_logo_size_v2', type: 'select', values: { '125': 'Малий', '150': 'Середній', '180': 'Стандартний', '210': 'Великий' }, default: '125' }, field: { name: 'Висота логотипу' }, onChange: applyStyles });
        Lampa.SettingsApi.addParam({ component: 'mobile_interface', param: { name: 'mobile_interface_show_tagline', type: 'trigger', default: true }, field: { name: 'Показувати слоган' }, onChange: applyStyles });
        Lampa.SettingsApi.addParam({ component: 'mobile_interface', param: { name: 'mobile_interface_blocks_gap', type: 'select', values: { '8px': 'Компактний', '12px': 'Стандартний', '18px': 'Просторий', '24px': 'Панорамний' }, default: '8px' }, field: { name: 'Відступи між блоками' }, onChange: applyStyles });
        Lampa.SettingsApi.addParam({ component: 'mobile_interface', param: { name: 'mobile_interface_ratings_size', type: 'select', values: { '0.4em': 'Малий', '0.45em': 'Середній', '0.5em': 'Великий', '0.55em': 'Максимальний' }, default: '0.45em' }, field: { name: 'Розмір рейтингів' }, onChange: applyStyles });
        Lampa.SettingsApi.addParam({ component: 'mobile_interface', param: { name: 'mobile_interface_studios', type: 'trigger', default: true }, field: { name: 'Показувати студії' } });
        Lampa.SettingsApi.addParam({ component: 'mobile_interface', param: { name: 'mobile_interface_studios_bg_opacity', type: 'select', values: { '0': 'Вимкнено', '0.08': 'Легкий', '0.2': 'Середній', '0.4': 'Світлий' }, default: '0.15' }, field: { name: 'Фон студій' }, onChange: applyStyles });
        Lampa.SettingsApi.addParam({ component: 'mobile_interface', param: { name: 'mobile_interface_quality', type: 'trigger', default: true }, field: { name: 'Показувати якість' } });
    }

    function startPlugin() {
        applyStyles(); 
        setupSettings(); 
        init();
    }

    if (window.appready) startPlugin();
    else Lampa.Listener.follow('app', function (e) { if (e.type === 'ready') startPlugin(); });
})();
