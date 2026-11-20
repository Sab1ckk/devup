'use strict';
var $ = function(s,r){return (r||document).querySelector(s)};
var $$ = function(s,r){return Array.from((r||document).querySelectorAll(s))};
function uiIcon(name){
 var paths={up:'m6 14 6-6 6 6M12 8v12',down:'m6 10 6 6 6-6M12 4v12',close:'m6 6 12 12M6 18 18 6',plus:'M12 4v16M4 12h16',check:'m5 12 4 4L19 6',home:'m3 10 9-7 9 7M5 9v12h14V9M9 21v-8h6v8',info:'M12 11v6M12 7v1M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',grid:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',pin:'M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0',user:'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M4 21v-2a8 8 0 0 1 16 0v2',chat:'M4 4h16v12H9l-5 4V4ZM8 8h8M8 12h5'};
 return '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="'+(paths[name]||paths.plus)+'"/></svg>';
}
var paletteMemory = {};
function sget(k,fallback){try{return JSON.parse(localStorage.getItem('upup-mix-'+k))??fallback}catch{return paletteMemory[k]??fallback}}
function sset(k,v){paletteMemory[k]=v;try{localStorage.setItem('upup-mix-'+k,JSON.stringify(v))}catch{}}
function toast(message){var el=$('#toast');el.textContent=message;el.classList.add('on');clearTimeout(toast.timer);toast.timer=setTimeout(function(){el.classList.remove('on')},2600)}

var blockKinds=[['hero','Главная','home','Первый экран, заголовок, основная идея.'],['about','О проекте','info','История, команда и преимущества.'],['catalog','Каталог','grid','Товары, услуги или разделы.'],['contacts','Контакты','pin','Способы связи и адрес.'],['account','Личный кабинет','user','Как выглядит пространство пользователя.'],['chat','Чат','chat','Обсуждения и переписка.'],['custom','Свой блок','plus','Опиши собственную идею.']];
blockKinds.push(...[["services", "Услуги", "grid", "Выберите, что рассказать об услугах."], ["product", "Карточка товара", "grid", "Фото, характеристики и варианты товара."], ["cart", "Корзина", "grid", "Состав и оформление заказа."], ["portfolio", "Портфолио", "grid", "Какие работы показать?"], ["blog", "Блог", "grid", "Темы публикаций и рубрики."], ["reviews", "Отзывы", "grid", "Что показать в отзывах?"], ["faq", "Вопросы", "grid", "На какие вопросы ответить?"], ["form", "Форма заявки", "plus", "Опиши, как должна работать эта функция."], ["payment", "Онлайн-оплата", "plus", "Опиши, как должна работать эта функция."], ["admin", "Админка", "plus", "Опиши, как должна работать эта функция."], ["telegram", "Бот Telegram", "plus", "Опиши, как должна работать эта функция."], ["map", "Карта", "plus", "Опиши, как должна работать эта функция."], ["push", "Push-уведомления", "plus", "Опиши, как должна работать эта функция."], ["search", "Поиск", "plus", "Опиши, как должна работать эта функция."], ["languages", "Два языка", "plus", "Опиши, как должна работать эта функция."], ["crm", "CRM", "plus", "Опиши, как должна работать эта функция."], ["analytics", "Аналитика", "plus", "Опиши, как должна работать эта функция."], ["offline", "Офлайн-режим", "plus", "Опиши, как должна работать эта функция."], ["social", "Вход через соцсети", "plus", "Опиши, как должна работать эта функция."]]);
var nextBlockId=0;
var singleBlockKinds=['hero','about','catalog','contacts','account'];
function canAddBlock(list,kind){return blockKinds.some(function(k){return k[0]===kind})&&(!singleBlockKinds.includes(kind)||!list.some(function(b){return b.kind===kind}))}
function normalizeProjectType(value){return ['site','app','small','study'].includes(value)?value:'site'}
function createBlock(kind){var spec=blockKinds.find(function(k){return k[0]===kind});if(!spec)return null;return {id:++nextBlockId,kind:kind,title:spec[1],description:'',hint:spec[3]}}
function moveBlock(list,id,delta){var from=list.findIndex(function(b){return b.id===id}),to=from+delta;if(from<0||to<0||to>=list.length)return list.slice();var result=list.slice();var block=result.splice(from,1)[0];result.splice(to,0,block);return result}
function placeBlock(list,id,before){var from=list.findIndex(function(b){return b.id===id});if(from<0||id===before)return list.slice();var result=list.slice(),block=result.splice(from,1)[0];var target=before==null?result.length:result.findIndex(function(b){return b.id===before});if(target<0)return list.slice();result.splice(target,0,block);return result}
function initBuilder(){
 var library=$('#block-library'),canvas=$('.builder-canvas'),root=$('#project-blocks');if(!library)return;
 var blocks=[createBlock('hero'),createBlock('about'),createBlock('contacts')],drag=null;
 function announce(message){$('#block-count').textContent=message||('Блоков: '+blocks.length)}
 function insert(kind,beforeId){
  if(!canAddBlock(blocks,kind)){announce('Этот блок уже добавлен');return null}
  var block=createBlock(kind),index=beforeId==null?blocks.length:blocks.findIndex(function(b){return b.id===beforeId});if(index<0)return null;
  blocks.splice(index,0,block);return block;
 }
 function add(kind){var block=insert(kind);if(!block)return;render();var el=root.lastElementChild;$('input',el).focus();announce('Добавлен блок «'+block.title+'». Всего: '+blocks.length)}
 function render(focusId,action){
  root.replaceChildren();blocks.forEach(function(block,index){var el=document.createElement('section');el.className='project-block';el.dataset.id=block.id;el.draggable=true;
   el.innerHTML='<div class="project-block-head"><span class="block-number"></span><h3 class="block-label"></h3><div class="block-actions"><button type="button" data-action="up">↑</button><button type="button" data-action="down">↓</button><button type="button" data-action="remove">×</button></div></div><label><span>Название блока</span><input type="text"></label><label><span>Что должно быть внутри?</span><textarea rows="2"></textarea></label>';
   $('.block-number',el).textContent=String(index+1).padStart(2,'0');$('.block-label',el).textContent=blockKinds.find(function(x){return x[0]===block.kind})[1];
   var input=$('input',el),area=$('textarea',el);input.value=block.title;area.value=block.description;area.placeholder=block.hint;
   input.addEventListener('input',function(){block.title=input.value});area.addEventListener('input',function(){block.description=area.value});
   $$('[data-action]',el).forEach(function(button){var act=button.dataset.action;button.setAttribute('aria-label',({up:'Переместить выше',down:'Переместить ниже',remove:'Удалить блок'})[act]+' «'+block.title+'»');button.innerHTML=uiIcon({up:'up',down:'down',remove:'close'}[act]);button.disabled=(act==='up'&&index===0)||(act==='down'&&index===blocks.length-1);button.onclick=function(){
    if(act==='remove'){blocks=blocks.filter(function(b){return b.id!==block.id});var target=blocks[Math.min(index,blocks.length-1)];render(target&&target.id,'remove');if(!target)$('.library-block',library).focus();announce('Блок удалён. Всего: '+blocks.length)}
    else {blocks=moveBlock(blocks,block.id,act==='up'?-1:1);render(block.id,act);announce('Порядок блоков изменён')}
   }});
   el.addEventListener('dragstart',function(e){if(e.target.closest('input,textarea,button')){e.preventDefault();return}drag={id:block.id};e.dataTransfer.setData('text/plain','upup-block');e.dataTransfer.effectAllowed='move'});
   el.addEventListener('dragover',function(e){if(!drag)return;e.preventDefault();el.classList.add('drag-over')});el.addEventListener('dragleave',function(){el.classList.remove('drag-over')});
   el.addEventListener('drop',function(e){if(!drag)return;e.preventDefault();e.stopPropagation();if(drag.kind)insert(drag.kind,block.id);else blocks=placeBlock(blocks,drag.id,block.id);drag=null;render();canvas.classList.remove('drag-over');announce('Структура обновлена')});
   root.append(el);
  });$('#builder-empty').hidden=blocks.length!==0;announce();
  $$('.library-block',library).forEach(function(b){b.disabled=!canAddBlock(blocks,b.dataset.kind);b.draggable=!b.disabled;b.title=b.disabled?'Этот блок уже добавлен':'';$('span:last-child',b).innerHTML=uiIcon(b.disabled?'check':'plus')});
  if(focusId){var target=$('[data-id="'+focusId+'"] [data-action="'+action+'"]',root);if(target&&!target.disabled)target.focus();else {var title=$('[data-id="'+focusId+'"] input',root);if(title)title.focus()}}
 }
 const featureKinds = new Set(["account", "chat", "form", "payment", "admin", "telegram", "map", "push", "search", "languages", "crm", "analytics", "offline", "social"]);
 const groups = {};
 for (const title of ['Страницы', 'Функции', 'Свой блок']) {
  const section = document.createElement('section');
  const heading = document.createElement('h3');
  heading.textContent = title;
  section.className = 'library-group';
  section.append(heading);
  library.append(section);
  groups[title] = section;
 }
 blockKinds.forEach(function(kind){var b=document.createElement('button');b.type='button';b.className='library-block';b.dataset.kind=kind[0];b.draggable=true;b.innerHTML='<b aria-hidden="true"></b><span></span><span aria-hidden="true">+</span>';$('b',b).innerHTML=uiIcon(kind[2]);$('span',b).textContent=kind[1];b.setAttribute('aria-label','Добавить блок «'+kind[1]+'»');b.onclick=function(){add(kind[0])};b.addEventListener('dragstart',function(e){if(!canAddBlock(blocks,kind[0])){e.preventDefault();return}drag={kind:kind[0]};e.dataTransfer.setData('text/plain','upup-library');e.dataTransfer.effectAllowed='copy'});groups[kind[0]==='custom'?'Свой блок':featureKinds.has(kind[0])?'Функции':'Страницы'].append(b)});
 canvas.addEventListener('dragover',function(e){if(drag){e.preventDefault();canvas.classList.add('drag-over')}});canvas.addEventListener('dragleave',function(e){if(!canvas.contains(e.relatedTarget))canvas.classList.remove('drag-over')});canvas.addEventListener('drop',function(e){if(!drag)return;e.preventDefault();if(drag.kind)insert(drag.kind);else blocks=placeBlock(blocks,drag.id,null);drag=null;render();canvas.classList.remove('drag-over')});
 document.addEventListener('dragend',function(){drag=null;canvas.classList.remove('drag-over');$$('.drag-over',root).forEach(function(el){el.classList.remove('drag-over')})});
 function chooseType(type){$$('.type-picks button').forEach(function(b){var selected=b.dataset.type===type;b.classList.toggle('active',selected);b.setAttribute('aria-pressed',selected)})}
 $$('.type-picks button').forEach(function(b){b.onclick=function(){chooseType(b.dataset.type);announce('Тип проекта: '+b.textContent)}});
 chooseType(normalizeProjectType(new URLSearchParams(location.search).get('type')));render();
}

function initTrail(){
 var canvas=$('canvas[data-trail]');if(!canvas)return;
 var ctx=canvas.getContext('2d');if(!ctx)return;
 var host=canvas.parentNode,reduced=matchMedia('(prefers-reduced-motion: reduce)'),dots=[],frame=0,width=0,height=0;
 function resize(){var r=canvas.getBoundingClientRect(),scale=Math.min(devicePixelRatio||1,2);width=r.width;height=r.height;canvas.width=Math.round(width*scale);canvas.height=Math.round(height*scale);ctx.setTransform(scale,0,0,scale,0,0);dots=[]}
 function draw(now){
  ctx.clearRect(0,0,width,height);dots=dots.filter(function(d){return now-d.time<650});
  ctx.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--acc').trim();
  dots.forEach(function(d){ctx.globalAlpha=Math.max(0,1-(now-d.time)/650)*.7;ctx.fillRect(d.x+2,d.y+2,24,24)});ctx.globalAlpha=1;
  frame=dots.length?requestAnimationFrame(draw):0;
 }
 host.addEventListener('pointermove',function(e){
  if(reduced.matches||e.pointerType==='touch')return;
  var r=canvas.getBoundingClientRect(),x=Math.floor((e.clientX-r.left)/28)*28,y=Math.floor((e.clientY-r.top)/28)*28,last=dots[dots.length-1];
  if(!last||last.x!==x||last.y!==y)dots.push({x:x,y:y,time:performance.now()});
  if(dots.length>250)dots.shift();if(!frame)frame=requestAnimationFrame(draw);
 },{passive:true});
 reduced.addEventListener('change',function(){if(reduced.matches){cancelAnimationFrame(frame);frame=0;dots=[];ctx.clearRect(0,0,width,height)}});
 new ResizeObserver(resize).observe(canvas);resize();
}

function initCardGlow(){
 var reduced=matchMedia('(prefers-reduced-motion: reduce)');
 document.addEventListener('pointermove',function(e){
  if(reduced.matches||e.pointerType==='touch')return;
  var card=e.target.closest('.svc,.pfg .card,.project-block');if(!card)return;
  var rect=card.getBoundingClientRect();card.style.setProperty('--glow-x',(e.clientX-rect.left)+'px');card.style.setProperty('--glow-y',(e.clientY-rect.top)+'px');
 },{passive:true});
}

function initUI(){
 function fitViewport(){document.documentElement.style.setProperty('--viewport-width',document.documentElement.clientWidth+'px')}fitViewport();addEventListener('resize',fitViewport);
 var page=location.pathname.split('/').pop()||'index.html';$$('.nav a').forEach(function(a){if(a.getAttribute('href')===page)a.setAttribute('aria-current','page')});
 var menu=$('.menu-btn'),nav=$('.nav');menu.onclick=function(){var expanded=nav.classList.toggle('open');menu.setAttribute('aria-expanded',expanded);menu.setAttribute('aria-label',expanded?'Закрыть меню':'Открыть меню')};
 document.addEventListener('keydown',function(e){if(e.key==='Escape'&&nav.classList.contains('open')){nav.classList.remove('open');menu.setAttribute('aria-expanded','false');menu.focus()}});
 $$('[data-open]').forEach(function(b){b.onclick=function(){var dialog=document.getElementById(b.dataset.open);if(dialog)dialog.showModal()}});$$('[data-close]').forEach(function(b){b.onclick=function(){b.closest('dialog').close()}});
 $$('.dlg').forEach(function(d){d.addEventListener('click',function(e){if(e.target===d)d.close()})});
 $$('input[name="amode"]').forEach(function(r){r.onchange=function(){var up=r.value==='up';$('#a-link-wrap').hidden=!up;$('#a-pass').autocomplete=up?'new-password':'current-password';$('#a-submit').textContent=up?'Зарегистрироваться':'Войти'}});
 $$('[data-demo-form]').forEach(function(f){f.addEventListener('submit',function(e){e.preventDefault()})});
 $$('[data-demo-notice]').forEach(function(b){b.onclick=function(){toast('Это макет. Отправка заявки не подключена.')}});
 var ticker=$('.ticker');if(ticker){var track=$('.ticker-track',ticker),group=$('.ticker-group',ticker),original=group.innerHTML;function fillTicker(){track.replaceChildren(group);group.innerHTML=original;var count=Math.max(1,Math.ceil(ticker.clientWidth/Math.max(1,group.scrollWidth)));group.innerHTML=original.repeat(count);var copy=group.cloneNode(true);copy.setAttribute('aria-hidden','true');track.append(copy)}fillTicker();new ResizeObserver(fillTicker).observe(ticker);}
 var reduced=matchMedia('(prefers-reduced-motion: reduce)');$$('[data-magnet]').forEach(function(el){el.addEventListener('pointermove',function(e){if(reduced.matches||e.pointerType==='touch')return;var r=el.getBoundingClientRect();el.style.transform='translate('+((e.clientX-r.left-r.width/2)*.12).toFixed(1)+'px,'+((e.clientY-r.top-r.height/2)*.18).toFixed(1)+'px)'});el.addEventListener('pointerleave',function(){el.style.transform=''})});
 initPalette();
}
function initReveal() {
 if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
 const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
   if (!entry.isIntersecting) return;
   entry.target.classList.add('reveal-enter');
   entry.target.addEventListener('animationend', () => {
    entry.target.classList.remove('reveal-enter');
   }, {once:true});
   observer.unobserve(entry.target);
  });
 }, {threshold:.06});
 const targets = $$('.main .rv, .main .pagehd, .main .brief-section, .main .chat-page');
 targets.filter(element => !targets.some(parent => parent !== element && parent.contains(element)))
  .forEach(element => observer.observe(element));
}

document.addEventListener('DOMContentLoaded',function(){initUI();initBuilder();initTrail();initCardGlow();initReveal()});

document.addEventListener('DOMContentLoaded', function() {
 const sort = document.getElementById('review-sort');
 if (!sort) return;
 const list = document.querySelector('.review-list');
 sort.addEventListener('change', function() {
  const cards = Array.from(list.children);
  cards.sort(function(a,b) {
   if(sort.value==='high') return Number(b.dataset.rating)-Number(a.dataset.rating);
   if(sort.value==='low') return Number(a.dataset.rating)-Number(b.dataset.rating);
   return sort.value==='old' ? a.dataset.date.localeCompare(b.dataset.date) : b.dataset.date.localeCompare(a.dataset.date);
  });
  list.append(...cards);
 });
});
