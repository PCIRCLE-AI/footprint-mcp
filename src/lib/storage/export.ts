import JSZip from 'jszip';
import { createHash } from 'node:crypto';
import type { EvidenceDatabase } from './database.js';

export interface ExportOptions {
  evidenceIds?: string[]; // Specific IDs to export (or all)
  includeGitInfo?: boolean; // Include git-info.json
  password?: string; // Optional password protection (not implemented yet)
}

export interface ExportResult {
  filename: string; // Generated filename
  zipData: Uint8Array; // ZIP file data
  checksum: string; // SHA-256 of zip file
  evidenceCount: number; // Number of evidences exported
}

interface ManifestData {
  version: string;
  exportDate: string;
  evidenceCount: number;
  includeGitInfo: boolean;
}

// Export format version constant
const EXPORT_FORMAT_VERSION = '1.0.0';

// Maximum export size in MB (configurable limit to prevent OOM)
const MAX_EXPORT_SIZE_MB = 100;

/**
 * Export evidences to a ZIP archive with encrypted data and metadata.
 *
 * ⚠️ **Memory Warning**: Entire ZIP is generated in-memory. For large exports
 * (>1000 evidences or >100MB encrypted data), consider exporting in batches
 * to avoid memory exhaustion.
 *
 * @param db - EvidenceDatabase instance
 * @param options - Export options
 * @returns Export result with ZIP data and metadata
 * @throws Error if database operations fail, IDs not found, or ZIP generation fails
 */
export async function exportEvidences(
  db: EvidenceDatabase,
  options: ExportOptions = {}
): Promise<ExportResult> {
  try {
    const { evidenceIds, includeGitInfo = false } = options;

    // Get evidences to export - validate IDs if specified
    let evidences;
    if (evidenceIds) {
      // Validate all IDs exist first
      const notFound = evidenceIds.filter(id => !db.findById(id));
      if (notFound.length > 0) {
        throw new Error(`Evidence IDs not found: ${notFound.join(', ')}`);
      }
      // Map with proper error handling (should never throw after validation above)
      evidences = evidenceIds.map(id => {
        const evidence = db.findById(id);
        if (!evidence) {
          throw new Error(`Evidence ${id} not found`);
        }
        return evidence;
      });
    } else {
      evidences = db.list();
    }

    // Validate export size to prevent OOM crashes
    const estimatedSizeMB = evidences.reduce(
      (sum, e) => sum + e.encryptedContent.length,
      0
    ) / (1024 * 1024);

    if (estimatedSizeMB > MAX_EXPORT_SIZE_MB) {
      throw new Error(
        `Export size (${estimatedSizeMB.toFixed(1)}MB) exceeds limit (${MAX_EXPORT_SIZE_MB}MB). ` +
        `Please export in smaller batches using the evidenceIds parameter.`
      );
    }

    // Create ZIP archive
    const zip = new JSZip();

    // Add manifest.json
    const manifest: ManifestData = {
      version: EXPORT_FORMAT_VERSION,
      exportDate: new Date().toISOString(),
      evidenceCount: evidences.length,
      includeGitInfo,
    };
    zip.file('manifest.json', JSON.stringify(manifest, null, 2));

    // Add each evidence
    const checksumEntries: string[] = [];

    for (const evidence of evidences) {
      const evidenceFolder = `evidences/${evidence.id}`;

      // Add encrypted-data
      zip.file(`${evidenceFolder}/encrypted-data`, evidence.encryptedContent);

      // Calculate checksum for encrypted data
      const dataChecksum = createHash('sha256')
        .update(evidence.encryptedContent)
        .digest('hex');
      checksumEntries.push(`${dataChecksum}  ${evidenceFolder}/encrypted-data`);

      // Add metadata.json
      const metadata = {
        id: evidence.id,
        timestamp: evidence.timestamp,
        conversationId: evidence.conversationId,
        llmProvider: evidence.llmProvider,
        contentHash: evidence.contentHash,
        messageCount: evidence.messageCount,
        tags: evidence.tags,
        nonce: Array.from(evidence.nonce), // Convert Uint8Array to array for JSON
      };
      const metadataJson = JSON.stringify(metadata, null, 2);
      zip.file(`${evidenceFolder}/metadata.json`, metadataJson);

      const metadataChecksum = createHash('sha256')
        .update(metadataJson)
        .digest('hex');
      checksumEntries.push(
        `${metadataChecksum}  ${evidenceFolder}/metadata.json`
      );

      // Add git-info.json if requested and available
      if (includeGitInfo && evidence.gitCommitHash && evidence.gitTimestamp) {
        const gitInfo = {
          gitCommitHash: evidence.gitCommitHash,
          gitTimestamp: evidence.gitTimestamp,
        };
        const gitInfoJson = JSON.stringify(gitInfo, null, 2);
        zip.file(`${evidenceFolder}/git-info.json`, gitInfoJson);

        const gitChecksum = createHash('sha256').update(gitInfoJson).digest('hex');
        checksumEntries.push(`${gitChecksum}  ${evidenceFolder}/git-info.json`);
      }
    }

    // Add checksum.txt
    const checksumContent = [
      'SHA-256 Checksums',
      '=================',
      '',
      ...checksumEntries,
    ].join('\n');
    zip.file('checksum.txt', checksumContent);

    // Generate ZIP data
    const zipData = await zip.generateAsync({
      type: 'uint8array',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 },
    });

    // Calculate ZIP checksum
    const zipChecksum = createHash('sha256').update(zipData).digest('hex');

    // Generate filename
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const filename = `evidence-export-${timestamp}.zip`;

    return {
      filename,
      zipData,
      checksum: zipChecksum,
      evidenceCount: evidences.length,
    };
  } catch (error) {
    throw new Error(
      `Failed to export evidences: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
