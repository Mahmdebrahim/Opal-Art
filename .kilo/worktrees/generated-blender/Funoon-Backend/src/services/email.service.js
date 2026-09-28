const { Resend } = require("resend");
const logger = require("../utils/logger");

// تهيئة Resend
const resend = new Resend(process.env.RESEND_API_KEY);

const getFromAddress = () => {
  if (process.env.NODE_ENV === "production" && process.env.RESEND_DOMAIN) {
    return `Funoon.sa <noreply@${process.env.RESEND_DOMAIN}>`;
  }
  return "Funoon.sa <onboarding@resend.dev>";
};

const BRAND = {
  primary: "#5A1E2B",
  primaryDark: "#431620",
  gold: "#C5A880",
  bg: "#F6F3EF",
  card: "#FEFEFE",
  text: "#2B2B2B",
  muted: "#8A8580",
  border: "#EAE4DC",
  success: "#2e7d32",
  danger: "#8B0000",
  warning: "#e65100",
  info: "#5a6b7d",
};

const baseTemplate = (content, accent = BRAND.primary) => `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>فُنون | Funoon.sa</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.bg};font-family:'Segoe UI',Tahoma,Arial,sans-serif;-webkit-text-size-adjust:100%;">
  <center style="width:100%;background:${BRAND.bg};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:28px 12px;">
      <tr><td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <tr>
            <td style="background:${accent};border-radius:16px 16px 0 0;padding:22px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
                <td style="color:#FDFDFD;font-size:21px;font-weight:bold;">
                  فُنون <span style="color:${BRAND.gold};font-size:18px;">✦</span>
                  <span style="font-size:12px;color:#E9DCCE;font-weight:normal;">Funoon.sa</span>
                </td>
              </tr></table>
            </td>
          </tr>
          <tr><td style="background:${BRAND.gold};height:4px;font-size:0;line-height:0;">&nbsp;</td></tr>
          <tr>
            <td style="background:${BRAND.card};padding:36px 32px;border-right:1px solid ${BRAND.border};border-left:1px solid ${BRAND.border};color:${BRAND.text};font-size:14px;line-height:1.9;">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="background:#EFEAE3;border-radius:0 0 16px 16px;padding:20px 32px;border:1px solid ${BRAND.border};border-top:0;">
              <p style="margin:0;color:${BRAND.muted};font-size:11px;line-height:1.8;text-align:center;">
                منصة فُنون — عرض وبيع الأعمال الفنية السعودية<br>
                بريد تلقائي، يرجى عدم الرد عليه
              </p>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </center>
</body>
</html>`;

const btn = (href, label, color = BRAND.primary) => `
  <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:28px auto 6px;">
    <tr>
      <td style="background:${color};border-radius:10px;">
        <a href="${href}" style="display:inline-block;padding:13px 38px;color:#FDFDFD;text-decoration:none;font-weight:bold;font-size:14px;">${label}</a>
      </td>
    </tr>
  </table>`;

const escapeHtml = (str) =>
  String(str ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c],
  );

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

class EmailService {
  // static async sendEmail(to, subject, html) {
  //   try {
  //     // ✅ Validation
  //     if (!to || typeof to !== "string") {
  //       throw new Error(
  //         `Invalid 'to' field: expected string, got ${typeof to}`,
  //       );
  //     }

  //     if (process.env.NODE_ENV === "development") {
  //       logger.info(`[Email Dev Mode] Sending to: ${to} | Subject: ${subject}`);
  //     }

  //     const response = await resend.emails.send({
  //       from: getFromAddress(),
  //       to,
  //       subject,
  //       html,
  //     });

  //     if (response.error) throw new Error(response.error.message);

  //     logger.info(`✅ Email dispatched to ${to}. ID: ${response.data?.id}`);
  //     return true;
  //   } catch (error) {
  //     logger.error(`❌ Email failed to ${to}: ${error.message}`);
  //     if (process.env.NODE_ENV === "development") {
  //       console.error("Resend Error:", error);
  //     }
  //     return false;
  //   }
  // }

  static async sendEmail(to, subject, html) {
    try {
      if (!to || typeof to !== "string") {
        throw new Error(
          `Invalid 'to' field: expected string, got ${typeof to}`,
        );
      }

      let finalTo = to;
      let finalSubject = subject;

      // ✅ Dev mode: override للإيميلات اللي مش verified
      if (process.env.NODE_ENV === "development") {
        const DEV_EMAIL = "muhammedsaviola@gmail.com"; // ✅ الـ verified email
        if (to.toLowerCase() !== DEV_EMAIL.toLowerCase()) {
          finalTo = DEV_EMAIL;
          finalSubject = `[DEV → ${to}] ${subject}`;
          // ✅ نضيف ملاحظة في أعلى الـ HTML
          const devBanner = `
          <div style="background:#fff3cd;border:2px solid #ffc107;padding:12px;margin-bottom:16px;border-radius:8px;font-size:12px;color:#856404;text-align:right;">
            <strong>🔧 Dev Mode:</strong> الرسالة دي في الأساس لـ <strong>${to}</strong> — تم تحويلها للإيميل المطور للاختبار.
          </div>
        `;
          // نحط الـ banner بعد الـ <body> tag
          html = html.replace("<body", `<body data-dev-redirect="${to}"`);
          html = html.replace(
            /(<table[^>]*role="presentation"[^>]*>[\s\S]*?<td[^>]*>[\s\S]*?<\/td>[\s\S]*?<\/table>)/,
            (match) => devBanner + match,
          );
          logger.info(
            `[Email Dev Mode] Redirected: ${to} → ${DEV_EMAIL} | Subject: ${subject}`,
          );
        }
      }

      const response = await resend.emails.send({
        from: getFromAddress(),
        to: finalTo,
        subject: finalSubject,
        html,
      });

      if (response.error) throw new Error(response.error.message);

      logger.info(
        `✅ Email dispatched to ${finalTo}. ID: ${response.data?.id}`,
      );
      return true;
    } catch (error) {
      logger.error(`❌ Email failed to ${to}: ${error.message}`);
      if (process.env.NODE_ENV === "development") {
        console.error("Resend Error:", error);
      }
      return false;
    }
  }

