import { Transport, ESPLoader } from "protodevice/src/device/esptool-js";
import { sleep } from "protodevice/src/sleep";
import { Build, FlashError } from "protodevice/src/const";
import { manifest } from "protodevice/src/manifest";

import { CompletionsHandler } from "./esphomeEditor/completions-handler";
import { DefinitionHandler } from "./esphomeEditor/definition-handler";
import { fromMonacoPosition, setSchemaVersion } from "./esphomeEditor/editor-shims";
import { ESPHomeDocuments } from "./esphomeEditor/esphome-document";
import { HoverHandler } from "./esphomeEditor/hover-handler";
import { TextBuffer } from "./esphomeEditor/utils/text-buffer";
import protoInfraUrls  from "@extensions/protoinfra/utils/protoInfraUrls";

const debounce = (func: Function, wait: number) => {
    let timeout: number | null;
    return function () {
        // @ts-ignore
        let context = this,
            args = arguments;
        let later = function () {
            timeout = null;
            func.apply(context, args);
        };
        clearTimeout(timeout!);
        // @ts-ignore
        timeout = setTimeout(later, wait);
    };
};

export let port;

let SERIAL_VENDOR_FILTER: number[] = [
  0x303A, // Espressif (ESP32-S2/S3 native USB)
  0x10C4, // Silicon Labs CP210x
  0x1A86, // WCH CH340/CH341
  0x0403, // FTDI
  0x067B, // Prolific PL2303
  0x2341, // Arduino
  0x2E8A, // Raspberry Pi (RP2040)
];

export const resetTransport = async (transport: Transport) => {
    await transport.device.setSignals({
        dataTerminalReady: false,
        requestToSend: true,
    });
    await transport.device.setSignals({
        dataTerminalReady: false,
        requestToSend: false,
    });
};

export const closeSerialPort = async () => {
    if (port) {
        try {
            await port.close();
        } catch (err: any) {
            console.error("Error closing port:", err);
        }
        port = null;
    }
}

