import { VisualContentData } from '../types.js';

/**
 * Extracts visual companion data (code, link, command, table, steps)
 * from response text if not explicitly provided by tool call.
 */
export function extractVisualContentFromText(text: string): {
  cleanText: string;
  visualContent?: VisualContentData;
} {
  if (!text) return { cleanText: text };

  // 1. Detect markdown code block
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/;
  const codeMatch = text.match(codeBlockRegex);
  if (codeMatch) {
    const language = codeMatch[1].trim() || 'python';
    const code = codeMatch[2].trim();
    // If it's bash/sh command
    if (language === 'bash' || language === 'sh' || language === 'shell' || code.startsWith('npm ') || code.startsWith('pip ') || code.startsWith('brew ')) {
      const clean = text.replace(codeBlockRegex, '').trim();
      return {
        cleanText: clean || `I've displayed the ${language} command for you.`,
        visualContent: {
          type: 'command',
          title: 'Terminal Command',
          command: code,
          language,
        },
      };
    }

    const clean = text.replace(codeBlockRegex, '').trim();
    return {
      cleanText: clean || `I've displayed the ${language} code for you.`,
      visualContent: {
        type: 'code',
        title: `${language.charAt(0).toUpperCase() + language.slice(1)} Code`,
        code,
        language,
      },
    };
  }

  // 2. Detect markdown table
  if (text.includes('|') && text.includes('\n|') && text.includes('---')) {
    const lines = text.split('\n');
    const tableLines = lines.filter(l => l.trim().startsWith('|') && l.trim().endsWith('|'));
    if (tableLines.length >= 3) {
      const headerLine = tableLines[0];
      const headers = headerLine.split('|').map(c => c.trim()).filter(Boolean);
      // skip divider row
      const rowLines = tableLines.slice(2);
      const rows = rowLines.map(rl => rl.split('|').map(c => c.trim()).filter(Boolean));

      const clean = lines.filter(l => !l.trim().startsWith('|')).join('\n').trim();
      return {
        cleanText: clean || "Here is the comparison table you requested.",
        visualContent: {
          type: 'table',
          title: 'Comparison Table',
          tableHeaders: headers,
          tableRows: rows,
        },
      };
    }
  }

  // 3. Detect standalone URLs (especially government / official / portal links)
  const urlRegex = /(https?:\/\/[^\s<>"']+)/i;
  const urlMatch = text.match(urlRegex);
  if (urlMatch) {
    const rawUrl = urlMatch[1].replace(/[.,;:)]$/, '');
    let title = 'Official Web Portal';
    if (rawUrl.includes('nfsa.gov.in') || text.toLowerCase().includes('ration')) {
      title = 'National Food Security Portal (Ration Card)';
    } else if (rawUrl.includes('uidai.gov.in') || text.toLowerCase().includes('aadhaar')) {
      title = 'UIDAI Official Aadhaar Portal';
    } else if (rawUrl.includes('github.com')) {
      title = 'GitHub Repository';
    } else if (rawUrl.includes('python.org')) {
      title = 'Official Python Website';
    }

    return {
      cleanText: text,
      visualContent: {
        type: 'link',
        title,
        url: rawUrl,
        urlLabel: 'Open Official Portal',
      },
    };
  }

  return { cleanText: text };
}
