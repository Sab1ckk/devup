import {test,expect} from '@playwright/test';
test('monochrome theme toggle and neutral form layout',async({page})=>{
 await page.goto('/order');
 await expect(page.locator('.attachment-mock')).toHaveCount(0);
 const toggle=page.getByRole('button',{name:'Переключить тему'});
 const before=await page.evaluate(()=>document.documentElement.style.colorScheme);
 await toggle.click();
 expect(await page.evaluate(()=>document.documentElement.style.colorScheme)).not.toBe(before);
 await page.reload();
 expect(await page.evaluate(()=>document.documentElement.style.colorScheme)).not.toBe(before);
 await page.goto('/services');
 await expect(page.locator('.svc').first()).toHaveCSS('position','relative');
 expect(await page.locator('.svc').first().evaluate(el=>getComputedStyle(el,'::after').display)).toBe('none');
 for(const width of [360,768,1280]){
  await page.setViewportSize({width,height:900});
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
});
