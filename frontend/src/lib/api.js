export async function api(path, data, options = {}) {
  const multipart = data instanceof FormData;
  const response = await fetch(`/api${path}`, {
    method: options.method || (data === undefined ? "GET" : "POST"),
    credentials: "same-origin",
    headers: {
      ...(multipart ? {} : { "Content-Type": "application/json" }),
      "X-Requested-With": "devup",
    },
    ...(data === undefined
      ? {}
      : { body: multipart ? data : JSON.stringify(data) }),
  });
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(result.message || "Не удалось выполнить запрос.");
    error.field = result.field;
    error.errors = result.errors;
    error.retryAfter = Number(response.headers.get("Retry-After") || 0);
    error.status = response.status;
    if (
      response.status === 401 &&
      path.startsWith("/admin/") &&
      !path.startsWith("/admin/auth/")
    )
      window.dispatchEvent(new Event("devup-admin-expired"));
    throw error;
  }
  return result;
}
