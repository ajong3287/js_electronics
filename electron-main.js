const { app, BrowserWindow, Menu, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const { autoUpdater } = require('electron-updater');

let mainWindow;
let serverProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    icon: path.join(__dirname, 'assets/icon.png'),
    title: 'JS일렉트로닉 ERP 시스템'
  });

  // 메뉴바 설정
  const template = [
    {
      label: '파일',
      submenu: [
        {
          label: '엑셀 가져오기',
          accelerator: 'CmdOrCtrl+I',
          click: () => {
            mainWindow.webContents.send('import-excel');
          }
        },
        {
          type: 'separator'
        },
        {
          label: '종료',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: '편집',
      submenu: [
        { label: '실행 취소', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: '다시 실행', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo' },
        { type: 'separator' },
        { label: '잘라내기', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: '복사', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: '붙여넣기', accelerator: 'CmdOrCtrl+V', role: 'paste' }
      ]
    },
    {
      label: '보기',
      submenu: [
        { label: '새로고침', accelerator: 'CmdOrCtrl+R', role: 'reload' },
        { label: '개발자 도구', accelerator: 'F12', role: 'toggleDevTools' },
        { type: 'separator' },
        { label: '확대', accelerator: 'CmdOrCtrl+Plus', role: 'zoomIn' },
        { label: '축소', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
        { label: '원래 크기', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' }
      ]
    },
    {
      label: '도움말',
      submenu: [
        {
          label: '업데이트 확인',
          click: () => {
            autoUpdater.checkForUpdatesAndNotify();
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: '업데이트 확인',
              message: '업데이트를 확인하고 있습니다...',
              buttons: ['확인']
            });
          }
        },
        {
          type: 'separator'
        },
        {
          label: '프로그램 정보',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'JS일렉트로닉 ERP',
              message: 'JS일렉트로닉 ERP 시스템 v1.0.0',
              detail: '엘리콘에서 제작한 고객사 전용 ERP 시스템입니다.\n\n© 2025 Elicon. All rights reserved.',
              buttons: ['확인']
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  // React 앱 로드 (개발 중에는 localhost:3000, 프로덕션에서는 빌드된 파일)
  if (process.env.NODE_ENV === 'development') {
    // 개발 모드에서는 React 개발 서버 사용
    setTimeout(() => {
      mainWindow.loadURL('http://localhost:3000');
      mainWindow.webContents.openDevTools(); // 개발자 도구 자동 열기
    }, 3000); // React 서버가 완전히 시작되기를 기다림
  } else {
    mainWindow.loadFile(path.join(__dirname, 'client/build/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startServer() {
  // Express 서버를 자식 프로세스로 실행
  serverProcess = spawn('node', [path.join(__dirname, 'server.js')], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    stdio: ['inherit', 'inherit', 'inherit']
  });

  serverProcess.on('error', (err) => {
    console.error('서버 시작 실패:', err);
  });

  serverProcess.on('exit', (code, signal) => {
    console.log(`서버 프로세스 종료: ${code || signal}`);
  });
}

// 자동 업데이트 설정
autoUpdater.checkForUpdatesAndNotify();

// 업데이트 이벤트 핸들러
autoUpdater.on('update-available', () => {
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: '업데이트 가능',
    message: '새로운 버전이 있습니다. 다운로드 중입니다.',
    buttons: ['확인']
  });
});

autoUpdater.on('update-downloaded', () => {
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: '업데이트 준비 완료',
    message: '업데이트가 다운로드되었습니다. 애플리케이션을 다시 시작하여 업데이트를 적용하시겠습니까?',
    buttons: ['다시 시작', '나중에']
  }).then((result) => {
    if (result.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });
});

app.whenReady().then(() => {
  startServer();
  
  // 서버가 시작되기를 잠시 기다림
  setTimeout(() => {
    createWindow();
    
    // 앱 시작 후 업데이트 확인
    setTimeout(() => {
      autoUpdater.checkForUpdatesAndNotify();
    }, 5000);
  }, 2000);
});

app.on('window-all-closed', () => {
  // 서버 프로세스 종료
  if (serverProcess) {
    serverProcess.kill();
  }
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// 앱 종료 시 서버도 함께 종료
app.on('before-quit', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
});