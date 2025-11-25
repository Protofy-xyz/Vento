export function isElectron() {
    // Renderer process
    if (typeof window !== 'undefined' && typeof window.process === 'object' && window.process.type === 'renderer') {
        return true;
    }

    // Main / Node child processes launched from Electron
    if (typeof process !== 'undefined') {
        if (typeof process.versions === 'object' && !!process.versions.electron) {
            return true;
        }
        // flag inherited from Electron launcher when backend is a child Node process
        if (process.env?.VENTO_ELECTRON === '1' || process.env?.ELECTRON_RUN_AS_NODE === '1') {
            return true;
        }
    }

    // Detect the user agent when the `nodeIntegration` option is set to true
    if (typeof navigator === 'object' && typeof navigator.userAgent === 'string' && navigator.userAgent.indexOf('Electron') >= 0) {
        return true;
    }

    return false;
}