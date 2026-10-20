const API_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:4000").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  if (token) headers.set("authorization", `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...options, headers });
  } catch {
    throw new ApiError("Không thể kết nối máy chủ. Hãy kiểm tra API và kết nối mạng.", 0);
  }
  const data: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    let message =
      typeof data === "object" && data !== null && "error" in data && typeof data.error === "string"
        ? data.error
        : "Yêu cầu không thành công.";
    if (typeof data === "object" && data !== null && "details" in data) {
      const details = data.details;
      if (typeof details === "object" && details !== null && "failures" in details && Array.isArray(details.failures)) {
        const failures = details.failures
          .filter((failure): failure is { date: string; reason: string } =>
            typeof failure === "object" && failure !== null &&
            "date" in failure && typeof failure.date === "string" &&
            "reason" in failure && typeof failure.reason === "string"
          )
          .map((failure) => `${new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(new Date(failure.date))}: ${failure.reason}`);
        if (failures.length) message = `${message}\n${failures.join("\n")}`;
      }
    }
    throw new ApiError(message, response.status);
  }
  return data as T;
}
