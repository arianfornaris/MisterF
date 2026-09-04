/**
 * Maps attachment outcome codes to user-facing copy.
 *
 * Codes are the stable contract between the ingestion layer and the UI; the
 * wording lives in the locale catalogs. Keeping the mapping explicit rather
 * than deriving key names from codes means a renamed code fails to compile
 * instead of silently rendering a raw key to the user.
 */
import { translate } from '../i18n/index.js';
const rejectionKeys = {
    content_mismatch: 'attachments.error.contentMismatch',
    decode_failed: 'attachments.error.decodeFailed',
    empty_file: 'attachments.error.emptyFile',
    empty_text: 'attachments.error.emptyText',
    extraction_failed: 'attachments.error.extractionFailed',
    staging_full: 'attachments.error.stagingFull',
    too_large: 'attachments.error.tooLarge',
    too_many_pages: 'attachments.error.tooManyPages',
    unsupported_type: 'attachments.error.unsupportedType',
    url_blocked: 'attachments.error.urlBlocked',
    url_fetch_failed: 'attachments.error.urlFetchFailed',
};
const warningKeys = {
    docx_tables_simplified: 'attachments.warning.docxTablesSimplified',
    image_downscaled: 'attachments.warning.imageDownscaled',
    pdf_pages_truncated: 'attachments.warning.pdfPagesTruncated',
    pdf_probably_scanned: 'attachments.warning.pdfProbablyScanned',
    text_truncated: 'attachments.warning.textTruncated',
    url_content_thin: 'attachments.warning.urlContentThin',
};
export function translateRejection(input) {
    return translate(input.locale, rejectionKeys[input.code], input.values);
}
export function translateWarnings(warnings, locale) {
    return warnings.map((warning) => translate(locale, warningKeys[warning.code], warning.values));
}
//# sourceMappingURL=messages.js.map