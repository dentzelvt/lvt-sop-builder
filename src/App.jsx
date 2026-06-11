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
  tools:"", revisionLog:"A - Initial Release",
  generalNotes:"Tasks may be completed in any order, if steps are numbered they must be followed in order as specified.",
  stationImages:[], tasks:[],
});
const mkTask = (sopId, taskNo) => ({
  id:Date.now()+Math.random(), taskNo, taskId:genTaskId(sopId,taskNo),
  description:"", generalNotes:"", taskImages:[], steps:[],
});
const mkStep = () => ({
  id:Date.now()+Math.random(), useStepNumber:true, stepNumber:"",
  description:"", keyPoints:"", icon:"none", cycleTime:"", image:null,
});

// ─── Persistence ──────────────────────────────────────────────────────────────
const lsSave = (s) => { try { localStorage.setItem(SAVE_KEY, JSON.stringify({version:1,savedAt:new Date().toISOString(),stations:s})); } catch{} };
const lsLoad = ()  => { try { const r=localStorage.getItem(SAVE_KEY); return r?JSON.parse(r).stations:null; } catch{ return null; } };
const saveFile = (stations) => {
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([JSON.stringify({version:1,savedAt:new Date().toISOString(),stations},null,2)],{type:"application/json"}));
  a.download=`sop_save_${new Date().toISOString().slice(0,10)}.json`; a.click();
};
const loadFile = (file,cb) => {
  const r=new FileReader();
  r.onload=e=>{ try{ const d=JSON.parse(e.target.result); if(d.stations) cb(d.stations); else alert("Invalid save file."); }catch{ alert("Could not read file."); } };
  r.readAsText(file);
};

// ─── CSV Export ───────────────────────────────────────────────────────────────
const exportCSV = (stations) => {
  const rows=[["SOP ID","Station No","Station Desc","Task No","Task ID","Task Description","Step No","Step Description","Key Points","Safety Icon","Cycle Time (min)"]];
  stations.forEach(s=>s.tasks.forEach(t=>{
    if(!t.steps.length){ rows.push([s.sopId,s.stationNo,s.stationDesc||"",t.taskNo,t.taskId,t.description,"","","","",""]); return; }
    t.steps.forEach((st,si)=>rows.push([s.sopId,s.stationNo,s.stationDesc||"",t.taskNo,t.taskId,t.description,
      st.stepNumber||si+1,st.description,st.keyPoints,ICONS[st.icon]?.label||"",parseFloat(st.cycleTime)||0]));
  }));
  const csv=rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(",")).join("\r\n");
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8;"}));
  a.download="sop_data.csv"; a.click();
};

