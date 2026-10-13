import { useState, useRef, useEffect } from 'react';
import { Bot, Globe, Download, Upload, RefreshCw, Trash2, ChevronRight, Check, Phone, CreditCard, FileUp, Database, Target, Zap, MessageSquare } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { BottomNav } from '@/components/BottomNav';
import { Button } from '@/components/ui/button';
import { InstallAppButton } from '@/components/InstallAppButton';
import { ChangePasswordSection } from '@/components/ChangePasswordSection';

import { Input } from '@/components/ui/input';
import { useApp } from '@/contexts/AppContext';
import { useBusinessConfig } from '@/hooks/useBusinessConfig';
import { toast } from 'sonner';

const saleModes = [
  { id: 'consultiva', label: 'Consultiva', emoji: '🎓', desc: 'Foca em entender a necessidade' },
  { id: 'vendedora', label: 'Vendedora', emoji: '🎯', desc: 'Persuasiva e proativa' },
  { id: 'fechamento_rapido', label: 'Fechamento Rápido', emoji: '⚡', desc: 'Direto ao ponto' },
] as const;

export default function Settings() {
  const { 
    exportBrain, 
    exportProducts, 
    exportDataset,
    exportAll,
    importBrain, 
    importProducts, 
    importDataset,
    products, 
    trainingData, 
    dataset,
    resetAllData 
  } = useApp();
  
  const { config, loading: configLoading, updateConfig } = useBusinessConfig();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [paymentLink, setPaymentLink] = useState('');
  
  const brainInputRef = useRef<HTMLInputElement>(null);
  const productsInputRef = useRef<HTMLInputElement>(null);
  const datasetInputRef = useRef<HTMLInputElement>(null);

  // Carregar valores do config
  useEffect(() => {
    if (config) {
      setWhatsappNumber(config.whatsapp_number || '');
      setPaymentLink(config.payment_link || '');
    }
  }, [config]);

  const handleSaleModeChange = async (mode: 'consultiva' | 'vendedora' | 'fechamento_rapido') => {
    const result = await updateConfig({ sale_mode: mode });
    if (result?.success) {
      toast.success(`Modo alterado para ${saleModes.find(s => s.id === mode)?.label}`);
    }
  };

  const handleWhatsappSave = async () => {
    if (!whatsappNumber.trim()) {
      toast.error('Informe um número de WhatsApp');
      return;
    }
    const result = await updateConfig({ 
      whatsapp_number: whatsappNumber,
      transfer_enabled: true 
    });
    if (result?.success) {
      toast.success('WhatsApp salvo!');
    }
  };

  const handlePaymentLinkSave = async () => {
    if (!paymentLink.trim()) {
      toast.error('Informe um link de pagamento');
      return;
    }
    const result = await updateConfig({ payment_link: paymentLink });
    if (result?.success) {
      toast.success('Link de pagamento salvo!');
    }
  };

  const handleTransferToggle = async () => {
    if (!config?.whatsapp_number && !config?.transfer_enabled) {
      toast.error('Configure o WhatsApp primeiro');
      return;
    }
    const result = await updateConfig({ transfer_enabled: !config?.transfer_enabled });
    if (result?.success) {
      toast.success(config?.transfer_enabled ? 'Transferência desativada' : 'Transferência ativada');
    }
  };

  const handleBackup = () => {
    exportAll();
    toast.success('Backup completo exportado!');
  };

  const handleImportBrain = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setIsImporting(true);
    try {
      const content = await file.text();
      const result = await importBrain(content);
      
      if (result.success && result.stats) {
        toast.success(
          `Brain importado! ${result.stats.trainings} novos treinamentos, ${result.stats.updated} atualizados`
        );
      } else {
        toast.error(result.error || 'Erro ao importar brain.js');
      }
    } catch (error) {
      toast.error('Erro ao ler arquivo');
    } finally {
      setIsImporting(false);
      if (brainInputRef.current) brainInputRef.current.value = '';
    }
  };

  const handleImportProducts = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setIsImporting(true);
    try {
      const content = await file.text();
      const result = await importProducts(content);
      
      if (result.success && result.stats) {
        toast.success(
          `Produtos importados! ${result.stats.added} novos, ${result.stats.updated} atualizados`
        );
      } else {
        toast.error(result.error || 'Erro ao importar products.js');
      }
    } catch (error) {
      toast.error('Erro ao ler arquivo');
    } finally {
      setIsImporting(false);
      if (productsInputRef.current) productsInputRef.current.value = '';
    }
  };

  const handleImportDataset = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setIsImporting(true);
    try {
      const content = await file.text();
      const result = await importDataset(content);
      
      if (result.success && result.stats) {
        toast.success(
          `Dataset importado! ${result.stats.added} novos, ${result.stats.updated} atualizados`
        );
      } else {
        toast.error(result.error || 'Erro ao importar dataset.js');
      }
    } catch (error) {
      toast.error('Erro ao ler arquivo');
    } finally {
      setIsImporting(false);
      if (datasetInputRef.current) datasetInputRef.current.value = '';
    }
  };

  const handleReset = () => {
    if (confirm('Tem certeza que deseja resetar todos os dados? Esta ação não pode ser desfeita.')) {
      resetAllData();
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen pb-24">
      <PageHeader title="Ajustes" subtitle="Configurações de vendas" />

      <main className="px-6 py-4 space-y-4 max-w-lg mx-auto">
        <InstallAppButton />
        <ChangePasswordSection />


        {/* Sale Mode */}
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <Target className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="font-semibold">Modo de Venda</h3>
              <p className="text-sm text-muted-foreground">Como sua IA vai negociar</p>
            </div>
          </div>

          <div className="space-y-2">
            {saleModes.map((mode) => (
              <button
                key={mode.id}
                onClick={() => handleSaleModeChange(mode.id)}
                disabled={configLoading}
                className={`w-full p-3 rounded-xl flex items-center gap-3 text-left transition-all ${
                  config?.sale_mode === mode.id
                    ? 'bg-primary/20 border border-primary/50'
                    : 'bg-muted/30 hover:bg-muted/50'
                }`}
              >
                <span className="text-2xl">{mode.emoji}</span>
                <div className="flex-1">
                  <div className="font-medium text-sm">{mode.label}</div>
                  <div className="text-xs text-muted-foreground">{mode.desc}</div>
                </div>
                {config?.sale_mode === mode.id && (
                  <Check className="w-4 h-4 text-primary" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Payment Link */}
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <h3 className="font-semibold">Link de Pagamento</h3>
              <p className="text-sm text-muted-foreground">A IA pode enviar ao cliente</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Input
              value={paymentLink}
              onChange={(e) => setPaymentLink(e.target.value)}
              placeholder="https://pay.seu-link.com/..."
              className="flex-1"
            />
            <Button variant="gradient" size="sm" onClick={handlePaymentLinkSave}>
              <Check className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Mercado Pago, PagSeguro, Stripe, etc.
          </p>
        </div>

        {/* WhatsApp Transfer */}
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
              <Phone className="w-5 h-5 text-cyan-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">Transferência de Atendimento</h3>
              <p className="text-sm text-muted-foreground">Enviar cliente para WhatsApp</p>
            </div>
            <button
              onClick={handleTransferToggle}
              disabled={!config?.whatsapp_number}
              className={`w-12 h-7 rounded-full transition-all ${
                config?.transfer_enabled && config?.whatsapp_number ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                config?.transfer_enabled && config?.whatsapp_number ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>
          <div className="flex gap-2">
            <Input
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
              placeholder="5511999999999"
              className="flex-1"
            />
            <Button variant="gradient" size="sm" onClick={handleWhatsappSave}>
              <Check className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Número com código do país (sem +)
          </p>
        </div>

        {/* Language */}
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <Globe className="w-5 h-5 text-blue-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">Idioma</h3>
              <p className="text-sm text-muted-foreground">Português (Brasil)</p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </div>
        </div>

        {/* Stats */}
        <div className="glass-card rounded-2xl p-5">
          <h3 className="font-semibold mb-3">Dados Configurados</h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-muted/30 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold gradient-text">{trainingData.length}</p>
              <p className="text-xs text-muted-foreground">Respostas</p>
            </div>
            <div className="bg-muted/30 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold gradient-text">{products.length}</p>
              <p className="text-xs text-muted-foreground">Produtos</p>
            </div>
            <div className="bg-muted/30 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold gradient-text">{dataset.length}</p>
              <p className="text-xs text-muted-foreground">Dataset</p>
            </div>
          </div>
        </div>

        {/* Backup - Exportar */}
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
              <Download className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <h3 className="font-semibold">Exportar</h3>
              <p className="text-sm text-muted-foreground">Baixar arquivos de configuração</p>
            </div>
          </div>
          <div className="space-y-2">
            <Button variant="glass" className="w-full" onClick={handleBackup}>
              <Download className="w-4 h-4" />
              Exportar tudo
            </Button>
            <div className="grid grid-cols-3 gap-2">
              <Button variant="outline" size="sm" onClick={exportBrain}>
                brain.js
              </Button>
              <Button variant="outline" size="sm" onClick={exportProducts}>
                products.js
              </Button>
              <Button variant="outline" size="sm" onClick={exportDataset}>
                dataset.js
              </Button>
            </div>
          </div>
        </div>

        {/* Advanced */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="glass-card rounded-2xl p-5 w-full text-left flex items-center gap-3"
        >
          <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
            <RefreshCw className="w-5 h-5 text-orange-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold">Modo avançado</h3>
            <p className="text-sm text-muted-foreground">Importação e reset</p>
          </div>
          <ChevronRight className={`w-5 h-5 text-muted-foreground transition-transform ${showAdvanced ? 'rotate-90' : ''}`} />
        </button>

        {showAdvanced && (
          <div className="glass-card rounded-xl p-4 animate-slide-up space-y-4">
            {/* Importar */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Importar arquivos</h4>
              <input
                ref={brainInputRef}
                type="file"
                accept=".js"
                onChange={handleImportBrain}
                className="hidden"
                id="import-brain"
              />
              <Button 
                variant="outline" 
                className="w-full justify-start gap-2"
                onClick={() => brainInputRef.current?.click()}
                disabled={isImporting}
              >
                <FileUp className="w-4 h-4" />
                Importar brain.js
              </Button>
              
              <input
                ref={productsInputRef}
                type="file"
                accept=".js"
                onChange={handleImportProducts}
                className="hidden"
                id="import-products"
              />
              <Button 
                variant="outline" 
                className="w-full justify-start gap-2"
                onClick={() => productsInputRef.current?.click()}
                disabled={isImporting}
              >
                <FileUp className="w-4 h-4" />
                Importar products.js
              </Button>
              
              <input
                ref={datasetInputRef}
                type="file"
                accept=".js"
                onChange={handleImportDataset}
                className="hidden"
                id="import-dataset"
              />
              <Button 
                variant="outline" 
                className="w-full justify-start gap-2"
                onClick={() => datasetInputRef.current?.click()}
                disabled={isImporting}
              >
                <Database className="w-4 h-4" />
                Importar dataset.js
              </Button>
            </div>

            {/* Emojis Toggle */}
            <div className="flex items-center justify-between py-2">
              <span className="text-sm">Usar emojis nas respostas</span>
              <button
                onClick={async () => {
                  const result = await updateConfig({ use_emojis: !config?.use_emojis });
                  if (result?.success) {
                    toast.success(config?.use_emojis ? 'Emojis desativados' : 'Emojis ativados');
                  }
                }}
                className={`w-12 h-7 rounded-full transition-all ${
                  config?.use_emojis ? 'bg-primary' : 'bg-muted'
                }`}
              >
                <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  config?.use_emojis ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>

            {/* Reset */}
            <div className="pt-2 border-t border-border/50">
              <Button
                variant="destructive"
                className="w-full"
                onClick={handleReset}
              >
                <Trash2 className="w-4 h-4" />
                Resetar todos os dados
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-2">
                Esta ação não pode ser desfeita
              </p>
            </div>
          </div>
        )}

        {/* Version */}
        <p className="text-center text-xs text-muted-foreground pt-4">
          Sistema de Vendas com IA v2.0.0
        </p>
      </main>

      <BottomNav />
    </div>
  );
}
