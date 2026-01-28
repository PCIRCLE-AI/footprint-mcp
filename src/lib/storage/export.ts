import JSZip from 'jszip';
import { createHash } from 'node:crypto';
import type { EvidenceDatabase } from './database.js';

export interface ExportOptions {
  ids?: string[]; // Specific IDs to export (or all)
  includeGitInfo?: boolean; // Include git-info.json
  password?: string; // Optional password protection (not implemented yet)
}

export interface ExportResult {
  filename: string; // Generated filename
  zipData: Uint8Array; // ZIP file data
  checksum: string; // SHA-256 of zip file
  footprintCount: number; // Number of footprints exported
}

interface ManifestData {
  version: string;
  exportDate: string;
  footprintCount: number;
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
    const { ids, includeGitInfo = false } = options;

    // Get footprints to export - validate IDs if specified
    let footprints;
    if (ids) {
      // Validate all IDs exist first
      const notFound = ids.filter(id => !db.findById(id));
      if (notFound.length > 0) {
        throw new Error(`Footprint IDs not found: ${notFound.join(', ')}`);
      }
      // Map with proper error handling (should never throw after validation above)
      footprints = ids.map(id => {
        const footprint = db.findById(id);
        if (!footprint) {
          throw new Error(`Footprint ${id} not found`);
        }
        return footprint;
      });
    } else {
      footprints = db.list();
    }

    // Validate export size to prevent OOM crashes
    const estimatedSizeMB = footprints.reduce(
      (sum, e) => sum + e.encryptedContent.length,
      0
    ) / (1024 * 1024);

    if (estimatedSizeMB > MAX_EXPORT_SIZE_MB) {
      throw new Error(
        `Export size (${estimatedSizeMB.toFixed(1)}MB) exceeds limit (${MAX_EXPORT_SIZE_MB}MB). ` +
        `Please export in smaller batches using the ids parameter.`
      );
    }

    // Create ZIP archive
    const zip = new JSZip();

    // Add manifest.json
    const manifest: ManifestData = {
      version: EXPORT_FORMAT_VERSION,
      exportDate: new Date().toISOString(),
      footprintCount: footprints.length,
      includeGitInfo,
    };
    zip.file('manifest.json', JSON.stringify(manifest, null, 2));

    // Add each footprint
    const checksumEntries: string[] = [];

    for (const fp of footprints) {
      const fpFolder = `footprints/${fp.id}`;

      // Add encrypted-data
      zip.file(`${fpFolder}/encrypted-data`, fp.encryptedContent);

      // Calculate checksum for encrypted data
      const dataChecksum = createHash('sha256')
        .update(fp.encryptedContent)
        .digest('hex');
      checksumEntries.push(`${dataChecksum}  ${fpFolder}/encrypted-data`);

      // Add metadata.json
      const metadata = {
        id: fp.id,
        timestamp: fp.timestamp,
        conversationId: fp.conversationId,
        llmProvider: fp.llmProvider,
        contentHash: fp.contentHash,
        messageCount: fp.messageCount,
        tags: fp.tags,
        nonce: Array.from(fp.nonce), // Convert Uint8Array to array for JSON
      };
      const metadataJson = JSON.stringify(metadata, null, 2);
      zip.file(`${fpFolder}/metadata.json`, metadataJson);

      const metadataChecksum = createHash('sha256')
        .update(metadataJson)
        .digest('hex');
      checksumEntries.push(
        `${metadataChecksum}  ${fpFolder}/metadata.json`
      );

      // Add git-info.json if requested and available
      if (includeGitInfo && fp.gitCommitHash && fp.gitTimestamp) {
        const gitInfo = {
          gitCommitHash: fp.gitCommitHash,
          gitTimestamp: fp.gitTimestamp,
        };
        const gitInfoJson = JSON.stringify(gitInfo, null, 2);
        zip.file(`${fpFolder}/git-info.json`, gitInfoJson);

        const gitChecksum = createHash('sha256').update(gitInfoJson).digest('hex');
        checksumEntries.push(`${gitChecksum}  ${fpFolder}/git-info.json`);
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
    const filename = `footprint-export-${timestamp}.zip`;

    return {
      filename,
      zipData,
      checksum: zipChecksum,
      footprintCount: footprints.length,
    };
  } catch (error) {
    throw new Error(
      `Failed to export footprints: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
