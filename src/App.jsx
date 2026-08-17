import React, { useState, useRef, useEffect, useCallback } from "react";

// ─── Version & Changelog ──────────────────────────────────────────────────────
const APP_VERSION = "1.18.0";
const CHANGELOG = [
  { version:"1.18.0", date:"2026-08-17", notes:[
    "Work Instruction station format — new station type for image-based guides (hanging guides, staging guides, paint guides)",
    "Each WI task has: Part No., Part Description, primary image, optional secondary image, setup/positioning instructions (relabelable), work instructions, custom key-value pairs and text blocks",
    "WI PDF layout options: Stacked Sections, Single Page, Two Column",
    "WI station cycle time feeds into Line Balance tab",
    "Station format toggle: Standard SOP (Tasks & Steps) vs Work Instruction per station",
  ]},
  { version:"1.17.1", date:"2026-08-04", notes:[
    "Torque checklist auto-displayed when torque spec is set: Verify torque setting, Torque fastener, Mark with paint pen",
    "Checklist renders in builder as visual reference and in PDF as printable checkboxes (☐)",
  ]},
  { version:"1.17.0", date:"2026-08-04", notes:[
    "Torque specification field on steps — toggle 🔩 Add torque spec to reveal value + unit selector (ft-lbs, in-lbs, Nm, kg-cm)",
    "Torque spec renders in PDF/preview with pink highlight block",
    "Torque value and unit included in CSV backup export (Torque Value, Torque Unit columns)",
  ]},
  { version:"1.16.0", date:"2026-07-13", notes:[
    "File badge moved to left of nav action buttons (before New)",
    "Persistence advisory: auto-save to browser localStorage is unreliable on some browsers/configurations — use 💾 Save to write to a file as the primary workflow",
  ]},
  { version:"1.15.0", date:"2026-07-13", notes:[
    "Fix autosave — lsLoad moved outside App() so it runs once at module load, not on every re-render",
    "Fix lines dropping after refresh — reversed ID lookup in applyMerge corrected",
    "Nav bar redesigned — New, Open, Save as primary buttons; Export Save/Import/CSV/PDFs in More ▾ dropdown",
    "Duplicate version badge and New Project button removed from nav",
    "activeFileHandle removed from autosave useEffect deps (it mutates internally, React can't track it)",
  ]},
  { version:"1.14.0", date:"2026-07-13", notes:[
    "Fix all 3 lines persisting on refresh — stale closure in LinesManager updLine/delLine/addLine was overwriting lines state with older snapshot",
    "Version tracker with changelog panel added to nav bar",
  ]},
  { version:"1.13.0", date:"2026-07-13", notes:[
    "Persist file links across sessions — activeFileName stored in localStorage",
    "Auto-reconnect all linked files (global + per-line) on browser reopen",
    "Fix lsSave race condition — removed read-merge-write pattern, useEffect is now single source of truth",
  ]},
  { version:"1.12.0", date:"2026-07-13", notes:[
    "CSV backup comprehensively updated — adds Station Metadata, Revision Log, Task Notes, Tools & Equipment, Applicable Drawings sections",
    "CSV restore parser rewritten RFC 4180 compliant — correctly handles multiline quoted fields (fixes phantom stations from real CSV data)",
    "Restore from CSV tool added to nav bar — recovers full line from backup CSV when JSON is lost",
  ]},
  { version:"1.11.0", date:"2026-07-12", notes:[
    "Revision log — editable date field in edit modal, delete revision button with guard against deleting last entry",
    "Move task fixed — replaced floating dropdown with select element, deduplicated station list to current line only",
    "Line balance station selector fixed — string coercion on IDs, select separated from label element",
    "Line balance TAKT time input — inline with scope selector, MM:SS or seconds format",
    "AI Analysis button — opens claude.ai with pre-built structured prompt, copies to clipboard",
    "LVT Line Balance Analysis skill file created",
  ]},
  { version:"1.10.0", date:"2026-07-11", notes:[
    "Sidebar navigator — sticky positioning, tree-only expand (no workspace side effects), navigate arrow button jumps to item",
    "Lines/stations/tasks collapsed by default, Collapse All controls on Lines header and per-line",
    "Sticky header — nav bar stays fixed while scrolling",
  ]},
  { version:"1.9.0", date:"2026-07-10", notes:[
    "Add Line from File with conflict resolution — compares timestamps, offers Keep/Replace/Keep Both per conflicting line",
    "File conflict detection on Save — warns when file was updated by another user since you opened it",
    "Version check when opening a line — prompts to reload if linked file is newer",
    "File link disconnect buttons — separate ✕ for JSON and CSV in nav bar and line header badge",
    "Link Files modal after import — choose existing files or create new, links both JSON and CSV",
    "Reconnect Files modal on session start — walks through all previously linked files",
  ]},
  { version:"1.8.0", date:"2026-07-09", notes:[
    "Delete confirmation modal on all levels — line, station, task, step with cascade warnings",
    "New Project button — clears workspace with confirmation",
    "Cycle time input — plain seconds or MM:SS format, totals display as MM:SS min",
    "PDF filename — SopID_StationDesc format",
    "Remove from Line button removed (redundant with ✕ delete)",
    "Custom station identifier — editable per station, defaults from line identifier",
  ]},
  { version:"1.7.0", date:"2026-07-08", notes:[
    "Bold/Italic B/I toolbar in step description and key points",
    "Multiple images per step — add unlimited, remove individually",
    "Drawings table — two drawings per row to use full column width",
    "CSV Open File — prompts to link companion CSV immediately after opening JSON",
  ]},
  { version:"1.6.0", date:"2026-07-07", notes:[
    "SOP Builder fully rebuilt with Lines → Stations → Tasks → Steps hierarchy",
    "Per-line 💾 Save with file link badge, global workspace Save",
    "PDF/Preview with cover page, task pages, revision log, drawings table",
    "Line Balance tab with bar chart, TAKT reference line, Export CSV",
    "Import Wizard — selective import from saved files",
    "CSV backup/restore tool",
    "Revision log with Windchill reminder, editable entries",
  ]},
];


const ICONS = {
  none:     { label: "No Icon",         emoji: "" },
  warning:  { label: "⚠️ Warning",      emoji: "⚠️" },
  caution:  { label: "🔶 Caution",      emoji: "🔶" },
  note:     { label: "📝 Note",         emoji: "📝" },
  ppe:      { label: "🦺 PPE Required", emoji: "🦺" },
  electric: { label: "⚡ Electrical",   emoji: "⚡" },
  heavy:    { label: "🏋️ Heavy Lift",   emoji: "🏋️" },
  inspect:  { label: "🔍 Inspect",      emoji: "🔍" },
};

const TEAL       = "#00897b";
const TEAL_DARK  = "#00695c";
const TEAL_LIGHT = "#e0f2f1";
const SAVE_KEY   = "lvt_sop_builder_autosave";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const genSopId  = (no, ver, rev) => {
  const base = (no||"SOP").replace(/\s+/g,"-").toUpperCase();
  return `${base}${ver?`-V${ver}`:""}${rev?`.${rev.toUpperCase()}`:""}`;
};
const genTaskId = (sopId, n) => `${sopId}-${String(n).padStart(2,"0")}`;
const fmtTime = (totalMin) => {
  const n = parseFloat(totalMin)||0;
  if(!n) return "—";
  const totalSec = Math.round(n * 60);
  const mm = Math.floor(totalSec / 60);
  const ss = totalSec % 60;
  return mm > 0
    ? `${mm}:${String(ss).padStart(2,"0")} min`
    : `0:${String(ss).padStart(2,"0")} min`;
};
// Parse cycle time entry: "1:30" → 1.5 min, "90" → 1.5 min (assumes seconds)
const parseTime = (val) => {
  if(!val && val !== 0) return 0;
  const s = String(val).trim();
  if(s.includes(":")) {
    const [mm, ss] = s.split(":").map(p => parseFloat(p)||0);
    return mm + ss/60;
  }
  // plain number = seconds
  return (parseFloat(s)||0) / 60;
};
const toMinutes = (st) => parseTime(st.cycleTime);
const sumSteps = (steps) => steps.reduce((s,st) => s+toMinutes(st), 0);
const sumTasks  = (tasks) => tasks.reduce((s,t)  => s+sumSteps(t.steps||[]), 0);
const reindex   = (tasks, sopId) =>
  tasks.map((t,i) => ({ ...t, taskNo:i+1, taskId:genTaskId(sopId,i+1) }));

// Generate station number from line identifier + 1-based position
const autoStationNo = (identifier, position) =>
  identifier ? `${identifier.toUpperCase().trim()}-${String(position).padStart(2,"0")}` : "";

// Apply auto station numbers to all stations in a line and regenerate sopIds
const applyStationNos = (line, stations, onStationsChange) => {
  if(!line.stationIdentifier) return;
  line.stationIds.forEach((id, i) => {
    const s = stations.find(st=>st.id===id);
    if(!s) return;
    const newNo  = autoStationNo(line.stationIdentifier, i+1);
    const newId  = genSopId(newNo, s.asmVersion, s.sopRev);
    const tasks  = s.tasks.map(t=>({...t, taskId:genTaskId(newId,t.taskNo)}));
    onStationsChange(prev=>prev.map(st=>st.id===id ? {...st,stationNo:newNo,sopId:newId,tasks} : st));
  });
};

// ─── Factories ────────────────────────────────────────────────────────────────
const mkStation = () => ({
  id: Date.now()+Math.random(),
  stationNo:"", stationDesc:"", asmVersion:"", sopRev:"A", sopId:"", revisedBy:"",
  purpose:"",
  safety:"• Always wear appropriate Personal Protective Equipment (PPE), including safety glasses and gloves as required.\n• Observe all warnings, cautions, and notes throughout this document.",
  drawings:[{drawingNo:"",description:""}],
  tools:"",
  toolList:[],
  revisionLog:"A - Initial Release",
  revisionEntries:[{rev:"A", date:new Date().toLocaleDateString(), description:"Initial Release", by:""}],
  // Rev A is always pre-seeded so it appears in the log from day one
  generalNotes:"Tasks may be completed in any order, if steps are numbered they must be followed in order as specified.",
  stationImages:[], tasks:[],
  stationType:"standard", // "standard" | "wi"
  wiLayout:"stacked",     // "stacked" | "single" | "twocol"
  wiCycleTime:"",
});
const mkTask = (sopId, taskNo) => ({
  id:Date.now()+Math.random(), taskNo, taskId:genTaskId(sopId,taskNo),
  description:"", generalNotes:"", taskImages:[], steps:[], selectedTools:[], selectedDrawings:[],
});
const mkStep = () => ({
  id:Date.now()+Math.random(), useStepNumber:false, stepNumber:"",
  description:"", keyPoints:"", icons:[], cycleTime:"", images:[], selectedTools:[], selectedDrawings:[],
  torqueValue:"", torqueUnit:"ft-lbs",
});
const mkWiTask = (sopId, taskNo) => ({
  id:Date.now()+Math.random(), taskNo, taskId:genTaskId(sopId,taskNo),
  description:"",
  partNo:"",
  partDesc:"",
  cycleTime:"",  // secs or MM:SS
  wiImages:[],
  workInstructions:"",
  customFields:[],
});

const mkWiImage = (src) => ({
  id: Date.now()+Math.random(),
  src,
  caption:"",
  size:"full",
  align:"center",
});

const mkWiCustomField = (cols=1) => ({
  id: Date.now()+Math.random(),
  cols,           // 1 = full width, 2 = two side-by-side boxes
  // col 1
  label:"",
  value:"",
  // col 2 (only used when cols===2)
  label2:"",
  value2:"",
});

const mkLine = () => ({

  id: Date.now()+Math.random(),
  name: "",
  description: "",
  stationIdentifier: "",
  savedAt: new Date().toISOString(),
  linkedFileName:  null,   // persisted filename for reconnect on reload
  linkedCsvName:   null,   // persisted CSV filename for reconnect on reload
  stationIds: [],
});

// ─── Persistence ──────────────────────────────────────────────────────────────
const lsSave = (s, l=[], meta={}) => {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      version:2, savedAt:new Date().toISOString(), stations:s, lines:l,
      activeFileName: meta.activeFileName ?? null,
      activeFileCsvName: meta.activeFileCsvName ?? null,
    }));
  } catch(e){ console.error("[lsSave] FAILED:", e); }
};
const migrateStation = (s) => {
  // Seed revisionEntries if missing (stations saved before this feature)
  if (!s.revisionEntries || s.revisionEntries.length === 0) {
    const rev = s.sopRev || "A";
    const rawLog = s.revisionLog || "";
    const lines = rawLog.split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length > 0) {
      s = { ...s, revisionEntries: lines.map(line => {
        const match = line.match(/^([A-Z]+)\s*[-–]\s*(.+)/);
        return match
          ? { rev: match[1], date: "", description: match[2].trim(), by: "" }
          : { rev, date: "", description: line, by: "" };
      })};
    } else {
      s = { ...s, revisionEntries: [{ rev, date: new Date().toLocaleDateString(), description: rev === "A" ? "Initial Release" : "See revision history", by: "" }] };
    }
  }
  // Seed toolList if missing
  if (!s.toolList) s = { ...s, toolList: [] };
  // Seed stationType if missing (stations saved before WI feature)
  if (!s.stationType) s = { ...s, stationType: "standard" };
  // Migrate step.image (single) → step.images (array)
  // Guard against WI tasks which have no steps array
  s = { ...s, tasks: s.tasks.map(t => ({
    ...t,
    steps: Array.isArray(t.steps) ? t.steps.map(st => {
      if (st.images) return st; // already migrated
      return { ...st, images: st.image ? [st.image] : [], image: undefined };
    }) : [],
  }))};
  return s;
};
const lsLoad = () => {
  try {
    const r=localStorage.getItem(SAVE_KEY);
    if(!r) return null;
    const d=JSON.parse(r);
    if(!d || typeof d !== 'object') return null;
    return {
      stations: Array.isArray(d.stations) ? d.stations.map(migrateStation) : [],
      lines:    Array.isArray(d.lines)    ? d.lines                         : [],
      activeFileName:     d.activeFileName     || null,
      activeFileCsvName:  d.activeFileCsvName  || null,
    };
  } catch{ return null; }
};
const saveFile = async (stations, lines=[], station=null, lineName=null, explicitName=null) => {
  const date = new Date().toISOString().slice(0,10);
  const name = explicitName
    ? explicitName
    : station
      ? [station.sopId, station.stationDesc].filter(Boolean).join("_").replace(/[^a-zA-Z0-9_\-]/g,"_") || "SOP_save"
      : lineName
        ? `${lineName.replace(/[^a-zA-Z0-9_\- ]/g,"").trim().replace(/\s+/g,"_")}_${date}`
        : `SOP_save_${date}`;

  const json = JSON.stringify({version:2,savedAt:new Date().toISOString(),stations,lines:stampLines(lines)},null,2);

  // Use File System Access API (Chrome/Edge) for Save As dialog
  if(window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: `${name}.json`,
        types: [{ description:"SOP Builder Save File", accept:{"application/json":[".json"]} }],
      });
      const writable = await handle.createWritable();
      await writable.write(json);
      await writable.close();
      return;
    } catch(e) {
      // User cancelled the picker — don't fall through to download
      if(e.name === "AbortError") return;
      // Any other error (permissions etc.) — fall through to legacy download
    }
  }

  // Fallback: standard download (goes to default Downloads folder)
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([json],{type:"application/json"}));
  a.download = `${name}.json`;
  a.click();
};
// Write current project data back to an already-open file handle (no dialog)
const stampLines = (lines) => {
  const now = new Date().toISOString();
  return lines.map(l => ({...l, savedAt: now}));
};

// Read savedAt from the current file on disk without writing
const readFileSavedAt = async (handle) => {
  try {
    const file = await handle.getFile();
    const text = await file.text();
    const data = JSON.parse(text);
    return { savedAt: data.savedAt || null, fileModified: file.lastModified };
  } catch { return null; }
};

const writeToHandle = async (handle, stations, lines) => {
  try {
    const json = JSON.stringify({version:2,savedAt:new Date().toISOString(),stations,lines:stampLines(lines)},null,2);
    const writable = await handle.createWritable();
    await writable.write(json);
    await writable.close();
    return true;
  } catch(e) {
    if(e.name==="NotAllowedError") {
      try {
        await handle.requestPermission({mode:"readwrite"});
        const writable = await handle.createWritable();
        const json = JSON.stringify({version:2,savedAt:new Date().toISOString(),stations,lines:stampLines(lines)},null,2);
        await writable.write(json);
        await writable.close();
        return true;
      } catch { return false; }
    }
    return false;
  }
};

// smartSave — unified save function used by nav and line buttons.
// If a handle exists → write back silently. Otherwise → Save As dialog.
// Always writes a .csv backup alongside the .json.
const smartSave = async (stations, lines, defaultName, handle, onHandleChange, onFlash) => {
  const baseName = defaultName.replace(/\.json$/i,"");

  if(handle) {
    const ok = await writeToHandle(handle, stations, lines);
    if(ok) {
      const csv = buildCSV(stations);
      const baseName = (handle.name||defaultName).replace(/\.json$/i,"");
      try {
        if(handle._csvHandle) {
          // Silently write to existing CSV handle
          const w = await handle._csvHandle.createWritable();
          await w.write(csv); await w.close();
          onFlash(`✓ Saved → ${handle.name||baseName}.json + .csv`);
        } else {
          // No CSV handle yet — prompt user to pick or create one
          if(window.showSaveFilePicker) {
            try {
              const csvHandle = await window.showSaveFilePicker({
                suggestedName: `${baseName}.csv`,
                types:[{description:"CSV Backup",accept:{"text/csv":[".csv"]}}],
              });
              const cw = await csvHandle.createWritable();
              await cw.write(csv); await cw.close();
              handle._csvHandle = csvHandle;
              onFlash(`✓ Saved → ${handle.name||baseName}.json + ${csvHandle.name}`);
            } catch(e){
              if(e.name==="AbortError") {
                // User cancelled CSV picker — save JSON only this time
                onFlash(`✓ Saved → ${handle.name||baseName}.json (no CSV)`);
              }
            }
          } else {
            // Fallback download
            const a=document.createElement("a");
            a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8;"}));
            a.download=`${baseName}.csv`; a.click();
            onFlash(`✓ Saved → ${handle.name||baseName}.json + .csv downloaded`);
          }
        }
      } catch(e){ console.warn("CSV backup write failed",e); onFlash(`✓ Saved → ${handle.name||baseName}.json`); }
      return;
    }
    // Handle invalid — clear and fall through to picker
    onHandleChange(null, "");
  }

  // No handle — open Save As dialog for JSON
  if(window.showSaveFilePicker) {
    try {
      const newHandle = await window.showSaveFilePicker({
        suggestedName: `${baseName}.json`,
        types:[{description:"SOP Builder Save File",accept:{"application/json":[".json"]}}],
      });
      const json = JSON.stringify({version:2,savedAt:new Date().toISOString(),stations,lines:stampLines(lines)},null,2);
      const writable = await newHandle.createWritable();
      await writable.write(json); await writable.close();

      // Now prompt for CSV in the same session — suggest same name with .csv
      let csvHandle = null;
      try {
        csvHandle = await window.showSaveFilePicker({
          suggestedName: `${baseName}.csv`,
          types:[{description:"CSV Backup",accept:{"text/csv":[".csv"]}}],
        });
        const csv = buildCSV(stations);
        const cw = await csvHandle.createWritable();
        await cw.write(csv); await cw.close();
        // Attach csv handle to json handle for future silent writes
        newHandle._csvHandle = csvHandle;
      } catch(e){ if(e.name!=="AbortError") console.warn("CSV save skipped",e); }

      onHandleChange(newHandle, newHandle.name);
      onFlash(`✓ Saved → ${newHandle.name}${csvHandle?" + .csv":""}`);
      return;
    } catch(e) { if(e.name==="AbortError") return; }
  }

  // Fallback: plain downloads for both
  const json = JSON.stringify({version:2,savedAt:new Date().toISOString(),stations,lines:stampLines(lines)},null,2);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([json],{type:"application/json"}));
  a.download = `${baseName}.json`; a.click();
  setTimeout(()=>{
    const csv = buildCSV(stations);
    const b = document.createElement("a");
    b.href = URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8;"}));
    b.download = `${baseName}.csv`; b.click();
  }, 500);
  onFlash(`✓ Downloaded: ${baseName}.json + .csv`);
};

const loadFile = (file,cb) => {
  const r=new FileReader();
  r.onload=e=>{ try{ const d=JSON.parse(e.target.result); if(d.stations) cb({stations:d.stations.map(migrateStation),lines:d.lines||[]}); else alert("Invalid save file."); }catch{ alert("Could not read file."); } };
  r.readAsText(file);
};

// ─── CSV Export ───────────────────────────────────────────────────────────────
// Build CSV string from stations (no download — pure data)
const buildCSV = (stations) => {
  const esc = (v) => `"${String(v||"").replace(/"/g,'""')}"`;
  const row = (...cols) => cols.map(c=>esc(c)).join(",");

  const sections = [];

  // ── Section 1: Station Metadata ──────────────────────────────────────────
  sections.push("## STATION METADATA");
  sections.push(row("SOP ID","Station No","Station Desc","ASM Version","SOP Revision",
                     "Revised By","Purpose","Safety Summary","General Notes","Tools & Equipment","Applicable Drawings"));
  stations.forEach(s => {
    const tools = (s.toolList||[]).map(t=>t.partNo?`${t.name} (${t.partNo})`:t.name).join("; ");
    const drawings = (s.drawings||[]).filter(d=>d.drawingNo).map(d=>d.description?`${d.drawingNo} — ${d.description}`:d.drawingNo).join("; ");
    sections.push(row(s.sopId, s.stationNo, s.stationDesc||"", s.asmVersion||"", s.sopRev||"A",
                      s.revisedBy||"", s.purpose||"", s.safety||"", s.generalNotes||"", tools, drawings));
  });

  // ── Section 2: Revision Log ───────────────────────────────────────────────
  sections.push("");
  sections.push("## REVISION LOG");
  sections.push(row("SOP ID","Station No","Rev","Date","Description","Revised By"));
  stations.forEach(s => {
    (s.revisionEntries||[]).forEach(e => {
      sections.push(row(s.sopId, s.stationNo, e.rev||"", e.date||"", e.description||"", e.by||""));
    });
  });

  // ── Section 3: Tasks & Steps ─────────────────────────────────────────────
  sections.push("");
  sections.push("## TASKS AND STEPS");
  sections.push(row("SOP ID","Station No","Station Desc","Task No","Task ID","Task Description",
                     "Task Notes","Step No","Step Description","Key Points","Safety Icons",
                     "Tools (Step)","Drawings (Step)","Cycle Time (min)","Torque Value","Torque Unit"));
  stations.forEach(s => {
    if(!s.tasks.length) {
      // Station exists but no tasks — still write a row so the station is captured
      sections.push(row(s.sopId, s.stationNo, s.stationDesc||"", "","","","","","","","","","",""));
      return;
    }
    s.tasks.forEach(t => {
      if(!t.steps.length) {
        sections.push(row(s.sopId, s.stationNo, s.stationDesc||"", t.taskNo, t.taskId,
                          t.description, t.generalNotes||"", "","","","","","",""));
        return;
      }
      t.steps.forEach((st,si) => {
        const icons = (st.icons||[st.icon]).filter(i=>i&&i!=="none").map(i=>ICONS[i]?.label||i).join("; ");
        const stepTools = (st.selectedTools||[]).join("; ");
        const stepDrawings = (st.selectedDrawings||[]).join("; ");
        sections.push(row(s.sopId, s.stationNo, s.stationDesc||"",
          t.taskNo, t.taskId, t.description, t.generalNotes||"",
          st.stepNumber||si+1, st.description||"", st.keyPoints||"",
          icons, stepTools, stepDrawings, toMinutes(st).toFixed(3),
          st.torqueValue||"", st.torqueUnit||""));
      });
    });
  });

  return sections.join("\r\n");
};

// exportCSV — manual download from Line Balance tab
const exportCSV = (stations) => {
  const csv = buildCSV(stations);
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8;"}));
  a.download="sop_data.csv"; a.click();
};

// Write CSV alongside a JSON save — same base name, .csv extension
const writeCSVAlongside = async (jsonHandle, stations, baseName) => {
  try {
    const csv = buildCSV(stations);
    // Try File System Access: get parent directory, create/overwrite .csv file there
    if(jsonHandle && jsonHandle.kind === "file") {
      try {
        // getParentDirectory is not universally available yet — use showSaveFilePicker
        // as a one-time prompt the first time, then the handle is stored.
        // Simpler reliable approach: write via a separate showSaveFilePicker only on
        // the very first save, store the csv handle alongside the json handle.
        // For now: attempt a direct sibling write via the OPFS workaround,
        // fall back gracefully to a plain download if not supported.
        const csvHandle = await window.showSaveFilePicker({
          suggestedName: `${baseName}.csv`,
          types:[{description:"CSV Backup",accept:{"text/csv":[".csv"]}}],
          // startIn: jsonHandle  <-- not supported yet in all browsers
        }).catch(()=>null);
        if(csvHandle) {
          const w = await csvHandle.createWritable();
          await w.write(csv); await w.close();
          return;
        }
      } catch{}
    }
    // Fallback: silent background download
    const a=document.createElement("a");
    a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8;"}));
    a.download=`${baseName}.csv`; a.click();
  } catch(e){ console.warn("CSV backup failed",e); }
};

// ─── Print HTML ────────────────────────────────────────────────────────────────────────────────────────────────────────────
// screen=true  → white page sheets on grey background (preview iframe)
// screen=false → print/PDF — footer lives in @page margin boxes so it appears on every physical page

const buildPrintHTML = (station, screen=false) => {
  const safe = (s) => String(s||"")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\n/g,"<br/>");
  const rich = (s) => safe(s)
    .replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>")
    .replace(/_(.+?)_/g,"<em>$1</em>");
  const today = new Date().toLocaleDateString();

  const hdr = (extra="") => `
    <table class="ht" cellspacing="0">
      <tr>
        <td rowspan="3" class="logo">LVT</td>
        <td colspan="6" class="title">${safe(station.lineName||'SOP')} — Standard Operating Procedure</td>
      </tr>
      <tr>
        <td class="lbl">ASM Version</td><td>${safe(station.asmVersion)||"—"}</td>
        <td class="lbl">Station No:</td><td>${safe(station.stationNo)}</td>
        <td class="lbl">SOP REV.</td><td>${safe(station.sopRev)}</td>
      </tr>
      <tr>
        <td colspan="2" class="lbl">SOP ID:</td><td colspan="2">${safe(station.sopId)}</td>
        <td class="lbl">Station Desc:</td><td>${safe(station.stationDesc)}</td>
      </tr>
      ${extra}
    </table>`;

  // Screen mode gets an inline footer per block; print uses @page margin boxes
  const screenFtr = (pageNum) => screen ? `
    <div class="footer">
      <span class="f-left">Live View Technologies &nbsp;|&nbsp; Revised By: ${safe(station.revisedBy)}</span>
      <span class="f-center">Page ${pageNum}</span>
      <span class="f-right">SOP ID: ${safe(station.sopId)} &nbsp;|&nbsp; Effective Date: ${today}</span>
    </div>` : "";

  const validDrawings = station.drawings.filter(d=>d.drawingNo||d.description);
  const drawRows = (() => {
    if(validDrawings.length === 0) return `<tr><td colspan="4">&nbsp;</td></tr>`;
    const rows = [];
    for(let i=0; i<validDrawings.length; i+=2){
      const left  = validDrawings[i];
      const right = validDrawings[i+1];
      rows.push(`<tr>
        <td>${safe(left.drawingNo)}</td><td>${safe(left.description)}</td>
        <td>${right?safe(right.drawingNo):""}</td><td>${right?safe(right.description):""}</td>
      </tr>`);
    }
    return rows.join("");
  })();
  const stImgs = (station.stationImages||[]).map(src=>`<img src="${src}" class="thumb"/>`).join("");

  const cover = `
    <div class="pg cover-pg">
      ${hdr()}
      <div class="pg-body">
        <table class="bt" cellspacing="0">
          <tr><td colspan="4" class="sh">Purpose</td></tr>
          <tr><td colspan="4" class="content">${safe(station.purpose)}&nbsp;</td></tr>
          <tr><td colspan="4" class="sh">Safety Summary</td></tr>
          <tr><td colspan="4" class="content">${safe(station.safety)}&nbsp;</td></tr>
          <tr><td colspan="4" class="sh">Applicable Drawings</td></tr>
          <tr>
            <td class="lbl" style="width:18%">Drawing #</td><td class="lbl" style="width:32%">Description</td>
            <td class="lbl" style="width:18%">Drawing #</td><td class="lbl" style="width:32%">Description</td>
          </tr>
          ${drawRows}
          <tr>
            <td colspan="2" class="content vtop"><strong>Tool and Equipment List</strong><br/>${safe(station.tools)}&nbsp;</td>
            <td colspan="2" class="content vtop"><strong>Revision Log</strong><br/>${safe(station.revisionLog)}&nbsp;</td>
          </tr>
          <tr><td colspan="4" class="sh">General Notes</td></tr>
          <tr><td colspan="4" class="content">${safe(station.generalNotes)}${stImgs?"<br/>"+stImgs:""}&nbsp;</td></tr>
        </table>

        <!-- Table of Contents -->
        ${station.tasks.length > 0 ? `
        <table class="bt toc-table" cellspacing="0" style="margin-top:8px;">
          <tr><td colspan="3" class="sh">Table of Contents</td></tr>
          <tr>
            <td class="lbl" style="width:60px;">Task</td>
            <td class="lbl">Description</td>
            <td class="lbl" style="width:80px;text-align:right;">Page</td>
          </tr>
          ${station.tasks.map((t,i)=>`
          <tr style="background:${i%2===0?"white":"#fafafa"};">
            <td style="padding:4px 6px;font-weight:700;color:#00695c;">${String(t.taskNo).padStart(2,"0")}</td>
            <td style="padding:4px 6px;">${safe(t.description)}</td>
            <td style="padding:4px 6px;text-align:right;color:#888;">${i+2}</td>
          </tr>`).join("")}
        </table>` : ""}

        <!-- Icon Legend -->
        ${Object.entries(ICONS).filter(([k])=>k!=="none").length > 0 ? `
        <table class="bt" cellspacing="0" style="margin-top:8px;">
          <tr><td colspan="4" class="sh">Icon Legend</td></tr>
          <tr>
            ${Object.entries(ICONS).filter(([k])=>k!=="none").map(([k,v])=>
              `<td style="padding:4px 8px;font-size:8.5pt;"><span style="font-size:12pt;">${v.emoji}</span>&nbsp;${v.label.replace(/^\S+\s/,"")}</td>`
            ).join("")}
          </tr>
        </table>` : ""}
      </div>
      ${screenFtr(1)}
    </div>`;

  const taskPages = station.tasks.map((task, ti) => {
    const tImgs = (task.taskImages||[]).map(src=>`<img src="${src}" class="thumb"/>`).join("");

    // ── Helpers to render tool/drawing tags for task or step ──────────────────
    const toolLabel = (name) => {
      const t = (station.toolList||[]).find(t=>t.name===name);
      return t ? (t.partNo ? `${t.name} <span class="ref-pn">(${safe(t.partNo)})</span>` : safe(t.name)) : safe(name);
    };
    const drawLabel = (no) => {
      const d = (station.drawings||[]).find(d=>d.drawingNo===no);
      return d ? `${safe(d.drawingNo)}${d.description?" — "+safe(d.description):""}` : safe(no);
    };
    const refTags = (tools, drawings) => {
      const parts = [];
      if(tools&&tools.length) parts.push(`<span class="ref-group"><span class="ref-hdr">🔧 Tools:</span> ${tools.map(toolLabel).join(" &nbsp;·&nbsp; ")}</span>`);
      if(drawings&&drawings.length) parts.push(`<span class="ref-group"><span class="ref-hdr">📐 Drawings:</span> ${drawings.map(drawLabel).join(" &nbsp;·&nbsp; ")}</span>`);
      return parts.length ? `<div class="ref-bar">${parts.join("&ensp;|&ensp;")}</div>` : "";
    };

    const taskRefs = refTags(task.selectedTools, task.selectedDrawings);

    const stepRows = task.steps.map((step,si) => {
      const ico = (step.icons&&step.icons.length?step.icons:step.icon&&step.icon!=="none"?[step.icon]:[]).map(k=>ICONS[k]?.emoji||"").filter(Boolean).join(" ")+(((step.icons&&step.icons.length)||(step.icon&&step.icon!=="none"))?" ":"");
      const num = step.useStepNumber ? `<strong>${step.stepNumber||si+1}</strong>` : "";
      const imgs = (step.images||[]).map(src=>`<div class="step-img-wrap"><img src="${src}" class="sthumb"/></div>`).join(""); const img = imgs;
      const kp  = step.keyPoints ? `<br/><em class="kp">${rich(step.keyPoints)}</em>` : "";
      const torq = step.torqueValue ? `<span class="torque">🔩 Torque: <strong>${safe(step.torqueValue.trim())} ${safe(step.torqueUnit||"ft-lbs")}</strong></span><span class="torque-list"><span class="torque-list-title">Torque Checklist:</span><span class="torque-item">☐ Verify torque setting on torque tool</span><span class="torque-item">☐ Torque fastener</span><span class="torque-item">☐ Mark torqued fastener with paint pen</span></span>` : "";
      const stepRefs = refTags(step.selectedTools, step.selectedDrawings);
      return `<tr class="step-row">
        <td class="step-num">${num}</td>
        <td class="step-desc">${ico}${rich(step.description)}${kp}${torq?`<br/>${torq}`:""}${stepRefs}${img}</td>
        <td class="step-time">${step.cycleTime?parseTime(step.cycleTime).toFixed(2):""}</td>
      </tr>`;
    }).join("");
    return `
      <div class="pg task-pg">
        ${hdr(`<tr>
          <td colspan="2" class="task-lbl">Task No.&nbsp;${task.taskNo}</td>
          <td colspan="2" class="task-lbl" style="font-family:monospace">${safe(task.taskId)}</td>
          <td colspan="2" class="task-desc"><strong>${safe(task.description)}</strong></td>
        </tr>`)}
        <div class="pg-body">
          <table class="bt" cellspacing="0">
            <tr><td colspan="3" class="sh">General Task Notes (For Reference Only)</td></tr>
            <tr><td colspan="3" class="content notes-cell">${safe(task.generalNotes)}${tImgs?"<br/>"+tImgs:""}&nbsp;</td></tr>
            <tr>
              <td colspan="2" class="sh">&nbsp;</td>
              <td class="sh" style="text-align:right;white-space:nowrap">Est. Cycle Time:&nbsp;${fmtTime(sumSteps(task.steps))}</td>
            </tr>
            ${taskRefs ? `<tr><td colspan="3" class="ref-row">${taskRefs}</td></tr>` : ""}
          </table>
          <table class="bt steps-table" cellspacing="0">
            <thead>
              <tr class="cont-row">
                <td colspan="3" class="cont-banner">
                  &#8627; Task ${task.taskNo} continued &nbsp;|&nbsp; ${safe(task.taskId)} &nbsp;|&nbsp; <strong>${safe(task.description)}</strong>
                </td>
              </tr>
              <tr>
                <td class="step-num col-hdr">Step</td>
                <td class="col-hdr">Description</td>
                <td class="step-time col-hdr">Time</td>
              </tr>
            </thead>
            <tbody>
              ${stepRows||`<tr><td colspan="3" class="content">&nbsp;</td></tr>`}
            </tbody>
          </table>
        </div>
        ${screenFtr(ti+2)}
      </div>`;
  }).join("");

  // @page margin content strings — single-quoted, no template literals
  const fLeft  = "Live View Technologies  |  Revised By: " + (station.revisedBy||"");
  const fRight = "SOP ID: " + (station.sopId||"") + "  |  Effective Date: " + today;

  const screenStyles = screen ? `
    body { background:#4b5563; padding:32px 0; margin:0; }
    .pg  { width:8.5in; min-height:11in; margin:0 auto 32px; padding:0.5in;
           background:white; box-shadow:0 4px 24px rgba(0,0,0,0.4);
           display:flex; flex-direction:column; }
    .pg-body { flex:1; }
    .cont-row { display:none; }
    .footer { display:grid; grid-template-columns:1fr auto 1fr; align-items:center;
              margin-top:auto; padding-top:6px; font-size:8pt; color:#555; border-top:2px solid #00897b; }
    .f-left   { text-align:left; }
    .f-center { text-align:center; font-weight:700; color:#00695c; font-size:9pt; }
    .f-right  { text-align:right; }
  ` : `
    @page {
      size: 8.5in 11in portrait;
      margin-top:   0.5in;
      margin-left:  0.5in;
      margin-right: 0.5in;
      margin-bottom:0.6in;
      @bottom-left   { content:"${fLeft}";  font-family:Arial,sans-serif; font-size:7.5pt; color:#555; border-top:1.5pt solid #00897b; padding-top:3pt; vertical-align:top; }
      @bottom-center { content:"Page " counter(page) " of " counter(pages); font-family:Arial,sans-serif; font-size:9pt; font-weight:bold; color:#00695c; border-top:1.5pt solid #00897b; padding-top:3pt; vertical-align:top; }
      @bottom-right  { content:"${fRight}"; font-family:Arial,sans-serif; font-size:7.5pt; color:#555; border-top:1.5pt solid #00897b; padding-top:3pt; vertical-align:top; text-align:right; }
    }
    body { margin:0; padding:0; background:white; }
    .pg       { page-break-before:always; }
    .cover-pg { page-break-before:auto; }
    .steps-table { width:100%; border-collapse:collapse; }
    thead { display:table-header-group; }
    .cont-banner { background:#e0f2f1 !important; color:#00695c; font-size:8pt;
                   padding:3px 6px; border:1px solid #80cbc4; font-style:italic; }
    .step-row   { page-break-inside:avoid; }
    .notes-cell { page-break-inside:avoid; }
  `;


  // ── Work Instruction print layout ──────────────────────────────────────────
  if(station.stationType === "wi") {
    const alignCSS = {left:"left", center:"center", right:"right"};

    // Build a caption line — separate function avoids nested template literals
    const figCaption = (n, caption, align) => {
      const a = align || "center";
      return '<div style="font-size:8pt;color:#555;margin-top:3px;font-style:italic;text-align:' + a + ';">'
        + '<strong>Fig. ' + n + '</strong>'
        + (caption ? ' \u2014 ' + safe(caption) : '')
        + '</div>';
    };

    const imgTag = (src, maxW, maxH) =>
      '<img src="' + src + '" style="max-width:' + maxW + ';height:auto;max-height:' + maxH + ';display:inline-block;border:1px solid #ccc;"/>';

    const renderWiImageBlock = (images, figOffset=0) => {
      const rows = [];
      let i = 0;
      while(i < images.length) {
        const img = images[i];
        const size = img.size || "full";
        const figN = figOffset + i + 1;
        const align = alignCSS[img.align||"center"];

        if(size === "full") {
          rows.push(
            '<div style="text-align:' + align + ';margin:8px 0;page-break-inside:avoid;">'
            + imgTag(img.src, "100%", "4.5in")
            + figCaption(figN, img.caption, align)
            + '</div>'
          );
          i++;

        } else if(size === "half") {
          const pair = images.slice(i, i+2).filter(x=>(x.size||"full")==="half");
          if(pair.length === 2) {
            const cells = pair.map((im, pi) =>
              '<td style="width:50%;padding:0 4px;vertical-align:top;text-align:center;">'
              + imgTag(im.src, "100%", "3in")
              + figCaption(figOffset + i + pi + 1, im.caption, "center")
              + '</td>'
            ).join("");
            rows.push(
              '<table style="width:100%;border-collapse:collapse;margin:8px 0;page-break-inside:avoid;"><tr>'
              + cells + '</tr></table>'
            );
            i += 2;
          } else {
            // Lone half — render at 50% centered
            rows.push(
              '<div style="text-align:center;margin:8px 0;page-break-inside:avoid;">'
              + imgTag(img.src, "50%", "3in")
              + figCaption(figN, img.caption, "center")
              + '</div>'
            );
            i++;
          }

        } else { // third
          const trio = images.slice(i, i+3).filter(x=>(x.size||"full")==="third");
          const cols = Math.min(trio.length, 3);
          const pct = Math.floor(100/cols) + "%";
          const cells = trio.map((im, pi) =>
            '<td style="width:' + pct + ';padding:0 4px;vertical-align:top;text-align:center;">'
            + imgTag(im.src, "100%", "2.5in")
            + figCaption(figOffset + i + pi + 1, im.caption, "center")
            + '</td>'
          ).join("");
          rows.push(
            '<table style="width:100%;border-collapse:collapse;margin:8px 0;page-break-inside:avoid;"><tr>'
            + cells + '</tr></table>'
          );
          i += cols;
        }
      }
      return rows.join("\n");
    };

    const renderCustomField = (cf) => {
      if(cf.cols === 2) {
        return `
          <table class="bt" style="margin-bottom:8px;">
            <tr>
              <td style="width:50%;border-right:2px solid #aaa;vertical-align:top;padding:0;">
                <div class="lbl" style="padding:4px 8px;">${safe(cf.label||"")}</div>
                <div style="padding:7px 9px;font-size:9.5pt;line-height:1.6;">${rich(cf.value||"")}</div>
              </td>
              <td style="width:50%;vertical-align:top;padding:0;">
                <div class="lbl" style="padding:4px 8px;">${safe(cf.label2||"")}</div>
                <div style="padding:7px 9px;font-size:9.5pt;line-height:1.6;">${rich(cf.value2||"")}</div>
              </td>
            </tr>
          </table>`;
      }
      return `
        <table class="bt" style="margin-bottom:8px;">
          <tr><td class="lbl">${safe(cf.label||"")}</td></tr>
          <tr><td style="padding:7px 9px;font-size:9.5pt;line-height:1.6;">${rich(cf.value||"")}</td></tr>
        </table>`;
    };

    const wiPages = station.tasks.length === 0
      ? `<div class="pg"><div style="padding:40px;text-align:center;color:#aaa;font-size:12pt;">No tasks added yet.</div></div>`
      : station.tasks.map((task, ti) => {
          const images = (task.wiImages && task.wiImages.length > 0)
            ? task.wiImages
            : [task.primaryImage&&{id:"p",src:task.primaryImage,caption:"",size:"full",align:"center"},
               task.secondaryImage&&{id:"s",src:task.secondaryImage,caption:"",size:"half",align:"center"}]
              .filter(Boolean);

          const partRow = (task.partNo||task.partDesc) ? `
            <table class="bt" style="margin-bottom:8px;">
              ${task.partNo?`<tr><td class="lbl" style="width:130px">PART NO</td><td style="padding:4px 8px;">${safe(task.partNo)}</td></tr>`:""}
              ${task.partDesc?`<tr><td class="lbl">PART DESCRIPTION</td><td style="padding:4px 8px;">${safe(task.partDesc)}</td></tr>`:""}
            </table>` : "";

          const wiBlock = task.workInstructions ? `
            <table class="bt" style="margin-bottom:8px;">
              <tr><td class="lbl">WORK INSTRUCTIONS</td></tr>
              <tr><td style="padding:7px 9px;font-size:9.5pt;line-height:1.6;">${rich(task.workInstructions)}</td></tr>
            </table>` : "";

          // Legacy setup notes support
          const setupBlock = task.setupNotes ? `
            <table class="bt" style="margin-bottom:8px;">
              <tr><td class="lbl">${safe(task.setupLabel||"SETUP INSTRUCTIONS")}</td></tr>
              <tr><td style="padding:7px 9px;font-size:9.5pt;line-height:1.6;">${rich(task.setupNotes)}</td></tr>
            </table>` : "";

          const customBlocks = (task.customFields||[])
            .filter(cf=>cf.label||cf.value||cf.label2||cf.value2)
            .map(cf=>renderCustomField(cf)).join("");

          const taskCT = task.cycleTime ? parseTime(task.cycleTime) : 0;
          const taskHdr = '<div style="background:#00897b;color:white;padding:6px 10px;font-weight:700;font-size:12pt;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;">'
            + '<span>' + safe(task.description||"Work Instruction") + '</span>'
            + '<span style="font-size:9pt;opacity:0.85;font-weight:400;display:flex;gap:12px;">'
            + (task.partNo ? '<span>P/N: ' + safe(task.partNo) + '</span>' : '')
            + (taskCT > 0 ? '<span>⏱ ' + fmtTime(taskCT) + '</span>' : '')
            + '</span>'
            + '</div>';

          return `
            <div class="pg">
              ${hdr()}
              ${taskHdr}
              ${partRow}
              <div class="pg-body">
                ${renderWiImageBlock(images)}
                ${setupBlock}${wiBlock}${customBlocks}
              </div>
              ${screenFtr(ti+2)}
            </div>`;
        }).join("\n");

    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>${pdfName(station)}</title>
<style>
  * { -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important;
      box-sizing:border-box; font-family:Arial,sans-serif; }
  body { font-size:10pt; }
  ${screenStyles}
  .ht  {width:100%;border-collapse:collapse;}
  .ht td{border:1px solid #888;padding:3px 5px;font-size:9pt;}
  .logo{width:62px;background:#00897b !important;color:white !important;font-size:17pt;font-weight:900;text-align:center;vertical-align:middle;}
  .title{text-align:center;font-size:15pt;font-weight:bold;background:#00897b !important;color:white !important;padding:6px;}
  .lbl {font-weight:bold;background:#e0e0e0 !important;padding:4px 8px;font-size:9pt;}
  .bt  {width:100%;border-collapse:collapse;}
  .bt td{border:1px solid #aaa;font-size:9pt;}
  .footer{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;padding-top:6px;font-size:8pt;color:#555;border-top:2px solid #00897b;}
  .f-left{text-align:left;} .f-center{text-align:center;font-weight:700;color:#00695c;font-size:9pt;} .f-right{text-align:right;}
</style></head>
<body>
  ${cover}
  ${wiPages}
  ${!screen?'<scr'+'ipt>window.onload=()=>{setTimeout(()=>window.print(),400);}</scr'+'ipt>':""}
</body></html>`;
  }


  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>${pdfName(station)}</title>
<style>
  * { -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important;
      box-sizing:border-box; font-family:Arial,sans-serif; }
  body { font-size:10pt; }
  ${screenStyles}
  .ht{width:100%;border-collapse:collapse;} .ht td{border:1px solid #888;padding:3px 5px;font-size:9pt;}
  .logo{width:62px;background:#00897b !important;color:white !important;font-size:17pt;font-weight:900;text-align:center;vertical-align:middle;}
  .title{text-align:center;font-size:15pt;font-weight:bold;background:#00897b !important;color:white !important;padding:6px;}
  .lbl{font-weight:bold;background:#e0e0e0 !important;}
  .task-lbl{font-weight:bold;background:#b2dfdb !important;color:#00695c;}
  .task-desc{background:#e0f2f1 !important;font-size:9pt;}
  .bt{width:100%;border-collapse:collapse;margin-top:4px;} .bt td{border:1px solid #888;padding:4px 6px;font-size:9pt;}
  .steps-table{margin-top:0 !important;}
  .sh{background:#e0e0e0 !important;font-weight:bold;text-align:center;padding:4px 6px;}
  .col-hdr{background:#00897b !important;color:white !important;font-weight:bold;padding:5px 6px;}
  .content{padding:5px 7px;min-height:20px;} .vtop{vertical-align:top;}
  .step-num{width:32px;text-align:center;vertical-align:top;padding:4px 3px;font-size:9pt;}
  .step-desc{vertical-align:top;padding:4px 6px;font-size:9pt;}
  .step-time{width:58px;text-align:right;vertical-align:top;padding:4px 5px;font-size:9pt;white-space:nowrap;}
  .kp{color:#00695c;font-size:8pt;font-style:italic;}
  .torque{display:block;margin-top:3px;font-size:9pt;font-weight:700;color:#880e4f;background:#fce4ec;border:1px solid #f48fb1;border-radius:3px;padding:2px 6px;}
  .torque-list{display:block;margin-top:2px;padding:3px 8px;background:#fce4ec;border:1px solid #f48fb1;border-radius:3px;}
  .torque-list-title{display:block;font-size:8pt;font-weight:700;color:#ad1457;margin-bottom:2px;text-transform:uppercase;letter-spacing:0.3px;}
  .torque-item{display:block;font-size:9pt;color:#880e4f;padding:1px 0;}
  .thumb{max-width:220px;max-height:150px;margin:3px 3px 0 0;border:1px solid #bbb;display:inline-block;}
  .sthumb{max-width:100%;max-height:3.2in;display:block;margin-top:5px;border:1px solid #bbb;}
  .step-img-wrap{page-break-inside:avoid;}
</style></head>
<body>
  ${cover}
  ${taskPages}
  ${!screen ? '<scr'+'ipt>window.onload=()=>{setTimeout(()=>window.print(),400);}</scr'+'ipt>' : ""}
</body></html>`;
};


// Build PDF filename from sopId + stationDesc
const pdfName = (station) =>
  [station.sopId, station.stationDesc].filter(Boolean).join("_").replace(/[^a-zA-Z0-9_\-]/g,"_") || "SOP";

const exportPDF = (station) => {
  const win=window.open("","_blank");
  if(!win){ alert("Pop-up blocked — allow pop-ups for this site and try again."); return; }
  win.document.open(); win.document.write(buildPrintHTML(station, false)); win.document.close();
};

// ─── SOP Preview ──────────────────────────────────────────────────────────────
function SOPPreview({ station, onClose }) {
  // Build screen-mode HTML (pages as white sheets on grey, no auto-print)
  const html = buildPrintHTML(station, true);
  return (
    <div style={{position:"fixed",inset:0,background:"#374151",zIndex:1000,display:"flex",flexDirection:"column"}}>
      {/* toolbar */}
      <div style={{background:TEAL_DARK,color:"white",padding:"9px 18px",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0,boxShadow:"0 2px 8px rgba(0,0,0,0.4)"}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <span style={{fontWeight:700,fontSize:14}}>Preview — {station.sopId||station.stationNo||"Station"}</span>
          <span style={{fontSize:11,opacity:0.7,background:"rgba(255,255,255,0.1)",padding:"2px 8px",borderRadius:4}}>
            8.5 × 11 in · portrait
          </span>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>exportPDF(station)}
            style={{background:"rgba(255,255,255,0.2)",border:"1px solid rgba(255,255,255,0.4)",color:"white",borderRadius:5,padding:"5px 14px",cursor:"pointer",fontSize:12}}>
            📄 Print / Save PDF
          </button>
          <button onClick={onClose}
            style={{background:"rgba(200,0,0,0.3)",border:"1px solid rgba(255,80,80,0.5)",color:"white",borderRadius:5,padding:"5px 14px",cursor:"pointer",fontSize:12}}>
            ✕ Close
          </button>
        </div>
      </div>
      {/* scrollable page viewer */}
      <div style={{flex:1,overflow:"auto",background:"#4b5563"}}>
        <iframe
          srcDoc={html}
          style={{width:"100%",height:"100%",minHeight:"calc(100vh - 48px)",border:"none",display:"block"}}
          title="SOP Preview"
        />
      </div>
    </div>
  );
}

// ─── Image helpers ────────────────────────────────────────────────────────────
function ImgUpload({ onImage, label="📎 Add Image" }) {
  const ref=useRef();
  return (<>
    <button onClick={()=>ref.current.click()} style={{fontSize:12,padding:"4px 10px",background:"#e8f5e9",border:"1px solid #a5d6a7",borderRadius:4,cursor:"pointer"}}>{label}</button>
    <input ref={ref} type="file" accept="image/*" style={{display:"none"}} onChange={e=>{
      const f=e.target.files[0]; if(!f) return;
      const r=new FileReader(); r.onload=ev=>onImage(ev.target.result); r.readAsDataURL(f); e.target.value="";
    }}/>
  </>);
}
function ImgList({ images, onRemove }) {
  if(!images?.length) return null;
  return (<div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:4}}>
    {images.map((src,i)=>(
      <div key={i} style={{position:"relative"}}>
        <img src={src} alt="" style={{maxHeight:70,maxWidth:110,border:"1px solid #ccc",borderRadius:4,display:"block"}}/>
        <button onClick={()=>onRemove(i)} style={{position:"absolute",top:-6,right:-6,background:"#e53935",color:"white",border:"none",borderRadius:"50%",width:18,height:18,cursor:"pointer",fontSize:10,lineHeight:"18px",textAlign:"center",padding:0}}>✕</button>
      </div>
    ))}
  </div>);
}

// ─── Drag helpers ─────────────────────────────────────────────────────────────
// Simple drag-and-drop using the HTML5 drag API.
// dragSrc ref holds the index being dragged; drop swaps positions.
function useDragList(items, onReorder) {
  const dragSrc = useRef(null);
  const makeDragProps = (i) => ({
    draggable: true,
    onDragStart: (e) => { dragSrc.current=i; e.dataTransfer.effectAllowed="move"; },
    onDragOver:  (e) => { e.preventDefault(); e.dataTransfer.dropEffect="move"; },
    onDrop: (e) => {
      e.preventDefault();
      if(dragSrc.current===null||dragSrc.current===i) return;
      const arr=[...items];
      const [removed]=arr.splice(dragSrc.current,1);
      arr.splice(i,0,removed);
      dragSrc.current=null;
      onReorder(arr);
    },
    onDragEnd: ()=>{ dragSrc.current=null; },
  });
  return makeDragProps;
}

// ─── Tool List Editor ─────────────────────────────────────────────────────────
function ToolListEditor({ toolList, onChange }) {
  const [bulkText, setBulkText] = useState("");
  const [showBulk, setShowBulk] = useState(false);

  const addOne  = () => onChange([...toolList, {id:Date.now()+Math.random(), name:"", partNo:""}]);
  const updTool = (i,f,v) => { const a=[...toolList]; a[i]={...a[i],[f]:v}; onChange(a); };
  const delTool = (i) => onChange(toolList.filter((_,j)=>j!==i));

  // Bulk add: each line becomes one tool entry.
  // Supports "Tool Name" or "Tool Name | Part#" per line.
  const commitBulk = () => {
    const lines = bulkText.split("\n").map(l=>l.trim()).filter(Boolean);
    const newTools = lines.map(line=>{
      const parts = line.split("|").map(s=>s.trim());
      return {id:Date.now()+Math.random(), name:parts[0]||"", partNo:parts[1]||""};
    });
    onChange([...toolList, ...newTools]);
    setBulkText("");
    setShowBulk(false);
  };

  return (
    <div style={{marginBottom:8}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
        <label style={{fontSize:11,color:"#555",fontWeight:600}}>🔧 Tools & Equipment</label>
        <div style={{display:"flex",gap:6}}>
          <button onClick={addOne}
            style={{fontSize:11,padding:"2px 8px",background:"#e8f5e9",border:"1px solid #a5d6a7",borderRadius:4,cursor:"pointer"}}>
            + Add Tool
          </button>
          <button onClick={()=>setShowBulk(s=>!s)}
            style={{fontSize:11,padding:"2px 8px",background:"#e3f2fd",border:"1px solid #90caf9",borderRadius:4,cursor:"pointer",color:"#1565c0"}}>
            + Add Multiple
          </button>
        </div>
      </div>

      {/* Bulk add panel */}
      {showBulk && (
        <div style={{background:"#f0f8ff",border:"1px solid #90caf9",borderRadius:6,padding:10,marginBottom:8}}>
          <div style={{fontSize:11,color:"#1565c0",marginBottom:4,fontWeight:600}}>
            Bulk add — one tool per line. Optionally add a part/model number after a pipe: <code>Tool Name | Part#</code>
          </div>
          <textarea
            value={bulkText}
            onChange={e=>setBulkText(e.target.value)}
            autoFocus
            rows={5}
            placeholder={"Engine Crane\nHoist\nBattery Tester | BT-2000\nGeneral Hand Tools"}
            style={{width:"100%",padding:"6px 8px",border:"1px solid #90caf9",borderRadius:4,fontSize:12,resize:"vertical",fontFamily:"monospace"}}
          />
          <div style={{display:"flex",gap:8,marginTop:6}}>
            <button onClick={commitBulk}
              style={{background:TEAL,color:"white",border:"none",borderRadius:5,padding:"5px 14px",cursor:"pointer",fontSize:12,fontWeight:700}}>
              ✓ Add {bulkText.split("\n").filter(l=>l.trim()).length} Tool(s)
            </button>
            <button onClick={()=>{setShowBulk(false);setBulkText("");}}
              style={{background:"#f5f5f5",border:"1px solid #ddd",borderRadius:5,padding:"5px 14px",cursor:"pointer",fontSize:12}}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {toolList.length===0 && !showBulk && (
        <div style={{fontSize:11,color:"#aaa",fontStyle:"italic",padding:"4px 0"}}>
          No tools added yet.
        </div>
      )}
      {toolList.map((t,i)=>(
        <div key={t.id||i} style={{display:"flex",gap:6,marginBottom:4,alignItems:"center"}}>
          <input value={t.name} onChange={e=>updTool(i,"name",e.target.value)}
            placeholder="Tool name *"
            style={{flex:2,padding:"4px 6px",border:"1px solid #ccc",borderRadius:4,fontSize:12}}/>
          <input value={t.partNo||""} onChange={e=>updTool(i,"partNo",e.target.value)}
            placeholder="Part / Model # (optional)"
            style={{flex:2,padding:"4px 6px",border:"1px solid #ccc",borderRadius:4,fontSize:12}}/>
          <button onClick={()=>delTool(i)}
            style={{padding:"2px 7px",background:"#ffebee",border:"1px solid #ef9a9a",borderRadius:4,cursor:"pointer",fontSize:11,color:"#c62828",flexShrink:0}}>
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Ref Dropdown ──────────────────────────────────────────────────────────────
// Generic multi-select dropdown for tools and drawings at task/step level
function RefDropdown({ label, options, selected, onChange, compact=false }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(()=>{
    const h=(e)=>{ if(ref.current&&!ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown",h);
    return ()=>document.removeEventListener("mousedown",h);
  },[]);

  if(!options||options.length===0) return null;

  const toggle = (val) => {
    const next = selected.includes(val) ? selected.filter(v=>v!==val) : [...selected,val];
    onChange(next);
  };

  const displayLabel = selected.length===0
    ? label
    : selected.length===1
      ? (options.find(o=>o.value===selected[0])?.label||selected[0])
      : `${selected.length} selected`;

  const fs = compact ? 11 : 12;

  return (
    <div ref={ref} style={{position:"relative"}}>
      <button onClick={()=>setOpen(o=>!o)}
        style={{
          width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",
          gap:6,padding:`${compact?"2px 6px":"4px 8px"}`,
          border:`1px solid ${selected.length>0?TEAL:"#ccc"}`,
          borderRadius:4,background:selected.length>0?TEAL_LIGHT:"white",
          cursor:"pointer",fontSize:fs,textAlign:"left",
          color:selected.length>0?TEAL_DARK:"#555"
        }}>
        <span style={{flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
          {displayLabel}
        </span>
        <span style={{fontSize:9,flexShrink:0}}>▼</span>
      </button>
      {open && (
        <div style={{
          position:"absolute",top:"100%",left:0,zIndex:300,
          background:"white",border:"1px solid #ccc",borderRadius:6,
          boxShadow:"0 4px 16px rgba(0,0,0,0.15)",minWidth:"100%",maxWidth:340,
          marginTop:2,maxHeight:220,overflowY:"auto"
        }}>
          <div style={{padding:"5px 10px",fontSize:10,color:"#888",borderBottom:"1px solid #eee",background:"#fafafa"}}>
            Click to select/deselect
          </div>
          {selected.length>0 && (
            <div onClick={()=>{onChange([]);setOpen(false);}}
              style={{padding:"6px 12px",fontSize:fs,cursor:"pointer",color:"#c62828",borderBottom:"1px solid #eee",display:"flex",alignItems:"center",gap:6}}
              onMouseEnter={e=>e.currentTarget.style.background="#ffebee"}
              onMouseLeave={e=>e.currentTarget.style.background="white"}>
              ✕ &nbsp;Clear all
            </div>
          )}
          {options.map(opt=>{
            const active=selected.includes(opt.value);
            return (
              <div key={opt.value} onClick={()=>toggle(opt.value)}
                style={{
                  padding:"7px 12px",fontSize:fs,cursor:"pointer",
                  display:"flex",alignItems:"center",gap:8,
                  background:active?TEAL_LIGHT:"white",
                  fontWeight:active?700:400,
                  borderBottom:"1px solid #f5f5f5"
                }}
                onMouseEnter={e=>e.currentTarget.style.background=active?"#b2dfdb":"#f5f5f5"}
                onMouseLeave={e=>e.currentTarget.style.background=active?TEAL_LIGHT:"white"}>
                <span style={{flex:1}}>{opt.label}</span>
                {active&&<span style={{color:TEAL,fontSize:13,flexShrink:0}}>✓</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Auto-Expanding Textarea ─────────────────────────────────────────────────
const AutoTextarea = React.forwardRef(function AutoTextarea({ value, onChange, placeholder, minRows=2, style={} }, ref) {
  const innerRef = useRef();
  const resolvedRef = ref || innerRef;
  useEffect(() => {
    const el = resolvedRef.current;
    if(el){ el.style.height="auto"; el.style.height=el.scrollHeight+"px"; }
  }, [value]);
  return (
    <textarea ref={resolvedRef} value={value} onChange={onChange} placeholder={placeholder} rows={minRows}
      style={{width:"100%",padding:"5px 7px",border:"1px solid #ccc",borderRadius:4,
              fontSize:12,resize:"vertical",overflow:"hidden",minHeight:`${minRows*1.6}em`,...style}}
    />
  );
});

// ─── Rich Text Editor ─────────────────────────────────────────────────────────
// Wraps a textarea with Bold/Italic toolbar buttons. Text is stored as plain
// markdown-style: **bold** and _italic_. Rendered as HTML in preview/PDF.
function RichTextEditor({ value, onChange, placeholder, minRows=2 }) {
  const ref = useRef();

  const wrap = (before, after) => {
    const el = ref.current;
    if(!el) return;
    const start = el.selectionStart;
    const end   = el.selectionEnd;
    const selected = value.slice(start, end);
    const newVal = value.slice(0, start) + before + selected + after + value.slice(end);
    onChange({ target: { value: newVal } });
    // Restore selection after state update
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + before.length, end + before.length);
    }, 10);
  };

  // Render preview of bold/italic for display hint
  const preview = value
    .replace(/\*\*(.+?)\*\*/g, (_, t) => `**${t}**`)
    .replace(/_(.+?)_/g, (_, t) => `_${t}_`);

  return (
    <div>
      <div style={{display:"flex",gap:4,marginBottom:3}}>
        <button type="button" onMouseDown={e=>{e.preventDefault();wrap("**","**");}}
          title="Bold selected text"
          style={{padding:"1px 8px",fontSize:12,fontWeight:700,border:"1px solid #ccc",borderRadius:3,cursor:"pointer",background:"#f5f5f5"}}>
          B
        </button>
        <button type="button" onMouseDown={e=>{e.preventDefault();wrap("_","_");}}
          title="Italic selected text"
          style={{padding:"1px 8px",fontSize:12,fontStyle:"italic",border:"1px solid #ccc",borderRadius:3,cursor:"pointer",background:"#f5f5f5"}}>
          I
        </button>
        <span style={{fontSize:10,color:"#aaa",alignSelf:"center",marginLeft:4}}>
          Select text then click B or I
        </span>
      </div>
      <AutoTextarea ref={ref} value={value} onChange={onChange} placeholder={placeholder} minRows={minRows}
        style={{fontFamily:"monospace"}}/>
    </div>
  );
}

// ─── Lines Manager ────────────────────────────────────────────────────────────
// ─── Add Existing Station Picker ─────────────────────────────────────────────
function AddExistingStation({ available, onAdd }) {
  const [selId, setSelId] = useState("");
  const selected = available.find(s => String(s.id) === selId);

  const doAdd = () => { if(!selected) return; onAdd(selected); setSelId(""); };

  if(!available.length) return null;

  return (
    <div style={{borderTop:"1px solid #e0e0e0",paddingTop:10,marginTop:8,display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
      <label style={{fontSize:12,color:"#555",fontWeight:600,flexShrink:0}}>Add unassigned station:</label>
      <select value={selId} onChange={e=>setSelId(e.target.value)}
        style={{flex:1,minWidth:200,padding:"5px 8px",border:"1px solid #ccc",borderRadius:5,fontSize:12,background:"white"}}>
        <option value="">— select a station —</option>
        {available.map(s=>(
          <option key={s.id} value={String(s.id)}>
            {s.stationNo||s.sopId||"Station"}{s.stationDesc?" — "+s.stationDesc:""}
          </option>
        ))}
      </select>
      {selected && (
        <span style={{fontSize:11,color:"#555",background:"#f5f5f5",padding:"3px 8px",borderRadius:4,border:"1px solid #e0e0e0",flexShrink:0}}>
          {selected.tasks.length} task(s) · {fmtTime(sumTasks(selected.tasks))}
        </span>
      )}
      <button onClick={doAdd} disabled={!selected}
        style={{padding:"5px 14px",background:selected?TEAL:"#e0e0e0",color:selected?"white":"#aaa",
                border:"none",borderRadius:5,cursor:selected?"pointer":"not-allowed",
                fontSize:12,fontWeight:700,flexShrink:0}}>
        + Add
      </button>
    </div>
  );
}

function LinesManager({ lines, stations, onLinesChange, onStationsChange, updStation, preview, setPreview, stationHandles, setStationHandle, lineHandles, setLineHandle, flash, confirmDelete, openLineFile }) {
  // Use Sets so multiple lines/stations can be open independently
  // Default: all collapsed
  const [openLineIds,    setOpenLineIds]    = useState(new Set());
  const [openStationIds, setOpenStationIds] = useState(new Set());
  const [lineReloadPrompt, setLineReloadPrompt] = useState(null);
  const lineOpenedAt = useRef({});

  // Helpers
  const isLineOpen    = (id) => openLineIds.has(id);
  const isStationOpen = (id) => openStationIds.has(id);
  const toggleLine    = (id) => setOpenLineIds(prev => { const s=new Set(prev); s.has(id)?s.delete(id):s.add(id); return s; });
  const toggleStation = (id) => setOpenStationIds(prev => { const s=new Set(prev); s.has(id)?s.delete(id):s.add(id); return s; });
  const openLine      = (id) => setOpenLineIds(prev => new Set([...prev, id]));
  const openStation   = (id) => setOpenStationIds(prev => new Set([...prev, id]));
  const collapseAllInLine = (line) => {
    setOpenStationIds(prev => { const s=new Set(prev); line.stationIds.forEach(id=>s.delete(id)); return s; });
  };
  const collapseAllLines = () => { setOpenLineIds(new Set()); setOpenStationIds(new Set()); };

  // Listen for sidebar navigation events
  useEffect(() => {
    const handler = (e) => {
      const { type, lineId, stationId, taskId } = e.detail || {};
      // Open the relevant items then scroll — don't collapse others
      if(lineId)    openLine(lineId);
      if(stationId) openStation(stationId);
      // Scroll after state settles
      setTimeout(() => {
        const targetId = taskId ? `task-${taskId}` : stationId ? `station-${stationId}` : lineId ? `line-${lineId}` : null;
        if(targetId) {
          const el = document.getElementById(targetId);
          if(el) el.scrollIntoView({behavior:"smooth", block:"start"});
        }
      }, 150);
    };
    window.addEventListener("sop-nav", handler);
    return () => window.removeEventListener("sop-nav", handler);
  }, []);

  const addLine = () => {
    const l = mkLine();
    onLinesChange(prev => [...prev, l]);
    setActiveLineId(l.id);
  };
  const updLine = (updated) => onLinesChange(prev => prev.map(l => l.id===updated.id ? updated : l));
  const delLine = (id) => {
    onLinesChange(prev => prev.filter(l=>l.id!==id));
    setOpenLineIds(prev=>{ const s=new Set(prev); s.delete(id); return s; }); setOpenStationIds(new Set());
  };
  const addStationToLine = (line) => {
    let s = mkStation();
    const pos = line.stationIds.length + 1; // position this will occupy
    if(line.stationIdentifier) {
      const newNo    = autoStationNo(line.stationIdentifier, pos);
      const newSopId = genSopId(newNo, s.asmVersion, s.sopRev);
      s = { ...s, stationNo: newNo, sopId: newSopId };
    }
    onStationsChange(prev => [...prev, s]);
    updLine({...line, stationIds:[...line.stationIds, s.id]});
    setActiveStationId(s.id);
  };

  const assignedIds = new Set(lines.flatMap(l=>l.stationIds));

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div>
          <h2 style={{margin:0,color:TEAL_DARK}}>Production Lines</h2>
          <span style={{fontSize:12,color:"#888"}}>{lines.length} line(s) · {stations.length} total station(s)</span>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {openLineFile && (
            <button onClick={openLineFile}
              style={{background:"rgba(0,105,92,0.08)",color:TEAL_DARK,border:`1px solid ${TEAL}`,borderRadius:8,padding:"10px 16px",cursor:"pointer",fontSize:14,fontWeight:600}}>
              📥 Add Line from File
            </button>
          )}
          {openLineIds.size>0 && (
            <button onClick={collapseAllLines}
              style={{background:"#f5f5f5",color:"#555",border:"1px solid #ddd",borderRadius:8,padding:"10px 14px",cursor:"pointer",fontSize:13}}>
              ⊟ Collapse All
            </button>
          )}
          <button onClick={addLine}
            style={{background:TEAL,color:"white",border:"none",borderRadius:8,padding:"10px 20px",cursor:"pointer",fontSize:14,fontWeight:700,boxShadow:"0 2px 6px rgba(0,137,123,0.3)"}}>
            + New Line
          </button>
        </div>
      </div>

      {/* Line reload / version check prompt */}
      {lineReloadPrompt && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:4000,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"white",borderRadius:12,padding:28,maxWidth:460,width:"95%",boxShadow:"0 8px 40px rgba(0,0,0,0.25)"}}>
            <div style={{display:"flex",gap:12,alignItems:"flex-start",marginBottom:16}}>
              <span style={{fontSize:32}}>🔄</span>
              <div>
                <div style={{fontWeight:700,fontSize:16,color:TEAL_DARK}}>Newer Version Available</div>
                <div style={{fontSize:12,color:"#888",marginTop:2}}>🏗️ {lineReloadPrompt.line.name||"This line"}</div>
              </div>
            </div>
            <div style={{background:"#fff8e1",border:"1px solid #ffe082",borderRadius:8,padding:"12px 14px",marginBottom:14,fontSize:13,color:"#555",lineHeight:1.7}}>
              This line's file was <strong>updated after you last loaded it</strong>. Another user may have made changes.
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20,fontSize:12}}>
              <div style={{background:"#f5f5f5",borderRadius:6,padding:"10px 12px"}}>
                <div style={{color:"#888",marginBottom:3}}>Your version loaded at</div>
                <div style={{fontWeight:700,color:"#555"}}>
                  {lineReloadPrompt.loadedAt ? new Date(lineReloadPrompt.loadedAt).toLocaleString() : "Unknown"}
                </div>
              </div>
              <div style={{background:"#e8f5e9",borderRadius:6,padding:"10px 12px",border:"1px solid #a5d6a7"}}>
                <div style={{color:TEAL_DARK,marginBottom:3}}>File last saved at</div>
                <div style={{fontWeight:700,color:TEAL_DARK}}>
                  {new Date(lineReloadPrompt.fileUpdatedAt).toLocaleString()}
                </div>
              </div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              <button onClick={async()=>{
                // Reload from file
                try {
                  const file = await lineReloadPrompt.handle.getFile();
                  const text = await file.text();
                  const data = JSON.parse(text);
                  // Merge incoming line into workspace (replace this line's stations)
                  const incomingLine = (data.lines||[]).find(l=>l.name?.trim().toLowerCase()===lineReloadPrompt.line.name?.trim().toLowerCase());
                  if(incomingLine) {
                    const incomingStations = (data.stations||[]).filter(s=>incomingLine.stationIds.includes(s.id));
                    // Remove old stations for this line, add new ones
                    onStationsChange(prev => {
                      const without = prev.filter(s=>!lineReloadPrompt.line.stationIds.includes(s.id));
                      return [...without, ...incomingStations.map(migrateStation)];
                    });
                    onLinesChange(prev => prev.map(l => l.id===lineReloadPrompt.line.id ? {...incomingLine, id:l.id} : l));
                    flash(`✓ Reloaded: ${lineReloadPrompt.line.name}`);
                  } else {
                    flash("Could not find matching line in file.");
                  }
                } catch(e){ flash("Could not reload file."); }
                lineOpenedAt.current[lineReloadPrompt.line.id] = new Date().toISOString();
                openLine(lineReloadPrompt.line.id);
                setLineReloadPrompt(null);
              }}
                style={{background:TEAL,color:"white",border:"none",borderRadius:7,padding:"11px 0",cursor:"pointer",fontSize:13,fontWeight:700}}>
                🔄 Reload from file (get latest)
              </button>
              <button onClick={()=>{
                // Open with current workspace version
                lineOpenedAt.current[lineReloadPrompt.line.id] = new Date().toISOString();
                openLine(lineReloadPrompt.line.id);
                setLineReloadPrompt(null);
              }}
                style={{background:"#fff8e1",color:"#e65100",border:"2px solid #ffb74d",borderRadius:7,padding:"10px 0",cursor:"pointer",fontSize:13,fontWeight:600}}>
                Continue with my version
              </button>
              <button onClick={()=>setLineReloadPrompt(null)}
                style={{background:"#f5f5f5",color:"#555",border:"1px solid #ddd",borderRadius:7,padding:"10px 0",cursor:"pointer",fontSize:13}}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {lines.length===0 && (
        <div style={{textAlign:"center",padding:60,color:"#bbb",background:"white",borderRadius:12,border:"2px dashed #e0e0e0"}}>
          <div style={{fontSize:48}}>🏗️</div>
          <div style={{fontSize:16,marginTop:10,fontWeight:600}}>No lines yet</div>
          <div style={{fontSize:13,marginTop:6}}>Create a line to group stations together. The line name will appear in SOP headers.</div>
        </div>
      )}

      {lines.map(line => {
        const lineStations = line.stationIds.map(id=>stations.find(s=>s.id===id)).filter(Boolean);
        const totalTime    = lineStations.reduce((sum,s)=>sum+sumTasks(s.tasks),0);
        const lineOpen = isLineOpen(line.id);

        return (
          <div key={line.id} id={`line-${line.id}`} style={{border:lineOpen?`2px solid ${TEAL}`:"1px solid #ddd",borderRadius:10,marginBottom:10,
              overflow:"visible",background:"white",boxShadow:lineOpen?"0 2px 12px rgba(0,137,123,0.12)":"0 1px 3px rgba(0,0,0,0.06)"}}>

            {/* ── Line header bar ── */}
            <div onClick={async()=>{
              if(lineOpen){ toggleLine(line.id); return; }
              // Opening the line — check if the linked file has been updated since last load
              const lh = lineHandles[line.id];
              if(lh?.handle) {
                try {
                  const diskState = await readFileSavedAt(lh.handle);
                  const openedAt  = lineOpenedAt.current[line.id];
                  if(diskState?.savedAt && openedAt && diskState.savedAt > openedAt) {
                    // File is newer than when we last loaded this line
                    setLineReloadPrompt({ line, fileUpdatedAt: diskState.savedAt, loadedAt: openedAt, handle: lh.handle });
                    return; // Don't open yet — let user decide
                  }
                } catch(e){ /* can't read file — open normally */ }
              }
              openLine(line.id);
              lineOpenedAt.current[line.id] = new Date().toISOString();
            }}
              style={{background:lineOpen?TEAL:"#f5f5f5",color:lineOpen?"white":"#333",padding:"10px 14px",
                      cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",
                      userSelect:"none",borderRadius:lineOpen?"8px 8px 0 0":"8px"}}>
              <div style={{display:"flex",gap:10,alignItems:"center"}}>
                <span style={{fontWeight:700,fontSize:15}}>🏗️ {line.name||"New Line"}</span>
                <span style={{fontSize:12,opacity:0.8}}>{lineStations.length} station(s) · ⏱ {fmtTime(totalTime)}</span>
              </div>
              <div style={{display:"flex",gap:6}} onClick={e=>e.stopPropagation()}>
                <button onClick={()=>addStationToLine(line)}
                  style={{background:"rgba(255,255,255,0.2)",border:"1px solid rgba(255,255,255,0.5)",borderRadius:4,padding:"3px 10px",cursor:"pointer",fontSize:12,color:lineOpen?"white":"#333"}}>
                  + Station
                </button>
                {/* Line save button + linked file indicator */}
                <div style={{display:"flex",alignItems:"center",gap:0}}>
                  <button onClick={async(e)=>{e.stopPropagation();
                    const lh = lineHandles[line.id];
                    const name=(line.name||"Line").replace(/[^a-zA-Z0-9_\- ]/g,"").trim().replace(/\s+/g,"_")+`_${new Date().toISOString().slice(0,10)}`;
                    // Rebuild fresh from stations prop — avoids stale closure issue
                    const freshLineStations = line.stationIds.map(id=>stations.find(s=>s.id===id)).filter(Boolean);
                    await smartSave(freshLineStations,[line],name,lh?.handle||null,(h,n)=>setLineHandle(line.id,h,n),flash);
                  }} style={{background:lineHandles[line.id]?"rgba(255,255,255,0.3)":"rgba(255,255,255,0.2)",
                             border:lineHandles[line.id]?"2px solid #a5d6a7":"1px solid rgba(255,255,255,0.5)",
                             borderRadius:lineHandles[line.id]?"4px 0 0 4px":"4px",
                             padding:"3px 10px",cursor:"pointer",fontSize:12,
                             color:lineOpen?"white":"#333",fontWeight:lineHandles[line.id]?700:400}}>
                    💾 Save
                  </button>
                  {lineHandles[line.id] && (
                    <span style={{display:"flex",alignItems:"center",gap:2,
                                  background:"rgba(255,255,255,0.15)",border:"2px solid #a5d6a7",borderLeft:"none",
                                  borderRadius:"0 4px 4px 0",padding:"2px 6px",fontSize:10,
                                  color:lineOpen?"#a5d6a7":"#555",maxWidth:120,overflow:"hidden"}}>
                      <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:90}}
                        title={lineHandles[line.id].name}>
                        {lineHandles[line.id].name}
                      </span>
                      <button onClick={e=>{e.stopPropagation();setLineHandle(line.id,null,null);}}
                        title="Disconnect this file"
                        style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,0.7)",
                                fontSize:10,padding:"0 1px",lineHeight:1,flexShrink:0}}>✕</button>
                    </span>
                  )}
                </div>
                <button onClick={()=>lineStations.forEach((s,i)=>setTimeout(()=>exportPDF({...s,lineName:line.name}),i*500))}
                  style={{background:"rgba(255,255,255,0.2)",border:"1px solid rgba(255,255,255,0.5)",borderRadius:4,padding:"3px 10px",cursor:"pointer",fontSize:12,color:lineOpen?"white":"#333"}}>
                  📄 All PDFs
                </button>
                <button onClick={()=>confirmDelete("line", line.name||"this line", {lineId:line.id})}
                  style={{background:"rgba(200,0,0,0.12)",border:"1px solid rgba(200,0,0,0.25)",borderRadius:4,padding:"3px 8px",cursor:"pointer",color:"#c62828",fontSize:12}}>✕</button>
              </div>
            </div>

            {lineOpen && (
              <div style={{padding:16}}>
                {/* Line name + description */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:14}}>
                  <div>
                    <label style={{fontSize:11,color:"#555",display:"block",marginBottom:2}}>Line Name *</label>
                    <input value={line.name} onChange={e=>updLine({...line,name:e.target.value})}
                      placeholder="e.g. Powder Coat"
                      style={{width:"100%",padding:"6px 8px",border:"1px solid #ccc",borderRadius:4,fontSize:13,fontWeight:600}}/>
                    <div style={{fontSize:10,color:"#888",marginTop:3}}>Appears in SOP header</div>
                  </div>
                  <div>
                    <label style={{fontSize:11,color:"#555",display:"block",marginBottom:2}}>Station Identifier</label>
                    <input value={line.stationIdentifier||""} onChange={e=>{
                      const updated={...line,stationIdentifier:e.target.value.toUpperCase()};
                      updLine(updated);
                      // Re-apply station numbers immediately when identifier changes
                      if(e.target.value.trim()) {
                        updated.stationIds.forEach((id,i)=>{
                          const s=stations.find(st=>st.id===id); if(!s) return;
                          const newNo=autoStationNo(e.target.value,i+1);
                          const newSopId=genSopId(newNo,s.asmVersion,s.sopRev);
                          const tasks=s.tasks.map(t=>({...t,taskId:genTaskId(newSopId,t.taskNo)}));
                          onStationsChange(prev=>prev.map(st=>st.id===id?{...st,stationNo:newNo,sopId:newSopId,tasks}:st));
                        });
                      }
                    }}
                      placeholder="e.g. PWD-WIP"
                      style={{width:"100%",padding:"6px 8px",border:`1px solid ${line.stationIdentifier?TEAL:"#ccc"}`,borderRadius:4,fontSize:13,fontWeight:600,fontFamily:"monospace",textTransform:"uppercase"}}/>
                    <div style={{fontSize:10,color:"#888",marginTop:3}}>
                      Station Nos: <span style={{fontFamily:"monospace",color:TEAL_DARK}}>{line.stationIdentifier?`${line.stationIdentifier}-01, ${line.stationIdentifier}-02…`:"(enter identifier)"}</span>
                    </div>
                  </div>
                  <div>
                    <label style={{fontSize:11,color:"#555",display:"block",marginBottom:2}}>Description</label>
                    <input value={line.description||""} onChange={e=>updLine({...line,description:e.target.value})}
                      placeholder="Optional line description"
                      style={{width:"100%",padding:"6px 8px",border:"1px solid #ccc",borderRadius:4,fontSize:12}}/>
                  </div>
                </div>

                {/* ── Stations — full StationEditor inline ── */}
                <div style={{borderTop:`2px solid ${TEAL_LIGHT}`,paddingTop:12}}>
                  <div style={{fontWeight:700,fontSize:13,color:TEAL_DARK,marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span>Stations ({lineStations.length})
                      <span style={{fontSize:11,color:"#aaa",fontWeight:400,marginLeft:8}}>⠿ drag to reorder</span>
                    </span>
                    <div style={{display:"flex",gap:6}}>
                      {lineStations.some(s=>isStationOpen(s.id)) && (
                        <button onClick={()=>collapseAllInLine(line)}
                          style={{fontSize:12,padding:"3px 10px",background:"#f5f5f5",color:"#555",border:"1px solid #ddd",borderRadius:5,cursor:"pointer"}}>
                          ⊟ Collapse Stations
                        </button>
                      )}
                      <button onClick={()=>addStationToLine(line)}
                        style={{fontSize:12,padding:"3px 10px",background:TEAL,color:"white",border:"none",borderRadius:5,cursor:"pointer",fontWeight:600}}>
                        + Add Station
                      </button>
                    </div>
                  </div>

                  {lineStations.length===0 && (
                    <div style={{color:"#aaa",fontSize:12,fontStyle:"italic",padding:"8px 0"}}>
                      No stations yet — click + Add Station to create one.
                    </div>
                  )}

                  {lineStations.map((s, i) => (
                    <div key={s.id}
                      draggable
                      onDragStart={e=>{e.dataTransfer.setData("text/plain",String(i)); e.stopPropagation();}}
                      onDragOver={e=>e.preventDefault()}
                      onDrop={e=>{
                        e.preventDefault();
                        const from=parseInt(e.dataTransfer.getData("text/plain"));
                        if(from===i) return;
                        const ids=[...line.stationIds];
                        const [removed]=ids.splice(from,1); ids.splice(i,0,removed);
                        const reorderedLine={...line,stationIds:ids};
                        updLine(reorderedLine);
                        // Recompute station numbers after reorder
                        if(line.stationIdentifier) {
                          ids.forEach((sid,pos)=>{
                            const st=stations.find(s=>s.id===sid); if(!st) return;
                            const newNo=autoStationNo(line.stationIdentifier,pos+1);
                            const newSopId=genSopId(newNo,st.asmVersion,st.sopRev);
                            const tasks=st.tasks.map(t=>({...t,taskId:genTaskId(newSopId,t.taskNo)}));
                            onStationsChange(prev=>prev.map(s=>s.id===sid?{...s,stationNo:newNo,sopId:newSopId,tasks}:s));
                          });
                        }
                      }}
                      id={`station-${s.id}`}
                      style={{marginBottom:6}}>
                      {/* Drag handle row above StationEditor */}
                      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
                        <span style={{color:"#bbb",fontSize:16,cursor:"grab"}}>⠿</span>
                        <span style={{background:TEAL,color:"white",borderRadius:3,padding:"1px 7px",fontSize:11,fontWeight:700}}>
                          {String(i+1).padStart(2,"0")}
                        </span>
                      </div>
                      <StationEditor
                        station={s}
                        isActive={isStationOpen(s.id)}
                        onSelect={()=>toggleStation(s.id)}
                        onUpdate={(updated, extra)=>updStation(updated, extra)}
                        onDelete={()=>confirmDelete("station", s.stationNo||s.sopId||"this station", {stationId:s.id})}
                        onPreview={()=>setPreview({...s,lineName:line.name})}
                        allStations={lineStations}
                        lineName={line.name}
                        stationIdentifier={line.stationIdentifier||""}
                        stationHandle={stationHandles[s.id]?.handle||null}
                        onStationHandle={(h,n,msg)=>{
                          setStationHandle(s.id,h,n);
                          if(msg) flash(msg);
                        }}
                        confirmDelete={confirmDelete}
                      />
                    </div>
                  ))}

                  {/* Add existing station — only shows truly unassigned stations */}
                  {stations.filter(s=>!assignedIds.has(s.id)&&!line.stationIds.includes(s.id)).length>0 && (
                    <AddExistingStation
                      available={stations.filter(s=>!assignedIds.has(s.id)&&!line.stationIds.includes(s.id))}
                      onAdd={(s)=>{
                        const newIds=[...line.stationIds,s.id];
                        updLine({...line,stationIds:newIds});
                        if(line.stationIdentifier){
                          const pos=newIds.length;
                          const newNo=autoStationNo(line.stationIdentifier,pos);
                          const newSopId=genSopId(newNo,s.asmVersion,s.sopRev);
                          const tasks=s.tasks.map(t=>({...t,taskId:genTaskId(newSopId,t.taskNo)}));
                          onStationsChange(prev=>prev.map(st=>st.id===s.id?{...st,stationNo:newNo,sopId:newSopId,tasks}:st));
                        }
                      }}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}


// ─── Icon Picker ──────────────────────────────────────────────────────────────
function IconPicker({ selected, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();

  // Close when clicking outside
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggle = (key) => {
    const next = selected.includes(key)
      ? selected.filter(k => k !== key)
      : [...selected, key];
    onChange(next);
  };

  const label = selected.length === 0
    ? "Select icons…"
    : selected.map(k => ICONS[k]?.emoji).join("  ");

  return (
    <div ref={ref} style={{position:"relative",display:"inline-block"}}>
      {/* Trigger button — looks like a native select */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display:"flex", alignItems:"center", gap:6,
          padding:"3px 8px 3px 6px", minWidth:160, height:28,
          border:"1px solid #ccc", borderRadius:4, background:"white",
          cursor:"pointer", fontSize:13, textAlign:"left",
          justifyContent:"space-between"
        }}
      >
        <span style={{flex:1, overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis"}}>
          {label}
        </span>
        <span style={{fontSize:10, color:"#888", flexShrink:0}}>▼</span>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div style={{
          position:"absolute", top:"100%", left:0, zIndex:200,
          background:"white", border:"1px solid #ccc", borderRadius:6,
          boxShadow:"0 4px 16px rgba(0,0,0,0.15)", minWidth:190,
          marginTop:2, overflow:"hidden"
        }}>
          {/* Clear option */}
          {selected.length > 0 && (
            <div
              onClick={() => { onChange([]); setOpen(false); }}
              style={{
                padding:"7px 12px", fontSize:12, cursor:"pointer",
                color:"#c62828", borderBottom:"1px solid #eee",
                display:"flex", alignItems:"center", gap:8
              }}
              onMouseEnter={e=>e.currentTarget.style.background="#ffebee"}
              onMouseLeave={e=>e.currentTarget.style.background="white"}
            >
              ✕ &nbsp;Clear all
            </div>
          )}
          {/* Icon options */}
          {Object.entries(ICONS).filter(([k]) => k !== "none").map(([k, v]) => {
            const active = selected.includes(k);
            return (
              <div
                key={k}
                onClick={() => toggle(k)}
                style={{
                  padding:"7px 12px", fontSize:12, cursor:"pointer",
                  display:"flex", alignItems:"center", gap:10,
                  background: active ? "#e0f2f1" : "white",
                  fontWeight: active ? 700 : 400,
                  borderBottom:"1px solid #f5f5f5"
                }}
                onMouseEnter={e=>e.currentTarget.style.background=active?"#b2dfdb":"#f5f5f5"}
                onMouseLeave={e=>e.currentTarget.style.background=active?"#e0f2f1":"white"}
              >
                <span style={{fontSize:16, width:22, textAlign:"center"}}>{v.emoji}</span>
                <span>{v.label.replace(/^\S+\s/, "")}</span>
                {active && <span style={{marginLeft:"auto", color:TEAL, fontSize:14}}>✓</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Step Editor ──────────────────────────────────────────────────────────────
function StepEditor({ step, idx, showNums, onChange, onDelete, dragProps, allStations, thisStationId, thisTaskId, onMoveStep, stationToolList, stationDrawings, confirmDelete=null }) {
  const u=(f,v)=>onChange({...step,[f]:v});
  const [showMove,setShowMove]=useState(false);

  // Build target list: all tasks across all stations except the current task
  const moveTargets = [];
  allStations.forEach(st=>{
    st.tasks.forEach(t=>{
      if(t.id!==thisTaskId) moveTargets.push({ label:`${st.stationNo||"Station"} → Task ${t.taskNo}: ${t.description||"(untitled)"}`, stationId:st.id, taskId:t.id });
    });
  });

  return (
    <div {...dragProps} style={{background:"#fafafa",border:"1px solid #e0e0e0",borderRadius:6,padding:10,marginBottom:0,cursor:"grab",userSelect:"none"}}>
      {/* Row 1: controls */}
      <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap",marginBottom:6}}>
        <span title="Drag to reorder" style={{color:"#bbb",fontSize:16,cursor:"grab",marginRight:2}}>⠿</span>
        {showNums && (
          <input value={step.stepNumber} onChange={e=>u("stepNumber",e.target.value)} placeholder={String(idx+1)}
            style={{width:44,padding:"3px 5px",border:"1px solid #ccc",borderRadius:4,fontSize:12,textAlign:"center"}}/>
        )}
        {/* Multi-icon dropdown — custom */}
        <IconPicker
          selected={step.icons||[]}
          onChange={icons=>u("icons",icons)}
        />
        <input value={step.cycleTime} onChange={e=>u("cycleTime",e.target.value)}
          placeholder="secs (or MM:SS)" type="text"
          title="Enter seconds (e.g. 90) or MM:SS (e.g. 1:30)"
          style={{width:100,padding:"3px 5px",border:"1px solid #ccc",borderRadius:4,fontSize:12}}/>
        <div style={{display:"flex",gap:3,marginLeft:"auto"}}>
          {moveTargets.length>0 && (
            <div style={{position:"relative"}}>
              <button onClick={()=>setShowMove(!showMove)}
                title="Move step to another task"
                style={{padding:"2px 7px",fontSize:11,background:"#e3f2fd",border:"1px solid #90caf9",borderRadius:4,cursor:"pointer",color:"#1565c0"}}>
                ↪ Move
              </button>
              {showMove && (
                <div style={{position:"absolute",right:0,top:"100%",zIndex:50,background:"white",border:"1px solid #ccc",borderRadius:6,boxShadow:"0 4px 16px rgba(0,0,0,0.15)",minWidth:280,maxHeight:220,overflowY:"auto"}}>
                  <div style={{padding:"6px 10px",fontSize:11,fontWeight:700,color:"#555",borderBottom:"1px solid #eee",background:"#f9f9f9"}}>Move to task:</div>
                  {moveTargets.map((t,i)=>(
                    <button key={i} onClick={()=>{ onMoveStep(t.stationId,t.taskId); setShowMove(false); }}
                      style={{display:"block",width:"100%",textAlign:"left",padding:"7px 12px",fontSize:12,background:"none",border:"none",cursor:"pointer",borderBottom:"1px solid #f0f0f0"}}
                      onMouseEnter={e=>e.target.style.background="#e8f5e9"} onMouseLeave={e=>e.target.style.background="none"}>
                      {t.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <button onClick={onDelete} style={{padding:"2px 8px",fontSize:12,background:"#ffebee",border:"1px solid #ef9a9a",borderRadius:4,cursor:"pointer",color:"#c62828"}}>✕</button>
        </div>
      </div>
      <RichTextEditor value={step.description||""} onChange={e=>u("description",e.target.value)}
        placeholder="Step description… (select text then B or I to format)" minRows={2}/>
      <AutoTextarea value={step.keyPoints||""} onChange={e=>u("keyPoints",e.target.value)}
        placeholder="NOTE / Key point (optional)" minRows={1}
        style={{marginTop:3,background:"#fffde7",fontSize:11}}/>
      {/* Torque specification */}
      {step.torqueValue ? (
        <div style={{marginTop:4,background:"#fce4ec",border:"1px solid #f48fb1",borderRadius:5,padding:"8px 10px"}}>
          <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginBottom:8}}>
            <span style={{fontSize:12,fontWeight:700,color:"#880e4f",flexShrink:0}}>🔩 Torque Spec:</span>
            <input value={step.torqueValue} onChange={e=>u("torqueValue",e.target.value)}
              placeholder="Value" type="text"
              style={{width:72,padding:"2px 6px",border:"1px solid #f48fb1",borderRadius:4,
                      fontSize:13,fontWeight:700,color:"#880e4f",background:"white",textAlign:"center"}}/>
            <select value={step.torqueUnit||"ft-lbs"} onChange={e=>u("torqueUnit",e.target.value)}
              style={{padding:"2px 5px",border:"1px solid #f48fb1",borderRadius:4,fontSize:12,
                      background:"white",color:"#880e4f",cursor:"pointer"}}>
              <option value="ft-lbs">ft-lbs</option>
              <option value="in-lbs">in-lbs</option>
              <option value="Nm">Nm</option>
              <option value="kg-cm">kg-cm</option>
            </select>
            <button onClick={()=>onChange({...step, torqueValue:"", torqueUnit:"ft-lbs"})}
              title="Remove torque spec"
              style={{marginLeft:"auto",background:"none",border:"none",color:"#f48fb1",
                      cursor:"pointer",fontSize:13,padding:"0 2px",lineHeight:1}}>✕</button>
          </div>
          {/* Torque checklist — fixed process steps shown as reference */}
          <div style={{borderTop:"1px solid #f48fb1",paddingTop:6}}>
            <div style={{fontSize:10,fontWeight:700,color:"#ad1457",marginBottom:4,textTransform:"uppercase",letterSpacing:"0.4px"}}>
              Torque Checklist (displayed to operator)
            </div>
            {["Verify torque setting on torque tool","Torque fastener","Mark torqued fastener with paint pen"].map((item,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:"#880e4f",marginBottom:2}}>
                <span style={{width:14,height:14,border:"1.5px solid #f48fb1",borderRadius:2,
                              background:"white",flexShrink:0,display:"inline-block"}}/>
                {item}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <button onClick={()=>u("torqueValue"," ")}
          style={{marginTop:4,background:"none",border:"1px dashed #f48fb1",borderRadius:5,
                  padding:"3px 10px",cursor:"pointer",fontSize:11,color:"#c2185b",display:"inline-flex",
                  alignItems:"center",gap:4}}>
          🔩 Add torque spec
        </button>
      )}
      {/* Step-level tool & drawing selectors */}
      {(stationToolList&&stationToolList.length>0||stationDrawings&&stationDrawings.filter(d=>d.drawingNo||d.description).length>0) && (
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginTop:6}}>
          {stationToolList&&stationToolList.length>0 && (
            <RefDropdown
              label="🔧 Tools (this step)"
              options={stationToolList.map(t=>({value:t.name,label:t.partNo?`${t.name} — ${t.partNo}`:t.name}))}
              selected={step.selectedTools||[]}
              onChange={v=>u("selectedTools",v)}
              compact
            />
          )}
          {stationDrawings&&stationDrawings.filter(d=>d.drawingNo||d.description).length>0 && (
            <RefDropdown
              label="📐 Drawings (this step)"
              options={stationDrawings.filter(d=>d.drawingNo||d.description).map(d=>({value:d.drawingNo,label:d.drawingNo&&d.description?`${d.drawingNo} — ${d.description}`:d.drawingNo||d.description}))}
              selected={step.selectedDrawings||[]}
              onChange={v=>u("selectedDrawings",v)}
              compact
            />
          )}
        </div>
      )}
      <div style={{marginTop:5,display:"flex",gap:8,alignItems:"flex-start",flexWrap:"wrap"}}>
        <ImgUpload label="📎 Add Image" onImage={src=>u("images",[...(step.images||[]),src])}/>
        {(step.images||[]).map((src,i)=>(
          <div key={i} style={{position:"relative",flexShrink:0}}>
            <img src={src} alt="" style={{maxHeight:70,maxWidth:120,border:"1px solid #ccc",borderRadius:4,display:"block"}}/>
            <button onClick={()=>u("images",(step.images||[]).filter((_,j)=>j!==i))}
              style={{position:"absolute",top:-6,right:-6,background:"#e53935",color:"white",border:"none",
                      borderRadius:"50%",width:18,height:18,cursor:"pointer",fontSize:10,
                      lineHeight:"18px",textAlign:"center",padding:0}}>✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// Insert-between button
function InsertStepBtn({ onInsert }) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:0,margin:"2px 0"}}>
      <div style={{flex:1,height:1,background:"#e0e0e0"}}/>
      <button onClick={onInsert} title="Insert step here"
        style={{background:"white",border:"1px solid #a5d6a7",borderRadius:"50%",width:22,height:22,cursor:"pointer",fontSize:14,color:TEAL,lineHeight:"20px",textAlign:"center",padding:0,flexShrink:0,boxShadow:"0 1px 3px rgba(0,0,0,0.1)"}}>
        +
      </button>
      <div style={{flex:1,height:1,background:"#e0e0e0"}}/>
    </div>
  );
}

// ─── Task Editor ──────────────────────────────────────────────────────────────
function TaskEditor({ task, dragProps, onUpdate, onDelete, allStations, thisStationId, onMoveTask, stationToolList, stationDrawings, confirmDelete=null }) {
  // Derive showNums from actual step data — if any step has useStepNumber:false, treat as off
  const [showNums, setShowNums] = useState(
    () => task.steps.length > 0 && task.steps.some(s => s.useStepNumber === true)
  );
  const [collapsed, setCollapsed] = useState(true); // tasks start collapsed
  const u=(f,v)=>onUpdate({...task,[f]:v});

  const updStep=(i,s)=>{ const a=[...task.steps]; a[i]=s; u("steps",a); };
  const delStep=(i)=>u("steps",task.steps.filter((_,j)=>j!==i));
  const insertStep=(afterIdx)=>{
    const a=[...task.steps];
    a.splice(afterIdx+1,0,mkStep());
    u("steps",a);
  };

  // drag reorder for steps
  const stepDrag = useDragList(task.steps, (reordered)=>u("steps",reordered));

  // Move step to another task
  const handleMoveStep=(stepIdx,targetStationId,targetTaskId)=>{
    const step=task.steps[stepIdx];
    onUpdate({...task, steps:task.steps.filter((_,i)=>i!==stepIdx)}, { moveStep:step, targetStationId, targetTaskId });
  };

  const moveTaskTargets = allStations.filter(s=>s.id!==thisStationId);
  const total=sumSteps(task.steps);

  return (
    <div {...dragProps} style={{border:"1px solid #b2dfdb",borderRadius:8,marginBottom:4,background:"white",overflow:"visible",cursor:"default"}}>
      {/* Task header */}
      <div style={{background:TEAL_LIGHT,padding:"8px 12px",display:"flex",gap:8,alignItems:"center",borderRadius:"8px 8px 0 0"}}>
        <span title="Drag to reorder tasks" style={{color:"#80cbc4",fontSize:18,cursor:"grab"}}>⠿</span>
        <div style={{cursor:"pointer",display:"flex",gap:8,alignItems:"center",flex:1,minWidth:0}} onClick={()=>setCollapsed(!collapsed)}>
          <span style={{background:TEAL,color:"white",borderRadius:4,padding:"2px 9px",fontWeight:700,fontSize:12,flexShrink:0}}>Task {task.taskNo}</span>
          <span style={{fontFamily:"monospace",fontSize:11,color:"#555",flexShrink:0}}>{task.taskId}</span>
          <span style={{fontSize:12,fontWeight:600,color:TEAL_DARK,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
            {task.description||<em style={{color:"#aaa"}}>No description</em>}
          </span>
          <span style={{fontSize:12,color:"#00695c",flexShrink:0}}>⏱ {fmtTime(total)}</span>
          <span style={{fontSize:13,color:"#888",flexShrink:0}}>{collapsed?"▶":"▼"}</span>
        </div>
        {/* Move task */}
        {moveTaskTargets.length>0 && (
          <div style={{position:"relative",flexShrink:0,display:"flex",alignItems:"center",gap:4}}>
            <span style={{fontSize:11,color:"#1565c0",fontWeight:600}}>↪</span>
            <select
              defaultValue=""
              onChange={e=>{
                const targetId = e.target.value;
                if(!targetId) return;
                // Find target station — compare as strings
                const target = moveTaskTargets.find(s=>String(s.id)===String(targetId));
                if(target) { onMoveTask(target.id); e.target.value=""; }
              }}
              onClick={e=>e.stopPropagation()}
              style={{padding:"3px 6px",fontSize:11,border:"1px solid #90caf9",borderRadius:4,
                      background:"#e3f2fd",color:"#1565c0",cursor:"pointer",maxWidth:160}}>
              <option value="">Move to…</option>
              {moveTaskTargets.map(s=>(
                <option key={String(s.id)} value={String(s.id)}>
                  {s.stationNo||s.sopId||"Station"}{s.stationDesc?" — "+s.stationDesc:""}
                </option>
              ))}
            </select>
          </div>
        )}
        <button onClick={e=>{e.stopPropagation();onDelete();}}
          style={{background:"#ffebee",border:"1px solid #ef9a9a",borderRadius:4,padding:"3px 8px",cursor:"pointer",color:"#c62828",fontSize:11,flexShrink:0}}>✕</button>
      </div>

      {!collapsed && (
        <div style={{padding:12}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
            <div>
              <label style={{fontSize:11,color:"#555",display:"block",marginBottom:2}}>Task Description *</label>
              <input value={task.description} onChange={e=>u("description",e.target.value.toUpperCase())} placeholder="e.g. BATTERY AND BATTERY CABLE REFURB"
                style={{width:"100%",padding:"5px 7px",border:"1px solid #ccc",borderRadius:4,fontSize:12}}/>
            </div>
            <div>
              <label style={{fontSize:11,color:"#555",display:"block",marginBottom:2}}>General Notes</label>
              <AutoTextarea value={task.generalNotes||""} onChange={e=>u("generalNotes",e.target.value)}
                placeholder="Optional task-level notes" minRows={1}/>
            </div>
          </div>
          <div style={{marginBottom:8,display:"flex",gap:8,alignItems:"flex-start",flexWrap:"wrap"}}>
            <ImgUpload label="📎 Task Image" onImage={src=>u("taskImages",[...(task.taskImages||[]),src])}/>
            <ImgList images={task.taskImages} onRemove={i=>u("taskImages",task.taskImages.filter((_,j)=>j!==i))}/>
          </div>

          {/* Task-level tool & drawing selectors */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
            <RefDropdown
              label="🔧 Tools Used (this task)"
              options={(stationToolList||[]).map(t=>({value:t.name,label:t.partNo?`${t.name} — ${t.partNo}`:t.name}))}
              selected={task.selectedTools||[]}
              onChange={v=>u("selectedTools",v)}
            />
            <RefDropdown
              label="📐 Applicable Drawings (this task)"
              options={(stationDrawings||[]).filter(d=>d.drawingNo||d.description).map(d=>({value:d.drawingNo,label:d.drawingNo&&d.description?`${d.drawingNo} — ${d.description}`:d.drawingNo||d.description}))}
              selected={task.selectedDrawings||[]}
              onChange={v=>u("selectedDrawings",v)}
            />
          </div>

          {/* Steps */}
          <div style={{borderTop:"1px solid #e0e0e0",paddingTop:8}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <span style={{fontWeight:600,fontSize:12,color:TEAL_DARK}}>Steps ({task.steps.length})</span>
              <label style={{fontSize:11,display:"flex",alignItems:"center",gap:4,cursor:"pointer"}}>
                <input type="checkbox" checked={showNums} onChange={e=>{
                  const val = e.target.checked;
                  setShowNums(val);
                  // Persist to each step so PDF respects the setting
                  u("steps", task.steps.map(s => ({...s, useStepNumber: val})));
                }}/> Step Numbers
              </label>
            </div>

            {/* Insert at top */}
            {task.steps.length>0 && <InsertStepBtn onInsert={()=>insertStep(-1)}/>}

            {task.steps.map((step,i)=>(
              <div key={step.id}>
                <StepEditor
                  step={step} idx={i} showNums={showNums}
                  dragProps={stepDrag(i)}
                  onChange={s=>updStep(i,s)}
                  onDelete={()=>{ if(confirmDelete){ confirmDelete("step",step.description?step.description.slice(0,40)+(step.description.length>40?"…":""):"this step",{stationId:thisStationId,taskId:task.id,stepIdx:i}); } else delStep(i); }}
                  allStations={allStations}
                  thisStationId={thisStationId}
                  thisTaskId={task.id}
                  onMoveStep={(targetStationId,targetTaskId)=>handleMoveStep(i,targetStationId,targetTaskId)}
                  stationToolList={stationToolList||[]}
                  stationDrawings={stationDrawings||[]}
                  confirmDelete={confirmDelete}
                />
                <InsertStepBtn onInsert={()=>insertStep(i)}/>
              </div>
            ))}

            {task.steps.length===0 && (
              <button onClick={()=>u("steps",[...task.steps,mkStep()])}
                style={{background:"#e8f5e9",border:"1px dashed #81c784",borderRadius:6,padding:"7px 14px",cursor:"pointer",fontSize:12,width:"100%",color:"#2e7d32"}}>
                + Add First Step
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Revision Log Panel ───────────────────────────────────────────────────────
function RevisionLogPanel({ station, onUpdate, onRevChange, onEntryEdit }) {
  const [showRevModal, setShowRevModal]   = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [pendingRev, setPendingRev]       = useState("");
  const [revDesc, setRevDesc]             = useState("");
  const [revDate, setRevDate]             = useState("");
  const [revBy,   setRevBy]               = useState("");
  const [editIdx, setEditIdx]             = useState(null);
  const [editDesc, setEditDesc]           = useState("");
  const [editBy,   setEditBy]             = useState("");
  const [editDate, setEditDate]           = useState("");
  const [editConfirmed, setEditConfirmed] = useState(false);

  // Today as YYYY-MM-DD for the date input default
  const todayISO = () => new Date().toISOString().slice(0,10);
  const isoToLocale = (iso) => iso ? new Date(iso+"T00:00:00").toLocaleDateString() : new Date().toLocaleDateString();

  // Migrate: if revisionEntries missing, seed from sopRev + revisionLog text
  const entries = (() => {
    if (station.revisionEntries && station.revisionEntries.length > 0) {
      return station.revisionEntries;
    }
    // Build a fallback entry from whatever is stored in the old free-text revisionLog
    const rev = station.sopRev || "A";
    const rawLog = station.revisionLog || "";
    // Try to parse lines like "A - Initial Release" from the old text field
    const lines = rawLog.split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length > 0) {
      return lines.map(line => {
        const match = line.match(/^([A-Z]+)\s*[-–]\s*(.+)/);
        return match
          ? { rev: match[1], date: "", description: match[2].trim(), by: "" }
          : { rev, date: "", description: line, by: "" };
      });
    }
    // Last resort: just show the current rev as Initial Release
    return [{ rev, date: new Date().toLocaleDateString(), description: rev === "A" ? "Initial Release" : "See revision history", by: "" }];
  })();

  // Next letter helper  A→B, B→C … Z→AA etc.
  const nextRev = (current) => {
    const c = (current||"A").toUpperCase().trim();
    if(c.length===1) {
      const code = c.charCodeAt(0);
      return code < 90 ? String.fromCharCode(code+1) : "AA";
    }
    // multi-char: increment last letter
    const arr = c.split("");
    let i = arr.length-1;
    while(i>=0){
      if(arr[i].charCodeAt(0)<90){ arr[i]=String.fromCharCode(arr[i].charCodeAt(0)+1); break; }
      arr[i]="A"; i--;
    }
    if(i<0) arr.unshift("A");
    return arr.join("");
  };

  const proposed = nextRev(station.sopRev);

  // ── New revision flow ────────────────────────────────────────────────────────
  const startRevChange = () => {
    setPendingRev(proposed);
    setRevDesc("");
    setRevDate(todayISO());
    setRevBy(station.revisedBy||"");
    setShowRevModal(true);
  };
  const confirmRev = () => {
    const rev = (pendingRev||proposed).toUpperCase().trim();
    if(!rev){ alert("Please enter a revision letter."); return; }
    if(!revDesc.trim()){ alert("Please enter a description for this revision."); return; }
    const exists = entries.some(e=>e.rev.toUpperCase()===rev);
    if(exists && !window.confirm(`Revision ${rev} already exists in the log. Add another entry for it anyway?`)) return;
    onRevChange(rev, revDesc.trim(), isoToLocale(revDate), revBy.trim());
    setShowRevModal(false);
  };

  // ── Edit entry flow ──────────────────────────────────────────────────────────
  const startEdit = (i) => {
    setEditIdx(i);
    setEditDesc(entries[i].description);
    setEditBy(entries[i].by||"");
    // Convert locale date back to ISO for the date input
    const raw = entries[i].date||"";
    // Try to parse back to YYYY-MM-DD; if it fails leave blank
    try {
      const d = new Date(raw);
      setEditDate(!isNaN(d) ? d.toISOString().slice(0,10) : "");
    } catch { setEditDate(""); }
    setEditConfirmed(false);
    setShowEditModal(true);
  };
  const confirmEdit = () => {
    if(!editDesc.trim()){ alert("Description cannot be empty."); return; }
    onEntryEdit(editIdx, editDesc.trim(), editBy.trim(), editDate);
    setShowEditModal(false);
  };

  return (
    <div style={{marginBottom:8}}>
      {/* Header row */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
        <label style={{fontSize:11,color:"#555",fontWeight:600}}>Revision Log</label>
        <button onClick={startRevChange}
          style={{fontSize:11,padding:"3px 10px",background:TEAL,color:"white",border:"none",borderRadius:4,cursor:"pointer",fontWeight:600}}>
          + New Revision ({proposed})
        </button>
      </div>

      {/* Log table */}
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,border:"1px solid #ddd",borderRadius:4,overflow:"hidden"}}>
        <thead>
          <tr style={{background:"#e0e0e0"}}>
            <th style={{padding:"5px 8px",textAlign:"left",width:40}}>Rev</th>
            <th style={{padding:"5px 8px",textAlign:"left",width:90}}>Date</th>
            <th style={{padding:"5px 8px",textAlign:"left"}}>Description</th>
            <th style={{padding:"5px 8px",textAlign:"left",width:80}}>By</th>
            <th style={{padding:"5px 8px",width:60}}></th>
          </tr>
        </thead>
        <tbody>
          {entries.length===0 && (
            <tr><td colSpan={5} style={{padding:"8px",color:"#aaa",textAlign:"center",fontStyle:"italic"}}>No revisions yet</td></tr>
          )}
          {entries.map((e,i)=>(
            <tr key={i} style={{background:i%2===0?"white":"#fafafa",borderTop:"1px solid #eee"}}>
              <td style={{padding:"5px 8px",fontWeight:700,color:TEAL_DARK}}>{e.rev}</td>
              <td style={{padding:"5px 8px",color:"#666"}}>{e.date}</td>
              <td style={{padding:"5px 8px"}}>{e.description}</td>
              <td style={{padding:"5px 8px",color:"#666"}}>{e.by}</td>
              <td style={{padding:"3px 6px",textAlign:"center",whiteSpace:"nowrap"}}>
                <button onClick={()=>startEdit(i)} title="Edit this revision"
                  style={{background:"#e8f5e9",border:"1px solid #a5d6a7",borderRadius:3,
                          padding:"1px 6px",cursor:"pointer",fontSize:11,marginRight:3}}>
                  ✏️
                </button>
                <button onClick={()=>{
                  if(entries.length===1){ alert("Cannot delete the only revision entry."); return; }
                  if(window.confirm(`Delete Rev ${e.rev} — ${e.description}?\nThis cannot be undone.`)){
                    onEntryEdit(i, null, null, null, true); // pass delete flag
                  }
                }} title="Delete this revision"
                  style={{background:"#ffebee",border:"1px solid #ef9a9a",borderRadius:3,
                          padding:"1px 6px",cursor:"pointer",fontSize:11,color:"#c62828"}}>
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── New Revision Modal ─────────────────────────────────────────────── */}
      {showRevModal && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"white",borderRadius:12,padding:28,maxWidth:460,width:"90%",boxShadow:"0 8px 40px rgba(0,0,0,0.25)"}}>
            <div style={{fontWeight:700,fontSize:16,color:TEAL_DARK,marginBottom:4}}>
              Create New Revision
            </div>
            <div style={{fontSize:12,color:"#666",marginBottom:16,lineHeight:1.6}}>
              The SOP ID and revision log will update automatically.
            </div>

            {/* Revision letter */}
            <div style={{marginBottom:14}}>
              <label style={{fontSize:12,fontWeight:600,color:"#333",display:"block",marginBottom:4}}>
                New Revision Letter *
              </label>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:13,color:"#888"}}>Current: <strong style={{color:TEAL_DARK}}>{station.sopRev}</strong></span>
                <span style={{color:"#bbb"}}>→</span>
                <input value={pendingRev} onChange={e=>setPendingRev(e.target.value.toUpperCase().trim())}
                  placeholder={proposed} maxLength={4}
                  style={{width:72,padding:"6px 9px",border:`2px solid ${TEAL}`,borderRadius:5,fontSize:15,fontWeight:700,textAlign:"center",color:TEAL_DARK}}/>
                <span style={{fontSize:11,color:"#aaa"}}>(default: {proposed})</span>
              </div>
            </div>

            {/* Date + Revised By row */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
              <div>
                <label style={{fontSize:12,fontWeight:600,color:"#333",display:"block",marginBottom:4}}>
                  Revision Date *
                </label>
                <input type="date" value={revDate} onChange={e=>setRevDate(e.target.value)}
                  style={{width:"100%",padding:"7px 9px",border:"1px solid #ccc",borderRadius:5,fontSize:13}}/>
              </div>
              <div>
                <label style={{fontSize:12,fontWeight:600,color:"#333",display:"block",marginBottom:4}}>
                  Revised By
                </label>
                <input value={revBy} onChange={e=>setRevBy(e.target.value)}
                  placeholder="Name"
                  style={{width:"100%",padding:"7px 9px",border:"1px solid #ccc",borderRadius:5,fontSize:13,
                          background:revBy===station.revisedBy&&station.revisedBy?"#f0fdf4":"white"}}/>
                {station.revisedBy && revBy !== station.revisedBy && (
                  <button onClick={()=>setRevBy(station.revisedBy)}
                    style={{fontSize:10,color:TEAL,background:"none",border:"none",cursor:"pointer",padding:"2px 0",marginTop:2}}>
                    ↩ Use "{station.revisedBy}"
                  </button>
                )}
              </div>
            </div>

            {/* Description */}
            <div style={{marginBottom:16}}>
              <label style={{fontSize:12,fontWeight:600,color:"#333",display:"block",marginBottom:4}}>
                Revision Description *
              </label>
              <input value={revDesc} onChange={e=>setRevDesc(e.target.value)}
                placeholder={`Describe what changed in Rev ${pendingRev||proposed}…`}
                autoFocus
                onKeyDown={e=>e.key==="Enter"&&confirmRev()}
                style={{width:"100%",padding:"7px 9px",border:"1px solid #ccc",borderRadius:5,fontSize:13}}/>
            </div>

            <div style={{background:"#fff8e1",border:"1px solid #ffe082",borderRadius:6,padding:10,marginBottom:16,fontSize:12,color:"#7c4d00"}}>
              ⚠️ <strong>Remember:</strong> upload the updated SOP to Windchill after publishing this revision.
            </div>

            <div style={{display:"flex",gap:10}}>
              <button onClick={confirmRev}
                style={{flex:1,background:TEAL,color:"white",border:"none",borderRadius:7,padding:"10px 0",cursor:"pointer",fontSize:13,fontWeight:700}}>
                ✓ Confirm Rev {pendingRev||proposed}
              </button>
              <button onClick={()=>setShowRevModal(false)}
                style={{flex:1,background:"#f5f5f5",color:"#555",border:"1px solid #ddd",borderRadius:7,padding:"10px 0",cursor:"pointer",fontSize:13}}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Entry Modal ────────────────────────────────────────────────── */}
      {showEditModal && editIdx!==null && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"white",borderRadius:12,padding:28,maxWidth:480,width:"90%",boxShadow:"0 8px 40px rgba(0,0,0,0.25)"}}>
            <div style={{fontWeight:700,fontSize:16,color:TEAL_DARK,marginBottom:6}}>
              Edit Rev {entries[editIdx]?.rev}
            </div>
            <div style={{fontSize:12,color:"#666",marginBottom:12,lineHeight:1.6}}>
              Edit the date, description, or author for this revision entry.
            </div>
            {/* Date + Description + By */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
              <div>
                <label style={{fontSize:12,fontWeight:600,color:"#333",display:"block",marginBottom:4}}>Revision Date</label>
                <input type="date" value={editDate} onChange={e=>setEditDate(e.target.value)}
                  style={{width:"100%",padding:"7px 9px",border:"1px solid #ccc",borderRadius:5,fontSize:13}}/>
              </div>
              <div>
                <label style={{fontSize:12,fontWeight:600,color:"#333",display:"block",marginBottom:4}}>Revised By</label>
                <input value={editBy} onChange={e=>setEditBy(e.target.value)} placeholder="Name"
                  style={{width:"100%",padding:"7px 9px",border:"1px solid #ccc",borderRadius:5,fontSize:13}}/>
                {station.revisedBy && editBy !== station.revisedBy && (
                  <button onClick={()=>setEditBy(station.revisedBy)}
                    style={{fontSize:10,color:TEAL,background:"none",border:"none",cursor:"pointer",padding:"2px 0",marginTop:2}}>
                    ↩ Use "{station.revisedBy}"
                  </button>
                )}
              </div>
            </div>
            <div style={{marginBottom:12}}>
              <label style={{fontSize:12,fontWeight:600,color:"#333",display:"block",marginBottom:4}}>Description</label>
              <input value={editDesc} onChange={e=>setEditDesc(e.target.value)} autoFocus
                style={{width:"100%",padding:"7px 9px",border:"1px solid #ccc",borderRadius:5,fontSize:13}}/>
            </div>
            {/* Windchill reminder checkbox */}
            <div style={{background:"#fff8e1",border:"1px solid #ffe082",borderRadius:6,padding:10,marginBottom:16}}>
              <label style={{fontSize:12,color:"#7c4d00",display:"flex",alignItems:"flex-start",gap:8,cursor:"pointer"}}>
                <input type="checkbox" checked={editConfirmed} onChange={e=>setEditConfirmed(e.target.checked)}
                  style={{marginTop:2,flexShrink:0}}/>
                <span>I understand this changes the revision record. I will upload the updated SOP to <strong>Windchill</strong> after saving.</span>
              </label>
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>{ if(!editConfirmed){alert("Please confirm you will update Windchill before saving.");return;} confirmEdit(); }}
                style={{flex:1,background:TEAL,color:"white",border:"none",borderRadius:7,padding:"10px 0",cursor:"pointer",fontSize:13,fontWeight:700}}>
                ✓ Save Change
              </button>
              <button onClick={()=>setShowEditModal(false)}
                style={{flex:1,background:"#f5f5f5",color:"#555",border:"1px solid #ddd",borderRadius:7,padding:"10px 0",cursor:"pointer",fontSize:13}}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Work Instruction Task Editor ─────────────────────────────────────────────
function WiTaskEditor({ task, onUpdate, onDelete, confirmDelete }) {
  const u = (f,v) => onUpdate({...task,[f]:v});
  const imgRef = useRef();
  const [collapsed, setCollapsed] = useState(true);

  const addImage = (src) => u("wiImages",[...(task.wiImages||[]), mkWiImage(src)]);
  const updImage = (i,f,v) => { const imgs=[...(task.wiImages||[])]; imgs[i]={...imgs[i],[f]:v}; u("wiImages",imgs); };
  const delImage = (i) => u("wiImages",(task.wiImages||[]).filter((_,j)=>j!==i));
  const readImg  = (file) => { const r=new FileReader(); r.onload=e=>addImage(e.target.result); r.readAsDataURL(file); };

  const addField = (cols) => u("customFields",[...(task.customFields||[]), mkWiCustomField(cols)]);
  const updField = (i,f,v) => { const cf=[...(task.customFields||[])]; cf[i]={...cf[i],[f]:v}; u("customFields",cf); };
  const delField = (i) => u("customFields",(task.customFields||[]).filter((_,j)=>j!==i));

  return (
    <div style={{border:"1px solid #e0e0e0",borderRadius:8,marginBottom:8,background:"white"}}>
      {/* Header */}
      <div onClick={()=>setCollapsed(c=>!c)}
        style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",cursor:"pointer",
                background:collapsed?"#fafafa":"#e0f2f1",borderRadius:collapsed?"8px":"8px 8px 0 0",userSelect:"none"}}>
        <span style={{color:TEAL,fontSize:12}}>{collapsed?"▶":"▼"}</span>
        <span style={{fontWeight:700,fontSize:13,color:TEAL_DARK,flex:1}}>
          {task.description||"(untitled task)"}
          {task.partNo&&<span style={{fontSize:11,color:"#888",fontWeight:400,marginLeft:8}}>P/N: {task.partNo}</span>}
        </span>
        <button onClick={e=>{e.stopPropagation();onDelete();}}
          style={{background:"#ffebee",border:"1px solid #ef9a9a",borderRadius:4,padding:"2px 8px",cursor:"pointer",color:"#c62828",fontSize:11}}>✕</button>
      </div>

      {!collapsed && (
        <div style={{padding:16}}>

          {/* Title + Part + Cycle Time fields */}
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",gap:10,marginBottom:14}}>
            <div>
              <label style={{fontSize:11,color:"#555",display:"block",marginBottom:3,fontWeight:600}}>Task Title *</label>
              <input value={task.description||""} onChange={e=>u("description",e.target.value)}
                placeholder="e.g. 6 Inch Mast"
                style={{width:"100%",padding:"5px 8px",border:"1px solid #ccc",borderRadius:5,fontSize:12}}/>
            </div>
            <div>
              <label style={{fontSize:11,color:"#555",display:"block",marginBottom:3,fontWeight:600}}>Part No.</label>
              <input value={task.partNo||""} onChange={e=>u("partNo",e.target.value)}
                placeholder="e.g. 547781"
                style={{width:"100%",padding:"5px 8px",border:"1px solid #ccc",borderRadius:5,fontSize:12}}/>
            </div>
            <div>
              <label style={{fontSize:11,color:"#555",display:"block",marginBottom:3,fontWeight:600}}>Part Description</label>
              <input value={task.partDesc||""} onChange={e=>u("partDesc",e.target.value)}
                placeholder="e.g. Battery Box Panel"
                style={{width:"100%",padding:"5px 8px",border:"1px solid #ccc",borderRadius:5,fontSize:12}}/>
            </div>
            <div>
              <label style={{fontSize:11,color:"#555",display:"block",marginBottom:3,fontWeight:600}}>⏱ Cycle Time</label>
              <input value={task.cycleTime||""} onChange={e=>u("cycleTime",e.target.value)}
                placeholder="secs or MM:SS"
                style={{width:"100%",padding:"5px 8px",border:"1px solid #ccc",borderRadius:5,fontSize:12,
                        color:task.cycleTime?TEAL_DARK:"#aaa"}}/>
              {task.cycleTime && (
                <div style={{fontSize:10,color:TEAL_DARK,marginTop:2,fontWeight:600}}>
                  {fmtTime(parseTime(task.cycleTime))}
                </div>
              )}
            </div>
          </div>

          {/* Images */}
          <div style={{marginBottom:14}}>
            <label style={{fontSize:11,color:"#555",display:"block",marginBottom:6,fontWeight:600}}>
              📷 Images
              <span style={{fontWeight:400,color:"#aaa",marginLeft:6}}>Full = one per row · Half = two per row · Third = three per row</span>
            </label>
            {(task.wiImages||[]).map((img,i)=>(
              <div key={img.id} style={{border:"1px solid #e0e0e0",borderRadius:7,padding:10,marginBottom:8,background:"#fafafa"}}>
                <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                  <div style={{position:"relative",flexShrink:0}}>
                    <img src={img.src} alt="" style={{width:100,height:75,objectFit:"cover",borderRadius:5,border:"1px solid #ddd",display:"block"}}/>
                    <button onClick={()=>delImage(i)}
                      style={{position:"absolute",top:-7,right:-7,background:"#e53935",color:"white",border:"none",
                              borderRadius:"50%",width:20,height:20,cursor:"pointer",fontSize:11,lineHeight:"20px",textAlign:"center",padding:0}}>✕</button>
                    <div style={{position:"absolute",bottom:0,left:0,background:"rgba(0,105,92,0.85)",color:"white",
                                 fontSize:9,fontWeight:700,padding:"2px 5px",borderRadius:"0 0 0 5px"}}>Fig. {i+1}</div>
                  </div>
                  <div style={{flex:1,display:"flex",flexDirection:"column",gap:6}}>
                    <input value={img.caption||""} onChange={e=>updImage(i,"caption",e.target.value)}
                      placeholder={`Figure ${i+1} caption (optional)`}
                      style={{width:"100%",padding:"4px 8px",border:"1px solid #ccc",borderRadius:5,fontSize:12}}/>
                    <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
                      {/* Size */}
                      <div style={{display:"flex",alignItems:"center",gap:4,fontSize:11}}>
                        <span style={{color:"#555",fontWeight:600}}>Size:</span>
                        {[["full","Full"],["half","Half"],["third","Third"]].map(([val,lbl])=>(
                          <label key={val} style={{display:"flex",alignItems:"center",gap:3,cursor:"pointer",
                                                   padding:"2px 8px",borderRadius:4,fontSize:11,
                                                   background:img.size===val?TEAL_LIGHT:"white",
                                                   border:`1px solid ${img.size===val?TEAL:"#ddd"}`}}>
                            <input type="radio" name={`sz_${img.id}`} value={val}
                              checked={img.size===val} onChange={()=>updImage(i,"size",val)}
                              style={{accentColor:TEAL,margin:0}}/>
                            {lbl}
                          </label>
                        ))}
                      </div>
                      {/* Align — only for full width */}
                      {img.size==="full" && (
                        <div style={{display:"flex",alignItems:"center",gap:4,fontSize:11}}>
                          <span style={{color:"#555",fontWeight:600}}>Align:</span>
                          {[["left","◀ Left"],["center","■ Center"],["right","▶ Right"]].map(([val,lbl])=>(
                            <label key={val} style={{display:"flex",alignItems:"center",gap:3,cursor:"pointer",
                                                     padding:"2px 8px",borderRadius:4,fontSize:11,
                                                     background:img.align===val?TEAL_LIGHT:"white",
                                                     border:`1px solid ${img.align===val?TEAL:"#ddd"}`}}>
                              <input type="radio" name={`al_${img.id}`} value={val}
                                checked={(img.align||"center")===val} onChange={()=>updImage(i,"align",val)}
                                style={{accentColor:TEAL,margin:0}}/>
                              {lbl}
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <button onClick={()=>imgRef.current.click()}
              style={{width:"100%",padding:"8px",border:"2px dashed #ccc",borderRadius:6,
                      cursor:"pointer",background:"#fafafa",fontSize:12,color:"#888"}}>
              + Add Image
            </button>
            <input ref={imgRef} type="file" accept="image/*" style={{display:"none"}}
              onChange={e=>{if(e.target.files[0])readImg(e.target.files[0]);e.target.value="";}}/>
          </div>

          {/* Work Instructions */}
          <div style={{marginBottom:14}}>
            <label style={{fontSize:11,color:"#555",display:"block",marginBottom:4,fontWeight:600}}>Work Instructions / Notes</label>
            <AutoTextarea value={task.workInstructions||""} onChange={e=>u("workInstructions",e.target.value)}
              placeholder="Enter work instructions, quality notes, paint instructions…" minRows={3}/>
          </div>

          {/* Custom fields */}
          {(task.customFields||[]).length>0 && (
            <div style={{marginBottom:10}}>
              <label style={{fontSize:11,color:"#555",display:"block",marginBottom:6,fontWeight:600}}>Custom Sections</label>
              {(task.customFields||[]).map((cf,i)=>(
                <div key={cf.id} style={{border:"1px solid #e0e0e0",borderRadius:6,marginBottom:8,overflow:"hidden"}}>
                  {/* field header row */}
                  <div style={{display:"flex",alignItems:"center",gap:6,padding:"5px 8px",background:"#f5f5f5",borderBottom:"1px solid #e0e0e0"}}>
                    <span style={{fontSize:10,color:"#888",fontWeight:600}}>COLUMNS:</span>
                    {[1,2].map(c=>(
                      <label key={c} style={{display:"flex",alignItems:"center",gap:3,cursor:"pointer",fontSize:11,
                                             padding:"2px 8px",borderRadius:4,
                                             background:cf.cols===c?TEAL_LIGHT:"white",
                                             border:`1px solid ${cf.cols===c?TEAL:"#ddd"}`}}>
                        <input type="radio" name={`cols_${cf.id}`} value={c}
                          checked={cf.cols===c} onChange={()=>updField(i,"cols",c)}
                          style={{accentColor:TEAL,margin:0}}/>
                        {c===1?"1 — Full width":"2 — Side by side"}
                      </label>
                    ))}
                    <button onClick={()=>delField(i)}
                      style={{marginLeft:"auto",background:"#ffebee",border:"1px solid #ef9a9a",borderRadius:4,
                              padding:"2px 7px",cursor:"pointer",color:"#c62828",fontSize:11}}>✕</button>
                  </div>
                  {/* field content */}
                  {cf.cols===1 ? (
                    <div style={{padding:8,display:"flex",flexDirection:"column",gap:5}}>
                      <input value={cf.label||""} onChange={e=>updField(i,"label",e.target.value)}
                        placeholder="Section heading"
                        style={{padding:"4px 8px",border:"1px solid #ccc",borderRadius:5,fontSize:12,fontWeight:600}}/>
                      <AutoTextarea value={cf.value||""} onChange={e=>updField(i,"value",e.target.value)}
                        placeholder="Content…" minRows={2}/>
                    </div>
                  ) : (
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:0}}>
                      {[[cf.label,cf.value,"label","value"],[cf.label2,cf.value2,"label2","value2"]].map(([lbl,val,lk,vk],ci)=>(
                        <div key={ci} style={{padding:8,borderRight:ci===0?"1px solid #e0e0e0":"none",display:"flex",flexDirection:"column",gap:5}}>
                          <input value={lbl||""} onChange={e=>updField(i,lk,e.target.value)}
                            placeholder={`Column ${ci+1} heading`}
                            style={{padding:"4px 8px",border:"1px solid #ccc",borderRadius:5,fontSize:12,fontWeight:600}}/>
                          <AutoTextarea value={val||""} onChange={e=>updField(i,vk,e.target.value)}
                            placeholder="Content…" minRows={2}/>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          <div style={{display:"flex",gap:6}}>
            <button onClick={()=>addField(1)}
              style={{fontSize:11,padding:"5px 12px",background:"#f5f5f5",border:"1px solid #ddd",borderRadius:5,cursor:"pointer",color:"#555"}}>
              + 1-Column Section
            </button>
            <button onClick={()=>addField(2)}
              style={{fontSize:11,padding:"5px 12px",background:"#f5f5f5",border:"1px solid #ddd",borderRadius:5,cursor:"pointer",color:"#555"}}>
              + 2-Column Section
            </button>
          </div>

        </div>
      )}
    </div>
  );
}

function StationEditor({ station, isActive, onSelect, onUpdate, onDelete, onPreview, allStations, lineName="", stationIdentifier="", stationHandle=null, onStationHandle=null, confirmDelete=null }) {
  const u=(f,v)=>{
    const upd={...station,[f]:v};
    if(["stationNo","asmVersion","sopRev"].includes(f)){
      upd.sopId=genSopId(upd.stationNo,upd.asmVersion,upd.sopRev);
      upd.tasks=upd.tasks.map(t=>({...t,taskId:genTaskId(upd.sopId,t.taskNo)}));
    }
    onUpdate(upd);
  };
  const updDrawing=(i,f,v)=>{ const d=[...station.drawings]; d[i]={...d[i],[f]:v}; u("drawings",d); };

  const addTask=()=>{
    const no=station.tasks.length+1;
    u("tasks",[...station.tasks, mkTask(station.sopId,no)]);
  };

  // Task update — also handles step moves arriving from TaskEditor
  const updTask=(i,t,extra)=>{
    let tasks=[...station.tasks]; tasks[i]=t;
    if(extra?.moveStep){
      // step moved out — append to target task in target station (handled in App via callback)
      onUpdate({...station,tasks:reindex(tasks,station.sopId)}, extra);
    } else {
      onUpdate({...station,tasks:reindex(tasks,station.sopId)});
    }
  };
  const delTask=(i)=>onUpdate({...station,tasks:reindex(station.tasks.filter((_,j)=>j!==i),station.sopId)});

  // Move entire task to another station
  const moveTask=(taskIdx,targetStationId)=>{
    const task=station.tasks[taskIdx];
    const remaining=reindex(station.tasks.filter((_,i)=>i!==taskIdx),station.sopId);
    onUpdate({...station,tasks:remaining},{moveTask:task,targetStationId});
  };

  // Drag reorder tasks
  const taskDrag=useDragList(station.tasks,(reordered)=>onUpdate({...station,tasks:reindex(reordered,station.sopId)}));

  const total=sumTasks(station.tasks);

  return (
    <div style={{border:isActive?`2px solid ${TEAL}`:"1px solid #ddd",borderRadius:10,marginBottom:10,overflow:"visible",background:"white",boxShadow:isActive?"0 2px 12px rgba(0,137,123,0.12)":"0 1px 3px rgba(0,0,0,0.06)"}}>
      {/* Station bar */}
      <div onClick={onSelect} style={{background:isActive?TEAL:"#f5f5f5",color:isActive?"white":"#333",padding:"10px 14px",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",userSelect:"none",borderRadius:isActive?"8px 8px 0 0":"8px"}}>
        <div style={{display:"flex",gap:10,alignItems:"center",minWidth:0}}>
          <span style={{fontWeight:700,fontSize:14,whiteSpace:"nowrap"}}>{station.stationNo||"New Station"}</span>
          {station.stationType==="wi" && <span style={{fontSize:10,background:"#fff3e0",color:"#e65100",border:"1px solid #ffb74d",borderRadius:4,padding:"1px 6px",fontWeight:700,flexShrink:0}}>WI</span>}
          {station.stationDesc&&<span style={{fontSize:12,opacity:0.85}}>— {station.stationDesc}</span>}
          {station.sopId&&<span style={{fontFamily:"monospace",fontSize:11,opacity:0.75}}>{station.sopId}</span>}
          <span style={{fontSize:11,opacity:0.8}}>⏱ {fmtTime(total)} | {station.tasks.length} task(s)</span>
        </div>
        <div style={{display:"flex",gap:6,flexShrink:0}}>
          <button onClick={e=>{e.stopPropagation();onPreview();}} style={{background:"rgba(255,255,255,0.2)",border:"1px solid rgba(255,255,255,0.5)",borderRadius:4,padding:"3px 10px",cursor:"pointer",fontSize:12,color:isActive?"white":"#333"}}>👁 Preview</button>
          <button onClick={e=>{e.stopPropagation();exportPDF({...station,lineName});}} style={{background:"rgba(255,255,255,0.2)",border:"1px solid rgba(255,255,255,0.5)",borderRadius:4,padding:"3px 10px",cursor:"pointer",fontSize:12,color:isActive?"white":"#333"}}>📄 PDF</button>

          <button onClick={e=>{e.stopPropagation();onDelete();}} style={{background:"rgba(200,0,0,0.12)",border:"1px solid rgba(200,0,0,0.25)",borderRadius:4,padding:"3px 8px",cursor:"pointer",color:"#c62828",fontSize:12}}>✕</button>
        </div>
      </div>

      {isActive && (
        <div style={{padding:16}}>
          {/* Station Type Toggle */}
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12,padding:"8px 12px",
                       background:"#fafafa",borderRadius:7,border:"1px solid #e0e0e0"}}>
            <span style={{fontSize:12,fontWeight:600,color:"#555",flexShrink:0}}>Station Format:</span>
            {[{val:"standard",label:"📋 Standard SOP",desc:"Tasks & Steps"},
              {val:"wi",      label:"📄 Work Instruction",desc:"Image + Instructions"}
            ].map(opt=>(
              <label key={opt.val} style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",
                                          padding:"5px 12px",borderRadius:6,
                                          background:station.stationType===opt.val?TEAL_LIGHT:"white",
                                          border:`1px solid ${station.stationType===opt.val?TEAL:"#ddd"}`,
                                          fontSize:12}}>
                <input type="radio" name={`stype_${station.id}`} value={opt.val}
                  checked={station.stationType===opt.val}
                  onChange={()=>onUpdate({...station,stationType:opt.val})}
                  style={{accentColor:TEAL}}/>
                <span style={{fontWeight:600,color:station.stationType===opt.val?TEAL_DARK:"#444"}}>{opt.label}</span>
                <span style={{color:"#999",fontSize:10}}>{opt.desc}</span>
              </label>
            ))}
            {/* Layout selector — only for WI */}
            {station.stationType==="wi" && (
              <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:6,fontSize:12}}>
                <span style={{color:"#555",fontWeight:600}}>PDF Layout:</span>
                <select value={station.wiLayout||"stacked"}
                  onChange={e=>onUpdate({...station,wiLayout:e.target.value})}
                  style={{padding:"3px 7px",border:"1px solid #ccc",borderRadius:5,fontSize:12,background:"white"}}>
                  <option value="stacked">Stacked Sections</option>
                  <option value="single">Single Page</option>
                  <option value="twocol">Two Column</option>
                </select>
              </div>
            )}
          </div>
          {/* Station fields */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8,marginBottom:8}}>
            {/* Station No — editable, defaults from line identifier */}
            <div>
              <label style={{fontSize:11,color:"#555",display:"block",marginBottom:2}}>
                Station No. *
                {stationIdentifier && <span style={{fontSize:10,color:"#888",marginLeft:4}}>default: {station.stationNo||stationIdentifier+"-??"}</span>}
              </label>
              <input value={station.stationNo||""}
                onChange={e=>{
                  const val=e.target.value;
                  const newSopId=genSopId(val,station.asmVersion,station.sopRev);
                  const tasks=station.tasks.map(t=>({...t,taskId:genTaskId(newSopId,t.taskNo)}));
                  onUpdate({...station,stationNo:val,sopId:newSopId,tasks});
                }}
                placeholder={stationIdentifier||(station.stationNo||"REF-WIP-02")}
                style={{width:"100%",padding:"5px 7px",border:"1px solid #ccc",borderRadius:4,fontSize:12}}/>
            </div>
            {[{l:"Station Description",f:"stationDesc",ph:"BATTERY"},
              {l:"ASM Version",f:"asmVersion",ph:"2"},{l:"Revised By",f:"revisedBy",ph:"Name"}
            ].map(({l,f,ph})=>(
              <div key={f}>
                <label style={{fontSize:11,color:"#555",display:"block",marginBottom:2}}>{l}</label>
                <input value={station[f]||""} onChange={e=>u(f,e.target.value)} placeholder={ph}
                  style={{width:"100%",padding:"5px 7px",border:"1px solid #ccc",borderRadius:4,fontSize:12}}/>
              </div>
            ))}
            {/* SOP Revision — triggers confirmation dialog on change */}
            <div>
              <label style={{fontSize:11,color:"#555",display:"block",marginBottom:2}}>SOP Revision</label>
              <input value={station.sopRev||""} readOnly
                style={{width:"100%",padding:"5px 7px",border:"1px solid #ccc",borderRadius:4,fontSize:12,background:"#f5f5f5",cursor:"not-allowed",fontWeight:700,color:TEAL_DARK}}/>
            </div>
          </div>
          <div style={{marginBottom:10}}>
            <label style={{fontSize:11,color:"#555",display:"block",marginBottom:2}}>Generated SOP ID</label>
            <input value={station.sopId} readOnly style={{width:"100%",padding:"5px 7px",border:"1px solid #ccc",borderRadius:4,fontSize:13,background:"#f5f5f5",fontFamily:"monospace",fontWeight:700,color:TEAL_DARK}}/>
          </div>
          {[{l:"Purpose",f:"purpose",rows:2},{l:"Safety Summary",f:"safety",rows:3},
            {l:"General Notes",f:"generalNotes",rows:2}
          ].map(({l,f,rows})=>(
            <div key={f} style={{marginBottom:8}}>
              <label style={{fontSize:11,color:"#555",display:"block",marginBottom:2}}>{l}</label>
              <AutoTextarea value={station[f]||""} onChange={e=>u(f,e.target.value)} minRows={rows}/>
            </div>
          ))}
          {/* Tools & Equipment list */}
          <ToolListEditor
            toolList={station.toolList||[]}
            onChange={list=>{
              const toolStr=list.filter(t=>t.name).map(t=>t.partNo?`${t.name} (${t.partNo})`:t.name).join(", ");
              onUpdate({...station, toolList:list, tools:toolStr});
            }}
          />
          {/* Revision Log */}
          <RevisionLogPanel
            station={station}
            onUpdate={onUpdate}
            onRevChange={(newRev, desc, date, by)=>{
              const entry={rev:newRev, date:date||new Date().toLocaleDateString(), description:desc, by:by||station.revisedBy||""};
              const entries=[...(station.revisionEntries||[]), entry];
              const logText=entries.map(e=>`${e.rev} - ${e.description} (${e.date}${e.by?" | "+e.by:""})`).join("\n");
              const upd={...station, sopRev:newRev, revisionEntries:entries, revisionLog:logText};
              upd.sopId=genSopId(upd.stationNo,upd.asmVersion,upd.sopRev);
              upd.tasks=upd.tasks.map(t=>({...t,taskId:genTaskId(upd.sopId,t.taskNo)}));
              onUpdate(upd);
            }}
            onEntryEdit={(idx, desc, by, dateISO, isDelete)=>{
              const entries=[...(station.revisionEntries||[])];
              if(isDelete) {
                entries.splice(idx, 1);
              } else {
                const localeDate = dateISO
                  ? new Date(dateISO+"T00:00:00").toLocaleDateString()
                  : entries[idx].date;
                entries[idx]={
                  ...entries[idx],
                  description: desc !== null ? desc : entries[idx].description,
                  by: by !== undefined && by !== null ? by : entries[idx].by,
                  date: localeDate,
                };
              }
              const logText=entries.map(e=>`${e.rev} - ${e.description} (${e.date}${e.by?" | "+e.by:""})`).join("\n");
              onUpdate({...station, revisionEntries:entries, revisionLog:logText});
            }}
          />
          {/* Drawings */}
          <div style={{marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
              <label style={{fontSize:11,color:"#555",fontWeight:600}}>Applicable Drawings</label>
              <button onClick={()=>u("drawings",[...station.drawings,{drawingNo:"",description:""}])} style={{fontSize:11,padding:"2px 8px",background:"#e8f5e9",border:"1px solid #a5d6a7",borderRadius:4,cursor:"pointer"}}>+ Row</button>
            </div>
            {station.drawings.map((d,i)=>(
              <div key={i} style={{display:"flex",gap:6,marginBottom:4}}>
                <input value={d.drawingNo} onChange={e=>updDrawing(i,"drawingNo",e.target.value)} placeholder="Drawing #" style={{width:110,padding:"4px 6px",border:"1px solid #ccc",borderRadius:4,fontSize:12}}/>
                <input value={d.description} onChange={e=>updDrawing(i,"description",e.target.value)} placeholder="Description" style={{flex:1,padding:"4px 6px",border:"1px solid #ccc",borderRadius:4,fontSize:12}}/>
                <button onClick={()=>u("drawings",station.drawings.filter((_,j)=>j!==i))} style={{background:"#ffebee",border:"1px solid #ef9a9a",borderRadius:4,padding:"2px 6px",cursor:"pointer",fontSize:11}}>✕</button>
              </div>
            ))}
          </div>
          {/* Images */}
          <div style={{marginBottom:14,display:"flex",gap:8,alignItems:"flex-start",flexWrap:"wrap"}}>
            <ImgUpload label="📎 Station Image" onImage={src=>u("stationImages",[...(station.stationImages||[]),src])}/>
            <ImgList images={station.stationImages} onRemove={i=>u("stationImages",station.stationImages.filter((_,j)=>j!==i))}/>
          </div>

          {/* Tasks */}
          <div style={{borderTop:`2px solid ${TEAL_LIGHT}`,paddingTop:12}}>
            <div style={{fontWeight:700,fontSize:14,color:TEAL_DARK,marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span>
                {station.stationType==="wi" ? "Work Instructions" : "Tasks"} ({station.tasks.length})
                {station.stationType!=="wi" && <span style={{fontSize:12,color:"#888",fontWeight:400}}> Total: {fmtTime(total)}</span>}
                {station.stationType!=="wi" && <span style={{fontSize:11,color:"#aaa",fontWeight:400,marginLeft:8}}>⠿ drag to reorder</span>}
              </span>
            </div>

            {station.stationType==="wi" ? (
              /* ── Work Instruction Tasks ── */
              <div>
                {/* Station total — auto-summed from task cycle times */}
                {(()=>{
                  const totalSecs = station.tasks.reduce((s,t)=>s+parseTime(t.cycleTime||"0"),0);
                  const timedCount = station.tasks.filter(t=>t.cycleTime).length;
                  return (
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12,padding:"8px 12px",
                                 background:"#fff8e1",borderRadius:6,border:"1px solid #ffe082"}}>
                      <span style={{fontSize:12,fontWeight:600,color:"#555"}}>⏱ Total Station Cycle Time:</span>
                      <span style={{fontSize:14,fontWeight:700,color:totalSecs>0?TEAL_DARK:"#aaa"}}>
                        {totalSecs>0 ? fmtTime(totalSecs) : "—"}
                      </span>
                      <span style={{fontSize:11,color:"#aaa",fontStyle:"italic"}}>
                        {timedCount>0
                          ? `${timedCount} of ${station.tasks.length} task(s) timed`
                          : "Add cycle times to each task below"}
                      </span>
                    </div>
                  );
                })()}
                {station.tasks.map((task,i)=>(
                  <WiTaskEditor key={task.id} task={task}
                    onUpdate={t=>updTask(i,t)}
                    onDelete={()=>{ if(confirmDelete) confirmDelete("task",task.description||"this task",{stationId:station.id,taskIdx:i}); else delTask(i); }}
                    confirmDelete={confirmDelete}/>
                ))}
                <button onClick={()=>u("tasks",[...station.tasks, mkWiTask(station.sopId, station.tasks.length+1)])}
                  style={{background:TEAL_LIGHT,border:`2px dashed ${TEAL}`,borderRadius:8,padding:"10px 18px",
                          cursor:"pointer",fontSize:13,width:"100%",color:TEAL_DARK,fontWeight:600,marginTop:6}}>
                  + Add Task
                </button>
              </div>
            ) : (
              /* ── Standard Tasks ── */
              <div>
                {station.tasks.map((task,i)=>(
                  <TaskEditor key={task.id} task={task}
                    dragProps={taskDrag(i)}
                    onUpdate={(t,extra)=>updTask(i,t,extra)}
                    onDelete={()=>{ if(confirmDelete){ confirmDelete("task",task.description||"this task",{stationId:station.id,taskIdx:i}); } else delTask(i); }}
                    allStations={allStations}
                    thisStationId={station.id}
                    onMoveTask={(targetId)=>moveTask(i,targetId)}
                    stationToolList={station.toolList||[]}
                    stationDrawings={station.drawings||[]}
                    confirmDelete={confirmDelete}
                  />
                ))}
                <button onClick={addTask} style={{background:TEAL_LIGHT,border:`2px dashed ${TEAL}`,borderRadius:8,padding:"10px 18px",cursor:"pointer",fontSize:13,width:"100%",color:TEAL_DARK,fontWeight:600,marginTop:6}}>
                  + Add Task
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Line Balance ─────────────────────────────────────────────────────────────
function LineBalance({ stations, lines }) {
  const [scope,        setScope]       = useState("all");
  const [selLineId,    setSelLineId]   = useState(String(lines[0]?.id || ""));
  const [selStationId, setSelStationId]= useState(String(stations[0]?.id || ""));
  const [taktRaw,      setTaktRaw]     = useState(""); // user input — seconds or MM:SS

  // Parse TAKT time using same logic as cycle times
  const taktMin = taktRaw.trim() ? parseTime(taktRaw) : null;

  // Always compare as strings to avoid number/string type mismatch from select values
  const validLineId    = lines.find(l=>String(l.id)===String(selLineId))    ? selLineId    : String(lines[0]?.id||"");
  const validStationId = stations.find(s=>String(s.id)===String(selStationId)) ? selStationId : String(stations[0]?.id||"");

  // ── Determine which stations to analyse ──────────────────────────────────
  const scopedStations = (() => {
    if(scope === "line") {
      const line = lines.find(l=>String(l.id)===String(validLineId));
      if(!line) return [];
      return line.stationIds.map(id=>stations.find(s=>s.id===id)).filter(Boolean);
    }
    if(scope === "station") {
      const s = stations.find(s=>String(s.id)===validStationId);
      return s ? [s] : [];
    }
    return stations;
  })();

  const isSingleStation = scope === "station" && scopedStations.length === 1;
  const singleStation   = isSingleStation ? scopedStations[0] : null;

  const data = isSingleStation
    ? singleStation.tasks.map(t=>({
        id:t.id, name:`Task ${t.taskNo}: ${t.description||"(untitled)"}`,
        sopId:t.taskId, total:sumSteps(t.steps),
        tasks:1, steps:t.steps.length,
      }))
    : scopedStations.map(s=>({
        id:s.id, name:s.stationNo||s.sopId||"Station",
        sopId:s.sopId, total: s.stationType==="wi"
          ? s.tasks.reduce((acc,t)=>acc+parseTime(t.cycleTime||"0"),0)
          : sumTasks(s.tasks),
        tasks:s.tasks.length, steps:s.stationType==="wi" ? 0 : s.tasks.reduce((n,t)=>n+t.steps.length,0),
      }));

  const max    = Math.max(...data.map(d=>d.total), taktMin||0, 0.01);
  const avg    = data.length ? data.reduce((s,d)=>s+d.total,0)/data.length : 0;
  // Reference line for chart — TAKT if set, otherwise avg
  const refLine = taktMin || avg;

  const scopeLabel = scope==="line"
    ? (lines.find(l=>l.id===validLineId)?.name || "Line")
    : scope==="station"
      ? (stations.find(s=>String(s.id)===validStationId)?.stationNo || "Station")
      : "All Stations";

  const [aiAnalysis,   setAiAnalysis]   = useState("");

  const openInClaude = () => {
    const stationRows = data.map(d => {
      const vsRef = taktMin
        ? `${d.total > taktMin ? "+" : ""}${fmtTime(d.total - taktMin)} vs TAKT`
        : `${d.total > avg ? "+" : ""}${fmtTime(d.total - avg)} vs avg`;
      return `| ${d.sopId||d.name} | ${d.name} | ${fmtTime(d.total)} | ${vsRef} | ${d.tasks} tasks / ${d.steps} steps |`;
    }).join("\n");

    const prompt = `You are a lean manufacturing engineer at Live View Technologies analyzing a production line balance for trailer assembly.

## Line Balance Data

**Line:** ${scopeLabel}
**TAKT Time:** ${taktMin ? fmtTime(taktMin) : "not set"}
**Average Cycle Time:** ${fmtTime(avg)}
**Number of ${isSingleStation?"Tasks":"Stations"}:** ${data.length}
**Total Cycle Time:** ${fmtTime(data.reduce((s,d)=>s+d.total,0))}

| SOP ID | ${isSingleStation?"Task":"Station"} | Cycle Time | vs ${taktMin?"TAKT":"Avg"} | Content |
|--------|---------|------------|---------|---------|
${stationRows}

## Please Analyze:

1. **Balance Assessment** — How well balanced is this line? What is the line efficiency (total CT / stations / TAKT)?
2. **Bottlenecks** — Which ${isSingleStation?"tasks":"stations"} exceed TAKT or are significantly overloaded?
3. **Underloaded** — Which ${isSingleStation?"tasks":"stations"} have significant spare capacity that could absorb work?
4. **Rebalancing Recommendations** — Specific suggestions for redistributing work between ${isSingleStation?"tasks":"stations"} to bring all cycle times closer to TAKT.
5. **Priority Actions** — What are the top 3 things to address first?

Be specific and practical. Reference the actual station/task names from the data above.`;

    // Copy to clipboard and open Claude
    navigator.clipboard.writeText(prompt).then(() => {
      setAiAnalysis("✓ Analysis prompt copied to clipboard! Opening Claude in a new tab — paste the prompt to begin analysis.");
    }).catch(() => {
      setAiAnalysis("Opening Claude in a new tab. Copy the prompt below and paste it into Claude:\n\n" + prompt);
    });
    window.open("https://claude.ai/new", "_blank", "noopener");
  };

  if(!stations.length) return (
    <div style={{textAlign:"center",padding:80,color:"#bbb"}}>
      <div style={{fontSize:48}}>📊</div>
      <div style={{marginTop:10,fontSize:15}}>Add stations with step cycle times to see the line balance.</div>
    </div>
  );

  return (
    <div>
      {/* ── Scope + TAKT bar ── */}
      <div style={{background:"#f9f9f9",border:"1px solid #e0e0e0",borderRadius:8,padding:"10px 16px",
                   marginBottom:16,display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>

        <span style={{fontWeight:600,fontSize:12,color:"#555",flexShrink:0}}>Analyse:</span>

        {/* All */}
        <label style={{display:"flex",alignItems:"center",gap:5,cursor:"pointer",fontSize:12,flexShrink:0}}>
          <input type="radio" name="lbscope" checked={scope==="all"} onChange={()=>setScope("all")} style={{accentColor:TEAL}}/>
          All Stations
        </label>

        {/* Line — use string IDs throughout to avoid type mismatch */}
        {lines.length > 0 && (
          <div style={{display:"flex",alignItems:"center",gap:5,fontSize:12}}>
            <label style={{display:"flex",alignItems:"center",gap:5,cursor:"pointer"}}>
              <input type="radio" name="lbscope" checked={scope==="line"} onChange={()=>setScope("line")} style={{accentColor:TEAL}}/>
              Line:
            </label>
            <select
              value={validLineId}
              onChange={e=>{
                setSelLineId(e.target.value);
                setScope("line");
              }}
              style={{padding:"2px 6px",border:"1px solid #ccc",borderRadius:4,fontSize:12,background:"white",maxWidth:180}}>
              {lines.map(l=>(
                <option key={l.id} value={l.id}>{l.name||"(unnamed)"} ({l.stationIds.filter(id=>stations.find(s=>s.id===id)).length})</option>
              ))}
            </select>
          </div>
        )}

        {/* Station */}
        {stations.length > 0 && (
          <div style={{display:"flex",alignItems:"center",gap:5,fontSize:12}}>
            <label style={{display:"flex",alignItems:"center",gap:5,cursor:"pointer"}}>
              <input type="radio" name="lbscope" checked={scope==="station"} onChange={()=>setScope("station")} style={{accentColor:TEAL}}/>
              Station:
            </label>
            <select
              value={validStationId}
              onChange={e=>{ setSelStationId(e.target.value); setScope("station"); }}
              style={{padding:"2px 6px",border:"1px solid #ccc",borderRadius:4,fontSize:12,background:"white",maxWidth:200}}>
              {stations.map(s=>(
                <option key={String(s.id)} value={String(s.id)}>
                  {s.stationNo||s.sopId||"Station"}{s.stationDesc?" — "+s.stationDesc:""}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Divider */}
        <div style={{width:1,height:22,background:"#ddd",flexShrink:0,margin:"0 2px"}}/>

        {/* TAKT */}
        <div style={{display:"flex",alignItems:"center",gap:6,fontSize:12,flexShrink:0}}>
          <span style={{fontWeight:700,color:"#c62828",fontSize:12}}>⏱ TAKT:</span>
          <input
            value={taktRaw}
            onChange={e=>setTaktRaw(e.target.value)}
            placeholder="MM:SS or secs"
            title="Enter TAKT time as MM:SS (e.g. 1:30) or plain seconds (e.g. 90)"
            style={{width:90,padding:"3px 7px",
                    border:`2px solid ${taktMin?"#c62828":"#ccc"}`,
                    borderRadius:5,fontSize:12,
                    color:taktMin?"#c62828":"#444",
                    fontWeight:taktMin?700:400}}
          />
          {taktMin && (
            <button onClick={()=>setTaktRaw("")} title="Clear TAKT"
              style={{background:"none",border:"none",color:"#bbb",cursor:"pointer",
                      fontSize:13,padding:"0 2px",lineHeight:1}}>✕</button>
          )}
        </div>
      </div>

      {/* ── Header ── */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:8}}>
        <div>
          <h3 style={{margin:0,color:TEAL_DARK}}>
            Line Balance — {scopeLabel}
            {isSingleStation && <span style={{fontSize:12,fontWeight:400,color:"#888",marginLeft:8}}>(task breakdown)</span>}
          </h3>
          <span style={{fontSize:12,color:"#888"}}>
            Avg: {fmtTime(avg)}
            {taktMin && <span style={{marginLeft:10,color:"#c62828",fontWeight:600}}>TAKT: {fmtTime(taktMin)}</span>}
            {data.length > 0 && <span style={{marginLeft:10}}>{data.length} {isSingleStation?"task(s)":"station(s)"}</span>}
          </span>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <button onClick={openInClaude}
            style={{background:"linear-gradient(135deg,#5c35c9,#8b5cf6)",color:"white",border:"none",
                    borderRadius:6,padding:"6px 14px",cursor:"pointer",fontSize:12,fontWeight:700,
                    display:"flex",alignItems:"center",gap:5,
                    boxShadow:"0 2px 6px rgba(92,53,201,0.25)"}}>
            ✨ AI Analysis
          </button>
          <button onClick={()=>exportCSV(scopedStations)}
            style={{background:"#e8f5e9",border:"1px solid #a5d6a7",borderRadius:6,padding:"6px 14px",cursor:"pointer",fontSize:12}}>
            ⬇️ Export CSV
          </button>
        </div>
      </div>

      {data.length === 0 ? (
        <div style={{textAlign:"center",padding:40,color:"#bbb",background:"#f9f9f9",borderRadius:8}}>
          No data for this selection.
        </div>
      ) : (<>
        {/* ── Bar chart ── */}
        <div style={{display:"flex",alignItems:"flex-end",gap:6,padding:"16px 8px 8px",
                     background:"#f9fbe7",borderRadius:8,overflowX:"auto",marginBottom:16,minHeight:200,position:"relative"}}>
          {data.map(d=>{
            const pct     = (d.total/max)*100;
            const refPct  = (refLine/max)*100;
            const avgPct  = (avg/max)*100;
            const overTakt= taktMin && d.total > taktMin;
            const overAvg = !taktMin && d.total > avg*1.1;
            const hot     = overTakt || overAvg;
            const label   = isSingleStation
              ? `Task ${d.sopId?.split("-").pop()||""}`
              : d.name;
            return (
              <div key={d.id} style={{flex:"0 0 auto",width:isSingleStation?90:70,display:"flex",flexDirection:"column",alignItems:"center",position:"relative"}}>
                <span style={{fontSize:10,fontWeight:700,color:hot?"#c62828":"#2e7d32",marginBottom:3}}>{fmtTime(d.total)}</span>
                <div style={{width:isSingleStation?70:52,height:140,background:"#e8e8e8",
                             borderRadius:"4px 4px 0 0",position:"relative",display:"flex",
                             alignItems:"flex-end",overflow:"hidden"}}>
                  <div style={{width:"100%",height:`${pct}%`,
                               background:hot?"#e53935":TEAL,
                               borderRadius:"4px 4px 0 0",transition:"height 0.4s"}}/>
                  {/* Average line (orange) — only show when no TAKT */}
                  {!taktMin && (
                    <div style={{position:"absolute",bottom:`${avgPct}%`,left:0,right:0,height:2,background:"#ff6f00"}}/>
                  )}
                  {/* TAKT line (red) */}
                  {taktMin && (
                    <div style={{position:"absolute",bottom:`${refPct}%`,left:0,right:0,height:2,background:"#c62828"}}/>
                  )}
                  {/* When TAKT set, also show avg as dashed orange */}
                  {taktMin && (
                    <div style={{position:"absolute",bottom:`${avgPct}%`,left:0,right:0,height:1,background:"#ff6f00",opacity:0.5,borderTop:"1px dashed #ff6f00"}}/>
                  )}
                </div>
                <span style={{fontSize:9,textAlign:"center",marginTop:3,color:"#555",
                              maxWidth:isSingleStation?88:68,overflow:"hidden",
                              textOverflow:"ellipsis",whiteSpace:"nowrap",display:"block"}}
                      title={d.name}>{label}</span>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div style={{fontSize:11,color:"#888",marginBottom:12,display:"flex",gap:16,flexWrap:"wrap"}}>
          {taktMin ? (<>
            <span><span style={{color:"#c62828",fontWeight:700}}>— Red line</span> = TAKT time ({fmtTime(taktMin)})</span>
            <span><span style={{color:"#ff6f00",fontWeight:700}}>- - Orange</span> = average ({fmtTime(avg)})</span>
            <span><span style={{color:"#e53935",fontWeight:700}}>■ Red bar</span> = exceeds TAKT</span>
          </>) : (<>
            <span><span style={{color:"#ff6f00",fontWeight:700}}>— Orange line</span> = average ({fmtTime(avg)})</span>
            <span><span style={{color:"#e53935",fontWeight:700}}>■ Red bar</span> = &gt;10% over average</span>
          </>)}
        </div>

        {/* ── Table ── */}
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead>
            <tr style={{background:TEAL,color:"white"}}>
              {[isSingleStation?"Task ID":"SOP ID",
                isSingleStation?"Task":"Station",
                "Tasks","Steps","Cycle Time",
                taktMin?"vs TAKT":"vs Avg"]
                .map(h=><th key={h} style={{padding:"7px 10px",textAlign:"left",fontWeight:600}}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {data.map((d,i)=>{
              const ref  = taktMin || avg;
              const diff = d.total - ref;
              const over = taktMin ? d.total > taktMin : d.total > avg*1.1;
              return (
                <tr key={d.id} style={{background:i%2===0?"#f5f5f5":"white",borderBottom:"1px solid #e0e0e0"}}>
                  <td style={{padding:"6px 10px",fontFamily:"monospace",color:TEAL_DARK,fontWeight:600}}>{d.sopId||"—"}</td>
                  <td style={{padding:"6px 10px",maxWidth:220}}>{d.name}</td>
                  <td style={{padding:"6px 10px",textAlign:"center"}}>{d.tasks}</td>
                  <td style={{padding:"6px 10px",textAlign:"center"}}>{d.steps}</td>
                  <td style={{padding:"6px 10px",fontWeight:600}}>{fmtTime(d.total)}</td>
                  <td style={{padding:"6px 10px",fontWeight:600,color:over?"#c62828":diff<0?"#2e7d32":"#888"}}>
                    {diff>0?"+":""}{fmtTime(Math.abs(diff))} {diff>0?"▲":diff<0?"▼":"—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{background:TEAL_LIGHT,fontWeight:700}}>
              <td colSpan={4} style={{padding:"7px 10px"}}>Total / Average</td>
              <td style={{padding:"7px 10px"}}>{fmtTime(data.reduce((s,d)=>s+d.total,0))}</td>
              <td style={{padding:"7px 10px",color:taktMin?"#c62828":"#555"}}>
                {taktMin ? `TAKT: ${fmtTime(taktMin)}` : `Avg: ${fmtTime(avg)}`}
              </td>
            </tr>
          </tfoot>
        </table>
      </>)}

      {/* ── AI prompt status ── */}
      {aiAnalysis && (
        <div style={{marginTop:20,border:"2px solid #8b5cf6",borderRadius:10,overflow:"hidden"}}>
          <div style={{background:"linear-gradient(135deg,#5c35c9,#8b5cf6)",color:"white",
                       padding:"10px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontWeight:700,fontSize:13}}>✨ AI Analysis</span>
            <button onClick={()=>setAiAnalysis("")}
              style={{background:"rgba(255,255,255,0.2)",border:"none",color:"white",borderRadius:4,
                      padding:"2px 8px",cursor:"pointer",fontSize:12}}>✕ Close</button>
          </div>
          <div style={{padding:"14px 18px",background:"#faf9ff",fontSize:13,color:"#444",lineHeight:1.7}}>
            {aiAnalysis}
          </div>
        </div>
      )}
    </div>
  );
}


// ─── CSV Restore Tool ─────────────────────────────────────────────────────────
// Parses a backup CSV produced by buildCSV() and reconstructs a full Line
// with Stations → Tasks → Steps. Images and drawings cannot be recovered
// from CSV (they were never exported), but all text content and cycle times
// are restored. The created line is named "{detected name}_Restored".
function CsvRestoreTool({ currentLines, currentStations, onClose, onRestore }) {
  const [step,       setStep]       = useState("pick"); // pick | preview | done
  const [fileName,   setFileName]   = useState("");
  const [error,      setError]      = useState("");
  const [preview,    setPreview]    = useState(null);  // {lineName, stations[]}
  const fileRef = useRef();

  // ── Parse CSV text → structured data ─────────────────────────────────────
  const parseCSV = (text) => {

    // RFC 4180 compliant CSV row parser — handles multiline quoted fields
    // Takes the full CSV string for a section and returns array of string arrays
    const parseSection = (csvText) => {
      const rows = [];
      let row = [], cur = "", inQ = false;
      for(let i = 0; i < csvText.length; i++) {
        const c = csvText[i];
        const next = csvText[i+1];
        if(inQ) {
          if(c === '"' && next === '"') { cur += '"'; i++; }         // escaped quote
          else if(c === '"') { inQ = false; }                        // end quote
          else { cur += c; }                                         // content (incl. newlines)
        } else {
          if(c === '"') { inQ = true; }                              // start quote
          else if(c === ',') { row.push(cur.trim()); cur = ""; }     // field separator
          else if(c === '\n' || (c === '\r' && next === '\n')) {     // row separator
            if(c === '\r') i++;
            row.push(cur.trim()); cur = "";
            if(row.some(f=>f)) rows.push(row);                      // skip blank rows
            row = [];
          } else { cur += c; }
        }
      }
      row.push(cur.trim());
      if(row.some(f=>f)) rows.push(row);
      return rows;
    };

    // Split into named sections by ## markers (safe — ## only appears at line-start)
    const physicalLines = text.split(/\r?\n/);
    const sectionTexts = {}; // sectionName → raw text block
    let curName = null, curLines = [];
    physicalLines.forEach(line => {
      if(line.startsWith("## ")) {
        if(curName) sectionTexts[curName] = curLines.join("\n");
        curName = line.slice(3).trim();
        curLines = [];
      } else if(curName) {
        curLines.push(line);
      }
    });
    if(curName) sectionTexts[curName] = curLines.join("\n");
    const isLegacy = Object.keys(sectionTexts).length === 0;

    // Parse each section into rows
    const sections = {};
    Object.entries(sectionTexts).forEach(([name, raw]) => {
      sections[name] = parseSection(raw);
    });

    // Helper: build field index from header row
    const idx = (rows) => {
      if(!rows.length) return {};
      const h = rows[0].map(x => x.toLowerCase().replace(/[^a-z]/g,""));
      const o = {}; h.forEach((k,i) => o[k]=i);
      return { _h:h, get:(n)=>o[n]??-1 };
    };
    const fget = (r, I, name, def="") => { const i=I.get(name); return i>-1 ? r[i]||def : def; };

    // ── Station Metadata ────────────────────────────────────────────────────
    const stationMeta={};
    if(sections["STATION METADATA"]?.length>1){
      const rows=sections["STATION METADATA"];
      const I=idx(rows);
      rows.slice(1).forEach(r=>{
        const stNo=fget(r,I,"stationno");if(!stNo)return;
        stationMeta[stNo]={
          sopId:      fget(r,I,"sopid"),
          stDesc:     fget(r,I,"stationdesc"),
          asmVer:     fget(r,I,"asmversion"),
          sopRev:     fget(r,I,"soprevision","A"),
          revisedBy:  fget(r,I,"revisedby"),
          purpose:    fget(r,I,"purpose"),
          safety:     fget(r,I,"safetysummary"),
          generalNotes:fget(r,I,"generalnotes"),
          toolsRaw:   fget(r,I,"toolsequipment"),
          drawingsRaw:fget(r,I,"applicabledrawings"),
        };
      });
    }

    // ── Revision Log ────────────────────────────────────────────────────────
    const revisionLog={};
    if(sections["REVISION LOG"]?.length>1){
      const rows=sections["REVISION LOG"];
      const I=idx(rows);
      rows.slice(1).forEach(r=>{
        const stNo=fget(r,I,"stationno");if(!stNo)return;
        if(!revisionLog[stNo])revisionLog[stNo]=[];
        revisionLog[stNo].push({
          rev:  fget(r,I,"rev"),
          date: fget(r,I,"date"),
          description:fget(r,I,"description"),
          by:   fget(r,I,"revisedby"),
        });
      });
    }

    // ── Tasks & Steps ───────────────────────────────────────────────────────
    const taskRows = sections["TASKS AND STEPS"] ||
      (isLegacy ? parseSection(text.split(/\r?\n/).filter(Boolean).join("\n")) : []);
    if(taskRows.length<2) return {error:"No task/step data found in CSV."};

    const I=idx(taskRows);
    if(I.get("stationno")===-1) return {error:"CSV does not match expected SOP Builder format."};

    const stationMap=new Map();
    taskRows.slice(1).forEach(r=>{
      const stNo=fget(r,I,"stationno");if(!stNo)return;
      const sopId=fget(r,I,"sopid");
      const stDesc=fget(r,I,"stationdesc");
      const taskNo=fget(r,I,"taskno");
      const taskId=fget(r,I,"taskid");
      const taskDesc=fget(r,I,"taskdescription");
      const taskNotes=fget(r,I,"tasknotes");
      const stepNo=fget(r,I,"stepno");
      const stepDesc=fget(r,I,"stepdescription");
      const keyPts=fget(r,I,"keypoints");
      const iconKey=I.get("safetyicons")>-1?"safetyicons":"safetyicon";
      const icon=fget(r,I,iconKey);
      const ct=fget(r,I,"cycletimemin");
      if(!stationMap.has(stNo))stationMap.set(stNo,{sopId,stDesc,tasks:new Map()});
      const stData=stationMap.get(stNo);
      if(taskNo){
        if(!stData.tasks.has(taskNo))stData.tasks.set(taskNo,{taskId,taskDesc,taskNotes,steps:[]});
        if(stepDesc)stData.tasks.get(taskNo).steps.push({stepNo,stepDesc,keyPts,icon,ct});
      }
    });

    if(stationMap.size===0)return{error:"No stations found in CSV."};

    const firstSopId=[...stationMap.values()][0].sopId||"";
    const parts=firstSopId.split("-");
    const guessedLineName=parts.length>=3?parts.slice(0,2).join("-"):firstSopId.split(".")[0]||"Restored";

    const stations=[];
    stationMap.forEach((stData,stNo)=>{
      const meta=stationMeta[stNo]||{};
      const revEntries=revisionLog[stNo]||[{rev:"A",date:"",description:"Initial Release",by:""}];
      const toolList=meta.toolsRaw
        ?meta.toolsRaw.split(";").map(t=>t.trim()).filter(Boolean).map(t=>{
            const m=t.match(/^(.+?)\s*\((.+?)\)\s*$/);
            return m?{id:Date.now()+Math.random(),name:m[1].trim(),partNo:m[2].trim()}:{id:Date.now()+Math.random(),name:t,partNo:""};
          })
        :[];
      const drawings=meta.drawingsRaw
        ?meta.drawingsRaw.split(";").map(d=>d.trim()).filter(Boolean).map(d=>{
            const m=d.match(/^(.+?)\s*[—-]\s*(.+)$/);
            return m?{drawingNo:m[1].trim(),description:m[2].trim()}:{drawingNo:d,description:""};
          })
        :[{drawingNo:"",description:""}];
      const tasks=[];
      stData.tasks.forEach((tData,taskNo)=>{
        const steps=tData.steps.map((sp,si)=>({
          ...mkStep(),
          stepNumber:sp.stepNo||String(si+1),useStepNumber:!!sp.stepNo,
          description:sp.stepDesc,keyPoints:sp.keyPts,
          icons:sp.icon?sp.icon.split(";").map(s=>s.trim()).filter(Boolean):[],
          cycleTime:sp.ct?String(Math.round(parseFloat(sp.ct||0)*60)):"",
        }));
        tasks.push({...mkTask(stData.sopId,parseInt(taskNo)||tasks.length+1),
          taskNo:parseInt(taskNo)||tasks.length+1,taskId:tData.taskId,
          description:tData.taskDesc,generalNotes:tData.taskNotes||"",steps});
      });
      stations.push({
        ...mkStation(),
        stationNo:stNo,sopId:meta.sopId||stData.sopId,
        stationDesc:meta.stDesc||stData.stDesc,
        asmVersion:meta.asmVer||(stData.sopId.match(/-V(\d+)\./) ||[])[1]||"",
        sopRev:meta.sopRev||(stData.sopId.match(/\.([A-Z]+)$/) ||[])[1]||"A",
        revisedBy:meta.revisedBy||"",purpose:meta.purpose||"",
        safety:meta.safety||"",generalNotes:meta.generalNotes||"",
        toolList,tools:toolList.map(t=>t.partNo?`${t.name} (${t.partNo})`:t.name).join(", "),
        drawings,revisionEntries:revEntries,
        revisionLog:revEntries.map(e=>`${e.rev} - ${e.description}`).join("\n"),
        tasks:reindex(tasks,meta.sopId||stData.sopId),
      });
    });
    return {stations,guessedLineName};
  };



  const handleFile = (file) => {
    if(!file) return;
    setFileName(file.name);
    setError("");
    const reader = new FileReader();
    reader.onload = e => {
      const result = parseCSV(e.target.result);
      if(result.error) { setError(result.error); return; }
      // Guess line name from filename e.g. "Powder_Coat_2026-06-24.csv" → "Powder Coat"
      const namePart = file.name.replace(/\.csv$/i,"").replace(/_\d{4}-\d{2}-\d{2}$/,"").replace(/_/g," ").trim();
      const lineName = (namePart || result.guessedLineName || "Restored") + "_Restored";
      setPreview({lineName, stations: result.stations, guessedLineName: result.guessedLineName});
      setStep("preview");
    };
    reader.readAsText(file);
  };

  const doRestore = () => {
    if(!preview) return;
    const newLine = {
      ...mkLine(),
      name: preview.lineName,
      description: `Restored from CSV: ${fileName}`,
      stationIdentifier: preview.guessedLineName,
    };
    const newStations = preview.stations.map(s => ({...s, id: Date.now()+Math.random()}));
    newLine.stationIds = newStations.map(s=>s.id);
    onRestore(newStations, newLine);
    setStep("done");
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:3000,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{background:"white",borderRadius:12,padding:0,maxWidth:580,width:"95%",maxHeight:"85vh",
                   display:"flex",flexDirection:"column",boxShadow:"0 8px 40px rgba(0,0,0,0.3)"}}>

        {/* Header */}
        <div style={{background:"#e65100",color:"white",padding:"14px 20px",borderRadius:"12px 12px 0 0",
                     display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
          <div>
            <div style={{fontWeight:700,fontSize:15}}>♻️ Restore Line from CSV Backup</div>
            <div style={{fontSize:11,opacity:0.85,marginTop:2}}>Recovers stations, tasks, and steps from a .csv backup file</div>
          </div>
          <button onClick={onClose}
            style={{background:"rgba(255,255,255,0.2)",border:"none",color:"white",
                    borderRadius:4,padding:"4px 10px",cursor:"pointer",fontSize:13}}>✕</button>
        </div>

        <div style={{padding:24,overflowY:"auto",flex:1}}>

          {/* Step: pick file */}
          {step==="pick" && (
            <div style={{textAlign:"center",padding:"24px 0"}}>
              <div style={{fontSize:40,marginBottom:12}}>📊</div>
              <div style={{fontWeight:700,fontSize:15,marginBottom:8}}>Select your CSV backup file</div>
              <div style={{fontSize:12,color:"#666",marginBottom:6,lineHeight:1.7}}>
                Select the <code>.csv</code> file saved alongside your project.<br/>
                Recovers: Stations · Tasks · Steps · Cycle Times · Descriptions
              </div>
              <div style={{background:"#fff3e0",border:"1px solid #ffb74d",borderRadius:6,
                           padding:"8px 14px",marginBottom:20,fontSize:12,color:"#7c4d00",display:"inline-block"}}>
                ⚠️ Images and drawings cannot be recovered from CSV — only the JSON contains those.
              </div>
              <br/>
              {error && (
                <div style={{background:"#ffebee",color:"#c62828",padding:"8px 14px",borderRadius:6,
                             marginBottom:14,fontSize:12,display:"inline-block"}}>{error}</div>
              )}
              <br/>
              <button onClick={()=>fileRef.current.click()}
                style={{background:"#e65100",color:"white",border:"none",borderRadius:8,
                        padding:"12px 28px",cursor:"pointer",fontSize:14,fontWeight:700}}>
                Browse for CSV file…
              </button>
              <input ref={fileRef} type="file" accept=".csv" style={{display:"none"}}
                onChange={e=>{handleFile(e.target.files[0]);e.target.value="";}}/>
            </div>
          )}

          {/* Step: preview */}
          {step==="preview" && preview && (
            <div>
              <div style={{marginBottom:16}}>
                <div style={{fontWeight:700,fontSize:14,color:"#e65100",marginBottom:4}}>
                  Restore Preview
                </div>
                <div style={{fontSize:12,color:"#555"}}>File: <strong>{fileName}</strong></div>
              </div>

              {/* Line name */}
              <div style={{marginBottom:14}}>
                <label style={{fontSize:12,fontWeight:600,color:"#333",display:"block",marginBottom:4}}>
                  Restored Line Name
                </label>
                <input value={preview.lineName}
                  onChange={e=>setPreview(p=>({...p,lineName:e.target.value}))}
                  style={{width:"100%",padding:"7px 10px",border:"2px solid #e65100",borderRadius:6,
                          fontSize:14,fontWeight:700,color:"#e65100"}}/>
              </div>

              {/* Stations preview table */}
              <div style={{fontSize:12,fontWeight:600,color:"#555",marginBottom:6}}>
                {preview.stations.length} station(s) found:
              </div>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,marginBottom:16}}>
                <thead>
                  <tr style={{background:"#e65100",color:"white"}}>
                    <th style={{padding:"6px 10px",textAlign:"left"}}>Station No</th>
                    <th style={{padding:"6px 10px",textAlign:"left"}}>Description</th>
                    <th style={{padding:"6px 10px",textAlign:"center"}}>Tasks</th>
                    <th style={{padding:"6px 10px",textAlign:"center"}}>Steps</th>
                    <th style={{padding:"6px 10px",textAlign:"right"}}>Cycle Time</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.stations.map((s,i)=>(
                    <tr key={i} style={{background:i%2===0?"#fff3e0":"white",borderBottom:"1px solid #ffe0b2"}}>
                      <td style={{padding:"6px 10px",fontWeight:700,color:"#e65100"}}>{s.stationNo}</td>
                      <td style={{padding:"6px 10px"}}>{s.stationDesc||"—"}</td>
                      <td style={{padding:"6px 10px",textAlign:"center"}}>{s.tasks.length}</td>
                      <td style={{padding:"6px 10px",textAlign:"center"}}>{s.tasks.reduce((n,t)=>n+t.steps.length,0)}</td>
                      <td style={{padding:"6px 10px",textAlign:"right"}}>{fmtTime(sumTasks(s.tasks))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{background:"#e8f5e9",border:"1px solid #a5d6a7",borderRadius:6,
                           padding:"8px 12px",marginBottom:16,fontSize:12,color:"#2e7d32"}}>
                ✓ The restored line will be added to your workspace. Your existing lines are not affected.
              </div>
            </div>
          )}

          {/* Step: done */}
          {step==="done" && (
            <div style={{textAlign:"center",padding:"32px 0"}}>
              <div style={{fontSize:48,marginBottom:12}}>✅</div>
              <div style={{fontWeight:700,fontSize:16,color:"#2e7d32",marginBottom:8}}>
                Line Restored Successfully
              </div>
              <div style={{fontSize:13,color:"#555"}}>
                "{preview?.lineName}" has been added to your workspace.
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{padding:"12px 20px",borderTop:"1px solid #e0e0e0",display:"flex",
                     gap:10,flexShrink:0,justifyContent:"flex-end"}}>
          {step==="preview" && <>
            <button onClick={()=>setStep("pick")}
              style={{padding:"8px 18px",borderRadius:6,border:"1px solid #ddd",
                      background:"#f5f5f5",cursor:"pointer",fontSize:13}}>← Back</button>
            <button onClick={doRestore}
              style={{padding:"8px 20px",borderRadius:6,border:"none",
                      background:"#e65100",color:"white",cursor:"pointer",fontSize:13,fontWeight:700}}>
              ♻️ Restore Line
            </button>
          </>}
          {(step==="pick"||step==="done") && (
            <button onClick={onClose}
              style={{padding:"8px 18px",borderRadius:6,border:"1px solid #ddd",
                      background:"#f5f5f5",cursor:"pointer",fontSize:13}}>
              {step==="done"?"Close":"Cancel"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Import Wizard ─────────────────────────────────────────────────────────────
// Three steps:
//   1. Parse file, show what's inside
//   2. Select which stations / tasks / steps to import
//   3. Choose destination (which line, which station, which task)
//      then execute import

function ImportWizard({ currentStations, currentLines, onClose, onImport }) {
  const [step,        setStep]        = useState(1); // 1=pick file 2=select items 3=assign
  const [fileData,    setFileData]    = useState(null); // parsed {stations,lines}
  const [fileName,    setFileName]    = useState("");
  const [error,       setError]       = useState("");

  // Selection state: Set of ids
  const [selStations, setSelStations] = useState(new Set());
  const [selTasks,    setSelTasks]    = useState(new Set());   // "stationId::taskId"
  const [selSteps,    setSelSteps]    = useState(new Set());   // "stationId::taskId::stepId"

  // Destination choices per imported task (when importing tasks without their station)
  const [taskDest,       setTaskDest]       = useState({});  // taskKey → {stationId}
  // Destination choices per imported step
  const [stepDest,       setStepDest]       = useState({});  // stepKey → {stationId, taskId:"new"|id, newTaskDesc}
  // Line assignment for each imported station
  const [stationLineDest, setStationLineDest] = useState({});  // stationId → lineId | "new" | "none"

  const fileRef = useRef();

  // ── Step 1: Parse file ────────────────────────────────────────────────────
  const handleFile = (file) => {
    if(!file) return;
    setFileName(file.name);
    const r = new FileReader();
    r.onload = (e) => {
      try {
        const d = JSON.parse(e.target.result);
        const stations = (d.stations||[]).map(migrateStation);
        const lines    = d.lines || [];
        if(!stations.length) { setError("No stations found in this file."); return; }
        setFileData({ stations, lines });
        setError("");
        setStep(2);
      } catch { setError("Could not read file — is it a valid SOP Builder save?"); }
    };
    r.readAsText(file);
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const toggleStation = (sid) => {
    setSelStations(prev => {
      const next = new Set(prev);
      if(next.has(sid)) {
        next.delete(sid);
        // also deselect its tasks/steps
        setSelTasks(t => { const n=new Set(t); [...n].filter(k=>k.startsWith(sid+"::")).forEach(k=>n.delete(k)); return n; });
        setSelSteps(s => { const n=new Set(s); [...n].filter(k=>k.startsWith(sid+"::")).forEach(k=>n.delete(k)); return n; });
      } else {
        next.add(sid);
      }
      return next;
    });
  };
  const toggleTask = (sid, tid) => {
    const key = sid+"::"+tid;
    setSelTasks(prev => {
      const next = new Set(prev);
      if(next.has(key)) {
        next.delete(key);
        setSelSteps(s => { const n=new Set(s); [...n].filter(k=>k.startsWith(key+"::")).forEach(k=>n.delete(k)); return n; });
      } else { next.add(key); }
      return next;
    });
  };
  const toggleStep = (sid, tid, stid) => {
    const key = sid+"::"+tid+"::"+stid;
    setSelSteps(prev => { const next=new Set(prev); next.has(key)?next.delete(key):next.add(key); return next; });
  };
  const selectAll = () => {
    if(!fileData) return;
    const sids=new Set(), tkeys=new Set(), stkeys=new Set();
    fileData.stations.forEach(s => {
      sids.add(s.id);
      s.tasks.forEach(t => {
        tkeys.add(s.id+"::"+t.id);
        t.steps.forEach(st => stkeys.add(s.id+"::"+t.id+"::"+st.id));
      });
    });
    setSelStations(sids); setSelTasks(tkeys); setSelSteps(stkeys);
  };
  const clearAll = () => { setSelStations(new Set()); setSelTasks(new Set()); setSelSteps(new Set()); };

  // Count selected
  const stationCount = selStations.size;
  const taskCount    = [...selTasks].filter(k => !selStations.has(k.split("::")[0])).length;
  const stepCount    = [...selSteps].filter(k => {
    const [sid,tid] = k.split("::");
    return !selStations.has(sid) && !selTasks.has(sid+"::"+tid);
  }).length;
  const totalSelected = stationCount + taskCount + stepCount;

  // ── Step 3: Build destination form ───────────────────────────────────────
  // Orphan tasks: selected tasks whose station is NOT selected
  const orphanTasks = fileData ? [...selTasks].filter(k => !selStations.has(k.split("::")[0])).map(k => {
    const [sid,tid] = k.split("::");
    const st = fileData.stations.find(s=>s.id===sid);
    const t  = st?.tasks.find(t=>t.id===tid);
    return t ? { key:k, sid, task:t, stationName:st?.stationNo||st?.sopId||"Station" } : null;
  }).filter(Boolean) : [];

  // Orphan steps: selected steps whose task is NOT selected and station is NOT selected
  const orphanSteps = fileData ? [...selSteps].filter(k => {
    const [sid,tid] = k.split("::");
    return !selStations.has(sid) && !selTasks.has(sid+"::"+tid);
  }).map(k => {
    const [sid,tid,stid] = k.split("::");
    const st  = fileData.stations.find(s=>s.id===sid);
    const t   = st?.tasks.find(t=>t.id===tid);
    const stp = t?.steps.find(s=>s.id===stid);
    return stp ? { key:k, sid, tid, step:stp, taskDesc:t?.description||"Task", stationName:st?.stationNo||"Station" } : null;
  }).filter(Boolean) : [];

  const needsAssignment = selStations.size > 0 || orphanTasks.length > 0 || orphanSteps.length > 0;

  // ── Execute import ────────────────────────────────────────────────────────
  const doImport = () => {
    let newStations = [...currentStations];
    let newLines    = [...currentLines];

    // Helper: fresh IDs
    const freshStation = (s) => ({
      ...s,
      id: Date.now()+Math.random(),
      tasks: s.tasks.map(t => ({
        ...t, id:Date.now()+Math.random(),
        steps: t.steps.map(st => ({...st, id:Date.now()+Math.random()}))
      }))
    });
    const freshTask = (t) => ({
      ...t, id:Date.now()+Math.random(),
      steps: t.steps.map(st => ({...st, id:Date.now()+Math.random()}))
    });

    // 1. Import full stations and assign to lines
    const newStationIdMap = {}; // orig id → new station id
    selStations.forEach(sid => {
      const orig = fileData.stations.find(s=>s.id===sid);
      if(!orig) return;
      const station = freshStation({ ...orig });
      station.tasks = reindex(station.tasks, station.sopId);
      newStations.push(station);
      newStationIdMap[sid] = station.id;

      // Assign to line
      const dest = stationLineDest[sid];
      if(dest && dest !== "none") {
        if(dest === "new") {
          // Create a new line named after the station
          const newLine = mkLine();
          newLine.name = orig.stationNo || orig.sopId || "Imported Line";
          newLine.stationIds = [station.id];
          newLines.push(newLine);
        } else {
          // Add to existing line
          newLines = newLines.map(l => l.id === dest
            ? { ...l, stationIds: [...l.stationIds, station.id] }
            : l
          );
        }
      }
    });

    // 2. Import orphan tasks → assign to destination station
    orphanTasks.forEach(({ key, task }) => {
      const destSid = taskDest[key]?.stationId;
      const target  = newStations.find(s=>s.id===destSid);
      if(!target) return;
      const t = freshTask({
        ...task,
        // filter to only selected steps
        steps: task.steps.filter(st => selSteps.has(key+"::"+st.id) || selTasks.has(key))
      });
      target.tasks = reindex([...target.tasks, t], target.sopId);
      newStations = newStations.map(s=>s.id===destSid?target:s);
    });

    // 3. Import orphan steps → assign to destination task
    orphanSteps.forEach(({ key, step }) => {
      const dest    = stepDest[key] || {};
      const target  = newStations.find(s=>s.id===dest.stationId);
      if(!target) return;
      if(dest.taskId==="new") {
        // Create a new task in the target station
        const newTask = mkTask(target.sopId, target.tasks.length+1);
        newTask.description = (dest.newTaskDesc||"Imported Task").toUpperCase();
        newTask.steps = [{ ...step, id:Date.now()+Math.random() }];
        target.tasks = reindex([...target.tasks, newTask], target.sopId);
      } else {
        const taskIdx = target.tasks.findIndex(t=>t.id===dest.taskId);
        if(taskIdx===-1) return;
        target.tasks[taskIdx] = { ...target.tasks[taskIdx], steps:[...target.tasks[taskIdx].steps, { ...step, id:Date.now()+Math.random() }] };
      }
      newStations = newStations.map(s=>s.id===dest.stationId?target:s);
    });

    onImport(newStations, newLines);
    onClose();
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const modalStyle = {position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:3000,display:"flex",alignItems:"center",justifyContent:"center"};
  const cardStyle  = {background:"white",borderRadius:12,padding:0,maxWidth:720,width:"95%",maxHeight:"90vh",display:"flex",flexDirection:"column",boxShadow:"0 8px 40px rgba(0,0,0,0.3)"};
  const hdrStyle   = {background:TEAL_DARK,color:"white",padding:"14px 20px",borderRadius:"12px 12px 0 0",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0};
  const bodyStyle  = {padding:20,overflowY:"auto",flex:1};
  const ftrStyle   = {padding:"12px 20px",borderTop:"1px solid #e0e0e0",display:"flex",gap:10,flexShrink:0,justifyContent:"flex-end"};

  const Btn = ({onClick,children,primary=false,disabled=false}) => (
    <button onClick={onClick} disabled={disabled}
      style={{padding:"8px 18px",borderRadius:6,border:primary?"none":"1px solid #ddd",cursor:disabled?"not-allowed":"pointer",
              background:disabled?"#e0e0e0":primary?TEAL:"#f5f5f5",color:disabled?"#aaa":primary?"white":"#333",
              fontSize:13,fontWeight:primary?700:400,opacity:disabled?0.7:1}}>
      {children}
    </button>
  );

  return (
    <div style={modalStyle}>
      <div style={cardStyle}>
        {/* Header */}
        <div style={hdrStyle}>
          <div>
            <div style={{fontWeight:700,fontSize:15}}>📥 Import Wizard</div>
            <div style={{fontSize:11,opacity:0.8,marginTop:2}}>
              Step {step} of {needsAssignment||step===3?3:2}:&nbsp;
              {step===1?"Choose a file":step===2?"Select what to import":"Assign destinations"}
            </div>
          </div>
          <button onClick={onClose} style={{background:"rgba(255,255,255,0.15)",border:"none",color:"white",borderRadius:4,padding:"4px 10px",cursor:"pointer",fontSize:13}}>✕</button>
        </div>

        <div style={bodyStyle}>

          {/* ── Step 1: Pick file ── */}
          {step===1 && (
            <div style={{textAlign:"center",padding:"30px 0"}}>
              <div style={{fontSize:48,marginBottom:12}}>📂</div>
              <div style={{fontSize:15,fontWeight:600,marginBottom:6}}>Select a save file to import from</div>
              <div style={{fontSize:12,color:"#888",marginBottom:20}}>Supports both the old format (stations only) and the new format (lines + stations)</div>
              {error && <div style={{background:"#ffebee",color:"#c62828",padding:"8px 14px",borderRadius:6,marginBottom:14,fontSize:12}}>{error}</div>}
              <button onClick={()=>fileRef.current.click()}
                style={{background:TEAL,color:"white",border:"none",borderRadius:8,padding:"12px 28px",cursor:"pointer",fontSize:14,fontWeight:700}}>
                Browse for File…
              </button>
              <input ref={fileRef} type="file" accept=".json" style={{display:"none"}} onChange={e=>{handleFile(e.target.files[0]);e.target.value="";}}/>
            </div>
          )}

          {/* ── Step 2: Select items ── */}
          {step===2 && fileData && (
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <div>
                  <span style={{fontWeight:600,fontSize:13}}>File: </span>
                  <span style={{fontSize:12,color:"#555"}}>{fileName}</span>
                  <span style={{fontSize:11,color:"#888",marginLeft:8}}>
                    — {fileData.stations.length} station(s), {fileData.stations.reduce((n,s)=>n+s.tasks.length,0)} task(s)
                  </span>
                </div>
                <div style={{display:"flex",gap:6}}>
                  <button onClick={selectAll} style={{fontSize:11,padding:"2px 8px",background:"#e8f5e9",border:"1px solid #a5d6a7",borderRadius:4,cursor:"pointer"}}>Select All</button>
                  <button onClick={clearAll}  style={{fontSize:11,padding:"2px 8px",background:"#ffebee",border:"1px solid #ef9a9a",borderRadius:4,cursor:"pointer"}}>Clear All</button>
                </div>
              </div>

              {/* Selection tree */}
              {fileData.stations.map(s => {
                const stationSel = selStations.has(s.id);
                return (
                  <div key={s.id} style={{border:"1px solid #e0e0e0",borderRadius:8,marginBottom:8,overflow:"hidden"}}>
                    {/* Station row */}
                    <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:stationSel?TEAL_LIGHT:"#f9f9f9",borderBottom:s.tasks.length?"1px solid #e0e0e0":"none"}}>
                      <input type="checkbox" checked={stationSel} onChange={()=>toggleStation(s.id)} style={{width:15,height:15,cursor:"pointer",accentColor:TEAL}}/>
                      <span style={{fontSize:16}}>🏭</span>
                      <span style={{fontWeight:700,fontSize:13,color:TEAL_DARK}}>{s.stationNo||s.sopId||"Station"}</span>
                      {s.stationDesc && <span style={{fontSize:12,color:"#555"}}>— {s.stationDesc}</span>}
                      <span style={{fontFamily:"monospace",fontSize:11,color:"#888",marginLeft:4}}>{s.sopId}</span>
                      <span style={{marginLeft:"auto",fontSize:11,color:"#888"}}>{s.tasks.length} task(s)</span>
                      {stationSel && <span style={{fontSize:11,background:TEAL,color:"white",padding:"1px 7px",borderRadius:3}}>Full station</span>}
                    </div>
                    {/* Tasks */}
                    {s.tasks.map(t => {
                      const tkey = s.id+"::"+t.id;
                      const taskSel = stationSel || selTasks.has(tkey);
                      return (
                        <div key={t.id} style={{borderBottom:"1px solid #f0f0f0"}}>
                          <div style={{display:"flex",alignItems:"center",gap:8,padding:"6px 12px 6px 28px",background:taskSel&&!stationSel?"#fff8e1":"white"}}>
                            <input type="checkbox" checked={taskSel} disabled={stationSel}
                              onChange={()=>!stationSel&&toggleTask(s.id,t.id)}
                              style={{width:14,height:14,cursor:stationSel?"not-allowed":"pointer",accentColor:TEAL}}/>
                            <span style={{fontSize:13}}>📋</span>
                            <span style={{fontSize:12,fontWeight:600,color:"#444"}}>Task {t.taskNo}</span>
                            <span style={{fontSize:12,color:"#555",flex:1}}>{t.description||"(no description)"}</span>
                            <span style={{fontSize:11,color:"#888"}}>{t.steps.length} step(s)</span>
                            {!stationSel && taskSel && <span style={{fontSize:11,background:"#ff9800",color:"white",padding:"1px 7px",borderRadius:3}}>Full task</span>}
                          </div>
                          {/* Steps */}
                          {t.steps.map((st,si) => {
                            const stkey = s.id+"::"+t.id+"::"+st.id;
                            const stepSel = stationSel || taskSel || selSteps.has(stkey);
                            return (
                              <div key={st.id} style={{display:"flex",alignItems:"flex-start",gap:8,padding:"4px 12px 4px 48px",
                                  background:stepSel&&!stationSel&&!selTasks.has(tkey)?"#f3e5f5":"#fafafa",borderBottom:"1px solid #f5f5f5"}}>
                                <input type="checkbox" checked={stepSel} disabled={stationSel||selTasks.has(tkey)}
                                  onChange={()=>!stationSel&&!selTasks.has(tkey)&&toggleStep(s.id,t.id,st.id)}
                                  style={{marginTop:2,width:13,height:13,cursor:(stationSel||selTasks.has(tkey))?"not-allowed":"pointer",accentColor:TEAL,flexShrink:0}}/>
                                <span style={{fontSize:11,color:"#888",width:20,textAlign:"center",flexShrink:0}}>{st.stepNumber||si+1}</span>
                                <span style={{fontSize:11,color:"#555",flex:1,lineHeight:1.4}}>
                                  {(st.description||"(no description)").slice(0,80)}{st.description?.length>80?"…":""}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              {totalSelected===0 && (
                <div style={{textAlign:"center",color:"#e65100",fontSize:12,padding:"8px 0",fontWeight:600}}>
                  Select at least one item to continue.
                </div>
              )}
            </div>
          )}

          {/* ── Step 3: Assign destinations ── */}
          {step===3 && (
            <div>
              <div style={{fontSize:13,color:"#555",marginBottom:14}}>
                Assign imported items to lines and stations in your current project.
              </div>

              {/* ── Station → Line assignment ── */}
              {selStations.size > 0 && (
                <div style={{marginBottom:20}}>
                  <div style={{fontWeight:700,fontSize:13,color:TEAL_DARK,marginBottom:8}}>
                    🏭 Stations — assign each to a line:
                  </div>
                  {[...selStations].map(sid => {
                    const s = fileData.stations.find(st=>st.id===sid);
                    if(!s) return null;
                    const dest = stationLineDest[sid] || "none";
                    return (
                      <div key={sid} style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,alignItems:"center",
                          marginBottom:8,padding:"8px 12px",background:TEAL_LIGHT,borderRadius:6,border:`1px solid #80cbc4`}}>
                        <div>
                          <div style={{fontSize:12,fontWeight:700,color:TEAL_DARK}}>{s.stationNo||s.sopId||"Station"}</div>
                          <div style={{fontSize:11,color:"#555"}}>{s.stationDesc} {s.sopId && <span style={{fontFamily:"monospace",color:"#888"}}>{s.sopId}</span>}</div>
                          <div style={{fontSize:11,color:"#888",marginTop:2}}>{s.tasks.length} task(s)</div>
                        </div>
                        <div>
                          <label style={{fontSize:11,color:"#555",display:"block",marginBottom:2}}>Add to line</label>
                          <select value={dest}
                            onChange={e=>setStationLineDest(d=>({...d,[sid]:e.target.value}))}
                            style={{width:"100%",padding:"5px 7px",border:`1px solid ${TEAL}`,borderRadius:4,fontSize:12,background:"white"}}>
                            <option value="none">— No line (unassigned) —</option>
                            <option value="new">➕ Create new line for this station</option>
                            {currentLines.map(l=>(
                              <option key={l.id} value={l.id}>🏗️ {l.name||"(unnamed line)"}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Orphan tasks */}
              {orphanTasks.length>0 && (
                <div style={{marginBottom:16}}>
                  <div style={{fontWeight:700,fontSize:13,color:TEAL_DARK,marginBottom:8}}>
                    📋 Tasks — choose which station to add each to:
                  </div>
                  {orphanTasks.map(({key,task,stationName})=>(
                    <div key={key} style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,alignItems:"center",marginBottom:8,padding:"8px 10px",background:"#fffde7",borderRadius:6,border:"1px solid #ffe082"}}>
                      <div>
                        <div style={{fontSize:12,fontWeight:600}}>{task.description||"(no description)"}</div>
                        <div style={{fontSize:11,color:"#888"}}>from: {stationName}</div>
                      </div>
                      <div>
                        <label style={{fontSize:11,color:"#555",display:"block",marginBottom:2}}>Add to station *</label>
                        <select value={taskDest[key]?.stationId||""}
                          onChange={e=>setTaskDest(d=>({...d,[key]:{stationId:e.target.value}}))}
                          style={{width:"100%",padding:"5px 7px",border:"1px solid #ccc",borderRadius:4,fontSize:12}}>
                          <option value="">— select station —</option>
                          {currentStations.map(s=>(
                            <option key={s.id} value={s.id}>{s.stationNo||s.sopId} {s.stationDesc?"— "+s.stationDesc:""}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Orphan steps */}
              {orphanSteps.length>0 && (
                <div>
                  <div style={{fontWeight:700,fontSize:13,color:TEAL_DARK,marginBottom:8}}>
                    🔢 Steps — choose which station + task to add each to:
                  </div>
                  {orphanSteps.map(({key,step,taskDesc,stationName})=>(
                    <div key={key} style={{padding:"8px 10px",background:"#f3e5f5",borderRadius:6,border:"1px solid #ce93d8",marginBottom:8}}>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,alignItems:"flex-start"}}>
                        <div>
                          <div style={{fontSize:12,fontWeight:600}}>{(step.description||"(no description)").slice(0,60)}</div>
                          <div style={{fontSize:11,color:"#888"}}>from: {stationName} → {taskDesc}</div>
                        </div>
                        <div style={{display:"flex",flexDirection:"column",gap:6}}>
                          <div>
                            <label style={{fontSize:11,color:"#555",display:"block",marginBottom:2}}>Station *</label>
                            <select value={stepDest[key]?.stationId||""}
                              onChange={e=>setStepDest(d=>({...d,[key]:{...d[key],stationId:e.target.value,taskId:""}}))}
                              style={{width:"100%",padding:"4px 6px",border:"1px solid #ccc",borderRadius:4,fontSize:12}}>
                              <option value="">— select station —</option>
                              {currentStations.map(s=>(
                                <option key={s.id} value={s.id}>{s.stationNo||s.sopId} {s.stationDesc?"— "+s.stationDesc:""}</option>
                              ))}
                            </select>
                          </div>
                          {stepDest[key]?.stationId && (
                            <div>
                              <label style={{fontSize:11,color:"#555",display:"block",marginBottom:2}}>Task *</label>
                              <select value={stepDest[key]?.taskId||""}
                                onChange={e=>setStepDest(d=>({...d,[key]:{...d[key],taskId:e.target.value}}))}
                                style={{width:"100%",padding:"4px 6px",border:"1px solid #ccc",borderRadius:4,fontSize:12}}>
                                <option value="">— select task —</option>
                                <option value="new">➕ Create new task…</option>
                                {(currentStations.find(s=>s.id===stepDest[key]?.stationId)?.tasks||[]).map(t=>(
                                  <option key={t.id} value={t.id}>Task {t.taskNo}: {t.description||"(untitled)"}</option>
                                ))}
                              </select>
                            </div>
                          )}
                          {stepDest[key]?.taskId==="new" && (
                            <input value={stepDest[key]?.newTaskDesc||""}
                              onChange={e=>setStepDest(d=>({...d,[key]:{...d[key],newTaskDesc:e.target.value}}))}
                              placeholder="New task description"
                              style={{width:"100%",padding:"4px 6px",border:"1px solid #ccc",borderRadius:4,fontSize:12}}/>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer buttons */}
        <div style={ftrStyle}>
          {step>1 && <Btn onClick={()=>setStep(s=>s-1)}>← Back</Btn>}
          <div style={{flex:1}}/>
          <Btn onClick={onClose}>Cancel</Btn>
          {step===2 && (
            <Btn primary disabled={totalSelected===0}
              onClick={()=>{ if(needsAssignment) setStep(3); else doImport(); }}>
              {needsAssignment ? "Next: Assign →" : `Import ${totalSelected} item(s)`}
            </Btn>
          )}
          {step===3 && (
            <Btn primary
              onClick={()=>{
                // Validate all orphans have destinations
                const missing = [
                  ...orphanTasks.filter(({key})=>!taskDest[key]?.stationId),
                  ...orphanSteps.filter(({key})=>!stepDest[key]?.stationId||!stepDest[key]?.taskId)
                ];
                if(missing.length){ alert(`Please assign a destination for all ${missing.length} item(s).`); return; }
                doImport();
              }}>
              ✓ Import {totalSelected} item(s)
            </Btn>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sidebar Navigator ────────────────────────────────────────────────────────
function SidebarNav({ lines, stations, open, onNavigate, onDeleteStation, onDeleteAll }) {
  const [expanded, setExpanded] = useState({});
  const toggle = (key) => setExpanded(e=>({...e,[key]:!e[key]}));

  if(!open) return null;

  const assignedIds = new Set(lines.flatMap(l=>l.stationIds));

  const navBtn = (onClick) => (
    <button
      onClick={e=>{ e.stopPropagation(); onClick(); }}
      title="Jump to this item in the workspace"
      style={{flexShrink:0,background:TEAL,color:"white",border:"none",borderRadius:3,
              padding:"1px 6px",cursor:"pointer",fontSize:10,opacity:0.85,lineHeight:1.6}}>
      →
    </button>
  );

  return (
    <div style={{
      width:230, flexShrink:0, background:"#f9f9f9", borderRight:"1px solid #e0e0e0",
      fontSize:12,
      // Sticky — stays visible while workspace scrolls
      position:"sticky", top:46, height:"calc(100vh - 46px)",
      overflowY:"auto", alignSelf:"flex-start",
    }}>
      <div style={{padding:"9px 12px",fontWeight:700,fontSize:10,textTransform:"uppercase",
                   letterSpacing:"0.6px",color:"#888",borderBottom:"1px solid #e0e0e0",
                   background:"white",position:"sticky",top:0,zIndex:1}}>
        Navigator
      </div>

      {lines.length===0 && (
        <div style={{padding:"16px 12px",color:"#bbb",fontStyle:"italic"}}>No lines yet</div>
      )}

      {lines.map(line => {
        const lineStations = line.stationIds.map(id=>stations.find(s=>s.id===id)).filter(Boolean);
        const lineOpen = !!expanded[line.id];
        return (
          <div key={line.id}>
            {/* Line row — click chevron/name to expand tree only, → button to navigate */}
            <div
              style={{display:"flex",alignItems:"center",gap:5,padding:"7px 8px 7px 10px",
                      cursor:"pointer",borderBottom:"1px solid #efefef",
                      background:lineOpen?"#e0f2f1":"white"}}
              onMouseEnter={e=>{if(!lineOpen)e.currentTarget.style.background="#f5fffe";}}
              onMouseLeave={e=>{if(!lineOpen)e.currentTarget.style.background=lineOpen?"#e0f2f1":"white";}}>
              {/* Expand/collapse chevron */}
              <span onClick={()=>toggle(line.id)}
                style={{fontSize:10,color:TEAL,width:12,flexShrink:0,userSelect:"none"}}>
                {lineOpen?"▼":"▶"}
              </span>
              {/* Label — click to expand tree */}
              <span onClick={()=>toggle(line.id)} style={{fontSize:13,flexShrink:0}}>🏗️</span>
              <span onClick={()=>toggle(line.id)}
                style={{fontWeight:700,color:TEAL_DARK,flex:1,overflow:"hidden",
                        textOverflow:"ellipsis",whiteSpace:"nowrap",fontSize:12,userSelect:"none"}}>
                {line.name||"New Line"}
              </span>
              <span onClick={()=>toggle(line.id)}
                style={{fontSize:10,color:"#bbb",flexShrink:0,marginRight:4}}>
                {lineStations.length}
              </span>
              {/* Navigate button */}
              {navBtn(()=>onNavigate("line",line.id))}
            </div>

            {lineOpen && lineStations.map(s => {
              const sOpen = !!expanded["s_"+s.id];
              return (
                <div key={s.id}>
                  {/* Station row */}
                  <div
                    style={{display:"flex",alignItems:"center",gap:5,padding:"5px 8px 5px 20px",
                            cursor:"pointer",borderBottom:"1px solid #f5f5f5",
                            background:sOpen?"#f0fdf4":"#fafafa"}}
                    onMouseEnter={e=>{if(!sOpen)e.currentTarget.style.background="#f0f8f0";}}
                    onMouseLeave={e=>{e.currentTarget.style.background=sOpen?"#f0fdf4":"#fafafa";}}>
                    <span onClick={()=>toggle("s_"+s.id)}
                      style={{fontSize:10,color:"#bbb",width:10,flexShrink:0,userSelect:"none"}}>
                      {s.tasks.length?(sOpen?"▼":"▶"):""}
                    </span>
                    <span onClick={()=>toggle("s_"+s.id)} style={{flexShrink:0}}>🏭</span>
                    <div onClick={()=>toggle("s_"+s.id)} style={{flex:1,overflow:"hidden",minWidth:0}}>
                      <div style={{fontWeight:600,color:TEAL_DARK,fontSize:11,
                                   overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                        {s.stationNo||s.sopId||"Station"}
                      </div>
                      {s.stationDesc&&<div style={{color:"#999",fontSize:10,overflow:"hidden",
                                                   textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                        {s.stationDesc}
                      </div>}
                    </div>
                    <span onClick={()=>toggle("s_"+s.id)}
                      style={{fontSize:10,color:"#bbb",flexShrink:0,marginRight:4}}>
                      {s.tasks.length}
                    </span>
                    {navBtn(()=>onNavigate("station",line.id,s.id))}
                  </div>

                  {/* Task rows */}
                  {sOpen && s.tasks.map(t=>(
                    <div key={t.id}
                      onClick={()=>onNavigate("task",line.id,s.id,t.id)}
                      title="Click to jump to this task"
                      style={{display:"flex",alignItems:"center",gap:5,padding:"4px 8px 4px 32px",
                              cursor:"pointer",borderBottom:"1px solid #f5f5f5",background:"white"}}
                      onMouseEnter={e=>e.currentTarget.style.background="#f0f8ff"}
                      onMouseLeave={e=>e.currentTarget.style.background="white"}>
                      <span style={{flexShrink:0,fontSize:11}}>📋</span>
                      <div style={{flex:1,overflow:"hidden",minWidth:0}}>
                        <span style={{color:"#aaa",fontSize:10}}>Task {t.taskNo}&nbsp;</span>
                        <span style={{color:"#444",fontSize:11,overflow:"hidden",
                                      textOverflow:"ellipsis",whiteSpace:"nowrap",display:"block",
                                      fontWeight:600}}>
                          {t.description||"(untitled)"}
                        </span>
                      </div>
                      <span style={{fontSize:10,color:"#ddd",flexShrink:0}}>{t.steps.length}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        );
      })}

      {/* Unassigned stations */}
      {(() => {
        const unassigned = stations.filter(s=>!assignedIds.has(s.id));
        if(!unassigned.length) return null;
        return (
          <div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                         padding:"5px 10px",background:"#f5f5f5",
                         borderTop:"1px solid #e0e0e0",borderBottom:"1px solid #e0e0e0"}}>
              <span style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.4px",color:"#aaa"}}>
                Unassigned ({unassigned.length})
              </span>
              <button onClick={()=>onDeleteAll(unassigned)}
                title="Delete all unassigned stations"
                style={{fontSize:10,padding:"1px 6px",background:"#ffebee",border:"1px solid #ef9a9a",
                        borderRadius:3,cursor:"pointer",color:"#c62828",lineHeight:1.4}}>
                Delete all
              </button>
            </div>
            {unassigned.map(s=>(
              <div key={s.id}
                style={{display:"flex",alignItems:"center",gap:5,padding:"5px 8px 5px 14px",
                        borderBottom:"1px solid #f5f5f5",background:"white",transition:"background 0.1s"}}
                onMouseEnter={e=>e.currentTarget.style.background="#fafafa"}
                onMouseLeave={e=>e.currentTarget.style.background="white"}>
                <span style={{fontSize:12,flexShrink:0}}>🏭</span>
                <div style={{flex:1,overflow:"hidden",minWidth:0,cursor:"pointer"}}
                     onClick={()=>onNavigate("station",null,s.id)}>
                  <div style={{fontWeight:600,color:"#aaa",fontSize:11,overflow:"hidden",
                               textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                    {s.stationNo||s.sopId||"Station"}
                  </div>
                  {s.stationDesc&&<div style={{color:"#ccc",fontSize:10,overflow:"hidden",
                                              textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.stationDesc}</div>}
                </div>
                <button onClick={e=>{e.stopPropagation();onDeleteStation(s);}}
                  title="Delete this station"
                  style={{background:"none",border:"none",color:"#ef9a9a",cursor:"pointer",
                          fontSize:13,padding:"0 2px",lineHeight:1,flexShrink:0}}>✕</button>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}

// ─── Export Save Modal ────────────────────────────────────────────────────────
function ExportSaveModal({ lines, stations, onClose }) {
  const [mode, setMode] = useState("all"); // "all" | "line"
  const [selLineId, setSelLineId] = useState(lines[0]?.id || "");
  const date = new Date().toISOString().slice(0,10);

  // Always resolve to a valid line id
  const validIds = lines.map(l=>l.id);
  const effectiveId = validIds.includes(selLineId) ? selLineId : (validIds[0] || "");
  const selectedLine = lines.find(l=>l.id===effectiveId);

  const lineFileName = (line) => {
    const raw = (line.name||"Line").replace(/[^a-zA-Z0-9_\- ]/g,"").trim().replace(/\s+/g,"_");
    return `${raw||"Line"}_${date}`;
  };
  const previewName = mode==="all" ? `All_Lines_${date}` : (selectedLine ? lineFileName(selectedLine) : "—");

  const doExport = () => {
    if(mode==="all") {
      saveFile(stations, lines, null, null, `All_Lines_${date}`);
    } else {
      if(!selectedLine){ alert("Please select a line."); return; }
      const lineStations = selectedLine.stationIds.map(id=>stations.find(s=>s.id===id)).filter(Boolean);
      saveFile(lineStations, [selectedLine], null, null, lineFileName(selectedLine));
    }
    onClose();
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{background:"white",borderRadius:12,padding:28,maxWidth:460,width:"90%",boxShadow:"0 8px 40px rgba(0,0,0,0.25)"}}>
        <div style={{fontWeight:700,fontSize:16,color:TEAL_DARK,marginBottom:4}}>⬇️ Export Save File</div>
        <div style={{fontSize:12,color:"#666",marginBottom:20}}>Choose what to include in the exported file.</div>

        {/* All Lines option */}
        <label style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",borderRadius:8,
            border:`2px solid ${mode==="all"?TEAL:"#e0e0e0"}`,background:mode==="all"?TEAL_LIGHT:"#fafafa",
            cursor:"pointer",marginBottom:10}}>
          <input type="radio" name="em" checked={mode==="all"} onChange={()=>setMode("all")} style={{accentColor:TEAL,width:16,height:16}}/>
          <div>
            <div style={{fontWeight:600,fontSize:13}}>All Lines</div>
            <div style={{fontSize:11,color:"#666"}}>{lines.length} line(s) · {stations.length} station(s)</div>
          </div>
        </label>

        {/* Single Line option — always shows dropdown */}
        {lines.length > 0 && (
          <label style={{display:"flex",alignItems:"flex-start",gap:10,padding:"12px 14px",borderRadius:8,
              border:`2px solid ${mode==="line"?TEAL:"#e0e0e0"}`,background:mode==="line"?TEAL_LIGHT:"#fafafa",
              cursor:"pointer",marginBottom:20}}>
            <input type="radio" name="em" checked={mode==="line"} onChange={()=>setMode("line")} style={{accentColor:TEAL,width:16,height:16,marginTop:2}}/>
            <div style={{flex:1}}>
              <div style={{fontWeight:600,fontSize:13,marginBottom:8}}>Single Line</div>
              <select
                value={effectiveId}
                onChange={e=>{ setSelLineId(e.target.value); setMode("line"); }}
                onClick={e=>{ e.stopPropagation(); setMode("line"); }}
                style={{width:"100%",padding:"6px 8px",border:`1px solid ${mode==="line"?TEAL:"#ccc"}`,
                        borderRadius:5,fontSize:12,background:"white",cursor:"pointer"}}>
                {lines.map(l=>{
                  const count=l.stationIds.filter(id=>stations.find(s=>s.id===id)).length;
                  return <option key={l.id} value={l.id}>🏗️ {l.name||"(unnamed)"} — {count} station(s)</option>;
                })}
              </select>
            </div>
          </label>
        )}

        {/* Filename preview */}
        <div style={{background:"#f5f5f5",borderRadius:6,padding:"8px 12px",marginBottom:20,display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:11,color:"#888",flexShrink:0}}>Filename:</span>
          <span style={{fontFamily:"monospace",fontSize:12,color:TEAL_DARK,fontWeight:600,wordBreak:"break-all"}}>{previewName}.json</span>
        </div>

        <div style={{display:"flex",gap:10}}>
          <button onClick={doExport}
            style={{flex:1,background:TEAL,color:"white",border:"none",borderRadius:7,padding:"10px 0",cursor:"pointer",fontSize:13,fontWeight:700}}>
            ⬇️ Download
          </button>
          <button onClick={onClose}
            style={{flex:1,background:"#f5f5f5",color:"#555",border:"1px solid #ddd",borderRadius:7,padding:"10px 0",cursor:"pointer",fontSize:13}}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Confirm Delete Modal ─────────────────────────────────────────────────────
function ConfirmDeleteModal({ type, name, onConfirm, onCancel }) {
  const colors = {
    step:    { bg:"#fff3e0", border:"#ffb74d", icon:"🔢", accent:"#e65100" },
    task:    { bg:"#fff3e0", border:"#ffb74d", icon:"📋", accent:"#e65100" },
    station: { bg:"#ffebee", border:"#ef9a9a", icon:"🏭", accent:"#c62828" },
    line:    { bg:"#ffebee", border:"#ef9a9a", icon:"🏗️", accent:"#c62828" },
  };
  const c = colors[type] || colors.station;
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:4000,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{background:"white",borderRadius:12,padding:28,maxWidth:420,width:"90%",boxShadow:"0 8px 40px rgba(0,0,0,0.25)"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
          <span style={{fontSize:32}}>{c.icon}</span>
          <div>
            <div style={{fontWeight:700,fontSize:16,color:"#222"}}>Delete {type}?</div>
            <div style={{fontSize:12,color:"#888",marginTop:2}}>This cannot be undone.</div>
          </div>
        </div>
        <div style={{background:c.bg,border:`1px solid ${c.border}`,borderRadius:8,padding:"12px 14px",marginBottom:20}}>
          <div style={{fontSize:13,color:"#333",marginBottom:6}}>
            You are about to permanently delete:
          </div>
          <div style={{fontWeight:700,fontSize:14,color:c.accent,wordBreak:"break-word"}}>
            {c.icon} {name || `this ${type}`}
          </div>
          {(type==="station"||type==="line") && (
            <div style={{fontSize:12,color:"#666",marginTop:8,borderTop:`1px solid ${c.border}`,paddingTop:8}}>
              ⚠️ {type==="line"
                ? "All stations, tasks, and steps within this line will also be removed from the line. Station data is not deleted but will be unassigned."
                : "All tasks and steps within this station will be permanently deleted."}
            </div>
          )}
        </div>
        <div style={{display:"flex",gap:10}}>
          <button onClick={onCancel}
            style={{flex:1,background:"#f5f5f5",color:"#444",border:"1px solid #ddd",borderRadius:7,padding:"10px 0",cursor:"pointer",fontSize:13,fontWeight:600}}>
            Cancel
          </button>
          <button onClick={onConfirm}
            style={{flex:1,background:c.accent,color:"white",border:"none",borderRadius:7,padding:"10px 0",cursor:"pointer",fontSize:13,fontWeight:700}}>
            Yes, Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── New Project Modal ────────────────────────────────────────────────────────
function NewProjectModal({ onConfirm, onCancel }) {
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:4000,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{background:"white",borderRadius:12,padding:28,maxWidth:440,width:"90%",boxShadow:"0 8px 40px rgba(0,0,0,0.25)"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
          <span style={{fontSize:32}}>🆕</span>
          <div>
            <div style={{fontWeight:700,fontSize:16,color:"#222"}}>Start New Project?</div>
            <div style={{fontSize:12,color:"#888",marginTop:2}}>This will clear the current workspace.</div>
          </div>
        </div>
        <div style={{background:"#fff8e1",border:"1px solid #ffe082",borderRadius:8,padding:"12px 14px",marginBottom:20}}>
          <div style={{fontSize:13,color:"#555",lineHeight:1.7}}>
            Starting a new project will <strong>clear all lines, stations, tasks, and steps</strong> from the current workspace.<br/><br/>
            <strong style={{color:"#e65100"}}>Make sure you have saved your current work</strong> using <strong>💾 Save</strong> or <strong>⬇️ Export Save</strong> before continuing.
          </div>
        </div>
        <div style={{display:"flex",gap:10}}>
          <button onClick={onCancel}
            style={{flex:1,background:"#f5f5f5",color:"#444",border:"1px solid #ddd",borderRadius:7,padding:"10px 0",cursor:"pointer",fontSize:13,fontWeight:600}}>
            Cancel
          </button>
          <button onClick={onConfirm}
            style={{flex:1,background:TEAL,color:"white",border:"none",borderRadius:7,padding:"10px 0",cursor:"pointer",fontSize:13,fontWeight:700}}>
            Yes, Start New Project
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Changelog Modal ──────────────────────────────────────────────────────────
function ChangelogModal({ onClose }) {
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:4000,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{background:"white",borderRadius:12,padding:0,maxWidth:580,width:"95%",maxHeight:"85vh",
                   display:"flex",flexDirection:"column",boxShadow:"0 8px 40px rgba(0,0,0,0.25)"}}>
        {/* Header */}
        <div style={{background:TEAL_DARK,color:"white",padding:"14px 20px",borderRadius:"12px 12px 0 0",
                     display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
          <div>
            <div style={{fontWeight:700,fontSize:15}}>📋 LVT SOP Builder — Changelog</div>
            <div style={{fontSize:11,opacity:0.8,marginTop:2}}>Current version: v{APP_VERSION}</div>
          </div>
          <button onClick={onClose}
            style={{background:"rgba(255,255,255,0.2)",border:"none",color:"white",
                    borderRadius:4,padding:"4px 10px",cursor:"pointer",fontSize:13}}>✕</button>
        </div>

        {/* Entries */}
        <div style={{overflowY:"auto",flex:1,padding:"16px 20px"}}>
          {CHANGELOG.map((entry, ei) => (
            <div key={entry.version} style={{marginBottom:20,paddingBottom:20,
                 borderBottom: ei < CHANGELOG.length-1 ? "1px solid #f0f0f0" : "none"}}>
              <div style={{display:"flex",alignItems:"baseline",gap:10,marginBottom:8}}>
                <span style={{fontWeight:700,fontSize:14,color:TEAL_DARK}}>v{entry.version}</span>
                <span style={{fontSize:11,color:"#aaa"}}>{entry.date}</span>
                {ei===0 && (
                  <span style={{background:TEAL,color:"white",fontSize:10,fontWeight:700,
                                padding:"1px 7px",borderRadius:10}}>LATEST</span>
                )}
              </div>
              <ul style={{margin:0,paddingLeft:18,listStyle:"disc"}}>
                {entry.notes.map((note, ni) => (
                  <li key={ni} style={{fontSize:12,color:"#444",marginBottom:4,lineHeight:1.6}}>
                    {note}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── File Conflict Modal ──────────────────────────────────────────────────────
// Shown when the file on disk is newer than when the user opened it.
function FileConflictModal({ fileName, openedAt, fileUpdatedAt, onOverwrite, onMerge, onCancel }) {
  const fmt = (iso) => { try { return new Date(iso).toLocaleString(); } catch { return iso||"unknown"; } };
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.65)",zIndex:5000,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{background:"white",borderRadius:12,padding:28,maxWidth:480,width:"95%",boxShadow:"0 8px 40px rgba(0,0,0,0.3)"}}>
        <div style={{display:"flex",gap:12,alignItems:"flex-start",marginBottom:16}}>
          <span style={{fontSize:36}}>⚠️</span>
          <div>
            <div style={{fontWeight:700,fontSize:16,color:"#b71c1c"}}>File Updated by Someone Else</div>
            <div style={{fontSize:12,color:"#888",marginTop:2}}>{fileName}</div>
          </div>
        </div>

        <div style={{background:"#ffebee",border:"1px solid #ef9a9a",borderRadius:8,padding:"12px 14px",marginBottom:14}}>
          <div style={{fontSize:13,color:"#333",lineHeight:1.7}}>
            This file was <strong>updated after you opened it</strong>. Another user may have made changes.
            Saving now would overwrite their work.
          </div>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20,fontSize:12}}>
          <div style={{background:"#f5f5f5",borderRadius:6,padding:"10px 12px"}}>
            <div style={{color:"#888",marginBottom:3}}>You opened it at</div>
            <div style={{fontWeight:700,color:"#555"}}>{fmt(openedAt)}</div>
          </div>
          <div style={{background:"#fff3e0",borderRadius:6,padding:"10px 12px",border:"1px solid #ffcc80"}}>
            <div style={{color:"#e65100",marginBottom:3}}>File last saved at</div>
            <div style={{fontWeight:700,color:"#e65100"}}>{fmt(fileUpdatedAt)}</div>
          </div>
        </div>

        <div style={{fontSize:12,color:"#555",marginBottom:16,lineHeight:1.7}}>
          <strong>What would you like to do?</strong>
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          <button onClick={onMerge}
            style={{background:TEAL,color:"white",border:"none",borderRadius:7,padding:"11px 0",cursor:"pointer",fontSize:13,fontWeight:700}}>
            📥 Review file changes before saving
          </button>
          <button onClick={onOverwrite}
            style={{background:"#ffebee",color:"#c62828",border:"2px solid #ef9a9a",borderRadius:7,padding:"10px 0",cursor:"pointer",fontSize:13,fontWeight:600}}>
            ⚠️ Overwrite anyway (discard their changes)
          </button>
          <button onClick={onCancel}
            style={{background:"#f5f5f5",color:"#555",border:"1px solid #ddd",borderRadius:7,padding:"10px 0",cursor:"pointer",fontSize:13}}>
            Cancel — don't save yet
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Merge Line Modal ─────────────────────────────────────────────────────────
// Shown when an incoming line matches an existing line in the workspace.
// User chooses: keep theirs / use file / keep both.
function MergeLineModal({ conflicts, nonConflicts, onResolve, onCancel }) {
  // resolutions: { lineId: "keep" | "replace" | "both" }
  const [resolutions, setResolutions] = useState(() => {
    const init = {};
    conflicts.forEach(c => { init[c.existing.id] = "keep"; });
    return init;
  });

  const fmtDate = (iso) => {
    if(!iso) return "unknown";
    try { return new Date(iso).toLocaleString(); } catch { return iso; }
  };

  const setRes = (id, val) => setResolutions(r => ({...r, [id]: val}));

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:4000,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{background:"white",borderRadius:12,padding:0,maxWidth:600,width:"95%",maxHeight:"90vh",display:"flex",flexDirection:"column",boxShadow:"0 8px 40px rgba(0,0,0,0.3)"}}>
        {/* Header */}
        <div style={{background:TEAL_DARK,color:"white",padding:"14px 20px",borderRadius:"12px 12px 0 0",flexShrink:0}}>
          <div style={{fontWeight:700,fontSize:15}}>📥 Add Line to Workspace</div>
          <div style={{fontSize:12,opacity:0.8,marginTop:2}}>
            {nonConflicts.length > 0 && `${nonConflicts.length} new line(s) will be added. `}
            {conflicts.length > 0 && `${conflicts.length} line(s) already exist in your workspace — choose what to do.`}
          </div>
        </div>

        <div style={{padding:20,overflowY:"auto",flex:1}}>

          {/* New lines — no conflicts */}
          {nonConflicts.length > 0 && (
            <div style={{marginBottom:20}}>
              <div style={{fontWeight:600,fontSize:13,color:"#2e7d32",marginBottom:8}}>
                ✅ New lines (will be added automatically):
              </div>
              {nonConflicts.map(l => (
                <div key={l.id} style={{padding:"8px 12px",background:"#e8f5e9",borderRadius:6,marginBottom:4,fontSize:13}}>
                  🏗️ <strong>{l.name||"(unnamed)"}</strong>
                  <span style={{fontSize:11,color:"#666",marginLeft:8}}>{l.stationIds.length} station(s)</span>
                  {l.savedAt && <span style={{fontSize:10,color:"#888",marginLeft:8}}>saved {new Date(l.savedAt).toLocaleString()}</span>}
                </div>
              ))}
            </div>
          )}

          {/* Conflicting lines */}
          {conflicts.map(({existing, incoming}) => {
            const existingNewer = existing.savedAt && incoming.savedAt && existing.savedAt > incoming.savedAt;
            const incomingNewer = existing.savedAt && incoming.savedAt && incoming.savedAt > existing.savedAt;
            const res = resolutions[existing.id];
            return (
              <div key={existing.id} style={{border:"2px solid #ffb74d",borderRadius:8,padding:14,marginBottom:14,background:"#fffde7"}}>
                <div style={{fontWeight:700,fontSize:13,color:"#e65100",marginBottom:10}}>
                  ⚠️ Conflict: <strong>{existing.name||"(unnamed)"}</strong>
                </div>

                {/* Version comparison */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
                  <div style={{background:existingNewer?"#e8f5e9":"#f5f5f5",borderRadius:6,padding:10,border:existingNewer?"2px solid #81c784":"1px solid #e0e0e0"}}>
                    <div style={{fontSize:11,fontWeight:700,color:existingNewer?TEAL_DARK:"#555",marginBottom:4}}>
                      Your version {existingNewer?"✓ NEWER":""}
                    </div>
                    <div style={{fontSize:11,color:"#666"}}>
                      {existing.stationIds.length} station(s)<br/>
                      <span style={{fontSize:10}}>Last saved: {fmtDate(existing.savedAt)}</span>
                    </div>
                  </div>
                  <div style={{background:incomingNewer?"#e8f5e9":"#f5f5f5",borderRadius:6,padding:10,border:incomingNewer?"2px solid #81c784":"1px solid #e0e0e0"}}>
                    <div style={{fontSize:11,fontWeight:700,color:incomingNewer?TEAL_DARK:"#555",marginBottom:4}}>
                      File version {incomingNewer?"✓ NEWER":""}
                    </div>
                    <div style={{fontSize:11,color:"#666"}}>
                      {incoming.stationIds.length} station(s)<br/>
                      <span style={{fontSize:10}}>Last saved: {fmtDate(incoming.savedAt)}</span>
                    </div>
                  </div>
                </div>

                {/* Resolution options */}
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {[
                    {val:"keep",    label:"Keep your version",          desc:"Discard the file version, keep what you have"},
                    {val:"replace", label:"Use file version",           desc:"Replace your version with the one from the file"},
                    {val:"both",    label:"Keep both (add as new line)", desc:"Add the file version as a separate line with a copy suffix"},
                  ].map(opt => (
                    <label key={opt.val} style={{display:"flex",alignItems:"flex-start",gap:8,padding:"8px 10px",borderRadius:6,
                        border:`2px solid ${res===opt.val?TEAL:"#e0e0e0"}`,background:res===opt.val?TEAL_LIGHT:"white",cursor:"pointer"}}>
                      <input type="radio" name={`res_${existing.id}`} value={opt.val} checked={res===opt.val}
                        onChange={()=>setRes(existing.id,opt.val)} style={{marginTop:2,accentColor:TEAL}}/>
                      <div>
                        <div style={{fontSize:12,fontWeight:600}}>{opt.label}</div>
                        <div style={{fontSize:11,color:"#777"}}>{opt.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{padding:"12px 20px",borderTop:"1px solid #e0e0e0",display:"flex",gap:10,flexShrink:0}}>
          <button onClick={onCancel}
            style={{flex:1,background:"#f5f5f5",color:"#555",border:"1px solid #ddd",borderRadius:7,padding:"10px 0",cursor:"pointer",fontSize:13}}>
            Cancel
          </button>
          <button onClick={()=>onResolve(resolutions)}
            style={{flex:2,background:TEAL,color:"white",border:"none",borderRadius:7,padding:"10px 0",cursor:"pointer",fontSize:13,fontWeight:700}}>
            ✓ Apply & Add to Workspace
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Link Files Modal ─────────────────────────────────────────────────────────
// Shown after a line is imported. One modal, two paths:
//   A) Use existing files — open file pickers for the same JSON + CSV
//   B) Create new files  — Save As dialogs to name/place new files
// The actual file pickers are separate OS dialogs but triggered back-to-back.
function LinkFilesModal({ lineIds, sourceFileName, onLink, onSkip }) {
  const [status, setStatus] = useState(""); // feedback during picker sequence
  const baseName = (sourceFileName||"").replace(/\.json$/i,"");
  const lineWord = lineIds.length === 1 ? "line" : `${lineIds.length} lines`;

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:4000,
                 display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{background:"white",borderRadius:12,padding:28,maxWidth:480,width:"95%",
                   boxShadow:"0 8px 40px rgba(0,0,0,0.25)"}}>

        {/* Header */}
        <div style={{display:"flex",gap:12,alignItems:"flex-start",marginBottom:16}}>
          <span style={{fontSize:32}}>🔗</span>
          <div>
            <div style={{fontWeight:700,fontSize:15,color:TEAL_DARK}}>Link Save Files</div>
            <div style={{fontSize:12,color:"#888",marginTop:2}}>
              {lineIds.length === 1 ? "1 line was added to your workspace" : `${lineIds.length} lines were added to your workspace`}
            </div>
          </div>
        </div>

        <div style={{background:"#f9f9f9",borderRadius:8,padding:"10px 14px",marginBottom:18,fontSize:12,color:"#555",lineHeight:1.7}}>
          Link this {lineWord} to save files so 💾 Save writes directly back to them.<br/>
          Two file dialogs will open in sequence — JSON first, then CSV.
        </div>

        {status && (
          <div style={{background:TEAL_LIGHT,border:`1px solid ${TEAL}`,borderRadius:6,
                       padding:"8px 12px",marginBottom:14,fontSize:12,color:TEAL_DARK,fontWeight:600}}>
            {status}
          </div>
        )}

        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {/* Option A — use existing files */}
          <div style={{border:`2px solid ${TEAL}`,borderRadius:8,padding:"14px 16px"}}>
            <div style={{fontWeight:700,fontSize:13,color:TEAL_DARK,marginBottom:4}}>
              📂 Use existing files
            </div>
            <div style={{fontSize:12,color:"#666",marginBottom:10,lineHeight:1.6}}>
              Already have <code style={{background:"#e0f2f1",padding:"1px 5px",borderRadius:3}}>{sourceFileName}</code> and its CSV?
              Navigate to them to link and authorize writes.
            </div>
            <button onClick={()=>onLink("existing", setStatus)}
              style={{width:"100%",background:TEAL,color:"white",border:"none",borderRadius:7,
                      padding:"10px 0",cursor:"pointer",fontSize:13,fontWeight:700}}>
              📂 Browse for {sourceFileName} + CSV
            </button>
          </div>

          {/* Option B — create new files */}
          <div style={{border:"1px solid #e0e0e0",borderRadius:8,padding:"14px 16px",background:"#fafafa"}}>
            <div style={{fontWeight:700,fontSize:13,color:"#444",marginBottom:4}}>
              💾 Create new files
            </div>
            <div style={{fontSize:12,color:"#777",marginBottom:10,lineHeight:1.6}}>
              Save this {lineWord} to a new location. Choose a folder and filename for the JSON, then the CSV.
            </div>
            <button onClick={()=>onLink("new", setStatus)}
              style={{width:"100%",background:"#f5f5f5",color:"#444",border:"1px solid #ddd",borderRadius:7,
                      padding:"10px 0",cursor:"pointer",fontSize:13,fontWeight:600}}>
              💾 Choose where to save…
            </button>
          </div>

          {/* Skip */}
          <button onClick={onSkip}
            style={{background:"none",color:"#aaa",border:"none",cursor:"pointer",
                    fontSize:12,padding:"6px 0",textDecoration:"underline"}}>
            Skip — I'll link files later
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Reconnect Files Modal ────────────────────────────────────────────────────
// Shown on load when lines have stored filenames but no active handles.
function ReconnectModal({ queue, onReconnect, onDismiss }) {
  const [idx, setIdx] = useState(0);
  const line = queue[idx];
  if(!line) return null;

  const isLast = idx === queue.length - 1;

  const skip = () => {
    if(isLast) onDismiss();
    else setIdx(i=>i+1);
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:4000,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{background:"white",borderRadius:12,padding:28,maxWidth:460,width:"95%",boxShadow:"0 8px 40px rgba(0,0,0,0.25)"}}>
        <div style={{display:"flex",gap:12,alignItems:"flex-start",marginBottom:16}}>
          <span style={{fontSize:30}}>🔗</span>
          <div>
            <div style={{fontWeight:700,fontSize:15,color:TEAL_DARK}}>
              {line.isGlobal ? "Reconnect Workspace File" : "Reconnect Line File"}
            </div>
            <div style={{fontSize:12,color:"#888",marginTop:2}}>
              {idx+1} of {queue.length} file(s) to reconnect this session
            </div>
          </div>
        </div>

        <div style={{background:TEAL_LIGHT,border:"1px solid #80cbc4",borderRadius:8,padding:"12px 14px",marginBottom:16}}>
          <div style={{fontWeight:700,fontSize:13,color:TEAL_DARK,marginBottom:4}}>
            {line.isGlobal ? "🗂️ All Lines (Workspace)" : `🏗️ ${line.name||"(unnamed line)"}`}
          </div>
          <div style={{fontSize:12,color:"#555",lineHeight:1.6}}>
            Previously linked to:<br/>
            <code style={{background:"#e0f2f1",padding:"1px 6px",borderRadius:3,fontSize:12}}>
              {line.linkedFileName}
            </code>
            {line.linkedCsvName && (
              <span> + <code style={{background:"#e0f2f1",padding:"1px 6px",borderRadius:3,fontSize:12}}>{line.linkedCsvName}</code></span>
            )}
          </div>
        </div>

        <div style={{fontSize:12,color:"#666",marginBottom:18,lineHeight:1.6}}>
          Browser security requires re-selecting files each session. Navigate to the same file — saves will write back to it automatically for the rest of this session.
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          <button onClick={()=>onReconnect(line, idx, isLast)}
            style={{background:TEAL,color:"white",border:"none",borderRadius:7,padding:"11px 0",cursor:"pointer",fontSize:13,fontWeight:700}}>
            📂 Browse for "{line.linkedFileName}"
          </button>
          {line.linkedCsvName && (
            <div style={{fontSize:11,color:"#888",textAlign:"center"}}>
              You'll also be asked to locate the CSV file
            </div>
          )}
          <button onClick={skip}
            style={{background:"#f5f5f5",color:"#555",border:"1px solid #ddd",borderRadius:7,padding:"10px 0",cursor:"pointer",fontSize:13}}>
            {isLast ? "Done — skip remaining" : "Skip this line →"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Save Info Modal ──────────────────────────────────────────────────────────
function SaveInfoModal({ onExport, onClose }) {
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{background:"white",borderRadius:12,padding:28,maxWidth:480,width:"90%",boxShadow:"0 8px 40px rgba(0,0,0,0.25)"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:18}}>
          <span style={{fontSize:28}}>💾</span>
          <div>
            <div style={{fontWeight:700,fontSize:16,color:TEAL_DARK}}>Your progress has been saved</div>
            <div style={{fontSize:12,color:"#888",marginTop:2}}>Here's what that means</div>
          </div>
        </div>
        <div style={{background:TEAL_LIGHT,borderRadius:8,padding:14,marginBottom:14,border:"1px solid #80cbc4"}}>
          <div style={{fontWeight:700,fontSize:13,color:TEAL_DARK,marginBottom:6}}>✅ Auto-saved to this browser</div>
          <div style={{fontSize:12,color:"#444",lineHeight:1.6}}>
            Your work is stored in <strong>this browser's local storage</strong> on this computer.
            It will survive page refreshes and closing the tab.
            <br/><br/>
            <strong style={{color:"#c62828"}}>⚠️ It will be lost if you:</strong>
            <ul style={{margin:"6px 0 0 16px",padding:0,lineHeight:1.8}}>
              <li>Clear your browser's cache or browsing data</li>
              <li>Open the app in a different browser (Chrome vs Edge)</li>
              <li>Open the app on a different computer</li>
            </ul>
          </div>
        </div>
        <div style={{background:"#fff8e1",borderRadius:8,padding:14,marginBottom:20,border:"1px solid #ffe082"}}>
          <div style={{fontWeight:700,fontSize:13,color:"#e65100",marginBottom:6}}>📁 For a real portable backup — Export a Save File</div>
          <div style={{fontSize:12,color:"#444",lineHeight:1.6}}>
            Use <strong>⬇️ Export Save</strong> to download a <code style={{background:"#f5f5f5",padding:"1px 5px",borderRadius:3}}>.json</code> file to your computer. This file can be:
            <ul style={{margin:"6px 0 0 16px",padding:0,lineHeight:1.8}}>
              <li>Stored on your desktop, network drive, or USB</li>
              <li>Shared with teammates (they use 📂 Load File to open it)</li>
              <li>Loaded on any computer or browser</li>
            </ul>
          </div>
        </div>
        <div style={{background:TEAL_LIGHT,borderRadius:8,padding:12,marginBottom:14,border:`1px solid #80cbc4`,fontSize:12,color:"#444"}}>
          <strong style={{color:TEAL_DARK}}>💡 Tip — work directly on a file:</strong><br/>
          Use <strong>📂 Open File</strong> to open a <code>.json</code> from anywhere (Google Drive sync folder, network drive, desktop).
          After that, <strong>💾 Save</strong> writes back to that exact file automatically — no dialogs, no new copies.
        </div>
        <div style={{display:"flex",gap:10}}>
          <button onClick={()=>{onExport();onClose();}}
            style={{flex:1,background:TEAL,color:"white",border:"none",borderRadius:7,padding:"10px 0",cursor:"pointer",fontSize:13,fontWeight:700}}>
            ⬇️ Export Save File Now
          </button>
          <button onClick={onClose}
            style={{flex:1,background:"#f5f5f5",color:"#555",border:"1px solid #ddd",borderRadius:7,padding:"10px 0",cursor:"pointer",fontSize:13}}>
            Got it, close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── More Menu Dropdown ───────────────────────────────────────────────────────
function MoreMenu({ items }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  useEffect(()=>{
    const handler = (e) => { if(ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return ()=>document.removeEventListener("mousedown", handler);
  },[]);
  return (
    <div ref={ref} style={{position:"relative",flexShrink:0}}>
      <button onClick={()=>setOpen(o=>!o)}
        style={{background:open?"rgba(255,255,255,0.2)":"rgba(255,255,255,0.12)",
                border:"1px solid rgba(255,255,255,0.3)",borderRadius:5,
                padding:"5px 10px",cursor:"pointer",fontSize:12,color:"white",
                display:"flex",alignItems:"center",gap:4}}>
        More ▾
      </button>
      {open && (
        <div style={{position:"absolute",right:0,top:"calc(100% + 4px)",
                     background:"white",borderRadius:8,boxShadow:"0 4px 20px rgba(0,0,0,0.2)",
                     minWidth:180,zIndex:600,overflow:"hidden",border:"1px solid #e0e0e0"}}>
          {items.map((item,i)=>(
            <button key={i} onClick={()=>{item.action();setOpen(false);}}
              style={{display:"block",width:"100%",textAlign:"left",
                      padding:"10px 16px",fontSize:13,background:"none",border:"none",
                      borderBottom:i<items.length-1?"1px solid #f0f0f0":"none",
                      cursor:"pointer",color:"#333"}}
              onMouseEnter={e=>e.currentTarget.style.background="#f5f5f5"}
              onMouseLeave={e=>e.currentTarget.style.background="none"}>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
// Load once at module level — never re-runs on re-render
const _initialData = lsLoad();

export default function App() {
  const [stations, setStations] = useState(()=> _initialData ? _initialData.stations : []);
  const [lines,    setLines]    = useState(()=> _initialData ? _initialData.lines    : []);
  // Restore stored filenames so reconnect prompt shows them on next open
  const _storedActiveFileName    = _initialData?.activeFileName    || null;
  const _storedActiveFileCsvName = _initialData?.activeFileCsvName || null;
  const [active,   setActive]   = useState(null);
  const [tab,      setTab]      = useState("lines");
  const [preview,  setPreview]  = useState(null);
  const [saveMsg,  setSaveMsg]  = useState("");
  const [showSaveInfo,   setShowSaveInfo]   = useState(false);
  const [showImport,     setShowImport]     = useState(false);
  const [showCsvRestore, setShowCsvRestore] = useState(false);
  const [showExportSave, setShowExportSave] = useState(false);
  const [deletePrompt,   setDeletePrompt]   = useState(null); // {type, name, ids}
  const [sidebarOpen,    setSidebarOpen]    = useState(true);
  const [showNewProject, setShowNewProject] = useState(false);
  const [showChangelog,  setShowChangelog]  = useState(false);
  const [csvPrompt,      setCsvPrompt]      = useState(null); // {baseName, onLink, onSkip}
  const [mergePrompt,    setMergePrompt]    = useState(null); // {conflicts, nonConflicts, incomingStations}
  const [reconnectQueue,   setReconnectQueue]   = useState([]); // lines needing file reconnect
  const [linkFilesPrompt,  setLinkFilesPrompt]  = useState(null); // {lineIds, sourceHandle, sourceFileName} after merge
  const [fileConflict,   setFileConflict]   = useState(null); // {fileUpdatedAt, pendingSave}
  const openedAtRef = useRef(null); // timestamp when current file was opened/last-saved

  // Open a line file and merge into workspace
  const openLineFile = async () => {
    if(!window.showOpenFilePicker) return;
    try {
      const [handle] = await window.showOpenFilePicker({
        types:[{description:"SOP Builder Save File",accept:{"application/json":[".json"]}}],
        multiple:false
      });
      const file = await handle.getFile();
      loadFile(file, loaded => {
        const incomingLines    = loaded.lines||[];
        const incomingStations = loaded.stations||[];

        if(incomingLines.length===0){
          flash("No lines found in that file.");
          return;
        }

        // Detect conflicts by line name (case-insensitive) as the shared identity key
        const conflicts    = [];
        const nonConflicts = [];
        incomingLines.forEach(il => {
          const match = lines.find(l => l.name.trim().toLowerCase() === (il.name||"").trim().toLowerCase());
          if(match) conflicts.push({existing:match, incoming:il});
          else nonConflicts.push(il);
        });

        setMergePrompt({conflicts, nonConflicts, incomingStations, incomingLines, sourceHandle: handle, sourceFileName: file.name});
      });
    } catch(e){ if(e.name!=="AbortError") flash("Could not open file."); }
  };

  // Apply merge resolutions
  const applyMerge = (resolutions) => {
    if(!mergePrompt) return;
    const {conflicts, nonConflicts, incomingStations, incomingLines} = mergePrompt;

    let newStations = [...stations];
    let newLines    = [...lines];

    // Helper: add incoming stations for a line, remapping IDs to avoid collisions
    const addStationsForLine = (incomingLine) => {
      const idMap = {};
      incomingLine.stationIds.forEach(oldId => {
        const s = incomingStations.find(st => st.id===oldId);
        if(!s) return;
        const newS = {...s, id: Date.now()+Math.random()};
        idMap[oldId] = newS.id;
        newStations.push(migrateStation(newS));
      });
      return {...incomingLine, stationIds: incomingLine.stationIds.map(id=>idMap[id]||id)};
    };

    // Add non-conflicting lines
    nonConflicts.forEach(il => {
      const mapped = addStationsForLine(il);
      newLines.push({...mapped, id: Date.now()+Math.random()});
    });

    // Resolve conflicts
    conflicts.forEach(({existing, incoming}) => {
      const res = resolutions[existing.id] || "keep";
      if(res==="keep") {
        // Do nothing — keep existing
      } else if(res==="replace") {
        // Remove existing stations, add incoming stations, replace line entry
        newStations = newStations.filter(s => !existing.stationIds.includes(s.id));
        const mapped = addStationsForLine(incoming);
        newLines = newLines.map(l => l.id===existing.id ? {...mapped, id:existing.id} : l);
      } else if(res==="both") {
        // Keep existing, add incoming as a new line with copy suffix
        const copy = {...incoming, name:(incoming.name||"Line")+" (imported)", id:Date.now()+Math.random()};
        const mapped = addStationsForLine(copy);
        newLines.push(mapped);
      }
    });

    setStations(newStations);
    setLines(newLines);
    setMergePrompt(null);

    // Collect IDs of lines that were just imported (new or replaced)
    // Build a map from incoming line name → new line ID so we can link files correctly
    const importedLineIds = [];
    nonConflicts.forEach(il => {
      // Find the line we just pushed — match by name since we remapped the ID
      const created = newLines.find(l =>
        l.name === il.name && !lines.some(existing => existing.id === l.id)
      );
      if(created) importedLineIds.push(created.id);
    });
    conflicts.forEach(({existing}) => {
      const res = resolutions[existing.id] || "keep";
      if(res === "replace" || res === "both") importedLineIds.push(existing.id);
    });

    if(importedLineIds.length > 0 && mergePrompt.sourceHandle) {
      setLinkFilesPrompt({
        lineIds: importedLineIds,
        sourceHandle: mergePrompt.sourceHandle,
        sourceFileName: mergePrompt.sourceFileName,
        newLines,
      });
    } else {
      flash(`✓ Merged ${nonConflicts.length + conflicts.length} line(s) into workspace`);
    }
  };

  // confirmDelete — stores type + ids, executes deletion with fresh state on confirm
  // ids: { lineId, stationId, taskIdx, stepIdx }  (only the relevant ones)
  const confirmDelete = (type, name, ids={}) => setDeletePrompt({type, name, ids});

  // Execute the actual delete using current state (always fresh)
  const executeDelete = (type, ids) => {
    if(type==="line") {
      setLines(prev => prev.filter(l => l.id !== ids.lineId));
    } else if(type==="station") {
      setStations(prev => prev.filter(s => s.id !== ids.stationId));
      setLines(prev => prev.map(l => ({...l, stationIds: l.stationIds.filter(id => id !== ids.stationId)})));
    } else if(type==="task") {
      setStations(prev => prev.map(s => {
        if(s.id !== ids.stationId) return s;
        return {...s, tasks: reindex(s.tasks.filter((_,i) => i !== ids.taskIdx), s.sopId)};
      }));
    } else if(type==="step") {
      setStations(prev => prev.map(s => {
        if(s.id !== ids.stationId) return s;
        return {...s, tasks: s.tasks.map(t => {
          if(t.id !== ids.taskId) return t;
          return {...t, steps: t.steps.filter((_,si) => si !== ids.stepIdx)};
        })};
      }));
    }
    setDeletePrompt(null);
  };
  const [activeFileHandle, setActiveFileHandle] = useState(null); // global (All Lines) handle — lost on refresh, reconnected via prompt
  const [activeFileName,   setActiveFileName]   = useState(_storedActiveFileName||"");
  const [lineHandles,      setLineHandles]      = useState({});   // lineId → {handle, name}
  const [stationHandles,   setStationHandles]   = useState({});   // stationId → {handle, name}
  const loadRef = useRef();

  // Helpers for setting per-scope handles
  const setLineHandle = (lineId, handle, name, csvName) => {
    setLineHandles(p => handle
      ? {...p, [lineId]: {handle, name}}
      : Object.fromEntries(Object.entries(p).filter(([k])=>k!==lineId))
    );
    // Persist filename into the line object so it survives save/reload
    setLines(prev => prev.map(l => l.id===lineId
      ? {...l, linkedFileName: handle ? name : null, linkedCsvName: handle?._csvHandle?.name || csvName || null}
      : l
    ));
  };
  const setStationHandle= (stationId, handle, name) => setStationHandles(p=>handle?{...p,[stationId]:{handle,name}}:Object.fromEntries(Object.entries(p).filter(([k])=>k!==stationId)));

  // Autosave to localStorage on every state change
  // activeFileHandle excluded from deps — it mutates internally (.csvHandle),
  // React can't track mutations. We read it at call time instead.
  useEffect(()=>{
    lsSave(stations, lines, {
      activeFileName: activeFileName||null,
      activeFileCsvName: activeFileHandle?._csvHandle?.name||null,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[stations, lines, activeFileName]);

  // On first load: prompt to reconnect any files that were linked last session
  useEffect(()=>{
    if(!window.showOpenFilePicker) return;
    const queue = [];
    // Global workspace file
    if(_storedActiveFileName) {
      queue.push({
        id: "__global__",
        name: "(All Lines — Workspace)",
        linkedFileName: _storedActiveFileName,
        linkedCsvName: _storedActiveFileCsvName,
        isGlobal: true,
      });
    }
    // Per-line files
    lines.forEach(l => {
      if(l.linkedFileName && !lineHandles[l.id]) queue.push(l);
    });
    if(queue.length > 0) setReconnectQueue(queue);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const flash=(msg)=>{ setSaveMsg(msg); setTimeout(()=>setSaveMsg(""),2500); };

  // Find which line a station belongs to (for lineName in PDF)
  const stationLineName = (stationId) => {
    const line = lines.find(l=>l.stationIds.includes(stationId));
    return line?.name || "";
  };

  const addStation=()=>{ const s=mkStation(); setStations(p=>[...p,s]); setActive(s.id); setTab("stations"); };

  // Main station update — also receives cross-station move payloads
  const updStation = useCallback((updated, extra) => {
    setStations(prev => {
      let stations = prev.map(s => s.id===updated.id ? updated : s);

      if(extra?.moveTask) {
        // Append the task to the target station, reindex
        stations = stations.map(s => {
          if(s.id!==extra.targetStationId) return s;
          const tasks = reindex([...s.tasks, extra.moveTask], s.sopId);
          return {...s, tasks};
        });
      }
      if(extra?.moveStep) {
        // Append the step to the target task in the target station
        stations = stations.map(s => {
          if(s.id!==extra.targetStationId) return s;
          const tasks = s.tasks.map(t => {
            if(t.id!==extra.targetTaskId) return t;
            return {...t, steps:[...t.steps, extra.moveStep]};
          });
          return {...s, tasks};
        });
      }
      return stations;
    });
  }, []);

  const delStation=(id)=>{ setStations(p=>p.filter(s=>s.id!==id)); if(active===id) setActive(null); };

  return (
    <div style={{minHeight:"100vh",background:"#f0f4f8",fontFamily:"Arial,sans-serif"}}>
      {/* Nav */}
      <div style={{background:TEAL_DARK,color:"white",display:"flex",alignItems:"stretch",padding:"0 14px",flexWrap:"wrap",position:"sticky",top:0,zIndex:500,boxShadow:"0 2px 8px rgba(0,0,0,0.2)"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px 12px 0",flexShrink:0}}>
          <span style={{background:TEAL,padding:"3px 10px",borderRadius:4,fontWeight:900,fontSize:16,letterSpacing:1}}>LVT</span>
          <span style={{fontWeight:700,fontSize:14}}>SOP Builder</span>
        </div>
        {[{id:"lines",label:"🏗️ Lines"},{id:"balance",label:"📊 Line Balance"}].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{background:tab===t.id?"rgba(255,255,255,0.18)":"transparent",border:"none",borderBottom:tab===t.id?"3px solid white":"3px solid transparent",color:"white",padding:"0 14px",cursor:"pointer",fontSize:13,fontWeight:tab===t.id?700:400,alignSelf:"stretch"}}>{t.label}</button>
        ))}
        <button onClick={()=>setSidebarOpen(o=>!o)} title={sidebarOpen?"Hide navigator":"Show navigator"}
          style={{background:sidebarOpen?"rgba(255,255,255,0.18)":"transparent",border:"none",
                  borderBottom:sidebarOpen?"3px solid white":"3px solid transparent",
                  color:"white",padding:"0 12px",cursor:"pointer",fontSize:15,alignSelf:"stretch",
                  letterSpacing:1}}>
          ☰
        </button>
        <div style={{flex:1}}/>
        <div style={{display:"flex",alignItems:"center",gap:5,padding:"8px 0"}}>
          {/* Linked file badge — before New so it's visible at left of actions */}
          {activeFileName&&!saveMsg&&(
            <span style={{fontSize:10,color:"#a5d6a7",display:"flex",alignItems:"center",gap:3,
                          background:"rgba(255,255,255,0.08)",borderRadius:4,padding:"2px 7px",maxWidth:160,overflow:"hidden"}}>
              <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={activeFileName}>
                📄 {activeFileName}
              </span>
              <button onClick={()=>{setActiveFileHandle(null);setActiveFileName("");openedAtRef.current=null;}}
                style={{background:"none",border:"none",color:"rgba(255,255,255,0.5)",cursor:"pointer",fontSize:10,padding:0,lineHeight:1,flexShrink:0}}>✕</button>
            </span>
          )}
          {saveMsg&&<span style={{fontSize:11,color:"#a5d6a7"}}>{saveMsg}</span>}
          {/* ── Primary actions ── */}
          <button onClick={()=>setShowNewProject(true)}
            style={{background:"rgba(255,255,255,0.12)",border:"1px solid rgba(255,255,255,0.3)",borderRadius:5,padding:"5px 10px",cursor:"pointer",fontSize:12,color:"white"}}>
            🆕 New
          </button>
          <button onClick={async()=>{
            if(window.showOpenFilePicker){
              try {
                const [handle] = await window.showOpenFilePicker({
                  types:[{description:"SOP Builder Save File",accept:{"application/json":[".json"]}}],multiple:false});
                const file = await handle.getFile();
                const perm = await handle.queryPermission({mode:"readwrite"});
                if(perm!=="granted") await handle.requestPermission({mode:"readwrite"});
                loadFile(file, loaded=>{
                  setStations(loaded.stations);setLines(loaded.lines||[]);setActive(null);
                  setActiveFileName(file.name);setActiveFileHandle(handle);
                  openedAtRef.current = new Date().toISOString();
                  flash(`✓ Opened: ${file.name}`);
                  const baseName = file.name.replace(/\.json$/i,"");
                  setCsvPrompt({baseName,jsonFileName:file.name,
                    onLink:async()=>{
                      try{
                        const[csvHandle]=await window.showOpenFilePicker({
                          types:[{description:"CSV Backup",accept:{"text/csv":[".csv"]}}],multiple:false});
                        const cp=await csvHandle.queryPermission({mode:"readwrite"});
                        if(cp!=="granted")await csvHandle.requestPermission({mode:"readwrite"});
                        handle._csvHandle=csvHandle;
                        flash(`✓ CSV linked: ${csvHandle.name}`);
                      }catch(e){if(e.name!=="AbortError")console.warn("CSV link failed",e);}
                      setCsvPrompt(null);
                    },
                    onSkip:()=>{setCsvPrompt(null);flash(`✓ Opened: ${file.name}`);}
                  });
                });return;
              }catch(e){if(e.name==="AbortError")return;}
            }
            loadRef.current.click();
          }} style={{background:"rgba(255,255,255,0.12)",border:"1px solid rgba(255,255,255,0.3)",borderRadius:5,padding:"5px 10px",cursor:"pointer",fontSize:12,color:"white"}}>
            📂 Open
          </button>
          <input ref={loadRef} type="file" accept=".json" style={{display:"none"}} onChange={e=>{const f=e.target.files[0];if(!f)return;loadFile(f,loaded=>{setStations(loaded.stations);setLines(loaded.lines||[]);setActive(null);setActiveFileHandle(null);setActiveFileName("");flash("✓ Loaded");});e.target.value="";}}/>
          <button onClick={async()=>{
            if(activeFileHandle||window.showSaveFilePicker){
              if(activeFileHandle){
                const diskState=await readFileSavedAt(activeFileHandle);
                if(diskState&&diskState.savedAt&&openedAtRef.current&&diskState.savedAt>openedAtRef.current){
                  setFileConflict({fileUpdatedAt:diskState.savedAt,pendingSave:async()=>{
                    await smartSave(stations,lines,`All_Lines_${new Date().toISOString().slice(0,10)}`,activeFileHandle,
                      (h,n)=>{setActiveFileHandle(h);setActiveFileName(n||"");},flash);
                    openedAtRef.current=new Date().toISOString();setFileConflict(null);
                  }});return;
                }
              }
              await smartSave(stations,lines,`All_Lines_${new Date().toISOString().slice(0,10)}`,activeFileHandle,
                (h,n)=>{setActiveFileHandle(h);setActiveFileName(n||"");if(h)openedAtRef.current=new Date().toISOString();},flash);
            }else{setShowSaveInfo(true);}
          }} style={{background:activeFileHandle?"rgba(165,214,167,0.2)":"rgba(255,255,255,0.12)",
                     border:activeFileHandle?"2px solid #a5d6a7":"1px solid rgba(255,255,255,0.3)",
                     borderRadius:5,padding:"5px 10px",cursor:"pointer",fontSize:12,color:"white",fontWeight:activeFileHandle?700:400}}>
            💾 Save{activeFileHandle?" ●":""}
          </button>
          {/* ── More dropdown ── */}
          <MoreMenu items={[
            {label:"⬇️ Export Save",     action:()=>setShowExportSave(true)},
            {label:"📥 Import Stations", action:()=>setShowImport(true)},
            {label:"♻️ Restore from CSV",action:()=>setShowCsvRestore(true)},
            {label:"📊 Download CSV",    action:()=>{exportCSV(stations);flash("✓ CSV downloaded");}},
            {label:"📄 All PDFs",        action:()=>stations.forEach((s,i)=>setTimeout(()=>exportPDF(s),i*500))},
          ]}/>
          {/* ── Version + Help ── */}
          <button onClick={()=>setShowChangelog(true)} title={`v${APP_VERSION} — View changelog`}
            style={{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.2)",
                    borderRadius:5,padding:"4px 8px",cursor:"pointer",fontSize:10,color:"rgba(255,255,255,0.6)",fontFamily:"monospace"}}>
            v{APP_VERSION}
          </button>
          <button onClick={()=>{const base=window.location.origin+window.location.pathname.replace(/\/[^/]*$/,"/");window.open(base+"user-guide.html","_blank","noopener");}}
            title="Open User Guide"
            style={{background:"rgba(255,255,255,0.12)",border:"1px solid rgba(255,255,255,0.3)",borderRadius:5,padding:"5px 10px",cursor:"pointer",fontSize:12,color:"white"}}>
            ❓
          </button>
        </div>
      </div>

      <div style={{display:"flex",minHeight:"calc(100vh - 52px)"}}>
        <SidebarNav
          lines={lines}
          stations={stations}
          open={sidebarOpen && tab==="lines"}
          onNavigate={(type,lineId,stationId,taskId)=>{
            window.dispatchEvent(new CustomEvent("sop-nav",{detail:{type,lineId,stationId,taskId}}));
          }}
          onDeleteStation={(s)=>confirmDelete("station",s.stationNo||s.sopId||"this station",{stationId:s.id})}
          onDeleteAll={(unassigned)=>{
            if(!unassigned.length) return;
            if(window.confirm(`Delete all ${unassigned.length} unassigned station(s)? This cannot be undone.`)){
              setStations(prev=>prev.filter(s=>!unassigned.find(u=>u.id===s.id)));
            }
          }}
        />
        <div style={{flex:1,minWidth:0,overflowX:"hidden"}}>
        <div style={{maxWidth:1080,margin:"0 auto",padding:"18px 14px"}}>
        {tab==="lines" && (
          <LinesManager
            lines={lines}
            stations={stations}
            onLinesChange={setLines}
            onStationsChange={setStations}
            updStation={updStation}
            preview={preview}
            setPreview={setPreview}
            stationHandles={stationHandles}
            setStationHandle={setStationHandle}
            lineHandles={lineHandles}
            setLineHandle={setLineHandle}
            flash={flash}
            confirmDelete={confirmDelete}
            openLineFile={window.showOpenFilePicker ? openLineFile : null}
          />
        )}

        {tab==="balance" && (
          <div style={{background:"white",borderRadius:12,padding:22,boxShadow:"0 1px 5px rgba(0,0,0,0.07)"}}>
            <LineBalance stations={stations} lines={lines}/>
          </div>
        )}
        </div>{/* /maxWidth */}
        </div>{/* /flex content */}
      </div>{/* /flex row */}
      {preview&&<SOPPreview station={preview} onClose={()=>setPreview(null)}/>}
      {showSaveInfo&&<SaveInfoModal onExport={()=>setShowExportSave(true)} onClose={()=>setShowSaveInfo(false)}/>}
      {showExportSave&&<ExportSaveModal lines={lines} stations={stations} onClose={()=>{setShowExportSave(false);flash("✓ File downloaded");}}/>}
      {csvPrompt&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:4000,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"white",borderRadius:12,padding:28,maxWidth:440,width:"90%",boxShadow:"0 8px 40px rgba(0,0,0,0.25)"}}>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
              <span style={{fontSize:30}}>📊</span>
              <div>
                <div style={{fontWeight:700,fontSize:15,color:"#222"}}>Link CSV backup file?</div>
                <div style={{fontSize:12,color:"#888",marginTop:2}}>Opened: {csvPrompt.jsonFileName}</div>
              </div>
            </div>
            <div style={{background:TEAL_LIGHT,border:"1px solid #80cbc4",borderRadius:8,padding:"12px 14px",marginBottom:8,fontSize:13,color:"#333",lineHeight:1.6}}>
              If you have an existing <code style={{background:"#e0f2f1",padding:"1px 4px",borderRadius:3}}>{csvPrompt.baseName}.csv</code> from a previous save, link it here so future saves update it automatically.
            </div>
            <div style={{background:"#fff8e1",border:"1px solid #ffe082",borderRadius:8,padding:"10px 14px",marginBottom:18,fontSize:12,color:"#666"}}>
              No CSV yet? Click <strong>Skip</strong> — a Save As dialog will appear on your first save so you can choose where to create it.
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={csvPrompt.onLink}
                style={{flex:2,background:TEAL,color:"white",border:"none",borderRadius:7,padding:"10px 0",cursor:"pointer",fontSize:13,fontWeight:700}}>
                📂 Browse for CSV file
              </button>
              <button onClick={csvPrompt.onSkip}
                style={{flex:1,background:"#f5f5f5",color:"#555",border:"1px solid #ddd",borderRadius:7,padding:"10px 0",cursor:"pointer",fontSize:13}}>
                Skip
              </button>
            </div>
          </div>
        </div>
      )}
      {linkFilesPrompt&&<LinkFilesModal
        lineIds={linkFilesPrompt.lineIds}
        sourceFileName={linkFilesPrompt.sourceFileName}
        onSkip={()=>{
          setLinkFilesPrompt(null);
          flash(`✓ Merged — no files linked. Use 💾 Save to link files later.`);
        }}
        onLink={async(mode, setStatus)=>{
          const {lineIds, sourceHandle, sourceFileName, newLines: mergedLines} = linkFilesPrompt;
          const baseName = sourceFileName.replace(/\.json$/i,"");
          let jsonHandle = null;
          let csvHandle  = null;

          try {
            if(mode === "existing") {
              // Open the existing JSON
              setStatus("📂 Opening JSON file…");
              const [jh] = await window.showOpenFilePicker({
                types:[{description:"SOP Builder Save File",accept:{"application/json":[".json"]}}],
                multiple:false,
              });
              const jp = await jh.queryPermission({mode:"readwrite"});
              if(jp!=="granted") await jh.requestPermission({mode:"readwrite"});
              jsonHandle = jh;

              // Open the existing CSV
              setStatus("📊 Opening CSV file…");
              try {
                const [ch] = await window.showOpenFilePicker({
                  types:[{description:"CSV Backup",accept:{"text/csv":[".csv"]}}],
                  multiple:false,
                });
                const cp = await ch.queryPermission({mode:"readwrite"});
                if(cp!=="granted") await ch.requestPermission({mode:"readwrite"});
                csvHandle = ch;
              } catch(e){ if(e.name!=="AbortError") console.warn("CSV skipped"); }

            } else {
              // Save As — new JSON
              setStatus("💾 Choosing location for JSON…");
              const date = new Date().toISOString().slice(0,10);
              jsonHandle = await window.showSaveFilePicker({
                suggestedName: `${baseName}_${date}.json`,
                types:[{description:"SOP Builder Save File",accept:{"application/json":[".json"]}}],
              });

              // Save As — new CSV
              setStatus("💾 Choosing location for CSV…");
              try {
                csvHandle = await window.showSaveFilePicker({
                  suggestedName: `${baseName}_${date}.csv`,
                  types:[{description:"CSV Backup",accept:{"text/csv":[".csv"]}}],
                });
              } catch(e){ if(e.name!=="AbortError") console.warn("CSV skipped"); }
            }

            // Attach CSV to JSON handle
            if(jsonHandle && csvHandle) jsonHandle._csvHandle = csvHandle;

            // Link to all imported lines
            if(jsonHandle) {
              lineIds.forEach(lineId => {
                setLineHandle(lineId, jsonHandle, jsonHandle.name, csvHandle?.name||null);
              });
            }

            setLinkFilesPrompt(null);
            flash(`✓ Files linked — 💾 Save will write directly to ${jsonHandle?.name||"file"}${csvHandle?" + "+csvHandle.name:""}`);

          } catch(e){
            if(e.name==="AbortError") setStatus(""); // user cancelled a picker — stay in modal
            else { setLinkFilesPrompt(null); flash("Could not link files."); }
          }
        }}
      />}
      {reconnectQueue.length>0&&<ReconnectModal
        queue={reconnectQueue}
        onDismiss={()=>setReconnectQueue([])}
        onReconnect={async(line, idx, isLast)=>{
          try {
            const [handle] = await window.showOpenFilePicker({
              types:[{description:"SOP Builder Save File",accept:{"application/json":[".json"]}}],
              multiple:false,
            });
            const perm = await handle.queryPermission({mode:"readwrite"});
            if(perm!=="granted") await handle.requestPermission({mode:"readwrite"});

            // Reconnect CSV if it was linked
            let csvHandle = null;
            if(line.linkedCsvName) {
              try {
                const [ch] = await window.showOpenFilePicker({
                  types:[{description:"CSV Backup",accept:{"text/csv":[".csv"]}}],
                  multiple:false,
                });
                const cp = await ch.queryPermission({mode:"readwrite"});
                if(cp!=="granted") await ch.requestPermission({mode:"readwrite"});
                handle._csvHandle = ch;
                csvHandle = ch;
              } catch(e){ if(e.name!=="AbortError") console.warn("CSV reconnect skipped",e); }
            }

            if(line.isGlobal) {
              // Reconnect the global workspace file
              setActiveFileHandle(handle);
              setActiveFileName(handle.name);
              openedAtRef.current = new Date().toISOString();
              flash(`✓ Workspace reconnected: ${handle.name}`);
            } else {
              setLineHandle(line.id, handle, handle.name, csvHandle?.name||null);
              flash(`✓ Reconnected: ${handle.name}`);
            }
          } catch(e){
            if(e.name!=="AbortError") flash("Could not reconnect file.");
          }
          if(isLast) setReconnectQueue([]);
          else setReconnectQueue(q=>q.slice(1));
        }}
      />}
      {showChangelog&&<ChangelogModal onClose={()=>setShowChangelog(false)}/>}
      {fileConflict&&<FileConflictModal
        fileName={activeFileName}
        openedAt={openedAtRef.current}
        fileUpdatedAt={fileConflict.fileUpdatedAt}
        onOverwrite={fileConflict.pendingSave}
        onMerge={async ()=>{
          // Load the current file into the merge dialog
          if(activeFileHandle){
            const file = await activeFileHandle.getFile();
            loadFile(file, loaded=>{
              const conflicts=[], nonConflicts=[];
              (loaded.lines||[]).forEach(il=>{
                const match=lines.find(l=>l.name.trim().toLowerCase()===(il.name||"").trim().toLowerCase());
                if(match) conflicts.push({existing:match,incoming:il});
                else nonConflicts.push(il);
              });
              setMergePrompt({conflicts,nonConflicts,incomingStations:loaded.stations||[],incomingLines:loaded.lines||[]});
              setFileConflict(null);
            });
          }
        }}
        onCancel={()=>setFileConflict(null)}
      />}
      {mergePrompt&&<MergeLineModal
        conflicts={mergePrompt.conflicts}
        nonConflicts={mergePrompt.nonConflicts}
        onResolve={applyMerge}
        onCancel={()=>setMergePrompt(null)}
      />}
      {deletePrompt&&<ConfirmDeleteModal
        type={deletePrompt.type}
        name={deletePrompt.name}
        onConfirm={()=>executeDelete(deletePrompt.type, deletePrompt.ids)}
        onCancel={()=>setDeletePrompt(null)}
      />}
      {showNewProject&&<NewProjectModal
        onConfirm={()=>{
          setStations([]); setLines([]); setActive(null);
          setActiveFileHandle(null); setActiveFileName("");
          setLineHandles({}); setStationHandles({});
          setShowNewProject(false);
          flash("✓ New project started");
        }}
        onCancel={()=>setShowNewProject(false)}
      />}
      {showCsvRestore&&<CsvRestoreTool
        currentLines={lines}
        currentStations={stations}
        onClose={()=>setShowCsvRestore(false)}
        onRestore={(newStations, newLine)=>{
          setStations(prev=>[...prev, ...newStations]);
          setLines(prev=>[...prev, newLine]);
          setShowCsvRestore(false);
          flash(`✓ Restored: ${newLine.name}`);
        }}
      />}
      {showImport&&<ImportWizard
        currentStations={stations}
        currentLines={lines}
        onClose={()=>setShowImport(false)}
        onImport={(newStations,newLines)=>{
          setStations(newStations);
          setLines(newLines);
          flash("✓ Import complete");
        }}
      />}
    </div>
  );
}
