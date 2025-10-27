const scope = globalThis as Record<string, unknown>

if (typeof scope.__vite_ssr_exportName__ !== 'function') {
  scope.__vite_ssr_exportName__ = (
    target: Record<string, unknown>,
    name: string,
    valueOrGetter: unknown,
  ) => {
    if (!target || typeof target !== 'object') {
      return
    }
    if (!Object.prototype.hasOwnProperty.call(target, name)) {
      if (typeof valueOrGetter === 'function') {
        Object.defineProperty(target, name, {
          enumerable: true,
          get: valueOrGetter as () => unknown,
        })
      } else {
        Object.defineProperty(target, name, { enumerable: true, value: valueOrGetter })
      }
    }
  }
}
