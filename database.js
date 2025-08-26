const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

class Database {
  constructor() {
    this.db = null;
    this.dbPath = path.join(__dirname, 'database', 'erp.db');
    this.schemaPath = path.join(__dirname, 'database', 'schema.sql');
  }

  // 데이터베이스 초기화
  async initialize() {
    try {
      // database 디렉토리가 없으면 생성
      const dbDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
        console.log('📁 데이터베이스 디렉토리 생성:', dbDir);
      }

      // 데이터베이스 연결
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('❌ 데이터베이스 연결 실패:', err.message);
          throw err;
        }
        console.log('✅ SQLite 데이터베이스 연결 성공:', this.dbPath);
      });

      // 스키마 실행
      await this.executeSchema();
      
      console.log('🎉 데이터베이스 초기화 완료!');
      return this.db;

    } catch (error) {
      console.error('💥 데이터베이스 초기화 실패:', error);
      throw error;
    }
  }

  // 스키마 파일 실행
  async executeSchema() {
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(this.schemaPath)) {
        reject(new Error('스키마 파일을 찾을 수 없습니다: ' + this.schemaPath));
        return;
      }

      const schema = fs.readFileSync(this.schemaPath, 'utf8');
      
      this.db.exec(schema, (err) => {
        if (err) {
          console.error('❌ 스키마 실행 실패:', err.message);
          reject(err);
        } else {
          console.log('✅ 데이터베이스 스키마 실행 완료');
          resolve();
        }
      });
    });
  }

  // 쿼리 실행 (SELECT)
  async query(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          console.error('❌ 쿼리 실행 실패:', err.message);
          console.error('📝 SQL:', sql);
          console.error('📊 Parameters:', params);
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // 단일 행 조회
  async get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          console.error('❌ 단일 행 조회 실패:', err.message);
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  // 실행 쿼리 (INSERT, UPDATE, DELETE)
  async run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          console.error('❌ 실행 쿼리 실패:', err.message);
          console.error('📝 SQL:', sql);
          console.error('📊 Parameters:', params);
          reject(err);
        } else {
          resolve({
            id: this.lastID,
            changes: this.changes
          });
        }
      });
    });
  }

  // 트랜잭션 시작
  async beginTransaction() {
    return this.run('BEGIN TRANSACTION');
  }

  // 커밋
  async commit() {
    return this.run('COMMIT');
  }

  // 롤백
  async rollback() {
    return this.run('ROLLBACK');
  }

  // =============================================
  // 비즈니스 로직 메서드들
  // =============================================

  // 고객 관리
  async getCustomers() {
    return this.query(`
      SELECT c.*, 
        COALESCE(cs.total_transactions, 0) as total_transactions,
        COALESCE(cs.total_sales, 0) as total_sales,
        COALESCE(cs.total_profit, 0) as total_profit
      FROM customers c
      LEFT JOIN customer_sales_summary cs ON c.id = cs.customer_id
      ORDER BY c.name
    `);
  }

  async getCustomerById(id) {
    return this.get('SELECT * FROM customers WHERE id = ?', [id]);
  }

  async getCustomerByName(name) {
    return this.get('SELECT * FROM customers WHERE name = ?', [name]);
  }

  async addCustomer(customerData) {
    const { name, business_number, contact_person, phone, email, address } = customerData;
    const result = await this.run(`
      INSERT INTO customers (name, business_number, contact_person, phone, email, address)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [name, business_number, contact_person, phone, email, address]);
    
    return result.id;
  }

  async updateCustomer(id, customerData) {
    const { name, business_number, contact_person, phone, email, address } = customerData;
    return this.run(`
      UPDATE customers 
      SET name = ?, business_number = ?, contact_person = ?, phone = ?, email = ?, address = ?
      WHERE id = ?
    `, [name, business_number, contact_person, phone, email, address, id]);
  }

  async deleteCustomer(id) {
    return this.run('DELETE FROM customers WHERE id = ?', [id]);
  }

  // 품목 관리
  async getItems() {
    return this.query(`
      SELECT i.*,
        COALESCE(iss.total_transactions, 0) as total_transactions,
        COALESCE(iss.total_quantity_sold, 0) as total_quantity_sold,
        COALESCE(iss.total_revenue, 0) as total_revenue,
        COALESCE(iss.total_profit, 0) as total_profit
      FROM items i
      LEFT JOIN item_sales_summary iss ON i.id = iss.item_id
      WHERE i.is_active = 1
      ORDER BY i.name
    `);
  }

  async getItemById(id) {
    return this.get('SELECT * FROM items WHERE id = ?', [id]);
  }

  async getItemByName(name) {
    return this.get('SELECT * FROM items WHERE name = ?', [name]);
  }

  async addItem(itemData) {
    const { code, name, category, unit, standard_price, description } = itemData;
    const result = await this.run(`
      INSERT INTO items (code, name, category, unit, standard_price, description)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [code, name, category || '전자부품', unit || '개', standard_price || 0, description]);
    
    return result.id;
  }

  async updateItem(id, itemData) {
    const { code, name, category, unit, standard_price, description } = itemData;
    return this.run(`
      UPDATE items 
      SET code = ?, name = ?, category = ?, unit = ?, standard_price = ?, description = ?
      WHERE id = ?
    `, [code, name, category, unit, standard_price, description, id]);
  }

  async deleteItem(id) {
    return this.run('DELETE FROM items WHERE id = ?', [id]);
  }

  // 매출 관리
  async getSales(options = {}) {
    const { limit = 1000, offset = 0, startDate, endDate, customerId, itemId } = options;
    
    let whereClause = 'WHERE 1=1';
    const params = [];

    if (startDate) {
      whereClause += ' AND s.sale_date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      whereClause += ' AND s.sale_date <= ?';
      params.push(endDate);
    }
    if (customerId) {
      whereClause += ' AND s.customer_id = ?';
      params.push(customerId);
    }
    if (itemId) {
      whereClause += ' AND s.item_id = ?';
      params.push(itemId);
    }

    params.push(limit, offset);

    return this.query(`
      SELECT s.*,
        c.name as customer_name,
        i.name as item_name,
        i.code as item_code,
        i.category as item_category
      FROM sales s
      JOIN customers c ON s.customer_id = c.id
      JOIN items i ON s.item_id = i.id
      ${whereClause}
      ORDER BY s.sale_date DESC, s.created_at DESC
      LIMIT ? OFFSET ?
    `, params);
  }

  async getSaleById(id) {
    return this.get('SELECT * FROM sales_detail WHERE id = ?', [id]);
  }

  async addSale(saleData) {
    const { 
      customer_id, item_id, sale_date, quantity, unit_price, 
      vat_amount, purchase_price, invoice_number, notes 
    } = saleData;
    
    // 최신 매입가 조회 (매입가가 없는 경우)
    let actualPurchasePrice = purchase_price || 0;
    if (!purchase_price || purchase_price === 0) {
      const latestPurchase = await this.getLatestPurchasePrice(item_id);
      if (latestPurchase) {
        actualPurchasePrice = latestPurchase.unit_cost;
      }
    }
    
    // 자동 계산
    const supply_price = unit_price * quantity;
    const total_amount = supply_price + (vat_amount || 0);
    const profit_amount = total_amount - (actualPurchasePrice * quantity);
    const margin_rate = total_amount > 0 ? (profit_amount / total_amount) * 100 : 0;
    
    const result = await this.run(`
      INSERT INTO sales (
        customer_id, item_id, sale_date, quantity, unit_price, 
        supply_price, vat_amount, total_amount, purchase_price, 
        profit_amount, margin_rate, invoice_number, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      customer_id, item_id, sale_date, quantity, unit_price, 
      supply_price, vat_amount || 0, total_amount, actualPurchasePrice,
      profit_amount, margin_rate, invoice_number, notes
    ]);
    
    return result.id;
  }

  async updateSale(id, saleData) {
    const { 
      customer_id, item_id, sale_date, quantity, unit_price, 
      vat_amount, purchase_price, invoice_number, notes 
    } = saleData;
    
    return this.run(`
      UPDATE sales 
      SET customer_id = ?, item_id = ?, sale_date = ?, quantity = ?, 
          unit_price = ?, vat_amount = ?, purchase_price = ?, 
          invoice_number = ?, notes = ?
      WHERE id = ?
    `, [customer_id, item_id, sale_date, quantity, unit_price, vat_amount, purchase_price, invoice_number, notes, id]);
  }

  async deleteSale(id) {
    return this.run('DELETE FROM sales WHERE id = ?', [id]);
  }

  // =============================================
  // 공급업체 관리
  // =============================================
  async getSuppliers() {
    return this.query(`
      SELECT sup.*, 
        COALESCE(sps.total_transactions, 0) as total_transactions,
        COALESCE(sps.total_purchases, 0) as total_purchases,
        COALESCE(sps.avg_unit_cost, 0) as avg_unit_cost,
        sps.last_purchase_date
      FROM suppliers sup
      LEFT JOIN supplier_purchase_summary sps ON sup.id = sps.supplier_id
      WHERE sup.is_active = 1
      ORDER BY sup.name
    `);
  }

  async getSupplierById(id) {
    return this.get('SELECT * FROM suppliers WHERE id = ?', [id]);
  }

  async getSupplierByName(name) {
    return this.get('SELECT * FROM suppliers WHERE name = ?', [name]);
  }

  async addSupplier(supplierData) {
    const { name, business_number, contact_person, phone, email, address, payment_terms, notes } = supplierData;
    const result = await this.run(`
      INSERT INTO suppliers (name, business_number, contact_person, phone, email, address, payment_terms, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [name, business_number, contact_person, phone, email, address, payment_terms || '현금', notes]);
    
    return result.id;
  }

  async updateSupplier(id, supplierData) {
    const { name, business_number, contact_person, phone, email, address, payment_terms, notes } = supplierData;
    return this.run(`
      UPDATE suppliers 
      SET name = ?, business_number = ?, contact_person = ?, phone = ?, email = ?, address = ?, payment_terms = ?, notes = ?
      WHERE id = ?
    `, [name, business_number, contact_person, phone, email, address, payment_terms, notes, id]);
  }

  async deleteSupplier(id) {
    return this.run('UPDATE suppliers SET is_active = 0 WHERE id = ?', [id]);
  }

  // =============================================
  // 매입 관리
  // =============================================
  async getPurchases(options = {}) {
    const { limit = 1000, offset = 0, startDate, endDate, supplierId, itemId, status } = options;
    
    let whereClause = 'WHERE 1=1';
    const params = [];

    if (startDate) {
      whereClause += ' AND p.purchase_date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      whereClause += ' AND p.purchase_date <= ?';
      params.push(endDate);
    }
    if (supplierId) {
      whereClause += ' AND p.supplier_id = ?';
      params.push(supplierId);
    }
    if (itemId) {
      whereClause += ' AND p.item_id = ?';
      params.push(itemId);
    }
    if (status) {
      whereClause += ' AND p.status = ?';
      params.push(status);
    }

    params.push(limit, offset);

    return this.query(`
      SELECT p.*,
        sup.name as supplier_name,
        i.name as item_name,
        i.code as item_code,
        i.category as item_category
      FROM purchases p
      JOIN suppliers sup ON p.supplier_id = sup.id
      JOIN items i ON p.item_id = i.id
      ${whereClause}
      ORDER BY p.purchase_date DESC, p.created_at DESC
      LIMIT ? OFFSET ?
    `, params);
  }

  async getPurchaseById(id) {
    return this.get('SELECT * FROM purchase_detail WHERE id = ?', [id]);
  }

  async addPurchase(purchaseData) {
    const { 
      supplier_id, item_id, purchase_date, quantity, unit_cost, 
      vat_amount, expected_sale_price, invoice_number, status, notes 
    } = purchaseData;
    
    // 공급가액 = 단가 × 수량
    const supply_amount = unit_cost * quantity;
    const total_amount = supply_amount + (vat_amount || 0);
    
    // 예상 마진율 계산
    const expected_margin = expected_sale_price > 0 
      ? ((expected_sale_price - unit_cost) / expected_sale_price * 100) 
      : 0;
    
    const result = await this.run(`
      INSERT INTO purchases (
        supplier_id, item_id, purchase_date, quantity, unit_cost, 
        supply_amount, vat_amount, total_amount, expected_sale_price, 
        expected_margin, invoice_number, status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      supplier_id, item_id, purchase_date, quantity, unit_cost, 
      supply_amount, vat_amount || 0, total_amount, expected_sale_price || 0, 
      expected_margin, invoice_number, status || 'ordered', notes
    ]);
    
    // 재고 업데이트
    await this.updateInventory(item_id, quantity, unit_cost);
    
    return result.id;
  }

  async updatePurchase(id, purchaseData) {
    const { 
      supplier_id, item_id, purchase_date, quantity, unit_cost, 
      vat_amount, expected_sale_price, invoice_number, status, notes 
    } = purchaseData;
    
    const supply_amount = unit_cost * quantity;
    const total_amount = supply_amount + (vat_amount || 0);
    const expected_margin = expected_sale_price > 0 
      ? ((expected_sale_price - unit_cost) / expected_sale_price * 100) 
      : 0;
    
    return this.run(`
      UPDATE purchases 
      SET supplier_id = ?, item_id = ?, purchase_date = ?, quantity = ?, 
          unit_cost = ?, supply_amount = ?, vat_amount = ?, total_amount = ?,
          expected_sale_price = ?, expected_margin = ?, invoice_number = ?, 
          status = ?, notes = ?
      WHERE id = ?
    `, [
      supplier_id, item_id, purchase_date, quantity, unit_cost, 
      supply_amount, vat_amount, total_amount, expected_sale_price, 
      expected_margin, invoice_number, status, notes, id
    ]);
  }

  async deletePurchase(id) {
    return this.run('DELETE FROM purchases WHERE id = ?', [id]);
  }

  // 품목의 최신 매입가 조회
  async getLatestPurchasePrice(itemId) {
    return this.get(`
      SELECT unit_cost, purchase_date
      FROM purchases
      WHERE item_id = ? AND status = 'received'
      ORDER BY purchase_date DESC, created_at DESC
      LIMIT 1
    `, [itemId]);
  }

  // =============================================
  // 재고 관리
  // =============================================
  async getInventory() {
    return this.query(`
      SELECT inv.*,
        i.name as item_name,
        i.code as item_code,
        i.category as item_category,
        i.standard_price,
        CASE 
          WHEN inv.current_stock <= inv.min_stock THEN 'LOW'
          WHEN inv.current_stock >= inv.max_stock THEN 'HIGH'
          ELSE 'NORMAL'
        END as stock_status
      FROM inventory inv
      JOIN items i ON inv.item_id = i.id
      WHERE i.is_active = 1
      ORDER BY inv.current_stock ASC, i.name
    `);
  }

  async getInventoryByItem(itemId) {
    return this.get(`
      SELECT inv.*,
        i.name as item_name,
        i.code as item_code
      FROM inventory inv
      JOIN items i ON inv.item_id = i.id
      WHERE inv.item_id = ?
    `, [itemId]);
  }

  async updateInventory(itemId, quantityChange, unitCost) {
    // 기존 재고 조회
    const existing = await this.get('SELECT * FROM inventory WHERE item_id = ?', [itemId]);
    
    if (existing) {
      // 기존 재고 업데이트
      const newStock = existing.current_stock + quantityChange;
      const newAvgCost = Math.round(
        (existing.avg_purchase_cost * existing.current_stock + unitCost * quantityChange) / newStock
      );
      
      return this.run(`
        UPDATE inventory 
        SET current_stock = ?, avg_purchase_cost = ?, last_purchase_date = DATE('now')
        WHERE item_id = ?
      `, [newStock, newAvgCost, itemId]);
    } else {
      // 새 재고 생성
      return this.run(`
        INSERT INTO inventory (item_id, current_stock, avg_purchase_cost, last_purchase_date)
        VALUES (?, ?, ?, DATE('now'))
      `, [itemId, quantityChange, unitCost]);
    }
  }

  async setInventoryLimits(itemId, minStock, maxStock) {
    return this.run(`
      UPDATE inventory 
      SET min_stock = ?, max_stock = ?
      WHERE item_id = ?
    `, [minStock, maxStock, itemId]);
  }

  // 통계 및 대시보드 데이터
  async getDashboardStats(year = null, month = null) {
    let dateFilter = '';
    const params = [];

    if (year && month) {
      dateFilter = "WHERE strftime('%Y', s.sale_date) = ? AND strftime('%m', s.sale_date) = ?";
      params.push(year.toString(), month.toString().padStart(2, '0'));
    } else if (year) {
      dateFilter = "WHERE strftime('%Y', s.sale_date) = ?";
      params.push(year.toString());
    }

    const stats = await this.get(`
      SELECT 
        COUNT(s.id) as total_transactions,
        SUM(s.total_amount) as total_sales,
        SUM(s.profit_amount) as total_profit,
        AVG(s.margin_rate) as avg_margin_rate,
        COUNT(DISTINCT s.customer_id) as total_customers,
        COUNT(DISTINCT s.item_id) as total_items
      FROM sales s
      ${dateFilter}
    `, params);

    return stats || {
      total_transactions: 0,
      total_sales: 0,
      total_profit: 0,
      avg_margin_rate: 0,
      total_customers: 0,
      total_items: 0
    };
  }

  // 파일 업로드 이력
  async addFileUpload(uploadData) {
    const { 
      original_filename, stored_filename, file_path, file_size, 
      sheet_name, total_records, success_count, error_count 
    } = uploadData;
    
    const result = await this.run(`
      INSERT INTO file_uploads (
        original_filename, stored_filename, file_path, file_size,
        sheet_name, total_records, success_count, error_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [original_filename, stored_filename, file_path, file_size, sheet_name, total_records, success_count, error_count]);
    
    return result.id;
  }

  async updateFileUploadStatus(id, status, errorMessage = null) {
    return this.run(`
      UPDATE file_uploads 
      SET upload_status = ?, error_message = ?
      WHERE id = ?
    `, [status, errorMessage, id]);
  }

  // 연결 종료
  close() {
    if (this.db) {
      this.db.close((err) => {
        if (err) {
          console.error('❌ 데이터베이스 연결 종료 실패:', err.message);
        } else {
          console.log('✅ 데이터베이스 연결 종료');
        }
      });
    }
  }
}

// 싱글톤 인스턴스
const database = new Database();

module.exports = database;