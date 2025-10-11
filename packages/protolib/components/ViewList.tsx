import { Info, X } from '@tamagui/lucide-icons'
import { useEffect, useState } from 'react'
import { Button, Paragraph, ScrollView, SizableText, Spinner, View, XStack, YStack } from 'tamagui'
import { FlatList } from 'react-native'
import { InteractiveIcon } from './InteractiveIcon'
import { Input } from '@my/ui'
import { Tinted } from './Tinted'
import { JSONView } from './JSONView'


export function ViewList({ items, onDeleteItem = (item, index) => { }, emptyMessageProps={}, emptyMode='info', emptyMessage="Empty queue", disableManualPush = false, onClear = (items) => { }, onPush = (item) => { } }) {
  const [itemsList, setItemsList] = useState(items ?? [])
  const [addText, setAddText] = useState('')
  const renderItem = ({ item, index }) => (
    <ViewListItem item={item} index={index} onDeleteItem={onDeleteItem} />
  )

  useEffect(() => {
    setItemsList(items ?? [])
  }, [items])

  return (
    <YStack className='no-drag' height="100%" f={1}>
      {itemsList.length ? <XStack>
        <XStack f={1} ml={"$3"}>
          <InteractiveIcon onPress={() => onClear(items)} Icon="trash"><SizableText mr="$2">Clear all</SizableText></InteractiveIcon>
        </XStack>
        <XStack mr={"$4"} ai="center" gap={"$2"}>
          <SizableText fontWeight={"500"} o={0.8}>Total: {itemsList.length}</SizableText>
        </XStack>
      </XStack> : <></>}

      {itemsList.length ? <ScrollView height="100%" width="100%" flex={1} mt={"$2"} mb={"$4"}>
        <FlatList
          data={itemsList}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <></>}
          keyExtractor={(item) => item.id}
          style={{ flex: 1 }}
          contentContainerStyle={{}}
          showsVerticalScrollIndicator={false}
        /></ScrollView> : <YStack jc="center" ai="center" height="100%" f={1} o={1}>
        {emptyMode === 'info' ? <Info color="$color7" size={50} /> : <Spinner color="$color7" size="large" />}
        <Paragraph mt={"$4"} fontSize={"$8"} fontWeight="600" color="$color" {...emptyMessageProps}>{emptyMessage}</Paragraph>
      </YStack>}

      {disableManualPush ? <></> : <XStack m={"10px"}>
        <YStack f={1}>
          <Input
            value={addText}
            width="100%"
            placeholder="Add new item"
            onChangeText={(text) => {
              console.log('onChangeText', text)
              setAddText(text)
            }} />
          <Tinted>
            <Button
              mt={"$2"}
              mb={"$2"}
              width="100%"
              disabled={!addText}
              bc={"$color6"}
              disabledStyle={{ bc: "$gray6" }}
              onPress={() => {
                if (addText) {
                  onPush(addText)
                  setAddText('')
                }
              }}><SizableText color={!addText && "$gray10"}>Add</SizableText>
            </Button>
          </Tinted>
        </YStack>
      </XStack>
      }

    </YStack>

  )
}



function ViewListItem({ item, index, onDeleteItem }) {

  const [isHover, setIsHover] = useState(false)

  let content = <SizableText fontWeight={"500"} color="$color11">{item}</SizableText>
  let stringMode = true
  if (typeof item !== 'string') {
    content = <JSONView src={item} />
    stringMode = false
  }

  return (
    <View
      p={"$2"}
      pl={"$3"}
      paddingVertical="$3"
      m={"$1"}
      marginHorizontal="10px"
      borderRadius="$5"
      backgroundColor={stringMode ? "$color6" : "$bgContent"}
      flexDirection="row"
      // paddingVertical="$2"
      // gap="$4"
      // $gtXs={{
      //   padding: '$4',
      //   gap: '$4',  
      // }}
      onHoverIn={() => setIsHover(true)}
      onHoverOut={() => setIsHover(false)}
      alignItems="center"
    >
      <View f={1} flexDirection="column" flexShrink={1} justifyContent="center">
        {content}
        {/* <Text fontWeight="$2" theme="alt1">
          {item.status.status}
        </Text> */}
      </View>
      <Button
        circular
        theme="red"
        bc="transparent"
        opacity={isHover ? 1 : 0}
        size={"$3"}
        pressStyle={{ opacity: 0.8 }}
        onPress={() => onDeleteItem(item, index)}
        icon={X}
        scaleIcon={1.8}
        color={"$red10"}
      />
    </View>
  )
}

