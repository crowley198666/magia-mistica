/* =========================================================
   MAGIA MÍSTICA — LÓGICA DA LOJA
   Conectado ao Supabase (banco de dados real)
========================================================= */

const SIGILS = {
  cristais: '<svg viewBox="0 0 24 24" fill="none"><path d="M16 3a9 9 0 100 18 9 9 0 010-18z" fill="#D4AF37" opacity="0.85"/></svg>',
  taro: '<svg viewBox="0 0 24 24" fill="none"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" stroke="#D4AF37" stroke-width="1.4"/><circle cx="12" cy="12" r="3" fill="#9B6DD6"/></svg>',
  incensos: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="5" fill="#D4AF37"/><g stroke="#D4AF37" stroke-width="1.4"><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2 2M17 17l2 2M4.9 19.1l2-2M17 7l2-2"/></g></svg>',
  velas: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 2l3 6 6 1-4.5 4.5L18 20l-6-3-6 3 1.5-6.5L3 9l6-1z" fill="#D4AF37" opacity="0.85"/></svg>'
};
const CAT_LABEL = {cristais:'Cristal', taro:'Tarô', incensos:'Incenso', velas:'Vela'};

/* =========================================================
   ESTADO
========================================================= */
let PRODUCTS = [];          // vem do Supabase
let cart = {};               // {produto_id: qty} — guardado no localStorage do navegador
let currentFilter = 'todos';

const CART_KEY = 'magia-mistica-cart';

function loadCartFromBrowser(){
  try{
    const raw = localStorage.getItem(CART_KEY);
    cart = raw ? JSON.parse(raw) : {};
  }catch(e){ cart = {}; }
}
function saveCartToBrowser(){
  try{ localStorage.setItem(CART_KEY, JSON.stringify(cart)); }catch(e){ console.error(e); }
}

function fmtBRL(v){ return 'R$ ' + Number(v).toFixed(2).replace('.', ','); }

/* =========================================================
   BUSCAR PRODUTOS DO SUPABASE
========================================================= */
async function fetchProducts(){
  const grid = document.getElementById('productGrid');
  grid.innerHTML = `<div class="grid-loading">Carregando peças místicas...</div>`;
  try{
    const { data, error } = await supabaseClient
      .from('produtos')
      .select('*')
      .eq('ativo', true)
      .order('criado_em', { ascending: true });

    if(error) throw error;
    PRODUCTS = data || [];
    renderGrid();
  }catch(err){
    console.error('Erro ao buscar produtos:', err);
    grid.innerHTML = `<div class="grid-error">Não foi possível carregar o catálogo agora. Verifique sua conexão e recarregue a página.</div>`;
  }
}

/* =========================================================
   RENDER: CATÁLOGO
========================================================= */
function renderGrid(){
  const grid = document.getElementById('productGrid');
  const list = currentFilter === 'todos' ? PRODUCTS : PRODUCTS.filter(p => p.categoria === currentFilter);

  if(list.length === 0){
    grid.innerHTML = `<div class="grid-loading">Nenhum produto encontrado nesta categoria.</div>`;
    return;
  }

  grid.innerHTML = list.map(p => {
    const soldOut = p.estoque <= 0;
    return `
    <div class="product-card ${soldOut ? 'sold-out' : ''}">
      <div class="product-media">
        <span class="product-tag">${CAT_LABEL[p.categoria] || p.categoria}</span>
        ${soldOut ? '<span class="out-of-stock">Esgotado</span>' : ''}
        <div class="sigil-badge">${SIGILS[p.categoria] || SIGILS.cristais}</div>
      </div>
      <div class="product-info">
        <h3>${escapeHtml(p.nome)}</h3>
        <p class="desc">${escapeHtml(p.descricao || '')}</p>
        <div class="product-footer">
          <span class="price">${p.preco_antigo ? `<span class="old">${fmtBRL(p.preco_antigo)}</span>` : ''}${fmtBRL(p.preco)}</span>
          <button class="add-btn" data-id="${p.id}" ${soldOut ? 'disabled' : ''}>${soldOut ? 'Esgotado' : '+ Adicionar'}</button>
        </div>
      </div>
    </div>
  `;
  }).join('');

  grid.querySelectorAll('.add-btn:not([disabled])').forEach(btn => {
    btn.addEventListener('click', () => {
      addToCart(btn.dataset.id);
      const original = btn.textContent;
      btn.textContent = 'Adicionado ✓';
      btn.classList.add('added');
      setTimeout(() => { btn.textContent = original; btn.classList.remove('added'); }, 1100);
    });
  });
}

