/**
 * BioStudies Tool Handlers - Implementation of MCP tools for BioStudies functionality
 */

import { BioStudiesApiClient } from '../utils/api-client.js';
import { SearchParams, FileSearchParams, AuthCredentials, Attribute } from '../types/biostudies.js';

export class BioStudiesHandlers {
  private apiClient: BioStudiesApiClient;

  constructor() {
    this.apiClient = new BioStudiesApiClient();
  }

  /**
   * Search for studies by keywords, authors, or other criteria
   * Note: EBI BioStudies search API is currently unavailable (404 error)
   * This provides helpful alternatives for study discovery
   */
  async searchStudies(args: any) {
    if (!args.query && !args.collection && !args.author) {
      throw new Error('At least one search parameter (query, collection, or author) is required');
    }

    const searchParams: SearchParams = {
      query: args.query,
      collection: args.collection,
      type: args.type,
      author: args.author,
      keywords: args.keywords && Array.isArray(args.keywords) ? args.keywords : undefined,
      page: args.page && typeof args.page === 'number' ? args.page : 0,
      size: args.size && typeof args.size === 'number' ? Math.min(args.size, 100) : 20,
      sortBy: args.sortBy,
      sortOrder: args.sortOrder,
      releaseDateFrom: args.releaseDateFrom,
      releaseDateTo: args.releaseDateTo
    };

    const result = await this.apiClient.searchStudies(searchParams);

    // If API endpoint is unavailable (404), provide helpful fallback
    if (result.error && result.status === 404) {
      return this.provideSearchAlternatives(searchParams);
    }

    if (result.error) {
      return {
        content: [{
          type: "text",
          text: `Error searching BioStudies: ${result.error}`
        }],
        isError: true
      };
    }

    const response = result.data;
    if (!response || response.hits.length === 0) {
      return {
        content: [{
          type: "text",
          text: `No studies found matching the search criteria`
        }]
      };
    }

    const studies = response.hits;
    const formattedResults = studies.map(study => {
      let output = `• **${study.accno}**: ${study.title}`;
      
      if (study.authors?.length) {
        output += `\n  Authors: ${study.authors.slice(0, 3).join(', ')}${study.authors.length > 3 ? ' et al.' : ''}`;
      }
      
      if (study.collection) {
        output += `\n  Collection: ${study.collection}`;
      }
      
      if (study.type) {
        output += `\n  Type: ${study.type}`;
      }
      
      if (study.releaseDate) {
        output += `\n  Released: ${study.releaseDate}`;
      }

      if (study.views || study.downloads) {
        const stats = [];
        if (study.views) stats.push(`${study.views} views`);
        if (study.downloads) stats.push(`${study.downloads} downloads`);
        output += `\n  Stats: ${stats.join(', ')}`;
      }

      return output;
    }).join('\n\n');

    const pagination = response.page > 0 || studies.length >= (searchParams.size || 20)
      ? `\n\nPage ${response.page + 1}, showing ${studies.length} of ${response.totalHits} total results.`
      : studies.length < response.totalHits
        ? `\n\nShowing first ${studies.length} of ${response.totalHits} total results.`
        : '';

    return {
      content: [{
        type: "text",
        text: `Found ${response.totalHits} studies:\n\n${formattedResults}${pagination}`
      }]
    };
  }

