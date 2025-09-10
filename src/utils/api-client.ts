/**
 * BioStudies API Client - HTTP client for EBI BioStudies API v1
 * Handles authentication, pagination, and all API interactions
 */

import {
  StudyDetails,
  StudySearchResult,
  SearchParams,
  SearchResponse,
  Collection,
  FileInfo,
  FileSearchParams,
  FileSearchResponse,
  AuthToken,
  AuthCredentials,
  StudyValidation,
  ApiResponse,
  Statistics,
  BulkOperationResult
} from '../types/biostudies.js';

export class BioStudiesApiClient {
  private readonly baseUrl = 'https://www.ebi.ac.uk/biostudies/api/v1';
  private authToken?: string;
  private readonly defaultTimeout = 30000;

  /**
   * Make an HTTP request to the BioStudies API
   */
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const defaultHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'BioStudies-MCP-Server/0.1.0'
    };

    // Add authentication header if token is available
    if (this.authToken) {
      defaultHeaders['Authorization'] = `Bearer ${this.authToken}`;
    }

    const requestOptions: RequestInit = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers
      },
      signal: AbortSignal.timeout(this.defaultTimeout)
    };

    try {
      const response = await fetch(url, requestOptions);
      
      // Handle different response types
      let data: T | undefined;
      const contentType = response.headers.get('Content-Type') || '';
      
      if (contentType.includes('application/json')) {
        const jsonData = await response.json();
        data = jsonData;
      } else if (response.ok) {
        // For non-JSON responses that are successful
        const textData = await response.text();
        data = textData as unknown as T;
      }

      if (!response.ok) {
        const errorMessage = data ? 
          (data as any)?.message || (data as any)?.error || `HTTP ${response.status}` :
          `HTTP ${response.status}: ${response.statusText}`;
        
        return {
          error: errorMessage,
          status: response.status
        };
      }

      return {
        data,
        status: response.status
      };

    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return { error: 'Request timeout', status: 408 };
        }
        return { error: error.message, status: 0 };
      }
      return { error: 'Unknown error occurred', status: 0 };
    }
  }

  /**
   * Authenticate with the BioStudies API
   */
  async authenticate(credentials: AuthCredentials): Promise<ApiResponse<AuthToken>> {
    const result = await this.makeRequest<AuthToken>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    });

    if (result.data?.token) {
      this.authToken = result.data.token;
    }

    return result;
  }

  /**
   * Clear authentication token
   */
  clearAuthentication(): void {
    this.authToken = undefined;
  }

  /**
   * Search for studies with various filters
   */
  async searchStudies(params: SearchParams): Promise<ApiResponse<SearchResponse>> {
    const searchParams = new URLSearchParams();

    if (params.query) searchParams.append('query', params.query);
    if (params.collection) searchParams.append('collection', params.collection);
    if (params.type) searchParams.append('type', params.type);
    if (params.author) searchParams.append('author', params.author);
    if (params.keywords?.length) {
      params.keywords.forEach(keyword => searchParams.append('keywords', keyword));
    }
    if (params.page !== undefined) searchParams.append('page', params.page.toString());
    if (params.size !== undefined) searchParams.append('size', params.size.toString());
    if (params.sortBy) searchParams.append('sortBy', params.sortBy);
    if (params.sortOrder) searchParams.append('sortOrder', params.sortOrder);
    if (params.releaseDateFrom) searchParams.append('releaseDateFrom', params.releaseDateFrom);
    if (params.releaseDateTo) searchParams.append('releaseDateTo', params.releaseDateTo);

    const endpoint = `/studies?${searchParams.toString()}`;
    return this.makeRequest<SearchResponse>(endpoint);
  }

  /**
   * Get detailed information about a specific study
   */
  async getStudyDetails(accno: string): Promise<ApiResponse<StudyDetails>> {
    if (!this.isValidAccessionNumber(accno)) {
      return {
        error: `Invalid accession number format: ${accno}`,
        status: 400
      };
    }

    return this.makeRequest<StudyDetails>(`/studies/${accno}`);
  }

  /**
   * Get all available collections
   */
  async getCollections(): Promise<ApiResponse<Collection[]>> {
    return this.makeRequest<Collection[]>('/collections');
  }

  /**
   * Get studies from a specific collection
   */
  async getCollectionStudies(
    collectionKey: string,
    page: number = 0,
    size: number = 20
  ): Promise<ApiResponse<SearchResponse>> {
    return this.searchStudies({
      collection: collectionKey,
      page,
      size
    });
  }

  /**
   * Search for files within studies
   */
  async searchFiles(params: FileSearchParams): Promise<ApiResponse<FileSearchResponse>> {
    const searchParams = new URLSearchParams();

    if (params.accno) searchParams.append('accno', params.accno);
    if (params.path) searchParams.append('path', params.path);
    if (params.name) searchParams.append('name', params.name);
    if (params.type) searchParams.append('type', params.type);
    if (params.minSize !== undefined) searchParams.append('minSize', params.minSize.toString());
    if (params.maxSize !== undefined) searchParams.append('maxSize', params.maxSize.toString());

    const endpoint = `/files?${searchParams.toString()}`;
    return this.makeRequest<FileSearchResponse>(endpoint);
  }

  /**
   * Get files associated with a specific study
   */
  async getStudyFiles(accno: string): Promise<ApiResponse<FileInfo[]>> {
    if (!this.isValidAccessionNumber(accno)) {
      return {
        error: `Invalid accession number format: ${accno}`,
        status: 400
      };
    }

    return this.makeRequest<FileInfo[]>(`/studies/${accno}/files`);
  }

  /**
   * Get external links for a study
   */
  async getStudyLinks(accno: string): Promise<ApiResponse<any[]>> {
    if (!this.isValidAccessionNumber(accno)) {
      return {
        error: `Invalid accession number format: ${accno}`,
        status: 400
      };
    }

    return this.makeRequest<any[]>(`/studies/${accno}/links`);
  }

  /**
   * Validate a study accession number
   */
  async validateStudyAccession(accno: string): Promise<ApiResponse<StudyValidation>> {
    const validation: StudyValidation = {
      accno,
      isValid: this.isValidAccessionNumber(accno),
      exists: false
    };

    if (!validation.isValid) {
      return {
        data: validation,
        status: 200
      };
    }

    // Try to fetch the study to see if it exists
    const studyResult = await this.getStudyDetails(accno);
    
    validation.exists = !studyResult.error && !!studyResult.data;
    if (studyResult.data) {
      validation.isPublic = studyResult.data.isPublic;
      validation.collection = studyResult.data.collection;
      validation.title = studyResult.data.title;
    }

    return {
      data: validation,
      status: 200
    };
  }

  /**
   * Get statistics for collections or studies
   */
  async getStatistics(): Promise<ApiResponse<Statistics>> {
    return this.makeRequest<Statistics>('/statistics');
  }

  /**
   * Batch retrieve multiple studies
   */
  async batchGetStudies(accessions: string[]): Promise<ApiResponse<BulkOperationResult>> {
    if (accessions.length === 0) {
      return {
        data: {
          successful: [],
          failed: [],
          total: 0,
          successCount: 0,
          failureCount: 0
        },
        status: 200
      };
    }

    if (accessions.length > 50) {
      return {
        error: 'Maximum 50 accessions can be processed at once',
        status: 400
      };
    }

    const results = await Promise.allSettled(
      accessions.map(async (accno) => {
        const result = await this.getStudyDetails(accno);
        if (result.error) {
          throw new Error(result.error);
        }
        return accno;
      })
    );

    const successful: string[] = [];
    const failed: Array<{ accno: string; error: string }> = [];

    results.forEach((result, index) => {
      const accno = accessions[index];
      if (result.status === 'fulfilled') {
        successful.push(accno);
      } else {
        failed.push({
          accno,
          error: result.reason.message || 'Unknown error'
        });
      }
    });

    return {
      data: {
        successful,
        failed,
        total: accessions.length,
        successCount: successful.length,
        failureCount: failed.length
      },
      status: 200
    };
  }

  /**
   * Check if an accession number has valid format
   * BioStudies accession numbers typically follow patterns like:
   * - S-BSST#### (BioStudies)
   * - E-MTAB-#### (ArrayExpress)
   * - EMPIAR-#### (EMPIAR)
   * - S-BIAD#### (BioImages)
   */
  isValidAccessionNumber(accno: string): boolean {
    if (!accno || typeof accno !== 'string') {
      return false;
    }

    const patterns = [
      /^S-BSST\d+$/i,      // BioStudies
      /^E-\w{4}-\d+$/i,    // ArrayExpress
      /^EMPIAR-\d+$/i,     // EMPIAR
      /^S-BIAD\d+$/i,      // BioImages
      /^S-BSMS\d+$/i,      // BioSamples
      /^PRJ[EDN][A-Z]\d+$/i // Project accessions
    ];

    return patterns.some(pattern => pattern.test(accno));
  }

  /**
   * Format accession number to ensure proper case
   */
  formatAccessionNumber(accno: string): string {
    if (!accno) return accno;
    
    // Convert to uppercase for standard format
    return accno.toUpperCase();
  }

  /**
   * Get API status and health
   */
  async getApiStatus(): Promise<ApiResponse<any>> {
    return this.makeRequest<any>('/status');
  }

  /**
   * Set authentication token manually
   */
  setAuthToken(token: string): void {
    this.authToken = token;
  }

  /**
   * Get current authentication status
   */
  isAuthenticated(): boolean {
    return !!this.authToken;
  }
}
