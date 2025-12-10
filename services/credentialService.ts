
import { AppCredential, AppCredentialDBRow, User, ClientDBRow } from '../types';
import { getAllClients, supabase } from './clientService';
import { MOCK_CREDENTIALS } from '../constants';

// --- CRUD COM SUPABASE ---

export const fetchCredentials = async (): Promise<AppCredential[]> => {
  try {
    const { data, error } = await supabase
      .from('app_credentials')
      .select('*');

    if (error) {
        // Suppress specific fetch errors to avoid console noise when offline/blocked
        if (error.message && !error.message.includes('Failed to fetch')) {
             console.error('Supabase error fetching credentials:', JSON.stringify(error, null, 2));
        }
        throw error;
    }

    if (!data) return [];

    // Mapeia do formato do DB (snake_case) para o App (camelCase) e garante campos obrigatórios
    return (data as unknown as AppCredentialDBRow[]).map(row => ({
      id: row.id,
      service: row.service || 'Serviço Desconhecido',
      email: row.email || 'Sem Email',
      password: row.password || 'Sem Senha',
      publishedAt: row.published_at || new Date().toISOString(),
      isVisible: row.is_visible !== undefined ? row.is_visible : true
    }));
  } catch (error) {
    // Fallback silencioso para Mocks em caso de erro de conexão
    console.warn('Usando credenciais de demonstração (Conexão falhou).');
    return MOCK_CREDENTIALS.map(row => ({
      id: row.id,
      service: row.service,
      email: row.email,
      password: row.password,
      publishedAt: row.published_at,
      isVisible: row.is_visible
    }));
  }
};

export const saveCredential = async (cred: AppCredential): Promise<void> => {
  try {
    const dbRow = {
      service: cred.service,
      email: cred.email,
      password: cred.password,
      published_at: cred.publishedAt,
      is_visible: cred.isVisible
    };

    if (cred.id && cred.id.length > 20) {
      // Update
      const { error } = await supabase
        .from('app_credentials')
        .update(dbRow)
        .eq('id', cred.id);
        if (error) throw error;
    } else {
      // Insert
      const { error } = await supabase
        .from('app_credentials')
        .insert([dbRow]);
        if (error) throw error;
    }
  } catch (error) {
    console.error('Erro ao salvar credencial:', error);
  }
};

export const deleteCredential = async (id: string): Promise<void> => {
  try {
    const response = await supabase.from('app_credentials').delete().eq('id', id);
    if (response.error) {
        throw new Error(`Erro SQL: ${response.error.message}`);
    }
  } catch (error) {
    console.error('Erro ao deletar:', error);
    throw error;
  }
};

// --- LÓGICA DE DISTRIBUIÇÃO ---

export const getAssignedCredential = async (user: User, serviceName: string): Promise<{ credential: AppCredential | null, alert: string | null }> => {
  // 1. Busca credenciais (com fallback para mock se falhar)
  const credentialsList = await fetchCredentials();
  
  const allCreds = credentialsList
    .filter(c => c.isVisible && c.service.toLowerCase().includes(serviceName.toLowerCase()))
    .sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime());

  if (allCreds.length === 0) return { credential: null, alert: null };

  // 2. Busca todos os clientes para calcular a posição deste usuário
  const allClients = await getAllClients();
  // Filter out deleted clients from distribution logic to prevent skewing
  const activeClients = allClients.filter((c: any) => !c.deleted);
  
  const clientsWithService = activeClients.filter(client => {
    let subs: string[] = [];
    if (Array.isArray(client.subscriptions)) {
      subs = client.subscriptions;
    } else if (typeof client.subscriptions === 'string') {
      const s = client.subscriptions as string;
      subs = s.includes('+') ? s.split('+') : [s];
    }
    return subs.some(s => s.toLowerCase().includes(serviceName.toLowerCase()));
  });

  clientsWithService.sort((a, b) => a.phone_number.localeCompare(b.phone_number));

  const userPhoneClean = user.phoneNumber.replace(/\D/g, '');
  const userIndex = clientsWithService.findIndex(c => c.phone_number.replace(/\D/g, '') === userPhoneClean);

  if (userIndex === -1) {
    return { credential: allCreds[0], alert: null }; 
  }

  // 3. Regras de Capacidade
  let capacity = 4; // Viki, Kocowa

  if (serviceName.toLowerCase().includes('iqiyi')) {
    const totalUsers = clientsWithService.length;
    const totalAccounts = allCreds.length;
    if (totalAccounts > 0) {
      capacity = Math.ceil(totalUsers / totalAccounts);
    }
  } else if (serviceName.toLowerCase().includes('wetv')) {
    capacity = 1000; 
  }

  // 4. Distribuição
  const credentialIndex = Math.floor(userIndex / capacity);
  const assignedCred = allCreds[credentialIndex % allCreds.length];

  // 5. Alertas
  let alertMsg = null;
  const publishedDate = new Date(assignedCred.publishedAt);
  const now = new Date();
  const diffTime = now.getTime() - publishedDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (serviceName.toLowerCase().includes('viki')) {
    if (diffDays >= 13) {
      alertMsg = "⚠️ Esta conta vence amanhã ou já venceu (Ciclo de 14 dias).";
    }
  } else if (serviceName.toLowerCase().includes('kocowa')) {
    if (diffDays >= 28) {
      alertMsg = "⚠️ Esta conta vence em breve (Ciclo de 30 dias).";
    }
  }

  return { credential: assignedCred, alert: alertMsg };
};

// Gets the list of users assigned to a specific credential
export const getClientsAssignedToCredential = async (cred: AppCredential, preloadedClients?: any[]): Promise<ClientDBRow[]> => {
   const serviceName = cred.service;
   const allClients = preloadedClients || await getAllClients();
   const activeClients = allClients.filter((c: any) => !c.deleted);
   
   const clientsWithService = activeClients.filter((client: any) => {
      let subs: string[] = [];
      if (Array.isArray(client.subscriptions)) {
        subs = client.subscriptions;
      } else if (typeof client.subscriptions === 'string') {
        const s = client.subscriptions as string;
        subs = s.includes('+') ? s.split('+') : [s];
      }
      return subs.some((s: string) => s.toLowerCase().includes(serviceName.toLowerCase()));
   });
   
   clientsWithService.sort((a: any, b: any) => a.phone_number.localeCompare(b.phone_number));

   const allCredsRaw = await fetchCredentials();
   const allCreds = allCredsRaw
    .filter(c => c.isVisible && c.service.toLowerCase().includes(serviceName.toLowerCase()))
    .sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime());

   const credIndex = allCreds.findIndex(c => c.id === cred.id);
   if (credIndex === -1) return [];

   let capacity = 4;
   if (serviceName.toLowerCase().includes('iqiyi')) {
      const totalUsers = clientsWithService.length;
      const totalAccounts = allCreds.length;
      capacity = totalAccounts > 0 ? Math.ceil(totalUsers / totalAccounts) : 1;
   } else if (serviceName.toLowerCase().includes('wetv')) {
      capacity = 1000;
   }

   const assignedUsers: ClientDBRow[] = [];
   for (let i = 0; i < clientsWithService.length; i++) {
      const assignedIndex = Math.floor(i / capacity) % allCreds.length;
      if (assignedIndex === credIndex) {
        assignedUsers.push(clientsWithService[i]);
      }
   }

   return assignedUsers;
}

export const getUsersCountForCredential = async (cred: AppCredential, preloadedClients?: any[]): Promise<number> => {
   const users = await getClientsAssignedToCredential(cred, preloadedClients);
   return users.length;
}
