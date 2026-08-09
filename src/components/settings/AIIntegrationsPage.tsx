import React, { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { wasapmaticApi, marzWasapApi, openaiApi, geminiApi, ilmuApi } from '../../services/api';
import { ICONS } from '../ui/icons';

interface AIIntegrationsPageProps {
  onBack: () => void;
}

interface TestResult {
  success: boolean;
  message: string;
}

export const AIIntegrationsPage: React.FC<AIIntegrationsPageProps> = ({ onBack }) => {
  // State for API keys
  const [openaiKey, setOpenaiKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [wasapmaticKey, setWasapmaticKey] = useState('');
  const [wasapmaticDeviceId, setWasapmaticDeviceId] = useState('');
  const [wasapmaticApiUrl, setWasapmaticApiUrl] = useState('https://app.wasapmatic.com/api');
  const [marzApiSecret, setMarzApiSecret] = useState('');
  const [marzAccountId, setMarzAccountId] = useState('');
  const [activeWhatsAppProvider, setActiveWhatsAppProvider] = useState<'wasapmatic' | 'marz' | null>(null);
  const [selectedWhatsAppTab, setSelectedWhatsAppTab] = useState<'wasapmatic' | 'marz'>('wasapmatic');
  
  // State for saved keys (to show if key already exists)
  const [openaiKeySaved, setOpenaiKeySaved] = useState(false);
  const [geminiKeySaved, setGeminiKeySaved] = useState(false);
  const [wasapmaticConfigSaved, setWasapmaticConfigSaved] = useState(false);
  const [marzConfigSaved, setMarzConfigSaved] = useState(false);
  const [openaiEditMode, setOpenaiEditMode] = useState(false);
  const [geminiEditMode, setGeminiEditMode] = useState(false);
  const [wasapmaticEditMode, setWasapmaticEditMode] = useState(false);
  const [marzEditMode, setMarzEditMode] = useState(false);

  // State for models
  const [openaiModels, setOpenaiModels] = useState<string[]>([]);
  const [geminiModels, setGeminiModels] = useState<string[]>([]);
  const [selectedOpenaiModel, setSelectedOpenaiModel] = useState('gpt-4o-mini');
  const [selectedGeminiModel, setSelectedGeminiModel] = useState('gemini-2.0-flash');

  // State for ILMU AI
  const [ilmuModels, setIlmuModels] = useState<string[]>(['nemo-super']);
  const [selectedIlmuModel, setSelectedIlmuModel] = useState('nemo-super');
  const [ilmuKey, setIlmuKey] = useState('');
  const [ilmuKeySaved, setIlmuKeySaved] = useState(false);
  const [ilmuEditMode, setIlmuEditMode] = useState(false);
  const [ilmuBaseUrl, setIlmuBaseUrl] = useState('https://api.ilmu.ai/v1');
  const [activeProviderTab, setActiveProviderTab] = useState<'openai' | 'gemini' | 'ilmu' | 'whatsapp'>('openai');

  // State for test messages
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [testPrompt, setTestPrompt] = useState('');

  // State for loading and results
  const [loading, setLoading] = useState<{ [key: string]: boolean }>({});
  const [results, setResults] = useState<{ [key: string]: TestResult | null }>({});

  // Fetch models on component mount
  useEffect(() => {
    const fetchModels = async () => {
      try {
        // Fetch OpenAI models
        const openaiModelsResult = await openaiApi.getModels();
        if (openaiModelsResult.success && openaiModelsResult.data) {
          const models = Array.isArray(openaiModelsResult.data) 
            ? openaiModelsResult.data.map((m: any) => m.id || m.name || m)
            : ['gpt-4o-mini', 'gpt-4', 'gpt-3.5-turbo'];
          setOpenaiModels(models);
        }
      } catch (error) {
        console.log('Could not fetch OpenAI models, using defaults');
        setOpenaiModels(['gpt-4o-mini', 'gpt-4', 'gpt-3.5-turbo']);
      }

      try {
        // Fetch Gemini models
        const geminiModelsResult = await geminiApi.getModels();
        if (geminiModelsResult.success && geminiModelsResult.data) {
          const modelsData = (geminiModelsResult.data as any).models || geminiModelsResult.data;
          const models = Array.isArray(modelsData) 
            ? modelsData.map((m: any) => {
                const modelName = m.name || m;
                // Remove 'models/' prefix if present
                return typeof modelName === 'string' ? modelName.replace(/^models\//, '') : modelName;
              })
            : ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash', 'gemini-1.5-pro'];
          setGeminiModels(models);
        }
      } catch (error) {
        console.log('Could not fetch Gemini models, using defaults');
        setGeminiModels(['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash', 'gemini-1.5-pro']);
      }

      try {
        const geminiConfigResult = await geminiApi.getConfig();
        if (geminiConfigResult.success && geminiConfigResult.data) {
          const configuredModel = (geminiConfigResult.data as any).model;
          if (configuredModel && typeof configuredModel === 'string') {
            setSelectedGeminiModel(configuredModel.replace(/^models\//, ''));
          }
        }
      } catch (error) {
        console.log('Could not fetch Gemini saved model, using default selection');
      }

      try {
        const ilmuConfigResult = await ilmuApi.getConfig();
        if (ilmuConfigResult.success && ilmuConfigResult.data) {
          const cfg = ilmuConfigResult.data as any;
          if (cfg.model) setSelectedIlmuModel(cfg.model);
          if (cfg.base_url) setIlmuBaseUrl(cfg.base_url);
        }
      } catch {}
    };

    fetchModels();

    // Check saved configs for all services
    const checkSavedConfigs = async () => {
      try {
        const [openaiTest, geminiTest, ilmuTest, wasapmaticTest, marzTest, providerStatus] = await Promise.allSettled([
          openaiApi.testConnection(),
          geminiApi.testConnection(),
          ilmuApi.testConnection(),
          wasapmaticApi.testConnection(),
          marzWasapApi.testConnection(),
          wasapmaticApi.getProviderStatus(),
        ]);

        if (openaiTest.status === 'fulfilled' && openaiTest.value?.data?.success) {
          setOpenaiKeySaved(true);
        }

        if (geminiTest.status === 'fulfilled' && geminiTest.value?.data?.success) {
          setGeminiKeySaved(true);
        }

        if (ilmuTest.status === 'fulfilled' && ilmuTest.value?.data?.success) {
          setIlmuKeySaved(true);
        }
        // Note: WhatsApp providers check value?.success because their routes return { success } directly without apiRequest wrapper

        if (wasapmaticTest.status === 'fulfilled' && wasapmaticTest.value?.data?.success) {
          setWasapmaticConfigSaved(true);
        }

        if (marzTest.status === 'fulfilled' && marzTest.value?.data?.success) {
          setMarzConfigSaved(true);
        }

        if (providerStatus.status === 'fulfilled' && providerStatus.value?.success) {
          const activeProvider = (providerStatus.value.data as any)?.activeProvider;
          if (activeProvider === 'wasapmatic' || activeProvider === 'marz') {
            setActiveWhatsAppProvider(activeProvider);
            setSelectedWhatsAppTab(activeProvider);
          } else {
            setActiveWhatsAppProvider(null);
          }
        }
      } catch (err) {
        // ignore errors on initial check
      }
    };

    checkSavedConfigs();
  }, []);

  const handleTest = async (service: 'openai' | 'gemini' | 'ilmu' | 'wasapmatic' | 'marz') => {
    setLoading({ ...loading, [service]: true });
    try {
      let result;
      switch (service) {
        case 'openai':
          result = await openaiApi.testConnection();
          break;
        case 'gemini':
          result = await geminiApi.testConnection();
          break;
        case 'ilmu':
          result = await ilmuApi.testConnection();
          break;
        case 'wasapmatic':
          result = await wasapmaticApi.testConnection();
          break;
        case 'marz':
          result = await marzWasapApi.testConnection();
          break;
      }
      
      // Handle response - check for nested data structure
      const responseData = result.data || result;
      if (result.success && responseData) {
        setResults({ 
          ...results, 
          [service]: { 
            success: true, 
            message: responseData.message || 'Connection successful' 
          } 
        });
      } else {
        setResults({ 
          ...results, 
          [service]: { 
            success: false, 
            message: result.error || responseData.message || 'Connection failed' 
          } 
        });
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message || 'Connection failed';
      setResults({ 
        ...results, 
        [service]: { 
          success: false, 
          message: errorMsg 
        } 
      });
    } finally {
      setLoading({ ...loading, [service]: false });
    }
  };

  const handleUpdateKey = async (service: 'openai' | 'gemini' | 'ilmu', apiKey: string) => {
    setLoading({ ...loading, [`${service}_update`]: true });
    try {
      let result;
      if (service === 'openai') {
        result = await openaiApi.updateConfig({ apiKey });
      } else if (service === 'gemini') {
        result = await geminiApi.updateConfig({ apiKey, model: selectedGeminiModel });
      } else if (service === 'ilmu') {
        result = await ilmuApi.saveConfig({ apiKey, model: selectedIlmuModel, baseUrl: ilmuBaseUrl });
      }
      
      if (result.success) {
        alert(`${service.toUpperCase()} API key updated successfully!`);
        setResults({ ...results, [service]: { success: true, message: result.message || result.data?.message || 'Updated' } });
        
        // Mark as saved and exit edit mode
        if (service === 'openai') {
          setOpenaiKeySaved(true);
          setOpenaiEditMode(false);
          setOpenaiKey(''); // Clear input for security
        } else if (service === 'gemini') {
          setGeminiKeySaved(true);
          setGeminiEditMode(false);
          setGeminiKey('');
        } else if (service === 'ilmu') {
          setIlmuKeySaved(true);
          setIlmuEditMode(false);
          setResults({ ...results, ilmu: result });
          return;
        }
      } else {
        const errorMsg = result.error || result.message || result.data?.message || 'Failed to update API key';
        alert(`Failed to update ${service.toUpperCase()} API key: ${errorMsg}`);
        setResults({ ...results, [service]: { success: false, message: errorMsg } });
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message || 'Unknown error';
      alert(`Error: ${errorMsg}`);
      setResults({ ...results, [service]: { success: false, message: errorMsg } });
    } finally {
      setLoading({ ...loading, [`${service}_update`]: false });
    }
  };

  const handleSendWAMessage = async () => {
    if (!testPhone || !testMessage) {
      alert('Please enter phone number and message');
      return;
    }

    if (!activeWhatsAppProvider) {
      alert('Aktifkan salah satu WhatsApp provider dahulu.');
      return;
    }

    setLoading({ ...loading, wa_send: true });
    try {
      const result = await wasapmaticApi.sendMessage({
        to: testPhone,
        message: testMessage
      });

      if (result.success) {
        alert('WhatsApp message sent successfully!');
        setResults({
          ...results,
          wa_send: {
            success: true,
            message: `Mesej test dihantar melalui ${activeWhatsAppProvider === 'wasapmatic' ? 'Wasapmatic' : 'Marz Wasap'}`,
          },
        });
        setTestMessage('');
      } else {
        setResults({
          ...results,
          wa_send: {
            success: false,
            message: result.error || 'Unknown error',
          },
        });
        alert(`Failed to send message: ${result.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      setResults({
        ...results,
        wa_send: {
          success: false,
          message: error.message || 'Unknown error',
        },
      });
      alert(`Error: ${error.message}`);
    } finally {
      setLoading({ ...loading, wa_send: false });
    }
  };

  const handleSetActiveProvider = async (provider: 'wasapmatic' | 'marz' | null) => {
    setLoading({ ...loading, provider_update: true });
    try {
      const result = await wasapmaticApi.setActiveProvider(provider);
      if (result.success) {
        setActiveWhatsAppProvider(provider);
        setResults({
          ...results,
          provider: {
            success: true,
            message: provider
              ? `${provider === 'wasapmatic' ? 'Wasapmatic' : 'Marz Wasap'} kini aktif`
              : 'Tiada provider aktif',
          },
        });
      } else {
        setResults({
          ...results,
          provider: { success: false, message: (result as any).error || result.message || 'Gagal set provider aktif' },
        });
      }
    } catch (error: any) {
      setResults({
        ...results,
        provider: { success: false, message: error.response?.data?.message || error.message || 'Gagal set provider aktif' },
      });
    } finally {
      setLoading({ ...loading, provider_update: false });
    }
  };

  const handleUpdateMarzConfig = async () => {
    if (!marzApiSecret || !marzAccountId) {
      alert('Please enter both API secret and Account ID');
      return;
    }

    setLoading({ ...loading, marz_update: true });
    try {
      const result = await marzWasapApi.updateConfig({
        apiSecret: marzApiSecret,
        accountId: marzAccountId,
        isActive: activeWhatsAppProvider === 'marz',
      });

      if (result.success) {
        alert('Marz Wasap configuration updated successfully!');
        setResults({ ...results, marz: { success: true, message: result.message || 'Configuration saved' } });
        setMarzConfigSaved(true);
        setMarzEditMode(false);
        setMarzApiSecret('');
        setMarzAccountId('');
      } else {
        const errorMsg = (result as any).error || result.message || 'Failed to update configuration';
        alert(`Failed: ${errorMsg}`);
        setResults({ ...results, marz: { success: false, message: errorMsg } });
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message || 'Unknown error';
      alert(`Error: ${errorMsg}`);
      setResults({ ...results, marz: { success: false, message: errorMsg } });
    } finally {
      setLoading({ ...loading, marz_update: false });
    }
  };

  const handleUpdateWasapmaticConfig = async () => {
    if (!wasapmaticKey || !wasapmaticDeviceId) {
      alert('Please enter both API key and Device ID');
      return;
    }

    setLoading({ ...loading, wasapmatic_update: true });
    try {
      const result = await wasapmaticApi.updateConfig({
        apiKey: wasapmaticKey,
        deviceId: wasapmaticDeviceId,
        apiUrl: wasapmaticApiUrl,
        isActive: activeWhatsAppProvider === 'wasapmatic',
      });

      if (result.success) {
        alert('Wasapmatic configuration updated successfully!');
        setResults({ ...results, wasapmatic: { success: true, message: result.message || 'Configuration saved' } });
        setWasapmaticConfigSaved(true);
        setWasapmaticEditMode(false);
        setWasapmaticKey('');
        setWasapmaticDeviceId('');
      } else {
        const errorMsg = result.error || result.message || 'Failed to update configuration';
        alert(`Failed: ${errorMsg}`);
        setResults({ ...results, wasapmatic: { success: false, message: errorMsg } });
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message || 'Unknown error';
      alert(`Error: ${errorMsg}`);
      setResults({ ...results, wasapmatic: { success: false, message: errorMsg } });
    } finally {
      setLoading({ ...loading, wasapmatic_update: false });
    }
  };

  const handleTestAI = async (service: 'openai' | 'gemini' | 'ilmu') => {
    if (!testPrompt) {
      alert('Please enter a test prompt');
      return;
    }

    setLoading({ ...loading, [`${service}_test`]: true });
    try {
      let result;
      if (service === 'openai') {
        result = await openaiApi.chat({
          messages: [{ role: 'user', content: testPrompt }],
          model: selectedOpenaiModel
        });
      } else if (service === 'gemini') {
        result = await geminiApi.generate({ 
          prompt: testPrompt,
          model: selectedGeminiModel 
        });
      } else if (service === 'ilmu') {
        result = await ilmuApi.chat({
          messages: [{ role: 'user', content: testPrompt }],
          model: selectedIlmuModel
        });
      }

      if (result.success && result.data) {
        const response = service === 'openai' || service === 'ilmu'
          ? result.data.choices[0]?.message?.content 
          : result.data.text;
        alert(`AI Response:\n\n${response}`);
      } else {
        alert(`Failed to get response: ${result.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setLoading({ ...loading, [`${service}_test`]: false });
    }
  };

  const StatusBadge = ({ result }: { result: TestResult | null }) => {
    if (!result) return null;
    return (
      <div className={`mt-2 p-2 rounded text-sm ${result.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
        {result.success ? '✓' : '✗'} {result.message}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Integrasi AI & Messaging</h2>
          <p className="mt-1 text-sm text-gray-600">Urus API keys dan test integrasi dengan OpenAI, Gemini, Wasapmatic, dan Marz Wasap</p>
        </div>
        <Button variant="secondary" onClick={onBack}>Kembali ke Tetapan</Button>
      </div>

      {/* Provider Tabs */}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setActiveProviderTab('openai')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
            activeProviderTab === 'openai'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}>🤖 OpenAI</button>
        <button type="button" onClick={() => setActiveProviderTab('gemini')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
            activeProviderTab === 'gemini'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}>✨ Gemini</button>
        <button type="button" onClick={() => setActiveProviderTab('ilmu')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
            activeProviderTab === 'ilmu'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}>🧠 ILMU AI</button>
        <button type="button" onClick={() => setActiveProviderTab('whatsapp')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
            activeProviderTab === 'whatsapp'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}>💬 WhatsApp</button>
      </div>

      {activeProviderTab === 'openai' && (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">🤖</span>
          <h3 className="text-lg font-bold text-gray-800">OpenAI Integration</h3>
        </div>
        
        <div className="space-y-4">
          {openaiKeySaved && !openaiEditMode ? (
            <div className="p-4 bg-green-50 border border-green-200 rounded">
              <p className="text-green-800 font-semibold mb-2">✓ API Key Configured</p>
              <div className="flex gap-2">
                <Button 
                  size="sm"
                  variant="secondary"
                  onClick={() => setOpenaiEditMode(true)}
                >
                  Edit Key
                </Button>
                <Button 
                  size="sm"
                  variant="danger"
                  onClick={() => {
                    if (confirm('Delete OpenAI API key?')) {
                      setOpenaiKeySaved(false);
                      setOpenaiKey('');
                      setResults({ ...results, openai: null });
                    }
                  }}
                >
                  Delete Key
                </Button>
                <Button 
                  size="sm"
                  onClick={() => handleTest('openai')}
                  disabled={loading.openai}
                >
                  {loading.openai ? 'Testing...' : 'Test Connection'}
                </Button>
              </div>
              <StatusBadge result={results.openai || null} />
            </div>
          ) : (
            <div>
              <Input
                label="OpenAI API Key"
                type="password"
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                placeholder="sk-..."
              />
              <div className="flex gap-2 mt-2">
                <Button 
                  size="sm" 
                  onClick={() => handleUpdateKey('openai', openaiKey)}
                  disabled={!openaiKey || loading.openai_update}
                >
                  {loading.openai_update ? 'Updating...' : openaiEditMode ? 'Update Key' : 'Save API Key'}
                </Button>
                {openaiEditMode && (
                  <Button 
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setOpenaiEditMode(false);
                      setOpenaiKey('');
                    }}
                  >
                    Cancel
                  </Button>
                )}
                <Button 
                  size="sm" 
                  variant="secondary"
                  onClick={() => handleTest('openai')}
                  disabled={loading.openai}
                >
                  {loading.openai ? 'Testing...' : 'Test Connection'}
                </Button>
              </div>
              <StatusBadge result={results.openai || null} />
            </div>
          )}

          <div className="border-t pt-4">
            <h4 className="font-semibold mb-2">Test AI Generation</h4>
            {openaiModels.length > 0 && (
              <Select
                label="Select Model"
                value={selectedOpenaiModel}
                onChange={(e) => setSelectedOpenaiModel(e.target.value)}
              >
                {openaiModels.map(model => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </Select>
            )}
            <Input
              label="Test Prompt"
              value={testPrompt}
              onChange={(e) => setTestPrompt(e.target.value)}
              placeholder="Enter a test prompt..."
              className="mt-2"
            />
            <Button 
              size="sm" 
              className="mt-2"
              onClick={() => handleTestAI('openai')}
              disabled={!testPrompt || loading.openai_test}
            >
              {loading.openai_test ? 'Generating...' : 'Test OpenAI'}
            </Button>
          </div>
        </div>
      </div>
      )}

      {activeProviderTab === 'gemini' && (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">✨</span>
          <h3 className="text-lg font-bold text-gray-800">Google Gemini Integration</h3>
        </div>
        
        <div className="space-y-4">
          {geminiKeySaved && !geminiEditMode ? (
            <div className="p-4 bg-green-50 border border-green-200 rounded">
              <p className="text-green-800 font-semibold mb-2">✓ API Key Configured</p>
              <div className="flex gap-2">
                <Button 
                  size="sm"
                  variant="secondary"
                  onClick={() => setGeminiEditMode(true)}
                >
                  Edit Key
                </Button>
                <Button 
                  size="sm"
                  variant="danger"
                  onClick={() => {
                    if (confirm('Delete Gemini API key?')) {
                      setGeminiKeySaved(false);
                      setGeminiKey('');
                      setResults({ ...results, gemini: null });
                    }
                  }}
                >
                  Delete Key
                </Button>
                <Button 
                  size="sm"
                  onClick={() => handleTest('gemini')}
                  disabled={loading.gemini}
                >
                  {loading.gemini ? 'Testing...' : 'Test Connection'}
                </Button>
              </div>
              <StatusBadge result={results.gemini || null} />
            </div>
          ) : (
            <div>
              <Input
                label="Gemini API Key"
                type="password"
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder="AIza..."
              />
              <div className="flex gap-2 mt-2">
                <Button 
                  size="sm" 
                  onClick={() => handleUpdateKey('gemini', geminiKey)}
                  disabled={!geminiKey || loading.gemini_update}
                >
                  {loading.gemini_update ? 'Updating...' : geminiEditMode ? 'Update Key' : 'Save API Key'}
                </Button>
                {geminiEditMode && (
                  <Button 
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setGeminiEditMode(false);
                      setGeminiKey('');
                    }}
                  >
                    Cancel
                  </Button>
                )}
                <Button 
                  size="sm" 
                  variant="secondary"
                  onClick={() => handleTest('gemini')}
                  disabled={loading.gemini}
                >
                  {loading.gemini ? 'Testing...' : 'Test Connection'}
                </Button>
              </div>
              <StatusBadge result={results.gemini || null} />
            </div>
          )}

          <div className="border-t pt-4">
            <h4 className="font-semibold mb-2">Test AI Generation</h4>
            {geminiModels.length > 0 && (
              <Select
                label="Select Model"
                value={selectedGeminiModel}
                onChange={(e) => setSelectedGeminiModel(e.target.value)}
              >
                {geminiModels.map(model => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </Select>
            )}
            <Input
              label="Test Prompt"
              value={testPrompt}
              onChange={(e) => setTestPrompt(e.target.value)}
              placeholder="Enter a test prompt..."
              className="mt-2"
            />
            <Button 
              size="sm" 
              className="mt-2"
              onClick={() => handleTestAI('gemini')}
              disabled={!testPrompt || loading.gemini_test}
            >
              {loading.gemini_test ? 'Generating...' : 'Test Gemini'}
            </Button>
          </div>
        </div>
      </div>
      )}

      {activeProviderTab === 'ilmu' && (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">🧠</span>
          <h3 className="text-lg font-bold text-gray-800">ILMU AI Integration</h3>
        </div>
        
        <div className="space-y-4">
          {ilmuKeySaved && !ilmuEditMode ? (
            <div className="p-4 bg-green-50 border border-green-200 rounded">
              <p className="text-green-800 font-semibold mb-2">✓ API Key Configured</p>
              <div className="flex gap-2">
                <Button 
                  size="sm"
                  variant="secondary"
                  onClick={() => setIlmuEditMode(true)}
                >
                  Edit Key
                </Button>
                <Button 
                  size="sm"
                  variant="danger"
                  onClick={() => {
                    if (confirm('Delete ILMU AI API key?')) {
                      setIlmuKeySaved(false);
                      setIlmuKey('');
                      setResults({ ...results, ilmu: null });
                    }
                  }}
                >
                  Delete Key
                </Button>
                <Button 
                  size="sm"
                  onClick={() => handleTest('ilmu')}
                  disabled={loading.ilmu}
                >
                  {loading.ilmu ? 'Testing...' : 'Test Connection'}
                </Button>
              </div>
              <StatusBadge result={results.ilmu || null} />
            </div>
          ) : (
            <div>
              <Input
                label="ILMU AI API Key"
                type="password"
                value={ilmuKey}
                onChange={(e) => setIlmuKey(e.target.value)}
                placeholder="ilmu-..."
              />
              <Input
                label="Base URL"
                value={ilmuBaseUrl}
                onChange={(e) => setIlmuBaseUrl(e.target.value)}
                placeholder="https://api.ilmu.ai/v1"
                className="mt-2"
              />
              <Input
                label="Model Name"
                value={selectedIlmuModel}
                onChange={(e) => setSelectedIlmuModel(e.target.value)}
                placeholder="nemo-super"
                className="mt-2"
              />
              <div className="flex gap-2 mt-2">
                <Button 
                  size="sm" 
                  onClick={() => handleUpdateKey('ilmu', ilmuKey)}
                  disabled={!ilmuKey || loading.ilmu_update}
                >
                  {loading.ilmu_update ? 'Updating...' : ilmuEditMode ? 'Update Key' : 'Save API Key'}
                </Button>
                {ilmuEditMode && (
                  <Button 
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setIlmuEditMode(false);
                      setIlmuKey('');
                    }}
                  >
                    Cancel
                  </Button>
                )}
                <Button 
                  size="sm" 
                  variant="secondary"
                  onClick={() => handleTest('ilmu')}
                  disabled={loading.ilmu}
                >
                  {loading.ilmu ? 'Testing...' : 'Test Connection'}
                </Button>
              </div>
              <StatusBadge result={results.ilmu || null} />
            </div>
          )}

          <div className="border-t pt-4">
            <h4 className="font-semibold mb-2">Test AI Generation</h4>
            <Input
              label="Test Prompt"
              value={testPrompt}
              onChange={(e) => setTestPrompt(e.target.value)}
              placeholder="Enter a test prompt..."
              className="mt-2"
            />
            <Button 
              size="sm" 
              className="mt-2"
              onClick={() => handleTestAI('ilmu')}
              disabled={!testPrompt || loading.ilmu_test}
            >
              {loading.ilmu_test ? 'Generating...' : 'Test ILMU AI'}
            </Button>
          </div>
        </div>
      </div>
      )}

      {activeProviderTab === 'whatsapp' && (
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-4 sm:p-5 space-y-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-xl">🔀</span>
          <h3 className="text-base font-bold text-gray-800">Pilih WhatsApp Provider</h3>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedWhatsAppTab('wasapmatic')}
            className={`px-4 py-2 rounded-md border text-sm font-medium transition ${selectedWhatsAppTab === 'wasapmatic' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}
          >
            Wasapmatic
          </button>
          <button
            type="button"
            onClick={() => setSelectedWhatsAppTab('marz')}
            className={`px-4 py-2 rounded-md border text-sm font-medium transition ${selectedWhatsAppTab === 'marz' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}
          >
            Marz Wasap
          </button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 border rounded-lg border-gray-200">
          <div>
            <span className="font-medium">
              {selectedWhatsAppTab === 'wasapmatic' ? 'Wasapmatic' : 'Marz Wasap'}
            </span>
            {selectedWhatsAppTab === 'wasapmatic' && !wasapmaticConfigSaved && (
              <span className="ml-2 text-xs text-gray-400">(belum dikonfigurasi)</span>
            )}
            {selectedWhatsAppTab === 'marz' && !marzConfigSaved && (
              <span className="ml-2 text-xs text-gray-400">(belum dikonfigurasi)</span>
            )}
          </div>
          <Button
            size="sm"
            onClick={() => handleSetActiveProvider(selectedWhatsAppTab)}
            disabled={
              loading.provider_update ||
              (selectedWhatsAppTab === 'wasapmatic' ? !wasapmaticConfigSaved : !marzConfigSaved) ||
              activeWhatsAppProvider === selectedWhatsAppTab
            }
          >
            {activeWhatsAppProvider === selectedWhatsAppTab
              ? 'Sedang Aktif'
              : selectedWhatsAppTab === 'wasapmatic'
                ? 'Aktifkan Wasapmatic'
                : 'Aktifkan Marz Wasap'}
          </Button>
        </div>

        {!activeWhatsAppProvider && (
          <div className="p-3 rounded border border-amber-300 bg-amber-50 text-amber-800 text-sm">
            ⚠️ Tiada WhatsApp API aktif. Sistem tidak dapat menghantar mesej sehingga salah satu provider diaktifkan.
          </div>
        )}
        {activeWhatsAppProvider && (
          <div className="p-3 rounded border border-green-300 bg-green-50 text-green-800 text-sm">
            ✓ Provider aktif: <strong>{activeWhatsAppProvider === 'wasapmatic' ? 'Wasapmatic' : 'Marz Wasap'}</strong>
          </div>
        )}
        <StatusBadge result={results.provider || null} />
      </div>

      <div className="p-4 sm:p-6">

      {/* Wasapmatic Section */}
      {selectedWhatsAppTab === 'wasapmatic' && (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">💬</span>
          <h3 className="text-lg font-bold text-gray-800">Wasapmatic WhatsApp Integration</h3>
        </div>
        
        <div className="space-y-4">
          {wasapmaticConfigSaved && !wasapmaticEditMode ? (
            <div>
              <div className="flex items-center gap-2 mb-4 bg-green-50 p-3 rounded-lg border border-green-200">
                <span className="text-green-600 text-lg">✓</span>
                <span className="font-semibold text-green-700">Configuration Saved</span>
              </div>
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  variant="secondary"
                  onClick={() => setWasapmaticEditMode(true)}
                >
                  Edit Configuration
                </Button>
                <Button 
                  size="sm" 
                  variant="secondary"
                  onClick={() => {
                    setWasapmaticConfigSaved(false);
                    setWasapmaticKey('');
                    setWasapmaticDeviceId('');
                    setWasapmaticApiUrl('https://app.wasapmatic.com/api');
                  }}
                >
                  Delete Configuration
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <Input
                label="Wasapmatic API Key"
                type="password"
                value={wasapmaticKey}
                onChange={(e) => setWasapmaticKey(e.target.value)}
                placeholder="Enter API Key"
              />
              <Input
                label="Device ID"
                value={wasapmaticDeviceId}
                onChange={(e) => setWasapmaticDeviceId(e.target.value)}
                placeholder="Enter Device ID"
                className="mt-2"
              />
              <Input
                label="API URL (Optional)"
                value={wasapmaticApiUrl}
                onChange={(e) => setWasapmaticApiUrl(e.target.value)}
                placeholder="https://app.wasapmatic.com/api"
                className="mt-2"
              />
              <div className="flex gap-2 mt-2">
                <Button 
                  size="sm" 
                  onClick={() => handleUpdateWasapmaticConfig()}
                  disabled={!wasapmaticKey || !wasapmaticDeviceId || loading.wasapmatic_update}
                >
                  {loading.wasapmatic_update ? 'Updating...' : wasapmaticEditMode ? 'Update Configuration' : 'Save Configuration'}
                </Button>
                {wasapmaticEditMode && (
                  <Button 
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setWasapmaticEditMode(false);
                      setWasapmaticKey('');
                      setWasapmaticDeviceId('');
                      setWasapmaticApiUrl('https://app.wasapmatic.com/api');
                    }}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          )}

          <div className="border-t pt-4">
            <h4 className="font-semibold mb-2">Test Connection</h4>
            <Button 
              size="sm" 
              variant="secondary"
              onClick={() => handleTest('wasapmatic')}
              disabled={!wasapmaticConfigSaved || loading.wasapmatic}
            >
              {loading.wasapmatic ? 'Testing...' : 'Test Connection'}
            </Button>
            <StatusBadge result={results.wasapmatic || null} />
          </div>

        </div>
      </div>
      )}

      {/* Marz Wasap Section */}
      {selectedWhatsAppTab === 'marz' && (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">📲</span>
          <h3 className="text-lg font-bold text-gray-800">Marz Wasap Integration</h3>
        </div>

        <div className="space-y-4">
          {marzConfigSaved && !marzEditMode ? (
            <div>
              <div className="flex items-center gap-2 mb-4 bg-green-50 p-3 rounded-lg border border-green-200">
                <span className="text-green-600 text-lg">✓</span>
                <span className="font-semibold text-green-700">Configuration Saved</span>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setMarzEditMode(true)}
                >
                  Edit Configuration
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setMarzConfigSaved(false);
                    setMarzApiSecret('');
                    setMarzAccountId('');
                    if (activeWhatsAppProvider === 'marz') {
                      handleSetActiveProvider(null);
                    }
                  }}
                >
                  Delete Configuration
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <Input
                label="API Secret"
                type="password"
                value={marzApiSecret}
                onChange={(e) => setMarzApiSecret(e.target.value)}
                placeholder="Enter API Secret"
              />
              <Input
                label="WhatsApp Account ID"
                value={marzAccountId}
                onChange={(e) => setMarzAccountId(e.target.value)}
                placeholder="Account unique ID dari /get/wa.accounts"
                className="mt-2"
              />
              <p className="text-xs text-gray-500 mt-1">
                Marz Wasap API URL adalah hardcoded ke `http://wasap.marz.biz.my/api` dalam sistem.
              </p>
              <div className="flex gap-2 mt-2">
                <Button
                  size="sm"
                  onClick={handleUpdateMarzConfig}
                  disabled={!marzApiSecret || !marzAccountId || loading.marz_update}
                >
                  {loading.marz_update ? 'Updating...' : marzEditMode ? 'Update Configuration' : 'Save Configuration'}
                </Button>
                {marzEditMode && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setMarzEditMode(false);
                      setMarzApiSecret('');
                      setMarzAccountId('');
                    }}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          )}

          <div className="border-t pt-4">
            <h4 className="font-semibold mb-2">Test Connection</h4>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => handleTest('marz')}
              disabled={!marzConfigSaved || loading.marz}
            >
              {loading.marz ? 'Testing...' : 'Test Connection'}
            </Button>
            <StatusBadge result={results.marz || null} />
          </div>
        </div>
      </div>
      )}

      <div className="border-t pt-4 mt-4">
        <h4 className="font-semibold mb-2">Send Test Message (Universal)</h4>
        <p className="text-xs text-gray-600 mb-2">
          Test ini akan ikut provider WhatsApp yang sedang aktif.
          {activeWhatsAppProvider
            ? ` Provider aktif: ${activeWhatsAppProvider === 'wasapmatic' ? 'Wasapmatic' : 'Marz Wasap'}.`
            : ' Tiada provider aktif.'}
        </p>
        <Input
          label="Phone Number"
          value={testPhone}
          onChange={(e) => setTestPhone(e.target.value)}
          placeholder="60123456789"
        />
        <Input
          label="Message"
          value={testMessage}
          onChange={(e) => setTestMessage(e.target.value)}
          placeholder="Test message..."
          className="mt-2"
        />
        {!activeWhatsAppProvider && (
          <p className="mt-2 text-xs text-amber-700">Aktifkan salah satu WhatsApp provider dahulu untuk menghantar mesej.</p>
        )}
        <Button
          size="sm"
          className="mt-2"
          onClick={handleSendWAMessage}
          disabled={!testPhone || !testMessage || loading.wa_send || !activeWhatsAppProvider}
        >
          {loading.wa_send ? 'Sending...' : 'Try Send Test'}
        </Button>
        <StatusBadge result={results.wa_send || null} />
      </div>
      </div>
      </div>
      )}

      {/* Info Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">ℹ️ Maklumat</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• API keys disimpan dengan selamat dalam pangkalan data sistem</li>
          <li>• Pastikan API keys anda aktif dan mempunyai kredit yang mencukupi</li>
          <li>• OpenAI: <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="underline">Dapatkan API key</a></li>
          <li>• Gemini: <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="underline">Dapatkan API key</a></li>
          <li>• ILMU AI: Malaysian-hosted LLM, OpenAI-compatible API. Dapatkan key dari portal ILMU AI</li>
          <li>• Wasapmatic: <a href="https://wasapmatic.com" target="_blank" rel="noopener noreferrer" className="underline">Dapatkan API key</a></li>
          <li>• Marz Wasap: gunakan API secret dan account ID dari dashboard Marz Wasap</li>
          <li>• Nota: Marz Wasap mengikut dokumentasi Wasapmatic yang sama; hanya tukar domain API.</li>
        </ul>
      </div>
    </div>
  );
};