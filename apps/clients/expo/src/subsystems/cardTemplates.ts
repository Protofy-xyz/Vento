/**
 * Card HTML templates for custom rendering in the board view.
 * These templates are React components embedded as strings that the frontend will render.
 */

/** Template for displaying byte values (memory, storage) formatted as KB/MB/GB/TB */
export const bytesTemplate = `//@card/react
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
}`;

/** Template for displaying text values with ellipsis and consistent styling */
export const textTemplate = `//@card/react
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
}`;

/** Template for displaying percentage values (battery level, brightness) */
export const percentTemplate = `//@card/react
function Widget(card) {
  const formatPercent = (value) => {
    if (value === undefined || value === null || value === "N/A") return "N/A";
    const v = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(v)) return value;
    return Math.round(v) + "%";
  };
  return (
    <Tinted>
      <ProtoThemeProvider forcedTheme={window.TamaguiTheme}>
        <YStack f={1} height="100%" ai="center" jc="center" width="100%">
          {card.icon && card.displayIcon !== false && (
            <Icon name={card.icon} size={48} color={card.color}/>
          )}
          <div style={{fontSize: '36px', fontWeight: 'bold', marginTop: '15px'}}>
            {formatPercent(card.value)}
          </div>
        </YStack>
      </ProtoThemeProvider>
    </Tinted>
  );
}`;

/** Template for displaying JSON/object values like sensor data (x, y, z) */
export const jsonTemplate = `//@card/react
function Widget(card) {
  const formatValue = (v) => {
    if (v === undefined || v === null) return "N/A";
    if (typeof v === 'object') {
      // Handle sensor data with x, y, z
      if ('x' in v && 'y' in v && 'z' in v) {
        return \`X: \${v.x?.toFixed?.(2) ?? v.x}  Y: \${v.y?.toFixed?.(2) ?? v.y}  Z: \${v.z?.toFixed?.(2) ?? v.z}\`;
      }
      // Handle GPS data
      if ('latitude' in v && 'longitude' in v) {
        return \`\${v.latitude?.toFixed?.(4) ?? v.latitude}, \${v.longitude?.toFixed?.(4) ?? v.longitude}\`;
      }
      // Handle pressure data
      if ('pressure' in v) {
        return \`\${v.pressure?.toFixed?.(1) ?? v.pressure} hPa\`;
      }
      // Handle illuminance data
      if ('illuminance' in v) {
        return \`\${v.illuminance} lux\`;
      }
      // Handle steps data
      if ('steps' in v) {
        return \`\${v.steps} steps\`;
      }
      // Handle heading data
      if ('heading' in v) {
        return \`\${v.heading}°\`;
      }
      // Generic object
      return JSON.stringify(v);
    }
    return String(v);
  };
  return (
    <Tinted>
      <ProtoThemeProvider forcedTheme={window.TamaguiTheme}>
        <YStack f={1} height="100%" ai="center" jc="center" width="100%">
          {card.icon && card.displayIcon !== false && (
            <Icon name={card.icon} size={48} color={card.color}/>
          )}
          <div style={{
            fontSize: '14px',
            fontWeight: 'bold',
            marginTop: '15px',
            textAlign: 'center',
            maxWidth: '90%',
            fontFamily: 'monospace'
          }}>
            {formatValue(card.value)}
          </div>
        </YStack>
      </ProtoThemeProvider>
    </Tinted>
  );
}`;

/** Template for displaying simple numeric values */
export const numberTemplate = `//@card/react
function Widget(card) {
  const value = card.value ?? "N/A";
  return (
    <Tinted>
      <ProtoThemeProvider forcedTheme={window.TamaguiTheme}>
        <YStack f={1} height="100%" ai="center" jc="center" width="100%">
          {card.icon && card.displayIcon !== false && (
            <Icon name={card.icon} size={48} color={card.color}/>
          )}
          <div style={{fontSize: '30px', fontWeight: 'bold', marginTop: '15px'}}>
            {value}
          </div>
        </YStack>
      </ProtoThemeProvider>
    </Tinted>
  );
}`;
