// scripts/register-oto-webhook.js
require("dotenv").config();
const axios = require("axios");

async function registerWebhook() {
  try {
    console.log("🔍 Debug: Checking environment variables...\n");

    // Check environment variables
    console.log("📍 OTO_BASE_URL:", process.env.OTO_BASE_URL || "❌ MISSING");
    console.log(
      "🔑 OTO_REFRESH_TOKEN:",
      process.env.OTO_REFRESH_TOKEN ? "✅ Set" : "❌ Missing",
    );
    console.log("🌐 NGROK_URL:", process.env.NGROK_URL || "❌ MISSING");
    console.log(
      "🔐 OTO_WEBHOOK_SECRET:",
      process.env.OTO_WEBHOOK_SECRET ? "✅ Set" : "❌ Missing",
    );

    // Validate required variables
    if (!process.env.OTO_BASE_URL) {
      throw new Error("❌ OTO_BASE_URL is missing in .env");
    }

    if (!process.env.OTO_REFRESH_TOKEN) {
      throw new Error("❌ OTO_REFRESH_TOKEN is missing in .env");
    }

    if (!process.env.NGROK_URL) {
      throw new Error("❌ NGROK_URL is missing in .env");
    }

    const webhookAuthorizationKey =
      process.env.OTO_WEBHOOK_AUTHORIZATION_KEY || process.env.OTO_WEBHOOK_AUTH;
    if (!process.env.OTO_WEBHOOK_SECRET || !webhookAuthorizationKey) {
      throw new Error(
        "❌ OTO webhook verification credentials are missing in .env",
      );
    }

    // Step 1: Get Access Token
    console.log("\n🔑 Step 1: Getting access token...");
    console.log(
      "📡 Requesting:",
      `${process.env.OTO_BASE_URL}/rest/v2/refreshToken`,
    );

    const requestBody = {
      refresh_token: process.env.OTO_REFRESH_TOKEN,
    };

    const tokenResponse = await axios.post(
      `${process.env.OTO_BASE_URL}/rest/v2/refreshToken`,
      requestBody,
      {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        timeout: 30000,
      },
    );

    console.log("✅ Access token response received");

    const accessToken = tokenResponse.data.access_token;
    if (!accessToken) {
      throw new Error("❌ No access_token in response");
    }

    console.log("✅ Access token obtained");

    // Step 2: Register Webhook
    console.log("\n📝 Step 2: Registering webhook...");

    const webhookData = {
      method: "post",
      url: `${process.env.NGROK_URL}/api/v1/webhooks/oto`,
      webhookType: "orderStatus",
      secretKey: process.env.OTO_WEBHOOK_SECRET,
      authorizationKey: webhookAuthorizationKey,
      orderPrefix: "P",
      timestampFormat: "yyyy-MM-dd HH:mm:ss",
    };

    console.log("📤 Registering OTO webhook with configured credentials");

    const webhookResponse = await axios.post(
      `${process.env.OTO_BASE_URL}/rest/v2/webhook`,
      webhookData,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        timeout: 30000,
      },
    );

    console.log("✅ Webhook registered successfully!");
    console.log("📊 Response:", JSON.stringify(webhookResponse.data, null, 2));
  } catch (error) {
    console.error("\n❌ Error:", error.response?.data || error.message);

    if (error.response?.data?.otoErrorCode === "OTO1083") {
      console.error("\n💡 Possible causes:");
      console.error("   1. Refresh token is expired or invalid");
      console.error("   2. Using wrong base URL (production vs staging)");
      console.error("   3. Refresh token belongs to a different project");
      console.error("\n🔧 Solutions:");
      console.error("   1. Get a new refresh token from OTO Dashboard");
      console.error(
        "   2. Check if OTO_BASE_URL matches where you got the token",
      );
      console.error("   3. Try staging URL: https://staging-api.tryoto.com");
    }

    if (error.code === "ECONNABORTED") {
      console.error("\n⏱️ Request timeout - check your internet connection");
    }
  }
}

registerWebhook();
