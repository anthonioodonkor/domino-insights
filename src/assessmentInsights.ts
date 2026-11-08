export type Edge = { dependencyId: string; parentComponentId: string; childComponentId: string };
export type Rule = { dependencyId: string; requirementGroup: string; relationshipType: string };

export function parseIds(value: string): string[] {
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed) || parsed.some(id => typeof id !== 'string')) {
    throw new Error('The saved assessment contains invalid identifiers.');
  }
  return [...new Set(parsed as string[])];
}

// Explain the server's persisted result; do not run a second cascade prediction.
export function explainAssessment(root: string, affected: string[], edges: readonly Edge[], rules: readonly Rule[]) {
  const impacted = new Set([root, ...affected]);
  const ruleMap = new Map(rules.map(rule => [rule.dependencyId, rule]));
  const groups = new Map<string, { child: string; group: string; relationship: string; sources: string[] }>();
  for (const edge of edges.filter(edge => edge.dependencyId.startsWith('MS-DEP-'))) {
    const rule = ruleMap.get(edge.dependencyId);
    if (!rule) throw new Error(`Missing dependency rule for ${edge.dependencyId}`);
    const key = JSON.stringify([edge.childComponentId, rule.requirementGroup]);
    const group = groups.get(key) ?? { child: edge.childComponentId, group: rule.requirementGroup, relationship: rule.relationshipType, sources: [] };
    group.sources.push(edge.parentComponentId);
    groups.set(key, group);
  }
  const relevant = [...groups.values()].filter(group => group.sources.some(id => impacted.has(id)));
  return {
    disrupted: relevant.filter(group => group.child !== root && impacted.has(group.child) && group.sources.every(id => impacted.has(id))),
    protected: relevant.filter(group => !impacted.has(group.child) && group.sources.some(id => !impacted.has(id)))
      .map(group => ({ ...group, survivingSources: group.sources.filter(id => !impacted.has(id)) })),
  };
}

export function exposureForMinutes(hourly: number, minutes: number) {
  if (!Number.isFinite(hourly) || hourly < 0 || !Number.isFinite(minutes) || minutes < 0 || minutes > 240) {
    throw new Error('Exposure requires a nonnegative rate and a duration from 0 to 240 minutes.');
  }
  return hourly * minutes / 60;
}

export function responseGuidance(domain: string, root: string) {
  if (root.includes('PUMP')) return 'Investigate the shared cooling pump and verify flow to both air handlers. A second chiller does not bypass this shared pump.';
  if (domain === 'HVAC') return 'Verify cooling availability and inspect the affected equipment. Confirm that the alternate supply and its controls can support the load.';
  if (domain === 'UTILITIES') return 'Request an electrical inspection and verify the modeled alternate power path before considering a simulated transfer.';
  if (domain === 'ACCESS_CONTROL') return 'Coordinate with security to verify maintenance access and an authorized alternate route.';
  return 'Assign facilities to verify the affected service and coordinate with the downstream asset owners.';
}
