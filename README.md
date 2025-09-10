# BioStudies MCP Server

A streamlined Model Context Protocol (MCP) server that provides reliable access to the EBI BioStudies database. This server focuses on the core functionality that works consistently with the current BioStudies API, ensuring reliable access to biological study metadata.

## Features

- **Study Details**: Get comprehensive information about specific studies with rich metadata extraction
- **Accession Validation**: Validate study accession numbers and check study existence  
- **Batch Processing**: Efficiently retrieve multiple studies in a single request
- **Rich Data Extraction**: Enhanced parsing of study metadata including attributes, files, links, and subsections
- **Reliable Performance**: Only includes tools that work consistently with the current API

## Installation

### Prerequisites

- Node.js 18 or higher
- npm or yarn

### Setup

1. Clone or download the server files
2. Install dependencies:

```bash
npm install
```

3. Build the server:

```bash
npm run build
```

4. Start the server:

```bash
npm start
```

## Usage

The server provides 3 reliable tools for interacting with the BioStudies API:

### 1. Get Study Details (`get_study_details`)

Retrieve comprehensive information about a specific study including rich metadata, external references, associated files, and detailed attributes.

```javascript
{
  "accno": "S-BSST1234"
}
```

**Example Response Features:**
- Complete study attributes and section details
- External database references and links
- Associated file information with sizes and types
- Subsection data and hierarchical information
- Author details with affiliations and ORCID IDs
- Rich descriptions and methodologies

### 2. Validate Study Accession (`validate_study_accession`)

Validate an accession number format and check if the study exists in the database.

```javascript
{
  "accno": "E-MTAB-1234"
}
```

**Response includes:**
- Format validation results
- Study existence confirmation
- Basic study information if found
- Access level (public/restricted)

### 3. Batch Get Studies (`batch_get_studies`)

Efficiently retrieve information for multiple studies in a single request (maximum 50 studies).

```javascript
{
  "accessions": ["S-BSST1234", "E-MTAB-5678", "EMPIAR-9012"]
}
```

**Features:**
- Processes up to 50 studies at once
- Success/failure status for each study
- Detailed error reporting for failed retrievals
- Efficient parallel processing

## Supported Accession Formats

The server recognizes these accession number patterns:

- **S-BSST####** - BioStudies submissions
- **E-MTAB-####** - ArrayExpress studies  
- **EMPIAR-####** - EMPIAR electron microscopy data
- **S-BIAD####** - BioImages data
- **S-BSMS####** - BioSamples data
- **PRJ[EDN][A-Z]####** - Project accessions

## Examples

### Get Detailed Study Information

```javascript
{
  "accno": "E-MTAB-7249"
}
```

This returns comprehensive metadata including study descriptions, methodologies, author information, file listings, and external database links.

### Validate Multiple Accession Numbers

```javascript
{
  "accessions": [
    "S-BSST1234",
    "E-MTAB-5678", 
    "INVALID-123"
  ]
}
```

This efficiently processes multiple studies and reports which ones exist and which failed with specific error messages.

### Check If Accession Exists

```javascript
{
  "accno": "EMPIAR-10001"
}
```

This validates the format and confirms whether the study exists in the database.

## Error Handling

The server provides clear error messages for:

- Invalid accession number formats
- Non-existent studies
- Network connection issues
- Missing required parameters
- Rate limiting and timeouts

## API Details

- **Base URL**: `https://www.ebi.ac.uk/biostudies/api/v1`
- **Format**: JSON responses with comprehensive metadata
- **Timeout**: 30 seconds per request
- **Batch limit**: Maximum 50 studies per batch request

## Data Quality

This server includes enhanced data extraction that:

- Parses complex nested JSON structures from the API
- Extracts comprehensive study attributes and section details
- Includes file information, external links, and references
- Provides rich metadata including descriptions, methodologies, and author details
- Handles various study types and collection formats

## Development

### Building

```bash
npm run build
```

### Development Mode

```bash
npm run dev
```

### Project Structure

```
biostudies-server/
├── src/
│   ├── index.ts                    # Main server entry point
│   ├── handlers/
│   │   └── biostudies-handlers.ts  # Tool implementations
│   ├── types/
│   │   └── biostudies.ts          # TypeScript interfaces
│   └── utils/
│       └── api-client.ts          # HTTP client with enhanced parsing
├── build/                         # Compiled JavaScript
├── package.json
├── tsconfig.json
└── README.md
```

## Collections

BioStudies includes data from multiple collections:

- **ArrayExpress**: Gene expression and functional genomics studies
- **BioImages**: Biological imaging data from microscopy
- **EMPIAR**: Electron microscopy public image archive
- **BioSamples**: Sample metadata and descriptions
- **General BioStudies**: Multi-omics and general biological studies

## Use Cases

This server is particularly useful for:

- **Research Data Discovery**: Finding and analyzing biological studies
- **Metadata Extraction**: Retrieving comprehensive study information
- **Data Integration**: Incorporating BioStudies data into analysis pipelines
- **Accession Validation**: Verifying study identifiers in databases
- **Batch Processing**: Efficiently handling multiple studies

## Support

For issues related to:

- **This MCP server**: Submit issues to the server repository
- **BioStudies API**: Contact biostudies@ebi.ac.uk
- **Study data**: Use the contact information provided in study metadata

## License

MIT License - See LICENSE file for details.

## Related Resources

- [BioStudies Database](https://www.ebi.ac.uk/biostudies/)
- [BioStudies Help](https://www.ebi.ac.uk/biostudies/help)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [EBI Data Resources](https://www.ebi.ac.uk/services)
