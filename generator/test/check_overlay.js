// Comprehensive overlay script audit
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/../js/cinematic-editor.js', 'utf-8');

// Extract the overlay function body
const marker = "function _getOverlayScript() {";
const start = src.indexOf(marker);
if (start < 0) { console.log("ERROR: Could not find _getOverlayScript"); process.exit(1); }

// Find matching closing brace
let depth = 0, i = start + marker.length - 1;
for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) break; }
}
const funcBody = src.substring(start, i + 1);

let errors = [];
let warnings = [];

// Eval the function and get the script
try {
    const fn = new Function(funcBody + '\nreturn _getOverlayScript();');
    const script = fn();
    console.log("Generated overlay script length:", script.length);
    
    // Syntax check
    try {
        new Function(script);
        console.log("SYNTAX CHECK: PASSED");
    } catch(e) {
        errors.push("SYNTAX ERROR: " + e.message);
        const lines = script.split('\n');
        const lineMatch = e.message.match(/position (\d+)/);
        if (lineMatch) {
            const pos = parseInt(lineMatch[1]);
            const before = script.substring(Math.max(0, pos - 100), pos);
            const after = script.substring(pos, pos + 100);
            console.log("Context around error:");
            console.log("BEFORE: ..." + before);
            console.log("AFTER: " + after + "...");
        }
    }
    
    // ─── Structural Checks ───
    
    // Check IIFE wrapping
    if (!script.startsWith('(function(){')) errors.push("Missing IIFE start");
    if (!script.endsWith('})();')) errors.push("Missing IIFE end");
    
    // Check critical variable declarations
    const criticalVars = ['selected', 'primary', 'editing', 'drag', 'resize', 'marquee', 'rotating', 'justDragged', '_dragRaf'];
    criticalVars.forEach(v => {
        if (script.indexOf('var ' + v) < 0 && script.indexOf(',' + v) < 0 && script.indexOf(', ' + v) < 0) {
            errors.push("Missing variable declaration: " + v);
        }
    });
    
    // Check event listeners
    const reqListeners = [
        ['mousedown', 'drag start handler'],
        ['mousemove', 'drag/resize/rotate handler'],
        ['mouseup', 'drag end handler'],
        ['click', 'selection handler'],
        ['dblclick', 'inline edit handler'],
        ['contextmenu', 'right-click handler'],
        ['scroll', 'handle reposition on scroll'],
        ['message', 'parent communication handler']
    ];
    reqListeners.forEach(([evt, desc]) => {
        const pattern = new RegExp('addEventListener\\("' + evt + '"');
        if (!pattern.test(script)) {
            errors.push("Missing event listener: " + evt + " (" + desc + ")");
        }
    });
    
    // Check critical functions
    const criticalFns = ['posHandles', 'computeSnap', 'hideSnap', 'sendSel', 'sel', 'desel', 'startEdit', 'stopEdit'];
    criticalFns.forEach(fn => {
        if (script.indexOf('function ' + fn) < 0) {
            errors.push("Missing function: " + fn);
        }
    });
    
    // Check postMessage types
    const msgTypes = ['arbel-multi-move', 'arbel-move-end', 'arbel-select', 'arbel-resize', 'arbel-resize-end', 'arbel-rotate', 'arbel-key', 'arbel-contextmenu'];
    msgTypes.forEach(t => {
        if (script.indexOf('"' + t + '"') < 0) {
            errors.push("Missing postMessage type: " + t);
        }
    });
    
    // Check RAF batching pattern
    if (script.indexOf('_dragRaf=requestAnimationFrame') < 0) {
        errors.push("Missing RAF batching for drag");
    }
    if (script.indexOf('cancelAnimationFrame(_dragRaf)') < 0) {
        errors.push("Missing cancelAnimationFrame on mouseup");
    }
    
    // Check drag code flow
    const dragStartIdx = script.indexOf('if(!drag)return;');
    const rafStartIdx = script.indexOf('_dragRaf=requestAnimationFrame');
    const multiMoveIdx = script.indexOf('"arbel-multi-move"');
    const moveEndIdx = script.indexOf('"arbel-move-end"');
    
    if (dragStartIdx < 0) errors.push("Missing drag guard 'if(!drag)return'");
    if (rafStartIdx < 0) errors.push("Missing RAF scheduling");
    if (multiMoveIdx < 0) errors.push("Missing arbel-multi-move message");
    if (moveEndIdx < 0) errors.push("Missing arbel-move-end message");
    
    if (dragStartIdx >= 0 && rafStartIdx >= 0 && multiMoveIdx >= 0) {
        if (!(dragStartIdx < rafStartIdx && rafStartIdx < multiMoveIdx)) {
            errors.push("Drag code ORDER wrong: guard→RAF→postMessage should be sequential");
        }
    }
    
    // Check drag origins collection
    if (script.indexOf('origTop:selected[i].offsetTop') < 0) {
        warnings.push("offsetTop not used for drag origin — might use different property");
    }
    if (script.indexOf('origLeft:selected[i].offsetLeft') < 0) {
        warnings.push("offsetLeft not used for drag origin — might use different property");
    }
    
    // Check brace/bracket balance (skip paren check — naive string parser
    // produces false positives on nested quote patterns; syntax check above
    // is the authoritative validation)
    let braceDepth = 0;
    let bracketDepth = 0;
    let inStr = false;
    let strChar = '';
    for (let c = 0; c < script.length; c++) {
        const ch = script[c];
        if (inStr) {
            if (ch === '\\') { c++; continue; }
            if (ch === strChar) inStr = false;
            continue;
        }
        if (ch === '"' || ch === "'") { inStr = true; strChar = ch; continue; }
        if (ch === '{') braceDepth++;
        if (ch === '}') braceDepth--;
        if (ch === '[') bracketDepth++;
        if (ch === ']') bracketDepth--;
    }
    if (braceDepth !== 0) errors.push("UNBALANCED BRACES: depth=" + braceDepth);
    if (bracketDepth !== 0) errors.push("UNBALANCED BRACKETS: depth=" + bracketDepth);
    
    // Check for suspicious 'undefined' — skip legitimate uses like ===undefined
    const undefinedPattern = /(?<![!=])undefined/g;
    let undMatch;
    while ((undMatch = undefinedPattern.exec(script)) !== null) {
        const ctx = script.substring(Math.max(0, undMatch.index - 40), undMatch.index + 50);
        warnings.push("Found suspicious 'undefined' in script: ..." + ctx + "...");
    }
    
    // Check position update flow: element style assignment
    if (script.indexOf('.style.top=') < 0) errors.push("No direct style.top assignment for drag");
    if (script.indexOf('.style.left=') < 0) errors.push("No direct style.left assignment for drag");
    
    // Print dump of drag section for manual review
    console.log("\n─── DRAG SECTION DUMP ───");
    const dragGuardIdx = script.indexOf('if(!drag)return;');
    if (dragGuardIdx >= 0) {
        // Find the end — look for });  which closes the mousemove handler
        const dragSection = script.substring(dragGuardIdx, dragGuardIdx + 1200);
        console.log(dragSection);
    }
    
    // Print report
    console.log("\n═══ AUDIT REPORT ═══");
    if (errors.length === 0) {
        console.log("✓ No errors found");
    } else {
        errors.forEach(e => console.log("✗ ERROR: " + e));
    }
    if (warnings.length > 0) {
        console.log("");
        warnings.forEach(w => console.log("⚠ WARNING: " + w));
    }
    
} catch(e) {
    console.log("EVAL ERROR:", e.message, e.stack);
}
