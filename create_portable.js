const fs = require('fs');
const path = require('path');
const https = require('https');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Node.js 다운로드 URL (Windows x64)
const NODE_URL = 'https://nodejs.org/dist/v22.17.0/node-v22.17.0-win-x64.zip';
const OUTPUT_DIR = './portable_package';

console.log('🏃‍♂️ JS Electronics ERP 포터블 버전 생성기');

function copyFiles(source, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const items = fs.readdirSync(source);
  
  for (const item of items) {
    const sourcePath = path.join(source, item);
    const destPath = path.join(dest, item);
    
    if (fs.statSync(sourcePath).isDirectory()) {
      copyFiles(sourcePath, destPath);
    } else {
      fs.copyFileSync(sourcePath, destPath);
    }
  }
}

async function downloadNodeJS() {
  console.log('📥 Node.js 다운로드 중...');
  
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(path.join(OUTPUT_DIR, 'node.zip'));
    https.get(NODE_URL, response => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log('✅ Node.js 다운로드 완료');
        resolve();
      });
    }).on('error', reject);
  });
}

async function extractNodeJS() {
  console.log('📂 Node.js 압축 해제 중...');
  
  try {
    // macOS/Linux에서는 unzip 사용
    await execAsync(`unzip -q "${path.join(OUTPUT_DIR, 'node.zip')}" -d "${OUTPUT_DIR}"`);
    
    // 압축 해제된 폴더명 변경
    const extractedFolder = fs.readdirSync(OUTPUT_DIR).find(item => 
      item.startsWith('node-v22.17.0-win-x64') && fs.statSync(path.join(OUTPUT_DIR, item)).isDirectory()
    );
    
    if (extractedFolder) {
      fs.renameSync(path.join(OUTPUT_DIR, extractedFolder), path.join(OUTPUT_DIR, 'node'));
      console.log('✅ Node.js 압축 해제 완료');
    }
    
    // zip 파일 삭제
    fs.unlinkSync(path.join(OUTPUT_DIR, 'node.zip'));
    
  } catch (error) {
    console.error('❌ Node.js 압축 해제 실패:', error.message);
    throw error;
  }
}

async function createPortablePackage() {
  try {
    // 출력 디렉토리 생성
    if (fs.existsSync(OUTPUT_DIR)) {
      fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    console.log('📦 포터블 패키지 생성 중...');

    // 1. Node.js 다운로드 및 압축 해제
    await downloadNodeJS();
    await extractNodeJS();

    // 2. 필수 파일들 복사
    const filesToCopy = [
      'server.js',
      'database.js', 
      'package.json',
      'package-lock.json'
    ];

    console.log('📁 필수 파일 복사 중...');
    for (const file of filesToCopy) {
      if (fs.existsSync(file)) {
        fs.copyFileSync(file, path.join(OUTPUT_DIR, file));
        console.log(`  ✓ ${file}`);
      }
    }

    // 3. 디렉토리 복사
    const dirsToCopy = ['client/build', 'database', 'scripts', 'assets', 'backups'];
    
    for (const dir of dirsToCopy) {
      if (fs.existsSync(dir)) {
        const destDir = path.join(OUTPUT_DIR, dir);
        copyFiles(dir, destDir);
        console.log(`  ✓ ${dir}/`);
      }
    }

    // 4. node_modules 필수 종속성만 복사
    console.log('📦 Node.js 종속성 설치 중...');
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const portablePackageJson = {
      name: packageJson.name,
      version: packageJson.version,
      main: packageJson.main,
      scripts: {
        start: "node server.js"
      },
      dependencies: packageJson.dependencies
    };
    
    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'package.json'),
      JSON.stringify(portablePackageJson, null, 2)
    );

    // 5. 포터블 실행 스크립트 생성
    const runScript = `@echo off
chcp 65001 > nul
title JS Electronics ERP - Portable v1.0
color 0A

echo ====================================
echo  JS Electronics ERP Portable v1.0
echo ====================================
echo.
echo [INFO] 포터블 ERP 시스템 시작 중...
echo [INFO] Node.js 런타임 확인 중...

if not exist "node\\node.exe" (
    echo [ERROR] Node.js 런타임이 없습니다!
    echo [ERROR] 포터블 패키지가 손상되었습니다.
    pause
    exit /b 1
)

if not exist "server.js" (
    echo [ERROR] 서버 파일이 없습니다!
    echo [ERROR] 포터블 패키지가 손상되었습니다.
    pause
    exit /b 1
)

echo [INFO] 종속성 설치 중...
node\\node.exe node\\npm.cmd install --omit=dev --silent

echo.
echo [SUCCESS] ERP 서버 시작 완료!
echo [INFO] 브라우저에서 http://localhost:3001 접속하세요
echo [INFO] 종료하려면 Ctrl+C 누르세요
echo.

node\\node.exe server.js

echo.
echo [INFO] ERP 서버가 종료되었습니다.
pause`;

    fs.writeFileSync(path.join(OUTPUT_DIR, 'RUN_ERP.bat'), runScript);

    // 6. 설치 안내 파일 생성
    const readmeContent = `# JS Electronics ERP - 포터블 버전

## 🚀 빠른 시작

1. RUN_ERP.bat 파일을 더블클릭하세요
2. 브라우저에서 http://localhost:3001 접속하세요
3. ERP 시스템을 사용하세요

## 📋 시스템 요구사항

- Windows 10/11
- 최소 2GB RAM
- 500MB 디스크 공간

## 🔧 문제 해결

### 포트 충돌 시
- 작업 관리자에서 node.exe 프로세스 종료
- 브라우저 재시작 후 다시 접속

### 보안 경고 시
- Windows Defender "자세히" 클릭
- "실행" 버튼 클릭하여 허용

## 📞 지원

문제 발생 시 개발팀에 연락하세요.

---
JS Electronics ERP v1.0 - Portable Edition
`;

    fs.writeFileSync(path.join(OUTPUT_DIR, 'README.txt'), readmeContent);

    console.log('✅ 포터블 패키지 구성 완료!');
    console.log(`📁 출력 위치: ${path.resolve(OUTPUT_DIR)}`);
    console.log('');
    console.log('🎯 사용법:');
    console.log('  1. portable_package 폴더를 원하는 위치에 복사');
    console.log('  2. RUN_ERP.bat 더블클릭하여 실행');
    console.log('  3. http://localhost:3001 접속');

    return true;

  } catch (error) {
    console.error('❌ 포터블 패키지 생성 실패:', error.message);
    throw error;
  }
}

// 실행
if (require.main === module) {
  createPortablePackage()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('❌ 실행 중 오류:', error.message);
      process.exit(1);
    });
}

module.exports = { createPortablePackage };