/**
 * @fileoverview Requires every exported Server Action to start with an
 * authorisation guard.
 *
 * Proxy route guards don't cover this: Server Functions POST to whatever
 * route uses them, so a refactor can silently drop coverage without the
 * action's own code changing. Detection is structural — the action (or a
 * local helper it calls) must call a guard first.
 */

const GUARD_NAMES = new Set([
  "requireSession",
  "requirePermission",
  "requireSelfOrPermission",
  "checkPermission",
  "requireAdmin",
  "checkAdmin",
]);

/**
 * Files exempt from the rule, each with the reason.
 * Keep this short — every entry is a hole in the enforcement.
 */
const ALLOWLIST = new Map([
  [
    "admin-auth.ts",
    "The admin sign-in and sign-out actions: there is no session to guard on " +
      "the way in, and signing out without one is a no-op. This file must " +
      "contain nothing but those two actions.",
  ],
]);

/** Unwraps `await x`, `foo()`, `a.b()` to the callee identifier name. */
function calleeName(node) {
  if (!node) return null;
  if (node.type === "AwaitExpression") return calleeName(node.argument);
  if (node.type === "CallExpression") {
    if (node.callee.type === "Identifier") return node.callee.name;
    if (node.callee.type === "MemberExpression" && node.callee.property.type === "Identifier") {
      return node.callee.property.name;
    }
  }
  return null;
}

/** The first meaningful statement of a function body, skipping directives. */
function firstStatements(body, count = 3) {
  if (!body || body.type !== "BlockStatement") return [];
  return body.body
    .filter((stmt) => !(stmt.type === "ExpressionStatement" && stmt.expression.type === "Literal"))
    .slice(0, count);
}

function statementCallsGuard(stmt, localHelpers) {
  let expression = null;
  if (stmt.type === "VariableDeclaration") {
    expression = stmt.declarations[0]?.init ?? null;
  } else if (stmt.type === "ExpressionStatement") {
    expression = stmt.expression;
  } else if (stmt.type === "ReturnStatement") {
    expression = stmt.argument;
  }

  const name = calleeName(expression);
  if (!name) return false;
  return GUARD_NAMES.has(name) || localHelpers.has(name);
}

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Exported Server Actions must call an authorisation guard first",
    },
    schema: [],
    messages: {
      missingGuard:
        "Server Action '{{name}}' does not begin with an authorisation guard. " +
        "Call requireSession, requirePermission, requireSelfOrPermission or checkPermission " +
        "as its first statement. Proxy coverage is not a substitute — " +
        "Server Functions are POSTs to whatever route uses them, so a matcher change can " +
        "silently remove it.",
    },
  },

  create(context) {
    const filename = context.filename ?? context.getFilename();
    const normalised = filename.replace(/\\/g, "/");

    if (!normalised.includes("/app/actions/")) return {};

    const basename = normalised.split("/").pop() ?? "";
    if (ALLOWLIST.has(basename)) return {};

    // Module-local helpers that themselves start with a guard count as guards,
    // so a shared `authoriseX()` in the same file is not a false positive.
    const localHelpers = new Set();

    function collectHelper(node, name) {
      if (!name) return;
      for (const stmt of firstStatements(node.body)) {
        if (statementCallsGuard(stmt, localHelpers)) {
          localHelpers.add(name);
          return;
        }
      }
    }

    return {
      "Program:exit"(program) {
        for (const node of program.body) {
          if (node.type === "FunctionDeclaration" && node.id) {
            collectHelper(node, node.id.name);
          }
          if (node.type === "VariableDeclaration") {
            for (const decl of node.declarations) {
              if (
                decl.id.type === "Identifier" &&
                decl.init &&
                (decl.init.type === "ArrowFunctionExpression" ||
                  decl.init.type === "FunctionExpression")
              ) {
                collectHelper(decl.init, decl.id.name);
              }
            }
          }
        }

        for (const node of program.body) {
          if (node.type !== "ExportNamedDeclaration" || !node.declaration) continue;
          const declaration = node.declaration;

          const functions = [];
          if (declaration.type === "FunctionDeclaration" && declaration.id) {
            functions.push({ name: declaration.id.name, fn: declaration });
          }
          if (declaration.type === "VariableDeclaration") {
            for (const decl of declaration.declarations) {
              if (
                decl.id.type === "Identifier" &&
                decl.init &&
                (decl.init.type === "ArrowFunctionExpression" ||
                  decl.init.type === "FunctionExpression")
              ) {
                functions.push({ name: decl.id.name, fn: decl.init });
              }
            }
          }

          for (const { name, fn } of functions) {
            const guarded = firstStatements(fn.body).some((stmt) =>
              statementCallsGuard(stmt, localHelpers)
            );
            if (!guarded) {
              context.report({ node: fn, messageId: "missingGuard", data: { name } });
            }
          }
        }
      },
    };
  },
};

const plugin = {
  meta: { name: "pulse", version: "1.0.0" },
  rules: { "no-unguarded-server-action": rule },
};

export default plugin;
