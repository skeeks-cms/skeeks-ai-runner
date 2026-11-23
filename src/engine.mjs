/**
 * Engine contract: runStep({binding, sessionId, turn, image, history, request, steps})
 * returns {sessionId, step}. binding is the stable site/chat key. sessionId is
 * opaque, or null for an API without resumable sessions. history contains the
 * site's visible messages; request and steps carry the current tool loop.
 * Tools and confirmations are executed by the service, never by this adapter.
 */
export async function loadEngine(id) {
  switch (id) {
    case "claude":
      return (await import("./claude-engine.mjs")).createClaudeEngine(process.env.SKEEKS_AI_CLAUDE_PROFILE);
    case "codex":
      return (await import("./codex-engine.mjs")).codexEngine;
    default:
      throw new Error("Неизвестный движок SkeekS AI: " + id);
  }
}

const actions = new Set(["answer", "skill", "schema", "execute", "attachment", "background"]);

export async function runEngineStep(engine, input) {
  const {sessionId, step} = await engine.runStep(input);
  if (sessionId !== null && (typeof sessionId !== "string" || !sessionId.length || sessionId.length > 255)) {
    throw new Error("Некорректный идентификатор сессии движка.");
  }
  if (input.sessionId !== null && sessionId !== input.sessionId) {
    throw new Error("Сессия движка не совпадает с чатом.");
  }
  if (!step || !actions.has(step.action) ||
      (step.action === "answer" ? typeof step.answer !== "string" : typeof step.tool !== "string") ||
      (step.action === "execute" && typeof step.arguments_json !== "string")) {
    throw new Error("Некорректный ответ движка.");
  }
  return {sessionId, step};
}
