import React, { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line, Bar, Pie, Doughnut } from 'react-chartjs-2';
import '../Analytics.css';

// Chart.js 등록
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

const Analytics = () => {
  const [analyticsData, setAnalyticsData] = useState({
    trends: { monthly: [], quarterly: [], yearly: [] },
    customers: { top: [], distribution: [] },
    items: { top: [], performance: [] },
    targets: { monthly: 0, achieved: 0, rate: 0 },
    summary: { totalRevenue: 0, totalProfit: 0, averageOrder: 0, growth: 0 }
  });
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('monthly'); // monthly, quarterly, yearly
  const [selectedChart, setSelectedChart] = useState('trends'); // trends, customers, items, targets

  // 분석 데이터 로드
  const loadAnalyticsData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:3001/api/analytics?period=${selectedPeriod}`);
      
      if (!response.ok) {
        throw new Error('분석 데이터 로드 실패');
      }
      
      const data = await response.json();
      setAnalyticsData(data);
      
    } catch (err) {
      console.error('분석 데이터 로드 에러:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalyticsData();
  }, [selectedPeriod]);

  // 매출 트렌드 차트 데이터
  const getTrendChartData = () => {
    const trendData = analyticsData.trends[selectedPeriod] || [];
    
    return {
      labels: trendData.map(item => item.period),
      datasets: [
        {
          label: '매출액',
          data: trendData.map(item => item.revenue),
          borderColor: 'rgb(75, 192, 192)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          tension: 0.1,
          fill: true,
        },
        {
          label: '순이익',
          data: trendData.map(item => item.profit),
          borderColor: 'rgb(255, 99, 132)',
          backgroundColor: 'rgba(255, 99, 132, 0.2)',
          tension: 0.1,
          fill: true,
        }
      ],
    };
  };

  // 고객별 매출 파이 차트 데이터
  const getCustomerChartData = () => {
    const customerData = analyticsData.customers.top || [];
    
    const colors = [
      '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
      '#FF9F40', '#FF6384', '#C9CBCF', '#4BC0C0', '#FF6384'
    ];
    
    return {
      labels: customerData.map(item => item.customer),
      datasets: [
        {
          data: customerData.map(item => item.revenue),
          backgroundColor: colors.slice(0, customerData.length),
          borderWidth: 2,
          borderColor: '#fff',
        },
      ],
    };
  };

  // 품목별 성과 바 차트 데이터
  const getItemChartData = () => {
    const itemData = analyticsData.items.top || [];
    
    return {
      labels: itemData.map(item => item.name),
      datasets: [
        {
          label: '매출량',
          data: itemData.map(item => item.quantity),
          backgroundColor: 'rgba(54, 162, 235, 0.8)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1,
        },
        {
          label: '매출액',
          data: itemData.map(item => item.revenue),
          backgroundColor: 'rgba(255, 99, 132, 0.8)',
          borderColor: 'rgba(255, 99, 132, 1)',
          borderWidth: 1,
          yAxisID: 'y1',
        }
      ],
    };
  };

  // 목표 달성률 도넛 차트 데이터
  const getTargetChartData = () => {
    const targetData = analyticsData.targets;
    const achieved = targetData.achieved || 0;
    const target = targetData.monthly || 1;
    const remaining = Math.max(0, target - achieved);
    
    return {
      labels: ['달성', '미달성'],
      datasets: [
        {
          data: [achieved, remaining],
          backgroundColor: ['#36A2EB', '#E0E0E0'],
          borderWidth: 0,
        },
      ],
    };
  };

  // PDF 리포트 내보내기
  const exportToPDF = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/analytics/export/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period: selectedPeriod })
      });
      
      if (!response.ok) throw new Error('PDF 생성 실패');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `매출분석리포트_${selectedPeriod}_${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
    } catch (error) {
      console.error('PDF 내보내기 에러:', error);
      alert('PDF 내보내기 중 오류가 발생했습니다.');
    }
  };

  // 엑셀 리포트 내보내기
  const exportToExcel = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/analytics/export/excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period: selectedPeriod })
      });
      
      if (!response.ok) throw new Error('엑셀 생성 실패');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `매출분석리포트_${selectedPeriod}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
    } catch (error) {
      console.error('엑셀 내보내기 에러:', error);
      alert('엑셀 내보내기 중 오류가 발생했습니다.');
    }
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: '매출 분석',
      },
    },
    scales: selectedChart === 'items' ? {
      y: {
        type: 'linear',
        display: true,
        position: 'left',
      },
      y1: {
        type: 'linear',
        display: true,
        position: 'right',
        grid: {
          drawOnChartArea: false,
        },
      },
    } : undefined,
  };

  if (loading) {
    return (
      <div className="analytics-container">
        <div className="loading-spinner">분석 데이터를 로드하고 있습니다...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="analytics-container">
        <div className="error-message">
          <h3>오류 발생</h3>
          <p>{error}</p>
          <button onClick={loadAnalyticsData} className="retry-button">
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="analytics-container">
      {/* 헤더 */}
      <div className="analytics-header">
        <h2>📊 매출 분석 대시보드</h2>
        <div className="analytics-controls">
          <select 
            value={selectedPeriod} 
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="period-select"
          >
            <option value="monthly">월별</option>
            <option value="quarterly">분기별</option>
            <option value="yearly">연도별</option>
          </select>
          
          <button onClick={exportToPDF} className="export-btn pdf">
            📄 PDF 내보내기
          </button>
          <button onClick={exportToExcel} className="export-btn excel">
            📊 엑셀 내보내기
          </button>
        </div>
      </div>

      {/* 요약 통계 */}
      <div className="summary-cards">
        <div className="summary-card revenue">
          <h3>총 매출액</h3>
          <p className="amount">₩{analyticsData.summary.totalRevenue.toLocaleString()}</p>
          <span className="growth positive">+{analyticsData.summary.growth}%</span>
        </div>
        <div className="summary-card profit">
          <h3>총 순이익</h3>
          <p className="amount">₩{analyticsData.summary.totalProfit.toLocaleString()}</p>
          <span className="percentage">{((analyticsData.summary.totalProfit / analyticsData.summary.totalRevenue) * 100).toFixed(1)}%</span>
        </div>
        <div className="summary-card average">
          <h3>평균 주문액</h3>
          <p className="amount">₩{analyticsData.summary.averageOrder.toLocaleString()}</p>
        </div>
        <div className="summary-card target">
          <h3>목표 달성률</h3>
          <p className="amount">{analyticsData.targets.rate}%</p>
          <div className="progress-bar">
            <div className="progress" style={{width: `${Math.min(analyticsData.targets.rate, 100)}%`}}></div>
          </div>
        </div>
      </div>

      {/* 차트 선택 탭 */}
      <div className="chart-tabs">
        <button 
          className={selectedChart === 'trends' ? 'active' : ''}
          onClick={() => setSelectedChart('trends')}
        >
          📈 매출 트렌드
        </button>
        <button 
          className={selectedChart === 'customers' ? 'active' : ''}
          onClick={() => setSelectedChart('customers')}
        >
          👥 고객별 분석
        </button>
        <button 
          className={selectedChart === 'items' ? 'active' : ''}
          onClick={() => setSelectedChart('items')}
        >
          📦 품목별 성과
        </button>
        <button 
          className={selectedChart === 'targets' ? 'active' : ''}
          onClick={() => setSelectedChart('targets')}
        >
          🎯 목표 달성률
        </button>
      </div>

      {/* 차트 영역 */}
      <div className="chart-container">
        {selectedChart === 'trends' && (
          <div className="chart-wrapper">
            <Line data={getTrendChartData()} options={chartOptions} />
          </div>
        )}
        
        {selectedChart === 'customers' && (
          <div className="chart-wrapper">
            <Pie data={getCustomerChartData()} options={chartOptions} />
          </div>
        )}
        
        {selectedChart === 'items' && (
          <div className="chart-wrapper">
            <Bar data={getItemChartData()} options={chartOptions} />
          </div>
        )}
        
        {selectedChart === 'targets' && (
          <div className="chart-wrapper">
            <Doughnut data={getTargetChartData()} options={chartOptions} />
          </div>
        )}
      </div>

      {/* 상세 테이블 */}
      <div className="analytics-tables">
        {selectedChart === 'customers' && (
          <div className="table-section">
            <h3>고객별 상세 현황</h3>
            <table className="analytics-table">
              <thead>
                <tr>
                  <th>고객사</th>
                  <th>총 매출액</th>
                  <th>거래 횟수</th>
                  <th>평균 주문액</th>
                  <th>기여도</th>
                </tr>
              </thead>
              <tbody>
                {analyticsData.customers.top.map((customer, index) => (
                  <tr key={index}>
                    <td>{customer.customer}</td>
                    <td>₩{customer.revenue.toLocaleString()}</td>
                    <td>{customer.transactions}회</td>
                    <td>₩{customer.averageOrder.toLocaleString()}</td>
                    <td>{customer.contribution}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {selectedChart === 'items' && (
          <div className="table-section">
            <h3>품목별 상세 현황</h3>
            <table className="analytics-table">
              <thead>
                <tr>
                  <th>품목명</th>
                  <th>판매량</th>
                  <th>매출액</th>
                  <th>평균 단가</th>
                  <th>수익률</th>
                </tr>
              </thead>
              <tbody>
                {analyticsData.items.top.map((item, index) => (
                  <tr key={index}>
                    <td>{item.name}</td>
                    <td>{item.quantity.toLocaleString()}개</td>
                    <td>₩{item.revenue.toLocaleString()}</td>
                    <td>₩{item.averagePrice.toLocaleString()}</td>
                    <td>{item.profitRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Analytics;