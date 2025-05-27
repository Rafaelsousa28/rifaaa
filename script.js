// Variáveis Globais
let currentUser = null; 
let currentRaffle = null; 
let selectedQuantity = 1;
let currentSelectedPaymentMethod = null; // Guarda 'stripe'
let isAdminAuthenticated = false;
let uploadedImageBase64 = null;
let editingRaffleId = null; 
let currentAdminRaffleIdForPromotion = null; 

// URL do seu backend (ajuste conforme necessário)
const BACKEND_URL = 'https://edf8-149-102-242-98.ngrok-free.app'; // Ou a URL do seu backend em produção

// Chave Publicável do Stripe (segura para usar no frontend)
// IMPORTANTE: Substitua pela sua chave publicável REAL do Stripe
const STRIPE_PUBLISHABLE_KEY = 'pk_live_51RT6NiBxBeAndeGgKd3KmjyE9ayHpEiyUddkSGTHKPBriqJ5wKDoYVLBR7JhxNlihKL65weAhT2ipQeIvC9CnF9t00zaPDkX3y'; 
const stripe = Stripe(STRIPE_PUBLISHABLE_KEY);

// Database (simulação com localStorage)
let db = {
    raffles: [], 
    sales: [],   
    users: [],   
    promotions: [] 
};

// Admin Credentials (para simulação)
const ADMIN_CREDENTIALS = {
    email: 'rafaelsousaooficial@gmail.com', 
    password: 'as12345'               
};

// Instâncias dos Gráficos
let activeRafflesChartInstance = null;
let salesLast7DaysChartInstance = null;


// Inicialização da Aplicação
function initializeApp() {
    console.log("WebApp RifaMax: initializeApp() chamada.");
    loadDB(); 
    
    const savedUser = localStorage.getItem('rifamaxCurrentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        console.log("WebApp RifaMax: Usuário encontrado no localStorage:", currentUser);
        updateAuthUI();
    }
    
    renderRaffles(); 
    showPage('home'); 
    
    window.addEventListener('scroll', handleScroll);
    setupPhoneMasks();

    const adminEditBtn = document.getElementById('adminEditRaffleBtnFromDetail');
    if(adminEditBtn) {
        adminEditBtn.onclick = () => {
            const raffleIdToEdit = currentAdminRaffleIdForPromotion || (currentRaffle ? currentRaffle.id : null);
            if (raffleIdToEdit) openEditRaffleForm(raffleIdToEdit);
            else alert("Selecione uma rifa para editar.");
        };
    }
    const adminNewPromoBtn = document.getElementById('adminNewPromotionBtn');
    if(adminNewPromoBtn) {
        adminNewPromoBtn.onclick = () => {
            const raffleIdForPromo = currentAdminRaffleIdForPromotion || (currentRaffle ? currentRaffle.id : null);
            if(raffleIdForPromo) openAdminPromotionModal(null, raffleIdForPromo);
            else alert("Não foi possível identificar a rifa para adicionar promoção. Abra os detalhes da rifa primeiro.");
        };
    }
    updateAdminNotificationCount(); 
    checkStripeSessionStatus(); 
    console.log("WebApp RifaMax: initializeApp() concluída.");
}

// Gerenciamento do Banco de Dados (localStorage)
function saveDB() {
    localStorage.setItem('rifamaxDB', JSON.stringify(db));
    console.log("WebApp RifaMax: Base de dados salva no localStorage.");
}

function loadDB() {
    const savedData = localStorage.getItem('rifamaxDB');
    if (savedData) {
        db = JSON.parse(savedData);
        if (!db.promotions) db.promotions = []; 
        if (!db.users) db.users = [];

        db.raffles.forEach(raffle => {
            if (raffle.prizeQuotas === undefined) {
                raffle.prizeQuotas = ''; 
            }
            if (!Array.isArray(raffle.soldNumbers)) {
                raffle.soldNumbers = [];
            }
        });
        console.log("WebApp RifaMax: Base de dados carregada do localStorage.");
    } else {
        db.raffles = [
             {
                id: 1, title: 'iPhone 15 Pro Max 256GB', price: 25.00, totalNumbers: 500, soldNumbers: [12, 45, 78, 123, 234, 345, 456],
                description: 'iPhone 15 Pro Max 256GB Titânio Natural.\nAparelho lacrado com garantia Apple de 1 ano.', icon: '📱', image: null, 
                isHighlight: true, drawMethod: 'Loteria Federal, concurso do próximo sábado.', createdAt: new Date(Date.now() - 86400000 * 2).toISOString(), completedAt: null, winner: null, prizeQuotas: "10:Vale R$20,500:Surpresa VIP" 
            },
            {
                id: 2, title: 'MacBook Air M3', price: 35.00, totalNumbers: 300, soldNumbers: Array.from({length: 150}, (_, i) => i + 1),
                description: 'MacBook Air M3 com 8GB RAM e 256GB SSD.\nPerfeito para trabalho e estudos.', icon: '💻', image: null, 
                isHighlight: false, drawMethod: 'Sorteio ao vivo no Instagram @RifaMaxOficial assim que todas as cotas forem vendidas.', createdAt: new Date().toISOString(), completedAt: null, winner: null, prizeQuotas: "1:Bônus,150:Prêmio Extra"
            }
        ];
        db.users = [];
        db.sales = [];
        db.promotions = [];
        saveDB();
        console.log("WebApp RifaMax: Base de dados de exemplo criada e salva.");
    }
}

// Efeitos de UI e Navegação
function handleScroll() {
    const header = document.getElementById('header');
    if (window.scrollY > 50) header.classList.add('scrolled');
    else header.classList.remove('scrolled');
}

function toggleMobileMenu() {
    document.querySelector('.mobile-menu-btn').classList.toggle('active');
    document.getElementById('mobileSidebar').classList.toggle('active');
}

function showPage(pageId) {
    console.log(`WebApp RifaMax: showPage('${pageId}') chamada. isAdminAuthenticated: ${isAdminAuthenticated}`);
    // Limpa parâmetros da URL do Stripe ao navegar para evitar reprocessamento
    if (window.location.search.includes('stripe_payment')) {
        history.replaceState(null, '', window.location.pathname);
    }

    if (pageId === 'admin' && !isAdminAuthenticated) {
        console.log("WebApp RifaMax: Acesso ao admin negado. Abrindo modal de login do admin.");
        openAdminLoginModal();
        return;
    }
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.classList.add('active');
        console.log(`WebApp RifaMax: Página '${pageId}' ativada.`);
        window.scrollTo(0, 0);
        if (pageId === 'admin') {
            showAdminTab('dashboard'); 
            updateAdminNotificationCount(); 
        } else if (pageId === 'winners') {
            renderWinners();
        } else if (pageId === 'home') {
            renderRaffles();
        }
    } else {
        console.error(`WebApp RifaMax: Página com ID '${pageId}' não encontrada.`);
    }
}

function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setupPhoneMasks() {
    const phoneInputs = document.querySelectorAll('input[type="tel"]');
    phoneInputs.forEach(input => {
        input.addEventListener('input', function(e) {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length <= 10) value = value.replace(/^(\d{2})(\d{0,4})(\d{0,4}).*/, '($1) $2-$3').replace(/-$/, '');
            else if (value.length === 11) value = value.replace(/^(\d{2})(\d{0,5})(\d{0,4}).*/, '($1) $2-$3').replace(/-$/, '');
            else value = value.substring(0,11).replace(/^(\d{2})(\d{0,5})(\d{0,4}).*/, '($1) $2-$3').replace(/-$/, '');
            e.target.value = value;
        });
    });
}

function validatePhone(countryCode, phone) {
    const cleanPhone = phone.replace(/\D/g, '');
    if (countryCode === '+55') return cleanPhone.length === 10 || cleanPhone.length === 11;
    return cleanPhone.length >= 7 && cleanPhone.length <= 15; // Validação genérica para outros países
}

function validateEmail(email) {
    const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
}


// Autenticação de Usuário
function openLoginModal() {
    closeModal('adminLoginModal'); 
    const loginModal = document.getElementById('loginModal');
    if (loginModal) {
        loginModal.classList.add('active');
        console.log("WebApp RifaMax: Modal de login do usuário aberto.");
    }
}

function login(event) {
    event.preventDefault();
    const countryCode = document.getElementById('loginCountryCode').value;
    const phone = document.getElementById('loginPhone').value;
    const name = document.getElementById('loginName').value;
    
    if (!validatePhone(countryCode, phone)) {
        alert('Número de telefone inválido!'); return;
    }
    const fullPhone = countryCode + phone.replace(/\D/g, '');
    
    let existingUser = db.users.find(u => u.phone === fullPhone);
    if (existingUser) {
        currentUser = { ...existingUser, displayPhone: `${countryCode} ${phone}` }; 
        if (name && existingUser.name !== name) { 
            existingUser.name = name;
            currentUser.name = name;
        }
    } else {
        currentUser = { phone: fullPhone, name: name, email: null, displayPhone: `${countryCode} ${phone}` }; 
        db.users.push({phone: fullPhone, name: name, email: null, createdAt: new Date().toISOString()});
    }
    
    localStorage.setItem('rifamaxCurrentUser', JSON.stringify(currentUser));
    saveDB();
    closeModal('loginModal');
    updateAuthUI();
    console.log("WebApp RifaMax: Login/Atualização do usuário realizado:", currentUser);
}


function updateAuthUI() {
    const authBtn = document.getElementById('authBtn');
    const mobileAuthBtn = document.getElementById('mobileAuthBtn'); 
    if (currentUser) {
        authBtn.innerHTML = '<span>Sair</span>';
        authBtn.onclick = logout;
        if(mobileAuthBtn) {
            mobileAuthBtn.innerHTML = '<span>Sair</span>';
            mobileAuthBtn.onclick = function() { logout(); toggleMobileMenu(); };
        }
    } else {
        authBtn.innerHTML = '<span>Entrar</span>';
        authBtn.onclick = openLoginModal;
        if(mobileAuthBtn) {
            mobileAuthBtn.innerHTML = '<span>Entrar</span>';
            mobileAuthBtn.onclick = function() { openLoginModal(); toggleMobileMenu(); };
        }
    }
    console.log("WebApp RifaMax: UI de autenticação atualizada. Usuário atual:", currentUser);
}

function logout() {
    currentUser = null;
    localStorage.removeItem('rifamaxCurrentUser');
    updateAuthUI();
    showPage('home');
    console.log("WebApp RifaMax: Logout do usuário realizado.");
}

// Modais
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        if (modalId === 'purchaseModal') {
            document.getElementById('emailStep').style.display = 'none';
            document.getElementById('paymentSelectionStep').style.display = 'block';
            document.getElementById('paymentDetails').style.display = 'none';
            document.getElementById('paymentDetails').innerHTML = '';
            const emailInput = document.getElementById('purchaseUserEmail');
            if (emailInput) emailInput.value = '';
            currentSelectedPaymentMethod = null; 
        }
        console.log(`WebApp RifaMax: Modal '${modalId}' fechado.`);
    } else {
        console.warn(`WebApp RifaMax: Tentativa de fechar modal inexistente: '${modalId}'`);
    }
}
window.addEventListener('click', function(e) { 
    if (e.target.classList.contains('modal')) {
        closeModal(e.target.id);
    }
});


// Funções do Painel de Administração
function requestAdminAccess() {
    console.log(`WebApp RifaMax: requestAdminAccess() chamada. isAdminAuthenticated: ${isAdminAuthenticated}`);
    if (isAdminAuthenticated) showPage('admin');
    else openAdminLoginModal();
}

function openAdminLoginModal() {
    closeModal('loginModal');
    const adminModal = document.getElementById('adminLoginModal');
    if (adminModal) {
        adminModal.classList.add('active');
        console.log("WebApp RifaMax: Modal de login do admin aberto.");
    }
}