function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

document.getElementById('filters').addEventListener('click', (e) => {
  const chip = e.target.closest('.filter-chip');
  if(!chip) return;
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  chip.classList.add('active');
  currentFilter = chip.dataset.cat;
  renderGrid();
});

/* =========================================================
   CARRINHO
========================================================= */
function findProduct(id){ return PRODUCTS.find(p => p.id === id); }

function addToCart(id){
  const p = findProduct(id);
  if(!p) return;
  const currentQty = cart[id] || 0;
  if(currentQty + 1 > p.estoque){
    showToast('Quantidade indisponível em estoque');
    return;
  }
  cart[id] = currentQty + 1;
  saveCartToBrowser();
  renderCart();
  showToast('Item adicionado ao carrinho ✦');
}
function changeQty(id, delta){
  if(!cart[id]) return;
  const p = findProduct(id);
  const next = cart[id] + delta;
  if(p && next > p.estoque){
    showToast('Quantidade indisponível em estoque');
    return;
  }
  cart[id] = next;
  if(cart[id] <= 0) delete cart[id];
  saveCartToBrowser();
  renderCart();
}
function removeFromCart(id){
  delete cart[id];
  saveCartToBrowser();
  renderCart();
}
function cartTotal(){
  return Object.entries(cart).reduce((sum, [id, qty]) => {
    const p = findProduct(id);
    return p ? sum + p.preco * qty : sum;
  }, 0);
}
function cartItemCount(){
  return Object.values(cart).reduce((a,b) => a+b, 0);
}

function renderCart(){
  const body = document.getElementById('cartBody');
  const entries = Object.entries(cart).filter(([id]) => findProduct(id));
  document.getElementById('cartCount').textContent = cartItemCount();
  document.getElementById('cartSubtotal').textContent = fmtBRL(cartTotal());
  document.getElementById('goCheckout').disabled = entries.length === 0;

  if(entries.length === 0){
    body.innerHTML = `<div class="empty-cart">✦<br>Seu carrinho está vazio.<br>Que tal explorar o catálogo?</div>`;
    return;
  }

  body.innerHTML = entries.map(([id, qty]) => {
    const p = findProduct(id);
    return `
      <div class="cart-item" data-id="${id}">
        <div class="ci-icon">${SIGILS[p.categoria] || SIGILS.cristais}</div>
        <div class="ci-info">
          <h4>${escapeHtml(p.nome)}</h4>
          <div class="ci-price">${fmtBRL(p.preco)}</div>
          <div class="qty-control">
            <button class="qty-minus">−</button>
            <span>${qty}</span>
            <button class="qty-plus">+</button>
            <a class="remove-link">remover</a>
          </div>
        </div>
      </div>
    `;
  }).join('');

  body.querySelectorAll('.cart-item').forEach(el => {
    const id = el.dataset.id;
    el.querySelector('.qty-plus').addEventListener('click', () => changeQty(id, 1));
    el.querySelector('.qty-minus').addEventListener('click', () => changeQty(id, -1));
    el.querySelector('.remove-link').addEventListener('click', () => removeFromCart(id));
  });
}

function openDrawer(){
  document.getElementById('cartDrawer').classList.add('open');
  document.getElementById('overlay').classList.add('open');
}
function closeDrawer(){
  document.getElementById('cartDrawer').classList.remove('open');
  document.getElementById('overlay').classList.remove('open');
}
document.getElementById('openCart').addEventListener('click', openDrawer);
document.getElementById('closeCart').addEventListener('click', closeDrawer);
document.getElementById('overlay').addEventListener('click', closeDrawer);

/* =========================================================
   TOAST
========================================================= */
let toastTimer;
function showToast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

/* =========================================================
   CHECKOUT FLOW
========================================================= */
let checkoutStep = 1;
let checkoutData = { name:'', email:'', cep:'', address:'', city:'', state:'', method:'pix' };
let cachedSnapshot = null;

