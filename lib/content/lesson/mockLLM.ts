export class MockLLM {
  private response: string
  constructor(response: string) {
    this.response = response
  }
  async generate(_prompt: string): Promise<string> {
    void _prompt
    return this.response
  }
}

export function createMockLLM(response: string) {
  return new MockLLM(response)
}

export default MockLLM
