
import React, { useState, useEffect } from 'react';
import { AppCredential, ClientDBRow } from '../types';
import { fetchCredentials, saveCredential, deleteCredential, getUsersCountForCredential, getClientsAssignedToCredential } from '../services/credentialService';
import { getAllClients, saveClientToDB, deleteClientFromDB, resetAllClientPasswords, verifyAdminLogin, getTestUser, createDemoClient, getSystemConfig, saveSystemConfig, SystemConfig } from '../services/clientService';
import { Plus, Trash2, Edit2, LogOut, Eye, Users, Save, RefreshCw, Search, AlertTriangle, X, Check, DollarSign, MessageCircle, ShieldAlert, TestTube, Unlock, Ban, Calendar, User as UserIcon, Sparkles, PieChart, Activity, Megaphone, AlertCircle, Signal } from 'lucide-react';

interface AdminPanelProps {
  onLogout: () => void;
}

const SERVICES = ['Viki Pass', 'Kocowa+', 'IQIYI', 'WeTV', 'DramaBox'];

// Helper for test password display
const getCurrentTestPassword = () => {
    const block = Math.floor(Date.now() / (3 * 60 * 60 * 1000));
    const suffix = (block * 13 % 1000).toString().padStart(3, '0');
    return `TESTE-${suffix}`;
};

