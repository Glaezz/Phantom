import type { AgentVerdict, AnalysisResult } from './schemas';

export interface MergedVerdict {
  status: 'neutral' | 'caution' | 'danger' | 'official';
  source: 'rules' | 'agent';
  capped: boolean;
}

const RANK: Record<'neutral' | 'caution' | 'danger', number> = {
  neutral: 0,
  caution: 1,
  danger: 2,
};

function higher(
  a: 'neutral' | 'caution' | 'danger',
  b: 'neutral' | 'caution' | 'danger',
): 'neutral' | 'caution' | 'danger' {
  return RANK[a] >= RANK[b] ? a : b;
}

export function mergeVerdict(
  rule: AnalysisResult,
  agent: AgentVerdict | null,
): MergedVerdict {
  if (rule.status === 'official') {
    return { status: 'official', source: 'rules', capped: false };
  }

  if (agent === null) {
    return { status: rule.status, source: 'rules', capped: false };
  }

  let agentStatus: 'neutral' | 'caution' | 'danger' = agent.verdict;
  let capped = false;
  if (agentStatus === 'danger' && agent.evidenceRefs.length === 0) {
    agentStatus = 'caution';
    capped = true;
  }

  const status = higher(rule.floor, agentStatus);
  return {
    status,
    source: status !== rule.status ? 'agent' : 'rules',
    capped,
  };
}
