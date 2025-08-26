-- JS일렉트로닉 ERP 데이터베이스 스키마
-- 생성일: 2025-08-22
-- 목적: 엑셀 의존성 제거, 고성능 데이터 관리

-- =============================================
-- 1. 거래처 (고객) 테이블
-- =============================================
CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,                    -- 거래처명
    business_number TEXT,                         -- 사업자등록번호
    contact_person TEXT,                          -- 담당자명
    phone TEXT,                                   -- 전화번호
    email TEXT,                                   -- 이메일
    address TEXT,                                 -- 주소
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- 2. 품목 테이블
-- =============================================
CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE,                             -- 품목코드 (ITEM-001)
    name TEXT NOT NULL,                           -- 품목명
    category TEXT DEFAULT '전자부품',               -- 카테고리
    unit TEXT DEFAULT '개',                       -- 단위
    standard_price INTEGER DEFAULT 0,             -- 표준 단가
    description TEXT,                             -- 품목 설명
    is_active BOOLEAN DEFAULT 1,                 -- 사용 여부
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- 3. 매출 거래 테이블 (메인)
-- =============================================
CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,                -- 거래처 ID (FK)
    item_id INTEGER NOT NULL,                    -- 품목 ID (FK)
    sale_date DATE NOT NULL,                     -- 판매일자
    quantity INTEGER NOT NULL DEFAULT 1,         -- 수량
    unit_price INTEGER NOT NULL DEFAULT 0,       -- 단가 (공급가액)
    supply_price INTEGER NOT NULL DEFAULT 0,     -- 공급가액 (단가 * 수량)
    vat_amount INTEGER NOT NULL DEFAULT 0,       -- 부가세
    total_amount INTEGER NOT NULL DEFAULT 0,     -- 총 금액 (공급가액 + 부가세)
    purchase_price INTEGER DEFAULT 0,            -- 매입가
    profit_amount INTEGER DEFAULT 0,             -- 이익금액
    margin_rate REAL DEFAULT 0.0,               -- 마진율 (%)
    invoice_number TEXT,                         -- 세금계산서 번호
    notes TEXT,                                  -- 비고
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- 외래키 제약조건
    FOREIGN KEY (customer_id) REFERENCES customers (id),
    FOREIGN KEY (item_id) REFERENCES items (id)
);

-- =============================================
-- 4. 공급업체 (매입처) 테이블
-- =============================================
CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,                    -- 공급업체명
    business_number TEXT,                         -- 사업자등록번호
    contact_person TEXT,                          -- 담당자명
    phone TEXT,                                   -- 전화번호
    email TEXT,                                   -- 이메일
    address TEXT,                                 -- 주소
    payment_terms TEXT DEFAULT '현금',            -- 결제조건
    notes TEXT,                                   -- 비고
    is_active BOOLEAN DEFAULT 1,                 -- 사용 여부
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- 5. 매입 거래 테이블
-- =============================================
CREATE TABLE IF NOT EXISTS purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER NOT NULL,               -- 공급업체 ID (FK)
    item_id INTEGER NOT NULL,                   -- 품목 ID (FK)
    purchase_date DATE NOT NULL,                -- 매입일자
    quantity INTEGER NOT NULL DEFAULT 1,        -- 수량
    unit_cost INTEGER NOT NULL DEFAULT 0,      -- 매입 단가
    supply_amount INTEGER NOT NULL DEFAULT 0,   -- 공급가액
    vat_amount INTEGER NOT NULL DEFAULT 0,      -- 부가세
    total_amount INTEGER NOT NULL DEFAULT 0,    -- 총 금액
    expected_sale_price INTEGER DEFAULT 0,      -- 예상 판매가
    expected_margin REAL DEFAULT 0.0,          -- 예상 마진율
    invoice_number TEXT,                        -- 세금계산서번호
    status TEXT DEFAULT 'ordered',              -- ordered, received, cancelled
    notes TEXT,                                 -- 비고
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- 외래키 제약조건
    FOREIGN KEY (supplier_id) REFERENCES suppliers (id),
    FOREIGN KEY (item_id) REFERENCES items (id)
);

-- =============================================
-- 6. 재고 관리 테이블 (매입-매출 연동)
-- =============================================
CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL UNIQUE,            -- 품목 ID (FK)
    current_stock INTEGER DEFAULT 0,            -- 현재 재고
    min_stock INTEGER DEFAULT 0,               -- 최소 재고
    max_stock INTEGER DEFAULT 0,               -- 최대 재고
    avg_purchase_cost INTEGER DEFAULT 0,        -- 평균 매입가
    last_purchase_date DATE,                    -- 마지막 매입일
    last_sale_date DATE,                       -- 마지막 판매일
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- 외래키 제약조건
    FOREIGN KEY (item_id) REFERENCES items (id)
);

