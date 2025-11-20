// src/publisher/GitHubPublisher.ts

import { Notice, TFile, TFolder } from 'obsidian';
import { Octokit } from '@octokit/rest';
import BlogSyncPlugin from '../../main';

export interface GitHubSettings {
    githubToken: string;
    githubUsername: string;
    githubRepo: string;
    githubBranch: string;
    publicBasePath: string;  // 예: 'src/site'
    blogContentPath: string; // 예: 'notes'
    blogAssetsPath: string;  // 예: 'img/user'
}

interface FileBlob {
    path: string;
    mode: '100644';
    type: 'blob';
    sha: string;
}

export class GitHubPublisher {
    private octokit: Octokit;
    private settings: GitHubSettings;
    private plugin: BlogSyncPlugin;

    constructor(plugin: BlogSyncPlugin, settings: GitHubSettings) {
        this.plugin = plugin;
        this.settings = settings;
        this.octokit = new Octokit({
            auth: settings.githubToken
        });
    }

    /**
     * 경로 정규화 (슬래시 제거)
     */
    private normalizePath(path: string): string {
        let normalized = path.trim();
        if (normalized.startsWith('/')) {
            normalized = normalized.slice(1);
        }
        if (normalized.endsWith('/')) {
            normalized = normalized.slice(0, -1);
        }
        return normalized;
    }

    /**
     * 전체 경로 생성 (publicBasePath + relativePath)
     */
    private getFullPath(...parts: string[]): string {
        const filtered = parts.filter(p => p && p.trim());
        const joined = filtered.map(p => this.normalizePath(p)).join('/');
        return joined;
    }

    /**
     * Obsidian 볼트 내 파일의 상대 경로를 유지하면서 GitHub 경로 생성
     * 예: src/site/notes/folder/note.md
     */
    private getFilePath(file: TFile): string {
        // 파일의 볼트 내 전체 경로 (예: "folder/subfolder/note.md")
        const vaultPath = file.path;
        
        // publicBasePath + blogContentPath + vaultPath
        return this.getFullPath(
            this.settings.publicBasePath,
            this.settings.blogContentPath,
            vaultPath
        );
    }

    /**
     * 이미지 파일 경로 생성
     * 예: src/site/img/user/첨부파일/image.png
     */
    private getAssetPath(assetPath: string): string {
        // publicBasePath + blogAssetsPath + assetPath
        return this.getFullPath(
            this.settings.publicBasePath,
            this.settings.blogAssetsPath,
            assetPath
        );
    }

    /**
     * 마크다운에서 이미지 링크 추출
     */
    private extractImageLinks(content: string): string[] {
        const images: string[] = [];
        
        // ![[image.png]] 형식
        const wikiLinkRegex = /!\[\[([^\]]+)\]\]/g;
        let match;
        while ((match = wikiLinkRegex.exec(content)) !== null) {
            images.push(match[1]);
        }
        