function adminLogin(event) {
    event.preventDefault();
    const email = document.getElementById('adminEmail').value;
    const password = document.getElementById('adminPassword').value;
    console.log(`WebApp RifaMax: Tentativa de login do admin com email: ${email}`);
    if (email === ADMIN_CREDENTIALS.email && password === ADMIN_CREDENTIALS.password) {
        isAdminAuthenticated = true;
        console.log("WebApp RifaMax: Login do admin bem-sucedido. isAdminAuthenticated:", isAdminAuthenticated);
        closeModal('adminLoginModal');
        showPage('admin');
        updateAdminNotificationCount(); 
    } else {
        alert('Credenciais de admin inválidas!');
        isAdminAuthenticated = false;
        console.warn("WebApp RifaMax: Tentativa de login do admin falhou.");
    }
}

function resetCreateRaffleForm() {
    document.getElementById('createRaffleForm').reset();
    document.getElementById('prizeQuotasDynamicInputsContainer').innerHTML = ''; 
    document.getElementById('activatePrizeQuotasToggle').classList.remove('active');
    document.getElementById('prizeQuotasConfigSection').style.display = 'none';
    uploadedImageBase64 = null;
    document.getElementById('uploadPlaceholder').innerHTML = '<i>📸</i><p>Clique para adicionar imagem</p>';
    document.getElementById('highlightToggle').classList.remove('active');
    document.getElementById('adminCreateEditTitle').textContent = 'Criar Nova Rifa';
    document.getElementById('createRaffleSubmitBtnText').textContent = 'Criar Rifa';
    editingRaffleId = null; 
    console.log("WebApp RifaMax: Formulário de criação de rifa resetado.");
}

function handleNewRaffleTabClick() {
    resetCreateRaffleForm();
    showAdminTab('create');
}


function showAdminTab(tab) {
    console.log(`WebApp RifaMax: showAdminTab('${tab}') chamada. isAdminAuthenticated: ${isAdminAuthenticated}`);
    if (!isAdminAuthenticated) {
        console.warn("WebApp RifaMax: Tentativa de mostrar aba do admin sem autenticação.");
        return;
    }
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    const clickedTabButton = (tab === 'create') ? 
        document.querySelector('.admin-tab[onclick="handleNewRaffleTabClick()"]') : 
        document.querySelector(`.admin-tab[onclick="showAdminTab('${tab}')"]`);

    if (clickedTabButton) clickedTabButton.classList.add('active');
    else { 
        const createTabFallback = document.querySelector('.admin-tab[onclick="handleNewRaffleTabClick()"]');
        if (createTabFallback && tab === 'create') createTabFallback.classList.add('active');
    }
    
    document.querySelectorAll('.admin-content').forEach(c => c.classList.remove('active'));
    const targetContent = document.getElementById(`admin-${tab}`);
    if (targetContent) {
        targetContent.classList.add('active');
        console.log(`WebApp RifaMax: Aba do admin '${tab}' ativada.`);
    } else {
        console.error(`WebApp RifaMax: Conteúdo da aba do admin 'admin-${tab}' não encontrado.`);
    }
    
    if (tab === 'dashboard') updateAdminDashboard();
    else if (tab === 'raffles') updateRafflesTable();
    else if (tab === 'sales') updateSalesTable();
}


// Notificações Admin (Simulação Visual)
function updateAdminNotificationCount() {
    if (!isAdminAuthenticated) return;

    const pendingSalesCount = db.sales.filter(s => s.status === 'pending_admin_approval' || s.status === 'pending_stripe_confirmation').length;
    const notificationBell = document.getElementById('adminNotificationBell'); 
    const notificationCountSpan = document.getElementById('adminNotificationCount'); 

    if (notificationBell && notificationCountSpan) {
        notificationCountSpan.textContent = pendingSalesCount;
        if (pendingSalesCount > 0) {
            notificationBell.classList.add('has-notifications'); 
            notificationCountSpan.style.display = 'inline-block';
        } else {
            notificationBell.classList.remove('has-notifications');
            notificationCountSpan.style.display = 'none';
        }
    }
    console.log("WebApp RifaMax: Contagem de notificações do admin atualizada:", pendingSalesCount);
}


// Upload de Imagem
function previewImage(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            uploadedImageBase64 = e.target.result;
            document.getElementById('uploadPlaceholder').innerHTML =  
                `<img src="${uploadedImageBase64}" alt="Preview">`;
        };
        reader.readAsDataURL(file);
    }
}

// Criação e Edição de Rifas
function openEditRaffleForm(raffleId) {
    const raffle = db.raffles.find(r => r.id === raffleId);
    if (!raffle) {
        alert('Rifa não encontrada para edição!');
        editingRaffleId = null;
        return;
    }
    console.log("WebApp RifaMax: Abrindo formulário para editar rifa:", raffle);
    editingRaffleId = raffleId; 

    document.getElementById('raffleTitle').value = raffle.title;
    document.getElementById('rafflePrice').value = raffle.price;
    document.getElementById('raffleTotalNumbers').value = raffle.totalNumbers;
    document.getElementById('raffleDescription').value = raffle.description;
    document.getElementById('raffleIcon').value = raffle.icon || '';
    document.getElementById('raffleDrawMethod').value = raffle.drawMethod || '';
    
    const prizeQuotasContainer = document.getElementById('prizeQuotasDynamicInputsContainer');
    prizeQuotasContainer.innerHTML = ''; 
    const activateToggle = document.getElementById('activatePrizeQuotasToggle');
    if (raffle.prizeQuotas && raffle.prizeQuotas.trim() !== '') {
        activateToggle.classList.add('active');
        document.getElementById('prizeQuotasConfigSection').style.display = 'block';
        const entries = raffle.prizeQuotas.split(',');
        entries.forEach(entry => {
            const parts = entry.split(':');
            if (parts.length === 2) {
                addPrizeQuotaInput(parts[0].trim(), parts[1].trim());
            }
        });
    } else {
        activateToggle.classList.remove('active');
        document.getElementById('prizeQuotasConfigSection').style.display = 'none';
    }
    
    uploadedImageBase64 = raffle.image; 
    if (raffle.image) {
        document.getElementById('uploadPlaceholder').innerHTML = 
            `<img src="${raffle.image}" alt="Preview">`;
    } else {
        document.getElementById('uploadPlaceholder').innerHTML = 
            '<i>📸</i><p>Clique para adicionar imagem</p>';
    }

    if (raffle.isHighlight) document.getElementById('highlightToggle').classList.add('active');
    else document.getElementById('highlightToggle').classList.remove('active');

    document.getElementById('adminCreateEditTitle').textContent = `Editando Rifa: ${raffle.title}`;
    document.getElementById('createRaffleSubmitBtnText').textContent = 'Salvar Alterações';
    
    closeModal('adminRaffleDetailModal'); 
    showAdminTab('create'); 
}


function createRaffle(event) {
    event.preventDefault();
    console.log("WebApp RifaMax: createRaffle() iniciada. Modo Edição ID:", editingRaffleId);
    
    const title = document.getElementById('raffleTitle').value;
    const price = parseFloat(document.getElementById('rafflePrice').value);
    const totalNumbers = parseInt(document.getElementById('raffleTotalNumbers').value);
    const description = document.getElementById('raffleDescription').value;
    const icon = document.getElementById('raffleIcon').value || '🎁';
    const isHighlight = document.getElementById('highlightToggle').classList.contains('active');
    const drawMethod = document.getElementById('raffleDrawMethod').value;
    
    let prizeQuotasString = '';
    if (document.getElementById('activatePrizeQuotasToggle').classList.contains('active')) {
        const prizeQuotaInputs = document.querySelectorAll('.prize-quota-input-group');
        const quotasArray = [];
        let invalidQuotaFound = false;
        prizeQuotaInputs.forEach(group => {
            const numberInput = group.querySelector('input[placeholder="Número"]');
            const prizeInput = group.querySelector('input[placeholder="Prêmio"]');
            const number = numberInput ? numberInput.value.trim() : '';
            const prize = prizeInput ? prizeInput.value.trim() : '';

            if (number && prize && !isNaN(parseInt(number)) && parseInt(number) > 0 && parseInt(number) <= totalNumbers) {
                quotasArray.push(`${number}:${prize}`);
            } else if (number || prize) { 
                alert(`Cota premiada inválida: Número "${number}", Prêmio "${prize}". Verifique se o número é válido (maior que 0 e menor ou igual ao total de cotas: ${totalNumbers}) e se ambos os campos estão preenchidos.`);
                invalidQuotaFound = true;
            }
        });
        if (invalidQuotaFound) return; // Interrompe se houver cota inválida
        prizeQuotasString = quotasArray.join(',');
    }


    if (!title || isNaN(price) || price <= 0 || isNaN(totalNumbers) || totalNumbers <= 0 || !description) {
        alert("Por favor, preencha todos os campos obrigatórios corretamente (Título, Preço, Total de Cotas, Descrição).");
        return;
    }

    if (isHighlight) { 
        db.raffles.forEach(r => { 
            if (r.id !== editingRaffleId) { 
                 r.isHighlight = false;
            }
        });
    }

    let raffleBeingProcessedId = null;

    if (editingRaffleId) {
        const raffleIndex = db.raffles.findIndex(r => r.id === editingRaffleId);
        if (raffleIndex > -1) {
            raffleBeingProcessedId = editingRaffleId;
            const existingRaffle = db.raffles[raffleIndex];
            const approvedSoldCount = db.sales.filter(s => s.raffleId === editingRaffleId && s.status === 'approved')
                                            .reduce((sum, s) => sum + s.numbers.length, 0);

            if (totalNumbers < approvedSoldCount) {
                alert(`Não é possível definir o total de cotas (${totalNumbers}) como menor que o número de cotas já vendidas e aprovadas (${approvedSoldCount}).`);
                return;
            }
            db.raffles[raffleIndex] = {
                ...existingRaffle, 
                title, price, totalNumbers, description, icon, 
                image: uploadedImageBase64, isHighlight, drawMethod, prizeQuotas: prizeQuotasString 
            };
            alert('Rifa atualizada com sucesso!');
            console.log("WebApp RifaMax: Rifa atualizada:", db.raffles[raffleIndex]);
        }
    } else { 
        const newRaffle = {
            id: Date.now(), title, price, totalNumbers, soldNumbers: [], description, icon,
            image: uploadedImageBase64, isHighlight, drawMethod: drawMethod || 'A ser definido pelo organizador',
            createdAt: new Date().toISOString(), completedAt: null, winner: null, prizeQuotas: prizeQuotasString 
        };
        db.raffles.push(newRaffle);
        raffleBeingProcessedId = newRaffle.id;
        alert('Rifa criada com sucesso!');
        console.log("WebApp RifaMax: Nova rifa criada:", newRaffle);
    }
    
    saveDB();
    
    const wasEditing = !!editingRaffleId; 
    
    resetCreateRaffleForm(); 
    
    renderRaffles(); 
    updateRafflesTable();
    updateAdminDashboard(); 

    if (wasEditing && raffleBeingProcessedId) {
        const updatedRaffle = db.raffles.find(r => r.id === raffleBeingProcessedId);
        if (updatedRaffle) {
            currentRaffle = updatedRaffle; 
            openAdminRaffleDetailModal(raffleBeingProcessedId);
        } else {
            showAdminTab('raffles');
        }
    } else {
        showAdminTab('raffles'); 
    }
    editingRaffleId = null; 
}

