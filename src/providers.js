const DEFAULT_MODELS = {
  codex: process.env.MULTIVERSE_SEC_CODEX_MODEL || 'gpt-5-mini',
  claude: process.env.MULTIVERSE_SEC_CLAUDE_MODEL || 'claude-sonnet-4-5',
  gemini: process.env.MULTIVERSE_SEC_GEMINI_MODEL || 'gemini-2.5-flash'
};

const BASE_URLS = {
  codex: process.env.MULTIVERSE_SEC_CODEX_BASE_URL || process.env.MULTIVERSE_SEC_OPENAI_BASE_URL || 'https://api.openai.com/v1',
  claude: process.env.MULTIVERSE_SEC_CLAUDE_BASE_URL || 'https://api.anthropic.com/v1',
  gemini: process.env.MULTIVERSE_SEC_GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta'
};

function stripCodeFences(text) {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
}

function extractJsonCandidate(text) {
  const cleaned = stripCodeFences(text);
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`JSON 응답을 찾지 못했습니다: ${cleaned.slice(0, 200)}`);
  }
  return cleaned.slice(start, end + 1);
}

function repairJsonString(candidate) {
  let result = '';
  let inString = false;
  let escaped = false;

  for (let index = 0; index < candidate.length; index += 1) {
    const char = candidate[index];

    if (!inString) {
      result += char;
      if (char === '"') {
        inString = true;
        escaped = false;
      }
      continue;
    }

    if (escaped) {
      if (char === 'u') {
        const unicode = candidate.slice(index + 1, index + 5);
        if (/^[0-9a-fA-F]{4}$/.test(unicode)) {
          result += `\\u${unicode}`;
          index += 4;
        } else {
          result += '\\\\u';
        }
      } else if ('"\\/bfnrt'.includes(char)) {
        result += `\\${char}`;
      } else {
        result += `\\\\${char}`;
      }
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = false;
      result += char;
      continue;
    }

    if (char === '\n') {
      result += '\\n';
      continue;
    }
    if (char === '\r') {
      result += '\\r';
      continue;
    }
    if (char === '\t') {
      result += '\\t';
      continue;
    }

    result += char;
  }

  if (escaped) {
    result += '\\\\';
  }

  return result;
}

function extractJson(text) {
  const cleaned = stripCodeFences(text);
  try {
    return JSON.parse(cleaned);
  } catch {}

  const candidate = extractJsonCandidate(cleaned);
  try {
    return JSON.parse(candidate);
  } catch (error) {
    try {
      return JSON.parse(repairJsonString(candidate));
    } catch {
      throw error;
    }
  }
}

async function requestJson(url, init) {
  const response = await fetch(url, init);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`API 요청 실패 (${response.status}): ${text}`);
  }
  return JSON.parse(text);
}

function resolveModel(provider, modelOverride = null) {
  return modelOverride || DEFAULT_MODELS[provider];
}

async function callCodex(apiKey, systemPrompt, userPrompt, modelOverride) {
  const data = await requestJson(`${BASE_URLS.codex}/responses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: resolveModel('codex', modelOverride),
      instructions: systemPrompt,
      input: userPrompt,
      max_output_tokens: 3200
    })
  });
  const text = data.output_text ?? data.output?.map((item) => item?.content?.map((c) => c.text).join('')).join('') ?? '';
  return extractJson(text);
}

async function callClaude(apiKey, systemPrompt, userPrompt, modelOverride) {
  const data = await requestJson(`${BASE_URLS.claude}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: resolveModel('claude', modelOverride),
      max_tokens: 3200,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt }
      ]
    })
  });
  const text = (data.content || []).filter((item) => item.type === 'text').map((item) => item.text).join('\n');
  return extractJson(text);
}

async function callGemini(apiKey, systemPrompt, userPrompt, modelOverride) {
  const model = resolveModel('gemini', modelOverride);
  const requestBody = (extraInstruction = '') => JSON.stringify({
    system_instruction: {
      parts: [{ text: [systemPrompt, extraInstruction].filter(Boolean).join('\n') }]
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
  });

  const parseAttempt = async (extraInstruction = '') => {
    const data = await requestJson(`${BASE_URLS.gemini}/models/${model}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: requestBody(extraInstruction)
    });
    const text = (data.candidates?.[0]?.content?.parts || []).map((item) => item.text || '').join('\n');
    return extractJson(text);
  };

  try {
    return await parseAttempt();
  } catch (error) {
    return parseAttempt('이전 응답의 JSON escape가 깨졌습니다. 모든 문자열의 줄바꿈과 백슬래시를 JSON 규칙에 맞게 escape 해서 다시 JSON만 반환하세요.');
  }
}

export function getDefaultModel(provider) {
  return DEFAULT_MODELS[provider] ?? null;
}

export async function callProvider(provider, apiKey, systemPrompt, userPrompt, modelOverride = null) {
  if (!apiKey) {
    throw new Error(`${provider} provider credential이 없습니다.`);
  }
  if (provider === 'codex') return callCodex(apiKey, systemPrompt, userPrompt, modelOverride);
  if (provider === 'claude') return callClaude(apiKey, systemPrompt, userPrompt, modelOverride);
  if (provider === 'gemini') return callGemini(apiKey, systemPrompt, userPrompt, modelOverride);
  throw new Error(`지원하지 않는 provider입니다: ${provider}`);
}