function openCheckout(){
  if(cartItemCount() === 0) return;
  cachedSnapshot = { ...cart };
  checkoutStep = 1;
  checkoutData = { name:'', email:'', cep:'', address:'', city:'', state:'', method:'pix' };
  document.getElementById('checkoutOverlay').classList.add('open');
  closeDrawer();
  renderCheckoutStep();
}
function closeCheckout(){
  document.getElementById('checkoutOverlay').classList.remove('open');
}
document.getElementById('goCheckout').addEventListener('click', openCheckout);
document.getElementById('closeModal').addEventListener('click', closeCheckout);

function updateDots(){
  for(let i=1;i<=3;i++){
    const dot = document.getElementById('dot'+i);
    dot.classList.remove('done','active');
    if(i < checkoutStep) dot.classList.add('done');
    if(i === checkoutStep) dot.classList.add('active');
  }
}

function snapshotTotal(){
  return Object.entries(cachedSnapshot).reduce((sum, [id, qty]) => {
    const p = findProduct(id);
    return p ? sum + p.preco * qty : sum;
  }, 0);
}

function renderCheckoutStep(){
  updateDots();
  const body = document.getElementById('modalBody');
  const title = document.getElementById('modalTitle');

  if(checkoutStep === 1){
    title.textContent = 'Dados de entrega';
    body.innerHTML = `
      <div class="field-group">
        <label>Nome completo</label>
        <input type="text" id="f-name" placeholder="Como você se chama" value="${checkoutData.name}">
      </div>
      <div class="field-group">
        <label>E-mail</label>
        <input type="email" id="f-email" placeholder="seu@email.com" value="${checkoutData.email}">
      </div>
      <div class="field-row">
        <div class="field-group">
          <label>CEP</label>
          <input type="text" id="f-cep" placeholder="00000-000" value="${checkoutData.cep}">
        </div>
        <div class="field-group">
          <label>Cidade</label>
          <input type="text" id="f-city" placeholder="Sua cidade" value="${checkoutData.city}">
        </div>
      </div>
      <div class="field-row">
        <div class="field-group">
          <label>Endereço</label>
          <input type="text" id="f-address" placeholder="Rua, número, bairro" value="${checkoutData.address}">
        </div>
        <div class="field-group">
          <label>Estado (UF)</label>
          <input type="text" id="f-state" placeholder="SP" maxlength="2" value="${checkoutData.state}">
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn-ghost" id="cancelCheckout">Cancelar</button>
        <button class="btn-gold" id="toStep2">Continuar para pagamento</button>
      </div>
    `;
    document.getElementById('cancelCheckout').addEventListener('click', closeCheckout);
    document.getElementById('toStep2').addEventListener('click', () => {
      const name = document.getElementById('f-name').value.trim();
      const email = document.getElementById('f-email').value.trim();
      const cep = document.getElementById('f-cep').value.trim();
      const address = document.getElementById('f-address').value.trim();
      const city = document.getElementById('f-city').value.trim();
      const state = document.getElementById('f-state').value.trim();
      if(!name || !email || !cep || !address || !city || !state){
        showToast('Preencha todos os campos para continuar');
        return;
      }
      checkoutData = {...checkoutData, name, email, cep, address, city, state};
      checkoutStep = 2;
      renderCheckoutStep();
    });
  }

  else if(checkoutStep === 2){
    title.textContent = 'Forma de pagamento';
    const total = snapshotTotal();
    const itemsHtml = Object.entries(cachedSnapshot).map(([id, qty]) => {
      const p = findProduct(id);
      return `<div class="os-row"><span>${qty}x ${escapeHtml(p.nome)}</span><span>${fmtBRL(p.preco*qty)}</span></div>`;
    }).join('');

    body.innerHTML = `
      <div class="pay-methods">
        <button class="pay-method ${checkoutData.method==='pix'?'active':''}" data-m="pix"><span class="pm-ic">📱</span>PIX</button>
        <button class="pay-method ${checkoutData.method==='cartao'?'active':''}" data-m="cartao"><span class="pm-ic">💳</span>Cartão</button>
        <button class="pay-method ${checkoutData.method==='boleto'?'active':''}" data-m="boleto"><span class="pm-ic">🧾</span>Boleto</button>
      </div>
      <div id="paymentFields"></div>
      <div class="order-summary">
        ${itemsHtml}
        <div class="os-row total"><span>Total</span><span class="val">${fmtBRL(total)}</span></div>
      </div>
      <div class="modal-actions">
        <button class="btn-ghost" id="backStep1">Voltar</button>
        <button class="btn-gold" id="toStep3">Confirmar pagamento</button>
      </div>
    `;
    renderPaymentFields();

    body.querySelectorAll('.pay-method').forEach(btn => {
      btn.addEventListener('click', () => {
        checkoutData.method = btn.dataset.m;
        body.querySelectorAll('.pay-method').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderPaymentFields();
      });
    });
    document.getElementById('backStep1').addEventListener('click', () => { checkoutStep = 1; renderCheckoutStep(); });
    document.getElementById('toStep3').addEventListener('click', () => {
      if(checkoutData.method === 'cartao'){
        const num = document.getElementById('f-card-num')?.value.trim();
        const nm = document.getElementById('f-card-name')?.value.trim();
        const val = document.getElementById('f-card-val')?.value.trim();
        const cvv = document.getElementById('f-card-cvv')?.value.trim();
        if(!num || !nm || !val || !cvv){
          showToast('Preencha os dados do cartão');
          return;
        }
      }
      checkoutStep = 3;
      renderCheckoutStep();
    });
  }

  else if(checkoutStep === 3){
    title.textContent = 'Confirmação';
    processPayment();
  }
}