// Renderização de Rifas (Pública)
function renderRaffles() {
    const mainRaffle = db.raffles.find(r => r.isHighlight && !r.completedAt);
    const mainContainer = document.getElementById('mainRaffleContainer');
    if (mainRaffle) {
        const approvedSoldCount = db.sales.filter(s => s.raffleId === mainRaffle.id && s.status === 'approved').reduce((sum, s) => sum + s.numbers.length, 0);
        const percentage = mainRaffle.totalNumbers > 0 ? (approvedSoldCount / mainRaffle.totalNumbers * 100).toFixed(1) : 0;
        const remainingQuotas = mainRaffle.totalNumbers - approvedSoldCount;
        mainContainer.innerHTML = `
            <div class="main-raffle-card">
                <span class="badge">DESTAQUE</span>
                ${mainRaffle.image ? `<img src="${mainRaffle.image}" alt="${mainRaffle.title}" style="width: 100%; height: 300px; object-fit: cover; border-radius: 20px; margin-bottom: 2rem;">` : `<div style="font-size: 6rem; text-align: center; margin: 2rem 0; color: var(--primary);">${mainRaffle.icon}</div>`}
                <h3 style="font-size: 2rem; margin-bottom: 1rem;">${mainRaffle.title}</h3>
                <div style="font-size: 3rem; color: var(--primary); font-weight: 900; margin-bottom: 1rem;">R$ ${mainRaffle.price.toFixed(2).replace('.', ',')}</div>
                <div class="progress-container">
                    <div class="progress-info">
                        <span>Vendidos (Aprovados): ${approvedSoldCount}</span>
                        <span>Restantes: ${remainingQuotas > 0 ? remainingQuotas : 'ESGOTADO'}</span>
                        <span>${percentage}%</span>
                        <span>Total: ${mainRaffle.totalNumbers}</span>
                    </div>
                    <div class="progress-bar"><div class="progress-fill" style="width: ${percentage}%"></div></div>
                </div>
                <button class="btn btn-primary" style="width: 100%; margin-top: 2rem;" onclick="showRaffleDetailsPage(${mainRaffle.id})"><span>Ver Detalhes</span></button>
            </div>`;
    } else {
        mainContainer.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">Nenhuma rifa em destaque no momento.</p>';
    }
    
    const otherRaffles = db.raffles.filter(r => (!r.isHighlight && !r.completedAt) || r.completedAt );
    const grid = document.getElementById('campaignsGrid');
    grid.innerHTML = otherRaffles.sort((a,b) => (a.completedAt ? 1 : -1) - (b.completedAt ? 1 : -1) || new Date(b.createdAt) - new Date(a.createdAt) )
    .map(raffle => {
        const approvedSoldCount = db.sales.filter(s => s.raffleId === raffle.id && s.status === 'approved').reduce((sum, s) => sum + s.numbers.length, 0);
        const percentage = raffle.totalNumbers > 0 ? (approvedSoldCount / raffle.totalNumbers * 100).toFixed(1) : 0;
        const remainingQuotas = raffle.totalNumbers - approvedSoldCount;
        const isCompleted = raffle.completedAt !== null;
        return `
            <div class="campaign-card ${isCompleted ? 'completed' : ''}">
                <div class="campaign-image">${raffle.image ? `<img src="${raffle.image}" alt="${raffle.title}">` : `<div class="default-icon">${raffle.icon}</div>`}</div>
                <h3 style="font-size: 1.3rem; margin-bottom: 1rem;">${raffle.title}</h3>
                <div style="font-size: 1.8rem; color: var(--primary); font-weight: 700; margin-bottom: 1rem;">R$ ${raffle.price.toFixed(2).replace('.', ',')}</div>
                ${isCompleted ? `
                    <div style="text-align: center; padding: 1rem; background: var(--glass-bg); border-radius: 10px; margin-top: 1rem;">
                        <h4 style="color: var(--accent); margin-bottom: 0.5rem;">🏆 Ganhador</h4>
                        <p style="color: var(--text-primary);">${raffle.winner.name}</p>
                        <p style="color: var(--text-secondary); font-size: 0.9rem;">Cota: ${raffle.winner.number.toString().padStart(String(raffle.totalNumbers).length, '0')}</p>
                        <button class="btn" style="width: 100%; margin-top: 1rem; border-color: var(--accent); color:var(--accent);" onclick="showRaffleDetailsPage(${raffle.id})"><span>Ver Sorteio</span></button>
                    </div>` : `
                    <div class="progress-container">
                        <div class="progress-info">
                            <span>${approvedSoldCount}/${raffle.totalNumbers} (Aprov.)</span>
                            <span>Restam: ${remainingQuotas > 0 ? remainingQuotas : 'ESGOTADO'}</span>
                            <span>${percentage}%</span>
                        </div>
                        <div class="progress-bar"><div class="progress-fill" style="width: ${percentage}%"></div></div>
                    </div>
                    <button class="btn btn-primary" style="width: 100%; margin-top: 1rem;" onclick="showRaffleDetailsPage(${raffle.id})"><span>Ver Detalhes</span></button>
                `}
            </div>`;
    }).join('');
}

// Página de Detalhes da Rifa (Pública)
function showRaffleDetailsPage(raffleId) {
    currentRaffle = db.raffles.find(r => r.id === raffleId);
    if (!currentRaffle) { alert('Rifa não encontrada!'); showPage('home'); return; }

    const container = document.getElementById('raffleDetailsContainer');
    const approvedSoldCount = db.sales.filter(s => s.raffleId === currentRaffle.id && s.status === 'approved').reduce((sum, s) => sum + s.numbers.length, 0);
    const percentage = currentRaffle.totalNumbers > 0 ? (approvedSoldCount / currentRaffle.totalNumbers * 100).toFixed(1) : 0;
    const remainingQuotas = currentRaffle.totalNumbers - approvedSoldCount;
    const isCompleted = currentRaffle.completedAt !== null;
    
    let detailsHTML = `
        <section class="cyber-card" style="margin-bottom: 2rem;">
            ${currentRaffle.image ? `<img src="${currentRaffle.image}" alt="${currentRaffle.title}" style="width: 100%; max-height: 450px; object-fit: cover; border-radius: 15px; margin-bottom: 1.5rem;">` : `<div style="font-size: 8rem; text-align: center; margin: 2rem 0; color: var(--primary);">${currentRaffle.icon}</div>`}
            <h2 style="font-size: 2.2rem; color: var(--primary); margin-bottom: 1rem; text-align:center;">${currentRaffle.title}</h2>
            <p style="color: var(--text-secondary); margin-bottom: 1.5rem; line-height: 1.7; text-align:justify;">${currentRaffle.description.replace(/\n/g, '<br>')}</p>
            ${currentRaffle.drawMethod ? `<p style="color: var(--text-muted); font-style: italic; margin-bottom: 1.5rem; background: var(--bg-tertiary); padding: 0.8rem; border-radius: 8px;"><strong>Sorteio por:</strong> ${currentRaffle.drawMethod}</p>` : ''}
            <div style="font-size: 1.8rem; color: var(--primary); font-weight: 700; margin: 1.5rem 0; text-align:center;">R$ ${currentRaffle.price.toFixed(2).replace('.', ',')} por cota</div>`;
    if (isCompleted) {
        detailsHTML += `
            <div style="text-align: center; padding: 2rem; background: var(--glass-bg); border-radius: 10px; border: 1px solid var(--accent);">
                <h3 style="color: var(--accent); margin-bottom: 1rem; font-size: 1.8rem;">🎉 RIFA FINALIZADA 🎉</h3>
                <p style="color: var(--text-primary); font-size: 1.2rem; margin-bottom: 0.5rem;"><strong>Ganhador:</strong> ${currentRaffle.winner.name}</p>
                <p style="color: var(--text-secondary); font-size: 1.1rem;"><strong>Cota Sorteada:</strong> <span class="ticket-number">${currentRaffle.winner.number.toString().padStart(String(currentRaffle.totalNumbers).length, '0')}</span></p>
                <p style="color: var(--text-muted); font-size: 0.9rem; margin-top:1rem;">Sorteio realizado em: ${new Date(currentRaffle.completedAt).toLocaleDateString('pt-BR')}</p>
            </div>`;
    } else {
        detailsHTML += `
            <div class="progress-container" style="margin-bottom: 2rem;">
                <div class="progress-info">
                    <span>Vendidos (Aprovados): ${approvedSoldCount}</span>
                    <span>Restantes: ${remainingQuotas > 0 ? remainingQuotas : 'ESGOTADO'}</span>
                    <span>${percentage}%</span>
                    <span>Total: ${currentRaffle.totalNumbers}</span>
                </div>
                <div class="progress-bar"><div class="progress-fill" style="width: ${percentage}%"></div></div>
            </div>
            <button class="btn btn-primary" style="width: 100%; font-size: 1.2rem; padding: 1rem;" onclick="openPurchaseModal(${currentRaffle.id})"><span>🛒 Comprar Cotas</span></button>`;
    }
    detailsHTML += `</section>`;
    
    detailsHTML += `
        <section class="cyber-card ranking-container" style="margin-top: 2rem; margin-bottom: 2rem;">
            <h3>🏆 Ranking de Compradores</h3>
            <div id="rankingDetailsContainer">${renderRaffleRanking(currentRaffle.id)}</div>
        </section>
        <section class="cyber-card prize-quotas-container">
            <h3>🏅 Cotas Premiadas</h3>
            <div id="prizeQuotasDetailsContainer">${renderPrizeQuotas(currentRaffle.id)}</div>
        </section>`;
    
    container.innerHTML = detailsHTML;
    showPage('raffle-details-page');
}

// Funções de Compra
function openPurchaseModal(raffleId) {
    if (!currentUser) { 
        alert('Você precisa fazer login ou se identificar primeiro!'); 
        openLoginModal(); 
        return; 
    }
    currentRaffle = db.raffles.find(r => r.id === raffleId); 
    if (!currentRaffle || currentRaffle.completedAt) { 
        alert('Esta rifa não está disponível ou já foi finalizada.'); 
        return; 
    }
    
    document.getElementById('purchaseTitle').textContent = `Comprar Cotas: ${currentRaffle.title}`;
    let descriptionHtml = currentRaffle.description.replace(/\n/g, '<br>');
    if (currentRaffle.drawMethod) {
        descriptionHtml += `<br><br><p style="margin-top:10px; padding:10px; background-color:var(--bg-tertiary); border-left: 3px solid var(--primary-dark); border-radius:4px;"><strong>Sorteio por:</strong> ${currentRaffle.drawMethod}</p>`;
    }
    document.getElementById('raffleDescriptionModal').innerHTML = descriptionHtml;
    
    document.getElementById('emailStep').style.display = 'none';
    document.getElementById('paymentSelectionStep').style.display = 'block'; 
    document.getElementById('paymentDetails').style.display = 'none';
    document.getElementById('paymentDetails').innerHTML = '';
    const emailInput = document.getElementById('purchaseUserEmail');
    if (emailInput) emailInput.value = currentUser?.email || ''; 
    
    selectedQuantity = 1;
    updatePurchaseDisplay(); 
    document.querySelectorAll('.payment-method').forEach(m => m.classList.remove('selected'));
    currentSelectedPaymentMethod = null; 
    document.getElementById('purchaseModal').classList.add('active');
}

function selectPayment(method) { // 'stripe'
    currentSelectedPaymentMethod = method; 
    const emailStep = document.getElementById('emailStep');
    const paymentSelectionStep = document.getElementById('paymentSelectionStep');
    const paymentDetailsDiv = document.getElementById('paymentDetails');
    const emailInput = document.getElementById('purchaseUserEmail');

    paymentSelectionStep.style.display = 'none';
    paymentDetailsDiv.style.display = 'none';
    paymentDetailsDiv.innerHTML = '';
    document.querySelectorAll('.payment-method').forEach(m => m.classList.remove('selected')); 

    if (currentUser && !currentUser.email) { 
        emailStep.style.display = 'block';
        if(emailInput) {
            emailInput.value = ''; 
            emailInput.required = true;
        }
    } else if (currentUser && currentUser.email) { 
        emailStep.style.display = 'block';
        if(emailInput) {
            emailInput.value = currentUser.email;
            emailInput.required = true; 
        }
    } else { 
        closeModal('purchaseModal');
        openLoginModal();
        return;
    }
}

function handlePurchaseEmailSubmit(event) {
    event.preventDefault();
    const emailInput = document.getElementById('purchaseUserEmail');
    const userEmail = emailInput.value;

    if (!validateEmail(userEmail)) {
        alert("Por favor, insira um email válido.");
        return;
    }

    if (currentUser) {
        currentUser.email = userEmail;
        localStorage.setItem('rifamaxCurrentUser', JSON.stringify(currentUser));
        const userInDb = db.users.find(u => u.phone === currentUser.phone);
        if (userInDb) {
            userInDb.email = userEmail;
        } else { 
             db.users.push({phone: currentUser.phone, name: currentUser.name, email: userEmail, createdAt: new Date().toISOString()});
        }
        saveDB();
    }

    document.getElementById('emailStep').style.display = 'none';
    showPaymentDetails(currentSelectedPaymentMethod); 
}

