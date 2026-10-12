/* Device selection stays in memory. No original files are modified. */
(() => {
  const el = id => document.getElementById(id);
  const MAX_UPLOAD = 25 * 1024 * 1024;
  const MAX_HASH = 128 * 1024 * 1024;
  let selected = new Map();
  const localFiles = new Map();
  let groups = [];
  let controller = null;
  let busy = false;
  let generation = 0;
  const text = value => String(value ?? "");
  const pathOf = file => file.webkitRelativePath || file.name;
  const keyOf = file => JSON.stringify([pathOf(file), file.size, file.lastModified]);
  const node = (tag, value, className) => {
    const n = document.createElement(tag);
    if (value !== undefined) n.textContent = text(value);
    if (className) n.className = className;
    return n;
  };
  function setBusy(value) {
    busy = value;
    ["choose-files", "choose-photos", "choose-folder", "content-analysis", "scan-btn"].forEach(id => el(id).disabled = value);
    el("device-scan-btn").disabled = value || !selected.size;
    el("clear-selection").disabled = value || !selected.size;
    el("cancel-scan").classList.toggle("hidden", !value);
    if (!value && !("webkitdirectory" in el("device-folder"))) el("choose-folder").disabled = true;
  }
  function renderSelection() {
    el("selection-summary").textContent = selected.size
      ? selected.size + " files selected · " + fmtBytes([...selected.values()].reduce((n, f) => n + f.size, 0))
      : "No files selected.";
    el("selection-list").replaceChildren();
    [...selected.values()].slice(0, 10).forEach(file => el("selection-list").append(node("li", pathOf(file))));
    if (selected.size > 10) el("selection-list").append(node("li", "And " + (selected.size - 10) + " more."));
    setBusy(busy);
  }
  function selectFiles(files) {
    if (busy) return;
    for (const file of files) selected.set(keyOf(file), file);
    renderSelection();
  }
  async function hashFile(file) {
    if (file.size > MAX_HASH) throw new Error("Above the 128 MB browser scan limit; choose a smaller file.");
    if (!globalThis.crypto?.subtle) throw new Error("Secure file scanning is unavailable in this browser. Use HTTPS and a current browser.");
    const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
    return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
  }
  function cancelled(signal) {
    if (signal.aborted) throw new DOMException("Scan stopped", "AbortError");
  }
  async function refreshAnalysis(signal) {
    const result = await api("/scan/analyze", { method: "POST", signal });
    cancelled(signal);
    renderGroups(result.duplicate_groups || []);
    await loadStats();
    try {
      const names = await api("/scan/rename-candidates", { signal });
      cancelled(signal);
      renderRenames(names.candidates || []);
    } catch (error) {
      if (signal.aborted) throw error;
      el("rename-list").replaceChildren(node("p", "Filename suggestions unavailable: " + error.message, "scan-help"));
    }
  }
  async function scanSelected() {
    if (busy || !selected.size || !token) return;
    const runGeneration = generation;
    const files = [...selected.values()];
    const includeContent = el("content-analysis").checked;
    controller = new AbortController();
    const signal = controller.signal;
    setBusy(true);
    el("scan-errors").replaceChildren();
    const progress = el("device-progress");
    progress.classList.remove("hidden");
    progress.max = files.length;
    progress.value = 0;
    let scanned = 0, failed = 0;
    try {
      // Reuse content-analysis records from earlier selections instead of creating
      // a duplicate merely because the same path was uploaded again.
      const previous = await api("/files", { signal });
      const uploaded = new Map((previous.files || []).filter(f => f.source === "internal").map(f => [JSON.stringify([f.name, f.size, f.sha256]), f]));
      for (const file of files) {
        cancelled(signal);
        el("device-status").textContent = "Scanning " + (progress.value + 1) + " of " + files.length + ": " + pathOf(file);
        try {
          const sha256 = await hashFile(file);
          cancelled(signal);
          const external_id = "web:" + keyOf(file);
          const identity = JSON.stringify([pathOf(file), file.size, sha256]);
          let record = uploaded.get(identity);
          if (!record && includeContent && file.size <= MAX_UPLOAD) {
              const form = new FormData();
              form.append("file", file, pathOf(file));
              record = await api("/files/upload", { method: "POST", body: form, signal });
              uploaded.set(identity, record);
          } else if (!record) {
            await api("/files/register", { method: "POST", signal, body: JSON.stringify({ items: [{
              name: pathOf(file), size: file.size, mime_type: file.type, sha256,
              external_id, created_at: new Date(file.lastModified || Date.now()).toISOString()
            }] }) });
          }
          cancelled(signal);
          // Resolve registered IDs after the batch; uploaded records return an ID.
          if (record?.id) localFiles.set(record.id, file);
          scanned++;
        } catch (error) {
          if (signal.aborted || !token) throw error;
          failed++;
          el("scan-errors").append(node("li", pathOf(file) + ": " + error.message));
        }
        progress.value++;
      }
      cancelled(signal);
      if (scanned) {
        el("device-status").textContent = "Comparing scanned files…";
        await refreshAnalysis(signal);
      }
      el("device-status").textContent = scanned + " files scanned; " + failed + " skipped or failed. Review the results below.";
    } catch (error) {
      if (runGeneration === generation) el("device-status").textContent = signal.aborted
        ? "Scan stopped. " + scanned + " files completed. Completed records remain in your account; review them with a new scan."
        : "Scan failed: " + error.message;
    } finally {
      if (runGeneration === generation) {
        controller = null;
        setBusy(false);
      }
    }
  }
  function renderGroups(nextGroups) {
    if (!token) return;
    groups = nextGroups;
    const list = el("groups-list");
    list.replaceChildren();
    el("export-report").disabled = !groups.length;
    if (!groups.length) {
      list.append(node("p", "No duplicate groups found in the scanned records.", "empty-state"));
      return;
    }
    for (const group of groups) {
      const card = node("div", undefined, "group-card");
      card.append(node("div", text(group.kind).replace(/_/g, " "), "kind"));
      card.append(node("p", group.reason || "Compare these files before deciding what to keep.", "reason"));
      for (const file of group.files || []) {
        if (file.source === "internal" && file.external_id?.startsWith("web:")) {
          const original = selected.get(file.external_id.slice(4));
          if (original) localFiles.set(file.id, original);
        }
        const keep = file.id === group.keep_id;
        const row = node("div", undefined, "file-item " + (keep ? "keep" : "review"));
        row.append(node("span", (keep ? "Suggested keep: " : "Review: ") + file.name));
        row.append(node("span", fmtBytes(file.size)));
        row.append(node("span", file.source === "internal" ? "Device scan" : file.source, "badge"));
        if (!keep && file.source === "internal") {
          const remove = node("button", "Remove scan record", "ghost");
          remove.type = "button";
          remove.addEventListener("click", async () => {
            if (busy || !confirm("Remove the scan record for " + file.name + "? Your original device file will NOT be deleted and device storage will not be freed.")) return;
            remove.disabled = true;
            try {
              await api("/files/" + encodeURIComponent(file.id), { method: "DELETE" });
              localFiles.delete(file.id);
              // Removing a record is account-only for internal files.
              const result = await api("/scan/analyze", { method: "POST" });
              renderGroups(result.duplicate_groups || []);
              await loadStats();
            } catch (error) { toast(error.message); remove.disabled = false; }
          });
          row.append(remove);
        }
        card.append(row);
      }
      list.append(card);
    }
  }
  function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = node("a");
    link.href = url; link.download = filename;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  function renderRenames(files) {
    if (!token) return;
    const list = el("rename-list");
    list.replaceChildren();
    if (!files.length) list.append(node("p", "No filename suggestions available. Content analysis can provide more useful document suggestions.", "scan-help"));
    for (const file of files) {
      const row = node("div", undefined, "rename-row");
      row.append(node("p", file.name + " → " + file.ai_suggested_name));
      const original = localFiles.get(file.id);
      if (original) {
        const button = node("button", "Download renamed copy", "ghost");
        button.type = "button";
        button.addEventListener("click", () => {
          const extension = original.name.includes(".") ? "." + original.name.split(".").pop() : "";
          let name = text(file.ai_suggested_name).replace(/[\\/:*?"<>|\x00-\x1f]/g, "_").replace(/^\.+/, "").slice(0, 150) || "renamed-file";
          if (extension && !name.toLowerCase().endsWith(extension.toLowerCase())) name += extension;
          download(original, name);
        });
        row.append(button);
      } else row.append(node("p", "Rename the original in your device's file manager or cloud account.", "scan-help"));
      list.append(row);
    }
  }
  function reset() {
    generation++;
    controller?.abort();
    controller = null;
    selected.clear(); localFiles.clear(); groups = [];
    ["device-files", "device-photos", "device-folder"].forEach(id => el(id).value = "");
    el("scan-errors").replaceChildren();
    el("device-status").textContent = "";
    el("scan-status").textContent = "";
    el("content-analysis").checked = false;
    el("device-progress").classList.add("hidden");
    el("groups-list").replaceChildren(node("p", "Run a scan to find duplicates.", "empty-state"));
    el("rename-list").replaceChildren();
    el("export-report").disabled = true;
    busy = false; renderSelection();
  }
  async function scanCloud() {
    if (busy || !token) return;
    const runGeneration = generation;
    controller = new AbortController();
    const signal = controller.signal;
    setBusy(true);
    try {
      const sources = await api("/sources", { signal });
      const supported = sources.filter(s => ["gdrive", "dropbox"].includes(s.type));
      if (!supported.length) {
        el("scan-status").textContent = "Connect Google Drive or Dropbox first, or choose device files above.";
        return;
      }
      for (const source of supported) {
        cancelled(signal);
        el("scan-status").textContent = "Scanning " + source.label + "…";
        await api("/scan/" + source.type + "/" + encodeURIComponent(source.id), { method: "POST", signal });
      }
      el("scan-status").textContent = "Comparing files…";
      await refreshAnalysis(signal);
      el("scan-status").textContent = "Cloud scan complete. Review results below.";
    } catch (error) {
      if (runGeneration === generation) el("scan-status").textContent = signal.aborted ? "Cloud scan stopped. Completed records remain in your account." : "Cloud scan failed: " + error.message;
    } finally {
      if (runGeneration === generation) { controller = null; setBusy(false); }
    }
  }
  ["files", "photos", "folder"].forEach(kind => {
    const input = el("device-" + kind);
    el("choose-" + kind).addEventListener("click", () => input.click());
    input.addEventListener("change", () => { selectFiles(input.files || []); input.value = ""; });
  });
  el("clear-selection").addEventListener("click", () => { selected.clear(); renderSelection(); });
  el("device-scan-btn").addEventListener("click", scanSelected);
  el("cancel-scan").addEventListener("click", () => controller?.abort());
  el("export-report").addEventListener("click", () => download(new Blob([JSON.stringify({
    created_at: new Date().toISOString(),
    note: "Recommendations only. No original device files have been deleted or renamed.",
    duplicate_groups: groups
  }, null, 2)], { type: "application/json" }), "smart-cleaner-review.json"));
  window.Cleaner = { renderGroups, renderRenames, reset, hashFile, selectFiles, scanSelected, scanCloud, isBusy: () => busy };
  setBusy(false);
})();
