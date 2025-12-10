
import React, { useEffect, useState } from 'react';
import { User, AppCredential } from '../types';
import { getAssignedCredential } from '../services/credentialService';
import { getSystemConfig, SystemConfig } from '../services/clientService';
import { CheckCircle, AlertCircle, Tv, Copy, RefreshCw, Check, AlertTriangle, Lock, Bot, Wrench, CreditCard, Upload, ChevronRight, HeartHandshake, Star, Cast, Gamepad2, Info, Sparkles, Rocket, ArrowRight, Bell, Megaphone, Calendar, Clock, X, ShoppingBag, MessageCircle } from 'lucide-react';
import NewsCarousel from './NewsCarousel';

interface DashboardProps {
  user: User;
  onOpenSupport: () => void;
  onOpenDoraminha: () => void; 
  onOpenCheckout: (type: 'renewal' | 'gift' | 'new_sub', targetService?: string) => void;
  onOpenGame: () => void;
}

const SERVICE_CATALOG = [
    {
        id: 'Viki Pass',
        name: 'Viki Pass',
        benefits: ['Doramas Exclusivos', 'Sem Anúncios', 'Alta Qualidade (HD)', 'Acesso Antecipado'],
        price: 'R$ 19,90',
        color: 'from-blue-500 to-cyan-500'
    },
    {
        id: 'Kocowa+',
        name: 'Kocowa+',
        benefits: ['Shows de K-Pop Ao Vivo', 'Reality Shows Coreanos', 'Legendas Super Rápidas', '100% Coreano'],
        price: 'R$ 14,90',
        color: 'from-yellow-400 to-orange-400'
    },
    {
        id: 'IQIYI',
        name: 'IQIYI',
        benefits: ['Doramas Chineses (C-Drama)', 'Animes e BLs Exclusivos', 'Qualidade 4K e Dolby', 'Catálogo Gigante'],
        price: 'R$ 14,90',
        color: 'from-green-500 to-emerald-600'
    },
    {
        id: 'WeTV',
        name: 'WeTV',
        benefits: ['Séries Tencent Video', 'Mini Doramas Viciantes', 'Variedades Asiáticas', 'Dublagem em Português'],
        price: 'R$ 14,90',
        color: 'from-orange-500 to-red-500'
    },
    {
        id: 'DramaBox',
        name: 'DramaBox',
        benefits: ['Doramas Verticais (Shorts)', 'Episódios de 1 minuto', 'Histórias Intensas', 'Ideal para Celular'],
        price: 'R$ 14,90',
        color: 'from-pink-500 to-rose-600'
    }
];

