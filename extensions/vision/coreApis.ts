import { getServiceToken } from "protonode";
import APIContext from "app/bundles/coreContext";
import { Application } from "express";
import axios from "axios";
import { addAction } from "@extensions/actions/coreContext/addAction";
import { addCard } from "@extensions/cards/coreContext/addCard";
import { getChatGPTApiKey } from '@extensions/chatgpt/coreContext';
import fs from "fs";
import path from "path";

async function getImageBase64(url) {
    const response = await axios.get(url, { responseType: 'arraybuffer' });

    const textData = Buffer.from(response.data).toString("utf8");

    // in case the url is already a base64 image
    if (textData.startsWith("data:image")) {
        return textData.split(",")[1];
    }

    return Buffer.from(response.data, 'binary').toString('base64');
}

async function sendPromptWithImage(prompt, imageUrl) {
    const token = await getChatGPTApiKey();
    if (!token) throw new Error("OpenAI API key not found");
    const imageBase64 = await getImageBase64(imageUrl);

    const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
            temperature: 1,
            model: 'gpt-4o', // o 'gpt-4-vision-preview'
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:image/jpeg;base64,${imageBase64}`,
                            },
                        },
                        { type: "text", text: prompt }
                    ],
                },
            ],
            max_tokens: 1024,
        },
        {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        }
    );

    return {response: response.data.choices[0].message.content, stats: {usage: response.data.usage}};
}

async function sendPromptWithImageLmStudio(prompt, imageUrl) {
    const imageBase64 = await getImageBase64(imageUrl);

    // Enviar el prompt y la imagen en base64 a LM Studio
    const lmStudioResponse = await axios.post('http://localhost:1234/api/v0/chat/completions', {
        messages: [
            {
                role: "user",
                content: [
                    {
                        type: "image_url",
                        image_url: {
                            url: `data:image/jpeg;base64,${imageBase64}`,
                        },
                    },
                    { type: "text", text: prompt }
                ],
            },
        ],
    });

    // Mostrar respuesta
    return {response: lmStudioResponse.data.choices[0].message.content, stats: {stats: lmStudioResponse.data.stats, usage: lmStudioResponse.data.usage}};
}

const locks = {
    "detect": false,
    "categorize": false,
    "count": false
}

let frames = {}

export default async (app: Application, context: typeof APIContext) => {

    app.get('/api/core/v1/vision/detect', async (req, res) => {
        if (locks["detect"]) return res.send({ error: "Another detection is in progress" });
        locks["detect"] = true;
        console.log('init')
        try {
            const params = req.query;
            const preprompt = `
            Answer only with a number between 0.0 and 1.0. 0.0 being zero confidence and 1.0 being maximum confidence.
            Check the image provided and answer with the confidence of whether the image contains a:
            
                    `
            const url = params.url;
            let response;
            if(params.llmProvider === 'lmstudio') {
                response = await sendPromptWithImageLmStudio(preprompt + params.prompt, url);
            } else {
                response = await sendPromptWithImage(preprompt + params.prompt, url);
            }
            console.log('CONFIDENCE:', response);
            res.json(response);
        } catch (e) {
            console.error(e);
            res.send({ error: e.message });
        } finally {
            locks["detect"] = false;
        }
    })

    app.post('/api/core/v1/vision/frame/set', async (req, res) => {
        const { image } = req.body;
        const { id } = req.body;
        if(!id) {
            return res.status(400).send({ error: "ID is required" });
        }
        // if has more than 20 frames, delete the oldest one
        if(Object.keys(frames).length >= 20) {
            const oldestKey = Object.keys(frames)[0];
            delete frames[oldestKey];
        }
        frames[id as string] = image;
        res.send('/api/core/v1/vision/frame/get?id=' + id);
    })

    addAction({
        group: 'vision',
        name: 'set',
        url: "/api/core/v1/vision/frame/set",
        tag: 'frame',
        description: "set a frame to be used later",
        params: {
            id: "frame id",
            image: "base64 image"
        },
        method: 'post',
        emitEvent: true
    })

    app.get('/api/core/v1/vision/frame/get', async (req, res) => {
        const { id, mode } = req.query;
        if(frames[id as string]) {
            if (mode == "image/png") {
                const imgBuffer = Buffer.from(frames[id as string].split(",")[1], 'base64');
                res.writeHead(200, {
                    'Content-Type': 'image/png',
                    'Content-Length': imgBuffer.length
                });
                return res.end(imgBuffer);
            } else {
                return res.send(frames[id as string]);
            }
        }
        return res.status(404).send({ error: "Frame not found" });
    })

    addAction({
        group: 'vision',
        name: 'get',
        url: "/api/core/v1/vision/frame/get",
        tag: 'frame',
        description: "get a previously set frame",
        params: {
            id: "frame id"
        },
        emitEvent: true
    })

    addAction({
        group: 'vision',
        name: 'detect',
        url: "/api/core/v1/vision/detect",
        tag: 'basic',
        description: "basic object detection, give an object description and get a confidence",
        params: {
            url: "image url",
            prompt: "what to detect in the image",
            llmProvider: "llm provider to use (openai or lmstudio)",
        },
        emitEvent: true
    })

    app.get('/api/core/v1/vision/describe', async (req, res) => {
        if (locks["describe"]) return res.send({ error: "Another detection is in progress" });
        locks["describe"] = true;
        console.log('init')
        try {
            const params = req.query;
            const preprompt = `    `
            const url = params.url;
            let response;
            if(params.llmProvider === 'lmstudio') {
                response = await sendPromptWithImageLmStudio(preprompt + params.prompt, url);
            } else {
                response = await sendPromptWithImage(preprompt + params.prompt, url);
            }
            console.log('DESCRIPTION:', response, typeof response);
            res.json(response);
        } catch (e) {
            console.error(e);
            res.send({ error: e.message });
        } finally {
            locks["describe"] = false;
        }
    })

    addAction({
        group: 'vision',
        name: 'describe',
        url: "/api/core/v1/vision/describe",
        tag: 'basic',
        description: "image description using AI",
        params: {
            url: "image url",
            prompt: "promt for the image model",
            stateName: "state name to store the result",
            llmProvider: "llm provider to use (openai or lmstudio)",
        },
        emitEvent: true
    })
}

