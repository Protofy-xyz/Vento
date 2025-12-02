const icon = ({ name, size, color = 'var(--color7)', style = '' }) => {
    return `
        <div style="
            width: ${size}px;
            height: ${size}px;
            background-color: ${color};
            mask-image: url(/public/icons/${name}.svg);
            -webkit-mask-image: url(/public/icons/${name}.svg);
            mask-repeat: no-repeat;
            -webkit-mask-repeat: no-repeat;
            mask-size: contain;
            -webkit-mask-size: contain;
            mask-position: center;
            -webkit-mask-position: center;
            ${style}
        "></div>
    `;
};

const cardIcon = ({ data, size, style = '' }) => {
    if (data.displayIcon === false) {
        return '';
    }
    return icon({
        name: data.icon || 'default',
        size: size || '48',
        color: data.color,
        style: style || ''
    });
}

function jsonToDiv(json, indent, expandedDepth) {
    indent = indent || 0;
    expandedDepth = (expandedDepth === undefined) ? 2 : expandedDepth;

    var basePadding = 20;
    var baseFontSize = 14;
    var colors = {
        key: "var(--color10)",
        string: "var(--color7)",
        number: "#005cc5",
        boolean: "#e36209",
        null: "#6a737d",
        bracket: "#999"
    };

    function isObject(val) {
        return val && typeof val === "object" && !Array.isArray(val);
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }

    function createDiv(content, level) {
        var padding = level * basePadding;
        return '<div style="padding-left:' + padding +
            'px; font-family: monospace; font-size:' + baseFontSize +
            'px;">' + content + "</div>";
    }

    function createCollapsible(header, content, closing, level, isExpanded) {
        var padding = level * basePadding;
        if (level === 0 && header === "" && closing === "") {
            // nivel 0 sin encabezado ni cierre (caso especial para objeto raíz sin llaves)
            return content;
        } else if (level === 0) {
            // nivel 0 pero sí con encabezado/cierre (ej: array raíz o fuerza)
            var headerHTML = '<div style="padding-left:' + padding +
                'px; font-family: monospace; font-size:' + baseFontSize +
                'px;">' + header + "</div>";
            var contentHTML = '<div style="display:block;">' + content + "</div>";
            var closingHTML = '<div style="padding-left:' + padding +
                'px; font-family: monospace; font-size:' + baseFontSize +
                'px;">' + closing + "</div>";
            return headerHTML + contentHTML + closingHTML;
        } else {
            var togglerIcon = isExpanded ? "-" : "+";
            var contentDisplay = isExpanded ? "block" : "none";
            var headerHTML =
                '<div style="padding-left:' + padding +
                'px; font-family: monospace; font-size:' + baseFontSize +
                'px;">' +
                '<span style="cursor:pointer;" onclick="(function(el){' +
                'var c = el.parentNode.nextElementSibling;' +
                "if(c.style.display==='none'){ c.style.display='block'; el.innerHTML='-'; }" +
                "else { c.style.display='none'; el.innerHTML='+'; }" +
                '})(this)">' +
                togglerIcon +
                "</span> " +
                header +
                "</div>";
            var contentHTML = '<div style="display:' + contentDisplay + ';">' +
                content + "</div>";
            var closingHTML =
                '<div style="padding-left:' + padding +
                'px; font-family: monospace; font-size:' + baseFontSize +
                'px;">' + closing + "</div>";
            return headerHTML + contentHTML + closingHTML;
        }
    }

    function process(value, level) {
        if (typeof value === "string") {
            if (level === 0) {
                return '<span style="color:' + colors.string + '">' + escapeHtml(value) + '</span>';
            }
            return '<span style="color:' + colors.string + '">"' + escapeHtml(value) + '"</span>';
        } else if (typeof value === "number") {
            return '<span style="color:' + colors.number +
                '">' + value + "</span>";
        } else if (typeof value === "boolean") {
            return '<span style="color:' + colors.boolean +
                '">' + value + "</span>";
        } else if (value === null) {
            return '<span style="color:' + colors.null +
                '">null</span>';
        } else {
            return render(value, level);
        }
    }

    function render(obj, level) {
        if (Array.isArray(obj)) {
            var isExpanded = level < expandedDepth;
            var inner = "";
            for (var i = 0; i < obj.length; i++) {
                inner += jsonToDiv(obj[i], level + 1, expandedDepth);
            }
            return createCollapsible(
                '<span style="color:' + colors.bracket + '">[</span>',
                inner,
                '<span style="color:' + colors.bracket + '">]</span>',
                level,
                isExpanded
            );
        } else if (isObject(obj)) {
            var isExpanded = level < expandedDepth;
            var inner = "";
            for (var key in obj) {
                if (obj.hasOwnProperty(key)) {
                    var keyHtml = '<span style="color:' + colors.key +
                        '">' + escapeHtml(key) + '</span>';
                    var valHtml = process(obj[key], level + 1);
                    inner += createDiv(keyHtml + ": " + valHtml, level + 1);
                }
            }

            // En nivel 0 no renderizamos llaves
            return createCollapsible(
                level === 0 ? "" : '<span style="color:' + colors.bracket + '">{</span>',
                inner,
                level === 0 ? "" : '<span style="color:' + colors.bracket + '">}</span>',
                level,
                isExpanded
            );
        } else {
            return createDiv(process(obj, level), level);
        }
    }

    var parsed;
    try {
        parsed = typeof json === "string" ? JSON.parse(json) : json;
    } catch (e) {
        parsed = json;
    }

    return '<div class="no-drag" style="padding-top: 0px;border-radius: 10px;flex:1;text-align:left; height:100%; background-color: var(--gray1);width: 100%; display:inline-block; white-space:pre-wrap;">' +
        render(parsed, indent) +
        "</div>";
}

