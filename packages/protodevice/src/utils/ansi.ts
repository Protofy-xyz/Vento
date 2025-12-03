const ANSI_REGEX = /((?:\x1b|\u001b)\[[0-9;]*)([a-zA-Z])/g;

export type AnsiToken = { style: string; text: string };
export type AnsiStyleMap = Record<string, { color: string }>;

export function parseAnsiText(text: string, initialStyle = 'ansiNormal') {
  const tokens: AnsiToken[] = [];
  let currentStyle = initialStyle;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = ANSI_REGEX.exec(text)) !== null) {
    const [full, _sequence, terminator] = match;
    const matchIndex = match.index;

    if (matchIndex > lastIndex) {
      tokens.push({
        style: currentStyle,
        text: text.substring(lastIndex, matchIndex),
      });
    }

    if (terminator === 'm') {
      if (/0m$/.test(full)) {
        currentStyle = 'ansiNormal';
      } else if (/31m$/.test(full)) {
        currentStyle = 'ansiRed';
      } else if (/32m$/.test(full)) {
        currentStyle = 'ansiGreen';
      } else if (/33m$/.test(full)) {
        currentStyle = 'ansiYellow';
      } else if (/34m$/.test(full)) {
        currentStyle = 'ansiBlue';
      } else if (/35m$/.test(full)) {
        currentStyle = 'ansiMagenta';
      } else if (/36m$/.test(full)) {
        currentStyle = 'ansiCyan';
      } else if (/37m$/.test(full)) {
        currentStyle = 'ansiWhite';
      }
    }

    lastIndex = ANSI_REGEX.lastIndex;
  }

  if (lastIndex < text.length) {
    tokens.push({
      style: currentStyle,
      text: text.substring(lastIndex),
    });
  }

  return { tokens, endStyle: currentStyle };
}

export function breakTokensIntoLines(tokens: AnsiToken[]) {
  const lines: AnsiToken[][] = [];
  let currentLine: AnsiToken[] = [];

  tokens.forEach((token) => {
    const parts = token.text.split('\n');
    parts.forEach((part, index) => {
      if (index > 0) {
        lines.push(currentLine);
        currentLine = [];
      }
      if (part.length > 0) {
        currentLine.push({ ...token, text: part });
      }
    });
  });
  if (currentLine.length > 0) lines.push(currentLine);
  return lines;
}

export function createAnsiStyleMap(themeName?: string): AnsiStyleMap {
  const isDark = (themeName || '').toLowerCase().includes('dark');
  if (isDark) {
    return {
      ansiNormal: { color: '#d0d0d0' },
      ansiRed: { color: '#ff5f5f' },
      ansiGreen: { color: '#9ef542' },
      ansiYellow: { color: '#ffd75f' },
      ansiBlue: { color: '#58b7ff' },
      ansiMagenta: { color: '#cf87ff' },
      ansiCyan: { color: '#6ee7ff' },
      ansiWhite: { color: '#ffffff' },
    };
  }
  return {
    ansiNormal: { color: '#444444' },
    ansiRed: { color: '#d12f2f' },
    ansiGreen: { color: '#2f9e44' },
    ansiYellow: { color: '#b88700' },
    ansiBlue: { color: '#1f6feb' },
    ansiMagenta: { color: '#8c4fa8' },
    ansiCyan: { color: '#0b8ba7' },
    ansiWhite: { color: '#222222' },
  };
}
