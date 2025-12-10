
import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import DoramaList from './components/DoramaList';
import SupportChat from './components/SupportChat';
import CheckoutModal from './components/CheckoutModal';
import AdminLogin from './components/AdminLogin';
import AdminPanel from './components/AdminPanel';
import NameModal from './components/NameModal';
import GamesHub from './components/GamesHub';
import Toast from './components/Toast';
import { User, Dorama } from './types';
import { addDoramaToDB, updateDoramaInDB, removeDoramaFromDB, getUserDoramasFromDB, saveGameProgress, syncDoramaBackup, addLocalDorama } from './services/clientService';
import { LayoutDashboard, Heart, PlayCircle, LogOut, X, CheckCircle2, MessageCircle, AlertTriangle, Gift, Gamepad2 } from 'lucide-react';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState<'home' | 'watching' | 'favorites' | 'games' | 'completed'>('home');
  const [isTestSession, setIsTestSession] = useState(false);
  
  // Feature States
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [checkoutType, setCheckoutType] = useState<'renewal' | 'gift' | 'new_sub'>('renewal');
  const [checkoutTargetService, setCheckoutTargetService] = useState<string | null>(null);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  // Modal State - Add / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'watching' | 'favorites' | 'completed'>('watching');
  const [editingDorama, setEditingDorama] = useState<Dorama | null>(null); // State for editing
  
  const [newDoramaName, setNewDoramaName] = useState('');
  const [newDoramaSeason, setNewDoramaSeason] = useState('1');
  const [newDoramaTotalEp, setNewDoramaTotalEp] = useState('16');
  const [newDoramaRating, setNewDoramaRating] = useState(5); // 1-5 Hearts
  
  // Modal State - DELETE
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [doramaToDelete, setDoramaToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Name Modal State
  const [showNameModal, setShowNameModal] = useState(false);

  // Auto Login Effect (User & Admin)
  useEffect(() => {
    // Check User Session
    const savedSession = localStorage.getItem('eudorama_session');
    if (savedSession) {
      try {
        const user = JSON.parse(savedSession);
        if (user && user.phoneNumber) {
          // IMMEDIATE RESYNC: Fetch fresh data from DB on load to fix "missing data" on reload
          getUserDoramasFromDB(user.phoneNumber).then(doramas => {
             const updatedUser = {
               ...user,
               watching: doramas.watching,
               favorites: doramas.favorites,
               completed: doramas.completed
             };
             // Always update session with verified DB data (even if empty, to sync deletions)
             handleLogin(updatedUser, true);
          });
        }
      } catch (e) {
        localStorage.removeItem('eudorama_session');
      }
    }

    // Check Admin Session
    const adminSession = localStorage.getItem('eudorama_admin_session');
    if (adminSession === 'true') {
        setIsAdminMode(true);
        setIsAdminLoggedIn(true);
    }
  }, []);

  // AUTO-BACKUP EFFECT: Sync lists to clients table whenever they change
  useEffect(() => {
      if (currentUser && !isTestSession && !isAdminMode) {
          syncDoramaBackup(currentUser.phoneNumber, {
              watching: currentUser.watching,
              favorites: currentUser.favorites,
              completed: currentUser.completed
          });
      }
  }, [currentUser?.watching, currentUser?.favorites, currentUser?.completed]);

  // 1-Hour Session Timer for Test Users
  useEffect(() => {
      let timer: ReturnType<typeof setTimeout>;
      if (isTestSession && currentUser) {
          timer = setTimeout(() => {
              alert('Sessão de teste expirada (1 hora).');
              handleLogout();
          }, 60 * 60 * 1000); // 1 hour
      }
      return () => clearTimeout(timer);
  }, [isTestSession, currentUser]);

  // Check for Name on Login
  useEffect(() => {
      if (currentUser && !isTestSession) {
          // If name is "Dorameira" (default) or empty, show modal
          if (currentUser.name === 'Dorameira' || !currentUser.name) {
              setShowNameModal(true);
          }
      }
  }, [currentUser, isTestSession]);

  const handleLogin = (user: User, remember: boolean = false, isTest: boolean = false) => {
    setCurrentUser(user);
    setIsTestSession(isTest);
    
    if (!isTest) {
      localStorage.setItem('eudorama_session', JSON.stringify(user));
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setActiveTab('home');
    setIsTestSession(false);
    localStorage.removeItem('eudorama_session');
  };

  const handleNameSaved = (newName: string) => {
      if (currentUser) {
          const updatedUser = { ...currentUser, name: newName };
          setCurrentUser(updatedUser);
          localStorage.setItem('eudorama_session', JSON.stringify(updatedUser));
      }
      setShowNameModal(false);
  };

  // --- ADMIN HANDLERS ---
  const handleAdminClick = () => {
    setIsAdminMode(true);
  };

  const handleAdminSuccess = (remember: boolean) => {
    setIsAdminLoggedIn(true);
    if (remember) {
        localStorage.setItem('eudorama_admin_session', 'true');
    }
  };

  const handleAdminLogout = () => {
    setIsAdminLoggedIn(false);
    setIsAdminMode(false);
    localStorage.removeItem('eudorama_admin_session');
  };

  // --- PIX HANDLER ---
  const handleOpenCheckout = (type: 'renewal' | 'gift' | 'new_sub', targetService?: string) => {
    setCheckoutType(type);
    setCheckoutTargetService(targetService || null);
    setIsCheckoutOpen(true);
  };

  // --- DORAMA ACTIONS ---
  
  const handleUpdateDorama = async (updatedDorama: Dorama) => {
    if (!currentUser) return;
    
    // Optimistic Update
    const listKey = activeTab === 'favorites' ? 'favorites' : (activeTab === 'completed' ? 'completed' : 'watching');
    
    if (activeTab === 'games' || activeTab === 'home') return; 

    const newList = currentUser[listKey as 'watching' | 'favorites' | 'completed'].map(d => d.id === updatedDorama.id ? updatedDorama : d);
    
    const newUserState = { ...currentUser, [listKey]: newList };
    setCurrentUser(newUserState);
    localStorage.setItem('eudorama_session', JSON.stringify(newUserState));

    // CRITICAL: Force update local backup cache immediately to allow self-healing on reload
    addLocalDorama(currentUser.phoneNumber, listKey as any, updatedDorama);

    // DB Call with Confirmation
    const success = await updateDoramaInDB(updatedDorama);
    if (success) {
        setToast({ message: 'Salvo com sucesso!', type: 'success' });
    } else {
        setToast({ message: 'Erro ao salvar. Verifique a conexão.', type: 'error' });
    }
  };

  const onRequestDeleteDorama = (doramaId: string) => {
    setDoramaToDelete(doramaId);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!currentUser || !doramaToDelete) return;
    
    setIsDeleting(true);
    
    // Optimistic Update
    const prevUser = { ...currentUser };
    const listKey = activeTab === 'favorites' ? 'favorites' : (activeTab === 'completed' ? 'completed' : 'watching');

    const newList = currentUser[listKey as 'watching' | 'favorites' | 'completed'].filter(d => d.id !== doramaToDelete);
    
    const newUserState = { ...currentUser, [listKey]: newList };
    setCurrentUser(newUserState);
    localStorage.setItem('eudorama_session', JSON.stringify(newUserState));

    // DB Call
    const success = await removeDoramaFromDB(doramaToDelete);
    
    setIsDeleting(false);
    setIsDeleteModalOpen(false);
    setDoramaToDelete(null);

    if (success) {
        setToast({ message: 'Dorama removido!', type: 'success' });
    } else {
        setToast({ message: 'Erro ao remover.', type: 'error' });
    }
  };

  // --- GAME ACTIONS ---
  const handleSaveGame = async (gameId: string, data: any) => {
      if (!currentUser) return;

      // 1. Update Local State & Storage
      const newProgress = { ...currentUser.gameProgress, [gameId]: data };
      const updatedUser = { ...currentUser, gameProgress: newProgress };
      setCurrentUser(updatedUser);
      localStorage.setItem('eudorama_session', JSON.stringify(updatedUser));

      // 2. Save to Supabase
      await saveGameProgress(currentUser.phoneNumber, gameId, data);
  };

  // --- CONTENT RENDERING ---

  if (isAdminMode) {
    if (isAdminLoggedIn) {
      return <AdminPanel onLogout={handleAdminLogout} />;
    }
    return <AdminLogin onSuccess={handleAdminSuccess} onBack={() => setIsAdminMode(false)} />;
  }

  if (!currentUser) {
    return <Login onLogin={handleLogin} onAdminClick={handleAdminClick} />;
  }

  const openAddModal = (type: 'watching' | 'favorites' | 'completed') => {
    setModalType(type);
    setEditingDorama(null); // Clear editing state
    setNewDoramaName('');
    setNewDoramaSeason('1');
    setNewDoramaTotalEp('16');
    setNewDoramaRating(5);
    setIsModalOpen(true);
  };

  const openEditModal = (dorama: Dorama) => {
    // Determine type based on active tab
    if (activeTab === 'games' || activeTab === 'home') return;
    
    setModalType(activeTab); 
    setEditingDorama(dorama);
    setNewDoramaName(dorama.title);
    setNewDoramaSeason(dorama.season ? dorama.season.toString() : '1');
    setNewDoramaTotalEp(dorama.totalEpisodes ? dorama.totalEpisodes.toString() : '16');
    setNewDoramaRating(dorama.rating || 5);
    setIsModalOpen(true);
  };

  const saveDorama = async () => {
    if (!currentUser || !newDoramaName.trim()) return;

    let status: Dorama['status'] = 'Watching';
    if (modalType === 'favorites') status = 'Plan to Watch';
    if (modalType === 'completed') status = 'Completed';

    // Capture values from inputs (Editing OR Creating)
    const season = parseInt(newDoramaSeason) || 1;
    const total = parseInt(newDoramaTotalEp) || 16;
    const rating = newDoramaRating;

    if (editingDorama) {
        // UPDATE MODE
        const updated: Dorama = {
            ...editingDorama,
            title: newDoramaName,
            season: season,
            totalEpisodes: total,
            rating: rating
        };
        
        setIsModalOpen(false);
        await handleUpdateDorama(updated);

    } else {
        // CREATE MODE
        const tempDorama: Dorama = {
          id: 'temp-' + Date.now(), 
          title: newDoramaName,
          genre: 'Drama',
          thumbnail: `https://ui-avatars.com/api/?name=${newDoramaName}&background=random&size=128`,
          status: status,
          episodesWatched: modalType === 'completed' ? total : 1, // Start at Ep 1 if adding to watching
          totalEpisodes: total,
          season: season,
          rating: rating
        };
    
        setIsModalOpen(false);
    
        // Optimistic UI update (shows immediately)
        setCurrentUser(prev => {
            if (!prev) return null;
            const newState = {
              ...prev,
              [modalType]: [...prev[modalType], tempDorama]
            };
            localStorage.setItem('eudorama_session', JSON.stringify(newState));
            return newState;
        });

        // DB Insert
        const createdDorama = await addDoramaToDB(currentUser.phoneNumber, modalType, tempDorama);
    
        if (createdDorama) {
          setToast({ message: 'Adicionado com sucesso!', type: 'success' });
          // Replace temporary item with real DB item (ID fix)
          setCurrentUser(prev => {
            if (!prev) return null;
            const updatedList = prev[modalType].map(d => 
                d.id === tempDorama.id ? createdDorama : d
            );
            const newState = { ...prev, [modalType]: updatedList };
            localStorage.setItem('eudorama_session', JSON.stringify(newState));
            return newState;
          });
        } else {
          setToast({ message: 'Erro ao salvar no banco.', type: 'error' });
        }
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return <Dashboard 
                  user={currentUser} 
                  onOpenSupport={() => setIsSupportOpen(true)} 
                  onOpenDoraminha={() => {}} // Deprecated
                  onOpenCheckout={handleOpenCheckout}
                  onOpenGame={() => setActiveTab('games')}
               />;
      case 'watching':
        return (
          <DoramaList 
            title="Assistindo Agora" 
            doramas={currentUser.watching} 
            type="watching" 
            onAdd={() => openAddModal('watching')}
            onUpdate={handleUpdateDorama}
            onDelete={onRequestDeleteDorama}
            onEdit={openEditModal}
          />
        );
      case 'favorites':
        return (
          <DoramaList 
            title="Meus Favoritos" 
            doramas={currentUser.favorites} 
            type="favorites" 
            onAdd={() => openAddModal('favorites')}
            onUpdate={handleUpdateDorama}
            onDelete={onRequestDeleteDorama}
            onEdit={openEditModal}
          />
        );
      case 'completed':
          return (
            <DoramaList 
              title="Doramas Finalizados" 
              doramas={currentUser.completed} 
              type="completed" 
              onAdd={() => openAddModal('completed')}
              onUpdate={handleUpdateDorama}
              onDelete={onRequestDeleteDorama}
              onEdit={openEditModal}
            />
          );
      case 'games':
        return <GamesHub user={currentUser} onSaveGame={handleSaveGame} />;
      default:
        return null;
    }
  };

  const getModalTitle = () => {
    if (editingDorama) return 'Editar Dorama';
    switch (modalType) {
      case 'watching': return 'O que está vendo?';
      case 'favorites': return 'Novo Favorito';
      case 'completed': return 'Dorama Finalizado';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 max-w-lg mx-auto shadow-2xl relative overflow-hidden flex flex-col font-sans">
      {isTestSession && (
         <div className="bg-indigo-600 text-white text-xs text-center py-1 font-bold z-50 sticky top-0">
             MODO TESTE GRÁTIS - SESSÃO ENCERRA EM BREVE
         </div>
      )}
      
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Top Bar */}
      <div className="bg-white p-4 shadow-sm flex justify-between items-center z-30 sticky top-0 border-b border-gray-200 shrink-0">
          <h1 className="text-xl font-extrabold text-primary-700 tracking-tight">
            Clientes EuDorama
          </h1>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gray-200 overflow-hidden border-2 border-primary-200">
              <img src={`https://ui-avatars.com/api/?name=${currentUser.name || 'Dorama'}&background=fbcfe8&color=be185d`} alt="Profile" />
            </div>
            <button 
              onClick={handleLogout}
              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
              title="Sair do aplicativo"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

      <main className={`flex-1 relative bg-gray-50 overflow-hidden pb-24`}>
           <div className="h-full overflow-y-auto scrollbar-hide p-4">{renderContent()}</div>
      </main>

      {/* SUPPORT CHAT OVERLAY (FULL SCREEN) - FIXED POSITION */}
      {isSupportOpen && (
          <div className="fixed inset-0 z-[60] bg-white animate-slide-up">
              <SupportChat 
                  user={currentUser} 
                  onClose={() => setIsSupportOpen(false)} 
              />
          </div>
      )}

      {/* NAME MODAL (Forced) */}
      {showNameModal && (
          <NameModal user={currentUser} onNameSaved={handleNameSaved} />
      )}

      {/* CHECKOUT MODAL */}
      {isCheckoutOpen && (
        <CheckoutModal 
            onClose={() => setIsCheckoutOpen(false)} 
            user={currentUser}
            type={checkoutType}
            targetService={checkoutTargetService || undefined}
        />
      )}

      {/* FLOATING ACTION BUTTONS (Only when chats/game are closed) */}
      {!isSupportOpen && !isCheckoutOpen && activeTab !== 'games' && !showNameModal && (
        <div className="fixed bottom-24 right-4 z-40 flex flex-col gap-3 items-center pointer-events-none">
            
            {/* Wrapper to allow pointer events on buttons only */}
            <div className="pointer-events-auto flex flex-col gap-3 items-end">
                
                {/* Christmas Box Button */}
                <div className="relative group">
                   <div className="absolute right-full mr-2 top-1/2 -translate-y-1/2 bg-white px-2 py-1 rounded-lg text-xs font-bold shadow-md text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                       Contribua com nossa caixinha de natal
                   </div>
                   <button 
                        onClick={() => handleOpenCheckout('gift')}
                        className="w-11 h-11 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-110 border-2 border-white animate-bounce"
                        title="Contribua com nossa caixinha de natal"
                    >
                        <Gift className="w-5 h-5" />
                    </button>
                </div>

                {/* WhatsApp Button */}
                <div className="relative group">
                    <div className="absolute right-full mr-2 top-1/2 -translate-y-1/2 bg-white px-2 py-1 rounded-lg text-xs font-bold shadow-md text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                       Suporte Técnico
                    </div>
                    <a 
                        href="https://wa.me/558894875029?text=Ol%C3%A1!%20Preciso%20de%20ajuda%20com%20o%20Cliente%20EuDorama."
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-11 h-11 bg-green-500 hover:bg-green-600 text-white rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-110 border-2 border-white"
                        title="Fale com o Suporte"
                    >
                        <MessageCircle className="w-5 h-5" />
                    </a>
                </div>
            </div>
        </div>
      )}

      {/* MODAL ADICIONAR / EDITAR */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-fade-in-up">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">
                {getModalTitle()}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 bg-gray-100 rounded-full">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Nome do Dorama</label>
                    <input 
                      autoFocus
                      className="w-full bg-white text-gray-900 border-2 border-gray-300 rounded-xl p-3 text-base focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none placeholder-gray-400"
                      placeholder="Digite o nome..."
                      value={newDoramaName}
                      onChange={(e) => setNewDoramaName(e.target.value)}
                    />
                </div>
                
                {/* 
                   MODIFIED: Inputs for Season/Ep ONLY shown when EDITING (editingDorama is not null).
                   When adding new, we use defaults to simplify the UX.
                */}
                {(modalType === 'watching' || modalType === 'completed') && editingDorama && (
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Temporada</label>
                            <input 
                              type="number"
                              className="w-full bg-white text-gray-900 border-2 border-gray-300 rounded-xl p-3 text-base text-center focus:border-primary-500 outline-none"
                              value={newDoramaSeason}
                              onChange={(e) => setNewDoramaSeason(e.target.value)}
                              min="1"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Total Ep.</label>
                            <input 
                              type="number"
                              className="w-full bg-white text-gray-900 border-2 border-gray-300 rounded-xl p-3 text-base text-center focus:border-primary-500 outline-none"
                              value={newDoramaTotalEp}
                              onChange={(e) => setNewDoramaTotalEp(e.target.value)}
                              min="1"
                              max="999"
                            />
                        </div>
                    </div>
                )}

                {/* Rating for Favorites */}
                {modalType === 'favorites' && (
                    <div className="text-center">
                        <label className="block text-sm font-bold text-gray-700 mb-2">Sua Avaliação (Corações)</label>
                        <div className="flex justify-center gap-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    onClick={() => setNewDoramaRating(star)}
                                    className="p-1 focus:outline-none transform hover:scale-110 transition-transform"
                                >
                                    <Heart 
                                        className={`w-8 h-8 ${star <= newDoramaRating ? 'text-red-500 fill-red-500' : 'text-gray-300'}`} 
                                    />
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <button 
                  onClick={saveDorama}
                  className="w-full bg-primary-600 text-white font-bold text-base py-3.5 rounded-xl hover:bg-primary-700 transition-colors shadow-lg mt-2"
                >
                  {editingDorama ? 'Salvar Alterações' : 'Salvar Novo'}
                </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EXCLUIR */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-bounce-in border-t-8 border-red-500">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="bg-red-100 p-4 rounded-full">
                 <AlertTriangle className="w-10 h-10 text-red-600" />
              </div>
              
              <h3 className="text-xl font-extrabold text-gray-900">
                Tem certeza?
              </h3>
              <p className="text-gray-600 text-sm">
                Isso apagará este dorama e todo o seu progresso da lista. <br/>
                <span className="font-bold text-red-600">Essa ação não pode ser desfeita.</span>
              </p>

              <div className="flex gap-3 w-full pt-2">
                <button 
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="flex-1 bg-gray-200 text-gray-800 font-bold py-3 rounded-xl hover:bg-gray-300 transition-colors text-sm"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  className="flex-1 bg-red-600 text-white font-bold py-3 rounded-xl hover:bg-red-700 transition-colors flex justify-center items-center shadow-lg text-sm"
                >
                  {isDeleting ? "Excluindo..." : "Sim, Excluir"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BOTTOM NAV */}
      <nav className="bg-white border-t border-gray-200 flex justify-around items-center pb-4 pt-3 px-2 absolute bottom-0 w-full z-40 h-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] text-xs">
        <button 
          onClick={() => setActiveTab('home')}
          className={`flex flex-col items-center space-y-1 w-1/5 ${activeTab === 'home' ? 'text-primary-700' : 'text-gray-400'}`}
        >
          <LayoutDashboard className={`w-6 h-6 ${activeTab === 'home' ? 'fill-current opacity-20' : ''}`} />
          <span className="font-bold uppercase tracking-tight text-[10px]">Início</span>
        </button>

        <button 
          onClick={() => setActiveTab('watching')}
          className={`flex flex-col items-center space-y-1 w-1/5 ${activeTab === 'watching' ? 'text-primary-700' : 'text-gray-400'}`}
        >
          <PlayCircle className={`w-6 h-6 ${activeTab === 'watching' ? 'fill-current opacity-20' : ''}`} />
          <span className="font-bold uppercase tracking-tight text-[10px]">Assistindo</span>
        </button>

        <button 
          onClick={() => setActiveTab('games')}
          className={`flex flex-col items-center space-y-1 w-1/5 transform -translate-y-3 ${activeTab === 'games' ? 'text-primary-700' : 'text-gray-400'}`}
        >
          <div className={`rounded-full p-3 shadow-lg border-4 border-white transition-all ${activeTab === 'games' ? 'bg-primary-700 scale-105' : 'bg-primary-600'}`}>
             <Gamepad2 className="w-6 h-6 text-white" />
          </div>
          <span className="font-bold uppercase tracking-tight text-[10px] mt-1">Jogos</span>
        </button>

        <button 
          onClick={() => setActiveTab('favorites')}
          className={`flex flex-col items-center space-y-1 w-1/5 ${activeTab === 'favorites' ? 'text-primary-700' : 'text-gray-400'}`}
        >
          <Heart className={`w-6 h-6 ${activeTab === 'favorites' ? 'fill-current' : ''}`} />
          <span className="font-bold uppercase tracking-tight text-[10px]">Amei</span>
        </button>

        <button 
          onClick={() => setActiveTab('completed')} 
          className={`flex flex-col items-center space-y-1 w-1/5 ${activeTab === 'completed' ? 'text-primary-700' : 'text-gray-400'}`}
        >
          <CheckCircle2 className={`w-6 h-6 ${activeTab === 'completed' ? 'text-primary-700' : ''}`} />
          <span className="font-bold uppercase tracking-tight text-[10px]">Fim</span>
        </button>
      </nav>
    </div>
  );
};

export default App;
