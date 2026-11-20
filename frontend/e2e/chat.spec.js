import { test, expect } from "@playwright/test";

async function code(request, template) {
  const result = await request.get("/__test/mail");
  return (await result.json()).filter((m) => m.template === template).at(-1)
    ?.code;
}

test("chat login return, manager reply and responsive conversation", async ({
  page,
  request,
  browser,
}) => {
  await request.post("/__test/reset");
  await page.goto("/");
  await page.getByRole("link", { name: "Связаться с менеджером" }).click();
  await expect(
    page.getByRole("heading", { name: "Личный кабинет" }),
  ).toBeVisible();
  await page.getByRole("radio", { name: "Регистрация" }).check();
  await page
    .locator("#auth")
    .getByLabel("Почта", { exact: true })
    .fill("chat-client@example.com");
  await page.getByLabel("Пароль", { exact: true }).fill("Chat-password-123");
  await page
    .getByRole("button", { name: "Зарегистрироваться", exact: true })
    .click();
  await expect.poll(() => code(request, "code")).toBeTruthy();
  await page.getByLabel("Код подтверждения").fill(await code(request, "code"));
  await page.getByRole("button", { name: "Подтвердить", exact: true }).click();
  await expect(page).toHaveURL(/\/chat\?thread=direct/);
  await page
    .getByRole("textbox", { name: "Сообщение", exact: true })
    .fill("Вопрос по проекту");
  await page
    .getByRole("textbox", { name: "Сообщение", exact: true })
    .press("Enter");
  await expect(page.getByRole("log")).toContainText("Вопрос по проекту");

  const manager = await browser.newPage();
  await manager.goto("/admin/login");
  await manager.getByLabel("Логин", { exact: true }).fill("qa_admin");
  await manager.getByLabel("Пароль", { exact: true }).fill("Test-admin-123");
  await manager.getByRole("button", { name: "Войти", exact: true }).click();
  await expect.poll(() => code(request, "admin_code")).toBeTruthy();
  await manager
    .getByLabel("Код подтверждения")
    .fill(await code(request, "admin_code"));
  await manager
    .getByRole("button", { name: "Подтвердить", exact: true })
    .click();
  await manager.getByRole("link", { name: /^Чаты/ }).click();
  await manager.locator(".chat-threads a").first().click();
  await expect(manager.getByRole("log")).toContainText("Вопрос по проекту");
  await manager
    .getByRole("textbox", { name: "Сообщение", exact: true })
    .fill("Помогу с заявкой");
  await manager.getByRole("button", { name: "Отправить", exact: true }).click();
  await expect(page.getByRole("log")).toContainText("Помогу с заявкой", {
    timeout: 10000,
  });
  await expect(page.getByRole("log")).toContainText("Менеджер DEVUP");
  await expect(page.getByRole("log")).not.toContainText("qa_admin");

  for (const width of [360, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const light of [false, true]) {
      await page.evaluate(light => {
        document.querySelector('#pal-g button').click();
        const toggle=document.querySelector('#pal-inv');
        if(toggle.checked!==light)toggle.click();
      }, light);
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (width <= 800) await expect(page.locator(".chat-live .conversation-list")).toBeHidden();
      await page.screenshot({path: `test-results/chat/client-${width}-${light?'light':'dark'}.png`});
    }
  }
  await manager.close();
});
