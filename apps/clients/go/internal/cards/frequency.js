//@card/react
function Widget(card) {
  const formatFrequency = (mhz) => {
    if (mhz === undefined || mhz === null || mhz === "N/A") return "N/A";
    const m = typeof mhz === 'string' ? parseFloat(mhz) : mhz;
    if (isNaN(m)) return mhz;
    if (m >= 1000) {
      return (m / 1000).toFixed(2) + " GHz";
    }
    return m.toFixed(0) + " MHz";
  };
  return (
    <Tinted>
      <ProtoThemeProvider forcedTheme={window.TamaguiTheme}>
        <YStack f={1} height="100%" ai="center" jc="center" width="100%">
          {card.icon && card.displayIcon !== false && (
            <Icon name={card.icon} size={48} color={card.color}/>
          )}
          <div style={{fontSize: '30px', fontWeight: 'bold', marginTop: '15px'}}>
            {formatFrequency(card.value)}
          </div>
        </YStack>
      </ProtoThemeProvider>
    </Tinted>
  );
}
