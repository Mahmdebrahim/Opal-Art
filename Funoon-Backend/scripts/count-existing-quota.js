// migrations/count-existing-quota.js
const mongoose = require("mongoose");
const User = require("../src/models/User");
const Order = require("../src/models/Order");
require("dotenv").config();

async function migrate() {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: "funoon_dev" });
  console.log("🔧 Starting freeShippingUsed migration...");

  const prestigeUsers = await User.find({
    "subscription.plan": "opal_prestige",
  });

  for (const user of prestigeUsers) {
    const quotaStart = user.subscription?.startDate || new Date(0);

    const used = await Order.countDocuments({
      artist: user._id,
      status: {
        $in: ["PAID", "PROCESSING", "SHIPPED", "DELIVERED", "COMPLETED"],
      },
      "financials.platformShippingExpense": { $gt: 0 },
      createdAt: { $gte: quotaStart },
    });

    user.freeShippingUsed = used;
    await user.save();
    console.log(`  ✓ User ${user.name} (${user.email}): ${used} used`);
  }

  console.log("✅ Migration complete!");
  await mongoose.disconnect();
}

migrate().catch(console.error);