  // ═══════════════════════════════════════════════════
  //* Auth
  // ═══════════════════════════════════════════════════
  static async sendWelcomeEmail(user) {
    const roleLabel = user.role === "artist" ? "فنان" : "مقتني أعمال فنية";
    const subject = "مرحباً بك في فُنون ✦";
    const html = baseTemplate(`
      <h2 style="margin-top:0;color:${BRAND.primary};">مرحباً ${escapeHtml(user.name)} 👋</h2>
      <p style="color:#444;line-height:1.8;">
        يسعدنا انضمامك إلينا كـ <strong>${roleLabel}</strong> في منصة فُنون.
      </p>
      <p style="color:#444;line-height:1.8;">
        تصفح واكتشف أرقى الأعمال الفنية السعودية.
      </p>
      ${btn(`${FRONTEND_URL}`, "ابدأ الاستكشاف")}
    `);
    return this.sendEmail(user.email, subject, html);
  }

  static async sendVerificationOTP(user, otp) {
    if (process.env.NODE_ENV === "development") {
      console.log(`🔑 [DEV] OTP for ${user.email}: ${otp}`);
    }
    const subject = "رمز تأكيد بريدك الإلكتروني في فُنون";
    const html = baseTemplate(`
      <h2 style="margin-top:0;color:${BRAND.text};">أهلاً ${escapeHtml(user.name)} 👋</h2>
      <p style="color:#444;line-height:1.8;">
        نحتاج نتأكد إن البريد ده تابع ليك. استخدم الرمز التالي لتأكيد حسابك:
      </p>
      <div style="background:${BRAND.bg};border:2px solid ${BRAND.gold};border-radius:12px;padding:24px;margin:24px 0;text-align:center;">
        <p style="font-size:36px;font-weight:bold;letter-spacing:8px;color:${BRAND.primary};margin:0;font-family:monospace;">
          ${escapeHtml(otp)}
        </p>
      </div>
      <p style="color:#444;line-height:1.8;">
        الرمز صالح لمدة <strong>10 دقائق</strong>. لا تشاركه مع أي شخص.
      </p>
      <p style="color:${BRAND.muted};font-size:12px;margin-top:24px;padding-top:16px;border-top:1px solid ${BRAND.border};">
        إذا لم تطلب هذا الرمز، يمكنك تجاهل هذا البريد بأمان.
      </p>
    `);
    return this.sendEmail(user.email, subject, html);
  }

  static async sendPasswordResetEmail(user, url) {
    if (process.env.NODE_ENV === "development") {
      console.log(`🔑 [DEV] Reset URL for ${user.email}: ${url}`);
    }
    const safeUrl = escapeHtml(url);
    const subject = "رابط استعادة كلمة المرور | فُنون";
    const html = baseTemplate(`
      <h2 style="margin-top:0;color:${BRAND.text};">طلب استعادة كلمة المرور</h2>
      <p style="color:#444;line-height:1.8;">
        تلقيت هذا البريد لأنك طلبت استعادة كلمة المرور. اضغط على الزر أدناه لتعيين كلمة مرور جديدة.
      </p>
      <p style="color:${BRAND.muted};font-size:12px;margin-top:-8px;">
        الرابط صالح لمدة 10 دقائق فقط.
      </p>
      ${btn(safeUrl, "استعادة كلمة المرور", BRAND.gold)}
      <p style="color:${BRAND.muted};font-size:12px;margin-top:24px;">
        إذا لم تطلب هذا، يرجى تجاهل هذا البريد.
      </p>
    `);
    return this.sendEmail(user.email, subject, html);
  }

  // ═══════════════════════════════════════════════════
  //* Orders
  // ═══════════════════════════════════════════════════
  static async sendOrderConfirmation(buyer, order) {
    const items = Array.isArray(order?.items) ? order.items : [];
    const firstTitle = items[0]?.artworkSnapshot?.title || "عمل فني";
    const artworkLabel =
      items.length > 1 ? `${firstTitle} +${items.length - 1} أخرى` : firstTitle;
    const orderNumber = String(order._id).slice(-6).toUpperCase();

    const subject = `تم تأكيد دفع طلبك #${orderNumber}`;
    const html = baseTemplate(`
      <h2 style="margin-top:0;color:${BRAND.success};">شكراً لشرائك يا ${escapeHtml(buyer.name)}! 🎉</h2>
      <p style="color:#444;line-height:1.8;">تم استلام دفعتك بنجاح وجاري تجهيز طلبك للشحن.</p>

      <div style="background:${BRAND.bg};border:1px solid ${BRAND.border};border-radius:8px;padding:16px;margin:20px 0;">
        <p style="margin:0 0 6px 0;color:${BRAND.muted};font-size:12px;">رقم الطلب</p>
        <p style="margin:0 0 14px 0;color:${BRAND.primary};font-weight:bold;font-family:monospace;">#${escapeHtml(orderNumber)}</p>
        <p style="margin:0 0 6px 0;color:${BRAND.muted};font-size:12px;">الأعمال</p>
        <p style="margin:0 0 14px 0;color:${BRAND.text};font-weight:bold;">${escapeHtml(artworkLabel)}</p>
        <p style="margin:0 0 6px 0;color:${BRAND.muted};font-size:12px;">المبلغ المدفوع</p>
        <p style="margin:0;color:${BRAND.primary};font-size:18px;font-weight:bold;">${escapeHtml(order.financials?.totalAmount)} ر.س</p>
      </div>

      <p style="color:#444;line-height:1.8;">هنبعتلك تفاصيل الشحن أول ما الفنان يسلمها لشركة الشحن.</p>
      ${btn(`${FRONTEND_URL}/orders`, "تتبع طلباتي")}
    `);
    return this.sendEmail(buyer.email, subject, html);
  }

