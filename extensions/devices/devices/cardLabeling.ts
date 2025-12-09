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
