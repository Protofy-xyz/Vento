import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Tinted } from "./Tinted";
import { Pencil, Save, X, Check, ClipboardPaste } from "@tamagui/lucide-icons";
import { useEffect, useRef, useState } from "react";
import { Monaco } from "./Monaco";
import { useThemeSetting } from "@tamagui/next-theme";
import useKeypress from "react-use-keypress";
import { StackProps, XStack, YStack } from "@my/ui";
import { v4 as uuid } from "uuid";
import { InteractiveIcon } from "./InteractiveIcon";

function escapeMarkdownForTemplate(md: string) {
  return md;
}

async function copyToClipboardSafe(text: string) {
  if (navigator?.clipboard && window?.isSecureContext) {
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

type MarkdownProps = {
  data: any;
  readOnly?: boolean;
  copyToClipboardEnabled?: boolean;
  setData?: (val: string) => void;
} & StackProps

export function Markdown({ data, readOnly = false, copyToClipboardEnabled = true, setData = undefined, ...props }: MarkdownProps) {
  const text = data ? (typeof data === "string" ? data : String(data)) : "";
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const { resolvedTheme } = useThemeSetting();
  const id = uuid();
  const code = useRef(text);
  const originalBeforeEdit = useRef(text);
  const isHttp = window.location.protocol === "http:";
  const isLocalhost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  const disableCopy = copyToClipboardEnabled ? isHttp && !isLocalhost : true;
  const normalizedText = text;

  const save = () => {
    if (setData) setData(escapeMarkdownForTemplate(code.current));
    setEditing(false);
  };

  const cancel = () => {
    code.current = originalBeforeEdit.current; // revertir cambios
    setEditing(false);
  };

  useKeypress(["Escape"], (event) => {
    if (editing) {
      cancel();
      event.preventDefault();
    }
  });

  const handleCopy = async () => {
    const toCopy = editing ? code.current : normalizedText;
    const ok = await copyToClipboardSafe(toCopy);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  useEffect(() => {
    if (data) {
      code.current = escapeMarkdownForTemplate(data);
      if (!editing) originalBeforeEdit.current = code.current;
    }
  }, [data, editing]);

  return <YStack className="no-drag markdown-body" f={1} w="100%" p="$3" bc="var(--bg-color)" onHoverIn={() => setIsHovered(true)} onHoverOut={() => setIsHovered(false)} {...props}>
    {/* Toolbar */}
    <XStack jc="flex-end" gap="$0.5"  >
      {
        (!disableCopy && !editing)
        && <InteractiveIcon
          opacity={isHovered ? 1 : 0}
          IconColor={copied ? 'var(--green10)' : 'var(--color10)'}
          Icon={copied ? Check : ClipboardPaste}
          hoverStyle={{ bg: 'transparent', filter: 'brightness(1.2)' }}
          onPress={handleCopy}
          title="Copy to clipboard"
        />
      }
      {!editing ? (
        !readOnly
        && <InteractiveIcon
          Icon={Pencil}
          hoverStyle={{ bg: 'transparent', filter: 'brightness(1.2)' }}
          onPress={() => {
            if (readOnly) return;
            originalBeforeEdit.current = code.current; // snapshot to cancel
            setEditing(true);
          }}
        />
      ) : (
        <>
          <InteractiveIcon
            Icon={X}
            IconColor="var(--red10)"
            hoverStyle={{ bg: 'transparent', filter: 'brightness(1.2)' }}
            onPress={cancel}
            title="Cancel"
          />
          <InteractiveIcon
            Icon={Save}
            hoverStyle={{ bg: 'transparent', filter: 'brightness(1.2)' }}
            onPress={save}
            title="Save"
          />
        </>
      )}
    </XStack>
    {/* Content */}
    <YStack style={{ flex: 1, overflow: "auto" }}>
      {editing ? (
        <Monaco
          key={id}
          height={"100%"}
          path={id + "_markdown.md"}
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
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ node, ...props }) => {
                const target = props.target ?? "_blank";
                const rel = target === "_blank" ? "noopener noreferrer" : undefined;
                return (
                  <a {...props} target={target} rel={rel}>
                    {props.children}
                  </a>
                );
              },
            }}
          >
            {normalizedText}
          </ReactMarkdown>
        </Tinted>
      )}
    </YStack>
  </YStack>
}
