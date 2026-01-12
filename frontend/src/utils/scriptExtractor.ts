/**
 * Script Extractor Utility
 * 
 * Extracts RouterOS code blocks from AI responses.
 * Code blocks are identified by ```routeros markers.
 * 
 * @module scriptExtractor
 */

/**
 * Represents an extracted script block from AI response
 */
export interface ScriptBlock {
  /** The extracted script content (without the code fence markers) */
  content: string;
  /** The language identifier (e.g., 'routeros') */
  language: string;
  /** Start index of the code block in the original text */
  startIndex: number;
  /** End index of the code block in the original text */
  endIndex: number;
}

/**
 * Regular expression to match fenced code blocks.
 * Captures:
 * - Group 1: Language identifier (optional)
 * - Group 2: Code content
 */
const CODE_BLOCK_REGEX = /```(\w*)\n([\s\S]*?)```/g;

/**
 * Extracts all code blocks from the given text.
 * 
 * @param text - The AI response text to extract code blocks from
 * @param language - Optional language filter (e.g., 'routeros'). If provided, only blocks with this language are returned.
 * @returns Array of extracted script blocks
 * 
 * @example
 * ```typescript
 * const response = `Here's a script:
 * \`\`\`routeros
 * /ip address add address=192.168.1.1/24 interface=ether1
 * \`\`\`
 * `;
 * const blocks = extractCodeBlocks(response, 'routeros');
 * // blocks[0].content === '/ip address add address=192.168.1.1/24 interface=ether1'
 * ```
 */
export function extractCodeBlocks(text: string, language?: string): ScriptBlock[] {
  const blocks: ScriptBlock[] = [];
  let match: RegExpExecArray | null;
  
  // Reset regex state
  CODE_BLOCK_REGEX.lastIndex = 0;
  
  while ((match = CODE_BLOCK_REGEX.exec(text)) !== null) {
    const blockLanguage = match[1] || '';
    const content = match[2];
    
    // Filter by language if specified
    if (language && blockLanguage.toLowerCase() !== language.toLowerCase()) {
      continue;
    }
    
    blocks.push({
      content: content.trimEnd(), // Remove trailing whitespace but preserve internal formatting
      language: blockLanguage,
      startIndex: match.index,
      endIndex: match.index + match[0].length
    });
  }
  
  return blocks;
}

/**
 * Extracts only RouterOS script blocks from the given text.
 * This is a convenience function that filters for 'routeros' language blocks.
 * 
 * @param text - The AI response text to extract RouterOS scripts from
 * @returns Array of extracted RouterOS script blocks
 * 
 * @example
 * ```typescript
 * const response = `
 * Here's a RouterOS script:
 * \`\`\`routeros
 * /interface print
 * \`\`\`
 * 
 * And here's some Python:
 * \`\`\`python
 * print("hello")
 * \`\`\`
 * `;
 * const scripts = extractRouterOSScripts(response);
 * // scripts.length === 1
 * // scripts[0].content === '/interface print'
 * ```
 */
export function extractRouterOSScripts(text: string): ScriptBlock[] {
  return extractCodeBlocks(text, 'routeros');
}

/**
 * Checks if the given text contains any RouterOS code blocks.
 * 
 * @param text - The text to check
 * @returns true if the text contains at least one RouterOS code block
 */
export function hasRouterOSScripts(text: string): boolean {
  return extractRouterOSScripts(text).length > 0;
}

/**
 * Extracts the first RouterOS script from the given text.
 * 
 * @param text - The AI response text
 * @returns The first RouterOS script block, or null if none found
 */
export function extractFirstRouterOSScript(text: string): ScriptBlock | null {
  const scripts = extractRouterOSScripts(text);
  return scripts.length > 0 ? scripts[0] : null;
}
