export function sleep(seconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, seconds * 1000);
  });
}

// Simple, readable logger with levels and colors. Kept compatible with existing
// `log(message)` calls by defaulting to INFO level when not provided.
const COLORS = {
  reset: '\x1b[0m',
  gray: '\x1b[90m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  blue: '\x1b[34m'
};

function formatMeta(meta) {
  if (!meta) return '';
  try {
    return typeof meta === 'string' ? meta : JSON.stringify(meta, null, 2);
  } catch (e) {
    return String(meta);
  }
}

export function log(message, level = 'INFO', meta = null) {
  const ts = new Date().toISOString();
  const lvl = String(level).toUpperCase();

  let color = COLORS.gray;
  if (lvl === 'ERROR') color = COLORS.red;
  else if (lvl === 'WARN' || lvl === 'WARNING') color = COLORS.yellow;
  else if (lvl === 'INFO') color = COLORS.blue;
  else if (lvl === 'SUCCESS') color = COLORS.green;
  else if (lvl === 'DEBUG') color = COLORS.gray;

  const prefix = `${COLORS.gray}[${ts}]${COLORS.reset} ${color}[${lvl}]${COLORS.reset}`;

  if (typeof message === 'object' && message !== null) {
    // pretty-print objects
    const body = formatMeta(message);
    console.log(prefix, '\n' + body);
    if (meta) console.log(formatMeta(meta));
    return;
  }

  const metaStr = meta ? `\n${formatMeta(meta)}` : '';
  // Ensure multi-line messages are indented for readability
  const msg = String(message).split('\n').map((l, i) => (i === 0 ? l : '  ' + l)).join('\n');

  console.log(prefix, msg + metaStr);
}

export function info(message, meta = null) { return log(message, 'INFO', meta); }
export function warn(message, meta = null) { return log(message, 'WARN', meta); }
export function error(message, meta = null) { return log(message, 'ERROR', meta); }
export function debug(message, meta = null) { return log(message, 'DEBUG', meta); }


export function isSocketHangupError(err) {
  return err.code === 'ECONNRESET' || 
         err.code === 'ENOTFOUND' || 
         err.code === 'ETIMEDOUT' ||
         err.message.includes('socket hang up') ||
         err.message.includes('network') ||
         err.message.includes('connection');
}