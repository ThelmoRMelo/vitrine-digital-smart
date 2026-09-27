import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  categoria?: string;
}

interface NegotiationState {
  hasOfferedDiscount: boolean;
  lastDiscountOffered: number | null;
  discountAttempts: number;
  maxDiscountReached: boolean;
}

interface ClosingState {
  isClosing: boolean;
  closingReason: 'discount_max' | 'purchase_intent' | 'price_accepted' | 'contact_request' | null;
  closingAttempts: number;
  hasOfferedWhatsApp: boolean;
  hasOfferedPaymentLink: boolean;
  conversationEnded: boolean;
}

const SESSION_KEY = 'chat_session_id';

export function useConversation(productId?: string, isSimulation: boolean = false) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [negotiation, setNegotiation] = useState<NegotiationState>({
    hasOfferedDiscount: false,
    lastDiscountOffered: null,
    discountAttempts: 0,
    maxDiscountReached: false
  });
  const [closing, setClosing] = useState<ClosingState>({
    isClosing: false,
    closingReason: null,
    closingAttempts: 0,
    hasOfferedWhatsApp: false,
    hasOfferedPaymentLink: false,
    conversationEnded: false
  });
  const [loading, setLoading] = useState(true);
  const lastBotResponseRef = useRef<string>('');
  const initRef = useRef(false);
  const currentProductIdRef = useRef<string | undefined>(productId);

  // Gerar ou recuperar session_id - agora inclui productId para contexto separado
  const getSessionId = useCallback(() => {
    // Para chat público com produto específico, usar session_id único por produto
    const baseKey = isSimulation ? `${SESSION_KEY}_sim` : SESSION_KEY;
    const key = productId ? `${baseKey}_product_${productId}` : baseKey;
    
    let sessionId = localStorage.getItem(key);
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      localStorage.setItem(key, sessionId);
    }
    return sessionId;
  }, [isSimulation, productId]);

  // Criar nova conversa
  const createConversation = useCallback(async (sessionId: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase
        .from('conversations')
        .insert({
          session_id: sessionId,
          product_id: productId || null,
          is_simulation: isSimulation
        })
        .select('id')
        .single();

      if (error) throw error;
      return data.id;
    } catch (err) {
      console.error('[useConversation] Create error:', err);
      return null;
    }
  }, [productId, isSimulation]);

  // Carregar conversa existente ou criar nova
  const loadConversation = useCallback(async () => {
    if (initRef.current) return;
    initRef.current = true;
    
    try {
      setLoading(true);
      const sessionId = getSessionId();

      // Buscar conversa existente
      const { data: existingConv, error: fetchError } = await supabase
        .from('conversations')
        .select('*')
        .eq('session_id', sessionId)
        .eq('is_simulation', isSimulation)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError) throw fetchError;

      let convId: string;

      if (existingConv) {
        convId = existingConv.id;
        setConversationId(convId);
        
        // Restaurar estados
        if (existingConv.negotiation_state) {
          setNegotiation(existingConv.negotiation_state as unknown as NegotiationState);
        }
        if (existingConv.closing_state) {
          setClosing(existingConv.closing_state as unknown as ClosingState);
        }

        // Carregar mensagens
        const { data: msgs, error: msgError } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', convId)
          .order('created_at', { ascending: true });

        if (msgError) throw msgError;

        if (msgs && msgs.length > 0) {
          const loadedMsgs: Message[] = msgs.map(m => ({
            id: m.id,
            content: m.content,
            sender: m.sender as 'user' | 'bot',
            timestamp: new Date(m.created_at),
            categoria: m.categoria || undefined
          }));
          setMessages(loadedMsgs);
          
          // Última resposta do bot
          const lastBot = loadedMsgs.filter(m => m.sender === 'bot').pop();
          if (lastBot) {
            lastBotResponseRef.current = lastBot.content;
          }
        }
      } else {
        // Criar nova conversa
        const newId = await createConversation(sessionId);
        if (newId) {
          convId = newId;
          setConversationId(newId);
        }
      }
    } catch (err) {
      console.error('[useConversation] Load error:', err);
    } finally {
      setLoading(false);
    }
  }, [getSessionId, createConversation, isSimulation]);

  // Adicionar mensagem
  // Agora permite informar previamente o ID da mensagem.
  // Isso possibilita preparar o áudio antes de inserir a mensagem no chat.
  const addMessage = useCallback(async (
    content: string,
    sender: 'user' | 'bot',
    categoria?: string,
    messageId?: string
  ): Promise<Message | null> => {
    if (!conversationId) return null;

    try {
      const messageData: {
        id?: string;
        conversation_id: string;
        content: string;
        sender: 'user' | 'bot';
        categoria?: string;
      } = {
        conversation_id: conversationId,
        content,
        sender,
        categoria
      };

      // Se o Chat.tsx já preparou um ID para o áudio,
      // usamos exatamente o mesmo ID no banco.
      if (messageId) {
        messageData.id = messageId;
      }

      const { data, error } = await supabase
        .from('messages')
        .insert(messageData)
        .select()
        .single();

      if (error) throw error;

      const newMsg: Message = {
        id: data.id,
        content: data.content,
        sender: data.sender as 'user' | 'bot',
        timestamp: new Date(data.created_at),
        categoria: data.categoria || undefined
      };

      setMessages(prev => [...prev, newMsg]);

      if (sender === 'bot') {
        lastBotResponseRef.current = content;
      }

      return newMsg;
    } catch (err) {
      console.error('[useConversation] Add message error:', err);
      return null;
    }
  }, [conversationId]);

  // Atualizar estado de negociação
  const updateNegotiation = useCallback(async (updates: Partial<NegotiationState>) => {
    if (!conversationId) return;

    const newState = { ...negotiation, ...updates };
    setNegotiation(newState);

    try {
      await supabase
        .from('conversations')
        .update({ negotiation_state: newState })
        .eq('id', conversationId);
    } catch (err) {
      console.error('[useConversation] Update negotiation error:', err);
    }
  }, [conversationId, negotiation]);

  // Atualizar estado de fechamento
  const updateClosing = useCallback(async (updates: Partial<ClosingState>) => {
    if (!conversationId) return;

    const newState = { ...closing, ...updates };
    setClosing(newState);

    try {
      await supabase
        .from('conversations')
        .update({ closing_state: newState })
        .eq('id', conversationId);
    } catch (err) {
      console.error('[useConversation] Update closing error:', err);
    }
  }, [conversationId, closing]);

  // Limpar conversa (nova sessão) - agora suporta productId
  const clearConversation = useCallback(async () => {
    const baseKey = isSimulation ? `${SESSION_KEY}_sim` : SESSION_KEY;
    const key = productId ? `${baseKey}_product_${productId}` : baseKey;
    localStorage.removeItem(key);
    
    setMessages([]);
    setConversationId(null);
    setNegotiation({
      hasOfferedDiscount: false,
      lastDiscountOffered: null,
      discountAttempts: 0,
      maxDiscountReached: false
    });
    setClosing({
      isClosing: false,
      closingReason: null,
      closingAttempts: 0,
      hasOfferedWhatsApp: false,
      hasOfferedPaymentLink: false,
      conversationEnded: false
    });
    lastBotResponseRef.current = '';
    initRef.current = false;

    // Criar nova conversa automaticamente
    const newSessionId = crypto.randomUUID();
    localStorage.setItem(key, newSessionId);
    const newId = await createConversation(newSessionId);
    if (newId) {
      setConversationId(newId);
    }
    setLoading(false);
    
    return newId;
  }, [isSimulation, productId, createConversation]);

  // Detectar mudança de produto e reiniciar conversa
  useEffect(() => {
    if (currentProductIdRef.current !== productId) {
      currentProductIdRef.current = productId;
      initRef.current = false;
      loadConversation();
    }
  }, [productId, loadConversation]);

  useEffect(() => {
    loadConversation();
  }, [loadConversation]);

  return {
    conversationId,
    messages,
    negotiation,
    closing,
    loading,
    lastBotResponse: lastBotResponseRef.current,
    addMessage,
    updateNegotiation,
    updateClosing,
    clearConversation,
    setMessages
  };
}
