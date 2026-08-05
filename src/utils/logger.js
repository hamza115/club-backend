const levels = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = process.env.NODE_ENV === 'production' ? 'info' : 'debug';

const shouldLog = (level) => levels[level] <= levels[currentLevel];

const timestamp = () => new Date().toISOString();

const logger = {
  error: (...args) => shouldLog('error') && console.error(`[${timestamp()}] ERROR:`, ...args),
  warn: (...args) => shouldLog('warn') && console.warn(`[${timestamp()}] WARN:`, ...args),
  info: (...args) => shouldLog('info') && console.log(`[${timestamp()}] INFO:`, ...args),
  debug: (...args) => shouldLog('debug') && console.log(`[${timestamp()}] DEBUG:`, ...args),
};

module.exports = logger;