  static async sendArtistOrderNotification(artist, order) {
    const items = Array.isArray(order?.items) ? order.items : [];
    const firstTitle = items[0]?.artworkSnapshot?.title || "عمل فني";
    const artworkLabel =
      items.length > 1 ? `${firstTitle} +${items.length - 1} أخرى` : firstTitle;

    const subject = `مبروك! تم بيع "${firstTitle}"`;
    const html = baseTemplate(`
      <h2 style="margin-top:0;color:${BRAND.success};">تهانينا يا ${escapeHtml(artist.name)}! 🎉</h2>
      <p style="color:#444;line-height:1.8;">
        تم بيع عملك الفني <strong>"${escapeHtml(artworkLabel)}"</strong> بنجاح.
      </p>

      <div style="background:${BRAND.bg};border-right:4px solid ${BRAND.gold};border-radius:8px;padding:16px;margin:20px 0;">
        <p style="margin:0 0 6px 0;color:${BRAND.muted};font-size:12px;">أرباحك (بعد العمولة)</p>
        <p style="margin:0;color:${BRAND.success};font-size:20px;font-weight:bold;">${escapeHtml(order.financials?.totalArtistEarning)} ر.س</p>
      </div>

      <p style="color:#444;line-height:1.8;">
        جهّز العمل للشحن — شركة الشحن هتستلمه منك قريباً.
        الأرباح هتتاح في محفظتك بعد مهلة الاستلام.
      </p>
      ${btn(`${FRONTEND_URL}/dashboard/orders`, "إدارة طلباتي")}
    `);
    return this.sendEmail(artist.email, subject, html);
  }

  static async sendOrderShippedEmail(user, orderNumber, carrier) {
    const subject = `طلبك #${escapeHtml(orderNumber)} في الطريق إليك`;
    const html = baseTemplate(
      `
      <h2 style="margin-top:0;color:${BRAND.info};">خبر جميل يا ${escapeHtml(user.name)}!</h2>
      <p style="color:#444;line-height:1.8;">
        تم شحن طلبك <strong>#${escapeHtml(orderNumber)}</strong> عبر <strong>${escapeHtml(carrier)}</strong>.
      </p>
      <p style="color:#444;line-height:1.8;">ستصلك اللوحة خلال أيام العمل القادمة.</p>
      ${btn(`${FRONTEND_URL}/orders`, "تتبع طلباتي")}
      `,
      BRAND.info,
    );
    return this.sendEmail(user.email, subject, html);
  }

  static async sendOrderDeliveredEmail(user, orderNumber) {
    const subject = `تم توصيل طلبك #${escapeHtml(orderNumber)}`;
    const html = baseTemplate(`
      <h2 style="margin-top:0;color:${BRAND.success};">وصلت لوحتك يا ${escapeHtml(user.name)}! 🖼</h2>
      <p style="color:#444;line-height:1.8;">تم توصيل الطلب <strong>#${escapeHtml(orderNumber)}</strong> بنجاح.</p>
      <p style="color:#444;line-height:1.8;">نتمنى أن تنال إعجابك — ولا تنس مشاركتنا رأيك!</p>
      ${btn(`${FRONTEND_URL}/orders`, "تقييم الطلب")}
    `);
    return this.sendEmail(user.email, subject, html);
  }