  /**
   * Get detailed information about a specific study
   */
  async getStudyDetails(args: any) {
    if (!args.accno || typeof args.accno !== 'string') {
      throw new Error('Study accession number is required and must be a string');
    }

    const result = await this.apiClient.getStudyDetails(args.accno);

    if (result.error) {
      return {
        content: [{
          type: "text",
          text: `Error retrieving study ${args.accno}: ${result.error}`
        }],
        isError: true
      };
    }

    const study = result.data;
    if (!study) {
      return {
        content: [{
          type: "text",
          text: `Study ${args.accno} not found`
        }]
      };
    }

    // Extract title from attributes if not in main object
    const titleAttr = study.attributes?.find(attr => attr.name === 'Title');
    const title = study.title || titleAttr?.value || 'Title not available';

    let output = `**Study: ${study.accno}**\n`;
    output += `**Title:** ${title}\n\n`;

    // Extract and display all top-level attributes
    if (study.attributes?.length) {
      output += `**Study Attributes:**\n`;
      study.attributes.forEach(attr => {
        if (attr.name !== 'Title') { // Don't repeat title
          output += `  • **${attr.name}:** ${attr.value}\n`;
        }
      });
      output += '\n';
    }

    if (study.type) {
      output += `**Study Type:** ${study.type}\n\n`;
    }

    // Process section data (this contains most of the rich content)
    if (study.section) {
      if (study.section.attributes?.length) {
        output += `**Section Details:**\n`;
        study.section.attributes.forEach(attr => {
          output += `  • **${attr.name}:** ${attr.value}\n`;
        });
        output += '\n';
      }

      // Display section links
      if (study.section.links?.length) {
        output += `**External References:**\n`;
        study.section.links.forEach((link, index) => {
          if (typeof link === 'object' && link.url) {
            output += `  ${index + 1}. ${link.url}\n`;
          } else if (Array.isArray(link)) {
            // Handle nested link arrays
            link.forEach((subLink, subIndex) => {
              if (subLink.url) {
                output += `  ${index + 1}.${subIndex + 1}. ${subLink.url}\n`;
                if (subLink.attributes?.length) {
                  subLink.attributes.forEach((attr: Attribute) => {
                    output += `       ${attr.name}: ${attr.value}\n`;
                  });
                }
              }
            });
          }
        });
        output += '\n';
      }

      // Display section files
      if (study.section.files?.length) {
        output += `**Associated Files:**\n`;
        study.section.files.slice(0, 10).forEach(file => {
          output += `  • ${file.name || file.path}`;
          if (file.size) output += ` (${this.formatFileSize(file.size)})`;
          if (file.type) output += ` [${file.type}]`;
          output += '\n';
        });
        if (study.section.files.length > 10) {
          output += `  ... and ${study.section.files.length - 10} more files\n`;
        }
        output += '\n';
      }

      // Display subsections if present
      if (study.section.subsections?.length) {
        output += `**Subsections:** ${study.section.subsections.length} subsections available\n`;
        study.section.subsections.slice(0, 5).forEach((subsection, index) => {
          if (subsection.type) {
            output += `  ${index + 1}. ${subsection.type}`;
            if (subsection.attributes?.length) {
              output += ` (${subsection.attributes.length} attributes)`;
            }
            output += '\n';
          }
        });
        if (study.section.subsections.length > 5) {
          output += `  ... and ${study.section.subsections.length - 5} more subsections\n`;
        }
        output += '\n';
      }
    }

    // Legacy fields (for backward compatibility)
    if (study.authors?.length) {
      output += `**Authors:**\n`;
      study.authors.forEach(author => {
        output += `  • ${author.name}`;
        if (author.affiliation) output += ` (${author.affiliation})`;
        if (author.orcid) output += ` [ORCID: ${author.orcid}]`;
        output += '\n';
      });
      output += '\n';
    }

    if (study.description) {
      output += `**Description:** ${study.description}\n\n`;
    }

    if (study.views || study.downloads) {
      const stats = [];
      if (study.views) stats.push(`${study.views} views`);
      if (study.downloads) stats.push(`${study.downloads} downloads`);
      output += `**Statistics:** ${stats.join(', ')}\n`;
    }

    return {
      content: [{
        type: "text",
        text: output.trim()
      }]
    };
  }

  /**
   * Get all available collections
   * Note: EBI BioStudies collections API is currently unavailable (404 error)
   * This provides known collection information as fallback
   */
  async listCollections(args: any) {
    const result = await this.apiClient.getCollections();

    // If API endpoint is unavailable (404), provide known collections as fallback
    if (result.error && result.status === 404) {
      return this.provideKnownCollections();
    }

    if (result.error) {
      return {
        content: [{
          type: "text",
          text: `Error retrieving collections: ${result.error}`
        }],
        isError: true
      };
    }

    const collections = result.data || [];

    if (collections.length === 0) {
      return {
        content: [{
          type: "text",
          text: "No collections found"
        }]
      };
    }

    const formattedCollections = collections.map(collection => {
      let output = `• **${collection.key}**: ${collection.name}`;
      
      if (collection.description) {
        output += `\n  Description: ${collection.description}`;
      }
      
      if (collection.studyCount !== undefined) {
        output += `\n  Studies: ${collection.studyCount.toLocaleString()}`;
      }
      
      if (collection.releaseDate) {
        output += `\n  Release Date: ${collection.releaseDate}`;
      }

      if (collection.url) {
        output += `\n  URL: ${collection.url}`;
      }

      return output;
    }).join('\n\n');

    return {
      content: [{
        type: "text",
        text: `Available Collections (${collections.length} total):\n\n${formattedCollections}`
      }]
    };
  }

