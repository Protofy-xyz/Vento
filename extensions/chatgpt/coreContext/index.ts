import { getLogger } from "protobase";
import { getServiceToken } from '@extensions/apis/coreContext';
import { getKey } from "@extensions/keys/coreContext";
import OpenAI from 'openai';
import axios from "axios";
import * as fs from "fs";
import { getRoot, processAgentResponse } from "protonode";
import * as path from "path";
import * as fsp from "fs/promises";
import * as fspath from "node:path";
const logger = getLogger()

export const getChatGPTApiKey = async (options?: {
    done?: (result) => {},
    error?: (err) => {}
}) => {
    const { done = (apiKey) => apiKey, error = () => { } } = options ?? {};
    let apiKey = ""
    try {
        apiKey = await getKey({ key: "OPENAI_API_KEY", token: getServiceToken() });
        done(apiKey)
        return apiKey
    } catch (err) {
        const errorMessage = "Error fetching key: " + err;
        console.error(errorMessage);
        error(errorMessage);
    }
}

export const validateOpenAIApiKey = async (apiKey: string) => {
    if (!apiKey) {
        throw new Error("API key is required");
    }

    const client = new OpenAI({ apiKey });
    await client.models.list();
    return true;
}

async function uploadFileToOpenAI(filePath: string): Promise<string> {
    let apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        try {
            apiKey = await getKey({ key: "OPENAI_API_KEY", token: getServiceToken() });
        } catch (err) {
            console.error("Error fetching key:", err);
        }
    }
    if (!apiKey) {
        throw new Error("No API Key provided");
    }

    const client = new OpenAI({ apiKey });
    const file = await client.files.create({
        file: fs.createReadStream(filePath),
        purpose: "assistants"
    });
    return file.id;
}

export const chatGPTSession = async ({
    apiKey = undefined,
    done = (response, message) => { },
    chunk = (chunk: any) => { },
    error = (err) => { },
    model = "gpt-4o", //"gpt-5",
    max_tokens = 4096,
    ...props
}: ChatGPTRequest) => {
    try {
        // --- API key ---
        if (!apiKey) apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            try {
                apiKey = await getKey({ key: "OPENAI_API_KEY", token: getServiceToken() });
            } catch (err) {
                console.error("Error fetching key:", err);
            }
        }
        if (!apiKey) {
            const errObj = { message: "No API Key provided", code: "invalid_api_key" };
            error(errObj.message);
            return { isError: true, data: { error: errObj } };
        }

        const client = new OpenAI({ apiKey });

        // --- ¿Responses API disponible? ---
        const hasResponsesAPI = !!(client as any).responses?.create;

        // Fallback a chat.completions si no hay Responses (los files se ignorarán)
        if (!hasResponsesAPI) {
            console.warn("SDK/driver sin Responses API; fallback a chat.completions (files ignorados).");
            // @ts-ignore
            const stream = await client.chat.completions.create({
                ...(props as any),
                model,
                max_tokens,
                stream: true,
            });

            let fullResponse: string[] | undefined;
            for await (const currentChunk of stream) {
                if (!fullResponse) {
                    fullResponse = Array.from({ length: currentChunk.choices.length }).map(() => "");
                }
                currentChunk.choices.forEach((choice, index) => {
                    if (choice.delta?.content) fullResponse![index] += choice.delta.content;
                });
                await chunk(currentChunk);
            }
            const out = fullResponse ?? [""];
            done({ choices: out }, out[0]);
            return out;
        }

        // --- Camino Responses API (con files) ---
        type Part =
            | string
            | { type: "text"; text: string }
            | { type: "image_url"; image_url: string | { url: string } }
            | { type: "file"; file: { file_id: string } };

        const messages = (props as any).messages as Array<{
            role: "system" | "user" | "assistant" | "function";
            content: Part[] | string;
            name?: string;
        }>;

        // En v5 el contenido de Responses debe ser:
        // { type: "input_text", text: string } | { type: "input_image", image_url: string }
        const input: Array<{
            role: "user" | "assistant" | "system" | "function";
            content: Array<
                | { type: "input_text"; text: string }
                | { type: "input_image"; image_url: string }
                | { type: "input_file"; file_id: string }
            >;
        }> = [];

        const toText = (s: any) => (typeof s === "string" ? s : String(s ?? ""));

        for (const msg of messages || []) {
            const parts: Part[] = Array.isArray(msg.content) ? (msg.content as Part[]) : [toText(msg.content)];
            const converted: Array<{ type: "input_text"; text: string } | { type: "input_image"; image_url: string }> = [];

            for (const p of parts) {
                if (typeof p === "string") {
                    if (p.trim()) converted.push({ type: "input_text", text: p });
                    continue;
                }
                if ((p as any).type === "text") {
                    const t = (p as any).text ?? "";
                    if (t.trim()) converted.push({ type: "input_text", text: t });
                    continue;
                }
                if ((p as any).type === "image_url") {
                    const raw = (p as any).image_url;
                    const url = typeof raw === "string" ? raw : raw?.url;
                    // ✅ v5: image_url DEBE ser string (data URI o URL)
                    if (url && typeof url === "string" && url.trim()) {
                        converted.push({ type: "input_image", image_url: url });
                    }
                    continue;
                }
                if ((p as any).type === "file" && (p as any).file?.file_id) {
                    converted.push({ type: "input_file", file_id: (p as any).file.file_id });
                    continue;
                }
            }

            input.push({
                role: msg.role,
                content: converted.length ? converted : [{ type: "input_text", text: "" }],
            });
        }

        const request: any = {
            model,
            input,
            max_output_tokens: typeof max_tokens === "number" ? max_tokens : undefined,
            temperature: (props as any).temperature,
            top_p: (props as any).top_p,
        };

        if ((props as any).response_format) {
            request.response_format = (props as any).response_format;
        }

        const res = await (client as any).responses.create(request);

        // Extraer texto de Responses v5
        const text =
            (res as any).output_text ??
            (() => {
                try {
                    const chunks = ((res as any).output ?? [])
                        .flatMap((o: any) => o.content ?? [])
                        .filter((c: any) => c.type === "output_text")
                        .map((c: any) => c?.text ?? "");
                    return chunks.join("");
                } catch {
                    return "";
                }
            })();

        const out = [text];
        done({ choices: out }, out[0]);
        return out;

    } catch (e: any) {
        logger.error({ error: e?.message || e, stack: e?.stack }, "Error in chatGPTSession");
        if (error) error(e);
        // return null;
        return { error: e?.message || e, stack: e?.stack };
    }
};

