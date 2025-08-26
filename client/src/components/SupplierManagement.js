import React, { useState, useEffect } from 'react';
import '../SupplierManagement.css';

const SupplierManagement = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // 모달 상태
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add', 'edit', 'view'
  const [selectedSupplier, setSelectedSupplier] = useState(null);

  // 폼 데이터
  const [formData, setFormData] = useState({
    name: '',
    business_number: '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
    payment_terms: '현금',
    notes: ''
  });

  // 공급업체 목록 조회
  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:3001/api/suppliers');
      if (!response.ok) {
        throw new Error('공급업체 데이터 조회에 실패했습니다.');
      }
      
      const data = await response.json();
      setSuppliers(data.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    fetchSuppliers();
  }, []);

  // 폼 데이터 변경 처리
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // 모달 열기
  const openModal = (mode, supplier = null) => {
    setModalMode(mode);
    setSelectedSupplier(supplier);
    
    if (mode === 'add') {
      setFormData({
        name: '',
        business_number: '',
        contact_person: '',
        phone: '',
        email: '',
        address: '',
        payment_terms: '현금',
        notes: ''
      });
    } else if (supplier) {
      setFormData({
        name: supplier.name || '',
        business_number: supplier.business_number || '',
        contact_person: supplier.contact_person || '',
        phone: supplier.phone || '',
        email: supplier.email || '',
        address: supplier.address || '',
        payment_terms: supplier.payment_terms || '현금',
        notes: supplier.notes || ''
      });
    }
    
    setShowModal(true);
    setError('');
    setSuccess('');
  };

  // 모달 닫기
  const closeModal = () => {
    setShowModal(false);
    setSelectedSupplier(null);
    setFormData({
      name: '',
      business_number: '',
      contact_person: '',
      phone: '',
      email: '',
      address: '',
      payment_terms: '현금',
      notes: ''
    });
  };

  // 공급업체 저장 (추가/수정)
  const handleSave = async (e) => {
    e.preventDefault();
    
    try {
      // 유효성 검사
      if (!formData.name.trim()) {
        setError('공급업체명을 입력해주세요.');
        return;
      }

      const url = modalMode === 'add' 
        ? 'http://localhost:3001/api/suppliers'
        : `http://localhost:3001/api/suppliers/${selectedSupplier.id}`;
      
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
        throw new Error(errorData.error || '공급업체 저장에 실패했습니다.');
      }

      const result = await response.json();
      setSuccess(result.message);
      
      // 목록 새로고침
      await fetchSuppliers();
      
      // 모달 닫기
      closeModal();

    } catch (err) {
      setError(err.message);
    }
  };

  // 공급업체 삭제
  const handleDelete = async (supplier) => {
    if (!window.confirm(`'${supplier.name}' 공급업체를 정말 삭제하시겠습니까?`)) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:3001/api/suppliers/${supplier.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('공급업체 삭제에 실패했습니다.');
      }

      const result = await response.json();
      setSuccess(result.message);
      
      // 목록 새로고침
      await fetchSuppliers();

    } catch (err) {
      setError(err.message);
    }
  };

  // 금액 포맷팅
  const formatAmount = (amount) => {
    return amount ? amount.toLocaleString() : '0';
  };

  return (
    <div className="supplier-management">
      <div className="supplier-header">
        <h2>공급업체 관리</h2>
        <button 
          className="btn-primary"
          onClick={() => openModal('add')}
        >
          + 공급업체 추가
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* 공급업체 목록 */}
      <div className="supplier-table-container">
        {loading ? (
          <div className="loading">공급업체 데이터를 불러오는 중...</div>
        ) : suppliers.length === 0 ? (
          <div className="no-data">
            등록된 공급업체가 없습니다.<br/>
            '공급업체 추가' 버튼을 클릭하여 새 공급업체를 등록해보세요.
          </div>
        ) : (
          <table className="supplier-table">
            <thead>
              <tr>
                <th>공급업체명</th>
                <th>사업자번호</th>
                <th>담당자</th>
                <th>연락처</th>
                <th>결제조건</th>
                <th>총 매입액</th>
                <th>거래 횟수</th>
                <th>최근 매입일</th>
                <th>관리</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((supplier) => (
                <tr key={supplier.id}>
                  <td className="supplier-name">{supplier.name}</td>
                  <td>{supplier.business_number || '-'}</td>
                  <td>{supplier.contact_person || '-'}</td>
                  <td>
                    {supplier.phone && (
                      <div>
                        <div>{supplier.phone}</div>
                        {supplier.email && <div className="email">{supplier.email}</div>}
                      </div>
                    )}
                  </td>
                  <td>{supplier.payment_terms || '현금'}</td>
                  <td className="amount">{formatAmount(supplier.total_purchases)}원</td>
                  <td className="count">{supplier.total_transactions}회</td>
                  <td>
                    {supplier.last_purchase_date 
                      ? new Date(supplier.last_purchase_date).toLocaleDateString('ko-KR')
                      : '-'
                    }
                  </td>
                  <td className="actions">
                    <button 
                      className="btn-view"
                      onClick={() => openModal('view', supplier)}
                      title="상세 보기"
                    >
                      보기
                    </button>
                    <button 
                      className="btn-edit"
                      onClick={() => openModal('edit', supplier)}
                      title="수정"
                    >
                      수정
                    </button>
                    <button 
                      className="btn-delete"
                      onClick={() => handleDelete(supplier)}
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
                {modalMode === 'add' && '공급업체 추가'}
                {modalMode === 'edit' && '공급업체 수정'}
                {modalMode === 'view' && '공급업체 상세 정보'}
              </h3>
              <button className="modal-close" onClick={closeModal}>&times;</button>
            </div>

            <form onSubmit={handleSave} className="modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label>공급업체명 *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="공급업체명을 입력하세요"
                    disabled={modalMode === 'view'}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>사업자등록번호</label>
                  <input
                    type="text"
                    name="business_number"
                    value={formData.business_number}
                    onChange={handleInputChange}
                    placeholder="123-45-67890"
                    disabled={modalMode === 'view'}
                  />
                </div>

                <div className="form-group">
                  <label>담당자명</label>
                  <input
                    type="text"
                    name="contact_person"
                    value={formData.contact_person}
                    onChange={handleInputChange}
                    placeholder="담당자명을 입력하세요"
                    disabled={modalMode === 'view'}
                  />
                </div>

                <div className="form-group">
                  <label>전화번호</label>
                  <input
                    type="text"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    placeholder="02-1234-5678"
                    disabled={modalMode === 'view'}
                  />
                </div>

                <div className="form-group">
                  <label>이메일</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="email@company.com"
                    disabled={modalMode === 'view'}
                  />
                </div>

                <div className="form-group">
                  <label>결제조건</label>
                  <select
                    name="payment_terms"
                    value={formData.payment_terms}
                    onChange={handleInputChange}
                    disabled={modalMode === 'view'}
                  >
                    <option value="현금">현금</option>
                    <option value="월말결제">월말결제</option>
                    <option value="30일">30일 후 지급</option>
                    <option value="60일">60일 후 지급</option>
                    <option value="90일">90일 후 지급</option>
                    <option value="기타">기타</option>
                  </select>
                </div>

                <div className="form-group full-width">
                  <label>주소</label>
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    placeholder="주소를 입력하세요"
                    disabled={modalMode === 'view'}
                  />
                </div>

                <div className="form-group full-width">
                  <label>비고</label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                    placeholder="추가 정보나 특이사항을 입력하세요"
                    disabled={modalMode === 'view'}
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

export default SupplierManagement;