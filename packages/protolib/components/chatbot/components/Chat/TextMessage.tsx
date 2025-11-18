import { Check, Clipboard } from "lucide-react";
import { SyncLoader } from "react-spinners";
import useClipboard from "../../hooks/useClipboard";
import useBot from "../../hooks/useBot";
import { ChatMessageType } from "../../store/store";
import Markdown from "react-markdown";
import { API } from "protobase";
import CodeHighlight from "../CodeHighlight/CodeHighlight";
import { PromptAtom } from '../../../../context/PromptAtom';
import { useAtom } from "jotai";
import { InteractiveIcon } from "../../../InteractiveIcon";
import { Button, XStack, YStack, Text } from "tamagui";
import { useEffect, useState } from "react";

type Props = {
  index: number;
  chat: ChatMessageType;
};

export default function TextMessage({ index, chat }: Props) {
  const [promptChain] = useAtom(PromptAtom);
  const { copy, copied } = useClipboard();
  const [applied, setApplied] = useState(false);
  const [rejected, setRejected] = useState(false);
  const [busy, setBusy] = useState(false);

  const prompt: any = promptChain.reduce((total, current) => {
    return total + current.generate();
  }, '') + `
    reply directly to the user, acting as the assistant.
  `;
  const { result, error, isStreamCompleted, cursorRef } = useBot({
    index,
    chat,
    prompt
  });

  const raw = (result ?? "").trim() || (chat.content ?? "");

  let displayText = raw;
  let jsonApproval: {
    boardId?: string;
    action?: string;
    approvalId?: string;
    id?: string;
    message?: string;
    urls?: { accept?: string; reject?: string; status?: string };
  } | null = null;

  if (raw) {
    try {
      const parsed: any = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        if (typeof parsed.response === "string") {
          displayText = parsed.response;
        }
        if (Array.isArray(parsed.approvals) && parsed.approvals.length > 0) {
          jsonApproval = parsed.approvals[0];
        }
      }
    } catch {
      // not JSON, ignore
    }
  }

  if (isStreamCompleted && !raw.trim()) {
    return null;
  }

  if (jsonApproval) {
    const boardId = jsonApproval.boardId;
    const action = jsonApproval.action;
    const approvalId = jsonApproval.approvalId || jsonApproval.id;
    const message = jsonApproval.message || (action ? `The action "${action}" requests approval.` : "This action requests approval.");

    const onAccept = async () => {
      try {
        if (busy || applied) return;
        setBusy(true);
        if (!boardId || !action || !approvalId) return;
        const acceptUrl = jsonApproval.urls?.accept || `/api/core/v1/boards/${encodeURIComponent(boardId)}/actions/${encodeURIComponent(action)}/approvals/${encodeURIComponent(approvalId)}/accept`;
        await API.post(acceptUrl, {});
        setApplied(true);
        setRejected(false);
      } catch (err) {
        console.error('Approval accept error', err);
      } finally {
        setBusy(false);
      }
    };

    const onCancel = async (e) => {
      try {
        if (busy || applied) return;
        setBusy(true);
        if (!boardId || !action || !approvalId) return;
        const rejectUrl = jsonApproval.urls?.reject || `/api/core/v1/boards/${encodeURIComponent(boardId)}/actions/${encodeURIComponent(action)}/approvals/${encodeURIComponent(approvalId)}/reject`;
        await API.post(rejectUrl, {});
        setApplied(true);
        setRejected(true);
      } catch (err) {
        console.error('Approval cancel error', err);
      } finally {
        setBusy(false);
      }
    };

    return <YStack gap="$3" py="$3">
      <Text o={0.6} fow={"600"}>
        {applied ? rejected ? "Request rejected" : "Request applied" : message}
      </Text>
      {!applied && (
        <XStack gap={"$2"}>
          <Button themeInverse bc="$bgPanel" size="$3" onPress={onAccept} disabled={busy}>Accept</Button>
          <Button bc="$bgPanel" size="$3" onPress={onCancel} disabled={busy}>Cancel</Button>
        </XStack>
      )}
    </YStack>
  } else {
    return (
      <YStack jc="flex-start" >
        {!isStreamCompleted && !raw && !error ? (
          <YStack py="$3" px="$4" jc="center" >
            <SyncLoader color="gray" size={8} speedMultiplier={0.5} />
          </YStack>
        ) : (
          <YStack>
            <Markdown
              children={displayText || raw}
              components={{
                code(props) {
                  const { children, className, node, ...rest } = props;
                  const match = /language-(\w+)/.exec(className || "");
                  return match ? (
                    <CodeHighlight language={match[1]}>
                      {String(children).replace(/\n$/, "")}
                    </CodeHighlight>
                  ) : (
                    <code {...rest} className={className?.concat("language")}>
                      {children}
                    </code>
                  );
                },
              }}
            />

            {!isStreamCompleted && !chat.content && (
              <span
                className="ml-1 blink bg-gray-500 dark:bg-gray-200 h-4 w-1 inline-block"
                ref={cursorRef}
              ></span>
            )}
            <XStack>
              {!copied ? (
                <InteractiveIcon
                  Icon={Clipboard}
                  onPress={() => copy(displayText || raw)}
                />
              ) : (
                <InteractiveIcon
                  Icon={Check}
                  onPress={() => copy(displayText || raw)}
                />
              )}
            </XStack>
          </YStack>
        )}
      </YStack>
    );
  }
}
