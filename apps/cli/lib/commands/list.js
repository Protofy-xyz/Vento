/**
 * List commands: agents, tools, values
 */

const api = require('../api');
const ui = require('../ui');

/**
 * List all agents (boards)
 */
async function listAgents() {
  const spin = ui.spinner('Loading agents...');

  try {
    const boards = await api.getBoards();
    spin.stop();

    ui.header('Vento Agents', ui.emoji.agent);

    if (boards.length === 0) {
      ui.warning('No agents found');
      return;
    }

    const rows = boards.map(b => [
      ui.theme.agent(b.name),
      ui.theme.muted(b.description || '-')
    ]);

    ui.table(['Agent', 'Description'], rows);
    ui.blank();
    ui.info(`${boards.length} agent(s) available`);

  } catch (err) {
    spin.stop();
    ui.error(`Failed to load agents: ${err.message}`);
  }
}

/**
 * List all tools (actions)
 */
async function listTools(boardFilter) {
  const spin = ui.spinner('Loading tools...');

  try {
    let tools = await api.getTools();
    spin.stop();

    if (boardFilter) {
      tools = tools.filter(t => t.board === boardFilter);
    }

    ui.header('Vento Tools', ui.emoji.tool);

    if (tools.length === 0) {
      ui.warning(boardFilter ? `No tools found for board "${boardFilter}"` : 'No tools found');
      return;
    }

    const rows = tools.map(t => [
      ui.theme.tool(t.fullName),
      ui.theme.muted(t.description || '-'),
      ui.theme.muted(Object.keys(t.params).join(', ') || '-')
    ]);

    ui.table(['Tool', 'Description', 'Params'], rows);
    ui.blank();
    ui.info(`${tools.length} tool(s) available`);

  } catch (err) {
    spin.stop();
    ui.error(`Failed to load tools: ${err.message}`);
  }
}

/**
 * List all values
 */
async function listValues(boardFilter) {
  const spin = ui.spinner('Loading values...');

  try {
    let values = await api.getValues();
    spin.stop();

    if (boardFilter) {
      values = values.filter(v => v.board === boardFilter);
    }

    ui.header('Vento Values', ui.emoji.value);

    if (values.length === 0) {
      ui.warning(boardFilter ? `No values found for board "${boardFilter}"` : 'No values found');
      return;
    }

    const rows = values.map(v => {
      let displayValue = v.value;
      if (displayValue === null || displayValue === undefined) {
        displayValue = ui.theme.muted('null');
      } else if (typeof displayValue === 'object') {
        displayValue = ui.theme.muted(JSON.stringify(displayValue).substring(0, 30) + '...');
      } else {
        displayValue = ui.theme.value(String(displayValue));
      }

      return [
        ui.theme.value(v.fullName),
        ui.theme.muted(v.description || '-'),
        displayValue
      ];
    });

    ui.table(['Value', 'Description', 'Current'], rows);
    ui.blank();
    ui.info(`${values.length} value(s) available`);

  } catch (err) {
    spin.stop();
    ui.error(`Failed to load values: ${err.message}`);
  }
}

module.exports = {
  listAgents,
  listTools,
  listValues
};

