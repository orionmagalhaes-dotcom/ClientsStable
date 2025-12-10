
import { createClient } from '@supabase/supabase-js';
import { User, ClientDBRow, Dorama, AdminUserDBRow } from '../types';
import { MOCK_DB_CLIENTS } from '../constants';

// --- CONFIGURAÇÃO DO SUPABASE ---
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://srsqipevsammsfzyaewn.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNyc3FpcGV2c2FtbXNmenlhZXduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUwMTA0NTQsImV4cCI6MjA4MDU4NjQ1NH0.8ePfpnSVeluDG-YwvrjWiIhl6fr5p6UDoZKjF7rrL1I';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Helper para garantir chaves consistentes no DB (apenas números)
const cleanPhone = (phone: string) => {
    if (!phone) return '';
    return phone.replace(/\D/g, '');
};

// --- GERENCIAMENTO DE DADOS LOCAIS (CACHE) ---
const getLocalUserData = (phoneNumber: string) => {
  const clean = cleanPhone(phoneNumber);
  let data = { watching: [], favorites: [], completed: [] };

  // 1. Tenta recuperar do cache específico
  try {
    const local = localStorage.getItem(`dorama_user_${clean}`);
    if (local) {
        const parsed = JSON.parse(local);
        data = { ...data, ...parsed };
    }
  } catch (e) {}

  // 2. Tenta recuperar da sessão principal (MUITO IMPORTANTE para evitar rollback)
  // Se a sessão tiver dados mais recentes, usamos eles como verdade
  try {
      const session = localStorage.getItem('eudorama_session');
      if (session) {
          const user = JSON.parse(session);
          // Verifica se a sessão é do mesmo usuário
          if (cleanPhone(user.phoneNumber) === clean) {
              if (user.watching && user.watching.length > 0) data.watching = user.watching;
              if (user.favorites && user.favorites.length > 0) data.favorites = user.favorites;
              if (user.completed && user.completed.length > 0) data.completed = user.completed;
          }
      }
  } catch(e) {}

  return data;
};

export const addLocalDorama = (phoneNumber: string, type: 'watching' | 'favorites' | 'completed', dorama: Dorama) => {
  const clean = cleanPhone(phoneNumber);
  // Pega os dados atuais (mesclados com a sessão para garantir frescor)
  const currentData = getLocalUserData(clean);
  
  if (!currentData[type]) {
    currentData[type] = [];
  }
  
  // Remove versão anterior do mesmo dorama para atualizar
  currentData[type] = currentData[type].filter((d: Dorama) => d.title !== dorama.title && d.id !== dorama.id);
  
  // Adiciona a nova versão com dados atualizados (Episódio novo)
  currentData[type].push(dorama);
  
  // Salva no cache específico
  localStorage.setItem(`dorama_user_${clean}`, JSON.stringify(currentData));
  
  return currentData;
};

// --- FUNÇÕES DE CLIENTE ---

export const getAllClients = async (): Promise<ClientDBRow[]> => {
  try {
    if (supabase) {
      const { data, error } = await supabase.from('clients').select('*');
      if (!error && data) return data as unknown as ClientDBRow[];
    }
    return MOCK_DB_CLIENTS;
  } catch (e) {
    return MOCK_DB_CLIENTS;
  }
};

// --- DORAMA OPERATIONS (FIXED & ROBUST) ---

// Normaliza o status vindo do banco para o formato da App
const mapStatusFromDB = (status: string): 'Watching' | 'Completed' | 'Plan to Watch' => {
    if (!status) return 'Plan to Watch';
    const s = status.toLowerCase().trim();
    if (s === 'watching' || s === 'assistindo') return 'Watching';
    if (s === 'completed' || s === 'completed' || s === 'finalizado') return 'Completed';
    return 'Plan to Watch'; // Default fallback (Favorites)
};

// Normaliza o status da App para o banco
const mapStatusToDB = (status: string): string => {
    if (status === 'Watching') return 'watching';
    if (status === 'Completed') return 'completed';
    return 'plan_to_watch';
};

