(function () {
    'use strict';

    // Іконка плагіна (Фрагмент кіноплівки - NewCard)
const PLUGIN_ICON = '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="#333"><rect x="5" y="30" width="90" height="40" rx="5" fill="hsl(0, 0%, 30%)"/><rect x="8" y="33" width="6" height="6" fill="#1E1E1E"/><rect x="18" y="33" width="6" height="6" fill="#1E1E1E"/><rect x="28" y="33" width="6" height="6" fill="#1E1E1E"/><rect x="38" y="33" width="6" height="6" fill="#1E1E1E"/><rect x="48" y="33" width="6" height="6" fill="#1E1E1E"/><rect x="58" y="33" width="6" height="6" fill="#1E1E1E"/><rect x="68" y="33" width="6" height="6" fill="#1E1E1E"/><rect x="78" y="33" width="6" height="6" fill="#1E1E1E"/><rect x="8" y="61" width="6" height="6" fill="#1E1E1E"/><rect x="18" y="61" width="6" height="6" fill="#1E1E1E"/><rect x="28" y="61" width="6" height="6" fill="#1E1E1E"/><rect x="38" y="61" width="6" height="6" fill="#1E1E1E"/><rect x="48" y="61" width="6" height="6" fill="#1E1E1E"/><rect x="58" y="61" width="6" height="6" fill="#1E1E1E"/><rect x="68" y="61" width="6" height="6" fill="#1E1E1E"/><rect x="78" y="61" width="6" height="6" fill="#1E1E1E"/><rect x="15" y="40" width="20" height="20" fill="hsl(200, 80%, 70%)"/><rect x="40" y="40" width="20" height="20" fill="hsl(200, 80%, 80%)"/><rect x="65" y="40" width="20" height="20" fill="hsl(200, 80%, 70%)"/></svg>';
    
    // Головна функція плагіна
    function initializePlugin() {
        console.log('NewCard', 'v1.0.0');
        
        if (!Lampa.Platform.screen('tv')) {
            console.log('NewCard', 'TV mode only');
            return;
        }

        patchApiImg();
        addCustomTemplate();
        addStyles();
        addSettings();
        attachLogoLoader();
    }

    // Переклади для налаштувань (лише українська)
const translations = {
        show_ratings: {
            uk: 'Показувати рейтинги'
        },
        show_ratings_desc: {
            uk: 'Відображати рейтинги IMDB та КіноПошук'
        },
        ratings_position: {
            uk: 'Розташування рейтингів'
        },
        ratings_position_desc: {
            uk: 'Виберіть де відображати рейтинги'
        },
        position_card: {
            uk: 'У картці'
        },
        position_corner: {
            uk: 'У лівому нижньому куті'
        },
        logo_scale: {
            uk: 'Розмір логотипу'
        },
        logo_scale_desc: {
            uk: 'Масштаб логотипу фільму'
        },
        text_scale: {
            uk: 'Розмір тексту'
        },
        text_scale_desc: {
            uk: 'Масштаб тексту даних про фільм'
        },
        scale_default: {
            uk: 'За замовчуванням'
        },
        spacing_scale: {
            uk: 'Відступи між рядками'
        },
        spacing_scale_desc: {
            uk: 'Відстань між елементами інформації'
        },
        settings_title_display: {
            uk: 'Відображення'
        },
        settings_title_scaling: {
            uk: 'Масштабування'
        },
        // Видалено: show_reactions, show_reactions_desc, reverse_episodes, reverse_episodes_desc, year_short
    };
    
    // Рефакторинг: Спрощена функція перекладу
    function t(key) {
        return translations[key]?.['uk'] || '???';
    }

    // Додаємо налаштування плагіна
    function addSettings() {
        // Ініціалізуємо значення за замовчуванням
       if (Lampa.Storage.get('applecation_show_ratings') === undefined) {
            Lampa.Storage.set('applecation_show_ratings', false);
        }
        if (Lampa.Storage.get('applecation_ratings_position') === undefined) {
            Lampa.Storage.set('applecation_ratings_position', 'card');
        }
        if (Lampa.Storage.get('applecation_logo_scale') === undefined) {
            Lampa.Storage.set('applecation_logo_scale', '100');
        }
        if (Lampa.Storage.get('applecation_text_scale') === undefined) {
            Lampa.Storage.set('applecation_text_scale', '100');
        }
        if (Lampa.Storage.get('applecation_spacing_scale') === undefined) {
            Lampa.Storage.set('applecation_spacing_scale', '100');
        }
        // Видалено ініціалізацію 'applecation_reverse_episodes'

        // Створюємо розділ налаштувань
        Lampa.SettingsApi.addComponent({
            component: 'applecation_settings',
            name: 'NewCard', // Перейменовано
            icon: PLUGIN_ICON
        });
        
        // Показувати рейтинги
        Lampa.SettingsApi.addParam({
            component: 'applecation_settings',
            param: {
                name: 'applecation_show_ratings',
                type: 'trigger',
                default: false
            },
            field: {
                name: t('show_ratings'),
                description: t('show_ratings_desc')
            },
            onChange: function(value) {
                if (value) {
                    $('body').removeClass('applecation--hide-ratings');
                } else {
                    $('body').addClass('applecation--hide-ratings');
                }
            }
        });

        // Розташування рейтингів
        Lampa.SettingsApi.addParam({
            component: 'applecation_settings',
            param: {
                name: 'applecation_ratings_position',
                type: 'select',
                values: {
                    card: t('position_card'),
                    corner: t('position_corner')
                },
                default: 'card'
            },
            field: {
                name: t('ratings_position'),
                description: t('ratings_position_desc')
            },
            onChange: function(value) {
                Lampa.Storage.set('applecation_ratings_position', value);
                $('body').removeClass('applecation--ratings-card applecation--ratings-corner');
                $('body').addClass('applecation--ratings-' + value);
                // Оновлюємо шаблон і перезавантажуємо активність
                addCustomTemplate();
                Lampa.Activity.back();
            }
        });
       // Показати реакції (Налаштування залишено, але переклади видалено, оскільки воно не має onChange)
        Lampa.SettingsApi.addParam({
            component: 'applecation_settings',
            param: {
                name: 'card_interfice_reactions',
                type: 'trigger',
                default: true
            },
            field: {
                name: 'Показувати реакції Lampa', // Використовуємо тут фіксований текст
                description: 'Відображати блок з реакціями на картці' // Використовуємо тут фіксований текст
            }
        });

        // Розмір логотипа
        Lampa.SettingsApi.addParam({
            component: 'applecation_settings',
            param: {
                name: 'applecation_logo_scale',
                type: 'select',
                values: {
                    '50': '50%',
                    '60': '60%',
                    '70': '70%',
                    '80': '80%',
                    '90': '90%',
                    '100': t('scale_default'),
                    '110': '110%',
                    '120': '120%',
                    '130': '130%',
                    '140': '140%',
                    '150': '150%',
                    '160': '160%',
                    '170': '170%',
                    '180': '180%'
                },
                default: '100'
            },
            field: {
                name: t('logo_scale'),
                description: t('logo_scale_desc')
            },
            onChange: function(value) {
                Lampa.Storage.set('applecation_logo_scale', value);
                applyScales();
            }
        });

        // Розмір тексту
        Lampa.SettingsApi.addParam({
            component: 'applecation_settings',
            param: {
                name: 'applecation_text_scale',
                type: 'select',
                values: {
                    '50': '50%',
                    '60': '60%',
                    '70': '70%',
                    '80': '80%',
                    '90': '90%',
                    '100': t('scale_default'),
                    '110': '110%',
                    '120': '120%',
                    '130': '130%',
                    '140': '140%',
                    '150': '150%',
                    '160': '160%',
                    '170': '170%',
                    '180': '180%'
                },
                default: '100'
            },
            field: {
                name: t('text_scale'),
                description: t('text_scale_desc')
            },
            onChange: function(value) {
                Lampa.Storage.set('applecation_text_scale', value);
                applyScales();
            }
        });

        // відступ між нядками
        Lampa.SettingsApi.addParam({
            component: 'applecation_settings',
            param: {
                name: 'applecation_spacing_scale',
                type: 'select',
                values: {
                    '50': '50%',
                    '60': '60%',
                    '70': '70%',
                    '80': '80%',
                    '90': '90%',
                    '100': t('scale_default'),
                    '110': '110%',
                    '120': '120%',
                    '130': '130%',
                    '140': '140%',
                    '150': '150%',
                    '160': '160%',
                    '170': '170%',
                    '180': '180%',
                    '200': '200%',
                    '250': '250%',
                    '300': '300%'
                },
                default: '100'
            },
            field: {
                name: t('spacing_scale'),
                description: t('spacing_scale_desc')
            },
            onChange: function(value) {
                Lampa.Storage.set('applecation_spacing_scale', value);
                applyScales();
            }
        });

        // Застосовуємо налаштування 
        if (!Lampa.Storage.get('applecation_show_ratings', false)) {
            $('body').addClass('applecation--hide-ratings');
        }
        $('body').addClass('applecation--ratings-' + Lampa.Storage.get('applecation_ratings_position', 'card'));
        applyScales();
    }

    // Применяем масштабирование контента
    function applyScales() {
        const logoScale = parseInt(Lampa.Storage.get('applecation_logo_scale', '100'));
        const textScale = parseInt(Lampa.Storage.get('applecation_text_scale', '100'));
        const spacingScale = parseInt(Lampa.Storage.get('applecation_spacing_scale', '100'));

        // Удаляем старые стили если есть
        $('style[data-id="applecation_scales"]').remove();

        // Создаем новые стили
        const scaleStyles = `
            <style data-id="applecation_scales">
                /* Масштаб логотипа */
                
                .applecation .applecation__logo img {
                    max-width: ${35 * logoScale / 100}vw !important;
                    max-height: ${180 * logoScale / 100}px !important;
                }

                /* Масштаб текста и мета-информации */
                .applecation .applecation__content-wrapper {
                    font-size: ${textScale}% !important;
                }

                /* Отступы между элементами */
                .applecation .full-start-new__title {
                    margin-bottom: ${0.5 * spacingScale / 100}em !important;
                }
                
                .applecation .applecation__meta {
                    margin-bottom: ${0.5 * spacingScale / 100}em !important;
                }
                
                .applecation .applecation__ratings {
                    margin-bottom: ${0.5 * spacingScale / 100}em !important;
                }
                
                .applecation .applecation__description {
                    max-width: ${35 * textScale / 100}vw !important;
                    margin-bottom: ${0.5 * spacingScale / 100}em !important;
                }
                
                .applecation .applecation__info {
                    margin-bottom: ${0.5 * spacingScale / 100}em !important;
                }
            </style>
        `;

        $('body').append(scaleStyles);
    }

    // Реєструємо кастомний шаблон сторінки full
    function addCustomTemplate() {
        const ratingsPosition = Lampa.Storage.get('applecation_ratings_position', 'card');
        
        // Блок з рейтингами
        const ratingsBlock = `<div class="applecation__ratings">
                        <div class="rate--imdb hide">
                            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none">
                                <path fill="currentColor" d="M4 7c-1.103 0-2 .897-2 2v6.4c0 1.103.897 2 2 2h16c1.103 0 2-.897 2-2V9c0-1.103-.897-2-2-2H4Zm1.4 2.363h1.275v5.312H5.4V9.362Zm1.962 0H9l.438 2.512.287-2.512h1.75v5.312H10.4v-3l-.563 3h-.8l-.512-3v3H7.362V9.362Zm8.313 0H17v1.2c.16-.16.516-.363.875-.363.36.04.84.283.8.763v3.075c0 .24-.075.404-.275.524-.16.04-.28.075-.6.075-.32 0-.795-.196-.875-.237-.08-.04-.163.275-.163.275h-1.087V9.362Zm-3.513.037H13.6c.88 0 1.084.078 1.325.237.24.16.35.397.35.838v3.2c0 .32-.15.563-.35.762-.2.2-.484.288-1.325.288h-1.438V9.4Zm1.275.8v3.563c.2 0 .488.04.488-.2v-3.126c0-.28-.247-.237-.488-.237Zm3.763.675c-.12 0-.2.08-.2.2v2.688c0 .159.08.237.2.237.12 0 .2-.117.2-.238l-.037-2.687c0-.12-.043-.2-.163-.2Z"/>
                            </svg>
                            <div>0.0</div>
                        </div>
                        <div class="rate--kp hide">
                            <svg viewBox="0 0 192 192" xmlns="http://www.w3.org/2000/svg" fill="none">
                                <path d="M96.5 20 66.1 75.733V20H40.767v152H66.1v-55.733L96.5 172h35.467C116.767 153.422 95.2 133.578 80 115c28.711 16.889 63.789 35.044 92.5 51.933v-30.4C148.856 126.4 108.644 115.133 85 105c23.644 3.378 63.856 7.889 87.5 11.267v-30.4L85 90c27.022-11.822 60.478-22.711 87.5-34.533v-30.4C143.789 41.956 108.711 63.11 80 80l51.967-60z" style="fill:none;stroke:currentColor;stroke-width:5;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10"/>
                            </svg>
                            <div>0.0</div>
                        </div>
                    </div>`;
        
        const template = `<div class="full-start-new applecation">
        <div class="full-start-new__body">
            <div class="full-start-new__left hide">
                <div class="full-start-new__poster">
                    <img class="full-start-new__img full--poster" />
                </div>
            </div>

            <div class="full-start-new__right">
                <div class="applecation__left">
                    <div class="applecation__logo"></div>
                    
                    <div class="applecation__content-wrapper">
                        <div class="full-start-new__title" style="display: none;">{title}</div>
                        
                        <div class="applecation__meta">
                            <div class="applecation__meta-left">
                                <span class="applecation__network"></span>
                                <span class="applecation__meta-text"></span>
                                <div class="full-start__pg hide"></div>
                            </div>
                        </div>
                        
                        ${ratingsPosition === 'card' ? ratingsBlock : ''}
                        
                        <div class="applecation__description-wrapper">
                            <div class="applecation__description"></div>
                        </div>
                        <div class="applecation__info"></div>
                    </div>
                    
        <div class="full-start-new__head" style="display: none;"></div>
                    <div class="full-start-new__details" style="display: none;"></div>

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
                                <path d="M37.208 10.9742C37.1364 10.8013 37.0314 10.6441 36.899 10.5117C36.7666 10.3794 36.6095 10.2744 36.4365 10.2028L12.0658 0.108375C11.7166 -0.0361828 11.3242 -0.0361227 10.9749 0.108542C10.6257 0.253206 10.3482 0.530634 10.2034 0.879836L0.108666 25.2507C0.0369593 25.4236 3.37953e-05 25.609 2.3187e-08 25.7962C-3.37489e-05 25.9834 0.0368249 26.1688 0.108469 26.3418C0.180114 26.5147 0.28514 26.6719 0.417545 26.8042C0.54995 26.9366 0.707139 27.0416 0.880127 27.1131L17.2452 33.8917C17.5945 34.0361 17.9869 34.0361 18.3362 33.8917L29.6574 29.2017C29.8304 29.1301 29.9875 29.0251 30.1199 28.8928C30.2523 28.7604 30.3573 28.6032 30.4289 28.4303L37.2078 12.065C37.2795 11.8921 37.3164 11.7068 37.3164 11.5196C37.3165 11.3325 37.2796 11.1471 37.208 10.9742ZM20.425 29.9407L21.8784 26.4316L25.3873 27.885L20.425 29.9407ZM28.3407 26.0222L21.6524 23.252C21.3031 23.1075 20.9107 23.1076 20.5615 23.2523C20.2123 23.3969 19.9348 23.6743 19.79 24.0235L17.0194 30.7123L3.28783 25.0247L12.2918 3.28773L34.0286 12.2912L28.3407 26.0222Z" fill="currentColor"/>
                                <path d="M25.3493 16.976L24.258 14.3423L16.959 17.3666L15.7196 14.375L13.0859 15.4659L15.4161 21.0916L25.3493 16.976Z" fill="currentColor"/>
                            </svg>
                            <span>#{title_reactions}</span>
                        </div>

                        <div class="full-start__button selector button--subscribe hide">
                            <svg width="25" height="30" viewBox="0 0 25 30" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M6.01892 24C6.27423 27.3562 9.07836 30 12.5 30C15.9216 30 18.7257 27.3562 18.981 24H15.9645C15.7219 25.6961 14.2632 27 12.5 27C10.7367 27 9.27804 25.6961 9.03542 24H6.01892Z" fill="currentColor"/>
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

                <div class="applecation__right">
                    <div class="full-start-new__reactions selector">
                        <div>#{reactions_none}</div>
                    </div>
                    
                    ${ratingsPosition === 'corner' ? ratingsBlock : ''}

                    <div class="full-start-new__rate-line">
                        <div class="full-start__status hide"></div>
                    </div>
                    
                    <div class="rating--modss" style="display: none;"></div>
                </div>
            </div>
        </div>

        <div class="hide buttons--container">
            <div class="full-start__button view--torrent hide">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50" width="50px" height="50px">
                    <path d="M25,2C12.317,2,2,12.317,2,25s10.317,23,23,23s23-10.317,23-23S37.683,2,25,2z M40.5,30.963c-3.1,0-4.9-2.4-4.9-2.4 S34.1,35,27,35c-1.4,0-3.6-0.837-3.6-0.837l4.17,9.643C26.727,43.92,25.874,44,25,44c-2.157,0-4.222-0.377-6.155-1.039L9.237,16.851 c0,0-0.7-1.2,0.4-1.5c1.1-0.3,5.4-1.2,5.4-1.2s1.475-0.494,1.8,0.5c0.5,1.3,4.063,11.112,4.063,11.112S22.6,29,27.4,29 c4.7,0,5.9-3.437,5.7-3.937c-1.2-3-4.993-11.862-4.993-11.862s-0.6-1.1,0.8-1.4c1.4-0.3,3.8-0.7,3.8-0.7s1.105-0.163,1.6,0.8 c0.738,1.437,5.193,11.262,5.193,11.262s1.1,2.9,3.3,2.9c0.464,0,0.834-0.046,1.152-0.104c-0.082,1.635-0.348,3.221-0.817,4.722 C42.541,30.867,41.756,30.963,40.5,30.963z" fill="currentColor"/>
                </svg>
                <span>#{full_torrents}</span>
            </div>

            <div class="full-start__button selector view--trailer">
                <svg height="70" viewBox="0 0 80 70" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path fill-rule="evenodd" clip-rule="evenodd" d="M71.2555 2.08955C74.6975 3.2397 77.4083 6.62804 78.3283 10.9306C80 18.7291 80 35 80 35C80 35 80 51.2709 78.3283 59.0694C77.4083 63.372 74.6975 66.7603 71.2555 67.9104C65.0167 70 40 70 40 70C40 70 14.9833 70 8.74453 67.9104C5.3025 66.7603 2.59172 63.372 1.67172 59.0694C0 51.2709 0 35 0 35C0 35 0 18.7291 1.67172 10.9306C2.59172 6.62804 5.3025 3.2395 8.74453 2.08955C14.9833 0 40 0 40 0C40 0 65.0167 0 71.2555 2.08955ZM55.5909 35.0004L29.9773 49.5714V20.4286L55.5909 35.0004Z" fill="currentColor"></path>
                </svg>
                <span>#{full_trailers}</span>
            </div>
        </div>
    </div>`;
    
        
        Lampa.Template.add('full_start_new', template);

        // Переопределяем шаблон эпизода для стиля Apple TV
        const episodeTemplate = `<div class="full-episode selector layer--visible">
            <div class="full-episode__img">
                <img />
                <div class="full-episode__time">{time}</div>
            </div>

            <div class="full-episode__body">
                <div class="full-episode__num">#{full_episode} {num}</div>
                <div class="full-episode__name">{name}</div>
                <div class="full-episode__overview">{overview}</div>
                <div class="full-episode__date">{date}</div>
            </div>
        </div>`;
        
        Lampa.Template.add('full_episode', episodeTemplate);
    }

    function disableFullDescription(e) {
        if (e.type === 'start' && e.link) {
            
            const rows = e.link.rows;
            const index = rows.indexOf('description');
            if (index > -1) {
                rows.splice(index, 1);
            }
        }
    }
    
    function addStyles() {
        const styles = `<style>
/* Основной контейнер */
.applecation {
    transition: all .3s;
}

.applecation .full-start-new__body {
    height: 80vh;
}

.applecation .full-start-new__right {
    display: flex;
    align-items: flex-end;
}

.applecation .full-start-new__title {
    font-size: 2.5em;
    font-weight: 700;
    line-height: 1.2;
    margin-bottom: 0.5em;
    text-shadow: 0 0 .1em rgba(0, 0, 0, 0.3);
}

/* Логотип */
.applecation__logo {
    margin-bottom: 0.5em;
    opacity: 0;
    transform: translateY(20px);
    transition: opacity 0.4s ease-out, transform 0.4s ease-out;
}

.applecation__logo.loaded {
    opacity: 1;
    transform: translateY(0);
}

.applecation__logo img {
    display: block;
    max-width: 35vw;
    width: auto;
    height: auto;
    object-fit: contain;
    object-position: left center;
    
    /* Дефолтный (Средний) размер */
    max-height: 180px; 
}

/* Стилизация размера логотипа */
body.applecation--logo-small .applecation__logo img {
    max-height: 120px;
    max-width: 25vw;
}

body.applecation--logo-large .applecation__logo img {
    max-height: 250px;
    max-width: 45vw;
}

/* Мета информация (Тип/Жанр/поджанр) */
.applecation__meta {
    display: flex;
    align-items: center;
    color: #fff;
    font-size: 1.1em;
    margin-bottom: 0.5em;
    line-height: 1;
    opacity: 0;
    transform: translateY(15px);
    transition: opacity 0.4s ease-out, transform 0.4s ease-out;
    transition-delay: 0.05s;
}

.applecation__meta.show {
    opacity: 1;
    transform: translateY(0);
}

.applecation__meta-left {
    display: flex;
    align-items: center;
    line-height: 1;
}

.applecation__network {
    display: inline-flex;
    align-items: center;
    line-height: 1;
}

.applecation__network img {
    display: block;
    max-height: 1.4em;
    width: auto;
    object-fit: contain;
    filter: brightness(0) invert(1);
}

.applecation__meta-text {
    margin-left: 1em;
    line-height: 1;
}

.applecation__meta .full-start__pg {
    margin: 0 0 0 0.6em;
    padding: 0.2em 0.5em;
    font-size: 0.85em;
    font-weight: 600;
    border: 1.5px solid rgba(255, 255, 255, 0.4);
    border-radius: 0.3em;
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.9);
    line-height: 1;
    vertical-align: middle;
}

/* Рейтинги */
.applecation__ratings {
    display: flex;
    align-items: center;
    gap: 0.8em;
    margin-bottom: 0.5em;
    opacity: 0;
    transform: translateY(15px);
    transition: opacity 0.4s ease-out, transform 0.4s ease-out;
    transition-delay: 0.08s;
}

.applecation__ratings.show {
    opacity: 1;
    transform: translateY(0);
}

.applecation__ratings .rate--imdb,
.applecation__ratings .rate--kp {
    display: flex;
    align-items: center;
    gap: 0.35em;
}

.applecation__ratings svg {
    width: 2.5em;
    height: auto;
    flex-shrink: 0;
    color: rgba(255, 255, 255, 0.85);
}

.applecation__ratings .rate--kp svg {
    width: 1.5em;
}

.applecation__ratings > div > div {
    font-size: 0.95em;
    font-weight: 600;
    line-height: 1;
    color: #fff;
}

/* Управление видимостью рейтингов через настройки */
body.applecation--hide-ratings .applecation__ratings {
    display: none !important;
}

/* Скрытие реакций через настройки */
body.applecation--hide-reactions .full-start-new__reactions {
    display: none !important;
}

/* Расположение рейтингов - в левом нижнем углу */
body.applecation--ratings-corner .applecation__right {
    gap: 1em;
}

body.applecation--ratings-corner .applecation__ratings {
    margin-bottom: 0;
}

/* Описание */
.applecation__description {
    color: rgba(255, 255, 255, 0.6);
    font-size: 0.95em;
    line-height: 1.5;
    margin-bottom: 0.5em;
    max-width: 35vw;
    display: -webkit-box;
    -webkit-line-clamp: 4;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
    opacity: 0;
    transform: translateY(15px);
    transition: opacity 0.4s ease-out, transform 0.4s ease-out;
    transition-delay: 0.1s;
}

.applecation__description.show {
    opacity: 1;
    transform: translateY(0);
}

/* Дополнительная информация (Год/длительность) */
.applecation__info {
    color: rgba(255, 255, 255, 0.75);
    font-size: 1em;
    line-height: 1.4;
    margin-bottom: 0.5em;
    opacity: 0;
    transform: translateY(15px);
    transition: opacity 0.4s ease-out, transform 0.4s ease-out;
    transition-delay: 0.15s;
}

.applecation__info.show {
    opacity: 1;
    transform: translateY(0);
}

/* Левая и правая части */
.applecation__left {
    flex-grow: 1;
}

.applecation__right {
    display: flex;
    align-items: flex-end;
    flex-shrink: 0;
    position: relative;
}

/* Выравнивание по baseline только если реакции видны и рейтинги в углу */
body.applecation--ratings-corner:not(.applecation--hide-reactions) .applecation__right {
    align-items: last baseline;
}

/* Реакции */
.applecation .full-start-new__reactions {
    margin: 0;
    display: flex;
    flex-direction: column-reverse;
    align-items: flex-end;
}

.applecation .full-start-new__reactions > div {
    align-self: flex-end;
}

.applecation .full-start-new__reactions:not(.focus) {
    margin: 0;
}

.applecation .full-start-new__reactions:not(.focus) > div:not(:first-child) {
    display: none;
}

/* Стили первой реакции (всегда видимой) */
.applecation .full-start-new__reactions > div:first-child .reaction {
    display: flex !important;
    align-items: center !important;
    background-color: rgba(0, 0, 0, 0) !important;
    gap: 0 !important;
}

.applecation .full-start-new__reactions > div:first-child .reaction__icon {
    background-color: rgba(0, 0, 0, 0.3) !important;
    -webkit-border-radius: 5em;
    -moz-border-radius: 5em;
    border-radius: 5em;
    padding: 0.5em;
    width: 2.6em !important;
    height: 2.6em !important;
}

.applecation .full-start-new__reactions > div:first-child .reaction__count {
    font-size: 1.2em !important;
    font-weight: 500 !important;
}

/* При фокусе реакции раскрываются вверх */
.applecation .full-start-new__reactions.focus {
    gap: 0.5em;
}

.applecation .full-start-new__reactions.focus > div {
    display: block;
}

/* Скрываем стандартный rate-line (используется только для статуса) */
.applecation .full-start-new__rate-line {
    margin: 0;
    height: 0;
    overflow: hidden;
    opacity: 0;
    pointer-events: none;
}

/* 1. Стиль для фону (лише картинка) */
.full-start__background {
    height: calc(100% + 6em);
    left: 0 !important;
    opacity: 0 !important;
    transition: opacity 0.6s ease-out, filter 0.3s ease-out !important;
    animation: none !important;
    transform: none !important;
    will-change: opacity, filter;
    z-index: 0 !important; /* Найнижчий шар */
}

/* 2. Створюємо НОВИЙ шар затемнення, який не залежить від фону */
.full-start__details::before {
    content: '';
    position: absolute;
    top: -100px; /* Перекриваємо з запасом зверху */
    left: -100px; /* Перекриваємо з запасом зліва */
    width: 150%;  /* Широкий градієнт */
    height: 150%;
    /* Ті самі кольори Apple TV: чорний -> прозорий */
    background: linear-gradient(90deg, 
        rgba(0, 0, 0, 1) 0%, 
        rgba(0, 0, 0, 0.8) 25%, 
        rgba(0, 0, 0, 0.4) 50%, 
        rgba(0, 0, 0, 0) 100%
    );
    z-index: -1; /* Він буде під текстом деталей, але над фоном */
    pointer-events: none;
}

/* 3. Гарантуємо, що контент (логотип, текст) буде зверху */
.applecation__logo, 
.applecation__meta, 
.applecation__info, 
.applecation__description, 
.applecation__ratings {
    position: relative;
    z-index: 2;
}

/* Стандартні стани завантаження */
.full-start__background.loaded:not(.dim) {
    opacity: 1 !important;
}

.full-start__background.dim {
    filter: brightness(0.3);
}

.full-start__background.loaded.applecation-animated {
    opacity: 1 !important;
}

/* Приховуємо зайві елементи */
.applecation .full-start__status {
    display: none;
}
</style>`;
        
        Lampa.Template.add('applecation_css', styles);
        $('body').append(Lampa.Template.get('applecation_css', {}, true));
    }

    // Патчим Api.img для улучшенного качества фона
    function patchApiImg() {
        const originalImg = Lampa.Api.img;
        
        Lampa.Api.img = function(src, size) {
            // Улучшаем качество backdrop фонов в соответствии с poster_size
            if (size === 'w1280') {
                const posterSize = Lampa.Storage.field('poster_size');
                
                // Маппінг poster_size на backdrop розміри
                const sizeMap = {
                    'w200': 'w780',      // Низьке → мінімальний backdrop
                    'w300': 'w1280',     // Середнє → стандартний backdrop
                    'w500': 'original'   // Високе → оригінальний backdrop
                };
                
                size = sizeMap[posterSize] || 'w1280';
            }
            return originalImg.call(this, src, size);
        };
    }

    // Отримуємо якість логотипа на основі poster_size
    function getLogoQuality() {
        const posterSize = Lampa.Storage.field('poster_size');
        const qualityMap = {
            'w200': 'w300',      // Низьке постера → низьке лого
            'w300': 'w500',      // Середнє постера → середнє лого
            'w500': 'original'   // Високе постера → оригінальне лого
        };
        return qualityMap[posterSize] || 'w500';
    }
    
    // Нова функція для вибору найкращого логотипа
    function selectBestLogo(logos, currentLang) {
        // Приорітети мов: 1. Поточна мова ('uk'), 2. Англійська ('en'), 3. Будь-яка.
        
        // 1. Поточна мова ('uk')
        const preferred = logos.filter(l => l.iso_639_1 === 'uk');
        if (preferred.length > 0) {
            // Беремо логотип з найвищим рейтингом серед відповідних мов
            preferred.sort((a, b) => b.vote_average - a.vote_average);
            return preferred[0];
        }

        // 2. Англійська мова
        const english = logos.filter(l => l.iso_639_1 === 'en');
        if (english.length > 0) {
            english.sort((a, b) => b.vote_average - a.vote_average);
            return english[0];
        }
        
        // 3. Будь-яка мова (за найвищим рейтингом)
        if (logos.length > 0) {
            logos.sort((a, b) => b.vote_average - a.vote_average);
            return logos[0];
        }

        return null;
    }

    // Отримуємо локалізований тип медіа (лише українська)
    function getMediaType(data) {
        const isTv = !!data.name;
        
        const types = {
            uk: isTv ? 'Серіал' : 'Фільм',
        };
        
        // Оскільки залишаємо лише 'uk', можна не перевіряти Lampa.Storage.get('language')
        return types['uk']; 
    }

    // Завантажуємо іконку студії/мережі
    function loadNetworkIcon(activity, data) {
        const networkContainer = activity.render().find('.applecation__network');
        
        // Для серіалів - телемережа
        if (data.networks && data.networks.length) {
            const network = data.networks[0];
            if (network.logo_path) {
                const logoUrl = Lampa.Api.img(network.logo_path, 'w200');
                networkContainer.html(`<img src="${logoUrl}" alt="${network.name}">`);
                return;
            }
        }
        
        // Для фільмів - студія
        if (data.production_companies && data.production_companies.length) {
            const company = data.production_companies[0];
            if (company.logo_path) {
                const logoUrl = Lampa.Api.img(company.logo_path, 'w200');
                networkContainer.html(`<img src="${logoUrl}" alt="${company.name}">`);
                return;
            }
        }
        
// Якщо немає іконки - приховуємо контейнер
        networkContainer.remove();
    }

   // Заповнюємо мета інформацію (Тип/Жанр/піджанр)
    function fillMetaInfo(activity, data) {
        const metaTextContainer = activity.render().find('.applecation__meta-text');
        const metaParts = [];

        // Тип контенту
        metaParts.push(getMediaType(data));

        // Жанри (перші 2-3)
        if (data.genres && data.genres.length) {
            const genres = data.genres.slice(0, 2).map(g => 
                Lampa.Utils.capitalizeFirstLetter(g.name)
            );
            metaParts.push(...genres);
        }

        metaTextContainer.html(metaParts.join(' · '));
        
        // Завантажуємо іконку студії/мережі
        loadNetworkIcon(activity, data);
    }

    // Схиляння сезонів з локалізацією (залишено лише українську логіку)
    function formatSeasons(count) {
        // Логіка для української мови
        const cases = [2, 0, 1, 1, 1, 2];
        const titles = ['сезон', 'сезони', 'сезонів'];
        
        const caseIndex = (count % 100 > 4 && count % 100 < 20) ? 2 : cases[Math.min(count % 10, 5)];
        
        return `${count} ${titles[caseIndex]}`;
    }

    // Заповнюємо додаткову інформацію (Рік/тривалість)
    function fillAdditionalInfo(activity, data) {
        const infoContainer = activity.render().find('.applecation__info');
        const infoParts = [];

        // Рік випуску
        const releaseDate = data.release_date || data.first_air_date || '';
        if (releaseDate) {
            const year = releaseDate.split('-')[0];
            infoParts.push(year);
        }

        // Тривалість
        if (data.name) {
            // Серіал - показуємо і тривалість епізоду, і кількість сезонів
            if (data.episode_run_time && data.episode_run_time.length) {
                const avgRuntime = data.episode_run_time[0];
                // Використовуємо Lampa.Lang.translate, оскільки воно не було видалено
                const timeM = Lampa.Lang.translate('time_m').replace('.', '');
                infoParts.push(`${avgRuntime} ${timeM}`);
            }
            
            // Завжди показуємо кількість сезонів для серіалів
            const seasons = Lampa.Utils.countSeasons(data);
            if (seasons) {
                infoParts.push(formatSeasons(seasons));
            }
        } else {
            // Фільм - загальна тривалість
            if (data.runtime && data.runtime > 0) {
                const hours = Math.floor(data.runtime / 60);
                const minutes = data.runtime % 60;
                // Використовуємо Lampa.Lang.translate
                const timeH = Lampa.Lang.translate('time_h').replace('.', '');
                const timeM = Lampa.Lang.translate('time_m').replace('.', '');
                const timeStr = hours > 0 
                    ? `${hours} ${timeH} ${minutes} ${timeM}` 
                    : `${minutes} ${timeM}`;
                infoParts.push(timeStr);
            }
        }

        infoContainer.html(infoParts.join(' · '));
    }

    // Завантажуємо логотип фільму
    function loadLogo(event) {
        const data = event.data.movie;
        const activity = event.object.activity;
        
        if (!data || !activity) return;

        // ВИДАЛЕНО: Зайвий код для видалення елементів full-start-new__details та full-start-new__head
        
        // Заповнюємо основну інформацію
        fillMetaInfo(activity, data);       
        fillAdditionalInfo(activity, data); 

        // Чекаємо коли фон завантажиться і з'явиться
        waitForBackgroundLoad(activity, () => {
            // Після завантаження фону показуємо контент
            activity.render().find('.applecation__meta').addClass('show');      
            activity.render().find('.applecation__info').addClass('show');       
            activity.render().find('.applecation__ratings').addClass('show');    
            // Також показуємо опис, оскільки він має клас opacity: 0
            activity.render().find('.applecation__description').addClass('show');
        });

        // Завантажуємо логотип
        const mediaType = data.name ? 'tv' : 'movie';
        // Примусово встановлюємо мову для пошуку лого
        const currentLang = 'uk'; 
        
        // Запит всіх логотипів (TMDb images endpoint)
        const apiUrl = Lampa.TMDB.api(
            `${mediaType}/${data.id}/images?api_key=${Lampa.TMDB.key()}` // Залишили без локалізації, щоб отримати всі доступні лого
        );

        $.get(apiUrl, (imagesData) => {
            const logoContainer = activity.render().find('.applecation__logo');
            const titleElement = activity.render().find('.full-start-new__title');

            const bestLogo = selectBestLogo(imagesData.logos, currentLang);

            if (bestLogo) {
                const logoPath = bestLogo.file_path;
                const quality = getLogoQuality();
                const logoUrl = Lampa.TMDB.image(`/t/p/${quality}${logoPath}`);

                const img = new Image();
                img.onload = () => {
                    logoContainer.html(`<img src="${logoUrl}" alt="" />`);
                    waitForBackgroundLoad(activity, () => {
                        logoContainer.addClass('loaded');
                    });
                };
                img.src = logoUrl;
            } else {
                // Немає логотипа - показуємо текстову назву
                titleElement.show();
                waitForBackgroundLoad(activity, () => {
                    logoContainer.addClass('loaded');
                });
            }
        }).fail(() => {
        // При помилці показуємо текстову назву
            activity.render().find('.full-start-new__title').show();
            waitForBackgroundLoad(activity, () => {
                activity.render().find('.applecation__logo').addClass('loaded');
            });
        });
    }

 // Чекаємо завантаження та появи фону
    function waitForBackgroundLoad(activity, callback) {
        const background = activity.render().find('.full-start__background');
        
        if (!background.length) {
            callback();
            return;
        }

        // Якщо фон вже завантажений і анімація завершена
        if (background.hasClass('loaded') && background.hasClass('applecation-animated')) {
            callback();
            return;
        }

        // Якщо фон завантажений але анімація ще триває
        if (background.hasClass('loaded')) {
            // Чекаємо завершення transition + невелика затримка для надійності
            setTimeout(() => {
                background.addClass('applecation-animated');
                callback();
            }, 650); // 600ms transition + 50ms запас
            return;
        }

        // Чекаємо завантаження фону
        const checkInterval = setInterval(() => {
            if (background.hasClass('loaded')) {
                clearInterval(checkInterval);
                // Чекаємо завершення transition + невелика затримка
                setTimeout(() => {
                    background.addClass('applecation-animated');
                    callback();
                }, 650); // 600ms transition + 50ms запас
            }
        }, 50);

        // Таймаут на випадок якщо щось пішло не так
        setTimeout(() => {
            clearInterval(checkInterval);
            if (!background.hasClass('applecation-animated')) {
                background.addClass('applecation-animated');
                callback();
            }
        }, 2000);
    }

    // Підключаємо завантаження логотипів
    function attachLogoLoader() {
        Lampa.Listener.follow('full', (event) => {
            if (event.type === 'complite') {
                loadLogo(event);
            }
        });
    }

    // Реєстрація плагіна в маніфесті
    var pluginManifest = {
        type: 'other',
        version: '1.0.0',
        name: 'NewCard', // Перейменовано
        description: 'Новий дизайн картки фільму/серіалу.', // Оновлений опис
        author: '', // Видалено автора
        icon: PLUGIN_ICON
    };

    // Реєструємо плагін
    if (Lampa.Manifest && Lampa.Manifest.plugins) {
        Lampa.Manifest.plugins = pluginManifest;
    }

    // Запуск плагіна
    if (window.appready) {
        initializePlugin();
    } else {
        Lampa.Listener.follow('app', (event) => {
            if (event.type === 'ready') {
                initializePlugin();
            }
        });
    }

})();