const card = ({ content, style = '', padding = false, mode = 'normal' }) => {
    let padd = padding
    if (!padd) {
        if (mode === 'normal') {
            padd = '10px';
        } else if (mode === 'slim') {
            padd = '3px';
        }
    }
    return `
        <div style="
            height: 100%;
            width: 100%;
            padding: ${padd};
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            ${style}
        ">
            ${content}
        </div>
    `;
};

function cardTable(dataArray) {
    if (!Array.isArray(dataArray)) {
        return '<p>Input must be an array of objects</p>';
    }

    const allKeys = Array.from(
        new Set(dataArray.flatMap(item => Object.keys(item)))
    );

    let html = `
    <div style="height: 100%; overflow: auto; width: 100%;">
        <table style="
            border-collapse: collapse;
            width: 100%;
            font-family: sans-serif;
            font-size: 14px;
        ">
            <thead style="color: var(--color9); border-bottom: 1px solid var(--color6);">
                <tr>`;

    for (const key of allKeys) {
        html += `<th style="padding: 8px; text-align: left;">${key}</th>`;
    }

    html += `</tr></thead><tbody>`;

    dataArray.forEach((row, index) => {
        html += `<tr style="
                border-bottom: 1px solid var(--color6);
                transition: background-color 0.2s;
            "
            onmouseover="this.style.backgroundColor='var(--color2, rgba(0,0,0,0.05))'"
            onmouseout="this.style.backgroundColor='transparent'"
        >`;

        for (const key of allKeys) {
            let value = row[key];
            if (typeof value === 'object' && value !== null) {
                value = `<pre style="margin: 0; font-family: monospace; color: var(--color8);">${JSON.stringify(value, null, 2)}</pre>`;
            }
            html += `<td style="padding: 8px; vertical-align: top;">${value !== undefined ? value : ''}</td>`;
        }

        html += '</tr>';
    });

    html += '</tbody></table></div>';
    return html;
}

const iframe = ({ src }) => {
    return `<iframe style="width: 100%;height:100%;" src= "${src}" />`
}


const boardImage = ({ src, alt = '', style = '' }) => {
    return `<img src="${src}" alt="${alt}" style="width: 100%; height: 100%; object-fit: contain; ${style}" />`;
};

const markdown = (card, readOnly = false) => {

    reactCard(`

    function escapeMarkdownForTemplate(md) {
        return md.replace(/\\\\/g, '\\\\\\\\').replace(/\`/g, '\\\\\\\`')
    }

  function Widget(props) {
    const text = props?.value ?? '';
    return (
        <View className="no-drag" height="100%">
            <ProtoThemeProvider forcedTheme={window.TamaguiTheme}>
                <Markdown readOnly={${readOnly}} data={text} setData={(newtext) => setCardData('${card.key}', 'rulesCode', 'return \`'+escapeMarkdownForTemplate(newtext)+'\`')} />
            </ProtoThemeProvider>
        </View>
    );
  }

`, data.domId, data)
};

