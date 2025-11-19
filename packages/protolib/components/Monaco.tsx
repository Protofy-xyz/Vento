import React, { useEffect, useMemo } from 'react';
import Editor, { EditorProps, useMonaco, loader } from '@monaco-editor/react';
import useKeypress from 'react-use-keypress';
import { useThemeSetting } from '@tamagui/next-theme';
import { useTheme } from '@my/ui';
import { useTint } from '../lib/Tints'
import { Tinted } from './Tinted'
import convert from 'color-convert';

// loader.config({
//     paths: {
//         vs: '/public/monaco',
//     },
// });

function toHex(colorStr) {
    // Hex directo
    if (/^#([0-9a-f]{3,8})$/i.test(colorStr)) {
        // normalizamos a #RRGGBB
        const hex = colorStr.replace(/^#/, "");
        if (hex.length === 3) {
            return (
                "#" +
                hex
                    .split("")
                    .map((c) => c + c)
                    .join("")
                    .toUpperCase()
            );
        }
        return "#" + hex.slice(0, 6).toUpperCase();
    }

    // RGB(a)
    let m = colorStr.match(
        /^rgba?\(([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*[\d.]+)?\)$/i
    );
    if (m) {
        const [r, g, b] = m.slice(1, 4).map(Number);
        return "#" + convert.rgb.hex(r, g, b);
    }

    // HSL(a)
    m = colorStr.match(
        /^hsla?\(([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%(?:\s*,\s*[\d.]+)?\)$/i
    );
    if (m) {
        const [h, s, l] = m.slice(1, 4).map(Number);
        return "#" + convert.hsl.hex(h, s, l);
    }

    throw new Error("Formato de color no reconocido: " + colorStr);
}

type Props = {
    darkMode?: boolean,
    autofocus?: boolean,
    sourceCode: string,
    onChange?: any,
    onSave?: any,
    onBlur?: any,
    onEscape?: any,
    onLoad?: any,
    path?: string,
    bgColorDark?: string,
    bgColorLight?: string,
    colors?: {
        [key: string]: string;
    }
};

function hslToRgb(h, s, l) {
    let r, g, b;

    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };

        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }

    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function hslStringToHex(hslStr) {
    const matches = hslStr.match(/^hsl\((\d+),\s*([\d.]+)%,\s*([\d.]+)%\)$/i);

    if (!matches) return null;

    const [h, s, l] = [matches[1] / 360, matches[2] / 100, matches[3] / 100];
    const [r, g, b] = hslToRgb(h, s, l);

    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
}


export const Monaco = ({
    path = '',
    sourceCode,
    onChange = () => { },
    onSave = () => { },
    onEscape = () => { },
    onBlur = () => { },
    onLoad = (monaco) => { },
    colors = {},
    autofocus = false,
    ...props
}: Props & EditorProps) => {
    const { options, ...restProps } = props;
    const { resolvedTheme } = useThemeSetting();
    const monaco = useMonaco();
    const customThemeName = 'myCustomTheme';

    const theme = useTheme()
    const { tint } = useTint()
    let tokenColor = theme[tint + '10'].val
    tokenColor = tokenColor.startsWith('hsl') ? hslStringToHex(tokenColor) : tokenColor

    let lightTokenColor = theme[tint + '7'].val
    lightTokenColor = lightTokenColor.startsWith('hsl') ? hslStringToHex(lightTokenColor) : lightTokenColor
    // console.log('token color: ', theme[tint+'10'].val, tokenColor)   
    useEffect(() => {
        if (!monaco) return;

        monaco.editor.defineTheme(customThemeName, {
            base: resolvedTheme === 'dark' ? 'vs-dark' : 'vs',
            inherit: true,
            rules: [
                { token: 'keyword', foreground: tokenColor },
                { token: 'inKeyword', foreground: lightTokenColor },
                { token: 'punctuation', foreground: tokenColor },
            ],
            colors: {
                'editor.background': '#ffffff00',
                ...colors
            }
        });

        monaco.editor.setTheme(customThemeName);

        // Solo registrar si no se ha hecho ya
        if (!monaco.languages.getLanguages().some(lang => lang.id === 'gherkin')) {
            monaco.languages.register({ id: 'gherkin' });

            monaco.languages.setMonarchTokensProvider('gherkin', {
                tokenizer: {
                    root: [
                        [/(Feature:|Scenario:|Rule:|Example:)/, 'comment'],
                        [/(Given|When|Then|And|But)/, 'keyword'],
                        [/"[^"]*"/, 'string'],
                        [/#.*/, 'comment'],
                    ]
                }
            });
        }
        
        onLoad(monaco);
    }, [monaco, resolvedTheme, tokenColor, lightTokenColor]);

    const editorOptions = useMemo(() => {
        const defaultOptions = {
            minimap: { enabled: false },
        };

        if (!options) {
            return defaultOptions;
        }

        return {
            ...defaultOptions,
            ...options,
            minimap: {
                ...defaultOptions.minimap,
                ...(options.minimap ?? {}),
            },
        };
    }, [options]);

    const handleEditorDidMount = (editor, monaco) => {

        monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
            noSemanticValidation: true,
            noSyntaxValidation: true
        });

        monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
            noSemanticValidation: true,
            noSyntaxValidation: true
        });

        editor.onDidBlurEditorText(() => onBlur());

        if (autofocus) {
            requestAnimationFrame(() => {
                editor.layout();
                editor.focus();
            });
        }
    };
    if (onSave) {
        useKeypress(['s', 'S'], (event) => {
            if ((event.key === "s" || event.key === "S") && (event.ctrlKey || event.metaKey)) {
                event.preventDefault();
                onSave();
            }
        });
    }

    if (onEscape) {
        useKeypress(['Escape'], (event) => {
            if (event.key === "Escape") {
                event.preventDefault();
                onEscape();
            }
        });
    }
    const extensionToLang = {
        'feature': 'gherkin'
    }
    const ext = path.split('.').pop()
    return (
        <Tinted><Editor
            onMount={handleEditorDidMount}
            path={path}
            theme={monaco ? customThemeName : undefined}
            value={sourceCode}
            onChange={onChange}
            defaultLanguage={extensionToLang[ext]}
            options={editorOptions}
            {...restProps}
        /></Tinted>
    );
};
