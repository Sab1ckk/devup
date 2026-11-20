var PALS=[['Алый + чёрный','#D00000','#000000'],['Чёрный + серебро','#080808','#BFC3C7'],['Тёмно-зелёный + ядовито-жёлтый','#123B2A','#E5FF00'],['Индиго + ледяной голубой','#19152F','#A5E7FF'],['Молочный + баклажан','#3B1C4A','#FFFDF5'],['Чернильный + мятный','#121A3A','#B2F2D8'],['Хвойный + персиковый','#1B4332','#FFB38A'],['Петроль + морской бриз','#0F4C5C','#8FE3D6'],['Хвойный + пепельный','#1B4332','#D9D9D9'],['Графит + солнечный','#2F3640','#FFC400'],['Бордовый + молочный','#701C32','#F1E9D8'],['Изумрудный + бежевый','#0B3D0B','#F5E6CC'],['Графит + мягкий оранжевый','#171918','#FFAB70'],['16 · Сапфир + персик','#172A45','#FFB38A'],['17 · Уголь + оранжевый','#191C1B','#FF9569'],['19 · Молочный + красный','#F4F0E6','#A33135'],['10 · Чёрный + розовый + красный','#191719','#F09AAE']];

function h2r(hex){return [1,3,5].map(function(i){return parseInt(hex.slice(i,i+2),16)})}
function mixc(a,b,t){return a.map(function(v,i){return Math.round(v*(1-t)+b[i]*t)})}
function rgbs(c){return 'rgb('+c.join(',')+')'}
function lum(c){return c.map(function(v){v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4)}).reduce(function(sum,v,i){return sum+v*[.2126,.7152,.0722][i]},0)}
var EDITORIAL_PALETTES = {
 '10 · Чёрный + розовый + красный': ['#191719','#6D283C','#F0DDE2','#F0DDE2','#6D283C','#F09AAE'],
 '16 · Сапфир + персик': ['#172A45','#486579','#F0F0E8','#F0F0E8','#486579','#FFB38A'],
 '17 · Уголь + оранжевый': ['#191C1B','#466455','#F2EEDC','#F2EEDC','#466455','#FF9569'],
 '19 · Молочный + красный': ['#F4F0E6','#D6C8AD','#292622','#292622','#D6C8AD','#A33135']
};

// Four-color adaptations of the numbered Visme examples.
PALS.push(["01 · Бирюза + терракота", "#123C42", "#EDAA87"]);
EDITORIAL_PALETTES["01 · Бирюза + терракота"] = ["#123C42", "#466B69", "#F1E7D8", "#F1E7D8", "#466B69", "#EDAA87"];
PALS.push(["02 · Синий + коралловый", "#23245B", "#FFAA8D"]);
EDITORIAL_PALETTES["02 · Синий + коралловый"] = ["#23245B", "#53518D", "#F1ECF7", "#F1ECF7", "#53518D", "#FFAA8D"];
PALS.push(["04 · Синий + изумруд", "#102D4B", "#8DDCB2"]);
EDITORIAL_PALETTES["04 · Синий + изумруд"] = ["#102D4B", "#28635E", "#E1F3EB", "#E1F3EB", "#28635E", "#8DDCB2"];
PALS.push(["08 · Тосканский + лаванда", "#34252D", "#C6AECF"]);
EDITORIAL_PALETTES["08 · Тосканский + лаванда"] = ["#34252D", "#70434D", "#EFE3E6", "#EFE3E6", "#70434D", "#C6AECF"];
PALS.push(["12 · Дымчатый + электрик", "#171B24", "#8AAFFF"]);
EDITORIAL_PALETTES["12 · Дымчатый + электрик"] = ["#171B24", "#3B4665", "#EDF1FA", "#EDF1FA", "#3B4665", "#8AAFFF"];
PALS.push(["14 · Чернильный + золото", "#192C40", "#E4B653"]);
EDITORIAL_PALETTES["14 · Чернильный + золото"] = ["#192C40", "#65453D", "#F1E6D2", "#F1E6D2", "#65453D", "#E4B653"];
PALS.push(["21 · Черника + аметист", "#27264B", "#9EDAF1"]);
EDITORIAL_PALETTES["21 · Черника + аметист"] = ["#27264B", "#65518B", "#EEF0FA", "#EEF0FA", "#65518B", "#9EDAF1"];
PALS.push(["25 · Василёк + розовый", "#263859", "#F1A8CD"]);
EDITORIAL_PALETTES["25 · Василёк + розовый"] = ["#263859", "#4B628D", "#E5ECFF", "#E5ECFF", "#4B628D", "#F1A8CD"];
PALS.push(["43 · Кофейный + небесный", "#362A25", "#ABD6E8"]);
EDITORIAL_PALETTES["43 · Кофейный + небесный"] = ["#362A25", "#725A47", "#F1E5D4", "#F1E5D4", "#725A47", "#ABD6E8"];
PALS.push(["50 · Лимон + мята", "#183E4B", "#E7EF85"]);
EDITORIAL_PALETTES["50 · Лимон + мята"] = ["#183E4B", "#356B64", "#DDF2DF", "#DDF2DF", "#356B64", "#E7EF85"];

