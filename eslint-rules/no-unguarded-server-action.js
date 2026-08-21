/**
 * @fileoverview Requires every exported Server Action to begin with an
 * authorisation guard.
 *
 * Server Functions are handled as POST requests to whatever route they are used
 * on, so a matcher change or a refactor that moves one can silently remove proxy
 * coverage from an action whose own code never changed. A missing guard is
 * therefore not caught by reviewing the diff that breaks it.
 *
 * Detection is structural rather than name-based where it can be: an exported
 * async function in an action module must, before any other statement, either
 * call a known guard or delegate to another function in the same module that
 * does. Files may opt out with a documented allowlist entry.
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
 * Keep this short — every entry is a hole in the enforcement. Empty since M17
 * removed break-glass, which was the only action module that ever claimed one.
 */
const ALLOWLIST = new Map();

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

    // Only applies to Server Action modules.
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
        // First pass: learn which local functions are themselves guarded.
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

        // Second pass: every exported function must be guarded.
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
