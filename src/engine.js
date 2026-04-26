import { callProvider, getDefaultModel } from './providers.js';
import {
  AGENT_META,
  IMPLEMENTATION_AGENTS,
  getStoredCredential
} from './auth.js';

const AGENT_ORDER = [...IMPLEMENTATION_AGENTS];

function workspaceContext(snapshot) {
  const files = snapshot.files.map((file) => ({
    path: file.path,
    content: file.content
  }));
  return JSON.stringify({
    rootDir: snapshot.rootDir,
    fileCount: snapshot.fileCount,
    files
  });
}

function proposalSchema() {
  return '{"agent":"alpha|beta|gamma","strategy":"string","summary":"string","approach":"string","plan":["string"],"reasons":["string"],"risks":["string"],"changes":[{"path":"relative/path","action":"create|replace|delete","content":"string"}]}';
}

function critiqueSchema() {
  return '{"agent":"alpha|beta|gamma","preferredAgent":"alpha|beta|gamma","strengths":["string"],"issues":["string"],"mergeIdeas":["string"],"debatePoints":["string"]}';
}

function refinementSchema() {
  return '{"winner":"alpha|beta|gamma","winningStrategy":"string","summary":"string","reasons":["string"],"debateResolution":["string"],"changes":[{"path":"relative/path","action":"create|replace|delete","content":"string"}],"postApplyChecks":["string"]}';
}

function validateChanges(changes) {
  if (!Array.isArray(changes) || changes.length === 0) {
    throw new Error('파일 변경안이 비어 있습니다.');
  }
  return changes.map((change) => {
    if (!change || typeof change.path !== 'string' || typeof change.action !== 'string') {
      throw new Error('파일 변경안 형식이 올바르지 않습니다.');
    }
    if (change.action !== 'delete' && typeof change.content !== 'string') {
      throw new Error(`파일 내용이 없는 변경안입니다: ${change.path}`);
    }
    return {
      path: change.path,
      action: change.action,
      content: change.content ?? ''
    };
  });
}

function effectiveModelLabel(config) {
  return config.model || getDefaultModel(config.provider);
}

export async function generateAgentProposal(config, request, snapshot) {
  const meta = AGENT_META[config.agent];
  const system = [
    `너는 ${meta.label} 역할의 구현 에이전트다.`,
    `${meta.strategy}.`,
    '사전에 고정된 구현 패턴을 따르지 말고, 현재 요청과 워크스페이스를 보고 네가 가장 적합하다고 판단한 전략을 스스로 정한다.',
    '다른 두 에이전트와 겹치지 않을 수 있도록 전략 이름과 접근 철학을 분명하게 제시한다.',
    '사용자의 요청을 현재 워크스페이스에 실제로 반영할 수 있는 코드 변경안으로 제안한다.',
    '반드시 JSON만 반환한다.',
    '수정이 필요한 파일만 changes 배열에 넣고, 각 파일은 전체 내용을 반환한다.',
    '기존 파일의 맥락을 존중하고, 불필요한 파일은 건드리지 않는다.'
  ].join(' ');
  const user = [
    `사용자 요청: ${request}`,
    `에이전트: ${config.agent}`,
    `Provider: ${config.provider}`,
    `Model: ${effectiveModelLabel(config)}`,
    '현재 워크스페이스:',
    workspaceContext(snapshot),
    `반드시 아래 스키마만 반환하라: ${proposalSchema()}`
  ].join('\n');

  const proposal = await callProvider(
    config.provider,
    getStoredCredential(config.provider),
    system,
    user,
    config.model
  );
  proposal.agent = config.agent;
  proposal.changes = validateChanges(proposal.changes);
  proposal.strategy ??= 'Unnamed Strategy';
  proposal.plan ??= [];
  proposal.reasons ??= [];
  proposal.risks ??= [];
  return proposal;
}

