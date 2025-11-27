/**
 * Chat command: talk to agents
 */

const api = require('../api');
const ui = require('../ui');

/**
 * Send a message to an agent
 */
async function chat(boardName, message) {
  ui.header(`Chatting with ${boardName}`, ui.emoji.chat);
  ui.info(`You: ${message}`);
  ui.blank();

  const spin = ui.spinner('Thinking...');

  try {
    const result = await api.chat(boardName, message);
    spin.stop();

    if (result?.error) {
      ui.error(result.error);
      return;
    }

    // Try to extract the response text
    let response = result;
    
    // Handle different response formats
    if (result?.choices?.[0]?.message?.content) {
      response = result.choices[0].message.content;
    } else if (result?.response) {
      response = result.response;
    } else if (result?.message) {
      response = result.message;
    } else if (typeof result === 'string') {
      response = result;
    }

    console.log(ui.theme.agent(`${ui.emoji.agent} ${boardName}:`));
    
    if (typeof response === 'string') {
      console.log(ui.theme.highlight(response));
    } else {
      console.log(ui.formatJson(response));
    }

  } catch (err) {
    spin.stop();
    ui.error(`Chat failed: ${err.message}`);
  }
}

module.exports = {
  chat
};