  /**
   * Get studies from a specific collection
   */
  async getCollectionStudies(args: any) {
    if (!args.collection || typeof args.collection !== 'string') {
      throw new Error('Collection key is required and must be a string');
    }

    const page = args.page && typeof args.page === 'number' ? args.page : 0;
    const size = args.size && typeof args.size === 'number' ? Math.min(args.size, 100) : 20;

    const result = await this.apiClient.getCollectionStudies(args.collection, page, size);

    if (result.error) {
      return {
        content: [{
          type: "text",
          text: `Error retrieving studies from collection ${args.collection}: ${result.error}`
        }],
        isError: true
      };
    }

    const response = result.data;
    if (!response || response.hits.length === 0) {
      return {
        content: [{
          type: "text",
          text: `No studies found in collection: ${args.collection}`
        }]
      };
    }

    const studies = response.hits;
    const formattedResults = studies.map(study => {
      let output = `• **${study.accno}**: ${study.title}`;
      
      if (study.authors?.length) {
        output += `\n  Authors: ${study.authors.slice(0, 2).join(', ')}${study.authors.length > 2 ? ' et al.' : ''}`;
      }
      
      if (study.releaseDate) {
        output += `\n  Released: ${study.releaseDate}`;
      }

      return output;
    }).join('\n\n');

    const pagination = page > 0 || studies.length >= size
      ? `\n\nPage ${page + 1}, showing ${studies.length} of ${response.totalHits} total studies in ${args.collection}.`
      : studies.length < response.totalHits
        ? `\n\nShowing first ${studies.length} of ${response.totalHits} total studies in ${args.collection}.`
        : '';

    return {
      content: [{
        type: "text",
        text: `Studies in collection "${args.collection}" (${response.totalHits} total):\n\n${formattedResults}${pagination}`
      }]
    };
  }

  /**
   * Search for files within studies
   */
  async searchFiles(args: any) {
    if (!args.accno && !args.name && !args.type) {
      throw new Error('At least one search parameter (accno, name, or type) is required');
    }

    const searchParams: FileSearchParams = {
      accno: args.accno,
      path: args.path,
      name: args.name,
      type: args.type,
      minSize: args.minSize && typeof args.minSize === 'number' ? args.minSize : undefined,
      maxSize: args.maxSize && typeof args.maxSize === 'number' ? args.maxSize : undefined
    };

    const result = await this.apiClient.searchFiles(searchParams);

    if (result.error) {
      return {
        content: [{
          type: "text",
          text: `Error searching files: ${result.error}`
        }],
        isError: true
      };
    }

    const response = result.data;
    if (!response || response.files.length === 0) {
      return {
        content: [{
          type: "text",
          text: "No files found matching the search criteria"
        }]
      };
    }

    const files = response.files;
    const formattedResults = files.map(file => {
      let output = `• **${file.name}**`;
      
      if (file.path) {
        output += `\n  Path: ${file.path}`;
      }
      
      if (file.size) {
        output += `\n  Size: ${this.formatFileSize(file.size)}`;
      }
      
      if (file.type) {
        output += `\n  Type: ${file.type}`;
      }
      
      if (file.md5) {
        output += `\n  MD5: ${file.md5}`;
      }

      return output;
    }).join('\n\n');

    return {
      content: [{
        type: "text",
        text: `Found ${response.totalFiles} files:\n\n${formattedResults}`
      }]
    };
  }

