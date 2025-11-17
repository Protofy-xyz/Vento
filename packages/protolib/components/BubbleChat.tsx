import { useState, useEffect, useMemo } from "react";
import { Sparkles, X, Maximize, Minimize, Bot, ChevronDown } from "@tamagui/lucide-icons";
import { Tinted } from "./Tinted";
import { Chat } from "./Chat";
import { YStack, Button, XStack, Paragraph, Spinner, Accordion, SizableText, Square } from "@my/ui";
import { getIcon } from "./InternalIcon";
import { shouldShowInArea } from "protolib/helpers/Visibility";
import { useAgents } from "@extensions/boards/hooks/useAgents";

type Agent = {
  name: string;
  target: string;
  icon?: string | null;
  tags?: string[];
};

const UNTITLED_GROUP = "Agents";

export const BubbleChat = () => {
  const [isChatVisible, setIsChatVisible] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isChatLoaded, setIsChatLoaded] = useState(false);
  const [selectedBot, setSelectedBot] = useState<Agent | null>(null);
  const { agents, loading: loadingBots } = useAgents();

  const bots = useMemo(() => {
    const items = Array.isArray(agents) ? agents : [];

    const parsed = items
      .map((b: any) => {
              // ✅ solo boards visibles en el área "chat"
        if (!shouldShowInArea(b, "chat")) return null;

        const name = b?.name ?? "";
        const target = b?.inputs?.default ?? null;
        const icon = b?.icon ?? null;
        const tags = Array.isArray(b?.tags) ? b.tags.filter(Boolean) : [];

        return name && target
          ? ({ name, target, icon, tags } as Agent)
          : null;
      })
      .filter(Boolean) as Agent[];

    return parsed;
  }, [agents]);


  useEffect(() => {
    if (!bots.length) {
      if (selectedBot) setSelectedBot(null);
      return;
    }

    if (!selectedBot) {
      setSelectedBot(bots[0]);
      return;
    }

    const exists = bots.find((b) => b.name === selectedBot.name);
    if (!exists) {
      setSelectedBot(bots[0] || null);
    }
  }, [bots, selectedBot]);

  const toggleChat = () => {
    if (isChatVisible) {
      setIsChatVisible(false);
      setIsExpanded(false);
    } else {
      if (!isChatLoaded) setIsChatLoaded(true);
      setIsChatVisible(true);
      setIsExpanded(false);
    }
  };

  const toggleExpand = () => setIsExpanded(!isExpanded);

  // Agrupar por tags
  const groups = bots.reduce((acc, bot) => {
    const ts = bot.tags && bot.tags.length ? bot.tags : [UNTITLED_GROUP];
    for (const t of ts) {
      if (!acc[t]) acc[t] = [];
      acc[t].push(bot);
    }
    return acc;
  }, {} as Record<string, Agent[]>);

  const orderedGroupNames = Object.keys(groups).sort((a, b) => a.localeCompare(b));

  return (
    <>
      {/* FAB */}
      <Tinted>
        <Button
          position="absolute"
          bottom={30}
          right={30}
          size="$5"
          circular
          icon={isChatVisible ? <X size="30px" color="white" /> : <Sparkles size="30px" color="white" />}
          onPress={toggleChat}
          zIndex={isExpanded ? 100002 : 10002}
          elevation="$5"
          backgroundColor="$color7"
          hoverStyle={{ backgroundColor: "$color7" }}
        />
      </Tinted>

      {isChatVisible && (
        <Button
          position="absolute"
          bottom={30}
          right={90}
          size="$4"
          circular
          icon={isExpanded ? <Minimize color="white" size="$2" /> : <Maximize color="white" size="$2" />}
          onPress={toggleExpand}
          zIndex={isExpanded ? 100002 : 10002}
          elevation="$5"
          backgroundColor="$color7"
          hoverStyle={{ backgroundColor: "$color7" }}
        />
      )}

      <XStack
        width={isExpanded ? "100vw" : 700}
        height={isExpanded ? "calc(100vh - 0px)" : "calc(100vh - 200px)"}
        maxHeight={isExpanded ? "100vh" : 800}
        position="absolute"
        bottom={isExpanded ? 0 : 110}
        right={isExpanded ? 0 : 30}
        backgroundColor="$bgContent"
        borderRadius={isExpanded ? 0 : "$4"}
        elevation="$6"
        zIndex={100000}
        overflow="hidden"
        display={isChatVisible ? "flex" : "none"}
      >
        {/* Sidebar */}
        <YStack
          width={240}
          backgroundColor="var(--bgPanel)"
          borderRightWidth={1}
          borderRightColor="$gray6"
          overflow="auto"
          p="$3"
          gap="$2"
        >
          <Paragraph mb="$3" color="$color11" fontWeight="700">
            Chatbots
          </Paragraph>

          {loadingBots ? (
            <YStack f={1} ai="center" jc="center" mt="$5">
              <Spinner size="large" color="$color8" />
            </YStack>
          ) : bots.length === 0 ? (
            <Paragraph textAlign="center" size="$4" color="$color11">
              No chatbots available
            </Paragraph>
          ) : (
            <Accordion
              type="multiple"
              defaultValue={orderedGroupNames.map((_, i) => `g${i}`)}
              collapsible
            >
              {orderedGroupNames.map((groupName, idx) => {
                const list = groups[groupName]!;
                return (
                  <Accordion.Item key={groupName} value={`g${idx}`}>
                    <Accordion.Trigger
                      p="$2"
                      br="$4"
                      bw={0}
                      backgroundColor="$backgroundTransparent"
                      focusStyle={{ backgroundColor: "$backgroundTransparent" }}
                      hoverStyle={{ backgroundColor: "$backgroundTransparent" }}
                      flexDirection="row"
                      justifyContent="space-between"
                    >
                      {({ open }) => (
                        <XStack f={1} h="36px" ai="center" px="$2" br="$4">
                          <SizableText f={1} fontWeight="700" size="$4" color="$color11">
                            {groupName}
                          </SizableText>
                          <Square animation="bouncy" rotate={open ? "180deg" : "0deg"}>
                            <ChevronDown size={18} color="var(--gray9)" />
                          </Square>
                        </XStack>
                      )}
                    </Accordion.Trigger>

                    <Accordion.Content pt="$1" pb="$2" p="$0" backgroundColor="transparent">
                      <YStack gap="$1">
                        {list.map((bot) => {
                          const isActive = selectedBot?.name === bot.name;
                          return (
                            <Tinted key={`${groupName}-${bot.name}`}>
                              <Button
                                f={1}
                                mih="$4"
                                mah="$4"
                                overflow="hidden"
                                icon={getIcon(bot.icon, {
                                  color: isActive ? "var(--color10)" : "var(--color11)",
                                  size: 18,
                                })}
                                jc="flex-start"
                                bc={isActive ? "$color2" : "transparent"}
                                hoverStyle={{ bc: "$color2" }}
                                onPress={() => setSelectedBot(bot)}
                              >
                                {bot.name}
                              </Button>
                            </Tinted>
                          );
                        })}
                      </YStack>
                    </Accordion.Content>
                  </Accordion.Item>
                );
              })}
            </Accordion>
          )}
        </YStack>

        {/* Área del chat */}
        <YStack flex={1} position="relative">
          {isChatLoaded && selectedBot && <Chat agent={selectedBot.name} />}
          {!selectedBot && (
            <YStack flex={1} ai="center" jc="center" gap="$4">
              <Bot size="$6" color="$color11" />
              <Paragraph maw="300px" textAlign="center" size="$4" color="$color11" ml="$2">
                {!loadingBots && bots.length <= 0
                  ? "To get started, create an AI agent board using one of the available templates"
                  : "Select a chatbot to get started."}
              </Paragraph>
            </YStack>
          )}
        </YStack>
      </XStack>
    </>
  );
};

export default BubbleChat;
