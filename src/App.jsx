import { useState, useRef, useCallback } from "react";

const SYSTEM = `You are The Honorable J. Ustice, Chief Justice of the Supreme Court of Petty Disputes. You are completely impartial — the plaintiff has NO advantage for filing the case. You will rule against them without hesitation if their case is weak, if they provoked the situation, or if the defendant's position is more defensible. If a defendant pleaded guilty, acknowledge it but still determine a proportionate remedy.

Treat every case with absolute gravity and zero irony. Heavy legal Latin and courtroom jargon throughout. If photographic evidence was submitted by either party, examine each exhibit carefully and reference it explicitly as Exhibit A, B, C (plaintiff) or Exhibit W, X, Y (defendant).

Format your ruling EXACTLY using these markers:

%%CASE_FILING%%
[Formal case name and number: e.g. "TORRES v. KIM, Case No. SPD-2026-5512 | Supreme Court of Petty Disputes"]

%%CHARGES%%
[1-2 formal charges in dramatic legal language — or a counter-finding against plaintiff if they are in the wrong]

%%PLAINTIFF_OPENING%%
[2-3 sentences presenting the plaintiff's position formally]

%%DEFENSE_OPENING%%
[2-3 sentences presenting the defendant's position — if guilty plea, note this formally]

%%EVIDENCE%%
[3-5 bullet points. Reference any exhibits specifically. Start each with —]

%%DELIBERATION%%
[2-3 sentences of sharp, honest judicial reasoning. Do not pull punches.]

%%VERDICT%%
[GUILTY / NOT GUILTY / PARTIALLY LIABLE / PLAINTIFF IN CONTEMPT — then em dash — then one devastating sentence]

%%REMEDY%%
[Specific, formal, court-ordered remedy. Seriousness of tone makes mundane remedies funnier.]

%%FINAL_WORD%%
[One unforgettable, quotable closing line. Make it hit.]`;

const SECS = ["CASE_FILING","CHARGES","PLAINTIFF_OPENING","DEFENSE_OPENING","EVIDENCE","DELIBERATION","VERDICT","REMEDY","FINAL_WORD"];
function parse(raw) {
  const out = {};
  SECS.forEach((k,i) => {
    const a=`%%${k}%%`, b=SECS[i+1]?`%%${SECS[i+1]}%%`:null;
    const s=raw.indexOf(a); if(s<0) return;
    out[k]=raw.slice(s+a.length,(b&&raw.indexOf(b)>-1)?raw.indexOf(b):undefined).trim();
  });
  return out;
}
function vColor(v=""){
  if(v.includes("NOT GUILTY")) return "#4A9E6B";
  if(v.includes("CONTEMPT")) return "#C4522A";
  if(v.includes("PARTIALLY")) return "#C8960A";
  return "#9B2020";
}
function vLabel(v=""){return v.split("—")[0].split("\n")[0].trim();}
function vRest(v=""){const p=v.split("—");return p.length>1?p.slice(1).join("—").trim():v.split("\n").slice(1).join(" ").trim();}
function genId(){return Math.random().toString(36).substr(2,6).toUpperCase();}
async function compress(file,maxDim=720,q=0.65){
  return new Promise(res=>{
    const img=new Image(),url=URL.createObjectURL(file);
    img.onload=()=>{
      const s=Math.min(1,maxDim/Math.max(img.width,img.height));
      const c=document.createElement("canvas");
      c.width=Math.round(img.width*s);c.height=Math.round(img.height*s);
      c.getContext("2d").drawImage(img,0,0,c.width,c.height);
      URL.revokeObjectURL(url);res(c.toDataURL("image/jpeg",q).split(",")[1]);
    };
    img.src=url;
  });
}
function buildSpeech(v){
  const cl=t=>(t||"").replace(/%%\w+%%/g,"").replace(/—/g,"...").replace(/\n/g," ").trim();
  return ["Order. Order in the court.",cl(v.CASE_FILING)+".","The charges. "+cl(v.CHARGES),"After careful deliberation. "+cl(v.DELIBERATION),"The verdict. "+cl(vLabel(v.VERDICT))+". "+cl(vRest(v.VERDICT)),"The remedy. "+cl(v.REMEDY),cl(v.FINAL_WORD)].join(" ... ");
}
const LOAD_LINES=["Court is now in session...","Reviewing all evidence...","Hearing both parties...","The Honorable J. Ustice is deliberating...","Drafting the verdict..."];
const MAX_IMG=3;

