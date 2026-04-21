import type {
  LlmTool,
  LlmToolCall,
  LlmToolDeclaration,
  ToolExecutionContext,
} from './types.js';

export class ToolManager {
  private readonly tools = new Map<string, LlmTool>();

  register(tool: LlmTool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool already registered: ${tool.name}`);
    }

    this.tools.set(tool.name, tool);
  }

  getDeclarations(): LlmToolDeclaration[] {
    return [...this.tools.values()].map((tool) => tool.declaration);
  }

  async execute(
    call: LlmToolCall,
    context: ToolExecutionContext,
  ): Promise<Record<string, unknown>> {
    const tool = this.tools.get(call.name);
    if (!tool) {
      return { ok: false, error: `Unknown tool: ${call.name}` };
    }

    try {
      return await tool.execute(call, context);
    } catch (error) {
      console.error(`Could not execute tool: ${call.name}`, {
        args: call.args,
        error,
        id: call.id,
      });
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Unexpected tool error.',
      };
    }
  }
}
