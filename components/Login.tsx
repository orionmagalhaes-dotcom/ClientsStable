
import React, { useState } from 'react';
import { User } from '../types';
import { checkUserStatus, loginWithPassword, registerClientPassword, getTestUser } from '../services/clientService';
import { Smartphone, LockKeyhole, ArrowRight, Loader2, UserPlus, LogIn, AlertCircle, TestTube, HelpCircle, ShieldCheck, Eye, EyeOff, CheckCircle } from 'lucide-react';

interface LoginProps {
  onLogin: (user: User, remember: boolean, isTest?: boolean) => void;
  onAdminClick: () => void;
}

// Helper function to generate the current 3-hour block password
const getCurrentTestPassword = () => {
    const block = Math.floor(Date.now() / (3 * 60 * 60 * 1000));
    const suffix = (block * 13 % 1000).toString().padStart(3, '0');
    return `TESTE-${suffix}`;
};

const Login: React.FC<LoginProps> = ({ onLogin, onAdminClick }) => {
  const [activeTab, setActiveTab] = useState<'login' | 'test'>('login');
  const [step, setStep] = useState<'identify' | 'password' | 'create_password'>('identify');
  
  const [digits, setDigits] = useState('');
  const [fullPhoneFound, setFullPhoneFound] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false); // New state for password visibility
  const [keepConnected, setKeepConnected] = useState(true);
  const [testPassword, setTestPassword] = useState('');
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // --- HANDLERS ---
  
  const handleDigitsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value.replace(/\D/g, '').slice(0, 4);
      setDigits(val);
      if (error) setError('');
  };

  const handleIdentify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const cleanDigits = digits.replace(/\D/g, '');
    
    if (cleanDigits.length < 4) {
      setError('Preencha os 4 dígitos finais.');
      return;
    }

    setLoading(true);
    
    try {
        const status = await checkUserStatus(cleanDigits);

        if (status.exists && status.phoneMatches.length > 0) {
            setFullPhoneFound(status.phoneMatches[0]);
            if (status.hasPassword) {
                setStep('password');
            } else {
                setStep('create_password');
            }
        } else {
            setError('Cliente não encontrado.');
        }
    } catch (err) {
        console.error(err);
        setError('Erro de conexão.');
    } finally {
        setLoading(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!password.trim()) {
        setError('Digite sua senha.');
        return;
    }

    setLoading(true);
    const { user, error: loginError } = await loginWithPassword(fullPhoneFound, password);
    setLoading(false);

    if (user) {
        onLogin(user, keepConnected);
    } else {
        setError(loginError || 'Senha incorreta.');
    }
  };

  const handleRegisterPassword = async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');

      if (password.length < 4) {
          setError('A senha deve ter pelo menos 4 caracteres.');
          return;
      }

      setLoading(true);
      const success = await registerClientPassword(fullPhoneFound, password);
      
      if (success) {
          const { user, error: loginError } = await loginWithPassword(fullPhoneFound, password);
          setLoading(false);
          if (user) {
              onLogin(user, keepConnected);
          } else {
              setError(loginError || 'Erro ao entrar após cadastro.');
          }
      } else {
          setLoading(false);
          setError('Erro ao salvar senha.');
      }
  };

  const handleTestLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setLoading(true);

      const validPassword = getCurrentTestPassword();
      
      if (testPassword.trim().toUpperCase() === validPassword) {
          const { user, error } = await getTestUser();
          if (user) {
              onLogin(user, false, true); 
          } else {
              setError(error || 'Erro no teste.');
          }
      } else {
          setError('Senha de teste inválida.');
      }
      setLoading(false);
  };

  const handleRecovery = () => {
      window.open(`https://wa.me/558894875029?text=Ol%C3%A1!%20Esqueci%20minha%20senha%20de%20acesso%20ao%20app%20(N%C3%BAmero%20final%20${fullPhoneFound.slice(-4)}).`, '_blank');
  };

  const resetLogin = () => {
      setDigits('');
      setPassword('');
      setStep('identify');
      setError('');
      setShowPassword(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 relative overflow-hidden font-sans flex-col">
      
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-1/2 bg-primary-700 rounded-b-[3rem] shadow-2xl z-0"></div>
      <div className="absolute top-10 left-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
      <div className="absolute top-20 right-20 w-48 h-48 bg-pink-500/20 rounded-full blur-3xl"></div>

      {/* Admin Button */}
      <button 
        onClick={onAdminClick}
        className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors z-50 p-2"
      >
        <LockKeyhole className="w-4 h-4" />
      </button>

      {/* Main Card */}
      <div className="w-full max-w-[360px] bg-white rounded-3xl shadow-xl z-10 overflow-hidden mx-4 animate-fade-in-up">
        
        {/* Header Section */}
        <div className="bg-white p-8 pb-4 text-center">
            <div className="w-16 h-16 bg-primary-50 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm text-primary-600">
                <ShieldCheck className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Clientes EuDorama</h1>
            <p className="text-gray-500 text-sm mt-1">Gerencie seu acesso exclusivo</p>
        </div>

        {/* Navigation Tabs */}
        <div className="px-8 flex border-b border-gray-100">
            <button 
                onClick={() => { setActiveTab('login'); resetLogin(); }}
                className={`flex-1 py-3 text-sm font-bold transition-all border-b-2 ${activeTab === 'login' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
            >
                Entrar
            </button>
            <button 
                onClick={() => { setActiveTab('test'); resetLogin(); }}
                className={`flex-1 py-3 text-sm font-bold transition-all border-b-2 flex justify-center items-center ${activeTab === 'test' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
            >
                <TestTube className="w-3 h-3 mr-1.5" /> Teste Grátis
            </button>
        </div>

        {/* Content Area */}
        <div className="p-8 pt-6">
            
            {/* --- TAB: TEST LOGIN --- */}
            {activeTab === 'test' && (
                 <form onSubmit={handleTestLogin} className="space-y-6">
                    <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100 text-center">
                        <p className="text-xs text-indigo-800 font-bold uppercase mb-1">Senha Rotativa</p>
                        <p className="text-xs text-indigo-600">A senha muda a cada 3 horas. Solicite no suporte.</p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-500 uppercase ml-1">Senha de Teste</label>
                      <input
                        type="text"
                        placeholder="TESTE-000"
                        className="w-full bg-gray-50 text-center text-xl font-bold tracking-widest text-gray-900 py-4 rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:bg-white outline-none transition-all uppercase placeholder-gray-300"
                        value={testPassword}
                        onChange={(e) => setTestPassword(e.target.value.toUpperCase())}
                        autoFocus
                      />
                    </div>
                    
                    {error && (
                        <div className="p-3 bg-red-50 rounded-xl flex items-center justify-center gap-2 text-red-600 text-xs font-bold animate-pulse">
                            <AlertCircle className="w-4 h-4" /> {error}
                        </div>
                    )}

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-200 transition-all active:scale-[0.98] disabled:opacity-50 flex justify-center items-center"
                    >
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Iniciar Teste'}
                    </button>
                 </form>
            )}

            {/* --- TAB: REGULAR LOGIN --- */}
            {activeTab === 'login' && (
                <div className="space-y-6">
                    
                    {/* STEP 1: IDENTIFY */}
                    {step === 'identify' && (
                        <form onSubmit={handleIdentify} className="space-y-6 animate-fade-in">
                            <div className="text-center space-y-4">
                                <label className="block text-sm font-bold text-gray-600">
                                    Confirme seu número de telefone
                                </label>
                                
                                {/* Visual Input Mockup - MASKED */}
                                <div className="bg-gray-100 p-4 rounded-xl border-2 border-gray-200 flex items-center justify-center">
                                    <span className="text-xl font-black text-gray-400 mr-2 select-none tracking-widest">(••) ••••• -</span>
                                    <input
                                        type="tel"
                                        maxLength={4}
                                        placeholder="____"
                                        className="w-20 bg-transparent text-center text-xl font-black text-primary-600 placeholder-gray-300 border-none focus:ring-0 outline-none p-0 tracking-[0.2em]"
                                        value={digits}
                                        onChange={handleDigitsChange}
                                        autoFocus
                                    />
                                </div>
                                <p className="text-xs text-primary-500 font-medium">Digite apenas os 4 últimos dígitos</p>
                            </div>
                            
                            <div className="flex items-center justify-center gap-2">
                                <input 
                                    type="checkbox" 
                                    id="keepConnected" 
                                    checked={keepConnected} 
                                    onChange={e => setKeepConnected(e.target.checked)}
                                    className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
                                />
                                <label htmlFor="keepConnected" className="text-xs text-gray-500 font-bold cursor-pointer">
                                    Manter conectado
                                </label>
                            </div>

                            {error && (
                                <div className="p-3 bg-red-50 rounded-xl text-center text-red-600 text-xs font-bold">
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading || digits.length < 4}
                                className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-primary-200 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                                    <span className="flex items-center">Continuar <ArrowRight className="ml-2 w-4 h-4" /></span>
                                )}
                            </button>
                        </form>
                    )}

                    {/* STEP 2: PASSWORD */}
                    {(step === 'password' || step === 'create_password') && (
                        <form onSubmit={step === 'password' ? handleLoginSubmit : handleRegisterPassword} className="space-y-5 animate-slide-up">
                            
                            <div className="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-100">
                                <div>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase">Cliente</p>
                                    <p className="text-sm font-bold text-gray-800 tracking-wider">•••••-{fullPhoneFound.slice(-4)}</p>
                                </div>
                                <button type="button" onClick={resetLogin} className="text-xs font-bold text-primary-600 hover:bg-white px-3 py-1.5 rounded-lg transition-colors">
                                    Alterar
                                </button>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-500 uppercase ml-1">
                                    {step === 'create_password' ? 'Crie sua Senha de Acesso' : 'Digite sua Senha'}
                                </label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <LockKeyhole className="h-5 w-5 text-gray-400 group-focus-within:text-primary-500 transition-colors" />
                                    </div>
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        className="w-full bg-white pl-12 pr-12 py-4 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-0 outline-none transition-all text-lg font-bold text-gray-900 placeholder-gray-300"
                                        placeholder={showPassword ? "123456" : "******"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        autoFocus
                                    />
                                    {/* Password Toggle Button */}
                                    <button 
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors focus:outline-none"
                                        tabIndex={-1}
                                    >
                                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                    </button>
                                </div>
                            </div>

                            {step === 'password' && (
                                <button type="button" onClick={handleRecovery} className="w-full text-center text-xs text-primary-600 font-bold hover:underline flex items-center justify-center gap-1">
                                    <HelpCircle className="w-3 h-3" /> Esqueci a senha
                                </button>
                            )}

                            {step === 'create_password' && (
                                 <p className="text-[10px] text-center text-gray-400">
                                     Como é seu primeiro acesso, defina uma senha simples.
                                 </p>
                            )}

                            {error && (
                                <div className="p-3 bg-red-50 rounded-xl text-center text-red-600 text-xs font-bold">
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className={`w-full text-white font-bold py-4 rounded-xl shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 flex justify-center items-center ${step === 'create_password' ? 'bg-green-600 hover:bg-green-700 shadow-green-200' : 'bg-primary-600 hover:bg-primary-700 shadow-primary-200'}`}
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                                    step === 'create_password' ? 
                                    <span className="flex items-center"><UserPlus className="mr-2 w-5 h-5"/> Criar e Entrar</span> :
                                    <span className="flex items-center"><LogIn className="mr-2 w-5 h-5"/> Acessar Conta</span>
                                )}
                            </button>
                        </form>
                    )}
                </div>
            )}
            
            {/* PARTNERSHIP & TRUST BADGES */}
            <div className="mt-8 border-t border-gray-100 pt-4 flex flex-col items-center gap-2 opacity-80">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 bg-green-50 px-2 py-1 rounded-full border border-green-100">
                        <CheckCircle className="w-3 h-3 text-green-600" />
                        <span className="text-[9px] font-bold text-green-700 uppercase">100% Seguro</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-blue-50 px-2 py-1 rounded-full border border-blue-100">
                        <ShieldCheck className="w-3 h-3 text-blue-600" />
                        <span className="text-[9px] font-bold text-blue-700 uppercase">Dados Criptografados</span>
                    </div>
                </div>
                <div className="flex items-center gap-2 mt-1">
                    <span className="text-[9px] text-gray-400 font-medium">Infraestrutura:</span>
                    <div className="flex items-center gap-1 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100 grayscale hover:grayscale-0 transition-all">
                        {/* Using a generic cloud icon to represent Google Cloud without external image dependency risk */}
                        <svg viewBox="0 0 24 24" className="w-4 h-4 text-gray-500 fill-current" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
                        <span className="text-[10px] font-bold text-gray-600">Secured by Google Cloud</span>
                    </div>
                </div>
            </div>

        </div>
      </div>
      
      <p className="absolute bottom-6 text-[10px] text-gray-400 font-medium tracking-widest uppercase opacity-60">© 2024 EuDorama App</p>
    </div>
  );
};

export default Login;
