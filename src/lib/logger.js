const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };

let currentLevel = LEVELS[process.env.LOG_LEVEL] || (process.env.NODE_ENV === 'test' ? LEVELS.silent : LEVELS.info);

function write(level, message, extra) {
  if (LEVELS[level] < currentLevel) return;
  const line = `${new Date().toISOString()} [${level}] ${message}`;
  const out = level === 'error' || level === 'warn' ? console.error : console.log;
  if (extra !== undefined) out(line, extra);
  else out(line);
}

const logger = {
  setLevel(level) {
    if (!LEVELS[level]) throw new Error(`nivel de log desconhecido: ${level}`);
    currentLevel = LEVELS[level];
  },
  debug: (message, extra) => write('debug', message, extra),
  info: (message, extra) => write('info', message, extra),
  warn: (message, extra) => write('warn', message, extra),
  error: (message, extra) => write('error', message, extra)
};

module.exports = { logger };
