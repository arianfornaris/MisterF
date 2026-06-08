export class TutorPlanValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'TutorPlanValidationError';
    }
}
export function applyTutorPlanBlocks(blocks, currentPlan) {
    const planBlocks = blocks.filter((block) => block.type === 'tutor_plan' || block.type === 'tutor_plan_update');
    if (planBlocks.length === 0) {
        return null;
    }
    if (planBlocks.length > 1) {
        throw new TutorPlanValidationError('Invalid tutor plan update: emit at most one tutor_plan or tutor_plan_update block in one response.');
    }
    const block = planBlocks[0];
    if (block.type === 'tutor_plan') {
        if (currentPlan && !isTutorPlanComplete(currentPlan)) {
            throw new TutorPlanValidationError('Invalid tutor plan update: tutor_plan cannot be emitted when a plan already exists. Use tutor_plan_update operations instead.');
        }
        return createPlanFromBlock(block);
    }
    if (!currentPlan || isTutorPlanComplete(currentPlan)) {
        throw new TutorPlanValidationError('Invalid tutor plan update: tutor_plan_update requires an active tutor plan.');
    }
    return applyPlanUpdateBlock(currentPlan, block);
}
export function formatTutorPlanForModel(plan) {
    if (!plan) {
        return '';
    }
    const activeStep = plan.steps.find((step) => step.status === 'active');
    return [
        `title: ${plan.title}`,
        plan.summary ? `summary: ${plan.summary}` : '',
        `active step: ${activeStep ? activeStep.id : '(none)'}`,
        'steps:',
        ...plan.steps.map((step) => `- ${step.id}: ${step.status} — ${step.label}`),
    ].filter(Boolean).join('\n');
}
function createPlanFromBlock(block) {
    const steps = block.steps.map((step) => ({
        id: step.id,
        label: step.label,
        status: step.status,
    }));
    assertAtMostOneActiveStep(steps);
    return {
        steps,
        summary: block.summary,
        title: block.title,
    };
}
function applyPlanUpdateBlock(currentPlan, block) {
    let steps = currentPlan.steps.map((step) => ({ ...step }));
    for (const operation of block.operations) {
        if (operation.action === 'update_step') {
            steps = applyUpdateStepOperation(steps, operation);
        }
        else {
            steps = applyAddStepOperation(steps, operation);
        }
    }
    assertAtMostOneActiveStep(steps);
    return {
        steps,
        summary: currentPlan.summary,
        title: currentPlan.title,
    };
}
function applyUpdateStepOperation(steps, operation) {
    const index = steps.findIndex((step) => step.id === operation.id);
    if (index === -1) {
        throw new TutorPlanValidationError(`Invalid tutor plan update: step id "${operation.id}" does not exist.`);
    }
    return steps.map((step, stepIndex) => {
        if (stepIndex !== index) {
            return step;
        }
        return {
            ...step,
            label: operation.label ?? step.label,
            status: operation.status ?? step.status,
        };
    });
}
function applyAddStepOperation(steps, operation) {
    if (steps.some((step) => step.id === operation.id)) {
        throw new TutorPlanValidationError(`Invalid tutor plan update: step id "${operation.id}" already exists.`);
    }
    const nextStep = {
        id: operation.id,
        label: operation.label,
        status: operation.status ?? 'pending',
    };
    if (!operation.afterId) {
        return [...steps, nextStep];
    }
    const afterIndex = steps.findIndex((step) => step.id === operation.afterId);
    if (afterIndex === -1) {
        throw new TutorPlanValidationError(`Invalid tutor plan update: afterId "${operation.afterId}" does not exist.`);
    }
    return [
        ...steps.slice(0, afterIndex + 1),
        nextStep,
        ...steps.slice(afterIndex + 1),
    ];
}
function assertAtMostOneActiveStep(steps) {
    const activeCount = steps.filter((step) => step.status === 'active').length;
    if (activeCount > 1) {
        throw new TutorPlanValidationError('Invalid tutor plan update: there must be at most one active step.');
    }
}
function isTutorPlanComplete(plan) {
    return plan.steps.every((step) => step.status === 'done' || step.status === 'skipped');
}
//# sourceMappingURL=tutorPlans.js.map