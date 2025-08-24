# Enhanced Monitoring System

A comprehensive background monitoring system that continuously checks and fixes markdown link problems, keeps script files updated, and maintains proper mappings and paths.

## Features

### 🔗 Markdown Link Management
- **Automatic Link Validation**: Checks all markdown files for broken internal links
- **Smart Link Fixing**: Automatically suggests and applies fixes for broken links
- **External Link Monitoring**: Optional validation of external links
- **Anchor Link Support**: Validates anchor links within documents

### 📜 Script File Management
- **Package.json Updates**: Automatically adds missing monitoring scripts
- **Import Validation**: Checks for broken TypeScript/JavaScript imports
- **Path Consistency**: Ensures all script references are up to date

### 🗂️ File Mapping Maintenance
- **Source-Target Mapping**: Maintains relationships between source files and documentation
- **Automatic Updates**: Updates documentation when source files change
- **Reference Tracking**: Keeps track of file dependencies and relationships

### 📊 Continuous Monitoring
- **File System Watching**: Real-time monitoring of file changes
- **Periodic Checks**: Regular system-wide validation every 30 seconds
- **Background Operation**: Runs continuously without blocking development

## Quick Start

### 1. Start the Monitoring System

```bash
# Start in background (recommended)
./scripts/background-monitor.sh start

# Or use npm script
npm run monitor:start
```

### 2. Check Status

```bash
# Check if monitor is running
./scripts/background-monitor.sh status

# Or use npm script
npm run monitor:check
```

### 3. View Logs

```bash
# View recent logs
./scripts/background-monitor.sh logs
```

### 4. Stop the Monitor

```bash
# Stop the background monitor
./scripts/background-monitor.sh stop
```

## Available Commands

### Background Monitor Script (`./scripts/background-monitor.sh`)

| Command | Description |
|---------|-------------|
| `start` | Start the monitoring system in background |
| `stop` | Stop the monitoring system |
| `restart` | Restart the monitoring system |
| `status` | Check if monitor is running |
| `logs` | Show recent monitor logs |
| `check` | Run a one-time system check |
| `fix` | Fix detected issues |

### NPM Scripts

| Script | Description |
|--------|-------------|
| `npm run monitor:start` | Start background monitoring |
| `npm run monitor:check` | Perform one-time check |
| `npm run monitor:fix` | Fix detected issues |
| `npm run monitor:stop` | Stop background monitoring |

## Configuration

The monitoring system is configured via `scripts/monitor-config.json`:

### Key Configuration Options

```json
{
  "monitoring": {
    "enabled": true,
    "checkInterval": 30000,  // 30 seconds
    "autoFix": true,
    "backupBeforeFix": true
  },
  "linkValidation": {
    "checkExternalLinks": false,
    "checkInternalLinks": true,
    "autoFixBrokenLinks": true
  },
  "fileMappings": [
    {
      "source": "src/types/index.ts",
      "target": "docs/architecture/TYPES_REFERENCE.md",
      "autoUpdate": true
    }
  ]
}
```

### File Mappings

The system maintains mappings between source files and their corresponding documentation:

- **Source Files**: TypeScript types, API routes, database migrations
- **Target Files**: Documentation files that should be updated when sources change
- **Auto-Update**: Automatically updates documentation when source files change

## System Service Installation (Linux)

### 1. Install as System Service

```bash
# Copy service file to systemd directory
sudo cp scripts/property-manager-monitor.service /etc/systemd/system/

# Reload systemd
sudo systemctl daemon-reload

# Enable and start the service
sudo systemctl enable property-manager-monitor
sudo systemctl start property-manager-monitor
```

### 2. Service Management

```bash
# Check service status
sudo systemctl status property-manager-monitor

# View service logs
sudo journalctl -u property-manager-monitor -f

# Stop the service
sudo systemctl stop property-manager-monitor

# Restart the service
sudo systemctl restart property-manager-monitor
```

## What Gets Monitored

### 📁 Directories Watched
- `src/` - Source code files
- `docs/` - Documentation files
- `scripts/` - Script files
- `supabase/` - Database and configuration files

### 📄 File Types Monitored
- **Markdown**: `.md` files for link validation
- **TypeScript**: `.ts`, `.tsx` files for import validation
- **JavaScript**: `.js`, `.jsx` files
- **JSON**: Configuration files
- **SQL**: Database migration files

### 🔍 Automatic Checks

#### Every 30 Seconds:
1. **Markdown Link Validation**: Check all internal links in markdown files
2. **File Mapping Validation**: Ensure source-target file relationships are maintained
3. **Script Reference Updates**: Update package.json scripts if needed
4. **Import Validation**: Check for broken TypeScript/JavaScript imports
5. **Documentation Index Update**: Update timestamps in documentation index

#### On File Changes:
1. **Immediate Link Check**: Validate links in changed markdown files
2. **Related Doc Updates**: Update related documentation files
3. **Mapping Validation**: Check file mapping integrity

## Logging

### Log Files
- **Main Log**: `logs/monitoring.log` - Detailed monitoring activities
- **Background Log**: `logs/background-monitor.log` - Background service logs
- **Backups**: `logs/backups/` - Backup files before fixes

### Log Levels
- **ERROR**: Critical issues that need immediate attention
- **WARN**: Issues that should be reviewed
- **INFO**: General monitoring activities
- **DEBUG**: Detailed debugging information

## Troubleshooting

### Common Issues

#### Monitor Won't Start
```bash
# Check if Node.js and tsx are installed
node --version
npx tsx --version

# Check file permissions
ls -la scripts/enhanced-monitoring-system.ts
chmod +x scripts/enhanced-monitoring-system.ts
```

#### Monitor Stops Unexpectedly
```bash
# Check logs for errors
./scripts/background-monitor.sh logs

# Restart the monitor
./scripts/background-monitor.sh restart
```

#### Links Not Being Fixed
```bash
# Check configuration
cat scripts/monitor-config.json

# Run manual fix
npm run monitor:fix
```

### Performance Issues

If the monitor is consuming too much resources:

1. **Increase Check Interval**: Modify `checkInterval` in config
2. **Reduce File Types**: Remove unnecessary file types from monitoring
3. **Limit Directory Scope**: Reduce watched directories

## Integration with Development Workflow

### Pre-commit Hooks
Add to your pre-commit hooks to ensure links are valid:

```bash
#!/bin/bash
# .git/hooks/pre-commit
npm run monitor:check
```

### CI/CD Integration
Add monitoring checks to your CI pipeline:

```yaml
# .github/workflows/monitor.yml
- name: Run Monitoring Checks
  run: npm run monitor:check
```

## Advanced Usage

### Custom File Mappings
Add your own file mappings to `monitor-config.json`:

```json
{
  "fileMappings": [
    {
      "source": "your/source/file.ts",
      "target": "your/docs/file.md",
      "type": "reference",
      "autoUpdate": true
    }
  ]
}
```

### Custom Documentation Rules
Define custom rules for automatic documentation updates:

```json
{
  "documentationRules": [
    {
      "pattern": "src/your-pattern/**/*.ts",
      "targetDocs": ["docs/your-doc.md"],
      "updateOnChange": true
    }
  ]
}
```

## Support

For issues or questions:
1. Check the logs: `./scripts/background-monitor.sh logs`
2. Review configuration: `scripts/monitor-config.json`
3. Run manual checks: `npm run monitor:check`

The monitoring system is designed to be self-healing and will automatically fix most common issues. If problems persist, the logs will contain detailed information about what went wrong.