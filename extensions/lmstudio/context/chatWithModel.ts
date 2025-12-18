import axios from "axios";
import { API, getLogger } from "protobase";
import { getServiceToken } from "protonode";

const logger = getLogger();

let chatWithModelBusy = false;

// Estimate token count from text
// Average: ~4 chars per token for English, ~3 for code/JSON
// This is a rough estimate - actual tokenization depends on the model
const estimateTokens = (text: string): number => {
  if (!text) return 0;
  // Use ~3.5 chars per token as a middle ground for mixed content
  return Math.ceil(text.length / 3.5);
};

// Get LM Studio host from settings
const getLmStudioHost = async (): Promise<string> => {
  try {
    const token = getServiceToken();
    const result = await API.get(`/api/core/v1/settings/ai.lmstudiohost?token=${token}`);
    if (!result.isError && result.data?.value) {
      // Remove quotes (from JSON storage) and trailing slashes
      return String(result.data.value).replace(/^"|"$/g, '').replace(/\/+$/, '');
    }
  } catch (err) {
    // Silently fall back to default
  }
  return 'http://localhost:1234';
};

export const chatWithModel = async (prompt, model, modelParams={}, url?: string) => {
  // If no URL provided, get from settings
  const baseUrl = url || await getLmStudioHost();
  const apiUrl = `${baseUrl}/v1/chat/completions`;
  if (chatWithModelBusy) {
    logger.warn({ _meta: { module: 'lmstudio' } }, 'LMStudio is busy, skipping execution');
    return { error: true, message: 'LMStudio is busy processing another request' };
  }
  chatWithModelBusy = true;

  try {
    // Build request data - let LMStudio use its currently loaded model if none specified
    const data = {
      ...(model ? { model } : {}),
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      stream: false,
      ...modelParams
    };

    // Log request info with token estimate
    const promptLength = prompt?.length || 0;
    const estimatedTokens = estimateTokens(prompt);
    logger.info({ 
      _meta: { module: 'lmstudio' }, 
      url: apiUrl, 
      model: model || '(using LMStudio loaded model)',
      promptLength,
      estimatedTokens,
      promptPreview: promptLength > 200 ? `${prompt.substring(0, 100)}...` : prompt
    }, `Calling LMStudio API (~${estimatedTokens} tokens estimated)`);

    const response = await axios.post(apiUrl, data, {
      headers: { "Content-Type": "application/json" },
      timeout: 120000 // 2 minute timeout
    });
    
    logger.info({ _meta: { module: 'lmstudio' } }, 'LMStudio response received successfully');
    return response.data;
  } catch (error: any) {
    // Try to get more detailed error information
    const responseData = error?.response?.data;
    // Handle both string error and object error from LMStudio
    let errorMessage = 'Unknown error';
    if (typeof responseData?.error === 'string') {
      errorMessage = responseData.error;
    } else if (responseData?.error?.message) {
      errorMessage = responseData.error.message;
    } else if (error?.message) {
      errorMessage = error.message;
    }
    
    const errorCode = error?.code || error?.response?.status;
    const promptLen = prompt?.length || 0;
    const estTokens = estimateTokens(prompt);
    
    // Log the full error response for debugging
    logger.error({ 
      _meta: { module: 'lmstudio' },
      errorCode,
      errorMessage,
      promptLength: promptLen,
      estimatedTokens: estTokens,
      responseData: typeof responseData === 'string' ? responseData : JSON.stringify(responseData || {}).substring(0, 500),
      url: apiUrl
    }, `LMStudio API error (~${estTokens} tokens): ${errorMessage}`);
    
    // Build user-friendly error message with token estimate
    let userMessage: string;
    
    if (errorCode === 'ECONNREFUSED') {
      userMessage = 'LMStudio is not running. Please start LMStudio and load a model.';
    } else if (errorMessage.includes('context length') || errorMessage.includes('tokens to keep') || errorMessage.includes('Channel Error')) {
      // Context too long error - include token estimate
      userMessage = `Prompt too long (~${estTokens} tokens). Your model's context may be too small. Increase context size in LMStudio or reduce visible actions/cards.`;
    } else if (errorCode === 400 || error?.response?.status === 400) {
      userMessage = `LMStudio error (~${estTokens} tokens): ${errorMessage}`;
    } else {
      userMessage = `LMStudio error: ${errorMessage}`;
    }
    
    return { 
      error: true, 
      message: userMessage,
      code: errorCode,
      rawError: errorMessage,
      estimatedTokens: estTokens
    };
  } finally {
    chatWithModelBusy = false;
  }
};