export function downloadLogs(logs: string, deviceName?: string) {
    const blob = new Blob([logs ?? ""], { type: "text/plain" });

    // Fallback + sanitize to avoid illegal filename characters
    const safeName = (deviceName || "device")
        .trim()
        .replace(/[\\/:*?"<>|]+/g, "_");

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${safeName}-logs.txt`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        URL.revokeObjectURL(a.href);
        a.remove();
    }, 0);
}

export const resetDevice = async (): Promise<void> => {
    if (!port) {
        console.error("No port available to reset device.");
        return;
    }
    const transport = new Transport(port);
    await resetTransport(transport);
};

export const connectSerialPort = async (): Promise<{ port: any | null, error?: string }> => {
    try {
        const filters = (SERIAL_VENDOR_FILTER || []).map(v => ({ usbVendorId: v }));
        const requestOptions: any = filters.length ? { filters } : undefined;

        port = await (navigator as any).serial.requestPort(requestOptions);
        await port.open({ baudRate: 115200 });
        return { port };
    } catch (err: any) {
        console.error("dev: Error opening port:", err);
        if (err.name === "NotFoundError") {
            return { port: null, error: "Any port selected" };
        }
        return { port: null, error: "Couldn't open port, verify connection and drivers" };
    }
};

export const flash = async (cb: (data: any) => void, deviceName: string, compileSessionId: string, eraseBeforeFlash: boolean) => {
    if (!port) {
        cb({ message: "Invalid port", details: { error: FlashError.PORT_UNAVAILABLE } });
        return;
    }

    cb({ message: 'Please hold "Boot" button of your ESP32 board.' });

    const transport = new Transport(port);
    const esploader = new ESPLoader(transport, 115200, undefined as any);

    // For debugging
    (window as any).esploader = esploader;

    try {
        await port.close(); // esptool-js abrirá el puerto internamente
        await esploader.main_fn();
    } catch (err: any) {
        console.error("Fail in main_fn():", err);
        cb({
            message: "Failed to initialize. Try resetting your device or holding the BOOT button while clicking INSTALL.",
            details: { error: FlashError.FAILED_INITIALIZING, details: err },
        });
        await resetTransport(transport);
        await transport.disconnect();
        return;
    }

    const chipFamily = esploader.chip.CHIP_NAME as Build["chipFamily"];
    console.log("chipFamily:", chipFamily);

    if (!esploader.chip.ROM_TEXT) {
        cb({
            message: `Chip ${chipFamily} is not supported`,
            details: { error: FlashError.NOT_SUPPORTED, details: `Chip ${chipFamily} is not supported` },
        });
        await resetTransport(transport);
        await transport.disconnect();
        return;
    }

    cb({ message: `Initialized. Found ${chipFamily}`, details: { done: true } });

    const build = manifest.builds.find((b) => b.chipFamily === chipFamily);
    if (!build) {
        cb({
            message: `Your ${chipFamily} board is not supported.`,
            details: { error: FlashError.NOT_SUPPORTED, details: chipFamily },
        });
        await resetTransport(transport);
        await transport.disconnect();
        return;
    }

    cb({ message: "Preparing installation...", details: { done: false } });

    const fileArray: Array<{ data: string; address: number }> = [];
    let totalSize = 0;

    try {
        const filePromises = build.parts.map(async (part) => {
            const url = downloadDeviceFirmwareEndpoint(deviceName, compileSessionId);
            const resp = await fetch(url);
            if (!resp.ok) throw new Error(`Downloading firmware ${url} failed: ${resp.status}`);
            const blob = await resp.blob();

            return new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.readAsBinaryString(blob);
            });
        });

        const results = await Promise.all(filePromises);
        results.forEach((data, i) => {
            fileArray.push({ data, address: build.parts[i].offset });
            totalSize += data.length;
        });

        cb({ message: "Installation prepared", details: { done: true } });
    } catch (err: any) {
        cb({
            message: err.message,
            details: { error: FlashError.FAILED_FIRMWARE_DOWNLOAD, details: err.message },
        });
        await resetTransport(transport);
        await transport.disconnect();
        return;
    }

    if (eraseBeforeFlash) {
        cb({ message: "Erasing device...", details: { done: false } });
        await esploader.erase_flash();
        cb({ message: "Device erased", details: { done: true } });
    }

    cb({
        message: `Writing progress: 0%`,
        details: { bytesTotal: totalSize, bytesWritten: 0, percentage: 0 },
    });

    let totalWritten = 0;

    try {
        await esploader.write_flash(
            fileArray,
            "keep",
            "keep",
            "keep",
            false,
            true,
            (fileIndex: number, written: number, total: number) => {
                const uncompressedWritten = (written / total) * fileArray[fileIndex].data.length;
                const newPct = Math.floor(((totalWritten + uncompressedWritten) / totalSize) * 100);

                if (written === total) {
                    totalWritten += uncompressedWritten;
                    return;
                }

                cb({
                    message: `Writing progress: ${newPct}%`,
                    details: { bytesTotal: totalSize, bytesWritten: totalWritten + written, percentage: newPct },
                });
            }
        );
    } catch (err: any) {
        cb({
            message: err.message,
            details: { error: FlashError.WRITE_FAILED, details: err },
        });
        await resetTransport(transport);
        await transport.disconnect();
        return;
    }

    cb({
        message: "Writing complete",
        details: { bytesTotal: totalSize, bytesWritten: totalWritten, percentage: 100 },
    });

    await sleep(100);

    console.log("HARD RESET");
    await resetTransport(transport);

    console.log("DISCONNECT");
    await transport.disconnect();

    cb({ message: "All done!" });
};



const onlineCompiler = protoInfraUrls.esphome.url;
export const downloadDeviceFirmwareEndpoint = (targetDevice, compileSessionId) => {
    return (`${onlineCompiler}/api/v1/device/download/${targetDevice}?compileSessionId=${compileSessionId}`)
};
export const downloadDeviceElfEndpoint = (targetDevice, compileSessionId) => {
    return (`${onlineCompiler}/api/v1/device/downloadElf/${targetDevice}?compileSessionId=${compileSessionId}`)
};

export const onlineCompilerSecureWebSocketUrl = () => {
    return (`${protoInfraUrls.esphome.wss}/websocket`)
};

export const postYamlApiEndpoint = (targetDevice) => {
    return (`${onlineCompiler}/api/v1/device/edit/${targetDevice}`);
};

export const compileActionUrl = (targetDevice, compileSessionId) => {
    return (`${onlineCompiler}/api/v1/device/compile/${targetDevice}?compileSessionId=${compileSessionId}`)
};

export const compileMessagesTopic = (compileSessionId) => {
    return (`device/compile/${compileSessionId}`);
}

export const loadEsphomeHelpers = (monaco) => {
    if (!monaco.languages.getLanguages().some(lang => lang.id === 'esphome')) {
        monaco.languages.register({ id: 'esphome' });
        monaco.languages.register({ id: "cpp" });


        const documents = new ESPHomeDocuments();

        const hoverHandler = new HoverHandler(documents);
        monaco.languages.registerHoverProvider("esphome", {
            provideHover: async function (model, position) {
                documents.update(model.uri.toString(), new TextBuffer(model));
                const hover = await hoverHandler.getHover(
                    model.uri.toString(),
                    fromMonacoPosition(position),
                );
                return hover;
            },
        });
        const completionsHandler = new CompletionsHandler(documents);
        monaco.languages.registerCompletionItemProvider("esphome", {
            provideCompletionItems: async function (model, position) {
                documents.update(model.uri.toString(), new TextBuffer(model));
                const completions = await completionsHandler.getCompletions(
                    model.uri.toString(),
                    fromMonacoPosition(position),
                );
                return { suggestions: completions };
            },
        });
        const definitionHandler = new DefinitionHandler(documents);
        monaco.languages.registerDefinitionProvider("esphome", {
            provideDefinition: async function (model, position) {
                documents.update(model.uri.toString(), new TextBuffer(model));
                const ret = await definitionHandler.getDefinition(
                    model.uri.toString(),
                    fromMonacoPosition(position),
                );
                if (!ret) return;

                return {
                    uri: model.uri,
                    range: {
                        startLineNumber: ret.range.start.line + 1,
                        startColumn: ret.range.start.character + 1,
                        endLineNumber: ret.range.end.line + 1,
                        endColumn: ret.range.end.character + 1,
                    },
                };
            },
        });

        monaco.languages.setLanguageConfiguration("esphome", {
            comments: {
                lineComment: "#",
            },
            brackets: [
                ["{", "}"],
                ["[", "]"],
                ["(", ")"],
            ],
            autoClosingPairs: [
                { open: "{", close: "}" },
                { open: "[", close: "]" },
                { open: "(", close: ")" },
                { open: '"', close: '"' },
                { open: "'", close: "'" },
            ],
            surroundingPairs: [
                { open: "{", close: "}" },
                { open: "[", close: "]" },
                { open: "(", close: ")" },
                { open: '"', close: '"' },
                { open: "'", close: "'" },
            ],
            folding: {
                offSide: true,
            },
            onEnterRules: [
                {
                    beforeText: /:\s*$/,
                    action: {
                        indentAction: monaco.languages.IndentAction.Indent,
                    },
                },
            ],
        });

        monaco.languages.setMonarchTokensProvider("esphome", {
            tokenPostfix: ".esphome",

            brackets: [
                { token: "delimiter.bracket", open: "{", close: "}" },
                { token: "delimiter.square", open: "[", close: "]" },
            ],

            keywords: [
                "true",
                "True",
                "TRUE",
                "false",
                "False",
                "FALSE",
                "null",
                "Null",
                "Null",
                "~",
            ],

            numberInteger: /(?:0|[+-]?[0-9]+)/,
            numberFloat: /(?:0|[+-]?[0-9]+)(?:\.[0-9]+)?(?:e[-+][1-9][0-9]*)?/,
            numberOctal: /0o[0-7]+/,
            numberHex: /0x[0-9a-fA-F]+/,
            numberInfinity: /[+-]?\.(?:inf|Inf|INF)/,
            numberNaN: /\.(?:nan|Nan|NAN)/,
            numberDate:
                /\d{4}-\d\d-\d\d([Tt ]\d\d:\d\d:\d\d(\.\d+)?(( ?[+-]\d\d?(:\d\d)?)|Z)?)?/,

            escapes: /\\(?:[btnfr\\"']|[0-7][0-7]?|[0-3][0-7]{2})/,

            tokenizer: {
                root: [
                    { include: "@whitespace" },
                    { include: "@comment" },

                    // Directive
                    [/%[^ ]+.*$/, "meta.directive"],

                    // Document Markers
                    [/---/, "operators.directivesEnd"],
                    [/\.{3}/, "operators.documentEnd"],

                    // Block Structure Indicators
                    [/[-?:](?= )/, "operators"],

                    { include: "@anchor" },
                    { include: "@tagHandle" },
                    { include: "@flowCollections" },
                    { include: "@blockStyle" },

                    // Numbers
                    [/@numberInteger(?![ \t]*\S+)/, "number"],
                    [/@numberFloat(?![ \t]*\S+)/, "number.float"],
                    [/@numberOctal(?![ \t]*\S+)/, "number.octal"],
                    [/@numberHex(?![ \t]*\S+)/, "number.hex"],
                    [/@numberInfinity(?![ \t]*\S+)/, "number.infinity"],
                    [/@numberNaN(?![ \t]*\S+)/, "number.nan"],
                    [/@numberDate(?![ \t]*\S+)/, "number.date"],

                    // Key:Value pair
                    [
                        /(".*?"|'.*?'|[^#'"]*?)([ \t]*)(:)( |$)/,
                        ["type", "white", "operators", "white"],
                    ],

                    { include: "@flowScalars" },

                    // String nodes
                    [
                        /.+?(?=(\s+#|$))/,
                        {
                            cases: {
                                "@keywords": "keyword",
                                "@default": "type",
                            },
                        },
                    ],
                ],

                // Flow Collection: Flow Mapping
                object: [
                    { include: "@whitespace" },
                    { include: "@comment" },

                    // Flow Mapping termination
                    [/\}/, "@brackets", "@pop"],

                    // Flow Mapping delimiter
                    [/,/, "delimiter.comma"],

                    // Flow Mapping Key:Value delimiter
                    [/:(?= )/, "operators"],

                    // Flow Mapping Key:Value key
                    [/(?:".*?"|'.*?'|[^,\{\[]+?)(?=: )/, "type"],

                    // Start Flow Style
                    { include: "@flowCollections" },
                    { include: "@flowScalars" },

                    // Scalar Data types
                    { include: "@tagHandle" },
                    { include: "@anchor" },
                    { include: "@flowNumber" },

                    // Other value (keyword or string)
                    [
                        /[^\},]+/,
                        {
                            cases: {
                                "@keywords": "keyword",
                                "@default": "string",
                            },
                        },
                    ],
                ],

                // Flow Collection: Flow Sequence
                array: [
                    { include: "@whitespace" },
                    { include: "@comment" },

                    // Flow Sequence termination
                    [/\]/, "@brackets", "@pop"],

                    // Flow Sequence delimiter
                    [/,/, "delimiter.comma"],

                    // Start Flow Style
                    { include: "@flowCollections" },
                    { include: "@flowScalars" },

                    // Scalar Data types
                    { include: "@tagHandle" },
                    { include: "@anchor" },
                    { include: "@flowNumber" },

                    // Other value (keyword or string)
                    [
                        /[^\],]+/,
                        {
                            cases: {
                                "@keywords": "keyword",
                                "@default": "identifier",
                            },
                        },
                    ],
                ],

                // First line of a Block Style
                multiString: [[/^([ \t]+).*?$/, "string", "@multiStringContinued.$1"]],

                // Further lines of a Block Style
                //   Workaround for indentation detection
                multiStringContinued: [
                    [/^(?!$S2).+$/, { token: "@rematch", next: "@popall" }],
                    [/^.*$/, { token: "string" }],
                ],

                whitespace: [[/[ \t\r\n]+/, "white"]],

                // Only line comments
                comment: [[/#.*$/, "comment"]],

                // Start Flow Collections
                flowCollections: [
                    [/\[/, "@brackets", "@array"],
                    [/\{/, "@brackets", "@object"],
                ],

                // Start Flow Scalars (quoted strings)
                flowScalars: [
                    [/"([^"\\]|\\.)*$/, "string.invalid"],
                    [/'([^'\\]|\\.)*$/, "string.invalid"],
                    [/'[^']*'/, "string"],
                    [/"/, "string", "@doubleQuotedString"],
                ],

                doubleQuotedString: [
                    [/[^\\"]+/, "string"],
                    [/@escapes/, "string.escape"],
                    [/\\./, "string.escape.invalid"],
                    [/"/, "string", "@pop"],
                ],

                // Start Block Scalar
                blockStyle: [[/[>|][0-9]*[+-]?[ \t]*$/, "operators", "@multiString"]],

                // Numbers in Flow Collections (terminate with ,]})
                flowNumber: [
                    [/@numberInteger(?=[ \t]*[,\]\}])/, "number"],
                    [/@numberFloat(?=[ \t]*[,\]\}])/, "number.float"],
                    [/@numberOctal(?=[ \t]*[,\]\}])/, "number.octal"],
                    [/@numberHex(?=[ \t]*[,\]\}])/, "number.hex"],
                    [/@numberInfinity(?=[ \t]*[,\]\}])/, "number.infinity"],
                    [/@numberNaN(?=[ \t]*[,\]\}])/, "number.nan"],
                    [/@numberDate(?=[ \t]*[,\]\}])/, "number.date"],
                ],

                tagHandle: [
                    [/\!lambda /, "tag", "@lambda"],
                    [/\![^ ]*/, "tag"],
                ],

                anchor: [[/[&*][^ ]+/, "namespace"]],

                lambda: [
                    [
                        /[ \t]*[>|][0-9]*[+-]?[ \t]*$/,
                        { token: "operators", switchTo: "@lambdaBlock" },
                    ],
                    [
                        /[ \t]*(['"])/,
                        { token: "string", switchTo: "@lambdaString.$1", nextEmbedded: "cpp" },
                    ],
                    [
                        /.+$/,
                        { token: "@rematch", switchTo: "@lambdaLine", nextEmbedded: "cpp" },
                    ],
                ],

                lambdaBlock: [
                    [
                        /^([ \t]+).*?$/,
                        {
                            token: "@rematch",
                            switchTo: "@lambdaBlockContinued.$1",
                            nextEmbedded: "cpp",
                        },
                    ],
                ],

                lambdaBlockContinued: [
                    [
                        /^(?!$S2).+$/,
                        { token: "@rematch", next: "@pop", nextEmbedded: "@pop" },
                    ],
                    [/^.*$/, { token: "" }],
                ],

                lambdaString: [
                    [/$S2/, { token: "string", next: "@pop", nextEmbedded: "@pop" }],
                    [/./, { token: "" }],
                ],

                lambdaLine: [
                    [/$/, { token: "@rematch", next: "@pop", nextEmbedded: "@pop" }],
                    [/./, { token: "" }],
                ],
            },
        });

        monaco.languages.setMonarchTokensProvider("cpp", {
            defaultToken: "",
            tokenPostfix: ".cpp",

            brackets: [
                { token: "delimiter.curly", open: "{", close: "}" },
                { token: "delimiter.parenthesis", open: "(", close: ")" },
                { token: "delimiter.square", open: "[", close: "]" },
                { token: "delimiter.angle", open: "<", close: ">" },
            ],

            keywords: [
                "abstract",
                "amp",
                "array",
                "auto",
                "bool",
                "break",
                "case",
                "catch",
                "char",
                "class",
                "const",
                "constexpr",
                "const_cast",
                "continue",
                "cpu",
                "decltype",
                "default",
                "delegate",
                "delete",
                "do",
                "double",
                "dynamic_cast",
                "each",
                "else",
                "enum",
                "event",
                "explicit",
                "export",
                "extern",
                "false",
                "final",
                "finally",
                "float",
                "for",
                "friend",
                "gcnew",
                "generic",
                "goto",
                "if",
                "in",
                "initonly",
                "inline",
                "int",
                "interface",
                "interior_ptr",
                "internal",
                "literal",
                "long",
                "mutable",
                "namespace",
                "new",
                "noexcept",
                "nullptr",
                "__nullptr",
                "operator",
                "override",
                "partial",
                "pascal",
                "pin_ptr",
                "private",
                "property",
                "protected",
                "public",
                "ref",
                "register",
                "reinterpret_cast",
                "restrict",
                "return",
                "safe_cast",
                "sealed",
                "short",
                "signed",
                "sizeof",
                "static",
                "static_assert",
                "static_cast",
                "struct",
                "switch",
                "template",
                "this",
                "thread_local",
                "throw",
                "tile_static",
                "true",
                "try",
                "typedef",
                "typeid",
                "typename",
                "union",
                "unsigned",
                "using",
                "virtual",
                "void",
                "volatile",
                "wchar_t",
                "where",
                "while",

                "_asm", // reserved word with one underscores
                "_based",
                "_cdecl",
                "_declspec",
                "_fastcall",
                "_if_exists",
                "_if_not_exists",
                "_inline",
                "_multiple_inheritance",
                "_pascal",
                "_single_inheritance",
                "_stdcall",
                "_virtual_inheritance",
                "_w64",

                "__abstract", // reserved word with two underscores
                "__alignof",
                "__asm",
                "__assume",
                "__based",
                "__box",
                "__builtin_alignof",
                "__cdecl",
                "__clrcall",
                "__declspec",
                "__delegate",
                "__event",
                "__except",
                "__fastcall",
                "__finally",
                "__forceinline",
                "__gc",
                "__hook",
                "__identifier",
                "__if_exists",
                "__if_not_exists",
                "__inline",
                "__int128",
                "__int16",
                "__int32",
                "__int64",
                "__int8",
                "__interface",
                "__leave",
                "__m128",
                "__m128d",
                "__m128i",
                "__m256",
                "__m256d",
                "__m256i",
                "__m512",
                "__m512d",
                "__m512i",
                "__m64",
                "__multiple_inheritance",
                "__newslot",
                "__nogc",
                "__noop",
                "__nounwind",
                "__novtordisp",
                "__pascal",
                "__pin",
                "__pragma",
                "__property",
                "__ptr32",
                "__ptr64",
                "__raise",
                "__restrict",
                "__resume",
                "__sealed",
                "__single_inheritance",
                "__stdcall",
                "__super",
                "__thiscall",
                "__try",
                "__try_cast",
                "__typeof",
                "__unaligned",
                "__unhook",
                "__uuidof",
                "__value",
                "__virtual_inheritance",
                "__w64",
                "__wchar_t",
            ],

            operators: [
                "=",
                ">",
                "<",
                "!",
                "~",
                "?",
                ":",
                "==",
                "<=",
                ">=",
                "!=",
                "&&",
                "||",
                "++",
                "--",
                "+",
                "-",
                "*",
                "/",
                "&",
                "|",
                "^",
                "%",
                "<<",
                ">>",
                "+=",
                "-=",
                "*=",
                "/=",
                "&=",
                "|=",
                "^=",
                "%=",
                "<<=",
                ">>=",
            ],

            // we include these common regular expressions
            symbols: /[=><!~?:&|+\-*\/\^%]+/,
            escapes:
                /\\(?:[0abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,
            integersuffix: /([uU](ll|LL|l|L)|(ll|LL|l|L)?[uU]?)/,
            floatsuffix: /[fFlL]?/,
            encoding: /u|u8|U|L/,

            // The main tokenizer for our languages
            tokenizer: {
                root: [
                    // C++ 11 Raw String
                    [
                        /@encoding?R\"(?:([^ ()\\\t]*))\(/,
                        { token: "string.raw.begin", next: "@raw.$1" },
                    ],

                    // identifiers and keywords
                    [
                        /[a-zA-Z_]\w*/,
                        {
                            cases: {
                                "@keywords": { token: "keyword.$0" },
                                "@default": "identifier",
                            },
                        },
                    ],

                    // The preprocessor checks must be before whitespace as they check /^\s*#/ which
                    // otherwise fails to match later after other whitespace has been removed.

                    // Inclusion
                    [
                        /^\s*#\s*include/,
                        { token: "keyword.directive.include", next: "@include" },
                    ],

                    // Preprocessor directive
                    [/^\s*#\s*\w+/, "keyword.directive"],

                    // whitespace
                    { include: "@whitespace" },

                    // [[ attributes ]].
                    [/\[\s*\[/, { token: "annotation", next: "@annotation" }],
                    // delimiters and operators
                    [/[{}()<>\[\]]/, "@brackets"],
                    [
                        /@symbols/,
                        {
                            cases: {
                                "@operators": "delimiter",
                                "@default": "",
                            },
                        },
                    ],

                    // numbers
                    [/\d*\d+[eE]([\-+]?\d+)?(@floatsuffix)/, "number.float"],
                    [/\d*\.\d+([eE][\-+]?\d+)?(@floatsuffix)/, "number.float"],
                    [/0[xX][0-9a-fA-F']*[0-9a-fA-F](@integersuffix)/, "number.hex"],
                    [/0[0-7']*[0-7](@integersuffix)/, "number.octal"],
                    [/0[bB][0-1']*[0-1](@integersuffix)/, "number.binary"],
                    [/\d[\d']*\d(@integersuffix)/, "number"],
                    [/\d(@integersuffix)/, "number"],

                    // delimiter: after number because of .\d floats
                    [/[;,.]/, "delimiter"],

                    // strings
                    [/"([^"\\]|\\.)*$/, "string.invalid"], // non-teminated string
                    [/"/, "string", "@string"],

                    // characters
                    [/'[^\\']'/, "string"],
                    [/(')(@escapes)(')/, ["string", "string.escape", "string"]],
                    [/'/, "string.invalid"],
                ],

                whitespace: [
                    [/[ \t\r\n]+/, ""],
                    [/\/\*\*(?!\/)/, "comment.doc", "@doccomment"],
                    [/\/\*/, "comment", "@comment"],
                    [/\/\/.*\\$/, "comment", "@linecomment"],
                    [/\/\/.*$/, "comment"],
                ],

                comment: [
                    [/[^\/*]+/, "comment"],
                    [/\*\//, "comment", "@pop"],
                    [/[\/*]/, "comment"],
                ],

                //For use with continuous line comments
                linecomment: [
                    [/.*[^\\]$/, "comment", "@pop"],
                    [/[^]+/, "comment"],
                ],

                //Identical copy of comment above, except for the addition of .doc
                doccomment: [
                    [/[^\/*]+/, "comment.doc"],
                    [/\*\//, "comment.doc", "@pop"],
                    [/[\/*]/, "comment.doc"],
                ],

                string: [
                    [/[^\\"]+/, "string"],
                    [/@escapes/, "string.escape"],
                    [/\\./, "string.escape.invalid"],
                    [/"/, "string", "@pop"],
                ],

                raw: [
                    [/[^)]+/, "string.raw"],
                    [/\)$S2\"/, { token: "string.raw.end", next: "@pop" }],
                    [/\)/, "string.raw"],
                ],

                annotation: [
                    { include: "@whitespace" },
                    [/using|alignas/, "keyword"],
                    [/[a-zA-Z0-9_]+/, "annotation"],
                    [/[,:]/, "delimiter"],
                    [/[()]/, "@brackets"],
                    [/\]\s*\]/, { token: "annotation", next: "@pop" }],
                ],

                include: [
                    [
                        /(\s*)(<)([^<>]*)(>)/,
                        [
                            "",
                            "keyword.directive.include.begin",
                            "string.include.identifier",
                            { token: "keyword.directive.include.end", next: "@pop" },
                        ],
                    ],
                    [
                        /(\s*)(")([^"]*)(")/,
                        [
                            "",
                            "keyword.directive.include.begin",
                            "string.include.identifier",
                            { token: "keyword.directive.include.end", next: "@pop" },
                        ],
                    ],
                ],
            },
        });
        initEsphomeMonacoValidation(monaco);
    }
};

// ---- ESPhome Monaco validation over websocket ----
const ESPHOME_ACE_WS_URL = protoInfraUrls.esphome.wss+"/esphome/ace";
export const ESPHOME_VALIDATION_EVENT = "esphome-validation-status";
const WS_OPEN = 1;
const WS_CLOSED = 3;

function initEsphomeMonacoValidation(monaco: any) {
    let ws: WebSocket | null = null;
    let lastValidatedModelUri: string | null = null;
    let lastValidationPayload: string | null = null;

    const emitValidationState = (hasErrors: boolean, errors: string[] = []) => {
        if (typeof window === "undefined") {
            return;
        }
        const payload = JSON.stringify({ hasErrors, errors });
        if (lastValidationPayload === payload) {
            return;
        }
        lastValidationPayload = payload;
        window.dispatchEvent(
            new CustomEvent(ESPHOME_VALIDATION_EVENT, {
                detail: { hasErrors, errors },
            }),
        );
    };

    const resolveEsphomeModel = () => {
        if (lastValidatedModelUri) {
            const existingModel = monaco.editor
                .getModels()
                .find((m: any) => m.uri.toString() === lastValidatedModelUri);
            if (existingModel) {
                return existingModel;
            }
        }
        return monaco.editor.getModels().find((m: any) => {
            const lang = m.getLanguageId ? m.getLanguageId() : m.getModeId?.();
            return lang === "esphome";
        });
    };

    const clearEsphomeMarkers = () => {
        const model = resolveEsphomeModel();
        if (model) {
            monaco.editor.setModelMarkers(model, "esphome", []);
        }
        emitValidationState(false, []);
    };

    const ensureSocket = () => {
        if (ws && ws.readyState !== WS_CLOSED) {
            return;
        }

        ws = new WebSocket(ESPHOME_ACE_WS_URL);

        ws.addEventListener("open", () => {
            // On connection send {"type":"spawn"}
            try {
                const msg = JSON.stringify({ type: "spawn" });
                ws!.send(msg);
            } catch (err) {
                console.error("[ESPHome Monaco] failed to send spawn", err);
            }
        });

        ws.addEventListener("message", (event) => {
            try {
                const raw = JSON.parse(event.data);
                if (raw.event !== "line") {
                    return;
                }

                const msg = JSON.parse(raw.data);

                // if (msg.type === "version") {
                //     setSchemaVersion(msg.value);
                //     return;
                // }

                if (msg.type !== "result") {
                    return;
                }

                const markers: any[] = [];
                const collectedMessages: string[] = [];

                const validationErrors = (msg.validation_errors ?? []).slice().reverse();
                const yamlErrors = msg.yaml_errors ?? [];

                for (const v of validationErrors) {
                    const marker: any = {
                        message: v.message,
                        severity: monaco.MarkerSeverity.Error,
                        startLineNumber: 1,
                        startColumn: 1,
                        endLineNumber: 1,
                        endColumn: 1,
                    };
                    if (v.range) {
                        marker.startLineNumber = v.range.start_line + 1;
                        marker.startColumn = v.range.start_col + 1;
                        marker.endLineNumber = v.range.end_line + 1;
                        marker.endColumn = v.range.end_col + 1;
                    }
                    markers.push(marker);
                    if (v.message) {
                        collectedMessages.push(v.message);
                    }
                }

                for (const v of yamlErrors) {
                    const yamlError = (v.message as string).match(
                        /Invalid YAML syntax:[\r\n][\r\n](.*)[\r\n]\s\sin "([^"]*)", line (\d*), column (\d*):/,
                    );

                    if (yamlError) {
                        markers.push({
                            message: yamlError[1],
                            severity: monaco.MarkerSeverity.Error,
                            startLineNumber: parseInt(yamlError[3], 10),
                            startColumn: parseInt(yamlError[4], 10),
                            endLineNumber: 0,
                            endColumn: 0,
                        });
                        collectedMessages.push(yamlError[1]);
                    } else {
                        markers.push({
                            message: v.message,
                            severity: monaco.MarkerSeverity.Error,
                            startLineNumber: v.range?.start_line ?? 0,
                            startColumn: v.range?.start_col ?? 1,
                            endLineNumber: v.range?.end_line ?? 0,
                            endColumn: v.range?.end_col ?? 1,
                        });
                        if (v.message) {
                            collectedMessages.push(v.message as string);
                        }
                    }
                }

                // Apply markers to the last validated ESPhome model
                const model = resolveEsphomeModel();
                if (!model) {
                    console.warn("[ESPHome Monaco] no model found to apply markers");
                    return;
                }
                monaco.editor.setModelMarkers(model, "esphome", markers);
                emitValidationState(markers.length > 0, collectedMessages);
            } catch (err) {
                console.error("[ESPHome Monaco] error handling websocket message", err);
            }
        });

        ws.addEventListener("close", () => {
            ws = null;
            clearEsphomeMarkers();
            setTimeout(ensureSocket, 5000);
        });

        ws.addEventListener("error", (err) => {
            console.error("[ESPHome Monaco] WebSocket error", err);
            if (!ws || ws.readyState !== WS_OPEN) {
                clearEsphomeMarkers();
            }
        });
    };

    const attachModel = (model: any) => {
        const languageId = model.getLanguageId
            ? model.getLanguageId()
            : model.getModeId
                ? model.getModeId()
                : null;
        if (languageId !== "esphome") {
            return;
        }

        ensureSocket();

        const doValidate = () => {
            if (!ws || ws.readyState !== WS_OPEN) {
                console.log("[ESPHome Monaco] doValidate aborted, socket not open");
                return;
            }

            lastValidatedModelUri = model.uri.toString();
            const content = model.getValue();
            // Every time content changes:
            // send {"type":"stdin","data":"{\"type\":\"validate\",\"file\":\"config.yaml\"}\n"}
            try {
                const validatePayload = {
                    type: "stdin",
                    data: `${JSON.stringify({
                        type: "validate",
                        file: "config.yaml",
                    })}\n`,
                };
                ws.send(JSON.stringify(validatePayload));
            } catch (err) {
                console.error("[ESPHome Monaco] failed to send validate", err);
            }

            // and {"type":"stdin","data":"{\"type\":\"file_response\",\"content\":\"...\"}\n"}
            try {
                const filePayload = {
                    type: "stdin",
                    data: `${JSON.stringify({
                        type: "file_response",
                        content,
                    })}\n`,
                };
                ws.send(JSON.stringify(filePayload));
            } catch (err) {
                console.error("[ESPHome Monaco] failed to send file_response", err);
            }
        };

        const debouncedValidate = debounce(() => {
            doValidate();
        }, 250);

        model.onDidChangeContent(() => {
            debouncedValidate();
        });

        // initial validation on attach
        debouncedValidate();
    };

    // Attach to already existing models
    monaco.editor.getModels().forEach(attachModel);

    // Attach to future models
    monaco.editor.onDidCreateModel((model: any) => {
        attachModel(model);
    });
}