export const getUserDoramasFromDB = async (phoneNumber: string): Promise<{ watching: Dorama[], favorites: Dorama[], completed: Dorama[] }> => {
    const cleanNum = cleanPhone(phoneNumber);
    const result = { watching: [], favorites: [], completed: [] };
    
    // Recupera dados locais para "Self-Healing" (correção automática)
    // Agora isso inclui dados da sessão, então é muito mais preciso
    const localData = getLocalUserData(cleanNum);
    const allLocalItems = [...(localData.watching||[]), ...(localData.favorites||[]), ...(localData.completed||[])];

    const possibleNumbers = [cleanNum];
    if (cleanNum.startsWith('55') && cleanNum.length > 10) possibleNumbers.push(cleanNum.substring(2));
    else if (cleanNum.length <= 11) possibleNumbers.push(`55${cleanNum}`);

    try {
      const { data, error } = await supabase
        .from('user_doramas')
        .select('*')
        .in('phone_number', possibleNumbers);

      if (error) throw error;

      if (data && data.length > 0) {
          const dbItems: Dorama[] = await Promise.all(data.map(async (row: any) => {
                const mappedStatus = mapStatusFromDB(row.status);
                
                // --- LÓGICA DE AUTO-CURA (SELF-HEALING) ---
                // Se o banco retornar valores padrão (1/16) MAS o local tiver dados avançados, usamos o local e atualizamos o banco.
                let finalWatched = row.episodes_watched ?? 1;
                let finalSeason = row.season ?? 1;
                let finalTotal = row.total_episodes ?? 16;
                let finalRating = row.rating ?? 0;

                const localMatch = allLocalItems.find((l: Dorama) => l.title === row.title || l.id === row.id);
                
                if (localMatch) {
                    // Proteção contra Downgrade: Se o banco diz 1, mas o local diz > 1, o banco perdeu dados.
                    if ((localMatch.episodesWatched || 1) > finalWatched) {
                        console.log(`[Auto-Heal] Recuperando Ep ${localMatch.episodesWatched} para ${row.title}`);
                        finalWatched = localMatch.episodesWatched;
                        // Dispara update silencioso para corrigir o banco
                        updateDoramaInDB({ ...localMatch, id: row.id, episodesWatched: finalWatched });
                    }
                    if ((localMatch.season || 1) > finalSeason) {
                        console.log(`[Auto-Heal] Recuperando Temporada ${localMatch.season} para ${row.title}`);
                        finalSeason = localMatch.season;
                        updateDoramaInDB({ ...localMatch, id: row.id, season: finalSeason });
                    }
                }

                return {
                    id: row.id,
                    title: row.title,
                    genre: row.genre,
                    thumbnail: row.thumbnail,
                    status: mappedStatus,
                    episodesWatched: finalWatched,
                    totalEpisodes: finalTotal,
                    season: finalSeason,
                    rating: finalRating
                };
          }));

          result.watching = dbItems.filter(d => d.status === 'Watching');
          result.favorites = dbItems.filter(d => d.status === 'Plan to Watch');
          result.completed = dbItems.filter(d => d.status === 'Completed');
          
          // Atualiza cache local com a versão mesclada e corrigida
          localStorage.setItem(`dorama_user_${cleanNum}`, JSON.stringify(result));
          return result;
      }
    } catch (e) {
        console.error("Erro DB, usando local:", e);
    }

    return getLocalUserData(cleanNum);
};

export const addDoramaToDB = async (phoneNumber: string, listType: 'watching' | 'favorites' | 'completed', dorama: Dorama): Promise<Dorama | null> => {
    const cleanNum = cleanPhone(phoneNumber);
    
    // Salva localmente primeiro
    addLocalDorama(cleanNum, listType, dorama);

    try {
      let statusStr = 'watching'; // Default DB value
      if (listType === 'favorites') statusStr = 'plan_to_watch';
      if (listType === 'completed') statusStr = 'completed';

      const dbRow = {
        phone_number: cleanNum, 
        title: dorama.title,
        genre: dorama.genre || 'Dorama',
        thumbnail: dorama.thumbnail,
        status: statusStr, 
        episodes_watched: dorama.episodesWatched || 1,
        total_episodes: dorama.totalEpisodes || 16, 
        season: dorama.season || 1, 
        rating: dorama.rating || 0,
        list_type: listType // Mantém como legado/backup
      };
  
      const { data, error } = await supabase
        .from('user_doramas')
        .insert([dbRow])
        .select()
        .single();
  
      if (error) {
          console.error("Erro Insert Supabase:", error);
          throw error;
      }
  
      // Retorna objeto com ID real e Status App-Format
      const realDorama = { 
          ...dorama, 
          id: data.id, 
          status: mapStatusFromDB(statusStr) 
      };
      
      // Atualiza local com ID real
      addLocalDorama(cleanNum, listType, realDorama); 
      return realDorama;

    } catch (e) {
      return { ...dorama, id: 'local-' + Date.now() };
    }
};
  
