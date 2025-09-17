import { chatGPTPrompt, getChatGPTApiKey } from "./coreContext"
import { addAction } from "@extensions/actions/coreContext/addAction";
import { addCard } from "@extensions/cards/coreContext/addCard";
import { getLogger, getServiceToken } from 'protobase';
import { handler, getRoot } from 'protonode'


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
                width: 2,
                height: 10,
                name: "chatGPT_message_send",
                icon: "openai",
                color: "#74AA9C",
                description: "Send a message to ChatGPT",
                rulesCode: `return execute_action("/api/v1/chatgpt/send/prompt", { message: (userParams.preprompt ?? "") + " " + (userParams.prompt ?? "") + " " + (userParams.postprompt ?? "")});`,
                params: { preprompt: "preprompt", prompt: "prompt", postprompt: "postprompt" },
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
                    }
                }
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

