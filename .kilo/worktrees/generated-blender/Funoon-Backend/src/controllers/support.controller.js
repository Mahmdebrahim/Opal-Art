const SupportTicket = require("../models/SupportTicket");
const ApiResponse = require("../utils/api-response");
const catchAsync = require("../utils/catch-async");
const eventEmitter = require("../events/event-emitter");
const EVENTS = require("../events/events");
const M = require("../utils/messages");

// @desc    Create support message (public + rate limited)
// @route   POST /api/v1/support
const createContactMessage = catchAsync(async (req, res) => {
  const { name, email, topic, message } = req.body;

  const ticket = await SupportTicket.create({
    user: req.user?._id || null,
    name,
    email,
    topic,
    message,
  });

  // ✅ إشعار + إيميل للأدمن عبر نظام الأحداث
  eventEmitter.safeEmit(EVENTS.SUPPORT_MESSAGE_RECEIVED, {
    ticketId: ticket._id,
    name: ticket.name,
    email: ticket.email,
    topic: ticket.topic,
  });

  return ApiResponse.created(
    res,
    ticket,
    M.admin.ticketCreated,
  );
});


const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// @desc    Admin: list tickets (مع دعم البحث برقم التذكرة)
// @route   GET /api/v1/admin/support
const getSupportTickets = catchAsync(async (req, res) => {
  const { status = "all", page = 1, limit = 20, q = "" } = req.query;

  const filter = status !== "all" ? { status } : {};

  if (q.trim()) {
    const query = escapeRegex(q.trim().replace(/^#/, "")); // نشيل الـ # ونعمل escape

    filter.$or = [
      { name: { $regex: query, $options: "i" } },
      { email: { $regex: query, $options: "i" } },
      { message: { $regex: query, $options: "i" } },
      // ✅ بحث برقم التذكرة: نحوّل الـ ObjectId لـ string الأول
      {
        $expr: {
          $regexMatch: {
            input: { $toString: "$_id" },
            regex: query,
            options: "i",
          },
        },
      },
    ];
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [tickets, total] = await Promise.all([
    SupportTicket.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    SupportTicket.countDocuments(filter),
  ]);

  return ApiResponse.success(
    res,
    {
      tickets,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
      },
    },
    M.admin.ticketsRetrieved,
  );
});

// @desc    Admin: update ticket status
// @route   PATCH /api/v1/admin/support/:id
const updateTicketStatus = catchAsync(async (req, res) => {
  const { status } = req.body;
  const ticket = await SupportTicket.findByIdAndUpdate(
    req.params.id,
    { status },
    { new: true, runValidators: true },
  );
  if (!ticket)
    throw new (require("../utils/api-error").NotFoundError)(M.admin.ticketNotFound);
  return ApiResponse.success(res, ticket, M.admin.ticketUpdated);
});

module.exports = {
  createContactMessage,
  getSupportTickets,
  updateTicketStatus,
};
