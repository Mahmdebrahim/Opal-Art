const { EventEmitter } = require("events");
const logger = require("../utils/logger");

class AppEventEmitter extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50);

    //! Logging كل event (في dev فقط)
    if (process.env.NODE_ENV === "development") {
      this.onAny?.((event, ...args) => {
        logger.debug(`[Event] ${event}`, args[0]);
      });

      const originalEmit = this.emit.bind(this);
      this.emit = (event, ...args) => {
        logger.debug(`[Event] ${event}`);
        return originalEmit(event, ...args);
      };
    }
  }

  safeEmit(event, payload) {
    try {
      this.emit(event, payload);
    } catch (error) {
      logger.error(`[Event] Error emitting ${event}:`, error);
    }
  }
}

module.exports = new AppEventEmitter();
