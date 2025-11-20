// src/publisher/LocalServerPublisher.ts

import { Notice } from 'obsidian';
import * as fs from 'fs';
import * as path from 'path';

export interface LocalServerPublishResult {
    success: boolean;
    filesPublished: number;
    errors?: string[];
}

export class LocalServerPublisher {
    private serverPath: string;
    private notesPath: string;
    private assetsPath: string;

    constructor(serverPath: string, notesPath: string, assetsPath: string) {
        this.serverPath = serverPath;
        this.notesPath = path.join(serverPath, notesPath);
        this.assetsPath = path.join(serverPath, assetsPath);
    }

    /**
     * 경로가 유효한지 확인
     */
    async validatePaths(): Promise<boolean> {
        try {
            if (!fs.existsSync(this.serverPath)) {
                new Notice(`❌ 서버 경로에 접근할 수 없습니다: ${this.serverPath}`);
                return false;
            }
            
            // 노트 경로 생성 (없으면)
            if (!fs.existsSync(this.notesPath)) {
                fs.mkdirSync(this.notesPath, { recursive: true });
            }
            
            // 에셋 경로 생성 (없으면)
            if (!fs.existsSync(this.assetsPath)) {
                fs.mkdirSync(this.assetsPath, { recursive: true });
            }
            
            return true;
        } catch (error) {
            console.error('Path validation error:', error);
            new Notice(`❌ 경로 검증 실패: ${error.message}`);
            return false;
        }
    }

    /**
     * 파일을 로컬 서버로 복사
     */
    async publishFile(sourcePath: string, targetRelativePath: string, isAsset: boolean = false): Promise<boolean> {
        try {
            const targetDir = isAsset ? this.assetsPath : this.notesPath;
            const targetPath = path.join(targetDir, targetRelativePath);
            
            // 대상 디렉토리 생성
            const targetDirPath = path.dirname(targetPath);
            if (!fs.existsSync(targetDirPath)) {
                fs.mkdirSync(targetDirPath, { recursive: true });
            }
            
            // 파일 복사
            fs.copyFileSync(sourcePath, targetPath);
            console.log(`Published to local server: ${targetPath}`);
            
            return true;
        } catch (error) {
            console.error('File publish error:', error);
            new Notice(`❌ 파일 복사 실패: ${targetRelativePath}`);
            return false;
        }
    }

    /**
     * 여러 파일을 한 번에 발행
     */
    async publishFiles(files: { source: string; target: string; isAsset?: boolean }[]): Promise<LocalServerPublishResult> {
        const errors: string[] = [];
        let filesPublished = 0;

        // 경로 검증
        const isValid = await this.validatePaths();
        if (!isValid) {
            return {
                success: false,
                filesPublished: 0,
                errors: ['서버 경로 접근 불가']
            };
        }

        // 파일 복사
        for (const file of files) {
            const success = await this.publishFile(file.source, file.target, file.isAsset || false);
            if (success) {
                filesPublished++;
            } else {
                errors.push(file.target);
            }
        }

        return {
            success: errors.length === 0,
            filesPublished,
            errors: errors.length > 0 ? errors : undefined
        };
    }

    /**
     * 단일 파일 삭제
     */
    async deleteFile(relativePath: string, isAsset: boolean = false): Promise<boolean> {
        try {
            const targetDir = isAsset ? this.assetsPath : this.notesPath;
            const targetPath = path.join(targetDir, relativePath);
            
            if (fs.existsSync(targetPath)) {
                fs.unlinkSync(targetPath);
                console.log(`Deleted from local server: ${targetPath}`);
                return true;
            }
            
            return true; // 파일이 없으면 성공으로 처리
        } catch (error) {
            console.error('File delete error:', error);
            return false;
        }
    }

    /**
     * 여러 파일 삭제
     */
    async deleteFiles(files: { path: string; isAsset?: boolean }[]): Promise<LocalServerPublishResult> {
        const errors: string[] = [];
        let filesDeleted = 0;

        // 경로 검증
        const isValid = await this.validatePaths();
        if (!isValid) {
            return {
                success: false,
                filesPublished: 0,
                errors: ['서버 경로 접근 불가']
            };
        }

        // 파일 삭제
        for (const file of files) {
            const success = await this.deleteFile(file.path, file.isAsset || false);
            if (success) {
                filesDeleted++;
            } else {
                errors.push(file.path);
            }
        }

        return {
            success: errors.length === 0,
            filesPublished: filesDeleted,
            errors: errors.length > 0 ? errors : undefined
        };
    }
}
