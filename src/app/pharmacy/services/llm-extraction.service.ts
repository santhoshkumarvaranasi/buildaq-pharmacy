import { Injectable } from '@angular/core';

export interface LlmMedicineDetails {
  name?: string;
  strength?: string;
  manufacturer?: string;
  genericName?: string;
}

@Injectable({
  providedIn: 'root'
})
export class LlmExtractionService {
  private readonly defaultBaseUrl = 'https://api.openai.com/v1';
  private readonly defaultModel = 'gpt-4o-mini';

  async extractMedicineDetails(text: string): Promise<LlmMedicineDetails | null> {
    const trimmed = (text || '').trim();
    if (!trimmed) return null;

    const apiKey = this.getConfigValue('LLM_API_KEY');
    if (!apiKey) {
      console.warn('LLM API key not set; skipping LLM extraction');
      return null;
    }

    const baseUrl = this.getConfigValue('LLM_API_BASE_URL') || this.defaultBaseUrl;
    const model = this.getConfigValue('LLM_MODEL') || this.defaultModel;

    const prompt = [
      'Extract medicine details from the OCR text.',
      'Return ONLY valid JSON with keys: name, strength, manufacturer, genericName.',
      'Use empty string for unknown values.'
    ].join(' ');

    const body = {
      model,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: trimmed }
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' }
    };

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        console.warn('LLM extraction failed:', response.status, response.statusText);
        return null;
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;
      if (!content) return null;

      const parsed = JSON.parse(content);
      return {
        name: this.cleanValue(parsed?.name),
        strength: this.cleanValue(parsed?.strength),
        manufacturer: this.cleanValue(parsed?.manufacturer),
        genericName: this.cleanValue(parsed?.genericName)
      };
    } catch (error) {
      console.warn('LLM extraction error:', error);
      return null;
    }
  }

  private getConfigValue(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private cleanValue(value: unknown): string {
    if (typeof value !== 'string') return '';
    return value.trim();
  }
}
