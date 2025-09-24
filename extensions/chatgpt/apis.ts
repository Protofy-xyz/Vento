import { chatGPTPrompt, getChatGPTApiKey } from "./coreContext"
import { addAction } from "@extensions/actions/coreContext/addAction";
import { addCard } from "@extensions/cards/coreContext/addCard";
import { getLogger, getServiceToken } from 'protobase';
import { handler, getRoot } from 'protonode'
import OpenAI from 'openai';

export default (app, context) => {


    const registerActions = async (context) => {
        addAction({
            group: 'chatGPT',
            name: 'message',
            url: `/api/v1/chatgpt/send/prompt`,
            tag: "send",
            description: "send a chatGPT prompt",
            params: { prompt: "message value to send" },
            emitEvent: true,
            token: await getServiceToken(),
            method: 'post'
        })
    }

    const registerCards = async (context) => {
        // addCard({
        //     group: 'chatGPT',
        //     tag: "chat",
        //     id: 'chatGPT__chat_response',
        //     templateName: "chatGPT last chat response",
        //     name: "response",
        //     defaults: {
        //         width: 2,
        //         height: 8,
        //         name: "chatGPT_last_chat_response",
        //         icon: "openai",
        //         color: "#74AA9C",
        //         description: "ChatGPT last chat response",
        //         rulesCode: `return states?.chatGPT?.conversation?.chatResponse`,
        //         type: 'value',
        //         html: "return markdown(data)",
        //     },
        //     emitEvent: true,
        //     token: await getServiceToken()
        // })

        addCard({
            group: 'chatGPT',
            tag: "message",
            id: 'chatGPT_message_send',
            templateName: "chatGPT send message",
            name: "send_message",
            defaults: {
                width: 3,
                height: 13,
                name: "chatGPT_message_send",
                icon: "openai",
                color: "#74AA9C",
                description: "Send a message to ChatGPT",
                rulesCode: "if (userParams.forcedValue) {\n  return JSON.parse(userParams.forcedValue);\n}\nreturn execute_action(\"/api/v1/chatgpt/send/prompt\", {\n  message:\n    (userParams.preprompt ?? \"\") +\n    \" \" +\n    (userParams.prompt ?? \"\") +\n    \" \" +\n    (userParams.postprompt ?? \"\"),\n});\n",
                html: "//@card/react\n\nfunction Widget(card) {\n  const value = card.value;\n  const nameKey = 'OPENAI_API_KEY';\n  const readme = `\n### 🔑 How to get your OpenAI API key?\n1. Go to [OpenAI's API Keys page](https://platform.openai.com/account/api-keys).\n2. Log in and click **\"Create new secret key\"**.\n3. Copy and save your key securely, it won't be shown again.\n---\n> ⚠️ **Keep it secret!** Your API key is private and usage-based.\n`;\n\n  async function validateKey(apiKey) {\n    if (!apiKey.startsWith('sk-')) return 'The OpenAI API key must start with sk-.';\n    const response = await API.post('/api/v1/chatgpt/validate-key', { apiKey });\n    if (response.isError) return response.error.error\n    return true;\n  }\n\n  const content = (\n    <YStack f={1} mt={\"20px\"} ai=\"center\" jc=\"center\" width=\"100%\">\n      {card.icon && card.displayIcon !== false && (\n        <Icon name={card.icon} size={48} color={card.color} />\n      )}\n      {card.displayResponse !== false && (\n        <CardValue mode={card.markdownDisplay ? 'markdown' : 'normal'} value={value ?? \"N/A\"} readOnly={card.markdownDisplay ? false: true} executeActionOnEdit={(val)=>execute_action(card.name, {forcedValue: JSON.stringify(val)})}/>\n      )}\n    </YStack>\n  );\n\n  return (\n    <Tinted>\n      <ProtoThemeProvider forcedTheme={window.TamaguiTheme}>\n        <KeyGate requiredKeys={[nameKey]} readme={readme} validators={{ [nameKey]: validateKey }} >\n          <ActionCard data={card}>\n            {card.displayButton !== false\n              ? <ParamsForm data={card}>{content}</ParamsForm>\n              : card.displayResponse !== false && content}\n          </ActionCard>\n        </KeyGate>\n      </ProtoThemeProvider>\n    </Tinted>\n  );\n}\n\n",
                params: { 
                    preprompt: "preprompt",
                    prompt: "prompt",
                    postprompt: "postprompt",
                    forcedValue: "forcedValue" 
                },
                type: 'action',
                configParams: {
                    "preprompt": {
                        "visible": false,
                        "defaultValue": "",
                        "type": "text"
                    },
                    "prompt": {
                        "visible": true,
                        "defaultValue": "",
                        "type": "text"
                    },
                    "postprompt": {
                        "visible": false,
                        "defaultValue": "",
                        "type": "text"
                    },
                    "forcedValue": {
                        "visible": false,
                        "defaultValue": "",
                        "type": "string"
                    }
                },
                markdownDisplay: true
            },
            emitEvent: true,
            token: await getServiceToken()
        })
    }

    const handleSendPrompt = async (message, images, files, res) => {
        console.log('--------------------------------------------------------------------------------------')
        console.log('************** chatgpt send prompt: ', message, images, files)
        if (!message) {
            res.status(400).send({ error: "Message parameter is required" });
            return;
        }

        try {
            await getChatGPTApiKey()
        } catch (err) {
            res.json({ error: "Failed to retrieve ChatGPT API key. Please check your configuration." });
            return;
        }

        console.log('************** chatgpt before:')
        chatGPTPrompt({
            images: images || [],
            files: (files || []).map(file => getRoot() + file),
            message: message, done: (response, msg) => {
                console.log('************** chatgpt: ', response, msg)
                context.state.set({ group: 'chatGPT', tag: "conversation", name: "userMessage", value: message, emitEvent: true });
                context.state.set({ group: 'chatGPT', tag: "conversation", name: "chatResponse", value: msg, emitEvent: true });
                res.send(msg);
            }, error: (err) => {
                context.state.set({ group: 'chatGPT', tag: "conversation", name: "chatResponse", value: err || "An error occurred", emitEvent: true });
                res.status(500).send({ error: err || "An error occurred" });
            }
        })
    }

    app.post("/api/v1/chatgpt/validate-key", handler(async (req, res, session) => {
        if (!session || !session.user.admin) {
            res.status(401).send({ error: "Unauthorized" })
            return
        }

        const apiKey = req.body?.apiKey ?? ""
        if (!apiKey) {
            res.status(400).send({ error: "API key is required" });
            return;
        }

        try {
            const client = new OpenAI({ apiKey });
            await client.models.list();
            res.send({ valid: true });
        } catch (error) {
            const errorMessage = error?.error?.message ?? error.message ?? "Invalid OpenAI API key";
            res.status(400).send({ error: errorMessage });
        }
    }))

    app.post("/api/v1/chatgpt/send/prompt", handler(async (req, res, session) => {
        if (!session || !session.user.admin) {
            res.status(401).send({ error: "Unauthorized" })
            return
        }
        console.log('************** chatgpt send prompt: ', req.body.message, req.body.images, req.body.files)
        handleSendPrompt(req.body.message, req.body.images, req.body.files, res)
    }))

    app.get("/api/v1/chatgpt/send/prompt", handler(async (req, res, session) => {
        if (!session || !session.user.admin) {
            res.status(401).send({ error: "Unauthorized" })
            return
        }
        handleSendPrompt(req.query.message, req.query.images, req.query.files, res)

    }))
    registerActions(context);
    registerCards(context);

}

