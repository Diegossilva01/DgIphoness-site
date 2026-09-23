
function money(n){return Number(n||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}
function todayBR(){
  const d=new Date();
  return d.toLocaleDateString("pt-BR");
}
function isoToday(){
  return new Date().toISOString().slice(0,10);
}
function statusClass(status){
  if(status==="Recebido") return "status-received";
  if(status==="Em análise") return "status-analysis";
  if(status==="Em reparo") return "status-repair";
  if(status==="Pronto") return "status-ready";
  return "status-delivered";
}
function getOrders(){return JSON.parse(localStorage.getItem("adones_orders")||"[]")}
function saveOrders(v){localStorage.setItem("adones_orders",JSON.stringify(v))}
function getExpenses(){return JSON.parse(localStorage.getItem("adones_expenses")||"[]")}
function saveExpenses(v){localStorage.setItem("adones_expenses",JSON.stringify(v))}
if(!localStorage.getItem("adones_orders")){
  saveOrders([
    {id:"OS-1001",client:"Marcos Silva",phone:"(11) 98888-1122",model:"iPhone 13",service:"Troca de tela",status:"Em reparo",received:"22/09/2026",price:620,cost:265,notes:"Tela retirada, aguardando montagem."},
    {id:"OS-1002",client:"Beatriz Lima",phone:"(11) 97777-8831",model:"iPhone 12 Pro",service:"Bateria",status:"Pronto",received:"22/09/2026",price:390,cost:150,notes:"Teste de carga concluído."},
    {id:"OS-1003",client:"Rafael Souza",phone:"(11) 96645-1030",model:"iPhone 15",service:"Conector de carga",status:"Em análise",received:"21/09/2026",price:480,cost:210,notes:"Analisando possível oxidação."},
    {id:"OS-1004",client:"Camila Alves",phone:"(11) 95540-3041",model:"iPhone 11",service:"Câmera traseira",status:"Recebido",received:"21/09/2026",price:350,cost:145,notes:"Aguardando diagnóstico."},
    {id:"OS-1005",client:"João Pedro",phone:"(11) 94432-2211",model:"iPhone XR",service:"Troca de tela",status:"Entregue",received:"20/09/2026",price:390,cost:165,notes:"Entregue ao cliente."}
  ]);
}
if(!localStorage.getItem("adones_expenses")){
  saveExpenses([
    {id:"G1",date:"22/09/2026",description:"Películas e materiais",category:"Peças",value:185},
    {id:"G2",date:"21/09/2026",description:"Anúncios Instagram",category:"Marketing",value:120},
    {id:"G3",date:"19/09/2026",description:"Kit ferramentas",category:"Ferramentas",value:240}
  ]);
}

const panelTitles={overview:"Visão geral",orders:"Ordens de serviço",finance:"Financeiro",expenses:"Gastos"};
document.querySelectorAll(".sidebar-nav button").forEach(btn=>{
  btn.addEventListener("click",()=>{
    document.querySelectorAll(".sidebar-nav button").forEach(b=>b.classList.remove("active"));
    document.querySelectorAll(".panel-section").forEach(s=>s.classList.remove("active"));
    btn.classList.add("active");
    const id=btn.dataset.panel;
    document.getElementById(id).classList.add("active");
    document.getElementById("pageTitle").textContent=panelTitles[id];
    document.getElementById("sidebar").classList.remove("open");
    renderAll();
  });
});
document.getElementById("mobileMenu").addEventListener("click",()=>document.getElementById("sidebar").classList.toggle("open"));

function totals(){
  const orders=getOrders();
  const expenses=getExpenses();
  const revenue=orders.reduce((s,o)=>s+Number(o.price||0),0);
  const costs=orders.reduce((s,o)=>s+Number(o.cost||0),0);
  const extra=expenses.reduce((s,e)=>s+Number(e.value||0),0);
  return {revenue,costs,extra,profit:revenue-costs-extra};
}

function renderOverview(){
  const orders=getOrders();
  const t=totals();
  document.getElementById("statOpen").textContent=orders.filter(o=>o.status!=="Entregue").length;
  document.getElementById("statRevenue").textContent=money(t.revenue);
  document.getElementById("statCosts").textContent=money(t.costs+t.extra);
  document.getElementById("statProfit").textContent=money(t.profit);
  document.getElementById("recentOrders").innerHTML=orders.slice().reverse().slice(0,6).map(o=>`
    <tr><td><strong>${o.id}</strong></td><td>${o.client}</td><td>${o.model}</td><td><span class="status-pill ${statusClass(o.status)}">${o.status}</span></td><td><strong>${money(o.price)}</strong></td></tr>
  `).join("");
  const statuses=["Recebido","Em análise","Em reparo","Pronto","Entregue"];
  document.getElementById("statusProgress").innerHTML=statuses.map(s=>{
    const count=orders.filter(o=>o.status===s).length;
    const pct=orders.length?Math.round(count/orders.length*100):0;
    return `<div class="progress-item"><div class="progress-label"><span>${s}</span><strong>${count}</strong></div><div class="progress-bar"><span style="width:${pct}%"></span></div></div>`;
  }).join("");
}

function renderOrders(){
  const q=(document.getElementById("orderSearch")?.value||"").toLowerCase();
  const sf=document.getElementById("statusFilter")?.value||"";
  const data=getOrders().filter(o=>{
    const okQ=!q||[o.id,o.client,o.model,o.service].join(" ").toLowerCase().includes(q);
    const okS=!sf||o.status===sf;
    return okQ&&okS;
  }).slice().reverse();
  document.getElementById("ordersTable").innerHTML=data.map(o=>`
    <tr>
      <td><strong>${o.id}</strong></td><td>${o.client}</td><td>${o.phone||"-"}</td><td>${o.model}</td><td>${o.service}</td>
      <td><span class="status-pill ${statusClass(o.status)}">${o.status}</span></td><td>${money(o.price)}</td><td>${money(o.cost)}</td>
      <td><div class="table-actions"><button class="icon-btn edit-order" data-id="${o.id}">✎</button><button class="icon-btn delete-order" data-id="${o.id}">⌫</button></div></td>
    </tr>`).join("") || `<tr><td colspan="9" style="text-align:center;color:#7b8799;padding:28px">Nenhuma ordem encontrada.</td></tr>`;
  document.querySelectorAll(".edit-order").forEach(b=>b.onclick=()=>openOrder(b.dataset.id));
  document.querySelectorAll(".delete-order").forEach(b=>b.onclick=()=>deleteOrder(b.dataset.id));
}

function renderFinance(){
  const t=totals(), orders=getOrders();
  document.getElementById("financeRevenue").textContent=money(t.revenue);
  document.getElementById("financeCosts").textContent=money(t.costs+t.extra);
  document.getElementById("financeProfit").textContent=money(t.profit);
  const top=orders.slice().sort((a,b)=>(b.price-b.cost)-(a.price-a.cost)).slice(0,6);
  document.getElementById("profitTable").innerHTML=top.map(o=>`<tr><td><strong>${o.id}</strong></td><td>${o.service}</td><td><strong style="color:#1d9b67">${money(o.price-o.cost)}</strong></td></tr>`).join("");
  const months=["Abr","Mai","Jun","Jul","Ago","Set"];
  const factors=[.55,.64,.60,.75,.81,1];
  const max=Math.max(t.revenue,1);
  document.getElementById("financeBars").innerHTML=months.map((m,i)=>{
    const rev=t.revenue*factors[i]/6;
    const cost=(t.costs+t.extra)*factors[i]/6;
    const h1=Math.max(12,Math.round(rev/max*820));
    const h2=Math.max(8,Math.round(cost/max*820));
    return `<div class="finance-col"><div class="bar-wrap"><div class="bar" style="height:${Math.min(h1,170)}px"></div><div class="bar exp" style="height:${Math.min(h2,170)}px"></div></div><span>${m}</span></div>`;
  }).join("");
}
function renderExpenses(){
  const q=(document.getElementById("expenseSearch")?.value||"").toLowerCase();
  const data=getExpenses().filter(e=>!q||[e.description,e.category].join(" ").toLowerCase().includes(q)).slice().reverse();
  document.getElementById("expensesTable").innerHTML=data.map(e=>`
    <tr><td>${e.date}</td><td><strong>${e.description}</strong></td><td>${e.category}</td><td>${money(e.value)}</td>
    <td><button class="icon-btn delete-expense" data-id="${e.id}">⌫</button></td></tr>`).join("") || `<tr><td colspan="5" style="text-align:center;color:#7b8799;padding:28px">Nenhum gasto cadastrado.</td></tr>`;
  document.querySelectorAll(".delete-expense").forEach(b=>b.onclick=()=>{saveExpenses(getExpenses().filter(e=>e.id!==b.dataset.id));toast("Gasto excluído.");renderAll()});
}
function renderAll(){renderOverview();renderOrders();renderFinance();renderExpenses()}

function showModal(id){document.getElementById(id).classList.add("show")}
function hideModal(id){document.getElementById(id).classList.remove("show")}
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>hideModal(b.dataset.close));
document.querySelectorAll(".modal-backdrop").forEach(m=>m.addEventListener("click",e=>{if(e.target===m)hideModal(m.id)}));

