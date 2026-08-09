import React, { useState, useEffect } from 'react';
import type { User, Freelancer } from '../types';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { authApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface LoginScreenProps {
  onLogin: (user: User | Freelancer) => void;
  onNavigateToRegister: () => void;
  error?: string | null;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ 
  onLogin, 
  onNavigateToRegister, 
  error: externalError 
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [forgotPasswordSuccess, setForgotPasswordSuccess] = useState(false);
  const [captchaNumber1, setCaptchaNumber1] = useState<number>(0);
  const [captchaNumber2, setCaptchaNumber2] = useState<number>(0);
  const [captchaAnswer, setCaptchaAnswer] = useState<string>('');
  
  const { login } = useAuth();

  useEffect(() => {
    // Generate captcha numbers when forgot password modal opens
    if (showForgotPassword) {
      const num1 = Math.floor(Math.random() * 10) + 1; // 1-10
      const num2 = Math.floor(Math.random() * 10) + 1; // 1-10
      setCaptchaNumber1(num1);
      setCaptchaNumber2(num2);
      setCaptchaAnswer('');
      setError(''); // Clear any previous errors when modal opens
    }
  }, [showForgotPassword]);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
  };

  const getLoginLocation = (): Promise<{
    status: 'granted' | 'denied' | 'unsupported' | 'error' | 'timeout';
    latitude?: number;
    longitude?: number;
    accuracy?: number;
    capturedAt?: string;
    error?: string;
  }> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve({ status: 'unsupported', capturedAt: new Date().toISOString() });
        return;
      }

      let settled = false;
      const settle = (payload: {
        status: 'granted' | 'denied' | 'unsupported' | 'error' | 'timeout';
        latitude?: number;
        longitude?: number;
        accuracy?: number;
        capturedAt?: string;
        error?: string;
      }) => {
        if (settled) return;
        settled = true;
        resolve(payload);
      };

      const timeoutId = setTimeout(() => {
        settle({ status: 'timeout', capturedAt: new Date().toISOString() });
      }, 6000);

      navigator.geolocation.getCurrentPosition(
        (position) => {
          clearTimeout(timeoutId);
          settle({
            status: 'granted',
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            capturedAt: new Date().toISOString(),
          });
        },
        (geoError) => {
          clearTimeout(timeoutId);
          if (geoError.code === geoError.PERMISSION_DENIED) {
            settle({ status: 'denied', capturedAt: new Date().toISOString(), error: geoError.message });
            return;
          }
          settle({ status: 'error', capturedAt: new Date().toISOString(), error: geoError.message });
        },
        {
          enableHighAccuracy: false,
          timeout: 5500,
          maximumAge: 300000,
        }
      );
    });
  };

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Sila masukkan e-mel dan kata laluan.');
      return;
    }

    if (!validateEmail(email)) {
      setError('Sila masukkan alamat e-mel yang sah.');
      return;
    }

    if (password.length < 6) {
      setError('Kata laluan mestilah sekurang-kurangnya 6 aksara.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const loginLocation = await getLoginLocation();
      const response = await authApi.login(email, password, rememberMe, loginLocation);
      
      if (response?.success && response?.data) {
        const { user, accessToken, sessionId } = response.data;
        login(accessToken, user, sessionId, rememberMe);
        onLogin(user);
      } else {
        setError(response?.message || 'Log masuk gagal. Sila semak e-mel dan kata laluan anda.');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Ralat sambungan. Sila cuba lagi.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!forgotPasswordEmail) {
      setError('Sila masukkan alamat e-mel anda.');
      return;
    }

    if (!validateEmail(forgotPasswordEmail)) {
      setError('Sila masukkan alamat e-mel yang sah.');
      return;
    }

    // Validate captcha answer
    const answerNum = parseInt(captchaAnswer, 10);
    if (isNaN(answerNum) || answerNum !== (captchaNumber1 + captchaNumber2)) {
      setError(`Jawapan keselamatan tidak betul. ${captchaNumber1} + ${captchaNumber2} = ?`);
      return;
    }

    setForgotPasswordLoading(true);
    setError('');

    try {
      // Call forgot password API with captcha parameters
      const response = await authApi.forgotPassword(
        forgotPasswordEmail,
        answerNum,
        captchaNumber1,
        captchaNumber2
      );
      
      if (response?.success) {
        // Email wujud dan berjaya dihantar
        setForgotPasswordSuccess(true);
        setTimeout(() => {
          setShowForgotPassword(false);
          setForgotPasswordSuccess(false);
          setForgotPasswordEmail('');
          setCaptchaAnswer('');
        }, 5000); // Tingkatkan masa paparan untuk user baca mesej
      } else {
        // Handle specific error types from backend
        const errorType = response?.errorType;
        if (errorType === 'EMAIL_NOT_FOUND') {
          setError('Emel tidak dijumpai dalam sistem. Sila semak alamat emel anda.');
        } else if (errorType === 'EMAIL_SEND_FAILED') {
          setError('Sistem email mengalami masalah. Sila hubungi admin untuk bantuan.');
        } else {
          setError(response?.message || 'Gagal menghantar permintaan reset kata laluan.');
        }
      }
    } catch (err) {
      console.error('Forgot password error:', err);
      setError('Ralat sambungan. Sila cuba lagi.');
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (showForgotPassword) {
        handleForgotPassword();
      } else {
        handleLogin();
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-sm sm:max-w-md lg:max-w-lg">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="px-6 sm:px-8 pt-8 sm:pt-10 pb-6 text-center bg-gradient-to-b from-white to-gray-50">
            <div className="mb-4">
              <h1 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                SPFIT
              </h1>
            </div>
            <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-2">
              Sistem Pengurusan Freelance IT Tech
            </h2>
            <p className="text-sm sm:text-base text-gray-600">
              {showForgotPassword ? 'Reset kata laluan akaun anda.' : 'Sila log masuk ke akaun anda.'}
            </p>
          </div>

          <div className="px-6 sm:px-8 pb-8 sm:pb-10">
            <div className="space-y-5 sm:space-y-6">
              {(error || externalError) && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 sm:p-4">
                  <p className="text-sm text-red-700 font-medium">{externalError || error}</p>
                </div>
              )}              
              
              {!showForgotPassword ? (
                <>
                  <div className="space-y-4 sm:space-y-5">
                    <Input 
                      label="Alamat E-mel" 
                      id="email" 
                      type="email" 
                      value={email} 
                      onChange={e => setEmail(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="cth: ahmad@spfit.com"
                      disabled={loading}
                      className="transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <Input 
                      label="Kata Laluan" 
                      id="password" 
                      type="password" 
                      value={password} 
                      onChange={e => setPassword(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="**********"
                      disabled={loading}
                      className="transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <label className="flex items-center gap-3 text-sm text-gray-700 select-none">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        disabled={loading}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>Kekalkan log masuk</span>
                    </label>
                  </div>

                  <Button 
                    onClick={handleLogin} 
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 sm:py-4 px-6 rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none" 
                    disabled={loading}
                  >
                    {loading ? (
                      <div className="flex items-center justify-center space-x-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Sedang log masuk...</span>
                      </div>
                    ) : (
                      'Log Masuk'
                    )}
                  </Button>

                  <div className="text-center pt-2">
                    <p className="text-sm sm:text-base text-gray-600">
                      Belum mempunyai akaun?{' '}
                      <button 
                        onClick={onNavigateToRegister} 
                        className="font-semibold text-blue-600 hover:text-purple-600 transition-colors duration-200 underline decoration-2 underline-offset-2 hover:decoration-purple-600"
                      >
                        Daftar sebagai Freelancer
                      </button>
                    </p>
                    <p className="text-sm sm:text-base text-gray-600 mt-2">
                      Lupa kata laluan?{' '}
                      <button 
                        onClick={() => {
                          setShowForgotPassword(true);
                          setError('');
                        }}
                        className="font-semibold text-blue-600 hover:text-purple-600 transition-colors duration-200 underline decoration-2 underline-offset-2 hover:decoration-purple-600"
                      >
                        Reset kata laluan
                      </button>
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-4 sm:space-y-5">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
                      <p className="text-sm text-blue-700">
                        Masukkan alamat e-mel anda dan jawab soalan keselamatan. Kami akan menghantar pautan untuk reset kata laluan.
                      </p>
                    </div>

                    <Input
                      label="Alamat E-mel"
                      id="forgotPasswordEmail"
                      type="email"
                      value={forgotPasswordEmail}
                      onChange={e => setForgotPasswordEmail(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="cth: ahmad@spfit.com"
                      disabled={forgotPasswordLoading}
                    />
                    
                    {forgotPasswordSuccess ? (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <p className="text-green-700 font-medium">
                          ✓ Permintaan reset kata laluan telah dihantar ke e-mel anda.
                        </p>
                        <button 
                          onClick={() => {
                            setShowForgotPassword(false);
                            setForgotPasswordEmail('');
                            setForgotPasswordSuccess(false);
                            setError('');
                          }}
                          className="mt-3 text-sm text-blue-600 hover:text-purple-600 transition-colors duration-200 underline decoration-2 underline-offset-2"
                        >
                          Kembali ke log masuk
                        </button>
                      </div>
                    ) : (
                      <>
                        {/* Security Question - Captcha (Inline dalam borang yang sama) */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-medium text-gray-700">
                              Soalan Keselamatan
                            </label>
                            <span className="text-xs text-gray-500">Sila jawab soalan matematik mudah</span>
                          </div>
                          <div className="flex items-center space-x-3">
                            <div className="flex-1 bg-gray-100 rounded-lg p-4 text-center">
                              <p className="text-2xl font-bold text-gray-800">
                                {captchaNumber1} + {captchaNumber2} = ?
                              </p>
                            </div>
                            <div className="flex-1">
                              <input
                                type="text"
                                inputMode="numeric"
                                value={captchaAnswer}
                                onChange={e => setCaptchaAnswer(e.target.value)}
                                onKeyPress={handleKeyPress}
                                placeholder="Jawapan"
                                disabled={forgotPasswordLoading}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                              />
                            </div>
                          </div>
                          <p className="text-xs text-gray-500 mt-2">
                            Soalan keselamatan ini membantu menghalang akses tanpa kebenaran ke akaun anda.
                          </p>
                        </div>
                        
                        <div className="flex space-x-3">
                          <Button
                            onClick={handleForgotPassword}
                            className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-lg shadow-lg"
                            disabled={forgotPasswordLoading}
                          >
                            {forgotPasswordLoading ? (
                              <div className="flex items-center justify-center space-x-2">
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                <span>Menghantar...</span>
                              </div>
                            ) : (
                              'Hantar Reset'
                            )}
                          </Button>
                          <Button
                            onClick={() => {
                              setShowForgotPassword(false);
                              setForgotPasswordEmail('');
                              setError('');
                              setForgotPasswordSuccess(false);
                            }}
                            className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 px-6 rounded-lg"
                            disabled={forgotPasswordLoading}
                          >
                            Kembali
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="text-center mt-6 sm:mt-8">
          <p className="text-xs sm:text-sm text-gray-500">
             2024 SPFIT. Semua hak terpelihara.
          </p>
        </div>
      </div>
    </div>
  );
};
