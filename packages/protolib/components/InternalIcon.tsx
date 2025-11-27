import type { ComponentType } from "react";
import * as LucideIcons from "@tamagui/lucide-icons";

// Convert kebab-case or lowercase to PascalCase (e.g., "bot-message-square" -> "BotMessageSquare")
const toPascalCase = (str: string): string => {
  return str
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
};

// Get Lucide icon component by name dynamically
const getLucideIcon = (name: string): ComponentType<any> | null => {
  const pascalName = toPascalCase(name);
  return (LucideIcons as Record<string, ComponentType<any>>)[pascalName] || null;
};

export const getIcon = (
  Icon: string | ComponentType<any> | null | undefined,
  opts: { color?: string; size?: number | string; opacity?: number; strokeWidth?: number } = {}
) => {
  const { color = "var(--gray9)", size = 20, opacity = 0.8, strokeWidth = 2 } = opts;

  if (!Icon) {
    return <LucideIcons.Bot color={color} size={size} opacity={opacity} strokeWidth={strokeWidth} />;
  }

  if (typeof Icon === "string") {
    // Try to find a Lucide component dynamically
    const LucideComponent = getLucideIcon(Icon);
    if (LucideComponent) {
      return <LucideComponent color={color} size={size} opacity={opacity} strokeWidth={strokeWidth} />;
    }
    // Fallback to InternalIcon for icons not in Lucide
    return <InternalIcon name={Icon} color={color} size={size} opacity={opacity} />;
  }

  const IconComp = Icon as ComponentType<any>;
  return <IconComp color={color} size={size} opacity={opacity} strokeWidth={strokeWidth} />;
};


export const InternalIcon = ({
  name,
  color = 'var(--gray9)',
  size = 20,
  opacity = 0.8,
}: {
  name: string;
  color?: string;
  size?: number | string;
  opacity?: number;
}) => (
  <div
    style={{
      opacity,
      width: size,
      height: size,
      backgroundColor: color,
      WebkitMask: `url('/public/icons/${name}.svg') center / contain no-repeat`,
      mask: `url('/public/icons/${name}.svg') center / contain no-repeat`,
    }}
  />
);