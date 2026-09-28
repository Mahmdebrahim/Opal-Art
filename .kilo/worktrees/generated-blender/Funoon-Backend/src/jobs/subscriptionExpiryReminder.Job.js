const cron = require("node-cron");
const User = require("../models/User");
const eventEmitter = require("../events/event-emitter");
const EVENTS = require("../events/events");
const logger = require("../utils/logger");

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * ✅ Simplified Subscription Expiring Job
 *
 * Strategy (2 reminders only):
 * - Reminder 1: أول مرة يدخل في window ≤ 30 يوم (early notice)
 * - Reminder 2: لما يوصل لـ 3 أيام بالظبط (urgent warning)
 */
async function runSubscriptionExpiringJob() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // ✅ جيب كل الـ users اللي اشتراكهم ينتهي خلال 30 يوم
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

      // ✅ قرار الإرسال
      const hasReceivedFirstReminder =
        user.subscription.lastReminderDaysLeft !== null &&
        user.subscription.lastReminderDaysLeft !== undefined;

      const isUrgentDay = daysLeft === 3;
      const alreadyReceivedUrgent =
        user.subscription.lastReminderDaysLeft === 3;

      let shouldSend = false;
      let reminderType = "";

      if (!hasReceivedFirstReminder) {
        // ✅ أول مرة يدخل في window الـ 30 يوم
        shouldSend = true;
        reminderType = "first (30-day window entry)";
      } else if (isUrgentDay && !alreadyReceivedUrgent) {
        // ✅ وصل لـ 3 أيام بالظبط
        shouldSend = true;
        reminderType = "urgent (3-day warning)";
      }

      if (!shouldSend) {
        skippedCount++;
        continue;
      }

      // ✅ بعت الـ reminder
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

      // ✅ حدّث الـ tracking fields
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
  cron.schedule("40 1 * * *", runSubscriptionExpiringJob);
  logger.info("⏰ Subscription expiring cron job scheduled (daily at 1:00 AM)");
}

module.exports = {
  startSubscriptionExpiringJob,
  runSubscriptionExpiringJob,
};