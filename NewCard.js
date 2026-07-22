(function () {                
    'use strict';                
    const PLUGIN_NAME = 'NewCard';                
    const PLUGIN_ID = 'new_card_style';                
    const ASSETS_PATH = 'https://crowley38.github.io/Icons/';                
    const CACHE_LIFETIME = 1000 * 60 * 60 * 24;                  
                
    let currentInterval = null;            
            
    const ICONS = {                
        tmdb: 'https://upload.wikimedia.org/wikipedia/commons/8/89/Tmdb.new.logo.svg',                
        cub: 'https://raw.githubusercontent.com/yumata/lampa/9381985ad4371d2a7d5eb5ca8e3daf0f32669eb7/img/logo-icon.svg'                
    };                
    const QUALITY_ICONS = {                
        '4K': ASSETS_PATH + '4K.svg',                
        '2K': ASSETS_PATH + '2K.svg',                
        'FULL HD': ASSETS_PATH + 'FULL HD.svg',                
        'HD': ASSETS_PATH + 'HD.svg',                
        'HDR': ASSETS_PATH + 'HDR.svg',                
        'Dolby Vision': ASSETS_PATH + 'Dolby Vision.svg',                
        'UKR': ASSETS_PATH + 'UKR.svg',  
        // Додано нові іконки якості  
        '7.1': ASSETS_PATH + '7.1.svg',  
        '5.1': ASSETS_PATH + '5.1.svg',  
        '4.0': ASSETS_PATH + '4.0.svg',  
        '2.0': ASSETS_PATH + '2.0.svg',  
        'DUB': ASSETS_PATH + 'DUB.svg'  
    };                
    const SETTINGS_ICON = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="15" y="20" width="70" height="60" rx="8" stroke="white" stroke-width="6" fill="none" opacity="0.4"/><rect x="25" y="32" width="50" height="28" rx="4" fill="white"/><rect x="25" y="66" width="30" height="6" rx="3" fill="white" opacity="0.6"/><rect x="60" y="66" width="15" height="6" rx="3" fill="white" opacity="0.6"/></svg>`;                
                
    const TRANSLATIONS = {                
        'settings_cas_logo_quality': 'Якість логотипу',                
        'settings_cas_logo_scale': 'Розмір логотипу',                
        'settings_cas_meta_size': 'Розмір шрифту',                
        'settings_cas_blocks_gap': 'Відступи між блоками',                
        'settings_cas_bg_animation': 'Анімація фону (Ken Burns)',                
        'settings_cas_slideshow_enabled': 'Слайд-шоу фону',                
        'settings_cas_show_studios': 'Показувати студії',                
        'settings_cas_show_quality': 'Показувати якість',                
        'settings_cas_show_rating': 'Показувати рейтинги',                
        'settings_cas_show_description': 'Опис фільму'                
    };                
                
    let debounceTimer;                
    function debounce(func, delay) {                
        return function() {                
            const context = this;                
            const args = arguments;                
            clearTimeout(debounceTimer);                
            debounceTimer = setTimeout(() => func.apply(context, args), delay);                
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
                
    function getRatingColor(val) {                
        const n = parseFloat(val);                
        return n >= 7.5 ? '#2ecc71' : n >= 6 ? '#feca57' : '#ff4d4d';                
    }                
                
    function formatTime(mins) {                
        if (!mins) return '';                
        const h = Math.floor(mins / 60);                
        const m = mins % 60;                
        return (h > 0 ? h + 'г ' : '') + m + 'хв';                
    }                
                
    // Нова функція для створення бейджів з анімацією  
    function createBadgeImg(type, isCard, index) {  
        const iconPath = QUALITY_ICONS[type];  
        if (!iconPath) return '';  
        const className = isCard ? 'card-quality-badge' : 'quality-badge';  
        const delay = (index * 0.08) + 's';  
        return `<div class="${className}" style="animation-delay: ${delay}"><img src="${iconPath}" draggable="false"></div>`;  
    }                
                
    function initializePlugin() {                
        addCustomTemplate();                
        addStyles();                
        addSettings();                
        attachLoader();                
    }                
                
    function addSettings() {                
        const defaults = {                
            'cas_logo_scale': '100',                
            'cas_logo_quality': 'original',                
            'cas_bg_animation': true,                
            'cas_slideshow_enabled': true,                
            'cas_blocks_gap': '20',                
            'cas_meta_size': '1.3',                
            'cas_show_studios': true,                
            'cas_show_quality': true,                
            'cas_show_rating': true,                
            'cas_show_description': true                
        };                
                
        Object.keys(defaults).forEach(key => {                
            if (Lampa.Storage.get(key) === undefined) Lampa.Storage.set(key, defaults[key]);                
        });                
                
        Lampa.SettingsApi.addComponent({                
            component: PLUGIN_ID,                
            name: PLUGIN_NAME,                
            icon: SETTINGS_ICON                
        });                
                        
        const params = [                
            { name: 'cas_logo_quality', type: 'select', values: { 'w300':'300px', 'w500':'500px', 'original':'Original' } },                
            { name: 'cas_logo_scale', type: 'select', values: { '70':'70%','80':'80%','90':'90%','100':'100%','110':'110%','120':'120%' } },                
            { name: 'cas_meta_size', type: 'select', values: { '1.1': 'Міні', '1.2': 'Малий', '1.3': 'Стандартний', '1.4': 'Збільшений', '1.5': 'Великий' } },                
            { name: 'cas_blocks_gap', type: 'select', values: { '10':'Дуже тісно','15':'Тісно','20':'Стандарт','25':'Просторе','30':'Дуже просторе' } },                
            { name: 'cas_bg_animation', type: 'trigger' },                
            { name: 'cas_slideshow_enabled', type: 'trigger' },                
            { name: 'cas_show_studios', type: 'trigger' },                
            { name: 'cas_show_quality', type: 'trigger' },                
            { name: 'cas_show_rating', type: 'trigger' },                
            { name: 'cas_show_description', type: 'trigger' }                
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
        const scale = parseInt(Lampa.Storage.get('cas_logo_scale') || 100) / 100;          
        const gap = Lampa.Storage.get('cas_blocks_gap') || '20';          
        const metaSize = Lampa.Storage.get('cas_meta_size') || '1.3';          
                          
        root.style.setProperty('--cas-logo-scale', scale);          
        root.style.setProperty('--cas-blocks-gap', gap + 'px');          
        root.style.setProperty('--cas-meta-size', metaSize + 'em');          
                          
        $('body').toggleClass('cas--zoom-enabled', !!Lampa.Storage.get('cas_bg_animation'));          
                          
        const currentCard = $('.full-start-new.left-title');          
        if (currentCard.length > 0) {          
            currentCard.find('.cas-description').toggle(!!Lampa.Storage.get('cas_show_description'));          
            currentCard.find('.cas-studios-row').toggle(!!Lampa.Storage.get('cas_show_studios'));          
            currentCard.find('.cas-quality-row').toggle(!!Lampa.Storage.get('cas_show_quality'));          
            currentCard.find('.cas-rate-items').toggle(!!Lampa.Storage.get('cas_show_rating'));          
                        
            const hasVisibleElements = currentCard.find('.cas-studios-row:visible, .cas-rate-items:visible, .cas-quality-row:visible, .cas-description:visible').length > 0;          
            const buttons = currentCard.find('.full-start-new__buttons');          
                      
            if (!hasVisibleElements) {          
                buttons.css('margin-top', '0.2em');          
                currentCard.find('.cas-ratings-line').css('margin-bottom', '0');          
            } else {          
                buttons.css('margin-top', '');          
                currentCard.find('.cas-ratings-line').css('margin-bottom', '');          
            }          
                        
            stopSlideshow();          
          
            if (Lampa.Storage.get('cas_slideshow_enabled')) {          
                const bg = currentCard.find('.full-start__background img, img.full-start__background');          
                if (bg.length && bg.attr('src')) {          
                    const movieData = currentCard.data('movie');          
                    if (movieData && movieData.id) {          
                        const cacheId = 'tmdb_' + movieData.id;          
                        const cached = getCachedData(cacheId);          
                        if (cached && cached.backdrops?.length > 1) {          
                            startSlideshow(currentCard, cached.backdrops);          
                        }          
                    }          
                }          
            }          
        }          
    }               
                      
    function addCustomTemplate() {                       
        const template = `<div class="full-start-new left-title">                      
            <div class="full-start-new__body">                      
                <div class="full-start-new__left hide">                      
                    <div class="full-start-new__poster">                      
                        <img class="full-start-new__img full--poster" />                      
                    </div>                      
                </div>                      
                <div class="full-start-new__right">                      
                    <div class="left-title__content">                      
                        <div class="cas-logo-container" style="margin-bottom: calc(var(--cas-blocks-gap) * 1.5);">                    
                            <div class="cas-logo"></div>                    
                        </div>                    
                 <div class="cas-meta-line" style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px; flex-wrap: wrap;">      
                     <div class="cas-studios-row" style="display: flex; gap: 8px; align-items: center;"></div>      
                         <div class="cas-meta-info"></div>      
                         <div class="cas-quality-row" style="display: flex; gap: 6px; align-items: center;"></div>      
                        </div>  
                        <div class="cas-description" style="margin-top: calc(var(--cas-blocks-gap) * 0.4);"></div>                    
                        <div class="cas-details-wrapper" style="margin-top: 10px;">                  
                            <div class="full-start-new__head hide"></div>                      
                            <div class="full-start-new__details hide"></div>                      
                        </div>                  
                        <div class="full-start-new__buttons">                      
                            <div class="full-start__button selector button--play">                      
                                <svg width="28" height="29" viewBox="0 0 28 29" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="14" cy="14.5" r="13" stroke="currentColor" stroke-width="2.7"/><path d="M18.0739 13.634C18.7406 14.0189 18.7406 14.9811 18.0739 15.366L11.751 19.0166C11.0843 19.4015 10.251 18.9204 10.251 18.1506L10.251 10.8494C10.251 10.0796 11.0843 9.5985 11.751 9.9834L18.0739 13.634Z" fill="currentColor"/></svg>                      
                                <span>#{title_watch}</span>                      
                            </div>                      
                            <div class="full-start__button selector button--book">                      
                                <svg width="21" height="32" viewBox="0 0 21 32" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 1.5H19C19.2761 1.5 19.5 1.72386 19.5 2V27.9618C19.5 28.3756 19.0261 28.6103 18.697 28.3595L12.6212 23.7303C11.3682 22.7757 9.63183 22.7757 8.37885 23.7303L2.30302 28.3595C1.9739 28.6103 1.5 28.3756 1.5 27.9618V2C1.5 1.72386 1.72386 1.5 2 1.5Z" stroke="currentColor" stroke-width="2.5"/></svg>                      
                                <span>#{settings_input_links}</span>                      
                            </div>                      
                                                          <div class="full-start__button selector button--reaction">                  
                                <svg width="38" height="34" viewBox="0 0 38 34" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M37.208 10.9742C37.1364 10.8013 37.0314 10.6441 36.899 10.5117C36.7666 10.3794 36.6095 10.2744 36.4365 10.2028L12.0658 0.108375C11.7166 -0.0361828 11.3242 -0.0361227 10.9749 0.108542C10.6257 0.253206 10.3482 0.530634 10.2034 0.879836L0.108666 25.2507C0.0369593 25.4236 3.37953e-05 25.609 2.3187e-08 25.7962C-3.37489e-05 25.9834 0.0368249 26.1688 0.108469 26.3418C0.180114 26.5147 0.28514 26.6719 0.417545 26.8042C0.54995 26.9366 0.707139 27.0416 0.880127 27.1131L17.2452 33.8917C17.5945 34.0361 17.9869 34.0361 18.3362 33.8917L29.6574 29.2017C29.8304 29.1301 29.9875 29.0251 30.1199 28.8928C30.2523 28.7604 30.3573 28.6032 30.4289 28.4303L37.2078 12.065C37.2795 11.8921 37.3164 11.7068 37.3165 11.5196C37.3165 11.3325 37.2796 11.1471 37.208 10.9742ZM20.425 29.9407L21.8784 26.4316L25.3873 27.885L20.425 29.9407ZM28.3407 26.0222L21.6524 23.252C21.3031 23.1075 20.9107 23.1076 20.5615 23.2523C20.2123 23.3969 19.9348 23.6743 19.79 24.0235L17.0194 30.7123L3.28783 25.0247L12.2918 3.28773L34.0286 12.2912L28.3407 26.0222Z" fill="currentColor"/><path d="M25.3493 16.976L24.258 14.3423L16.959 17.3666L15.7196 14.375L13.0859 15.4659L15.4161 21.0916L25.3493 16.976Z" fill="currentColor"/></svg>              
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
                                <svg width="38" height="10" viewBox="0 0 38 10" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="4.88968" cy="4.98563" r="4.75394" fill="currentColor"/><circle cx="18.9746" cy="4.98563" r="4.75394" fill="currentColor"/><circle cx="33.0596" cy="4.98563" r="4.75394" fill="currentColor"/></svg>                  
                            </div>                  
                        </div>                  
                    </div>                  
                    <div class="full-start-new__reactions selector hide"></div>                  
                    <div class="full-start-new__rate-line hide"></div>                  
                    <div class="rating--modss" style="display: none;"></div>                  
                </div>                  
            </div>                  
            <div class="hide buttons--container">                  
                <div class="full-start__button view--torrent hide">                  
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50" width="24" height="24"><path d="M25,2C12.317,2,2,12.317,2,25s10.317,23,23,23s23-10.317,23-23S37.683,2,25,2z M40.5,30.963c-3.1,0-4.9-2.4-4.9-2.4 S34.1,35,27,35c-1.4,0-3.6-0.837-3.6-0.837l4.17,9.643C26.727,43.92,25.874,44,25,44c-2.157,0-4.222-0.377-6.155-1.039L9.237,16.851 c0,0-0.7-1.2,0.4-1.5c1.1-0.3,5.4-1.2,5.4-1.2s1.475-0.494,1.8,0.5c0.5,1.3,4.063,11.112,4.063,11.112S22.6,29,27.4,29 c4.7,0,5.9-3.437,5.7-3.937c-1.2-3-4.993-11.862-4.993-11.862s-0.6-1.1,0.8-1.4c1.4-0.3,3.8-0.7,3.8-0.7s1.105-0.163,1.6,0.8 c0.738,1.437,5.193,11.262,5.193,11.262s1.1,2.9,3.3,2.9c0.464,0,0.834-0.046,1.152-0.104c-0.082,1.635-0.348,3.221-0.817,4.722 C42.541,30.867,41.756,30.963,40.5,30.963z" fill="currentColor"/></svg>                  
                    <span>#{full_torrents}</span>                  
                </div>                  
                <div class="full-start__button selector view--trailer">                  
                    <svg height="24" viewBox="0 0 80 70" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M71.2555 2.08955C74.6975 3.2397 77.4083 6.62804 78.3283 10.9306C80 18.7291 80 35 80 35C80 35 80 51.2709 78.3283 59.0694C77.4083 63.372 74.6975 66.7603 71.2555 67.9104C65.0167 70 40 70 40 70C40 70 14.9833 70 8.74453 67.9104C5.3025 66.7603 2.59172 63.372 1.67172 59.0694C0 51.2709 0 35 0 35C0 35 0 18.7291 1.67172 10.9306C2.59172 6.62804 5.3025 3.2395 8.74453 2.08955C14.9833 0 40 0 40 0C40 0 65.0167 0 71.2555 2.08955ZM55.5909 35.0004L29.9773 49.5714V20.4286L55.5909 35.0004Z" fill="currentColor"/></svg>                  
                    <span>#{full_trailers}</span>                  
                </div>                  
            </div>                  
        </div>`;                  
        Lampa.Template.add('full_start_new', template);                  
    }              
              
function addStyles() {  
    if ($('#cas-main-styles').length) return;  
    const styles = `<style id="cas-main-styles">  
    :root { --cas-logo-scale: 1; --cas-blocks-gap: 30px; --cas-meta-size: 1.3em; --cas-anim-curve: cubic-bezier(0.2, 0.8, 0.2, 1); }  
            
    /* Чистий фон без стандартних фільтрів Lampa */  
    .full-start__background {  
        height: calc(100% + 6em);  
        left: 0 !important;  
        opacity: 0 !important;  
        transition: opacity 0.6s ease-out !important;  
        will-change: opacity;  
        transform: scale(1.05);  
    }  
        
    .full-start__background.loaded {  
        opacity: 1 !important;  
    }  
  
    .full-start__background.dim {  
        opacity: 0.35 !important;  
    }  
        
    /* Відключення стандартної анімації Lampa */  
    body.advanced--animation:not(.no--animation) .full-start__background.loaded {  
        animation: none !important;  
    }  
            
    /* Елегантна Ken Burns анімація */  
    @keyframes casKenBurnsParallax {  
        0% { transform: scale(1.05) translateY(0px) translateX(0px); }  
        25% { transform: scale(1.08) translateY(-12px) translateX(-6px); }  
        50% { transform: scale(1.12) translateY(-18px) translateX(8px); }  
        75% { transform: scale(1.09) translateY(-10px) translateX(-4px); }  
        100% { transform: scale(1.05) translateY(0px) translateX(0px); }  
    }  
              
    body.cas--zoom-enabled .full-start__background.loaded {  
        animation: casKenBurnsParallax 50s ease-in-out infinite !important;  
        will-change: transform;  
    }  
    
    /* Додатковий subtle ефект глибини */  
    body.cas--zoom-enabled .full-start__background::after {  
        content: '';  
        position: absolute;  
        top: 0;  
        left: 0;  
        right: 0;  
        bottom: 0;  
        background: radial-gradient(circle at center, transparent 0%, rgba(0,0,0,0.1) 100%);  
        pointer-events: none;  
        animation: vignettePulse 50s ease-in-out infinite;  
    }  
    
    @keyframes vignettePulse {  
        0%, 100% { opacity: 0.3; }  
        50% { opacity: 0.1; }  
    }  
      
    /* Анімації контенту */  
    .cas-logo, .cas-studios-row, .cas-rate-items, .cas-meta-info, .cas-quality-row, .cas-description, .cas-details-wrapper {  
        opacity: 0 !important;  
        transform: translateY(10px);  
        transition: opacity 0.4s var(--cas-anim-curve), transform 0.4s var(--cas-anim-curve);  
        will-change: transform, opacity;  
    }  
                        
    .cas-animated .cas-logo { opacity: 1 !important; transform: translateY(0); transition-delay: 0s; }  
    .cas-animated .cas-studios-row { opacity: 0.9 !important; transform: translateY(0); transition-delay: 0.1s; }  
    .cas-animated .cas-rate-items { opacity: 1 !important; transform: translateY(0); transition-delay: 0.2s; }  
    .cas-animated .cas-meta-info { opacity: 0.7 !important; transform: translateY(0); transition-delay: 0.3s; }  
    .cas-animated .cas-quality-row { opacity: 0.9 !important; transform: translateY(0); transition-delay: 0.4s; }  
    .cas-animated .cas-description { opacity: 0.7 !important; transform: translateY(0); transition-delay: 0.15s; }  
              
    .full-start-new__details { display: none !important; }  
    .full-start-new__head { display: block !important; margin: 0 !important; padding: 0 !important; font-size: 0.9em; }  
    .full-start-new__body { display: flex; height: 85vh; position: relative; }  
    .full-start-new__left { flex: 1; display: flex; flex-direction: column; justify-content: flex-end; padding: 4em 3em 2em 4em; position: relative; z-index: 2; }  
    .full-start-new__right { width: 50%; display: flex; flex-direction: column; justify-content: space-between; padding: 4em 4em 2em 0; position: relative; z-index: 2; }  
    .full-start-new__poster { display: none; }  
    .full-start-new__title { display: none; }  
                        
    .left-title .full-start-new__left { width: 50%; }  
    .left-title .full-start-new__right { width: 50%; }  
                        
    .cas-logo-container {  
        position: relative;  
        overflow: visible;  
        max-width: 100%;  
        padding-left: 0%;  
        margin-bottom: calc(var(--cas-blocks-gap) * 1.5);  
        max-height: 300px;  
    }  
                        
    .cas-logo img {  
        background: transparent !important;  
        border: none !important;  
        max-width: 450px;  
        max-height: 200px;  
        width: auto;  
        height: auto;  
        transform: scale(var(--cas-logo-scale));  
        transform-origin: left center;  
        display: block;  
        object-fit: contain;  
    }  
           
    /* Вирівнювання відступів для всіх елементів */  
    .cas-logo-container,  
    .cas-studios-row,  
    .cas-ratings-line,  
    .cas-description {  
        margin-left: 0;  
        margin-right: 0;  
        padding-left: 0;  
        padding-right: 0;  
    }  
    
    /* Вирівнювання елементів у рядку метаданих */  
    .cas-ratings-line {  
        display: flex;  
        align-items: center;  
        gap: 8px !important;  
        flex-wrap: wrap;  
        margin-bottom: 8px !important;  
    }  
    
    .cas-meta-info {  
        margin-right: 0;  
        display: flex;  
        align-items: center;  
        gap: 8px;  
    }  
    
    .cas-quality-row {  
        margin-top: 0 !important;  
        display: flex;  
        align-items: center;  
        gap: 6px;  
    }  
    
    .cas-sep {  
        margin: 0 2px !important;  
    }  
                        
    .cas-studios-row {  
        display: flex;  
        flex-wrap: wrap;  
        gap: 8px;  
        margin-bottom: calc(var(--cas-blocks-gap) * 0.8);  
    }
    .cas-studio-item {    
        height: 2.3em !important;    
        display: flex;    
        align-items: center;    
        justify-content: center;    
    }    
  
    .cas-studio-item img {    
        height: 100%;    
        width: auto;    
        object-fit: contain;    
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));    
        opacity: 1;    
        transition: all 0.3s ease;    
    }    
    .cas-description { font-size: var(--cas-meta-size) !important; line-height: 1.4; color: rgba(255,255,255,0.7); display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; max-width: 650px; margin-top: calc(var(--cas-blocks-gap) * 0.4); }    
    .cas-quality-item img { height: 12px; }    
    .cas-ratings-line { display: flex; align-items: center; gap: 15px; margin-bottom: 5px; font-size: var(--cas-meta-size); font-weight: 600; height: 30px; }    
    .cas-rate-item { display: flex; align-items: center; gap: 6px; }    
    .cas-rate-item img { height: 1.1em; }    
    .left-title .full-start-new__body { height: 85vh; }    
    .cas-meta-info { display: flex; align-items: center; gap: 8px; font-weight: 400; }    
                          
    .full-start__background img {    
        transform: translateZ(0);    
        -webkit-transform: translateZ(0);    
    }    
        
    .cas-audio-item {    
        background: rgba(255, 255, 255, 0.2);    
        padding: 2px 6px;    
        border-radius: 4px;    
        font-size: 0.8em;    
        font-weight: 600;    
        color: white;    
    }    
    </style>`;    
    Lampa.Template.add('left_title_css', styles);    
    $('body').append(Lampa.Template.get('left_title_css', {}, true));    
}  
     function getCachedData(id) {                
        const cache = Lampa.Storage.get('cas_images_cache') || {};                
        const item = cache[id];                
        if (item && (Date.now() - item.time < CACHE_LIFETIME)) return item.data;                
        return null;                
    }                
                
    function setCachedData(id, data) {                
        const cache = Lampa.Storage.get('cas_images_cache') || {};                
        cache[id] = { time: Date.now(), data: data };                
        const keys = Object.keys(cache);          
        if (keys.length > 100) delete cache[keys[0]];          
        Lampa.Storage.set('cas_images_cache', cache);                
    }                
                
    function cleanup() {                
        stopSlideshow();                
        $('.left-title__content').removeClass('cas-animated');          
    }                
                
    function stopSlideshow() {                
        if (currentInterval) {                
            clearInterval(currentInterval);                
            currentInterval = null;                
        }                
        if (window.casBgInterval) {                
            clearInterval(window.casBgInterval);                
            window.casBgInterval = null;                
        }                
    }                
                
    function startSlideshow(render, backdrops) {        
        stopSlideshow();        
                
        console.log('Starting slideshow with backdrops:', backdrops.length);        
                
        if (!backdrops || backdrops.length <= 1) {        
            console.log('Not enough backdrops for slideshow');        
            return;        
        }        
                
        let idx = 0;        
        const intervalTime = 15000;        
                
        const bg = render.find('.full-start__background img, img.full-start__background');        
                
        if (!bg.length) {        
            console.log('Background element not found');        
            return;        
        }        
                
        console.log('Background element found, starting slideshow');        
                
        currentInterval = setInterval(() => {        
            idx = (idx + 1) % backdrops.length;        
            const nextSrc = Lampa.TMDB.image('/t/p/original' + backdrops[idx].file_path);        
                    
            console.log('Changing background to:', nextSrc);        
                    
            bg.attr('src', nextSrc);        
        }, intervalTime);        
                
        window.casBgInterval = currentInterval;        
    }                
                
    // Нова функція для аналізу кольорів логотипів студій    
    function renderStudioLogosWithColorAnalysis(container, data) {    
     const studios = (data.networks || data.production_companies || []).filter(s => s.logo_path).slice(0, 1);  
            
        studios.forEach((studio, index) => {    
            const logoUrl = Lampa.TMDB.image('/t/p/w200' + studio.logo_path);    
            const id = 'cas_studio_' + Math.random().toString(36).substr(2, 9);    
                
            container.append(`<div class="cas-studio-item cas-wave-studio" id="${id}"><img src="${logoUrl}"></div>`);    
                
            const img = new Image();    
            img.crossOrigin = 'anonymous';    
            img.onload = function() {    
                const canvas = document.createElement('canvas');    
                const ctx = canvas.getContext('2d');    
                canvas.width = this.width;    
                canvas.height = this.height;    
                ctx.drawImage(this, 0, 0);    
                    
                try {    
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;    
                    let r = 0, g = 0, b = 0, count = 0;    
                        
                    for (let i = 0; i < imageData.length; i += 4) {    
                        if (imageData[i + 3] > 50) {    
                            r += imageData[i];    
                            g += imageData[i + 1];    
                            b += imageData[i + 2];    
                            count++;    
                        }    
                    }    
                        
                    if (count > 0) {    
                        const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / count;    
                        if (brightness < 40) {    
                            $('#' + id + ' img').css('filter', 'brightness(0) invert(1)');    
                        }    
                    }    
                } catch (e) {    
                    console.log('Error analyzing logo color:', e);    
                }    
            };    
            img.src = logoUrl;    
        });    
    }    
                
    async function processImages(render, data, res) {                
        try {                
            const bestLogo = res.logos.find(l => l.iso_639_1 === 'uk') || res.logos.find(l => l.iso_639_1 === 'en') || res.logos[0];                
            if (bestLogo) {        
                const quality = Lampa.Storage.get('cas_logo_quality') || 'original';                
                const logoSrc = Lampa.TMDB.image('/t/p/' + quality + bestLogo.file_path);                
                await preloadImage(logoSrc);                
                render.find('.cas-logo').html(`<img src="${logoSrc}">`);                
            } else {                
                render.find('.cas-logo').html(`<div style="font-size: 3em; font-weight: 800; text-transform: uppercase;">${data.title || data.name}</div>`);                
            }                
            stopSlideshow();                
            if (Lampa.Storage.get('cas_slideshow_enabled') && res.backdrops && res.backdrops.length > 1) {        
                console.log('Slideshow enabled, backdrops:', res.backdrops.length);        
                startSlideshow(render, res.backdrops);        
            } else {        
                console.log('Slideshow disabled or not enough backdrops');        
            }                
        } catch (error) {                
            render.find('.cas-logo').html(`<div style="font-size: 3em; font-weight: 800; text-transform: uppercase;">${data.title || data.name}</div>`);                
        }                
    }    
                
async function loadMovieDataOptimized(render, data) {    
    const tasks = [];    
        
    if (Lampa.Storage.get('cas_show_description')) {    
        tasks.push(Promise.resolve().then(() => {    
            render.find('.cas-description').html(data.overview || '').css('opacity','1').show();    
        }));    
    }    
        
    // Об'єднана задача для метаданих та рейтингів з іконками    
    tasks.push(Promise.resolve().then(() => {    
        const year = data.release_date ? new Date(data.release_date).getFullYear() : (data.first_air_date ? new Date(data.first_air_date).getFullYear() : '');    
        const time = formatTime(data.runtime || (data.episode_run_time ? data.episode_run_time[0] : 0));    
        const genre = (data.genres || []).slice(0, 1).map(g => g.name).join('');    
            
        // Рейтинги з іконками    
        let ratings = '';    
        const tmdbV = parseFloat(data.vote_average || 0).toFixed(1);    
        if (tmdbV > 0) {    
            ratings += `<img src="${ICONS.tmdb}" style="height: 1.1em; margin-right: 4px;"> <span style="color:${getRatingColor(tmdbV)}">${tmdbV}</span>`;    
        }    
            
        if (data.reactions && data.reactions.result) {    
            let sum = 0, cnt = 0;    
            const coef = { fire: 10, nice: 7.5, think: 5, bore: 2.5, shit: 0 };    
            data.reactions.result.forEach(r => {           
                if (r.counter) { sum += (r.counter * coef[r.type]); cnt += r.counter; }          
            });    
            if (cnt >= 1) {    
                const isTv = data.name ? true : false;    
                const cubV = (((isTv?7.4:6.5)*(isTv?50:150)+sum)/((isTv?50:150)+cnt)).toFixed(1);    
                if (ratings) ratings += ' • ';    
                ratings += `<img src="${ICONS.cub}" style="height: 1.1em; margin-right: 4px;"> <span style="color:${getRatingColor(cubV)}">${cubV}</span>`;    
            }    
        }    
            
        // Формуємо повний рядок з хвильовою анімацією    
        let metaHtml = '';    
        if (year) metaHtml += `<span class="cas-wave-year">${year}</span>`;    
        if (time) metaHtml += `<span class="cas-wave-time">${time}</span>`;    
        if (genre) metaHtml += `<span class="cas-wave-genre">${genre}</span>`;    
        if (ratings) metaHtml += `<span class="cas-wave-rating">${ratings}</span>`;    
            
        render.find('.cas-meta-info').html(metaHtml);    
        render.find('.cas-rate-items').empty(); // Очищуємо окремий блок рейтингів    
    }));    
        
    if (Lampa.Storage.get('cas_show_studios')) {    
        tasks.push(Promise.resolve().then(() => {    
            renderStudioLogosWithColorAnalysis(render.find('.cas-studios-row'), data);    
        }));    
    }    
        
    await Promise.all(tasks);    
        
    // Обробка якості з підтримкою аудіо форматів    
    if (Lampa.Storage.get('cas_show_quality') && Lampa.Parser.get) {    
        Lampa.Parser.get({ search: data.title || data.name, movie: data, page: 1 }, (res) => {    
            try {    
                const items = res.Results || res;    
                if (items && Array.isArray(items) && items.length > 0) {    
                    const b = { res: '', hdr: false, dv: false, ukr: false, audio: '', dub: false };    
                    items.slice(0, 8).forEach(i => {    
                        const t = (i.Title || i.title || '').toLowerCase();    
                        if (t.includes('4k') || t.includes('2160')) b.res = '4K';    
                        else if (!b.res && (t.includes('1080') || t.includes('fhd'))) b.res = 'FULL HD';    
                        if (t.includes('hdr')) b.hdr = true;    
                        if (t.includes('dv') || t.includes('dovi') || t.includes('vision')) b.dv = true;    
                        if (t.includes('ukr') || t.includes('укр')) b.ukr = true;    
                        if (t.includes('5.1') || t.includes('5 1')) b.audio = '5.1';    
                        else if (t.includes('7.1') || t.includes('7 1')) b.audio = '7.1';    
                        else if (t.includes('4.0') || t.includes('4 0')) b.audio = '4.0';    
                        else if (t.includes('2.0') || t.includes('2 0')) b.audio = '2.0';    
                        if (t.includes('dub') || t.includes('дубл')) b.dub = true;    
                    });    
                        
                    let qH = '';    
                    if (b.res) qH += `<div class="cas-quality-item cas-wave-quality"><img src="${QUALITY_ICONS[b.res]}"></div>`;    
                    if (b.dv) qH += `<div class="cas-quality-item cas-wave-hdr"><img src="${QUALITY_ICONS['Dolby Vision']}"></div>`;    
                    else if (b.hdr) qH += `<div class="cas-quality-item cas-wave-hdr"><img src="${QUALITY_ICONS['HDR']}"></div>`;    
                    if (b.audio) qH += `<div class="cas-quality-item cas-wave-quality cas-audio-item">${b.audio}</div>`;    
                    if (b.dub) qH += `<div class="cas-quality-item cas-wave-quality"><img src="${QUALITY_ICONS['DUB']}"></div>`;    
                    if (b.ukr) qH += `<div class="cas-quality-item cas-wave-ukr"><img src="${QUALITY_ICONS['UKR']}"></div>`;    
                        
                    if (qH) {    
                      render.find('.cas-quality-row').html(qH).show();  
                    }    
                }    
            } catch (error) {    
                render.find('.cas-quality-row').hide();    
            }    
        }).fail(() => {    
            render.find('.cas-quality-row').hide();    
        });    
    } else {    
        render.find('.cas-quality-row').hide();    
    }    
}             
    const debouncedLoadMovieData = debounce((render, data) => {                
        try { loadMovieDataOptimized(render, data); } catch (error) {}                
    }, 250);                
                
    function attachLoader() {                
        Lampa.Listener.follow('full', (event) => {                
            if (event.type === 'complite') {                
                const data = event.data.movie;                
                const render = event.object.activity.render();                
                const content = render.find('.left-title__content');                
                            
                content.removeClass('cas-animated');                
                event.object.activity.onBeforeDestroy = cleanup;                
                                
                if (data && data.id) {                
                    render.data('movie', data);                
                    const cacheId = 'tmdb_' + data.id;                
                    const cached = getCachedData(cacheId);                
                                
                    const processImagesWrapper = async (res) => {                
                        try { await processImages(render, data, res); } catch (e) {}                
                    };                
                                    
                    if (cached) processImagesWrapper(cached);                
                    else {                
                        const imagesUrl = Lampa.TMDB.api((data.name ? 'tv/' : 'movie/') + data.id + '/images?api_key=' + Lampa.TMDB.key());                
                        $.getJSON(imagesUrl, (res) => {                
                            setCachedData(cacheId, res);                
                            processImagesWrapper(res);                
                        }).fail(() => {                
                            render.find('.cas-logo').html(`<div style="font-size: 3em; font-weight: 800; text-transform: uppercase;">${data.title || data.name}</div>`);                
                        });                
                    }                
                                    
                    // Об'єднуємо дані реакцій з об'єктом фільму для loadMovieDataOptimized          
                    if (event.data.reactions) data.reactions = event.data.reactions;          
                    debouncedLoadMovieData(render, data);                
                }                
                                
                setTimeout(() => content.addClass('cas-animated'), 100);                
                                
                setTimeout(() => {                
                    const firstButton = render.find('.full-start-new__buttons .full-start__button').first();                
                    if (firstButton.length) {                
                        render.find('.full-start__button').removeClass('focus');                
                        firstButton.addClass('focus').trigger('focus');                
                    }                
                }, 200);                
            }                
        });                
    }              
                  
    function startPlugin() {                   
        try {                  
            initializePlugin();                  
            console.log('NewCard plugin initialized successfully');                  
        } catch (error) {                  
            console.error('Failed to initialize NewCard plugin:', error);                  
        }                  
    }                  
                  
    if (window.appready) startPlugin();                  
    else Lampa.Listener.follow('app', (e) => { if (e.type === 'ready') startPlugin(); });                  
})();
