const eventEmitter = require("../event-emitter");
const EVENTS = require("../events");
const EmailService = require("../../services/email.service");
const User = require("../../models/User");
const logger = require("../../utils/logger");

const EMAIL_EVENTS = [
  EVENTS.ORDER_PAID,
  EVENTS.ORDER_SHIPPED,
  EVENTS.ORDER_CANCELLED,
  EVENTS.REFUND_FAILED,
  EVENTS.REFUND_MANUALLY_COMPLETED,
  EVENTS.ARTWORK_REJECTED,
  EVENTS.ARTWORK_SUSPENDED,
  EVENTS.WITHDRAWAL_REQUESTED,
  EVENTS.WITHDRAWAL_REJECTED,
  EVENTS.WITHDRAWAL_PAID,
  EVENTS.SUBSCRIPTION_EXPIRING,
  EVENTS.SUBSCRIPTION_EXPIRED,
  EVENTS.SUBSCRIPTION_ACTIVATED,
  EVENTS.SUPPORT_MESSAGE_RECEIVED,
  EVENTS.USER_BANNED,
  EVENTS.USER_UNBANNED,
  EVENTS.ORDER_HELD,
  EVENTS.ORDER_UNHELD,
];

EMAIL_EVENTS.forEach((event) => {
  eventEmitter.on(event, async (payload) => {
    try {
      switch (event) {
        case EVENTS.ORDER_PAID: {
          // email للمشتري
          const buyer = await User.findById(payload.buyerId).select(
            "name email",
          );
          if (buyer)
            await EmailService.sendOrderConfirmation(buyer, payload.order);

          const artist = await User.findById(payload.artistId).select(
            "name email",
          );
          if (artist)
            await EmailService.sendArtistOrderNotification(
              artist,
              payload.order,
            );
          break;
        }
        case EVENTS.ORDER_SHIPPED: {
          const buyer = await User.findById(payload.buyerId).select(
            "name email",
          );
          if (buyer)
            await EmailService.sendOrderShippedEmail(
              buyer,
              payload.orderNumber,
              payload.carrier,
            );
          break;
        }
        case EVENTS.ORDER_CANCELLED: {
          try {
            // ✅ لو إلغاء من OTO → نبعت إيميل مختلف للفنان
            if (payload.isOtoCancellation && payload.artistId) {
              const artist = await User.findById(payload.artistId).select(
                "name email",
              );
              if (artist) {
                await EmailService.sendShipmentReturnedEmail(artist, {
                  orderNumber: payload.orderNumber,
                  carrier: payload.carrier,
                  isReturned: payload.isReturned,
                  fundsWereReleased: payload.fundsWereReleased,
                });
                logger.info(
                  `[EmailSubscriber] Sent shipment returned to ${artist.email}`,
                );
              }
            }

            // ✅ إيميل للمشتري (زي ما كان)
            const buyer = await User.findById(payload.buyerId).select(
              "name email",
            );
            if (buyer && payload.totalAmount) {
              await EmailService.sendOrderCancelledEmail(
                buyer,
                payload.orderNumber,
                payload.totalAmount,
                payload.reason,
                payload.refundInitiated,
              );
              logger.info(
                `[EmailSubscriber] Sent order:cancelled to ${buyer.email}`,
              );
            }
          } catch (err) {
            logger.error(`Order cancelled email failed: ${err.message}`);
          }
          break;
        }
        case EVENTS.REFUND_FAILED: {
          try {
            const admins = await User.find({ role: "admin" }).select(
              "name email",
            );
            for (const admin of admins) {
              await EmailService.sendRefundFailedAdminEmail(admin, payload);
            }
            logger.info(
              `[EmailSubscriber] Sent refund:failed to ${admins.length} admin(s)`,
            );
          } catch (err) {
            logger.error(`Refund failed email failed: ${err.message}`);
          }
          break;
        }
        case EVENTS.REFUND_MANUALLY_COMPLETED: {
          try {
            const user = await User.findById(payload.buyerId).select(
              "name email",
            );
            if (user) {
              await EmailService.sendRefundCompletedEmail(user, {
                amount: payload.amount,
                orderNumber: payload.orderNumber,
              });
              logger.info(
                `[EmailSubscriber] Sent refund:completed to ${user.email}`,
              );
            }
          } catch (err) {
            logger.error(`Refund completed email failed: ${err.message}`);
          }
          break;
        }
        case EVENTS.ORDER_HELD: {
          try {
            await EmailService.sendOrderHoldEmail(payload);
            logger.info(
              `[EmailSubscriber] Sent order:held to ${payload.artistEmail}`,
            );
          } catch (err) {
            logger.error(`Order hold email failed: ${err.message}`);
          }
          break;
        }
        case EVENTS.ORDER_UNHELD: {
          try {
            await EmailService.sendOrderUnholdEmail(payload);
            logger.info(
              `[EmailSubscriber] Sent order:unheld to ${payload.artistEmail}`,
            );
          } catch (err) {
            logger.error(`Order unhold email failed: ${err.message}`);
          }
          break;
        }

        case EVENTS.USER_BANNED: {
          try {
            await EmailService.sendBanNotice(
              payload.email,
              payload.name,
              payload.reason,
            );
            logger.info(
              `[EmailSubscriber] Sent user:banned to ${payload.email}`,
            );
          } catch (err) {
            logger.error(`Ban email failed: ${err.message}`);
          }
          break;
        }
        case EVENTS.USER_UNBANNED: {
          try {
            await EmailService.sendUnbanEmail(
              payload.email,
              payload.name,
              payload.reason,
            );
            logger.info(
              `[EmailSubscriber] Sent user:unbanned to ${payload.email}`,
            );
          } catch (err) {
            logger.error(`Unban email failed: ${err.message}`);
          }
          break;
        }

        case EVENTS.ARTWORK_REJECTED: {
          const user = await User.findById(payload.artistId).select(
            "name email",
          );
          if (user)
            await EmailService.sendArtworkRejectedEmail(
              user,
              payload.title,
              payload.reason,
            );
          break;
        }
        case EVENTS.ARTWORK_SUSPENDED: {
          const user = await User.findById(payload.artistId).select(
            "name email",
          );
          if (user)
            await EmailService.sendArtworkSuspendedEmail(
              user,
              payload.title,
              payload.reason,
            );
          break;
        }

        case EVENTS.WITHDRAWAL_REQUESTED: {
          const admins = await User.find({ role: "admin" }).select(
            "name email",
          );
          for (const admin of admins) {
            await EmailService.sendWithdrawalRequestedAdminEmail(
              admin,
              payload.userName,
              payload.amount,
            );
          }
          break;
        }
        case EVENTS.WITHDRAWAL_REJECTED:
        case EVENTS.WITHDRAWAL_PAID: {
          const user = await User.findById(payload.userId).select("name email");
          if (user) {
            await EmailService.sendWithdrawalStatusEmail(user, {
              amount: payload.amount,
              status:
                event === EVENTS.WITHDRAWAL_REJECTED ? "REJECTED" : "PAID",
              rejectionReason: payload.reason,
              transferReference: payload.transferReference,
            });
          }
          break;
        }

        case EVENTS.SUBSCRIPTION_EXPIRING: {
          const user = await User.findById(payload.userId).select("name email");
          if (user)
            await EmailService.sendSubscriptionExpiringEmail(
              user,
              payload.daysLeft,
              payload.planLabel,
            );
          break;
        }
        case EVENTS.SUBSCRIPTION_EXPIRED: {
          const user = await User.findById(payload.userId).select("name email");
          if (user)
            await EmailService.sendSubscriptionExpiredEmail(
              user,
              payload.planLabel,
            );
          break;
        }
        case EVENTS.SUBSCRIPTION_ACTIVATED: {
          const user = await User.findById(payload.userId).select("name email");
          if (user) {
            await EmailService.sendSubscriptionActivatedEmail(
              user,
              payload.planLabel,
              payload.endDate,
            );
          }
          break;
        }
        case EVENTS.SUPPORT_MESSAGE_RECEIVED: {
          const admins = await User.find({ role: "admin" }).select(
            "name email",
          );
          for (const admin of admins) {
            await EmailService.sendSupportAdminEmail(admin, payload);
          }
          break;
        }

        default:
          break;
      }
      logger.debug(`[EmailSubscriber] Sent ${event}`);
    } catch (error) {
      logger.error(`[EmailSubscriber] Failed for ${event}: ${error.message}`);
    }
  });
});

logger.info(
  `✅ Email subscriber registered (${EMAIL_EVENTS.length} critical events only)`,
);
