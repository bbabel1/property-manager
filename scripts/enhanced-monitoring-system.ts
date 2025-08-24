#!/usr/bin/env tsx

/**
 * Enhanced Monitoring System
 * Continuously monitors and fixes:
 * - Markdown link problems
 * - Script file updates
 * - Path mappings
 * - Documentation consistency
 */

import fs from 'fs/promises'
import path from 'path'
import { execSync } from 'child_process'
import { watch } from 'fs'

interface LinkIssue {
  file: string
  line: number
  link: string
  issue: 'broken' | 'relative' | 'absolute' | 'missing'
  suggestedFix?: string
}

interface FileMapping {
  source: string
  target: string
  type: 'symlink' | 'copy' | 'reference'
}

class EnhancedMonitor {
  private isRunning = false
  private checkInterval = 30000 // 30 seconds
  private lastCheck = new Date()
  private linkIssues: LinkIssue[] = []
  private fileMappings: FileMapping[] = []

  constructor() {
    this.setupFileMappings()
  }

  private setupFileMappings() {
    // Define critical file mappings that need to be maintained
    this.fileMappings = [
      {
        source: 'src/types/index.ts',
        target: 'docs/architecture/TYPES_REFERENCE.md',
        type: 'reference'
      },
      {
        source: 'src/lib/supabase.ts',
        target: 'docs/architecture/SUPABASE_CLIENT_SETUP.md',
        type: 'reference'
      },
      {
        source: 'supabase/migrations',
        target: 'docs/database/MIGRATIONS.md',
        type: 'reference'
      },
      {
        source: 'src/app/api',
        target: 'docs/api/ENDPOINTS.md',
        type: 'reference'
      }
    ]
  }

  async start() {
    if (this.isRunning) {
      console.log('🚫 Monitor is already running')
      return
    }

    console.log('🚀 Starting Enhanced Monitoring System...')
    this.isRunning = true

    // Initial check
    await this.performFullCheck()

    // Set up file watchers
    this.setupFileWatchers()

    // Start periodic checks
    this.startPeriodicChecks()

    console.log('✅ Enhanced Monitoring System is now running in the background')
    console.log('📊 Monitoring: markdown links, script files, mappings, and paths')
    console.log('⏰ Check interval: 30 seconds')
    console.log('📝 Logs will be written to logs/monitoring.log')
  }

  private setupFileWatchers() {
    const watchDirs = ['src', 'docs', 'scripts', 'supabase']
    
    watchDirs.forEach(dir => {
      try {
        watch(dir, { recursive: true }, async (eventType, filename) => {
          if (filename && this.shouldProcessFile(filename)) {
            console.log(`📁 File change detected: ${dir}/${filename}`)
            await this.handleFileChange(path.join(dir, filename), eventType)
          }
        })
        console.log(`👀 Watching directory: ${dir}`)
      } catch (error) {
        console.warn(`⚠️ Could not watch directory ${dir}:`, error)
      }
    })
  }

  private shouldProcessFile(filename: string): boolean {
    const relevantExtensions = ['.md', '.ts', '.tsx', '.js', '.jsx', '.json', '.sql']
    return relevantExtensions.some(ext => filename.endsWith(ext))
  }

  private async handleFileChange(filePath: string, eventType: string) {
    try {
      if (eventType === 'change' || eventType === 'rename') {
        // Check for markdown link issues
        if (filePath.endsWith('.md')) {
          await this.checkMarkdownLinks(filePath)
        }

        // Update related documentation
        await this.updateRelatedDocs(filePath)

        // Check file mappings
        await this.validateFileMappings()
      }
    } catch (error) {
      console.error(`❌ Error handling file change for ${filePath}:`, error)
    }
  }

  private startPeriodicChecks() {
    setInterval(async () => {
      if (this.isRunning) {
        await this.performFullCheck()
      }
    }, this.checkInterval)
  }

