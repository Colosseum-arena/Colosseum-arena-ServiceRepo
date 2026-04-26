const DEFAULT_MODELS = {
  openai: process.env.MULTIVERSE_SEC_OPENAI_MODEL || 'gpt-4.1-mini',
  claude: process.env.MULTIVERSE_SEC_CLAUDE_MODEL || 'claude-sonnet-4-5',
  gemini: process.env.MULTIVERSE_SEC_GEMINI_MODEL || 'gemini-2.5-flash'
};

const BASE_URLS = {
  openai: process.env.MULTIVERSE_SEC_OPENAI_BASE_URL || 'https://api.openai.com/v1',
  claude: process.env.MULTIVERSE_SEC_CLAUDE_BASE_URL || 'https://api.anthropic.com/v1',
  gemini: process.env.MULTIVERSE_SEC_GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta'
};

function stripCodeFences(text) {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
}

function extractJson(text) {
  const cleaned = stripCodeFences(text);
  try {
    return JSON.parse(cleaned);
  } catch {}

  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`JSON 응답을 찾지 못했습니다: ${cleaned.slice(0, 200)}`);
  }
  return JSON.parse(cleaned.slice(start, end + 1));
}

async function requestJson(url, init) {
  const response = await fetch(url, init);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`API 요청 실패 (${response.status}): ${text}`);
  }
  return JSON.parse(text);
}

async function callOpenAI(apiKey, systemPrompt, userPrompt) {
  const data = await requestJson(`${BASE_URLS.openai}/responses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: DEFAULT_MODELS.openai,
      instructions: systemPrompt,
      input: userPrompt,
      max_output_tokens: 1200
    })
  });
  const text = data.output_text ?? data.output?.map((item) => item?.content?.map((c) => c.text).join('')).join('') ?? '';
  return extractJson(text);
}

async function callClaude(apiKey, systemPrompt, userPrompt) {
  const data = await requestJson(`${BASE_URLS.claude}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: DEFAULT_MODELS.claude,
      max_tokens: 1200,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt }
      ]
    })
  });
  const text = (data.content || []).filter((item) => item.type === 'text').map((item) => item.text).join('\n');
  return extractJson(text);
}

async function callGemini(apiKey, systemPrompt, userPrompt) {
  const data = await requestJson(`${BASE_URLS.gemini}/models/${DEFAULT_MODELS.gemini}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey
    },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: [
        {
          parts: [{ text: userPrompt }]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json'
      }
    })
  });
  const text = (data.candidates?.[0]?.content?.parts || []).map((item) => item.text || '').join('\n');
  return extractJson(text);
}

export async function callProvider(provider, apiKey, systemPrompt, userPrompt) {
  if (!apiKey) {
    throw new Error(`${provider} provider credential이 없습니다.`);
  }
  if (provider === 'openai') return callOpenAI(apiKey, systemPrompt, userPrompt);
  if (provider === 'claude') return callClaude(apiKey, systemPrompt, userPrompt);
  if (provider === 'gemini') return callGemini(apiKey, systemPrompt, userPrompt);
  throw new Error(`지원하지 않는 provider입니다: ${provider}`);
}
