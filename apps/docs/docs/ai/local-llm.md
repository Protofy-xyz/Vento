# Local LLM

Run AI models locally using llama.cpp for complete privacy.

## Setup

### Using the AI Wizard (Recommended)

1. Go to `/workspace/settings` → **AI**
2. Select **Local** provider
3. Choose model size (the wizard downloads **Gemma 3** automatically)
4. Wait for download to complete
5. Start using local AI

The wizard handles downloading both the llama-server binary and the model file.

### Adding Custom Models

You can add additional models manually:

1. Download a `.gguf` model file
2. Place it in `data/models/`
3. Select it from the dropdown in AI settings

**Compatible models:**
- Gemma 3 (various sizes)
- LLaMA 3
- Mistral
- Any GGUF-format model

## Usage in Cards

```javascript
// List available models
const models = await context.llama.llamaListModels()

// Query local model
const response = await context.llama.prompt({
    message: 'Analyze this data',
    model: 'gemma-3-12b-it-Q4_1'  // without .gguf
})
```

## Preloading

For faster first response, preload the model:

```javascript
await context.llama.llamaPreload('gemma-3-12b-it-Q4_1')
```

## Status Check

```javascript
const status = await context.llama.llamaStatus()
// { serverRunning: true, modelLoaded: 'gemma-3-12b-it-Q4_1', ... }
```

## GPU Acceleration

llama.cpp automatically uses GPU if available:
- **NVIDIA**: CUDA support
- **AMD**: ROCm support  
- **Apple**: Metal support

## Troubleshooting

### Server Crashes

1. Check `logs/raw/core*.log` for errors
2. Try a smaller model
3. Ensure model file is valid `.gguf`

### Slow Performance

1. Use smaller quantized model (Q4 vs Q8)
2. Close other GPU-intensive apps

### GPU Issues on Windows

The process manager includes cleanup hooks for GPU resources. Always use `yarn stop` to properly release GPU memory.