  static async sendFundsReleasedEmail(user, amount) {
    const subject = `تم إتاحة ${escapeHtml(amount)} ر.س في محفظتك`;
    const html = baseTemplate(`
      <h2 style="margin-top:0;color:${BRAND.success};">أرباحك جاهزة يا ${escapeHtml(user.name)}!</h2>
      <p style="color:#444;line-height:1.8;">
        تم إطلاق مبلغ <strong>${escapeHtml(amount)} ر.س</strong> إلى رصيدك المتاح.
      </p>
      <p style="color:#444;line-height:1.8;">يمكنك الآن طلب سحبها إلى حسابك البنكي.</p>
      ${btn(`${FRONTEND_URL}/dashboard/wallet`, "الذهاب للمحفظة")}
    `);
    return this.sendEmail(user.email, subject, html);
  }
  static async sendOrderCancelledEmail(
    user,
    orderNumber,
    totalAmount,
    reason,
    refundInitiated,
  ) {
    // ✅ Reasons الجديدة + القديمة
    const reasons = {
      buyer_banned_before_payment: "نظراً لتعليق حسابك في المنصة",
      buyer_banned_during_checkout: "نظراً لتعليق حسابك في المنصة",
      artist_banned_before_payment:
        "نظراً لإيقاف الفنان المسؤول عن أحد الأعمال في طلبك",
      artist_banned_during_checkout:
        "نظراً لإيقاف الفنان المسؤول عن أحد الأعمال في طلبك",
      artwork_sold_to_another_buyer:
        "نظراً لأن أحد الأعمال في طلبك لم يعد متاحاً",
      admin_force_cancel: "بعد مراجعة الإدارة لحالة البائع أو المشتري",
      expired_pending_order: "لانتهاء مهلة الدفع",
      superseded_by_new_checkout: "لإنشاء طلب جديد لنفس اللوحة",
    };

    // ✅ Subject ديناميكي حسب حالة الـ refund
    const subject = refundInitiated
      ? `إلغاء الطلب #${escapeHtml(orderNumber)} واسترداد المبلغ`
      : `إلغاء الطلب #${escapeHtml(orderNumber)} — جاري معالجة الاسترداد`;

    const html = baseTemplate(
      `
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;width:64px;height:64px;background:#fff5f5;border-radius:50%;line-height:64px;font-size:32px;">⚠️</div>
    </div>

    <h2 style="margin-top:0;color:${BRAND.danger};text-align:center;">تم إلغاء طلبك</h2>

    <p style="color:#444;line-height:1.8;">
      مرحباً <strong>${escapeHtml(user.name)}</strong>،
    </p>

    <p style="color:#444;line-height:1.8;">
      ${reasons[reason] || reason || "لأسباب تشغيلية"}، تم إلغاء طلبك <strong>#${escapeHtml(orderNumber)}</strong>.
    </p>

    ${
      refundInitiated
        ? `
    <div style="background:#d1fae5;border-right:4px solid ${BRAND.success};border-radius:8px;padding:16px;margin:20px 0;">
      <p style="margin:0 0 8px 0;color:${BRAND.success};font-size:12px;font-weight:bold;">✅ تم الاسترداد:</p>
      <p style="margin:0;color:#065f46;font-size:22px;font-weight:bold;">${escapeHtml(totalAmount)} ر.س</p>
      <p style="margin:8px 0 0 0;color:#444;line-height:1.7;">
        تم إصدار الاسترداد كاملاً إلى بطاقتك. سيظهر خلال <strong>5-10 أيام عمل</strong> حسب بنكك.
      </p>
    </div>
    `
        : `
    <div style="background:#fef3c7;border-right:4px solid #f59e0b;border-radius:8px;padding:16px;margin:20px 0;">
      <p style="margin:0 0 8px 0;color:#92400e;font-size:12px;font-weight:bold;">⏳ جاري معالجة الاسترداد:</p>
      <p style="margin:0;color:#78350f;font-size:18px;font-weight:bold;">${escapeHtml(totalAmount)} ر.س</p>
      <p style="margin:8px 0 0 0;color:#444;line-height:1.7;">
        فريق الدعم يُعالج الاسترداد يدوياً وسيتم إتمامه خلال <strong>24-48 ساعة</strong>.
        سيتم إشعارك فور اكتمال العملية.
      </p>
    </div>
    `
    }

    <div style="background:${BRAND.bg};border:1px solid ${BRAND.border};border-radius:8px;padding:16px;margin:20px 0;">
      <p style="margin:0 0 6px 0;color:${BRAND.muted};font-size:12px;">رقم الطلب الملغي</p>
      <p style="margin:0;color:${BRAND.primary};font-size:18px;font-weight:bold;font-family:monospace;">#${escapeHtml(orderNumber)}</p>
    </div>

    <p style="color:#444;line-height:1.8;">
      لأي استفسار أو مساعدة، يرجى التواصل مع فريق الدعم.
    </p>

    ${btn(`${FRONTEND_URL}/contact-us`, "تواصل مع الدعم", BRAND.info)}
    `,
      BRAND.danger,
    );
    return this.sendEmail(user.email, subject, html);
  }
  static async sendShipmentReturnedEmail(artist, data) {
    const subject = data.isReturned
      ? `ارتجعت شحنة طلب #${escapeHtml(data.orderNumber)} إليك`
      : `أُلغيت شحنة طلب #${escapeHtml(data.orderNumber)}`;

    const html = baseTemplate(
      `
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;width:64px;height:64px;background:#fef3c7;border-radius:50%;line-height:64px;font-size:32px;">📦</div>
    </div>

    <h2 style="margin-top:0;color:#92400e;text-align:center;">
      ${data.isReturned ? "ارتجعت الشحنة إليك" : "أُلغيت الشحنة"}
    </h2>

    <p style="color:#444;line-height:1.8;">
      مرحباً <strong>${escapeHtml(artist.name)}</strong>،
    </p>

    <p style="color:#444;line-height:1.8;">
      ${
        data.isReturned
          ? `ارتجعت شحنة طلب <strong>#${escapeHtml(data.orderNumber)}</strong> إليك من <strong>${escapeHtml(data.carrier)}</strong>.`
          : `ألغت شركة <strong>${escapeHtml(data.carrier)}</strong> شحنة طلب <strong>#${escapeHtml(data.orderNumber)}</strong>.`
      }
    </p>

    <div style="background:#fef3c7;border-right:4px solid #f59e0b;border-radius:8px;padding:16px;margin:20px 0;">
      <p style="margin:0 0 8px 0;color:#92400e;font-size:12px;font-weight:bold;">
        تم استرداد المبلغ للمشتري تلقائياً
      </p>
      <p style="margin:0;color:#78350f;line-height:1.7;">
        ${
          data.isReturned
            ? "يرجى استلام الشحنة المرتجعة من شركة الشحن خلال 7 أيام."
            : "يرجى التواصل مع المشتري لترتيب شحن بديل أو إلغاء الطلب."
        }
      </p>
    </div>

    <div style="background:${BRAND.bg};border:1px solid ${BRAND.border};border-radius:8px;padding:16px;margin:20px 0;">
      <p style="margin:0 0 6px 0;color:${BRAND.muted};font-size:12px;">رقم الطلب</p>
      <p style="margin:0;color:${BRAND.primary};font-size:18px;font-weight:bold;font-family:monospace;">
        #${escapeHtml(data.orderNumber)}
      </p>
    </div>

    ${
      data.fundsWereReleased
        ? `
    <div style="background:#fef2f2;border-right:4px solid #ef4444;border-radius:8px;padding:16px;margin:20px 0;">
      <p style="margin:0;color:#991b1b;line-height:1.7;">
        ⚠️ تم تحويل أرباحك من هذا الطلب إلى محفظتك سابقاً. سيتم خصم المبلغ من محفظتك أو من السحب القادم.
      </p>
    </div>
    `
        : ""
    }

    <p style="color:#444;line-height:1.8;">
      لأي استفسار، يرجى التواصل مع فريق الدعم.
    </p>

    ${btn(`${FRONTEND_URL}/support`, "تواصل مع الدعم", BRAND.info)}
    `,
      "#f59e0b",
    );

    return this.sendEmail(artist.email, subject, html);
  }
  static async sendRefundCompletedEmail(user, data) {
    const subject = `✅ تم استرداد مبلغ طلبك #${escapeHtml(data.orderNumber)}`;
    const html = baseTemplate(
      `
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;width:64px;height:64px;background:#d1fae5;border-radius:50%;line-height:64px;font-size:32px;">✅</div>
    </div>

    <h2 style="margin-top:0;color:${BRAND.success};text-align:center;">تم استرداد المبلغ بنجاح</h2>

    <p style="color:#444;line-height:1.8;">
      مرحباً <strong>${escapeHtml(user.name)}</strong>،
    </p>

    <div style="background:#d1fae5;border-right:4px solid ${BRAND.success};border-radius:8px;padding:16px;margin:20px 0;">
      <p style="margin:0 0 8px 0;color:${BRAND.success};font-size:12px;font-weight:bold;">المبلغ المسترد:</p>
      <p style="margin:0;color:#065f46;font-size:22px;font-weight:bold;">${escapeHtml(data.amount)} ر.س</p>
      <p style="margin:8px 0 0 0;color:#444;line-height:1.7;">
        تم رد المبلغ كاملاً إلى بطاقتك. سيظهر خلال <strong>5-10 أيام عمل</strong>.
      </p>
    </div>

    <p style="color:#444;line-height:1.8;">
      نشكرك على صبرك، ونعتذر عن أي إزعاج.
    </p>
    `,
      BRAND.success,
    );
    return this.sendEmail(user.email, subject, html);
  }
  static async sendRefundFailedAdminEmail(admin, data) {
    const subject = `🚨 فشل استرداد ${data.amount} ر.س — تدخل يدوي مطلوب`;
    const orderNumber = data.orderIds?.[0]
      ? data.orderIds[0].slice(-6).toUpperCase()
      : "N/A";

    const html = baseTemplate(
      `
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;width:64px;height:64px;background:#fef2f2;border-radius:50%;line-height:64px;font-size:32px;">🚨</div>
    </div>

    <h2 style="margin-top:0;color:${BRAND.danger};text-align:center;">فشل الاسترداد التلقائي</h2>

    <p style="color:#444;line-height:1.8;">
      مرحباً <strong>${escapeHtml(admin.name)}</strong>،
    </p>

    <p style="color:#444;line-height:1.8;">
      فشل استرداد المبلغ بعد <strong>3 محاولات تلقائية</strong>. المطلوب تنفيذ الاسترداد <strong>يدوياً</strong> من داشبورد Moyasar في أقرب وقت.
    </p>

    <div style="background:#fef3c7;border:1px solid #fbbf24;border-radius:8px;padding:16px;margin:20px 0;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:6px 0;color:#78350f;font-weight:bold;">رقم الطلب:</td>
          <td style="padding:6px 0;color:#444;text-align:left;">#${escapeHtml(orderNumber)}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#78350f;font-weight:bold;">المبلغ:</td>
          <td style="padding:6px 0;color:#444;text-align:left;font-size:18px;font-weight:bold;">${escapeHtml(data.amount)} ر.س</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#78350f;font-weight:bold;">Payment ID:</td>
          <td style="padding:6px 0;color:#444;text-align:left;font-family:monospace;font-size:12px;" dir="ltr">${escapeHtml(data.paymentId || "—")}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#78350f;font-weight:bold;">السبب:</td>
          <td style="padding:6px 0;color:#444;text-align:left;">${escapeHtml(data.reason || "—")}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#78350f;font-weight:bold;">آخر خطأ:</td>
          <td style="padding:6px 0;color:#444;text-align:left;">${escapeHtml(data.error || "—")}</td>
        </tr>
      </table>
    </div>

    <div style="text-align:center;margin:24px 0;">
      ${btn("https://dashboard.moyasar.com", "فتح داشبورد Moyasar", BRAND.danger)}
    </div>

    <p style="color:#444;line-height:1.8;">
      بعد إتمام الاسترداد يدوياً، سيُرسل Moyasar webhook تلقائي وسيُحدّث النظام حالة الطلب.
    </p>
    `,
      BRAND.danger,
    );
    return this.sendEmail(admin.email, subject, html);
  }