function showPaymentDetails(method) { // 'stripe'
    const paymentDetailsDiv = document.getElementById('paymentDetails');
    paymentDetailsDiv.style.display = 'block'; 

    const paymentMethodButtons = document.querySelectorAll('.payment-method');
    paymentMethodButtons.forEach(btn => {
        const buttonText = btn.textContent || btn.innerText;
        if (buttonText.trim().toLowerCase().includes(method)) {
            btn.classList.add('selected');
        }
    });

    if (method === 'stripe') {
        paymentDetailsDiv.innerHTML = `
            <div class="stripe-payment-container" style="text-align:center;">
                <p style="color:var(--text-secondary); margin-bottom:1.5rem;">Você será redirecionado para o Stripe para concluir o pagamento de forma segura.</p>
                <button id="stripe-checkout-button" class="btn btn-primary" style="width: 100%;"><span>Pagar com Stripe</span></button>
            </div>`;
        document.getElementById('stripe-checkout-button').addEventListener('click', redirectToStripeCheckout);
    } else {
        paymentDetailsDiv.innerHTML = `<p style="color:var(--danger);">Método de pagamento desconhecido.</p>`;
    }
}

async function redirectToStripeCheckout() {
    if (!currentRaffle || !currentUser || selectedQuantity <= 0) {
        alert("Erro: Dados da rifa ou do usuário ausentes.");
        return;
    }
    if (!currentUser.email) {
        alert("Por favor, forneça seu email para prosseguir com o pagamento.");
        return;
    }

    let finalPricePerTicket = currentRaffle.price;
    const activePromos = db.promotions.filter(p => p.raffleId === currentRaffle.id && p.isActive);
    let bestPromoPrice = currentRaffle.price;
    for (const promo of activePromos) { 
        let currentPromoPricePerTicket = currentRaffle.price;
        if (promo.type === 'discount_quantity_threshold' && selectedQuantity >= promo.details.minQuantity) {
            currentPromoPricePerTicket = promo.details.discountedPrice;
        } else if (promo.type === 'fixed_price_pack' && selectedQuantity > 0 && selectedQuantity % promo.details.packQuantity === 0) {
            const numberOfPacks = selectedQuantity / promo.details.packQuantity;
            currentPromoPricePerTicket = (numberOfPacks * promo.details.packPrice) / selectedQuantity;
        }
        if (currentPromoPricePerTicket < bestPromoPrice) {
            bestPromoPrice = currentPromoPricePerTicket;
        }
    }
    finalPricePerTicket = bestPromoPrice;
    // const totalAmount = selectedQuantity * finalPricePerTicket; // O backend calculará o total final

    const saleId = `sale_${Date.now()}_${currentUser.phone.slice(-4)}`;

    const itemsForStripe = [{
        name: `Cotas Rifa: ${currentRaffle.title}`, // Nome do produto/serviço
        unit_amount: finalPricePerTicket, // Preço unitário em BRL (o backend converterá para centavos)
        currency: 'brl',
        quantity: selectedQuantity
    }];
    
    // Salva uma pré-venda no localStorage para rastreamento no frontend
    // O status final será atualizado pelo webhook no backend
    const pendingSale = {
        id: saleId, 
        raffleId: currentRaffle.id,
        userId: currentUser.phone,
        userName: currentUser.name,
        userEmail: currentUser.email,
        numbers: [], 
        amount: selectedQuantity * finalPricePerTicket, // Salva o valor calculado no frontend para referência
        paymentMethod: 'stripe',
        date: new Date().toISOString(),
        status: 'pending_stripe_checkout' // Status inicial antes de ir para o Stripe
    };
    db.sales.push(pendingSale);
    saveDB();
    updateAdminNotificationCount();


    try {
        const response = await fetch(`${BACKEND_URL}/api/criar-sessao-checkout-stripe`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                saleId: saleId, 
                items: itemsForStripe, // Envia os itens formatados para o backend
                payerEmail: currentUser.email,
                success_url_param: `${window.location.origin}${window.location.pathname}?stripe_payment=success&sale_id=${saleId}`,
                cancel_url_param: `${window.location.origin}${window.location.pathname}?stripe_payment=cancel&sale_id=${saleId}`,
            }),
        });

        const sessionData = await response.json();

        if (response.ok && sessionData.sessionId) {
            const { error } = await stripe.redirectToCheckout({
                sessionId: sessionData.sessionId,
            });
            if (error) {
                alert(`Erro ao redirecionar para o Stripe: ${error.message}`);
                const saleIndex = db.sales.findIndex(s => s.id === saleId);
                if (saleIndex > -1) {
                    db.sales[saleIndex].status = 'stripe_redirect_failed';
                    saveDB();
                }
            }
        } else {
            alert(`Erro ao criar sessão de pagamento: ${sessionData.error || 'Erro desconhecido do servidor.'}`);
        }
    } catch (error) {
        console.error('Erro na chamada para criar sessão Stripe:', error);
        alert('Não foi possível iniciar o processo de pagamento. Tente novamente.');
    }
}


function checkStripeSessionStatus() {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('stripe_payment');
    const saleId = urlParams.get('sale_id'); 

    if (paymentStatus === 'success' && saleId) {
        console.log(`Retorno do Stripe: Sucesso! Sale ID: ${saleId}`);
        alert("Pagamento processado com sucesso pelo Stripe! Aguarde a confirmação final e a liberação das suas cotas via email.");
        
        // Atualiza o status da venda no localStorage para aguardar confirmação do webhook
        const saleIndex = db.sales.findIndex(s => s.id === saleId && s.status === 'pending_stripe_checkout');
        if (saleIndex > -1) {
            db.sales[saleIndex].status = 'pending_webhook_confirmation'; // Novo status
            saveDB();
        }
        
        history.replaceState(null, '', window.location.pathname);
        showPage('my-tickets'); 
    } else if (paymentStatus === 'cancel' && saleId) {
        console.log(`Retorno do Stripe: Pagamento cancelado. Sale ID: ${saleId}`);
        alert("O pagamento foi cancelado.");
        const saleIndex = db.sales.findIndex(s => s.id === saleId && s.status === 'pending_stripe_checkout');
        if (saleIndex > -1) {
            db.sales[saleIndex].status = 'stripe_checkout_canceled';
            saveDB();
        }
        history.replaceState(null, '', window.location.pathname);
        showPage('home');
    }
}


function setQuantity(qty) {
    if (!currentRaffle || currentRaffle.completedAt) return;
    selectedQuantity = qty;
    updatePurchaseDisplay();
}
function increaseQuantity() {
    if (!currentRaffle || currentRaffle.completedAt) return;
    selectedQuantity++;
    updatePurchaseDisplay();
}
function decreaseQuantity() {
    if (!currentRaffle || currentRaffle.completedAt) return;
    if (selectedQuantity > 1) { selectedQuantity--; updatePurchaseDisplay(); }
}

function updatePurchaseDisplay() {
    if (!currentRaffle) return;
    document.getElementById('quantityDisplay').textContent = selectedQuantity;
    let finalPricePerTicket = currentRaffle.price;
    let promotionAppliedTitle = null;
    const activePromos = db.promotions.filter(p => p.raffleId === currentRaffle.id && p.isActive);
    
    let bestPromoPrice = currentRaffle.price;

    for (const promo of activePromos) { 
        let currentPromoPricePerTicket = currentRaffle.price;
        if (promo.type === 'discount_quantity_threshold' && selectedQuantity >= promo.details.minQuantity) {
            currentPromoPricePerTicket = promo.details.discountedPrice;
        } else if (promo.type === 'fixed_price_pack' && selectedQuantity > 0 && selectedQuantity % promo.details.packQuantity === 0) {
            const numberOfPacks = selectedQuantity / promo.details.packQuantity;
            currentPromoPricePerTicket = (numberOfPacks * promo.details.packPrice) / selectedQuantity;
        }

        if (currentPromoPricePerTicket < bestPromoPrice) {
            bestPromoPrice = currentPromoPricePerTicket;
            promotionAppliedTitle = promo.title;
        }
    }
    finalPricePerTicket = bestPromoPrice;

    const total = selectedQuantity * finalPricePerTicket;
    document.getElementById('totalPrice').textContent = `R$ ${total.toFixed(2).replace('.', ',')}`;
    const promoInfoDiv = document.getElementById('purchasePromoInfo');
    if (promoInfoDiv) {
        if (promotionAppliedTitle) {
            promoInfoDiv.innerHTML = `<p style="color: var(--success); text-align: center; margin-bottom: 1rem;">🎉 Promoção aplicada: ${promotionAppliedTitle}! (R$ ${finalPricePerTicket.toFixed(2).replace('.',',')} por cota)</p>`;
            promoInfoDiv.style.display = 'block';
        } else {
            promoInfoDiv.innerHTML = '';
            promoInfoDiv.style.display = 'none';
        }
    }
}


function simulatePayment() { 
    alert("Esta opção é para simulação de PIX manual. Para pagamentos reais, use o checkout do Stripe.");
}
function processCardPayment(event) { 
    event.preventDefault();
    alert("Para pagamento com cartão, você será redirecionado para o Stripe.");
}


function completeFrontendSaleAfterWebhook(saleId, purchasedNumbersAssignedByBackend) {
    const saleIndex = db.sales.findIndex(s => s.id === saleId);
    if (saleIndex > -1) {
        // Idealmente, o backend já teria atualizado o status para algo como 'approved_by_stripe'
        // e agora estamos apenas refletindo isso e os números no frontend.
        db.sales[saleIndex].numbers = purchasedNumbersAssignedByBackend; 
        db.sales[saleIndex].status = 'approved'; // Status final no frontend

        const raffle = db.raffles.find(r => r.id === db.sales[saleIndex].raffleId);
        if (raffle) {
            purchasedNumbersAssignedByBackend.forEach(num => {
                if (!raffle.soldNumbers.includes(num)) {
                    raffle.soldNumbers.push(num);
                }
            });
            raffle.soldNumbers.sort((a,b) => a-b);
        }
        saveDB();
        updateAdminNotificationCount(); 
        closeModal('purchaseModal'); 
        
        currentRaffle = raffle; 
        showSuccess(purchasedNumbersAssignedByBackend); // Mostra o modal de sucesso com os números
        renderRaffles(); 
        updateRafflesTable(); 
        updateSalesTable(); // Atualiza a tabela de vendas do admin
    } else {
        console.warn(`completeFrontendSaleAfterWebhook: Venda ID ${saleId} não encontrada no localStorage para atualização final.`);
    }
}


function completeRaffle(raffle, manualWinnerNumber = null, forceFinalizeNoWinner = false) { 
    if (raffle.completedAt) { alert("Esta rifa já foi finalizada."); return; }
    
    if (forceFinalizeNoWinner) {
        raffle.completedAt = new Date().toISOString();
        raffle.winner = { name: "N/A (Finalizada sem vendas)", number: "N/A", phone: "N/A" };
        saveDB();
        alert(`Rifa "${raffle.title}" finalizada sem ganhador.`);
        renderRaffles();
        updateRafflesTable();
        if (document.getElementById('adminRaffleDetailModal').classList.contains('active') && currentRaffle && currentRaffle.id === raffle.id) {
            openAdminRaffleDetailModal(raffle.id);
        }
        return;
    }
    
    const approvedSalesForRaffle = db.sales.filter(s => s.raffleId === raffle.id && s.status === 'approved');
    
    let winnerNumber;
    let winnerSale = null;

    if (manualWinnerNumber !== null) {
        winnerNumber = parseInt(manualWinnerNumber);
        if (isNaN(winnerNumber) || winnerNumber <= 0 || winnerNumber > raffle.totalNumbers) {
            alert("Número da cota ganhadora inválido.");
            return;
        }
        for(const sale of approvedSalesForRaffle) {
            if(sale.numbers.includes(winnerNumber)) {
                winnerSale = sale;
                break;
            }
        }
        if (!winnerSale) {
            alert(`A cota ${winnerNumber} não foi encontrada entre as vendas aprovadas ou não foi vendida.`);
            return;
        }
    } else { 
        const allApprovedSoldNumbers = [];
        approvedSalesForRaffle.forEach(sale => allApprovedSoldNumbers.push(...sale.numbers));
        if (allApprovedSoldNumbers.length === 0) {
            alert("Nenhuma cota aprovada para sortear automaticamente. Se deseja finalizar, defina um ganhador manualmente ou aprove vendas.");
            return;
        }
        const winnerNumberIndex = Math.floor(Math.random() * allApprovedSoldNumbers.length);
        winnerNumber = allApprovedSoldNumbers[winnerNumberIndex];
        for(const sale of approvedSalesForRaffle) { 
            if(sale.numbers.includes(winnerNumber)) { winnerSale = sale; break; }
        }
    }
    
    if (!winnerSale && manualWinnerNumber === null) { 
        alert("Erro crítico: Não foi possível determinar os dados do ganhador no sorteio automático."); 
        return;
    }
    
    raffle.completedAt = new Date().toISOString();
    raffle.winner = { 
        number: winnerNumber, 
        name: winnerSale ? winnerSale.userName : "Ganhador Manual (Dados não encontrados na venda)", 
        phone: winnerSale ? winnerSale.userId : "N/A"
    };
    saveDB();
    alert(`Rifa "${raffle.title}" finalizada! Ganhador: ${raffle.winner.name}, Cota: ${raffle.winner.number}`);
    renderRaffles();
    updateRafflesTable();
    if (document.getElementById('adminRaffleDetailModal').classList.contains('active') && currentRaffle && currentRaffle.id === raffle.id) {
        openAdminRaffleDetailModal(raffle.id); 
    }
}

