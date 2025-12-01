//@card/react

function Widget(card) {
  const value = card.value;
  return (
    <Tinted>
      <ProtoThemeProvider forcedTheme={window.TamaguiTheme}>
        <YStack f={1} height="100%" ai="center" jc="center" width="100%">
          {card?.value?.imageUrl ? (
            <img 
              src={card?.value?.imageUrl} 
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} 
            />
          ) : (
            <Text color="$color11">No image captured</Text>
          )}
        </YStack>
      </ProtoThemeProvider>
    </Tinted>
  );
}