  // ═══════════════════════════════════════════════════
  //* Order Hold/Unhold
  // ═══════════════════════════════════════════════════
  static async sendOrderHoldEmail(data) {
    const { artistName, orderNumber, buyerName, reason, amount } = data;
    const subject = `تنبيه: تم تجميد أموال طلبك #${orderNumber}`;

    const html = baseTemplate(
      `
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;width:64px;height:64px;background:#fef3c7;border-radius:50%;line-height:64px;font-size:32px;">❄️</div>
    </div>

    <h2 style="margin-top:0;color:${BRAND.warning};text-align:center;">تم تجميد أموال طلبك</h2>

    <p style="color:#444;line-height:1.8;">
      مرحباً <strong>${escapeHtml(artistName)}</strong>،
    </p>

    <p style="color:#444;line-height:1.8;">
      نود إبلاغك بأن أموال طلبك <strong>#${escapeHtml(orderNumber)}</strong> قد تم تجميدها مؤقتاً بواسطة فريق المنصة.
    </p>

    <div style="background:#fffbeb;border-right:4px solid ${BRAND.warning};border-radius:8px;padding:16px;margin:20px 0;">
      <p style="margin:0 0 8px 0;color:${BRAND.warning};font-size:12px;font-weight:bold;">سبب التجميد:</p>
      <p style="margin:0;color:#92400e;line-height:1.7;">${escapeHtml(reason || "بلاغ تحت المراجعة")}</p>
    </div>

    <div style="background:${BRAND.bg};border:1px solid ${BRAND.border};border-radius:8px;padding:16px;margin:20px 0;">
      <p style="margin:0 0 6px 0;color:${BRAND.muted};font-size:12px;">المبلغ المجمّد</p>
      <p style="margin:0;color:${BRAND.primary};font-size:20px;font-weight:bold;">${escapeHtml(amount)} ر.س</p>
      <p style="margin:8px 0 0 0;color:${BRAND.muted};font-size:12px;">المشتري: ${escapeHtml(buyerName || "—")}</p>
    </div>

    <p style="color:#444;line-height:1.8;">
      <strong>ماذا يعني هذا؟</strong>
    </p>
    <ul style="color:#444;line-height:2;padding-right:20px;">
      <li>الأموال لن تُطلق تلقائياً بعد مهلة الـ 72 ساعة</li>
      <li>فريق الدعم يراجع البلاغ أو المشكلة</li>
      <li>سيتم إشعارك فور فك التجميد أو اتخاذ أي إجراء</li>
    </ul>

    <p style="color:#444;line-height:1.8;">
      يمكنك التواصل معنا للاستفسار أو تقديم أي معلومات إضافية.
    </p>

    ${btn(`${FRONTEND_URL}/dashboard/orders`, "عرض الطلب", BRAND.warning)}
    ${btn(`${FRONTEND_URL}/support`, "تواصل مع الدعم", BRAND.info)}

    <p style="color:${BRAND.muted};font-size:12px;margin-top:24px;padding-top:16px;border-top:1px solid ${BRAND.border};text-align:center;">
      فريق منصة فُنون
    </p>
    `,
      BRAND.warning,
    );

    return this.sendEmail(data.artistEmail, subject, html);
  }