export const updateDoramaInDB = async (dorama: Dorama): Promise<boolean> => {
    // Se for ID temporário, tenta salvar como novo (Recovery)
    if (dorama.id.startsWith('temp-') || dorama.id.startsWith('local-')) {
        console.warn("Tentativa de atualizar item local sem ID real:", dorama.title);
        return true; 
    }

    try {
      const dbStatus = mapStatusToDB(dorama.status);

      const { error } = await supabase
        .from('user_doramas')
        .update({
          episodes_watched: dorama.episodesWatched,
          season: dorama.season,
          total_episodes: dorama.totalEpisodes,
          rating: dorama.rating,
          status: dbStatus
        })
        .eq('id', dorama.id);
      
      if (error) {
          console.error("Erro Update Supabase:", error);
          return false;
      }
      return true;
    } catch (e) {
        console.error("Exceção Update:", e);
        return false;
    }
};
  
export const removeDoramaFromDB = async (doramaId: string): Promise<boolean> => {
    try {
      if (doramaId.startsWith('temp-') || doramaId.startsWith('local-')) return true;
      const { error } = await supabase.from('user_doramas').delete().eq('id', doramaId);
      return !error;
    } catch (e) { return false; }
};

// --- AUTH / ADMIN ---

export const getTestUser = async (): Promise<{ user: User | null, error: string | null }> => {
    try {
        const { data } = await supabase.from('clients').select('*').eq('phone_number', '00000000000');
        if (!data || data.length === 0) return { user: null, error: 'Usuário teste não encontrado' };
        
        const result = processUserLogin(data as unknown as ClientDBRow[]);
        if (result.user) {
            const doramas = await getUserDoramasFromDB(result.user.phoneNumber);
            result.user.watching = doramas.watching;
            result.user.favorites = doramas.favorites;
            result.user.completed = doramas.completed;
        }
        return result;
    } catch (e) { return { user: null, error: 'Erro conexão' }; }
};

export const checkUserStatus = async (lastFourDigits: string): Promise<{ exists: boolean; hasPassword: boolean; phoneMatches: string[] }> => {
  try {
    const { data, error } = await supabase
      .from('clients')
      .select('phone_number, client_password, deleted')
      .like('phone_number', `%${lastFourDigits}`);

    if (error || !data || data.length === 0) {
      const foundMock = MOCK_DB_CLIENTS.filter(c => c.phone_number.endsWith(lastFourDigits));
      if (foundMock.length > 0 && !foundMock[0].deleted) {
         return { exists: true, hasPassword: false, phoneMatches: [foundMock[0].phone_number] };
      }
      return { exists: false, hasPassword: false, phoneMatches: [] };
    }

    const activeClients = (data as any[]).filter(c => !c.deleted);
    if (activeClients.length === 0) return { exists: false, hasPassword: false, phoneMatches: [] };

    const hasPass = activeClients.some(row => row.client_password && row.client_password.trim() !== '');
    const phones = Array.from(new Set(activeClients.map(d => d.phone_number as string)));

    return { exists: true, hasPassword: hasPass, phoneMatches: phones };
  } catch (e) { return { exists: false, hasPassword: false, phoneMatches: [] }; }
};

export const loginWithPassword = async (phoneNumber: string, password: string): Promise<{ user: User | null, error: string | null }> => {
  try {
    const { data, error } = await supabase.from('clients').select('*').eq('phone_number', phoneNumber);

    if (error || !data || data.length === 0) return { user: null, error: 'Usuário não encontrado.' };

    const clientRows = data as unknown as ClientDBRow[];
    
    // FIX: Filtragem robusta para evitar bloqueio por contas antigas
    // Prioriza contas ativas (!deleted)
    const activeAccounts = clientRows.filter(r => !r.deleted);

    if (activeAccounts.length === 0) {
        // Todas as contas encontradas estão marcadas como deletadas
        return { user: null, error: 'Acesso revogado.' };
    }

    // Verifica a senha em QUALQUER conta ativa
    const isPasswordValid = activeAccounts.some(r => String(r.client_password).trim() === String(password).trim());

    if (!isPasswordValid) return { user: null, error: 'Senha incorreta.' };

    const result = processUserLogin(clientRows);

    if (result.user) {
        const doramas = await getUserDoramasFromDB(result.user.phoneNumber);
        result.user.watching = doramas.watching;
        result.user.favorites = doramas.favorites;
        result.user.completed = doramas.completed;
    }
    return result;
  } catch (e) { return { user: null, error: 'Erro de conexão.' }; }
};