export const chatGPTPrompt = async ({
    model = "gpt-4o",
    message,
    images = [],
    files = [],
    conversation = [],
    ...props
}: any & { message: string }) => {

    console.log("************************************************************************ Sending prompt to ChatGPT:");
    console.dir({ message, images, files, conversation }, { depth: 5 });

    // --- helper: normaliza data URIs para garantizar ;base64, ---
    const normalizeDataUrl = (s: string): string => {
        if (!s.startsWith("data:")) return s;
        const comma = s.indexOf(",");
        if (comma === -1) return s; // raro, pero no rompemos
        const header = s.slice(0, comma);
        // si ya tiene ;base64 justo antes de la coma, OK
        if (/;base64$/i.test(header)) return s;
        // inserta ;base64 antes de la coma
        return `${header};base64${s.slice(comma)}`;
    };

    // Contenido principal del usuario
    const content: any[] = [{ type: "text", text: message }];

    // Files -> subir y añadir como { type:"file" }
    for (const file of files) {
        const file_id = await uploadFileToOpenAI(file);
        console.log("✔ Uploaded file to OpenAI:", { file, file_id });
        content.push({ type: "file", file: { file_id } });
    }

    function guessMimeFromExt(p: string) {
        const extension = path.extname(p).toLowerCase();
        if (extension !== "jpg") return `image/${extension.slice(1)}`;
        return "image/jpeg";
    }

    async function filePathToDataUrl(p: string) {
        const clean = p.replace(/^[/\\]+/, "");
        const abs = fspath.join(getRoot(), clean);
        const buf = await fsp.readFile(abs);
        const ext = fspath.extname(abs).toLowerCase();
        let mime = "application/octet-stream";
        ext.startsWith(".") && (mime = guessMimeFromExt(ext));
        return `data:${mime};base64,${buf.toString("base64")}`;
    }

    // Images -> SIEMPRE data URL accesible por OpenAI (nada de localhost)
    if (images.length > 0) {
        console.log("📸 Chatgpt: there are images in the request:", images);
        const imageParts = await Promise.all(
            images.map(async (url: string, idx: number) => {
                try {
                    console.log(`➡️ Processing image[${idx}]`, url);

                    // 1) Si ya es data URI
                    if (typeof url === "string" && url.startsWith("data:")) {
                        const norm = normalizeDataUrl(url.trim());
                        console.log(`   data: URI detected, normalized:`, norm.slice(0, 100) + "...");
                        return { type: "image_url", image_url: norm };
                    }

                    // 2) Si es una URL (p.ej. tu localhost)
                    if (typeof url === "string" && url.startsWith("http")) {
                        const resp = await axios.get(url, { responseType: "arraybuffer" });
                        const contentType = String(resp.headers["content-type"] || "").split(";")[0] || guessMimeFromExt(url);
                        const b64 = Buffer.from(resp.data).toString("base64");
                        const dataUrl = `data:${contentType};base64,${b64}`;
                        console.log(`   [url ${idx}] http(s) -> data URL`);
                        return { type: "image_url", image_url: dataUrl };
                    }

                    const dataUrl = await filePathToDataUrl(url);
                    console.log(`   [url ${idx}] file path -> data URL`);
                    
                    return { type: "image_url", image_url: dataUrl };
                } catch (err) {
                    console.warn(`⚠️ Error fetching image from ${url}:`, err);
                    return null;
                }
            })
        );

        console.log("✔ Image parts built:", imageParts);
        content.push(...(imageParts.filter(Boolean) as any[]));
    }

    // Mensajes finales
    const messages = [
        ...(Array.isArray(conversation) ? conversation : []),
        { role: "user", content }
    ];

    console.log("###################################### Final chatgpt messages: ");
    console.dir(messages, { depth: 10 });

    const response = await chatGPTSession({
        model,
        messages,
        ...props,
        done: (response) => {
            let msg = "";
            if (response.choices && response.choices.length) {
                msg = response.choices[0] ?? "";
            }
            console.log("✅ Done callback fired. First msg:", msg?.slice(0, 200));
            if (props.done) props.done(response, msg);
        },
        error: (err) => {
            //check if err has error property
            let errorMessage = "Unknown ChatGpt error";
            if(err?.error?.message){
                errorMessage = err.error.message;
            }else{
                errorMessage = err;
            }
            
            logger.error("❌ Error callback fired: "+  errorMessage);
            console.error("❌ Error callback fired log:", err);
            if (props.error) props.error(err.message ?? err);
        }
    });

    console.log("📤 Final response from chatGPTSession:", response);
    return response;
};

