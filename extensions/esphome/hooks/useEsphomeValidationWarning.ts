import { useEffect, useMemo, useState } from "react";
import { ESPHOME_VALIDATION_EVENT } from "../utils";
import { SaveButtonWarning } from "@extensions/files/saveButtonWarning";
import { useThemeSetting } from "@tamagui/next-theme";

export const useEsphomeValidationWarning = (): SaveButtonWarning | undefined => {
  const [state, setState] = useState<{ isActive: boolean; messages: string[] }>({
    isActive: false,
    messages: [],
  });
  const { resolvedTheme } = useThemeSetting();
  const warningColor = resolvedTheme === "dark" ? "#ffb300" : "#ff7300";

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ hasErrors: boolean; errors?: string[] }>).detail;
      setState({
        isActive: !!detail?.hasErrors,
        messages: detail?.errors ?? [],
      });
    };

    window.addEventListener(ESPHOME_VALIDATION_EVENT, handler);
    return () => {
      window.removeEventListener(ESPHOME_VALIDATION_EVENT, handler);
    };
  }, []);

  return useMemo(
    () =>
      ({
        isActive: state.isActive,
        color: warningColor,
        title: "Fix ESPHome validation errors for a successful compile!",
        messages: state.messages,
      } satisfies SaveButtonWarning),
    [state, warningColor],
  );
};
