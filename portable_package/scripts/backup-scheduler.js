const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const cron = require('node-cron');

class BackupScheduler {
  constructor() {
    this.backupDir = path.join(__dirname, '../backups');
    this.dbPath = path.join(__dirname, '../database/erp.db');
    this.maxBackups = 10;
    
    // 백업 디렉토리 생성
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  // 백업 파일명 생성
  generateBackupFileName() {
    const now = new Date();
    const dateStr = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    return `backup_${dateStr}.db`;
  }

  // 데이터베이스 백업 실행
  async createBackup() {
    try {
      const backupFileName = this.generateBackupFileName();
      const backupPath = path.join(this.backupDir, backupFileName);
      
      // SQLite 데이터베이스 복사
      fs.copyFileSync(this.dbPath, backupPath);
      
      console.log(`✅ 백업 생성 완료: ${backupFileName}`);
      
      // 백업 파일 개수 관리
      await this.cleanupOldBackups();
      
      return {
        success: true,
        fileName: backupFileName,
        filePath: backupPath,
        timestamp: new Date()
      };
      
    } catch (error) {
      console.error('❌ 백업 생성 실패:', error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date()
      };
    }
  }

  // 오래된 백업 파일 정리
  async cleanupOldBackups() {
    try {
      const files = fs.readdirSync(this.backupDir)
        .filter(file => file.startsWith('backup_') && file.endsWith('.db'))
        .map(file => ({
          name: file,
          path: path.join(this.backupDir, file),
          mtime: fs.statSync(path.join(this.backupDir, file)).mtime
        }))
        .sort((a, b) => b.mtime - a.mtime);

      // 최대 개수 초과 시 오래된 파일 삭제
      if (files.length > this.maxBackups) {
        const filesToDelete = files.slice(this.maxBackups);
        
        for (const file of filesToDelete) {
          fs.unlinkSync(file.path);
          console.log(`🗑️ 오래된 백업 파일 삭제: ${file.name}`);
        }
      }
      
    } catch (error) {
      console.error('❌ 백업 파일 정리 실패:', error);
    }
  }

  // 백업 파일 목록 조회
  getBackupList() {
    try {
      const files = fs.readdirSync(this.backupDir)
        .filter(file => file.startsWith('backup_') && file.endsWith('.db'))
        .map(file => {
          const filePath = path.join(this.backupDir, file);
          const stats = fs.statSync(filePath);
          
          return {
            fileName: file,
            filePath: filePath,
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime
          };
        })
        .sort((a, b) => b.created - a.created);

      return files;
      
    } catch (error) {
      console.error('❌ 백업 목록 조회 실패:', error);
      return [];
    }
  }

  // 백업에서 복구
  async restoreFromBackup(backupFileName) {
    try {
      const backupPath = path.join(this.backupDir, backupFileName);
      
      if (!fs.existsSync(backupPath)) {
        throw new Error('백업 파일을 찾을 수 없습니다');
      }

      // 현재 DB를 백업으로 교체하기 전에 임시 백업 생성
      const tempBackup = path.join(this.backupDir, `temp_${Date.now()}.db`);
      fs.copyFileSync(this.dbPath, tempBackup);
      
      try {
        // 백업 파일로 현재 DB 교체
        fs.copyFileSync(backupPath, this.dbPath);
        
        // 임시 백업 삭제
        fs.unlinkSync(tempBackup);
        
        console.log(`✅ 데이터베이스 복구 완료: ${backupFileName}`);
        
        return {
          success: true,
          restoredFrom: backupFileName,
          timestamp: new Date()
        };
        
      } catch (restoreError) {
        // 복구 실패 시 원본 복원
        fs.copyFileSync(tempBackup, this.dbPath);
        fs.unlinkSync(tempBackup);
        throw restoreError;
      }
      
    } catch (error) {
      console.error('❌ 데이터베이스 복구 실패:', error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date()
      };
    }
  }

  // 자동 백업 스케줄 시작
  startScheduler(scheduleType = 'daily') {
    // 기존 스케줄 정리
    if (this.dailyTask) this.dailyTask.destroy();
    if (this.weeklyTask) this.weeklyTask.destroy();
    
    if (scheduleType === 'daily') {
      // 매일 오전 2시에 백업
      this.dailyTask = cron.schedule('0 2 * * *', async () => {
        console.log('🕐 일일 자동 백업 시작...');
        await this.createBackup();
      });
      
      console.log('⏰ 일일 자동 백업 스케줄 시작 (매일 02:00)');
      
    } else if (scheduleType === 'weekly') {
      // 매주 일요일 오전 3시에 백업
      this.weeklyTask = cron.schedule('0 3 * * 0', async () => {
        console.log('🕐 주간 자동 백업 시작...');
        await this.createBackup();
      });
      
      console.log('⏰ 주간 자동 백업 스케줄 시작 (매주 일요일 03:00)');
    }
  }

  // 스케줄 중지
  stopScheduler() {
    if (this.dailyTask) {
      this.dailyTask.destroy();
      this.dailyTask = null;
    }
    
    if (this.weeklyTask) {
      this.weeklyTask.destroy();
      this.weeklyTask = null;
    }
    
    console.log('⏸️ 자동 백업 스케줄 중지');
  }
}

module.exports = BackupScheduler;