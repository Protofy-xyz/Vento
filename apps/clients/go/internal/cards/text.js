//@card/react
function Widget(card) {
  const value = card.value ?? "N/A";
  return (
    <Tinted>
      <ProtoThemeProvider forcedTheme={window.TamaguiTheme}>
        <YStack f={1} height="100%" ai="center" jc="center" width="100%">
          {card.icon && card.displayIcon !== false && (
            <Icon name={card.icon} size={48} color={card.color}/>
          )}
          <div style={{
            fontSize: '16px',
            fontWeight: 'bold',
            marginTop: '15px',
            textAlign: 'center',
            maxWidth: '90%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {value}
          </div>
        </YStack>
      </ProtoThemeProvider>
    </Tinted>
  );
}
