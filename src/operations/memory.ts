import { z } from "zod";
import { MemoryService } from "../memory/MemoryService.js";
import {
  MemoryAddDocumentParams,
  MemoryQueryParams,
  MemoryRemoveDocumentParams,
  MemoryGetDocumentParams,
} from "../schemas.js";

export async function addDocument(
  memoryService: MemoryService,
  params: MemoryAddDocumentParams
): Promise<{ id: string; message: string }> {
  try {
    const id = await memoryService.addDocument(params.content, {
      title: params.title,
      source: params.source,
    });

    return {
      id,
      message: `Document added successfully with ID: ${id}`,
    };
  } catch (error: any) {
    console.error("Error adding document to memory:", error);
    throw new Error(`Failed to add document: ${error.message}`);
  }
}

export async function queryMemory(
  memoryService: MemoryService,
  params: MemoryQueryParams
): Promise<{
  query: string;
  results: Array<{
    document: {
      id: string;
      content: string;
      metadata: {
        title?: string;
        source?: string;
        timestamp: string;
      };
    };
    score: number;
  }>;
  totalResults: number;
}> {
  try {
    const results = await memoryService.queryMemory(params.query, params.limit || 5);

    return {
      query: params.query,
      results: results.map(result => ({
        document: result.document,
        score: result.score,
      })),
      totalResults: results.length,
    };
  } catch (error: any) {
    console.error("Error querying memory:", error);
    throw new Error(`Failed to query memory: ${error.message}`);
  }
}

export async function listDocuments(
  memoryService: MemoryService
): Promise<{
  documents: Array<{
    id: string;
    content: string;
    metadata: {
      title?: string;
      source?: string;
      timestamp: string;
    };
  }>;
  totalDocuments: number;
}> {
  try {
    const documents = await memoryService.listDocuments();

    return {
      documents,
      totalDocuments: documents.length,
    };
  } catch (error: any) {
    console.error("Error listing documents:", error);
    throw new Error(`Failed to list documents: ${error.message}`);
  }
}

export async function getDocument(
  memoryService: MemoryService,
  params: MemoryGetDocumentParams
): Promise<{
  document: {
    id: string;
    content: string;
    metadata: {
      title?: string;
      source?: string;
      timestamp: string;
    };
  } | null;
}> {
  try {
    const document = await memoryService.getDocument(params.id);

    return {
      document,
    };
  } catch (error: any) {
    console.error("Error getting document:", error);
    throw new Error(`Failed to get document: ${error.message}`);
  }
}

export async function removeDocument(
  memoryService: MemoryService,
  params: MemoryRemoveDocumentParams
): Promise<{ success: boolean; message: string }> {
  try {
    const success = await memoryService.removeDocument(params.id);

    return {
      success,
      message: success
        ? `Document ${params.id} removed successfully`
        : `Document ${params.id} not found`,
    };
  } catch (error: any) {
    console.error("Error removing document:", error);
    throw new Error(`Failed to remove document: ${error.message}`);
  }
}

export async function clearMemory(
  memoryService: MemoryService
): Promise<{ success: boolean; message: string }> {
  try {
    await memoryService.clearMemory();

    return {
      success: true,
      message: "Memory cleared successfully",
    };
  } catch (error: any) {
    console.error("Error clearing memory:", error);
    throw new Error(`Failed to clear memory: ${error.message}`);
  }
}

export async function getMemoryInfo(
  memoryService: MemoryService
): Promise<{
  totalDocuments: number;
  storePath: string;
  isInitialized: boolean;
}> {
  try {
    return await memoryService.getStoreInfo();
  } catch (error: any) {
    console.error("Error getting memory info:", error);
    throw new Error(`Failed to get memory info: ${error.message}`);
  }
}