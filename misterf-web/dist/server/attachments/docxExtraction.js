/**
 * DOCX handling.
 *
 * No model or provider ingests a Word document, so extraction is not an
 * optimization here — it is the only path. The output is text, and the bytes
 * are dropped immediately afterwards.
 *
 * Mammoth converts to HTML rather than raw text because headings, lists, and
 * tables carry pedagogical structure in a worksheet: "1. ___ 2. ___" reads very
 * differently from a paragraph. The HTML is then flattened to text through the
 * same converter used for web pages, so both document paths agree on what
 * "structured text" looks like.
 */
import mammoth from 'mammoth';
import { htmlToPlainText } from './htmlText.js';
import { maxDocxDecompressedBytes, maxExtractedTextChars } from './limits.js';
import { AttachmentRejectedError, } from './types.js';
export async function extractDocx(bytes) {
    const warnings = [];
    const result = await mammoth
        .convertToHtml({ buffer: bytes }, {
        // Images inside a DOCX would otherwise be inlined as base64 data URIs,
        // which is both useless to a text pipeline and a way to blow past the
        // decompression ceiling from a small file.
        convertImage: mammoth.images.imgElement(async () => ({ src: '' })),
    })
        .catch(() => null);
    if (!result) {
        throw new AttachmentRejectedError('decode_failed');
    }
    // A ZIP can expand far beyond its packed size. The check happens on the
    // converted output because that is the first point where the real expanded
    // volume is known.
    if (result.value.length > maxDocxDecompressedBytes) {
        throw new AttachmentRejectedError('too_large', {
            limitMb: Math.floor(maxDocxDecompressedBytes / (1024 * 1024)),
        });
    }
    const text = htmlToPlainText(result.value);
    if (result.messages.some((message) => message.type === 'warning')) {
        warnings.push({ code: 'docx_tables_simplified' });
    }
    if (text.length > maxExtractedTextChars) {
        warnings.push({ code: 'text_truncated' });
    }
    return { text, warnings };
}
//# sourceMappingURL=docxExtraction.js.map