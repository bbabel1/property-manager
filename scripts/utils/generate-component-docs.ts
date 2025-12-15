import fs from 'fs';
import path from 'path';
import { logger } from './logger';

interface ComponentInfo {
  name: string;
  filePath: string;
  props: PropInfo[];
  description: string;
  usage: string;
}

interface PropInfo {
  name: string;
  type: string;
  required: boolean;
  defaultValue?: string;
  description: string;
}

class ComponentDocGenerator {
  private components: ComponentInfo[] = [];

  generate() {
    logger.info('🔍 Scanning React components...');
    
    this.scanComponents('./src/components');
    const markdown = this.generateMarkdown();
    
    fs.writeFileSync('./docs/api/component-documentation.md', markdown);
    logger.info(`✅ Component documentation generated with ${this.components.length} components`);
  }

  private scanComponents(componentsDir: string) {
    if (!fs.existsSync(componentsDir)) {
      logger.warn(`Components directory not found: ${componentsDir}`);
      return;
    }

    this.scanDirectory(componentsDir);
  }

  private scanDirectory(dir: string) {
    const items = fs.readdirSync(dir);

    items.forEach(item => {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        this.scanDirectory(fullPath);
      } else if (item.endsWith('.tsx') || item.endsWith('.ts')) {
        this.parseComponent(fullPath);
      }
    });
  }

  private parseComponent(filePath: string) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const fileName = path.basename(filePath, path.extname(filePath));
      
      // Check if it's a React component
      if (this.isReactComponent(content)) {
        const component: ComponentInfo = {
          name: this.extractComponentName(content, fileName),
          filePath: filePath,
          props: this.extractProps(content),
          description: this.extractDescription(content),
          usage: this.generateUsageExample(fileName, this.extractProps(content))
        };
        
        this.components.push(component);
      }
    } catch (error) {
      logger.error(`Error parsing component file ${filePath}: ${error}`);
    }
  }

  private isReactComponent(content: string): boolean {
    return content.includes('export') && (
      content.includes('function') || 
      content.includes('const') ||
      content.includes('class')
    ) && (
      content.includes('JSX') ||
      content.includes('return') ||
      content.includes('React')
    );
  }

  private extractComponentName(content: string, fileName: string): string {
    // Look for named exports
    const exportMatch = content.match(/export\s+(?:default\s+)?(?:function|const|class)\s+(\w+)/);
    if (exportMatch) {
      return exportMatch[1];
    }

    // Look for default exports
    const defaultMatch = content.match(/export\s+default\s+(?:function|const|class)\s+(\w+)/);
    if (defaultMatch) {
      return defaultMatch[1];
    }

    // Fallback to filename
    return fileName.charAt(0).toUpperCase() + fileName.slice(1);
  }

  private extractProps(content: string): PropInfo[] {
    const props: PropInfo[] = [];
    
    // Look for TypeScript interfaces
    const interfaceMatch = content.match(/interface\s+(\w+Props?)\s*{([^}]+)}/);
    if (interfaceMatch) {
      const interfaceBody = interfaceMatch[2];
      const propLines = interfaceBody.split('\n').map(line => line.trim()).filter(line => line);
      
      propLines.forEach(line => {
        const prop = this.parsePropLine(line);
        if (prop) {
          props.push(prop);
        }
      });
    }

    // Look for inline props
    const propsMatch = content.match(/\([^)]*\{[^}]*\}[^)]*\)/);
    if (propsMatch && props.length === 0) {
      const propsString = propsMatch[0];
      const propMatches = propsString.matchAll(/(\w+)\s*:\s*([^,\s]+)/g);
      
      for (const match of propMatches) {
        props.push({
          name: match[1],
          type: match[2],
          required: !match[2].includes('?'),
          description: `Prop: ${match[1]}`
        });
      }
    }

    return props;
  }

  private parsePropLine(line: string): PropInfo | null {
    const propMatch = line.match(/(\w+)\s*[?:]\s*([^;]+)/);
    if (!propMatch) return null;

    const name = propMatch[1];
    const type = propMatch[2].trim();
    const required = !line.includes('?');

    return {
      name,
      type,
      required,
      description: this.getPropDescription(name, type)
    };
  }

  private getPropDescription(name: string, type: string): string {
    const descriptions: Record<string, string> = {
      'children': 'Child components or content',
      'className': 'CSS class names',
      'style': 'Inline styles',
      'onClick': 'Click event handler',
      'onChange': 'Change event handler',
      'onSubmit': 'Submit event handler',
      'value': 'Current value',
      'defaultValue': 'Default value',
      'placeholder': 'Placeholder text',
      'disabled': 'Whether the component is disabled',
      'required': 'Whether the field is required',
      'type': 'Input type or component type',
      'size': 'Size variant',
      'variant': 'Visual variant',
      'color': 'Color variant',
      'label': 'Label text',
      'title': 'Title text',
      'description': 'Description text',
      'icon': 'Icon component',
      'loading': 'Loading state',
      'error': 'Error state or message'
    };

    return descriptions[name.toLowerCase()] || `${name} prop of type ${type}`;
  }

  private extractDescription(content: string): string {
    // Look for JSDoc comments
    const jsdocMatch = content.match(/\/\*\*([\s\S]*?)\*\//);
    if (jsdocMatch) {
      return jsdocMatch[1].replace(/\*/g, '').trim();
    }

    // Look for single line comments
    const commentMatch = content.match(/\/\/\s*(.+)/);
    return commentMatch ? commentMatch[1].trim() : 'React component';
  }

  private generateUsageExample(componentName: string, props: PropInfo[]): string {
    const requiredProps = props.filter(p => p.required);
    const optionalProps = props.filter(p => !p.required);

    let example = `<${componentName}`;
    
    if (requiredProps.length > 0) {
      example += `\n  ${requiredProps.map(p => `${p.name}={/* ${p.type} */}`).join('\n  ')}`;
    }
    
    if (optionalProps.length > 0) {
      example += `\n  ${optionalProps.map(p => `// ${p.name}={/* ${p.type} */}`).join('\n  ')}`;
    }
    
    example += '\n/>';

    return example;
  }

  private generateMarkdown(): string {
    const timestamp = new Date().toISOString();
    
    return `# Component Documentation

> Generated on: ${timestamp}
> 
> This documentation is automatically generated from your React components.

## Overview

This document describes the React components used in the Property Management System.

## Components

${this.components.map(component => `
### ${component.name}

${component.description}

**File:** \`${component.filePath}\`

${component.props.length > 0 ? `
#### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
${component.props.map(prop => `| \`${prop.name}\` | \`${prop.type}\` | ${prop.required ? 'Yes' : 'No'} | ${prop.description} |`).join('\n')}

#### Usage Example

\`\`\`tsx
${component.usage}
\`\`\`
` : 'No props defined.'}

---
`).join('\n')}

## Component Guidelines

### Naming Conventions

- Component names use PascalCase
- File names match component names
- Props interfaces are named \`{ComponentName}Props\`

### Best Practices

1. Use TypeScript for type safety
2. Define prop interfaces for all components
3. Include JSDoc comments for complex components
4. Use consistent prop naming conventions
5. Provide default values for optional props
6. Handle loading and error states appropriately

### Common Props

- \`children\`: Child components or content
- \`className\`: CSS class names for styling
- \`onClick\`: Click event handlers
- \`onChange\`: Change event handlers
- \`value\`: Current value for controlled components
- \`disabled\`: Disabled state
- \`loading\`: Loading state
- \`error\`: Error state or message
`;
  }
}

// Run the generator
const generator = new ComponentDocGenerator();
generator.generate();
