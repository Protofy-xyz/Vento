/**
 * Get command: read values
 */

const api = require('../api');
const ui = require('../ui');

/**
 * Parse value path into board and card
 * Supports: board/card or board_card
 */
function parseValuePath(path) {
  if (path.includes('/')) {
    const [board, card] = path.split('/');
    return { board, card };
  }
  
  const idx = path.indexOf('_');
  if (idx === -1) {
    return { board: path, card: null };
  }
  
  return {
    board: path.substring(0, idx),
    card: path.substring(idx + 1)
  };
}

/**
 * Get a value
 */
async function get(valuePath) {
  const { board, card } = parseValuePath(valuePath);

  if (!card) {
    ui.error('Invalid value path. Use format: board/card or board_card');
    return;
  }

  ui.header(`Value: ${valuePath}`, ui.emoji.value);

  const spin = ui.spinner('Loading...');

  try {
    const value = await api.getValue(board, card);
    spin.stop();

    ui.labelValue('Board', board);
    ui.labelValue('Card', card);
    ui.blank();

    console.log(ui.formatJson(value));

  } catch (err) {
    spin.stop();
    ui.error(`Failed to get value: ${err.message}`);
  }
}

module.exports = {
  get,
  parseValuePath
};

