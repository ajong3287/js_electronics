import React, { useState, useEffect } from 'react';
import '../Notifications.css';

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [counts, setCounts] = useState({
    urgent: 0,
    high: 0,
    normal: 0,
    low: 0,
    unread_total: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all'); // all, unread, urgent, high
  const [selectedNotifications, setSelectedNotifications] = useState([]);

  // 알림 목록 로드
  const loadNotifications = async (filter = selectedFilter) => {
    try {
      setLoading(true);
      let url = 'http://localhost:3001/api/notifications?limit=100';
      
      if (filter === 'unread') {
        url += '&is_read=false';
      } else if (filter !== 'all') {
        url += `&priority=${filter}`;
      }
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('알림 조회 실패');
      }
      
      const data = await response.json();
      setNotifications(data.notifications);
      setCounts(data.counts);
      setSelectedNotifications([]);
      
    } catch (err) {
      console.error('알림 로드 에러:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 알림 읽음 처리
  const markAsRead = async (notificationId) => {
    try {
      const response = await fetch(`http://localhost:3001/api/notifications/${notificationId}/read`, {
        method: 'PUT'
      });
      
      if (response.ok) {
        setNotifications(notifications.map(notification => 
          notification.id === notificationId 
            ? { ...notification, is_read: true }
            : notification
        ));
        
        // 카운트 업데이트
        setCounts(prevCounts => ({
          ...prevCounts,
          unread_total: Math.max(0, prevCounts.unread_total - 1)
        }));
      }
      
    } catch (error) {
      console.error('알림 읽음 처리 에러:', error);
    }
  };

  // 선택된 알림들 읽음 처리
  const markSelectedAsRead = async () => {
    if (selectedNotifications.length === 0) return;
    
    try {
      const response = await fetch('http://localhost:3001/api/notifications/read-multiple', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedNotifications })
      });
      
      if (response.ok) {
        loadNotifications();
      }
      
    } catch (error) {
      console.error('선택 알림 읽음 처리 에러:', error);
    }
  };

  // 모든 알림 읽음 처리
  const markAllAsRead = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/notifications/read-all', {
        method: 'PUT'
      });
      
      if (response.ok) {
        loadNotifications();
      }
      
    } catch (error) {
      console.error('모든 알림 읽음 처리 에러:', error);
    }
  };

  // 알림 삭제
  const deleteNotification = async (notificationId) => {
    if (!window.confirm('이 알림을 삭제하시겠습니까?')) return;
    
    try {
      const response = await fetch(`http://localhost:3001/api/notifications/${notificationId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        setNotifications(notifications.filter(n => n.id !== notificationId));
      }
      
    } catch (error) {
      console.error('알림 삭제 에러:', error);
    }
  };

  // 읽은 알림 일괄 삭제
  const deleteReadNotifications = async () => {
    if (!window.confirm('읽은 알림을 모두 삭제하시겠습니까?')) return;
    
    try {
      const response = await fetch('http://localhost:3001/api/notifications/read', {
        method: 'DELETE'
      });
      
      if (response.ok) {
        loadNotifications();
      }
      
    } catch (error) {
      console.error('읽은 알림 삭제 에러:', error);
    }
  };

  // 만료된 알림 정리
  const cleanupExpiredNotifications = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/notifications/expired', {
        method: 'DELETE'
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.deletedCount > 0) {
          alert(`${result.deletedCount}개의 만료된 알림이 삭제되었습니다.`);
          loadNotifications();
        } else {
          alert('만료된 알림이 없습니다.');
        }
      }
      
    } catch (error) {
      console.error('만료된 알림 정리 에러:', error);
    }
  };

  // 체크박스 토글
  const toggleNotificationSelection = (notificationId) => {
    setSelectedNotifications(prev => 
      prev.includes(notificationId)
        ? prev.filter(id => id !== notificationId)
        : [...prev, notificationId]
    );
  };

  // 모든 알림 선택/해제
  const toggleSelectAll = () => {
    if (selectedNotifications.length === notifications.length) {
      setSelectedNotifications([]);
    } else {
      setSelectedNotifications(notifications.map(n => n.id));
    }
  };

  // 우선순위 배지 색상
  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return '#e74c3c';
      case 'high': return '#f39c12';
      case 'normal': return '#3498db';
      case 'low': return '#95a5a6';
      default: return '#95a5a6';
    }
  };

  // 우선순위 텍스트
  const getPriorityText = (priority) => {
    switch (priority) {
      case 'urgent': return '긴급';
      case 'high': return '높음';
      case 'normal': return '보통';
      case 'low': return '낮음';
      default: return '보통';
    }
  };

  // 알림 타입 아이콘
  const getTypeIcon = (type) => {
    switch (type) {
      case 'low_stock': return '📦';
      case 'high_amount': return '💰';
      case 'new_customer': return '👤';
      case 'payment_due': return '💳';
      case 'backup': return '💾';
      case 'system': return '⚙️';
      default: return '🔔';
    }
  };

  // 시간 포맷
  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));
    
    if (diffInHours < 1) {
      const diffInMinutes = Math.floor((now - date) / (1000 * 60));
      return `${diffInMinutes}분 전`;
    } else if (diffInHours < 24) {
      return `${diffInHours}시간 전`;
    } else {
      return date.toLocaleDateString('ko-KR');
    }
  };

  useEffect(() => {
    loadNotifications();
    
    // 30초마다 알림 새로고침
    const interval = setInterval(loadNotifications, 30000);
    
    return () => clearInterval(interval);
  }, [selectedFilter]);

  if (loading) {
    return (
      <div className="notifications-container">
        <div className="loading-spinner">알림을 로드하고 있습니다...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="notifications-container">
        <div className="error-message">
          <h3>오류 발생</h3>
          <p>{error}</p>
          <button onClick={() => loadNotifications()} className="retry-button">
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="notifications-container">
      {/* 헤더 */}
      <div className="notifications-header">
        <h2>🔔 알림 센터</h2>
        <div className="notification-counts">
          <span className="count urgent">긴급: {counts.urgent}</span>
          <span className="count high">높음: {counts.high}</span>
          <span className="count normal">보통: {counts.normal}</span>
          <span className="count low">낮음: {counts.low}</span>
          <span className="count total">전체 미읽음: {counts.unread_total}</span>
        </div>
      </div>

      {/* 필터 및 액션 버튼 */}
      <div className="notifications-controls">
        <div className="filter-buttons">
          <button 
            className={selectedFilter === 'all' ? 'active' : ''}
            onClick={() => setSelectedFilter('all')}
          >
            전체
          </button>
          <button 
            className={selectedFilter === 'unread' ? 'active' : ''}
            onClick={() => setSelectedFilter('unread')}
          >
            미읽음 ({counts.unread_total})
          </button>
          <button 
            className={selectedFilter === 'urgent' ? 'active' : ''}
            onClick={() => setSelectedFilter('urgent')}
          >
            긴급 ({counts.urgent})
          </button>
          <button 
            className={selectedFilter === 'high' ? 'active' : ''}
            onClick={() => setSelectedFilter('high')}
          >
            높음 ({counts.high})
          </button>
        </div>

        <div className="action-buttons">
          <button 
            onClick={markAllAsRead}
            disabled={counts.unread_total === 0}
            className="btn-mark-all-read"
          >
            모두 읽음
          </button>
          <button 
            onClick={markSelectedAsRead}
            disabled={selectedNotifications.length === 0}
            className="btn-mark-selected-read"
          >
            선택 읽음 ({selectedNotifications.length})
          </button>
          <button 
            onClick={deleteReadNotifications}
            className="btn-delete-read"
          >
            읽은 알림 삭제
          </button>
          <button 
            onClick={cleanupExpiredNotifications}
            className="btn-cleanup"
          >
            만료 알림 정리
          </button>
        </div>
      </div>

      {/* 알림 목록 */}
      <div className="notifications-list">
        {notifications.length === 0 ? (
          <div className="no-notifications">
            <p>표시할 알림이 없습니다.</p>
          </div>
        ) : (
          <>
            <div className="list-header">
              <label className="select-all">
                <input
                  type="checkbox"
                  checked={selectedNotifications.length === notifications.length}
                  onChange={toggleSelectAll}
                />
                모두 선택
              </label>
              <span className="notification-info">
                총 {notifications.length}개 알림
              </span>
            </div>

            {notifications.map(notification => (
              <div 
                key={notification.id} 
                className={`notification-item ${notification.is_read ? 'read' : 'unread'} ${notification.priority}`}
              >
                <div className="notification-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedNotifications.includes(notification.id)}
                    onChange={() => toggleNotificationSelection(notification.id)}
                  />
                </div>

                <div className="notification-icon">
                  {getTypeIcon(notification.type)}
                </div>

                <div className="notification-content">
                  <div className="notification-header">
                    <h4 className="notification-title">{notification.title}</h4>
                    <div className="notification-meta">
                      <span 
                        className="priority-badge"
                        style={{ backgroundColor: getPriorityColor(notification.priority) }}
                      >
                        {getPriorityText(notification.priority)}
                      </span>
                      <span className="notification-time">
                        {formatTime(notification.created_at)}
                      </span>
                    </div>
                  </div>
                  
                  <p className="notification-message">{notification.message}</p>
                  
                  {notification.data && (
                    <div className="notification-data">
                      <details>
                        <summary>상세 정보</summary>
                        <pre>{JSON.stringify(JSON.parse(notification.data), null, 2)}</pre>
                      </details>
                    </div>
                  )}
                </div>

                <div className="notification-actions">
                  {!notification.is_read && (
                    <button
                      onClick={() => markAsRead(notification.id)}
                      className="btn-mark-read"
                      title="읽음 처리"
                    >
                      ✓
                    </button>
                  )}
                  <button
                    onClick={() => deleteNotification(notification.id)}
                    className="btn-delete"
                    title="삭제"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
};

export default Notifications;