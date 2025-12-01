import { useEffect, useRef, useState } from "react";
import { StackProps, XStack, YStack, Text, Spinner } from "@my/ui";
import { useThemeSetting } from "@tamagui/next-theme";
import { Tinted } from "./Tinted";
import dynamic from "next/dynamic";

// Dynamic import Monaco with ssr: false to prevent server-side errors
const Monaco = dynamic(() => import("./Monaco").then(m => m.Monaco), {
  ssr: false,
  loading: () => <Spinner />
});
import { InteractiveIcon } from "./InteractiveIcon";
import { Pencil, Save, X, Check, ClipboardPaste } from "@tamagui/lucide-icons";
import useKeypress from "react-use-keypress";
import { v4 as uuid } from "uuid";

async function copyToClipboardSafe(text: string) {
  if ((navigator as any)?.clipboard && (window as any)?.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.left = "0";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();

    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

type HtmlProps = {
  data: any;
  readOnly?: boolean;
  copyToClipboardEnabled?: boolean;
  setData?: (val: string) => void;
} & StackProps;

export function Html({ data, readOnly = false, copyToClipboardEnabled = true, setData = undefined, ...props }: HtmlProps) {
  const parsedhtml = (data !== undefined && data !== null && data != "undefined") ? (typeof data === "string" ? data : String(data)) : "";
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const { resolvedTheme } = useThemeSetting();
  const id = uuid();
  const code = useRef(parsedhtml);
  const originalBeforeEdit = useRef(parsedhtml);
  const isHttp = typeof window !== "undefined" && window.location.protocol === "http:";
  const isLocalhost = typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname);
  const disableCopy = copyToClipboardEnabled ? isHttp && !isLocalhost : true;

  const save = () => {
    if (setData) setData(code.current);
    setEditing(false);
  };

  const cancel = () => {
    code.current = originalBeforeEdit.current;
    setEditing(false);
  };

  useKeypress(["Escape"], (event) => {
    if (editing) {
      cancel();
      event.preventDefault();
    }
  });

  const handleCopy = async () => {
    const toCopy = editing ? code.current : parsedhtml;
    const ok = await copyToClipboardSafe(toCopy);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  useEffect(() => {
    if (data !== undefined) {
      code.current = parsedhtml;
      if (!editing) originalBeforeEdit.current = code.current;
    }
  }, [data, editing]);
  console.log("dev:: Html rendering with data:", { data, parsedhtml, code: code.current });

  return (
    <YStack className="no-drag html-body" f={1} w="100%" h="100%" p="$3" bc="transparent" {...props}>
      <XStack jc="flex-end" gap="$0.5">
        {!disableCopy && !editing && (
          <InteractiveIcon
            IconColor={copied ? "var(--green10)" : "var(--color10)"}
            Icon={copied ? Check : ClipboardPaste}
            hoverStyle={{ bg: "transparent", filter: "brightness(1.2)" }}
            onPress={handleCopy}
            title="Copy to clipboard"
          />
        )}
        {!editing ? (
          !readOnly && (
            <InteractiveIcon
              Icon={Pencil}
              hoverStyle={{ bg: "transparent", filter: "brightness(1.2)" }}
              onPress={() => {
                if (readOnly) return;
                originalBeforeEdit.current = code.current;
                setEditing(true);
              }}
            />
          )
        ) : (
          <>
            <InteractiveIcon
              Icon={X}
              IconColor="var(--red10)"
              hoverStyle={{ bg: "transparent", filter: "brightness(1.2)" }}
              onPress={cancel}
              title="Cancel"
            />
            <InteractiveIcon
              Icon={Save}
              hoverStyle={{ bg: "transparent", filter: "brightness(1.2)" }}
              onPress={save}
              title="Save"
            />
          </>
        )}
      </XStack>

      <YStack style={{ flex: 1, overflow: "auto" }}>
        {editing ? (
          <Monaco
            key={id}
            height={"100%"}
            path={id + "_html.html"}
            darkMode={resolvedTheme === "dark"}
            sourceCode={code.current}
            onChange={(newCode) => {
              code.current = newCode;
            }}
            autofocus={true}
            options={{
              folding: false,
              lineDecorationsWidth: 0,
              lineNumbersMinChars: 0,
              lineNumbers: false,
              minimap: { enabled: false },
              suggestOnTriggerCharacters: false,
              quickSuggestions: false,
              wordBasedSuggestions: false,
              parameterHints: { enabled: false },
              tabCompletion: "off",
            }}
          />
        ) : (
          <Tinted>
            {parsedhtml
              ? <iframe
                id={`iframe-${id}`}
                name={id}
                style={{
                  width: "calc(100% - 10px)",
                  height: "calc(100% - 10px)",
                  border: "none",
                  marginLeft: "5px",
                  marginTop: "5px",
                  backgroundColor: "white",
                }}
                sandbox="allow-scripts allow-same-origin"
                srcDoc={parsedhtml}
              />
              : <YStack f={1} jc="center" ai="center" opacity={0.5}>
                <Text textAlign="center">{"Oops!\n🤔 It seems that there's no \nHTML content to show..."}</Text>
              </YStack>
            }
          </Tinted>

        )}

      </YStack>
    </YStack >
  );
}
