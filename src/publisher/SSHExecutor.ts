// src/publisher/SSHExecutor.ts

import { Notice } from 'obsidian';

export class SSHExecutor {
    private host: string;
    private port: number;
    private username: string;
    private password: string;

    constructor(host: string, port: number, username: string, password: string) {
        this.host = host;
        this.port = port;
        this.username = username;
        this.password = password;
    }

    async executeCommand(command: string): Promise<{ success: boolean; output?: string; error?: string }> {
        try {
            // Obsidian은 Node.js 환경이 아니므로 child_process를 사용할 수 없습니다
            // 대신 간단한 HTTP API를 통해 SSH 명령을 실행합니다
            
            // 방법 1: OMV에 간단한 webhook 서버 구축
            // 방법 2: Obsidian의 시스템 명령 실행 기능 사용
            
            // 여기서는 PowerShell을 통한 SSH 실행 (Windows)
            const sshCommand = `ssh -p ${this.port} ${this.username}@${this.host} "${command}"`;
            
            new Notice(`🔄 Docker 재시작 중...`);
            
            // Electron 환경에서 실행 (Obsidian은 Electron 기반)
            const { exec } = require('child_process');
            
            return new Promise((resolve) => {
                exec(sshCommand, { 
                    env: { 
                        ...process.env,
                        SSHPASS: this.password 
                    }
                }, (error: any, stdout: string, stderr: string) => {
                    if (error) {
                        console.error('SSH execution error:', error);
                        new Notice(`❌ Docker 재시작 실패: ${error.message}`);
                        resolve({ success: false, error: error.message });
                        return;
                    }
                    
                    if (stderr) {
                        console.warn('SSH stderr:', stderr);
                    }
                    
                    console.log('SSH output:', stdout);
                    new Notice(`✅ Docker 컨테이너 재시작 완료!`);
                    resolve({ success: true, output: stdout });
                });
            });
            
        } catch (error) {
            console.error('SSH execution error:', error);
            new Notice(`❌ SSH 실행 실패: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    async restartDocker(composeCommand: string): Promise<boolean> {
        const result = await this.executeCommand(composeCommand);
        return result.success;
    }
}
