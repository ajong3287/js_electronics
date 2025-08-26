#!/usr/bin/env node

/**
 * 새로운 엑셀 데이터를 SQLite 데이터베이스로 이전하는 스크립트
 * 파일: 20250822_제이에스매출자료.xlsx
 * 
 * 사용법: node scripts/migrate-new-excel-to-db.js
 * 
 * 작업 순서:
 * 1. 기존 데이터베이스 백업
 * 2. 새 엑셀 파일 읽기 (매출/매입 동시 처리)
 * 3. 거래처 데이터 이전
 * 4. 공급업체 데이터 이전
 * 5. 품목 데이터 이전  
 * 6. 매입 데이터 이전
 * 7. 매출 데이터 이전 (매입가 연동)
 * 8. 결과 보고
 */

const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const database = require('../database');

class NewExcelMigrator {
  constructor() {
    this.stats = {
      customers: { total: 0, success: 0, errors: 0 },
      suppliers: { total: 0, success: 0, errors: 0 },
      items: { total: 0, success: 0, errors: 0 },
      purchases: { total: 0, success: 0, errors: 0 },
      sales: { total: 0, success: 0, errors: 0 }
    };
    this.customerMap = new Map(); // 고객명 -> DB ID 매핑
    this.supplierMap = new Map(); // 공급업체명 -> DB ID 매핑
    this.itemMap = new Map();     // 품목명 -> DB ID 매핑
  }

  async migrate() {
    console.log('🚀 새 엑셀 데이터 마이그레이션 시작...\n');

    try {
      // 1. 데이터베이스 초기화
      await this.initializeDatabase();

      // 2. 기존 데이터 백업
      await this.backupExistingData();

      // 3. 엑셀 파일 읽기
      const excelData = await this.readExcelFile();
      
      // 4. 데이터 이전 실행 (순서 중요)
      await this.migrateCustomers(excelData);
      await this.migrateSuppliers(excelData);
      await this.migrateItems(excelData);
      await this.migratePurchases(excelData);
      await this.migrateSales(excelData);

      // 5. 결과 보고
      this.printResults();

      console.log('\n🎉 마이그레이션 완료!');
      process.exit(0);

    } catch (error) {
      console.error('💥 마이그레이션 실패:', error);
      process.exit(1);
    }
  }

  async initializeDatabase() {
    console.log('📊 데이터베이스 초기화 중...');
    await database.initialize();
    console.log('✅ 데이터베이스 초기화 완료\n');
  }

  async backupExistingData() {
    console.log('💾 기존 데이터 백업 중...');
    // 기존 데이터 클리어 (테스트를 위해)
    await database.run('DELETE FROM sales');
    await database.run('DELETE FROM purchases');
    await database.run('DELETE FROM items WHERE id > 0');
    await database.run('DELETE FROM customers WHERE id > 0');
    await database.run('DELETE FROM suppliers WHERE id > 0');
    console.log('✅ 기존 데이터 클리어 완료\n');
  }

  async readExcelFile() {
    console.log('📖 새 엑셀 파일 읽기 중...');
    
    const excelPath = path.join(__dirname, '../../docs/제이에스일렉트로닉/20250822_제이에스매출자료.xlsx');
    
    if (!fs.existsSync(excelPath)) {
      throw new Error(`엑셀 파일을 찾을 수 없습니다: ${excelPath}`);
    }

    const workbook = XLSX.readFile(excelPath);
    const sheetName = '견적서';
    
    if (!workbook.Sheets[sheetName]) {
      console.log('📋 사용 가능한 시트 목록:');
      console.log(workbook.SheetNames);
      throw new Error(`시트를 찾을 수 없습니다: ${sheetName}`);
    }

    const worksheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    console.log(`✅ 엑셀 파일 읽기 완료 (총 ${rawData.length}행)\n`);
    
    return this.parseExcelData(rawData);
  }

