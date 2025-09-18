import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

class SnapshotCreator {
    constructor() {
        this.projectRoot = process.cwd();
        this.snapshotsDir = path.join(this.projectRoot, 'snapshots');
        this.timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    }

    ensureSnapshotsDir() {
        if (!fs.existsSync(this.snapshotsDir)) {
            fs.mkdirSync(this.snapshotsDir, { recursive: true });
            console.log('📁 Created snapshots directory');
        }
    }

    getProjectInfo() {
        const packageJsonPath = path.join(this.projectRoot, 'package.json');
        let packageInfo = {};
        
        if (fs.existsSync(packageJsonPath)) {
            packageInfo = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        }

        return {
            name: packageInfo.name || 'solstice-tokens',
            version: packageInfo.version || '1.0.0',
            description: packageInfo.description || 'Solstice Tokens Pipeline',
            timestamp: this.timestamp,
            gitCommit: this.getGitCommit(),
            gitBranch: this.getGitBranch()
        };
    }

    getGitCommit() {
        try {
            return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
        } catch (error) {
            return 'unknown';
        }
    }

    getGitBranch() {
        try {
            return execSync('git branch --show-current', { encoding: 'utf8' }).trim();
        } catch (error) {
            return 'unknown';
        }
    }

    getFileStats(filePath) {
        try {
            const stats = fs.statSync(filePath);
            return {
                size: stats.size,
                modified: stats.mtime.toISOString(),
                isDirectory: stats.isDirectory()
            };
        } catch (error) {
            return null;
        }
    }

    scanDirectory(dirPath, relativePath = '') {
        const items = [];
        
        try {
            const entries = fs.readdirSync(dirPath);
            
            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry);
                const relativeItemPath = path.join(relativePath, entry);
                const stats = this.getFileStats(fullPath);
                
                if (stats) {
                    const item = {
                        name: entry,
                        path: relativeItemPath,
                        ...stats
                    };
                    
                    if (stats.isDirectory) {
                        item.children = this.scanDirectory(fullPath, relativeItemPath);
                    }
                    
                    items.push(item);
                }
            }
        } catch (error) {
            console.warn(`⚠️ Could not scan directory ${dirPath}:`, error.message);
        }
        
        return items;
    }

    createManifest() {
        console.log('📋 Creating project manifest...');
        
        const manifest = {
            project: this.getProjectInfo(),
            structure: this.scanDirectory(this.projectRoot),
            summary: {
                totalFiles: 0,
                totalDirectories: 0,
                totalSize: 0
            }
        };

        // Calculate summary
        const calculateSummary = (items) => {
            items.forEach(item => {
                if (item.isDirectory) {
                    manifest.summary.totalDirectories++;
                    if (item.children) {
                        calculateSummary(item.children);
                    }
                } else {
                    manifest.summary.totalFiles++;
                    manifest.summary.totalSize += item.size || 0;
                }
            });
        };

        calculateSummary(manifest.structure);

        return manifest;
    }

    createArchive() {
        console.log('📦 Creating archive...');
        
        const archiveName = `solstice-tokens-snapshot-${this.timestamp}.tar.gz`;
        const archivePath = path.join(this.snapshotsDir, archiveName);
        
        try {
            // Create tar.gz archive excluding node_modules, .git, and snapshots
            const excludePatterns = [
                '--exclude=node_modules',
                '--exclude=.git',
                '--exclude=snapshots',
                '--exclude=.DS_Store',
                '--exclude=*.log'
            ];
            
            const tarCommand = `tar -czf "${archivePath}" ${excludePatterns.join(' ')} -C "${this.projectRoot}" .`;
            execSync(tarCommand, { stdio: 'pipe' });
            
            const archiveStats = this.getFileStats(archivePath);
            console.log(`✅ Archive created: ${archiveName} (${this.formatBytes(archiveStats.size)})`);
            
            return archivePath;
        } catch (error) {
            console.error('❌ Error creating archive:', error.message);
            return null;
        }
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    async createSnapshot() {
        console.log('🚀 Creating project snapshot...');
        console.log(`📅 Timestamp: ${this.timestamp}`);
        
        this.ensureSnapshotsDir();
        
        // Create manifest
        const manifest = this.createManifest();
        const manifestPath = path.join(this.snapshotsDir, `manifest-${this.timestamp}.json`);
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
        console.log(`✅ Manifest created: manifest-${this.timestamp}.json`);
        
        // Create archive
        const archivePath = this.createArchive();
        
        // Create summary
        const summary = {
            timestamp: this.timestamp,
            manifest: manifestPath,
            archive: archivePath,
            project: manifest.project,
            summary: manifest.summary
        };
        
        const summaryPath = path.join(this.snapshotsDir, `summary-${this.timestamp}.json`);
        fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
        
        console.log('\n🎉 Snapshot created successfully!');
        console.log(`📊 Project summary:`);
        console.log(`   Files: ${manifest.summary.totalFiles}`);
        console.log(`   Directories: ${manifest.summary.totalDirectories}`);
        console.log(`   Total size: ${this.formatBytes(manifest.summary.totalSize)}`);
        console.log(`   Git commit: ${manifest.project.gitCommit.slice(0, 8)}`);
        console.log(`   Git branch: ${manifest.project.gitBranch}`);
        
        return summary;
    }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
    const creator = new SnapshotCreator();
    creator.createSnapshot().catch(console.error);
}

export default SnapshotCreator;