type ChatGPTRequest = {
    apiKey?: string;
    done?: any;
    chunk?: (chunk: any) => any;
    error?: (error: any) => any;
} & GPT4VCompletionRequest

type GPT4VCompletionRequest = {
    model: "gpt-4-vision-preview" | "gpt-4-1106-preview" | "gpt-4-turbo" | "gpt-4-32k" | "gpt-4-0613" | "gpt-4-32k-0613" | "gpt-4-0314" | "gpt-4-32k-0314" | "gpt-4" | "gpt-4o" | "gpt-5"; // https://platform.openai.com/docs/models/overview
    messages: Message[];
    functions?: any[] | undefined;
    function_call?: any | undefined;
    stream?: boolean | undefined;
    temperature?: number | undefined;
    top_p?: number | undefined;
    max_tokens?: number | undefined;
    n?: number | undefined;
    best_of?: number | undefined;
    frequency_penalty?: number | undefined;
    presence_penalty?: number | undefined;
    logit_bias?:
    | {
        [x: string]: number;
    }
    | undefined;
    stop?: (string[] | string) | undefined;
};

type Message = {
    role: "system" | "user" | "assistant" | "function";
    content: MessageContent;
    name?: string | undefined;
}

type MessageContent =
    | string // String prompt
    | (string | { type: "image_url"; image_url: string })[]; // Image asset 



export const prompt = async (options: {
    message: string,
    images?: any[],
    files?: any[],
    conversation?: any[],
    model?: string,
    done?: (result) => {},
    error?: (err) => {}
}) => {
    const {
        message,
        images = [],
        files = [],
        conversation = [],
        model = "gpt-4o-mini",
        done = () => { },
        error = () => { }
    } = options;

    const response = await chatGPTPrompt({
        model,
        images: images || [],
        files: (files || []).map(file => getRoot() + file),
        message: message, done: (response, msg) => {
            done(response);
        }, error: (err) => {
            error(err);
        },
        conversation
    })
    return response && Array.isArray(response) ? response[0] : response;
}

export const processResponse = processAgentResponse;

export const getSystemPrompt = ({ prompt, done = async (prompt) => prompt, error = (e) => e }) => {
    const result = [
        {
            role: "system",
            content: [
                {
                    type: "text",
                    text: prompt,
                },
            ],
        },
    ]
    done(result)
    return result
}

export default {
    chatGPTSession,
    chatGPTPrompt,
    prompt,
    processResponse,
    getChatGPTApiKey,
    getSystemPrompt,
    validateOpenAIApiKey
}