function showSuccess(numbers) {
    closeModal('purchaseModal');
    const numbersHtml = numbers.map(n => `<span class="ticket-number">${n.toString().padStart(String(currentRaffle?.totalNumbers || 0).length, '0')}</span>`).join('');
    const successNumbersDiv = document.getElementById('successNumbers');
    const successNumbersContainer = document.getElementById('successNumbersContainer');

    if (numbers && numbers.length > 0) {
        successNumbersDiv.innerHTML = numbersHtml;
        successNumbersContainer.style.display = 'block';
    } else {
        successNumbersContainer.style.display = 'none'; // Oculta se não houver números (ex: antes do webhook)
    }
    document.getElementById('successModal').classList.add('active');
}

// Minhas Cotas
function searchTickets() {
    const countryCode = document.getElementById('countryCode').value;
    const phone = document.getElementById('phoneSearch').value;
    if (!validatePhone(countryCode, phone)) { alert('Número de telefone inválido!'); return; }
    const fullPhone = countryCode + phone.replace(/\D/g, '');
    const userSales = db.sales.filter(s => s.userId === fullPhone && s.status === 'approved'); 
    const resultsDiv = document.getElementById('searchResults');
    resultsDiv.style.display = 'block';
    if (userSales.length === 0) {
        resultsDiv.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">Nenhuma cota (aprovada) encontrada.</p>';
        return;
    }
    resultsDiv.innerHTML = userSales.map(sale => {
        const raffle = db.raffles.find(r => r.id === sale.raffleId);
        if (!raffle) return '';
        return `
            <div class="ticket-card">
                <div>
                    <h4 style="color: var(--primary); margin-bottom: 0.5rem;">${raffle.title}</h4>
                    <p style="color: var(--text-secondary); font-size: 0.9rem;">Comprado em: ${new Date(sale.date).toLocaleDateString('pt-BR')}</p>
                </div>
                <div class="ticket-numbers">${sale.numbers.map(n => `<span class="ticket-number">${n.toString().padStart(String(raffle.totalNumbers).length, '0')}</span>`).join('')}</div>
            </div>`;
    }).join('');
}

// Funções do Dashboard Admin
function updateAdminDashboard() {
    console.log("WebApp RifaMax: updateAdminDashboard() chamada.");
    let totalRevenue = 0; let totalTicketsSold = 0; const activeUsers = new Set(); let activeRafflesCount = 0;
    db.sales.forEach(sale => {
        if (sale.status === 'approved' || sale.status === 'approved_by_stripe') { // Considera ambos os status de aprovação
            totalRevenue += sale.amount;
            totalTicketsSold += sale.numbers.length;
            activeUsers.add(sale.userId);
        }
    });
    db.raffles.forEach(raffle => { if (!raffle.completedAt) activeRafflesCount++; });
    
    document.getElementById('totalRevenue').textContent = `R$ ${totalRevenue.toFixed(2).replace('.', ',')}`;
    document.getElementById('totalTickets').textContent = totalTicketsSold.toLocaleString();
    document.getElementById('activeUsers').textContent = activeUsers.size;
    document.getElementById('activeRaffles').textContent = activeRafflesCount;

    populateDashboardRaffleSelect();
    renderActiveRafflesProgressChart();
    renderSalesLast7DaysChart();
    updateAdminNotificationCount(); 
}

function populateDashboardRaffleSelect() {
    const selectElement = document.getElementById('dashboardRaffleSelect');
    if (!selectElement) return;
    selectElement.innerHTML = '<option value="">-- Escolha uma rifa --</option>';
    db.raffles.forEach(raffle => {
        const option = document.createElement('option');
        option.value = raffle.id;
        option.textContent = `${raffle.icon || ''} ${raffle.title} (${raffle.completedAt ? 'Finalizada' : 'Ativa'})`;
        selectElement.appendChild(option);
    });
}

function handleDashboardRaffleSelectChange(selectElement) {
    const raffleId = parseInt(selectElement.value);
    const quickStatsDiv = document.getElementById('dashboardRaffleQuickStats');
    quickStatsDiv.innerHTML = '';
    if (raffleId) {
        const selectedRaffle = db.raffles.find(r => r.id === raffleId);
        if (selectedRaffle) {
            const approvedSoldCount = db.sales.filter(s => s.raffleId === selectedRaffle.id && (s.status === 'approved' || s.status === 'approved_by_stripe')).reduce((sum, s) => sum + s.numbers.length, 0);
            const percentage = selectedRaffle.totalNumbers > 0 ? (approvedSoldCount / selectedRaffle.totalNumbers * 100).toFixed(1) : 0;
            quickStatsDiv.innerHTML = `
                <p style="color:var(--text-secondary); font-size:0.9rem;"><strong>${selectedRaffle.title}</strong>: ${approvedSoldCount} / ${selectedRaffle.totalNumbers} cotas aprovadas (${percentage}%).</p>
                <button class="btn btn-primary" style="margin-top:1rem;" onclick="openAdminRaffleDetailModal(${raffleId})"><span>Ver Detalhes Completos & Vendas</span></button>`;
        }
    }
}

// Tabelas do Admin
function updateRafflesTable() {
    const tbody = document.getElementById('rafflesTableBody');
    if (!tbody) return;
    tbody.innerHTML = db.raffles.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).map(raffle => {
        const approvedSoldCount = db.sales.filter(s => s.raffleId === raffle.id && (s.status === 'approved' || s.status === 'approved_by_stripe')).reduce((sum, s) => sum + s.numbers.length, 0);
        const percentage = raffle.totalNumbers > 0 ? (approvedSoldCount / raffle.totalNumbers * 100).toFixed(1) : 0;
        const status = raffle.completedAt ? 'completed' : 'active';
        const statusText = raffle.completedAt ? `Finalizada (${new Date(raffle.completedAt).toLocaleDateString('pt-BR')})` : `Ativa (${percentage}% aprov.)`;
        return `
            <tr>
                <td>${raffle.id}</td>
                <td>${raffle.icon} ${raffle.title}</td>
                <td>R$ ${raffle.price.toFixed(2).replace('.', ',')}</td>
                <td>${approvedSoldCount}</td>
                <td>${raffle.totalNumbers}</td>
                <td><span class="status-badge status-${status}">${statusText}</span></td>
                <td>
                    <button class="action-btn" onclick="openAdminRaffleDetailModal(${raffle.id})">Detalhes</button>
                    <button class="action-btn" style="border-color:var(--warning); color:var(--warning);" onclick="openEditRaffleForm(${raffle.id})">Editar</button>
                    ${!raffle.completedAt ? `<button class="action-btn" style="border-color:var(--success); color:var(--success);" onclick="adminCompleteRafflePrompt(${raffle.id})">Finalizar</button>` : ''}
                    <button class="action-btn" style="border-color:var(--danger); color:var(--danger);" onclick="deleteRaffle(${raffle.id})">Excluir</button>
                </td>
            </tr>`;
    }).join('');
}

function adminCompleteRafflePrompt(raffleId) {
    const raffle = db.raffles.find(r => r.id === raffleId);
    if (!raffle) return;
    
    const approvedSalesForRaffle = db.sales.filter(s => s.raffleId === raffle.id && (s.status === 'approved' || s.status === 'approved_by_stripe'));
    if (approvedSalesForRaffle.length === 0 && !raffle.completedAt) { 
        if (!confirm(`Atenção: Nenhuma cota aprovada foi vendida para esta rifa. Deseja mesmo assim marcar como finalizada (sem ganhador)?`)) {
            return;
        }
        completeRaffle(raffle, null, true); 
        return;
    }

    const choice = prompt(`Finalizar Rifa "${raffle.title}":\n1. Sortear ganhador automaticamente\n2. Definir ganhador manually\nDigite 1 ou 2 (ou cancele):`);
    if (choice === '1') {
        completeRaffle(raffle); 
    } else if (choice === '2') {
        const winnerNumberInput = prompt(`Digite o número da cota ganhadora para a rifa "${raffle.title}":`);
        if (winnerNumberInput !== null && winnerNumberInput.trim() !== "") {
            const manualWinnerNumber = parseInt(winnerNumberInput.trim());
            if (!isNaN(manualWinnerNumber) && manualWinnerNumber > 0) {
                completeRaffle(raffle, manualWinnerNumber);
            } else {
                alert("Número da cota inválido. A finalização foi cancelada.");
            }
        } else if (winnerNumberInput !== null) { 
            alert("Nenhum número de cota inserido. Finalização cancelada.");
        } else { 
            alert("Finalização cancelada.");
        }
    } else if (choice !== null) { 
        alert("Opção inválida. Finalização cancelada.");
    }
}


function deleteRaffle(raffleId) {
    if (confirm(`Tem certeza que deseja excluir a rifa ID ${raffleId}? Esta ação não pode ser desfeita e também removerá as vendas e promoções associadas.`)) {
        db.raffles = db.raffles.filter(r => r.id !== raffleId);
        db.sales = db.sales.filter(s => s.raffleId !== raffleId);
        db.promotions = db.promotions.filter(p => p.raffleId !== raffleId);
        saveDB();
        renderRaffles();
        updateRafflesTable();
        updateAdminDashboard(); 
        alert('Rifa excluída com sucesso.');
    }
}

function formatAdminSalesNumbers(numbers, totalRaffleNumbers) {
    const count = numbers.length;
    if (count === 0) return "0 cotas";
    return `${count} cotas`;
}

function showAllSaleTicketsModal(saleId) {
    const sale = db.sales.find(s => s.id === saleId);
    const raffle = db.raffles.find(r => r.id === sale.raffleId);
    if (!sale || !raffle) {
        alert("Venda ou rifa não encontrada.");
        return;
    }

    const modalTitle = document.getElementById('viewAllTicketsTitle');
    const modalContent = document.getElementById('viewAllTicketsContent');
    
    modalTitle.textContent = `Cotas da Venda #${sale.id} (Rifa: ${raffle.title})`;
    if (sale.numbers && sale.numbers.length > 0) {
        modalContent.innerHTML = sale.numbers.map(n => 
            `<span class="ticket-number">${n.toString().padStart(String(raffle.totalNumbers).length, '0')}</span>`
        ).join('');
    } else {
        modalContent.innerHTML = '<p style="color:var(--text-secondary)">Nenhuma cota atribuída ainda (aguardando confirmação de pagamento).</p>';
    }

    document.getElementById('viewAllTicketsModal').classList.add('active');
}


