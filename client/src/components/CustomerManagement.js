import React, { useState, useEffect } from 'react';
import '../CustomerManagement.css';

const CustomerManagement = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    business_number: '',
    contact_person: '',
    phone: '',
    email: '',
    address: ''
  });

  // 고객 목록 조회
  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:3001/api/customers');
      if (!response.ok) {
        throw new Error('고객 목록 조회에 실패했습니다.');
      }
      const data = await response.json();
      setCustomers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  // 폼 초기화
  const resetForm = () => {
    setFormData({
      name: '',
      business_number: '',
      contact_person: '',
      phone: '',
      email: '',
      address: ''
    });
    setEditingCustomer(null);
    setShowForm(false);
  };

  // 폼 입력 처리
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // 고객 추가/수정
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.name.trim()) {
      setError('거래처명은 필수 입력 항목입니다.');
      return;
    }

    try {
      const url = editingCustomer 
        ? `http://localhost:3001/api/customers/${editingCustomer.id}`
        : 'http://localhost:3001/api/customers';
      
      const method = editingCustomer ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '저장에 실패했습니다.');
      }

      setSuccess(result.message);
      resetForm();
      fetchCustomers();
    } catch (err) {
      setError(err.message);
    }
  };

  // 편집 시작
  const handleEdit = (customer) => {
    setFormData({
      name: customer.name || '',
      business_number: customer.business_number || '',
      contact_person: customer.contact_person || '',
      phone: customer.phone || '',
      email: customer.email || '',
      address: customer.address || ''
    });
    setEditingCustomer(customer);
    setShowForm(true);
  };

  // 고객 삭제
  const handleDelete = async (customer) => {
    if (!window.confirm(`'${customer.name}' 고객을 삭제하시겠습니까?`)) {
      return;
    }

    try {
      setError('');
      const response = await fetch(`http://localhost:3001/api/customers/${customer.id}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '삭제에 실패했습니다.');
      }

      setSuccess(result.message);
      fetchCustomers();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="customer-management">
      <div className="customer-header">
        <h2>고객 관리</h2>
        <button 
          className="btn-primary"
          onClick={() => setShowForm(true)}
        >
          + 고객 추가
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {showForm && (
        <div className="modal-overlay">
          <div className="customer-form-modal">
            <div className="modal-header">
              <h3>{editingCustomer ? '고객 정보 수정' : '새 고객 추가'}</h3>
              <button 
                className="btn-close"
                onClick={resetForm}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="customer-form">
              <div className="form-row">
                <div className="form-group">
                  <label>거래처명 *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    placeholder="거래처명을 입력하세요"
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
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>담당자명</label>
                  <input
                    type="text"
                    name="contact_person"
                    value={formData.contact_person}
                    onChange={handleInputChange}
                    placeholder="담당자명을 입력하세요"
                  />
                </div>
                <div className="form-group">
                  <label>전화번호</label>
                  <input
                    type="text"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    placeholder="010-1234-5678"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>이메일</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="email@company.com"
                />
              </div>

              <div className="form-group">
                <label>주소</label>
                <textarea
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  rows="3"
                  placeholder="주소를 입력하세요"
                />
              </div>

              <div className="form-buttons">
                <button type="button" className="btn-secondary" onClick={resetForm}>
                  취소
                </button>
                <button type="submit" className="btn-primary">
                  {editingCustomer ? '수정' : '추가'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="customer-table-container">
        {loading ? (
          <div className="loading">고객 목록을 불러오는 중...</div>
        ) : (
          <table className="customer-table">
            <thead>
              <tr>
                <th>거래처명</th>
                <th>사업자등록번호</th>
                <th>담당자</th>
                <th>전화번호</th>
                <th>이메일</th>
                <th>주소</th>
                <th>작업</th>
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 ? (
                <tr>
                  <td colSpan="7" className="no-data">
                    등록된 고객이 없습니다.
                  </td>
                </tr>
              ) : (
                customers.map(customer => (
                  <tr key={customer.id}>
                    <td className="customer-name">{customer.name}</td>
                    <td>{customer.business_number || '-'}</td>
                    <td>{customer.contact_person || '-'}</td>
                    <td>{customer.phone || '-'}</td>
                    <td>{customer.email || '-'}</td>
                    <td className="customer-address">
                      {customer.address ? customer.address.substring(0, 30) + (customer.address.length > 30 ? '...' : '') : '-'}
                    </td>
                    <td className="action-buttons">
                      <button 
                        className="btn-edit"
                        onClick={() => handleEdit(customer)}
                      >
                        수정
                      </button>
                      <button 
                        className="btn-delete"
                        onClick={() => handleDelete(customer)}
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default CustomerManagement;