-- =============================================
-- 7. 알림 시스템 테이블
-- =============================================
CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK (type IN ('low_stock', 'high_amount', 'new_customer', 'payment_due', 'system', 'backup')),
    title TEXT NOT NULL,                           -- 알림 제목
    message TEXT NOT NULL,                         -- 알림 메시지
    data TEXT,                                     -- 관련 데이터 (JSON 형태)
    is_read BOOLEAN DEFAULT FALSE,                 -- 읽음 여부
    priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,                           -- 만료일시 (NULL이면 만료되지 않음)
    related_id INTEGER,                            -- 관련 레코드 ID (고객, 품목 등)
    related_type TEXT                              -- 관련 타입 (customer, item, sale, purchase 등)
);

-- =============================================
-- 8. 업로드 파일 이력 테이블
-- =============================================
CREATE TABLE IF NOT EXISTS file_uploads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    original_filename TEXT NOT NULL,             -- 원본 파일명
    stored_filename TEXT NOT NULL,               -- 저장된 파일명
    file_path TEXT NOT NULL,                     -- 파일 경로
    file_size INTEGER,                           -- 파일 크기
    sheet_name TEXT,                            -- 분석한 시트명
    total_records INTEGER DEFAULT 0,             -- 처리된 레코드 수
    success_count INTEGER DEFAULT 0,             -- 성공 레코드 수
    error_count INTEGER DEFAULT 0,              -- 오류 레코드 수
    upload_status TEXT DEFAULT 'processing',     -- processing, completed, failed
    error_message TEXT,                         -- 오류 메시지
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- 인덱스 생성 (성능 최적화)
-- =============================================

-- 고객 검색 최적화
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);

-- 품목 검색 최적화
CREATE INDEX IF NOT EXISTS idx_items_name ON items(name);
CREATE INDEX IF NOT EXISTS idx_items_code ON items(code);
CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);

-- 매출 데이터 검색 최적화 (가장 중요)
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_item_id ON sales(item_id);
CREATE INDEX IF NOT EXISTS idx_sales_date_customer ON sales(sale_date, customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);

-- 파일 업로드 이력 최적화
CREATE INDEX IF NOT EXISTS idx_file_uploads_date ON file_uploads(uploaded_at);
CREATE INDEX IF NOT EXISTS idx_file_uploads_status ON file_uploads(upload_status);

-- 공급업체 검색 최적화
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);
CREATE INDEX IF NOT EXISTS idx_suppliers_active ON suppliers(is_active);

