import OpenAI, { AzureOpenAI } from "openai";

// Clientes compartilhados de IA (Azure OpenAI ou OpenAI direto). Inicializados
// eager no module-level pra eliminar latência de cold-start.
//
// O client do Azure é amarrado a um deployment específico na construção, então
// visão e texto precisam de instâncias separadas quando os deployments diferem.
function buildClient(deployment: string | undefined): OpenAI | null {
  const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT?.trim();
  const azureKey = process.env.AZURE_OPENAI_API_KEY?.trim();

  if (azureEndpoint && azureKey && deployment) {
    // AzureOpenAI monta a URL correta /openai/deployments/{deployment}/chat/completions
    return new AzureOpenAI({
      apiKey: azureKey,
      endpoint: azureEndpoint.replace(/\/$/, ""),
      apiVersion: process.env.AZURE_OPENAI_API_VERSION ?? "2025-01-01-preview",
      deployment,
      timeout: 60_000,
      maxRetries: 1,
    });
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  return new OpenAI({ apiKey, timeout: 60_000, maxRetries: 1 });
}

function visionDeployment(): string | undefined {
  return (
    process.env.AZURE_OPENAI_VISION_DEPLOYMENT?.trim() ?? process.env.AZURE_OPENAI_DEPLOYMENT?.trim()
  );
}

// Texto prefere o deployment genérico; cai no de visão porque os deployments de
// chat da Azure atendem os dois casos e nem todo ambiente configura os dois.
function textDeployment(): string | undefined {
  return (
    process.env.AZURE_OPENAI_DEPLOYMENT?.trim() ?? process.env.AZURE_OPENAI_VISION_DEPLOYMENT?.trim()
  );
}

const visionClient: OpenAI | null = buildClient(visionDeployment());
const textClient: OpenAI | null = buildClient(textDeployment());

export function getVisionClient(): OpenAI | null {
  return visionClient;
}

export function getVisionModel(): string {
  return (
    process.env.AZURE_OPENAI_VISION_DEPLOYMENT ??
    process.env.OPENAI_VISION_MODEL ??
    "gpt-4o"
  );
}

export function getTextClient(): OpenAI | null {
  return textClient;
}

export function getTextModel(): string {
  return (
    process.env.AZURE_OPENAI_DEPLOYMENT ??
    process.env.AZURE_OPENAI_VISION_DEPLOYMENT ??
    process.env.OPENAI_CHECKLIST_MODEL ??
    "gpt-4.1-mini"
  );
}