  /**
   * Get files associated with a specific study
   * Note: If dedicated files API is unavailable, this extracts file info from study metadata
   */
  async getStudyFiles(args: any) {
    if (!args.accno || typeof args.accno !== 'string') {
      throw new Error('Study accession number is required and must be a string');
    }

    const result = await this.apiClient.getStudyFiles(args.accno);

    // If API endpoint is unavailable (404), try extracting files from study metadata
    if (result.error && result.status === 404) {
      return this.extractFilesFromStudyMetadata(args.accno);
    }

    if (result.error) {
      return {
        content: [{
          type: "text",
          text: `Error retrieving files for study ${args.accno}: ${result.error}`
        }],
        isError: true
      };
    }

    const files = result.data || [];

    if (files.length === 0) {
      return {
        content: [{
          type: "text",
          text: `No files found for study ${args.accno}`
        }]
      };
    }

    const formattedFiles = files.map(file => {
      let output = `• **${file.name}**`;
      
      if (file.path && file.path !== file.name) {
        output += `\n  Path: ${file.path}`;
      }
      
      if (file.size) {
        output += `\n  Size: ${this.formatFileSize(file.size)}`;
      }
      
      if (file.type) {
        output += `\n  Type: ${file.type}`;
      }

      return output;
    }).join('\n\n');

    const totalSize = files.reduce((sum, file) => sum + (file.size || 0), 0);
    const sizeInfo = totalSize > 0 ? `\nTotal size: ${this.formatFileSize(totalSize)}` : '';

    return {
      content: [{
        type: "text",
        text: `Files in study ${args.accno} (${files.length} files):${sizeInfo}\n\n${formattedFiles}`
      }]
    };
  }

  /**
   * Get external links for a study
   */
  async getStudyLinks(args: any) {
    if (!args.accno || typeof args.accno !== 'string') {
      throw new Error('Study accession number is required and must be a string');
    }

    const result = await this.apiClient.getStudyLinks(args.accno);

    if (result.error) {
      return {
        content: [{
          type: "text",
          text: `Error retrieving links for study ${args.accno}: ${result.error}`
        }],
        isError: true
      };
    }

    const links = result.data || [];

    if (links.length === 0) {
      return {
        content: [{
          type: "text",
          text: `No external links found for study ${args.accno}`
        }]
      };
    }

    const formattedLinks = links.map((link, index) => {
      let output = `${index + 1}. ${link.url}`;
      
      if (link.attributes?.length) {
        const attrs = link.attributes.map((attr: Attribute) => `${attr.name}: ${attr.value}`).join(', ');
        output += `\n   ${attrs}`;
      }

      return output;
    }).join('\n\n');

    return {
      content: [{
        type: "text",
        text: `External links for study ${args.accno} (${links.length} links):\n\n${formattedLinks}`
      }]
    };
  }

  /**
   * Validate a study accession number
   */
  async validateStudyAccession(args: any) {
    if (!args.accno || typeof args.accno !== 'string') {
      throw new Error('Accession number is required and must be a string');
    }

    const result = await this.apiClient.validateStudyAccession(args.accno);

    if (result.error) {
      return {
        content: [{
          type: "text",
          text: `Error validating accession ${args.accno}: ${result.error}`
        }],
        isError: true
      };
    }

    const validation = result.data!;

    if (!validation.isValid) {
      return {
        content: [{
          type: "text",
          text: `❌ Invalid accession number format: "${args.accno}"\n\nValid formats include:\n• S-BSST#### (BioStudies)\n• E-MTAB-#### (ArrayExpress)\n• EMPIAR-#### (EMPIAR)\n• S-BIAD#### (BioImages)`
        }]
      };
    }

    if (!validation.exists) {
      return {
        content: [{
          type: "text",
          text: `⚠️ Valid format but study not found: "${args.accno}"\n\nThe accession number format is correct but no study exists with this identifier.`
        }]
      };
    }

    let output = `✅ Valid study accession: "${args.accno}"\n`;
    if (validation.title) {
      output += `Title: ${validation.title}\n`;
    }
    if (validation.collection) {
      output += `Collection: ${validation.collection}\n`;
    }
    if (validation.isPublic !== undefined) {
      output += `Access: ${validation.isPublic ? 'Public' : 'Restricted'}`;
    }

    return {
      content: [{
        type: "text",
        text: output
      }]
    };
  }