function renderPaymentFields(){
  const wrap = document.getElementById('paymentFields');
  if(checkoutData.method === 'cartao'){
    wrap.innerHTML = `
      <div class="field-group">
        <label>Número do cartão</label>
        <input type="text" id="f-card-num" placeholder="0000 0000 0000 0000" maxlength="19">
      </div>
      <div class="field-group">
        <label>Nome impresso no cartão</label>
        <input type="text" id="f-card-name" placeholder="Como está no cartão">
      </div>
      <div class="field-row">
        <div class="field-group">
          <label>Validade</label>
          <input type="text" id="f-card-val" placeholder="MM/AA" maxlength="5">
        </div>
        <div class="field-group">
          <label>CVV</label>
          <input type="text" id="f-card-cvv" placeholder="123" maxlength="4">
        </div>
      </div>
    `;
  } else if(checkoutData.method === 'pix'){
    wrap.innerHTML = `<p style="font-size:0.85rem; opacity:0.65; margin-bottom:18px;">Ao confirmar, vamos gerar a cobrança PIX real através do Mercado Pago.</p>`;
  } else {
    wrap.innerHTML = `<p style="font-size:0.85rem; opacity:0.65; margin-bottom:18px;">Ao confirmar, vamos gerar o boleto bancário real através do Mercado Pago.</p>`;
  }
}

function genOrderId(){
  return 'MM-' + Date.now().toString(36).toUpperCase().slice(-6) + '-' + Math.floor(Math.random()*900+100);
}

/* =========================================================
   PROCESSAR PAGAMENTO — grava pedido real no Supabase
   (a integração com o Mercado Pago entra aqui na próxima etapa,
   por enquanto o pedido já é salvo de verdade no banco)
========================================================= */
async function processPayment(){
  const body = document.getElementById('modalBody');
  const total = snapshotTotal();
  const orderId = genOrderId();

  body.innerHTML = `
    <div style="text-align:center; padding:50px 0;">
      <div style="font-size:2rem; margin-bottom:14px;">✦</div>
      <p style="opacity:0.75;">Registrando seu pedido...</p>
    </div>
  `;

  try{
    // 1. Cria o pedido na tabela "pedidos"
    const { data: pedido, error: erroPedido } = await supabaseClient
      .from('pedidos')
      .insert({
        codigo: orderId,
        nome_cliente: checkoutData.name,
        email_cliente: checkoutData.email,
        cep: checkoutData.cep,
        endereco: checkoutData.address,
        cidade: checkoutData.city,
        estado: checkoutData.state,
        metodo_pagamento: checkoutData.method,
        status: 'pendente',
        total: total
      })
      .select()
      .single();

    if(erroPedido) throw erroPedido;

    // 2. Cria os itens do pedido na tabela "itens_pedido"
    const itensParaInserir = Object.entries(cachedSnapshot).map(([id, qty]) => {
      const p = findProduct(id);
      return {
        pedido_id: pedido.id,
        produto_id: id,
        nome_produto: p.nome,
        quantidade: qty,
        preco_unitario: p.preco
      };
    });
    const { error: erroItens } = await supabaseClient.from('itens_pedido').insert(itensParaInserir);
    if(erroItens) throw erroItens;

    // 3. Por enquanto, simulamos a confirmação de pagamento aqui mesmo
    //    (na próxima etapa, isso vira uma chamada real ao backend do Mercado Pago)
    renderPaymentSimulation(orderId, pedido.id, total);

  }catch(err){
    console.error('Erro ao registrar pedido:', err);
    body.innerHTML = `
      <div class="grid-error" style="margin:0;">
        Não foi possível registrar seu pedido. Tente novamente em alguns instantes.
      </div>
      <div class="modal-actions">
        <button class="btn-ghost" id="closeErrBtn" style="flex:1;">Fechar</button>
      </div>
    `;
    document.getElementById('closeErrBtn').addEventListener('click', closeCheckout);
  }
}

