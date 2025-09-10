#!/usr/bin/env node

/**
 * BioStudies MCP Server - A Model Context Protocol server for the EBI BioStudies API
 * 
 * This server provides reliable tools to interact with the BioStudies API including:
 * - Getting comprehensive information about specific studies with rich metadata extraction
 * - Validating study accession numbers and checking study existence
 * - Batch processing multiple studies efficiently
 * 
 * BioStudies contains millions of studies and associated data files from
 * various biological research domains and is widely used in life sciences research.
 * 
 * This streamlined version focuses on the core functionality that works reliably
 * with the current EBI BioStudies API endpoints.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";

import { BioStudiesHandlers } from "./handlers/biostudies-handlers.js";

/**
 * Create an MCP server with BioStudies functionality
 */
const server = new Server(
  {
    name: "biostudies-server",
    version: "0.1.0",
  }
);

// Initialize BioStudies handlers
const bioStudiesHandlers = new BioStudiesHandlers();

/**
 * Handler that lists all available BioStudies tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_study_details",
        description: "Get comprehensive information about a specific biological study by its accession number. This tool provides rich metadata including study attributes, section details, external references, associated files, and subsections.",
        inputSchema: {
          type: "object",
          properties: {
            accno: {
              type: "string",
              description: "Study accession number (e.g., S-BSST1234, E-MTAB-1234, EMPIAR-1234)"
            }
          },
          required: ["accno"]
        }
      },
      {
        name: "validate_study_accession",
        description: "Validate a study accession number format and check if the study exists. Supports all BioStudies accession formats including S-BSST, E-MTAB, EMPIAR, S-BIAD, and others.",
        inputSchema: {
          type: "object",
          properties: {
            accno: {
              type: "string",
              description: "Study accession number to validate"
            }
          },
          required: ["accno"]
        }
      },
      {
        name: "batch_get_studies",
        description: "Retrieve information for multiple studies in a single request (maximum 50 studies). Efficiently processes multiple accession numbers and provides success/failure status for each.",
        inputSchema: {
          type: "object",
          properties: {
            accessions: {
              type: "array",
              items: { type: "string" },
              description: "Array of study accession numbers to retrieve",
              maxItems: 50,
              minItems: 1
            }
          },
          required: ["accessions"]
        }
      }
    ]
  };
});

/**
 * Handler for executing BioStudies tools
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "get_study_details":
        return await bioStudiesHandlers.getStudyDetails(args);

      case "validate_study_accession":
        return await bioStudiesHandlers.validateStudyAccession(args);

      case "batch_get_studies":
        return await bioStudiesHandlers.batchGetStudies(args);

      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${name}. Available tools: get_study_details, validate_study_accession, batch_get_studies`
        );
    }
  } catch (error) {
    // Handle both McpError and regular errors
    if (error instanceof McpError) {
      throw error;
    }

    // Convert regular errors to appropriate MCP errors
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    if (errorMessage.includes('required')) {
      throw new McpError(ErrorCode.InvalidParams, errorMessage);
    }
    
    return {
      content: [{
        type: "text",
        text: `Error: ${errorMessage}`
      }],
      isError: true
    };
  }
});

/**
 * Start the server using stdio transport
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("BioStudies MCP server running on stdio");
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.error('Shutting down BioStudies MCP server...');
  await server.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.error('Shutting down BioStudies MCP server...');
  await server.close();
  process.exit(0);
});

// Start the server
main().catch((error) => {
  console.error("BioStudies MCP Server error:", error);
  process.exit(1);
});