  async performFullCheck() {
    console.log(`\n🔍 Performing full system check at ${new Date().toISOString()}`)
    
    try {
      // Check markdown links across all files
      await this.checkAllMarkdownLinks()
      
      // Validate file mappings
      await this.validateFileMappings()
      
      // Update script references
      await this.updateScriptReferences()
      
      // Check for broken imports
      await this.checkBrokenImports()
      
      // Update documentation index
      await this.updateDocumentationIndex()
      
      // Log results
      await this.logResults()
      
    } catch (error) {
      console.error('❌ Error during full check:', error)
    }
  }

  async checkAllMarkdownLinks() {
    console.log('🔗 Checking all markdown links...')
    
    const markdownFiles = await this.findMarkdownFiles()
    this.linkIssues = []

    for (const file of markdownFiles) {
      await this.checkMarkdownLinks(file)
    }

    if (this.linkIssues.length > 0) {
      console.log(`⚠️ Found ${this.linkIssues.length} link issues`)
      await this.fixLinkIssues()
    } else {
      console.log('✅ All markdown links are valid')
    }
  }

  async findMarkdownFiles(): Promise<string[]> {
    const files: string[] = []
    
    const searchDirs = ['.', 'docs', 'src']
    
    for (const dir of searchDirs) {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true })
        for (const entry of entries) {
          if (entry.isFile() && entry.name.endsWith('.md')) {
            files.push(path.join(dir, entry.name))
          } else if (entry.isDirectory() && !entry.name.startsWith('.')) {
            const subFiles = await this.findMarkdownFilesRecursive(path.join(dir, entry.name))
            files.push(...subFiles)
          }
        }
      } catch (error) {
        // Directory might not exist, skip
      }
    }
    
    return files
  }

  async findMarkdownFilesRecursive(dir: string): Promise<string[]> {
    const files: string[] = []
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.md')) {
          files.push(path.join(dir, entry.name))
        } else if (entry.isDirectory() && !entry.name.startsWith('.')) {
          const subFiles = await this.findMarkdownFilesRecursive(path.join(dir, entry.name))
          files.push(...subFiles)
        }
      }
    } catch (error) {
      // Directory might not exist, skip
    }
    
    return files
  }

  async checkMarkdownLinks(filePath: string) {
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const lines = content.split('\n')
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const linkMatches = line.match(/\[([^\]]+)\]\(([^)]+)\)/g)
        
        if (linkMatches) {
          for (const match of linkMatches) {
            const linkMatch = match.match(/\[([^\]]+)\]\(([^)]+)\)/)
            if (linkMatch) {
              const [, text, link] = linkMatch
              await this.validateLink(filePath, i + 1, text, link)
            }
          }
        }
      }
    } catch (error) {
      console.error(`❌ Error checking links in ${filePath}:`, error)
    }
  }

  async validateLink(filePath: string, line: number, text: string, link: string) {
    // Skip external links
    if (link.startsWith('http://') || link.startsWith('https://')) {
      return
    }

    // Handle anchor links
    if (link.startsWith('#')) {
      return
    }

    // Check if the linked file exists
    const linkPath = path.resolve(path.dirname(filePath), link)
    
    try {
      await fs.access(linkPath)
    } catch (error) {
      this.linkIssues.push({
        file: filePath,
        line,
        link,
        issue: 'broken',
        suggestedFix: await this.suggestLinkFix(filePath, link)
      })
    }
  }

  async suggestLinkFix(filePath: string, brokenLink: string): Promise<string | undefined> {
    // Try to find similar files
    const searchDir = path.dirname(filePath)
    const searchTerm = path.basename(brokenLink, path.extname(brokenLink))
    
    try {
      const files = await this.findFilesRecursive(searchDir)
      const similarFiles = files.filter(file => 
        file.toLowerCase().includes(searchTerm.toLowerCase()) && 
        file.endsWith('.md')
      )
      
      if (similarFiles.length > 0) {
        const relativePath = path.relative(path.dirname(filePath), similarFiles[0])
        return relativePath
      }
    } catch (error) {
      // Ignore errors in suggestion
    }
    
    return undefined
  }

  async findFilesRecursive(dir: string): Promise<string[]> {
    const files: string[] = []
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isFile()) {
          files.push(path.join(dir, entry.name))
        } else if (entry.isDirectory() && !entry.name.startsWith('.')) {
          const subFiles = await this.findFilesRecursive(path.join(dir, entry.name))
          files.push(...subFiles)
        }
      }
    } catch (error) {
      // Directory might not exist, skip
    }
    
    return files
  }

  async fixLinkIssues() {
    console.log('🔧 Fixing link issues...')
    
    for (const issue of this.linkIssues) {
      if (issue.suggestedFix) {
        try {
          const content = await fs.readFile(issue.file, 'utf-8')
          const lines = content.split('\n')
          
          // Replace the broken link with the suggested fix
          const lineIndex = issue.line - 1
          const line = lines[lineIndex]
          
          // Find the markdown link pattern and replace it
          const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/
          const match = line.match(linkPattern)
          
          if (match) {
            const [, text, currentLink] = match
            const newLine = line.replace(linkPattern, `[${text}](${issue.suggestedFix})`)
            lines[lineIndex] = newLine
            
            await fs.writeFile(issue.file, lines.join('\n'))
            console.log(`✅ Fixed link in ${issue.file}:${issue.line}`)
          }
        } catch (error) {
          console.error(`❌ Failed to fix link in ${issue.file}:`, error)
        }
      }
    }
  }

  async validateFileMappings() {
    console.log('🗂️ Validating file mappings...')
    
    for (const mapping of this.fileMappings) {
      try {
        await fs.access(mapping.source)
        console.log(`✅ Source file exists: ${mapping.source}`)
      } catch (error) {
        console.warn(`⚠️ Source file missing: ${mapping.source}`)
      }
      
      try {
        await fs.access(mapping.target)
        console.log(`✅ Target file exists: ${mapping.target}`)
      } catch (error) {
        console.warn(`⚠️ Target file missing: ${mapping.target}`)
      }
    }
  }

  async updateScriptReferences() {
    console.log('📜 Updating script references...')
    
    // Update package.json scripts if needed
    const packagePath = 'package.json'
    try {
      const packageContent = await fs.readFile(packagePath, 'utf-8')
      const packageJson = JSON.parse(packageContent)
      
      // Ensure monitoring scripts are present
      const requiredScripts = {
        'monitor:start': 'npx tsx scripts/enhanced-monitoring-system.ts start',
        'monitor:check': 'npx tsx scripts/enhanced-monitoring-system.ts check',
        'monitor:fix': 'npx tsx scripts/enhanced-monitoring-system.ts fix'
      }
      
      let updated = false
      for (const [script, command] of Object.entries(requiredScripts)) {
        if (!packageJson.scripts[script]) {
          packageJson.scripts[script] = command
          updated = true
          console.log(`➕ Added script: ${script}`)
        }
      }
      
      if (updated) {
        await fs.writeFile(packagePath, JSON.stringify(packageJson, null, 2))
        console.log('✅ Updated package.json scripts')
      }
    } catch (error) {
      console.error('❌ Error updating package.json:', error)
    }
  }

  async checkBrokenImports() {
    console.log('🔍 Checking for broken imports...')
    
    const tsFiles = await this.findTypeScriptFiles()
    
    for (const file of tsFiles) {
      try {
        const content = await fs.readFile(file, 'utf-8')
        const importMatches = content.match(/import.*from\s+['"]([^'"]+)['"]/g)
        
        if (importMatches) {
          for (const match of importMatches) {
            const importPath = match.match(/from\s+['"]([^'"]+)['"]/)?.[1]
            if (importPath && !importPath.startsWith('@') && !importPath.startsWith('.') && !importPath.startsWith('next') && !importPath.startsWith('react') && !importPath.startsWith('lucide-react') && !importPath.startsWith('clsx') && !importPath.startsWith('tailwind-merge') && !importPath.startsWith('next-auth') && !importPath.startsWith('fs') && !importPath.startsWith('path') && !importPath.startsWith('child_process')) {
              // This is a relative import that might be broken
              const resolvedPath = path.resolve(path.dirname(file), importPath)
              try {
                await fs.access(resolvedPath)
              } catch (error) {
                console.warn(`⚠️ Potentially broken import in ${file}: ${importPath}`)
              }
            }
          }
        }
      } catch (error) {
        console.error(`❌ Error checking imports in ${file}:`, error)
      }
    }
  }

  async findTypeScriptFiles(): Promise<string[]> {
    const files: string[] = []
    
    const searchDirs = ['src', 'scripts']
    
    for (const dir of searchDirs) {
      try {
        const subFiles = await this.findTypeScriptFilesRecursive(dir)
        files.push(...subFiles)
      } catch (error) {
        // Directory might not exist, skip
      }
    }
    
    return files
  }

  async findTypeScriptFilesRecursive(dir: string): Promise<string[]> {
    const files: string[] = []
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
          files.push(path.join(dir, entry.name))
        } else if (entry.isDirectory() && !entry.name.startsWith('.')) {
          const subFiles = await this.findTypeScriptFilesRecursive(path.join(dir, entry.name))
          files.push(...subFiles)
        }
      }
    } catch (error) {
      // Directory might not exist, skip
    }
    
    return files
  }

  async updateDocumentationIndex() {
    console.log('📚 Updating documentation index...')
    
    const indexPath = 'docs/README.md'
    try {
      const content = await fs.readFile(indexPath, 'utf-8')
      
      // Update last modified timestamp
      const updatedContent = content.replace(
        /(Last Updated: ).*/,
        `$1${new Date().toISOString()} (Auto-generated)`
      )
      
      await fs.writeFile(indexPath, updatedContent)
      console.log('✅ Updated documentation index')
    } catch (error) {
      console.error('❌ Error updating documentation index:', error)
    }
  }

  async updateRelatedDocs(filePath: string) {
    // Update related documentation based on file changes
    if (filePath.includes('src/app/api')) {
      await this.updateApiDocumentation()
    } else if (filePath.includes('supabase/migrations')) {
      await this.updateDatabaseDocumentation()
    } else if (filePath.includes('src/types')) {
      await this.updateTypesDocumentation()
    }
  }

  async updateApiDocumentation() {
    console.log('🔄 Updating API documentation...')
    // Implementation would go here
  }

  async updateDatabaseDocumentation() {
    console.log('🗄️ Updating database documentation...')
    // Implementation would go here
  }

  async updateTypesDocumentation() {
    console.log('📝 Updating types documentation...')
    // Implementation would go here
  }

  async logResults() {
    const logDir = 'logs'
    const logFile = path.join(logDir, 'monitoring.log')
    
    try {
      await fs.mkdir(logDir, { recursive: true })
      
      const timestamp = new Date().toISOString()
      const logEntry = `[${timestamp}] Check completed. Link issues: ${this.linkIssues.length}\n`
      
      await fs.appendFile(logFile, logEntry)
    } catch (error) {
      console.error('❌ Error writing log:', error)
    }
  }

  async stop() {
    console.log('🛑 Stopping Enhanced Monitoring System...')
    this.isRunning = false
    console.log('✅ Monitoring system stopped')
  }
}

// CLI interface
async function main() {
  const monitor = new EnhancedMonitor()
  
  const command = process.argv[2]
  
  switch (command) {
    case 'start':
      await monitor.start()
      break
    case 'check':
      await monitor.performFullCheck()
      break
    case 'fix':
      await monitor.checkAllMarkdownLinks()
      await monitor.fixLinkIssues()
      break
    case 'stop':
      await monitor.stop()
      break
    default:
      console.log(`
Enhanced Monitoring System

Usage:
  npm run monitor:start    - Start background monitoring
  npm run monitor:check    - Perform one-time check
  npm run monitor:fix      - Fix detected issues
  npm run monitor:stop     - Stop background monitoring

Features:
  - Continuous markdown link validation
  - Script file reference updates
  - Path mapping maintenance
  - Documentation consistency checks
  - Automatic issue fixing
      `)
  }
}

if (require.main === module) {
  main().catch(console.error)
}

export default EnhancedMonitor