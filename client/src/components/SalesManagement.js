import React, { useState, useEffect } from 'react';
import '../SalesManagement.css';

const SalesManagement = () => {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [exporting, setExporting] = useState(false);

  // 필터 상태
  const [filters, setFilters] = useState({
    customer: '',
    item: '',
    startDate: '',
    endDate: '',
    minAmount: '',
    maxAmount: ''
  });

  // 페이지네이션 상태
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    limit: 50
  });

  // 검색 결과 요약
  const [summary, setSummary] = useState({
    totalAmount: 0,
    totalProfit: 0,
    averageAmount: 0,
    averageProfit: 0
  });

  // 매출 데이터 조회
  const fetchSales = async (page = 1, resetData = false) => {
    try {
      if (resetData) {
        setLoading(true);
      }

      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
        ...filters
      });

      const response = await fetch(`http://localhost:3001/api/sales?${queryParams}`);
      if (!response.ok) {
        throw new Error('매출 데이터 조회에 실패했습니다.');
      }

      const data = await response.json();
      setSales(data.data);
      setPagination(data.pagination);
      setSummary(data.summary);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    fetchSales(1, true);
  }, []);

  // 필터 변경 처리
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // 검색 실행
  const handleSearch = () => {
    setError('');
    fetchSales(1, true);
  };

  // 필터 초기화
  const handleClearFilters = () => {
    setFilters({
      customer: '',
      item: '',
      startDate: '',
      endDate: '',
      minAmount: '',
      maxAmount: ''
    });
    
    // 필터 초기화 후 자동 검색
    setTimeout(() => {
      fetchSales(1, true);
    }, 100);
  };

  // 페이지 변경
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      fetchSales(newPage);
    }
  };

  // 엑셀 내보내기
  const handleExport = async () => {
    try {
      setExporting(true);
      setError('');

      const queryParams = new URLSearchParams(filters);
      const response = await fetch(`http://localhost:3001/api/sales/export?${queryParams}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '엑셀 내보내기에 실패했습니다.');
      }

      // 파일 다운로드
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      // 파일명 추출 (Content-Disposition 헤더에서)
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `매출데이터_${new Date().toISOString().split('T')[0]}.xlsx`;
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename\*=UTF-8''(.+)/);
        if (filenameMatch) {
          filename = decodeURIComponent(filenameMatch[1]);
        }
      }

      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setSuccess('엑셀 파일이 성공적으로 다운로드되었습니다.');

    } catch (err) {
      setError(err.message);
    } finally {
      setExporting(false);
    }
  };

  // 금액 포맷팅
  const formatAmount = (amount) => {
    return amount ? amount.toLocaleString() : '-';
  };

  // 날짜 포맷팅
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('ko-KR');
  };

  return (
    <div className="sales-management">
      <div className="sales-header">
        <h2>매출 관리</h2>
        <div className="header-actions">
          <button 
            className="btn-export"
            onClick={handleExport}
            disabled={exporting || sales.length === 0}
          >
            {exporting ? '내보내는 중...' : '📊 엑셀 내보내기'}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* 검색 필터 */}
      <div className="filter-section">
        <div className="filter-title">
          <h3>검색 필터</h3>
          <button className="btn-clear" onClick={handleClearFilters}>
            초기화
          </button>
        </div>
        
        <div className="filter-grid">
          <div className="filter-group">
            <label>거래처명</label>
            <input
              type="text"
              name="customer"
              value={filters.customer}
              onChange={handleFilterChange}
              placeholder="거래처명으로 검색"
            />
          </div>
          
          <div className="filter-group">
            <label>품목명</label>
            <input
              type="text"
              name="item"
              value={filters.item}
              onChange={handleFilterChange}
              placeholder="품목명으로 검색"
            />
          </div>
          
          <div className="filter-group">
            <label>시작일</label>
            <input
              type="date"
              name="startDate"
              value={filters.startDate}
              onChange={handleFilterChange}
            />
          </div>
          
          <div className="filter-group">
            <label>종료일</label>
            <input
              type="date"
              name="endDate"
              value={filters.endDate}
              onChange={handleFilterChange}
            />
          </div>
          
          <div className="filter-group">
            <label>최소 금액</label>
            <input
              type="number"
              name="minAmount"
              value={filters.minAmount}
              onChange={handleFilterChange}
              placeholder="0"
              min="0"
            />
          </div>
          
          <div className="filter-group">
            <label>최대 금액</label>
            <input
              type="number"
              name="maxAmount"
              value={filters.maxAmount}
              onChange={handleFilterChange}
              placeholder="제한없음"
              min="0"
            />
          </div>
        </div>
        
        <div className="filter-actions">
          <button className="btn-primary" onClick={handleSearch}>
            🔍 검색
          </button>
        </div>
      </div>

      {/* 검색 결과 요약 */}
      {!loading && sales.length > 0 && (
        <div className="summary-section">
          <div className="summary-cards">
            <div className="summary-card">
              <h4>검색 결과</h4>
              <p className="summary-value">{pagination.totalCount.toLocaleString()}건</p>
            </div>
            <div className="summary-card">
              <h4>총 매출액</h4>
              <p className="summary-value">{formatAmount(summary.totalAmount)}원</p>
            </div>
            <div className="summary-card">
              <h4>총 이익</h4>
              <p className="summary-value">{formatAmount(summary.totalProfit)}원</p>
            </div>
            <div className="summary-card">
              <h4>평균 거래액</h4>
              <p className="summary-value">{formatAmount(summary.averageAmount)}원</p>
            </div>
          </div>
        </div>
      )}

      {/* 매출 데이터 테이블 */}
      <div className="sales-table-container">
        {loading ? (
          <div className="loading">매출 데이터를 불러오는 중...</div>
        ) : sales.length === 0 ? (
          <div className="no-data">
            검색 조건에 맞는 매출 데이터가 없습니다.
          </div>
        ) : (
          <>
            <table className="sales-table">
              <thead>
                <tr>
                  <th>판매일자</th>
                  <th>거래처명</th>
                  <th>품목명</th>
                  <th>카테고리</th>
                  <th>수량</th>
                  <th>단가</th>
                  <th>공급가액</th>
                  <th>부가세</th>
                  <th>총액</th>
                  <th>이익</th>
                  <th>마진율</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((sale, index) => (
                  <tr key={sale.id || index}>
                    <td>{formatDate(sale.sale_date)}</td>
                    <td className="customer-name">{sale.customer_name}</td>
                    <td className="item-name">{sale.item_name}</td>
                    <td>{sale.item_category}</td>
                    <td className="quantity">{sale.quantity?.toLocaleString()}</td>
                    <td className="amount">{formatAmount(sale.unit_price)}원</td>
                    <td className="amount">{formatAmount(sale.supply_price)}원</td>
                    <td className="amount">{formatAmount(sale.vat_amount)}원</td>
                    <td className="total-amount">{formatAmount(sale.total_amount)}원</td>
                    <td className="profit">{formatAmount(sale.profit_amount)}원</td>
                    <td className="margin">{sale.margin_rate?.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* 페이지네이션 */}
            {pagination.totalPages > 1 && (
              <div className="pagination">
                <button 
                  className="page-btn"
                  onClick={() => handlePageChange(1)}
                  disabled={pagination.currentPage === 1}
                >
                  처음
                </button>
                
                <button 
                  className="page-btn"
                  onClick={() => handlePageChange(pagination.currentPage - 1)}
                  disabled={!pagination.hasPrev}
                >
                  이전
                </button>

                <span className="page-info">
                  {pagination.currentPage} / {pagination.totalPages} 페이지
                </span>

                <button 
                  className="page-btn"
                  onClick={() => handlePageChange(pagination.currentPage + 1)}
                  disabled={!pagination.hasNext}
                >
                  다음
                </button>
                
                <button 
                  className="page-btn"
                  onClick={() => handlePageChange(pagination.totalPages)}
                  disabled={pagination.currentPage === pagination.totalPages}
                >
                  마지막
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default SalesManagement;