// Phase 4: guards against a template that references itself, directly or
// through other templates, which would otherwise recurse forever - each
// nested `custom:decluttering-card` reference mounts as a genuinely separate
// custom element (looked up by template name independently, not literally
// embedded content), so there's no natural call stack to detect a cycle
// with. The chain is threaded through the thing config itself instead.

export function assertNoRecursion(chain: string[], templateName: string): void {
  if (chain.includes(templateName)) {
    throw new Error(
      `Template "${templateName}" references itself, directly or through other templates ` +
        `(${[...chain, templateName].join(' -> ')}). This would recurse forever.`,
    );
  }
}

// If a template's own content turns out to itself be a nested
// decluttering-card reference, thread the current chain into it so its own
// setConfig can detect a cycle too when it mounts and resolves its template.
export function threadChainIntoNestedReference(thingConfig: unknown, chain: string[]): void {
  if (
    thingConfig &&
    typeof thingConfig === 'object' &&
    (thingConfig as { type?: unknown }).type === 'custom:decluttering-card'
  ) {
    (thingConfig as Record<string, unknown>).__declutteringChain = chain;
  }
}

export function extractInheritedChain(config: unknown): string[] {
  if (config && typeof config === 'object' && Array.isArray((config as Record<string, unknown>).__declutteringChain)) {
    return (config as Record<string, unknown>).__declutteringChain as string[];
  }
  return [];
}
