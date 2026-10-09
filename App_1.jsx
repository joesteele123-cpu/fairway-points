import React, { useMemo, useState } from "react";

const COURSES = [
  { name: "Nashboro Golf Course", pars: [4,4,3,5,4,4,5,3,4,5,4,4,3,4,3,4,5,4], si: [2,8,16,6,12,4,18,14,10,7,3,5,17,9,15,1,13,11] },
  { name: "Pine Creek Golf Course — Mount Juliet, TN", pars: [4,5,3,4,4,3,4,5,4,4,4,3,5,4,3,4,5,4], si: [17,9,3,1,13,11,15,5,7,6,18,8,14,2,16,10,4,12] },
  { name: "Ted Rhodes Golf Course — Nashville, TN", pars: [5,4,3,4,4,4,4,4,3,5,4,3,5,4,3,5,4,4], si: [13,11,9,5,15,17,3,1,7,14,18,6,16,8,2,12,10,4] },
  { name: "Indian Hills Golf Course — Murfreesboro, TN", pars: [4,4,5,4,3,4,3,5,4,5,4,4,3,4,3,4,5,4], si: [9,11,5,17,7,1,13,3,15,8,10,12,6,16,14,18,2,4] },
];

const STANDINGS_KEY = "fairway-points-standings";
const THEME_KEY = "fairway-points-dark-mode";