function updateSalesTable() { 
    const tbody = document.getElementById('salesTableBody');
    if(!tbody) return;
    const salesToDisplay = db.sales.slice().reverse(); 
    tbody.innerHTML = salesToDisplay.map(sale => {
        const raffle = db.raffles.find(r => r.id === sale.raffleId);
        let statusClass = 'pending'; 
        let statusText = sale.status; 
        let emailButtonHtml = '';
        let manualActionHtml = '';

        if (sale.status === 'approved' || sale.status === 'approved_by_stripe') { 
            statusClass = 'active'; 
            statusText = 'Aprovado'; 
            emailButtonHtml = `<button class="action-btn" style="font-size:0.7rem; padding:0.2rem 0.5rem; margin-top: 5px; border-color:var(--accent); color:var(--accent);" onclick="sendPurchaseConfirmationEmail(${sale.id})">Enviar Email (Sim.)</button>`;
            manualActionHtml = `<button class="action-btn" style="border-color:var(--danger); color:var(--danger);" onclick="rejectSale(${sale.id}, ${sale.raffleId})">Rejeitar Manual</button>`;
        } else if (sale.status === 'pending_admin_approval') { // Este status pode ser usado se o webhook falhar ou para pagamentos manuais
            statusClass = 'pending';
            statusText = 'Pendente Aprovação';
            manualActionHtml = `
                <button class="action-btn" style="border-color:var(--success); color:var(--success);" onclick="approveSale(${sale.id}, ${sale.raffleId})">Aprovar</button>
                <button class="action-btn" style="border-color:var(--danger); color:var(--danger);" onclick="rejectSale(${sale.id}, ${sale.raffleId})">Rejeitar</button>`;
        } else if (sale.status === 'rejected' || sale.status.includes('failed') || sale.status.includes('canceled')) { 
            statusClass = 'danger'; 
            statusText = sale.status.replace('stripe_checkout_canceled', 'Cancelado Stripe').replace('stripe_redirect_failed', 'Falha Stripe'); 
            manualActionHtml = `<button class="action-btn" onclick="approveSale(${sale.id}, ${sale.raffleId})">Aprovar Manual</button>`;
        } else if (sale.status.includes('pending')) {
            statusClass = 'warning';
            statusText = 'Pendente Gateway';
        }
        
        const numbersDisplay = formatAdminSalesNumbers(sale.numbers, raffle?.totalNumbers || 0);

        return `
            <tr>
                <td>${new Date(sale.date).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'})}</td>
                <td>${sale.userName}<br><small>${sale.userId}</small><br><small>${sale.userEmail || 'Email não informado'}</small></td>
                <td>${raffle ? raffle.title : 'Rifa Deletada'}</td>
                <td>${numbersDisplay} 
                    ${sale.numbers && sale.numbers.length > 0 ? 
                        `<button class="action-btn" style="font-size:0.7rem; padding:0.2rem 0.5rem;" onclick="showAllSaleTicketsModal(${sale.id})">Ver Todas</button>`
                        : ''
                    }
                </td>
                <td>R$ ${sale.amount.toFixed(2).replace('.', ',')}</td>
                <td><span class="status-badge status-${statusClass}">${statusText}</span></td>
                <td>
                    ${manualActionHtml}
                    ${emailButtonHtml || (manualActionHtml ? '' : '-')} 
                </td>
            </tr>`;
    }).join('');
}

function promptChangeSaleStatus(saleId, currentStatus) { 
    // Esta função pode se tornar menos relevante se a maior parte da lógica de status
    // for tratada pelos webhooks do Stripe. Mantida para flexibilidade.
    const sale = db.sales.find(s => s.id === saleId);
    if (!sale) return;
    const raffle = db.raffles.find(r => r.id === sale.raffleId);
    if (!raffle) { alert("Rifa associada não encontrada!"); return; }

    if (currentStatus === 'pending_admin_approval') { 
        if (confirm(`Aprovar venda para "${sale.userName}" (Rifa: ${raffle.title})?`)) approveSale(saleId, sale.raffleId);
        else if (confirm(`REJEITAR venda para "${sale.userName}" (Rifa: ${raffle.title})?`)) rejectSale(saleId, sale.raffleId);
    } else if (currentStatus === 'rejected' || currentStatus.includes('failed') || currentStatus.includes('canceled')) {
        if (confirm(`Tentar RE-APROVAR manualmente a venda para "${sale.userName}" (Rifa: ${raffle.title})? Isso não reprocessa o pagamento.`)) approveSale(saleId, sale.raffleId);
    } else if (currentStatus === 'approved' || currentStatus === 'approved_by_stripe') {
        if (confirm(`Esta venda já está APROVADA. Deseja REJEITÁ-LA manualmente para "${sale.userName}" (Rifa: ${raffle.title})? Cotas serão devolvidas.`)) rejectSale(saleId, sale.raffleId);
    } else {
        alert(`Status atual: ${currentStatus}. Ação manual não definida para este status.`);
    }
    updateAdminNotificationCount(); 
}


function sendPurchaseConfirmationEmail(saleId) { 
    const saleDetails = db.sales.find(s => s.id === saleId);
    if (!saleDetails) {
        alert("Detalhes da venda não encontrados para enviar email.");
        return;
    }
    if (!saleDetails.userEmail) {
        alert("Email do usuário não disponível para esta venda. Não é possível enviar a confirmação.");
        console.warn("WebApp RifaMax: Email do usuário não disponível para a venda ID:", saleDetails.id, ". Não é possível simular o envio de email.");
        return;
    }
    const raffle = db.raffles.find(r => r.id === saleDetails.raffleId);
    const subject = `Confirmação da sua compra na Rifa: ${raffle ? raffle.title : 'ID ' + saleDetails.raffleId}`;
    const body = `
Olá ${saleDetails.userName},

Sua compra de ${saleDetails.numbers.length} cota(s) para a rifa "${raffle ? raffle.title : 'ID ' + saleDetails.raffleId}" foi APROVADA!

Seus números da sorte são: ${saleDetails.numbers.join(', ')}

Valor total: R$ ${saleDetails.amount.toFixed(2).replace('.', ',')}
Data da compra: ${new Date(saleDetails.date).toLocaleString('pt-BR')}

Obrigado por participar e boa sorte!

Atenciosamente,
Equipe RifaMax
    `;
    console.log("===========================================");
    console.log("SIMULAÇÃO DE ENVIO DE EMAIL:");
    console.log("Para:", saleDetails.userEmail);
    console.log("Assunto:", subject);
    console.log("Corpo:", body);
    console.log("===========================================");
    alert(`Simulação: Email de confirmação enviado para ${saleDetails.userEmail} para a venda ID ${saleDetails.id}. Verifique o console para detalhes.`);
    console.warn("NOTA: Este é um log de simulação. Para enviar emails reais, é necessário integrar um serviço de backend com um provedor de email (ex: SendGrid, Mailgun, Nodemailer).");
}

// Modal de Detalhes da Rifa no Admin
function openAdminRaffleDetailModal(raffleId) {
    currentRaffle = db.raffles.find(r => r.id === raffleId); 
    if (!currentRaffle) { alert('Rifa não encontrada!'); return; }
    currentAdminRaffleIdForPromotion = raffleId; 
    console.log("WebApp RifaMax: Abrindo modal de detalhes do admin para rifa:", currentRaffle);

    document.getElementById('adminRaffleDetailTitle').textContent = `Detalhes: ${currentRaffle.icon || ''} ${currentRaffle.title}`;
    const contentDiv = document.getElementById('adminRaffleDetailContent');
    const approvedSoldCount = db.sales.filter(s => s.raffleId === currentRaffle.id && (s.status === 'approved' || s.status === 'approved_by_stripe')).reduce((sum, s) => sum + s.numbers.length, 0);
    const percentage = currentRaffle.totalNumbers > 0 ? (approvedSoldCount / currentRaffle.totalNumbers * 100).toFixed(1) : 0;
    const isCompleted = currentRaffle.completedAt !== null;
    const approvedRevenue = calculateApprovedRevenueForRaffle(currentRaffle.id);

    contentDiv.innerHTML = `
        <div class="detail-card" style="grid-column: 1 / -1;">
            ${currentRaffle.image ? `<img src="${currentRaffle.image}" alt="${currentRaffle.title}">` : ''}
            <h4>Informações Principais</h4>
            <p><strong>ID:</strong> ${currentRaffle.id}</p>
            <p><strong>Preço por Cota:</strong> R$ ${currentRaffle.price.toFixed(2).replace('.', ',')}</p>
            <p><strong>Total de Cotas:</strong> ${currentRaffle.totalNumbers}</p>
            <p><strong>Cotas Vendidas (Aprovadas):</strong> ${approvedSoldCount} (${percentage}% do total)</p>
            <p><strong>Receita (Aprovada):</strong> R$ ${approvedRevenue.toFixed(2).replace('.', ',')}</p>
            <p><strong>Descrição:</strong> ${currentRaffle.description.replace(/\n/g, '<br>')}</p>
            <p><strong>Método de Sorteio:</strong> ${currentRaffle.drawMethod || 'N/A'}</p>
            <p><strong>Cotas Premiadas (definidas):</strong> ${currentRaffle.prizeQuotas ? currentRaffle.prizeQuotas.split(',').filter(Boolean).length : '0'} cotas</p>
            <p><strong>Criada em:</strong> ${new Date(currentRaffle.createdAt).toLocaleString('pt-BR')}</p>
            <p><strong>Status:</strong> ${isCompleted ? `Finalizada em ${new Date(currentRaffle.completedAt).toLocaleString('pt-BR')}` : (approvedSoldCount >= currentRaffle.totalNumbers ? 'Pronta para finalizar' : 'Ativa')}</p>
            ${isCompleted && currentRaffle.winner ? `<p><strong>Ganhador:</strong> ${currentRaffle.winner.name} (Cota: ${currentRaffle.winner.number.toString().padStart(String(currentRaffle.totalNumbers).length, '0')})</p>` : ''}
        </div>
        <div class="detail-card ranking-container" style="grid-column: 1 / -1;">
            <h3>🏆 Ranking de Compradores (Desta Rifa)</h3>
            ${renderRaffleRanking(raffleId)}
        </div>
        <div class="detail-card prize-quotas-container" style="grid-column: 1 / -1;">
            <h3>🏅 Cotas Premiadas (Desta Rifa)</h3>
            ${renderPrizeQuotas(raffleId)}
        </div>`;
        
    renderAdminRaffleSalesList(raffleId); 
    renderAdminRafflePromotionsList(raffleId); 

    const completeBtn = document.getElementById('adminCompleteRaffleBtn');
    const approvedSalesForRaffle = db.sales.filter(s => s.raffleId === currentRaffle.id && (s.status === 'approved' || s.status === 'approved_by_stripe'));
    if (!isCompleted && approvedSalesForRaffle.length > 0) { 
        completeBtn.style.display = 'inline-block';
        completeBtn.innerHTML = '<span>Marcar como Concluída e Sortear</span>';
        completeBtn.onclick = () => adminCompleteRafflePrompt(currentRaffle.id);
    } else if (!isCompleted && approvedSalesForRaffle.length === 0) { 
        completeBtn.style.display = 'inline-block';
        completeBtn.innerHTML = '<span>Finalizar (Sem Vendas Aprov.)</span>'; 
        completeBtn.onclick = () => adminCompleteRafflePrompt(currentRaffle.id);
    }
    else {
        completeBtn.style.display = 'none';
    }
    document.getElementById('adminRaffleDetailModal').classList.add('active');
}

function calculateApprovedRevenueForRaffle(raffleId) {
    return db.sales.filter(sale => sale.raffleId === raffleId && (sale.status === 'approved' || sale.status === 'approved_by_stripe')).reduce((sum, sale) => sum + sale.amount, 0);
}