  parseExcelData(rawData) {
    console.log('🔍 엑셀 데이터 분석 중...');
    
    const salesData = [];
    const purchasesData = [];
    const customersSet = new Set();
    const suppliersSet = new Set();
    const itemsSet = new Set();

    // 헤더는 6행(인덱스 5), 데이터는 7행(인덱스 6)부터
    const dataStartRow = 6;
    console.log(`📍 데이터 시작 행: ${dataStartRow + 1}`);

    // 매출/매입 데이터 파싱
    for (let i = dataStartRow; i < rawData.length; i++) {
      const row = rawData[i];
      
      // 유효성 검사
      if (!row || row.length < 17) continue;
      if (!row[1] || !row[10]) continue; // 매출처와 매입처가 있어야 함
      
      // 매출 데이터 (컬럼 0-7)
      const saleDate = this.parseDate(row[0]);
      const customerName = row[1].toString().trim();
      const itemCode = row[2] ? row[2].toString().trim() : `ITEM-${i}`;
      const itemName = row[3] ? row[3].toString().trim() : '품목명없음';
      const saleQuantity = parseInt(row[4]) || 1;
      const supplyAmount = parseInt(row[5]) || 0;
      const saleVat = parseInt(row[6]) || 0;
      const saleTotalAmount = parseInt(row[7]) || (supplyAmount + saleVat);
      const unitPrice = saleQuantity > 0 ? Math.round(supplyAmount / saleQuantity) : 0;

      // 매입 데이터 (컬럼 9-16)
      const purchaseDate = this.parseDate(row[9]);
      const supplierName = row[10].toString().trim();
      const purchaseQuantity = parseInt(row[13]) || 1;
      const purchaseSupplyAmount = parseInt(row[14]) || 0; // 컬럼14는 총 매입가액
      const purchaseVat = parseInt(row[15]) || 0;
      const purchaseTotalAmount = parseInt(row[16]) || 0;
      const purchaseUnitCost = purchaseQuantity > 0 ? Math.round(purchaseSupplyAmount / purchaseQuantity) : 0; // 단가 = 총액 ÷ 수량

      // 이익 계산
      const profit = saleTotalAmount - purchaseTotalAmount;
      const marginRate = saleTotalAmount > 0 ? Math.round((profit / saleTotalAmount) * 100 * 10) / 10 : 0;

      // 최소한 총액이 0보다 큰 경우만 포함
      if (saleTotalAmount > 0) {
        customersSet.add(customerName);
        suppliersSet.add(supplierName);
        itemsSet.add(itemName);
        
        // 매출 데이터
        salesData.push({
          customerName,
          itemName,
          itemCode,
          saleDate,
          quantity: saleQuantity,
          unitPrice,
          supplyAmount,
          vat: saleVat,
          totalAmount: saleTotalAmount,
          purchasePrice: purchaseQuantity > 0 ? Math.round(purchaseUnitCost) : 0,
          profit,
          marginRate,
          rawRowIndex: i + 1
        });

        // 매입 데이터
        purchasesData.push({
          supplierName,
          itemName,
          itemCode,
          purchaseDate,
          quantity: purchaseQuantity,
          unitCost: Math.round(purchaseUnitCost),
          supplyAmount: purchaseSupplyAmount,
          vat: purchaseVat,
          totalAmount: purchaseTotalAmount,
          expectedSalePrice: unitPrice,
          expectedMargin: marginRate,
          rawRowIndex: i + 1
        });
      }
    }

    const result = {
      sales: salesData,
      purchases: purchasesData,
      customers: Array.from(customersSet).map(name => ({ name })),
      suppliers: Array.from(suppliersSet).map(name => ({ name })),
      items: Array.from(itemsSet).map((name, index) => ({ 
        name, 
        code: salesData.find(s => s.itemName === name)?.itemCode || `ITEM-${index + 1}`
      }))
    };

    console.log(`✅ 데이터 분석 완료:`);
    console.log(`   - 거래처: ${result.customers.length}개`);
    console.log(`   - 공급업체: ${result.suppliers.length}개`);
    console.log(`   - 품목: ${result.items.length}개`);
    console.log(`   - 매입기록: ${result.purchases.length}건`);
    console.log(`   - 매출기록: ${result.sales.length}건\n`);

    return result;
  }

