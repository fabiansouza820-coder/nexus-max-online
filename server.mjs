import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.cwd();
const PROJECTS = path.join(ROOT, "projects.json");
const PORT = Number(process.env.PORT || 3000);
const MAX_TOOL_STEPS = Number(process.env.NEXUS_MAX_TOOL_STEPS || 6);

async function loadEnv() {
  try {
    const txt = await fs.readFile(path.join(ROOT, ".env"), "utf8");
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
    }
  } catch {}
}
await loadEnv();
try { await fs.access(PROJECTS); } catch { await fs.writeFile(PROJECTS, "{}\n"); }

const cfg = {
  openai: !!process.env.OPENAI_API_KEY,
  anthropic: !!process.env.ANTHROPIC_API_KEY,
  gemini: !!process.env.GEMINI_API_KEY,
  xai: !!process.env.XAI_API_KEY
};

function json(res, status, body) {
  const out = JSON.stringify(body);
  res.writeHead(status, {"Content-Type":"application/json; charset=utf-8","Access-Control-Allow-Origin":"*"});
  res.end(out);
}
function text(res, status, body, type="text/plain; charset=utf-8") {
  res.writeHead(status, {"Content-Type":type});
  res.end(body);
}
async function body(req) {
  let s=""; for await (const c of req) s += c;
  return s ? JSON.parse(s) : {};
}
function clean(s="") { return String(s).slice(0, 50000); }

async function getProjects() {
  return JSON.parse(await fs.readFile(PROJECTS, "utf8"));
}
async function saveProjects(x) {
  await fs.writeFile(PROJECTS, JSON.stringify(x,null,2));
}

function detectNeeds(message) {
  const t = message.toLowerCase();
  return {
    web: /pesquis|web|internet|notícia|noticias|atual|hoje|fontes|fonte|mercado/.test(t),
    code: /código|codigo|program|python|javascript|calcular|planilha|csv|gráfico|grafico/.test(t),
    files: /arquivo|pdf|documento|csv|anexo|ficheiro/.test(t),
    creative: /imagem|design|criativ|roteiro|nome|marca/.test(t),
    research: /analis|compar|estud|pesquis/.test(t)
  };
}

function providers() {
  return [
    ["openai", cfg.openai], ["anthropic", cfg.anthropic],
    ["gemini", cfg.gemini], ["xai", cfg.xai]
  ].filter(x=>x[1]).map(x=>x[0]);
}

async function geminiInteraction(input, tools=[]) {
  if (!process.env.GEMINI_API_KEY) throw new Error("Gemini não configurado");
  const r = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
    method:"POST",
    headers: {"x-goog-api-key":process.env.GEMINI_API_KEY,"Content-Type":"application/json"},
    body: JSON.stringify({
      model: process.env.GEMINI_MODEL || "gemini-3.8-flash",
      input,
      tools
    })
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error?.message || "Erro Gemini");
  return {text: j.output_text || "", raw:j};
}

async function openai(input) {
  const r = await fetch("https://api.openai.com/v1/responses", {
    method:"POST",
    headers: {"Authorization":`Bearer ${process.env.OPENAI_API_KEY}`,"Content-Type":"application/json"},
    body: JSON.stringify({model:process.env.OPENAI_MODEL || "gpt-6-astra", input})
  });
  const j=await r.json();
  if (!r.ok) throw new Error(j.error?.message || "Erro OpenAI");
  const text = j.output_text || j.output?.flatMap(x=>x.content||[]).map(x=>x.text||"").join("") || "";
  return {text,raw:j};
}

async function anthropic(input) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method:"POST",
    headers: {"x-api-key":process.env.ANTHROPIC_API_KEY,"anthropic-version":"2023-06-01","content-type":"application/json"},
    body: JSON.stringify({model:process.env.ANTHROPIC_MODEL || "claude-opus-5", max_tokens:5000, messages:[{role:"user",content:input}]})
  });
  const j=await r.json();
  if (!r.ok) throw new Error(j.error?.message || "Erro Anthropic");
  return {text:(j.content||[]).map(x=>x.text||"").join(""),raw:j};
}

async function xai(input) {
  const r = await fetch("https://api.x.ai/v1/responses", {
    method:"POST",
    headers: {"Authorization":`Bearer ${process.env.XAI_API_KEY}`,"Content-Type":"application/json"},
    body: JSON.stringify({model:process.env.XAI_MODEL || "grok-4.6", input})
  });
  const j=await r.json();
  if (!r.ok) throw new Error(j.error?.message || "Erro xAI");
  return {text:j.output_text || "",raw:j};
}

async function callModel(provider, input) {
  if (provider==="gemini") return geminiInteraction(input);
  if (provider==="openai") return openai(input);
  if (provider==="anthropic") return anthropic(input);
  if (provider==="xai") return xai(input);
  throw new Error("Provider desconhecido");
}

async function autonomousResearch(message) {
  if (!cfg.gemini) return null;
  const r = await geminiInteraction(
    `Você é o agente de pesquisa do NEXUS. Pesquise a web quando isso melhorar a resposta. 
Usuário: ${message}
Retorne uma síntese objetiva, com fontes/citações que o seu resultado disponibilizar.`,
    [{type:"google_search"}]
  );
  return r.text;
}

async function autonomousCode(message) {
  if (!cfg.gemini) return null;
  const r = await geminiInteraction(
    `Você é o agente de execução do NEXUS. Resolva a tarefa usando Python quando for útil.
Usuário: ${message}
Explique o resultado e inclua os números/resultados relevantes.`,
    [{type:"code_execution"}]
  );
  return r.text;
}

