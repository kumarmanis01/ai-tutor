export async function resolvePublishedOutputForScope(db: any, scope: any, scopeRefId: string) {
  const published = await (db as any).publishedOutput.findUnique({ where: { scope_scopeRefId: { scope, scopeRefId } } })
  if (!published) return null
  const out = await (db as any).regenerationOutput.findUnique({ where: { id: published.outputRef } as any })
  if (!out) return null
  return { published, output: out }
}

export default resolvePublishedOutputForScope