        // ![alt](image.png) 형식
        const markdownLinkRegex = /!\[([^\]]*)\]\(([^\)]+)\)/g;
        while ((match = markdownLinkRegex.exec(content)) !== null) {
            images.push(match[2]);
        }
        
        return images;
    }

    /**
     * 이미지 파일 찾기 및 blob 생성
     */
    private async processImages(file: TFile): Promise<FileBlob[]> {
        const content = await this.plugin.app.vault.read(file);
        const imageLinks = this.extractImageLinks(content);
        
        if (imageLinks.length === 0) {
            return [];
        }

        console.log(`Found ${imageLinks.length} images in ${file.basename}`);
        
        const imageBlobs: FileBlob[] = [];
        
        for (const imageName of imageLinks) {
            try {
                // 이미지 파일 찾기
                const imageFile = this.plugin.app.metadataCache.getFirstLinkpathDest(
                    imageName,
                    file.path
                );
                
                if (!imageFile) {
                    console.warn(`Image not found: ${imageName}`);
                    continue;
                }

                // 이미지가 실제 파일인지 확인
                if (!(imageFile instanceof TFile)) {
                    continue;
                }

                // 이미지 파일 읽기 (binary)
                const imageData = await this.plugin.app.vault.readBinary(imageFile);
                
                // Base64 인코딩
                const base64Data = this.arrayBufferToBase64(imageData);

                // Blob 생성
                const { data: blobData } = await this.octokit.rest.git.createBlob({
                    owner: this.settings.githubUsername,
                    repo: this.settings.githubRepo,
                    content: base64Data,
                    encoding: 'base64'
                });

                console.log(`Image blob created: ${imageFile.path}`);

                imageBlobs.push({
                    path: this.getAssetPath(imageFile.path),
                    mode: '100644',
                    type: 'blob',
                    sha: blobData.sha
                });
            } catch (error) {
                console.error(`Error processing image ${imageName}:`, error);
            }
        }
        
        return imageBlobs;
    }

    /**
     * ArrayBuffer를 Base64로 변환
     */
    private arrayBufferToBase64(buffer: ArrayBuffer): string {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    /**
     * 마크다운 내용에서 이미지 링크 변환
     * GitHub에 저장될 때는 /src/site/img/user/... 형태
     * Quartz 빌드 시 src/site가 루트가 되므로 img/user/...로 자동 변환됨
     */
    private transformImageLinks(content: string): string {
        // 전체 경로: publicBasePath + blogAssetsPath
        const fullAssetsPath = this.getFullPath(
            this.settings.publicBasePath,
            this.settings.blogAssetsPath
        );
        
        // ![[image.png]] 또는 ![[첨부파일/image.png]] → ![첨부파일/image.png](/src/site/img/user/첨부파일/image.png)
        content = content.replace(/!\[\[([^\]]+)\]\]/g, (match, imagePath) => {
            // URL 인코딩 (한글 등)
            const encodedPath = imagePath.split('/').map((part : string) => encodeURIComponent(part)).join('/');
            return `![${imagePath}](/${fullAssetsPath}/${encodedPath})`;
        });
        
        // ![alt](image.png) 또는 ![alt](첨부파일/image.png) → ![alt](/src/site/img/user/첨부파일/image.png)
        content = content.replace(/!\[([^\]]*)\]\(([^\)]+)\)/g, (match, alt, imagePath) => {
            // 이미 절대 경로거나 URL이면 그대로 둠
            if (imagePath.startsWith('http') || imagePath.startsWith('/')) {
                return match;
            }
            // URL 인코딩
            const encodedPath = imagePath.split('/').map((part : string) => encodeURIComponent(part)).join('/');
            return `![${alt}](/${fullAssetsPath}/${encodedPath})`;
        });
        
        return content;
    }

    /**
     * 단일 파일 발행 (이미지 포함) - Git Tree API 사용으로 1개 커밋
     */
    async publishFile(file: TFile): Promise<boolean> {
        try {
            console.log(`=== Publishing file: ${file.path} ===`);
            
            // 1. 최신 커밋 가져오기
            let latestCommitSha: string;
            let baseTreeSha: string | undefined;

            try {
                const { data: refData } = await this.octokit.rest.git.getRef({
                    owner: this.settings.githubUsername,
                    repo: this.settings.githubRepo,
                    ref: `heads/${this.settings.githubBranch}`
                });

                latestCommitSha = refData.object.sha;

                const { data: commitData } = await this.octokit.rest.git.getCommit({
                    owner: this.settings.githubUsername,
                    repo: this.settings.githubRepo,
                    commit_sha: latestCommitSha
                });

                baseTreeSha = commitData.tree.sha;
            } catch (error: any) {
                if (error.status === 404) {
                    console.log('Repository is empty, creating initial commit...');
                    return await this.createInitialCommit([file]);
                }
                throw error;
            }

            // 2. 노트 blob 생성
            const content = await this.plugin.app.vault.read(file);
            const transformedContent = this.transformImageLinks(content);
            const encodedContent = btoa(unescape(encodeURIComponent(transformedContent)));

            const { data: noteBlobData } = await this.octokit.rest.git.createBlob({
                owner: this.settings.githubUsername,
                repo: this.settings.githubRepo,
                content: encodedContent,
                encoding: 'base64'
            });

            const noteBlob: FileBlob = {
                path: this.getFilePath(file),
                mode: '100644',
                type: 'blob',
                sha: noteBlobData.sha
            };

            console.log(`✓ Note blob created: ${noteBlob.path}`);

            // 3. 이미지 blobs 생성
            const imageBlobs = await this.processImages(file);
            console.log(`✓ Created ${imageBlobs.length} image blobs`);

            // 4. 모든 blob 합치기
            const allBlobs = [noteBlob, ...imageBlobs];

            // 5. 새로운 트리 생성
            const { data: newTree } = await this.octokit.rest.git.createTree({
                owner: this.settings.githubUsername,
                repo: this.settings.githubRepo,
                base_tree: baseTreeSha,
                tree: allBlobs
            });

            console.log(`✓ Tree created with SHA: ${newTree.sha}`);

            // 6. 커밋 생성
            const commitMessage = imageBlobs.length > 0 
                ? `Publish: ${file.basename} (with ${imageBlobs.length} image(s))`
                : `Publish: ${file.basename}`;

            const { data: newCommit } = await this.octokit.rest.git.createCommit({
                owner: this.settings.githubUsername,
                repo: this.settings.githubRepo,
                message: commitMessage,
                tree: newTree.sha,
                parents: [latestCommitSha]
            });

            console.log(`✓ Commit created with SHA: ${newCommit.sha}`);

            // 7. 브랜치 업데이트 (강제)
            await this.octokit.rest.git.updateRef({
                owner: this.settings.githubUsername,
                repo: this.settings.githubRepo,
                ref: `heads/${this.settings.githubBranch}`,
                sha: newCommit.sha,
                force: true
            });

            console.log(`✓ Branch updated successfully`);

            const message = imageBlobs.length > 0 
                ? `✅ Published: ${file.basename} (${imageBlobs.length} images)`
                : `✅ Published: ${file.basename}`;
            
            new Notice(message);
            return true;
        } catch (error: any) {
            console.error('=== Publish failed ===');
            console.error('Error:', error.message);
            console.error('Status:', error.status);
            console.error('Response:', error.response?.data);
            
            new Notice(`❌ Failed to publish: ${file.basename}`);
            return false;
        }
    }

    /**
     * 여러 파일 배치 발행 (노트 + 이미지)
     */
    async publishFiles(files: TFile[]): Promise<boolean> {
        try {
            console.log(`Publishing ${files.length} files...`);
            new Notice(`Publishing ${files.length} files...`);

            let latestCommitSha: string;
            let baseTreeSha: string | undefined;

            try {
                const { data: refData } = await this.octokit.rest.git.getRef({
                    owner: this.settings.githubUsername,
                    repo: this.settings.githubRepo,
                    ref: `heads/${this.settings.githubBranch}`
                });

                latestCommitSha = refData.object.sha;

                const { data: commitData } = await this.octokit.rest.git.getCommit({
                    owner: this.settings.githubUsername,
                    repo: this.settings.githubRepo,
                    commit_sha: latestCommitSha
                });

                baseTreeSha = commitData.tree.sha;
            } catch (error: any) {
                if (error.status === 404) {
                    console.log('Repository is empty, creating initial commit...');
                    return await this.createInitialCommit(files);
                }
                throw error;
            }

            // 노트 파일 blob 생성
            const noteBlobs: FileBlob[] = [];
            const allImageBlobs: FileBlob[] = [];

            for (const file of files) {
                try {
                    // 노트 내용 처리
                    const content = await this.plugin.app.vault.read(file);
                    const transformedContent = this.transformImageLinks(content);
                    const encodedContent = btoa(unescape(encodeURIComponent(transformedContent)));

                    const { data: blobData } = await this.octokit.rest.git.createBlob({
                        owner: this.settings.githubUsername,
                        repo: this.settings.githubRepo,
                        content: encodedContent,
                        encoding: 'base64'
                    });

                    noteBlobs.push({
                        path: this.getFilePath(file),
                        mode: '100644',
                        type: 'blob',
                        sha: blobData.sha
                    });

                    // 이미지 처리
                    const imageBlobs = await this.processImages(file);
                    allImageBlobs.push(...imageBlobs);

                } catch (error) {
                    console.error(`Error processing file ${file.basename}:`, error);
                    throw error;
                }
            }

            // 중복 이미지 제거 (같은 경로)
            const uniqueImageBlobs = Array.from(
                new Map(allImageBlobs.map(blob => [blob.path, blob])).values()
            );

            console.log(`Created ${noteBlobs.length} note blobs and ${uniqueImageBlobs.length} image blobs`);

            // 모든 blob 합치기
            const allBlobs = [...noteBlobs, ...uniqueImageBlobs];

            // 새로운 트리 생성
            const { data: newTree } = await this.octokit.rest.git.createTree({
                owner: this.settings.githubUsername,
                repo: this.settings.githubRepo,
                base_tree: baseTreeSha,
                tree: allBlobs
            });

            // 커밋 생성
            const { data: newCommit } = await this.octokit.rest.git.createCommit({
                owner: this.settings.githubUsername,
                repo: this.settings.githubRepo,
                message: `Published ${files.length} notes and ${uniqueImageBlobs.length} images from Obsidian`,
                tree: newTree.sha,
                parents: [latestCommitSha]
            });

            // 브랜치 업데이트 (강제)
            await this.octokit.rest.git.updateRef({
                owner: this.settings.githubUsername,
                repo: this.settings.githubRepo,
                ref: `heads/${this.settings.githubBranch}`,
                sha: newCommit.sha,
                force: true
            });

            new Notice(`✅ Published ${files.length} notes and ${uniqueImageBlobs.length} images!`);
            return true;
        } catch (error: any) {
            console.error('Batch publish error:', error);
            
            let errorMessage = 'Failed to publish files';
            if (error.message) {
                errorMessage = `❌ ${error.message}`;
            }
            
            new Notice(errorMessage);
            return false;
        }
    }

    /**
     * 빈 저장소에 초기 커밋 생성
     */
    private async createInitialCommit(files: TFile[]): Promise<boolean> {
        try {
            console.log('Creating initial commit...');
            
            const noteBlobs: FileBlob[] = [];
            const allImageBlobs: FileBlob[] = [];

            for (const file of files) {
                const content = await this.plugin.app.vault.read(file);
                const transformedContent = this.transformImageLinks(content);
                const encodedContent = btoa(unescape(encodeURIComponent(transformedContent)));

                const { data: blobData } = await this.octokit.rest.git.createBlob({
                    owner: this.settings.githubUsername,
                    repo: this.settings.githubRepo,
                    content: encodedContent,
                    encoding: 'base64'
                });

                noteBlobs.push({
                    path: this.getFilePath(file),
                    mode: '100644',
                    type: 'blob',
                    sha: blobData.sha
                });

                const imageBlobs = await this.processImages(file);
                allImageBlobs.push(...imageBlobs);
            }

            const uniqueImageBlobs = Array.from(
                new Map(allImageBlobs.map(blob => [blob.path, blob])).values()
            );

            const allBlobs = [...noteBlobs, ...uniqueImageBlobs];

            const { data: newTree } = await this.octokit.rest.git.createTree({
                owner: this.settings.githubUsername,
                repo: this.settings.githubRepo,
                tree: allBlobs
            });

            const { data: newCommit } = await this.octokit.rest.git.createCommit({
                owner: this.settings.githubUsername,
                repo: this.settings.githubRepo,
                message: `Initial commit: ${files.length} notes and ${uniqueImageBlobs.length} images`,
                tree: newTree.sha,
                parents: []
            });

            try {
                await this.octokit.rest.git.createRef({
                    owner: this.settings.githubUsername,
                    repo: this.settings.githubRepo,
                    ref: `refs/heads/${this.settings.githubBranch}`,
                    sha: newCommit.sha
                });
            } catch (error: any) {
                if (error.status === 422) {
                    await this.octokit.rest.git.updateRef({
                        owner: this.settings.githubUsername,
                        repo: this.settings.githubRepo,
                        ref: `heads/${this.settings.githubBranch}`,
                        sha: newCommit.sha,
                        force: true
                    });
                } else {
                    throw error;
                }
            }

            new Notice(`✅ Initial commit: ${files.length} notes and ${uniqueImageBlobs.length} images!`);
            return true;
        } catch (error: any) {
            console.error('Initial commit error:', error);
            new Notice(`❌ Failed: ${error.message}`);
            return false;
        }
    }

    /**
     * 여러 파일 삭제 (배치)
     */
    async deleteFiles(files: TFile[]): Promise<boolean> {
        try {
            console.log(`=== Starting deletion of ${files.length} files ===`);
            
            const pathsToDelete = files.map(file => {
                const path = this.getFilePath(file);
                console.log(`Will delete: ${file.path} -> ${path}`);
                return path;
            });

            const { data: refData } = await this.octokit.rest.git.getRef({
                owner: this.settings.githubUsername,
                repo: this.settings.githubRepo,
                ref: `heads/${this.settings.githubBranch}`
            });

            const latestCommitSha = refData.object.sha;

            const { data: commitData } = await this.octokit.rest.git.getCommit({
                owner: this.settings.githubUsername,
                repo: this.settings.githubRepo,
                commit_sha: latestCommitSha
            });

            const baseTreeSha = commitData.tree.sha;

            const { data: currentTree } = await this.octokit.rest.git.getTree({
                owner: this.settings.githubUsername,
                repo: this.settings.githubRepo,
                tree_sha: baseTreeSha,
                recursive: '1'
            });

            const currentBlobs = currentTree.tree.filter(item => item.type === 'blob');
            
            const newTreeItems = currentBlobs
                .filter(item => !pathsToDelete.includes(item.path || ''))
                .map(item => ({
                    path: item.path!,
                    mode: '100644' as const,
                    type: 'blob' as const,
                    sha: item.sha!
                }));

            const { data: newTree } = await this.octokit.rest.git.createTree({
                owner: this.settings.githubUsername,
                repo: this.settings.githubRepo,
                tree: newTreeItems
            });

            const commitMessage = `Unpublish ${files.length} note(s) from Obsidian`;
            const { data: newCommit } = await this.octokit.rest.git.createCommit({
                owner: this.settings.githubUsername,
                repo: this.settings.githubRepo,
                message: commitMessage,
                tree: newTree.sha,
                parents: [latestCommitSha]
            });

            await this.octokit.rest.git.updateRef({
                owner: this.settings.githubUsername,
                repo: this.settings.githubRepo,
                ref: `heads/${this.settings.githubBranch}`,
                sha: newCommit.sha,
                force: true
            });

            new Notice(`✅ Unpublished ${files.length} notes`);
            return true;
        } catch (error: any) {
            console.error('Delete error:', error);
            new Notice(`❌ Delete failed: ${error.message}`);
            return false;
        }
    }

    /**
     * 단일 파일 삭제
     */
    async deleteFile(file: TFile): Promise<boolean> {
        return await this.deleteFiles([file]);
    }

    async testConnection(): Promise<boolean> {
        try {
            await this.octokit.rest.repos.get({
                owner: this.settings.githubUsername,
                repo: this.settings.githubRepo
            });
            new Notice('✅ GitHub connection successful!');
            return true;
        } catch (error) {
            new Notice('❌ GitHub connection failed');
            return false;
        }
    }
}