export default function PettitCourt(){
  const [phase,setPhase]=useState("home");
  const [form,setForm]=useState({plaintiff:"",defendant:"",incident:""});
  const [imgs,setImgs]=useState([]);const [previews,setPreviews]=useState([]);
  const [caseId,setCaseId]=useState("");
  const [codeInput,setCodeInput]=useState("");
  const [loadedCase,setLoadedCase]=useState(null);
  const [defense,setDefense]=useState("");
  const [defImgs,setDefImgs]=useState([]);const [defPreviews,setDefPreviews]=useState([]);
  const [verdict,setVerdict]=useState(null);
  const [error,setError]=useState("");
  const [copied,setCopied]=useState(false);
  const [shareCopied,setShareCopied]=useState(false);
  const [loadLine,setLoadLine]=useState(0);
  const [dragging,setDragging]=useState(false);
  const [defDragging,setDefDragging]=useState(false);
  const [isSpeaking,setIsSpeaking]=useState(false);
  const [lookupLoading,setLookupLoading]=useState(false);
  const fileRef=useRef(null);const defFileRef=useRef(null);const timerRef=useRef(null);

  const addFiles=useCallback((files,def=false)=>{
    const cur=def?defImgs:imgs;
    const valid=Array.from(files).filter(f=>f.type.startsWith("image/")).slice(0,MAX_IMG-cur.length);
    if(!valid.length)return;
    (def?setDefImgs:setImgs)(p=>[...p,...valid].slice(0,MAX_IMG));
    valid.forEach(f=>{const r=new FileReader();r.onload=e=>(def?setDefPreviews:setPreviews)(p=>[...p,{url:e.target.result,name:f.name}].slice(0,MAX_IMG));r.readAsDataURL(f);});
  },[imgs,defImgs]);

  const removeImg=(i,def=false)=>{(def?setDefImgs:setImgs)(p=>p.filter((_,j)=>j!==i));(def?setDefPreviews:setPreviews)(p=>p.filter((_,j)=>j!==i));};
  const startTicker=()=>{let i=0;setLoadLine(0);timerRef.current=setInterval(()=>{i=Math.min(i+1,LOAD_LINES.length-1);setLoadLine(i);},1800);};
  const stopTicker=()=>clearInterval(timerRef.current);

  const fileCase=async()=>{
    if(!form.plaintiff.trim()||!form.defendant.trim()||!form.incident.trim())return;
    const id=genId();
    const compressed=await Promise.all(imgs.map(f=>compress(f)));
    const caseData={id,status:"pending",plaintiff:form.plaintiff.trim(),defendant:form.defendant.trim(),incident:form.incident.trim(),plaintiffImgs:compressed.map((d,i)=>({data:d,type:"image/jpeg",name:imgs[i].name})),verdict:null};
    try{await window.storage.set(`case:${id}`,JSON.stringify(caseData),true);setCaseId(id);setPhase("summoned");}
    catch{setError("Storage error — please try again.");}
  };

  const lookupCase=async()=>{
    const id=codeInput.trim().toUpperCase().replace(/[^A-Z0-9]/g,"");
    if(id.length<4){setError("Enter a valid case code.");return;}
    setLookupLoading(true);setError("");
    try{
      const result=await window.storage.get(`case:${id}`,true);
      if(!result){setError("Case not found. Check your code and try again.");setLookupLoading(false);return;}
      const data=JSON.parse(result.value);
      if(data.status==="decided"){setVerdict(data.verdict);setPhase("verdict");}
      else{setLoadedCase(data);setCaseId(id);setPhase("defense");}
    }catch{setError("Could not retrieve case. Try again.");}
    setLookupLoading(false);
  };

  const runTrial=async(userText,pImgBlocks,dImgBlocks=[])=>{
    setPhase("trial");startTicker();
    try{
      const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,system:SYSTEM,messages:[{role:"user",content:[...pImgBlocks,...dImgBlocks,{type:"text",text:userText}]}]})});
      const data=await res.json();
      const raw=data.content?.find(b=>b.type==="text")?.text||"";
      const parsed=parse(raw);
      await window.storage.set(`case:${caseId}`,JSON.stringify({...loadedCase,status:"decided",verdict:parsed}),true);
      setVerdict(parsed);setPhase("verdict");
    }catch{setError("Court recess — please try again.");setPhase("defense");}
    stopTicker();
  };

  const pleadGuilty=async()=>{
    const c=loadedCase;
    const pImgBlocks=c.plaintiffImgs.map(img=>({type:"image",source:{type:"base64",media_type:img.type,data:img.data}}));
    const pNote=c.plaintiffImgs.length?`\nPlaintiff's exhibits: ${c.plaintiffImgs.map((_,i)=>"Exhibit "+"ABCDEFG"[i]).join(", ")}.`:"";
    await runTrial(`CASE FILED\nPlaintiff: ${c.plaintiff}\nDefendant: ${c.defendant}\nIncident: ${c.incident}${pNote}\n\nDEFENDANT ENTERED A PLEA OF GUILTY. Acknowledge this formally and determine an appropriate remedy.`,pImgBlocks);
  };

  const submitDefense=async()=>{
    const c=loadedCase;
    const pImgBlocks=c.plaintiffImgs.map(img=>({type:"image",source:{type:"base64",media_type:img.type,data:img.data}}));
    const dImgBlocks=await Promise.all(defImgs.map(async f=>({type:"image",source:{type:"base64",media_type:"image/jpeg",data:await compress(f)}})));
    const pNote=c.plaintiffImgs.length?`\nPlaintiff's exhibits: ${c.plaintiffImgs.map((_,i)=>"Exhibit "+"ABCDEFG"[i]).join(", ")}.`:"";
    const dNote=dImgBlocks.length?`\nDefendant's exhibits: ${dImgBlocks.map((_,i)=>"Exhibit "+"WXYZ"[i]).join(", ")}.`:"";
    await runTrial(`CASE FILED\nPlaintiff: ${c.plaintiff}\nDefendant: ${c.defendant}\nPlaintiff's Account: ${c.incident}${pNote}\n\nDEFENDANT'S RESPONSE:\n${defense.trim()||"The defendant offered no written statement but submitted evidence."}${dNote}\n\nRule with complete impartiality. You may rule against either party.`,pImgBlocks,dImgBlocks);
  };

  const toggleVoice=()=>{
    const synth=window.speechSynthesis;
    if(isSpeaking){synth.cancel();setIsSpeaking(false);return;}
    if(!verdict)return;
    const utt=new SpeechSynthesisUtterance(buildSpeech(verdict));
    utt.pitch=0.1;utt.rate=0.72;utt.volume=1;
    const voices=synth.getVoices();
    const deep=voices.find(v=>/daniel|alex|thomas|fred|ralph/i.test(v.name))||voices.find(v=>v.lang.startsWith("en"));
    if(deep)utt.voice=deep;
    utt.onend=()=>setIsSpeaking(false);utt.onerror=()=>setIsSpeaking(false);
    setIsSpeaking(true);synth.speak(utt);
  };

  const copyVerdict=()=>{
    if(!verdict)return;
    const txt=`⚖️ PETTIT COURT — OFFICIAL VERDICT ⚖️\n${verdict.CASE_FILING}\n\nFINDING: ${vLabel(verdict.VERDICT)}\n${vRest(verdict.VERDICT)}\n\nREMEDY: ${verdict.REMEDY}\n\n"${verdict.FINAL_WORD}"\n— The Honorable J. Ustice\n\npettitcourt.lol`;
    navigator.clipboard.writeText(txt).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2500);});
  };

  const shareMsg=(id)=>`⚖️ You've been summoned to Pettit Court ⚖️\n\nCase No: ${id}\n\nGo to pettitcourt.lol — tap "I've Been Summoned" and enter your code to respond.\n\nYou may plead guilty or submit your defense.\n\n— Supreme Court of Petty Disputes`;
  const copyCode=(id)=>{navigator.clipboard.writeText(shareMsg(id)).then(()=>{setShareCopied(true);setTimeout(()=>setShareCopied(false),2500);});};
  const emailCase=(id)=>{window.location.href=`mailto:?subject=You%27ve%20Been%20Summoned%20to%20Pettit%20Court&body=${encodeURIComponent(shareMsg(id))}`;};
  const textCase=(id)=>{window.location.href=`sms:?body=${encodeURIComponent(shareMsg(id))}`;};

  const reset=()=>{window.speechSynthesis?.cancel();setPhase("home");setForm({plaintiff:"",defendant:"",incident:""});setImgs([]);setPreviews([]);setCaseId("");setCodeInput("");setLoadedCase(null);setDefense("");setDefImgs([]);setDefPreviews([]);setVerdict(null);setError("");setIsSpeaking(false);};

  const inp={width:"100%",background:"rgba(255,255,255,0.05)",border:"none",borderBottom:"1px solid rgba(200,180,130,0.35)",padding:"10px 4px",color:"#DDD0B0",fontSize:"15px",fontFamily:"'IM Fell English',Georgia,serif",outline:"none",borderRadius:0};
  const lbl={fontSize:"10px",letterSpacing:"0.22em",color:"rgba(200,180,130,0.5)",fontFamily:"'Cinzel',serif",fontWeight:700,display:"block",marginBottom:"8px"};
  const card={background:"rgba(255,255,255,0.04)",border:"1px solid rgba(200,180,130,0.15)",borderRadius:"6px",padding:"18px 22px",marginBottom:"14px"};
  const secLbl={fontSize:"10px",letterSpacing:"0.22em",color:"rgba(200,180,130,0.5)",fontFamily:"'Cinzel',serif",fontWeight:700,marginBottom:"10px"};
  const secTxt={fontSize:"15px",lineHeight:1.75,color:"#C8BAA0",fontStyle:"italic"};

  const Uploader=({def=false})=>{
    const pv=def?defPreviews:previews;
    const dr=def?defDragging:dragging;
    const setDr=def?setDefDragging:setDragging;
    const ref=def?defFileRef:fileRef;
    const letters=def?"WXYZ":"ABCDEFG";
    return(
      <div>
        {pv.length>0&&<div style={{display:"flex",gap:"10px",marginBottom:"12px",flexWrap:"wrap"}}>{pv.map((p,i)=><div key={i} style={{position:"relative",width:"110px",height:"82px",borderRadius:"4px",overflow:"hidden",border:"1px solid rgba(200,168,75,0.3)"}}><img src={p.url} alt={p.name} style={{width:"100%",height:"100%",objectFit:"cover"}}/><span style={{position:"absolute",top:5,left:5,background:"#C8A84B",color:"#100A04",fontFamily:"'Cinzel',serif",fontWeight:700,fontSize:"9px",letterSpacing:".08em",padding:"2px 7px",borderRadius:"3px"}}>EX. {letters[i]}</span><button onClick={()=>removeImg(i,def)} style={{position:"absolute",top:5,right:5,width:"20px",height:"20px",background:"rgba(0,0,0,.75)",border:"none",borderRadius:"50%",color:"#DDD0B0",cursor:"pointer",fontSize:"13px",lineHeight:1}}>×</button></div>)}</div>}
        {pv.length<MAX_IMG&&<div style={{border:`1px dashed rgba(200,168,75,${dr?.7:.3})`,borderRadius:"6px",padding:"22px 16px",textAlign:"center",cursor:"pointer",background:dr?"rgba(200,168,75,.05)":"transparent",transition:"all .2s"}} onClick={()=>ref.current?.click()} onDragOver={e=>{e.preventDefault();setDr(true);}} onDragLeave={()=>setDr(false)} onDrop={e=>{e.preventDefault();setDr(false);addFiles(e.dataTransfer.files,def);}}>
          <div style={{fontSize:"20px",opacity:.45,marginBottom:"6px"}}>⊕</div>
          <div style={{fontFamily:"'Cinzel',serif",fontSize:"10px",letterSpacing:".15em",color:"rgba(200,168,75,.5)"}}>SUBMIT PHOTOGRAPHIC EVIDENCE</div>
          <div style={{fontSize:"11px",fontStyle:"italic",color:"rgba(200,168,75,.3)",marginTop:"3px"}}>Click or drag · JPG PNG WEBP · max {MAX_IMG-pv.length} more</div>
          <input ref={ref} type="file" accept="image/*" multiple style={{display:"none"}} onChange={e=>addFiles(e.target.files,def)}/>
        </div>}
      </div>
    );
  };

  const Header=()=>(
    <div style={{borderBottom:"1px solid rgba(200,168,75,0.2)",textAlign:"center",padding:"24px 20px 20px",background:"rgba(200,168,75,0.03)",cursor:"pointer"}} onClick={reset}>
      <div style={{fontFamily:"'Cinzel',serif",fontSize:"10px",letterSpacing:"0.28em",color:"rgba(200,168,75,0.4)",marginBottom:"12px"}}>HONORABLE J. USTICE PRESIDING</div>
      <svg width="58" height="58" viewBox="0 0 72 72" style={{display:"block",margin:"0 auto 12px"}}>
        <circle cx="36" cy="36" r="34" fill="none" stroke="rgba(200,168,75,0.4)" strokeWidth="1"/>
        <circle cx="36" cy="36" r="29" fill="none" stroke="rgba(200,168,75,0.2)" strokeWidth="0.5"/>
        <text x="36" y="42" textAnchor="middle" fontSize="28" fill="rgba(200,168,75,0.75)" fontFamily="Georgia">⚖</text>
      </svg>
      <div style={{fontFamily:"'Cinzel Decorative','Cinzel',serif",fontSize:"clamp(20px,5vw,34px)",fontWeight:900,letterSpacing:"0.1em",color:"#DDD0B0",marginBottom:"3px"}}>PETTIT COURT</div>
      <div style={{fontFamily:"'Cinzel',serif",fontSize:"10px",letterSpacing:"0.24em",color:"rgba(200,168,75,0.5)",marginBottom:"5px"}}>SUPREME COURT OF PETTY DISPUTES</div>
      <div style={{fontSize:"12px",fontStyle:"italic",color:"rgba(200,168,75,0.4)"}}>Justice is blind. But she's been reading your texts.</div>
    </div>
  );

  return(
    <div style={{minHeight:"100vh",background:"#100A04",color:"#DDD0B0",fontFamily:"'IM Fell English',Georgia,serif"}}>
      <link href="https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700;900&family=Cinzel:wght@400;600;700&family=IM+Fell+English:ital@0;1&display=swap" rel="stylesheet"/>
      <style>{`*{box-sizing:border-box;margin:0;padding:0}::placeholder{color:rgba(200,180,130,.3);font-style:italic;font-family:'IM Fell English',Georgia,serif}input:focus,textarea:focus{border-bottom-color:rgba(200,180,130,.8)!important;outline:none}textarea{resize:vertical}@keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}@keyframes swing{0%,100%{transform:rotate(-10deg)}50%{transform:rotate(10deg)}}@keyframes stampIn{0%{opacity:0;transform:scale(1.35) rotate(-2deg)}60%{transform:scale(.97) rotate(.3deg)}100%{opacity:1;transform:scale(1) rotate(0)}}@keyframes speakPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.7;transform:scale(1.06)}}.fadeUp{animation:fadeUp .45s ease forwards}.swing{animation:swing 2.2s ease-in-out infinite;transform-origin:top center;display:inline-block}.stamp{animation:stampIn .45s cubic-bezier(.175,.885,.32,1.275) forwards}.speaking{animation:speakPulse 1.1s ease infinite}.btn{background:#C8A84B;color:#100A04;border:none;padding:13px 26px;font-family:'Cinzel',serif;font-weight:700;font-size:13px;letter-spacing:.1em;cursor:pointer;border-radius:4px;transition:all .2s}.btn:hover{background:#E0C06A;transform:translateY(-1px)}.btn:disabled{opacity:.35;cursor:not-allowed;transform:none}.btn-ghost{background:transparent;color:#C8A84B;border:1px solid rgba(200,168,75,.4);padding:11px 22px;font-family:'Cinzel',serif;font-size:12px;cursor:pointer;border-radius:4px;transition:all .2s;letter-spacing:.08em}.btn-ghost:hover{border-color:#C8A84B;background:rgba(200,168,75,.08)}.btn-danger{background:transparent;color:#D07070;border:1px solid rgba(180,80,80,.4);padding:11px 22px;font-family:'Cinzel',serif;font-size:12px;cursor:pointer;border-radius:4px;transition:all .2s;letter-spacing:.08em}.btn-danger:hover{border-color:#D07070;background:rgba(180,80,80,.08)}.rule{width:100%;height:1px;background:linear-gradient(90deg,transparent,rgba(200,168,75,.3),transparent);margin:24px 0}.share-btn{display:flex;align-items:center;gap:10px;background:rgba(255,255,255,.04);border:1px solid rgba(200,168,75,.2);border-radius:6px;padding:13px 16px;cursor:pointer;transition:all .2s;font-family:'Cinzel',serif;font-size:12px;letter-spacing:.08em;color:#C8A84B;width:100%}.share-btn:hover{border-color:rgba(200,168,75,.5);background:rgba(200,168,75,.06)}`}</style>
      <Header/>
      <div style={{maxWidth:"700px",margin:"0 auto",padding:"36px 20px 60px"}}>

        {phase==="home"&&<div className="fadeUp">
          <div style={{textAlign:"center",marginBottom:"40px"}}><p style={{fontSize:"15px",fontStyle:"italic",color:"rgba(200,168,75,.55)",lineHeight:1.8,maxWidth:"460px",margin:"0 auto"}}>The court is accepting petitions. All grievances, however trivial, shall be heard with the gravity they deserve.</p></div>
          <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
            <button className="btn" style={{fontSize:"15px",padding:"20px 32px",letterSpacing:".15em"}} onClick={()=>setPhase("filing")}>FILE A CASE</button>
            <div style={{textAlign:"center",fontFamily:"'Cinzel',serif",fontSize:"11px",color:"rgba(200,168,75,.3)",letterSpacing:".1em",padding:"2px 0"}}>— OR —</div>
            <button className="btn-ghost" style={{fontSize:"14px",padding:"17px 32px"}} onClick={()=>setPhase("lookup")}>I'VE BEEN SUMMONED</button>
          </div>
          <p style={{textAlign:"center",marginTop:"28px",fontSize:"11px",fontStyle:"italic",color:"rgba(200,168,75,.25)"}}>Case data stored in shared court records. Do not file frivolous suits — the judge will notice.</p>
        </div>}

        {phase==="filing"&&<div className="fadeUp">
          <div style={{textAlign:"center",marginBottom:"28px"}}>
            <div style={{fontFamily:"'Cinzel',serif",fontSize:"11px",letterSpacing:".2em",color:"rgba(200,168,75,.5)",marginBottom:"8px"}}>OFFICIAL CASE FILING — FORM PC-1</div>
            <p style={{fontSize:"13px",fontStyle:"italic",color:"rgba(200,168,75,.45)",lineHeight:1.7,maxWidth:"460px",margin:"0 auto"}}>The court is impartial. Filing does not guarantee ruling in your favor. The judge will find the truth.</p>
          </div>
          {error&&<div style={{background:"rgba(155,32,32,.2)",border:"1px solid rgba(155,32,32,.4)",borderRadius:"6px",padding:"12px 18px",marginBottom:"18px",fontSize:"14px",color:"#D08080",fontStyle:"italic"}}>{error}</div>}
          <div style={card}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 38px 1fr",gap:"12px",alignItems:"end"}}>
              <div><label style={lbl}>PLAINTIFF (YOU)</label><input style={inp} placeholder="Your full name" value={form.plaintiff} onChange={e=>setForm(f=>({...f,plaintiff:e.target.value}))}/></div>
              <div style={{textAlign:"center",paddingBottom:"10px",fontFamily:"'Cinzel',serif",fontSize:"13px",color:"rgba(200,168,75,.5)",fontStyle:"italic"}}>v.</div>
              <div><label style={lbl}>DEFENDANT</label><input style={inp} placeholder="Their name" value={form.defendant} onChange={e=>setForm(f=>({...f,defendant:e.target.value}))}/></div>
            </div>
          </div>
          <div style={card}>
            <label style={lbl}>STATEMENT OF FACTS</label>
            <textarea style={{...inp,minHeight:"110px",lineHeight:1.7}} placeholder="Describe exactly what happened. Be specific. Do not omit details that make you look bad — the judge will find out anyway." value={form.incident} onChange={e=>setForm(f=>({...f,incident:e.target.value}))}/>
          </div>
          <div style={card}><label style={lbl}>PHOTOGRAPHIC EVIDENCE — PLAINTIFF'S EXHIBITS (OPTIONAL)</label><Uploader/></div>
          <div style={{textAlign:"center",paddingTop:"8px"}}>
            <button className="btn" onClick={fileCase} disabled={!form.plaintiff.trim()||!form.defendant.trim()||!form.incident.trim()}>SUBMIT CASE TO COURT</button>
            <div style={{marginTop:"10px",fontSize:"11px",fontStyle:"italic",color:"rgba(200,168,75,.3)"}}>The court reserves the right to rule against the plaintiff.</div>
          </div>
        </div>}

        {phase==="summoned"&&<div className="fadeUp">
          <div style={{textAlign:"center",marginBottom:"24px"}}>
            <div style={{fontSize:"30px",marginBottom:"12px"}}>📜</div>
            <div style={{fontFamily:"'Cinzel',serif",fontSize:"13px",letterSpacing:".18em",color:"rgba(200,168,75,.6)",marginBottom:"8px"}}>CASE ACCEPTED BY THE COURT</div>
            <p style={{fontSize:"14px",fontStyle:"italic",color:"rgba(200,168,75,.5)",lineHeight:1.7}}>Send the case code to the defendant. They must respond before a verdict is issued.</p>
          </div>
          <div style={{background:"rgba(200,168,75,.08)",border:"1px solid rgba(200,168,75,.3)",borderRadius:"6px",padding:"22px",textAlign:"center",marginBottom:"18px"}}>
            <div style={{fontFamily:"'Cinzel',serif",fontSize:"11px",letterSpacing:".2em",color:"rgba(200,168,75,.5)",marginBottom:"10px"}}>CASE CODE</div>
            <div style={{fontFamily:"'Cinzel Decorative','Cinzel',serif",fontSize:"44px",fontWeight:900,color:"#C8A84B",letterSpacing:".15em"}}>{caseId}</div>
            <div style={{fontSize:"12px",fontStyle:"italic",color:"rgba(200,168,75,.4)",marginTop:"8px"}}>Defendant enters this at pettitcourt.lol</div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:"10px",marginBottom:"20px"}}>
            <button className="share-btn" onClick={()=>textCase(caseId)}><span style={{fontSize:"18px"}}>💬</span><span>Send via Text Message</span></button>
            <button className="share-btn" onClick={()=>emailCase(caseId)}><span style={{fontSize:"18px"}}>✉️</span><span>Send via Email</span></button>
            <button className="share-btn" onClick={()=>copyCode(caseId)}><span style={{fontSize:"18px"}}>⧉</span><span>{shareCopied?"Copied ✓":"Copy summons message"}</span></button>
          </div>
          <div className="rule"/>
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:"13px",fontStyle:"italic",color:"rgba(200,168,75,.4)",marginBottom:"14px"}}>Once they respond, check back here for the verdict:</div>
            <button className="btn-ghost" onClick={()=>{setCodeInput(caseId);setPhase("lookup");}}>CHECK VERDICT STATUS</button>
          </div>
        </div>}

        {phase==="lookup"&&<div className="fadeUp">
          <div style={{textAlign:"center",marginBottom:"32px"}}>
            <div style={{fontSize:"30px",marginBottom:"12px"}}>⚖️</div>
            <div style={{fontFamily:"'Cinzel',serif",fontSize:"13px",letterSpacing:".18em",color:"rgba(200,168,75,.6)",marginBottom:"8px"}}>ENTER THE COURT</div>
            <p style={{fontSize:"14px",fontStyle:"italic",color:"rgba(200,168,75,.45)",lineHeight:1.7,maxWidth:"400px",margin:"0 auto"}}>Enter your case code to respond to charges — or to check if a verdict has been issued.</p>
          </div>
          {error&&<div style={{background:"rgba(155,32,32,.2)",border:"1px solid rgba(155,32,32,.4)",borderRadius:"6px",padding:"12px 18px",marginBottom:"18px",fontSize:"14px",color:"#D08080",fontStyle:"italic"}}>{error}</div>}
          <div style={card}>
            <label style={lbl}>CASE CODE</label>
            <input style={{...inp,fontSize:"24px",letterSpacing:".2em",textAlign:"center",fontFamily:"'Cinzel',serif",fontWeight:700}} placeholder="e.g. A3B7KX" value={codeInput} onChange={e=>setCodeInput(e.target.value.toUpperCase())} onKeyDown={e=>e.key==="Enter"&&lookupCase()} maxLength={8}/>
          </div>
          <div style={{textAlign:"center",paddingTop:"8px"}}>
            <button className="btn" onClick={lookupCase} disabled={lookupLoading||codeInput.trim().length<4}>{lookupLoading?"SEARCHING RECORDS...":"ENTER THE COURT"}</button>
          </div>
        </div>}

        {phase==="defense"&&loadedCase&&<div className="fadeUp">
          <div style={{textAlign:"center",marginBottom:"22px"}}>
            <div style={{fontFamily:"'Cinzel',serif",fontSize:"11px",letterSpacing:".2em",color:"rgba(200,168,75,.5)",marginBottom:"6px"}}>CASE NO. {loadedCase.id} — DEFENDANT'S REVIEW</div>
            <div style={{fontFamily:"'Cinzel',serif",fontSize:"16px",fontWeight:700,color:"#DDD0B0"}}>{loadedCase.plaintiff.toUpperCase()} v. {loadedCase.defendant.toUpperCase()}</div>
          </div>
          <div style={{...card,borderColor:"rgba(200,80,80,.25)",background:"rgba(155,32,32,.06)"}}>
            <div style={{...secLbl,color:"rgba(220,120,120,.6)"}}>CHARGES AGAINST YOU — PLAINTIFF'S STATEMENT</div>
            <div style={{...secTxt,color:"#C0A8A8"}}>{loadedCase.incident}</div>
            {loadedCase.plaintiffImgs?.length>0&&<div style={{marginTop:"12px",display:"flex",gap:"8px",flexWrap:"wrap"}}>{loadedCase.plaintiffImgs.map((img,i)=><div key={i} style={{position:"relative",width:"88px",height:"66px",borderRadius:"4px",overflow:"hidden",border:"1px solid rgba(200,168,75,.25)"}}><img src={`data:${img.type};base64,${img.data}`} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/><span style={{position:"absolute",top:3,left:3,background:"#C8A84B",color:"#100A04",fontFamily:"'Cinzel',serif",fontSize:"8px",fontWeight:700,padding:"2px 5px",borderRadius:"2px"}}>EX. {"ABCDEFG"[i]}</span></div>)}</div>}
          </div>
          {error&&<div style={{background:"rgba(155,32,32,.2)",border:"1px solid rgba(155,32,32,.4)",borderRadius:"6px",padding:"12px 18px",marginBottom:"14px",fontSize:"14px",color:"#D08080",fontStyle:"italic"}}>{error}</div>}
          <div style={card}>
            <label style={lbl}>YOUR DEFENSE — STATEMENT TO THE COURT</label>
            <textarea style={{...inp,minHeight:"110px",lineHeight:1.7}} placeholder="Explain your side. Present context, mitigating factors, or rebuttals. The judge will hear you." value={defense} onChange={e=>setDefense(e.target.value)}/>
          </div>
          <div style={card}><label style={lbl}>YOUR PHOTOGRAPHIC EVIDENCE — DEFENDANT'S EXHIBITS (OPTIONAL)</label><Uploader def={true}/></div>
          <div className="rule"/>
          <div style={{display:"flex",flexDirection:"column",gap:"12px",alignItems:"center"}}>
            <button className="btn" style={{width:"100%",maxWidth:"360px"}} onClick={submitDefense} disabled={!defense.trim()&&defImgs.length===0}>SUBMIT MY DEFENSE</button>
            <div style={{fontFamily:"'Cinzel',serif",fontSize:"11px",color:"rgba(200,168,75,.3)",letterSpacing:".08em"}}>— OR —</div>
            <button className="btn-danger" style={{width:"100%",maxWidth:"360px"}} onClick={pleadGuilty}>PLEAD GUILTY</button>
            <div style={{fontSize:"12px",fontStyle:"italic",color:"rgba(200,168,75,.3)",textAlign:"center"}}>Pleading guilty acknowledges the charges. The judge determines the remedy.</div>
          </div>
        </div>}

        {phase==="trial"&&<div style={{textAlign:"center",padding:"70px 20px",animation:"fadeUp .4s ease"}}>
          <div className="swing" style={{fontSize:"52px",marginBottom:"32px"}}>⚖</div>
          <div style={{fontFamily:"'Cinzel',serif",fontSize:"19px",letterSpacing:".1em",color:"#DDD0B0",marginBottom:"12px"}}>COURT IS IN SESSION</div>
          <div style={{fontSize:"15px",fontStyle:"italic",color:"rgba(200,168,75,.55)",animation:"pulse 2.5s ease infinite",minHeight:"24px"}}>{LOAD_LINES[loadLine]}</div>
          <div style={{marginTop:"36px",display:"flex",gap:"8px",justifyContent:"center"}}>{[0,1,2].map(i=><div key={i} style={{width:"5px",height:"5px",borderRadius:"50%",background:"rgba(200,168,75,.4)",animation:`pulse 1.4s ease ${i*.22}s infinite`}}/>)}</div>
        </div>}

        {phase==="verdict"&&verdict&&<div className="fadeUp">
          <div style={{textAlign:"center",marginBottom:"22px"}}>
            <div style={{fontFamily:"'Cinzel',serif",fontSize:"10px",letterSpacing:".25em",color:"rgba(200,168,75,.4)",marginBottom:"8px"}}>CERTIFIED COURT TRANSCRIPT</div>
            <div style={{fontFamily:"'Cinzel',serif",fontSize:"15px",fontWeight:700,color:"#DDD0B0",letterSpacing:".04em"}}>{verdict.CASE_FILING}</div>
          </div>
          <div className="rule"/>
          <div style={card}><div style={secLbl}>THE CHARGES</div><div style={secTxt}>{verdict.CHARGES}</div></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px",marginBottom:"14px"}}>
            {[["PLAINTIFF_OPENING","PLAINTIFF'S OPENING"],["DEFENSE_OPENING","DEFENSE'S OPENING"]].map(([k,l])=><div key={k} style={card}><div style={secLbl}>{l}</div><div style={{...secTxt,fontSize:"14px"}}>{verdict[k]}</div></div>)}
          </div>
          <div style={card}><div style={secLbl}>EVIDENCE EXAMINED</div><div style={secTxt}>{(verdict.EVIDENCE||"").split("\n").filter(l=>l.trim()).map((line,i)=><div key={i} style={{marginBottom:"7px"}}>{line}</div>)}</div></div>
          <div style={card}><div style={secLbl}>COURT'S DELIBERATION</div><div style={secTxt}>{verdict.DELIBERATION}</div></div>
          <div className="rule"/>
          <div className="stamp" style={{textAlign:"center",padding:"34px 24px",marginBottom:"14px",background:"rgba(255,255,255,.03)",border:`1px solid ${vColor(verdict.VERDICT)}44`,borderRadius:"8px",position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",inset:8,border:`2px solid ${vColor(verdict.VERDICT)}18`,borderRadius:"6px",pointerEvents:"none"}}/>
            <div style={{fontFamily:"'Cinzel',serif",fontSize:"10px",letterSpacing:".28em",color:"rgba(200,168,75,.4)",marginBottom:"16px"}}>THE COURT FINDS</div>
            <div style={{fontFamily:"'Cinzel Decorative','Cinzel',serif",fontSize:"clamp(18px,5vw,32px)",fontWeight:900,letterSpacing:".12em",color:vColor(verdict.VERDICT),marginBottom:"16px",lineHeight:1.2}}>{vLabel(verdict.VERDICT)}</div>
            <div style={{fontSize:"15px",fontStyle:"italic",color:"rgba(200,168,75,.7)",maxWidth:"500px",margin:"0 auto",lineHeight:1.75}}>{vRest(verdict.VERDICT)}</div>
          </div>
          <div style={{...card,borderColor:"rgba(200,168,75,.3)"}}><div style={secLbl}>COURT-ORDERED REMEDY</div><div style={secTxt}>{verdict.REMEDY}</div></div>
          <div style={{textAlign:"center",padding:"24px 20px 16px"}}>
            <div style={{color:"rgba(200,168,75,.45)",fontSize:"16px",letterSpacing:"8px"}}>— ⚖ —</div>
            <div style={{fontSize:"18px",fontStyle:"italic",color:"#C8BAA0",lineHeight:1.8,maxWidth:"540px",margin:"18px auto 12px"}}>"{verdict.FINAL_WORD}"</div>
            <div style={{fontFamily:"'Cinzel',serif",fontSize:"11px",letterSpacing:".18em",color:"rgba(200,168,75,.4)"}}>— The Honorable J. Ustice</div>
            <div style={{fontFamily:"'Cinzel',serif",fontSize:"10px",letterSpacing:".13em",color:"rgba(200,168,75,.3)",marginTop:"3px"}}>Supreme Court of Petty Disputes · This verdict is final.</div>
          </div>
          <div className="rule"/>
          <div style={{textAlign:"center",marginBottom:"20px"}}>
            <button onClick={toggleVoice} className={isSpeaking?"speaking":""} style={{background:"rgba(200,168,75,.1)",border:"1px solid rgba(200,168,75,.4)",borderRadius:"50px",padding:"12px 28px",cursor:"pointer",fontFamily:"'Cinzel',serif",fontSize:"12px",letterSpacing:".1em",color:"#C8A84B",transition:"all .2s",display:"inline-flex",alignItems:"center",gap:"10px"}}>
              <span style={{fontSize:"18px"}}>{isSpeaking?"⏸":"▶"}</span>
              {isSpeaking?"SILENCE THE COURT":"HEAR THE VERDICT"}
            </button>
            <div style={{marginTop:"7px",fontSize:"11px",fontStyle:"italic",color:"rgba(200,168,75,.3)"}}>{isSpeaking?"The Honorable J. Ustice is speaking...":"J. Ustice will read the verdict aloud"}</div>
          </div>
          <div style={{display:"flex",gap:"12px",justifyContent:"center",flexWrap:"wrap"}}>
            <button className="btn" onClick={copyVerdict}>{copied?"✓ COPIED":"COPY VERDICT"}</button>
            <button className="btn-ghost" onClick={reset}>NEW CASE</button>
          </div>
          <p style={{textAlign:"center",marginTop:"16px",fontSize:"11px",fontStyle:"italic",color:"rgba(200,168,75,.25)"}}>Court is adjourned. No appeals accepted.</p>
        </div>}

      </div>
    </div>
  );
}
