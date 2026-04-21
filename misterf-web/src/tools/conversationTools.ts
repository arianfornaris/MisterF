import { ToolManager } from './ToolManager.js';
import { StartSentenceChallengeTool } from './StartSentenceChallengeTool.js';
import { UpdateConversationTitleTool } from './UpdateConversationTitleTool.js';
import { UpdateLearningProgressTool } from './UpdateLearningProgressTool.js';
import { UpdateSentenceEvaluationTool } from './UpdateSentenceEvaluationTool.js';

export function createConversationToolManager(): ToolManager {
  const manager = new ToolManager();
  manager.register(new StartSentenceChallengeTool());
  manager.register(new UpdateLearningProgressTool());
  manager.register(new UpdateConversationTitleTool());
  manager.register(new UpdateSentenceEvaluationTool());
  return manager;
}
