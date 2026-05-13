import { ToolManager } from './ToolManager.js';
import { UpdateConversationTitleTool } from './UpdateConversationTitleTool.js';
import { UpdateLearningProgressTool } from './UpdateLearningProgressTool.js';
import { UpdateSentenceEvaluationTool } from './UpdateSentenceEvaluationTool.js';
export function createConversationToolManager() {
    const manager = new ToolManager();
    manager.register(new UpdateLearningProgressTool());
    manager.register(new UpdateConversationTitleTool());
    manager.register(new UpdateSentenceEvaluationTool());
    return manager;
}
//# sourceMappingURL=conversationTools.js.map