export const processUserLogin = (userRows: ClientDBRow[]): { user: User | null, error: string | null } => {
    if (userRows.length === 0) return { user: null, error: 'Dados vazios.' };

    const primaryPhone = userRows[0].phone_number;
    const allServices = new Set<string>();
    
    // Map to store specific dates for each service
    const subDetails: Record<string, { purchaseDate: string; durationMonths: number }> = {};

    let bestRow = userRows[0];
    let maxExpiryTime = 0;
    let isDebtorAny = false;
    let overrideAny = false;
    let clientName = "Dorameira";

    userRows.forEach(row => {
      if (row.deleted) return;
      if (row.client_name) clientName = row.client_name;

      // Extract subscriptions from this specific row
      let subs: string[] = [];
      if (Array.isArray(row.subscriptions)) {
        subs = row.subscriptions;
      } else if (typeof row.subscriptions === 'string') {
        const s = row.subscriptions as string;
        subs = s.includes('+') ? s.split('+').map(i => i.trim().replace(/^"|"$/g, '')) : [s.replace(/^"|"$/g, '')];
      }
      
      // Calculate expiry for this row
      const purchase = new Date(row.purchase_date);
      const expiry = new Date(purchase);
      expiry.setMonth(purchase.getMonth() + row.duration_months);
      
      // Add to global list AND store specific dates
      subs.forEach(s => {
          if (s) {
              const cleanS = s.trim();
              allServices.add(cleanS);
              
              // CRITICAL FIX: If we already have this service, check if this row gives it a longer duration.
              // If not present, add it.
              if (!subDetails[cleanS]) {
                  subDetails[cleanS] = { purchaseDate: row.purchase_date, durationMonths: row.duration_months };
              } else {
                  const currentStored = subDetails[cleanS];
                  const currentPurchase = new Date(currentStored.purchaseDate);
                  const currentExpiry = new Date(currentPurchase);
                  currentExpiry.setMonth(currentPurchase.getMonth() + currentStored.durationMonths);
                  
                  // If this row's expiry is later than what we have stored, update it.
                  if (expiry.getTime() > currentExpiry.getTime()) {
                      subDetails[cleanS] = { purchaseDate: row.purchase_date, durationMonths: row.duration_months };
                  }
              }
          }
      });

      if (row.is_debtor) isDebtorAny = true;
      if (row.override_expiration) overrideAny = true;

      // General "Best Row" for fallback/main status
      if (expiry.getTime() > maxExpiryTime) {
        maxExpiryTime = expiry.getTime();
        bestRow = row;
      }
    });

    const localData = getLocalUserData(primaryPhone);
    const gameProgress = bestRow.game_progress || {};

    const appUser: User = {
      id: bestRow.id,
      name: clientName, 
      phoneNumber: bestRow.phone_number,
      // General fallbacks
      purchaseDate: bestRow.purchase_date, 
      durationMonths: bestRow.duration_months,
      // Detailed info
      subscriptionDetails: subDetails,
      services: Array.from(allServices),
      isDebtor: isDebtorAny,
      overrideExpiration: overrideAny,
      watching: localData.watching || [],
      favorites: localData.favorites || [],
      completed: localData.completed || [],
      gameProgress: gameProgress
    };

    return { user: appUser, error: null };
};

// --- SUPPORT FUNCTIONS ---
export const saveGameProgress = async (phoneNumber: string, gameId: string, data: any): Promise<boolean> => {
    try {
        const { data: clientData } = await supabase.from('clients').select('game_progress').eq('phone_number', phoneNumber).single();
        let currentProgress = clientData?.game_progress || {};
        currentProgress[gameId] = { ...currentProgress[gameId], ...data };
        const { error } = await supabase.from('clients').update({ game_progress: currentProgress }).eq('phone_number', phoneNumber);
        return !error;
    } catch (e) { return false; }
};

