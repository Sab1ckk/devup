import { test, expect } from "@playwright/test";
import fs from "node:fs";
async function captureStates(page, name) {
  fs.mkdirSync('test-results/states', { recursive: true });
  for (const width of [360, 768, 1280]) for (const light of [false, true]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(light => {
      document.querySelector('#pal-g button').click();
      const input = document.querySelector('#pal-inv');
      if (input.checked !== light) input.click();
    }, light);
    await page.screenshot({path: `test-results/states/${name}-${width}-${light?'light':'dark'}.png`, fullPage: true});
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    for (const dialog of await page.locator('dialog[open]').all()) {
      const box = await dialog.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
    }
  }
}
async function settle(page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
}
for (const width of [360, 768, 1280])
  for (const light of [false, true]) {
    test(`template layout ${width} ${light ? "light" : "dark"}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript((light) => {
        localStorage.setItem("upup-mix-palette-revision", "three-choices-v1");
        localStorage.setItem("upup-mix-pal", light ? "0" : "-1");
        localStorage.setItem("upup-mix-palinv", JSON.stringify(light));
      }, light);
      for (const path of [
        "index",
        "services",
        "portfolio",
        "reviews",
        "chat",
        "order",
        "cabinet",
      ]) {
        const route = path === "index" ? "/" : `/${path}`;
        await page.goto(`/template/${path}.html`);
        await settle(page);
        const originalWidth = await page
          .locator(".main")
          .evaluate((e) => Math.round(e.getBoundingClientRect().width));
        await page.goto(route);
        await settle(page);
        expect(
          await page
            .locator(".main")
            .evaluate((e) => Math.round(e.getBoundingClientRect().width)),
        ).toBe(originalWidth);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBeTruthy();
        await expect(page.locator(".site-header #pal-fab")).toBeVisible();
        await expect(page.locator(".foot #pal-fab")).toHaveCount(0);
        fs.mkdirSync("test-results/layout", { recursive: true });
        await page.screenshot({
          path: `test-results/layout/${path}-${width}-${light ? "light" : "dark"}.png`,
          fullPage: true,
        });
      }
    });
  }

test("guest order, draft, code, registration, cabinet and claim", async ({
  page,
  request,
}) => {
  await request.post("/__test/reset");
  await page.goto("/order?type=app");
  await page.getByLabel("О компании и задаче").fill("Нужно Android-приложение");
  await page.getByRole("button", { name: "Добавить блок «Чат»" }).click();
  await page
    .getByRole("textbox", { name: "Telegram", exact: true })
    .fill("@example");
  const source=page.getByRole('button',{name:'Добавить блок «Каталог»'}),target=page.locator('.project-block').first();
  await source.scrollIntoViewIfNeeded();
  const a=await source.boundingBox();
  await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(a.x+a.width/2+15,a.y+a.height/2+15,{steps:5});
  await target.scrollIntoViewIfNeeded();
  const b=await target.boundingBox();
  await page.mouse.move(b.x+b.width/2,b.y+20,{steps:15});await page.mouse.move(b.x+b.width/2+2,b.y+22);await page.mouse.up();
  await expect(page.getByRole('button',{name:'Удалить блок «Каталог»'})).toBeVisible();
  await page.getByRole('button',{name:'Удалить блок «Каталог»'}).click();
  await page.waitForTimeout(700);
  await page.reload();
  await expect(page.getByLabel("О компании и задаче")).toHaveValue(
    "Нужно Android-приложение",
  );
  await expect(
    page.getByText("Черновик восстановлен", { exact: true }).first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Оставить заявку", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Заявка принята." }),
  ).toBeVisible();
  await captureStates(page,"success");
  await page.emulateMedia({media:"print"});
  await expect(page.locator(".site-header")).toBeHidden();
  await expect(page.locator(".claim-secret")).toBeVisible();
  await page.emulateMedia({media:"screen"});
  const code = await page.locator(".claim-secret").textContent();
  expect(code.replaceAll("-", "")).toHaveLength(12);
  await page.evaluate(() => { Object.defineProperty(navigator,'clipboard',{value:{writeText:async value=>{window.__copied=value}},configurable:true}); });
  await page.getByRole('button',{name:'Скопировать',exact:true}).click();
  expect(await page.evaluate(()=>Boolean(window.__copied?.includes('DEVUP-')))).toBeTruthy();
  await expect(
    page.getByRole("button", { name: "Зарегистрироваться / Войти" }),
  ).toBeDisabled();
  await page.getByLabel("Я сохранил код").check();
  await page
    .getByRole("button", { name: "Зарегистрироваться / Войти" })
    .click();
  await page.getByRole("radio", { name: "Регистрация", exact: true }).check();
  await page
    .locator("#auth")
    .getByLabel("Почта", { exact: true })
    .fill("browser@example.com");
  await page.getByLabel("Пароль", { exact: true }).fill("Browser-password-123");
  await captureStates(page,"registration");
  await page
    .getByRole("button", { name: "Зарегистрироваться", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Код из письма" }),
  ).toBeVisible();
  await captureStates(page,"code-step");
  const messages = await (await request.get("/__test/mail")).json();
  const verification = messages
    .filter((m) => m.template === "code")
    .at(-1).code;
  await page.getByLabel("Код подтверждения").fill(verification);
  await page.getByRole("button", { name: "Подтвердить", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Нашли заявки с этого устройства" }),
  ).toBeVisible();
  await captureStates(page,"claim-offer");
  await page.getByRole("button", { name: "Привязать", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Мои заявки" })).toBeVisible();
  await captureStates(page,"cabinet");
  await page.getByRole("button", { name: "Подробнее", exact: true }).click();
  await expect(page.locator("#detail")).toBeVisible();
  await expect(
    page
      .locator("#detail")
      .getByText("Нужно Android-приложение", { exact: true }),
  ).toBeVisible();
  await expect(
    page.locator("#detail").getByRole("link", { name: "Чат по заявке" }),
  ).toHaveAttribute("href", /chat\?thread=devup-/);
  await captureStates(page,"detail");
  await page.keyboard.press("Escape");
  expect(
    await page.evaluate(() => localStorage.getItem("devup-mix-draft")),
  ).toBeNull();
  await page.goto('/order?type=study');
  await page.getByRole('textbox',{name:'Telegram',exact:true}).fill('@another');
  await page.getByRole('button',{name:'Оставить заявку',exact:true}).click();
  await expect(page.getByText('Заявка привязана к твоему кабинету.')).toBeVisible();
  await expect(page.locator('.claim-secret')).toHaveCount(0);
  await page.getByRole('link',{name:'Открыть в кабинете'}).click();
  await expect(page.locator('.request-list article')).toHaveCount(2);
  await page.getByRole("button", { name: "Выйти", exact: true }).click();
  await expect(page.locator("#auth")).toBeVisible();
});

test("mobile menu, palette, dialogs and reviews sorting", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await page.getByRole("button", { name: "Открыть меню" }).click();
  await expect(page.locator("#site-navigation")).toHaveClass(/open/);
  await page.keyboard.press("Escape");
  await expect(page.locator("#site-navigation")).not.toHaveClass(/open/);
  await page.locator("#pal-fab").click();
  await page.locator("#pal-g button").first().click();
  await page.getByLabel("Светлая версия").check();
  await page.reload();
  expect(
    await page.evaluate(() => document.documentElement.style.colorScheme),
  ).toBe("light");
  await page.route("**/api/reviews", route => route.fulfill({json: [
    {id: "one", author_name: "Анна", rating: 5, body: "Отлично", service: "Сайт", created_at: "2026-11-19"},
    {id: "two", author_name: "Илья", rating: 4, body: "Спасибо", service: "Сайт", created_at: "2026-11-18"},
  ]}));
  await page.goto("/reviews");
  await page.locator("#review-sort").selectOption("low");
  await expect(page.locator(".review-list article").first()).toHaveAttribute(
    "data-rating",
    "4",
  );
  await page
    .getByRole("button", { name: "Оставить отзыв", exact: true })
    .click();
  await expect(page.locator("#review-form")).toBeVisible();
  await page.keyboard.press("Escape");
});

test("order editing, stable scroll, palette dismissal and card glow", async ({page}) => {
  await page.setViewportSize({width:1280,height:900});
  await page.goto("/order");
  const add=page.getByRole("button",{name:/Добавить блок.*Чат/});
  await add.scrollIntoViewIfNeeded();
  const library = page.locator(".block-library");
  const before = await page.evaluate(() => window.scrollY);
  const panelTop = (await library.boundingBox()).y;
  for (let i = 0; i < 12; i++) await add.click();
  expect((await page.locator(".builder-canvas").boundingBox()).height)
    .toBeGreaterThan((await library.boundingBox()).height);
  expect(Math.abs(await page.evaluate(() => window.scrollY) - before)).toBeLessThanOrEqual(1);
  expect(Math.abs((await library.boundingBox()).y - panelTop)).toBeLessThanOrEqual(1);
  const input=page.locator(".project-block input").first();
  await input.fill("Первое второе третье");
  await input.click({position:{x:45,y:20}});
  const caret=await input.evaluate(el=>el.selectionStart);
  expect(caret).toBeGreaterThan(0);
  expect(caret).toBeLessThan(20);
  await input.press("X");
  expect(await input.inputValue()).toBe("Первое второе третье".slice(0,caret)+"X"+"Первое второе третье".slice(caret));
  await page.getByRole("button",{name:"Палитра",exact:true}).click();
  await expect(page.locator("#pal")).toBeVisible();
  await page.locator(".site-header .logo").focus();
  await page.locator(".site-header").click({position:{x:1,y:1}});
  await expect(page.locator("#pal")).toBeHidden();
  await page.goto("/services");
  const card=page.locator(".svc").last();
  await expect(card).toHaveCSS("position","relative");
  await card.scrollIntoViewIfNeeded();
  await card.hover({position:{x:90,y:110}});
  const center=await card.evaluate(e=>[parseFloat(e.style.getPropertyValue("--glow-x")),parseFloat(e.style.getPropertyValue("--glow-y")),getComputedStyle(e,"::after").display]);
  expect(Math.abs(center[0]-90)).toBeLessThan(3);
  expect(Math.abs(center[1]-110)).toBeLessThan(3);
  expect(center[2]).toBe("block");
});

