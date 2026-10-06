(function () {
  'use strict';

  /** SVG-иконки через спрайт (лише для доданих нами елементів) */
  const FAVORITE_SVG = `<svg><use xlink:href="#sprite-favorite"></use></svg>`; 
  const HISTORY_SVG = `<svg><use xlink:href="#sprite-history"></use></svg>`;
  const SEARCH_SVG = `<svg><use xlink:href="#sprite-search"></use></svg>`; 
  
  /** CSS */
  const css = `
  /* Стилі для усієї панелі */
  .navigation-bar__body {
      display: flex !important;
      justify-content: center !important;
      align-items: center !important;
      width: 100% !important;
      padding: 6px 10px !important;
      /* Ефект "Скло" (Background Blur) */
      background: rgba(20,20,25,0.6);
      backdrop-filter: blur(18px);
      -webkit-backdrop-filter: blur(18px);
      /* Тінь та рамка */
      box-shadow: 0 2px 25px rgba(0,0,0,0.6);
      border-top: 1px solid rgba(255,255,255,0.15);
      overflow: hidden !important;
  }

  /* **ФІКС ДУБЛІКАТІВ**: Приховуємо зайві елементи "Головна" */
  .navigation-bar__item[data-action="movie"],
  .navigation-bar__item[data-action="home"] { 
      display: none !important;
  }
  
  /* **ПОКАЗУЄМО ВСІ СИСТЕМНІ ЕЛЕМЕНТИ** (Назад, Пошук, Налаштування) */
  .navigation-bar__item[data-action="back"],
  .navigation-bar__item[data-action="search"],
  .navigation-bar__item[data-action="settings"] {
      display: flex !important;
  }
  
  /* Стилі для Налаштувань */
  .navigation-bar__item[data-action="settings"] {
      margin-left: 0 !important; 
      margin-right: 0 !important; 
      flex: 1 1 auto !important; 
      width: auto; 
  }
  
  /* Стилі для всіх кнопок (елементів) */
  .navigation-bar__item {
      flex: 1 1 auto !important;
      display: flex !important;
      align-items: center;
      justify-content: center;
      height: 70px !important;
      margin: 0 4px !important;
      
      /* Візуальні покращення: фон, тіні, заокруглення */
      background: rgba(255,255,255,0.05); 
      box-shadow: inset 0 0 10px rgba(0,0,0,0.3), 0 4px 15px rgba(0,0,0,0.4);
      
      border-radius: 14px;
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      /* Плавний перехід для ефектів */
      transition: all .25s cubic-bezier(0.17, 0.84, 0.44, 1);
      box-sizing: border-box;
  }

  /* Ефект наведення (градієнт та збільшення) */
  .navigation-bar__item:hover,
  .navigation-bar__item.active {
      background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.2) 100%);
      /* ЗБІЛЬШЕННЯ (трансформація) */
      transform: scale(1.08); 
      box-shadow: inset 0 0 10px rgba(0,0,0,0.1), 0 8px 25px rgba(100,200,255,0.3);
  }

  /* Анімація іконки при наведенні */
  .navigation-bar__item:hover .navigation-bar__icon svg {
      /* ЗБІЛЬШЕННЯ іконки */
      transform: scale(1.15); 
      fill: #FFFFFF !important;
      transition: fill .25s, transform .25s;
  }

  .navigation-bar__icon {
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
  }

  .navigation-bar__icon svg {
      width: 22px !important;
      height: 22px !important;
      fill: #F0F0F0 !important;
      transition: fill .25s, transform .25s;
  }

  /* Полностью скрываем подписи */
  .navigation-bar__label {
      display: none !important;
  }

  @media (max-width: 900px) {
      .navigation-bar__item { height: 66px !important; border-radius: 13px; }
  }
  @media (max-width: 600px) {
      .navigation-bar__item { height: 60px !important; border-radius: 12px; }
      .navigation-bar__icon svg { width: 20px !important; height: 20px !important; }
  }
  `;

  const $  = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));

  function injectCSS(){
    if(!$('#menu-glass-auto-style')){
      const st=document.createElement('style');
      st.id='menu-glass-auto-style';
      st.textContent=css;
      document.head.appendChild(st);
    }
  }

  function emulateSidebarClick(action){
    // Ця логіка потрібна лише для ADDED елементів
    for(const el of $$('.menu__item, .selector')){
      if(el.dataset && el.dataset.action && el.dataset.action === action){
        el.click();
        return;
      }
    }
  }
  
  function addItem(action, svg){
    const bar = $('.navigation-bar__body');
    if(!bar || bar.querySelector(`[data-action="${action}"]`)) return; 
    
    const div = document.createElement('div');
    div.className = 'navigation-bar__item';
    div.dataset.action = action;
    div.innerHTML = `<div class="navigation-bar__icon">${svg}</div>`;
    
    const settings = bar.querySelector('.navigation-bar__item[data-action="settings"]');
    
    let target = settings; 
    
    // Логіка вставлення (У зворотному порядку для досягнення: favorite, history, search)
    if (action === 'history') {
        const search = bar.querySelector('.navigation-bar__item[data-action="search"]');
        if (search) target = search; else target = settings;
    } else if (action === 'favorite') {
        const history = bar.querySelector('.navigation-bar__item[data-action="history"]');
        if (history) target = history; else target = settings;
    } else if (action === 'search') {
        target = settings;
    }

    if (target) {
        bar.insertBefore(div, target);
    } else {
        bar.appendChild(div);
    }

    div.addEventListener('click', () => emulateSidebarClick(action));
  }
  
  // Функція updateLampaItem ВИДАЛЕНА для стабільності.

  function adjustSpacing(){
    const bar=$('.navigation-bar__body');
    if(!bar) return;
    
    const items=$$('.navigation-bar__item', bar); 
    const visibleItems = items.filter(item => {
        const computedStyle = window.getComputedStyle(item);
        return computedStyle.display !== 'none';
    });
    
    if(!visibleItems.length) return;

    const width=bar.clientWidth;
    const count=visibleItems.length;
    const minGap=Math.max(2,Math.floor(width*0.005));
    const totalGap=minGap*(count-1);
    const available=width-totalGap;
    const itemWidth=Math.floor(available/count);

    visibleItems.forEach((it,i)=>{
      it.style.flex=`0 0 ${itemWidth}px`;
      it.style.marginRight=(i<count-1)?`${minGap}px`:'0';
      it.style.marginLeft='0';
    });
  }

  function init(){
    injectCSS();
    
    // ДОДАЄМО ТІЛЬКИ НЕОБХІДНІ ЕЛЕМЕНТИ 
    
    // 1. Додаємо Пошук (стане перед Налаштуваннями)
    addItem('search', SEARCH_SVG); 
    
    // 2. Додаємо Історію (стане перед Пошуком)
    addItem('history', HISTORY_SVG);
    
    // 3. Додаємо Вибране (стане перед Історією)
    addItem('favorite', FAVORITE_SVG); 
    
    adjustSpacing();

    const bar=$('.navigation-bar__body');
    if(!bar) return;
    const ro=new ResizeObserver(adjustSpacing);
    ro.observe(bar);
    window.addEventListener('resize',adjustSpacing);
    window.addEventListener('orientationchange',adjustSpacing);
  }

  const mo=new MutationObserver(()=>{
    const bar=$('.navigation-bar__body');
    if(bar){mo.disconnect();init();}
  });
  mo.observe(document.documentElement,{childList:true,subtree:true});
  if($('.navigation-bar__body')){mo.disconnect();init();}
})();