function renderAdminRaffleSalesList(raffleId) {
    const salesListDiv = document.getElementById('adminRaffleSalesList');
    const salesForRaffle = db.sales.filter(s => s.raffleId === raffleId).sort((a, b) => new Date(b.date) - new Date(a.date));
    if (salesForRaffle.length === 0) {
        salesListDiv.innerHTML = '<p style="text-align:center; color:var(--text-secondary);">Nenhuma venda para esta rifa.</p>'; return;
    }
    salesListDiv.innerHTML = salesForRaffle.map(sale => {
        let statusClass = 'pending'; 
        let statusText = sale.status;
        let emailButtonHtml = '';
        let manualActionHtml = '';


        if (sale.status === 'approved' || sale.status === 'approved_by_stripe') { 
            statusClass = 'active'; 
            statusText = 'Aprovado'; 
            emailButtonHtml = `<button class="action-btn" style="font-size:0.7rem; padding:0.2rem 0.5rem; margin-top: 5px; border-color:var(--accent); color:var(--accent);" onclick="sendPurchaseConfirmationEmail(${sale.id})">Enviar Email (Sim.)</button>`;
             manualActionHtml = `<button class="action-btn" style="border-color:var(--danger); color:var(--danger);" onclick="rejectSale(${sale.id}, ${raffleId})">Rejeitar Manual</button>`;
        } else if (sale.status === 'pending_admin_approval') {
            statusClass = 'pending';
            statusText = 'Pendente Aprovação';
             manualActionHtml = `
                <button class="action-btn" style="border-color:var(--success); color:var(--success);" onclick="approveSale(${sale.id}, ${raffleId})">Aprovar</button>
                <button class="action-btn" style="border-color:var(--danger); color:var(--danger);" onclick="rejectSale(${sale.id}, ${raffleId})">Rejeitar</button>`;
        } else if (sale.status === 'rejected' || sale.status.includes('failed') || sale.status.includes('canceled')) { 
            statusClass = 'danger'; 
            statusText = sale.status.replace('stripe_checkout_canceled', 'Cancelado Stripe').replace('stripe_redirect_failed', 'Falha Stripe'); 
            manualActionHtml = `<button class="action-btn" onclick="approveSale(${sale.id}, ${raffleId})">Aprovar Manual</button>`;
        } else if (sale.status.includes('pending')) {
            statusClass = 'warning';
            statusText = 'Pendente Gateway';
        }
        
        const raffle = db.raffles.find(r => r.id === sale.raffleId); 
        const numbersDisplay = formatAdminSalesNumbers(sale.numbers, raffle?.totalNumbers || 0);

        return `
            <div class="sale-item-admin">
                <div class="info">
                    <p><strong>Cliente:</strong> ${sale.userName} (${sale.userId})</p>
                    <p><strong>Email:</strong> ${sale.userEmail || 'Não informado'}</p>
                    <p><strong>Data:</strong> ${new Date(sale.date).toLocaleString('pt-BR')}</p>
                    <p><strong>Valor:</strong> R$ ${sale.amount.toFixed(2).replace('.', ',')}</p>
                    <p><strong>Método Pag.:</strong> ${sale.paymentMethod || 'N/A'}</p>
                    <p><strong>Status:</strong> <span class="status-badge status-${statusClass}">${statusText}</span></p>
                    <div class="ticket-numbers-admin"><strong>Cotas:</strong> ${numbersDisplay} 
                        ${sale.numbers && sale.numbers.length > 0 ? 
                            `<button class="action-btn" style="font-size:0.7rem; padding:0.2rem 0.5rem; margin-left:5px;" onclick="showAllSaleTicketsModal(${sale.id})">Ver Todas</button>`
                            : ''
                        }
                    </div>
                </div>
                <div class="actions">
                    ${manualActionHtml}
                    ${emailButtonHtml}
                </div>
            </div>`;
    }).join('');
}

function approveSale(saleId, raffleId) {
    const saleIndex = db.sales.findIndex(s => s.id === saleId);
    if (saleIndex === -1) return;
    const sale = db.sales[saleIndex];
    const raffle = db.raffles.find(r => r.id === raffleId);
    if (!raffle) return;

    // Se a venda não estava aprovada, atribui os números agora (se não tiverem sido atribuídos antes)
    if (sale.status !== 'approved' && sale.status !== 'approved_by_stripe') {
        if (!sale.numbers || sale.numbers.length === 0) { // Atribui números apenas se não existirem
            const availableNumbers = Array.from({length: raffle.totalNumbers}, (_, i) => i + 1).filter(n => !raffle.soldNumbers.includes(n));
            const quantityToAssign = Math.floor(sale.amount / raffle.price); // Calcula a quantidade baseada no valor e preço da rifa, caso não tenha sido guardada

            if (availableNumbers.length < quantityToAssign) { 
                alert('Não há cotas suficientes disponíveis para esta aprovação manual.'); 
                // Poderia reverter o status ou pedir ação do admin
                return; 
            }
            const purchasedNumbers = [];
            for (let i = 0; i < quantityToAssign && availableNumbers.length > 0; i++) {
                const randomIndex = Math.floor(Math.random() * availableNumbers.length);
                purchasedNumbers.push(availableNumbers.splice(randomIndex, 1)[0]);
            }
            sale.numbers = purchasedNumbers;
        }
        
        sale.numbers.forEach(num => {
            if (!raffle.soldNumbers.includes(num)) {
                raffle.soldNumbers.push(num);
            }
        });
        raffle.soldNumbers.sort((a,b) => a-b);
    }
    db.sales[saleIndex].status = 'approved'; // Status final de aprovação manual
    saveDB();
    console.log(`WebApp RifaMax: Venda ID ${saleId} aprovada manualmente para rifa ID ${raffleId}.`);
    
    sendPurchaseConfirmationEmail(sale); 

    renderAdminRaffleSalesList(raffleId); 
    updateAdminDashboard(); updateRafflesTable(); updateSalesTable(); 
    if (document.getElementById('adminRaffleDetailModal').classList.contains('active') && currentRaffle && currentRaffle.id === raffleId) {
        openAdminRaffleDetailModal(raffleId); 
    }
    updateAdminNotificationCount(); 
}

function rejectSale(saleId, raffleId) {
    const saleIndex = db.sales.findIndex(s => s.id === saleId);
    if (saleIndex === -1) return;
    const sale = db.sales[saleIndex];
    const originalStatus = sale.status;
    db.sales[saleIndex].status = 'rejected';
    const raffle = db.raffles.find(r => r.id === raffleId);
    if (raffle && (originalStatus === 'approved' || originalStatus === 'approved_by_stripe' || originalStatus === 'pending_admin_approval')) {
        // Devolve os números para a rifa se a venda estava aprovada ou pendente e foi rejeitada
        if (sale.numbers && sale.numbers.length > 0) {
            sale.numbers.forEach(numberToRemove => {
                const index = raffle.soldNumbers.indexOf(numberToRemove);
                if (index > -1) raffle.soldNumbers.splice(index, 1);
            });
        }
    }
    saveDB();
    console.log(`WebApp RifaMax: Venda ID ${saleId} rejeitada para rifa ID ${raffleId}.`);
    renderAdminRaffleSalesList(raffleId);
    updateAdminDashboard(); updateRafflesTable(); updateSalesTable();
    if (document.getElementById('adminRaffleDetailModal').classList.contains('active') && currentRaffle && currentRaffle.id === raffleId) {
        openAdminRaffleDetailModal(raffleId); 
    }
    updateAdminNotificationCount(); 
}

// Promoções
function openAdminPromotionModal(promotionId, raffleToSetId = null) {
    const form = document.getElementById('adminPromotionForm');
    form.reset(); 
    document.getElementById('promotionSpecificFields').innerHTML = '';
    document.getElementById('promotionActiveToggle').classList.remove('active');

    const raffleIdForModal = raffleToSetId || (currentAdminRaffleIdForPromotion || (currentRaffle ? currentRaffle.id : null));
    
    if (!raffleIdForModal && !promotionId) { 
        alert("Selecione uma rifa primeiro ou edite uma promoção existente.");
        return;
    }
    document.getElementById('promotionRaffleId').value = raffleIdForModal;

    if (promotionId) {
        const promotion = db.promotions.find(p => p.id === promotionId);
        if (promotion) {
            document.getElementById('adminPromotionModalTitle').textContent = 'Editar Promoção';
            document.getElementById('adminPromotionSubmitBtnText').textContent = 'Salvar Alterações';
            document.getElementById('promotionEditId').value = promotion.id;
            document.getElementById('promotionRaffleId').value = promotion.raffleId; 
            document.getElementById('promotionTitle').value = promotion.title;
            document.getElementById('promotionType').value = promotion.type;
            updatePromotionFields(promotion.details);
            if (promotion.isActive) document.getElementById('promotionActiveToggle').classList.add('active');
        }
    } else {
        document.getElementById('adminPromotionModalTitle').textContent = 'Adicionar Nova Promoção';
        document.getElementById('adminPromotionSubmitBtnText').textContent = 'Criar Promoção';
        document.getElementById('promotionEditId').value = '';
        document.getElementById('promotionActiveToggle').classList.add('active'); 
    }
    document.getElementById('adminPromotionModal').classList.add('active');
}

function updatePromotionFields(details = null) {
    const type = document.getElementById('promotionType').value;
    const fieldsDiv = document.getElementById('promotionSpecificFields');
    fieldsDiv.innerHTML = ''; 
    if (type === 'discount_quantity_threshold') {
        fieldsDiv.innerHTML = `
            <div class="form-group"><label>Qtde. Mínima</label><input type="number" class="form-input" id="promoMinQuantity" min="1" required value="${details?.minQuantity || ''}"></div>
            <div class="form-group"><label>Novo Preço/Cota</label><input type="number" class="form-input" id="promoDiscountedPrice" step="0.01" min="0.01" required value="${details?.discountedPrice || ''}"></div>`;
    } else if (type === 'fixed_price_pack') {
        fieldsDiv.innerHTML = `
            <div class="form-group"><label>Qtde. Cotas Pacote</label><input type="number" class="form-input" id="promoPackQuantity" min="1" required value="${details?.packQuantity || ''}"></div>
            <div class="form-group"><label>Preço Fixo Pacote</label><input type="number" class="form-input" id="promoPackPrice" step="0.01" min="0.01" required value="${details?.packPrice || ''}"></div>`;
    }
}

function handleAdminPromotionSubmit(event) {
    event.preventDefault();
    const editId = document.getElementById('promotionEditId').value;
    const raffleId = parseInt(document.getElementById('promotionRaffleId').value);
    if (!raffleId) { alert("Erro: Rifa não especificada para a promoção."); return; }

    const promotionData = {
        raffleId: raffleId, title: document.getElementById('promotionTitle').value,
        type: document.getElementById('promotionType').value, 
        isActive: document.getElementById('promotionActiveToggle').classList.contains('active'), details: {}
    };
    if (promotionData.type === 'discount_quantity_threshold') {
        promotionData.details.minQuantity = parseInt(document.getElementById('promoMinQuantity').value);
        promotionData.details.discountedPrice = parseFloat(document.getElementById('promoDiscountedPrice').value);
        if (isNaN(promotionData.details.minQuantity) || isNaN(promotionData.details.discountedPrice) || promotionData.details.minQuantity < 1 || promotionData.details.discountedPrice <=0) {
            alert("Valores inválidos para promoção de desconto progressivo."); return;
        }
    } else if (promotionData.type === 'fixed_price_pack') {
        promotionData.details.packQuantity = parseInt(document.getElementById('promoPackQuantity').value);
        promotionData.details.packPrice = parseFloat(document.getElementById('promoPackPrice').value);
         if (isNaN(promotionData.details.packQuantity) || isNaN(promotionData.details.packPrice) || promotionData.details.packQuantity < 1 || promotionData.details.packPrice <=0) {
            alert("Valores inválidos para promoção de pacote com preço fixo."); return;
        }
    } else if (!promotionData.type) {
        alert("Selecione um tipo de promoção."); return;
    }


    if (editId) {
        const promoIndex = db.promotions.findIndex(p => p.id === parseInt(editId));
        if (promoIndex > -1) db.promotions[promoIndex] = { ...db.promotions[promoIndex], ...promotionData };
    } else {
        promotionData.id = Date.now();
        promotionData.createdAt = new Date().toISOString();
        db.promotions.push(promotionData);
    }
    saveDB();
    closeModal('adminPromotionModal');
    if (document.getElementById('adminRaffleDetailModal').classList.contains('active') && 
        (currentRaffle?.id === raffleId || currentAdminRaffleIdForPromotion === raffleId) ) {
        renderAdminRafflePromotionsList(raffleId);
    }
}

