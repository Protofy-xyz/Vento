import { chatGPTPrompt, getChatGPTApiKey, validateOpenAIApiKey } from "./coreContext"
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


    const handleSendPrompt = async (message, images, files, res, model?) => {
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
            model: model,
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

    app.post("/api/v1/chatgpt/validateKey", handler(async (req, res, session) => {
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
            await validateOpenAIApiKey(apiKey);
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
        handleSendPrompt(req.body.message, req.body.images, req.body.files, res, req.body.model)
    }))

    app.get("/api/v1/chatgpt/send/prompt", handler(async (req, res, session) => {
        if (!session || !session.user.admin) {
            res.status(401).send({ error: "Unauthorized" })
            return
        }
        handleSendPrompt(req.query.message, req.query.images, req.query.files, res, req.body.model)

    }))
    registerActions(context);
}

