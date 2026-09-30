/**
 * Image Generation Intent Detector & Prompt Extractor
 * Identifies conversational image requests such as:
 * - "Generate an image of a cat"
 * - "Create an image of a futuristic city"
 * - "Make a picture of a robot"
 * - "Draw a cyberpunk car"
 * - "Create a realistic photo of a mountain"
 * - "Generate a logo for a bookstore"
 * - "Make an illustration of a dragon"
 * - "Create a poster of space exploration"
 * - "Generate a picture of a black Lamborghini"
 * - "Generate an image of a red apple on a white table"
 */

export interface ImageIntentResult {
  isImageIntent: boolean;
  prompt: string;
  title: string;
}

export function detectImageGenerationIntent(input: string): ImageIntentResult {
  const text = (input || '').trim();
  if (!text) {
    return { isImageIntent: false, prompt: '', title: '' };
  }

  const lower = text.toLowerCase();

  // Negative guards: Explanations, coding requests, general knowledge
  if (
    lower.startsWith('explain ') ||
    lower.startsWith('what does ') ||
    lower.startsWith('what is ') ||
    lower.startsWith('how to ') ||
    lower.startsWith('why is ') ||
    lower.startsWith('why does ') ||
    lower.includes('write python') ||
    lower.includes('write code') ||
    lower.includes('give me code') ||
    lower.includes('show code') ||
    lower.includes('calculate factorial')
  ) {
    return { isImageIntent: false, prompt: '', title: '' };
  }

  // Common wake word / assistant prefixes
  const normalized = text
    .replace(/^(?:hey\s+)?(?:aura|assistant|jarvis)[,\s]*/i, '')
    .trim();

  // Pattern 1: (generate|create|make|produce|render|paint|draw) (an?|the) (image|picture|photo|photograph|drawing|illustration|logo|poster|artwork|graphic|render) (of|showing|depicting|with|for) ...
  const pattern1 = /^(?:please\s+)?(?:generate|create|make|produce|render|paint|draw)\s+(?:an?|a|the)?\s*(?:image|picture|photo|photograph|drawing|illustration|logo|poster|artwork|graphic|render)\s+(?:of|showing|depicting|with|for)\s+(.+)/i;

  // Pattern 2: (draw|paint|illustrate|render) (me )?(a|an)? ...
  const pattern2 = /^(?:please\s+)?(?:draw|paint|illustrate|render)\s+(?:me\s+)?(?:an?|a)?\s*(.+)/i;

  // Pattern 3: (generate|create|make) (a|an) (logo|poster|illustration) (for|of) ...
  const pattern3 = /^(?:please\s+)?(?:generate|create|make)\s+(?:an?|a)\s*(?:logo|poster|illustration)\s+(?:for|of)\s+(.+)/i;

  // Pattern 4: (generate image|create image|image generation|image of|picture of):? ...
  const pattern4 = /^(?:generate\s+image|create\s+image|image\s+generation|image\s+of|picture\s+of)\s*[:\s]\s*(.+)/i;

  // Pattern 5: (generate|create|make) ... (image|picture|illustration|photo|drawing)
  const pattern5 = /^(?:please\s+)?(?:generate|create|make)\s+(.+?)\s+(?:image|picture|illustration|photo|drawing)$/i;

  let prompt = '';
  let match = normalized.match(pattern1);
  if (match && match[1]) {
    prompt = match[1].trim();
  } else {
    match = normalized.match(pattern2);
    if (match && match[1]) {
      prompt = match[1].trim();
    } else {
      match = normalized.match(pattern3);
      if (match && match[1]) {
        prompt = match[1].trim();
      } else {
        match = normalized.match(pattern4);
        if (match && match[1]) {
          prompt = match[1].trim();
        } else {
          match = normalized.match(pattern5);
          if (match && match[1]) {
            prompt = match[1].trim();
          }
        }
      }
    }
  }

  // Fallback for short generic "generate an image" without object
  if (!prompt && /^(?:please\s+)?(?:generate|create|make|draw)\s+(?:an?|a)?\s*(?:image|picture|photo)$/i.test(normalized)) {
    prompt = 'a futuristic cybernetic landscape with glowing neon lights';
  }

  if (prompt) {
    // Clean up trailing punctuation
    prompt = prompt.replace(/[.!?]+$/, '').trim();
    
    // Create clean human-readable title
    let title = prompt;
    if (title.length > 35) {
      title = title.slice(0, 35).replace(/\s+\S*$/, '') + '...';
    }
    title = title.charAt(0).toUpperCase() + title.slice(1);

    return {
      isImageIntent: true,
      prompt,
      title,
    };
  }

  return { isImageIntent: false, prompt: '', title: '' };
}