function renderPaymentSimulation(orderId, pedidoDbId, total){
  const body = document.getElementById('modalBody');

  if(checkoutData.method === 'pix'){
    const pixCode = '00020126580014BR.GOV.BCB.PIX0136' + cryptoRandomHex(32) + '5204000053039865802BR5913MAGIA MISTICA6009SAO PAULO62070503***6304' + cryptoRandomHex(4).toUpperCase();
    body.innerHTML = `
      <div class="pix-box">
        <div class="pix-qr">${qrPlaceholderSvg()}</div>
        <div class="pix-code">${pixCode}</div>
        <button class="copy-btn" id="copyPix">Copiar código PIX</button>
        <div class="pix-timer" id="pixTimer">Aguardando pagamento... 0:08</div>
      </div>
    `;
    document.getElementById('copyPix').addEventListener('click', () => {
      navigator.clipboard?.writeText(pixCode);
      showToast('Código PIX copiado');
    });
    let t = 8;
    const timerEl = document.getElementById('pixTimer');
    const interval = setInterval(() => {
      t--;
      if(timerEl) timerEl.textContent = `Aguardando pagamento... 0:0${t}`;
      if(t <= 0){
        clearInterval(interval);
        finalizeOrder(orderId, pedidoDbId, total, 'pago');
      }
    }, 500);
  }

  else if(checkoutData.method === 'boleto'){
    const due = new Date(Date.now() + 3*86400000).toLocaleDateString('pt-BR');
    body.innerHTML = `
      <div class="boleto-box">
        <div class="boleto-barcode"></div>
        <div class="boleto-code">34191.79001 01043.510047 91020.150008 5 84410026000</div>
        <p style="font-size:0.85rem; opacity:0.7; margin-bottom:14px;">Vencimento: ${due} — compensação em até 2 dias úteis após o pagamento.</p>
        <button class="copy-btn" id="copyBoleto">Copiar código de barras</button>
      </div>
    `;
    document.getElementById('copyBoleto').addEventListener('click', () => {
      navigator.clipboard?.writeText('34191790010104351004791020150008584410026000');
      showToast('Código de barras copiado');
    });
    setTimeout(() => finalizeOrder(orderId, pedidoDbId, total, 'pendente'), 2200);
  }

  else {
    body.innerHTML = `
      <div style="text-align:center; padding:50px 0;">
        <div style="font-size:2rem; margin-bottom:14px;">✦</div>
        <p style="opacity:0.75;">Processando pagamento com a operadora do cartão...</p>
      </div>
    `;
    setTimeout(() => finalizeOrder(orderId, pedidoDbId, total, 'pago'), 1800);
  }
}

function cryptoRandomHex(len){
  let s = '';
  const chars = '0123456789ABCDEF';
  for(let i=0;i<len;i++) s += chars[Math.floor(Math.random()*chars.length)];
  return s;
}
function qrPlaceholderSvg(){
  let cells = '';
  for(let y=0;y<10;y++){
    for(let x=0;x<10;x++){
      if(Math.random() > 0.45) cells += `<rect x="${x*16}" y="${y*16}" width="14" height="14" fill="#0D0717"/>`;
    }
  }
  return `<svg width="160" height="160" viewBox="0 0 160 160">${cells}</svg>`;
}

