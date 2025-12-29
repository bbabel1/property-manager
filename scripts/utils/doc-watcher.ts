import { watch } from 'fs';
import { spawn } from 'child_process';
import { logger } from './logger';

class DocumentationWatcher {
  private isRunning = false;
  private debounceTimer: NodeJS.Timeout | null = null;
  private changeCount = 0;

  start() {
    logger.info('🚀 Starting documentation watcher...');
    
    // Watch source directories
    const watchPaths = [
      './src',
      './supabase',
      './migrations'
    ];

    watchPaths.forEach(dir => {
      try {
        watch(dir, { recursive: true }, (eventType, filename) => {
          if (filename && !this.shouldIgnore(filename)) {
            this.changeCount++;
            logger.info(`📝 Detected change: ${eventType} in ${filename}`);
            this.debouncedUpdateDocs();
          }
        });
        logger.info(`�� Watching directory: ${dir}`);
      } catch (error) {
        logger.error(`❌ Error watching directory ${dir}: ${error}`);
      }
    });

    // Initial documentation generation
    this.updateDocumentation();
  }

  private shouldIgnore(filename: string): boolean {
    const ignorePatterns = [
      /\.(log|tmp|temp|tsbuildinfo)$/,
      /node_modules/,
      /\.next/,
      /\.git/,
      /\.DS_Store/,
      /package-lock\.json/,
      /yarn\.lock/,
      /pnpm-lock\.yaml/,
      /\.env/,
      /\.env\.local/,
      /\.env\.example/,
      /dist/,
      /build/,
      /coverage/,
      /\.swp$/,
      /\.swo$/,
      /Thumbs\.db/
    ];
    return ignorePatterns.some(pattern => pattern.test(filename));
  }

  private debouncedUpdateDocs() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    
    this.debounceTimer = setTimeout(() => {
      this.updateDocumentation();
    }, 3000); // Wait 3 seconds after last change
  }

  private async updateDocumentation() {
    if (this.isRunning) {
      logger.info('⏳ Documentation update already in progress, skipping...');
      return;
    }
    
    this.isRunning = true;
    logger.info(`📝 Updating documentation (change #${this.changeCount})...`);

    try {
      // Run documentation generation scripts
      await this.runScript('generate-api-docs');
      await this.runScript('generate-db-docs');
      await this.runScript('update-readme');
      await this.runScript('generate-component-docs');
      
      logger.info('✅ Documentation updated successfully');
    } catch (error) {
      logger.error(`❌ Error updating documentation: ${error}`);
    } finally {
      this.isRunning = false;
    }
  }

  private runScript(scriptName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      logger.info(`�� Running script: ${scriptName}`);
      
      const child = spawn('npm', ['run', scriptName], {
        stdio: 'inherit',
        shell: true,
        cwd: process.cwd()
      });

      child.on('close', (code) => {
        if (code === 0) {
          logger.info(`✅ Script ${scriptName} completed successfully`);
          resolve();
        } else {
          logger.error(`❌ Script ${scriptName} failed with code ${code}`);
          reject(new Error(`Script ${scriptName} failed with code ${code}`));
        }
      });

      child.on('error', (error) => {
        logger.error(`❌ Error running script ${scriptName}: ${error}`);
        reject(error);
      });
    });
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.info('🛑 Shutting down documentation watcher...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('🛑 Shutting down documentation watcher...');
  process.exit(0);
});

// Start the watcher
const watcher = new DocumentationWatcher();
watcher.start();