function readStorage(key, fallback) {
  try { const v = window.localStorage.getItem(key); return v===null?fallback:JSON.parse(v); } catch { return fallback; }
}
function makePlayer(name) {
  return { id: (window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2,9)}`), name, handicap: 0 };
}
function makeEmptyScores(players) { return Object.fromEntries(players.map(p=>[p.id, Array(18).fill("")])) }
function strokesForHole(handicap, strokeIndex) { const v=Math.max(0,Number(handicap)||0); return Math.floor(v/18)+(strokeIndex<=v%18?1:0); }
function parseCourse(text){
  const lines=text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  const getLine=(label)=>lines.find(l=>l.toLowerCase().startsWith(`${label}:`));
  const nameLine=getLine("Name"); const parLine=getLine("Par"); const siLine=getLine("SI");
  if(!nameLine||!parLine||!siLine) return {error:"Use three lines: Name:, Par: (18 values), and SI: (18 values)."};
  const name=nameLine.slice(nameLine.indexOf(":")+1).trim();
  const values=(line)=>line.slice(line.indexOf(":")+1).split(/[,\s]+/).filter(Boolean).map(Number);
  const pars=values(parLine); const si=values(siLine);
  if(!name) return {error:"Enter a course name."};
  if(pars.length!==18||pars.some(v=>!Number.isInteger(v)||v<3||v>6)) return {error:"Par must contain exactly 18 integers from 3 to 6."};
  if(si.length!==18||si.some(v=>!Number.isInteger(v)||v<1||v>18)||new Set(si).size!==18) return {error:"SI must contain each integer from 1 to 18 exactly once."};
  return {course:{name,pars,si}};
}
function calculate(players, scores, pars, strokeIndexes){
  let carryover=0; const carryovers=[]; const standardByHole=Array.from({length:18},()=>({})); const bonusByHole=Array.from({length:18},()=>({})); const standardTotals=Object.fromEntries(players.map(p=>[p.id,0])); const bonusTotals=Object.fromEntries(players.map(p=>[p.id,0]));
  const debug=[];
  for(let hole=0;hole<18;hole++){
    carryovers.push(carryover);
    players.forEach(p=>{standardByHole[hole][p.id]=0; bonusByHole[hole][p.id]=0;});
    const complete=players.length>1&&players.every(p=>{const s=scores[p.id]?.[hole]; return s!==""&&s!=null&&Number(s)>0;});
    if(complete){
      const nets=players.map(p=>({id:p.id,name:p.name,gross:Number(scores[p.id][hole]),net:Number(scores[p.id][hole])-strokesForHole(p.handicap,strokeIndexes[hole]),strokes:strokesForHole(p.handicap,strokeIndexes[hole])}));
      const low=Math.min(...nets.map(e=>e.net)); const winners=nets.filter(e=>e.net===low);
      if(winners.length===1){ const winnerId=winners[0].id; const award=2+carryover; players.forEach(p=>{standardByHole[hole][p.id]=p.id===winnerId?award*(players.length-1):-award;}); debug.push(`Hole ${hole+1}: ${winners[0].name} wins +${award*(players.length-1)} (${players.filter(p=>p.id!==winnerId).map(p=>`${p.name} ${-award}`).join(", ")}) | Nets: ${nets.map(n=>`${n.name} ${n.gross}-${n.strokes}=${n.net}`).join(", ")} (SI${strokeIndexes[hole]})`); carryover=0; } else { debug.push(`Hole ${hole+1}: Tie at net ${low} between ${winners.map(w=>w.name).join(", ")} - carryover ${carryover} -> ${Math.min(4,carryover+2)}`); carryover=Math.min(4,carryover+2); }
    }
    players.forEach(p=>{ const sc=scores[p.id]?.[hole]; if(sc===""||sc==null||!Number.isFinite(Number(sc))) return; const under=Number(pars[hole])-Number(sc); const bonus=under===2?5:under===1?2:0; if(!bonus||players.length<2) return; players.forEach(op=>{bonusByHole[hole][op.id]+=op.id===p.id?bonus*(players.length-1):-bonus;}); });
    players.forEach(p=>{standardTotals[p.id]+=standardByHole[hole][p.id]; bonusTotals[p.id]+=bonusByHole[hole][p.id];});
  }
  const totals=Object.fromEntries(players.map(p=>[p.id,standardTotals[p.id]+bonusTotals[p.id]]));
  return {carryovers,standardByHole,bonusByHole,standardTotals,bonusTotals,totals,debug};
}

export default function App(){
  const [initialPlayers]=useState(()=>[makePlayer("Joe"),makePlayer("Brad"),makePlayer("Graham")]);
  const [players,setPlayers]=useState(initialPlayers); const [scores,setScores]=useState(()=>makeEmptyScores(initialPlayers));
  const [courseName,setCourseName]=useState(COURSES[0].name); const [pars,setPars]=useState([...COURSES[0].pars]); const [strokeIndexes,setStrokeIndexes]=useState([...COURSES[0].si]);
  const [query,setQuery]=useState(""); const [manualText,setManualText]=useState(""); const [importError,setImportError]=useState(""); const [notice,setNotice]=useState("");
  const [darkMode,setDarkMode]=useState(()=>readStorage(THEME_KEY,false)); const [standings,setStandings]=useState(()=>readStorage(STANDINGS_KEY,{})); const [phase,setPhase]=useState("setup"); const [roundSaved,setRoundSaved]=useState(false);
  const result=useMemo(()=>calculate(players,scores,pars,strokeIndexes),[players,scores,pars,strokeIndexes]);
  const filteredCourses=COURSES.filter(c=>c.name.toLowerCase().includes(query.trim().toLowerCase()));
  const holesCompleted=Array.from({length:18},(_,h)=>h).filter(h=>players.length>0&&players.every(p=>{const v=scores[p.id]?.[h]; return v!==""&&v!=null&&Number(v)>0;})).length;
  const importCourse=(course)=>{setCourseName(course.name); setPars([...course.pars]); setStrokeIndexes([...course.si]); setImportError(""); setNotice(`${course.name} loaded. Pars and SI remain editable.`);};
  const importManual=()=>{const parsed=parseCourse(manualText); if(parsed.error){setImportError(parsed.error); setNotice(""); return;} importCourse(parsed.course);};
  const updatePlayer=(id,key,value)=>{setPlayers(cur=>cur.map(p=>p.id===id?{...p,[key]:key==="handicap"?Math.max(0,Number(value)||0):value}:p));};
  const updateScore=(playerId,hole,value)=>{setScores(cur=>({...cur,[playerId]:(cur[playerId]||Array(18).fill("")).map((s,i)=>i===hole?value:s)}));};
  const updateCourseValue=(setter,index,value)=>{setter(cur=>cur.map((item,idx)=>idx===index?(value===""?"":Number(value)):item));};
  const addPlayer=()=>{if(players.length>=8||phase!=="setup") return; const player=makePlayer(`Player ${players.length+1}`); setPlayers(cur=>[...cur,player]); setScores(cur=>({...cur,[player.id]:Array(18).fill("")}));};
  const removePlayer=(id)=>{if(players.length<=2||phase!=="setup") return; setPlayers(cur=>cur.filter(p=>p.id!==id)); setScores(cur=>{const n={...cur}; delete n[id]; return n;});};
  const startRound=()=>{const active=players.filter(p=>p.name.trim()); if(active.length<2) return; setPlayers(active); setPhase("playing"); setRoundSaved(false);};
  const endRound=()=>{if(roundSaved) return; const updated={...standings}; players.forEach(p=>{const name=p.name.trim(); if(!name) return; const prev=updated[name]||{rounds:0,points:0}; updated[name]={rounds:prev.rounds+1,points:prev.points+result.totals[p.id]};}); setStandings(updated); try{window.localStorage.setItem(STANDINGS_KEY,JSON.stringify(updated));}catch{} setRoundSaved(true); setPhase("ended");};
  const resetRound=()=>{setScores(makeEmptyScores(players)); setRoundSaved(false); setPhase("setup");};
  const toggleTheme=()=>{setDarkMode(cur=>{const next=!cur; try{window.localStorage.setItem(THEME_KEY,JSON.stringify(next));}catch{} return next;});};
  const sortedStandings=Object.entries(standings).sort((a,b)=>b[1].points!==a[1].points?b[1].points-a[1].points:b[1].rounds-a[1].rounds);
  const shell=darkMode?"min-h-screen bg-slate-950 text-slate-100":"min-h-screen bg-slate-50 text-slate-900";
  const panel=darkMode?"border-slate-800 bg-slate-900":"border-slate-200 bg-white";
  const muted=darkMode?"text-slate-400":"text-slate-500";
  const inputClass=`rounded-lg border px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 ${darkMode?"border-slate-700 bg-slate-950 text-slate-100":"border-slate-200 bg-white text-slate-900"}`;
  const showPoints=(v)=>v>0?`+${v}`:`${v}`; const pointColor=(v)=>v>0?"text-green-500":v<0?"text-red-500":muted;
  return (
    <main className={`${shell} transition-colors duration-300`}>
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-500 text-2xl shadow-lg">⛳</div><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-green-500">Season golf tracker</p><h1 className="text-2xl font-black sm:text-3xl">Fairway Points</h1></div></div>
          <div className="flex items-center gap-3"><span className={`hidden text-sm sm:inline ${muted}`}>{courseName}</span><button type="button" onClick={toggleTheme} className={`flex h-10 w-10 items-center justify-center rounded-xl border ${panel}`}>{darkMode?"☀":"☾"}</button></div>
        </header>
        <section className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className={`rounded-2xl border p-4 ${panel}`}><p className={`text-xs font-semibold uppercase tracking-wider ${muted}`}>Round status</p><p className="mt-2 text-lg font-bold">{phase==="setup"?"Ready to set up":phase==="playing"?"Round in progress":"Round complete"}</p></div>
          <div className={`rounded-2xl border p-4 ${panel}`}><p className={`text-xs font-semibold uppercase tracking-wider ${muted}`}>Holes completed</p><p className="mt-2 text-lg font-bold">{holesCompleted}<span className={`text-sm ${muted}`}> / 18</span></p></div>
          <div className={`rounded-2xl border p-4 ${panel}`}><p className={`text-xs font-semibold uppercase tracking-wider ${muted}`}>Standard swing</p><p className="mt-2 text-lg font-bold">Up to <span className="text-green-500">+6 / −6</span><span className={`text-sm ${muted}`}> per opponent</span></p></div>
        </section>
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            {phase==="setup"&&(<>
              <section className={`rounded-2xl border p-5 shadow-sm sm:p-6 ${panel}`}><h2 className="text-lg font-bold">Round setup</h2><p className={`mt-1 text-sm ${muted}`}>Search offline courses or import a scorecard manually.</p>
                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  <section className={`rounded-xl border p-4 ${darkMode?"border-slate-800 bg-slate-950/50":"border-slate-100 bg-slate-50"}`}><h3 className="font-bold">Offline course search</h3><label className="mt-3 block"><span className={`mb-1 block text-xs font-semibold ${muted}`}>Search courses</span><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search course name…" className={`w-full ${inputClass}`} /></label>
                    <div className="mt-3 space-y-2">{filteredCourses.map(course=><button key={course.name} onClick={()=>importCourse(course)} className={`w-full rounded-lg border p-3 text-left ${courseName===course.name?"border-blue-500 bg-blue-500/10":darkMode?"border-slate-800 bg-slate-900":"border-slate-200 bg-white"}`}><span className="block text-sm font-semibold">{course.name}</span></button>)}</div>
                  </section>
                  <section className={`rounded-xl border p-4 ${darkMode?"border-slate-800 bg-slate-950/50":"border-slate-100 bg-slate-50"}`}><h3 className="font-bold">Manual import</h3><textarea rows={5} value={manualText} onChange={e=>{setManualText(e.target.value); setImportError(""); setNotice("");}} placeholder={"Name: Course name\nPar: 4,4,3,5,4,4,5,3,4,5,4,4,3,4,3,4,5,4\nSI: 2,8,16,6,12,4,18,14,10,7,3,5,17,9,15,1,13,11"} className={`mt-3 w-full resize-y font-mono text-xs ${inputClass}`} /><div className="mt-3 flex gap-2"><button onClick={importManual} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white">Validate and import</button><button onClick={()=>{setManualText(""); setImportError(""); setNotice("");}} className={`rounded-lg border px-3 py-2 text-sm ${darkMode?"border-slate-700":"border-slate-200"}`}>Clear</button></div>{importError&&<p className="mt-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">{importError}</p>}{notice&&<p className="mt-2 rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-600">{notice}</p>}</section>
                </div>
                <div className="mt-6 flex justify-between"><h3 className="font-bold">Players</h3><button onClick={addPlayer} disabled={players.length>=8} className="rounded-xl border border-blue-500/30 px-3 py-2 text-sm font-semibold text-blue-500 disabled:opacity-40">+ Add player</button></div>
                <div className="mt-3 space-y-3">{players.map((player,i)=><div key={player.id} className={`grid gap-3 rounded-xl border p-3 sm:grid-cols-[1fr_150px_42px] ${darkMode?"border-slate-800 bg-slate-950/60":"border-slate-100 bg-slate-50"}`}><label><span className={`mb-1 block text-xs font-semibold ${muted}`}>Player {i+1}</span><input value={player.name} onChange={e=>updatePlayer(player.id,"name",e.target.value)} className={`w-full ${inputClass}`} /></label><label><span className={`mb-1 block text-xs font-semibold ${muted}`}>Handicap</span><input type="number" min="0" max="54" value={player.handicap} onChange={e=>updatePlayer(player.id,"handicap",e.target.value)} className={`w-full ${inputClass}`} /></label><button onClick={()=>removePlayer(player.id)} disabled={players.length<=2} className={`mt-5 rounded-lg text-xl ${muted}`}>×</button></div>)}</div>
                <button onClick={startRound} disabled={players.filter(p=>p.name.trim()).length<2} className="mt-5 w-full rounded-2xl bg-blue-600 px-5 py-4 font-bold text-white shadow-lg disabled:opacity-50">Start round →</button>
              </section>
              <section className={`rounded-2xl border p-5 sm:p-6 ${panel}`}><h2 className="font-bold">Editable course card · {courseName}</h2><div className="overflow-x-auto mt-4"><table className="w-full min-w-[700px] text-center text-sm border-separate border-spacing-0"><thead><tr><th className={`sticky left-0 px-3 py-2 text-left ${darkMode?"bg-slate-800":"bg-slate-100"}`}>Hole</th>{Array.from({length:18},(_,h)=><th key={h} className={`px-2 py-2 ${darkMode?"bg-slate-800":"bg-slate-100"}`}>{h+1}</th>)}<th>Total</th></tr></thead><tbody><tr><th className={`sticky left-0 px-3 py-2 text-left ${darkMode?"bg-slate-900":"bg-white"}`}>Par</th>{pars.map((par,h)=><td key={h} className="px-1 py-1"><input type="number" min="3" max="6" value={par} onChange={e=>updateCourseValue(setPars,h,e.target.value)} className={`w-12 text-center ${inputClass}`} /></td>)}<td className="font-bold">{pars.reduce((s,v)=>s+(Number(v)||0),0)}</td></tr><tr><th className={`sticky left-0 px-3 py-2 text-left ${darkMode?"bg-slate-900":"bg-white"}`}>SI</th>{strokeIndexes.map((si,h)=><td key={h} className="px-1 py-1"><input type="number" min="1" max="18" value={si} onChange={e=>updateCourseValue(setStrokeIndexes,h,e.target.value)} className={`w-12 text-center ${inputClass}`} /></td>)}<td className={`text-xs ${muted}`}>Idx</td></tr></tbody></table></div></section>
            </>)}
            {(phase==="playing"||phase==="ended")&&(<>
              {result.debug.length>0&&<div className="rounded-2xl border border-green-500/30 bg-green-500/10 p-4 text-sm"><p className="font-bold text-green-600 mb-2">✓ Calculation trace (Graham hole 1 fix)</p><div className="space-y-1 font-mono text-xs">{result.debug.map((d,i)=><div key={i}>{d}</div>)}</div></div>}
              <section className={`overflow-hidden rounded-2xl border shadow-sm ${panel}`}>
                <div className="flex justify-between p-5 border-b"><h2 className="text-lg font-bold">Live scorecard · {courseName}</h2>{phase==="ended"&&<span className="rounded-full bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-500">Round locked</span>}</div>
                <div className="overflow-x-auto"><table className="w-full min-w-[920px] border-separate border-spacing-0 text-center text-xs"><thead><tr><th className={`sticky left-0 z-20 min-w-32 px-3 py-3 text-left ${darkMode?"bg-slate-800":"bg-slate-100"}`}>Hole</th>{Array.from({length:18},(_,h)=><th key={h} className={`min-w-12 px-2 py-3 ${darkMode?"bg-slate-800":"bg-slate-100"}`}>{h+1}</th>)}<th>Total</th></tr><tr><th className={`sticky left-0 z-20 px-3 py-2 text-left ${darkMode?"bg-slate-900":"bg-white"}`}>Par / SI</th>{pars.map((par,h)=><th key={h} className={`px-1 py-2 font-medium ${muted}`}>{par}<span className="block text-[10px]">SI {strokeIndexes[h]}</span></th>)}<th className={`${muted}`}>{pars.reduce((s,v)=>s+(Number(v)||0),0)}</th></tr></thead>
                  <tbody>{players.map(player=>{
                    const ps=scores[player.id]||Array(18).fill(""); const grossTotal=ps.reduce((s,v)=>s+(Number(v)||0),0);
                    const netTotal=ps.reduce((s,v,h)=>v===""?s:s+Number(v)-strokesForHole(player.handicap,strokeIndexes[h]),0);
                    return (<React.Fragment key={player.id}>
                      <tr><th className={`sticky left-0 z-10 px-3 py-2 text-left font-semibold ${darkMode?"bg-slate-900":"bg-white"}`}>{player.name}<span className={`block text-[10px] ${muted}`}>Gross</span></th>{Array.from({length:18},(_,h)=><td key={h} className="px-1 py-1"><input type="number" min="1" max="20" value={ps[h]} onChange={e=>updateScore(player.id,h,e.target.value)} disabled={phase==="ended"} className={`w-10 text-center ${inputClass}`} /></td>)}<td className="font-bold">{grossTotal||"—"}</td></tr>
                      <tr className={darkMode?"bg-slate-950/40":"bg-slate-50"}><th className={`sticky left-0 px-3 py-2 text-left ${darkMode?"bg-slate-950":"bg-slate-50"}`}>Net</th>{ps.map((v,h)=><td key={h} className={`px-1 py-2 font-mono ${v===""?muted:"font-semibold"}`} title={`Strokes: ${strokesForHole(player.handicap,strokeIndexes[h])}`}>{v===""?"—":Number(v)-strokesForHole(player.handicap,strokeIndexes[h])}</td>)}<td className="font-bold">{ps.filter(v=>v!=="").length?netTotal:"—"}</td></tr>
                      <tr className={darkMode?"bg-slate-900/50":"bg-white"}><th className={`sticky left-0 px-3 py-2 text-left ${darkMode?"bg-slate-900":"bg-white"}`}>Std Pts <span className="block text-[10px] font-normal text-green-500">FIXED</span></th>{Array.from({length:18},(_,h)=>{const val=result.standardByHole[h][player.id]; return <td key={h} className={`px-1 py-2`}><span className={`inline-flex min-w-8 justify-center rounded-full px-2 py-0.5 font-mono font-bold ${val>0?"bg-green-500/20 text-green-500":val<0?"bg-red-500/20 text-red-500":muted}`}>{val===0?"—":showPoints(val)}</span></td>;})}<td className={`font-bold ${pointColor(result.standardTotals[player.id])}`}>{showPoints(result.standardTotals[player.id])}</td></tr>
                      <tr className={darkMode?"border-b border-slate-800 bg-slate-950/20":"border-b border-slate-100 bg-white"}><th className={`sticky left-0 px-3 py-2 text-left ${darkMode?"bg-slate-950":"bg-white"}`}>Bonus</th>{Array.from({length:18},(_,h)=>{const val=result.bonusByHole[h][player.id]; return <td key={h} className={`px-1 py-2 font-mono font-bold ${pointColor(val)}`}>{val===0?"—":showPoints(val)}</td>;})}<td className={`font-bold ${pointColor(result.bonusTotals[player.id])}`}>{showPoints(result.bonusTotals[player.id])}</td></tr>
                    </React.Fragment>);
                  })}</tbody></table></div>
                <div className={`flex flex-wrap gap-2 border-t px-5 py-3 text-xs ${muted}`}><span>Carryover:</span>{result.carryovers.map((v,h)=>v>0?<span key={h} className="font-semibold text-amber-500">H{h+1}: +{v}</span>:null)}{!result.carryovers.some(v=>v>0)&&<span>None</span>}</div>
              </section>
              <section className={`rounded-2xl border p-5 ${panel}`}><h2 className="mb-4 font-bold">Round leaderboard</h2><div className="grid gap-3 sm:grid-cols-2">{[...players].sort((a,b)=>result.totals[b.id]-result.totals[a.id]).map((p,i)=><div key={p.id} className={`flex justify-between rounded-xl border p-4 ${darkMode?"border-slate-800 bg-slate-950/60":"border-slate-100 bg-slate-50"}`}><div><p className="font-bold">{i+1}. {p.name}</p><p className={`text-xs ${muted}`}>Std {showPoints(result.standardTotals[p.id])} · Bonus {showPoints(result.bonusTotals[p.id])}</p></div><span className={`font-mono text-xl font-black ${pointColor(result.totals[p.id])}`}>{showPoints(result.totals[p.id])}</span></div>)}</div></section>
              {phase==="playing"?<button onClick={endRound} className="w-full rounded-2xl bg-green-600 px-5 py-4 font-bold text-white">End round and save standings</button>:<button onClick={resetRound} className="w-full rounded-2xl bg-blue-600 px-5 py-4 font-bold text-white">Set up another round →</button>}
            </>)}
          </div>
          <aside className="space-y-6"><section className={`rounded-2xl border p-5 ${panel}`}><h2 className="font-bold">Season standings</h2><div className="mt-4 space-y-2">{Object.entries(standings).sort((a,b)=>b[1].points-a[1].points).map(([name,data],i)=><div key={name} className={`flex justify-between rounded-xl px-3 py-3 ${darkMode?"bg-slate-950/60":"bg-slate-50"}`}><div><p className="text-sm font-semibold">{String(i+1).padStart(2,"0")} · {name}</p><p className={`text-xs ${muted}`}>{data.rounds} rounds</p></div><span className={`font-mono font-bold ${pointColor(data.points)}`}>{showPoints(data.points)}</span></div>)}{Object.keys(standings).length===0&&<p className={`text-sm ${muted}`}>Finish a round to start table.</p>}</div></section></aside>
        </div>
        <footer className={`mt-8 border-t py-5 text-center text-xs ${muted}`}>Fairway Points · Fixed build for Netlify</footer>
      </div>
    </main>
  );
}
