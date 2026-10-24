import { describe, expect, it } from "vitest";
import { allowedFrontendOrigins } from "./cors.js";

describe("frontend CORS configuration", () => {
  it("allows local development even when FRONTEND_URL points to production", () => {
    expect(allowedFrontendOrigins({ FRONTEND_URL: "https://roomly-web-seven.vercel.app" })).toEqual([
      "https://roomly-web-seven.vercel.app", "http://localhost:5173", "http://127.0.0.1:5173"
    ]);
  });

  it.each([{ NODE_ENV: "production" }, { VERCEL: "1" }])("restricts deployed APIs to configured origins: %j", (environment) => {
    expect(allowedFrontendOrigins({ ...environment, FRONTEND_URL: "https://roomly-web-seven.vercel.app" }))
      .toEqual(["https://roomly-web-seven.vercel.app"]);
  });

  it("handles multiple configured origins and removes empty or duplicate entries", () => {
    expect(allowedFrontendOrigins({
      NODE_ENV: "production", FRONTEND_URL: " https://one.example, ,https://two.example,https://one.example "
    })).toEqual(["https://one.example", "https://two.example"]);
  });

  it("uses local defaults in development and no default origin in production", () => {
    expect(allowedFrontendOrigins({})).toEqual(["http://localhost:5173", "http://127.0.0.1:5173"]);
    expect(allowedFrontendOrigins({ NODE_ENV: "production" })).toEqual([]);
  });
});