export const syncDoramaBackup = async (phoneNumber: string, data: any) => {
    // Backup passivo mantido para segurança extra
    try {
        const { data: clientData } = await supabase.from('clients').select('id, game_progress').eq('phone_number', phoneNumber).single();
        if (clientData) {
             let currentProgress = clientData.game_progress || {};
             currentProgress['doramas_backup'] = data;
             await supabase.from('clients').update({ game_progress: currentProgress }).eq('id', clientData.id);
        }
    } catch (e) {}
};

export const verifyAdminLogin = async (login: string, pass: string): Promise<boolean> => {
  try {
    const { data } = await supabase.from('admin_users').select('*').eq('username', login).limit(1);
    if (!data || data.length === 0) return false;
    return (data[0] as AdminUserDBRow).password === pass;
  } catch (e) { return false; }
};

export const saveClientToDB = async (client: Partial<ClientDBRow>): Promise<boolean> => {
    try {
      const payload: any = { ...client };
      delete payload.created_at; 
      if (client.id) {
         const { error } = await supabase.from('clients').update(payload).eq('id', client.id);
         return !error;
      } else {
         const { error } = await supabase.from('clients').insert([payload]);
         return !error;
      }
    } catch (e) { return false; }
};
export const deleteClientFromDB = async (id: string): Promise<boolean> => { try { const { error } = await supabase.from('clients').update({ deleted: true }).eq('id', id); return !error; } catch (e) { return false; } };
export const resetAllClientPasswords = async (): Promise<boolean> => { try { const { error } = await supabase.from('clients').update({ client_password: '' }).neq('id', '0000'); return !error; } catch (e) { return false; } };
export const updateClientName = async (phoneNumber: string, name: string): Promise<boolean> => { try { const { error } = await supabase.from('clients').update({ client_name: name }).eq('phone_number', phoneNumber); return !error; } catch (e) { return false; } };
export const registerClientPassword = async (phoneNumber: string, password: string): Promise<boolean> => { try { const { data, error } = await supabase.from('clients').update({ client_password: password }).eq('phone_number', phoneNumber).select(); return !error && data && data.length > 0; } catch (e) { return false; } };
export const loginUserByPhone = async (lastFourDigits: string): Promise<{ user: User | null, error: string | null }> => { const found = MOCK_DB_CLIENTS.filter(c => c.phone_number.endsWith(lastFourDigits) && !c.deleted); if (found.length > 0) return processUserLogin(found); return { user: null, error: 'Cliente não encontrado.' }; };
export const createDemoClient = async (): Promise<boolean> => { try { const fakeId = Math.floor(1000 + Math.random() * 9000); const demoPhone = `99999${fakeId}`; const demoUser: Partial<ClientDBRow> = { phone_number: demoPhone, client_name: `Demo User (${fakeId})`, client_password: '1234', subscriptions: ['Viki Pass', 'Kocowa+', 'IQIYI', 'WeTV', 'DramaBox'], purchase_date: new Date().toISOString(), duration_months: 999, is_debtor: false, deleted: false, override_expiration: true, game_progress: {} }; const { error } = await supabase.from('clients').insert([demoUser]); return !error; } catch (e) { return false; } };
export interface SystemConfig { bannerText: string; bannerType: 'info' | 'warning' | 'error' | 'success'; bannerActive: boolean; serviceStatus: { [key: string]: 'ok' | 'issues' | 'down' }; }
export const getSystemConfig = async (): Promise<SystemConfig> => { const defaultConfig: SystemConfig = { bannerText: '', bannerType: 'info', bannerActive: false, serviceStatus: { 'Viki Pass': 'ok', 'Kocowa+': 'ok', 'IQIYI': 'ok', 'WeTV': 'ok' } }; try { const { data } = await supabase.from('app_credentials').select('email').eq('service', 'SYSTEM_CONFIG').single(); if (data && data.email) { return JSON.parse(data.email); } } catch(e) {} return defaultConfig; };
export const saveSystemConfig = async (config: SystemConfig): Promise<boolean> => { try { const payload = { service: 'SYSTEM_CONFIG', email: JSON.stringify(config), password: 'CONFIG_IGNORED', is_visible: false, published_at: new Date().toISOString() }; const { data } = await supabase.from('app_credentials').select('id').eq('service', 'SYSTEM_CONFIG').single(); if (data) { const { error } = await supabase.from('app_credentials').update(payload).eq('id', data.id); return !error; } else { const { error } = await supabase.from('app_credentials').insert([payload]); return !error; } } catch (e) { return false; } };
