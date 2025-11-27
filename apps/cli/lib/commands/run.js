/**
 * Run command: execute actions
 */

const api = require('../api');
const ui = require('../ui');

/**
 * Parse tool name into board and action
 * Supports: board_action or board/action
 */
function parseToolName(name) {
  if (name.includes('/')) {
    const [board, action] = name.split('/');
    return { board, action };
  }
  
  const idx = name.indexOf('_');
  if (idx === -1) {
    return { board: name, action: null };
  }
  
  return {
    board: name.substring(0, idx),
    action: name.substring(idx + 1)
  };
}

/**
 * Run an action
 */
async function run(toolName, params = {}) {
  const { board, action } = parseToolName(toolName);

  if (!action) {
    ui.error('Invalid tool name. Use format: board_action or board/action');
    return;
  }

  ui.header(`Running ${toolName}`, ui.emoji.tool);

  if (Object.keys(params).length > 0) {
    ui.info(`Parameters: ${JSON.stringify(params)}`);
  }

  const spin = ui.spinner('Executing...');

  try {
    const result = await api.runAction(board, action, params);
    spin.stop();

    ui.success('Action completed');
    ui.blank();

    if (result !== null && result !== undefined) {
      console.log(ui.formatJson(result));
    } else {
      ui.info('No return value');
    }

  } catch (err) {
    spin.stop();
    ui.error(`Action failed: ${err.message}`);
  }
}

module.exports = {
  run,
  parseToolName
};

