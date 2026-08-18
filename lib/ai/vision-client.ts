import OpenAI, { AzureOpenAI } from "openai";

// Cliente compartilhado de visão (Azure OpenAI ou OpenAI direto), usado tanto
// pela leitura de hodômetro quanto pela leitura de CRLV. Inicializado eager no
// module-level pra eliminar latência de cold-start.
const client: OpenAI | null = (() => {
  const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT?.trim();
  const azureKey = process.env.AZURE_OPENAI_API_KEY?.trim();
  const azureDeployment =
    process.env.AZURE_OPENAI_VISION_DEPLOYMENT?.trim() ?? process.env.AZURE_OPENAI_DEPLOYMENT?.trim();

  if (azureEndpoint && azureKey && azureDeployment) {
    // AzureOpenAI monta a URL correta /openai/deployments/{deployment}/chat/completions
    return new AzureOpenAI({
      apiKey: azureKey,
      endpoint: azureEndpoint.replace(/\/$/, ""),
      apiVersion: process.env.AZURE_OPENAI_API_VERSION ?? "2025-01-01-preview",
      deployment: azureDeployment,
      timeout: 60_000,
      maxRetries: 1,
    });
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  return new OpenAI({ apiKey, timeout: 60_000, maxRetries: 1 });
})();

export function getVisionClient(): OpenAI | null {
  return client;
}

export function getVisionModel(): string {
  return (
    process.env.AZURE_OPENAI_VISION_DEPLOYMENT ??
    process.env.OPENAI_VISION_MODEL ??
    "gpt-4o"
  );
}
