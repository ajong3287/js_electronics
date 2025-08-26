import React, { useState, useEffect } from 'react';
import '../PurchaseManagement.css';

const PurchaseManagement = () => {
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // 모달 상태
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add', 'edit', 'view'
  const [selectedPurchase, setSelectedPurchase] = useState(null);

  // 폼 데이터
  const [formData, setFormData] = useState({
    supplier_id: '',
    item_id: '',
    purchase_date: new Date().toISOString().split('T')[0],
    quantity: 1,
    unit_cost: 0,
    vat_amount: 0,
    expected_sale_price: 0,
    invoice_number: '',
    status: 'ordered',
    notes: ''
  });

  // 필터 상태
  const [filters, setFilters] = useState({
    supplier: '',
    item: '',
    status: '',
    startDate: '',
    endDate: ''
  });

  // 매입 목록 조회
  const fetchPurchases = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      
      Object.keys(filters).forEach(key => {
        if (filters[key]) {
          queryParams.append(key, filters[key]);
        }
      });

      const response = await fetch(`http://localhost:3001/api/purchases?${queryParams}`);
      if (!response.ok) {
        throw new Error('매입 데이터 조회에 실패했습니다.');
      }
      
      const data = await response.json();
      setPurchases(data.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 공급업체 및 품목 목록 조회
  const fetchMasterData = async () => {
    try {
      const [suppliersRes, itemsRes] = await Promise.all([
        fetch('http://localhost:3001/api/suppliers'),
        fetch('http://localhost:3001/api/items')
      ]);

      if (suppliersRes.ok) {
        const suppliersData = await suppliersRes.json();
        setSuppliers(suppliersData.data || []);
      }

      if (itemsRes.ok) {
        const itemsData = await itemsRes.json();
        setItems(itemsData.data || []);
      }
    } catch (err) {
      console.error('마스터 데이터 조회 실패:', err);
    }
  };

  // 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    fetchPurchases();
    fetchMasterData();
  }, []);

  // 필터 변경 시 재조회
  useEffect(() => {
    fetchPurchases();
  }, [filters]);

  // 폼 데이터 변경 처리
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // 필터 변경 처리
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // 모달 열기
  const openModal = (mode, purchase = null) => {
    setModalMode(mode);
    setSelectedPurchase(purchase);
    
    if (mode === 'add') {
      setFormData({
        supplier_id: '',
        item_id: '',
        purchase_date: new Date().toISOString().split('T')[0],
        quantity: 1,
        unit_cost: 0,
        vat_amount: 0,
        expected_sale_price: 0,
        invoice_number: '',
        status: 'ordered',
        notes: ''
      });
    } else if (purchase) {
      setFormData({
        supplier_id: purchase.supplier_id || '',
        item_id: purchase.item_id || '',
        purchase_date: purchase.purchase_date || '',
        quantity: purchase.quantity || 1,
        unit_cost: purchase.unit_cost || 0,
        vat_amount: purchase.vat_amount || 0,
        expected_sale_price: purchase.expected_sale_price || 0,
        invoice_number: purchase.invoice_number || '',
        status: purchase.status || 'ordered',
        notes: purchase.notes || ''
      });
    }
    
    setShowModal(true);
    setError('');
    setSuccess('');
  };

  // 모달 닫기
  const closeModal = () => {
    setShowModal(false);
    setSelectedPurchase(null);
    setFormData({
      supplier_id: '',
      item_id: '',
      purchase_date: new Date().toISOString().split('T')[0],
      quantity: 1,
      unit_cost: 0,
      vat_amount: 0,
      expected_sale_price: 0,
      invoice_number: '',
      status: 'ordered',
      notes: ''
    });
  };

  // 매입 저장 (추가/수정)
  const handleSave = async (e) => {
    e.preventDefault();
    
    try {
      // 유효성 검사
      if (!formData.supplier_id || !formData.item_id) {
        setError('공급업체와 품목을 선택해주세요.');
        return;
      }

      if (formData.quantity <= 0 || formData.unit_cost <= 0) {
        setError('수량과 단가를 올바르게 입력해주세요.');
        return;
      }

      const url = modalMode === 'add' 
        ? 'http://localhost:3001/api/purchases'
        : `http://localhost:3001/api/purchases/${selectedPurchase.id}`;
      
      const method = modalMode === 'add' ? 'POST' : 'PUT';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '매입 저장에 실패했습니다.');
      }

      const result = await response.json();
      setSuccess(result.message);
      
      // 목록 새로고침
      await fetchPurchases();
      
      // 모달 닫기
      closeModal();

    } catch (err) {
      setError(err.message);
    }
  };

  // 매입 삭제
  const handleDelete = async (purchase) => {
    if (!window.confirm(`'${purchase.supplier_name} - ${purchase.item_name}' 매입을 정말 삭제하시겠습니까?`)) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:3001/api/purchases/${purchase.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('매입 삭제에 실패했습니다.');
      }

      const result = await response.json();
      setSuccess(result.message);
      
      // 목록 새로고침
      await fetchPurchases();

    } catch (err) {
      setError(err.message);
    }
  };

  // 상태 한글 변환
  const getStatusText = (status) => {
    switch(status) {
      case 'ordered': return '주문완료';
      case 'received': return '입고완료';
      case 'cancelled': return '취소';
      default: return status;
    }
  };

  // 상태 색상 클래스
  const getStatusClass = (status) => {
    switch(status) {
      case 'ordered': return 'status-ordered';
      case 'received': return 'status-received';
      case 'cancelled': return 'status-cancelled';
      default: return '';
    }
  };

  // 금액 포맷팅
  const formatAmount = (amount) => {
    return amount ? amount.toLocaleString() : '0';
  };

  // 엑셀 내보내기
  const handleExport = async () => {
    try {
      const queryParams = new URLSearchParams(filters);
      const response = await fetch(`http://localhost:3001/api/purchases/export?${queryParams}`);
      
      if (!response.ok) {
        throw new Error('엑셀 내보내기에 실패했습니다.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `매입관리_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setSuccess('엑셀 파일이 다운로드되었습니다.');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="purchase-management">
      <div className="purchase-header">
        <h2>매입 관리</h2>
        <div className="header-buttons">
          <button 
            className="btn-secondary"
            onClick={handleExport}
          >
            엑셀 내보내기
          </button>
          <button 
            className="btn-primary"
            onClick={() => openModal('add')}
          >
            + 매입 추가
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* 필터 영역 */}
      <div className="filter-section">
        <div className="filter-row">
          <div className="filter-group">
            <label>공급업체</label>
            <select 
              name="supplier" 
              value={filters.supplier} 
              onChange={handleFilterChange}
            >
              <option value="">전체</option>
              {suppliers.map(supplier => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>품목</label>
            <select 
              name="item" 
              value={filters.item} 
              onChange={handleFilterChange}
            >
              <option value="">전체</option>
              {items.map(item => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>상태</label>
            <select 
              name="status" 
              value={filters.status} 
              onChange={handleFilterChange}
            >
              <option value="">전체</option>
              <option value="ordered">주문완료</option>
              <option value="received">입고완료</option>
              <option value="cancelled">취소</option>
            </select>
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
        </div>
      </div>

      {/* 매입 목록 */}
      <div className="purchase-table-container">
        {loading ? (
          <div className="loading">매입 데이터를 불러오는 중...</div>
        ) : purchases.length === 0 ? (
          <div className="no-data">
            등록된 매입이 없습니다.<br/>
            '매입 추가' 버튼을 클릭하여 새 매입을 등록해보세요.
          </div>
        ) : (
          <table className="purchase-table">
            <thead>
              <tr>
                <th>매입일자</th>
                <th>공급업체</th>
                <th>품목명</th>
                <th>수량</th>
                <th>단가</th>
                <th>공급가액</th>
                <th>부가세</th>
                <th>총액</th>
                <th>예상판매가</th>
                <th>예상마진율</th>
                <th>상태</th>
                <th>관리</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((purchase) => (
                <tr key={purchase.id}>
                  <td>
                    {new Date(purchase.purchase_date).toLocaleDateString('ko-KR')}
                  </td>
                  <td className="supplier-name">{purchase.supplier_name}</td>
                  <td className="item-name">{purchase.item_name}</td>
                  <td className="quantity">{formatAmount(purchase.quantity)}</td>
                  <td className="amount">{formatAmount(purchase.unit_cost)}원</td>
                  <td className="amount">{formatAmount(purchase.supply_amount)}원</td>
                  <td className="amount">{formatAmount(purchase.vat_amount)}원</td>
                  <td className="amount total">{formatAmount(purchase.total_amount)}원</td>
                  <td className="amount">{formatAmount(purchase.expected_sale_price)}원</td>
                  <td className={`margin ${purchase.expected_margin > 30 ? 'high-margin' : purchase.expected_margin > 20 ? 'medium-margin' : 'low-margin'}`}>
                    {purchase.expected_margin ? purchase.expected_margin.toFixed(1) : '0.0'}%
                  </td>
                  <td>
                    <span className={`status ${getStatusClass(purchase.status)}`}>
                      {getStatusText(purchase.status)}
                    </span>
                  </td>
                  <td className="actions">
                    <button 
                      className="btn-view"
                      onClick={() => openModal('view', purchase)}
                      title="상세 보기"
                    >
                      보기
                    </button>
                    <button 
                      className="btn-edit"
                      onClick={() => openModal('edit', purchase)}
                      title="수정"
                    >
                      수정
                    </button>
                    <button 
                      className="btn-delete"
                      onClick={() => handleDelete(purchase)}
                      title="삭제"
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 모달 */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                {modalMode === 'add' && '매입 추가'}
                {modalMode === 'edit' && '매입 수정'}
                {modalMode === 'view' && '매입 상세 정보'}
              </h3>
              <button className="modal-close" onClick={closeModal}>&times;</button>
            </div>

            <form onSubmit={handleSave} className="modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label>공급업체 *</label>
                  <select
                    name="supplier_id"
                    value={formData.supplier_id}
                    onChange={handleInputChange}
                    disabled={modalMode === 'view'}
                    required
                  >
                    <option value="">공급업체 선택</option>
                    {suppliers.map(supplier => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>품목 *</label>
                  <select
                    name="item_id"
                    value={formData.item_id}
                    onChange={handleInputChange}
                    disabled={modalMode === 'view'}
                    required
                  >
                    <option value="">품목 선택</option>
                    {items.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>매입일자 *</label>
                  <input
                    type="date"
                    name="purchase_date"
                    value={formData.purchase_date}
                    onChange={handleInputChange}
                    disabled={modalMode === 'view'}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>수량 *</label>
                  <input
                    type="number"
                    name="quantity"
                    value={formData.quantity}
                    onChange={handleInputChange}
                    disabled={modalMode === 'view'}
                    min="1"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>매입 단가 *</label>
                  <input
                    type="number"
                    name="unit_cost"
                    value={formData.unit_cost}
                    onChange={handleInputChange}
                    disabled={modalMode === 'view'}
                    min="0"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>부가세</label>
                  <input
                    type="number"
                    name="vat_amount"
                    value={formData.vat_amount}
                    onChange={handleInputChange}
                    disabled={modalMode === 'view'}
                    min="0"
                  />
                </div>

                <div className="form-group">
                  <label>예상 판매가</label>
                  <input
                    type="number"
                    name="expected_sale_price"
                    value={formData.expected_sale_price}
                    onChange={handleInputChange}
                    disabled={modalMode === 'view'}
                    min="0"
                  />
                </div>

                <div className="form-group">
                  <label>상태</label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    disabled={modalMode === 'view'}
                  >
                    <option value="ordered">주문완료</option>
                    <option value="received">입고완료</option>
                    <option value="cancelled">취소</option>
                  </select>
                </div>

                <div className="form-group full-width">
                  <label>세금계산서번호</label>
                  <input
                    type="text"
                    name="invoice_number"
                    value={formData.invoice_number}
                    onChange={handleInputChange}
                    disabled={modalMode === 'view'}
                    placeholder="세금계산서번호를 입력하세요"
                  />
                </div>

                <div className="form-group full-width">
                  <label>비고</label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                    disabled={modalMode === 'view'}
                    placeholder="추가 정보나 특이사항을 입력하세요"
                    rows={3}
                  />
                </div>
              </div>

              {modalMode !== 'view' && (
                <div className="modal-actions">
                  <button type="button" className="btn-cancel" onClick={closeModal}>
                    취소
                  </button>
                  <button type="submit" className="btn-primary">
                    {modalMode === 'add' ? '추가' : '수정'}
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseManagement;