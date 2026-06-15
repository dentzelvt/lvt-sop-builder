import { useState, useRef, useEffect, useCallback } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────
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
const fmtTime   = (m) => { const n=parseFloat(m)||0; return n>0?`${n.toFixed(2)} min`:"—"; };
const sumSteps  = (steps) => steps.reduce((s,st) => s+(parseFloat(st.cycleTime)||0), 0);
const sumTasks  = (tasks) => tasks.reduce((s,t)  => s+sumSteps(t.steps), 0);
const reindex   = (tasks, sopId) =>
  tasks.map((t,i) => ({ ...t, taskNo:i+1, taskId:genTaskId(sopId,i+1) }));

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
});
const mkTask = (sopId, taskNo) => ({
  id:Date.now()+Math.random(), taskNo, taskId:genTaskId(sopId,taskNo),
  description:"", generalNotes:"", taskImages:[], steps:[], selectedTools:[], selectedDrawings:[],
});
const mkStep = () => ({
  id:Date.now()+Math.random(), useStepNumber:true, stepNumber:"",
  description:"", keyPoints:"", icons:[], cycleTime:"", image:null, selectedTools:[], selectedDrawings:[],
});

// ─── Persistence ──────────────────────────────────────────────────────────────
const lsSave = (s) => { try { localStorage.setItem(SAVE_KEY, JSON.stringify({version:1,savedAt:new Date().toISOString(),stations:s})); } catch{} };
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
  return s;
};
const lsLoad = () => { try { const r=localStorage.getItem(SAVE_KEY); return r?JSON.parse(r).stations.map(migrateStation):null; } catch{ return null; } };
const saveFile = (stations, station=null) => {
  // If a single station is passed name the file after it, otherwise use a date stamp
  const name = station
    ? [station.sopId, station.stationDesc].filter(Boolean).join("_").replace(/[^a-zA-Z0-9_\-]/g,"_") || "SOP_save"
    : `SOP_save_${new Date().toISOString().slice(0,10)}`;
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([JSON.stringify({version:1,savedAt:new Date().toISOString(),stations},null,2)],{type:"application/json"}));
  a.download=`${name}.json`; a.click();
};
const loadFile = (file,cb) => {
  const r=new FileReader();
  r.onload=e=>{ try{ const d=JSON.parse(e.target.result); if(d.stations) cb(d.stations.map(migrateStation)); else alert("Invalid save file."); }catch{ alert("Could not read file."); } };
  r.readAsText(file);
};

// ─── CSV Export ───────────────────────────────────────────────────────────────
const exportCSV = (stations) => {
  const rows=[["SOP ID","Station No","Station Desc","Task No","Task ID","Task Description","Step No","Step Description","Key Points","Safety Icon","Cycle Time (min)"]];
  stations.forEach(s=>s.tasks.forEach(t=>{
    if(!t.steps.length){ rows.push([s.sopId,s.stationNo,s.stationDesc||"",t.taskNo,t.taskId,t.description,"","","","",""]); return; }
    t.steps.forEach((st,si)=>rows.push([s.sopId,s.stationNo,s.stationDesc||"",t.taskNo,t.taskId,t.description,
      st.stepNumber||si+1,st.description,st.keyPoints,(st.icons||[st.icon]).filter(i=>i&&i!=="none").map(i=>ICONS[i]?.label||i).join("; "),parseFloat(st.cycleTime)||0]));
  }));
  const csv=rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(",")).join("\r\n");
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8;"}));
  a.download="sop_data.csv"; a.click();
};

// ─── Print HTML ────────────────────────────────────────────────────────────────────────────────────────────────────────────
// screen=true  → white page sheets on grey background (preview iframe)
// screen=false → print/PDF — footer lives in @page margin boxes so it appears on every physical page

const buildPrintHTML = (station, screen=false) => {
  const safe = (s) => String(s||"")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\n/g,"<br/>");
  const today = new Date().toLocaleDateString();

  const hdr = (extra="") => `
    <table class="ht" cellspacing="0">
      <tr>
        <td rowspan="3" class="logo">LVT</td>
        <td colspan="6" class="title">SOP Trailer Assembly</td>
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

  const drawRows = station.drawings.filter(d=>d.drawingNo||d.description)
    .map(d=>`<tr><td>${safe(d.drawingNo)}</td><td>${safe(d.description)}</td><td></td><td></td></tr>`)
    .join("") || `<tr><td colspan="4">&nbsp;</td></tr>`;
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
      const img = step.image ? `<div class="step-img-wrap"><img src="${step.image}" class="sthumb"/></div>` : "";
      const kp  = step.keyPoints ? `<br/><em class="kp">${safe(step.keyPoints)}</em>` : "";
      const stepRefs = refTags(step.selectedTools, step.selectedDrawings);
      return `<tr class="step-row">
        <td class="step-num">${num}</td>
        <td class="step-desc">${ico}<strong>${safe(step.description)}</strong>${kp}${stepRefs}${img}</td>
        <td class="step-time">${step.cycleTime?parseFloat(step.cycleTime).toFixed(2):""}</td>
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

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>SOP ${safe(station.sopId)}</title>
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
          style={{width:"100%",height:"100%",border:"none",display:"block"}}
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
function StepEditor({ step, idx, showNums, onChange, onDelete, dragProps, allStations, thisStationId, thisTaskId, onMoveStep, stationToolList, stationDrawings }) {
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
        <input value={step.cycleTime} onChange={e=>u("cycleTime",e.target.value)} placeholder="Time (min)" type="number" min="0" step="0.01"
          style={{width:90,padding:"3px 5px",border:"1px solid #ccc",borderRadius:4,fontSize:12}}/>
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
      <textarea value={step.description} onChange={e=>u("description",e.target.value)} placeholder="Step description…" rows={2}
        style={{width:"100%",padding:"5px 7px",border:"1px solid #ccc",borderRadius:4,fontSize:12,resize:"vertical",cursor:"text"}}/>
      <textarea value={step.keyPoints} onChange={e=>u("keyPoints",e.target.value)} placeholder="NOTE / Key point (optional)" rows={1}
        style={{width:"100%",padding:"5px 7px",border:"1px solid #ddd",borderRadius:4,fontSize:11,resize:"vertical",marginTop:3,background:"#fffde7",cursor:"text"}}/>
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
      <div style={{marginTop:5,display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
        <ImgUpload label="📎 Step Image" onImage={src=>u("image",src)}/>
        {step.image && (
          <div style={{position:"relative"}}>
            <img src={step.image} alt="" style={{maxHeight:70,maxWidth:120,border:"1px solid #ccc",borderRadius:4}}/>
            <button onClick={()=>u("image",null)} style={{position:"absolute",top:-6,right:-6,background:"#e53935",color:"white",border:"none",borderRadius:"50%",width:18,height:18,cursor:"pointer",fontSize:10,lineHeight:"18px",textAlign:"center",padding:0}}>✕</button>
          </div>
        )}
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
function TaskEditor({ task, dragProps, onUpdate, onDelete, allStations, thisStationId, onMoveTask, stationToolList, stationDrawings }) {
  const [showNums, setShowNums] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [showMoveTask, setShowMoveTask] = useState(false);
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
          <div style={{position:"relative",flexShrink:0}}>
            <button onClick={e=>{e.stopPropagation();setShowMoveTask(!showMoveTask);}}
              style={{padding:"3px 9px",fontSize:11,background:"#e3f2fd",border:"1px solid #90caf9",borderRadius:4,cursor:"pointer",color:"#1565c0"}}>
              ↪ Move Task
            </button>
            {showMoveTask && (
              <div style={{position:"absolute",right:0,top:"100%",zIndex:50,background:"white",border:"1px solid #ccc",borderRadius:6,boxShadow:"0 4px 16px rgba(0,0,0,0.15)",minWidth:220}}>
                <div style={{padding:"6px 10px",fontSize:11,fontWeight:700,color:"#555",borderBottom:"1px solid #eee",background:"#f9f9f9"}}>Move task to station:</div>
                {moveTaskTargets.map((s,i)=>(
                  <button key={i} onClick={()=>{ onMoveTask(s.id); setShowMoveTask(false); }}
                    style={{display:"block",width:"100%",textAlign:"left",padding:"7px 12px",fontSize:12,background:"none",border:"none",cursor:"pointer",borderBottom:"1px solid #f0f0f0"}}
                    onMouseEnter={e=>e.target.style.background="#e8f5e9"} onMouseLeave={e=>e.target.style.background="none"}>
                    {s.stationNo||"(untitled)"} — {s.sopId}
                  </button>
                ))}
              </div>
            )}
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
              <input value={task.generalNotes} onChange={e=>u("generalNotes",e.target.value)} placeholder="Optional task-level notes"
                style={{width:"100%",padding:"5px 7px",border:"1px solid #ccc",borderRadius:4,fontSize:12}}/>
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
                <input type="checkbox" checked={showNums} onChange={e=>setShowNums(e.target.checked)}/> Step Numbers
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
                  onDelete={()=>delStep(i)}
                  allStations={allStations}
                  thisStationId={thisStationId}
                  thisTaskId={task.id}
                  onMoveStep={(targetStationId,targetTaskId)=>handleMoveStep(i,targetStationId,targetTaskId)}
                  stationToolList={stationToolList||[]}
                  stationDrawings={stationDrawings||[]}
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
    setEditConfirmed(false);
    setShowEditModal(true);
  };
  const confirmEdit = () => {
    if(!editDesc.trim()){ alert("Description cannot be empty."); return; }
    onEntryEdit(editIdx, editDesc.trim(), editBy.trim());
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
            <th style={{padding:"5px 8px",width:36}}></th>
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
              <td style={{padding:"3px 6px",textAlign:"center"}}>
                <button onClick={()=>startEdit(i)} title="Edit description"
                  style={{background:"#e8f5e9",border:"1px solid #a5d6a7",borderRadius:3,padding:"1px 6px",cursor:"pointer",fontSize:11}}>
                  ✏️
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
          <div style={{background:"white",borderRadius:12,padding:28,maxWidth:460,width:"90%",boxShadow:"0 8px 40px rgba(0,0,0,0.25)"}}>
            <div style={{fontWeight:700,fontSize:16,color:TEAL_DARK,marginBottom:6}}>
              Edit Rev {entries[editIdx]?.rev} Description
            </div>
            <div style={{fontSize:12,color:"#666",marginBottom:12,lineHeight:1.6}}>
              You are editing the description for an existing revision entry.
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
              <div>
                <label style={{fontSize:12,fontWeight:600,color:"#333",display:"block",marginBottom:4}}>Description</label>
                <input value={editDesc} onChange={e=>setEditDesc(e.target.value)} autoFocus
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

// ─── Station Editor ───────────────────────────────────────────────────────────
function StationEditor({ station, isActive, onSelect, onUpdate, onDelete, onPreview, allStations }) {
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
          {station.stationDesc&&<span style={{fontSize:12,opacity:0.85}}>— {station.stationDesc}</span>}
          {station.sopId&&<span style={{fontFamily:"monospace",fontSize:11,opacity:0.75}}>{station.sopId}</span>}
          <span style={{fontSize:11,opacity:0.8}}>⏱ {fmtTime(total)} | {station.tasks.length} task(s)</span>
        </div>
        <div style={{display:"flex",gap:6,flexShrink:0}}>
          <button onClick={e=>{e.stopPropagation();onPreview();}} style={{background:"rgba(255,255,255,0.2)",border:"1px solid rgba(255,255,255,0.5)",borderRadius:4,padding:"3px 10px",cursor:"pointer",fontSize:12,color:isActive?"white":"#333"}}>👁 Preview</button>
          <button onClick={e=>{e.stopPropagation();exportPDF(station);}} style={{background:"rgba(255,255,255,0.2)",border:"1px solid rgba(255,255,255,0.5)",borderRadius:4,padding:"3px 10px",cursor:"pointer",fontSize:12,color:isActive?"white":"#333"}}>📄 PDF</button>
          <button onClick={e=>{e.stopPropagation();saveFile([station],station);}} title="Save this station to a file" style={{background:"rgba(255,255,255,0.2)",border:"1px solid rgba(255,255,255,0.5)",borderRadius:4,padding:"3px 10px",cursor:"pointer",fontSize:12,color:isActive?"white":"#333"}}>💾 Save</button>
          <button onClick={e=>{e.stopPropagation();onDelete();}} style={{background:"rgba(200,0,0,0.12)",border:"1px solid rgba(200,0,0,0.25)",borderRadius:4,padding:"3px 8px",cursor:"pointer",color:"#c62828",fontSize:12}}>✕</button>
        </div>
      </div>

      {isActive && (
        <div style={{padding:16}}>
          {/* Station fields */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8,marginBottom:8}}>
            {[{l:"Station No. *",f:"stationNo",ph:"REF-WIP-02"},{l:"Station Description",f:"stationDesc",ph:"BATTERY"},
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
              <textarea value={station[f]||""} onChange={e=>u(f,e.target.value)} rows={rows}
                style={{width:"100%",padding:"5px 7px",border:"1px solid #ccc",borderRadius:4,fontSize:12,resize:"vertical"}}/>
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
            onEntryEdit={(idx, desc, by)=>{
              const entries=[...(station.revisionEntries||[])];
              entries[idx]={...entries[idx], description:desc, by:by!==undefined?by:entries[idx].by};
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
            <div style={{fontWeight:700,fontSize:14,color:TEAL_DARK,marginBottom:8}}>
              Tasks ({station.tasks.length}) <span style={{fontSize:12,color:"#888",fontWeight:400}}>Total: {fmtTime(total)}</span>
              <span style={{fontSize:11,color:"#aaa",fontWeight:400,marginLeft:8}}>⠿ drag to reorder</span>
            </div>
            {station.tasks.map((task,i)=>(
              <TaskEditor key={task.id} task={task}
                dragProps={taskDrag(i)}
                onUpdate={(t,extra)=>updTask(i,t,extra)}
                onDelete={()=>delTask(i)}
                allStations={allStations}
                thisStationId={station.id}
                onMoveTask={(targetId)=>moveTask(i,targetId)}
                stationToolList={station.toolList||[]}
                stationDrawings={station.drawings||[]}
              />
            ))}
            <button onClick={addTask} style={{background:TEAL_LIGHT,border:`2px dashed ${TEAL}`,borderRadius:8,padding:"10px 18px",cursor:"pointer",fontSize:13,width:"100%",color:TEAL_DARK,fontWeight:600,marginTop:6}}>
              + Add Task
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Line Balance ─────────────────────────────────────────────────────────────
function LineBalance({ stations }) {
  const data=stations.map(s=>({id:s.id,name:s.stationNo||s.sopId||"Station",sopId:s.sopId,total:sumTasks(s.tasks),tasks:s.tasks.length,steps:s.tasks.reduce((n,t)=>n+t.steps.length,0)}));
  const max=Math.max(...data.map(d=>d.total),0.01);
  const avg=data.length?data.reduce((s,d)=>s+d.total,0)/data.length:0;
  if(!stations.length) return (<div style={{textAlign:"center",padding:80,color:"#bbb"}}><div style={{fontSize:48}}>📊</div><div style={{marginTop:10,fontSize:15}}>Add stations with step cycle times to see the line balance.</div></div>);
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div><h3 style={{margin:0,color:TEAL_DARK}}>Line Balance Analysis</h3><span style={{fontSize:12,color:"#888"}}>Average cycle time: {fmtTime(avg)}</span></div>
        <button onClick={()=>exportCSV(stations)} style={{background:"#e8f5e9",border:"1px solid #a5d6a7",borderRadius:6,padding:"6px 14px",cursor:"pointer",fontSize:12}}>⬇️ Export CSV</button>
      </div>
      <div style={{display:"flex",alignItems:"flex-end",gap:6,padding:"16px 8px 8px",background:"#f9fbe7",borderRadius:8,overflowX:"auto",marginBottom:16,minHeight:200}}>
        {data.map(d=>{
          const pct=(d.total/max)*100,tpct=(avg/max)*100,hot=d.total>avg*1.1;
          return (<div key={d.id} style={{flex:"0 0 auto",width:70,display:"flex",flexDirection:"column",alignItems:"center"}}>
            <span style={{fontSize:10,fontWeight:700,color:hot?"#c62828":"#2e7d32",marginBottom:3}}>{fmtTime(d.total)}</span>
            <div style={{width:52,height:140,background:"#e8e8e8",borderRadius:"4px 4px 0 0",position:"relative",display:"flex",alignItems:"flex-end",overflow:"hidden"}}>
              <div style={{width:"100%",height:`${pct}%`,background:hot?"#e53935":TEAL,borderRadius:"4px 4px 0 0",transition:"height 0.4s"}}/>
              <div style={{position:"absolute",bottom:`${tpct}%`,left:0,right:0,height:2,background:"#ff6f00"}}/>
            </div>
            <span style={{fontSize:9,textAlign:"center",marginTop:3,color:"#555",maxWidth:68,wordBreak:"break-all"}}>{d.name}</span>
          </div>);
        })}
      </div>
      <div style={{fontSize:11,color:"#888",marginBottom:12}}><span style={{color:"#ff6f00",fontWeight:600}}>— Orange line</span> = average &nbsp;|&nbsp;<span style={{color:"#e53935",fontWeight:600}}>■ Red</span> = &gt;10% over average</div>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
        <thead><tr style={{background:TEAL,color:"white"}}>{["SOP ID","Station","Tasks","Steps","Cycle Time","vs Avg"].map(h=><th key={h} style={{padding:"7px 10px",textAlign:"left",fontWeight:600}}>{h}</th>)}</tr></thead>
        <tbody>{data.map((d,i)=>{const diff=d.total-avg;return(<tr key={d.id} style={{background:i%2===0?"#f5f5f5":"white",borderBottom:"1px solid #e0e0e0"}}>
          <td style={{padding:"6px 10px",fontFamily:"monospace",color:TEAL_DARK,fontWeight:600}}>{d.sopId||"—"}</td>
          <td style={{padding:"6px 10px"}}>{d.name}</td>
          <td style={{padding:"6px 10px",textAlign:"center"}}>{d.tasks}</td>
          <td style={{padding:"6px 10px",textAlign:"center"}}>{d.steps}</td>
          <td style={{padding:"6px 10px",fontWeight:600}}>{fmtTime(d.total)}</td>
          <td style={{padding:"6px 10px",fontWeight:600,color:diff>0?"#c62828":diff<0?"#2e7d32":"#888"}}>{diff>0?"+":""}{fmtTime(Math.abs(diff))} {diff>0?"▲":diff<0?"▼":"—"}</td>
        </tr>);})}
        </tbody>
        <tfoot><tr style={{background:TEAL_LIGHT,fontWeight:700}}>
          <td colSpan={4} style={{padding:"7px 10px"}}>Total / Average</td>
          <td style={{padding:"7px 10px"}}>{fmtTime(data.reduce((s,d)=>s+d.total,0))}</td>
          <td style={{padding:"7px 10px",color:"#555"}}>Avg: {fmtTime(avg)}</td>
        </tr></tfoot>
      </table>
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

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [stations, setStations] = useState(()=>lsLoad()||[]);
  const [active,   setActive]   = useState(null);
  const [tab,      setTab]      = useState("stations");
  const [preview,  setPreview]  = useState(null);
  const [saveMsg,  setSaveMsg]  = useState("");
  const [showSaveInfo, setShowSaveInfo] = useState(false);
  const loadRef = useRef();

  useEffect(()=>{ lsSave(stations); },[stations]);
  const flash=(msg)=>{ setSaveMsg(msg); setTimeout(()=>setSaveMsg(""),2500); };

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
      <div style={{background:TEAL_DARK,color:"white",display:"flex",alignItems:"stretch",padding:"0 14px",flexWrap:"wrap"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px 12px 0",flexShrink:0}}>
          <span style={{background:TEAL,padding:"3px 10px",borderRadius:4,fontWeight:900,fontSize:16,letterSpacing:1}}>LVT</span>
          <span style={{fontWeight:700,fontSize:14}}>SOP Builder</span>
        </div>
        {[{id:"stations",label:"📋 Stations & SOPs"},{id:"balance",label:"📊 Line Balance"}].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{background:tab===t.id?"rgba(255,255,255,0.18)":"transparent",border:"none",borderBottom:tab===t.id?"3px solid white":"3px solid transparent",color:"white",padding:"0 14px",cursor:"pointer",fontSize:13,fontWeight:tab===t.id?700:400,alignSelf:"stretch"}}>{t.label}</button>
        ))}
        <div style={{flex:1}}/>
        <div style={{display:"flex",alignItems:"center",gap:5,padding:"8px 0"}}>
          {saveMsg&&<span style={{fontSize:11,color:"#a5d6a7",marginRight:4}}>{saveMsg}</span>}
          <button onClick={()=>{lsSave(stations);setShowSaveInfo(true);}} style={{background:"rgba(255,255,255,0.15)",border:"1px solid rgba(255,255,255,0.35)",borderRadius:5,padding:"5px 11px",cursor:"pointer",fontSize:12,color:"white"}}>💾 Save</button>
          <button onClick={()=>{saveFile(stations, stations.length===1?stations[0]:null);flash("✓ File downloaded");}} style={{background:"rgba(255,255,255,0.15)",border:"1px solid rgba(255,255,255,0.35)",borderRadius:5,padding:"5px 11px",cursor:"pointer",fontSize:12,color:"white"}}>⬇️ Export Save</button>
          <button onClick={()=>loadRef.current.click()} style={{background:"rgba(255,255,255,0.15)",border:"1px solid rgba(255,255,255,0.35)",borderRadius:5,padding:"5px 11px",cursor:"pointer",fontSize:12,color:"white"}}>📂 Load File</button>
          <input ref={loadRef} type="file" accept=".json" style={{display:"none"}} onChange={e=>{const f=e.target.files[0];if(!f)return;loadFile(f,loaded=>{setStations(loaded);setActive(null);flash("✓ Loaded");});e.target.value="";}}/>
          <button onClick={()=>{exportCSV(stations);flash("✓ CSV downloaded");}} style={{background:"rgba(255,255,255,0.15)",border:"1px solid rgba(255,255,255,0.35)",borderRadius:5,padding:"5px 11px",cursor:"pointer",fontSize:12,color:"white"}}>📊 CSV</button>
          <button onClick={()=>stations.forEach((s,i)=>setTimeout(()=>exportPDF(s),i*500))} style={{background:"rgba(255,255,255,0.15)",border:"1px solid rgba(255,255,255,0.35)",borderRadius:5,padding:"5px 11px",cursor:"pointer",fontSize:12,color:"white"}}>📄 All PDFs</button>
        </div>
      </div>

      <div style={{maxWidth:1080,margin:"0 auto",padding:"18px 14px"}}>
        {tab==="stations" && (<>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div>
              <h2 style={{margin:0,color:TEAL_DARK}}>Stations</h2>
              <span style={{fontSize:12,color:"#888"}}>{stations.length} station(s) · {stations.reduce((n,s)=>n+s.tasks.length,0)} task(s) · {fmtTime(stations.reduce((s,st)=>s+sumTasks(st.tasks),0))} total</span>
            </div>
            <button onClick={addStation} style={{background:TEAL,color:"white",border:"none",borderRadius:8,padding:"10px 20px",cursor:"pointer",fontSize:14,fontWeight:700,boxShadow:"0 2px 6px rgba(0,137,123,0.3)"}}>+ New Station</button>
          </div>
          {stations.length===0 && (
            <div style={{textAlign:"center",padding:70,color:"#bbb",background:"white",borderRadius:12,border:"2px dashed #e0e0e0"}}>
              <div style={{fontSize:52}}>🏭</div>
              <div style={{fontSize:16,marginTop:10,fontWeight:600}}>No stations yet</div>
              <div style={{fontSize:13,marginTop:6}}>Click <strong style={{color:TEAL}}>+ New Station</strong> to get started, or <strong style={{color:TEAL}}>📂 Load File</strong> to restore a saved project.</div>
            </div>
          )}
          {stations.map(s=>(
            <StationEditor key={s.id} station={s}
              isActive={active===s.id}
              onSelect={()=>setActive(active===s.id?null:s.id)}
              onUpdate={updStation}
              onDelete={()=>delStation(s.id)}
              onPreview={()=>setPreview(s)}
              allStations={stations}
            />
          ))}
        </>)}
        {tab==="balance" && (
          <div style={{background:"white",borderRadius:12,padding:22,boxShadow:"0 1px 5px rgba(0,0,0,0.07)"}}>
            <LineBalance stations={stations}/>
          </div>
        )}
      </div>
      {preview&&<SOPPreview station={preview} onClose={()=>setPreview(null)}/>}
      {showSaveInfo&&<SaveInfoModal onExport={()=>saveFile(stations)} onClose={()=>setShowSaveInfo(false)}/>}
    </div>
  );
}
