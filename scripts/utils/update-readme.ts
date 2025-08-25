import fs from 'fs';
import { logger } from './utils/logger';

class ReadmeUpdater {
  update() {
    try {
      const readmePath = './README.md';
      
      if (!fs.existsSync(readmePath)) {
        logger.warn('README.md not found, skipping update');
        return;
      }

      const currentReadme = fs.readFileSync(readmePath, 'utf-8');
      const updatedReadme = this.updateReadmeContent(currentReadme);
      
      fs.writeFileSync(readmePath, updatedReadme);
      logger.info('✅ README updated successfully');
    } catch (error) {
      logger.error(`❌ Error updating README: ${error}`);
    }
  }

  private updateReadmeContent(readme: string): string {
    const updatedDate = new Date().toISOString().split('T')[0];
    
    // Update or add last updated date
    if (readme.includes('Last updated:')) {
      return readme.replace(
        /Last updated: .*/,
        `Last updated: ${updatedDate}`
      );
    } else {
      // Add last updated date after the title
      return readme.replace(
        /^(# .*?\n)/,
        `$1\n> Last updated: ${updatedDate}\n\n`
      );
    }
  }
}

// Run the updater
const updater = new ReadmeUpdater();
updater.update();