const Dashboard: React.FC<DashboardProps> = ({ user, onOpenSupport, onOpenCheckout, onOpenGame }) => {
  const [assignedCredentials, setAssignedCredentials] = useState<{service: string, cred: AppCredential | null, alert: string | null}[]>([]);
  const [loadingCreds, setLoadingCreds] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showStarInfo, setShowStarInfo] = useState(false);
  const [sysConfig, setSysConfig] = useState<SystemConfig | null>(null);
  
  // Service Detail Modal State
  const [selectedService, setSelectedService] = useState<any | null>(null);

  // Date Logic (General/Best Status for Main Card)
  let purchaseDate = new Date(user.purchaseDate);
  if (isNaN(purchaseDate.getTime())) purchaseDate = new Date();
  
  const expiryDate = new Date(purchaseDate);
  expiryDate.setMonth(purchaseDate.getMonth() + user.durationMonths);
  
  const now = new Date();
  const isExpired = now > expiryDate;
  
  // Logic: Active if (Not Expired AND Not Debtor) OR (Admin Overrides Expiration)
  const isActive = (!isExpired && !user.isDebtor) || user.overrideExpiration;
  
  const diffTime = expiryDate.getTime() - now.getTime();
  const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  // Alerts Logic
  const isCritical = !isExpired && daysLeft <= 2; // Critical warning (2 days or less)
  const isExpiringSoon = !isExpired && daysLeft <= 5 && daysLeft > 2; // Warning (5 days)

  // Check if it is a Demo User (Starts with 99999) OR Test User (00000000000)
  const isDemoUser = user.phoneNumber.startsWith('99999') || user.phoneNumber === '00000000000';

  // Stars Logic
  const completedCount = user.completed?.length || 0;
  const starsCount = Math.floor(completedCount / 10);
  const nextStarTarget = (starsCount + 1) * 10;
  const progressToNextStar = completedCount % 10;

  // Filter Missing Services
  const userServicesLower = user.services.map(s => s.toLowerCase());
  const missingServices = SERVICE_CATALOG.filter(s => !userServicesLower.some(us => us.includes(s.id.toLowerCase())));

  useEffect(() => {
    const loadCreds = async () => {
      setLoadingCreds(true);
      
      // Load System Config first
      const conf = await getSystemConfig();
      setSysConfig(conf);

      // Carrega a lista de serviços.
      // Se NÃO estiver ativo (devedor ou vencido), NÃO buscamos a credencial real no banco por segurança e lógica de negócio.
      // Apenas montamos a estrutura para exibir o card de bloqueio.
      const results = await Promise.all(user.services.map(async (service) => {
        if (!isActive) {
            // Retorna estrutura "vazia" de credencial para acionar o layout de bloqueio
            return { service, cred: null, alert: 'blocked' };
        }
        
        // Se estiver ativo, busca a credencial real
        const result = await getAssignedCredential(user, service);
        return { service, cred: result.credential, alert: result.alert };
      }));
      
      setAssignedCredentials(results);
      setLoadingCreds(false);
    };
    loadCreds();
  }, [user, isActive]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatDate = (date: Date) => {
      try { return date.toLocaleDateString('pt-BR'); } catch (e) { return 'Data Inválida'; }
  };
  
  const handleServiceClick = (serviceName: string) => {
      let details = SERVICE_CATALOG.find(s => 
          serviceName.toLowerCase().includes(s.id.toLowerCase())
      );
      
      if (!details) {
          // Fallback generic info
          details = {
              id: serviceName,
              name: serviceName,
              benefits: ['Acesso total ao catálogo', 'Assista em alta qualidade'],
              price: 'Consulte',
              color: 'from-gray-500 to-gray-700'
          };
      }

      // **CRITICAL FIX**: Find specific date for this service from user's detailed map
      const specificData = user.subscriptionDetails ? user.subscriptionDetails[serviceName] : null;
      
      let finalPurchaseDate = user.purchaseDate;
      let finalDuration = user.durationMonths;

      if (specificData) {
          finalPurchaseDate = specificData.purchaseDate;
          finalDuration = specificData.durationMonths;
      }

      setSelectedService({
          ...details,
          specificPurchaseDate: finalPurchaseDate,
          specificDuration: finalDuration
      });
  };
  
  const whatsappProofLink = `https://wa.me/558894875029?text=${encodeURIComponent(`Olá! Segue meu comprovante de pagamento (Print ou PDF) para o telefone ${user.phoneNumber}.`)}`;

  const getBannerColor = (type: string) => {
      switch(type) {
          case 'warning': return 'bg-yellow-50 text-yellow-800 border-yellow-200';
          case 'error': return 'bg-red-50 text-red-800 border-red-200';
          case 'success': return 'bg-green-50 text-green-800 border-green-200';
          default: return 'bg-blue-50 text-blue-800 border-blue-200';
      }
  };

  // --- HELPER FOR MODAL DATES ---
  const getModalDates = () => {
      if (!selectedService) return { purchase: new Date(), expiry: new Date(), isExpired: false };
      
      const pDate = new Date(selectedService.specificPurchaseDate);
      const eDate = new Date(pDate);
      eDate.setMonth(pDate.getMonth() + selectedService.specificDuration);
      
      return { 
          purchase: pDate, 
          expiry: eDate,
          isExpired: new Date() > eDate
      };
  };

  return (
    <div className="space-y-6 pb-32 relative">
      
      {/* HEADER COMPACTO E MODERNO */}
      <div className="flex justify-between items-center px-1 pt-2">
          <div>
              <h1 className="text-2xl font-black text-gray-900 tracking-tight">Olá, {user.name}</h1>
              <p className="text-xs text-gray-500 font-medium">Bem-vinda de volta!</p>
          </div>
          
          {/* STARS BADGE */}
          <div 
              className="bg-white shadow-md rounded-2xl p-2 flex items-center gap-2 border border-gray-100 cursor-pointer active:scale-95 transition-transform relative group"
              onClick={() => setShowStarInfo(true)}
          >
              <div className="bg-yellow-100 p-2 rounded-full animate-bounce shadow-[0_0_15px_rgba(250,204,21,0.6)]">
                  <Star className="w-5 h-5 text-yellow-600 fill-yellow-500" />
              </div>
              <div>
                  <span className="text-lg font-black text-gray-800 leading-none block">{starsCount}</span>
                  <span className="text-[8px] uppercase font-bold text-gray-400 leading-none">Estrelas</span>
              </div>
          </div>
      </div>
      
      {/* STAR INFO MODAL */}
      {showStarInfo && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
              <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl relative border-4 border-yellow-100">
                  <button 
                      onClick={() => setShowStarInfo(false)}
                      className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200"
                  >
                      <X className="w-5 h-5" />
                  </button>
                  
                  <div className="text-center space-y-4">
                      <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(250,204,21,0.5)] animate-pulse">
                          <Star className="w-10 h-10 text-yellow-600 fill-yellow-500 animate-spin-slow" />
                      </div>
                      
                      <h2 className="text-2xl font-black text-gray-900">Sistema de Estrelas</h2>
                      
                      <div className="bg-yellow-50 p-4 rounded-2xl border border-yellow-200 text-left space-y-3">
                          <p className="text-sm font-bold text-yellow-800 flex items-start">
                              <span className="bg-yellow-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs mr-2 flex-shrink-0 mt-0.5">1</span>
                              Como ganhar?
                          </p>
                          <p className="text-xs text-yellow-700 pl-7">
                              A cada <strong>10 doramas</strong> que você move para a lista de "Finalizados" (Fim), você ganha 1 Estrela Brilhante!
                          </p>
                      </div>

                      <div className="pt-2">
                          <p className="text-xs text-gray-400 font-bold uppercase mb-1">Seu Progresso Atual</p>
                          <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden">
                              <div 
                                  className="bg-yellow-500 h-full transition-all duration-1000" 
                                  style={{width: `${(progressToNextStar / 10) * 100}%`}}
                              ></div>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">Faltam {10 - progressToNextStar} doramas para a próxima estrela!</p>
                      </div>

                      <button 
                          onClick={() => setShowStarInfo(false)}
                          className="w-full bg-yellow-500 text-white font-bold py-3 rounded-xl hover:bg-yellow-600 transition-transform active:scale-95 shadow-lg shadow-yellow-200"
                      >
                          Entendi!
                      </button>
                  </div>
              </div>
          </div>
      )}
      
      {/* SERVICE DETAIL MODAL */}
      {selectedService && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
              <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl relative overflow-hidden flex flex-col">
                  {/* Color Header */}
                  <div className={`h-32 bg-gradient-to-r ${selectedService.color} relative p-6 flex flex-col justify-end`}>
                      <button 
                          onClick={() => setSelectedService(null)}
                          className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/40 rounded-full text-white backdrop-blur-md"
                      >
                          <X className="w-5 h-5" />
                      </button>
                      <h2 className="text-3xl font-black text-white drop-shadow-md">{selectedService.name}</h2>
                  </div>
                  
                  <div className="p-6 space-y-6">
                      {/* DATES INFO - SPECIFIC FOR THIS SERVICE */}
                      {(() => {
                          const { purchase, expiry, isExpired: svcExpired } = getModalDates();
                          return (
                              <div className="grid grid-cols-2 gap-3">
                                   <div className="bg-gray-50 p-3 rounded-2xl border border-gray-100 text-center">
                                       <p className="text-[10px] text-gray-400 font-bold uppercase mb-1 flex items-center justify-center gap-1">
                                           <Calendar className="w-3 h-3"/> Data da Compra
                                       </p>
                                       <p className="text-sm font-black text-gray-800">{formatDate(purchase)}</p>
                                   </div>
                                   <div className="bg-gray-50 p-3 rounded-2xl border border-gray-100 text-center">
                                       <p className="text-[10px] text-gray-400 font-bold uppercase mb-1 flex items-center justify-center gap-1">
                                           <Clock className="w-3 h-3"/> Vencimento
                                       </p>
                                       <p className={`text-sm font-black ${svcExpired ? 'text-red-600' : 'text-gray-800'}`}>{formatDate(expiry)}</p>
                                   </div>
                              </div>
                          );
                      })()}

                      <div>
                          <h3 className="text-sm font-bold text-gray-400 uppercase mb-3">Benefícios Inclusos</h3>
                          <ul className="space-y-3">
                              {selectedService.benefits && selectedService.benefits.map((benefit: string, idx: number) => (
                                  <li key={idx} className="flex items-start text-gray-700 font-medium text-sm">
                                      <CheckCircle className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" />
                                      {benefit}
                                  </li>
                              ))}
                          </ul>
                      </div>
                      
                      <div className="pt-2">
                          <p className="text-[10px] text-center text-gray-400 mb-3">Este serviço faz parte do seu pacote.</p>
                          <button 
                              onClick={() => setSelectedService(null)}
                              className="w-full bg-gray-900 text-white font-bold py-3.5 rounded-xl hover:bg-black transition-transform active:scale-95"
                          >
                              Fechar Detalhes
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* SYSTEM GLOBAL BANNER */}
      {sysConfig?.bannerActive && sysConfig.bannerText && (
          <div className={`mx-2 p-4 rounded-xl border flex items-start gap-3 shadow-sm ${getBannerColor(sysConfig.bannerType)}`}>
              <Megaphone className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                  <p className="font-bold text-sm leading-tight">{sysConfig.bannerText}</p>
              </div>
          </div>
      )}

      {/* CARROSSEL DE NOTÍCIAS (HERO SECTION) */}
      <div className="px-1">
          <NewsCarousel />
      </div>

      <div className="px-2 space-y-6">
        
        {/* STATUS DA ASSINATURA (CARTÃO DETALHADO - AGORA COM LISTA DE DATAS) */}
        <div className={`rounded-3xl p-5 shadow-sm border-2 overflow-hidden relative ${!isActive ? 'bg-red-50 border-red-200' : (isCritical ? 'bg-red-50 border-red-200' : (isExpiringSoon ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-100'))}`}>
             
             {/* Alert Overlay */}
             {!isActive && (
                 <div className="absolute top-0 left-0 w-full bg-red-600 text-white text-[10px] font-bold uppercase py-1 text-center">
                     ⚠️ Acesso Parcialmente Restrito
                 </div>
             )}
             {isActive && isCritical && (
                 <div className="absolute top-0 left-0 w-full bg-red-600 text-white text-[10px] font-bold uppercase py-1 text-center animate-pulse">
                     ⚠️ Ação Necessária: Vence em menos de 2 dias!
                 </div>
             )}

             <div className="flex justify-between items-start mb-4 mt-3">
                 <div className="flex items-center gap-3">
                     <div className={`p-2.5 rounded-xl ${!isActive ? 'bg-red-200 text-red-700' : (isCritical ? 'bg-red-200 text-red-700' : (isExpiringSoon ? 'bg-orange-200 text-orange-700' : 'bg-green-100 text-green-700'))}`}>
                         <CreditCard className="w-6 h-6" />
                     </div>
                     <div>
                         <h3 className="font-bold text-gray-900 text-lg leading-none">Suas Assinaturas</h3>
                         <p className={`text-xs font-bold mt-1 ${!isActive ? 'text-red-700' : (isCritical ? 'text-red-600' : (isExpiringSoon ? 'text-orange-600' : 'text-green-600'))}`}>
                             {!isActive ? (user.isDebtor ? 'Conta Pendente' : 'Plano Vencido') : (isCritical ? 'Vencimento Crítico' : (isExpiringSoon ? 'Renovação Próxima' : 'Status Ativo'))}
                         </p>
                     </div>
                 </div>
                 {(!isActive || isCritical) && (
                     <button 
                        onClick={() => onOpenCheckout('renewal')}
                        className="bg-red-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg shadow-md animate-bounce"
                     >
                        RENOVAR
                     </button>
                 )}
             </div>

             {/* DETAILED SERVICES LIST WITH DATES */}
             <div className="space-y-2">
                 {user.services.length > 0 ? user.services.map((svc, i) => {
                     // Calcular datas específicas por serviço
                     const svcDetails = user.subscriptionDetails ? user.subscriptionDetails[svc] : null;
                     const svcPurchase = svcDetails ? new Date(svcDetails.purchaseDate) : purchaseDate;
                     const svcDuration = svcDetails ? svcDetails.durationMonths : user.durationMonths;
                     
                     const svcExpiry = new Date(svcPurchase);
                     svcExpiry.setMonth(svcPurchase.getMonth() + svcDuration);
                     
                     const isThisExpired = new Date() > svcExpiry && !user.overrideExpiration;

                     return (
                         <div 
                            key={i} 
                            onClick={() => handleServiceClick(svc)}
                            className={`p-3 rounded-xl border shadow-sm flex flex-col gap-2 cursor-pointer transition-colors ${isThisExpired ? 'bg-red-50 border-red-200' : 'bg-white/80 border-gray-200 hover:border-primary-300'}`}
                         >
                             <div className={`flex justify-between items-center border-b pb-2 mb-1 ${isThisExpired ? 'border-red-100' : 'border-gray-100'}`}>
                                 <div className="flex items-center gap-2">
                                     <div className={`w-2.5 h-2.5 rounded-full ${isThisExpired ? 'bg-red-500' : 'bg-green-500'}`}></div>
                                     <span className={`font-bold text-sm ${isThisExpired ? 'text-red-900' : 'text-gray-800'}`}>{svc}</span>
                                     {isThisExpired && <span className="bg-red-200 text-red-800 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase">Vencido</span>}
                                 </div>
                                 <div className="text-right">
                                     <span className={`text-[10px] font-bold uppercase ${isThisExpired ? 'text-red-500' : 'text-gray-400'}`}>
                                         {isThisExpired ? 'Venceu em' : 'Vence em'}
                                     </span>
                                     <p className={`text-xs font-bold leading-none ${isThisExpired ? 'text-red-700' : 'text-gray-700'}`}>
                                         {formatDate(svcExpiry)}
                                     </p>
                                 </div>
                             </div>
                             <div className="flex justify-between text-[10px] text-gray-500 px-1">
                                 <span>Início: <strong className="text-gray-700">{formatDate(svcPurchase)}</strong></span>
                                 <span>Plano: <strong className="text-gray-700">{svcDuration} Mês(es)</strong></span>
                             </div>
                         </div>
                     );
                 }) : (
                     <p className="text-xs text-gray-400 italic text-center p-2">Nenhum serviço ativo encontrado.</p>
                 )}
             </div>
        </div>

        {/* MENU RÁPIDO (GRID) */}
        <div className="grid grid-cols-2 gap-3">
            <button
                onClick={onOpenSupport}
                className="col-span-2 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-4 flex items-center justify-between shadow-lg shadow-blue-200 text-white relative overflow-hidden group active:scale-[0.98] transition-all"
            >
                <div className="relative z-10 flex items-center gap-3">
                    <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
                        <Cast className="w-6 h-6" />
                    </div>
                    <div className="text-left">
                        <h3 className="font-bold text-lg leading-tight">Conecte na sua TV ou celular</h3>
                        <p className="text-blue-100 text-xs mt-1">Guia passo a passo</p>
                    </div>
                </div>
                <ChevronRight className="w-5 h-5 text-white/70 group-hover:translate-x-1 transition-transform" />
                <Tv className="absolute -right-2 -bottom-4 w-24 h-24 text-white opacity-10 rotate-12" />
            </button>

            <button 
                onClick={onOpenGame} 
                className="bg-white border border-pink-100 p-4 rounded-2xl flex flex-col items-center justify-center gap-2 shadow-sm active:scale-95 transition-all hover:bg-pink-50"
            >
                <div className="bg-pink-50 p-3 rounded-full text-pink-500">
                    <Gamepad2 className="w-6 h-6" />
                </div>
                <span className="font-bold text-gray-700 text-sm">Jogos</span>
            </button>

            <button 
                onClick={() => onOpenCheckout('renewal')} 
                className="bg-white border border-green-100 p-4 rounded-2xl flex flex-col items-center justify-center gap-2 shadow-sm active:scale-95 transition-all hover:bg-green-50"
            >
                <div className="bg-green-50 p-3 rounded-full text-green-600">
                    <ShoppingBag className="w-6 h-6" />
                </div>
                <span className="font-bold text-gray-700 text-xs text-center leading-tight">Compras e<br/>renovações</span>
            </button>
        </div>

        {/* ACCESS CREDENTIALS */}
        <div className="space-y-4 pt-2">
             <div className="flex items-center justify-between px-1">
                <h2 className="text-lg font-extrabold text-gray-800 flex items-center">
                  <div className="w-1 h-6 bg-primary-600 rounded-full mr-3"></div>
                  Suas Contas
                </h2>
                {loadingCreds && <RefreshCw className="w-4 h-4 text-primary-600 animate-spin" />}
             </div>
             
             {isDemoUser && (
                 <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl text-center">
                     <p className="text-xs text-indigo-700 font-bold mb-1">Modo de Demonstração</p>
                     <p className="text-[10px] text-indigo-500">As senhas abaixo são fictícias para teste da interface.</p>
                 </div>
             )}

             <div className="grid gap-3">
               {!loadingCreds && !assignedCredentials.some(c => c.cred) && isActive && (
                  <p className="text-gray-500 text-sm bg-gray-50 p-4 rounded-xl text-center border border-gray-200">
                    Aguardando liberação de acesso para seus apps.
                  </p>
               )}

               {assignedCredentials.map(({ service, cred, alert }, idx) => {
                 
                 // --- LOGIC: CALCULAR SE ESSE SERVIÇO ESPECÍFICO ESTÁ VENCIDO ---
                 const svcDetails = user.subscriptionDetails ? user.subscriptionDetails[service] : null;
                 let isSvcExpired = false;
                 
                 // Default Global Dates
                 let specificPurchaseDate = purchaseDate;
                 let specificDuration = user.durationMonths;

                 if (svcDetails) {
                     specificPurchaseDate = new Date(svcDetails.purchaseDate);
                     specificDuration = svcDetails.durationMonths;
                     
                     const p = new Date(svcDetails.purchaseDate);
                     const e = new Date(p);
                     e.setMonth(p.getMonth() + svcDetails.durationMonths);
                     if (new Date() > e) isSvcExpired = true;
                 } else {
                     // Fallback se não tiver detalhe (usa o global)
                     if (!isActive) isSvcExpired = true;
                 }

                 // Calculate Specific Expiry based on refined data
                 const specificExpiryDate = new Date(specificPurchaseDate);
                 specificExpiryDate.setMonth(specificPurchaseDate.getMonth() + specificDuration);

                 // Override: Se o admin deu override global, nenhum serviço expira visualmente
                 if (user.overrideExpiration) isSvcExpired = false;

                 // --- LOGIC: SE ESTIVER VENCIDO, MOSTRAR MENSAGEM DA DORAMINHA ---
                 if (isSvcExpired) {
                     return (
                       <div key={idx} className="bg-red-50 rounded-2xl shadow-sm border border-red-100 overflow-hidden relative">
                           <div className="bg-red-100 px-4 py-3 border-b border-red-200 flex justify-between items-center">
                                <span className="font-bold text-red-900 text-base flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                                    {service}
                                </span>
                                <Lock className="w-4 h-4 text-red-600" />
                           </div>
                           <div className="p-5 flex flex-col gap-4">
                               <div className="flex gap-4">
                                   <div className="flex-shrink-0">
                                       <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center border-2 border-red-100 shadow-sm">
                                           <Bot className="w-7 h-7 text-pink-500" />
                                       </div>
                                   </div>
                                   <div className="space-y-2">
                                       <p className="text-sm font-bold text-red-800">
                                           Oi! Aqui é a Doraminha. 🌸
                                       </p>
                                       <p className="text-xs text-red-700 leading-relaxed">
                                           Não consigo te mostrar a senha deste app agora porque sua assinatura <strong>deste serviço</strong> precisa de uma atençãozinha.
                                           <br/><br/>
                                           Mas não se preocupe! É só renovar ou falar com o suporte que a gente libera rapidinho.
                                       </p>
                                   </div>
                               </div>
                               
                               <div className="bg-white/60 rounded-xl p-3 border border-red-100 flex justify-between text-[10px] text-gray-500 font-bold uppercase tracking-wide">
                                   <div className="text-center">
                                       <span>Compra original</span>
                                       <p className="text-gray-800 text-xs mt-0.5">{formatDate(specificPurchaseDate)}</p>
                                   </div>
                                   <div className="w-px bg-red-200"></div>
                                   <div className="text-center">
                                       <span>Seu Plano</span>
                                       <p className="text-gray-800 text-xs mt-0.5">{specificDuration} Mês(es)</p>
                                   </div>
                               </div>

                               <div className="flex gap-3 mt-1">
                                   <button 
                                      onClick={() => onOpenCheckout('renewal', service)}
                                      className="flex-1 bg-red-600 text-white py-2.5 rounded-xl font-bold text-xs shadow-md hover:bg-red-700 flex items-center justify-center gap-2 transition-colors"
                                   >
                                       <RefreshCw className="w-4 h-4" /> Renovar
                                   </button>
                                   <a 
                                      href="https://wa.me/558894875029?text=Ol%C3%A1!%20Meu%20acesso%20venceu%20e%20preciso%20de%20ajuda%20para%20renovar."
                                      target="_blank"
                                      rel="noreferrer"
                                      className="flex-1 bg-white text-green-600 border border-green-200 py-2.5 rounded-xl font-bold text-xs hover:bg-green-50 flex items-center justify-center gap-2 transition-colors"
                                   >
                                       <MessageCircle className="w-4 h-4" /> Suporte
                                   </a>
                               </div>
                           </div>
                       </div>
                     );
                 }

                 const displayEmail = isDemoUser ? 'demo@eudorama.com' : cred?.email;
                 const displayPass = isDemoUser ? 'demo1234' : cred?.password;
                 let displayAlert = isDemoUser ? null : alert;
                 
                 // System Status Override
                 if (sysConfig && sysConfig.serviceStatus) {
                     // Check fuzzy match
                     const statusKey = Object.keys(sysConfig.serviceStatus).find(k => service.toLowerCase().includes(k.toLowerCase()));
                     if (statusKey) {
                         const status = sysConfig.serviceStatus[statusKey];
                         if (status === 'issues') displayAlert = "⚠️ Serviço instável no momento. Aguarde.";
                         if (status === 'down') displayAlert = "🚨 Serviço fora do ar para manutenção.";
                     }
                 }

                 return cred ? (
                   <div key={idx} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden group hover:border-primary-200 transition-colors">
                     <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex justify-between items-center">
                        <span className="font-bold text-gray-800 text-base flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${displayAlert?.includes('fora do ar') ? 'bg-red-500' : (displayAlert ? 'bg-yellow-500' : 'bg-green-500')}`}></div>
                            {service}
                        </span>
                        {displayAlert && <AlertCircle className="w-4 h-4 text-yellow-500 animate-pulse" />}
                     </div>

                     <div className="p-4 flex flex-col gap-3">
                        <div className="flex justify-between items-center bg-gray-50/50 p-2 rounded-lg border border-gray-100">
                            <div className="overflow-hidden">
                                <p className="text-[10px] text-gray-400 font-bold uppercase">Email</p>
                                <p className="text-sm font-bold text-gray-900 truncate">{displayEmail}</p>
                            </div>
                            <button onClick={() => copyToClipboard(displayEmail || '', cred.id + 'email')} className="p-2 text-gray-400 hover:text-primary-600 transition-colors">
                                {copiedId === cred.id + 'email' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                            </button>
                        </div>

                        <div className="flex justify-between items-center bg-gray-50/50 p-2 rounded-lg border border-gray-100">
                            <div className="overflow-hidden">
                                <p className="text-[10px] text-gray-400 font-bold uppercase">Senha</p>
                                <p className="text-sm font-bold text-gray-900 tracking-wider">{displayPass}</p>
                            </div>
                            <button onClick={() => copyToClipboard(displayPass || '', cred.id + 'pass')} className="p-2 text-gray-400 hover:text-primary-600 transition-colors">
                                {copiedId === cred.id + 'pass' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                            </button>
                        </div>
                        
                        {displayAlert && <div className={`text-[10px] font-bold p-2 rounded text-center ${displayAlert.includes('fora do ar') ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-700'}`}>{displayAlert}</div>}
                     </div>
                   </div>
                 ) : null;
               })}
             </div>
        </div>

        {/* --- MISSING SERVICES (UPSHELL) --- */}
        {missingServices.length > 0 && (
            <div className="space-y-4 pt-4">
                <div className="flex items-center justify-between px-1">
                    <h2 className="text-lg font-extrabold text-gray-800 flex items-center">
                      <Rocket className="w-5 h-5 text-orange-500 mr-2" />
                      Turbine seu Plano
                    </h2>
                </div>
                
                <div className="flex overflow-x-auto gap-4 pb-4 px-1 scrollbar-hide">
                    {missingServices.map((service) => (
                        <div key={service.id} className="min-w-[260px] bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden relative flex flex-col">
                            <div className={`h-1.5 w-full bg-gradient-to-r ${service.color}`}></div>
                            <div className="p-5 flex-1 flex flex-col">
                                <h3 className="text-lg font-extrabold text-gray-900 mb-1">{service.name}</h3>
                                <p className="text-xs text-gray-500 mb-4">{service.benefits[0]}</p>
                                <div className="mt-auto flex items-center justify-between">
                                    <span className="font-bold text-gray-900">{service.price}</span>
                                    <button 
                                        onClick={() => onOpenCheckout('new_sub', service.name)}
                                        className="bg-gray-900 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-black transition-colors"
                                    >
                                        Assinar
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

      </div>
    </div>
  );
};

export default Dashboard;