// ─── Print HTML ───────────────────────────────────────────────────────────────
// screen=true → colours visible (preview); screen=false → @media print path (PDF popup)
const buildPrintHTML = (station, screen=false) => {
  const safe=(s)=>String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\n/g,"<br/>");
  const today=new Date().toLocaleDateString();

  const hdr=(extra="")=>`
    <table class="ht" cellspacing="0">
      <tr><td rowspan="3" class="logo">LVT</td><td colspan="6" class="title">SOP Trailer Assembly</td></tr>
      <tr><td class="lbl">ASM Version</td><td>${safe(station.asmVersion)||"—"}</td>
          <td class="lbl">Station No:</td><td>${safe(station.stationNo)}</td>
          <td class="lbl">SOP REV.</td><td>${safe(station.sopRev)}</td></tr>
      <tr><td colspan="2" class="lbl">SOP ID:</td><td colspan="2">${safe(station.sopId)}</td>
          <td class="lbl">Station Desc:</td><td>${safe(station.stationDesc)}</td></tr>
      ${extra}
    </table>`;

  const ftr=(label)=>`<div class="footer">
    <span>Live View Technologies &nbsp;|&nbsp; Revised By: ${safe(station.revisedBy)}</span>
    <span>${label} &nbsp;|&nbsp; SOP ID: ${safe(station.sopId)} &nbsp;|&nbsp; Effective Date: ${today}</span>
  </div>`;

  const drawRows=station.drawings.filter(d=>d.drawingNo||d.description)
    .map(d=>`<tr><td>${safe(d.drawingNo)}</td><td>${safe(d.description)}</td><td></td><td></td></tr>`).join("")
    ||`<tr><td colspan="4">&nbsp;</td></tr>`;

  const stImgs=(station.stationImages||[]).map(src=>`<img src="${src}" class="thumb"/>`).join("");

  const cover=`<div class="page">${hdr()}
    <table class="bt" cellspacing="0">
      <tr><td colspan="4" class="sh">Purpose</td></tr>
      <tr><td colspan="4" class="content">${safe(station.purpose)}&nbsp;</td></tr>
      <tr><td colspan="4" class="sh">Safety Summary</td></tr>
      <tr><td colspan="4" class="content">${safe(station.safety)}&nbsp;</td></tr>
      <tr><td colspan="4" class="sh">Applicable Drawings</td></tr>
      <tr><td class="lbl" style="width:18%">Drawing #</td><td class="lbl" style="width:32%">Description</td>
          <td class="lbl" style="width:18%">Drawing #</td><td class="lbl" style="width:32%">Description</td></tr>
      ${drawRows}
      <tr><td colspan="2" class="content vtop"><strong>Tool and Equipment List</strong><br/>${safe(station.tools)}&nbsp;</td>
          <td colspan="2" class="content vtop"><strong>Revision Log</strong><br/>${safe(station.revisionLog)}&nbsp;</td></tr>
      <tr><td colspan="4" class="sh">General Notes</td></tr>
      <tr><td colspan="4" class="content">${safe(station.generalNotes)}${stImgs?"<br/>"+stImgs:""}&nbsp;</td></tr>
    </table>${ftr("Page 1")}</div>`;

  const taskPages=station.tasks.map((task)=>{
    const tImgs=(task.taskImages||[]).map(src=>`<img src="${src}" class="thumb"/>`).join("");
    const stepRows=task.steps.map((step,si)=>{
      const ico=step.icon!=="none"?(ICONS[step.icon]?.emoji+" "):"";
      const num=step.useStepNumber?`<strong>${step.stepNumber||si+1}</strong>`:"";
      const img=step.image?`<div class="step-img-wrap"><img src="${step.image}" class="sthumb"/></div>`:"";
      // key-point rows get a teal-tinted background
      const kpHtml=step.keyPoints?`<br/><em class="kp">${safe(step.keyPoints)}</em>`:"";
      return `<tr class="step-row">
        <td class="step-num">${num}</td>
        <td class="step-desc">${ico}<strong>${safe(step.description)}</strong>${kpHtml}${img}</td>
        <td class="step-time">${step.cycleTime?parseFloat(step.cycleTime).toFixed(2):""}</td>
      </tr>`;
    }).join("");
    return `<div class="task-block">
      ${hdr(`<tr>
        <td colspan="2" class="task-lbl">Task No.&nbsp;${task.taskNo}</td>
        <td colspan="2" class="task-lbl" style="font-family:monospace">${safe(task.taskId)}</td>
        <td colspan="2" class="task-desc"><strong>${safe(task.description)}</strong></td>
      </tr>`)}
      <table class="bt" cellspacing="0">
        <tr><td colspan="3" class="sh">General Task Notes (For Reference Only)</td></tr>
        <tr><td colspan="3" class="content notes-cell">${safe(task.generalNotes)}${tImgs?"<br/>"+tImgs:""}&nbsp;</td></tr>
        <tr>
          <td colspan="2" class="sh">&nbsp;</td>
          <td class="sh ct-cell">Est. Cycle Time:&nbsp;${fmtTime(sumSteps(task.steps))}</td>
        </tr>
        <tr class="col-head">
          <td class="step-num col-hdr">Step</td>
          <td class="col-hdr">Description</td>
          <td class="step-time col-hdr">Time</td>
        </tr>
        ${stepRows||`<tr><td colspan="3" class="content">&nbsp;</td></tr>`}
      </table>
      ${ftr(`Task ${task.taskNo} of ${station.tasks.length}`)}
    </div>`;
  }).join("");

  // Screen mode: pages rendered as white sheets on a grey background, fixed 8.5×11 width
  // Print mode: standard @page rules take over, -webkit-print-color-adjust forces colour
  const screenStyles = screen ? `
    body { background:#6b7280; padding: 32px 0; }
    .page, .task-block {
      width: 8.5in;
      min-height: 11in;
      margin: 0 auto 32px;
      padding: 0.5in;
      background: white;
      box-shadow: 0 4px 24px rgba(0,0,0,0.35);
      page-break-after: unset !important;
      page-break-before: unset !important;
    }` : `
    @page { size:8.5in 11in portrait; margin:0.5in; }
    body { margin:0; padding:0; background:white; }
    .page { page-break-after:always; }
    .task-block { page-break-before:always; }`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>SOP ${station.sopId}</title>
  <style>
    /* ── force colour output in print ── */
    * { -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; box-sizing:border-box; font-family:Arial,sans-serif; }
    body { font-size:10pt; }
    ${screenStyles}
    .step-row{page-break-inside:avoid;} .col-head{page-break-after:avoid;} .notes-cell{page-break-inside:avoid;}

    /* ── header table ── */
    .ht{width:100%;border-collapse:collapse;}
    .ht td{border:1px solid #888;padding:3px 5px;font-size:9pt;}
    .logo{width:62px;background:#00897b !important;color:white !important;font-size:17pt;font-weight:900;text-align:center;vertical-align:middle;}
    .title{text-align:center;font-size:15pt;font-weight:bold;background:#00897b !important;color:white !important;padding:6px;}
    .lbl{font-weight:bold;background:#e0e0e0 !important;}
    .task-lbl{font-weight:bold;background:#b2dfdb !important;color:#00695c;}
    .task-desc{background:#e0f2f1 !important;font-size:9pt;}

    /* ── body table ── */
    .bt{width:100%;border-collapse:collapse;margin-top:4px;}
    .bt td{border:1px solid #888;padding:4px 6px;font-size:9pt;}
    .sh{background:#e0e0e0 !important;font-weight:bold;text-align:center;padding:4px 6px;}
    .col-hdr{background:#00897b !important;color:white !important;font-weight:bold;padding:5px 6px;}
    .ct-cell{text-align:right;white-space:nowrap;}
    .content{padding:5px 7px;min-height:20px;}
    .vtop{vertical-align:top;}

    /* ── steps ── */
    .step-num{width:32px;text-align:center;vertical-align:top;padding:4px 3px;font-size:9pt;}
    .step-desc{vertical-align:top;padding:4px 6px;font-size:9pt;}
    .step-time{width:58px;text-align:right;vertical-align:top;padding:4px 5px;font-size:9pt;white-space:nowrap;}
    .kp{color:#00695c;font-size:8pt;font-style:italic;}

    /* ── images ── */
    .thumb{max-width:220px;max-height:150px;margin:3px 3px 0 0;border:1px solid #bbb;display:inline-block;}
    .sthumb{max-width:100%;max-height:3.2in;display:block;margin-top:5px;border:1px solid #bbb;}
    .step-img-wrap{page-break-inside:avoid;}

    /* ── footer ── */
    .footer{display:flex;justify-content:space-between;margin-top:8px;font-size:8pt;
            color:#555;border-top:2px solid #00897b;padding-top:4px;}
  </style></head>
  <body>${cover}${taskPages}
  ${!screen?`<script>window.onload=()=>{setTimeout(()=>window.print(),400);}<\/script>`:""}
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

// ─── Step Editor ──────────────────────────────────────────────────────────────
function StepEditor({ step, idx, showNums, onChange, onDelete, dragProps, allStations, thisStationId, thisTaskId, onMoveStep }) {
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
        <select value={step.icon} onChange={e=>u("icon",e.target.value)} style={{padding:"3px 5px",border:"1px solid #ccc",borderRadius:4,fontSize:12}}>
          {Object.entries(ICONS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
        </select>
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
function TaskEditor({ task, dragProps, onUpdate, onDelete, allStations, thisStationId, onMoveTask }) {
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
          <button onClick={e=>{e.stopPropagation();onDelete();}} style={{background:"rgba(200,0,0,0.12)",border:"1px solid rgba(200,0,0,0.25)",borderRadius:4,padding:"3px 8px",cursor:"pointer",color:"#c62828",fontSize:12}}>✕</button>
        </div>
      </div>

      {isActive && (
        <div style={{padding:16}}>
          {/* Station fields */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8,marginBottom:8}}>
            {[{l:"Station No. *",f:"stationNo",ph:"REF-WIP-02"},{l:"Station Description",f:"stationDesc",ph:"BATTERY"},
              {l:"ASM Version",f:"asmVersion",ph:"2"},{l:"SOP Revision",f:"sopRev",ph:"A"},{l:"Revised By",f:"revisedBy",ph:"Name"}
            ].map(({l,f,ph})=>(
              <div key={f}>
                <label style={{fontSize:11,color:"#555",display:"block",marginBottom:2}}>{l}</label>
                <input value={station[f]||""} onChange={e=>u(f,e.target.value)} placeholder={ph}
                  style={{width:"100%",padding:"5px 7px",border:"1px solid #ccc",borderRadius:4,fontSize:12}}/>
              </div>
            ))}
          </div>
          <div style={{marginBottom:10}}>
            <label style={{fontSize:11,color:"#555",display:"block",marginBottom:2}}>Generated SOP ID</label>
            <input value={station.sopId} readOnly style={{width:"100%",padding:"5px 7px",border:"1px solid #ccc",borderRadius:4,fontSize:13,background:"#f5f5f5",fontFamily:"monospace",fontWeight:700,color:TEAL_DARK}}/>
          </div>
          {[{l:"Purpose",f:"purpose",rows:2},{l:"Safety Summary",f:"safety",rows:3},
            {l:"Tools & Equipment",f:"tools",rows:2},{l:"Revision Log",f:"revisionLog",rows:2},{l:"General Notes",f:"generalNotes",rows:2}
          ].map(({l,f,rows})=>(
            <div key={f} style={{marginBottom:8}}>
              <label style={{fontSize:11,color:"#555",display:"block",marginBottom:2}}>{l}</label>
              <textarea value={station[f]||""} onChange={e=>u(f,e.target.value)} rows={rows}
                style={{width:"100%",padding:"5px 7px",border:"1px solid #ccc",borderRadius:4,fontSize:12,resize:"vertical"}}/>
            </div>
          ))}
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

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [stations, setStations] = useState(()=>lsLoad()||[]);
  const [active,   setActive]   = useState(null);
  const [tab,      setTab]      = useState("stations");
  const [preview,  setPreview]  = useState(null);
  const [saveMsg,  setSaveMsg]  = useState("");
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
          <button onClick={()=>{lsSave(stations);flash("✓ Saved");}} style={{background:"rgba(255,255,255,0.15)",border:"1px solid rgba(255,255,255,0.35)",borderRadius:5,padding:"5px 11px",cursor:"pointer",fontSize:12,color:"white"}}>💾 Save</button>
          <button onClick={()=>{saveFile(stations);flash("✓ File downloaded");}} style={{background:"rgba(255,255,255,0.15)",border:"1px solid rgba(255,255,255,0.35)",borderRadius:5,padding:"5px 11px",cursor:"pointer",fontSize:12,color:"white"}}>⬇️ Export Save</button>
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
    </div>
  );
}
