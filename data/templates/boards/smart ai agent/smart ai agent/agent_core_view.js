//@card/react

function Widget(card) {
  const value = card.value;
  
  // Auto-detect HTML content
  const isHtmlContent = typeof value === 'string' && value.trim().startsWith('<');
  const mode= card.markdownDisplay ? 'markdown' : (card.htmlDisplay || (typeof value === 'string' && value.trim().startsWith('<'))) ? 'html' : 'normal'

  const content = <YStack f={1} mt={"20px"} ai="center" jc="center" width="100%">
      {card.icon && card.displayIcon !== false && (
          <Icon name={card.icon} size={48} color={card.color}/>
      )}
      {card.displayResponse !== false && (
          <CardValue mode={mode} value={value ?? "N/A"} />
      )}
  </YStack>

  return (
      <Tinted>
        <ProtoThemeProvider forcedTheme={window.TamaguiTheme}>
          <ActionCard data={card}>
            {card.displayButton !== false ? <ParamsForm data={card}>{content}</ParamsForm> : card.displayResponse !== false && content}
          </ActionCard>
        </ProtoThemeProvider>
      </Tinted>
  );
}