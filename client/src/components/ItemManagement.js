import React, { useState, useEffect } from 'react';
import '../ItemManagement.css';

const ItemManagement = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingItem, setEditingItem] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    category: '전자부품',
    unit: '개',
    standard_price: '',
    description: ''
  });

  // 품목 목록 조회
  const fetchItems = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:3001/api/items');
      if (!response.ok) {
        throw new Error('품목 목록 조회에 실패했습니다.');
      }
      const data = await response.json();
      setItems(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  // 폼 초기화
  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      category: '전자부품',
      unit: '개',
      standard_price: '',
      description: ''
    });
    setEditingItem(null);
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

  // 품목 추가/수정
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.name.trim()) {
      setError('품목명은 필수 입력 항목입니다.');
      return;
    }

    try {
      // 표준단가를 숫자로 변환
      const submitData = {
        ...formData,
        standard_price: formData.standard_price ? parseInt(formData.standard_price) : 0
      };

      const url = editingItem 
        ? `http://localhost:3001/api/items/${editingItem.id}`
        : 'http://localhost:3001/api/items';
      
      const method = editingItem ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(submitData)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '저장에 실패했습니다.');
      }

      setSuccess(result.message);
      resetForm();
      fetchItems();
    } catch (err) {
      setError(err.message);
    }
  };

  // 편집 시작
  const handleEdit = (item) => {
    setFormData({
      code: item.code || '',
      name: item.name || '',
      category: item.category || '전자부품',
      unit: item.unit || '개',
      standard_price: item.standard_price || '',
      description: item.description || ''
    });
    setEditingItem(item);
    setShowForm(true);
  };

  // 품목 삭제
  const handleDelete = async (item) => {
    if (!window.confirm(`'${item.name}' 품목을 삭제하시겠습니까?`)) {
      return;
    }

    try {
      setError('');
      const response = await fetch(`http://localhost:3001/api/items/${item.id}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '삭제에 실패했습니다.');
      }

      setSuccess(result.message);
      fetchItems();
    } catch (err) {
      setError(err.message);
    }
  };

  // 가격 포맷팅
  const formatPrice = (price) => {
    return price ? price.toLocaleString() : '-';
  };

  return (
    <div className="item-management">
      <div className="item-header">
        <h2>품목 관리</h2>
        <button 
          className="btn-primary"
          onClick={() => setShowForm(true)}
        >
          + 품목 추가
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {showForm && (
        <div className="modal-overlay">
          <div className="item-form-modal">
            <div className="modal-header">
              <h3>{editingItem ? '품목 정보 수정' : '새 품목 추가'}</h3>
              <button 
                className="btn-close"
                onClick={resetForm}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="item-form">
              <div className="form-row">
                <div className="form-group">
                  <label>품목코드</label>
                  <input
                    type="text"
                    name="code"
                    value={formData.code}
                    onChange={handleInputChange}
                    placeholder="예: ITEM-001 (선택사항)"
                  />
                </div>
                <div className="form-group">
                  <label>품목명 *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    placeholder="품목명을 입력하세요"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>카테고리</label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                  >
                    <option value="전자부품">전자부품</option>
                    <option value="반도체">반도체</option>
                    <option value="센서">센서</option>
                    <option value="모듈">모듈</option>
                    <option value="케이블">케이블</option>
                    <option value="커넥터">커넥터</option>
                    <option value="기타">기타</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>단위</label>
                  <select
                    name="unit"
                    value={formData.unit}
                    onChange={handleInputChange}
                  >
                    <option value="개">개</option>
                    <option value="세트">세트</option>
                    <option value="박스">박스</option>
                    <option value="키트">키트</option>
                    <option value="미터">미터</option>
                    <option value="킬로그램">킬로그램</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>표준 단가 (원)</label>
                <input
                  type="number"
                  name="standard_price"
                  value={formData.standard_price}
                  onChange={handleInputChange}
                  placeholder="0"
                  min="0"
                />
              </div>

              <div className="form-group">
                <label>품목 설명</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows="3"
                  placeholder="품목에 대한 설명을 입력하세요"
                />
              </div>

              <div className="form-buttons">
                <button type="button" className="btn-secondary" onClick={resetForm}>
                  취소
                </button>
                <button type="submit" className="btn-primary">
                  {editingItem ? '수정' : '추가'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="item-table-container">
        {loading ? (
          <div className="loading">품목 목록을 불러오는 중...</div>
        ) : (
          <table className="item-table">
            <thead>
              <tr>
                <th>품목코드</th>
                <th>품목명</th>
                <th>카테고리</th>
                <th>단위</th>
                <th>표준단가</th>
                <th>총 판매량</th>
                <th>총 매출</th>
                <th>설명</th>
                <th>작업</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan="9" className="no-data">
                    등록된 품목이 없습니다.
                  </td>
                </tr>
              ) : (
                items.map(item => (
                  <tr key={item.id}>
                    <td className="item-code">{item.code || '-'}</td>
                    <td className="item-name">{item.name}</td>
                    <td>{item.category}</td>
                    <td>{item.unit}</td>
                    <td className="price">{formatPrice(item.standard_price)}원</td>
                    <td className="quantity">{item.total_quantity_sold || 0}개</td>
                    <td className="revenue">{formatPrice(item.total_revenue)}원</td>
                    <td className="description">
                      {item.description ? 
                        item.description.substring(0, 30) + (item.description.length > 30 ? '...' : '') 
                        : '-'
                      }
                    </td>
                    <td className="action-buttons">
                      <button 
                        className="btn-edit"
                        onClick={() => handleEdit(item)}
                      >
                        수정
                      </button>
                      <button 
                        className="btn-delete"
                        onClick={() => handleDelete(item)}
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

export default ItemManagement;