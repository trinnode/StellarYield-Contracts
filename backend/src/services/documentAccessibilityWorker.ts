import { query } from "../db/index.js";
import { logger } from "../logger.js";
import https from "https";
import http from "http";

/**
 * Check if a URL is accessible by sending a HEAD request.
 * Returns true if the URL returns a 2xx status code.
 */
async function checkUrlAccessible(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const urlObj = new URL(url);
      const client = urlObj.protocol === "https:" ? https : http;

      const req = client.request(url, { method: "HEAD", timeout: 10000 }, (res) => {
        const accessible = res.statusCode !== undefined && res.statusCode >= 200 && res.statusCode < 300;
        resolve(accessible);
      });

      req.on("error", () => {
        resolve(false);
      });

      req.on("timeout", () => {
        req.destroy();
        resolve(false);
      });

      req.end();
    } catch {
      resolve(false);
    }
  });
}

/**
 * Process document accessibility check for all vaults with non-null rwa_document_uri.
 * This is scheduled to run daily via pg-boss.
 */
export async function processDocumentAccessibilityCheck(): Promise<void> {
  try {
    // Get all vaults with non-null document URIs
    const vaults = await query<{
      id: number;
      contract_id: string;
      rwa_document_uri: string;
    }>(
      "SELECT id, contract_id, rwa_document_uri FROM vaults WHERE rwa_document_uri IS NOT NULL",
    );

    logger.info({ count: vaults.length }, "Starting document accessibility check");

    for (const vault of vaults) {
      try {
        const accessible = await checkUrlAccessible(vault.rwa_document_uri);

        await query(
          `UPDATE vaults
           SET document_accessible = $1, document_last_checked = NOW()
           WHERE id = $2`,
          [accessible, vault.id],
        );

        if (!accessible) {
          logger.warn(
            { contractId: vault.contract_id, uri: vault.rwa_document_uri },
            "Document URI is not accessible",
          );
        }
      } catch (err) {
        logger.error(
          { err, contractId: vault.contract_id, uri: vault.rwa_document_uri },
          "Failed to check document accessibility for vault",
        );
      }
    }

    logger.info("Document accessibility check completed");
  } catch (err) {
    logger.error({ err }, "Failed to process document accessibility check");
    throw err;
  }
}
