import { LocalIndex } from "vectra";
import { pipeline } from "@xenova/transformers";
import { Config } from "../config.js";
import * as fs from "fs/promises";
import * as path from "path";

export interface Document {
  id: string;
  content: string;
  metadata: {
    title?: string;
    source?: string;
    timestamp: string;
  };
}

export interface SearchResult {
  document: Document;
  score: number;
}

export class MemoryService {
  private vectorStore: LocalIndex | null = null;
  private embedder: any = null;
  private config: Config;
  private documents: Map<string, Document> = new Map();
  private initialized = false;

  constructor(config: Config) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    try {
      // Initialize the vector store
      this.vectorStore = new LocalIndex(this.config.memoryStorePath!);

      // Initialize the embedding model
      this.embedder = await pipeline("feature-extraction", "sentence-transformers/all-MiniLM-L6-v2", {
        revision: "main",
      });

      // Load existing documents if the store exists
      await this.loadExistingDocuments();
      
      this.initialized = true;
      console.error("Memory service initialized successfully");
    } catch (error: any) {
      console.error("Failed to initialize memory service:", error.message);
      throw new Error(`Memory service initialization failed: ${error.message}`);
    }
  }

  private async loadExistingDocuments(): Promise<void> {
    if (!this.vectorStore) return;

    try {
      const documentsPath = path.join(this.config.memoryStorePath!, "documents.json");
      
      // Check if documents file exists
      try {
        const documentsData = await fs.readFile(documentsPath, "utf-8");
        const documents: Document[] = JSON.parse(documentsData);
        
        for (const doc of documents) {
          this.documents.set(doc.id, doc);
        }
        
        console.error(`Loaded ${documents.length} existing documents from memory store`);
      } catch (error: any) {
        if (error.code !== "ENOENT") {
          console.error("Error loading existing documents:", error.message);
        }
        // File doesn't exist yet, that's fine
      }
    } catch (error: any) {
      console.error("Error loading existing documents:", error.message);
    }
  }

  private async saveDocuments(): Promise<void> {
    try {
      const documentsPath = path.join(this.config.memoryStorePath!, "documents.json");
      
      // Ensure directory exists
      await fs.mkdir(this.config.memoryStorePath!, { recursive: true });
      
      const documents = Array.from(this.documents.values());
      await fs.writeFile(documentsPath, JSON.stringify(documents, null, 2));
    } catch (error: any) {
      console.error("Error saving documents:", error.message);
    }
  }

  private async createEmbedding(text: string): Promise<number[]> {
    if (!this.embedder) {
      throw new Error("Embedder not initialized");
    }

    try {
      const output = await this.embedder(text);
      
      // Extract the embedding from the transformer output
      let embedding: number[];
      
      if (Array.isArray(output)) {
        // Handle array format
        embedding = output as number[];
      } else if (output.data) {
        // Handle tensor format
        embedding = Array.from(output.data as Float32Array);
      } else if (output.tolist) {
        // Handle tensor with tolist method
        embedding = output.tolist()[0]; 
      } else {
        throw new Error("Unexpected embedding output format");
      }
      
      // Normalize the embedding
      const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
      return embedding.map(val => val / magnitude);
    } catch (error: any) {
      console.error("Error creating embedding:", error.message);
      throw new Error(`Failed to create embedding: ${error.message}`);
    }
  }

  async addDocument(content: string, metadata: { title?: string; source?: string } = {}): Promise<string> {
    if (!this.initialized || !this.vectorStore) {
      throw new Error("Memory service not initialized");
    }

    try {
      const id = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const document: Document = {
        id,
        content: content.trim(),
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString(),
        },
      };

      // Create embedding for the content
      const embedding = await this.createEmbedding(content);
      
      // Add to vector store
      await this.vectorStore.insertItem({
        vector: embedding,
        metadata: {
          id,
          content,
          title: metadata.title || "",
          source: metadata.source || "",
          timestamp: document.metadata.timestamp,
        },
      });

      // Store document in memory and persist
      this.documents.set(id, document);
      await this.saveDocuments();

      console.error(`Added document ${id} to memory store`);
      return id;
    } catch (error: any) {
      console.error("Error adding document:", error.message);
      throw new Error(`Failed to add document: ${error.message}`);
    }
  }

  async queryMemory(query: string, limit: number = 5): Promise<SearchResult[]> {
    if (!this.initialized || !this.vectorStore) {
      throw new Error("Memory service not initialized");
    }

    try {
      // Create embedding for the query
      const queryEmbedding = await this.createEmbedding(query);
      
      // Search for similar documents
      const results = await this.vectorStore.queryItems(queryEmbedding, "cosine", limit);
      
      const searchResults: SearchResult[] = [];
      
      for (const result of results) {
        const documentId = String(result.item.metadata.id);
        const document = this.documents.get(documentId);
        if (document) {
          searchResults.push({
            document,
            score: result.score,
          });
        }
      }

      return searchResults;
    } catch (error: any) {
      console.error("Error querying memory:", error.message);
      throw new Error(`Failed to query memory: ${error.message}`);
    }
  }

  async listDocuments(): Promise<Document[]> {
    return Array.from(this.documents.values()).sort(
      (a, b) => new Date(b.metadata.timestamp).getTime() - new Date(a.metadata.timestamp).getTime()
    );
  }

  async getDocument(id: string): Promise<Document | null> {
    return this.documents.get(id) || null;
  }

  async removeDocument(id: string): Promise<boolean> {
    if (!this.initialized || !this.vectorStore) {
      throw new Error("Memory service not initialized");
    }

    try {
      const document = this.documents.get(id);
      if (!document) {
        return false;
      }

      // Remove from vector store - find the item first
      const items = await this.vectorStore.listItems();
      const itemToDelete = items.find(item => String(item.metadata.id) === id);
      if (itemToDelete) {
        await this.vectorStore.deleteItem(itemToDelete.id);
      }
      
      // Remove from documents map
      this.documents.delete(id);
      
      // Save updated documents
      await this.saveDocuments();

      console.error(`Removed document ${id} from memory store`);
      return true;
    } catch (error: any) {
      console.error("Error removing document:", error.message);
      throw new Error(`Failed to remove document: ${error.message}`);
    }
  }

  async clearMemory(): Promise<void> {
    if (!this.initialized || !this.vectorStore) {
      throw new Error("Memory service not initialized");
    }

    try {
      // Clear all documents from vector store
      const items = await this.vectorStore.listItems();
      for (const item of items) {
        await this.vectorStore.deleteItem(item.id);
      }

      // Clear documents map
      this.documents.clear();
      
      // Save empty documents file
      await this.saveDocuments();

      console.error("Memory store cleared successfully");
    } catch (error: any) {
      console.error("Error clearing memory:", error.message);
      throw new Error(`Failed to clear memory: ${error.message}`);
    }
  }

  async getStoreInfo(): Promise<{
    totalDocuments: number;
    storePath: string;
    isInitialized: boolean;
  }> {
    return {
      totalDocuments: this.documents.size,
      storePath: this.config.memoryStorePath!,
      isInitialized: this.initialized,
    };
  }
}