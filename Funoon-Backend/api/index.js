const app = require("../src/app");
const { connectDB } = require("../src/config");

module.exports = async (req, res) => {
  try {
    // 1. ضمان الاتصال التام بالداتابيز أولاً عشان تنجح خطوة mongoose.connection.readyState === 1
    await connectDB();

    // 2. تمرير الطلب لـ Express
    return app(req, res);
  } catch (error) {
    console.error("Vercel DB Connection Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to connect to database on Vercel",
      error: error.message,
    });
  }
};
