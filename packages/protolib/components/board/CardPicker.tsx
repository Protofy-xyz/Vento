import { useState, useEffect, useMemo } from "react";
import {
  XStack, YStack, Text, Input, Button, Checkbox, ScrollView, Dialog,
} from "@my/ui";
import { Check, Eye, Plus, Rocket, X as XIcon, Asterisk } from "@tamagui/lucide-icons";
import { Tinted } from "../Tinted";

type CardPickerProps = {
  type?: string;
  value?: string[];
  onChange: (names: string[]) => void;
  onApply?: (names: string[]) => void;
};

export const CardPicker = ({ type, value, onChange, onApply }: CardPickerProps) => {
  const [allCards, setAllCards] = useState<{ name: string; type?: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [modalSelection, setModalSelection] = useState<string[]>([]);
  const selected = Array.isArray(value) ? value : [];

  useEffect(() => {
    const b = (window as any)?.board;
    if (!b?.cards) return;
    
    const filtered = type === "action" ? b.cards.filter((c: any) => c.type === "action") : b.cards;

    setAllCards(
      filtered.map((c: any) => ({
        name: String(c.name ?? ""),
        type: c.type,
      }))
    );
  }, [open]);

  const filteredCards = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allCards;
    return allCards.filter((c) => c.name.toLowerCase().includes(q));
  }, [allCards, search]);

  const toggleDirect = (name: string) => {
    const newArr = selected.includes(name)
      ? selected.filter((n) => n !== name)
      : [...selected, name];

    onChange(newArr);
    onApply?.(newArr);              // ← ✅ aplica siempre con la lista actual
  };

  const toggleModalSelect = (arr: string[], name: string) =>
    arr.includes(name) ? arr.filter((n) => n !== name) : [...arr, name];

  const Chip = ({ name }: { name: string }) => {
    const isAll = name === '*';
    return (
      <XStack 
        key={name} 
        ai="center" 
        br="$10" 
        px="$3" 
        py="$1.5" 
        gap="$2" 
        bg={isAll ? "$blue4" : "$bgContent"}
        borderWidth={isAll ? 1 : 0}
        borderColor={isAll ? "$blue8" : "transparent"}
        hoverStyle={{ bg: isAll ? "$blue5" : "$color4" }} 
        mr="$2" 
        mb="$2" 
        maxWidth={220} 
        overflow="hidden"
      >
        {isAll && <Asterisk size={14} color="var(--blue10)" />}
        <Text numberOfLines={1} ellipsizeMode="tail" color={isAll ? "$blue10" : "$color"} fontWeight={isAll ? "600" : "400"}>
          {isAll ? "All" : name}
        </Text>
        <Button
          size="$1"
          circular
          bg={isAll ? "$blue6" : "$color6"}
          hoverStyle={{ bg: isAll ? "$blue7" : "$color6" }}
          icon={XIcon}
          scaleIcon={0.8}
          onPress={() => toggleDirect(name)}
          aria-label={`Remove ${name}`}
        />
      </XStack>
    );
  };

  const chips = selected.map((name) => <Chip key={name} name={name} />);

  const Row = ({ card }: { card: { name: string; type?: string } }) => {
    const checked = modalSelection.includes(card.name);
    const IconComp =
      card.type === "action" ? Rocket :
        card.type === "value" ? Eye : null;

    return (
      <XStack key={card.name} ai="center" jc="space-between" py="$2" px="$2.5" hoverStyle={{ backgroundColor: "$gray2" }}>
        <XStack
          flex={1}
          ai="center"
          gap="$3"
          onPress={() =>
            setModalSelection((prev) => toggleModalSelect(prev, card.name))
          }
        >
          {IconComp && <IconComp size={20} color="var(--color10)" style={{ opacity: 0.7 }} />}
          <Text fos="$5">{card.name}</Text>
        </XStack>

        <XStack ml="$1">
          <Checkbox
            pointerEvents="auto"
            w="$2.5"
            h="$2.5"
            focusStyle={{ outlineWidth: 0 }}
            checked={checked}
            onCheckedChange={() =>
              setModalSelection((prev) => toggleModalSelect(prev, card.name))
            }
            className="no-drag"
            borderColor="$gray6"
            backgroundColor="$background"
          >
            <Checkbox.Indicator>
              <Check color="var(--color8)" size={16} />
            </Checkbox.Indicator>
          </Checkbox>
        </XStack>
      </XStack>
    );
  };

  const colA = filteredCards.filter((_, i) => i % 2 === 0);
  const colB = filteredCards.filter((_, i) => i % 2 === 1);

  const applyAndClose = () => {
    onChange(modalSelection);     // update live value
    onApply?.(modalSelection);    // persist default if parent wants
    setOpen(false);
  };

  return (
    <>
      <Tinted>
        <YStack>
          <XStack flexWrap="wrap" ai="center">
            {chips}

            <Button
              size="$2"
              circular
              icon={Plus}
              aria-label="Add cards"
              bg="$color3"
              bc="$color6"
              hoverStyle={{ bg: "$color4" }}
              mr="$2"
              mb="$2"
              onPress={() => {
                setModalSelection(selected);
                setOpen(true);
              }}
            />
          </XStack>
        </YStack>
      </Tinted>

      <Dialog modal open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay bg="rgba(0,0,0,0.5)" animation="quick" />
          <Dialog.Content elevate bordered br="$6" p="$4" mx="auto" my="10%" height={460} width={640} bg="$bgContent">
            <Tinted>
              <Text fos="$7" mb="$3" fow="600">Add cards</Text>

              <Input value={search} onChangeText={setSearch} placeholder="Search cards..." mb="$3" />

              <ScrollView maxHeight={320}>
                <XStack gap="$8">
                  <YStack flex={1} gap="$1">
                    {colA.map((card) => <Row key={card.name} card={card} />)}
                  </YStack>
                  <YStack flex={1} gap="$1">
                    {colB.map((card) => <Row key={card.name} card={card} />)}
                  </YStack>
                </XStack>
              </ScrollView>

              <XStack mt="$4" jc="center" gap="$3">
                <Button onPress={() => setOpen(false)} bg="$gray3" hoverStyle={{ bg: "$gray4" }}>
                  Cancel
                </Button>
                <Button
                  bg="$blue4"
                  borderWidth={1}
                  borderColor="$blue8"
                  hoverStyle={{ bg: "$blue5" }}
                  icon={Asterisk}
                  onPress={() => {
                    const newArr = selected.includes('*') ? selected : ['*'];
                    onChange(newArr);
                    onApply?.(newArr);
                    setOpen(false);
                  }}
                >
                  <Text color="$blue10" fontWeight="600">All</Text>
                </Button>
                <Button
                  bc="$color7"
                  color="white"
                  hoverStyle={{ bc: "$color9" }}
                  onPress={applyAndClose}
                >
                  Add selected
                </Button>
              </XStack>
            </Tinted>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </>
  );
};
