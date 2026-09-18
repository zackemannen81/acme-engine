import process from 'node:process';

process.loadEnvFile('C:/code/a008/.env.local');
const required = (name) => {
  const value = process.env[name];
  if (!value || value.trim().length === 0) throw new Error(`${name} is not configured`);
  return value;
};
const runtimeUrl = new URL(required('A008_ACME_MODEL_RUNTIME_URL'));
process.env.ACME_MODEL_RUNTIME_LISTEN_HOST = runtimeUrl.hostname;
process.env.ACME_MODEL_RUNTIME_LISTEN_PORT = runtimeUrl.port || '80';
process.env.ACME_MODEL_RUNTIME_BEARER_TOKEN = required('A008_ACME_MODEL_RUNTIME_TOKEN');
process.env.ACME_MODEL_RUNTIME_ENGINE_BUILD = required('A008_ACME_ENGINE_BUILD');
required('NVIDIA_API_KEY');
if (process.env.NVIDIA_CHAT_COMPLETIONS_URL) {
  process.env.ACME_MODEL_RUNTIME_NVIDIA_ENDPOINT = process.env.NVIDIA_CHAT_COMPLETIONS_URL;
}
process.env.ACME_MODEL_RUNTIME_NVIDIA_PROFILES = JSON.stringify([
  {
    selection: { profile: 'moonshotai/kimi-k3', providerHint: 'nvidia', modelHint: 'moonshotai/kimi-k3' },
    model: 'moonshotai/kimi-k3',
    capabilities: { structuredOutput: false, tools: true, vision: true },
    controls: { temperature: true, maxOutputTokens: true, reasoningEffort: true, seed: true },
  },
  {
    selection: { profile: 'nvidia/nemotron-3.5-lightning-30b-a3b', providerHint: 'nvidia', modelHint: 'nvidia/nemotron-3.5-lightning-30b-a3b' },
    model: 'nvidia/nemotron-3.5-lightning-30b-a3b',
    capabilities: { structuredOutput: false, tools: true, vision: false },
    controls: { temperature: true, topP: true, maxOutputTokens: true, stop: true, reasoningBudget: true, enableThinking: 'enable_thinking', seed: true },
  },
]);
await import('./apps/cli/dist/acme-model-runtime-service-main.js');