function nextOS(){
  const nums=getOrders().map(o=>Number(o.id.replace(/\D/g,""))||1000);
  return "OS-"+(Math.max(1000,...nums)+1);
}
function openOrder(id=null){
  const o=id?getOrders().find(x=>x.id===id):null;
  document.getElementById("orderModalTitle").textContent=o?"Editar ordem de serviço":"Nova ordem de serviço";
  document.getElementById("orderEditId").value=o?.id||"";
  document.getElementById("oClient").value=o?.client||"";
  document.getElementById("oPhone").value=o?.phone||"";
  document.getElementById("oModel").value=o?.model||"";
  document.getElementById("oService").value=o?.service||"";
  document.getElementById("oStatus").value=o?.status||"Recebido";
  document.getElementById("oReceived").value="";
  document.getElementById("oPrice").value=o?.price||"";
  document.getElementById("oCost").value=o?.cost||"";
  document.getElementById("oNotes").value=o?.notes||"";
  showModal("orderModal");
}
document.getElementById("newOrderBtn").onclick=()=>openOrder();
document.getElementById("quickNewOrder").onclick=()=>openOrder();

document.getElementById("orderForm").addEventListener("submit",e=>{
  e.preventDefault();
  let orders=getOrders();
  const editId=document.getElementById("orderEditId").value;
  const selectedDate=document.getElementById("oReceived").value;
  const existing=orders.find(x=>x.id===editId);
  const data={
    id:editId||nextOS(),
    client:document.getElementById("oClient").value.trim(),
    phone:document.getElementById("oPhone").value.trim(),
    model:document.getElementById("oModel").value.trim(),
    service:document.getElementById("oService").value.trim(),
    status:document.getElementById("oStatus").value,
    received:selectedDate?new Date(selectedDate+"T12:00:00").toLocaleDateString("pt-BR"):(existing?.received||todayBR()),
    price:Number(document.getElementById("oPrice").value),
    cost:Number(document.getElementById("oCost").value),
    notes:document.getElementById("oNotes").value.trim()
  };
  if(editId) orders=orders.map(o=>o.id===editId?data:o); else orders.push(data);
  saveOrders(orders); hideModal("orderModal"); toast("Ordem de serviço salva."); renderAll();
});
function deleteOrder(id){
  if(confirm(`Excluir a ordem ${id}?`)){saveOrders(getOrders().filter(o=>o.id!==id));toast("Ordem excluída.");renderAll()}
}

document.getElementById("newExpenseBtn").onclick=()=>{
  document.getElementById("expenseForm").reset();
  document.getElementById("eDate").value=isoToday();
  showModal("expenseModal");
};
document.getElementById("expenseForm").addEventListener("submit",e=>{
  e.preventDefault();
  const dateVal=document.getElementById("eDate").value;
  const expenses=getExpenses();
  expenses.push({
    id:"G"+Date.now(),
    description:document.getElementById("eDescription").value.trim(),
    category:document.getElementById("eCategory").value,
    value:Number(document.getElementById("eValue").value),
    date:new Date(dateVal+"T12:00:00").toLocaleDateString("pt-BR")
  });
  saveExpenses(expenses); hideModal("expenseModal"); toast("Gasto salvo."); renderAll();
});
document.getElementById("orderSearch").addEventListener("input",renderOrders);
document.getElementById("statusFilter").addEventListener("change",renderOrders);
document.getElementById("expenseSearch").addEventListener("input",renderExpenses);

let toastTimer;
function toast(msg){
  const el=document.getElementById("toast"); el.textContent=msg; el.classList.add("show");
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove("show"),2200);
}
renderAll();
