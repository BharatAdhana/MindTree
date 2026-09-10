const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// Inject console logs to debug positionContext
html = html.replace(
  'function positionContext(positions){',
  'function positionContext(positions){\n  console.log("positionContext called, selected:", selected);\n  const ctx=document.getElementById("context");\n  console.log("early return checks:", {activeConnection, contextVisible: typeof contextVisible !== "undefined" ? contextVisible : "undef", selected, posSel: positions[selected]});\n'
);

html = html.replace(
  'ctx.classList.add("show");',
  'ctx.classList.add("show");\n  console.log("ADDED SHOW TO CTX! left:", ctx.style.left, "top:", ctx.style.top);\n'
);

html = html.replace(
  'document.getElementById("ctxLineLength").value = node(selected)?.childLineLength || (40 + 100 * (state.view?.density || 1.0));',
  'try { document.getElementById("ctxLineLength").value = node(selected)?.childLineLength || (40 + 100 * (state.view?.density || 1.0)); console.log("Set ctxLineLength success"); } catch (e) { console.error("Error setting ctxLineLength:", e); }'
);

fs.writeFileSync('index.html', html, 'utf8');
console.log("Debug patch applied");
