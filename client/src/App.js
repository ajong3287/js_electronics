import React, { useState, useEffect } from 'react';
import CustomerManagement from './components/CustomerManagement';
import ItemManagement from './components/ItemManagement';
import SalesManagement from './components/SalesManagement';
import SupplierManagement from './components/SupplierManagement';
import PurchaseManagement from './components/PurchaseManagement';
import Analytics from './components/Analytics';
import Notifications from './components/Notifications';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [items, setItems] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [sales, setSales] = useState([]);
  const [showModal, setShowModal] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  
  // 파일 업로드 및 상태 관리
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState({ show: false, type: '', message: '' });
  const [currentFile, setCurrentFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showBackupReminder, setShowBackupReminder] = useState(false);
  const [lastBackupCheck, setLastBackupCheck] = useState(null);
  
  // 대시보드 통계 상태
  const [dashboardStats, setDashboardStats] = useState({
    overview: {
      totalSales: 0,
      totalProfit: 0,
      thisMonthSales: 0,
      todaySales: 0,
      totalCustomers: 0,
      activeCustomers: 0,
      totalItems: 0,
      activeItems: 0,
      totalTransactions: 0,
      averageTransactionAmount: 0
    },
    trends: { monthly: [] },
    topPerformers: { customers: [], items: [] },
    recent: { sales: [] }
  });
  const [statsLoading, setStatsLoading] = useState(false);

  // 백업 관리 상태
  const [backups, setBackups] = useState([]);
  const [backupLoading, setBackupLoading] = useState(false);
  const [scheduleType, setScheduleType] = useState('daily');

  // 실제 엑셀 데이터 로드
  useEffect(() => {
    loadExcelData();
    checkBackupReminder();
    loadDashboardStats(); // 대시보드 통계 로드 추가
  }, []);

  // 대시보드 통계 로드
  const loadDashboardStats = async () => {
    try {
      setStatsLoading(true);
      const response = await fetch('http://localhost:3001/api/dashboard/stats');
      if (response.ok) {
        const stats = await response.json();
        setDashboardStats(stats);
      } else {
        console.error('대시보드 통계 로드 실패');
      }
    } catch (error) {
      console.error('대시보드 통계 로드 에러:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  // 백업 알림 체크 (매월 1일)
  const checkBackupReminder = () => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentDate = today.getDate();
    
    // 로컬스토리지에서 마지막 백업 알림 날짜 확인
    const lastBackupReminder = localStorage.getItem('lastBackupReminder');
    const lastReminderDate = lastBackupReminder ? new Date(lastBackupReminder) : null;
    
    // 매월 1일이거나 테스트를 위해 알림을 한 번도 보여주지 않았다면
    const shouldShowReminder = currentDate === 1 && 
      (!lastReminderDate || 
       lastReminderDate.getMonth() !== currentMonth || 
       lastReminderDate.getFullYear() !== today.getFullYear());
    
    // 테스트를 위해 알림을 한 번도 보지 않았다면 표시
    const testShow = !lastReminderDate;
    
    if (shouldShowReminder || testShow) {
      setShowBackupReminder(true);
    }
  };

  // 백업 알림 처리
  const handleBackupReminder = (action) => {
    const today = new Date();
    
    if (action === 'backup') {
      // 백업 실행
      handleBackupData();
      setShowBackupReminder(false);
      localStorage.setItem('lastBackupReminder', today.toISOString());
    } else if (action === 'later') {
      // 나중에 하기 (하루 뒤 다시 알림)
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      localStorage.setItem('lastBackupReminder', tomorrow.toISOString());
      setShowBackupReminder(false);
    } else if (action === 'skip') {
      // 이번 달 건너뛰기
      localStorage.setItem('lastBackupReminder', today.toISOString());
      setShowBackupReminder(false);
    }
  };

  const loadExcelData = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:3001/api/js-electronics/data');
      const data = await response.json();
      
      // 매출 데이터 설정
      setSales(data.sales.map(sale => ({
        id: sale.id,
        date: sale.date,
        customer: sale.customer,
        itemName: sale.itemName,
        quantity: sale.quantity,
        unitPrice: sale.supplyPrice,
        vat: sale.vat,
        total: sale.total,
        profit: sale.profit,
        marginRate: sale.marginRate
      })));
      
      // 품목 데이터 설정
      setItems(data.items.map((item, index) => ({
        id: item.id,
        code: `ITEM-${String(index + 1).padStart(3, '0')}`,
        name: item.name,
        totalSold: item.totalSold,
        totalRevenue: item.totalRevenue,
        category: '전자부품',
        unit: '개'
      })));
      
      setLoading(false);
      
    } catch (error) {
      console.error('데이터 로드 실패:', error);
      setLoading(false);
      showNotification('error', '기본 데이터 로드 실패. 새 엑셀 파일을 업로드해주세요.');
      
      // 에러 시 샘플 데이터
      setItems([
        { id: 1, code: 'IC-001', name: '집적회로 A', category: 'IC', stock: 500, unit: '개', price: 1200 }
      ]);
      setSales([
        { id: 1, date: '2024-07-15', customer: '한국아이콘', itemCode: 'IC-001', quantity: 100, unitPrice: 1500, total: 150000 }
      ]);
    }
  };

  // 알림 표시 함수
  const showNotification = (type, message) => {
    setNotification({ show: true, type, message });
    setTimeout(() => {
      setNotification({ show: false, type: '', message: '' });
    }, 5000);
  };

  // 데이터 백업 (엑셀 내보내기)
  const handleBackupData = async () => {
    try {
      setLoading(true);
      showNotification('info', '데이터 백업을 시작합니다...');

      const response = await fetch('http://localhost:3001/api/export/excel');
      
      if (!response.ok) {
        throw new Error('백업 파일 생성에 실패했습니다.');
      }

      // 파일 다운로드
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      
      const today = new Date().toISOString().split('T')[0];
      const filename = `JS일렉트로닉_백업_${today}.xlsx`;
      
      link.href = url;
      link.download = filename;
      link.click();
      
      // 메모리 정리
      window.URL.revokeObjectURL(url);
      
      showNotification('success', `백업이 완료되었습니다. 파일: ${filename}`);
      
    } catch (error) {
      console.error('백업 실패:', error);
      showNotification('error', '백업 중 오류가 발생했습니다: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 파일 업로드 처리
  const handleFileUpload = async (file) => {
    if (!file) return;

    // 파일 형식 검증
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      showNotification('error', '엑셀 파일만 업로드 가능합니다. (.xlsx, .xls)');
      return;
    }

    setLoading(true);
    setUploadProgress(0);
    showNotification('info', '파일을 분석하고 있습니다...');

    try {
      const formData = new FormData();
      formData.append('excel', file);
      formData.append('clientName', 'uploads');

      const response = await fetch('http://localhost:3001/api/upload', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`업로드 실패: ${response.statusText}`);
      }

      const result = await response.json();
      
      // 업로드된 데이터로 화면 업데이트
      if (result.sales && result.sales.length > 0) {
        setSales(result.sales.map(sale => ({
          id: sale.id,
          date: sale.date,
          customer: sale.customer,
          itemName: sale.itemName,
          quantity: sale.quantity,
          unitPrice: sale.supplyPrice,
          vat: sale.vat,
          total: sale.total,
          profit: sale.profit,
          marginRate: sale.marginRate
        })));

        setItems(result.items.map((item, index) => ({
          id: item.id,
          code: `ITEM-${String(index + 1).padStart(3, '0')}`,
          name: item.name,
          totalSold: item.totalSold,
          totalRevenue: item.totalRevenue,
          category: '전자부품',
          unit: '개'
        })));

        setCurrentFile({
          name: result.originalName,
          uploadDate: new Date().toLocaleString(),
          summary: result.summary
        });

        showNotification('success', 
          `파일 분석 완료! ${result.summary.totalTransactions}개 거래 내역을 불러왔습니다.`
        );
      } else {
        showNotification('warning', '분석된 매출 데이터가 없습니다. 파일 형식을 확인해주세요.');
      }

    } catch (error) {
      console.error('파일 업로드 오류:', error);
      showNotification('error', `파일 업로드 실패: ${error.message}`);
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  // 파일 드롭 처리
  const handleFileDrop = (e) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  // 대시보드 통계 계산
  const getTotalSales = () => sales.reduce((sum, sale) => sum + sale.total, 0);
  const getMonthSales = () => {
    const currentMonth = new Date().getMonth();
    return sales
      .filter(sale => new Date(sale.date).getMonth() === currentMonth)
      .reduce((sum, sale) => sum + sale.total, 0);
  };

  // 검색 필터
  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredSales = sales.filter(sale => 
    sale.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sale.itemName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 챗봇 메시지 전송
  const sendChatMessage = async () => {
    if (!chatInput.trim()) return;

    const userMessage = { role: 'user', content: chatInput };
    setChatMessages([...chatMessages, userMessage]);
    setChatInput('');

    try {
      const response = await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: chatInput })
      });
      
      const data = await response.json();
      const botMessage = { role: 'bot', content: data.response };
      setChatMessages(prev => [...prev, botMessage]);
    } catch (error) {
      const errorMessage = { role: 'bot', content: '죄송합니다. 연결에 문제가 있습니다.' };
      setChatMessages(prev => [...prev, errorMessage]);
    }
  };

  // 거래명세서 PDF 생성
  const generateStatement = async (sale) => {
    try {
      showNotification('info', 'PDF 거래명세서를 생성하고 있습니다...');
      
      const response = await fetch(`http://localhost:3001/api/sales/${sale.id}/statement`);
      
      if (!response.ok) {
        throw new Error('거래명세서 생성 실패');
      }
      
      // PDF 파일 다운로드
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `거래명세서_${sale.customer}_${sale.date}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      showNotification('success', 'PDF 거래명세서가 다운로드되었습니다.');
      
    } catch (error) {
      console.error('거래명세서 생성 에러:', error);
      showNotification('error', '거래명세서 생성 중 오류가 발생했습니다.');
    }
  };

  // 거래명세서 엑셀 생성
  const generateStatementExcel = async (sale) => {
    try {
      showNotification('info', '엑셀 거래명세서를 생성하고 있습니다...');
      
      const response = await fetch(`http://localhost:3001/api/sales/${sale.id}/statement/excel`);
      
      if (!response.ok) {
        throw new Error('엑셀 거래명세서 생성 실패');
      }
      
      // 엑셀 파일 다운로드
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `거래명세서_${sale.customer}_${sale.date}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      showNotification('success', '엑셀 거래명세서가 다운로드되었습니다.');
      
    } catch (error) {
      console.error('엑셀 거래명세서 생성 에러:', error);
      showNotification('error', '엑셀 거래명세서 생성 중 오류가 발생했습니다.');
    }
  };

  // ==================== 백업 관리 함수들 ====================
  
  // 백업 목록 로드
  const loadBackupList = async () => {
    try {
      setBackupLoading(true);
      const response = await fetch('http://localhost:3001/api/backup/list');
      const data = await response.json();
      
      if (data.success) {
        setBackups(data.backups);
      } else {
        showNotification('error', '백업 목록을 불러오는데 실패했습니다.');
      }
    } catch (error) {
      console.error('백업 목록 로드 에러:', error);
      showNotification('error', '백업 목록 로드 중 오류가 발생했습니다.');
    } finally {
      setBackupLoading(false);
    }
  };

  // 수동 백업 생성
  const createManualBackup = async () => {
    try {
      setBackupLoading(true);
      showNotification('info', '백업을 생성하고 있습니다...');
      
      const response = await fetch('http://localhost:3001/api/backup/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        showNotification('success', '백업이 성공적으로 생성되었습니다.');
        loadBackupList(); // 백업 목록 새로고침
      } else {
        showNotification('error', data.message || '백업 생성에 실패했습니다.');
      }
      
    } catch (error) {
      console.error('수동 백업 생성 에러:', error);
      showNotification('error', '백업 생성 중 오류가 발생했습니다.');
    } finally {
      setBackupLoading(false);
    }
  };

  // 백업에서 복구
  const restoreFromBackup = async (backupFileName) => {
    if (!window.confirm(`'${backupFileName}' 백업으로 복구하시겠습니까?\n\n현재 데이터는 덮어써집니다.`)) {
      return;
    }
    
    try {
      setBackupLoading(true);
      showNotification('info', '데이터를 복구하고 있습니다...');
      
      const response = await fetch('http://localhost:3001/api/backup/restore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ backupFileName })
      });
      
      const data = await response.json();
      
      if (data.success) {
        showNotification('success', '데이터가 성공적으로 복구되었습니다.');
        // 데이터 다시 로드
        loadExcelData();
        loadDashboardStats();
      } else {
        showNotification('error', data.message || '데이터 복구에 실패했습니다.');
      }
      
    } catch (error) {
      console.error('백업 복구 에러:', error);
      showNotification('error', '데이터 복구 중 오류가 발생했습니다.');
    } finally {
      setBackupLoading(false);
    }
  };

  // 자동 백업 스케줄 설정
  const setBackupSchedule = async (type) => {
    try {
      const response = await fetch('http://localhost:3001/api/backup/schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ scheduleType: type })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setScheduleType(type);
        showNotification('success', data.message);
      } else {
        showNotification('error', data.message || '스케줄 설정에 실패했습니다.');
      }
      
    } catch (error) {
      console.error('백업 스케줄 설정 에러:', error);
      showNotification('error', '스케줄 설정 중 오류가 발생했습니다.');
    }
  };

  // 백업 파일 다운로드
  const downloadBackup = (fileName) => {
    const downloadUrl = `http://localhost:3001/api/backup/download/${fileName}`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = fileName;
    link.click();
    
    showNotification('info', '백업 파일을 다운로드합니다.');
  };

  return (
    <div className="App">
      <header className="header">
        <h1>JS일렉트로닉 ERP</h1>
        <div className="header-controls">
          <button 
            className="backup-button"
            onClick={handleBackupData}
            disabled={loading}
            title="전체 데이터를 엑셀 파일로 백업합니다"
          >
            {loading ? '백업 중...' : '📥 데이터 백업'}
          </button>
          <div className="header-info">
            <span>환영합니다!</span>
            <span>{new Date().toLocaleDateString('ko-KR')}</span>
          </div>
        </div>
      </header>

      <nav className="navigation">
        <button 
          className={activeTab === 'dashboard' ? 'active' : ''} 
          onClick={() => setActiveTab('dashboard')}
        >
          📊 대시보드
        </button>
        <button 
          className={activeTab === 'items' ? 'active' : ''} 
          onClick={() => setActiveTab('items')}
        >
          📦 품목관리
        </button>
        <button 
          className={activeTab === 'sales' ? 'active' : ''} 
          onClick={() => setActiveTab('sales')}
        >
          💰 매출관리
        </button>
        <button 
          className={activeTab === 'purchase' ? 'active' : ''} 
          onClick={() => setActiveTab('purchase')}
        >
          🛒 매입관리
        </button>
        <button 
          className={activeTab === 'customers' ? 'active' : ''} 
          onClick={() => setActiveTab('customers')}
        >
          👥 고객관리
        </button>
        <button 
          className={activeTab === 'reports' ? 'active' : ''} 
          onClick={() => setActiveTab('reports')}
        >
          📈 보고서
        </button>
        <button 
          className={activeTab === 'analytics' ? 'active' : ''} 
          onClick={() => setActiveTab('analytics')}
        >
          📊 분석대시보드
        </button>
        <button 
          className={activeTab === 'notifications' ? 'active' : ''} 
          onClick={() => setActiveTab('notifications')}
        >
          🔔 알림센터
        </button>
        <button 
          className={activeTab === 'backup' ? 'active' : ''} 
          onClick={() => {
            setActiveTab('backup');
            loadBackupList(); // 백업 탭 클릭 시 목록 로드
          }}
        >
          💾 백업관리
        </button>
      </nav>

      <main className="main-content">
        {/* 대시보드 */}
        {activeTab === 'customers' && <CustomerManagement />}
        
        {activeTab === 'items' && <ItemManagement />}
        
        {activeTab === 'sales' && <SalesManagement />}
        
        {activeTab === 'purchase' && <PurchaseManagement />}

        {activeTab === 'dashboard' && (
          <div className="dashboard">
            <div className="dashboard-header">
              <h2>오늘의 현황</h2>
              <div className="file-upload-section">
                <label htmlFor="file-input" className="upload-button">
                  📂 엑셀 파일 업로드
                </label>
                <input
                  id="file-input"
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => handleFileUpload(e.target.files[0])}
                  style={{ display: 'none' }}
                />
                <div 
                  className="drag-drop-area"
                  onDrop={handleFileDrop}
                  onDragOver={handleDragOver}
                >
                  {loading ? (
                    <div className="loading-area">
                      <div className="spinner"></div>
                      <p>파일을 분석하고 있습니다...</p>
                    </div>
                  ) : (
                    <>
                      <p>📁 엑셀 파일을 여기에 드래그하거나 위 버튼을 클릭하세요</p>
                      {currentFile && (
                        <div className="current-file">
                          <p><strong>현재 파일:</strong> {currentFile.name}</p>
                          <p><small>업로드: {currentFile.uploadDate}</small></p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
            
            {/* 통계 카드 */}
            <div className="stat-cards">
              {statsLoading ? (
                <div className="stats-loading">
                  <div className="spinner"></div>
                  <p>통계를 불러오는 중...</p>
                </div>
              ) : (
                <>
                  <div className="stat-card">
                    <h3>오늘 매출</h3>
                    <p className="stat-value">{dashboardStats.overview.todaySales.toLocaleString()}원</p>
                    <p className="stat-change">실시간 업데이트</p>
                  </div>
                  <div className="stat-card">
                    <h3>이번 달 매출</h3>
                    <p className="stat-value">{dashboardStats.overview.thisMonthSales.toLocaleString()}원</p>
                    <p className="stat-change">{new Date().toLocaleDateString('ko-KR', { month: 'long' })}</p>
                  </div>
                  <div className="stat-card">
                    <h3>전체 매출</h3>
                    <p className="stat-value">{dashboardStats.overview.totalSales.toLocaleString()}원</p>
                    <p className="stat-change">{dashboardStats.overview.totalTransactions}건 거래</p>
                  </div>
                  <div className="stat-card">
                    <h3>활성 거래처</h3>
                    <p className="stat-value">{dashboardStats.overview.activeCustomers}개사</p>
                    <p className="stat-change">총 {dashboardStats.overview.totalCustomers}개사</p>
                  </div>
                  <div className="stat-card">
                    <h3>총 이익</h3>
                    <p className="stat-value profit">{dashboardStats.overview.totalProfit.toLocaleString()}원</p>
                    <p className="stat-change">평균 거래액 {dashboardStats.overview.averageTransactionAmount.toLocaleString()}원</p>
                  </div>
                  <div className="stat-card">
                    <h3>품목 현황</h3>
                    <p className="stat-value">{dashboardStats.overview.activeItems}개</p>
                    <p className="stat-change">총 {dashboardStats.overview.totalItems}개 등록</p>
                  </div>
                </>
              )}
            </div>

            {/* 월별 매출 트렌드 */}
            {!statsLoading && dashboardStats.trends.monthly.length > 0 && (
              <div className="trends-section">
                <h3>월별 매출 트렌드 (최근 12개월)</h3>
                <div className="trends-chart">
                  {dashboardStats.trends.monthly.map((month, index) => (
                    <div key={`${month.year}-${month.month}`} className="trend-bar">
                      <div 
                        className="bar" 
                        style={{ 
                          height: `${Math.max(5, (month.sales / Math.max(...dashboardStats.trends.monthly.map(m => m.sales))) * 100)}%` 
                        }}
                        title={`${month.year}년 ${month.month}월: ${month.sales.toLocaleString()}원 (${month.count}건)`}
                      ></div>
                      <span className="month-label">{month.monthName}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 상위 실적 */}
            {!statsLoading && (
              <div className="performance-section">
                <div className="top-customers">
                  <h3>상위 거래처 (매출 기준)</h3>
                  <div className="ranking-list">
                    {dashboardStats.topPerformers.customers.map((customer, index) => (
                      <div key={customer.id} className="ranking-item">
                        <span className="rank">#{index + 1}</span>
                        <span className="name">{customer.name}</span>
                        <span className="value">{customer.totalSales.toLocaleString()}원</span>
                        <span className="count">({customer.transactionCount}건)</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="top-items">
                  <h3>상위 품목 (매출 기준)</h3>
                  <div className="ranking-list">
                    {dashboardStats.topPerformers.items.map((item, index) => (
                      <div key={item.id} className="ranking-item">
                        <span className="rank">#{index + 1}</span>
                        <span className="name">{item.name}</span>
                        <span className="value">{item.totalRevenue.toLocaleString()}원</span>
                        <span className="count">({item.quantitySold.toLocaleString()}개)</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 최근 거래 */}
            {!statsLoading && dashboardStats.recent.sales.length > 0 && (
              <div className="recent-sales-section">
                <h3>최근 거래 내역</h3>
                <div className="recent-sales-table">
                  <div className="table-header">
                    <span>날짜</span>
                    <span>거래처</span>
                    <span>품목</span>
                    <span>금액</span>
                    <span>이익</span>
                  </div>
                  {dashboardStats.recent.sales.slice(0, 5).map((sale) => (
                    <div key={sale.id} className="table-row">
                      <span>{new Date(sale.date).toLocaleDateString('ko-KR')}</span>
                      <span>{sale.customer}</span>
                      <span>{sale.item.length > 20 ? sale.item.substring(0, 20) + '...' : sale.item}</span>
                      <span>{sale.amount.toLocaleString()}원</span>
                      <span className="profit-cell">{sale.profit.toLocaleString()}원</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="help-section">
              <h3>프로그램 사용 가이드</h3>
              <div className="help-cards">
                <div className="help-card">
                  <h4>📁 내 데이터는 어디에 저장되나요?</h4>
                  <p><strong>걱정 마세요!</strong> 모든 데이터는 내 컴퓨터에만 안전하게 저장됩니다.</p>
                  
                  <div className="storage-info">
                    <h5>💻 Windows 사용자</h5>
                    <div className="path-box">
                      C:\Users\<span className="highlight">[내이름]</span>\AppData\Local\JS일렉트로닉 ERP\
                    </div>
                    <p className="path-desc">예시: C:\Users\홍길동\AppData\Local\JS일렉트로닉 ERP\</p>
                    
                    <h5>🍎 Mac 사용자</h5>
                    <div className="path-box">
                      /Users/<span className="highlight">[내이름]</span>/Library/Application Support/JS일렉트로닉 ERP/
                    </div>
                    <p className="path-desc">예시: /Users/홍길동/Library/Application Support/JS일렉트로닉 ERP/</p>
                  </div>
                  
                  <div className="folder-structure">
                    <h5>📂 폴더 구조</h5>
                    <div className="folder-tree">
                      <div className="folder-item">📁 clients/ - 고객사별 Excel 파일들</div>
                      <div className="folder-item indent">📁 제이에스일렉트로닉/</div>
                      <div className="folder-item indent2">📄 2024년도 매출이윤표.xlsx</div>
                      <div className="folder-item">📁 uploads/ - 업로드한 모든 파일들</div>
                      <div className="folder-item">📁 backup/ - 자동 백업 파일들</div>
                    </div>
                  </div>
                </div>
                <div className="help-card">
                  <h4>🔄 프로그램 업데이트는 어떻게 되나요?</h4>
                  <p><strong>자동으로 처리됩니다!</strong> 복잡한 것은 신경 쓰지 마세요.</p>
                  <div className="update-steps">
                    <div className="step">1️⃣ 프로그램이 스스로 새 버전 확인</div>
                    <div className="step">2️⃣ 업데이트 발견 시 "새 버전이 있어요!" 알림</div>
                    <div className="step">3️⃣ 사용 중에도 조용히 다운로드</div>
                    <div className="step">4️⃣ "업데이트 할까요?" 물어본 후 설치</div>
                  </div>
                  <p className="note">💡 언제든 메뉴 → 도움말 → 업데이트 확인으로 수동 확인 가능</p>
                </div>
                <div className="help-card">
                  <h4>💾 내 데이터가 사라질까 걱정된다면?</h4>
                  <p><strong>안전합니다!</strong> 자동으로 백업하고 있어요.</p>
                  <div className="backup-info">
                    <div className="backup-item">
                      <span className="backup-icon">🕒</span>
                      <div>
                        <strong>매일 밤 12시</strong><br/>
                        <span>자동으로 백업 파일 생성</span>
                      </div>
                    </div>
                    <div className="backup-item">
                      <span className="backup-icon">📚</span>
                      <div>
                        <strong>30일간 보관</strong><br/>
                        <span>한 달 전까지 복구 가능</span>
                      </div>
                    </div>
                    <div className="backup-item">
                      <span className="backup-icon">🎯</span>
                      <div>
                        <strong>수동 백업</strong><br/>
                        <span>언제든 파일 메뉴에서 백업</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="help-card">
                  <h4>🛡️ 내 정보가 외부로 나가지 않을까요?</h4>
                  <p><strong>절대 안전합니다!</strong> 100% 내 컴퓨터에만 저장됩니다.</p>
                  <div className="security-features">
                    <div className="security-item">
                      <span className="security-check">✅</span>
                      <span>모든 데이터는 내 컴퓨터 하드디스크에만 저장</span>
                    </div>
                    <div className="security-item">
                      <span className="security-check">✅</span>
                      <span>인터넷으로 정보 전송 일절 없음</span>
                    </div>
                    <div className="security-item">
                      <span className="security-check">✅</span>
                      <span>매출 데이터, 고객 정보 완벽 보호</span>
                    </div>
                    <div className="security-item">
                      <span className="security-check">✅</span>
                      <span>네트워크 없어도 언제든 사용 가능</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="help-actions">
                <button className="help-btn" onClick={() => {
                  const helpText = `
📖 JS일렉트로닉 ERP 도움말

💡 기본 사용법:
• 엑셀 파일을 업로드하면 자동으로 분석됩니다
• 대시보드에서 전체 현황을 확인하세요
• 품목관리에서 재고와 매출을 확인할 수 있습니다
• 검색 기능으로 원하는 정보를 빠르게 찾으세요

🔧 문제 해결:
• 프로그램이 느려질 때: 프로그램 재시작
• 데이터가 안 보일 때: 엑셀 파일 다시 업로드
• 업데이트 오류 시: 메뉴에서 수동 업데이트 확인

📞 더 궁금한 사항이 있으시면 고객센터로 연락주세요!
                  `.trim();
                  alert(helpText);
                }}>
                  📖 사용법 자세히 보기
                </button>
                <button className="help-btn" onClick={() => {
                  const contactInfo = `
📞 JS일렉트로닉 ERP 고객센터

✉️ 이메일: support@elicon.co.kr
📱 전화번호: 02-1234-5678
💬 카카오톡: @elicon

⏰ 운영시간:
월~금 오전 9시 ~ 오후 6시
토요일 오전 9시 ~ 오후 1시
(일요일, 공휴일 휴무)

🆘 긴급 문의:
데이터 손실이나 프로그램 오류 시
24시간 응급 지원 가능
                  `.trim();
                  alert(contactInfo);
                }}>
                  📞 고객센터 & 지원
                </button>
                <button className="help-btn" onClick={() => {
                  const pathInfo = `
📁 내 데이터 위치 찾기

🖥️ Windows 사용자:
1. 윈도우 키 + R 키를 누르세요
2. %LOCALAPPDATA% 입력 후 엔터
3. "JS일렉트로닉 ERP" 폴더 찾기

🍎 Mac 사용자:
1. Finder 열기
2. 이동 메뉴 → 폴더로 이동
3. ~/Library/Application Support 입력
4. "JS일렉트로닉 ERP" 폴더 찾기

💡 팁: 이 폴더를 즐겨찾기에 추가하면 편해요!
                  `.trim();
                  alert(pathInfo);
                }}>
                  📂 내 데이터 폴더 찾기
                </button>
              </div>
            </div>

            <div className="recent-section">
              <h3>최근 거래</h3>
              <table className="simple-table">
                <thead>
                  <tr>
                    <th>날짜</th>
                    <th>거래처</th>
                    <th>품목</th>
                    <th>금액</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.slice(0, 5).map(sale => (
                    <tr key={sale.id}>
                      <td>{sale.date}</td>
                      <td>{sale.customer}</td>
                      <td>{sale.itemName}</td>
                      <td>{sale.total.toLocaleString()}원</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 품목관리 */}
        {activeTab === 'items' && (
          <div className="items-section">
            <div className="section-header">
              <h2>품목 관리</h2>
              <div className="search-bar">
                <input 
                  type="text" 
                  placeholder="품목명 또는 코드로 검색..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <button className="btn-primary" onClick={() => setShowModal('addItem')}>
                + 신규 품목
              </button>
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th>품목코드</th>
                  <th>품목명</th>
                  <th>카테고리</th>
                  <th>총 판매수량</th>
                  <th>총 매출액</th>
                  <th>단위</th>
                  <th>작업</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map(item => (
                  <tr key={item.id}>
                    <td>{item.code}</td>
                    <td>{item.name}</td>
                    <td>{item.category}</td>
                    <td>{item.totalSold ? item.totalSold.toLocaleString() : 0}</td>
                    <td>{item.totalRevenue ? item.totalRevenue.toLocaleString() : 0}원</td>
                    <td>{item.unit}</td>
                    <td>
                      <button className="btn-small">상세</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 매출관리 */}
        {activeTab === 'sales' && (
          <div className="sales-section">
            <div className="section-header">
              <h2>매출 관리</h2>
              <div className="search-bar">
                <input 
                  type="text" 
                  placeholder="거래처 또는 품목으로 검색..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <button className="btn-primary" onClick={() => setShowModal('addSale')}>
                + 매출 등록
              </button>
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th>날짜</th>
                  <th>거래처</th>
                  <th>품목명</th>
                  <th>수량</th>
                  <th>공급가액</th>
                  <th>부가세</th>
                  <th>합계</th>
                  <th>이익률</th>
                  <th>명세서 다운로드</th>
                </tr>
              </thead>
              <tbody>
                {filteredSales.map(sale => (
                  <tr key={sale.id}>
                    <td>{sale.date}</td>
                    <td>{sale.customer}</td>
                    <td>{sale.itemName}</td>
                    <td>{sale.quantity.toLocaleString()}</td>
                    <td>{sale.unitPrice.toLocaleString()}원</td>
                    <td>{(sale.vat || 0).toLocaleString()}원</td>
                    <td>{sale.total.toLocaleString()}원</td>
                    <td>{sale.marginRate ? `${sale.marginRate}%` : '-'}</td>
                    <td>
                      <button 
                        className="btn-small"
                        onClick={() => generateStatement(sale)}
                        style={{ marginRight: '5px' }}
                      >
                        PDF
                      </button>
                      <button 
                        className="btn-small"
                        onClick={() => generateStatementExcel(sale)}
                        style={{ backgroundColor: '#28a745' }}
                      >
                        Excel
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 매입관리 */}
        {activeTab === 'purchase' && <SupplierManagement />}

        {/* 보고서 */}
        {activeTab === 'reports' && (
          <div className="reports-section">
            <h2>보고서</h2>
            <div className="report-buttons">
              <button className="report-btn">
                📊 월별 매출 보고서
              </button>
              <button className="report-btn">
                📈 거래처별 분석
              </button>
              <button className="report-btn">
                📉 품목별 판매 추이
              </button>
              <button className="report-btn">
                💹 수익률 분석
              </button>
            </div>
          </div>
        )}

        {/* 분석대시보드 */}
        {activeTab === 'analytics' && (
          <Analytics />
        )}

        {/* 알림센터 */}
        {activeTab === 'notifications' && (
          <Notifications />
        )}

        {/* 백업관리 */}
        {activeTab === 'backup' && (
          <div className="backup-section">
            <div className="section-header">
              <h2>백업 관리</h2>
              <div className="backup-controls">
                <button 
                  className="btn-create-backup" 
                  onClick={createManualBackup}
                  disabled={backupLoading}
                >
                  {backupLoading ? '생성 중...' : '📦 수동 백업 생성'}
                </button>
                
                <select 
                  value={scheduleType} 
                  onChange={(e) => setBackupSchedule(e.target.value)}
                  className="schedule-select"
                >
                  <option value="daily">일일 자동 백업</option>
                  <option value="weekly">주간 자동 백업</option>
                </select>
              </div>
            </div>

            <div className="backup-info">
              <div className="info-card">
                <h3>자동 백업 설정</h3>
                <p>현재 설정: <strong>{scheduleType === 'daily' ? '매일 오전 2시' : '매주 일요일 오전 3시'}</strong></p>
                <p>최근 10개 백업 파일을 자동으로 관리합니다.</p>
              </div>
            </div>

            <div className="backup-list">
              <h3>백업 파일 목록 ({backups.length}개)</h3>
              
              {backupLoading ? (
                <div className="loading">백업 목록을 불러오는 중...</div>
              ) : backups.length === 0 ? (
                <div className="no-backups">생성된 백업 파일이 없습니다.</div>
              ) : (
                <div className="backup-table-container">
                  <table className="backup-table">
                    <thead>
                      <tr>
                        <th>파일명</th>
                        <th>생성일시</th>
                        <th>파일 크기</th>
                        <th>작업</th>
                      </tr>
                    </thead>
                    <tbody>
                      {backups.map((backup, index) => (
                        <tr key={index}>
                          <td className="file-name">{backup.fileName}</td>
                          <td className="created-date">
                            {new Date(backup.created).toLocaleString('ko-KR')}
                          </td>
                          <td className="file-size">
                            {(backup.size / 1024).toFixed(1)} KB
                          </td>
                          <td className="backup-actions">
                            <button 
                              className="btn-restore" 
                              onClick={() => restoreFromBackup(backup.fileName)}
                              disabled={backupLoading}
                            >
                              🔄 복구
                            </button>
                            <button 
                              className="btn-download" 
                              onClick={() => downloadBackup(backup.fileName)}
                            >
                              📥 다운로드
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="backup-tips">
              <h3>백업 관리 가이드</h3>
              <ul>
                <li>중요한 작업 전에는 수동 백업을 생성하세요</li>
                <li>복구 시 현재 데이터가 완전히 대체됩니다</li>
                <li>백업 파일은 로컬에 저장되며, 외부 저장소 보관을 권장합니다</li>
                <li>자동 백업은 최대 10개까지 보관되며, 오래된 파일은 자동 삭제됩니다</li>
              </ul>
            </div>
          </div>
        )}
      </main>

      {/* 로딩 오버레이 */}
      {loading && (
        <div className="loading-overlay">
          <div className="loading-content">
            <div className="spinner-large"></div>
            <p>처리 중입니다...</p>
          </div>
        </div>
      )}

      {/* 알림 토스트 */}
      {notification.show && (
        <div className={`notification ${notification.type}`}>
          <div className="notification-content">
            <span className="notification-icon">
              {notification.type === 'success' && '✅'}
              {notification.type === 'error' && '❌'}
              {notification.type === 'warning' && '⚠️'}
              {notification.type === 'info' && 'ℹ️'}
            </span>
            <span className="notification-message">{notification.message}</span>
            <button 
              className="notification-close"
              onClick={() => setNotification({ show: false, type: '', message: '' })}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* 모달은 추후 구현 */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal('')}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{showModal === 'addItem' ? '신규 품목 등록' : '매출 등록'}</h3>
            <p>기능 구현 예정</p>
            <button onClick={() => setShowModal('')}>닫기</button>
          </div>
        </div>
      )}

      {/* 챗봇 버튼 */}
      <button 
        className="chat-button"
        onClick={() => setShowChat(!showChat)}
      >
        💬 AI 도우미
      </button>

      {/* 챗봇 창 */}
      {showChat && (
        <div className="chat-container">
          <div className="chat-header">
            <h3>AI 도우미</h3>
            <button onClick={() => setShowChat(false)}>✕</button>
          </div>
          <div className="chat-messages">
            {chatMessages.length === 0 && (
              <div className="chat-welcome">
                안녕하세요! 무엇을 도와드릴까요?<br/>
                예: "이번 달 매출은?", "거래처 목록 보여줘"
              </div>
            )}
            {chatMessages.map((msg, index) => (
              <div key={index} className={`chat-message ${msg.role}`}>
                {msg.content.split('\\n').map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
              </div>
            ))}
          </div>
          <div className="chat-input-container">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
              placeholder="질문을 입력하세요..."
            />
            <button onClick={sendChatMessage}>전송</button>
          </div>
        </div>
      )}

      {/* 백업 알림 모달 */}
      {showBackupReminder && (
        <div className="modal-backdrop">
          <div className="backup-reminder-modal">
            <div className="modal-header">
              <h3>💾 데이터 백업 권장</h3>
            </div>
            <div className="modal-content">
              <p>
                새로운 달이 시작되었습니다!<br/>
                안전한 데이터 관리를 위해 <strong>지난달 데이터</strong>를 
                엑셀 파일로 백업하시는 것을 권장합니다.
              </p>
              <div className="backup-benefits">
                <div className="benefit-item">
                  ✅ <span>데이터 안전성 확보</span>
                </div>
                <div className="benefit-item">
                  ✅ <span>내 컴퓨터에 직접 저장</span>
                </div>
                <div className="benefit-item">
                  ✅ <span>언제든 엑셀로 확인 가능</span>
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button 
                className="btn-primary"
                onClick={() => handleBackupReminder('backup')}
                disabled={loading}
              >
                {loading ? '백업 중...' : '지금 백업하기'}
              </button>
              <button 
                className="btn-secondary"
                onClick={() => handleBackupReminder('later')}
              >
                내일 다시 알림
              </button>
              <button 
                className="btn-text"
                onClick={() => handleBackupReminder('skip')}
              >
                이번 달 건너뛰기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;