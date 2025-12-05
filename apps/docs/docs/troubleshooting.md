# Troubleshooting

Common issues and solutions when working with Vento.

## Startup Issues

### Port Already in Use

**Symptom**: Vento fails to start with port binding error

**Solution**:
```bash
# Stop all Vento processes
yarn stop

# If still stuck, kill manually (Windows)
taskkill /F /IM node.exe

# On Linux/macOS
pkill -f node
```

### Missing Dependencies

**Symptom**: Module not found errors

**Solution**:
```bash
yarn
yarn build
```

### Missing Binaries

**Symptom**: Go agent or Dendrite not found

**Solution**:
```bash
yarn download-agent
yarn download-binaries
```

## Authentication Issues

### Token Not Working

**Symptom**: 401 Unauthorized on all requests

**Cause**: Missing `TOKEN_SECRET` environment variable

**Solution**: Set in `.env` file:
```bash
TOKEN_SECRET=your-secret-key-here
```

### Cannot Login

**Symptom**: Invalid credentials with correct password

**Solution**: Reset or create admin user:
```bash
yarn add-user
```

## Database Issues

### Corrupted Database

**Symptom**: Strange data or startup errors

**Solution**:
```bash
yarn stop
rm -rf data/databases/*
yarn start
```

### Missing Data

**Symptom**: Boards/objects disappeared

**Check**: Ensure `data/` directory wasn't deleted

## AI Issues

### GPU/LLM Crashes

**Symptom**: llama-server crashes or causes system issues

**Solutions**:

1. **Reduce GPU layers**:
```bash
LLAMA_GPU_LAYERS=20 yarn start
```

2. **Re-download binary**:
```bash
node scripts/download-llama.js
```

3. **Check model file**:
- Verify `.gguf` file in `data/models/` is valid
- Try a different model

### GPU Not Released

**Symptom**: GPU memory not freed after stopping

**Solution**: Always use `yarn stop` instead of Ctrl+C. The process manager includes cleanup hooks for GPU resources.

### OpenAI Not Working

**Symptom**: ChatGPT responses fail

**Check**:
1. API key set in `/workspace/keys` or environment
2. Valid API key with credits
3. Model name is correct (e.g., `gpt-4o-mini`)

## UI Issues

### UI Not Loading

**Symptom**: Blank page at `/workspace`

**Solutions**:

1. **Check static pages exist**:
```bash
ls data/pages/
```

2. **Re-download UI**:
```bash
yarn update-ui
```

3. **Enable dev mode** (for development):
```bash
yarn enable-ui-dev
yarn dev
```

### Style Issues

**Symptom**: Components look broken

**Solution**: Clear browser cache, hard refresh (Ctrl+Shift+R)

## MQTT Issues

### Messages Not Received

**Check**:
1. MQTT broker running on port 1883
2. WebSocket endpoint on port 3003
3. Topic pattern matches

**Debug**:
```bash
# Subscribe to all topics (requires mosquitto-clients)
mosquitto_sub -h localhost -p 1883 -t '#'
```

### Device Not Discovered

**Check**:
1. Device connected to same network
2. MQTT broker address correct in device config
3. Discovery prefix matches (`homeassistant` by default)

## Process Management

### Service Won't Stop

```bash
yarn stop

# If stuck:
yarn kill

# Force kill (Windows):
taskkill /F /IM node.exe

# Force kill (Linux/macOS):
pkill -9 -f node
```

### Check Status

```bash
yarn status
```

### View Logs

```bash
# Via command
yarn logs

# Directly
tail -f logs/core.log
tail -f logs/api.log
tail -f logs/adminpanel.log

# Raw output
tail -f logs/raw/*.log
```

## Board Issues

### Card Not Executing

**Check**:
1. Card code has no syntax errors
2. All `context.*` functions called correctly
3. Parameters are correct type

**Debug**: Add logging in card code:
```javascript
board.log('Debug:', params)
```

### State Not Updating

**Check**:
1. Board is running (check status)
2. MQTT subscription active
3. Card returns a value (for value cards)

### Board Name Invalid

**Requirement**: Board names must be lowercase with underscores only
```
Valid:   my_board, sensor_1, test_agent
Invalid: My-Board, sensor 1, test.agent
```

## Extension Issues

### Extension Not Loading

**Check**:
1. `package.json` exists in extension directory
2. `coreApis.ts` or `coreContext/index.ts` exports correctly
3. No syntax errors in extension code

**Solution**: Restart Vento after adding/modifying extensions

## Common Error Messages

### E_PERM

Permission denied. User lacks required permissions.

### E_AUTH

Authentication required. Token missing or invalid.

### File already exists

Trying to create a resource that already exists.

### ZodError

Validation failed. Check data matches schema.

## Performance Issues

### Slow Response

**Solutions**:
1. Reduce board complexity
2. Optimize card code
3. Use smaller AI models
4. Enable quickRefresh for DataView

### Memory Usage High

**Check**:
1. Number of running processes
2. Large datasets in memory
3. MQTT message backlog

**Solution**: Restart Vento periodically for long-running instances

## Getting Help

1. **Check logs** in `logs/` directory
2. **Join Discord**: https://discord.gg/VpeZxMFfYW
3. **Open issue** on GitHub

