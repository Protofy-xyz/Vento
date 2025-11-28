// Uses Tamagui tint color variables for avatar colors

function hashCode(str) {
  let hash = 0;
  let i;
  let chr;
  if (str.length === 0) {
    return hash;
  }
  for (i = 0; i < str.length; i += 1) {
    chr = str.charCodeAt(i);
    // eslint-disable-next-line no-bitwise
    hash = ((hash << 5) - hash) + chr;
    // eslint-disable-next-line no-bitwise
    hash |= 0;
  }
  return Math.abs(hash);
}

// Tamagui tint colors (from packages/protolib/lib/Tints.tsx)
const tintColors = ['gray', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red'];

export function cssColorMXID(userId) {
  const colorIndex = hashCode(userId) % tintColors.length;
  return `--${tintColors[colorIndex]}8`;
}

export default function colorMXID(userId) {
  return `var(${cssColorMXID(userId)})`;
}
