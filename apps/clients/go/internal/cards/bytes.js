//@card/react
function Widget(card) {
  const formatBytes = (bytes) => {
    if (bytes === undefined || bytes === null || bytes === "N/A") return "N/A";
    const b = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes;
    if (isNaN(b)) return bytes;
    const KB = 1024, MB = KB * 1024, GB = MB * 1024, TB = GB * 1024;
    if (b >= TB) return (b / TB).toFixed(2) + " TB";
    if (b >= GB) return (b / GB).toFixed(2) + " GB";
    if (b >= MB) return (b / MB).toFixed(2) + " MB";
    if (b >= KB) return (b / KB).toFixed(2) + " KB";
    return b + " B";
  };
  return (
    <Tinted>
      <ProtoThemeProvider forcedTheme={window.TamaguiTheme}>
        <YStack f={1} height="100%" ai="center" jc="center" width="100%">
          {card.icon && card.displayIcon !== false && (
            <Icon name={card.icon} size={48} color={card.color}/>
          )}
          <div style={{fontSize: '30px', fontWeight: 'bold', marginTop: '15px'}}>
            {formatBytes(card.value)}
          </div>
        </YStack>
      </ProtoThemeProvider>
    </Tinted>
  );
}