  /**
   * Batch retrieve multiple studies
   */
  async batchGetStudies(args: any) {
    if (!args.accessions || !Array.isArray(args.accessions)) {
      throw new Error('Accessions parameter is required and must be an array of strings');
    }

    if (args.accessions.length === 0) {
      return {
        content: [{
          type: "text",
          text: "No accession numbers provided"
        }]
      };
    }

    if (args.accessions.length > 50) {
      return {
        content: [{
          type: "text",
          text: "Maximum 50 studies can be processed at once"
        }]
      };
    }

    const result = await this.apiClient.batchGetStudies(args.accessions);

    if (result.error) {
      return {
        content: [{
          type: "text",
          text: `Error in batch operation: ${result.error}`
        }],
        isError: true
      };
    }

    const batchResult = result.data!;

    let output = `**Batch Processing Results:**\n\n`;
    output += `**Summary:** ${batchResult.successCount}/${batchResult.total} studies retrieved successfully\n\n`;

    if (batchResult.successful.length > 0) {
      output += `**Successfully Retrieved (${batchResult.successful.length}):**\n`;
      batchResult.successful.forEach(accno => {
        output += `  ✅ ${accno}\n`;
      });
      output += '\n';
    }

    if (batchResult.failed.length > 0) {
      output += `**Failed (${batchResult.failed.length}):**\n`;
      batchResult.failed.forEach(failure => {
        output += `  ❌ ${failure.accno}: ${failure.error}\n`;
      });
    }

    return {
      content: [{
        type: "text",
        text: output
      }]
    };
  }

  /**
   * Authenticate with the BioStudies API
   */
  async authenticate(args: any) {
    if (!args.login || !args.password) {
      throw new Error('Both login and password are required for authentication');
    }

    const credentials: AuthCredentials = {
      login: args.login,
      password: args.password
    };

    const result = await this.apiClient.authenticate(credentials);

    if (result.error) {
      return {
        content: [{
          type: "text",
          text: `Authentication failed: ${result.error}`
        }],
        isError: true
      };
    }

    const token = result.data!;

    let output = `✅ Authentication successful\n`;
    if (token.user) {
      output += `User: ${token.user}\n`;
    }
    if (token.expires) {
      output += `Token expires: ${token.expires}\n`;
    }
    output += `\nYou can now access protected studies and submit data.`;

    return {
      content: [{
        type: "text",
        text: output
      }]
    };
  }

  /**
   * Provide search alternatives when the API search endpoint is unavailable
   */
  private provideSearchAlternatives(searchParams: SearchParams) {
    let output = `🔍 **BioStudies Search Currently Unavailable**\n\n`;
    output += `The EBI BioStudies search API endpoint is currently not available (HTTP 404). Here are alternative approaches to find studies:\n\n`;

    // Collection-based suggestions
    if (searchParams.collection) {
      output += `**Collection-Based Discovery for "${searchParams.collection}":**\n`;
      const suggestions = this.getCollectionSuggestions(searchParams.collection.toLowerCase());
      if (suggestions.length > 0) {
        suggestions.forEach(suggestion => {
          output += `  • Try accession: ${suggestion}\n`;
        });
      } else {
        output += `  • Use individual study lookup with known ${searchParams.collection} accession patterns\n`;
      }
      output += '\n';
    }

    // Query-based suggestions
    if (searchParams.query) {
      output += `**Alternative Search Strategies for "${searchParams.query}":**\n`;
      output += `  • Use the EBI BioStudies website directly: https://www.ebi.ac.uk/biostudies/\n`;
      output += `  • Try related databases like ArrayExpress: https://www.ebi.ac.uk/arrayexpress/\n`;
      output += `  • Search by publication title or author name on the BioStudies website\n\n`;
    }

    // Common accession patterns
    output += `**Try Common Accession Patterns:**\n`;
    output += `  • **ArrayExpress**: E-MTAB-1234, E-GEOD-1234, E-MEXP-1234\n`;
    output += `  • **BioImages**: S-BIAD1234\n`;
    output += `  • **EMPIAR**: EMPIAR-10001\n`;
    output += `  • **BioStudies**: S-BSST1234\n\n`;

    // Working functionality
    output += `**Available Functionality:**\n`;
    output += `  ✅ Individual study retrieval: Use \`get_study_details\` with known accession numbers\n`;
    output += `  ✅ Accession validation: Use \`validate_study_accession\` to check format\n`;
    output += `  ✅ Batch study retrieval: Use \`batch_get_studies\` for multiple studies\n\n`;

    output += `**Example Usage:**\n`;
    output += `Try: get_study_details with accession "E-MTAB-1234" or similar known accession numbers`;

    return {
      content: [{
        type: "text",
        text: output
      }]
    };
  }