  static async sendOrderUnholdEmail(data) {
    const { artistName, orderNumber, buyerName, amount } = data;
    const subject = `تم فك تجميد طلبك #${orderNumber}`;

    const html = baseTemplate(
      `
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;width:64px;height:64px;background:#d1fae5;border-radius:50%;line-height:64px;font-size:32px;">✅</div>
    </div>

    <h2 style="margin-top:0;color:${BRAND.success};text-align:center;">تم فك تجميد أموال طلبك</h2>

    <p style="color:#444;line-height:1.8;">
      مرحباً <strong>${escapeHtml(artistName)}</strong>،
    </p>

    <p style="color:#444;line-height:1.8;">
      يسعدنا إبلاغك بأنه تم فك تجميد أموال طلبك <strong>#${escapeHtml(orderNumber)}</strong>.
    </p>

    <div style="background:#d1fae5;border-right:4px solid ${BRAND.success};border-radius:8px;padding:16px;margin:20px 0;">
      <p style="margin:0 0 8px 0;color:${BRAND.success};font-size:12px;font-weight:bold;">الحالة الجديدة:</p>
      <p style="margin:0;color:#065f46;line-height:1.7;">
        عاد الطلب للمسار الطبيعي — سيتم إطلاق الأموال تلقائياً بعد انتهاء مهلة الـ 72 ساعة من تاريخ التوصيل.
      </p>
    </div>

    <div style="background:${BRAND.bg};border:1px solid ${BRAND.border};border-radius:8px;padding:16px;margin:20px 0;">
      <p style="margin:0 0 6px 0;color:${BRAND.muted};font-size:12px;">المبلغ</p>
      <p style="margin:0;color:${BRAND.primary};font-size:20px;font-weight:bold;">${escapeHtml(amount)} ر.س</p>
      <p style="margin:8px 0 0 0;color:${BRAND.muted};font-size:12px;">المشتري: ${escapeHtml(buyerName || "—")}</p>
    </div>

    <p style="color:#444;line-height:1.8;">
      <strong>ماذا يحدث الآن؟</strong>
    </p>
    <ul style="color:#444;line-height:2;padding-right:20px;">
      <li>سيتم إطلاق الأموال تلقائياً بعد انتهاء المهلة</li>
      <li>ستتلقى إشعاراً فور إتاحة المبلغ في محفظتك</li>
      <li>يمكنك طلب السحب إلى حسابك البنكي</li>
    </ul>

    ${btn(`${FRONTEND_URL}/dashboard/orders`, "عرض الطلب")}
    ${btn(`${FRONTEND_URL}/dashboard/wallet`, "الذهاب للمحفظة", BRAND.gold)}
    `,
      BRAND.success,
    );

    return this.sendEmail(data.artistEmail, subject, html);
  }

  // ═══════════════════════════════════════════════════
  //* Artwork Moderation
  // ═══════════════════════════════════════════════════
  static async sendArtworkApprovedEmail(user, title) {
    const subject = `تم اعتماد لوحتك "${escapeHtml(title)}"`;
    const html = baseTemplate(`
      <h2 style="margin-top:0;color:${BRAND.success};">تهانينا يا ${escapeHtml(user.name)}! 🎉</h2>
      <p style="color:#444;line-height:1.8;">
        تم اعتماد لوحتك <strong>"${escapeHtml(title)}"</strong> وهي الآن ظاهرة لكل الزوار في المعرض.
      </p>
      ${btn(`${FRONTEND_URL}/dashboard/artworks`, "عرض لوحاتي")}
    `);
    return this.sendEmail(user.email, subject, html);
  }

  static async sendArtworkRejectedEmail(user, title, reason) {
    const subject = `تحديث بخصوص لوحتك "${escapeHtml(title)}"`;
    const html = baseTemplate(
      `
      <h2 style="margin-top:0;color:${BRAND.danger};">مرحباً ${escapeHtml(user.name)}</h2>
      <p style="color:#444;line-height:1.8;">
        بعد المراجعة، لم نتمكن من اعتماد لوحتك <strong>"${escapeHtml(title)}"</strong>.
      </p>
      ${reason ? `<div style="background:#fdecea;border:1px solid #f5c6cb;border-radius:8px;padding:14px;margin:16px 0;"><strong style="color:${BRAND.danger};">السبب:</strong> <span style="color:#842029;">${escapeHtml(reason)}</span></div>` : ""}
      <p style="color:#444;line-height:1.8;">يمكنك تعديل اللوحة وسيتم إرسالها للمراجعة تلقائياً.</p>
      ${btn(`${FRONTEND_URL}/dashboard/artworks`, "تعديل اللوحة", BRAND.info)}
      `,
      BRAND.danger,
    );
    return this.sendEmail(user.email, subject, html);
  }

  static async sendArtworkSuspendedEmail(user, title, reason) {
    const subject = `تم إيقاف عرض لوحتك "${escapeHtml(title)}"`;
    const html = baseTemplate(
      `
      <h2 style="margin-top:0;color:#ad1457;">مرحباً ${escapeHtml(user.name)}</h2>
      <p style="color:#444;line-height:1.8;">
        تم إيقاف عرض لوحتك <strong>"${escapeHtml(title)}"</strong> بواسطة فريق المنصة.
      </p>
      ${reason ? `<div style="background:#fdecea;border:1px solid #f5c6cb;border-radius:8px;padding:14px;margin:16px 0;"><strong style="color:${BRAND.danger};">السبب:</strong> <span style="color:#842029;">${escapeHtml(reason)}</span></div>` : ""}
      <p style="color:#444;line-height:1.8;">إذا كنت ترى أن هذا القرار غير صحيح، تواصل مع فريق الدعم.</p>
      ${btn(`${FRONTEND_URL}/support`, "تواصل مع الدعم", BRAND.info)}
      `,
      "#ad1457",
    );
    return this.sendEmail(user.email, subject, html);
  }