const fileBrowser = (card) => {
    return reactCard(`
function Widget() {
  return (
    <div className="no-drag" style={{
      height: "100%",
      padding: "1em",
      overflow: "auto",
      fontFamily: "sans-serif",
      fontSize: "14px",
      display: "flex",
      color: "var(--color)"
    }}>
      <Tinted>
        <ProtoThemeProvider forcedTheme={window.TamaguiTheme}>
            <FileBrowser initialPath={"${card.value}"} />
        </ProtoThemeProvider>
      </Tinted>
    </div>
  );
}
  `, card.domId);
};

const youtubeEmbed = ({ url }) => {
    // Extrae el video ID desde una URL de YouTube completa
    const match = url.match(
        /(?:youtube\.com\/.*v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/
    );

    const videoId = match ? match[1] : url; // si ya es solo el ID

    return `
    <iframe
      width="100%"
      height="100%"
      src="https://www.youtube.com/embed/${videoId}"
      frameborder="0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowfullscreen
      style="border: none;"
    ></iframe>
  `;
};

const paramsForm = ({ data }) => {
    const allKeys = Object.keys(data.params || {});

    const actionButtons = {
        "default": `<button
                id="${data.name}-run-button"
                class="no-drag"
                type="submit"
                style="
                    width: 100%;
                    max-width: 100%;
                    padding: 10px;
                    text-align: center;
                    margin-top: 15px;
                    background-color: ${data.color};
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: filter 0.2s ease-in-out;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                "
                onmouseover="this.style.filter='brightness(1.05)'"
                onmouseout="this.style.filter='none'"
                onmousedown="this.style.filter='saturate(1.2) contrast(1.2) brightness(0.85)'"
                onmouseup="this.style.filter='brightness(1.05)'"
            >
                <a style="color: ${data.color};filter: brightness(0.5); font-weight: 400;">
                    ${data.buttonLabel ? data.buttonLabel : "Run"}
                </a>
            </button>`,
        "full": `<button
                id="${data.name}-run-button"
                class="no-drag"
                type="submit"
                style="
                    width: 100%;
                    max-width: 100%;
                    flex: 1;
                    display: flex;
                    padding: 10px;
                    text-align: center;
                    background-color: ${data.color};
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: filter 0.2s ease-in-out;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                "
                onmouseover="this.style.filter='brightness(1.05)'"
                onmouseout="this.style.filter='none'"
                onmousedown="this.style.filter='saturate(1.2) contrast(1.2) brightness(0.85)'"
                onmouseup="this.style.filter='brightness(1.05)'"
            >
                <a style="color: ${data.color};filter: brightness(0.5); font-weight: 400;">
                    ${data.icon && data.displayIcon !== false ? icon({ name: data.icon, size: 48, color: data.color, style: 'margin-left: 5px;' }) : ''}
                    ${data.buttonLabel}
                </a>
            </button>`
    }

    return `<form
            style="width: 100%; height: 100%; display: flex; flex-direction: column; margin-top: ${data.buttonMode == "full" ? "0px" : "15px"};"
            onsubmit='event.preventDefault();const btn = document.getElementById("${data.name}-run-button");const prevCaption = btn.innerHTML; btn.innerHTML = "...";window.executeActionForm(event, "${data.name}").then(() => btn.innerHTML = prevCaption)'
        >
            ${allKeys.map(key => {
        const cfg = data.configParams?.[key] || {};
        const { visible = true, defaultValue = '' } = cfg;
        const placeholder = data.params[key] ?? '';

        if (!visible) {
            return `
                            <input
                                type="hidden"
                                name="${key}"
                                value="${defaultValue}"
                            >
                        `;
        }

        // Check if this is a select field
        const inputType = cfg.type || 'text';
        const selectData = cfg.data || [];
        
        let inputElement;
        if (inputType === 'select' && Array.isArray(selectData) && selectData.length > 0) {
            inputElement = `
                            <select
                                class="no-drag"
                                name="${key}"
                                style="
                                    background-color: var(--gray1);
                                    flex: 1;
                                    padding: 5px 10px;
                                    border: 0.5px solid var(--gray7);
                                    border-radius: 8px;
                                    box-sizing: border-box;
                                    min-width: 100px;
                                    cursor: pointer;
                                "
                            >
                                ${selectData.map(opt => `<option value="${opt}" ${opt === defaultValue ? 'selected' : ''}>${opt}</option>`).join('')}
                            </select>`;
        } else {
            inputElement = `
                            <input
                                class="no-drag"
                                type="text"
                                name="${key}"
                                style="
                                    background-color: var(--gray1);
                                    flex: 1;
                                    padding: 5px 10px;
                                    border: 0.5px solid var(--gray7);
                                    border-radius: 8px;
                                    box-sizing: border-box;
                                    min-width: 100px;
                                "
                                value="${defaultValue}"
                                placeholder="${placeholder}"
                            >`;
        }

        return `
                        <div style="
                            display: flex; 
                            width: 100%; 
                            margin-bottom: 10px;
                            box-sizing: border-box;
                            flex-direction: column;
                        ">
                            <label style="
                                display: inline-block; 
                                font-weight: 500;
                                margin-left: 12px;
                                margin-bottom: 2px;
                                opacity: 0.7;
                                width: 100%;
                                font-size: 14px;
                                margin-right: 10px;
                                text-align: left;
                                white-space: nowrap;
                                overflow: hidden;
                                text-overflow: ellipsis;
                            ">
                                ${key}
                            </label>
                            ${inputElement}
                        </div>
                    `;
    }).join('')
        }
            ${data.type == 'action' ? actionButtons[actionButtons[data.buttonMode] ? data.buttonMode : "default"] : ``}
        </form>`
}

const cardAction = ({ data, content }) => {
    const value = data.value
    let fullHeight = false;
    console.log('cardaction: ', data.value, data.name, typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean')
    if (value !== undefined && typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
        fullHeight = true;
    }
    return `
     <div style="
        display: flex;
        width: 99%;
        height: ${fullHeight || data.buttonMode == "full" ? '100%' : 'auto'};
        flex-direction: column;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
    ">

        ${data.displayResponse !== false ? cardValue({
        value: content ?? data.value ?? 'N/A'
    }) : ''}

        ${data.displayButton !== false ? paramsForm({ data }) : ''}
    </div>
    `;
};

const cardValue = ({ value, style = '', id = null }) => {
    let fullHeight = false;
    //check if value is string, number or boolean
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
        value = jsonToDiv(value);
        fullHeight = true;
    }
    return `
        <div ${id ? 'id="' + id + '"' : ''} style="
            height: ${fullHeight ? '100%' : 'auto'};
            width: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            font-size: 30px;
            font-weight: bold;
            margin-top: 20px;
            white-space: pre-wrap;
            ${style}           
        ">${value}</div>
    `;
}

const SafeProvider = window.Provider || (({ children }) => children);
window.WidgetWrapper = window.WidgetWrapper || (({ children }) =>
    React.createElement(
        SafeProvider,
        { disableRootThemeClass: true },
        React.createElement(ErrorBoundary, {
            fallback: React.createElement('div', { style: { color: 'red' } }, 'Oops')
        }, children)
    )
);

function deepCloneWithoutFunctions(obj) {
    if (typeof obj === 'function') return undefined;
    if (Array.isArray(obj)) return obj.map(deepCloneWithoutFunctions);
    if (obj && typeof obj === 'object') {
        const result = {};
        for (const key in obj) {
            const val = deepCloneWithoutFunctions(obj[key]);
            if (val !== undefined) result[key] = val;
        }
        return result;
    }
    return obj;
}

window.updateReactCardProps = (uuid, newProps) => {
    console.log('🔁 Updating React card props for:', uuid, newProps);
    const target = window._reactWidgets?.[uuid];
    const Component = window._reactWidgetComponents?.[uuid];

    if (!target) {
        console.warn('⚠️ No React root or iframe found for:', uuid);
        return;
    }

    // Si es un iframe (card/reactframe)
    if (target.tagName === 'IFRAME') {
        const safeProps = deepCloneWithoutFunctions(newProps);
        try {
            target.contentWindow?.postMessage({
                type: 'reactCardUpdate',
                props: safeProps
            }, '*');
            console.log('✅ Props sent to iframe:', uuid);
        } catch (err) {
            console.error('❌ Failed to postMessage to iframe:', err);
        }
        return;
    }

    // Si es un ReactDOM root (card/react)
    if (!Component) {
        console.warn('⚠️ No component found for:', uuid);
        return;
    }

    const element = React.createElement(
        window.WidgetWrapper,
        null,
        React.createElement(Component, newProps)
    );

    target.render(element);
};

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }
    static getDerivedStateFromError() {
        return { hasError: true };
    }
    render() {
        if (this.state.hasError) {
            return this.props.fallback ?? React.createElement('div', { style: { color: 'red' } }, 'Oops');
        }
        return this.props.children;
    }
}

