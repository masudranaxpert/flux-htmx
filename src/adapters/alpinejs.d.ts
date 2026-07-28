declare module 'alpinejs' {
  export interface Alpine {
    data(name: string, factory: (...args: unknown[]) => unknown): void;
    store(name: string, value?: unknown): unknown;
    initTree(node: Element): void;
    start(): void;
    plugin(cb: (alpine: Alpine) => void): void;
  }
  const Alpine: Alpine;
  export default Alpine;
}