  // ═══════════════════════════════════════════════════
  //* Withdrawals
  // ═══════════════════════════════════════════════════
  static async sendWithdrawalStatusEmail(user, withdrawal) {
    const isPaid = withdrawal.status === "PAID";
    const statusLabel = isPaid ? "تم الصرف" : "مرفوض";
    const statusColor = isPaid ? BRAND.success : BRAND.danger;
    const subject = `تحديث طلب السحب — ${statusLabel}`;

    const html = baseTemplate(
      `
      <h2 style="margin-top:0;color:${statusColor};">مرحباً ${escapeHtml(user.name)}</h2>
      <p style="color:#444;line-height:1.8;">
        طلب السحب بمبلغ <strong>${escapeHtml(withdrawal.amount)} ر.س</strong> حالته الآن:
        <strong style="color:${statusColor};">${statusLabel}</strong>
      </p>

      ${
        withdrawal.rejectionReason
          ? `
        <div style="background:#fdecea;border:1px solid #f5c6cb;border-radius:8px;padding:14px;margin:16px 0;">
          <strong style="color:${BRAND.danger};">سبب الرفض:</strong>
          <span style="color:#842029;">${escapeHtml(withdrawal.rejectionReason)}</span>
        </div>
      `
          : ""
      }

      ${
        withdrawal.transferReference
          ? `
        <div style="background:${BRAND.bg};border:1px solid ${BRAND.border};border-radius:8px;padding:14px;margin:16px 0;">
          <p style="margin:0 0 6px 0;color:${BRAND.muted};font-size:12px;">رقم الحوالة</p>
          <p style="margin:0;color:${BRAND.primary};font-weight:bold;font-family:monospace;">${escapeHtml(withdrawal.transferReference)}</p>
        </div>
      `
          : ""
      }

      ${btn(`${FRONTEND_URL}/dashboard/wallet`, "الذهاب للمحفظة")}
      `,
      statusColor,
    );
    return this.sendEmail(user.email, subject, html);
  }

  static async sendWithdrawalRequestedAdminEmail(admin, artistName, amount) {
    const subject = `طلب سحب جديد: ${escapeHtml(amount)} ر.س — ${escapeHtml(artistName)}`;
    const html = baseTemplate(
      `
      <h2 style="margin-top:0;color:${BRAND.info};">طلب سحب بانتظار المراجعة</h2>
      <p style="color:#444;line-height:1.8;">
        الفنان <strong>${escapeHtml(artistName)}</strong> طلب سحب <strong>${escapeHtml(amount)} ر.س</strong>.
      </p>
      ${btn(`${FRONTEND_URL}/admin/withdrawals`, "مراجعة الطلب", BRAND.info)}
      `,
      BRAND.info,
    );
    return this.sendEmail(admin.email, subject, html);
  }

