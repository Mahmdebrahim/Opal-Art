import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
  clear: () => storage.clear(),
};
globalThis.window = { localStorage: globalThis.localStorage };

const axiosModule = await import("axios");
const axios = axiosModule.default;
const { useAuthStore } = await import("./authStore.js");
const originalAdapter = axios.defaults.adapter;

const user = { _id: "user-1", role: "artist", emailVerified: true };
let refreshRequests = 0;

const responseFor = (config, data) => ({
  config,
  data,
  headers: {},
  status: 200,
  statusText: "OK",
});

before(() => {
  axios.defaults.adapter = async (config) => {
    if (config.url.endsWith("/auth/refresh-token")) {
      refreshRequests += 1;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return responseFor(config, {
        success: true,
        data: { accessToken: "fresh-access-token" },
      });
    }

    if (config.url.endsWith("/auth/me")) {
      return responseFor(config, { success: true, data: user });
    }

    throw new Error(`Unexpected request: ${config.url}`);
  };
});

after(() => {
  axios.defaults.adapter = originalAdapter;
  storage.clear();
});

describe("auth refresh access token", () => {
  it("shares one refresh request and returns its token to every caller", async () => {
    const [firstToken, secondToken] = await Promise.all([
      useAuthStore.getState().refreshAccessToken(),
      useAuthStore.getState().refreshAccessToken(),
    ]);

    assert.equal(firstToken, "fresh-access-token");
    assert.equal(secondToken, "fresh-access-token");
    assert.equal(refreshRequests, 1);
    assert.equal(useAuthStore.getState().user._id, user._id);
    assert.equal(useAuthStore.getState().accessToken, "fresh-access-token");
  });

  it("preserves the current auth state when refresh fails temporarily", async () => {
    useAuthStore.getState().setToken("still-valid-local-token");
    axios.defaults.adapter = async (config) => {
      const error = new Error("Backend unavailable");
      error.config = config;
      error.response = { ...responseFor(config, { message: "Unavailable" }), status: 503 };
      throw error;
    };

    await assert.rejects(useAuthStore.getState().refreshAccessToken());
    assert.equal(useAuthStore.getState().isAuthenticated, true);
    assert.equal(useAuthStore.getState().accessToken, "still-valid-local-token");
    assert.equal(localStorage.getItem("accessToken"), "still-valid-local-token");
  });
});