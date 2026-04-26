import { callProvider } from './providers.js';
import { getStoredCredential } from './auth.js';

function baseContext(prompt) {
  return `사용자 요청: ${prompt}\n서비스 목표: 여러 AI가 같은 작업을 검토하고 최종적으로 하나의 타당한 방향으로 합의해야 합니다.`;
}

export async function generateArchitectOutput(provider, prompt) {
  const system = '너는 Architect 역할이다. API 구조와 구현 방향을 제안한다. 반드시 JSON만 반환하라.';
  const user = `${baseContext(prompt)}\n반드시 아래 JSON 스키마만 반환하라:\n{"idea":"string","detail":"string","deliverable":"string","status":"string"}`;
  return callProvider(provider, getStoredCredential(provider), system, user);
}

export async function generateRedOutput(provider, prompt, architect) {
  const system = '너는 Red Team 역할이다. 보안 관점에서 취약점을 찾는다. 반드시 JSON만 반환하라.';
  const user = `${baseContext(prompt)}\nArchitect 제안:\n${JSON.stringify(architect)}\n반드시 아래 JSON 스키마만 반환하라:\n{"idea":"string","detail":"string","challenge":"string","status":"string"}`;
  return callProvider(provider, getStoredCredential(provider), system, user);
}

export async function generateBlueOutput(provider, prompt, architect, red) {
  const system = '너는 Blue Team 역할이다. 방어 전략과 수정 방향을 제안한다. 반드시 JSON만 반환하라.';
  const user = `${baseContext(prompt)}\nArchitect 제안:\n${JSON.stringify(architect)}\nRed Team 지적:\n${JSON.stringify(red)}\n반드시 아래 JSON 스키마만 반환하라:\n{"idea":"string","detail":"string","response":"string","status":"string"}`;
  return callProvider(provider, getStoredCredential(provider), system, user);
}

export async function generateConsensusOutput(provider, prompt, architect, red, blue) {
  const system = '너는 Judge/Consensus 역할이다. 각 역할의 의견을 조율하고 최종 방향을 결정한다. 반드시 JSON만 반환하라.';
  const user = `${baseContext(prompt)}\nArchitect:\n${JSON.stringify(architect)}\nRed Team:\n${JSON.stringify(red)}\nBlue Team:\n${JSON.stringify(blue)}\n반드시 아래 JSON 스키마만 반환하라:\n{"turns":[{"from":"string","to":"string","message":"string"}],"winner":"string","summary":"string"}`;
  return callProvider(provider, getStoredCredential(provider), system, user);
}

export async function generateFinalOutput(provider, prompt, architect, red, blue, consensus) {
  const system = '너는 Final 역할이다. 최종 선택 이유와 실제 코드 초안을 생성한다. 반드시 JSON만 반환하라.';
  const user = `${baseContext(prompt)}\nArchitect:\n${JSON.stringify(architect)}\nRed Team:\n${JSON.stringify(red)}\nBlue Team:\n${JSON.stringify(blue)}\nConsensus:\n${JSON.stringify(consensus)}\n반드시 아래 JSON 스키마만 반환하라:\n{"winner":"string","summary":"string","reasons":["string"],"finalCode":"string"}`;
  return callProvider(provider, getStoredCredential(provider), system, user);
}