const AdminPanel: React.FC<AdminPanelProps> = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState<'credentials' | 'clients' | 'reports' | 'system' | 'test' | 'danger'>('credentials');
  
  // Data State
  const [credentials, setCredentials] = useState<AppCredential[]>([]);
  const [counts, setCounts] = useState<{[key: string]: number}>({});
  const [clients, setClients] = useState<ClientDBRow[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  
  // System Config State
  const [sysConfig, setSysConfig] = useState<SystemConfig>({
      bannerText: '', bannerType: 'info', bannerActive: false, 
      serviceStatus: { 'Viki Pass': 'ok', 'Kocowa+': 'ok', 'IQIYI': 'ok', 'WeTV': 'ok' } 
  });
  
  // Test User State
  const [testServices, setTestServices] = useState<string[]>([]);
  const [testUserLoading, setTestUserLoading] = useState(false);
  const [testUserId, setTestUserId] = useState<string | null>(null);

  // Stats State
  const [stats, setStats] = useState({ totalClients: 0, activeClients: 0, totalRevenue: 0, expiringSoon: 0, debtors: 0 });

  // Modals State
  const [viewUsersModal, setViewUsersModal] = useState<{open: boolean, users: ClientDBRow[], cred: AppCredential | null}>({open: false, users: [], cred: null});
  const [clientModal, setClientModal] = useState({ open: false, isEdit: false });
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; type: 'credential' | 'client'; id: string | null }>({ open: false, type: 'credential', id: null });
  const [isDeleting, setIsDeleting] = useState(false);

  // Nuclear
  const [nuclearStep, setNuclearStep] = useState(0); 
  const [nuclearInput, setNuclearInput] = useState('');
  const [adminPassInput, setAdminPassInput] = useState('');
  const [nuclearLoading, setNuclearLoading] = useState(false);

  const [loading, setLoading] = useState(false);
  
  // Credential Form
  const [isEditing, setIsEditing] = useState(false);
  const [isBulkMode, setIsBulkMode] = useState(false); 
  const [editId, setEditId] = useState<string | null>(null);
  const [service, setService] = useState(SERVICES[0]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [bulkText, setBulkText] = useState(''); 
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  // Client Form
  const [clientForm, setClientForm] = useState<Partial<ClientDBRow>>({
      phone_number: '',
      client_name: '',
      client_password: '',
      subscriptions: [],
      purchase_date: new Date().toISOString().split('T')[0],
      duration_months: 1,
      is_debtor: false,
      override_expiration: false
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
        setLoading(true);

        // Fetch Data from DB
        const [credData, allClients, sysConf] = await Promise.all([
            fetchCredentials(),
            getAllClients(),
            getSystemConfig()
        ]);

        const filteredCreds = credData.filter(c => c.service !== 'SYSTEM_CONFIG');
        setCredentials(filteredCreds);
        setClients(allClients);
        setSysConfig(sysConf);

        // Calculate Stats
        const now = new Date();
        const active = allClients.filter(c => !c.deleted && !c.is_debtor);
        const revenue = active.length * 15; 
        
        const debtors = allClients.filter(c => !c.deleted && c.is_debtor).length;
        
        // Expiring logic
        let expiringCount = 0;
        active.forEach(c => {
             const purchase = new Date(c.purchase_date);
             const expiry = new Date(purchase);
             expiry.setMonth(purchase.getMonth() + c.duration_months);
             const diffTime = expiry.getTime() - now.getTime();
             const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
             if (daysLeft <= 7 && daysLeft >= 0) expiringCount++;
        });

        setStats({
            totalClients: allClients.filter(c => !c.deleted).length,
            activeClients: active.length,
            totalRevenue: revenue,
            expiringSoon: expiringCount,
            debtors: debtors
        });

        // Calculate Usage Counts
        const newCounts: {[key: string]: number} = {};
        for (const cred of filteredCreds) {
            newCounts[cred.id] = await getUsersCountForCredential(cred, allClients);
        }
        setCounts(newCounts);
        
        // Test User Logic
        const testU = allClients.find(c => c.phone_number === '00000000000');
        if (testU) {
            setTestUserId(testU.id);
            setTestServices(Array.isArray(testU.subscriptions) ? testU.subscriptions : []);
        }

    } catch (err) {
        console.error("Erro ao carregar dados:", err);
    } finally {
        setLoading(false);
    }
  };

  // --- ACTIONS ---

  const handleSaveCredential = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    let pubDate = date ? new Date(date).toISOString() : new Date().toISOString();
    
    if (isBulkMode) {
        const lines = bulkText.split('\n');
        for (const line of lines) {
             if (!line.trim()) continue;
             const parts = line.split(/[:|;\s]+/).filter(p => p.trim() !== '');
             if (parts.length >= 2) {
                 await saveCredential({
                     id: '', service, email: parts[0], password: parts[1], publishedAt: pubDate, isVisible: true
                 });
             }
        }
    } else {
        const newCred: AppCredential = {
          id: editId || '', service, email, password, publishedAt: pubDate, isVisible: true
        };
        await saveCredential(newCred);
    }
    
    resetForm();
    await loadData();
  };

  const confirmDelete = async () => {
      if (!deleteModal.id) return;
      setIsDeleting(true);

      if (deleteModal.type === 'credential') {
          await deleteCredential(deleteModal.id);
      } else {
          // CALLS SUPABASE DELETE
          await deleteClientFromDB(deleteModal.id);
      }

      await loadData(); // REFRESH DATA FROM DB
      setIsDeleting(false);
      setDeleteModal({ open: false, type: 'credential', id: null });
  };

  const handleSaveClient = async () => {
     if (!clientForm.phone_number) return alert('Telefone é obrigatório');
     setLoading(true);
     
     // CALLS SUPABASE SAVE
     const success = await saveClientToDB(clientForm);
     
     if (success) {
        setClientModal({ open: false, isEdit: false });
        await loadData(); // REFRESH DATA FROM DB
     } else {
        alert('Erro ao salvar no banco de dados. Tente novamente.');
     }
     setLoading(false);
  };

  const handleQuickToggleOverride = async (client: ClientDBRow) => {
      setLoading(true);
      const success = await saveClientToDB({ 
          id: client.id, 
          override_expiration: !client.override_expiration 
      });
      
      if (success) await loadData();
      setLoading(false);
  };

  const handleUpdateTestServices = async () => {
      setTestUserLoading(true);
      const payload: Partial<ClientDBRow> = {
          phone_number: '00000000000',
          client_password: 'TEST',
          subscriptions: testServices,
          purchase_date: new Date().toISOString(),
          duration_months: 120, 
          is_debtor: false,
          deleted: false
      };
      
      if (testUserId) payload.id = testUserId;

      const success = await saveClientToDB(payload);
      if (success) {
          alert('Configuração de teste salva no banco de dados!');
          await loadData();
      }
      setTestUserLoading(false);
  };

  const handleSaveSystemConfig = async () => {
      setLoading(true);
      const success = await saveSystemConfig(sysConfig);
      if (success) alert("Configurações do sistema atualizadas!");
      else alert("Erro ao salvar.");
      setLoading(false);
  };

  const handleViewUsers = async (cred: AppCredential) => {
      setLoading(true);
      try {
          // Fetch specifically assigned users
          const assignedUsers = await getClientsAssignedToCredential(cred, clients);
          setViewUsersModal({
              open: true,
              users: assignedUsers,
              cred: cred
          });
      } catch (e) {
          alert("Erro ao buscar usuários");
      }
      setLoading(false);
  };

  const handleCreateDemo = async () => {
      setLoading(true);
      const success = await createDemoClient();
      if (success) {
          alert("Conta Demo gerada com sucesso! Procure por '99999...' na lista.");
          await loadData();
      } else {
          alert("Erro ao gerar conta demo.");
      }
      setLoading(false);
  };

  // --- UI HELPERS ---

  const handleEditCredential = (cred: AppCredential) => {
    setIsBulkMode(false);
    setIsEditing(true);
    setEditId(cred.id);
    setService(cred.service);
    setEmail(cred.email);
    setPassword(cred.password);
    setDate(new Date(cred.publishedAt).toISOString().split('T')[0]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    setIsEditing(false);
    setIsBulkMode(false);
    setEditId(null);
    setEmail('');
    setPassword('');
    setBulkText('');
    setDate(new Date().toISOString().split('T')[0]);
  };

  const toggleVisibility = async (cred: AppCredential) => {
    setLoading(true);
    const updated = { ...cred, isVisible: !cred.isVisible };
    await saveCredential(updated);
    await loadData();
  };

  const handleOpenClientModal = (client?: ClientDBRow) => {
    if (client) {
      setClientForm({
        id: client.id,
        phone_number: client.phone_number,
        client_name: client.client_name || '',
        client_password: client.client_password || '',
        subscriptions: Array.isArray(client.subscriptions) ? client.subscriptions : [],
        purchase_date: client.purchase_date ? new Date(client.purchase_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        duration_months: client.duration_months,
        is_debtor: client.is_debtor,
        override_expiration: client.override_expiration || false
      });
      setClientModal({ open: true, isEdit: true });
    } else {
      setClientForm({ 
          phone_number: '', 
          client_name: '',
          client_password: '', 
          subscriptions: [], 
          purchase_date: new Date().toISOString().split('T')[0], 
          duration_months: 1, 
          is_debtor: false,
          override_expiration: false 
        });
      setClientModal({ open: true, isEdit: false });
    }
  };

  const filteredClients = clients.filter(c => 
    !c.deleted && (
        c.phone_number.includes(clientSearch) || 
        (c.client_name && c.client_name.toLowerCase().includes(clientSearch.toLowerCase())) ||
        (c.client_password && c.client_password.includes(clientSearch))
    )
  );

  const getExpiringClients = () => {
      const now = new Date();
      return clients.filter(c => !c.deleted && !c.is_debtor).map(c => {
          const purchase = new Date(c.purchase_date);
          const expiry = new Date(purchase);
          expiry.setMonth(purchase.getMonth() + c.duration_months);
          const diffTime = expiry.getTime() - now.getTime();
          const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          return { ...c, daysLeft };
      }).filter(c => c.daysLeft <= 10).sort((a,b) => a.daysLeft - b.daysLeft);
  };

  const toggleServiceInForm = (svc: string) => {
      const current = clientForm.subscriptions || [];
      if (current.includes(svc)) setClientForm({ ...clientForm, subscriptions: current.filter(s => s !== svc) });
      else setClientForm({ ...clientForm, subscriptions: [...current, svc] });
  };

  const toggleTestService = (svc: string) => {
      if (testServices.includes(svc)) setTestServices(prev => prev.filter(s => s !== svc));
      else setTestServices(prev => [...prev, svc]);
  };

  const handleNuclearReset = async () => {
      setNuclearLoading(true);
      const isAdmin = await verifyAdminLogin('1252', adminPassInput); 
      if (!isAdmin) {
          alert("Senha de administrador incorreta.");
          setNuclearLoading(false);
          return;
      }

      const success = await resetAllClientPasswords();
      if (success) {
          alert("SUCESSO: Todas as senhas foram resetadas no Banco de Dados.");
          setNuclearStep(0);
          setNuclearInput('');
          setAdminPassInput('');
          loadData();
      } else {
          alert("ERRO CRÍTICO: Falha ao resetar senhas.");
      }
      setNuclearLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-6 pb-24 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* HEADER & STATS */}
        <header className="flex flex-col gap-6 bg-white p-6 rounded-3xl shadow-sm">
           <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div>
                <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Painel Admin</h1>
                <p className="text-gray-500 font-medium">Gestão EuDorama</p>
              </div>
              <button onClick={onLogout} className="flex items-center text-red-600 font-bold hover:bg-red-50 px-4 py-2 rounded-xl transition-colors">
                <LogOut className="w-5 h-5 mr-2" /> Sair
              </button>
           </div>

           <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
               <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                   <div className="flex items-center text-blue-600 mb-1">
                       <Users className="w-5 h-5 mr-2" />
                       <span className="font-bold text-sm">Total Clientes</span>
                   </div>
                   <span className="text-2xl font-black text-blue-900">{stats.totalClients}</span>
               </div>
               <div className="bg-green-50 p-4 rounded-2xl border border-green-100">
                   <div className="flex items-center text-green-600 mb-1">
                       <DollarSign className="w-5 h-5 mr-2" />
                       <span className="font-bold text-sm">MRR (Est.)</span>
                   </div>
                   <span className="text-2xl font-black text-green-900">R$ {stats.totalRevenue}</span>
               </div>
               <div className="bg-yellow-50 p-4 rounded-2xl border border-yellow-100">
                   <div className="flex items-center text-yellow-600 mb-1">
                       <Calendar className="w-5 h-5 mr-2" />
                       <span className="font-bold text-sm">A Vencer (7d)</span>
                   </div>
                   <span className="text-2xl font-black text-yellow-900">{stats.expiringSoon}</span>
               </div>
               <div className="bg-red-50 p-4 rounded-2xl border border-red-100">
                   <div className="flex items-center text-red-600 mb-1">
                       <AlertTriangle className="w-5 h-5 mr-2" />
                       <span className="font-bold text-sm">Inadimplentes</span>
                   </div>
                   <span className="text-2xl font-black text-red-900">{stats.debtors}</span>
               </div>
           </div>
        </header>

        {/* TABS */}
        <div className="flex bg-white p-1.5 rounded-2xl shadow-sm w-full md:w-auto self-start overflow-x-auto">
             <button onClick={() => setActiveTab('credentials')} className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'credentials' ? 'bg-primary-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}>Credenciais</button>
             <button onClick={() => setActiveTab('clients')} className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'clients' ? 'bg-primary-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}>Clientes</button>
             <button onClick={() => setActiveTab('reports')} className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'reports' ? 'bg-purple-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}>Relatórios</button>
             <button onClick={() => setActiveTab('system')} className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'system' ? 'bg-orange-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}>Sistema</button>
             <button onClick={() => setActiveTab('test')} className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'test' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}>Teste Grátis</button>
             <button onClick={() => setActiveTab('danger')} className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'danger' ? 'bg-red-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}>Danger</button>
        </div>
        
        {/* TAB 1: CREDENTIALS */}
        {activeTab === 'credentials' && (
             <div>
                 {/* Input Form */}
                 <div className="bg-white p-6 rounded-2xl shadow-sm border-2 border-primary-100 mb-6">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-gray-800 flex items-center">
                            {isEditing ? <Edit2 className="w-5 h-5 mr-2 text-primary-600" /> : <Plus className="w-5 h-5 mr-2 text-primary-600" />}
                            {isEditing ? 'Editar Credencial' : 'Adicionar Nova Conta'}
                        </h3>
                        {isEditing && <button onClick={resetForm} className="text-xs text-gray-500 underline">Cancelar Edição</button>}
                    </div>
                    
                    <form onSubmit={handleSaveCredential} className="space-y-4">
                        <div className="flex gap-2 mb-2">
                             <button type="button" onClick={() => setIsBulkMode(false)} className={`flex-1 py-2 rounded-lg text-xs font-bold ${!isBulkMode ? 'bg-primary-50 text-primary-700 border border-primary-200' : 'bg-gray-50 text-gray-400'}`}>Individual</button>
                             <button type="button" onClick={() => setIsBulkMode(true)} className={`flex-1 py-2 rounded-lg text-xs font-bold ${isBulkMode ? 'bg-primary-50 text-primary-700 border border-primary-200' : 'bg-gray-50 text-gray-400'}`}>Em Lote (Vários)</button>
                        </div>

                        {!isBulkMode ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <select className="bg-gray-50 border-0 rounded-xl p-3 font-bold text-gray-700" value={service} onChange={e => setService(e.target.value)}>
                                    {SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                                <input type="date" className="bg-gray-50 border-0 rounded-xl p-3" value={date} onChange={e => setDate(e.target.value)} />
                                <input type="email" placeholder="Email da Conta" className="bg-gray-50 border-0 rounded-xl p-3 md:col-span-2" value={email} onChange={e => setEmail(e.target.value)} />
                                <input type="text" placeholder="Senha" className="bg-gray-50 border-0 rounded-xl p-3 md:col-span-2" value={password} onChange={e => setPassword(e.target.value)} />
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <select className="w-full bg-gray-50 border-0 rounded-xl p-3 font-bold text-gray-700 mb-2" value={service} onChange={e => setService(e.target.value)}>
                                    {SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                                <textarea 
                                    className="w-full h-32 bg-gray-50 border-0 rounded-xl p-3 font-mono text-xs" 
                                    placeholder={`email1@exemplo.com:senha1\nemail2@exemplo.com senha2\nemail3@exemplo.com;senha3`}
                                    value={bulkText}
                                    onChange={e => setBulkText(e.target.value)}
                                />
                                <p className="text-[10px] text-gray-400">Formato: email:senha (uma por linha)</p>
                            </div>
                        )}

                        <button disabled={loading} className="w-full bg-primary-600 text-white font-bold py-3 rounded-xl hover:bg-primary-700 flex justify-center items-center shadow-lg shadow-primary-200 transition-transform active:scale-95">
                            {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5 mr-2" /> Salvar no Banco de Dados</>}
                        </button>
                    </form>
                 </div>

                 <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {credentials.map(cred => (
                         <div key={cred.id} className={`bg-white p-5 rounded-2xl shadow-sm border transition-all ${cred.isVisible ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
                             <div className="flex justify-between items-start mb-3">
                                 <div>
                                     <span className="font-bold text-lg text-gray-800 block">{cred.service}</span>
                                     <span className={`inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${cred.isVisible ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                         {cred.isVisible ? 'Ativo' : 'Oculto'}
                                     </span>
                                 </div>
                                 <div className="flex bg-gray-50 rounded-lg p-1">
                                     <button onClick={(e) => { e.stopPropagation(); toggleVisibility(cred); }} className="p-2 text-gray-500 hover:text-gray-900 hover:bg-white rounded-md transition-all"><Eye className="w-4 h-4" /></button>
                                     <button onClick={(e) => { e.stopPropagation(); handleEditCredential(cred); }} className="p-2 text-blue-500 hover:bg-white rounded-md transition-all"><Edit2 className="w-4 h-4" /></button>
                                     <button onClick={(e) => { e.stopPropagation(); setDeleteModal({open: true, type: 'credential', id: cred.id}); }} className="p-2 text-red-500 hover:bg-white rounded-md transition-all"><Trash2 className="w-4 h-4" /></button>
                                 </div>
                             </div>
                             <div className="space-y-2 bg-gray-50 p-3 rounded-xl mb-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-gray-400 uppercase">Email</span>
                                    <span className="text-sm font-mono font-bold text-gray-700 truncate max-w-[150px]">{cred.email}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-gray-400 uppercase">Senha</span>
                                    <span className="text-sm font-mono font-bold text-gray-700">{cred.password}</span>
                                </div>
                             </div>
                             <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                                 <span className="text-[10px] text-gray-400 font-bold">Criada em: {new Date(cred.publishedAt).toLocaleDateString()}</span>
                                 <button onClick={() => handleViewUsers(cred)} className="flex items-center gap-1 text-xs font-bold text-primary-600 bg-primary-50 px-2 py-1 rounded-lg hover:bg-primary-100 transition-colors">
                                     <Users className="w-3 h-3" /> {counts[cred.id] || 0} Usuários
                                 </button>
                             </div>
                         </div>
                    ))}
                 </div>
             </div>
        )}

        {/* TAB 2: CLIENTS */}
        {activeTab === 'clients' && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-4 top-3.5 h-4 w-4 text-gray-400" />
                        <input type="text" placeholder="Buscar por nome, telefone ou senha..." className="w-full bg-gray-50 text-gray-900 pl-11 pr-4 py-3 rounded-xl border-0 focus:ring-2 focus:ring-primary-500" value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} />
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleCreateDemo} disabled={loading} className="bg-purple-600 text-white px-6 py-3 rounded-xl font-bold flex items-center hover:bg-purple-700 shadow-lg shadow-purple-100 transition-transform active:scale-95">
                            {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <><Sparkles className="w-5 h-5 mr-2" /> Gerar Demo</>}
                        </button>
                        <button onClick={() => handleOpenClientModal()} className="bg-green-600 text-white px-6 py-3 rounded-xl font-bold flex items-center hover:bg-green-700 shadow-lg shadow-green-100 transition-transform active:scale-95">
                            <Plus className="w-5 h-5 mr-2" /> Novo Cliente
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-inner">
                    <table className="w-full text-sm text-left min-w-[600px]">
                        <thead className="bg-gray-50 text-gray-500 font-bold uppercase tracking-wider text-xs">
                            <tr>
                                <th className="p-4">Cliente</th>
                                <th className="p-4">Serviços</th>
                                <th className="p-4">Status / Expiração</th>
                                <th className="p-4 text-right">Opções</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                            {filteredClients.map(client => (
                                <tr key={client.id} className={`hover:bg-gray-50 transition-colors ${client.is_debtor ? 'bg-red-50' : ''}`}>
                                    <td className="p-4">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-gray-900 font-mono text-base">{client.phone_number}</span>
                                            {client.client_name && <span className="text-gray-600 text-xs font-bold">{client.client_name}</span>}
                                            <span className="text-gray-400 text-xs">Senha: {client.client_password || 'Sem senha'}</span>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex flex-wrap gap-1">
                                            {(Array.isArray(client.subscriptions) ? client.subscriptions : []).map(s => (
                                                <span key={s} className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-[10px] font-bold uppercase">{s}</span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex flex-col">
                                            <span className="font-medium text-gray-800">{new Date(client.purchase_date).toLocaleDateString('pt-BR')}</span>
                                            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wide">Plano: {client.duration_months} Mês(es)</span>
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {client.is_debtor && <span className="text-red-600 font-bold text-xs bg-red-100 px-2 rounded">Bloqueado</span>}
                                                {client.override_expiration && <span className="text-yellow-600 font-bold text-xs bg-yellow-100 px-2 rounded">Liberado</span>}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => handleQuickToggleOverride(client)} className={`p-2 rounded-lg ${client.override_expiration ? 'bg-yellow-100 text-yellow-700' : 'text-gray-400'}`} title="Liberar Acesso Vencido"><Unlock className="w-4 h-4" /></button>
                                            <button onClick={() => handleOpenClientModal(client)} className="text-blue-600 p-2"><Edit2 className="w-4 h-4" /></button>
                                            <button onClick={() => setDeleteModal({open: true, type: 'client', id: client.id})} className="text-red-600 p-2"><Trash2 className="w-4 h-4" /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {/* TAB 3: REPORTS (NEW) */}
        {activeTab === 'reports' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Expiring Soon Card */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-3 mb-6">
                         <div className="bg-yellow-100 p-3 rounded-full">
                             <Calendar className="w-6 h-6 text-yellow-600" />
                         </div>
                         <div>
                             <h3 className="font-bold text-lg text-gray-900">Radar de Vencimento</h3>
                             <p className="text-xs text-gray-500">Próximos 10 dias</p>
                         </div>
                    </div>
                    
                    <div className="space-y-3">
                        {getExpiringClients().length === 0 ? (
                            <p className="text-center text-gray-400 py-4">Ninguém vencendo por agora. Ufa!</p>
                        ) : (
                            getExpiringClients().map(c => (
                                <div key={c.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl border border-gray-200">
                                    <div className="flex flex-col">
                                        <span className="font-bold text-gray-800">{c.client_name || c.phone_number}</span>
                                        <span className="text-[10px] text-gray-500">{new Date(new Date(c.purchase_date).setMonth(new Date(c.purchase_date).getMonth() + c.duration_months)).toLocaleDateString()}</span>
                                    </div>
                                    <div className={`px-3 py-1 rounded-lg font-bold text-xs ${c.daysLeft <= 3 ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-600'}`}>
                                        {c.daysLeft <= 0 ? 'Vence Hoje!' : `${c.daysLeft} Dias`}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Status Breakdown */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                     <div className="flex items-center gap-3 mb-6">
                         <div className="bg-purple-100 p-3 rounded-full">
                             <PieChart className="w-6 h-6 text-purple-600" />
                         </div>
                         <div>
                             <h3 className="font-bold text-lg text-gray-900">Saúde da Base</h3>
                             <p className="text-xs text-gray-500">Visão geral dos clientes</p>
                         </div>
                    </div>

                    <div className="space-y-6">
                        <div>
                            <div className="flex justify-between text-sm font-bold mb-1">
                                <span className="text-green-700">Ativos ({stats.activeClients})</span>
                                <span className="text-gray-400">{Math.round((stats.activeClients / stats.totalClients) * 100)}%</span>
                            </div>
                            <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden">
                                <div className="bg-green-500 h-full" style={{width: `${(stats.activeClients / stats.totalClients) * 100}%`}}></div>
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between text-sm font-bold mb-1">
                                <span className="text-red-700">Inadimplentes ({stats.debtors})</span>
                                <span className="text-gray-400">{Math.round((stats.debtors / stats.totalClients) * 100)}%</span>
                            </div>
                            <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden">
                                <div className="bg-red-500 h-full" style={{width: `${(stats.debtors / stats.totalClients) * 100}%`}}></div>
                            </div>
                        </div>
                        
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 mt-4">
                            <p className="text-xs text-gray-500 font-bold uppercase mb-2">Previsão de Receita (MRR)</p>
                            <p className="text-3xl font-black text-gray-900">R$ {stats.totalRevenue},00</p>
                            <p className="text-[10px] text-gray-400 mt-1">*Baseado em R$ 15,00/cliente ativo</p>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* TAB 4: SYSTEM (NEW) */}
        {activeTab === 'system' && (
            <div className="grid grid-cols-1 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                     <div className="flex items-center gap-3 mb-6">
                         <div className="bg-orange-100 p-3 rounded-full">
                             <Megaphone className="w-6 h-6 text-orange-600" />
                         </div>
                         <div>
                             <h3 className="font-bold text-lg text-gray-900">Avisos Globais</h3>
                             <p className="text-xs text-gray-500">Mensagem para todos os clientes</p>
                         </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-xl">
                            <input 
                                type="checkbox" 
                                className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500"
                                checked={sysConfig.bannerActive}
                                onChange={e => setSysConfig({...sysConfig, bannerActive: e.target.checked})}
                            />
                            <span className="font-bold text-gray-700 text-sm">Ativar Banner no App</span>
                        </div>
                        
                        <input 
                            type="text" 
                            className="w-full bg-white border border-gray-300 rounded-xl p-3"
                            placeholder="Digite a mensagem (Ex: Mudança de Chave Pix...)"
                            value={sysConfig.bannerText}
                            onChange={e => setSysConfig({...sysConfig, bannerText: e.target.value})}
                        />
                        
                        <div className="flex gap-2">
                             {['info', 'warning', 'error', 'success'].map(type => (
                                 <button 
                                    key={type}
                                    onClick={() => setSysConfig({...sysConfig, bannerType: type as any})}
                                    className={`px-4 py-2 rounded-lg text-xs font-bold capitalize border-2 ${sysConfig.bannerType === type ? 'border-gray-800 bg-gray-100' : 'border-transparent bg-gray-50'}`}
                                 >
                                    {type}
                                 </button>
                             ))}
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                     <div className="flex items-center gap-3 mb-6">
                         <div className="bg-blue-100 p-3 rounded-full">
                             <Activity className="w-6 h-6 text-blue-600" />
                         </div>
                         <div>
                             <h3 className="font-bold text-lg text-gray-900">Status dos Serviços</h3>
                             <p className="text-xs text-gray-500">Informe instabilidades</p>
                         </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {Object.keys(sysConfig.serviceStatus).map(svc => (
                            <div key={svc} className="flex justify-between items-center p-4 bg-gray-50 rounded-xl border border-gray-200">
                                <span className="font-bold text-gray-800">{svc}</span>
                                <div className="flex gap-1">
                                    <button 
                                        onClick={() => setSysConfig({...sysConfig, serviceStatus: {...sysConfig.serviceStatus, [svc]: 'ok'}})}
                                        className={`p-2 rounded-lg text-xs font-bold ${sysConfig.serviceStatus[svc] === 'ok' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}
                                    >OK</button>
                                    <button 
                                        onClick={() => setSysConfig({...sysConfig, serviceStatus: {...sysConfig.serviceStatus, [svc]: 'issues'}})}
                                        className={`p-2 rounded-lg text-xs font-bold ${sysConfig.serviceStatus[svc] === 'issues' ? 'bg-yellow-500 text-white' : 'bg-gray-200 text-gray-500'}`}
                                    >Lento</button>
                                    <button 
                                        onClick={() => setSysConfig({...sysConfig, serviceStatus: {...sysConfig.serviceStatus, [svc]: 'down'}})}
                                        className={`p-2 rounded-lg text-xs font-bold ${sysConfig.serviceStatus[svc] === 'down' ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-500'}`}
                                    >OFF</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <button 
                    onClick={handleSaveSystemConfig}
                    className="w-full bg-gray-900 text-white font-bold py-4 rounded-xl hover:bg-black shadow-lg flex justify-center items-center"
                >
                    {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : 'Salvar Configurações do Sistema'}
                </button>
            </div>
        )}

        {/* TAB 5: TEST USER (Existing code moved inside conditional) */}
        {activeTab === 'test' && (
             <div className="bg-white p-6 rounded-2xl shadow-sm border border-indigo-100">
                 <div className="flex items-center gap-3 mb-6">
                     <div className="bg-indigo-100 p-3 rounded-full">
                         <TestTube className="w-6 h-6 text-indigo-600" />
                     </div>
                     <div>
                         <h3 className="text-xl font-bold text-gray-900">Configurar Teste Grátis</h3>
                         <p className="text-sm text-gray-500">Defina o que os usuários de teste podem acessar.</p>
                     </div>
                 </div>

                 <div className="bg-indigo-50 p-6 rounded-2xl mb-6 text-center">
                     <p className="text-xs text-indigo-500 font-bold uppercase mb-2">Senha Atual (Muda a cada 3 horas)</p>
                     <div className="text-4xl font-black text-indigo-900 tracking-widest bg-white inline-block px-8 py-4 rounded-xl shadow-sm border-2 border-indigo-100">
                         {getCurrentTestPassword()}
                     </div>
                     <p className="text-xs text-gray-400 mt-2">Os usuários usam esta senha para entrar.</p>
                 </div>

                 <div className="space-y-4">
                     <p className="font-bold text-gray-700">Serviços Liberados no Teste:</p>
                     <div className="flex flex-wrap gap-2">
                        {SERVICES.map(svc => (
                            <button 
                                key={svc} 
                                onClick={() => toggleTestService(svc)}
                                className={`px-4 py-2 rounded-lg text-sm font-bold border-2 transition-all ${testServices.includes(svc) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-200'}`}
                            >
                                {svc} {testServices.includes(svc) && <Check className="w-4 h-4 inline ml-1" />}
                            </button>
                        ))}
                     </div>
                     <button 
                        onClick={handleUpdateTestServices}
                        disabled={testUserLoading}
                        className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition-colors flex items-center"
                     >
                        {testUserLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : 'Salvar Configuração no Banco de Dados'}
                     </button>
                 </div>
             </div>
        )}

        {/* TAB 6: DANGER ZONE */}
        {activeTab === 'danger' && (
            <div className="bg-red-50 p-6 rounded-2xl border-2 border-red-100">
                <div className="flex items-center gap-3 mb-6">
                    <div className="bg-red-100 p-3 rounded-full">
                        <ShieldAlert className="w-8 h-8 text-red-600" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-red-900">Zona de Perigo</h2>
                        <p className="text-red-700">Ações irreversíveis.</p>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-red-200 shadow-sm">
                    <h3 className="font-bold text-lg text-gray-900 mb-2">Resetar TODAS as Senhas</h3>
                    <p className="text-sm text-gray-500 mb-4">
                        Isso removerá a senha definida por <strong>todos</strong> os clientes. Eles terão que criar uma nova senha no próximo login.
                    </p>

                    {nuclearStep === 0 && (
                        <button onClick={() => setNuclearStep(1)} className="bg-red-600 text-white font-bold py-3 px-6 rounded-xl hover:bg-red-700">
                            Iniciar Reset Geral
                        </button>
                    )}

                    {nuclearStep === 1 && (
                        <div className="space-y-3 animate-fade-in">
                            <p className="font-bold text-red-600">Digite "CONFIRMAR":</p>
                            <input 
                                type="text" 
                                className="w-full border-2 border-red-300 rounded-lg p-2 font-bold text-red-900 uppercase"
                                value={nuclearInput}
                                onChange={e => setNuclearInput(e.target.value.toUpperCase())}
                            />
                            {nuclearInput === 'CONFIRMAR' && (
                                <>
                                    <p className="font-bold text-gray-700 mt-2">Senha ADMIN:</p>
                                    <input 
                                        type="password" 
                                        className="w-full border-2 border-gray-300 rounded-lg p-2"
                                        value={adminPassInput}
                                        onChange={e => setAdminPassInput(e.target.value)}
                                    />
                                    <div className="flex gap-3 mt-4">
                                        <button onClick={() => setNuclearStep(0)} className="bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-lg">Cancelar</button>
                                        <button onClick={handleNuclearReset} disabled={nuclearLoading} className="bg-red-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-red-700 flex items-center">
                                            {nuclearLoading ? <RefreshCw className="w-4 h-4 animate-spin mr-2"/> : <Ban className="w-4 h-4 mr-2"/>}
                                            EXECUTAR RESET
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* MODALS (VIEW USERS, CLIENT FORM, DELETE) */}
        {/* VIEW USERS MODAL */}
        {viewUsersModal.open && (
            <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-8 animate-fade-in-up max-h-[90vh] overflow-y-auto relative flex flex-col">
                    <button onClick={() => setViewUsersModal({ ...viewUsersModal, open: false })} className="absolute top-6 right-6 p-2 hover:bg-gray-100 rounded-full"><X className="w-6 h-6 text-gray-400" /></button>
                    
                    <h3 className="text-xl font-extrabold text-gray-900 mb-2">Usuários Conectados</h3>
                    <p className="text-sm text-gray-500 mb-6 bg-gray-50 p-2 rounded-lg">
                        Conta: <strong>{viewUsersModal.cred?.email}</strong> <br/>
                        A distribuição é automática. Para remover um usuário desta conta, edite o cliente e remova o serviço, ou apague o cliente.
                    </p>

                    <div className="space-y-2 overflow-y-auto flex-1">
                        {viewUsersModal.users.length === 0 ? (
                            <p className="text-center text-gray-400 py-10">Nenhum usuário alocado nesta conta no momento.</p>
                        ) : (
                            viewUsersModal.users.map((u, i) => (
                                <div key={u.id || i} className="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-200">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center font-bold text-primary-700 text-xs">
                                            {i + 1}
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-900 text-sm">{u.phone_number}</p>
                                            <p className="text-xs text-gray-500">{u.client_name || 'Sem nome'}</p>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => {
                                            setViewUsersModal({...viewUsersModal, open: false});
                                            handleOpenClientModal(u);
                                        }}
                                        className="text-xs font-bold text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200"
                                    >
                                        Editar
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        )}

        {/* CLIENT FORM MODAL */}
        {clientModal.open && (
            <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-8 animate-fade-in-up max-h-[90vh] overflow-y-auto relative">
                    <button onClick={() => setClientModal({ ...clientModal, open: false })} className="absolute top-6 right-6 p-2 hover:bg-gray-100 rounded-full"><X className="w-6 h-6 text-gray-400" /></button>
                    
                    <h3 className="text-2xl font-extrabold text-gray-900 mb-6">{clientModal.isEdit ? 'Editar Cliente' : 'Novo Cliente'}</h3>
                    
                    <div className="space-y-5">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome (Apelido)</label>
                                <div className="relative">
                                    <UserIcon className="absolute left-3 top-3.5 w-4 h-4 text-gray-400" />
                                    <input type="text" className="w-full bg-gray-50 text-gray-900 border-0 rounded-xl pl-10 pr-4 py-3.5 focus:ring-2 focus:ring-primary-500" value={clientForm.client_name} onChange={e => setClientForm({...clientForm, client_name: e.target.value})} placeholder="Ex: Maria Dorameira" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Telefone (Whatsapp)</label>
                                <input type="text" className="w-full bg-gray-50 text-gray-900 border-0 rounded-xl p-3.5 focus:ring-2 focus:ring-primary-500 font-mono" value={clientForm.phone_number} onChange={e => setClientForm({...clientForm, phone_number: e.target.value})} placeholder="88999999999" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Senha Acesso</label>
                                <input type="text" className="w-full bg-gray-50 text-gray-900 border-0 rounded-xl p-3.5 focus:ring-2 focus:ring-primary-500 font-mono" value={clientForm.client_password} onChange={e => setClientForm({...clientForm, client_password: e.target.value})} placeholder="1234" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Serviços Contratados</label>
                            <div className="flex flex-wrap gap-2">
                                {SERVICES.map(svc => (
                                    <button 
                                        key={svc} 
                                        type="button"
                                        onClick={() => toggleServiceInForm(svc)}
                                        className={`px-4 py-2 rounded-lg text-xs font-bold border-2 transition-all ${clientForm.subscriptions?.includes(svc) ? 'bg-primary-600 text-white border-primary-600 shadow-md' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
                                    >
                                        {svc} {clientForm.subscriptions?.includes(svc) && <Check className="w-3 h-3 inline ml-1" />}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Data Início</label>
                                <input type="date" className="w-full bg-gray-50 text-gray-900 border-0 rounded-xl p-3.5" value={clientForm.purchase_date} onChange={e => setClientForm({...clientForm, purchase_date: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1 flex items-center"><Calendar className="w-3 h-3 mr-1" /> Plano (Duração)</label>
                                <select 
                                    className="w-full bg-gray-50 text-gray-900 border-0 rounded-xl p-3.5 focus:ring-2 focus:ring-primary-500 font-bold"
                                    value={clientForm.duration_months} 
                                    onChange={e => setClientForm({...clientForm, duration_months: parseInt(e.target.value)})}
                                >
                                    <option value={1}>1 Mês (Mensal)</option>
                                    <option value={2}>2 Meses</option>
                                    <option value={3}>3 Meses (Trimestral)</option>
                                    <option value={6}>6 Meses (Semestral)</option>
                                    <option value={12}>1 Ano (Anual)</option>
                                    <option value={999}>Vitalício / Demo</option>
                                </select>
                            </div>
                        </div>

                        <div className="space-y-3">
                             <div className="flex items-center gap-3 p-4 bg-red-50 rounded-xl border border-red-100 cursor-pointer hover:bg-red-100 transition-colors" onClick={() => setClientForm({...clientForm, is_debtor: !clientForm.is_debtor})}>
                                 <div className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${clientForm.is_debtor ? 'bg-red-600 border-red-600' : 'bg-white border-red-200'}`}>
                                     {clientForm.is_debtor && <Check className="w-4 h-4 text-white" />}
                                 </div>
                                 <span className="text-red-900 font-bold text-sm">Cliente Inadimplente (Bloquear Acesso)</span>
                             </div>

                             <div className="flex items-center gap-3 p-4 bg-yellow-50 rounded-xl border border-yellow-100 cursor-pointer hover:bg-yellow-100 transition-colors" onClick={() => setClientForm({...clientForm, override_expiration: !clientForm.override_expiration})}>
                                 <div className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${clientForm.override_expiration ? 'bg-yellow-500 border-yellow-500' : 'bg-white border-yellow-200'}`}>
                                     {clientForm.override_expiration && <Check className="w-4 h-4 text-white" />}
                                 </div>
                                 <div>
                                    <span className="text-yellow-900 font-bold text-sm block">Liberar Acesso (Vencido)</span>
                                    <span className="text-yellow-700 text-xs block">Permite ver as senhas mesmo se a data expirou.</span>
                                 </div>
                             </div>
                        </div>

                        <button onClick={handleSaveClient} className="w-full bg-gray-900 text-white font-bold py-4 rounded-xl hover:bg-black flex justify-center items-center shadow-lg mt-2">
                            {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : 'Salvar no Banco de Dados'}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* DELETE MODAL */}
        {deleteModal.open && (
            <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
                <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-bounce-in border-t-8 border-red-500">
                    <div className="flex flex-col items-center text-center space-y-4">
                        <div className="bg-red-100 p-4 rounded-full">
                            <Trash2 className="w-10 h-10 text-red-600" />
                        </div>
                        <h3 className="text-2xl font-extrabold text-gray-900">Excluir {deleteModal.type === 'client' ? 'Cliente' : 'Credencial'}?</h3>
                        <p className="text-gray-600">Esta ação remove o acesso imediatamente do sistema.</p>
                        <div className="flex gap-3 w-full pt-2">
                            <button onClick={() => setDeleteModal({ ...deleteModal, open: false })} className="flex-1 bg-gray-200 text-gray-800 font-bold py-3 rounded-xl hover:bg-gray-300">Cancelar</button>
                            <button onClick={confirmDelete} disabled={isDeleting} className="flex-1 bg-red-600 text-white font-bold py-3 rounded-xl hover:bg-red-700 flex justify-center items-center">
                                {isDeleting ? <RefreshCw className="w-5 h-5 animate-spin" /> : "Sim, Excluir"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

      </div>
    </div>
  );
};

export default AdminPanel;