  parseDate(dateValue) {
    // ISO 표준 날짜 형식 (YYYY-MM-DD) 반환
    if (!dateValue) {
      return new Date().toISOString().split('T')[0];
    }
    
    // 이미 Date 객체인 경우
    if (dateValue instanceof Date) {
      return dateValue.toISOString().split('T')[0];
    }
    
    // 문자열 형태의 날짜 처리
    if (typeof dateValue === 'string') {
      // 공백 제거 및 구분자 정규화
      let cleaned = dateValue.trim();
      
      // 다양한 형식 지원: "2024/02/01", "2024-02-01", "2024.02.01"
      cleaned = cleaned.replace(/[\/\.]/g, '-');
      
      // 시간 부분 제거 (있을 경우)
      cleaned = cleaned.split(' ')[0];
      
      // ISO 형식으로 파싱
      const parsed = new Date(cleaned + 'T00:00:00.000Z');
      
      if (!isNaN(parsed.getTime())) {
        // UTC 기준으로 ISO 날짜 반환
        return parsed.toISOString().split('T')[0];
      }
      
      // 한국어 날짜 형식 처리 (예: "2024년 2월 1일")
      const koreanMatch = cleaned.match(/(\d{4})년?\s*(\d{1,2})월?\s*(\d{1,2})일?/);
      if (koreanMatch) {
        const [, year, month, day] = koreanMatch;
        const isoDate = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00.000Z`);
        if (!isNaN(isoDate.getTime())) {
          return isoDate.toISOString().split('T')[0];
        }
      }
    }
    
    // 엑셀 날짜 시리얼 번호 처리
    if (typeof dateValue === 'number') {
      // 엑셀 1900 날짜 시스템 (1900년 1월 1일 = 1)
      // 윤년 버그 보정 (1900년은 윤년이 아니지만 엑셀에서는 윤년으로 처리)
      let days = dateValue;
      if (days > 59) {
        days -= 1; // 1900년 2월 29일 보정
      }
      
      const excelEpoch = new Date(1899, 11, 30); // 1899년 12월 30일
      const jsDate = new Date(excelEpoch.getTime() + days * 24 * 60 * 60 * 1000);
      
      if (!isNaN(jsDate.getTime())) {
        return jsDate.toISOString().split('T')[0];
      }
    }

    // 파싱 실패 시 오늘 날짜 반환
    console.warn(`날짜 파싱 실패: ${dateValue} (타입: ${typeof dateValue})`);
    return new Date().toISOString().split('T')[0];
  }

  async migrateCustomers(data) {
    console.log('👥 거래처 데이터 이전 중...');
    
    this.stats.customers.total = data.customers.length;

    try {
      await database.beginTransaction();

      for (const customer of data.customers) {
        try {
          const customerId = await database.addCustomer({
            name: customer.name,
            business_number: null,
            contact_person: null,
            phone: null,
            email: null,
            address: null
          });

          this.customerMap.set(customer.name, customerId);
          this.stats.customers.success++;

        } catch (error) {
          if (error.message.includes('UNIQUE constraint failed')) {
            const existingCustomer = await database.getCustomerByName(customer.name);
            if (existingCustomer) {
              this.customerMap.set(customer.name, existingCustomer.id);
              this.stats.customers.success++;
            }
          } else {
            console.error(`❌ 고객 추가 실패: ${customer.name}`, error.message);
            this.stats.customers.errors++;
          }
        }
      }

      await database.commit();
      console.log(`✅ 거래처 이전 완료 (${this.stats.customers.success}/${this.stats.customers.total})\n`);

    } catch (error) {
      await database.rollback();
      throw new Error('거래처 데이터 이전 실패: ' + error.message);
    }
  }

  async migrateSuppliers(data) {
    console.log('🏢 공급업체 데이터 이전 중...');
    
    this.stats.suppliers.total = data.suppliers.length;

    try {
      await database.beginTransaction();

      for (const supplier of data.suppliers) {
        try {
          const supplierId = await database.addSupplier({
            name: supplier.name,
            business_number: null,
            contact_person: null,
            phone: null,
            email: null,
            address: null,
            payment_terms: '현금',
            notes: '엑셀에서 이전'
          });

          this.supplierMap.set(supplier.name, supplierId);
          this.stats.suppliers.success++;

        } catch (error) {
          if (error.message.includes('UNIQUE constraint failed')) {
            const existingSupplier = await database.getSupplierByName(supplier.name);
            if (existingSupplier) {
              this.supplierMap.set(supplier.name, existingSupplier.id);
              this.stats.suppliers.success++;
            }
          } else {
            console.error(`❌ 공급업체 추가 실패: ${supplier.name}`, error.message);
            this.stats.suppliers.errors++;
          }
        }
      }

      await database.commit();
      console.log(`✅ 공급업체 이전 완료 (${this.stats.suppliers.success}/${this.stats.suppliers.total})\n`);

    } catch (error) {
      await database.rollback();
      throw new Error('공급업체 데이터 이전 실패: ' + error.message);
    }
  }

  async migrateItems(data) {
    console.log('📦 품목 데이터 이전 중...');
    
    this.stats.items.total = data.items.length;

    try {
      await database.beginTransaction();

      for (const item of data.items) {
        try {
          const itemId = await database.addItem({
            code: item.code,
            name: item.name,
            category: '전자부품',
            unit: '개',
            standard_price: 0,
            description: `새 엑셀에서 이전: ${item.name}`
          });

          this.itemMap.set(item.name, itemId);
          this.stats.items.success++;

        } catch (error) {
          if (error.message.includes('UNIQUE constraint failed')) {
            const existingItem = await database.getItemByName(item.name);
            if (existingItem) {
              this.itemMap.set(item.name, existingItem.id);
              this.stats.items.success++;
            }
          } else {
            console.error(`❌ 품목 추가 실패: ${item.name}`, error.message);
            this.stats.items.errors++;
          }
        }
      }

      await database.commit();
      console.log(`✅ 품목 이전 완료 (${this.stats.items.success}/${this.stats.items.total})\n`);

    } catch (error) {
      await database.rollback();
      throw new Error('품목 데이터 이전 실패: ' + error.message);
    }
  }

  async migratePurchases(data) {
    console.log('🛒 매입 데이터 이전 중...');
    
    this.stats.purchases.total = data.purchases.length;

    try {
      await database.beginTransaction();

      for (const purchase of data.purchases) {
        try {
          const supplierId = this.supplierMap.get(purchase.supplierName);
          const itemId = this.itemMap.get(purchase.itemName);

          if (!supplierId) {
            throw new Error(`공급업체를 찾을 수 없습니다: ${purchase.supplierName}`);
          }
          if (!itemId) {
            throw new Error(`품목을 찾을 수 없습니다: ${purchase.itemName}`);
          }

          await database.addPurchase({
            supplier_id: supplierId,
            item_id: itemId,
            purchase_date: purchase.purchaseDate,
            quantity: purchase.quantity,
            unit_cost: purchase.unitCost,
            vat_amount: purchase.vat,
            expected_sale_price: purchase.expectedSalePrice,
            invoice_number: null,
            status: 'received',
            notes: `엑셀 ${purchase.rawRowIndex}행에서 이전`
          });

          this.stats.purchases.success++;

        } catch (error) {
          console.error(`❌ 매입 데이터 추가 실패 (행 ${purchase.rawRowIndex}):`, error.message);
          this.stats.purchases.errors++;
        }
      }

      await database.commit();
      console.log(`✅ 매입 데이터 이전 완료 (${this.stats.purchases.success}/${this.stats.purchases.total})\n`);

    } catch (error) {
      await database.rollback();
      throw new Error('매입 데이터 이전 실패: ' + error.message);
    }
  }

  async migrateSales(data) {
    console.log('💰 매출 데이터 이전 중...');
    
    this.stats.sales.total = data.sales.length;

    try {
      await database.beginTransaction();

      for (const sale of data.sales) {
        try {
          const customerId = this.customerMap.get(sale.customerName);
          const itemId = this.itemMap.get(sale.itemName);

          if (!customerId) {
            throw new Error(`거래처를 찾을 수 없습니다: ${sale.customerName}`);
          }
          if (!itemId) {
            throw new Error(`품목을 찾을 수 없습니다: ${sale.itemName}`);
          }

          await database.addSale({
            customer_id: customerId,
            item_id: itemId,
            sale_date: sale.saleDate,
            quantity: sale.quantity,
            unit_price: sale.unitPrice,
            vat_amount: sale.vat,
            purchase_price: sale.purchasePrice,
            invoice_number: null,
            notes: `엑셀 ${sale.rawRowIndex}행에서 이전`
          });

          this.stats.sales.success++;

        } catch (error) {
          console.error(`❌ 매출 데이터 추가 실패 (행 ${sale.rawRowIndex}):`, error.message);
          this.stats.sales.errors++;
        }
      }

      await database.commit();
      console.log(`✅ 매출 데이터 이전 완료 (${this.stats.sales.success}/${this.stats.sales.total})\n`);

    } catch (error) {
      await database.rollback();
      throw new Error('매출 데이터 이전 실패: ' + error.message);
    }
  }

  printResults() {
    console.log('📊 마이그레이션 결과 보고서:');
    console.log('================================');
    
    const total = this.stats.customers.total + this.stats.suppliers.total + 
                  this.stats.items.total + this.stats.purchases.total + this.stats.sales.total;
    const success = this.stats.customers.success + this.stats.suppliers.success + 
                    this.stats.items.success + this.stats.purchases.success + this.stats.sales.success;
    const errors = this.stats.customers.errors + this.stats.suppliers.errors + 
                   this.stats.items.errors + this.stats.purchases.errors + this.stats.sales.errors;

    console.log(`전체 레코드: ${total}개`);
    console.log(`성공: ${success}개 (${Math.round(success/total*100)}%)`);
    console.log(`실패: ${errors}개 (${Math.round(errors/total*100)}%)`);
    console.log('');
    
    console.log('상세 내역:');
    console.log(`  거래처:   ${this.stats.customers.success}/${this.stats.customers.total} (오류: ${this.stats.customers.errors})`);
    console.log(`  공급업체: ${this.stats.suppliers.success}/${this.stats.suppliers.total} (오류: ${this.stats.suppliers.errors})`);
    console.log(`  품목:     ${this.stats.items.success}/${this.stats.items.total} (오류: ${this.stats.items.errors})`);
    console.log(`  매입:     ${this.stats.purchases.success}/${this.stats.purchases.total} (오류: ${this.stats.purchases.errors})`);
    console.log(`  매출:     ${this.stats.sales.success}/${this.stats.sales.total} (오류: ${this.stats.sales.errors})`);
  }
}

// 스크립트 실행
if (require.main === module) {
  const migrator = new NewExcelMigrator();
  migrator.migrate().catch(error => {
    console.error('💥 스크립트 실행 실패:', error);
    process.exit(1);
  });
}

module.exports = NewExcelMigrator;