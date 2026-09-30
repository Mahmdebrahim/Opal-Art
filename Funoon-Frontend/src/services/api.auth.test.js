import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

const storage = new Map();
const testStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
  clear: () => storage.clear(),
};
globalThis.localStorage = testStorage;
globalThis.window = { localStorage: testStorage, location: { reload() {} } };

const axiosModule = await import("axios");
const axios = axiosModule.default;
const { useAuthStore } = await import("../features/auth/stores/authStore.js");
const { default: api } = await import("./api.js");
const originalDefaultAdapter = axios.defaults.adapter;
const originalApiAdapter = api.defaults.adapter;
const currentUser = { _id: "user-1", role: "artist", emailVerified: true };

let refreshRequests = 0;
let protectedRequests = 0;

const responseFor = (config, data, status = 200) => ({
  config,
  data,
  headers: {},
  status,
  statusText: status === 200 ? "OK" : "Unauthorized",
});

const expiredError = (config) => {
  const error = new Error("Access token expired");
  error.config = config;
  error.response = responseFor(
    config,
    {
      success: false,
      authErrorCode: "ACCESS_TOKEN_EXPIRED",
      message: "انتهت صلاحية الجلسة",
    },
    401,
  );
  return error;
};

before(() => {
  useAuthStore.getState().login(currentUser, "expired-access-token");

  axios.defaults.adapter = async (config) => {
    if (config.url.endsWith("/auth/refresh-token")) {
      refreshRequests += 1;
      return responseFor(config, {
        success: true,
        data: { accessToken: "fresh-access-token" },
      });
    }

    if (config.url.endsWith("/auth/me")) {
      return responseFor(config, { success: true, data: currentUser });
    }

    throw new Error(`Unexpected axios request: ${config.url}`);
  };

  api.defaults.adapter = async (config) => {
    protectedRequests += 1;
    if (config.headers.Authorization === "Bearer fresh-access-token") {
      return responseFor(config, { success: true, data: { result: "retried" } });
    }
    throw expiredError(config);
  };
});

beforeEach(() => {
  refreshRequests = 0;
  protectedRequests = 0;
  useAuthStore.getState().setToken("expired-access-token");
});

after(() => {
  axios.defaults.adapter = originalDefaultAdapter;
  api.defaults.adapter = originalApiAdapter;
  storage.clear();
});

describe("API access-token refresh", () => {
  it("refreshes an expired token and retries the original request without exposing the first 401", async () => {
    const result = await api.get("/private/resource");

    assert.deepEqual(result, { success: true, data: { result: "retried" } });
    assert.equal(refreshRequests, 1);
    assert.equal(protectedRequests, 2);
    assert.equal(useAuthStore.getState().accessToken, "fresh-access-token");
  });

  it("shares one refresh across simultaneous expired-token requests", async () => {
    const results = await Promise.all([
      api.get("/private/first"),
      api.get("/private/second"),
      api.get("/private/third"),
    ]);

    assert.equal(refreshRequests, 1);
    assert.equal(protectedRequests, 6);
    assert.ok(
      results.every((result) => result.data.result === "retried"),
    );
  });

  it("does not refresh for an unrelated resource-level 401", async () => {
    api.defaults.adapter = async (config) => {
      throw Object.assign(new Error("Not the resource owner"), {
        config,
        response: responseFor(
          config,
          { success: false, message: "غير مصرح لك بعرض هذا المورد" },
          401,
        ),
      });
    };

    await assert.rejects(api.get("/private/other-users-resource"));
    assert.equal(refreshRequests, 0);
    assert.equal(useAuthStore.getState().accessToken, "expired-access-token");
  });
});