// Preserve the original stored choice while reducing the visible palette list.
var previousPaletteNames = PALS.map(function(palette) { return palette[0]; });
PALS = PALS.filter(function(palette) {
 return palette[0] === 'Чёрный + серебро' || palette[0] === '12 · Дымчатый + электрик';
});
try {
 var paletteRevision = 'three-choices-v1';
 if(localStorage.getItem('upup-mix-palette-revision') !== paletteRevision) {
  var oldIndex = JSON.parse(localStorage.getItem('upup-mix-pal') || '-1');
  var oldName = previousPaletteNames[oldIndex];
  var newIndex = PALS.findIndex(function(palette) { return palette[0] === oldName; });
  localStorage.setItem('upup-mix-pal', JSON.stringify(newIndex));
  if(newIndex < 0) localStorage.setItem('upup-mix-palinv', 'false');
  localStorage.setItem('upup-mix-palette-revision', paletteRevision);
 }
} catch (error) {}

function applyPal(index,light){
 var style=document.documentElement.style,keys=['--bg','--surface','--fg','--mut','--line','--acc','--ink','--acc-rgb'];
 if(index<0){keys.forEach(function(k){style.removeProperty(k)});style.removeProperty('color-scheme');return}
 if(!Number.isInteger(index)||!PALS[index])return;
 var dark=h2r(PALS[index][1]),bright=h2r(PALS[index][2]);if(lum(dark)>lum(bright)){var tmp=dark;dark=bright;bright=tmp}
 var isLight=light&&lum(bright)>.5,bg=isLight?mixc(bright,[255,255,255],.35):mixc(dark,[0,0,0],.3),fg=isLight?mixc(dark,[0,0,0],.25):[241,244,230],acc=isLight?fg:bright;
 var colors={'--bg':bg,'--surface':mixc(bg,fg,isLight?.035:.06),'--fg':fg,'--mut':mixc(fg,bg,.2),'--line':mixc(bg,fg,.26),'--acc':acc};
 if(PALS[index][0]==='Графит + мягкий оранжевый'&&!isLight){
  colors={'--bg':h2r('#171918'),'--surface':h2r('#242824'),'--fg':h2r('#F2EFE6'),'--mut':h2r('#B5BBAF'),'--line':h2r('#646D60'),'--acc':bright};
  bg=colors['--bg'];fg=colors['--fg'];
 }
 var editorial = EDITORIAL_PALETTES[PALS[index][0]];
 if(editorial){
  var roles=['--bg','--surface','--fg','--mut','--line','--acc'];
  roles.forEach(function(role,i){colors[role]=h2r(editorial[i])});
  isLight=lum(colors['--bg'])>.5;
  if(light!==isLight){
   var originalBg=colors['--bg'];
   colors['--bg']=colors['--fg'];
   colors['--fg']=originalBg;
   colors['--surface']=mixc(colors['--bg'],colors['--fg'],.07);
   colors['--mut']=mixc(colors['--fg'],colors['--bg'],.22);
   colors['--acc']=isLight?h2r('#FF9F98'):h2r('#8E3520');
   isLight=light;
  }
  bg=colors['--bg'];fg=colors['--fg'];acc=colors['--acc'];
 }
 Object.entries(colors).forEach(function(pair){style.setProperty(pair[0],rgbs(pair[1]))});
 function contrast(a,b){var x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
 style.setProperty('--ink',contrast(acc,bg)>=contrast(acc,fg)?'var(--bg)':'var(--fg)');style.setProperty('--acc-rgb',acc.join(','));style.setProperty('color-scheme',isLight?'light':'dark');
}
function initPalette(){
 var fab=$('#pal-fab'),box=$('#pal'),grid=$('#pal-g');if(!fab||!box||!grid||grid.dataset.ready)return;grid.dataset.ready='true';
 var current=sget('pal',-1),light=sget('palinv',false);if(!Number.isInteger(current)||current<0||current>=PALS.length)current=-1;
 PALS.forEach(function(p,i){var button=document.createElement('button');button.type='button';button.dataset.i=i;button.innerHTML='<span class="sw" aria-hidden="true"><i></i><i></i></span><span></span>';var swatches=$$('.sw',button)[0];
 var scheme=EDITORIAL_PALETTES[p[0]];
 var samples=scheme?[scheme[0],scheme[1],scheme[2],scheme[5]]:[p[1],p[2]];
 swatches.replaceChildren();
 samples.forEach(function(color){var chip=document.createElement('i');chip.style.background=color;swatches.append(chip)});
 $('span:last-child',button).textContent=p[0];grid.append(button)});
 function sync(){$$('button',grid).forEach(function(b){b.setAttribute('aria-pressed',Number(b.dataset.i)===current)});$('#pal-inv').checked=light;applyPal(current,light)}
 fab.onclick=function(){box.hidden=!box.hidden;fab.setAttribute('aria-expanded',!box.hidden)};
 grid.onclick=function(e){var b=e.target.closest('button');if(!b)return;current=Number(b.dataset.i);if(EDITORIAL_PALETTES[PALS[current][0]]){light=lum(h2r(EDITORIAL_PALETTES[PALS[current][0]][0]))>.5;sset('palinv',light)}sset('pal',current);sync()};
 $('#pal-inv').onchange=function(e){light=e.target.checked;sset('palinv',light);sync()};$('#pal-reset').onclick=function(){current=-1;light=false;sset('pal',-1);sset('palinv',false);sync()};sync();
}

// Restore the shared theme independently of page-specific UI initialization.
function restoreSavedPalette() {
 try {
  var index = JSON.parse(localStorage.getItem('upup-mix-pal') || '-1');
  var light = JSON.parse(localStorage.getItem('upup-mix-palinv') || 'false');
  applyPal(index, light);
 } catch (error) {
  applyPal(-1, false);
 }
}
restoreSavedPalette();
document.addEventListener('DOMContentLoaded', initPalette);
addEventListener('pageshow', restoreSavedPalette);
addEventListener('storage', function(event) {
 if(event.key === 'upup-mix-pal' || event.key === 'upup-mix-palinv') location.reload();
});
