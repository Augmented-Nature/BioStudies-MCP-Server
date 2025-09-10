/**
 * TypeScript interfaces for EBI BioStudies API data structures
 * Based on BioStudies API v1 at https://www.ebi.ac.uk/biostudies/api/v1
 */

/**
 * Basic study information returned in search results
 */
export interface StudySearchResult {
  accno: string;
  title: string;
  authors?: string[];
  releaseDate?: string;
  modifyDate?: string;
  collection?: string;
  type?: string;
  views?: number;
  downloads?: number;
}

/**
 * Detailed study information
 */
export interface StudyDetails {
  accno: string;
  title: string;
  description?: string;
  authors?: Author[];
  contacts?: Contact[];
  releaseDate?: string;
  modifyDate?: string;
  collection?: string;
  type?: string;
  tags?: string[];
  attributes?: Attribute[];
  section?: Section;
  links?: Link[];
  files?: FileInfo[];
  views?: number;
  downloads?: number;
  isPublic?: boolean;
}

/**
 * Author information
 */
export interface Author {
  name: string;
  email?: string;
  affiliation?: string;
  orcid?: string;
}

/**
 * Contact information
 */
export interface Contact {
  name: string;
  email?: string;
  affiliation?: string;
  role?: string;
}

/**
 * Study attributes (key-value pairs)
 */
export interface Attribute {
  name: string;
  value: string;
  reference?: boolean;
  nmqual?: NameValueQualifier[];
}

/**
 * Name-value qualifiers for attributes
 */
export interface NameValueQualifier {
  name: string;
  value: string;
}

/**
 * Study section containing organized data
 */
export interface Section {
  type?: string;
  attributes?: Attribute[];
  links?: Link[];
  files?: FileInfo[];
  subsections?: Section[];
}

/**
 * External links
 */
export interface Link {
  url: string;
  attributes?: Attribute[];
}

/**
 * File information
 */
export interface FileInfo {
  name: string;
  path: string;
  size?: number;
  type?: string;
  attributes?: Attribute[];
  md5?: string;
}

/**
 * Collection information
 */
export interface Collection {
  key: string;
  name: string;
  description?: string;
  logo?: string;
  releaseDate?: string;
  studyCount?: number;
  url?: string;
}

/**
 * Search parameters for BioStudies queries
 */
export interface SearchParams {
  query?: string;
  collection?: string;
  type?: string;
  author?: string;
  keywords?: string[];
  page?: number;
  size?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  releaseDateFrom?: string;
  releaseDateTo?: string;
}

/**
 * Search response wrapper
 */
export interface SearchResponse {
  hits: StudySearchResult[];
  totalHits: number;
  page: number;
  size: number;
  sortBy?: string;
  sortOrder?: string;
  query?: string;
  facets?: Facet[];
}

/**
 * Search facet information
 */
export interface Facet {
  name: string;
  values: FacetValue[];
}

/**
 * Individual facet value
 */
export interface FacetValue {
  value: string;
  count: number;
}

/**
 * Authentication token response
 */
export interface AuthToken {
  token: string;
  expires?: string;
  user?: string;
}

/**
 * Authentication credentials
 */
export interface AuthCredentials {
  login: string;
  password: string;
}

/**
 * File search parameters
 */
export interface FileSearchParams {
  accno?: string;
  path?: string;
  name?: string;
  type?: string;
  minSize?: number;
  maxSize?: number;
}

/**
 * File search response
 */
export interface FileSearchResponse {
  files: FileInfo[];
  totalFiles: number;
  page: number;
  size: number;
}

/**
 * Study validation result
 */
export interface StudyValidation {
  accno: string;
  isValid: boolean;
  exists: boolean;
  isPublic?: boolean;
  collection?: string;
  title?: string;
}

/**
 * API response wrapper
 */
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  status: number;
  message?: string;
}

/**
 * Pagination information
 */
export interface PaginationInfo {
  page: number;
  size: number;
  totalResults: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

/**
 * Error details for API responses
 */
export interface ApiError {
  code: string;
  message: string;
  details?: string;
  timestamp?: string;
}

/**
 * Statistics for a collection or study
 */
export interface Statistics {
  totalStudies?: number;
  totalFiles?: number;
  totalSize?: number;
  lastUpdate?: string;
  collections?: { [key: string]: number };
  types?: { [key: string]: number };
}

/**
 * Bulk operation result
 */
export interface BulkOperationResult {
  successful: string[];
  failed: Array<{
    accno: string;
    error: string;
  }>;
  total: number;
  successCount: number;
  failureCount: number;
}
