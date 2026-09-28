/**
 * Centralized Messages Dictionary (Arabic) for Funoon Platform (Funoon.sa)
 * Single Source of Truth for all user-facing messages.
 */

const messages = {
  // ═══ Auth ═══
  auth: {
    invalidCredentials: "البريد الإلكتروني أو كلمة المرور غير صحيحة",
    emailExists: "البريد الإلكتروني مسجل بالفعل",
    phoneExists: "رقم الجوال مستخدم بالفعل",
    notLoggedIn: "يرجى تسجيل الدخول أولاً للوصول إلى هذا المحتوى",
    invalidToken: "جلسة غير صالحة — يرجى تسجيل الدخول مرة أخرى",
    expiredToken: "انتهت صلاحية الجلسة — يرجى تسجيل الدخول مرة أخرى",
    userNotFound: "المستخدم غير موجود",
    accountDisabled: "هذا الحساب معطل — يرجى التواصل مع الدعم",
    accountBanned:
      "حسابك محظور من المنصة — يرجى التواصل مع الدعم إذا كنت تعتقد أن هذا خطأ",
    passwordRecentlyChanged:
      "تم تغيير كلمة المرور مؤخراً — يرجى تسجيل الدخول مجدداً",
    emailNotVerified: "يرجى تأكيد بريدك الإلكتروني أولاً",
    emailNotVerifiedWithResend:
      "يرجى تأكيد بريدك الإلكتروني أولاً — أعدنا إرسال رمز جديد",
    emailAlreadyVerified: "البريد الإلكتروني مؤكد بالفعل",
    otpSent: "تم إرسال رمز التأكيد إلى بريدك الإلكتروني",
    otpResent: "تم إعادة إرسال الرمز إلى بريدك الإلكتروني",
    otpSendFailed: "فشل إرسال بريد التأكيد — يرجى المحاولة مرة أخرى",
    otpInvalid: "رمز التأكيد غير صحيح أو منتهي الصلاحية",
    otpLocked: (mins = 15) =>
      `تم قفل التأكيد مؤقتاً لكثرة المحاولات — حاول بعد ${mins} دقيقة`,
    otpDailyLimit: "تم تجاوز الحد اليومي لرموز التأكيد — حاول غداً",
    otpResendWait: (secs) => `انتظر ${secs} ثانية قبل إعادة الإرسال`,
    passwordResetSent:
      "إذا كان البريد الإلكتروني مسجلاً لدينا، سيتم إرسال رابط الاستعادة خلال دقائق",
    passwordResetInvalid: "رابط الاستعادة غير صالح أو منتهي الصلاحية",
    passwordResetTokenRequired: "رمز استعادة كلمة المرور مطلوب",
    passwordResetSuccess: "تم إعادة تعيين كلمة المرور بنجاح",
    passwordChangeSuccess:
      "تم تغيير كلمة المرور بنجاح — يرجى تسجيل الدخول مجدداً",
    currentPasswordIncorrect: "كلمة المرور الحالية غير صحيحة",
    registered: "تم إنشاء حسابك بنجاح",
    loggedIn: "تم تسجيل الدخول بنجاح",
    loggedOut: "تم تسجيل الخروج بنجاح",
    tokenRefreshed: "تم تحديث الجلسة بنجاح",
    noRefreshToken: "لا يوجد رمز تحديث للجلسة",
    emailVerifiedSuccess: "تم تأكيد بريدك الإلكتروني بنجاح",
    verificationStatusFetched: "تم جلب حالة التحقق من البريد",
    currentUserFetched: "تم جلب بيانات المستخدم الحالي بنجاح",
    accountDeleted: "تم حذف الحساب بنجاح",
    otpResendGeneric: "إذا كان الحساب موجوداً، سيتم إرسال رمز جديد",
    emailSendFailed: "فشل إرسال البريد — يرجى المحاولة لاحقاً",
    sessionExpired: "جلسة منتهية — يرجى تسجيل الدخول مرة أخرى",
  },

  // ═══ Artworks ═══
  artworks: {
    notFound: "اللوحة غير موجودة",
    created:
      "تم استلام لوحتك بنجاح وهي الآن قيد المراجعة من فريق المنصة. سيتم إشعارك فور الموافقة عليها.",
    updated: "تم تحديث اللوحة بنجاح",
    updatedNeedsReview:
      "تم تحديث اللوحة بنجاح. التعديلات الجوهرية تتطلب مراجعة جديدة من فريق المنصة.",
    deleted: "تم حذف اللوحة الفنية بنجاح",
    deletedHasOrdersAdmin:
      "تم إيقاف اللوحة — لا يمكن حذف لوحة لها طلبات مرتبطة",
    cannotDeleteSold:
      "لا يمكن حذف لوحة مباعة للحفاظ على سجل طلباتك. يمكنك إخفاؤها من البروفايل بدلاً من ذلك.",
    notOwner: "غير مصرح لك بتعديل أو حذف هذه اللوحة الفنية",
    alreadySold: "هذه اللوحة مباعة بالفعل",
    notApproved: "لا يمكنك تفعيل/إيقاف هذه اللوحة في حالتها الحالية",
    mustHaveImage: "يجب رفع صورة واحدة على الأقل للوحة الفنية",
    dimensionsRequired: "أبعاد اللوحة (العرض والارتفاع) مطلوبة",
    dimensionsExceeded: (maxDim, planLimit) =>
      `أبعاد اللوحة (${maxDim} سم) تتجاوز الحد الأقصى لباقتك (${planLimit} سم).`,
    planLimitReached: (maxArtworks, planName) =>
      `لقد وصلت للحد الأقصى (${maxArtworks}) من اللوحات في باقتك (${planName}).`,
    subscriptionRequired: "يجب أن يكون لديك اشتراك نشط لنشر اللوحات.",
    bannedNoPublish: "حسابك محظور — النشر غير متاح",
    bannedNoEdit: "حسابك محظور — التعديل غير متاح",
    bannedNoDelete: "حسابك محظور — الحذف غير متاح",
    featureNotPrestige:
      "ميزة التمييز متاحة فقط للفنانين المشتركين في باقة Opal Prestige النشطة. قم بترقية اشتراكك من صفحة الاشتراكات للاستفادة من هذه الميزة.",
    featureNotOwner: "لا يحق لك تمييز لوحة لا تملكها",
    featureOnlyApproved: "يمكن تمييز اللوحات المعتمدة فقط",
    featureOnlyActive: "يمكن تمييز اللوحات النشطة فقط",
    featureCannotSold: "لا يمكن تمييز لوحة مباعة",
    featuredSuccess: (prevTitle) =>
      prevTitle
        ? `تم تمييز اللوحة بنجاح. تم إلغاء تمييز لوحتك السابقة "${prevTitle}" تلقائياً.`
        : "تم تمييز اللوحة بنجاح ✨",
    unfeaturedSuccess: "تم إلغاء تمييز اللوحة بنجاح",
    unfeatureNotOwner: "لا يحق لك إلغاء تمييز هذه اللوحة",
    featuredList: "اللوحات المميزة",
    platformStats: "إحصائيات المنصة",
    activated: "تم تفعيل اللوحة",
    deactivated: "تم إيقاف اللوحة",
    pendingApprovalMsg: "لوحتك قيد المراجعة من فريق المنصة. يرجى الانتظار.",
    rejectedMsg: (reason) =>
      `تم رفض اللوحة. ${reason ? `السبب: ${reason}` : ""}`,
    suspendedMsg: (reason) =>
      `تم إيقاف اللوحة بواسطة فريق المنصة. ${reason ? `السبب: ${reason}` : ""}`,
    retrieved: "تم جلب بيانات اللوحة بنجاح",
    listRetrieved: "تم جلب اللوحات بنجاح",
    myArtworksRetrieved: "تم جلب لوحاتي بنجاح",
    filterOptionsRetrieved: "تم جلب خيارات التصفية بنجاح",
  },

  // ═══ Orders & Cart ═══
  orders: {
    cartEmpty: "سلة المشتريات فارغة",
    cartEmptyCleaned: "سلة المشتريات فارغة بعد إزالة العناصر غير المتوفرة",
    cartMaxItems: "لا يمكن أن تتجاوز السلة 10 عناصر",
    cartItemAdded: "تم إضافة اللوحة إلى السلة بنجاح",
    cartItemRemoved: "تم حذف اللوحة من السلة بنجاح",
    cartCleared: "تم تفريغ السلة بنجاح",
    cartRetrieved: "تم جلب السلة بنجاح",
    cartAlreadyIn: "اللوحة موجودة بالفعل في سلتك",
    cannotBuyOwnArtwork: "لا يمكنك إضافة لوحتك الفنية إلى السلة",
    artworkNoLongerAvailable: (title) =>
      `اللوحة "${title || "المحددة"}" لم تعد متاحة للشراء`,
    artistNoSubscription: (artistName) =>
      `الفنان "${artistName || ""}" ليس لديه اشتراك نشط حالياً`,
    artistBannedInCart: "أحد الأعمال في سلتك لفنان محظور ولم يعد متاحاً للشراء",
    artworkReservedAnotherBuyer:
      "للأسف، إحدى اللوحات في سلتك تم حجزها لمشترٍ آخر للتو. يرجى المحاولة مرة أخرى أو اختيار لوحة أخرى.",
    notFound: "الطلب غير موجود",
    notOwner: "غير مصرح لك بالوصول إلى هذا الطلب",
    created: "تم إنشاء الطلب بنجاح",
    checkoutSuccess: "تم بدء عملية الدفع بنجاح",
    retrieved: "تم جلب تفاصيل الطلب بنجاح",
    myOrdersRetrieved: "تم جلب طلباتي بنجاح",
    mySalesRetrieved: "تم جلب مبيعاتي بنجاح",
    cancelled: "تم إلغاء الطلب بنجاح",
    cancelNotAllowed: (status) =>
      `لا يمكن إلغاء الطلب في حالته الحالية (${status})`,
    cancelShippedDisallowed:
      "الشحنة خرجت بالفعل مع المندوب ولا يمكن إلغاؤها الآن. تواصل مع الدعم للمساعدة.",
    cancelOtoFailed:
      "تعذر إلغاء الشحنة لدى شركة الشحن حالياً، حاول مرة أخرى أو تواصل مع الدعم.",
    cancelRefundSuccess:
      "تم إلغاء الطلب وبدء عملية استرداد المبلغ. سيصلك المبلغ خلال 3-14 يوم عمل.",
    cancelRefundManualNotice:
      "تم إلغاء الطلب. تعذر إتمام الاسترداد التلقائي — يرجى التواصل مع الدعم.",
    confirmDeliverySuccess:
      "تم تأكيد الاستلام بنجاح. سيتم تحويل الأموال للفنان.",
    confirmDeliveryOnlyDelivered: (status) =>
      `لا يمكن تأكيد الاستلام قبل وصول الطلب (الحالة الحالية: ${status})`,
    alreadyCompleted: "الطلب مكتمل بالفعل",
    orderOnHoldNotice:
      "هذا الطلب قيد مراجعة الدعم حالياً ولا يمكن تأكيد الاستلام. يرجى التواصل مع خدمة العملاء.",
    manualStatusUpdated: (status) => `تم تحديث حالة الطلب يدوياً إلى ${status}`,
    paidAlreadyProcessed: "تمت معالجة الطلب مسبقاً",
    markedProcessing: "تم تحديث حالة الطلب إلى قيد المعالجة",
    notAuthorizedToProcess: "غير مصرح لك بمعالجة هذا الطلب",
    confirmOwnOrdersOnly: "يمكنك تأكيد طلباتك فقط",
    cancelOwnOrdersOnly: "يمكنك إلغاء طلباتك فقط",
    notAuthorizedToView: "غير مصرح لك بعرض هذا الطلب",
    notFoundDuringUpdate: "الطلب غير موجود أثناء التحديث",
    cannotProcessStatus: (status) => `لا يمكن معالجة طلب حالته: ${status}`,
    artworkReservedOrUnavailable: (title) =>
      `للأسف، لوحة "${title || "فنية"}" محجوزة لمشترٍ آخر جرب بعد دقائق - أو لم تعد متاحة.`,
    adminStatusUpdateOnly:
      "هذه العملية متاحة لفريق المنصة فقط. تحديث الحالة يتم تلقائياً عبر شركة الشحن.",
    statusNotAllowed: (allowed) =>
      `حالة غير مسموحة. المسموح يدوياً: ${allowed}`,
    statusTransitionInvalid: (from, to, flow) =>
      `لا يمكن تحويل من ${from} إلى ${to}. التدفق المنطقي: ${flow} → ${to}`,
    confirmDeliverySuccessExtended:
      "تم تأكيد الاستلام بنجاح. سيتم تحويل الأموال للفنان خلال دقائق.",
    cancelOtoRejected: "رفضت شركة الشحن إلغاء الشحنة",
    cancelledSuccess: "تم إلغاء الطلب بنجاح",
    cartNotFound: "السلة غير موجودة",
    accountBanned: "حسابك محظور",
  },

  // ═══ Wallet & Withdrawals ═══
  wallet: {
    notFound: "المحفظة غير موجودة",
    noWalletFound: "لا توجد محفظة لهذا المستخدم",
    retrieved: "تم جلب بيانات المحفظة بنجاح",
    transactionsRetrieved: "تم جلب سجل العمليات بنجاح",
    insufficientBalance: "الرصيد المتاح غير كافٍ لهذا السحب",
    insufficientPendingToRelease: "الرصيد المعلق غير كافٍ للإطلاق",
    insufficientPendingForRefund: "الرصيد المعلق غير كافٍ للاسترداد",
    invalidAmount: "المبلغ المدخل غير صالح",
    minWithdrawal: (amount = 50) => `الحد الأدنى للسحب هو ${amount} ر.س`,
    maxWithdrawal: (amount = 20000) =>
      `الحد الأقصى للسحب في الطلب الواحد ${amount} ر.س`,
    maxWithdrawalsWeekly: (count = 2) =>
      `تم الوصول للحد الأقصى (${count}) من طلبات السحب خلال 7 أيام — حاول لاحقاً.`,
    activeWithdrawalExists:
      "لديك طلب سحب قيد المعالجة بالفعل — انتظر الانتهاء منه قبل طلب جديد.",
    bankAccountRequired:
      "يرجى إضافة بيانات حسابك البنكي أولاً من صفحة الملف الشخصي",
    bankAccountPendingVerification:
      "حسابك البنكي قيد المراجعة. سيتم إخطارك عند التوثيق.",
    withdrawalCreated:
      "تم إرسال طلب السحب بنجاح — سيتم مراجعته خلال 3-5 أيام عمل",
    withdrawalsRetrieved: "تم جلب طلبات السحب بنجاح",
    bannedNoWithdraw: "حسابك محظور — السحب غير متاح",
    bankAccountSaved:
      "تم حفظ بيانات الحساب البنكي بنجاح. بانتظار توثيق الإدارة.",
    bankAccountRetrieved: "تم جلب بيانات الحساب البنكي بنجاح",
    bankAccountNotFound:
      "لا توجد بيانات حساب بنكي. يرجى إضافة حسابك البنكي أولاً.",
    bankFieldsRequired: "اسم صاحب الحساب والآيبان واسم البنك مطلوبة",
  },

  // ═══ Subscriptions ═══
  subscriptions: {
    planNotFound: "الباقة المحددة غير صحيحة",
    alreadyActive: (days) => `لديك اشتراك نشط بالفعل متبقٍ به ${days} يوماً`,
    activated: "تم تفعيل الاشتراك بنجاح",
    invoiceCreated: "تم إنشاء فاتورة الاشتراك بنجاح",
    paymentInitFailed: "تعذّر بدء عملية الدفع. حاول مرة أخرى.",
    retrieved: "تم جلب تفاصيل الاشتراك بنجاح",
    paymentsRetrieved: "تم جلب سجل مدفوعات الاشتراك بنجاح",
    existingPaymentFound: "يوجد طلب دفع سابق قيد الانتظار",
  },

  // ═══ Reviews ═══
  reviews: {
    created: "تم إضافة تقييمك بنجاح",
    updated: "تم تعديل التقييم بنجاح",
    retrieved: "تم جلب التقييمات بنجاح",
    myReviewsRetrieved: "تم جلب تقييماتك بنجاح",
    recentRetrieved: "التقييمات الأخيرة",
    notFound: "التقييم غير موجود",
    notOwner: "غير مصرح لك بتعديل هذا التقييم",
    orderNotFound: "الطلب غير موجود",
    orderNotCompleted: "التقييم متاح فقط للطلبات المكتملة",
    windowExpired: "انتهت مهلة التقييم (30 يوماً من تاريخ إكمال الطلب)",
    editWindowExpired: "انتهت مهلة تعديل التقييم (7 أيام من تاريخ الإنشاء)",
    alreadyReviewed: "لقد قمت بتقييم هذا الطلب من قبل",
    notBuyerOfOrder: "غير مصرح لك بتقديم تقييم لهذا الطلب",
    orderIdRequired: "رقم الطلب مطلوب",
    artistIdInvalid: "معرف الفنان غير صحيح",
    ratingRange: "التقييم يجب أن يكون بين 1 و 5 نجوم",
    commentMinLength: "التعليق يجب أن يكون 3 حروف على الأقل عند كتابته",
    commentMaxLength: "التعليق لا يمكن أن يتجاوز 500 حرف",
    hidden: "تم إخفاء التقييم بنجاح",
    unhidden: "تم إظهار التقييم بنجاح",
    hideReasonRequired: "سبب الإخفاء إجباري",
    hideReasonMinLength: "سبب الإخفاء يجب أن يكون 10 حروف على الأقل",
  },

  // ═══ Shipping ═══
  shipping: {
    notFound: "الشحنة أو الطلب غير موجود",
    calculated: "تم حساب تكلفة الشحن بنجاح",
    created: "تم إنشاء الشحنة بنجاح",
    otoOrderCreated: "تم إنشاء طلب الشحن بنجاح — يمكنك الآن إنشاء الشحنة",
    alreadyCreated: "تم إنشاء شحنة لهذا الطلب مسبقاً. استخدم رابط التتبع.",
    notAuthorizedToShip: "غير مصرح لك بشحن هذا الطلب",
    notAuthorizedToTrack: "غير مصرح لك بتتبع هذه الشحنة",
    notAuthorizedToAWB: "غير مصرح لك بالوصول إلى بوليصة الشحن",
    notPaidStatus: (status) => `لا يمكن إنشاء شحنة لطلب حالته: ${status}`,
    cannotProcessStatus: (status) => `لا يمكن معالجة شحنة طلب حالته: ${status}`,
    noDeliveryOption:
      "لا توجد خيارات شحن محددة لهذا الطلب. يرجى التواصل مع الدعم.",
    missingAddressInfo:
      "بيانات العنوان غير مكتملة في الطلب. يرجى التواصل مع الدعم.",
    awbRetrieved: "تم جلب رابط بوليصة الشحن بنجاح",
    awbNotAvailableYet: "بوليصة الشحن غير جاهزة بعد. يرجى المحاولة بعد قليل.",
    otoCreateFailed: "تعذّر إنشاء الشحنة لدى شركة الشحن",
    trackingRetrieved: "تم جلب بيانات تتبع الشحنة بنجاح",
    noShipmentFound: "لم يتم إنشاء شحنة بعد لهذا الطلب",
    shortAddressRequired: "الرمز القصير للعنوان الوطني مطلوب",
    shortAddressInvalid: "صيغة الرمز القصير غير صحيحة (مثال: RGUC8214)",
    addressNotFound: "لم يتم العثور على العنوان. تأكد من الرمز وحاول مرة أخرى.",
    addressLookupUnavailable:
      "خدمة البحث عن العناوين غير متاحة حالياً. حاول لاحقاً.",
    addressSaved: "تم التحقق من العنوان وحفظه بنجاح",
  },

  // ═══ Admin ═══
  admin: {
    noPermission: "ليس لديك صلاحية لتنفيذ هذا الإجراء",
    withdrawalsRetrieved: "تم جلب طلبات السحب بنجاح",
    withdrawalNotFound: "طلب السحب غير موجود",
    withdrawalApproved: "تمت الموافقة على طلب السحب. يرجى التحويل يدوياً.",
    withdrawalMarkedPaid: "تم تحديد طلب السحب كمكتمل ومحوّل بنجاح",
    withdrawalRejected: "تم رفض طلب السحب وإعادة المبلغ للمحفظة",
    withdrawalCannotApprove: (status) =>
      `لا يمكن اعتماد طلب سحب حالته: ${status}`,
    withdrawalMustBeApprovedFirst:
      "يجب الموافقة على طلب السحب أولاً قبل تعيينه كمدفوع",
    withdrawalCanOnlyRejectPending: "يمكن رفض طلبات السحب المعلقة فقط",
    transferReferenceRequired: "رقم الحوالة البنكية مطلوب",
    rejectionReasonRequired: "سبب الرفض مطلوب",
    withdrawalsSummaryRetrieved: "تم جلب ملخص طلبات السحب بنجاح",
    ordersRetrieved: "تم جلب الطلبات للإدارة بنجاح",
    orderHoldSuccess: "تم تجميد الطلب — لن يُطلق تلقائياً",
    orderAlreadyHeld: "الطلب مجمّد بالفعل",
    orderFundsAlreadyReleased: "الأموال أُطلقت بالفعل، لا يمكن تجميدها",
    orderHoldOnlyDelivered: (status) =>
      `لا يمكن تجميد الطلب في حالته الحالية (${status}). التجميد متاح فقط بعد التوصيل وقبل الإطلاق.`,
    orderUnholdSuccess:
      "تم فك التجميد — سيستأنف مسار الإطلاق الطبيعي (72 ساعة بعد التوصيل)",
    orderNotHeld: "الطلب غير مجمّد",
    orderReleaseFundsSuccess: "تم إطلاق الأموال بنجاح",
    orderReleaseOnlyDelivered: (status) =>
      `لا يمكن إطلاق أموال طلب حالته ${status}. يجب أن يكون الطلب مُوصَّلاً أولاً.`,
    userBanned: "تم حظر المستخدم بنجاح",
    userUnbanned: "تم رفع الحظر عن المستخدم بنجاح",
    ticketsRetrieved: "تم جلب تذاكر الدعم بنجاح",
    ticketUpdated: "تم تحديث التذكرة بنجاح",
    ticketNotFound: "التذكرة غير موجودة",
    ticketCreated: "تم استلام رسالتك بنجاح — سنرد عليك خلال 24 ساعة عمل.",
    pendingBankAccountsRetrieved: "تم جلب الحسابات البنكية المعلقة",
    bankAccountVerified: "تم توثيق الحساب البنكي",
    bankAccountRejected: "تم رفض الحساب البنكي",
    bankAccountNotFound: "الحساب البنكي غير موجود",
    banReasonRequired: "سبب الحظر مطلوب",
    cannotBanAdmin: "لا يمكن حظر مدير",
    userAlreadyBanned: "المستخدم محظور بالفعل",
    userNotBanned: "المستخدم غير محظور",
    walletNotFoundForUser: "لا توجد محفظة لهذا المستخدم",
    artworkAlreadyApproved: "اللوحة معتمدة ومفعلة بالفعل",
    rejectReasonRequired: "سبب الرفض مطلوب",
    suspendReasonRequired: "سبب الإيقاف مطلوب",
    artworkApproved: "تم اعتماد اللوحة ونشرها",
    artworkRejected: "تم رفض اللوحة",
    artworkSuspended: "تم إيقاف اللوحة",
    artworkNotSuspended: "اللوحة ليست موقوفة",
    artworkReactivated: "تم إعادة تفعيل اللوحة",
    artworkDeletedPermanently: "تم حذف اللوحة نهائياً",
    fundsAlreadyReleasedShort: "الأموال أُطلقت بالفعل",
    usersRetrieved: "تم جلب المستخدمين بنجاح",
    pendingArtworksRetrieved: "تم جلب اللوحات المعلقة بنجاح",
    cannotSuspendStatus: (status) =>
      `لا يمكن إيقاف لوحة حالتها: ${status}. استخدم الرفض أو الإيقاف المؤقت.`,
  },

  // ═══ User & Profile ═══
  user: {
    notFound: "المستخدم غير موجود",
    profileRetrieved: "تم جلب بيانات الملف الشخصي بنجاح",
    profileUpdated: "تم تحديث الملف الشخصي بنجاح",
    avatarUploaded: "تم رفع الصورة الشخصية بنجاح",
    avatarRequired: "يرجى تزويد ملف صورة صالح للصورة الشخصية",
    publicProfileRetrieved: "تم جلب الملف الشخصي العام بنجاح",
    onlyArtistsBankDetails: "تحديث بيانات الحساب البنكي متاح للفنانين فقط",
    bankDetailsUpdated: "تم تحديث بيانات الحساب البنكي بنجاح",
    coverImageOnlyArtists: "صورة الغلاف متاحة للفنانين فقط.",
    coverImageOnlyPlusPrestige:
      "صورة الغلاف متاحة فقط في باقتي أوبال بلس وأوبال برستيج.",
    socialLinksOnlyPlusPrestige:
      "الروابط الاجتماعية متاحة فقط في باقتي أوبال بلس وأوبال برستيج.",
    coverImageRequired: "يرجى رفع صورة للغلاف.",
    coverImageUploaded: "تم رفع صورة الغلاف بنجاح",
    coverImageDeleted: "تم حذف صورة الغلاف بنجاح",
    noCoverImageToDelete: "لا توجد صورة غلاف لحذفها.",
    addressRequired:
      "يرجى تعبئة حقل واحد على الأقل من بيانات العنوان (الشارع، المدينة، أو الحي)",
    addressUpdated: "تم تحديث العنوان بنجاح",
    addressRetrieved: "تم جلب العنوان بنجاح",
    noAddressFound: "لا يوجد عنوان مسجل. يرجى إضافة عنوانك.",
    analyticsOnlyPlusPrestige:
      "الإحصائيات التفصيلية متاحة فقط في باقتي أوبال بلس وأوبال برستيج. يرجى ترقية اشتراكك.",
    profileViewsRetrieved: "تم جلب إحصائيات مشاهدات الملف الشخصي بنجاح",
    artistsRetrieved: "تم جلب قائمة الفنانين بنجاح",
    artistNotFound: "الفنان غير موجود",
    dashboardStatsRetrieved: "تم جلب إحصائيات لوحة التحكم بنجاح",
    artistOrdersRetrieved: "تم جلب طلبات الفنان بنجاح",
    artworksAnalyticsRetrieved: "تم جلب تحليلات الأعمال الفنية بنجاح",
    profileNotFound: "الملف الشخصي غير موجود",
    passwordIncorrect: "كلمة المرور غير صحيحة",
    shortAddressFormatInvalid: "صيغة الرمز القصير غير صحيحة (مثال: RGUC8214)",
    noArtworksYet: "لا توجد لوحات بعد",
    artistProfileRetrieved: "تم جلب ملف الفنان بنجاح",
  },

  // ═══ Favorites ═══
  favorites: {
    added: "تمت الإضافة للمفضلة",
    removed: "تمت الإزالة من المفضلة",
    retrieved: "تم جلب المفضلة بنجاح",
    statusChecked: "تم التحقق من حالة المفضلة",
  },

  // ═══ Notifications ═══
  notifications: {
    retrieved: "تم جلب الإشعارات بنجاح",
    unreadCount: "عدد الإشعارات غير المقروءة",
    notFound: "الإشعار غير موجود",
    markedAsRead: "تم تحديد الإشعار كمقروء",
    markedAllAsRead: (count) => `تم تحديد ${count} إشعاراً كمقروء`,
  },

  // ═══ Upload ═══
  upload: {
    noFile: "لم يتم تقديم ملف",
    mustBeImage: "يجب أن يكون الملف صورة",
    noFiles: "لم يتم تقديم ملفات",
    maxImages: (max = 10) => `الحد الأقصى ${max} صور`,
    avatarFailed: "فشل رفع الصورة الشخصية",
    artworkImageFailed: "فشل رفع صورة اللوحة",
    artworkImagesFailed: "فشل رفع صور اللوحة",
    coverImageFailed: "فشل رفع صورة الغلاف",
  },

  // ═══ Validation (express-validator & Schema) ═══
  validation: {
    nameRequired: "الاسم مطلوب",
    nameNotEmpty: "الاسم لا يمكن أن يكون فارغاً",
    nameTooLong: (max = 50) => `الاسم لا يمكن أن يتجاوز ${max} حرفاً`,
    emailRequired: "البريد الإلكتروني مطلوب",
    emailInvalid: "يرجى إدخال بريد إلكتروني صحيح",
    passwordRequired: "كلمة المرور مطلوبة",
    passwordMinLength: (min = 8) =>
      `كلمة المرور يجب أن تكون ${min} أحرف على الأقل`,
    passwordComplexity: "كلمة المرور يجب أن تحتوي على حرف كبير وصغير ورقم",
    passwordMustBeDifferent:
      "كلمة المرور الجديدة يجب أن تكون مختلفة عن الحالية",
    phoneInvalid: "يرجى إدخال رقم هاتف صحيح (7 إلى 15 رقماً)",
    roleInvalid: 'الدور يجب أن يكون إما "buyer" أو "artist"',
    termsRequired: "يجب الموافقة على الشروط والأحكام",
    userIdRequired: "معرّف المستخدم مطلوب",
    userIdInvalid: "معرّف المستخدم غير صحيح",
    otpRequired: "رمز التأكيد مطلوب",
    otpDigits: "رمز التأكيد يجب أن يتكون من 6 أرقام",
    titleRequired: "عنوان اللوحة مطلوب",
    titleTooLong: (max = 100) => `عنوان اللوحة لا يمكن أن يتجاوز ${max} حرفاً`,
    descriptionRequired: "وصف اللوحة مطلوب",
    descriptionTooLong: (max = 2000) =>
      `وصف اللوحة لا يمكن أن يتجاوز ${max} حرفاً`,
    priceRequired: "السعر مطلوب",
    priceRange:
      "سعر اللوحة يجب أن يكون بين 1 و 5,000 ر.س (حد أقصى مؤقت للمرحلة الحالية)",
    weightRequired: "الوزن مطلوب",
    weightMin: "الوزن يجب أن يكون 0.1 كجم على الأقل",
    dimensionsRequired: "أبعاد اللوحة مطلوبة",
    dimensionsInvalidFormat: "صيغة أبعاد اللوحة غير صحيحة",
    widthInvalid: "العرض مطلوب ويجب أن يكون أكبر من الصفر",
    heightInvalid: "الارتفاع مطلوب ويجب أن يكون أكبر من الصفر",
    depthInvalid: "العمق لا يمكن أن يكون سالباً",
    categoryInvalid: "تصنيف غير صحيح",
    categoryRequired: "تصنيف مطلوب",
    paintTypeInvalid: "نوع الألوان غير صحيح",
    paintTypeRequired: "نوع الألوان مطلوب",
    canvasThicknessInvalid: "سماكة قماش الكانفاس غير صحيحة",
    canvasThicknessRequired: "سماكة قماش مطلوب ",
    dimensionTypeInvalid: "نوع أبعاد اللوحة غير صحيح",
    dimensionTypeRequired: "نوع أبعاد اللوحة مطلوب",
    mediumTooLong: (max = 100) => `الوسيط لا يمكن أن يتجاوز ${max} حرفاً`,
    tagsInvalidArray: "الوسوم يجب أن تكون في مصفوفة صالحة",
    bioTooLong: (max = 500) =>
      `النبذة التعريفية لا يمكن أن تتجاوز ${max} حرفاً`,
    ibanRequired: "الآيبان مطلوب",
    ibanInvalid:
      "صيغة الآيبان السعودي غير صحيحة (يجب أن يبدأ بـ SA ويليه 22 رقماً)",
    bankNameRequired: "اسم البنك مطلوب",
    bankNameLength: "اسم البنك يجب أن يكون بين 2 و 100 حرف",
    accountHolderRequired: "اسم صاحب الحساب مطلوب",
    accountHolderLength: "اسم صاحب الحساب يجب أن يكون بين 3 و 100 حرف",
    amountRequired: "المبلغ مطلوب",
    withdrawalMinAmount: "الحد الأدنى للسحب هو 50 ر.س",
    withdrawalMaxAmount: "الحد الأقصى للسحب هو 100,000 ر.س",
    planIdRequired: "معرف الباقة مطلوب",
    planIdInvalid: "الباقة المختارة غير صحيحة",
    shippingAddressRequired: "عنوان الشحن مطلوب",
    streetRequired: "اسم الشارع مطلوب",
    cityRequired: "المدينة مطلوبة",
    districtRequired: "الحي مطلوب",
    zipCodeRequired: "الرمز البريدي مطلوب",
    artworkIdRequired: "معرف اللوحة مطلوب",
    artworkIdInvalid: "معرف اللوحة غير صحيح",
    transferRefRequired: "رقم الحوالة مطلوب",
    transferRefLength: "رقم الحوالة يجب أن يكون بين 5 و 100 حرف",
    reasonRequired: "سبب الرفض أو الإلغاء مطلوب",
    reasonLength: "السبب يجب أن يكون بين 5 و 500 حرف",
    ratingRequired: "التقييم مطلوب",
    ratingMin: "التقييم يجب أن يكون 1 على الأقل",
    ratingMax: "التقييم لا يمكن أن يتجاوز 5",
    reviewerRequired: "المقيّم مطلوب",
    reviewedArtistRequired: "الفنان المقيَّم مطلوب",
    orderRequired: "الطلب مطلوب",
    commentMinChars: "التعليق يجب أن يكون 3 حروف على الأقل عند كتابته",
    commentMaxChars: "التعليق لا يمكن أن يتجاوز 500 حرف",
    orderMustHaveItems: "يجب أن يحتوي الطلب على عنصر واحد على الأقل",
    cancellationReasonTooLong: "سبب الإلغاء طويل جداً",
    onlyImageAllowed: "يسمح فقط برفع ملفات الصور",
  },

  // ═══ General ═══
  general: {
    validationFailed: "بيانات غير صالحة — يرجى مراجعة الحقول المدخلة",
    serverError: "حدث خطأ غير متوقع في الخادم — يرجى المحاولة لاحقاً",
    notFound: "العنصر المطلوب غير موجود",
    rateLimited: "تم تجاوز الحد المسموح من المحاولات — يرجى المحاولة لاحقاً",
    fileTooLarge: "حجم الملف كبير جداً",
    invalidFileType: "نوع الملف غير مدعوم — يرجى رفع صورة فقط",
    forbidden: "ليس لديك الصلاحية لإجراء هذه العملية",
    unauthorized: "غير مصرح — يرجى تسجيل الدخول أولاً",
    success: "تمت العملية بنجاح",
  },
};

module.exports = messages;
