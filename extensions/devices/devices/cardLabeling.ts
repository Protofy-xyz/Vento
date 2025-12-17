type CardLabelContext = {
    platform?: string;
    deviceName: string;
    subsystemName?: string;
    actionName?: string;
    monitorName?: string;
    baseLabel?: string;
    type: 'action' | 'monitor';
};

type Formatter = (ctx: CardLabelContext) => string | undefined;

const formatters = new Map<string, Formatter>();

export const registerCardLabelFormatter = (platform: string, formatter: Formatter) => {
    formatters.set(platform, formatter);
};

const titleize = (value?: string) =>
    (value || '')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .trim();

/**
 * Checks if a string looks like a UUID or hash
 * e.g., "531c40cc_58c0_4766_8821_7b2700000001", "89707d58", "EAB7A68F-EC2B-4487-AADF-D8A91C1CB782"
 */
const isUuidOrHash = (value: string): boolean => {
    if (!value) return false;
    const normalized = value.replace(/[-_\s]/g, '').toLowerCase();
    // Check if it's mostly hex characters and has a typical UUID/hash length
    const hexPattern = /^[a-f0-9]+$/;
    return hexPattern.test(normalized) && normalized.length >= 8;
};

/**
 * Extracts a clean device type from a device name
 * e.g., "android_89707d58" -> "Android", "computer" -> "Computer"
 */
const getDeviceType = (deviceName: string): string => {
    // Remove UUID/hash suffixes (e.g., android_89707d58 -> android)
    const baseType = deviceName.split('_')[0] || deviceName;
    return baseType //titleize(baseType);
};

/**
 * Cleans up a label by removing or simplifying UUID-like parts
 * e.g., "EAB7A68F-EC2B-4487-AADF-D8A91C1CB782 - Take Picture" -> "Take Picture"
 * e.g., "531c40cc_58c0_4766_8821_7b2700000001" -> "Camera"
 */
const cleanLabel = (label: string, fallback: string = 'Camera'): string => {
    if (!label) return fallback;
    
    // Pattern: "UUID - Action Name" or "UUID: Action Name"
    const separatorMatch = label.match(/^[A-Fa-f0-9\-_]+\s*[-:]\s*(.+)$/);
    if (separatorMatch && separatorMatch[1]) {
        return separatorMatch[1].trim();
    }
    
    // If the whole label is a UUID, return fallback
    if (isUuidOrHash(label)) {
        return fallback;
    }
    
    return label;
};

export const buildCardLabel = (ctx: CardLabelContext) => {
    const formatter = ctx.platform ? formatters.get(ctx.platform) : undefined;
    const formatted = formatter?.(ctx);
    if (formatted) return formatted;

    const base = ctx.baseLabel || ctx.actionName || ctx.monitorName;
    if (base) return base;

    if (ctx.actionName) return titleize(ctx.actionName);
    if (ctx.monitorName) return titleize(ctx.monitorName);
    return '';
};

/**
 * Builds a human-readable template name for the card selector
 * 
 * Examples:
 * - Action: "Bluetooth: Write" or "Take Picture (Camera)"
 * - Monitor: "CPU Model" or "Battery Level"
 * 
 * Format: "[Subsystem:] Action/Monitor Name [(Device Type)]"
 */
export const buildCardTemplateName = (ctx: CardLabelContext): string => {
    const deviceType = getDeviceType(ctx.deviceName);
    
    // Check if subsystem name is a UUID (like webcam IDs)
    const subsystemIsUuid = ctx.subsystemName ? isUuidOrHash(ctx.subsystemName) : false;
    
    // Prefer baseLabel if available, otherwise titleize the action/monitor name
    let name = '';
    if (ctx.baseLabel) {
        // Clean the label to remove UUID prefixes like "UUID - Take Picture" -> "Take Picture"
        name = cleanLabel(ctx.baseLabel, subsystemIsUuid ? 'Camera' : titleize(ctx.subsystemName || ''));
    } else if (ctx.type === 'action' && ctx.actionName) {
        name = titleize(ctx.actionName);
    } else if (ctx.type === 'monitor' && ctx.monitorName) {
        name = titleize(ctx.monitorName);
    } else if (ctx.subsystemName && !subsystemIsUuid) {
        name = titleize(ctx.subsystemName);
    }
    
    // For actions, include subsystem as prefix if different from action name
    if (ctx.type === 'action' && ctx.subsystemName && ctx.actionName) {
        const actionTitle = ctx.baseLabel 
            ? cleanLabel(ctx.baseLabel, titleize(ctx.actionName)) 
            : titleize(ctx.actionName);
        
        // If subsystem is a UUID, use a friendly name like "Camera"
        if (subsystemIsUuid) {
            name = `Camera: ${actionTitle}`;
        } else {
            const subsystemTitle = titleize(ctx.subsystemName);
            // Avoid redundancy: don't repeat if subsystem == action name
            if (subsystemTitle.toLowerCase() !== actionTitle.toLowerCase()) {
                name = `${subsystemTitle}: ${actionTitle}`;
            } else {
                name = actionTitle;
            }
        }
    }
    
    // For monitors with subsystem context (when subsystem has single monitor)
    if (ctx.type === 'monitor' && ctx.subsystemName && !ctx.monitorName) {
        if (subsystemIsUuid) {
            // For UUID subsystems like webcams, use "Camera" or the cleaned label
            name = ctx.baseLabel ? cleanLabel(ctx.baseLabel, 'Camera') : 'Camera';
        } else {
            name = titleize(ctx.subsystemName);
        }
    }
    
    // Add device type suffix for clarity in mixed device boards
    if (name && deviceType) {
        return `${name} (${deviceType})`;
    }
    
    return name || `${deviceType} Card`;
};
