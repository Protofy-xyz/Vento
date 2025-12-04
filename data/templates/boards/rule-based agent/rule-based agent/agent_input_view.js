//@card/react
function Widget(props) {
  return (
    <ViewList
      onReply={(item, response) => execute_action(props.name, {action: 'reply', response: response})}
      enableReply={true}
      enableManualPop={true}
      current={props?.value?.current}
      emptyMessageProps={{
        fontSize: "$6",
        fontWeight: "600"
      }}
      emptyDescription={<YStack>
        <Paragraph color="$color10" mt={"$2"} fontSize={"$4"}>
          <a style={{}} target="_new" href={'/api/agents/v1/'+window?.board?.name+'/'+props?.name}>{'Open agent link'}</a>
        </Paragraph>
      </YStack>  
      }
      // emptyMode="wait"
      emptyMessage="Empty agent job queue"
      disableManualPush={true}
      items={props?.value?.items} 
      onPop={(items) => execute_action(props.name, {action: 'skip'})}
      onClear={(items) => execute_action(props.name, {action: 'reset'})}
      onPush={(item) => execute_action(props.name, {action: 'push', item})}
      onDeleteItem={(item, index) => execute_action(props.name, {action: 'remove', index})} 
    />
  );
}