window.iframeCard = (html, rootId) => {
    return `
    <iframe
      id="iframe-${rootId}"
      name="${rootId}"
      style="width:calc(100% - 10px);height:calc(100% - 10px);border:none;margin-left:5px;margin-top:5px;background-color:white;"
      sandbox="allow-scripts allow-same-origin"
      csp="
        default-src 'self' https: blob: data:;
        script-src 'unsafe-inline' 'unsafe-eval' https: blob: data:;
        style-src 'unsafe-inline' https:;
        img-src data: https: blob:;
        connect-src https: blob: data:;
        worker-src blob: data:;
        object-src 'none';
      "
      srcdoc="${html ? html.replace(/&/g, "&amp;").replace(/"/g, "&quot;") : `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light dark">
    <title>Vento</title>
    <meta name="description" content="Agent Platform">
    <link
      rel="stylesheet"
      href="/public/pico/css/pico.classless.min.css"
    >
  </head>

  <body style='background-color:white;'>
    <main>
      <section id="typography">
        <h2>Empty card</h2>
        <p>
            Run card to generate content
        </p>
      </section>
    </main>
    <script src="/public/pico/js/minimal-theme-switcher.js"></script>
  </body>
</html>
      `.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"
    ></iframe>
  `;
};

window.reactCard = (jsx, rootId, initialProps = {}) => {
    const isFrameCard = jsx.includes('//@card/reactframe') || jsx.includes('// @card/reactframe');
    //console.log('debugjsx:host:enter', { rootId, isFrameCard, jsxLen: jsx?.length });

    // ----- MODO CLÁSICO -----
    if (!isFrameCard) {
        Object.keys(window.ProtoComponents || {}).forEach(key => {
            window[key] = window.ProtoComponents[key]?.component;
        });

        const jsxCode = `
        ${jsx}

        const container = document.getElementById("${rootId}");

        if (window._reactWidgets?.["${rootId}"]) {
            console.log("Unmounting previous React widget for rootId:", "${rootId}");
            window._reactWidgets["${rootId}"].unmount();
            delete window._reactWidgets["${rootId}"];
            delete window._reactWidgetComponents["${rootId}"];
        } else {
            console.log("Mounting new React widget for rootId:", "${rootId}");    
        }

        const root = ReactDOM.createRoot(container);

        window._reactWidgets = window._reactWidgets || {};
        window._reactWidgets["${rootId}"] = root;

        window._reactWidgetComponents = window._reactWidgetComponents || {};
        window._reactWidgetComponents["${rootId}"] = Widget;

        const element = React.createElement(
          window.WidgetWrapper,
          null,
          React.createElement(Widget, ${JSON.stringify(initialProps)})
        );

        root.render(element);
    `;

        //console.log("Compiling JSX code for rootId:", "${rootId}", jsxCode);

        const compiled = Babel.transform(jsxCode, {
            presets: ['react'],
        }).code;

        eval(compiled);
        return
    }

    // ----- MODO IFRAMED -----
    const target = document.getElementById(rootId);
    if (!target) return console.warn(`⛔ No div found with id "${rootId}"`);

    const safeProps = {};
    for (const k in initialProps) {
        if (typeof initialProps[k] !== 'function') safeProps[k] = initialProps[k];
    }
    safeProps.rootId = rootId;

    target.innerHTML = "";
    const iframe = document.createElement("iframe");
    iframe.id = `iframe-${rootId}`;
    iframe.name = rootId;
    iframe.style.cssText = "width:100%;height:100%;border:none;";
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
    iframe.setAttribute('csp',
        "default-src 'self' https: blob: data:; " +
        "script-src 'unsafe-inline' 'unsafe-eval' https: blob: data:; " +
        "style-src 'unsafe-inline' https:; " +
        "img-src data: https: blob:; " +
        "connect-src https: blob: data:; " +
        "worker-src blob: data:; " +
        "object-src 'none';"
    );

    const srcdoc = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <style>
    html, body, #mount { margin:0; padding:0; width:100%; height:100%; overflow:auto; }
    canvas { display:block; }
    pre { white-space: pre-wrap; }
  </style>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js" onload="console.log('debugjsx:ifr:babel-loaded')"></script>
</head>
<body>
  <div id="mount"></div>
  <script type="module">
    console.log('debugjsx:ifr:script-start');

    function post(tag, data) {
      let msg;
      try { msg = typeof data === 'string' ? data : JSON.stringify(data, (k,v)=> typeof v === 'function' ? '[fn]' : v); }
      catch { msg = String(data); }
      try { window.parent.postMessage({ type:'debugjsx', tag, rootId: window.name, msg }, '*'); } catch {}
      console.log('debugjsx:ifr:'+tag, data);
    }
    let PARENT_ORIGIN = '*';
    function setParentOrigin(o) { PARENT_ORIGIN = o || '*'; }

    // --- API disponible para el JSX ---
    function execute_action(action, payload) {
        window.parent.postMessage(
            { type: 'execute_action', action, rootId: window.name, payload },
            PARENT_ORIGIN
        );
    }
    window.execute_action = execute_action;

    post('boot', { name: window.name });
    window.parent.postMessage({ type: 'iframeReady', rootId: window.name }, '*');

    // Estado persistente dentro del iframe para evitar parpadeos
    let React = null;
    let ReactDOM = null;
    let root = null;                 // ReactDOM root (se crea una sola vez)
    let CurrentWidget = null;        // Componente compilado actual
    let lastUserCode = null;         // Código JSX previo (para recompilar solo si cambia)
    let lastPropsJSON = '';          // Props previas (para evitar renders redundantes)

    async function ensureDeps() {
      if (React && ReactDOM) return;
      try {
        post('deps:begin', {});
        React = await import('https://esm.sh/react@18.2.0');
        ReactDOM = await import('https://esm.sh/react-dom@18.2.0/client');
        window.React = React;
        window.ReactDOM = ReactDOM;
        post('deps:ok', {});
      } catch (err) {
        document.getElementById('mount').innerHTML = '<pre style="color:red">Deps load error: '+(err?.message||err)+'</pre>';
        post('deps:error', err?.message || err);
        throw err;
      }
    }

    function cleanCode(src) {
      return (src || '').split('\\n').filter(l => !l.trim().startsWith('//@')).join('\\n');
    }

    async function compileIfNeeded(userCode) {
      if (!userCode && lastUserCode) {
        // Solo props update: no recompilar
        return false;
      }
      if (!userCode) {
        const mount = document.getElementById('mount');
        mount.innerHTML = '<pre style="color:red">No JSX code provided</pre>';
        post('render:error', 'No JSX code provided');
        throw new Error('No JSX code provided');
      }
      if (userCode === lastUserCode && CurrentWidget) {
        // Código idéntico y ya tenemos Widget
        return false;
      }

      const code = cleanCode(userCode);
      const hasDefault = /(^|\\n)\\s*export\\s+default\\b/m.test(code);
      post('babel:start', { hasDefault });

      const transpiled = window.Babel.transform(code, {
        presets: [['react', { runtime: 'classic' }]],
        filename: 'widget.jsx',
        parserOpts: { sourceType: 'module' }
      }).code;

      const footer = hasDefault ? '' : '\\nexport default (typeof Widget !== "undefined" ? Widget : null);';
      const injectedReactGlobals = \`
const React = window.React;
const ReactDOM = window.ReactDOM;
const execute_action = window.execute_action;
\`;
      const modCode = injectedReactGlobals + '\\n' + transpiled + footer;

      const url = URL.createObjectURL(new Blob([modCode], { type: 'application/javascript' }));
      const mod = await import(url);
      const W = mod.default;

      if (!W) {
        const mount = document.getElementById('mount');
        mount.innerHTML = '<pre style="color:red">No Widget found (default export)</pre>';
        post('render:no-widget', {});
        throw new Error('No Widget found');
      }

      CurrentWidget = W;
      lastUserCode = userCode;
      post('compile:ok', { bytes: modCode.length });
      return true;
    }

    function renderWithProps(props) {
        const mount = document.getElementById('mount');
        if (!root) {
        // Crear root una sola vez → evita parpadeo del canvas
        root = ReactDOM.createRoot(mount);
      }
        const propsWithAPI = { ...props, execute_action };
        const nextJSON = JSON.stringify(propsWithAPI || {});
        if (nextJSON === lastPropsJSON) {
        post('render:skip-same-props', {});
        return;
      }
        lastPropsJSON = nextJSON;
        root.render(React.createElement(CurrentWidget, propsWithAPI));
        post('render:done', {});
    }

    async function handleUpdate(userCode, props) {
      post('render:enter', { len: userCode?.length });
      await ensureDeps();
      const compiled = await compileIfNeeded(userCode);
      // Si se recompiló el componente, simplemente volvemos a renderizar con nuevas props
      renderWithProps(props);
    }

    window.addEventListener('message', (e) => {
        const { type, jsx, props, parentOrigin, rootId } = e.data || {};

        if (type === 'CONFIG' && rootId === window.name && parentOrigin) {
            setParentOrigin(parentOrigin);
            return;
        }

        if (type === 'reactCardUpdate') {
            post('msg:reactCardUpdate', { hasCode: !!jsx });
            handleUpdate(jsx, props);
        }
    });
  </script>
</body>
</html>`;

    const onMessage = (e) => {
        if (e.source !== iframe.contentWindow) return;

        if (e.origin !== location.origin) return;

        const data = e.data || {};
        if (data.rootId !== rootId) return;

        if (data.type === 'execute_action') {
            window.execute_action(data.action, data.payload);
        }

        if (data.type === 'iframeReady' && data.rootId === rootId) {
            console.log('debugjsx:host:iframe-ready', { rootId });
            iframe.contentWindow?.postMessage(
                { type: 'CONFIG', rootId, parentOrigin: location.origin },
                '*'
            );
            iframe.contentWindow?.postMessage({ type: 'reactCardUpdate', jsx, props: safeProps }, '*');
        }
    };

    window._reactWidgetMsgHandlers = window._reactWidgetMsgHandlers || {};
    if (window._reactWidgetMsgHandlers[rootId]) {
        window.removeEventListener('message', window._reactWidgetMsgHandlers[rootId]);
    }
    window._reactWidgetMsgHandlers[rootId] = onMessage;
    window.addEventListener('message', onMessage);

    target.appendChild(iframe);
    const blob = new Blob([srcdoc], { type: 'text/html' });
    iframe.src = URL.createObjectURL(blob);
    console.log('debugjsx:host:iframe-appended', { rootId, iframeId: iframe.id });

    window._reactWidgets = window._reactWidgets || {};
    window._reactWidgets[rootId] = iframe;
};

const getStates = () => {
    return window.protoStates || {};
}

const getActions = () => {
    return window.protoActions || {};
}
const getStorage = (modelName, key = null, defaultValue = {}) => {
    const currentState = getStates();

    const storage = currentState?.objects[modelName] ?? {}
    if (key) {
        return storage[key] ?? defaultValue;
    }
    return storage ?? defaultValue;
}

const getCardAspectRatio = (id) => {
    const div = document.getElementById(id)
    if (div) {
        const rect = div.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;

        const aspectRatio = width / height;

        return aspectRatio
    }
    return 1
}

function useCardAspectRatio(id) {
    const [aspectRatio, setAspectRatio] = React.useState(1);

    React.useEffect(() => {
        const div = document.getElementById(id);
        if (!div) return;

        const heightError = 20; // margin top
        const updateAspectRatio = () => {
            const rect = div.getBoundingClientRect();
            if (rect.height !== 0) {
                setAspectRatio(rect.width / (rect.height - heightError));
            }
        };

        updateAspectRatio(); // calcular al montar

        const resizeObserver = new ResizeObserver(updateAspectRatio);
        resizeObserver.observe(div);

        return () => {
            resizeObserver.disconnect();
        };
    }, [id]);

    return aspectRatio;
}

const useActiveCard = () => {
    const [activeCard, setActiveCard] = React.useState(false);

    return [activeCard, {
        onMouseEnter: () => setActiveCard(true),
        onMouseLeave: () => setActiveCard(false),
    }];
}

const getToken = () => {
    //get token from localStorage, inside session, json decoded in key token
    const session = JSON.parse(localStorage.getItem('session') || '{}');
    return session.token || null;
}