  /**
   * Provide known BioStudies collections when the API endpoint is unavailable
   */
  private provideKnownCollections() {
    const knownCollections = [
      {
        key: 'arrayexpress',
        name: 'ArrayExpress',
        description: 'Functional genomics experiments including gene expression data',
        accessionPattern: 'E-MTAB-####, E-GEOD-####, E-MEXP-####',
        website: 'https://www.ebi.ac.uk/arrayexpress/',
        examples: ['E-MTAB-7249', 'E-MTAB-6819', 'E-MTAB-5061']
      },
      {
        key: 'bioimages',
        name: 'BioImages',
        description: 'Biological imaging data from light and electron microscopy',
        accessionPattern: 'S-BIAD####',
        website: 'https://www.ebi.ac.uk/biostudies/bioimages/',
        examples: ['S-BIAD423', 'S-BIAD424', 'S-BIAD425']
      },
      {
        key: 'empiar',
        name: 'EMPIAR',
        description: 'Electron Microscopy Public Image Archive',
        accessionPattern: 'EMPIAR-#####',
        website: 'https://www.ebi.ac.uk/empiar/',
        examples: ['EMPIAR-10001', 'EMPIAR-10002', 'EMPIAR-10003']
      },
      {
        key: 'biostudies',
        name: 'BioStudies General',
        description: 'General biological studies and multi-omics data',
        accessionPattern: 'S-BSST####',
        website: 'https://www.ebi.ac.uk/biostudies/',
        examples: ['S-BSST1', 'S-BSST2', 'S-BSST3']
      }
    ];

    let output = `📚 **Known BioStudies Collections**\n\n`;
    output += `⚠️ **Note**: The collections API endpoint is currently unavailable (HTTP 404). Below are the known major collections:\n\n`;

    const formattedCollections = knownCollections.map(collection => {
      let collectionOutput = `• **${collection.key}**: ${collection.name}`;
      collectionOutput += `\n  Description: ${collection.description}`;
      collectionOutput += `\n  Accession Pattern: ${collection.accessionPattern}`;
      collectionOutput += `\n  Website: ${collection.website}`;
      collectionOutput += `\n  Example Accessions: ${collection.examples.join(', ')}`;
      return collectionOutput;
    }).join('\n\n');

    output += formattedCollections;

    output += `\n\n**How to Use:**\n`;
    output += `• Use \`get_study_details\` with any of the example accession numbers above\n`;
    output += `• Try \`validate_study_accession\` to check if a specific accession exists\n`;
    output += `• Use \`batch_get_studies\` to retrieve multiple studies at once\n\n`;

    output += `**Collection-Specific Guidance:**\n`;
    output += `• **ArrayExpress**: Focus on gene expression and functional genomics\n`;
    output += `• **BioImages**: Look for microscopy and imaging studies\n`;
    output += `• **EMPIAR**: Specialized for electron microscopy data\n`;
    output += `• **BioStudies General**: Multi-omics and general biological studies`;

    return {
      content: [{
        type: "text",
        text: output
      }]
    };
  }

