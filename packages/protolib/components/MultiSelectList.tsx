import { YStack, SelectProps, Select, Adapt, Sheet, getFontSize, XStack, Paragraph, StackProps } from "@my/ui";
import { ChevronDown, ChevronUp, Check } from '@tamagui/lucide-icons';
import { useEffect, useMemo, useRef, useState } from "react";
import { Tinted } from "./Tinted";

type MultiSelectListProps = {
  choices: string[],
  defaultSelections?: string[] | [],
  onSetSelections?: Function,
  containerProps?: StackProps
}
export function MultiSelectList({ 
  choices,
  defaultSelections = [],
  onSetSelections = (selections) => {},
  containerProps = {},
  ...props
}: MultiSelectListProps & StackProps) {
  const rootRef = useRef(null)
  const [open, setOpen] = useState(false);
  const [selections, setSelections] = useState<string[]>(defaultSelections);

  const updateSelections = (e, cName) => {
    e?.stopPropagation?.()
    const target = choices[choices.indexOf(cName)]
    if (selections.includes(target)) {
      const newSelections = selections.filter(slc => slc !== target)
      onSetSelections(newSelections)
      setSelections(newSelections)
    } else {
      const newSelections = selections.concat(target)
      onSetSelections(newSelections)
      setSelections(newSelections)
    }
  }

  return (
    <Tinted>
      <XStack
        ref={rootRef}
        bc="$backgroundTransparent"
        w="100%"
        h="fit-content"
        jc="space-between"
        ai="center"
        px="10px"
        py="7px"
        br={6}
        outlineColor="$gray6"
        outlineWidth={1}
        outlineStyle='solid'
        boc='$gray6'
        cursor="pointer"
        onPress={() => setOpen(prev => !prev)}
        {...props}
      >
        <XStack
          fw="wrap"
          h="fit-content"
          ov="hidden"
          f={1}
          gap="$1.5"
        >
          {
            selections.length > 0
              ? selections.map((selection, i) =>
                <Paragraph
                  key={i}
                  px="7px"
                  py="4px"
                  bc="$color7"
                  br={4}
                  color="white"
                  onPress={(e) => updateSelections(e, selection)}
                >{selection}</Paragraph>
              )
              : <Paragraph
                px="7px"
                py="4px"
                br={4}
                color="$gray8"
              >Select</Paragraph>
          }
        </XStack>
        <ChevronDown />
        {
          open
            ? <YStack
              zIndex={999999999}
              pos="absolute"
              top={"130%"}
              left={"0%"}
              width="100%"
              bc={"$gray1"}
              px="7px"
              py="7px"
              br={4}
              outlineColor="$gray6"
              outlineWidth={1}
              outlineStyle='solid'
              borderColor='$borderColor'
              maxHeight={'150px'}
              gap="$1.5"
              ov="scroll"
              {...containerProps}
            >
              {
                choices.map((choice, i) => {
                  return selections.includes(choice)
                    ? <Paragraph
                      key={i}
                      px="10px"
                      py="7px"
                      br={4}
                      fontSize={"$5"}
                      fontFamily={"$body"}
                      bc="$color7"
                      hoverStyle={{
                        cursor: 'pointer'
                      }}
                      onPress={(e) => updateSelections(e, choice)}
                    >{choice}</Paragraph>
                    : <Paragraph
                      px="10px"
                      py="7px"
                      br={4}
                      fontSize={"$5"}
                      fontFamily={"$body"}
                      color="$color"
                      hoverStyle={{
                        bc: '$backgroundPress',
                        cursor: 'pointer'
                      }}
                      onPress={(e) => updateSelections(e, choice)}
                    >{choice}</Paragraph>
                })
              }
            </YStack>
            : null
        }
      </XStack>
    </Tinted>
  )
}
