import fs from 'fs';
import { logger } from './utils/logger';

interface TableInfo {
  name: string;
  columns: ColumnInfo[];
  indexes: string[];
  constraints: string[];
}

interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  default?: string;
  description?: string;
}

class DatabaseDocGenerator {
  private tables: TableInfo[] = [];

  generate() {
    logger.info('🔍 Reading database schema...');
    
    const schemaFiles = [
      './supabase-schema.sql',
      './supabase/schema.sql',
      './migrations/*.sql'
    ];

    let schemaContent = '';
    
    schemaFiles.forEach(file => {
      if (fs.existsSync(file)) {
        schemaContent += fs.readFileSync(file, 'utf-8') + '\n';
      }
    });

    if (!schemaContent) {
      logger.warn('No schema files found');
      return;
    }

    this.parseSchema(schemaContent);
    const markdown = this.generateMarkdown();
    
    fs.writeFileSync('./DATABASE_SCHEMA.md', markdown);
    logger.info(`✅ Database schema documentation generated with ${this.tables.length} tables`);
  }

  private parseSchema(schema: string) {
    // Split into individual statements
    const statements = schema.split(';').filter(stmt => stmt.trim());
    
    statements.forEach(statement => {
      const trimmed = statement.trim();
      
      if (trimmed.toUpperCase().startsWith('CREATE TABLE')) {
        this.parseCreateTable(trimmed);
      }
    });
  }

  private parseCreateTable(statement: string) {
    const tableMatch = statement.match(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?["`]?(\w+)["`]?\s*\(([\s\S]*)\)/i);
    
    if (!tableMatch) return;

    const tableName = tableMatch[1];
    const tableBody = tableMatch[2];
    
    const table: TableInfo = {
      name: tableName,
      columns: [],
      indexes: [],
      constraints: []
    };

    // Parse columns
    const columnLines = tableBody.split(',').map(line => line.trim()).filter(line => line);
    
    columnLines.forEach(line => {
      if (line.toUpperCase().startsWith('PRIMARY KEY') || 
          line.toUpperCase().startsWith('FOREIGN KEY') ||
          line.toUpperCase().startsWith('UNIQUE') ||
          line.toUpperCase().startsWith('INDEX')) {
        table.constraints.push(line);
      } else if (line.includes(' ')) {
        const column = this.parseColumn(line);
        if (column) {
          table.columns.push(column);
        }
      }
    });

    this.tables.push(table);
  }

  private parseColumn(line: string): ColumnInfo | null {
    const columnMatch = line.match(/["`]?(\w+)["`]?\s+([^\s]+)(?:\s+([^,\s]+))?(?:\s+DEFAULT\s+([^,\s]+))?/i);
    
    if (!columnMatch) return null;

    const name = columnMatch[1];
    const type = columnMatch[2];
    const nullable = !line.toUpperCase().includes('NOT NULL');
    const defaultVal = columnMatch[4];

    return {
      name,
      type,
      nullable,
      default: defaultVal,
      description: this.getColumnDescription(name, type)
    };
  }

  private getColumnDescription(name: string, type: string): string {
    const descriptions: Record<string, string> = {
      'id': 'Primary key identifier',
      'created_at': 'Timestamp when the record was created',
      'updated_at': 'Timestamp when the record was last updated',
      'name': 'Name or title',
      'email': 'Email address',
      'password': 'Hashed password',
      'status': 'Current status of the record',
      'type': 'Type or category',
      'description': 'Detailed description',
      'amount': 'Numeric amount or value',
      'date': 'Date value',
      'url': 'URL or link',
      'image': 'Image URL or path',
      'phone': 'Phone number',
      'address': 'Physical address',
      'city': 'City name',
      'state': 'State or province',
      'zip': 'Postal code',
      'country': 'Country name'
    };

    return descriptions[name.toLowerCase()] || `${name} field of type ${type}`;
  }

  private generateMarkdown(): string {
    const timestamp = new Date().toISOString();
    
    return `# Database Schema Documentation

> Generated on: ${timestamp}
> 
> This documentation is automatically generated from your database schema files.

## Overview

This document describes the database schema for the Property Management System.

## Tables

${this.tables.map(table => `
### ${table.name}

${table.columns.map(col => `
#### ${col.name}

- **Type:** \`${col.type}\`
- **Nullable:** ${col.nullable ? 'Yes' : 'No'}
${col.default ? `- **Default:** \`${col.default}\`` : ''}
- **Description:** ${col.description}

`).join('')}

${table.constraints.length > 0 ? `
**Constraints:**
${table.constraints.map(constraint => `- \`${constraint}\``).join('\n')}
` : ''}

---
`).join('\n')}

## Relationships

${this.generateRelationships()}

## Indexes

${this.generateIndexes()}

## Data Types

The database uses the following data types:

- **UUID**: Unique identifier (primary keys)
- **VARCHAR**: Variable-length character strings
- **TEXT**: Long text content
- **INTEGER**: Whole numbers
- **DECIMAL**: Decimal numbers with precision
- **BOOLEAN**: True/false values
- **TIMESTAMP**: Date and time values
- **JSON**: JSON data structures

## Naming Conventions

- Table names are in snake_case
- Column names are in snake_case
- Primary keys are named \`id\`
- Foreign keys are named \`{table_name}_id\`
- Timestamps are named \`created_at\` and \`updated_at\`

## Best Practices

1. All tables have a primary key
2. Foreign keys have appropriate constraints
3. Important columns are indexed for performance
4. Sensitive data is properly encrypted
5. Audit trails are maintained with timestamps
`;
  }

  private generateRelationships(): string {
    const relationships: string[] = [];
    
    this.tables.forEach(table => {
      table.constraints.forEach(constraint => {
        if (constraint.toUpperCase().includes('FOREIGN KEY')) {
          const fkMatch = constraint.match(/FOREIGN KEY\s*\(([^)]+)\)\s+REFERENCES\s+(\w+)\s*\(([^)]+)\)/i);
          if (fkMatch) {
            relationships.push(`- \`${table.name}.${fkMatch[1]}\` → \`${fkMatch[2]}.${fkMatch[3]}\``);
          }
        }
      });
    });

    return relationships.length > 0 ? relationships.join('\n') : 'No explicit foreign key relationships found.';
  }

  private generateIndexes(): string {
    const indexes: string[] = [];
    
    this.tables.forEach(table => {
      table.constraints.forEach(constraint => {
        if (constraint.toUpperCase().includes('INDEX') || constraint.toUpperCase().includes('UNIQUE')) {
          indexes.push(`- \`${table.name}\`: ${constraint}`);
        }
      });
    });

    return indexes.length > 0 ? indexes.join('\n') : 'No explicit indexes found.';
  }
}

// Run the generator
const generator = new DatabaseDocGenerator();
generator.generate();