function renderAdminRafflePromotionsList(raffleId) {
    const promotionsListDiv = document.getElementById('adminRafflePromotionsList');
    const promotionsForRaffle = db.promotions.filter(p => p.raffleId === raffleId);
    if (promotionsForRaffle.length === 0) {
        promotionsListDiv.innerHTML = '<p style="text-align:center; color:var(--text-secondary); margin-top:1rem;">Nenhuma promoção para esta rifa.</p>'; return;
    }
    promotionsListDiv.innerHTML = promotionsForRaffle.map(promo => `
        <div class="promotion-item-admin">
            <div><strong>${promo.title}</strong> (${promo.type}) - ${promo.isActive ? "Ativa" : "Inativa"}</div>
            <div>
                <button class="action-btn" onclick="openAdminPromotionModal(${promo.id}, ${raffleId})">Editar</button>
                <button class="action-btn" style="border-color:var(--danger); color:var(--danger);" onclick="deleteAdminPromotion(${promo.id}, ${raffleId})">Apagar</button>
            </div>
        </div>`).join('');
}

function deleteAdminPromotion(promotionId, raffleIdContext) {
    if (confirm('Tem certeza que deseja apagar esta promoção?')) {
        db.promotions = db.promotions.filter(p => p.id !== promotionId);
        saveDB();
        if (document.getElementById('adminRaffleDetailModal').classList.contains('active') && 
            (currentRaffle?.id === raffleIdContext || currentAdminRaffleIdForPromotion === raffleIdContext)) {
            renderAdminRafflePromotionsList(raffleIdContext);
        }
    }
}


// Ganhadores e Contato
function renderWinners() {
    const completedRaffles = db.raffles.filter(r => r.completedAt && r.winner);
    const grid = document.getElementById('winnersGrid');
    if (!grid) return;
    if (completedRaffles.length === 0) {
        grid.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">Nenhum sorteio realizado ainda.</p>'; return;
    }
    grid.innerHTML = completedRaffles.sort((a,b) => new Date(b.completedAt) - new Date(a.createdAt))
    .map(raffle => `
        <div class="winner-card">
            <div class="winner-name">${raffle.winner.name}</div>
            <div class="winner-prize">${raffle.icon} ${raffle.title}</div>
            <div class="winner-details">
                <span>Cota: ${raffle.winner.number.toString().padStart(String(raffle.totalNumbers).length, '0')}</span>
                <span>Data: ${new Date(raffle.completedAt).toLocaleDateString('pt-BR')}</span>
            </div>
        </div>`).join('');
}

function sendContact(event) {
    event.preventDefault();
    alert(`Obrigado pelo contato, ${document.getElementById('contactName').value}! Mensagem enviada (simulação).`);
    event.target.reset();
}

// Gráficos (Chart.js)
function renderActiveRafflesProgressChart() {
    const ctx = document.getElementById('activeRafflesProgressChart')?.getContext('2d');
    if (!ctx) return;
    const activeRaffles = db.raffles.filter(r => !r.completedAt).slice(0, 5); 
    if (activeRafflesChartInstance) activeRafflesChartInstance.destroy();
    activeRafflesChartInstance = new Chart(ctx, {
        type: 'bar', data: {
            labels: activeRaffles.map(r => r.title.substring(0,15) + (r.title.length > 15 ? '...' : '')),
            datasets: [{ label: '% Vendida (Aprovadas)', data: activeRaffles.map(r => {
                const approvedSoldCount = db.sales.filter(s=>s.raffleId === r.id && (s.status === 'approved' || s.status === 'approved_by_stripe')).reduce((sum,s)=>sum + s.numbers.length,0);
                return r.totalNumbers > 0 ? (approvedSoldCount / r.totalNumbers * 100).toFixed(1) : 0;
            }), backgroundColor: activeRaffles.map(() => `hsla(${Math.random()*360}, 70%, 60%, 0.7)`), borderWidth: 1 }]
        }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100, ticks: { color: 'var(--text-secondary)' }, grid: { color: 'var(--glass-border)' } }, x: { ticks: { color: 'var(--text-secondary)' }, grid: { display: false } } }, plugins: { legend: { display: false } } }
    });
}
function renderSalesLast7DaysChart() {
    const ctx = document.getElementById('salesLast7DaysChart')?.getContext('2d');
    if (!ctx) return;
    const salesData = { labels: [], totals: [] }; const today = new Date();
    for (let i = 6; i >= 0; i--) {
        const date = new Date(today); date.setDate(today.getDate() - i);
        salesData.labels.push(date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
        let dailyTotal = 0;
        db.sales.forEach(sale => { if ((sale.status === 'approved' || sale.status === 'approved_by_stripe') && new Date(sale.date).toLocaleDateString('pt-BR') === date.toLocaleDateString('pt-BR')) dailyTotal += sale.amount; });
        salesData.totals.push(dailyTotal);
    }
    if (salesLast7DaysChartInstance) salesLast7DaysChartInstance.destroy();
    salesLast7DaysChartInstance = new Chart(ctx, {
        type: 'line', data: { labels: salesData.labels, datasets: [{ label: 'Receita Aprovada (R$)', data: salesData.totals, borderColor: 'var(--primary)', backgroundColor: 'rgba(0, 255, 136, 0.1)', fill: true, tension: 0.3 }] },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { color: 'var(--text-secondary)', callback: value => `R$ ${value}` }, grid: { color: 'var(--glass-border)' } }, x: { ticks: { color: 'var(--text-secondary)' }, grid: { display: false } } }, plugins: { legend: { labels: { color: 'var(--text-primary)' } } } }
    });
}

// Ranking de Vendas e Cotas Premiadas
function renderRaffleRanking(raffleId) {
    const raffle = db.raffles.find(r => r.id === raffleId);
    if (!raffle) return '<p style="text-align:center; color:var(--text-secondary);">Rifa não encontrada.</p>';

    const salesByBuyer = {};
    db.sales.filter(s => s.raffleId === raffleId && (s.status === 'approved' || s.status === 'approved_by_stripe')).forEach(sale => {
        if (!salesByBuyer[sale.userId]) {
            salesByBuyer[sale.userId] = { name: sale.userName, phone: sale.userId, count: 0 };
        }
        salesByBuyer[sale.userId].count += sale.numbers.length;
    });

    const sortedBuyers = Object.values(salesByBuyer).sort((a, b) => b.count - a.count);

    if (sortedBuyers.length === 0) {
        return '<p style="text-align:center; color:var(--text-secondary);">Nenhuma cota aprovada vendida para esta rifa ainda.</p>';
    }

    let rankingHtml = '<div class="ranking-container">';
    const top3 = sortedBuyers.slice(0, 3);
    rankingHtml += '<div class="ranking-top3">';
    top3.forEach((buyer, index) => {
        let medal = '';
        if (index === 0) medal = '🥇'; 
        else if (index === 1) medal = '🥈'; 
        else if (index === 2) medal = '🥉'; 
        
        rankingHtml += `
            <div class="ranking-top-item ranking-pos-${index + 1}">
                <div class="ranking-medal">${medal}</div>
                <div class="ranking-buyer-name">${buyer.name}</div>
                <div class="ranking-buyer-quotas">${buyer.count.toLocaleString('pt-BR')} cotas</div>
            </div>`;
    });
    rankingHtml += '</div>'; 

    if (sortedBuyers.length > 3) {
        rankingHtml += '<h4 class="ranking-others-title">Demais Compradores</h4>';
        rankingHtml += '<ul class="ranking-others-list">';
        sortedBuyers.slice(3).forEach((buyer, index) => {
            rankingHtml += `
                <li class="ranking-other-item">
                    <span class="ranking-other-pos">${index + 4}.</span>
                    <span class="ranking-other-name">${buyer.name} (${buyer.phone.slice(-4)})</span>
                    <span class="ranking-other-quotas">${buyer.count.toLocaleString('pt-BR')} cotas</span>
                </li>`;
        });
        rankingHtml += '</ul>';
    }
    rankingHtml += '</div>'; 
    return rankingHtml;
}

function renderPrizeQuotas(raffleId) {
    const raffle = db.raffles.find(r => r.id === raffleId);
    if (!raffle || !raffle.prizeQuotas || raffle.prizeQuotas.trim() === '') {
        return '<p style="text-align:center; color:var(--text-secondary);">Nenhuma cota premiada definida para esta rifa.</p>';
    }

    const prizeQuotaEntries = raffle.prizeQuotas.split(',')
        .map(entry => {
            const parts = entry.split(':');
            const number = parseInt(parts[0]?.trim());
            const prizeDescription = parts[1]?.trim() || "Prêmio Especial"; 
            if (!isNaN(number) && number > 0) {
                return { number, prizeDescription };
            }
            return null;
        })
        .filter(entry => entry !== null);

    if (prizeQuotaEntries.length === 0) {
        return '<p style="text-align:center; color:var(--text-secondary);">Nenhuma cota premiada válida definida.</p>';
    }

    let prizeQuotasHtml = '<ul class="prize-quotas-list">';
    prizeQuotaEntries.forEach(entry => {
        let buyerInfo = 'Disponível';
        let buyerName = '';
        let isBought = false;
        for (const sale of db.sales) {
            if (sale.raffleId === raffleId && (sale.status === 'approved' || sale.status === 'approved_by_stripe') && sale.numbers.includes(entry.number)) {
                buyerName = sale.userName;
                buyerInfo = `Comprado`;
                isBought = true;
                break;
            }
        }
        prizeQuotasHtml += `
            <li class="prize-quota-item ${isBought ? 'bought' : 'available'}">
                <div class="prize-quota-desc">${entry.prizeDescription}</div>
                <div class="prize-quota-details">
                    <span class="prize-quota-status">${buyerInfo}</span>
                    <span class="prize-quota-number">Cota ${entry.number.toString().padStart(String(raffle.totalNumbers).length, '0')}</span>
                </div>
                ${isBought && buyerName ? `<div class="prize-quota-buyer"><i class="fas fa-user"></i> ${buyerName}</div>` : ''}
            </li>`;
    });
    prizeQuotasHtml += '</ul>';
    return prizeQuotasHtml;
}

// Funções para Cotas Premiadas Dinâmicas
function togglePrizeQuotasConfig() {
    const activateToggle = document.getElementById('activatePrizeQuotasToggle');
    const configSection = document.getElementById('prizeQuotasConfigSection');
    const isActive = activateToggle.classList.contains('active');

    if (isActive) {
        configSection.style.display = 'block';
        if (document.getElementById('prizeQuotasDynamicInputsContainer').childElementCount === 0) {
            addPrizeQuotaInput(); 
        }
    } else {
        configSection.style.display = 'none';
    }
}


function addPrizeQuotaInput(number = '', prize = '') {
    const container = document.getElementById('prizeQuotasDynamicInputsContainer');
    const newInputGroup = document.createElement('div');
    newInputGroup.classList.add('prize-quota-input-group');
    newInputGroup.style.display = 'flex';
    newInputGroup.style.gap = '1rem';
    newInputGroup.style.marginBottom = '1rem';
    newInputGroup.style.alignItems = 'center';

    const numberInput = document.createElement('input');
    numberInput.type = 'number';
    numberInput.classList.add('form-input');
    numberInput.placeholder = 'Número';
    numberInput.value = number;
    numberInput.style.flexGrow = '1';
    numberInput.min = "1";

    const prizeInput = document.createElement('input');
    prizeInput.type = 'text';
    prizeInput.classList.add('form-input');
    prizeInput.placeholder = 'Prêmio';
    prizeInput.value = prize;
    prizeInput.style.flexGrow = '2';

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.classList.add('btn');
    removeBtn.style.backgroundColor = 'var(--danger)';
    removeBtn.style.borderColor = 'var(--danger)';
    removeBtn.style.color = 'var(--text-primary)'; 
    removeBtn.innerHTML = '<span>Remover</span>';
    removeBtn.onclick = function() {
        newInputGroup.remove();
    };

    newInputGroup.appendChild(numberInput);
    newInputGroup.appendChild(prizeInput);
    newInputGroup.appendChild(removeBtn);
    container.appendChild(newInputGroup);
}


// Inicializar ao carregar o DOM
document.addEventListener('DOMContentLoaded', initializeApp);

