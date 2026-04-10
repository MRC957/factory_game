// ── Utilities ───────────────────────────────────────────────────────────
// fmt: formats a number as a dollar amount, e.g. 12.5 → "$12.50"
function fmt(n)   { return "$" + n.toFixed(2); }
// fmtCash: use separators only when absolute cash reaches at least 1000.
function fmtCash(n) {
  if (Math.abs(n) >= 1000) {
    return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return "$" + n.toFixed(2);
}
// fmtS: signed dollar amount for margins/deltas, e.g. -5 → "-$5.00", 3 → "+$3.00"
function fmtS(n)  { return (n >= 0 ? "+" : "") + "$" + n.toFixed(2); }

// Append one or more lines to the activity log at the bottom of the screen.
// msg may contain newlines (multi-day advance output); each line gets its own div.
// When cls is empty, each line is auto-classified: contract failed → red,
// contract expired → orange.
function log(msg, cls = "") {
  const box = document.getElementById("log-box");
  msg.split("\n").filter(Boolean).forEach(line => {
    const div = document.createElement("div");
    let lineCls = cls;
    if (!lineCls) {
      if (/contract.*failed|penalty.*deducted/i.test(line)) lineCls = "log-err";
      else if (/contract.*expired/i.test(line)) lineCls = "log-warn";
    }
    div.className = "log-entry " + lineCls;
    div.textContent = line;
    box.appendChild(div);
  });
  box.scrollTop = box.scrollHeight;
}

// Insert a day-separator heading before the automation output of a new day.
function logDay(day) {
  const div = document.createElement("div");
  div.className = "log-entry log-day";
  div.textContent = "── Day " + day + " ──────────────────";
  document.getElementById("log-box").appendChild(div);
  document.getElementById("log-box").scrollTop = document.getElementById("log-box").scrollHeight;
}

// Thin fetch wrapper: GET when body is null, POST+JSON otherwise.
// All action endpoints return {message, state}; /api/state just returns the state dict.
async function api(path, body = null) {
  const startedAt = performance.now();
  const opts = body
    ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
    : { method: "GET" };
  const res = await fetch(path, opts);
  const payload = await res.json();
  const elapsed = performance.now() - startedAt;
  console.debug(`[api] ${path} ${elapsed.toFixed(1)}ms`);
  return payload;
}