async function finalizeOrder(orderId, pedidoDbId, total, status){
  try{
    // 1. Atualiza o status do pedido no Supabase
    await supabaseClient.from('pedidos').update({ status }).eq('id', pedidoDbId);

    // 2. Dá baixa no estoque de cada produto comprado
    for(const [id, qty] of Object.entries(cachedSnapshot)){
      const p = findProduct(id);
      if(!p) continue;
      const novoEstoque = Math.max(0, p.estoque - qty);
      await supabaseClient.from('produtos').update({ estoque: novoEstoque }).eq('id', id);
      p.estoque = novoEstoque; // atualiza localmente também
    }

    // 3. Limpa os itens comprados do carrinho local
    Object.keys(cachedSnapshot).forEach(id => delete cart[id]);
    saveCartToBrowser();
    renderCart();
    renderGrid(); // atualiza estoque exibido

  }catch(err){
    console.error('Erro ao finalizar pedido:', err);
  }

  const body = document.getElementById('modalBody');
  body.innerHTML = `
    <div class="success-box">
      <div class="success-icon"><svg viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L19 7" stroke="#D4AF37" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
      <h3>${status === 'pendente' ? 'Boleto gerado!' : 'Pagamento confirmado!'}</h3>
      <p>${status === 'pendente' ? 'Seu pedido será processado após a compensação do boleto.' : 'Seu ritual de compra foi concluído. Em breve seus itens chegarão até você.'}</p>
      <div class="order-id">Pedido ${orderId}</div>
      <div class="modal-actions">
        <button class="btn-gold" id="closeSuccessBtn" style="flex:1;">Concluir</button>
      </div>
    </div>
  `;
  document.getElementById('closeSuccessBtn').addEventListener('click', closeCheckout);
}

/* =========================================================
   "MEUS PEDIDOS" — busca por e-mail informado
========================================================= */
function openOrdersView(){
  document.getElementById('checkoutOverlay').classList.add('open');
  document.getElementById('modalTitle').textContent = 'Meus pedidos';
  document.querySelector('.steps-track').style.display = 'none';
  const body = document.getElementById('modalBody');
  body.innerHTML = `
    <div class="field-group">
      <label>Digite o e-mail usado na compra</label>
      <input type="email" id="f-orders-email" placeholder="seu@email.com">
    </div>
    <div class="modal-actions">
      <button class="btn-ghost" id="closeOrdersBtn" style="flex:1;">Fechar</button>
      <button class="btn-gold" id="searchOrdersBtn" style="flex:1;">Buscar pedidos</button>
    </div>
    <div id="ordersResult" style="margin-top:18px;"></div>
  `;
  document.getElementById('closeOrdersBtn').addEventListener('click', () => {
    closeCheckout();
    document.querySelector('.steps-track').style.display = 'flex';
  });
  document.getElementById('searchOrdersBtn').addEventListener('click', async () => {
    const email = document.getElementById('f-orders-email').value.trim();
    const resultDiv = document.getElementById('ordersResult');
    if(!email){ showToast('Digite seu e-mail'); return; }
    resultDiv.innerHTML = `<div class="loading-state">Buscando...</div>`;
    try{
      const { data, error } = await supabaseClient
        .from('pedidos')
        .select('*')
        .eq('email_cliente', email)
        .order('criado_em', { ascending: false });
      if(error) throw error;
      if(!data || data.length === 0){
        resultDiv.innerHTML = `<div class="empty-cart">Nenhum pedido encontrado para este e-mail.</div>`;
        return;
      }
      resultDiv.innerHTML = `<div class="orders-list">` + data.map(o => `
        <div class="order-card">
          <div>
            <div class="oc-id">${o.codigo}</div>
            <div class="oc-date">${new Date(o.criado_em).toLocaleString('pt-BR')} · ${o.metodo_pagamento}</div>
          </div>
          <span class="oc-status">${o.status}</span>
          <span class="oc-total">${fmtBRL(o.total)}</span>
        </div>
      `).join('') + `</div>`;
    }catch(err){
      console.error(err);
      resultDiv.innerHTML = `<div class="grid-error" style="margin:0;">Erro ao buscar pedidos.</div>`;
    }
  });
}
document.getElementById('ordersLink').addEventListener('click', (e) => { e.preventDefault(); openOrdersView(); });
document.getElementById('ordersLink2').addEventListener('click', (e) => { e.preventDefault(); openOrdersView(); });

