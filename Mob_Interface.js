
(function () {
    'use strict';

    /* MOB_INTERFACE 3.1.4 — Lampa mobile movie interface */
    if (window.MOB_INTERFACE_V314_READY) return;
    window.MOB_INTERFACE_V314_READY = true;

    var VERSION = '3.1.4';
    var STYLE_ID = 'mobile-interface-styles';
    var pluginPath = 'https://crowley24.github.io/Icons/';
    var slideshowTimer = null;
    var detailsCache = {};
    var currentActiveId = null;
    var requestSequence = 0;
    var cleanupObserver = null;
    var cleanupTimer = null;
    var cleanupBusy = false;
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

    settings_list.forEach(function (option) {
        if (Lampa.Storage.get(option.id, 'unset') === 'unset') {
            Lampa.Storage.set(option.id, option.default);
        }
    });

    var eliteBadgesConfig = [
        { id: '4k-ultra-hd', pattern: /\b(4k|2160p|uhd|ultra\s*hd)\b/i, imageURL: 'https://raw.githubusercontent.com/leonevz/Elite-Badges/main/Badges/4k_ultra_hd.png', group: 'resolution', priority: 3 },
        { id: '1080p-full-hd', pattern: /\b(1080p|fhd|full\s*hd)\b/i, imageURL: 'https://raw.githubusercontent.com/leonevz/Elite-Badges/main/Badges/1080p_full_hd.png', group: 'resolution', priority: 2 },
        { id: '720p-hd', pattern: /\b720p\b/i, imageURL: 'https://raw.githubusercontent.com/leonevz/Elite-Badges/main/Badges/720p_hd.png', group: 'resolution', priority: 1 },
        { id: 'dolby-vision', pattern: /\b(dolby\s*vision|dovi|dv)\b/i, imageURL: 'https://raw.githubusercontent.com/leonevz/Elite-Badges/main/Badges/dolby_vision.png' },
        { id: 'hdr', pattern: /\b(hdr10\+|hdr10\s*plus|hdr\s*10\s*\+|hdr10|hdr\s*10|hdr)\b/i, imageURL: 'https://raw.githubusercontent.com/leonevz/Elite-Badges/main/Badges/hdr.png', group: 'hdr' },
        { id: 'sdr', pattern: /\bsdr\b/i, imageURL: 'https://raw.githubusercontent.com/leonevz/Elite-Badges/main/Badges/SDR_transparent_4x.png' },
        { id: 'dolby-atmos', pattern: /\b(dolby\s*atmos|atmos)\b/i, imageURL: 'https://raw.githubusercontent.com/leonevz/Elite-Badges/main/Badges/dolby_atmos.png' },
        { id: 'truehd', pattern: /\b(truehd|true\s*hd|dolby\s*truehd)\b/i, imageURL: 'https://raw.githubusercontent.com/leonevz/Elite-Badges/main/Badges/truehd.png' },
        { id: 'dolby-digital-plus', pattern: /\b(ddp[\s._-]*[0-9][\s._-]*[0-9]|ddp|dd\+|dolby[\s._-]*digital[\s._-]*plus|e-?ac-?3)(?![a-z])/i, imageURL: 'https://raw.githubusercontent.com/leonevz/Elite-Badges/main/Badges/dolby_digital_plus.png' },
        { id: 'dolby-digital', pattern: /\b(dd[\s._-]*[0-9][\s._-]*[0-9]|dd|dolby[\s._-]*digital|ac-?3)(?![\s._-]*plus|\+|p|[a-z])/i, imageURL: 'https://raw.githubusercontent.com/leonevz/Elite-Badges/main/Badges/dolby_digital.png' },
        { id: 'dts-hd-master-audio', pattern: /\b(dts[\s._-]*hd[\s._-]*ma|dtshd\s*ma|dts[\s._-]*hd[\s._-]*master)\b/i, imageURL: 'https://raw.githubusercontent.com/leonevz/Elite-Badges/main/Badges/dts_hd_master_audio.png' },
        { id: 'dts-hd', pattern: /\b(dts[\s._-]*hd|dtshd)(?![\s._-]*(ma|master)|ma)\b/i, imageURL: 'https://raw.githubusercontent.com/leonevz/Elite-Badges/main/Badges/dts_hd.png' },
        { id: 'dts', pattern: /\bdts\b(?![\s._:-]*(x|hd))/i, imageURL: 'https://raw.githubusercontent.com/leonevz/Elite-Badges/main/Badges/dts.png' }
    ];

    var ratingIcons = {
        tmdb: 'https://upload.wikimedia.org/wikipedia/commons/8/89/Tmdb.new.logo.svg',
        cub: 'https://raw.githubusercontent.com/yumata/lampa/9381985ad4371d2a7d5eb5ca8e3daf0f32669eb7/img/logo-icon.svg'
    };

    function enabled(id) {
        var value = Lampa.Storage.get(id);
        return value === true || value === 'true' || value === 1;
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

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

    function stopCleanupObserver() {
        if (cleanupObserver) {
            cleanupObserver.disconnect();
            cleanupObserver = null;
        }
        if (cleanupTimer) {
            clearTimeout(cleanupTimer);
            cleanupTimer = null;
        }
    }

    function isProtectedElement(element) {
        if (!element || element.nodeType !== 1) return true;
        return !!$(element).closest(
            '.plugin-meta-row,.quality-row-inline,.studio-header-brand,' +
            '.full-start-new__title,.full-start-new__tagline,' +
            '.full-start-new__buttons,.full-start-new__poster,.full-start__button'
        ).length;
    }

    function isStandardInfoText(text) {
        text = String(text || '').replace(/\s+/g, ' ').trim();
        if (!text || text.length > 100) return false;
        if (/^(19|20)\d{2}$/.test(text)) return true;
        if (/^(19|20)\d{2}\s*[,·•|]\s*.+$/.test(text)) return true;
        if (/^(0|3|6|7|10|12|13|14|15|16|17|18|21)\s*\+$/.test(text)) return true;
        if (/^(PG|PG-13|R|NC-17|TV-MA|TV-14|TV-PG|G)$/i.test(text)) return true;
        if (/^(Великобританія|Сполучене Королівство|США|Україна|Канада|Франція|Німеччина|Іспанія|Італія|Японія|Південна Корея|United Kingdom|United States|USA|UK|Canada|France|Germany|Spain|Italy|Japan)$/i.test(text)) return true;
        // Compatible with older Android WebView.
        if (/^[,،]\s*[A-Za-zА-Яа-яІіЇїЄєҐґЁё][A-Za-zА-Яа-яІіЇїЄєҐґЁё\s,.'’()-]*$/.test(text)) return true;
        return false;
    }

    function isLikelyStandardInfoClass(element) {
        var cls = typeof element.className === 'string' ? element.className : '';
        if (cls.indexOf('plugin-') !== -1) return false;
        return /(?:^|[\s_-])(age|year|country|info|meta|details|status|pg|pgs|certification|released)(?:$|[\s_-])/i.test(cls);
    }

    function getSafeHideTarget(element, root) {
        if (!element || !root) return null;
        var candidate = element;
        var current = element;
        for (var depth = 0; depth < 3; depth++) {
            var parent = current.parentElement;
            if (!parent || parent === root) break;
            if (parent.classList.contains('full-start-new__right') ||
                parent.classList.contains('full-start-new__left') ||
                parent.classList.contains('full-start-new__title') ||
                parent.classList.contains('full-start-new__buttons')) break;
            if (isProtectedElement(parent)) break;
            var parentText = String(parent.textContent || '').replace(/\s+/g, ' ').trim();
            if (!isStandardInfoText(parentText)) break;
            if (parent.querySelector('button,a,input,video,.plugin-meta-row,.studio-header-brand')) break;
            if (isLikelyStandardInfoClass(parent)) candidate = parent;
            current = parent;
        }
        return candidate;
    }

    function hideStandardMetadata($render) {
        if (!$render || !$render.length || window.innerWidth > 480 || cleanupBusy) return;
        var $card = $render.find('.full-start-new').first();
        if (!$card.length) return;
        var root = $card[0];
        var title = $card.find('.full-start-new__title').first()[0];
        if (!title) return;
        cleanupBusy = true;
        try {
            var standardSelectors = [
                '.full-start-new__age', '.full-start__age',
                '.full-start-new__status', '.full-start__status',
                '.full-start-new__details', '.full-start__details',
                '.full-start__info', '.full-start-new__info',
                '.full-start-new__meta', '.full-start-new__year',
                '.full-start-new__country', '.full-start-new__certification'
            ].join(',');
            $card.find(standardSelectors).each(function () {
                if (isProtectedElement(this)) return;
                if ($(this).find('.full-start-new__title,.full-start-new__buttons,.plugin-meta-row').length) return;
                $(this).addClass('mi312-standard-hidden');
            });

            var walker = document.createTreeWalker(root, 4, null, false);
            var matches = [];
            var node;
            while ((node = walker.nextNode())) {
                var text = String(node.nodeValue || '').trim();
                if (!isStandardInfoText(text)) continue;
                var element = node.parentElement;
                if (!element || isProtectedElement(element)) continue;
                var position = element.compareDocumentPosition(title);
                var beforeTitle = !!(position & 4);
                var hasStandardClass = isLikelyStandardInfoClass(element) ||
                    !!$(element).parentsUntil(root).filter(function () {
                        return isLikelyStandardInfoClass(this);
                    }).length;
                if (!beforeTitle && !hasStandardClass) continue;
                if ($(element).closest('button,a,input,select,textarea,.full-start-new__buttons,.full-start__button').length) continue;
                matches.push(element);
            }
            matches.forEach(function (element) {
                var target = getSafeHideTarget(element, root);
                if (!target || isProtectedElement(target)) return;
                $(target).addClass('mi312-standard-hidden');
            });
        } catch (error) {
            console.warn('[MOB_INTERFACE] Metadata cleanup:', error);
        } finally {
            cleanupBusy = false;
        }
    }

    function scheduleMetadataCleanup($render) {
        if (cleanupTimer) clearTimeout(cleanupTimer);
        cleanupTimer = setTimeout(function () {
            cleanupTimer = null;
            hideStandardMetadata($render);
        }, 80);
    }

    function watchStandardMetadata($render) {
        stopCleanupObserver();
        var $card = $render.find('.full-start-new').first();
        if (!$card.length) return;
        hideStandardMetadata($render);
        if (typeof MutationObserver === 'undefined') return;
        cleanupObserver = new MutationObserver(function (mutations) {
            var shouldCheck = false;
            for (var i = 0; i < mutations.length; i++) {
                var mutation = mutations[i];
                var target = mutation.target.nodeType === 3 ? mutation.target.parentElement : mutation.target;
                if (!target || isProtectedElement(target)) continue;
                if (target.nodeType === 1 && $(target).closest('.full-start-new__poster,.quality-row-inline').length) continue;
                if (mutation.type === 'characterData') {
                    shouldCheck = true;
                    break;
                }
                if (mutation.type === 'childList') {
                    // Ignore plugin-owned updates.
                    var nodes = [].slice.call(mutation.addedNodes || []);
                    if (!nodes.length) continue;
                    var pluginOnly = nodes.every(function (item) {
                        if (item.nodeType !== 1) return false;
                        return $(item).is('.plugin-meta-row,.quality-row-inline,.studio-header-brand') ||
                            !!$(item).closest('.plugin-meta-row,.quality-row-inline,.studio-header-brand').length;
                    });
                    if (!pluginOnly) {
                        shouldCheck = true;
                        break;
                    }
                }
            }
            if (shouldCheck) scheduleMetadataCleanup($render);
        });
        cleanupObserver.observe($card[0], { childList: true, subtree: true, characterData: true });
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
                var data = ctx.getImageData(0, 0, 40, 40).data;
                var brightness = 0;
                var colored = false;
                var count = 0;
                for (var i = 0; i < data.length; i += 4) {
                    if (data[i + 3] <= 50) continue;
                    var r = data[i], g = data[i + 1], b = data[i + 2];
                    brightness += (r * 299 + g * 587 + b * 114) / 1000;
                    count++;
                    if (Math.max(r, g, b) - Math.min(r, g, b) > 30) colored = true;
                }
                callback((count ? brightness / count : 255) < 110 && !colored);
            } catch (error) { callback(false); }
        };
        img.onerror = function () { callback(false); };
        img.src = imgSrc;
    }

    function applyStyles() {
        var style = document.getElementById(STYLE_ID);
        if (!style) {
            style = document.createElement('style');
            style.id = STYLE_ID;
            document.head.appendChild(style);
        }
        var posterAnim = enabled('mobile_interface_animation');
        var uiAnim = enabled('mobile_interface_ui_anim');
        var effect = Lampa.Storage.get('mobile_interface_ui_anim_effect', 'fluid');
        var badgeAnim = Lampa.Storage.get('mobile_interface_badge_anim', 'pulse');
        var ratingSize = Lampa.Storage.get('mobile_interface_ratings_size', '0.45em');
        var logoHeight = parseInt(Lampa.Storage.get('mobile_interface_logo_size_v2', '125'), 10);
        var gap = Lampa.Storage.get('mobile_interface_blocks_gap', '8px');
        var tagline = enabled('mobile_interface_show_tagline');
        if ([125, 150, 180, 210].indexOf(logoHeight) < 0) logoHeight = 125;
        if (!/^(8|12|18|24)px$/.test(gap)) gap = '8px';
        if (!/^(0\.4|0\.45|0\.5|0\.55)em$/.test(ratingSize)) ratingSize = '0.45em';
        var effects = { fluid: 'mi313_fluid', cyber: 'mi313_cyber', cinematic: 'mi313_cinematic', elastic: 'mi313_elastic', minimal: 'mi313_minimal' };
        var animationName = effects[effect] || effects.fluid;
        var timing = effect === 'elastic' ? 'cubic-bezier(.34,1.56,.64,1)' : 'cubic-bezier(.16,1,.3,1)';
        var appearance = uiAnim ? 'animation:' + animationName + ' .8s ' + timing + ' forwards;opacity:0;' : '';
        var css = '';
        css += '@keyframes mi313_kenBurns{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}';
        css += '@keyframes mi313_fluid{from{opacity:0;transform:translateY(25px) scale(.95);filter:blur(10px)}to{opacity:1;transform:none;filter:blur(0)}}';
        css += '@keyframes mi313_cyber{from{opacity:0;transform:translateX(-40px) scale(.9);filter:brightness(1.5)}to{opacity:1;transform:none;filter:brightness(1)}}';
        css += '@keyframes mi313_cinematic{from{opacity:0;transform:translateY(15px) scale(1.08);filter:blur(6px)}to{opacity:1;transform:none;filter:blur(0)}}';
        css += '@keyframes mi313_elastic{0%{opacity:0;transform:scale(.7)}70%{opacity:1;transform:scale(1.04)}100%{opacity:1;transform:scale(1)}}';
        css += '@keyframes mi313_minimal{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}';
        css += '@keyframes mi313_wave{from{opacity:0;transform:scale(.5) translateY(10px);filter:blur(4px)}to{opacity:1;transform:none;filter:blur(0)}}';
        css += '@keyframes mi313_pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.1)}}';
        css += '@keyframes mi313_breathe{0%,100%{transform:scale(1);opacity:.85)50%{transform:scale(1.06);opacity:1}}';
        css += '@keyframes mi313_spin{0%,100%{transform:rotate(0)}25%{transform:rotate(4deg)}75%{transform:rotate(-4deg)}}';
        css += '@keyframes mi313_float{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}';
        css += '@keyframes mi313_posterFade{from{opacity:0;transform:scale(1.05)}to{opacity:1;transform:scale(1)}}';
        css += '@media screen and (max-width:480px){';
        css += '.full-start-new .mi312-standard-hidden{display:none!important;visibility:hidden!important;}';
        css += '.full-start-new .full-start__reactions,.full-start-new .full-start-new__reactions,.full-start-new [class*="reactions"],.full-start-new .full-start__rates,.full-start-new .rate--tmdb,.full-start-new .rate--imdb,.full-start-new .rate--kp{display:none!important;}';
        css += '.full-start-new{position:relative!important;}';
        css += '.full-start-new__poster{position:relative!important;overflow:hidden!important;background:#000;z-index:1;height:62vh!important;';
        if (uiAnim) css += 'animation:mi313_posterFade .9s cubic-bezier(.16,1,.3,1) forwards;';
        css += '}';
        css += '.full-start-new__poster img{filter:none!important;';
        if (posterAnim) css += 'animation:mi313_kenBurns 25s ease-in-out infinite!important;';
        css += 'transform-origin:center!important;transition:opacity 1.2s ease-in-out!important;position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;mask-image:linear-gradient(to bottom,#000 0%,#000 55%,transparent 100%)!important;-webkit-mask-image:linear-gradient(to bottom,#000 0%,#000 55%,transparent 100%)!important;}';
        css += '.full-start-new__right{background:none!important;margin-top:-160px!important;z-index:2!important;display:flex!important;flex-direction:column!important;align-items:center!important;padding:0 10px!important;gap:' + gap + '!important;position:relative!important;}';
        css += '.full-start-new .quality-row-inline{position:absolute;top:30px;right:12px;z-index:99;display:flex;flex-direction:column;align-items:flex-end;gap:4px;pointer-events:none;}';
        css += '.full-start-new .studio-header-brand{' + appearance + 'animation-delay:.08s;order:1;width:100%;display:flex;justify-content:flex-start;align-items:center;padding-left:5vw;margin-bottom:-2px!important;}';
        css += '.full-start-new .studio-header-brand img{height:18px!important;width:auto;max-width:110px;object-fit:contain;filter:drop-shadow(0 2px 5px rgba(0,0,0,.9));opacity:.95;}';
        css += '.full-start-new .studio-header-brand img.is-dark-logo{filter:brightness(0) invert(1) drop-shadow(0 2px 4px rgba(0,0,0,.8))!important;}';
        css += '.full-start-new .full-start-new__title{' + appearance + 'animation-delay:.15s;width:100%!important;display:flex!important;justify-content:center!important;align-items:center!important;margin:0!important;min-height:50px;order:2;overflow:visible!important;}';
        css += '.full-start-new .full-start-new__title img{height:auto!important;max-height:' + logoHeight + 'px!important;width:auto!important;max-width:90vw!important;object-fit:contain!important;filter:drop-shadow(0 4px 20px rgba(0,0,0,.9));margin:0!important;}';
        css += '.full-start-new .full-start-new__tagline{' + appearance + 'animation-delay:.22s;display:' + (tagline ? 'block' : 'none') + '!important;font-style:italic!important;font-size:.9em!important;margin:0!important;color:rgba(255,255,255,.8)!important;text-align:center!important;order:3;}';
        css += '.full-start-new .plugin-meta-row{' + appearance + 'animation-delay:.28s;display:flex;justify-content:center;align-items:center;flex-wrap:nowrap;gap:8px;margin:0!important;font-size:calc(' + ratingSize + ' * 2.5);width:100%;order:4;color:rgba(255,255,255,.85);font-family:Inter,-apple-system,system-ui,sans-serif;}';
        css += '.full-start-new .info-text-item{opacity:.9;font-weight:500;font-size:.85em;white-space:nowrap;}';
        css += '.full-start-new .info-separator{opacity:.35;font-size:.8em;margin:0 -2px;}';
        css += '.full-start-new .full-start-new__buttons{' + appearance + 'animation-delay:.42s;display:flex!important;justify-content:space-around!important;align-items:center!important;width:100%!important;max-width:100%!important;padding:0 4px!important;box-sizing:border-box!important;margin-top:4px!important;order:6;}';
        css += '.full-start-new .full-start__button{background:none!important;border:none!important;box-shadow:none!important;display:flex!important;flex-direction:column!important;align-items:center!important;width:42px!important;min-width:36px!important;padding:0!important;transition:transform .2s ease,opacity .2s ease;}';
        css += '.full-start-new .full-start__button:active{transform:scale(.9);opacity:.7;}';
        css += '.full-start-new .full-start__button svg,.full-start-new .full-start__button img{width:24px!important;height:24px!important;margin-bottom:4px!important;fill:#fff!important;filter:drop-shadow(0 2px 8px rgba(0,0,0,.5));}';
        css += '.full-start-new .full-start__button span{font-size:9px!important;text-transform:uppercase!important;opacity:.75!important;font-weight:600;letter-spacing:.05em;}';
        var badgeAnimations = { pulse: 'mi313_pulse', breathe: 'mi313_breathe', spin_slow: 'mi313_spin', float: 'mi313_float' };
        var badgeName = badgeAnimations[badgeAnim] || '';
        var badgeDuration = badgeAnim === 'spin_slow' ? '4s' : (badgeAnim === 'breathe' ? '3s' : '2.5s');
        css += '.full-start-new .wave-item{transform-origin:center;filter:drop-shadow(0 2px 4px rgba(0,0,0,.3));';
        if (uiAnim) {
            css += 'opacity:0;animation:mi313_wave .5s cubic-bezier(.16,1,.3,1) forwards';
            if (badgeName) {
                css += ',' + badgeName + ' ' + badgeDuration + ' ease-in-out infinite;animation-delay:calc(.35s + var(--item-index) * .08s),calc(1s + var(--item-index) * .15s)';
            } else {
                css += ';animation-delay:calc(.35s + var(--item-index) * .08s)';
            }
            css += ';';
        } else if (badgeName) {
            css += 'animation:' + badgeName + ' ' + badgeDuration + ' ease-in-out infinite;';
        }
        css += '}';
        css += '.full-start-new .quality-row-inline .plugin-rating-item{display:flex;align-items:center;gap:4px;font-weight:700;color:#fff;font-size:.95em;padding:2px 0;}';
        css += '.full-start-new .quality-row-inline .plugin-rating-item img{height:1em;width:auto;}';
        css += '.full-start-new .quality-item{transform-origin:center;filter:drop-shadow(0 2px 5px rgba(0,0,0,.8));height:1.15em;display:flex;align-items:center;justify-content:flex-end;}';
        css += '.full-start-new .quality-item img{height:100%;width:auto;max-width:60px;object-fit:contain;}';
        css += '}';
        style.textContent = css;
    }

    function getRatingColor(value) {
        var n = parseFloat(value);
        if (n >= 7.5) return '#2ecc71';
        if (n >= 6) return '#feca57';
        if (n > 0) return '#ff4d4d';
        return '#fff';
    }

    function formatTime(mins) {
        mins = parseInt(mins, 10);
        if (!mins) return '';
        var hours = Math.floor(mins / 60);
        var minutes = mins % 60;
        return (hours ? hours + 'г ' : '') + minutes + 'хв';
    }

    function getCubRating(e) {
        if (!e.data || !e.data.reactions || !e.data.reactions.result) return null;
        var coefficients = { fire: 10, nice: 7.5, think: 5, bore: 2.5, shit: 0 };
        var sum = 0, count = 0;
        e.data.reactions.result.forEach(function (reaction) {
            if (reaction.counter && Object.prototype.hasOwnProperty.call(coefficients, reaction.type)) {
                sum += reaction.counter * coefficients[reaction.type];
                count += reaction.counter;
            }
        });
        if (count < 5) return null;
        var isTv = e.object.method === 'tv';
        var average = isTv ? 7.4 : 6.5;
        var weight = isTv ? 50 : 150;
        return ((average * weight + sum) / (weight + count)).toFixed(1);
    }

    function renderMeta($container, movie) {
        if (!$container || !$container.length) return;
        $container.find('.plugin-meta-row').remove();
        var $row = $('<div class="plugin-meta-row"></div>');
        function appendValue(value) {
            if (!value) return;
            if ($row.children().length) $row.append('<span class="info-separator">•</span>');
            $row.append('<div class="info-text-item">' + escapeHtml(value) + '</div>');
        }
        var date = movie.release_date || movie.first_air_date || '';
        appendValue(date.substring(0, 4));
        var country = '';
        if (movie.production_countries && movie.production_countries.length) {
            country = movie.production_countries[0].name || movie.production_countries[0].iso_3166_1 || '';
        } else if (movie.origin_country && movie.origin_country.length) {
            country = movie.origin_country[0];
        }
        appendValue(country);
        var runtime = movie.runtime || (movie.episode_run_time && movie.episode_run_time.length ? movie.episode_run_time[0] : 0);
        appendValue(formatTime(runtime));
        if (movie.genres && movie.genres.length) {
            appendValue(movie.genres.slice(0, 2).map(function (genre) { return genre.name; }).join(', '));
        }
        $container.append($row);
    }

    function applyMovieDetailsData(data, movie, $render, requestId) {
        if (requestId !== requestSequence || currentActiveId !== movie.id) return;
        var $title = $render.find('.full-start-new__title').first();
        if (!$title.length) return;
        if (data.images && data.images.logos && data.images.logos.length) {
            var language = Lampa.Storage.get('language') || 'uk';
            var logo = data.images.logos.filter(function (item) { return item.iso_639_1 === language; })[0] ||
                data.images.logos.filter(function (item) { return item.iso_639_1 === 'en'; })[0] || data.images.logos[0];
            if (logo && logo.file_path) {
                var quality = Lampa.Storage.get('mobile_interface_logo_quality', 'w500');
                var path = logo.file_path.replace(/\.svg$/i, '.png');
                var url = Lampa.TMDB.image('/t/p/' + quality + path);
                $title.html('<img src="' + escapeHtml(url) + '" alt="' + escapeHtml(movie.title || movie.name || '') + '">');
            }
        }
        $render.find('.studio-header-brand').remove();
        if (enabled('mobile_interface_studios')) {
            var studio = null;
            if (data.networks && data.networks.length) {
                studio = data.networks.find(function (item) { return item.logo_path; });
            }
            if (!studio && data.production_companies && data.production_companies.length) {
                studio = data.production_companies.find(function (item) { return item.logo_path; });
            }
            if (studio && studio.logo_path) {
                var studioUrl = Lampa.TMDB.image('/t/p/w200' + studio.logo_path);
                var $brand = $('<div class="studio-header-brand"><img src="' + escapeHtml(studioUrl) + '" alt="' + escapeHtml(studio.name || '') + '"></div>');
                var $image = $brand.find('img');
                $image.on('error', function () { $brand.remove(); });
                $title.before($brand);
                isImageDark(studioUrl, function (dark) {
                    if (dark && $image.length && document.body.contains($image[0])) $image.addClass('is-dark-logo');
                });
            }
        }
        var $right = $render.find('.full-start-new__right').first();
        if ($right.length) renderMeta($right, $.extend({}, movie, data));
        hideStandardMetadata($render);
        if (data.images && data.images.backdrops) {
            var backdrops = data.images.backdrops.filter(function (item) {
                return item.aspect_ratio > 1.5 && (!item.iso_639_1 || item.iso_639_1 === 'xx');
            });
            if (!backdrops.length) {
                backdrops = data.images.backdrops.filter(function (item) { return item.aspect_ratio > 1.5; });
            }
            if (backdrops.length) {
                backdrops.sort(function (a, b) { return (b.vote_average || 0) - (a.vote_average || 0); });
                startPosterSlideshow($render.find('.full-start-new__poster').first(), backdrops.slice(0, 15));
            }
        }
    }

    function loadMovieDetails(movie, $render) {
        var movieId = movie.id;
        var requestId = ++requestSequence;
        currentActiveId = movieId;
        var type = (movie.name || movie.first_air_date) ? 'tv' : 'movie';
        var cacheKey = type + '_' + movieId;
        if (detailsCache[cacheKey]) {
            applyMovieDetailsData(detailsCache[cacheKey], movie, $render, requestId);
            return;
        }
        var url = 'https://api.themoviedb.org/3/' + type + '/' + movieId +
            '?api_key=' + encodeURIComponent(Lampa.TMDB.key()) +
            '&append_to_response=images&include_image_language=uk,en,null';
        $.ajax({
            url: url,
            type: 'GET',
            dataType: 'json',
            success: function (data) {
                if (requestId !== requestSequence || currentActiveId !== movieId) return;
                detailsCache[cacheKey] = data;
                applyMovieDetailsData(data, movie, $render, requestId);
            },
            error: function () {
                if (requestId === requestSequence) hideStandardMetadata($render);
            }
        });
    }

    function getEliteBadges(results) {
        if (!Array.isArray(results)) return [];
        var combined = '';
        results.slice(0, 15).forEach(function (item) { combined += ' ' + (item.Title || item.title || ''); });
        var matched = [];
        eliteBadgesConfig.forEach(function (badge) { if (badge.pattern.test(combined)) matched.push(badge); });
        var highest = null;
        matched.forEach(function (badge) {
            if (badge.group === 'resolution' && (!highest || badge.priority > highest.priority)) highest = badge;
        });
        var result = [];
        matched.forEach(function (badge) {
            if (badge.group !== 'resolution' || (highest && badge.id === highest.id)) result.push(badge.imageURL);
        });
        if (/ukr|укр/i.test(combined)) result.push(pluginPath + 'UKR.svg');
        if (/dub|дуб/i.test(combined)) result.push(pluginPath + 'DUB.svg');
        return result.filter(function (url, index, array) { return array.indexOf(url) === index; });
    }

    function startPosterSlideshow($poster, items) {
        stopSlideshow();
        if (!enabled('mobile_interface_slideshow') || !$poster || !$poster.length || !items || items.length < 2) return;
        var index = 0;
        var interval = parseInt(Lampa.Storage.get('mobile_interface_slideshow_time', '10000'), 10);
        if (!interval || interval < 1000) interval = 10000;
        slideshowTimer = setInterval(function () {
            if (!$poster.length || !document.body.contains($poster[0])) {
                stopSlideshow();
                return;
            }
            index = (index + 1) % items.length;
            var quality = Lampa.Storage.get('mobile_interface_slideshow_quality', 'w780');
            var imageUrl = Lampa.TMDB.image('/t/p/' + quality + items[index].file_path);
            var preload = new Image();
            preload.onload = function () {
                if (!$poster.length || !document.body.contains($poster[0])) return;
                var $current = $poster.find('img').last();
                var $next = $('<img>').attr('src', imageUrl).css({ opacity: 0, transition: 'opacity 1.2s ease-in-out' });
                $poster.append($next);
                setTimeout(function () {
                    if (!$next.length || !document.body.contains($next[0])) return;
                    $next.css('opacity', '1');
                    if ($current.length) {
                        $current.css('opacity', '0');
                        setTimeout(function () { $current.remove(); }, 1250);
                    }
                }, 100);
            };
            preload.onerror = function () {};
            preload.src = imageUrl;
        }, interval);
        window.mobileInterfaceBgInterval = slideshowTimer;
    }

    function renderQuality($render, movie, e) {
        var $card = $render.find('.full-start-new').first();
        if (!$card.length) return;
        $card.find('.quality-row-inline').remove();
        var $row = $('<div class="quality-row-inline"></div>');
        $card.append($row);
        var itemIndex = 0;
        var tmdb = parseFloat(movie.vote_average || 0).toFixed(1);
        if (parseFloat(tmdb) > 0) {
            var $tmdb = $('<div class="plugin-rating-item wave-item"><img src="' + ratingIcons.tmdb + '"><span style="color:' + getRatingColor(tmdb) + '">' + escapeHtml(tmdb) + '</span></div>');
            $tmdb.css('--item-index', itemIndex++);
            $row.append($tmdb);
        }
        var cub = getCubRating(e);
        if (cub) {
            var $cub = $('<div class="plugin-rating-item wave-item"><img src="' + ratingIcons.cub + '"><span style="color:' + getRatingColor(cub) + '">' + escapeHtml(cub) + '</span></div>');
            $cub.css('--item-index', itemIndex++);
            $row.append($cub);
        }
        if (!enabled('mobile_interface_quality') || !Lampa.Parser || !Lampa.Parser.get) return;
        var movieId = movie.id;
        var currentRequest = requestSequence;
        Lampa.Parser.get({ search: movie.title || movie.name, movie: movie, page: 1 }, function (response) {
            if (currentActiveId !== movieId || currentRequest !== requestSequence) return;
            if (!$row.length || !document.body.contains($row[0])) return;
            if (!response || !Array.isArray(response.Results)) return;
            getEliteBadges(response.Results).forEach(function (url) {
                var $badge = $('<div class="quality-item wave-item"></div>');
                $badge.append($('<img>').attr('src', url));
                $badge.css('--item-index', itemIndex++);
                $row.append($badge);
            });
        });
    }

    function init() {
        Lampa.Listener.follow('full', function (e) {
            if (e.type === 'destroy' || e.type === 'onBeforeDestroy') {
                stopSlideshow();
                stopCleanupObserver();
                currentActiveId = null;
                requestSequence++;
                return;
            }
            if (window.innerWidth > 480) return;
            if (e.type !== 'complite' && e.type !== 'complete') return;
            if (!e.data || !e.data.movie || !e.object || !e.object.activity) return;
            var movie = e.data.movie;
            var $render = e.object.activity.render();
            if (!$render || !$render.length) return;
            var $card = $render.find('.full-start-new').first();
            var $right = $render.find('.full-start-new__right').first();
            if (!$card.length || !$right.length) return;
            stopSlideshow();
            stopCleanupObserver();
            if (window.lampa_settings) window.lampa_settings.blur_poster = false;
            renderMeta($right, movie);
            watchStandardMetadata($render);
            loadMovieDetails(movie, $render);
            renderQuality($render, movie, e);
            scheduleMetadataCleanup($render);
        });
    }

    function setupSettings() {
        Lampa.SettingsApi.addComponent({
            component: 'mobile_interface',
            name: 'Мобільний інтерфейс',
            icon: '<svg height="36" viewBox="0 0 24 24" width="36" xmlns="http://www.w3.org/2000/svg"><path d="M17 1.01L7 1c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99zM17 19H7V5h10v14z" fill="white"/></svg>'
        });
        Lampa.SettingsApi.addParam({ component: 'mobile_interface', param: { name: 'mobile_interface_animation', type: 'trigger', default: true }, field: { name: 'Зум-ефект постера (Ken Burns)' }, onChange: applyStyles });
        Lampa.SettingsApi.addParam({ component: 'mobile_interface', param: { name: 'mobile_interface_ui_anim', type: 'trigger', default: true }, field: { name: 'Плавна анімація появи елементів' }, onChange: applyStyles });
        Lampa.SettingsApi.addParam({ component: 'mobile_interface', param: { name: 'mobile_interface_ui_anim_effect', type: 'select', values: { fluid: 'Apple Fluid', cyber: 'Cyber Neon', cinematic: 'Cinematic Depth', elastic: 'Elastic Spring', minimal: 'Minimal Fade' }, default: 'fluid' }, field: { name: 'Стиль анімації появи' }, onChange: applyStyles });
        Lampa.SettingsApi.addParam({ component: 'mobile_interface', param: { name: 'mobile_interface_badge_anim', type: 'select', values: { none: 'Без анімації', pulse: 'Пульсація', breathe: 'Дихання', spin_slow: 'Гойдання', float: 'Підстрибування' }, default: 'pulse' }, field: { name: 'Анімація бейджів' }, onChange: applyStyles });
        Lampa.SettingsApi.addParam({ component: 'mobile_interface', param: { name: 'mobile_interface_slideshow', type: 'trigger', default: true }, field: { name: 'Автозміна фонових кадрів' } });
        Lampa.SettingsApi.addParam({ component: 'mobile_interface', param: { name: 'mobile_interface_slideshow_time', type: 'select', values: { '10000': '10 сек', '15000': '15 сек', '20000': '20 сек' }, default: '10000' }, field: { name: 'Інтервал зміни фону' } });
        Lampa.SettingsApi.addParam({ component: 'mobile_interface', param: { name: 'mobile_interface_logo_size_v2', type: 'select', values: { '125': 'Малий', '150': 'Середній', '180': 'Стандартний', '210': 'Великий' }, default: '125' }, field: { name: 'Висота логотипу тайтлу' }, onChange: applyStyles });
        Lampa.SettingsApi.addParam({ component: 'mobile_interface', param: { name: 'mobile_interface_show_tagline', type: 'trigger', default: true }, field: { name: 'Відображати слоган' }, onChange: applyStyles });
        Lampa.SettingsApi.addParam({ component: 'mobile_interface', param: { name: 'mobile_interface_blocks_gap', type: 'select', values: { '8px': 'Компактний', '12px': 'Стандартний', '18px': 'Просторий', '24px': 'Панорамний' }, default: '8px' }, field: { name: 'Відступи між блоками' }, onChange: applyStyles });
        Lampa.SettingsApi.addParam({ component: 'mobile_interface', param: { name: 'mobile_interface_ratings_size', type: 'select', values: { '0.4em': 'Дрібний', '0.45em': 'Звичайний', '0.5em': 'Великий', '0.55em': 'Дуже великий' }, default: '0.45em' }, field: { name: 'Розмір шрифту інфо-блоків' }, onChange: applyStyles });
        Lampa.SettingsApi.addParam({ component: 'mobile_interface', param: { name: 'mobile_interface_studios', type: 'trigger', default: true }, field: { name: 'Показувати логотип студії' } });
        Lampa.SettingsApi.addParam({ component: 'mobile_interface', param: { name: 'mobile_interface_quality', type: 'trigger', default: true }, field: { name: 'Бейджі якості та звуку' } });
    }

    function startPlugin() {
        if (started) return;
        started = true;
        applyStyles();
        setupSettings();
        init();
        console.log('[MOB_INTERFACE] v' + VERSION + ' initialized');
    }

    if (window.appready) {
        startPlugin();
    } else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') startPlugin();
        });
    }
})();