-- 매입 데이터 검색 최적화
CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(purchase_date);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier_id ON purchases(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchases_item_id ON purchases(item_id);
CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases(status);
CREATE INDEX IF NOT EXISTS idx_purchases_date_supplier ON purchases(purchase_date, supplier_id);

-- 재고 관리 최적화
CREATE INDEX IF NOT EXISTS idx_inventory_item_id ON inventory(item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_stock ON inventory(current_stock);

-- 알림 시스템 최적화
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_priority ON notifications(priority);
CREATE INDEX IF NOT EXISTS idx_notifications_expires ON notifications(expires_at);

-- =============================================
-- 초기 데이터 (기본 카테고리 등)
-- =============================================

-- 기본 품목 카테고리
INSERT OR IGNORE INTO items (code, name, category, unit, standard_price, description) VALUES
('DEFAULT-001', '기본품목', '전자부품', '개', 0, '시스템 기본 품목');

-- =============================================
-- 뷰 생성 (자주 사용하는 조인 쿼리 최적화)
-- =============================================

-- 매출 상세 뷰 (고객명, 품목명 포함)
CREATE VIEW IF NOT EXISTS sales_detail AS
SELECT 
    s.id,
    s.sale_date,
    c.name as customer_name,
    i.name as item_name,
    i.code as item_code,
    i.category as item_category,
    s.quantity,
    s.unit_price,
    s.supply_price,
    s.vat_amount,
    s.total_amount,
    s.purchase_price,
    s.profit_amount,
    s.margin_rate,
    s.invoice_number,
    s.notes,
    s.created_at,
    s.updated_at
FROM sales s
JOIN customers c ON s.customer_id = c.id
JOIN items i ON s.item_id = i.id;

-- 고객별 매출 통계 뷰
CREATE VIEW IF NOT EXISTS customer_sales_summary AS
SELECT 
    c.id as customer_id,
    c.name as customer_name,
    COUNT(s.id) as total_transactions,
    SUM(s.total_amount) as total_sales,
    SUM(s.profit_amount) as total_profit,
    AVG(s.margin_rate) as avg_margin_rate,
    MAX(s.sale_date) as last_sale_date,
    MIN(s.sale_date) as first_sale_date
FROM customers c
LEFT JOIN sales s ON c.id = s.customer_id
GROUP BY c.id, c.name;

-- 품목별 매출 통계 뷰
CREATE VIEW IF NOT EXISTS item_sales_summary AS
SELECT 
    i.id as item_id,
    i.code as item_code,
    i.name as item_name,
    i.category as item_category,
    COUNT(s.id) as total_transactions,
    SUM(s.quantity) as total_quantity_sold,
    SUM(s.total_amount) as total_revenue,
    SUM(s.profit_amount) as total_profit,
    AVG(s.margin_rate) as avg_margin_rate,
    AVG(s.unit_price) as avg_unit_price,
    MAX(s.sale_date) as last_sale_date
FROM items i
LEFT JOIN sales s ON i.id = s.item_id
WHERE i.is_active = 1
GROUP BY i.id, i.code, i.name, i.category;

-- 매입 상세 뷰 (공급업체명, 품목명 포함)
CREATE VIEW IF NOT EXISTS purchase_detail AS
SELECT 
    p.id,
    p.purchase_date,
    sup.name as supplier_name,
    i.name as item_name,
    i.code as item_code,
    i.category as item_category,
    p.quantity,
    p.unit_cost,
    p.supply_amount,
    p.vat_amount,
    p.total_amount,
    p.expected_sale_price,
    p.expected_margin,
    p.invoice_number,
    p.status,
    p.notes,
    p.created_at,
    p.updated_at
FROM purchases p
JOIN suppliers sup ON p.supplier_id = sup.id
JOIN items i ON p.item_id = i.id;

-- 공급업체별 매입 통계 뷰
CREATE VIEW IF NOT EXISTS supplier_purchase_summary AS
SELECT 
    sup.id as supplier_id,
    sup.name as supplier_name,
    COUNT(p.id) as total_transactions,
    SUM(p.total_amount) as total_purchases,
    AVG(p.unit_cost) as avg_unit_cost,
    MAX(p.purchase_date) as last_purchase_date,
    MIN(p.purchase_date) as first_purchase_date
FROM suppliers sup
LEFT JOIN purchases p ON sup.id = p.supplier_id
WHERE sup.is_active = 1
GROUP BY sup.id, sup.name;

-- 품목별 매입-매출 비교 뷰
CREATE VIEW IF NOT EXISTS item_profit_analysis AS
SELECT 
    i.id as item_id,
    i.code as item_code,
    i.name as item_name,
    i.category as item_category,
    COALESCE(SUM(p.total_amount), 0) as total_purchase_cost,
    COALESCE(SUM(s.total_amount), 0) as total_sales_revenue,
    COALESCE(SUM(s.profit_amount), 0) as total_profit,
    COALESCE(SUM(p.quantity), 0) as total_purchased,
    COALESCE(SUM(s.quantity), 0) as total_sold,
    COALESCE(inv.current_stock, 0) as current_stock,
    CASE 
        WHEN SUM(p.total_amount) > 0 THEN 
            (SUM(s.total_amount) - SUM(p.total_amount)) * 100.0 / SUM(p.total_amount)
        ELSE 0 
    END as profit_margin_percent
FROM items i
LEFT JOIN purchases p ON i.id = p.item_id
LEFT JOIN sales s ON i.id = s.item_id
LEFT JOIN inventory inv ON i.id = inv.item_id
WHERE i.is_active = 1
GROUP BY i.id, i.code, i.name, i.category;

-- =============================================
-- 트리거 (데이터 일관성 보장)
-- =============================================

-- 매출 데이터 삽입 시 자동 계산 (트리거 제거 - 애플리케이션에서 처리)
-- CREATE TRIGGER는 SQLite에서 복잡한 계산에 제한이 있으므로 제거

-- 수정 시간 자동 업데이트
CREATE TRIGGER IF NOT EXISTS customers_update_timestamp
    AFTER UPDATE ON customers
    FOR EACH ROW
BEGIN
    UPDATE customers SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS items_update_timestamp
    AFTER UPDATE ON items
    FOR EACH ROW
BEGIN
    UPDATE items SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS sales_update_timestamp
    AFTER UPDATE ON sales
    FOR EACH ROW
BEGIN
    UPDATE sales SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- 공급업체 수정 시간 자동 업데이트
CREATE TRIGGER IF NOT EXISTS suppliers_update_timestamp
    AFTER UPDATE ON suppliers
    FOR EACH ROW
BEGIN
    UPDATE suppliers SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- 매입 수정 시간 자동 업데이트
CREATE TRIGGER IF NOT EXISTS purchases_update_timestamp
    AFTER UPDATE ON purchases
    FOR EACH ROW
BEGIN
    UPDATE purchases SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- 재고 수정 시간 자동 업데이트
CREATE TRIGGER IF NOT EXISTS inventory_update_timestamp
    AFTER UPDATE ON inventory
    FOR EACH ROW
BEGIN
    UPDATE inventory SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;