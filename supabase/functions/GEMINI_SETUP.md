# Configuração do Gemini para as Edge Functions

O frontend não recebe a chave. Cadastre `GEMINI_API_KEY` nos secrets do projeto Supabase antes de implantar as funções.

## Modelos usados

- Chat e respostas a avaliações: `gemini-3.5-flash-lite`.
- Transcrição: `gemini-3.5-transcribe`.
- Voz: `gemini-3.8-flash-lite-tts`.

Os modelos e as cotas podem mudar. A cota gratuita não é ilimitada nem garantida. Consulte os limites aplicáveis ao projeto no Google AI Studio.

## Privacidade e plano

Na tabela atual de preços da Gemini Developer API, o nível gratuito indica que prompts e respostas podem ser usados para melhorar os produtos do Google; no nível pago, a tabela indica que não são usados para esse fim. O chat contém mensagens de clientes e a transcrição envia áudio ao provedor. Revise a política vigente e escolha conscientemente o tipo de projeto/chave antes de usar dados reais. A função de transcrição solicita a exclusão do arquivo temporário após o processamento; o provedor informa exclusão automática em até 48 horas caso a limpeza falhe.

## Configuração e implantação

Crie a chave no Google AI Studio e execute no diretório do repositório:

```powershell
supabase secrets set GEMINI_API_KEY="SUA_CHAVE_GEMINI"
supabase functions deploy ai-fallback
supabase functions deploy transcribe-audio
supabase functions deploy text-to-speech
supabase functions deploy generate-review-reply
```

Não coloque a chave em `.env`, no frontend ou no Git. Os comandos acima apenas estão documentados; esta alteração local não cadastrou secrets nem implantou funções.

As chamadas ao Gemini são feitas uma vez por requisição. Em indisponibilidade/limite, o chat mantém a contingência factual com os dados confirmados do catálogo; os demais recursos retornam uma mensagem segura para nova tentativa. Nenhuma resposta bruta do provedor é devolvida ao cliente ou registrada nos logs.
