import { Ollama } from "ollama";

const ollama = new Ollama({ host: "http://localhost:11434" });

export async function getEmbedding(text: string) {
  const response = await ollama.embed({
    model: 'all-minilm:latest',
    input: text,
  });
  return response.embeddings[0];
}