export async function generateAgentCritique(config, request, snapshot, proposals) {
  const meta = AGENT_META[config.agent];
  const system = [
    `너는 ${meta.label} 역할의 구현 에이전트다.`,
    '다른 에이전트들의 구현안을 비교 평가하고 가장 적합한 접근을 고른다.',
    '전략마다 무엇이 좋은지, 무엇이 약한지, 어떤 아이디어를 흡수해야 하는지 토론하듯이 평가한다.',
    '반드시 JSON만 반환한다.',
    '자기 제안을 지지할 수는 있지만, 근거 없이 편향되면 안 된다.'
  ].join(' ');
  const user = [
    `사용자 요청: ${request}`,
    `에이전트: ${config.agent}`,
    `Provider: ${config.provider}`,
    `Model: ${effectiveModelLabel(config)}`,
    '현재 워크스페이스:',
    workspaceContext(snapshot),
    '후보 제안들:',
    JSON.stringify(proposals),
    `반드시 아래 스키마만 반환하라: ${critiqueSchema()}`
  ].join('\n');

  const critique = await callProvider(
    config.provider,
    getStoredCredential(config.provider),
    system,
    user,
    config.model
  );
  critique.agent = config.agent;
  if (!AGENT_ORDER.includes(critique.preferredAgent)) {
    throw new Error(`유효하지 않은 preferredAgent 입니다: ${critique.preferredAgent}`);
  }
  critique.strengths ??= [];
  critique.issues ??= [];
  critique.mergeIdeas ??= [];
  critique.debatePoints ??= [];
  return critique;
}

export function selectWinningProposal(proposals, critiques) {
  const score = Object.fromEntries(AGENT_ORDER.map((agent) => [agent, 0]));
  for (const critique of critiques) {
    score[critique.preferredAgent] += 1;
  }

  const rankedAgents = [...AGENT_ORDER].sort((left, right) => {
    if (score[right] !== score[left]) return score[right] - score[left];
    return AGENT_ORDER.indexOf(left) - AGENT_ORDER.indexOf(right);
  });

  const winner = rankedAgents[0];
  return {
    winner,
    votes: score,
    proposal: proposals.find((proposal) => proposal.agent === winner)
  };
}

export async function refineWinningProposal(config, request, snapshot, proposals, critiques, selection) {
  const meta = AGENT_META[config.agent];
  const system = [
    `너는 ${meta.label} 역할의 구현 에이전트다.`,
    '여러 에이전트의 비평을 반영해 최종 패치를 다듬는다.',
    '최종 응답에는 어떤 전략이 채택되었고, 토론 끝에 어떤 논점이 정리되었는지 분명히 남긴다.',
    '반드시 JSON만 반환한다.',
    '최종 changes 배열은 실제 파일 적용이 가능한 전체 파일 내용이어야 한다.'
  ].join(' ');
  const user = [
    `사용자 요청: ${request}`,
    `선정된 에이전트: ${selection.winner}`,
    `Provider: ${config.provider}`,
    `Model: ${effectiveModelLabel(config)}`,
    '현재 워크스페이스:',
    workspaceContext(snapshot),
    '전체 제안:',
    JSON.stringify(proposals),
    '비평 결과:',
    JSON.stringify(critiques),
    '투표 현황:',
    JSON.stringify(selection.votes),
    `반드시 아래 스키마만 반환하라: ${refinementSchema()}`
  ].join('\n');

  const refined = await callProvider(
    config.provider,
    getStoredCredential(config.provider),
    system,
    user,
    config.model
  );
  refined.winner = selection.winner;
  refined.changes = validateChanges(refined.changes);
  refined.winningStrategy ??= selection.proposal?.strategy ?? 'Unnamed Strategy';
  refined.reasons ??= [];
  refined.debateResolution ??= [];
  refined.postApplyChecks ??= [];
  return refined;
}

export async function orchestrateWorkspacePatch(request, snapshot, agentConfigs, options = {}) {
  const onEvent = typeof options.onEvent === 'function' ? options.onEvent : null;
  const proposals = [];
  for (const config of agentConfigs) {
    const proposal = await generateAgentProposal(config, request, snapshot);
    proposals.push(proposal);
    onEvent?.({
      type: 'proposal',
      agent: config.agent,
      proposal,
      proposals: [...proposals]
    });
  }

  const critiques = [];
  for (const config of agentConfigs) {
    const critique = await generateAgentCritique(config, request, snapshot, proposals);
    critiques.push(critique);
    onEvent?.({
      type: 'critique',
      agent: config.agent,
      critique,
      critiques: [...critiques],
      proposals
    });
  }

  const selection = selectWinningProposal(proposals, critiques);
  onEvent?.({
    type: 'selection',
    selection,
    proposals,
    critiques
  });
  const winnerConfig = agentConfigs.find((config) => config.agent === selection.winner);
  const finalPatch = await refineWinningProposal(winnerConfig, request, snapshot, proposals, critiques, selection);
  onEvent?.({
    type: 'final',
    finalPatch,
    selection,
    proposals,
    critiques
  });

  return {
    proposals,
    critiques,
    selection,
    finalPatch
  };
}
