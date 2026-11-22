import {test,expect} from '@playwright/test';
import {PNG} from 'pngjs';
import fs from 'node:fs';
async function login(page,request){
 await page.goto('/admin/requests');await expect(page).toHaveURL(/\/admin\/login$/);
 await page.getByLabel('Логин',{exact:true}).fill('qa_admin');await page.getByLabel('Пароль',{exact:true}).fill('Test-admin-123');await page.getByRole('button',{name:'Войти',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Код из письма'})).toBeVisible();
 const messages=await (await request.get('/__test/mail')).json();const code=messages.filter(m=>m.template==='admin_code').at(-1).code;
 await page.getByLabel('Код подтверждения').fill(code);await page.getByRole('button',{name:'Подтвердить',exact:true}).click();await expect(page.getByRole('heading',{name:'Заявки',exact:true})).toBeVisible();
}
test('admin flow: prices, portfolio, preview, records and logout',async({page,request,context})=>{
 test.setTimeout(120000);
 await request.post('/__test/reset');await login(page,request);
 expect((await context.cookies()).find(c=>c.name==='devup_admin')).toMatchObject({httpOnly:true,sameSite:'Strict',path:'/api'});
 await expect(page.locator('meta[name=robots]')).toHaveAttribute('content','noindex');
 await page.getByRole('link',{name:'Услуги',exact:true}).click();
 const card=page.locator('.admin-service').first();await card.getByLabel('Цена от · ₽',{exact:true}).fill('22000');await card.getByRole('button',{name:'Сохранить',exact:true}).click();await expect(page.getByRole('status')).toContainText('Услуга сохранена');
 const site=await context.newPage();await site.goto('/services');await expect(site.locator('[data-service=site] .price')).toContainText('22');await expect(site.getByLabel('Режим администратора')).toBeVisible();
 await page.getByRole('link',{name:'Портфолио',exact:true}).click();await page.getByRole('link',{name:'Добавить работу'}).click();await page.getByLabel('Название',{exact:true}).fill('Проект студии');
 const png=new PNG({width:160,height:100});png.data.fill(150);
 await page.locator('input[type=file]').setInputFiles({name:'cover.png',mimeType:'image/png',buffer:PNG.sync.write(png)});await expect(page.locator('.admin-thumb')).toHaveCount(1);
 await page.getByRole('button',{name:'Сохранить черновик',exact:true}).click();await expect(page).toHaveURL(/\/admin\/portfolio\/[a-f0-9-]+$/);
 await expect(page.getByLabel('Название',{exact:true})).toHaveValue('Проект студии');
 await site.goto('/portfolio');await expect(site.getByText('Работы скоро появятся.')).toBeVisible();await site.getByLabel('Показывать черновики').check();await expect(site.getByRole('button',{name:/Проект студии/})).toBeVisible();await expect(site.getByText('Черновик',{exact:true})).toBeVisible();
 await page.getByLabel('Название',{exact:true}).fill('Проект студии · готово');await page.getByRole('link',{name:'Пользователи',exact:true}).click();await expect(page.getByRole('heading',{name:'Есть несохранённые изменения'})).toBeVisible();await page.getByRole('button',{name:'Остаться',exact:true}).click();
 await page.getByRole('button',{name:'Опубликовать',exact:true}).click();await expect(page.getByRole('status')).toContainText('Работа опубликована');
 await site.getByLabel('Показывать черновики').uncheck();await expect(site.getByRole('button',{name:/Проект студии · готово/})).toBeVisible();
 const guest=await request.post('/api/requests',{data:{project_type:'site',blocks:[],contacts:[{kind:'telegram',value:'@new_guest'}]},headers:{'X-Requested-With':'devup'}});expect(guest.ok()).toBeTruthy();const project=await guest.json();
 await page.getByRole('link',{name:'Заявки',exact:true}).click();await page.getByRole('link',{name:project.display_number,exact:true}).click();
 await page.getByRole('combobox',{name:'Статус',exact:true}).selectOption('in_progress');await page.getByLabel('Комментарий · только для админки').fill('Внутренний комментарий');await page.getByRole('button',{name:'Сменить статус',exact:true}).click();await expect(page.getByText('Внутренний комментарий',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Выдать новый код привязки'}).click();await expect(page.getByRole('heading',{name:'Новый код привязки'})).toBeVisible();await page.getByRole('button',{name:'Закрыть',exact:true}).click();
 fs.mkdirSync('test-results/admin',{recursive:true});
 for(const path of ['/admin/requests','/admin/users','/admin/services','/admin/portfolio']){
  await page.goto(path);await expect(page.locator('h1').first()).toBeVisible();
  for(const width of [360,768,1280])for(const light of [false,true]){
   await page.setViewportSize({width,height:900});await page.waitForFunction(()=>parseFloat(document.documentElement.style.getPropertyValue('--viewport-width'))===document.documentElement.clientWidth);await page.evaluate(light=>{document.querySelector('#pal-g button').click();const box=document.querySelector('#pal-inv');if(box.checked!==light)box.click()},light);await page.waitForTimeout(220);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
   await page.screenshot({path:`test-results/admin/${path.split('/').at(-1)}-${width}-${light?'light':'dark'}.png`,fullPage:true});
  }
 }
 await page.getByRole('button',{name:'Выйти',exact:true}).click();await expect(page).toHaveURL(/\/admin\/login$/);await site.reload();await expect(site.getByLabel('Режим администратора')).toHaveCount(0);
});
test('ordinary visitor has no admin requests or bar',async({page,request})=>{await request.post('/__test/reset');const requests=[];page.on('request',r=>{if(r.url().includes('/api/admin/'))requests.push(r.url())});await page.goto('/portfolio');await expect(page.getByText('Работы скоро появятся.')).toBeVisible();await expect(page.getByLabel('Режим администратора')).toHaveCount(0);expect(requests).toHaveLength(0)});

test('review is sent to moderation and appears only after publication', async ({page, request}) => {
  await request.post('/__test/reset');
  await page.goto('/reviews');
  await page.getByRole('button', {name:'Оставить отзыв'}).click();
  const form = page.locator('#review-form');
  await form.getByLabel('Имя', {exact:true}).fill('Анна Тест');
  await form.getByRole('combobox', {name:'Услуга'}).selectOption('site');
  await form.getByLabel('Отзыв', {exact:true}).fill('Удобно обсуждать проект.');
  const sent = page.waitForResponse(response => response.url().endsWith('/api/reviews') && response.request().method() === 'POST');
  await form.getByRole('button', {name:'Отправить отзыв'}).click();
  const response = await sent; expect(response.status(), await response.text()).toBe(201);
  await expect(page.locator('#toast')).toHaveText('Отзыв отправлен на модерацию');
  expect(await (await request.get('/api/reviews')).json()).toEqual([]);
  await login(page, request);
  await page.getByRole('link', {name:'Отзывы', exact:true}).click();
  const review = page.locator('.review-list article').filter({hasText:'Анна Тест'});
  await expect(review).toContainText('На модерации');
  await review.getByRole('button', {name:'Опубликовать'}).click();
  await expect(review).toContainText('Опубликован');
  await page.goto('/reviews');
  await expect(page.getByRole('heading', {name:'Анна Тест'})).toBeVisible();
});



test('service editor headings never overlap fields', async ({page, request}) => {
 await request.post('/__test/reset');
 await login(page, request);
 await page.goto('/admin/services');
 await expect(page.locator('.admin-service')).toHaveCount(4);
 for(const width of [360,768,1280]){
  await page.setViewportSize({width,height:900});
  await page.evaluate(()=>document.fonts.ready);
  const cards = await page.locator('.admin-service').evaluateAll(cards=>cards.map(card=>{
   const title=card.querySelector('h2').getBoundingClientRect();
   const form=card.querySelector('form').getBoundingClientRect();
   return {titleBottom:title.bottom,formTop:form.top,after:getComputedStyle(card,'::after').display};
  }));
  for(const card of cards){
   expect(card.formTop-card.titleBottom).toBeGreaterThanOrEqual(23);
   expect(card.after).toBe('none');
  }
  if(width>600)expect(Math.abs(cards[0].formTop-cards[1].formTop)).toBeLessThan(1);
 }
});
