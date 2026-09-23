
const models = [
  "iPhone SE (1ª geração)","iPhone 6","iPhone 6 Plus","iPhone 6s","iPhone 6s Plus",
  "iPhone 7","iPhone 7 Plus","iPhone 8","iPhone 8 Plus","iPhone X","iPhone XR",
  "iPhone XS","iPhone XS Max","iPhone 11","iPhone 11 Pro","iPhone 11 Pro Max",
  "iPhone SE (2ª geração)","iPhone 12 mini","iPhone 12","iPhone 12 Pro","iPhone 12 Pro Max",
  "iPhone 13 mini","iPhone 13","iPhone 13 Pro","iPhone 13 Pro Max","iPhone SE (3ª geração)",
  "iPhone 14","iPhone 14 Plus","iPhone 14 Pro","iPhone 14 Pro Max",
  "iPhone 15","iPhone 15 Plus","iPhone 15 Pro","iPhone 15 Pro Max",
  "iPhone 16","iPhone 16 Plus","iPhone 16 Pro","iPhone 16 Pro Max",
  "iPhone 16e","iPhone 17","iPhone 17 Air","iPhone 17 Pro","iPhone 17 Pro Max"
];

const modelSelect = document.getElementById("iphoneModel");
if (modelSelect) {
  models.forEach(m => {
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = m;
    modelSelect.appendChild(opt);
  });
}

const basePrices = {
  screen: 449,
  battery: 249,
  connector: 299,
  camera: 349,
  backglass: 399,
  diagnostic: 120
};

function modelMultiplier(model){
  const match = model.match(/iPhone\s+(\d+)/);
  if (!match) return 0.82;
  const n = Number(match[1]);
  if (n <= 8) return .82;
  if (n <= 11) return .95;
  if (n <= 13) return 1.12;
  if (n <= 15) return 1.32;
  if (n <= 16) return 1.48;
  return 1.62;
}

function money(n){
  return Number(n).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
}

const repairForm = document.getElementById("repairForm");
if (repairForm) {
  repairForm.addEventListener("submit", e => {
    e.preventDefault();
    const model = modelSelect.value;
    const repair = document.getElementById("repairType").value;
    const value = Math.round((basePrices[repair] || 120) * modelMultiplier(model) / 10) * 10;
    document.getElementById("estimateValue").textContent = money(value);
    document.getElementById("estimateBox").classList.remove("hidden");

    document.getElementById("whatsappBtn").onclick = () => {
      const name = document.getElementById("clientName").value.trim();
      const phone = document.getElementById("clientPhone").value.trim();
      const repairText = document.getElementById("repairType").selectedOptions[0].textContent;
      const msg = `Olá! Meu nome é ${name}. Quero orçamento para ${repairText} no ${model}. A estimativa do site foi ${money(value)}. Meu contato: ${phone}.`;
      window.open("https://wa.me/?text="+encodeURIComponent(msg),"_blank");
    };
  });
}

function seedOrders(){
  if (localStorage.getItem("adones_orders")) return;
  const data = [
    {id:"OS-1001",client:"Marcos Silva",phone:"(11) 98888-1122",model:"iPhone 13",service:"Troca de tela",status:"Em reparo",received:"22/09/2026",price:620,cost:265,notes:"Tela retirada, aguardando montagem."},
    {id:"OS-1002",client:"Beatriz Lima",phone:"(11) 97777-8831",model:"iPhone 12 Pro",service:"Bateria",status:"Pronto",received:"22/09/2026",price:390,cost:150,notes:"Teste de carga concluído."},
    {id:"OS-1003",client:"Rafael Souza",phone:"(11) 96645-1030",model:"iPhone 15",service:"Conector de carga",status:"Em análise",received:"21/09/2026",price:480,cost:210,notes:"Analisando possível oxidação."},
    {id:"OS-1004",client:"Camila Alves",phone:"(11) 95540-3041",model:"iPhone 11",service:"Câmera traseira",status:"Recebido",received:"21/09/2026",price:350,cost:145,notes:"Aguardando diagnóstico."},
    {id:"OS-1005",client:"João Pedro",phone:"(11) 94432-2211",model:"iPhone XR",service:"Troca de tela",status:"Entregue",received:"20/09/2026",price:390,cost:165,notes:"Entregue ao cliente."}
  ];
  localStorage.setItem("adones_orders",JSON.stringify(data));
}
seedOrders();

function statusClass(status){
  if(status==="Recebido") return "status-received";
  if(status==="Em análise") return "status-analysis";
  if(status==="Em reparo") return "status-repair";
  if(status==="Pronto") return "status-ready";
  return "status-delivered";
}

const searchBtn = document.getElementById("searchOsBtn");
if(searchBtn){
  const runSearch = () => {
    const q = document.getElementById("osSearch").value.trim().toUpperCase();
    const orders = JSON.parse(localStorage.getItem("adones_orders") || "[]");
    const o = orders.find(x => x.id.toUpperCase()===q);
    const box = document.getElementById("trackResult");
    if(!o){
      box.innerHTML = `<div class="empty-state"><span>!</span><p>Ordem de serviço não encontrada.</p></div>`;
      return;
    }
    box.innerHTML = `
      <div class="order-result">
        <div class="order-head">
          <div><small>Ordem de serviço</small><strong style="display:block;margin-top:3px">${o.id}</strong></div>
          <span class="status-pill ${statusClass(o.status)}">${o.status}</span>
        </div>
        <div class="order-info">
          <div><small>Cliente</small><strong>${o.client}</strong></div>
          <div><small>Aparelho</small><strong>${o.model}</strong></div>
          <div><small>Serviço</small><strong>${o.service}</strong></div>
          <div><small>Entrada</small><strong>${o.received}</strong></div>
          <div style="grid-column:1/-1"><small>Atualização técnica</small><strong>${o.notes || "Sem observações."}</strong></div>
        </div>
      </div>`;
  };
  searchBtn.addEventListener("click",runSearch);
  document.getElementById("osSearch").addEventListener("keydown",e=>{if(e.key==="Enter")runSearch()});
}