/* =========================================================
   STARFIELD BACKGROUND
========================================================= */
function initStars(){
  const canvas = document.getElementById('starsCanvas');
  const ctx = canvas.getContext('2d');
  let stars = [];
  function resize(){
    canvas.width = window.innerWidth;
    canvas.height = document.body.scrollHeight;
    stars = [];
    const count = Math.floor((canvas.width*canvas.height)/9000);
    for(let i=0;i<count;i++){
      stars.push({
        x: Math.random()*canvas.width,
        y: Math.random()*canvas.height,
        r: Math.random()*1.3+0.2,
        a: Math.random()*0.6+0.15,
        speed: Math.random()*0.4+0.1,
        phase: Math.random()*Math.PI*2
      });
    }
  }
  let t = 0;
  function draw(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    stars.forEach(s => {
      const tw = 0.5 + 0.5*Math.sin(t*s.speed + s.phase);
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI*2);
      ctx.fillStyle = `rgba(245,230,211,${(s.a*tw).toFixed(2)})`;
      ctx.fill();
    });
    t += 0.02;
    requestAnimationFrame(draw);
  }
  resize();
  draw();
  window.addEventListener('resize', resize);
  setTimeout(resize, 500);
}

/* =========================================================
   HERO CONSTELLATION (canvas)
========================================================= */
function initConstellation(){
  const canvas = document.getElementById('constellation');
  const ctx = canvas.getContext('2d');
  function size(){
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
  }
  size();
  window.addEventListener('resize', size);

  const points = [];
  const n = 22;
  for(let i=0;i<n;i++){
    const angle = (i/n)*Math.PI*2;
    const radius = 0.28 + Math.random()*0.42;
    points.push({
      baseX: 0.5 + Math.cos(angle)*radius,
      baseY: 0.5 + Math.sin(angle)*radius,
      phase: Math.random()*Math.PI*2,
      speed: 0.3+Math.random()*0.3
    });
  }
  const edges = [];
  for(let i=0;i<points.length;i++){
    let bestJ=-1, bestD=Infinity;
    for(let j=0;j<points.length;j++){
      if(i===j) continue;
      const d = Math.hypot(points[i].baseX-points[j].baseX, points[i].baseY-points[j].baseY);
      if(d<bestD){bestD=d; bestJ=j;}
    }
    edges.push([i,bestJ]);
  }

  let t = 0;
  function frame(){
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0,0,w,h);
    const pos = points.map(p => ({
      x: (p.baseX + Math.sin(t*p.speed+p.phase)*0.012)*w,
      y: (p.baseY + Math.cos(t*p.speed+p.phase)*0.012)*h
    }));

    ctx.strokeStyle = 'rgba(155,109,214,0.25)';
    ctx.lineWidth = 1;
    edges.forEach(([i,j]) => {
      ctx.beginPath();
      ctx.moveTo(pos[i].x, pos[i].y);
      ctx.lineTo(pos[j].x, pos[j].y);
      ctx.stroke();
    });

    pos.forEach((p,i) => {
      const tw = 0.6+0.4*Math.sin(t*1.5+i);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.4, 0, Math.PI*2);
      ctx.fillStyle = `rgba(212,175,55,${0.7*tw})`;
      ctx.fill();
    });

    const cx = w/2, cy = h/2;
    const grad = ctx.createRadialGradient(cx,cy,0,cx,cy,w*0.22);
    grad.addColorStop(0, 'rgba(212,175,55,0.35)');
    grad.addColorStop(1, 'rgba(212,175,55,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx,cy,w*0.22,0,Math.PI*2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(212,175,55,0.5)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.arc(cx,cy,w*0.14,0,Math.PI*2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, cy-w*0.14);
    ctx.lineTo(cx, cy+w*0.14);
    ctx.moveTo(cx-w*0.14, cy);
    ctx.lineTo(cx+w*0.14, cy);
    ctx.stroke();

    t += 0.012;
    requestAnimationFrame(frame);
  }
  frame();
}

/* =========================================================
   INIT
========================================================= */
loadCartFromBrowser();
fetchProducts();
renderCart();
initStars();
initConstellation();
