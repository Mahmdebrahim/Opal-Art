const cron = require("node-cron");
const User = require("../models/User");
const eventEmitter = require("../events/event-emitter");
const EVENTS = require("../events/events");
const logger = require("../utils/logger");

const MS_PER_DAY = 24 * 60 * 60 * 1000;


async function runSubscriptionExpiringJob() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thirtyOneDaysFromNow = new Date(today.getTime() + 31 * MS_PER_DAY);
    const users = await User.find({
      "subscription.isActive": true,
      "subscription.endDate": {
        $gte: today,
        $lt: thirtyOneDaysFromNow,
      },
    }).select(
      "_id name email subscription.plan subscription.endDate subscription.lastReminderSentAt subscription.lastReminderDaysLeft",
    );

    logger.info(
      `⏰ Found ${users.length} user(s) with subscription expiring within 30 days`,
    );

    let sentCount = 0;
    let skippedCount = 0;

    for (const user of users) {
      const endDate = new Date(user.subscription.endDate);
      endDate.setHours(0, 0, 0, 0);
      const daysLeft = Math.round((endDate - today) / MS_PER_DAY);

      const hasReceivedFirstReminder =
        user.subscription.lastReminderDaysLeft !== null &&
        user.subscription.lastReminderDaysLeft !== undefined;

      const isUrgentDay = daysLeft === 3;
      const alreadyReceivedUrgent =
        user.subscription.lastReminderDaysLeft === 3;

      let shouldSend = false;
      let reminderType = "";

      if (!hasReceivedFirstReminder) {
        shouldSend = true;
        reminderType = "first (30-day window entry)";
      } else if (isUrgentDay && !alreadyReceivedUrgent) {
        shouldSend = true;
        reminderType = "urgent (3-day warning)";
      }

      if (!shouldSend) {
        skippedCount++;
        continue;
      }

      const planConfig = User.PLAN_CONFIG?.[user.subscription.plan];
      const planLabel = planConfig?.labelAr || user.subscription.plan;

      eventEmitter.safeEmit(EVENTS.SUBSCRIPTION_EXPIRING, {
        userId: user._id,
        email: user.email,
        name: user.name,
        daysLeft,
        planLabel,
        isUrgent: daysLeft <= 3,
      });

      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            "subscription.lastReminderSentAt": new Date(),
            "subscription.lastReminderDaysLeft": daysLeft,
          },
        },
      );

      sentCount++;
      logger.info(
        `📧 ${reminderType} reminder sent to ${user.name} (${daysLeft}d left)`,
      );
    }

    logger.info(
      `✅ Subscription expiring job completed: sent=${sentCount}, skipped=${skippedCount}`,
    );
  } catch (error) {
    logger.error(`❌ Subscription expiring job error: ${error.message}`);
  }
}

function startSubscriptionExpiringJob() {
  cron.schedule("42 20 * * *", runSubscriptionExpiringJob);
  logger.info("⏰ Subscription expiring cron job scheduled (daily at 1:00 AM)");
}

module.exports = {
  startSubscriptionExpiringJob,
  runSubscriptionExpiringJob,
};