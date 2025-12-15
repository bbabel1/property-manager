import fs from 'fs';
import path from 'path';
import { logger } from './logger';

interface APIRoute {
  method: string;
  path: string;
  description: string;
  parameters: Parameter[];
  response: any;
  filePath: string;
}

interface Parameter {
  name: string;
  type: string;
  description: string;
  required: boolean;
}

class APIDocGenerator {
  private apiRoutes: APIRoute[] = [];

  generate() {
    logger.info('🔍 Scanning API routes...');
    
    this.scanAPIRoutes('./src/app/api');
    const markdown = this.generateMarkdown();
    
    fs.writeFileSync('./docs/api/api-documentation.md', markdown);
    logger.info(`✅ API documentation generated with ${this.apiRoutes.length} routes`);
  }

  private scanAPIRoutes(apiDir: string) {
    if (!fs.existsSync(apiDir)) {
      logger.warn(`API directory not found: ${apiDir}`);
      return;
    }

    this.scanDirectory(apiDir, '');
  }

  private scanDirectory(dir: string, basePath: string) {
    const items = fs.readdirSync(dir);

    items.forEach(item => {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        // Handle dynamic routes like [id]
        const routePath = item.startsWith('[') && item.endsWith(']') 
          ? `/{${item.slice(1, -1)}}` 
          : `/${item}`;
        
        this.scanDirectory(fullPath, basePath + routePath);
      } else if (item.endsWith('.ts') || item.endsWith('.tsx')) {
        this.parseAPIFile(fullPath, basePath);
      }
    });
  }

  private parseAPIFile(filePath: string, routePath: string) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const fileName = path.basename(filePath, path.extname(filePath));
      
      // Extract HTTP methods from the file
      const methods = this.extractHTTPMethods(content);
      
      methods.forEach(method => {
        const route: APIRoute = {
          method: method.toUpperCase(),
          path: routePath || '/',
          description: this.extractDescription(content),
          parameters: this.extractParameters(content),
          response: this.extractResponse(content),
          filePath: filePath
        };
        
        this.apiRoutes.push(route);
      });
    } catch (error) {
      logger.error(`Error parsing API file ${filePath}: ${error}`);
    }
  }

  private extractHTTPMethods(content: string): string[] {
    const methods: string[] = [];
    
    // Look for Next.js API route handlers
    const patterns = [
      /export async function GET/,
      /export async function POST/,
      /export async function PUT/,
      /export async function DELETE/,
      /export async function PATCH/,
      /export const GET/,
      /export const POST/,
      /export const PUT/,
      /export const DELETE/,
      /export const PATCH/
    ];

    patterns.forEach((pattern, index) => {
      if (pattern.test(content)) {
        const methodNames = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
        methods.push(methodNames[index % methodNames.length]);
      }
    });

    return methods.length > 0 ? methods : ['GET']; // Default to GET if no method found
  }

  private extractDescription(content: string): string {
    // Look for JSDoc comments or inline comments
    const jsdocMatch = content.match(/\/\*\*([\s\S]*?)\*\//);
    if (jsdocMatch) {
      return jsdocMatch[1].replace(/\*/g, '').trim();
    }

    // Look for single line comments
    const commentMatch = content.match(/\/\/\s*(.+)/);
    return commentMatch ? commentMatch[1].trim() : 'API endpoint';
  }

  private extractParameters(content: string): Parameter[] {
    const parameters: Parameter[] = [];
    
    // Look for request parameters in the code
    const paramMatches = content.matchAll(/req\.(?:query|body|params)\.(\w+)/g);
    
    for (const match of paramMatches) {
      parameters.push({
        name: match[1],
        type: 'string',
        description: `Parameter: ${match[1]}`,
        required: false
      });
    }

    return parameters;
  }

  private extractResponse(content: string): any {
    // Try to extract response structure from the code
    const responseMatch = content.match(/return\s+({[\s\S]*?})/);
    if (responseMatch) {
      try {
        return JSON.parse(responseMatch[1]);
      } catch {
        return { message: 'Response object' };
      }
    }

    return { message: 'Response data' };
  }

  private generateMarkdown(): string {
    const timestamp = new Date().toISOString();
    
    return `# API Documentation

> Generated on: ${timestamp}
> 
> This documentation is automatically generated from your Next.js API routes.

## Overview

This API provides endpoints for the Property Management System.

## Endpoints

${this.apiRoutes.map(route => `
### ${route.method} ${route.path}

${route.description}

**File:** \`${route.filePath}\`

${route.parameters.length > 0 ? `
**Parameters:**
${route.parameters.map(param => `- \`${param.name}\` (${param.type})${param.required ? ' - **Required**' : ' - Optional'}: ${param.description}`).join('\n')}
` : ''}

**Response:**
\`\`\`json
${JSON.stringify(route.response, null, 2)}
\`\`\`

---
`).join('\n')}

## Authentication

Most endpoints require authentication. Include your authentication token in the request headers.

## Error Handling

All endpoints return appropriate HTTP status codes:
- \`200\` - Success
- \`400\` - Bad Request
- \`401\` - Unauthorized
- \`404\` - Not Found
- \`500\` - Internal Server Error

## Rate Limiting

API requests are rate-limited to prevent abuse. Please implement appropriate retry logic with exponential backoff.
`;
  }
}

// Run the generator
const generator = new APIDocGenerator();
generator.generate();