async function buildPlan(message, projectMemory) {
  const needs = detectNeeds(message);
  const tools = [];
  if (needs.web) tools.push("web");
  if (needs.code) tools.push("code");
  if (needs.files) tools.push("files");
  const roles = ["coordenador"];
  if (needs.research) roles.push("pesquisador");
  if (needs.code) roles.push("programador");
  if (needs.creative) roles.push("criativo");
  if (providers().length > 1) roles.push("revisor");
  return {needs, tools, roles, memory: projectMemory || ""};
}

async function nexusRun(message, projectId="default", attachment=null) {
  const projects = await getProjects();
  const memory = projects[projectId]?.memory || "";
  const plan = await buildPlan(message, memory);
  const evidence = [];
  if (plan.needs.web) {
    try { const x=await autonomousResearch(message); if(x) evidence.push("WEB:\n"+x); }
    catch(e){ evidence.push("WEB: indisponível ("+e.message+")"); }
  }
  if (plan.needs.code) {
    try { const x=await autonomousCode(message); if(x) evidence.push("CODE:\n"+x); }
    catch(e){ evidence.push("CODE: indisponível ("+e.message+")"); }
  }

  const prov = providers();
  if (!prov.length) return {
    mode:"demo", plan, answer:"Configure pelo menos uma API no .env para ativar o cérebro Nexus.",
    providers:[], evidence
  };

  const attachmentText = attachment?.name ? `\n\nARQUIVO ANEXADO (${attachment.name}):\n${clean(attachment.content || "").slice(0,30000)}` : "";
  const context = `MEMÓRIA DO PROJETO:\n${memory || "(vazia)"}${attachmentText}\n\nFERRAMENTAS:\n${evidence.join("\n\n") || "(nenhuma)"}\n\nPEDIDO:\n${message}`;
  const outputs=[];
  for (let i=0;i<Math.min(prov.length,3);i++) {
    try {
      const p=prov[i];
      const r=await callModel(p,
        `Você é o especialista ${i+1} do NEXUS. Resolva a tarefa com precisão. Não invente fontes.
${context}`);
      outputs.push({provider:p,text:r.text});
    } catch(e) { outputs.push({provider:prov[i],error:e.message}); }
  }

  const synthesisInput = `Você é o NEXUS CORE, coordenador final.
Consolide os especialistas abaixo. Use a web/código somente quando os resultados fornecidos forem insuficientes.
Se houver conflito, deixe claro o conflito. Seja útil e direto.
${context}
ESPECIALISTAS:
${outputs.map(o=>`[${o.provider}] ${o.text||o.error}`).join("\n\n")}`;
  let finalText;
  try {
    finalText = (await callModel(prov[0], synthesisInput)).text;
  } catch {
    finalText = outputs.find(x=>x.text)?.text || "Não foi possível consolidar as respostas.";
  }

  const updated = projects[projectId] || {id:projectId,name:"Projeto Nexus",memory:"",history:[]};
  updated.history = [...(updated.history||[]), {at:new Date().toISOString(), user:clean(message), answer:clean(finalText)}].slice(-50);
  const memoryLine = `Pedido: ${clean(message)}\nResultado: ${clean(finalText).slice(0,1500)}`;
  updated.memory = [updated.memory||"", memoryLine].filter(Boolean).join("\n\n").slice(-12000);
  projects[projectId]=updated;
  await saveProjects(projects);

  return {mode:"live", plan, answer:finalText, providers:outputs.map(x=>x.provider), evidence};
}

async function route(req,res,url) {
  if (req.method==="OPTIONS") return json(res,204,{});
  if (url.pathname==="/api/status") return json(res,200,{providers:cfg, available:providers(), autonomous:{web:cfg.gemini,code:cfg.gemini,files:true,memory:true}});
  if (url.pathname==="/api/projects" && req.method==="GET") return json(res,200,{projects:await getProjects()});
  if (url.pathname==="/api/projects" && req.method==="POST") {
    const b=await body(req); const id=b.id || crypto.randomUUID();
    const p=await getProjects(); p[id]={id,name:b.name||"Novo projeto",memory:"",history:[]}; await saveProjects(p);
    return json(res,201,p[id]);
  }
  if (url.pathname==="/api/nexus" && req.method==="POST") {
    const b=await body(req); if(!b.message) return json(res,400,{error:"message é obrigatório"});
    return json(res,200,await nexusRun(b.message,b.projectId||"default",b.attachment||null));
  }
  if (url.pathname==="/api/memory" && req.method==="POST") {
    const b=await body(req); const p=await getProjects(); const id=b.projectId||"default";
    p[id]=p[id]||{id,name:"Projeto Nexus",memory:"",history:[]};
    p[id].memory=clean(b.memory||""); await saveProjects(p); return json(res,200,p[id]);
  }
  if (url.pathname.startsWith("/api/")) return json(res,404,{error:"Rota não encontrada"});
  const file = url.pathname==="/" ? "index.html" : url.pathname.slice(1);
  if (file.includes("..") || file.includes("\\")) return text(res,400,"Bad request");
  try { const data=await fs.readFile(path.join(ROOT,file)); const ext=path.extname(file); const type={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json",".webmanifest":"application/manifest+json"}[ext]||"application/octet-stream"; return text(res,200,data,type); }
  catch { return text(res,404,"Not found"); }
}

http.createServer((req,res)=>route(req,res,new URL(req.url,`http://${req.headers.host}`)).catch(e=>json(res,500,{error:e.message}))).listen(PORT,"0.0.0.0",()=>console.log(`NEXUS AI MAX v0.5 em http://localhost:${PORT}`));
