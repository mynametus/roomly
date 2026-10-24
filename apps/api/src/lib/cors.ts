export function allowedFrontendOrigins(environment: NodeJS.ProcessEnv = process.env): string[] {
  const origins = environment.FRONTEND_URL?.split(",").map((origin) => origin.trim()).filter(Boolean) ?? [];
  if (environment.NODE_ENV !== "production" && !environment.VERCEL) {
    origins.push("http://localhost:5173", "http://127.0.0.1:5173");
  }
  return [...new Set(origins)];
}