  // ═══════════════════════════════════════════════════
  //* Subscription
  // ═══════════════════════════════════════════════════
  static async sendSubscriptionActivatedEmail(user, planLabel, endDate) {
    const subject = `مبروك! تم تفعيل اشتراكك في باقة ${escapeHtml(planLabel)}`;
    const endDateStr = new Date(endDate).toLocaleDateString("ar-SA", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const html = baseTemplate(`
      <h2 style="margin-top:0;color:${BRAND.success};">مبروك يا ${escapeHtml(user.name)}! 🎉</h2>
      <p style="color:#444;line-height:1.8;">
        تم تفعيل اشتراكك بنجاح في باقة <strong style="color:${BRAND.primary};">${escapeHtml(planLabel)}</strong>
        وأصبحت الآن فناناً معتمداً في منصة فُنون.
      </p>

      <div style="background:${BRAND.bg};border-right:4px solid ${BRAND.gold};border-radius:8px;padding:18px;margin:24px 0;">
        <p style="margin:0 0 8px 0;color:${BRAND.muted};font-size:12px;">تاريخ انتهاء الاشتراك</p>
        <p style="margin:0;color:${BRAND.primary};font-size:18px;font-weight:bold;">${escapeHtml(endDateStr)}</p>
      </div>

      <p style="color:#444;line-height:1.8;">يمكنك الآن:</p>
      <ul style="color:#444;line-height:2;padding-right:20px;">
        <li>رفع لوحاتك الفنية في المعرض</li>
        <li>استقبال الطلبات من المشترين</li>
        <li>إدارة أرباحك من لوحة التحكم</li>
      </ul>

      ${btn(`${FRONTEND_URL}/dashboard`, "ابدأ من لوحة التحكم")}
      ${btn(`${FRONTEND_URL}/dashboard/artworks/new`, "ارفع أول لوحة", BRAND.gold)}
    `);
    return this.sendEmail(user.email, subject, html);
  }

  static async sendSubscriptionExpiringEmail(user, daysLeft, planLabel) {
    const subject = `اشتراكك (${escapeHtml(planLabel)}) ينتهي خلال ${escapeHtml(daysLeft)} يوم`;
    const html = baseTemplate(
      `
      <h2 style="margin-top:0;color:${BRAND.warning};">لا تفقد مميزاتك يا ${escapeHtml(user.name)}!</h2>
      <p style="color:#444;line-height:1.8;">
        اشتراكك في باقة <strong>${escapeHtml(planLabel)}</strong> سينتهي خلال <strong>${escapeHtml(daysLeft)} يوم</strong>.
      </p>
      <p style="color:#444;line-height:1.8;">جدد الآن للحفاظ على ظهور لوحاتك في المعرض.</p>
      ${btn(`${FRONTEND_URL}/subscription`, "تجديد الاشتراك", BRAND.warning)}
      `,
      BRAND.warning,
    );
    return this.sendEmail(user.email, subject, html);
  }
  static async sendSubscriptionExpiredEmail(user, planLabel) {
    const subject = `انتهى اشتراكك في ${escapeHtml(planLabel)} — جدّده الآن`;
    const html = baseTemplate(
      `
    <h2 style="margin-top:0;color:${BRAND.danger};">اشتراكك انتهى يا ${escapeHtml(user.name)}</h2>
    <p style="color:#444;line-height:1.8;">
      اشتراكك في باقة <strong>${escapeHtml(planLabel)}</strong> انتهى بالفعل.
    </p>
    <p style="color:#444;line-height:1.8;">
      للأسف، لوحاتك <strong>لم تعد ظاهرة</strong> في المعرض حتى تجدد اشتراكك.
      كما فقدت بعض المميزات مثل الشارة الموثّقة.
    </p>
    <p style="color:#444;line-height:1.8;">
      جدد الآن لإعادة تفعيل حسابك وظهور لوحاتك للمشترين مرة أخرى.
    </p>
    ${btn(`${FRONTEND_URL}/subscription`, "جدد اشتراكي الآن", BRAND.primary)}
    `,
      BRAND.danger,
    );
    return this.sendEmail(user.email, subject, html);
  }

  // ═══════════════════════════════════════════════════
  //* Support
  // ═══════════════════════════════════════════════════
  static async sendSupportAdminEmail(admin, ticket) {
    const topics = {
      ORDER: "طلب",
      PAYMENT: "دفع",
      ARTWORK: "لوحة",
      ACCOUNT: "حساب",
      PARTNERSHIP: "شراكة",
      OTHER: "عام",
    };
    const subject = `رسالة دعم جديدة: ${escapeHtml(topics[ticket.topic] || ticket.topic)} — ${escapeHtml(ticket.name)}`;
    const html = baseTemplate(`
      <h2 style="margin-top:0;color:${BRAND.text};">رسالة دعم جديدة</h2>
      <p style="color:#444;line-height:1.8;"><strong>من:</strong> ${escapeHtml(ticket.name)} — ${escapeHtml(ticket.email)}</p>
      <p style="color:#444;line-height:1.8;"><strong>الموضوع:</strong> ${escapeHtml(topics[ticket.topic] || ticket.topic)}</p>
      <div style="background:${BRAND.bg};border:1px solid ${BRAND.border};border-radius:8px;padding:14px;margin:16px 0;color:#444;line-height:1.8;">${escapeHtml(ticket.message)}</div>
      ${btn(`${FRONTEND_URL}/admin/support`, "الرد على الرسالة", BRAND.info)}
    `);
    return this.sendEmail(admin.email, subject, html);
  }

  // ═══════════════════════════════════════════════════
  //* 🔴 BAN NOTICE — إصلاح نهائي
  // ═══════════════════════════════════════════════════
  static async sendBanNotice(email, name, reason) {
    // ✅ Validation: لازم email string
    if (!email || typeof email !== "string") {
      logger.error(`❌ sendBanNotice: invalid email type: ${typeof email}`);
      return false;
    }

    const subject = "تنبيه هام: حالة حسابك في منصة فُنون";
    const html = baseTemplate(
      `
      <div style="text-align:center;margin-bottom:24px;">
        <div style="display:inline-block;width:64px;height:64px;background:#fdecea;border-radius:50%;line-height:64px;font-size:32px;">⚠️</div>
      </div>

      <h2 style="margin-top:0;color:${BRAND.danger};text-align:center;">تم حظر حسابك في منصة فُنون</h2>

      <p style="color:#444;line-height:1.8;">
        مرحباً <strong>${escapeHtml(name)}</strong>،
      </p>

      <p style="color:#444;line-height:1.8;">
        نأسف لإبلاغك بأن حسابك في منصة فُنون قد تم حظره.
      </p>

      ${
        reason
          ? `
        <div style="background:#fff5f5;border-right:4px solid ${BRAND.danger};border-radius:8px;padding:16px;margin:20px 0;">
          <p style="margin:0 0 8px 0;color:${BRAND.danger};font-size:12px;font-weight:bold;">سبب الحظر:</p>
          <p style="margin:0;color:#842029;line-height:1.7;">${escapeHtml(reason)}</p>
        </div>
      `
          : ""
      }

      <p style="color:#444;line-height:1.8;">
        <strong>ماذا يعني هذا؟</strong>
      </p>
      <ul style="color:#444;line-height:2;padding-right:20px;">
        <li>لن تتمكن من تسجيل الدخول إلى حسابك</li>
        <li>جميع أعمالك الفنية تم إخفاؤها من المعرض</li>
        <li>طلبات السحب المعلقة تم إلغاؤها</li>
      </ul>

      <p style="color:#444;line-height:1.8;">
        إذا كنت تعتقد أن هذا خطأ أو ترغب في الطعن على القرار، يرجى التواصل مع فريق الدعم خلال <strong>14 يوماً</strong>.
      </p>

      ${btn(`${FRONTEND_URL}/support`, "تواصل مع الدعم", BRAND.danger)}

      <p style="color:${BRAND.muted};font-size:12px;margin-top:24px;padding-top:16px;border-top:1px solid ${BRAND.border};text-align:center;">
        فريق منصة فُنون
      </p>
      `,
      BRAND.danger,
    );

    return this.sendEmail(email, subject, html);
  }
  static async sendUnbanEmail(email, userName, reason) {
    if (!email || typeof email !== "string") {
      logger.error(`❌ sendBanNotice: invalid email type: ${typeof email}`);
      return false;
    }
    const subject = "تم إلغاء حظر حسابك في منصة فنون";
    const html = baseTemplate(
      `
      <h2 style="margin-top:0;color:${BRAND.success};">تم إلغاء حظر حسابك</h2>
      <p style="color:#444;line-height:1.8;">
        مرحباً <strong>${escapeHtml(userName)}</strong>،
      </p>
      <p style="color:#444;line-height:1.8;">
        يسرنا إبلاغك بأنه تم إلغاء حظر حسابك في المنصة.
      </p>
      <div style="background:${BRAND.bg};border-right:4px solid ${BRAND.success};border-radius:8px;padding:16px;margin:20px 0;">
        <p style="margin:0 0 6px 0;color:${BRAND.muted};font-size:12px;">سبب إلغاء الحظر</p>
        <p style="margin:0;color:${BRAND.text};font-size:15px;">${escapeHtml(reason || "تمت مراجعة بلاغك")}</p>
      </div>
      <p style="color:#444;line-height:1.8;">
        يمكنك الآن تسجيل الدخول واستخدام المنصة بشكل طبيعي.
      </p>
      ${btn(`${FRONTEND_URL}/auth/login`, "تسجيل الدخول الآن", BRAND.primary)}
      `,
      BRAND.success,
    );
    return this.sendEmail(email, subject, html);
  }
}

module.exports = EmailService;
