/**
 * UI utilities for Vento CLI
 * Colors, spinners, tables, formatting
 */

const chalk = require('chalk');
const Table = require('cli-table3');
const ora = require('ora');

// Theme colors
const theme = {
  primary: chalk.cyan,
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  muted: chalk.gray,
  highlight: chalk.bold.white,
  agent: chalk.magenta,
  tool: chalk.blue,
  value: chalk.yellow
};

// Emojis
const emoji = {
  agent: '🤖',
  tool: '🔧',
  value: '📊',
  chat: '💬',
  success: '✨',
  error: '❌',
  warning: '⚠️',
  loading: '⏳',
  rocket: '🚀',
  sparkle: '✨',
  check: '✓',
  arrow: '→',
  bullet: '•'
};

/**
 * Print header
 */
function header(text, icon = emoji.rocket) {
  console.log();
  console.log(theme.primary(`${icon} ${text}`));
  console.log(theme.muted('─'.repeat(40)));
}

/**
 * Print success message
 */
function success(text) {
  console.log(theme.success(`${emoji.success} ${text}`));
}

/**
 * Print error message
 */
function error(text) {
  console.log(theme.error(`${emoji.error} ${text}`));
}

/**
 * Print warning message
 */
function warning(text) {
  console.log(theme.warning(`${emoji.warning} ${text}`));
}

/**
 * Print info message
 */
function info(text) {
  console.log(theme.muted(`${emoji.bullet} ${text}`));
}

/**
 * Create a spinner
 */
function spinner(text) {
  return ora({
    text,
    color: 'cyan'
  }).start();
}

/**
 * Create and print a table
 */
function table(headers, rows, options = {}) {
  const t = new Table({
    head: headers.map(h => theme.highlight(h)),
    style: {
      head: [],
      border: ['gray']
    },
    ...options
  });

  rows.forEach(row => t.push(row));
  console.log(t.toString());
}

/**
 * Format JSON for display
 */
function formatJson(obj) {
  if (obj === null || obj === undefined) {
    return theme.muted('null');
  }
  
  if (typeof obj === 'string') {
    return obj;
  }

  try {
    const str = JSON.stringify(obj, null, 2);
    // Colorize JSON
    return str
      .replace(/"([^"]+)":/g, `${chalk.cyan('"$1"')}:`)
      .replace(/: "([^"]+)"/g, `: ${chalk.green('"$1"')}`)
      .replace(/: (\d+)/g, `: ${chalk.yellow('$1')}`)
      .replace(/: (true|false)/g, `: ${chalk.magenta('$1')}`)
      .replace(/: null/g, `: ${chalk.gray('null')}`);
  } catch {
    return String(obj);
  }
}

/**
 * Print a labeled value
 */
function labelValue(label, value) {
  console.log(`${theme.muted(label + ':')} ${theme.highlight(value)}`);
}

/**
 * Print blank line
 */
function blank() {
  console.log();
}

module.exports = {
  theme,
  emoji,
  header,
  success,
  error,
  warning,
  info,
  spinner,
  table,
  formatJson,
  labelValue,
  blank
};

