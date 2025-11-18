import { useEffect, useRef } from "react";
import useChat from "../../store/store";
import BotMessage from "./BotMessage";
import UserMessage from "./UserMessage";
import { useEventEffect } from "@extensions/events/hooks";
import { createMessage } from "../../utils/createMessage";
import { YStack } from "tamagui";

export default function Chats() {
  const chats = useChat((state) => state.chats);
  const addChat = useChat((state) => state.addChat);
  const messagesEndRef = useRef(null);

  useEventEffect((payload, msg) => {
    try {
      const parsedMessage = JSON.parse(msg.message);
      const payload = parsedMessage.payload.message
      addChat(createMessage("assistant", payload, "text"));
    } catch (e) {
      console.error(e);
    }
  }, { path: "chat/notifications/#" });

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [chats]);

  return (
    <YStack f={1} overflow="hidden">
      {chats.map((chat, index) =>
        chat.role === "assistant" ? (
          <BotMessage index={index} key={chat.id} chat={chat} />
        ) : (
          <UserMessage chat={chat} chatIndex={index} key={chat.id} />
        )
      )}
      <div ref={messagesEndRef} />
   </YStack>
  );
}
