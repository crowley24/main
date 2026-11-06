(function () {
    'use strict';
    /*
     * @name NEWCARD
     * @version 3.3.7 + Interface+ Bridge + Staggered Animation + Smart Studio Logos
     * @author Crowley24
     * @description Cinematic TV interface with Trailer Feed logo behavior, Interface+ cache integration, Stagger animations and smart studio logos styling
     * @platforms Lampa | Android TV
     */

    const PLUGIN_NAME = 'NewCard';
    const PLUGIN_ID = 'new_card_style';

    const CACHE_LIFETIME = 1000 * 60 * 60 * 24;
    const LOGO_CACHE_TIMEOUT = CACHE_LIFETIME;
    const REQUEST_TIMEOUT = 12000;

    let currentInterval = null;
    let logoRequestId = 0;
    let cardRequestId = 0;
    let logoRequests = {};
    let detailsRequests = {};
    let debounceTimer = null;
    let slideshowGeneration = 0;

    const SETTINGS_ICON = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="15" y="20" width="70" height="60" rx="8" stroke="white" stroke-width="6" fill="none" opacity="0.4"/><rect x="25" y="32" width="50" height="28" rx="4" fill="white"/><rect x="25" y="66" width="30" height="6" rx="3" fill="white" opacity="0.6"/><rect x="60" y="66" width="15" height="6" rx="3" fill="white" opacity="0.6"/></svg>`;

    const TRANSLATIONS = {
        'settings_cas_meta_size': 'Розмір шрифту',
        'settings_cas_blocks_gap': 'Відступи між блоками',
        'settings_cas_bg_animation': 'Анімація фону',
        'settings_cas_animation_style': 'Стиль анімації появи',
        'settings_cas_slideshow_enabled': 'Слайд-шоу фону',
        'settings_cas_show_studios': 'Показувати студії',
        'settings_cas_show_tagline': 'Показувати слоган'
    };

    // =====================================================
    // HELPERS
    // =====================================================

    function debounce(func, delay) {
        return function () {
            const context = this;
            const args = arguments;

            clearTimeout(debounceTimer);

            debounceTimer = setTimeout(
                () => func.apply(context, args),
                delay
            );
        };
    }

    function preloadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();

            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });
    }

    function formatTime(mins) {
        mins = parseInt(mins) || 0;

        if (!mins) return '';

        const h = Math.floor(mins / 60);
        const m = mins % 60;

        return (h > 0 ? h + 'г ' : '') + m + 'хв';
    }

    function getRating(data) {
        if (!data) return 0;

        let rating = parseFloat(data.vote_average);

        if (!rating && data.rating) {
            rating = parseFloat(data.rating);
        }

        if (!isFinite(rating) || rating <= 0) return 0;

        return Math.min(rating, 10);
    }

    function getYear(data) {
        const date = data.release_date || data.first_air_date;

        if (!date) return '';

        const year = parseInt(String(date).substring(0, 4));

        return year > 1800 ? year : '';
    }

    function getCountry(data) {
        if (
            data.production_countries &&
            data.production_countries.length
        ) {
            return data.production_countries
                .map(item => item.name)
                .filter(Boolean)
                .slice(0, 2)
                .join(', ');
        }

        if (
            data.origin_country &&
            data.origin_country.length
        ) {
            return data.origin_country.join(', ');
        }

        return '';
    }

    function getRuntime(data) {
        if (data.runtime) return data.runtime;

        if (
            data.episode_run_time &&
            data.episode_run_time.length
        ) {
            return data.episode_run_time[0];
        }

        return 0;
    }

    function initializePlugin() {
        addCustomTemplate();
        addStyles();
        addSettings();
        attachLoader();
    }

    // =====================================================
    // SETTINGS
    // =====================================================

    function addSettings() {
        const defaults = {
            'cas_bg_animation': 'kenburns',
            'cas_animation_style': 'slide',
            'cas_slideshow_enabled': true,
            'cas_blocks_gap': '20',
            'cas_meta_size': '1.3',
            'cas_show_studios': true,
            'cas_show_tagline': true
        };

        Object.keys(defaults).forEach(key => {
            if (Lampa.Storage.get(key) === undefined) {
                Lampa.Storage.set(key, defaults[key]);
            }
        });

        Lampa.SettingsApi.addComponent({
            component: PLUGIN_ID,
            name: PLUGIN_NAME,
            icon: SETTINGS_ICON
        });

        const params = [
            {
                name: 'cas_meta_size',
                type: 'select',
                values: {
                    '1.1': 'Міні',
                    '1.2': 'Малий',
                    '1.3': 'Стандартний',
                    '1.4': 'Збільшений',
                    '1.5': 'Великий'
                }
            },
            {
                name: 'cas_blocks_gap',
                type: 'select',
                values: {
                    '10': 'Дуже тісно',
                    '15': 'Тісно',
                    '20': 'Стандарт',
                    '25': 'Просторе',
                    '30': 'Дуже просторе'
                }
            },
            {
                name: 'cas_bg_animation',
                type: 'select',
                values: {
                    'off': 'Вимкнено',
                    'kenburns': 'Ken Burns (Зум + Паралакс)',
                    'panscan': 'Кінематографічний дрейф (Pan & Scan)',
                    'tiltzoom': 'Динамічний кут (Tilt Zoom)'
                }
            },
            {
                name: 'cas_animation_style',
                type: 'select',
                values: {
                    'slide': 'Slide from Left (Виїзд зліва)',
                    'spring': 'Elastic Spring (Жива пружина)'
                }
            },
            { name: 'cas_slideshow_enabled', type: 'trigger' },
            { name: 'cas_show_studios', type: 'trigger' },
            { name: 'cas_show_tagline', type: 'trigger' }
        ];

        params.forEach(p => {
            Lampa.SettingsApi.addParam({
                component: PLUGIN_ID,
                param: {
                    name: p.name,
                    type: p.type,
                    values: p.values,
                    default: defaults[p.name]
                },
                field: {
                    name: TRANSLATIONS['settings_' + p.name]
                },
                onChange: applySettings
            });
        });

        applySettings();
    }

    function applySettings() {
        const root = document.documentElement;

        const gap = Lampa.Storage.get('cas_blocks_gap') || '20';
        const metaSize = Lampa.Storage.get('cas_meta_size') || '1.3';
        const animStyle = Lampa.Storage.get('cas_animation_style') || 'slide';
        const bgAnim = Lampa.Storage.get('cas_bg_animation') || 'kenburns';

        root.style.setProperty('--cas-blocks-gap', gap + 'px');
        root.style.setProperty('--cas-meta-size', metaSize + 'em');

        const bodyEl = $('body');

        bodyEl.removeClass(
            'cas--zoom-kenburns cas--zoom-panscan cas--zoom-tiltzoom'
        );

        if (bgAnim !== 'off') {
            bodyEl.addClass('cas--zoom-' + bgAnim);
        }

        const currentCard = $('.full-start-new.left-title');

        if (currentCard.length) {
            currentCard
                .removeClass('cas-anim-slide cas-anim-spring')
                .addClass('cas-anim-' + animStyle);

            const showTag = !!Lampa.Storage.get('cas_show_tagline');

            currentCard.find('.cas-tagline').toggle(showTag);

            currentCard.find('.cas-studios-row').toggle(
                !!Lampa.Storage.get('cas_show_studios')
            );

            stopSlideshow();

            if (Lampa.Storage.get('cas_slideshow_enabled')) {
                const movieData = currentCard.data('movie');

                if (movieData && movieData.id) {
                    const cached = getCachedData(
                        'tmdb_' + movieData.id
                    );

                    if (cached && cached.backdrops?.length > 1) {
                        startSlideshow(
                            currentCard,
                            cached.backdrops,
                            Lampa.Storage.field('tmdb_lang') || 'uk'
                        );
                    }
                }
            }
        }
    }

    // =====================================================
    // TEMPLATE
    // =====================================================

    function addCustomTemplate() {
        const animStyle =
            Lampa.Storage.get('cas_animation_style') || 'slide';

        const template = `<div class="full-start-new left-title cas-anim-${animStyle}">

            <div class="full-start-new__body">

                <div class="full-start-new__left hide">
                    <div class="full-start-new__poster">
                        <img class="full-start-new__img full--poster" />
                    </div>
                </div>

                <div class="full-start-new__right">
                    <div class="left-title__content">

                        <div class="cas-logo-container">
                            <div class="cas-studios-row"></div>
                            <div class="cas-logo"></div>
                        </div>

                        <div class="cas-tagline" style="display:none;"></div>

                        <div class="cas-meta-line">
                            <div class="cas-meta-info"></div>
                        </div>

                        <div class="cas-description"></div>

                        <div class="cas-details-wrapper">
                            <div class="full-start-new__head hide"></div>
                            <div class="full-start-new__details hide"></div>
                        </div>

                        <div class="full-start-new__buttons">

                            <div class="full-start__button selector button--play">
                                <svg width="28" height="29" viewBox="0 0 28 29" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <circle cx="14" cy="14.5" r="13" stroke="currentColor" stroke-width="2.7"/>
                                    <path d="M18.0739 13.634C18.7406 14.0189 18.7406 14.9811 18.0739 15.366L11.751 19.0166C11.0843 19.4015 10.251 18.9204 10.251 18.1506L10.251 10.8494C10.251 10.0796 11.0843 9.5985 11.751 9.9834L18.0739 13.634Z" fill="currentColor"/>
                                </svg>
                                <span>#{title_watch}</span>
                            </div>

                            <div class="full-start__button selector button--book">
                                <svg width="21" height="32" viewBox="0 0 21 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M2 1.5H19C19.2761 1.5 19.5 1.72386 19.5 2V27.9618C19.5 28.3756 19.0261 28.6103 18.697 28.3595L12.6212 23.7303C11.3682 22.7757 9.63183 22.7757 8.37885 23.7303L2.30302 28.3595C1.9739 28.6103 1.5 28.3756 1.5 27.9618V2C1.5 1.72386 1.72386 1.5 2 1.5Z" stroke="currentColor" stroke-width="2.5"/>
                                </svg>
                                <span>#{settings_input_links}</span>
                            </div>

                            <div class="full-start__button selector button--reaction">
                                <svg width="38" height="34" viewBox="0 0 38 34" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M37.208 10.9742C37.1364 10.8013 37.0314 10.6441 36.899 10.5117C36.7666 10.3794 36.6095 10.2744 36.4365 10.2028L12.0658 0.108375C11.7166 -0.0361828 11.3242 -0.0361227 10.9749 0.108542C10.6257 0.253206 10.3482 0.530634 10.2034 0.879836L0.108666 25.2507C0.0369593 25.4236 3.37953e-05 25.609 2.3187e-08 25.7962C-3.37489e-05 25.9834 0.0368249 26.1688 0.108469 26.3418C0.180114 26.5147 0.28514 26.6719 0.417545 26.8042C0.54995 26.9366 0.707139 27.0416 0.880127 27.1131L17.2452 33.8917C17.5945 34.0361 17.9869 34.0361 18.3362 33.8917L29.6574 29.2017C29.8304 29.1301 29.9875 29.0251 30.1199 28.8928C30.2523 28.7604 30.3573 28.6032 30.4289 28.4303L37.2078 12.065C37.2795 11.8921 37.3164 11.7068 37.3165 11.5196C37.3165 11.3325 37.2796 11.1471 37.208 10.9742ZM20.425 29.9407L21.8784 26.4316L25.3873 27.885L20.425 29.9407ZM28.3407 26.0222L21.6524 23.252C21.3031 23.1075 20.9107 23.1076 20.5615 23.2523C20.2123 23.3969 19.9348 23.6743 19.79 24.0235L17.0194 30.7123L3.28783 25.0247L12.2918 3.28773L34.0286 12.2912L28.3407 26.0222Z" fill="currentColor"/>
                                    <path d="M25.3493 16.976L24.258 14.3423L16.959 17.3666L15.7196 14.375L13.0859 15.4659L15.4161 21.0916L25.3493 16.976Z" fill="currentColor"/>
                                </svg>
                                <span>#{title_reactions}</span>
                            </div>

                            <div class="full-start__button selector button--subscribe hide">
                                <svg width="25" height="30" viewBox="0 0 25 30" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M6.01892 24H15.9645C15.7219 25.6961 14.2632 27 12.5 27C10.7367 27 9.27804 25.6961 9.03542 24H6.01892Z" fill="currentColor"/>
                                    <path d="M3.81972 14.5957V10.2679C3.81972 5.41336 7.7181 1.5 12.5 1.5C17.2819 1.5 21.1803 5.41336 21.1803 10.2679V14.5957C21.1803 15.8462 21.5399 17.0709 22.2168 18.1213L23.0727 19.4494C24.2077 21.2106 22.9392 23.5 20.9098 23.5H4.09021C2.06084 23.5 0.792282 21.2106 1.9273 19.4494L2.78317 18.1213C3.46012 17.0709 3.81972 15.8462 3.81972 14.5957Z" stroke="currentColor" stroke-width="2.5"/>
                                </svg>
                                <span>#{title_subscribe}</span>
                            </div>

                            <div class="full-start__button selector button--options">
                                <svg width="38" height="10" viewBox="0 0 38 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <circle cx="4.88968" cy="4.98563" r="4.75394" fill="currentColor"/>
                                    <circle cx="18.9746" cy="4.98563" r="4.75394" fill="currentColor"/>
                                    <circle cx="33.0596" cy="4.98563" r="4.75394" fill="currentColor"/>
                                </svg>
                            </div>

                        </div>
                    </div>

                    <div class="full-start-new__reactions selector hide"></div>
                    <div class="rating--modss" style="display:none;"></div>
                </div>
            </div>

            <div class="hide buttons--container">

                <div class="full-start__button view--torrent hide">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50" width="24" height="24">
                        <path d="M25,2C12.317,2,2,12.317,2,25s10.317,23,23,23s23-10.317,23-23S37.683,2,25,2z M40.5,30.963c-3.1,0-4.9-2.4-4.9-2.4S34.1,35,27,35c-1.4,0-3.6-0.837-3.6-0.837l4.17,9.643C26.727,43.92,25.874,44,25,44c-2.157,0-4.222-0.377-6.155-1.039L9.237,16.851c0,0-0.7-1.2,0.4-1.5c1.1-0.3,5.4-1.2,5.4-1.2s1.475-0.494,1.8,0.5c0.5,1.3,4.063,11.112,4.063,11.112S22.6,29,27.4,29c4.7,0,5.9-3.437,5.7-3.937c-1.2-3-4.993-11.862-4.993-11.862s-0.6-1.1,0.8-1.4c1.4-0.3,3.8-0.7,3.8-0.7s1.105-0.163,1.6,0.8c0.738,1.437,5.193,11.262,5.193,11.262s1.1,2.9,3.3,2.9c0.464,0,0.834-0.046,1.152-0.104c-0.082,1.635-0.348,3.221-0.817,4.722C42.541,30.867,41.756,30.963,40.5,30.963z" fill="currentColor"/>
                    </svg>
                    <span>#{full_torrents}</span>
                </div>

                <div class="full-start__button selector view--trailer">
                    <svg height="24" viewBox="0 0 80 70" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path fill-rule="evenodd" clip-rule="evenodd" d="M71.2555 2.08955C74.6975 3.2397 77.4083 6.62804 78.3283 10.9306C80 18.7291 80 35 80 35C80 35 80 51.2709 78.3283 59.0694C77.4083 63.372 74.6975 66.7603 71.2555 67.9104C65.0167 70 40 70 40 70C40 70 14.9833 70 8.74453 67.9104C5.3025 66.7603 2.59172 63.372 1.67172 59.0694C0 51.2709 0 35 0 35C0 35 0 18.7291 1.67172 10.9306C2.59172 6.62804 5.3025 3.2395 8.74453 2.08955C14.9833 0 40 0 40 0C40 0 65.0167 0 71.2555 2.08955ZM55.5909 35.0004L29.9773 49.5714V20.4286L55.5909 35.0004Z" fill="currentColor"/>
                    </svg>
                    <span>#{full_trailers}</span>
                </div>

            </div>
        </div>`;

        Lampa.Template.add('full_start_new', template);
    }

    // =====================================================
    // STYLES
    // =====================================================

    function addStyles() {
        if ($('#cas-main-styles').length) return;

        const styles = `<style id="cas-main-styles">

        :root {
            --cas-blocks-gap: 20px;
            --cas-meta-size: 1.3em;
            --cas-curve-slide: cubic-bezier(0.25, 1, 0.5, 1);
            --cas-curve-spring: cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        .full-start__background {
            height: calc(100% + 6em);
            left: 0 !important;
            opacity: 0 !important;
            transition: opacity 1s cubic-bezier(0.2, 0.8, 0.2, 1) !important;
            will-change: opacity;
            overflow: hidden !important;
            transform: translateZ(0);
        }

        .full-start__background.loaded {
            opacity: 1 !important;
        }

        .full-start__background.dim {
            opacity: 0.35 !important;
        }

        @keyframes casKenBurnsParallax {
            0% { transform: scale(1.02) translate3d(0,0,0); }
            50% { transform: scale(1.10) translate3d(5px,-15px,0); }
            100% { transform: scale(1.02) translate3d(0,0,0); }
        }

        @keyframes casCinematicPanScan {
            0% { transform: scale(1.06) translate3d(0,0,0); }
            33% { transform: scale(1.12) translate3d(-25px,-12px,0); }
            66% { transform: scale(1.10) translate3d(20px,15px,0); }
            100% { transform: scale(1.06) translate3d(0,0,0); }
        }

        @keyframes casDynamicTiltZoom {
            0% { transform: scale(1.08) rotate(0deg) translate3d(0,0,0); }
            33% { transform: scale(1.14) rotate(-2.2deg) translate3d(-15px,10px,0); }
            66% { transform: scale(1.14) rotate(2.2deg) translate3d(15px,-10px,0); }
            100% { transform: scale(1.08) rotate(0deg) translate3d(0,0,0); }
        }

        body.cas--zoom-kenburns .full-start__background img,
        body.cas--zoom-kenburns img.full-start__background {
            animation: casKenBurnsParallax 40s ease-in-out infinite !important;
            will-change: transform;
            transform-origin: center center;
        }

        body.cas--zoom-panscan .full-start__background img,
        body.cas--zoom-panscan img.full-start__background {
            animation: casCinematicPanScan 35s ease-in-out infinite !important;
            will-change: transform;
            transform-origin: center center;
        }

        body.cas--zoom-tiltzoom .full-start__background img,
        body.cas--zoom-tiltzoom img.full-start__background {
            animation: casDynamicTiltZoom 25s ease-in-out infinite !important;
            will-change: transform;
            transform-origin: center center;
        }

        /* NETFLIX-STYLE STAGGERED FADE-IN SYSTEM */

        .cas-studios-row,
        .cas-tagline,
        .cas-logo,
        .cas-meta-line,
        .cas-description,
        .full-start-new__buttons {
            opacity: 0 !important;
            will-change: transform, opacity;
            backface-visibility: hidden;
        }

        .left-title .full-start-new__body {
            height: 85vh;
            position: relative;
        }

        .left-title .full-start-new__right {
            position: static !important;
            width: 100% !important;
            height: 100%;
            padding: 0 !important;
            margin: 0 !important;
            display: block !important;
        }

        .left-title__content {
            position: absolute !important;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 5;
            box-sizing: border-box;
            width: 100%;
            padding: 7em 12em 2.5em 1.5em;
            display: flex;
            flex-direction: column;
            align-items: flex-start !important;
            text-align: left !important;
            background: transparent !important;
            cursor: pointer;
        }

        .cas-logo-container {
            position: relative;
            display: flex;
            flex-direction: column;
            align-items: flex-start !important;
            justify-content: flex-end;
            width: 100%;
            max-width: 100%;
            height: auto;
            max-height: none;
            overflow: visible;
            margin: 0 0 .5em 0;
            gap: 0;
        }

        /* STUDIOS — UNIFIED SIZE & SMART WHITE ADAPTATION */

        .cas-studios-row {
            display: flex;
            flex-wrap: wrap;
            justify-content: flex-start !important;
            align-items: center;
            gap: 12px;
            margin: 0 0 10px 0;
        }

        .cas-studio-item {
            height: 22px !important;
            max-width: 110px;
            display: flex;
            align-items: center;
            justify-content: flex-start;
            margin-bottom: 2px;
        }

        .cas-studio-item img {
            height: 100%;
            width: auto;
            max-width: 100%;
            max-height: 22px;
            object-fit: contain;
            object-position: left center;
            opacity: 0.9;
            filter: brightness(0) invert(1) drop-shadow(0 1px 2px rgba(0,0,0,0.8));
            transition: opacity 0.3s ease;
        }

        .cas-studio-item img:hover {
            opacity: 1;
        }

        /* LOGO */

        .cas-logo {
            display: block;
            width: 30em;
            max-width: 100%;
            height: 8em;
            max-height: 8em;
            overflow: visible;
            margin-bottom: .5em;
        }

        .cas-logo img {
            display: block;
            width: auto;
            height: auto;
            max-width: 30em;
            max-height: 8em;
            object-fit: contain;
            object-position: left center;
            border: none;
            background: transparent;
        }

        .cas-logo-fallback {
            max-width: 30em;
            max-height: 8em;
            overflow: hidden;
            font-size: 3em;
            font-weight: 800;
            line-height: 1.05;
            text-transform: uppercase;
            color: #fff;
        }

        /* TAGLINE */

        .cas-tagline {
            font-size: calc(var(--cas-meta-size) * 0.95);
            font-style: italic;
            color: rgba(255,255,255,0.85);
            margin: 0 0 16px 0;
            text-shadow: 0 2px 4px rgba(0,0,0,0.6);
            max-width: 70%;
            text-align: left !important;
        }

        /* SINGLE-LINE METADATA */

        .cas-meta-line {
            display: flex !important;
            align-items: center !important;
            justify-content: flex-start !important;
            flex-wrap: nowrap !important;
            white-space: nowrap !important;
            gap: 0 !important;
            width: 100%;
            max-width: 100%;
            min-width: 0;
            overflow: hidden;
            margin: 0 0 8px 0;
        }

        .cas-meta-info {
            display: flex !important;
            align-items: center !important;
            justify-content: flex-start !important;
            flex-wrap: nowrap !important;
            white-space: nowrap !important;
            gap: 0 !important;
            width: 100%;
            min-width: 0;
            overflow: hidden;
            font-size: var(--cas-meta-size);
            font-weight: 400;
            line-height: 1.4;
            color: rgba(255,255,255,0.82);
        }

        .cas-meta-item {
            display: inline-block;
            flex: 0 0 auto;
            white-space: nowrap;
        }

        .cas-meta-separator {
            display: inline-block;
            flex: 0 0 auto;
            margin: 0 9px;
            color: rgba(255,255,255,0.45);
        }

        .cas-wave-rating {
            display: inline-flex;
            align-items: center;
            flex: 0 0 auto;
            white-space: nowrap;
            color: rgba(255,255,255,0.95);
            font-weight: 600;
        }

        .cas-wave-rating-star {
            margin-right: 4px;
            font-size: 0.95em;
        }

        .cas-wave-rating-value {
            font-weight: 600;
        }

        .cas-wave-genre {
            flex: 1 1 auto;
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        /* DESCRIPTION */

        .cas-description {
            display: -webkit-box;
            -webkit-box-orient: vertical;
            -webkit-line-clamp: 3;
            overflow: hidden;
            font-size: var(--cas-meta-size) !important;
            line-height: 1.4;
            color: rgba(255,255,255,0.75);
            width: 70%;
            max-width: 70%;
            margin: 2px 0 10px 0;
            text-align: left !important;
        }

        /* BUTTONS */

        .full-start-new__buttons {
            display: flex !important;
            justify-content: flex-start !important;
            align-items: center !important;
            flex-wrap: wrap;
            width: 100%;
            margin: 0 !important;
            padding: 0;
        }

        /* STAGGER ANIMATION TIMELINE (SLIDE STYLE) */

        .cas-anim-slide .cas-studios-row,
        .cas-anim-slide .cas-tagline,
        .cas-anim-slide .cas-logo,
        .cas-anim-slide .cas-meta-line,
        .cas-anim-slide .cas-description,
        .cas-anim-slide .full-start-new__buttons {
            transform: translate3d(0, 12px, 0);
            transition:
                opacity 0.4s var(--cas-curve-slide),
                transform 0.4s var(--cas-curve-slide);
        }

        .cas-anim-slide.cas-animated .cas-studios-row {
            opacity: 0.9 !important;
            transform: translate3d(0, 0, 0);
            transition-delay: 0.0s;
        }
        .cas-anim-slide.cas-animated .cas-tagline {
            opacity: 0.85 !important;
            transform: translate3d(0, 0, 0);
            transition-delay: 0.05s;
        }
        .cas-anim-slide.cas-animated .cas-logo {
            opacity: 1 !important;
            transform: translate3d(0, 0, 0);
            transition-delay: 0.1s;
        }
        .cas-anim-slide.cas-animated .cas-meta-line {
            opacity: 0.82 !important;
            transform: translate3d(0, 0, 0);
            transition-delay: 0.18s;
        }
        .cas-anim-slide.cas-animated .cas-description {
            opacity: 0.75 !important;
            transform: translate3d(0, 0, 0);
            transition-delay: 0.25s;
        }
        .cas-anim-slide.cas-animated .full-start-new__buttons {
            opacity: 1 !important;
            transform: translate3d(0, 0, 0);
            transition-delay: 0.32s;
        }

        /* STAGGER ANIMATION TIMELINE (SPRING STYLE) */

        .cas-anim-spring .cas-studios-row,
        .cas-anim-spring .cas-tagline,
        .cas-anim-spring .cas-logo,
        .cas-anim-spring .cas-meta-line,
        .cas-anim-spring .cas-description,
        .cas-anim-spring .full-start-new__buttons {
            transform: scale3d(0.95, 0.95, 1) translate3d(0, 10px, 0);
            transition:
                opacity 0.45s cubic-bezier(0.175, 0.885, 0.32, 1.275),
                transform 0.45s var(--cas-curve-spring);
        }

        .cas-anim-spring.cas-animated .cas-studios-row {
            opacity: 0.9 !important;
            transform: scale3d(1, 1, 1) translate3d(0, 0, 0);
            transition-delay: 0.0s;
        }
        .cas-anim-spring.cas-animated .cas-tagline {
            opacity: 0.85 !important;
            transform: scale3d(1, 1, 1) translate3d(0, 0, 0);
            transition-delay: 0.05s;
        }
        .cas-anim-spring.cas-animated .cas-logo {
            opacity: 1 !important;
            transform: scale3d(1, 1, 1) translate3d(0, 0, 0);
            transition-delay: 0.1s;
        }
        .cas-anim-spring.cas-animated .cas-meta-line {
            opacity: 0.82 !important;
            transform: scale3d(1, 1, 1) translate3d(0, 0, 0);
            transition-delay: 0.18s;
        }
        .cas-anim-spring.cas-animated .cas-description {
            opacity: 0.75 !important;
            transform: scale3d(1, 1, 1) translate3d(0, 0, 0);
            transition-delay: 0.25s;
        }
        .cas-anim-spring.cas-animated .full-start-new__buttons {
            opacity: 1 !important;
            transform: scale3d(1, 1, 1) translate3d(0, 0, 0);
            transition-delay: 0.32s;
        }

        /* MOBILE */

        @media (max-width: 767px) {
            .left-title .full-start-new__body {
                height: 100vh;
            }

            .left-title__content {
                padding: 4em 8em 12.5em 1.5em;
                right: 0;
            }

            .cas-logo-container {
                width: 100%;
                margin-bottom: .5em;
            }

            .cas-logo {
                width: 80%;
                max-width: 80%;
                height: 5em;
                max-height: 5em;
            }

            .cas-logo img {
                max-width: 80%;
                max-height: 5em;
            }

            .cas-logo-fallback {
                max-width: 80%;
                max-height: 5em;
                font-size: 2em;
            }

            .cas-tagline {
                max-width: 95%;
            }

            .cas-description {
                width: 95%;
                max-width: 95%;
                -webkit-line-clamp: 3;
            }

            .cas-meta-line,
            .cas-meta-info {
                max-width: 100%;
            }

            .cas-meta-info {
                font-size: min(var(--cas-meta-size), 1em);
            }

            .cas-meta-separator {
                margin: 0 5px;
            }

            .cas-studio-item {
                height: 20px !important;
            }

            .full-start-new__buttons {
                flex-wrap: wrap;
            }
        }

        </style>`;

        Lampa.Template.add('left_title_css', styles);

        $('body').append(
            Lampa.Template.get('left_title_css', {}, true)
        );
    }

    // =====================================================
    // BACKDROP CACHE
    // =====================================================

    function getCachedData(id) {
        const cache = Lampa.Storage.get('cas_images_cache') || {};
        const item = cache[id];

        if (item && Date.now() - item.time < CACHE_LIFETIME) {
            return item.data;
        }

        return null;
    }

    function setCachedData(id, data) {
        const cache = Lampa.Storage.get('cas_images_cache') || {};

        cache[id] = {
            time: Date.now(),
            data: data
        };

        const keys = Object.keys(cache);

        if (keys.length > 100) {
            delete cache[keys[0]];
        }

        Lampa.Storage.set('cas_images_cache', cache);
    }

    // =====================================================
    // CLEANUP / SLIDESHOW
    // =====================================================

    function cleanup() {
        stopSlideshow();

        logoRequestId++;
        cardRequestId++;

        $('.left-title__content')
            .parent()
            .parent()
            .removeClass('cas-animated');
    }

    function stopSlideshow() {
        slideshowGeneration++;

        if (currentInterval) {
            clearInterval(currentInterval);
            currentInterval = null;
        }

        if (window.casBgInterval) {
            clearInterval(window.casBgInterval);
            window.casBgInterval = null;
        }
    }

    function startSlideshow(render, backdrops, currentLang) {
        stopSlideshow();

        if (!backdrops || backdrops.length <= 1) return;

        const generation = slideshowGeneration;

        let langBackdrops = [];
        let noLangBackdrops = [];
        let otherBackdrops = [];

        backdrops.forEach(b => {
            const lang = b.iso_639_1;

            if (lang === currentLang) {
                langBackdrops.push(b);
            } else if (!lang || lang === 'xx' || lang === 'null') {
                noLangBackdrops.push(b);
            } else {
                otherBackdrops.push(b);
            }
        });

        let finalBackdrops = [].concat(noLangBackdrops);

        if (finalBackdrops.length < 3 && langBackdrops.length) {
            finalBackdrops = finalBackdrops.concat(langBackdrops);
        }

        if (finalBackdrops.length < 3 && otherBackdrops.length) {
            otherBackdrops.sort(
                (a, b) => (b.vote_average || 0) - (a.vote_average || 0)
            );

            finalBackdrops = finalBackdrops.concat(otherBackdrops);
        }

        finalBackdrops = finalBackdrops.slice(0, 15);

        if (finalBackdrops.length <= 1) return;

        let idx = 0;

        currentInterval = setInterval(() => {
            if (generation !== slideshowGeneration) return;

            idx = (idx + 1) % finalBackdrops.length;

            const nextSrc = Lampa.TMDB.image(
                '/t/p/original' + finalBackdrops[idx].file_path
            );

            const $bgImg = render.find(
                '.full-start__background img, img.full-start__background'
            ).last();

            if (!$bgImg.length) return;

            const img = new Image();

            img.onload = () => {
                if (generation !== slideshowGeneration) return;

                const $container = render.find('.full-start__background');

                $container.css({
                    transition: 'opacity 0.4s ease',
                    opacity: 0
                });

                setTimeout(() => {
                    if (generation !== slideshowGeneration) return;

                    $bgImg.attr('src', nextSrc);

                    setTimeout(() => {
                        if (generation !== slideshowGeneration) return;

                        $container.css('opacity', 0.35);

                    }, 100);

                }, 400);
            };

            img.onerror = () => {};
            img.src = nextSrc;

        }, 15000);

        window.casBgInterval = currentInterval;
    }

    // =====================================================
    // TMDB LOGO SYSTEM — INTERFACE+ BRIDGE + TRAILER FEED
    // =====================================================

    function getPreferredLogoLanguage() {
        let lang = '';

        try {
            if (Lampa.Storage.field) {
                lang = Lampa.Storage.field('tmdb_lang') || '';
            }
        } catch (e) {}

        if (!lang) {
            lang = Lampa.Storage.get('tmdb_lang') || 'en';
        }

        return String(lang).toLowerCase();
    }

    function pickLogo(logos) {
        if (!Array.isArray(logos) || !logos.length) return null;

        const preferred = getPreferredLogoLanguage();

        const languages = [
            preferred,
            'en',
            null
        ];

        for (let i = 0; i < languages.length; i++) {
            const lang = languages[i];

            const found = logos.find(logo => {
                if (!logo || !logo.file_path) return false;

                if (lang === null) {
                    return !logo.iso_639_1 ||
                        logo.iso_639_1 === 'xx' ||
                        logo.iso_639_1 === 'null';
                }

                return String(logo.iso_639_1 || '').toLowerCase() === lang;
            });

            if (found) return found;
        }

        return logos.find(logo => logo && logo.file_path) || null;
    }

    function getLogoCache() {
        return Lampa.Storage.get('cas_logo_cache') || {};
    }

    function getCachedLogo(cacheId) {
        const cache = getLogoCache();
        const item = cache[cacheId];

        if (!item || !item.time) return null;

        if (Date.now() - item.time > LOGO_CACHE_TIMEOUT) {
            return null;
        }

        return item.data || null;
    }

    function setCachedLogo(cacheId, data) {
        const cache = getLogoCache();

        cache[cacheId] = {
            time: Date.now(),
            data: data
        };

        const keys = Object.keys(cache);

        if (keys.length > 100) {
            delete cache[keys[0]];
        }

        Lampa.Storage.set('cas_logo_cache', cache);
    }

    function getLogoUrl(logo) {
        if (!logo || !logo.file_path) return '';

        return Lampa.TMDB.image(
            '/t/p/w500' + logo.file_path
        );
    }

    function showLogoFallback(render, data, requestId) {
        if (requestId !== logoRequestId) return;

        const title = data.title || data.name || '';
        const logoContainer = render.find('.cas-logo');

        logoContainer.empty();

        if (!title) return;

        logoContainer.html(
            $('<div class="cas-logo-fallback"></div>').text(title)
        );
    }

    async function displayMovieLogo(render, data, logos, requestId) {
        if (requestId !== logoRequestId) return;

        const logoContainer = render.find('.cas-logo');
        const selectedLogo = pickLogo(logos);

        if (!selectedLogo) {
            showLogoFallback(render, data, requestId);
            return;
        }

        const logoUrl = getLogoUrl(selectedLogo);

        if (!logoUrl) {
            showLogoFallback(render, data, requestId);
            return;
        }

        try {
            await preloadImage(logoUrl);

            if (requestId !== logoRequestId) return;

            logoContainer.empty();

            const image = $('<img>');

            image.attr('alt', data.title || data.name || '');
            image.attr('src', logoUrl);

            logoContainer.append(image);
            image.show();

        } catch (e) {
            showLogoFallback(render, data, requestId);
        }
    }

    function buildImagesUrl(data) {
        const type = data.name ? 'tv/' : 'movie/';
        const language = getPreferredLogoLanguage() || 'en';
        const includeLanguage = language + ',en,null';

        return Lampa.TMDB.api(
            type + data.id +
            '/images?api_key=' + Lampa.TMDB.key() +
            '&include_image_language=' +
            encodeURIComponent(includeLanguage)
        );
    }

    function loadMovieLogo(render, data, imagesData) {
        const requestId = ++logoRequestId;
        const cacheId = 'tmdb_logo_' + data.id;

        const logoContainer = render.find('.cas-logo');
        logoContainer.empty();

        // 1. СПРОБА ОТРИМАТИ ЛОГОТИП З КЕШУ INTERFACE+
        let bridgeLogoUrl = null;
        if (window.InterfacePlusBridge && typeof window.InterfacePlusBridge.getLogo === 'function') {
            bridgeLogoUrl = window.InterfacePlusBridge.getLogo(data);
        }

        if (bridgeLogoUrl) {
            preloadImage(bridgeLogoUrl).then(() => {
                if (requestId !== logoRequestId) return;
                logoContainer.empty();
                const image = $('<img>');
                image.attr('alt', data.title || data.name || '');
                image.attr('src', bridgeLogoUrl);
                logoContainer.append(image);
                image.show();
            }).catch(() => {
                showLogoFallback(render, data, requestId);
            });
            return;
        }

        // 2. ВЛАСНИЙ КЕШ / TMDB ЗАПИТ
        const cachedLogo = getCachedLogo(cacheId);

        if (cachedLogo && cachedLogo.file_path) {
            displayMovieLogo(render, data, [cachedLogo], requestId);
            return;
        }

        if (imagesData && Array.isArray(imagesData.logos)) {
            const selected = pickLogo(imagesData.logos);

            if (selected) {
                setCachedLogo(cacheId, selected);

                displayMovieLogo(
                    render,
                    data,
                    imagesData.logos,
                    requestId
                );
            } else {
                showLogoFallback(render, data, requestId);
            }

            return;
        }

        if (logoRequests[cacheId]) {
            logoRequests[cacheId].then(result => {
                if (requestId !== logoRequestId) return;

                if (result && Array.isArray(result.logos)) {
                    const selected = pickLogo(result.logos);

                    if (selected) {
                        setCachedLogo(cacheId, selected);

                        displayMovieLogo(
                            render,
                            data,
                            result.logos,
                            requestId
                        );
                    } else {
                        showLogoFallback(render, data, requestId);
                    }
                } else {
                    showLogoFallback(render, data, requestId);
                }
            });

            return;
        }

        const request = new Promise(resolve => {
            let completed = false;

            const timeout = setTimeout(() => {
                if (completed) return;

                completed = true;
                resolve(null);

            }, REQUEST_TIMEOUT);

            $.getJSON(buildImagesUrl(data), result => {
                if (completed) return;

                completed = true;
                clearTimeout(timeout);
                resolve(result || null);

            }).fail(() => {
                if (completed) return;

                completed = true;
                clearTimeout(timeout);
                resolve(null);
            });
        });

        logoRequests[cacheId] = request;

        request.then(result => {
            delete logoRequests[cacheId];

            if (requestId !== logoRequestId) return;

            if (result && Array.isArray(result.logos)) {
                const selected = pickLogo(result.logos);

                if (selected) {
                    setCachedLogo(cacheId, selected);

                    displayMovieLogo(
                        render,
                        data,
                        result.logos,
                        requestId
                    );
                } else {
                    showLogoFallback(render, data, requestId);
                }
            } else {
                showLogoFallback(render, data, requestId);
            }
        });
    }

    // =====================================================
    // STUDIO LOGOS
    // =====================================================

    function renderStudioLogosWithColorAnalysis(container, data) {
        container.empty();

        const studios = (
            data.networks || data.production_companies || []
        ).filter(s => s.logo_path).slice(0, 1);

        studios.forEach(studio => {
            const logoUrl = Lampa.TMDB.image(
                '/t/p/w200' + studio.logo_path
            );

            const item = $('<div class="cas-studio-item cas-wave-studio"></div>');
            const image = $('<img>');

            image.attr('src', logoUrl);
            image.attr('alt', studio.name || '');

            item.append(image);
            container.append(item);
        });
    }

    // =====================================================
    // METADATA RENDERER
    // =====================================================

    function appendMetaItem(container, value, className) {
        if (!value) return;

        if (container.children().length) {
            container.append(
                '<span class="cas-meta-separator">·</span>'
            );
        }

        const item = $('<span></span>')
            .addClass('cas-meta-item')
            .addClass(className || '')
            .text(value);

        container.append(item);
    }

    function renderMetadata(render, data) {
        const container = render.find('.cas-meta-info');

        container.empty();

        const year = getYear(data);
        const country = getCountry(data);
        const runtime = formatTime(getRuntime(data));
        const rating = getRating(data);

        const genres = (data.genres || [])
            .map(g => g.name)
            .filter(Boolean)
            .slice(0, 3)
            .join(', ');

        if (rating > 0) {
            const ratingElement = $(`
                <span class="cas-meta-item cas-wave-rating">
                    <span class="cas-wave-rating-star">★</span>
                    <span class="cas-wave-rating-value"></span>
                </span>
            `);

            ratingElement
                .find('.cas-wave-rating-value')
                .text(rating.toFixed(1));

            container.append(ratingElement);
        }

        appendMetaItem(container, year, 'cas-wave-year');
        appendMetaItem(container, country, 'cas-wave-country');
        appendMetaItem(container, runtime, 'cas-wave-time');
        appendMetaItem(container, genres, 'cas-wave-genre');

        container.css('display', 'flex');
    }

    // =====================================================
    // TMDB DETAILS FALLBACK
    // =====================================================

    function needsDetails(data) {
        return !getCountry(data) ||
            !getRuntime(data) ||
            !(data.genres && data.genres.length) ||
            !getRating(data) ||
            !data.overview ||
            (
                Lampa.Storage.get('cas_show_tagline') &&
                !data.tagline
            );
    }

    function loadTMDBDetails(data) {
        return new Promise(resolve => {
            if (!data || !data.id) {
                resolve(null);
                return;
            }

            const type = data.name ? 'tv/' : 'movie/';
            const requestId = type + data.id;

            if (detailsRequests[requestId]) {
                detailsRequests[requestId].then(resolve);
                return;
            }

            const language = getPreferredLogoLanguage() || 'uk';

            const url = Lampa.TMDB.api(
                type + data.id + '?api_key=' +
                Lampa.TMDB.key() +
                '&language=' + encodeURIComponent(language)
            );

            const request = new Promise(done => {
                let completed = false;

                const timeout = setTimeout(() => {
                    if (completed) return;

                    completed = true;
                    done(null);
                }, REQUEST_TIMEOUT);

                $.getJSON(url, result => {
                    if (completed) return;

                    completed = true;
                    clearTimeout(timeout);
                    done(result || null);

                }).fail(() => {
                    if (completed) return;

                    completed = true;
                    clearTimeout(timeout);
                    done(null);
                });
            });

            detailsRequests[requestId] = request;

            request.then(result => {
                delete detailsRequests[requestId];
                resolve(result);
            });
        });
    }

    // =====================================================
    // MOVIE METADATA + DESCRIPTION
    // =====================================================

    async function loadMovieDataOptimized(render, data, requestId) {
        if (!data || requestId !== cardRequestId) return;

        if (data.tagline && Lampa.Storage.get('cas_show_tagline')) {
            render.find('.cas-tagline')
                .text('«' + data.tagline + '»')
                .show();
        } else {
            render.find('.cas-tagline').hide();
        }

        const description = String(data.overview || '').trim();

        render.find('.cas-description')
            .text(description)
            .css('display', description ? '-webkit-box' : 'none');

        renderMetadata(render, data);

        if (needsDetails(data)) {
            const details = await loadTMDBDetails(data);

            if (
                !details ||
                requestId !== cardRequestId
            ) {
                return;
            }

            const merged = Object.assign({}, data);

            if (!getRating(merged)) {
                merged.vote_average = details.vote_average;
            }

            if (!getCountry(merged)) {
                merged.production_countries =
                    details.production_countries;

                if (!merged.origin_country) {
                    merged.origin_country = details.origin_country;
                }
            }

            if (!getRuntime(merged)) {
                merged.runtime = details.runtime;
                merged.episode_run_time = details.episode_run_time;
            }

            if (!(merged.genres && merged.genres.length)) {
                merged.genres = details.genres;
            }

            if (!merged.overview && details.overview) {
                merged.overview = details.overview;

                render.find('.cas-description')
                    .text(String(details.overview).trim())
                    .css(
                        'display',
                        details.overview ? '-webkit-box' : 'none'
                    );
            }

            if (!merged.tagline && details.tagline) {
                merged.tagline = details.tagline;

                if (Lampa.Storage.get('cas_show_tagline')) {
                    render.find('.cas-tagline')
                        .text('«' + details.tagline + '»')
                        .show();
                }
            }

            renderMetadata(render, merged);

            if (
                Lampa.Storage.get('cas_show_studios') &&
                (
                    !data.production_companies ||
                    !data.production_companies.length
                ) &&
                details.production_companies &&
                details.production_companies.length
            ) {
                renderStudioLogosWithColorAnalysis(
                    render.find('.cas-studios-row'),
                    details
                );
            }
        }

        if (requestId !== cardRequestId) return;

        if (Lampa.Storage.get('cas_show_studios')) {
            renderStudioLogosWithColorAnalysis(
                render.find('.cas-studios-row'),
                data
            );
        } else {
            render.find('.cas-studios-row').empty();
        }
    }

    const debouncedLoadMovieData = debounce(
        (render, data, requestId) => {
            loadMovieDataOptimized(
                render,
                data,
                requestId
            ).catch(() => {});
        },
        150
    );

    // =====================================================
    // IMAGE PROCESSING
    // =====================================================

    async function processImages(render, data, res, requestId) {
        if (requestId !== cardRequestId) return;

        try {
            loadMovieLogo(render, data, res);

            stopSlideshow();

            if (
                Lampa.Storage.get('cas_slideshow_enabled') &&
                res.backdrops &&
                res.backdrops.length > 1
            ) {
                const currentLang =
                    Lampa.Storage.field('tmdb_lang') || 'uk';

                startSlideshow(
                    render,
                    res.backdrops,
                    currentLang
                );
            }

        } catch (error) {
            showLogoFallback(render, data, logoRequestId);
        }
    }

    // =====================================================
    // LAMPA EVENT LISTENER
    // =====================================================

    function attachLoader() {
        Lampa.Listener.follow('full', event => {
            if (event.type !== 'complite') return;

            const data = event.data.movie;
            const render = event.object.activity.render();

            const cardRoot = render.find(
                '.full-start-new.left-title'
            );

            const thisCardRequest = ++cardRequestId;

            logoRequestId++;

            cardRoot.removeClass('cas-animated');

            render.find('.cas-description').empty().hide();
            render.find('.cas-meta-info').empty();
            render.find('.cas-logo').empty();
            render.find('.cas-tagline').empty().hide();
            render.find('.cas-studios-row').empty();

            render.find(
                '.full-start-new__details, ' +
                '.full-start-new__description, ' +
                '.full-start-new__overview, ' +
                '.full-start-new__text, ' +
                '.full-start-new__head, ' +
                '.full-descr, ' +
                '.full-start__description, ' +
                '.full-start__descr, ' +
                '.full-description'
            ).hide();

            event.object.activity.onBeforeDestroy = cleanup;

            if (data && data.id) {
                render.data('movie', data);

                const cacheId = 'tmdb_' + data.id;
                const cached = getCachedData(cacheId);

                const processImagesWrapper = async res => {
                    if (thisCardRequest !== cardRequestId) return;

                    try {
                        await processImages(
                            render,
                            data,
                            res,
                            thisCardRequest
                        );

                    } catch (e) {
                        showLogoFallback(
                            render,
                            data,
                            logoRequestId
                        );

                    } finally {
                        if (thisCardRequest === cardRequestId) {
                            requestAnimationFrame(() => {
                                if (thisCardRequest !== cardRequestId) return;

                                cardRoot.addClass('cas-animated');
                            });
                        }
                    }
                };

                if (cached) {
                    processImagesWrapper(cached);

                } else {
                    const imagesUrl = buildImagesUrl(data);

                    $.getJSON(imagesUrl, res => {
                        if (thisCardRequest !== cardRequestId) return;

                        setCachedData(cacheId, res);
                        processImagesWrapper(res);

                    }).fail(() => {
                        if (thisCardRequest !== cardRequestId) return;

                        showLogoFallback(
                            render,
                            data,
                            logoRequestId
                        );

                        requestAnimationFrame(() => {
                            if (thisCardRequest !== cardRequestId) return;

                            cardRoot.addClass('cas-animated');
                        });
                    });
                }

                debouncedLoadMovieData(
                    render,
                    data,
                    thisCardRequest
                );

            } else {
                requestAnimationFrame(() => {
                    if (thisCardRequest !== cardRequestId) return;

                    cardRoot.addClass('cas-animated');
                });
            }

            setTimeout(() => {
                if (thisCardRequest !== cardRequestId) return;

                const firstButton = render.find(
                    '.full-start-new__buttons .full-start__button'
                ).first();

                if (firstButton.length) {
                    render.find('.full-start__button')
                        .removeClass('focus');

                    firstButton
                        .addClass('focus')
                        .trigger('focus');
                }
            }, 200);
        });
    }

    // =====================================================
    // START
    // =====================================================

    function startPlugin() {
        try {
            initializePlugin();

            console.log(
                'NewCard 3.3.7 + Interface+ Bridge + Staggered Animation + Smart Studio Logos initialized successfully'
            );

        } catch (error) {
            console.error(
                'Failed to initialize NewCard plugin:',
                error
            );
        }
    }

    if (window.appready) {
        startPlugin();

    } else {
        Lampa.Listener.follow('app', e => {
            if (e.type === 'ready') {
                startPlugin();
            }
        });
    }

})();