  /**
   * Extract file information from study metadata when dedicated files API is unavailable
   */
  private async extractFilesFromStudyMetadata(accno: string) {
    try {
      // Use the working study details API to get metadata
      const studyResult = await this.apiClient.getStudyDetails(accno);

      if (studyResult.error) {
        return {
          content: [{
            type: "text",
            text: `📁 **Files API Unavailable for ${accno}**\n\n⚠️ The dedicated files API endpoint is currently not available (HTTP 404), and we couldn't retrieve study metadata to extract file information.\n\nError: ${studyResult.error}\n\n**Alternative Approaches:**\n• Visit the study page directly: https://www.ebi.ac.uk/biostudies/studies/${accno}\n• Use \`get_study_details\` to see if file information is embedded in study metadata`
          }]
        };
      }

      const study = studyResult.data;
      if (!study) {
        return {
          content: [{
            type: "text",
            text: `Study ${accno} not found`
          }]
        };
      }

      // Extract files from study section data
      const extractedFiles = [];

      if (study.section?.files?.length) {
        extractedFiles.push(...study.section.files);
      }

      // Also check subsections for files
      if (study.section?.subsections?.length) {
        study.section.subsections.forEach(subsection => {
          if (subsection.files?.length) {
            extractedFiles.push(...subsection.files);
          }
        });
      }

      if (extractedFiles.length === 0) {
        return {
          content: [{
            type: "text",
            text: `📁 **Files for ${accno} (via metadata extraction)**\n\n⚠️ **Note**: The dedicated files API endpoint is currently unavailable (HTTP 404). Extracted file information from study metadata.\n\nNo files found in the study metadata. This could mean:\n• The study has no associated files\n• File information is not embedded in the metadata\n• Files are referenced externally\n\n**Alternative Approaches:**\n• Check study details with \`get_study_details\` for external references\n• Visit the study page directly: https://www.ebi.ac.uk/biostudies/studies/${accno}`
          }]
        };
      }

      const formattedFiles = extractedFiles.map(file => {
        let output = `• **${file.name || file.path || 'Unknown filename'}**`;
        
        if (file.path && file.path !== file.name) {
          output += `\n  Path: ${file.path}`;
        }
        
        if (file.size) {
          output += `\n  Size: ${this.formatFileSize(file.size)}`;
        }
        
        if (file.type) {
          output += `\n  Type: ${file.type}`;
        }

        if (file.md5) {
          output += `\n  MD5: ${file.md5}`;
        }

        return output;
      }).join('\n\n');

      const totalSize = extractedFiles.reduce((sum, file) => sum + (file.size || 0), 0);
      const sizeInfo = totalSize > 0 ? `\nTotal size: ${this.formatFileSize(totalSize)}` : '';

      return {
        content: [{
          type: "text",
          text: `📁 **Files for ${accno} (via metadata extraction)**\n\n⚠️ **Note**: The dedicated files API endpoint is currently unavailable (HTTP 404). Extracted ${extractedFiles.length} files from study metadata.${sizeInfo}\n\n${formattedFiles}\n\n**Data Source:** Extracted from study section metadata via \`get_study_details\``
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `📁 **Files API Unavailable for ${accno}**\n\n⚠️ The dedicated files API endpoint is currently not available (HTTP 404), and an error occurred while trying to extract file information from study metadata.\n\nError: ${error instanceof Error ? error.message : 'Unknown error'}\n\n**Alternative Approaches:**\n• Visit the study page directly: https://www.ebi.ac.uk/biostudies/studies/${accno}\n• Use \`get_study_details\` to view study metadata directly`
        }]
      };
    }
  }

  /**
   * Get sample accession suggestions for known collections
   */
  private getCollectionSuggestions(collection: string): string[] {
    const suggestions: Record<string, string[]> = {
      'arrayexpress': [
        'E-MTAB-7249', 'E-MTAB-6819', 'E-MTAB-5061', 'E-MTAB-4748', 'E-MTAB-4421'
      ],
      'bioimages': [
        'S-BIAD423', 'S-BIAD424', 'S-BIAD425', 'S-BIAD426', 'S-BIAD427'
      ],
      'empiar': [
        'EMPIAR-10001', 'EMPIAR-10002', 'EMPIAR-10003', 'EMPIAR-10004', 'EMPIAR-10005'
      ],
      'biostudies': [
        'S-BSST1', 'S-BSST2', 'S-BSST3', 'S-BSST4', 'S-BSST5'
      ]
    };

    return suggestions[collection] || [];
  }

  /**
   * Helper function to format file sizes
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
