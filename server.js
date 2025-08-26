const express = require('express');
const multer = require('multer');
const ExcelJS = require('exceljs');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const database = require('./database');
const BackupScheduler = require('./scripts/backup-scheduler');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// React 빌드 파일 서빙 (웹 배포용)
app.use(express.static(path.join(__dirname, 'client/build')));

// 백업 스케줄러 인스턴스 생성
const backupScheduler = new BackupScheduler();

// 데이터베이스 초기화
database.initialize().catch(error => {
  console.error('❌ 데이터베이스 초기화 실패:', error);
  process.exit(1);
});

// 파일 업로드 설정
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const clientName = req.body.clientName || 'unknown';
    const dir = `./uploads/${clientName}`;
    
    if (!fs.existsSync(dir)){
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    // 파일명 정제 (Path Traversal 방지)
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, Date.now() + '-' + sanitizedName);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB 제한
    files: 1
  },
  fileFilter: function (req, file, cb) {
    // 허용된 확장자만 업로드
    const allowedExtensions = ['.xlsx', '.xls', '.csv', '.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('허용되지 않은 파일 형식입니다. Excel 또는 PDF 파일만 업로드 가능합니다.'));
    }
  }
});

// 제이에스일렉트로닉 데이터 읽기 (SQLite 기반)
app.get('/api/js-electronics/data', async (req, res) => {
  try {
    // 데이터베이스에서 매출 데이터 조회
    const sales = await database.getSales({ limit: 1000 });
    const customers = await database.getCustomers();
    const items = await database.getItems();
    
    // 프론트엔드 호환성을 위한 데이터 변환
    const transformedSales = sales.map(sale => ({
      id: sale.id,
      customer: sale.customer_name,
      date: sale.sale_date,
      itemName: sale.item_name,
      quantity: sale.quantity,
      supplyPrice: sale.unit_price,
      vat: sale.vat_amount,
      total: sale.total_amount,
      purchasePrice: sale.purchase_price,
      profit: sale.profit_amount,
      marginRate: sale.margin_rate
    }));
    
    const transformedItems = items.map(item => ({
      id: item.id,
      name: item.name,
      totalSold: item.total_quantity_sold || 0,
      totalRevenue: item.total_revenue || 0
    }));
    
    const transformedCustomers = customers.map(customer => ({
      id: customer.id,
      name: customer.name,
      totalTransactions: customer.total_transactions || 0,
      totalAmount: customer.total_sales || 0
    }));
    
    res.json({
      sales: transformedSales,
      items: transformedItems,
      customers: transformedCustomers,
      summary: {
        totalSales: transformedSales.reduce((sum, sale) => sum + sale.total, 0),
        totalTransactions: transformedSales.length,
        totalCustomers: transformedCustomers.length,
        totalItems: transformedItems.length
      }
    });
    
  } catch (error) {
    console.error('❌ 데이터베이스 조회 오류:', error);
    res.status(500).json({ error: '데이터를 읽을 수 없습니다: ' + error.message });
  }
});

// 고객 목록 가져오기
app.get('/api/clients', (req, res) => {
  const clientsDir = './clients';
  if (fs.existsSync(clientsDir)) {
    const clients = fs.readdirSync(clientsDir).filter(file => {
      return fs.statSync(path.join(clientsDir, file)).isDirectory();
    });
    res.json(clients);
  } else {
    res.json([]);
  }
});

// 엑셀 파일 업로드 및 데이터베이스 저장
app.post('/api/upload', upload.single('excel'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '파일이 업로드되지 않았습니다.' });
  }

  try {
    // 파일 업로드 이력 저장
    const uploadId = await database.addFileUpload({
      original_filename: req.file.originalname,
      stored_filename: req.file.filename,
      file_path: req.file.path,
      file_size: req.file.size,
      sheet_name: null,
      total_records: 0,
      success_count: 0,
      error_count: 0
    });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(req.file.path);
    
    // 첫 번째 시트 또는 '판매현황' 포함 시트를 찾아 분석
    let targetSheet = workbook.getWorksheet(1);
    const salesSheetName = workbook.worksheets.find(ws => 
      ws.name.includes('판매') || ws.name.includes('매출') || ws.name.includes('거래')
    );
    if (salesSheetName) targetSheet = salesSheetName;

    // 데이터를 2차원 배열로 변환
    const rawData = [];
    targetSheet.eachRow((row, rowNumber) => {
      const rowData = [];
      row.eachCell((cell, colNumber) => {
        rowData[colNumber - 1] = cell.value;
      });
      rawData.push(rowData);
    });
    
    // 매출 데이터 분석
    const sales = [];
    const customersSet = new Set();
    const itemsSet = new Set();
    let headerRowIndex = -1;
    
    // 헤더 행 찾기
    for (let i = 0; i < Math.min(10, rawData.length); i++) {
      const row = rawData[i];
      if (row && row.length > 5) {
        const rowText = row.join('').toLowerCase();
        if (rowText.includes('거래처') || rowText.includes('고객') || 
            rowText.includes('품목') || rowText.includes('수량') ||
            rowText.includes('금액') || rowText.includes('매출')) {
          headerRowIndex = i;
          break;
        }
      }
    }
    
    const dataStartRow = headerRowIndex + 1;
    let successCount = 0;
    let errorCount = 0;
    
    // 트랜잭션 시작
    await database.beginTransaction();

    try {
      // 데이터 행 분석 및 데이터베이스 저장
      for (let i = dataStartRow; i < rawData.length; i++) {
        const row = rawData[i];
        
        if (!row || row.length < 3) continue;
        if (!row[1] || typeof row[1] !== 'string') continue;
        if (row[1].includes('계') || row[1].includes('합계')) continue;
        
        try {
          const customerName = (row[1] || row[0] || '미정').toString().trim();
          const itemName = (row[3] || row[2] || '품목명 없음').toString().trim();
          const saleDate = parseDate(row[2]);
          const quantity = parseInt(row[4]) || parseInt(row[3]) || 1;
          const unitPrice = parseInt(row[5]) || parseInt(row[4]) || 0;
          const vat = parseInt(row[6]) || parseInt(row[5]) || 0;
          const purchasePrice = parseInt(row[9]) || parseInt(row[8]) || 0;
          
          if (unitPrice > 0) {
            // 거래처 추가 또는 조회
            let customerId;
            try {
              customerId = await database.addCustomer({
                name: customerName,
                business_number: null,
                contact_person: null,
                phone: null,
                email: null,
                address: null
              });
            } catch (error) {
              if (error.message.includes('UNIQUE constraint failed')) {
                const existingCustomer = await database.getCustomerByName(customerName);
                customerId = existingCustomer.id;
              } else {
                throw error;
              }
            }
            
            // 품목 추가 또는 조회
            let itemId;
            try {
              const itemCode = `AUTO-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
              itemId = await database.addItem({
                code: itemCode,
                name: itemName,
                category: '전자부품',
                unit: '개',
                standard_price: unitPrice,
                description: `업로드된 품목: ${itemName}`
              });
            } catch (error) {
              if (error.message.includes('UNIQUE constraint failed')) {
                const existingItem = await database.getItemByName(itemName);
                itemId = existingItem.id;
              } else {
                throw error;
              }
            }
            
            // 매출 데이터 저장
            await database.addSale({
              customer_id: customerId,
              item_id: itemId,
              sale_date: saleDate,
              quantity: quantity,
              unit_price: unitPrice,
              vat_amount: vat,
              purchase_price: purchasePrice,
              invoice_number: null,
              notes: `업로드 파일: ${req.file.originalname}, 행: ${i + 1}`
            });
            
            sales.push({
              id: sales.length + 1,
              customer: customerName,
              date: saleDate,
              itemName: itemName,
              quantity: quantity,
              supplyPrice: unitPrice,
              vat: vat,
              total: unitPrice * quantity + vat,
              purchasePrice: purchasePrice,
              profit: (unitPrice * quantity + vat) - (purchasePrice * quantity),
              marginRate: ((unitPrice * quantity + vat) - (purchasePrice * quantity)) / (unitPrice * quantity + vat) * 100
            });
            
            customersSet.add(customerName);
            itemsSet.add(itemName);
            successCount++;
          }
        } catch (error) {
          console.error(`행 ${i + 1} 처리 실패:`, error);
          errorCount++;
        }
      }
      
      // 커밋
      await database.commit();
      
      // 업로드 이력 업데이트
      await database.updateFileUploadStatus(uploadId, 'completed', null);
      
      const analysisResult = {
        filename: req.file.filename,
        originalName: req.file.originalname,
        uploadPath: req.file.path,
        sheets: sheetNames,
        sales: sales,
        items: Array.from(itemsSet).map((name, index) => ({
          id: index + 1,
          name: name,
          totalSold: 0,
          totalRevenue: 0
        })),
        customers: Array.from(customersSet).map((name, index) => ({
          id: index + 1,
          name: name,
          totalTransactions: 0,
          totalAmount: 0
        })),
        summary: {
          totalSales: sales.reduce((sum, sale) => sum + sale.total, 0),
          totalTransactions: sales.length,
          totalCustomers: customersSet.size,
          totalItems: itemsSet.size,
          analysisDate: new Date().toISOString(),
          sourceSheet: targetSheet,
          successCount: successCount,
          errorCount: errorCount
        }
      };

      res.json(analysisResult);
      
    } catch (error) {
      // 롤백
      await database.rollback();
      await database.updateFileUploadStatus(uploadId, 'failed', error.message);
      throw error;
    }
    
  } catch (error) {
    console.error('엑셀 업로드 및 저장 오류:', error);
    res.status(500).json({ 
      error: '엑셀 파일 업로드 및 저장 실패: ' + error.message,
      details: '파일 형식이나 내용을 확인해주세요.'
    });
  }
});

// 날짜 파싱 함수
function parseDate(dateValue) {
  if (!dateValue) return new Date().toISOString().split('T')[0];
  
  if (dateValue instanceof Date) {
    return dateValue.toISOString().split('T')[0];
  }
  
  if (typeof dateValue === 'string') {
    const parsed = new Date(dateValue);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
  }
  
  if (typeof dateValue === 'number') {
    // 엑셀 날짜 시리얼 번호
    const excelEpoch = new Date(1900, 0, 1);
    const jsDate = new Date(excelEpoch.getTime() + (dateValue - 1) * 24 * 60 * 60 * 1000);
    return jsDate.toISOString().split('T')[0];
  }

  return new Date().toISOString().split('T')[0];
}

// 엑셀 데이터 저장
app.post('/api/save', async (req, res) => {
  const { clientName, filename, data } = req.body;
  
  try {
    const workbook = new ExcelJS.Workbook();
    
    Object.keys(data).forEach(sheetName => {
      const worksheet = workbook.addWorksheet(sheetName);
      worksheet.addRows(data[sheetName]);
    });

    const outputPath = `./clients/${clientName}/${filename}`;
    await workbook.xlsx.writeFile(outputPath);
    
    res.json({ success: true, message: '파일이 저장되었습니다.' });
  } catch (error) {
    res.status(500).json({ error: '파일 저장 실패: ' + error.message });
  }
});

// 엑셀 파일 다운로드
app.get('/api/download/:clientName/:filename', (req, res) => {
  const { clientName, filename } = req.params;
  const filePath = path.join(__dirname, 'clients', clientName, filename);
  
  if (fs.existsSync(filePath)) {
    res.download(filePath);
  } else {
    res.status(404).json({ error: '파일을 찾을 수 없습니다.' });
  }
});

// AI 챗봇 엔드포인트 (데이터베이스 기반)
app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  
  try {
    // 데이터베이스에서 대시보드 통계 가져오기
    const stats = await database.getDashboardStats();
    const customers = await database.getCustomers();
    const sales = await database.getSales({ limit: 100 });
    
    // 메시지 분석 및 응답 생성
    let response = '';
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('매출') || lowerMessage.includes('총매출')) {
      response = `현재 총 매출은 ${(stats.total_sales || 0).toLocaleString()}원입니다. (총 ${stats.total_transactions || 0}건의 거래)`;
    } else if (lowerMessage.includes('거래처') || lowerMessage.includes('고객')) {
      const topCustomers = customers
        .filter(c => c.total_sales > 0)
        .sort((a, b) => (b.total_sales || 0) - (a.total_sales || 0))
        .slice(0, 5);
      
      response = `현재 거래처는 총 ${customers.length}개사입니다.\\n상위 5개 거래처:\\n`;
      topCustomers.forEach(customer => {
        response += `- ${customer.name}: ${(customer.total_sales || 0).toLocaleString()}원\\n`;
      });
    } else if (lowerMessage.includes('최고') || lowerMessage.includes('가장 많')) {
      const topCustomer = customers
        .filter(c => c.total_sales > 0)
        .sort((a, b) => (b.total_sales || 0) - (a.total_sales || 0))[0];
      
      if (topCustomer) {
        response = `가장 매출이 높은 거래처는 ${topCustomer.name}으로 ${(topCustomer.total_sales || 0).toLocaleString()}원입니다.`;
      } else {
        response = '매출 데이터가 없습니다.';
      }
    } else if (lowerMessage.includes('품목') || lowerMessage.includes('제품')) {
      const items = await database.getItems();
      const topItems = items
        .filter(item => item.total_revenue > 0)
        .sort((a, b) => (b.total_revenue || 0) - (a.total_revenue || 0))
        .slice(0, 5);
      
      response = `등록된 품목은 총 ${items.length}개입니다.\\n상위 5개 품목:\\n`;
      topItems.forEach(item => {
        response += `- ${item.name}: ${(item.total_revenue || 0).toLocaleString()}원\\n`;
      });
    } else if (lowerMessage.includes('도움') || lowerMessage.includes('help')) {
      response = `다음과 같은 질문을 할 수 있습니다:\\n- 총 매출은?\\n- 거래처 목록 보여줘\\n- 가장 매출이 높은 거래처는?\\n- 인기 품목은?`;
    } else {
      response = `죄송합니다. "${message}"에 대한 답변을 찾을 수 없습니다. '도움말'이라고 입력해보세요.`;
    }
    
    res.json({ 
      response,
      timestamp: new Date().toISOString(),
      stats: {
        totalSales: stats.total_sales || 0,
        totalTransactions: stats.total_transactions || 0,
        totalCustomers: stats.total_customers || 0
      }
    });
    
  } catch (error) {
    console.error('❌ 챗봇 에러:', error);
    res.status(500).json({ 
      response: '죄송합니다. 일시적인 오류가 발생했습니다.',
      error: error.message 
    });
  }
});

// 고객 관리 CRUD API
app.get('/api/customers', async (req, res) => {
  try {
    const customers = await database.getCustomers();
    res.json(customers);
  } catch (error) {
    console.error('❌ 고객 목록 조회 에러:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/customers', async (req, res) => {
  try {
    const customerData = req.body;
    
    // 거래처명 중복 체크
    const existingCustomers = await database.getCustomers();
    const isDuplicate = existingCustomers.some(c => c.name === customerData.name);
    
    if (isDuplicate) {
      return res.status(400).json({ error: '이미 존재하는 거래처명입니다.' });
    }
    
    const customerId = await database.addCustomer(customerData);
    res.json({ id: customerId, message: '고객이 성공적으로 추가되었습니다.' });
  } catch (error) {
    console.error('❌ 고객 추가 에러:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/customers/:id', async (req, res) => {
  try {
    const customerId = req.params.id;
    const customerData = req.body;
    
    // 거래처명 중복 체크 (자신 제외)
    const existingCustomers = await database.getCustomers();
    const isDuplicate = existingCustomers.some(c => 
      c.name === customerData.name && c.id != customerId
    );
    
    if (isDuplicate) {
      return res.status(400).json({ error: '이미 존재하는 거래처명입니다.' });
    }
    
    await database.updateCustomer(customerId, customerData);
    res.json({ message: '고객 정보가 성공적으로 수정되었습니다.' });
  } catch (error) {
    console.error('❌ 고객 수정 에러:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/customers/:id', async (req, res) => {
  try {
    const customerId = req.params.id;
    
    // 해당 고객의 매출 데이터 확인
    console.log('삭제하려는 고객 ID:', customerId);
    const sales = await database.getSales({ customerId: customerId });
    console.log('고객의 매출 데이터 개수:', sales.length);
    
    if (sales.length > 0) {
      return res.status(400).json({ 
        error: '매출 데이터가 존재하는 고객은 삭제할 수 없습니다.' 
      });
    }
    
    await database.deleteCustomer(customerId);
    res.json({ message: '고객이 성공적으로 삭제되었습니다.' });
  } catch (error) {
    console.error('❌ 고객 삭제 에러:', error);
    res.status(500).json({ error: error.message });
  }
});

// 품목 관리 CRUD API
app.get('/api/items', async (req, res) => {
  try {
    const items = await database.getItems();
    res.json(items);
  } catch (error) {
    console.error('❌ 품목 목록 조회 에러:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/items', async (req, res) => {
  try {
    const itemData = req.body;
    
    // 품목코드 중복 체크 (코드가 있는 경우만)
    if (itemData.code) {
      const existingItems = await database.getItems();
      const isDuplicate = existingItems.some(item => item.code === itemData.code);
      
      if (isDuplicate) {
        return res.status(400).json({ error: '이미 존재하는 품목코드입니다.' });
      }
    }
    
    const itemId = await database.addItem(itemData);
    res.json({ id: itemId, message: '품목이 성공적으로 추가되었습니다.' });
  } catch (error) {
    console.error('❌ 품목 추가 에러:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/items/:id', async (req, res) => {
  try {
    const itemId = req.params.id;
    const itemData = req.body;
    
    // 품목코드 중복 체크 (자신 제외, 코드가 있는 경우만)
    if (itemData.code) {
      const existingItems = await database.getItems();
      const isDuplicate = existingItems.some(item => 
        item.code === itemData.code && item.id != itemId
      );
      
      if (isDuplicate) {
        return res.status(400).json({ error: '이미 존재하는 품목코드입니다.' });
      }
    }
    
    await database.updateItem(itemId, itemData);
    res.json({ message: '품목 정보가 성공적으로 수정되었습니다.' });
  } catch (error) {
    console.error('❌ 품목 수정 에러:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/items/:id', async (req, res) => {
  try {
    const itemId = req.params.id;
    
    // 해당 품목의 매출 데이터 확인
    const sales = await database.getSales({ itemId: itemId });
    if (sales.length > 0) {
      return res.status(400).json({ 
        error: '매출 데이터가 존재하는 품목은 삭제할 수 없습니다.' 
      });
    }
    
    await database.deleteItem(itemId);
    res.json({ message: '품목이 성공적으로 삭제되었습니다.' });
  } catch (error) {
    console.error('❌ 품목 삭제 에러:', error);
    res.status(500).json({ error: error.message });
  }
});

// 매출 데이터 검색 및 필터링 API
app.get('/api/sales', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      customer = '',
      item = '',
      startDate = '',
      endDate = '',
      minAmount = '',
      maxAmount = ''
    } = req.query;

    // 페이지네이션 계산
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // 필터 조건 구성
    const options = {
      limit: parseInt(limit),
      offset
    };

    if (startDate) options.startDate = startDate;
    if (endDate) options.endDate = endDate;

    // 매출 데이터 조회
    let sales = await database.getSales({ limit: 10000 }); // 전체 조회 후 필터링
    
    // 클라이언트 사이드 필터링 (더 유연한 검색을 위해)
    let filteredSales = sales;

    if (customer) {
      filteredSales = filteredSales.filter(sale => 
        sale.customer_name?.toLowerCase().includes(customer.toLowerCase())
      );
    }

    if (item) {
      filteredSales = filteredSales.filter(sale => 
        sale.item_name?.toLowerCase().includes(item.toLowerCase())
      );
    }

    if (startDate) {
      filteredSales = filteredSales.filter(sale => 
        new Date(sale.sale_date) >= new Date(startDate)
      );
    }

    if (endDate) {
      filteredSales = filteredSales.filter(sale => 
        new Date(sale.sale_date) <= new Date(endDate)
      );
    }

    if (minAmount) {
      filteredSales = filteredSales.filter(sale => 
        sale.total_amount >= parseInt(minAmount)
      );
    }

    if (maxAmount) {
      filteredSales = filteredSales.filter(sale => 
        sale.total_amount <= parseInt(maxAmount)
      );
    }

    // 페이지네이션 적용
    const totalCount = filteredSales.length;
    const totalPages = Math.ceil(totalCount / parseInt(limit));
    const paginatedSales = filteredSales.slice(offset, offset + parseInt(limit));

    // 통계 계산
    const totalAmount = filteredSales.reduce((sum, sale) => sum + sale.total_amount, 0);
    const totalProfit = filteredSales.reduce((sum, sale) => sum + sale.profit_amount, 0);

    res.json({
      data: paginatedSales,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount,
        hasNext: parseInt(page) < totalPages,
        hasPrev: parseInt(page) > 1
      },
      summary: {
        totalAmount,
        totalProfit,
        averageAmount: totalCount > 0 ? Math.round(totalAmount / totalCount) : 0,
        averageProfit: totalCount > 0 ? Math.round(totalProfit / totalCount) : 0
      },
      filters: {
        customer,
        item,
        startDate,
        endDate,
        minAmount,
        maxAmount
      }
    });

  } catch (error) {
    console.error('❌ 매출 검색 에러:', error);
    res.status(500).json({ error: error.message });
  }
});

// 매출 데이터 필터링된 엑셀 내보내기
app.get('/api/sales/export', async (req, res) => {
  try {
    const {
      customer = '',
      item = '',
      startDate = '',
      endDate = '',
      minAmount = '',
      maxAmount = ''
    } = req.query;

    console.log('📊 필터링된 매출 데이터 엑셀 내보내기 시작...', req.query);

    // 전체 매출 데이터 조회 후 필터링
    let sales = await database.getSales({ limit: 10000 });

    // 필터 적용 (검색 API와 동일한 로직)
    if (customer) {
      sales = sales.filter(sale => 
        sale.customer_name?.toLowerCase().includes(customer.toLowerCase())
      );
    }
    if (item) {
      sales = sales.filter(sale => 
        sale.item_name?.toLowerCase().includes(item.toLowerCase())
      );
    }
    if (startDate) {
      sales = sales.filter(sale => 
        new Date(sale.sale_date) >= new Date(startDate)
      );
    }
    if (endDate) {
      sales = sales.filter(sale => 
        new Date(sale.sale_date) <= new Date(endDate)
      );
    }
    if (minAmount) {
      sales = sales.filter(sale => 
        sale.total_amount >= parseInt(minAmount)
      );
    }
    if (maxAmount) {
      sales = sales.filter(sale => 
        sale.total_amount <= parseInt(maxAmount)
      );
    }

    if (sales.length === 0) {
      return res.status(404).json({ error: '조건에 맞는 매출 데이터가 없습니다.' });
    }

    // 엑셀 워크북 생성
    const workbook = new ExcelJS.Workbook();

    // 매출 데이터 시트 생성
    const worksheet = workbook.addWorksheet('필터링된매출데이터');
    
    // 헤더 추가
    const headers = ['판매일자', '거래처명', '품목명', '품목코드', '카테고리', '수량', '단가', 
                    '공급가액', '부가세', '총액', '매입가', '이익금액', '마진율(%)', '세금계산서번호', '비고'];
    worksheet.addRow(headers);
    
    // 데이터 추가
    sales.forEach(sale => {
      worksheet.addRow([
        sale.sale_date,
        sale.customer_name,
        sale.item_name,
        sale.item_code,
        sale.item_category,
        sale.quantity,
        sale.unit_price,
        sale.supply_price,
        sale.vat_amount,
        sale.total_amount,
        sale.purchase_price,
        sale.profit_amount,
        sale.margin_rate,
        sale.invoice_number || '',
        sale.notes || ''
      ]);
    });
    
    // 컬럼 너비 설정
    const colWidths = [12, 20, 30, 15, 12, 8, 12, 15, 12, 15, 12, 15, 10, 18, 20];
    worksheet.columns.forEach((column, index) => {
      column.width = colWidths[index];
    });

    // 필터 조건 시트 추가
    const filterSheet = workbook.addWorksheet('검색조건');
    filterSheet.addRow(['필터조건', '값']);
    filterSheet.addRow(['거래처', customer || '전체']);
    filterSheet.addRow(['품목', item || '전체']);
    filterSheet.addRow(['시작일', startDate || '전체']);
    filterSheet.addRow(['종료일', endDate || '전체']);
    filterSheet.addRow(['최소금액', minAmount || '제한없음']);
    filterSheet.addRow(['최대금액', maxAmount || '제한없음']);
    filterSheet.addRow(['총건수', sales.length]);
    filterSheet.addRow(['생성일시', new Date().toLocaleString('ko-KR')]);

    // 엑셀 파일 생성
    const buffer = await workbook.xlsx.writeBuffer();
    
    // 파일명 생성 (필터 조건 포함)
    const filterSuffix = [
      customer ? `거래처_${customer}` : '',
      item ? `품목_${item}` : '',
      startDate ? `${startDate}부터` : '',
      endDate ? `${endDate}까지` : ''
    ].filter(Boolean).join('_');
    
    const filename = `매출데이터_${filterSuffix || '전체'}_${new Date().toISOString().split('T')[0]}.xlsx`;

    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);

    console.log(`✅ 필터링된 매출 데이터 엑셀 내보내기 완료: ${sales.length}건`);

  } catch (error) {
    console.error('❌ 필터링된 엑셀 내보내기 에러:', error);
    res.status(500).json({ error: error.message });
  }
});

// 대시보드 통계 API
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    console.log('📊 대시보드 통계 데이터 조회 시작...');

    // 전체 통계 조회
    const [customers, items, sales] = await Promise.all([
      database.getCustomers(),
      database.getItems(),
      database.getSales({ limit: 10000 })
    ]);

    // 현재 날짜 정보
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentDate = now.toISOString().split('T')[0];

    // 매출 통계 계산
    const totalSales = sales.reduce((sum, sale) => sum + (sale.total_amount || 0), 0);
    const totalProfit = sales.reduce((sum, sale) => sum + (sale.profit_amount || 0), 0);

    // 이번 달 매출 계산
    const thisMonthSales = sales
      .filter(sale => {
        const saleDate = new Date(sale.sale_date);
        return saleDate.getFullYear() === currentYear && saleDate.getMonth() === currentMonth;
      })
      .reduce((sum, sale) => sum + (sale.total_amount || 0), 0);

    // 오늘 매출 계산
    const todaySales = sales
      .filter(sale => sale.sale_date === currentDate)
      .reduce((sum, sale) => sum + (sale.total_amount || 0), 0);

    // 월별 매출 트렌드 (최근 12개월)
    const monthlyTrends = [];
    for (let i = 11; i >= 0; i--) {
      const date = new Date(currentYear, currentMonth - i, 1);
      const year = date.getFullYear();
      const month = date.getMonth();
      
      const monthSales = sales
        .filter(sale => {
          const saleDate = new Date(sale.sale_date);
          return saleDate.getFullYear() === year && saleDate.getMonth() === month;
        })
        .reduce((sum, sale) => sum + (sale.total_amount || 0), 0);

      monthlyTrends.push({
        year,
        month: month + 1,
        monthName: date.toLocaleDateString('ko-KR', { month: 'short' }),
        sales: monthSales,
        count: sales.filter(sale => {
          const saleDate = new Date(sale.sale_date);
          return saleDate.getFullYear() === year && saleDate.getMonth() === month;
        }).length
      });
    }

    // 상위 고객 (매출 기준)
    const topCustomers = customers
      .filter(customer => customer.total_sales > 0)
      .sort((a, b) => (b.total_sales || 0) - (a.total_sales || 0))
      .slice(0, 5)
      .map(customer => ({
        id: customer.id,
        name: customer.name,
        totalSales: customer.total_sales || 0,
        transactionCount: customer.total_transactions || 0
      }));

    // 상위 품목 (매출 기준)
    const topItems = items
      .filter(item => item.total_revenue > 0)
      .sort((a, b) => (b.total_revenue || 0) - (a.total_revenue || 0))
      .slice(0, 5)
      .map(item => ({
        id: item.id,
        name: item.name,
        code: item.code,
        totalRevenue: item.total_revenue || 0,
        quantitySold: item.total_quantity_sold || 0
      }));

    // 최근 거래 (최근 10건)
    const recentSales = sales
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 10)
      .map(sale => ({
        id: sale.id,
        date: sale.sale_date,
        customer: sale.customer_name,
        item: sale.item_name,
        amount: sale.total_amount,
        profit: sale.profit_amount
      }));

    const stats = {
      overview: {
        totalSales,
        totalProfit,
        thisMonthSales,
        todaySales,
        totalCustomers: customers.length,
        activeCustomers: customers.filter(c => c.total_sales > 0).length,
        totalItems: items.length,
        activeItems: items.filter(i => i.total_revenue > 0).length,
        totalTransactions: sales.length,
        averageTransactionAmount: sales.length > 0 ? Math.round(totalSales / sales.length) : 0
      },
      trends: {
        monthly: monthlyTrends
      },
      topPerformers: {
        customers: topCustomers,
        items: topItems
      },
      recent: {
        sales: recentSales
      },
      lastUpdated: new Date().toISOString()
    };

    console.log(`✅ 대시보드 통계 조회 완료: 매출 ${sales.length}건, 고객 ${customers.length}명, 품목 ${items.length}개`);
    res.json(stats);

  } catch (error) {
    console.error('❌ 대시보드 통계 조회 에러:', error);
    res.status(500).json({ error: error.message });
  }
});

// 데이터베이스 전체 데이터를 엑셀로 내보내기
app.get('/api/export/excel', async (req, res) => {
  try {
    console.log('📊 엑셀 내보내기 시작...');
    
    // 데이터베이스에서 전체 데이터 조회
    const sales = await database.getSales({ limit: 10000 });
    const customers = await database.getCustomers();
    const items = await database.getItems();
    const stats = await database.getDashboardStats();
    
    // 새 워크북 생성
    const workbook = new ExcelJS.Workbook();
    
    // 1. 매출 데이터 시트
    const salesSheet = workbook.addWorksheet('매출데이터');
    salesSheet.addRow(['ID', '거래처명', '품목명', '판매일자', '수량', '단가', '공급가액', '부가세', '총금액', '매입가', '이익', '마진율(%)']);
    sales.forEach(sale => {
      salesSheet.addRow([
        sale.id,
        sale.customer_name,
        sale.item_name,
        sale.sale_date,
        sale.quantity,
        sale.unit_price,
        sale.supply_price,
        sale.vat_amount,
        sale.total_amount,
        sale.purchase_price,
        sale.profit_amount,
        sale.margin_rate
      ]);
    });
    
    // 2. 거래처 데이터 시트
    const customersSheet = workbook.addWorksheet('거래처목록');
    customersSheet.addRow(['ID', '거래처명', '사업자번호', '담당자', '전화번호', '이메일', '주소', '총거래수', '총매출액']);
    customers.forEach(customer => {
      customersSheet.addRow([
        customer.id,
        customer.name,
        customer.business_number || '',
        customer.contact_person || '',
        customer.phone || '',
        customer.email || '',
        customer.address || '',
        customer.total_transactions || 0,
        customer.total_sales || 0
      ]);
    });
    
    // 3. 품목 데이터 시트
    const itemsSheet = workbook.addWorksheet('품목목록');
    itemsSheet.addRow(['ID', '품목코드', '품목명', '카테고리', '단위', '표준단가', '설명', '총판매수량', '총매출액']);
    items.forEach(item => {
      itemsSheet.addRow([
        item.id,
        item.code,
        item.name,
        item.category,
        item.unit,
        item.standard_price,
        item.description || '',
        item.total_quantity_sold || 0,
        item.total_revenue || 0
      ]);
    });
    
    // 4. 요약 통계 시트
    const summarySheet = workbook.addWorksheet('요약통계');
    summarySheet.addRow(['항목', '값']);
    summarySheet.addRow(['총 거래건수', stats.total_transactions || 0]);
    summarySheet.addRow(['총 매출액', stats.total_sales || 0]);
    summarySheet.addRow(['총 이익', stats.total_profit || 0]);
    summarySheet.addRow(['평균 마진율(%)', Math.round((stats.avg_margin_rate || 0) * 100) / 100]);
    summarySheet.addRow(['거래처 수', stats.total_customers || 0]);
    summarySheet.addRow(['품목 수', stats.total_items || 0]);
    summarySheet.addRow(['백업 생성일시', new Date().toLocaleString('ko-KR')]);
    summarySheet.addRow(['데이터 기준일', new Date().toLocaleDateString('ko-KR')]);
    
    // 파일명 생성 (JS일렉트로닉_백업_2025-08-22.xlsx)
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    const filename = `JS일렉트로닉_백업_${dateStr}.xlsx`;
    
    // 응답 헤더 설정
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    
    // 엑셀 파일 생성 및 전송
    const buffer = await workbook.xlsx.writeBuffer();
    
    console.log(`✅ 엑셀 파일 생성 완료: ${filename} (${buffer.length} bytes)`);
    console.log(`📊 내보낸 데이터: 매출 ${sales.length}건, 거래처 ${customers.length}개, 품목 ${items.length}개`);
    
    res.send(buffer);
    
  } catch (error) {
    console.error('❌ 엑셀 내보내기 실패:', error);
    res.status(500).json({ 
      error: '엑셀 파일 생성에 실패했습니다: ' + error.message,
      details: '데이터베이스 연결을 확인해주세요.'
    });
  }
});

// =============================================
// 공급업체 CRUD API
// =============================================

// 공급업체 목록 조회
app.get('/api/suppliers', async (req, res) => {
  try {
    console.log('📋 공급업체 목록 조회 시작...');
    const suppliers = await database.getSuppliers();
    
    res.json({
      success: true,
      data: suppliers,
      count: suppliers.length,
      timestamp: new Date().toISOString()
    });
    
    console.log(`✅ 공급업체 목록 조회 완료: ${suppliers.length}개`);
  } catch (error) {
    console.error('❌ 공급업체 목록 조회 에러:', error);
    res.status(500).json({ error: error.message });
  }
});

// 공급업체 상세 조회
app.get('/api/suppliers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const supplier = await database.getSupplierById(id);
    
    if (!supplier) {
      return res.status(404).json({ error: '공급업체를 찾을 수 없습니다.' });
    }
    
    res.json(supplier);
  } catch (error) {
    console.error('❌ 공급업체 조회 에러:', error);
    res.status(500).json({ error: error.message });
  }
});

// 공급업체 추가
app.post('/api/suppliers', async (req, res) => {
  try {
    const supplierData = req.body;
    
    // 공급업체명 중복 체크
    const existingSuppliers = await database.getSuppliers();
    const isDuplicate = existingSuppliers.some(s => s.name === supplierData.name);
    
    if (isDuplicate) {
      return res.status(400).json({ error: '이미 존재하는 공급업체명입니다.' });
    }
    
    const supplierId = await database.addSupplier(supplierData);
    res.json({ id: supplierId, message: '공급업체가 성공적으로 추가되었습니다.' });
    
  } catch (error) {
    console.error('❌ 공급업체 추가 에러:', error);
    res.status(500).json({ error: error.message });
  }
});

// 공급업체 수정
app.put('/api/suppliers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const supplierData = req.body;
    
    await database.updateSupplier(id, supplierData);
    res.json({ message: '공급업체가 성공적으로 수정되었습니다.' });
    
  } catch (error) {
    console.error('❌ 공급업체 수정 에러:', error);
    res.status(500).json({ error: error.message });
  }
});

// 공급업체 삭제 (비활성화)
app.delete('/api/suppliers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await database.deleteSupplier(id);
    res.json({ message: '공급업체가 성공적으로 삭제되었습니다.' });
    
  } catch (error) {
    console.error('❌ 공급업체 삭제 에러:', error);
    res.status(500).json({ error: error.message });
  }
});

// =============================================
// 매입 CRUD API
// =============================================

// 매입 목록 조회 (필터링 지원)
app.get('/api/purchases', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      supplier, 
      item, 
      startDate, 
      endDate, 
      status,
      minAmount,
      maxAmount
    } = req.query;
    
    console.log('📋 매입 데이터 조회 시작...', { page, limit, supplier, item, startDate, endDate, status });
    
    const offset = (page - 1) * limit;
    const options = {
      limit: parseInt(limit),
      offset: offset,
      startDate,
      endDate,
      status
    };
    
    // 공급업체명으로 검색
    if (supplier) {
      const supplierRecord = await database.getSupplierByName(supplier);
      if (supplierRecord) {
        options.supplierId = supplierRecord.id;
      }
    }
    
    // 품목명으로 검색
    if (item) {
      const itemRecord = await database.getItemByName(item);
      if (itemRecord) {
        options.itemId = itemRecord.id;
      }
    }
    
    const purchases = await database.getPurchases(options);
    
    // 금액 필터링 (클라이언트 사이드)
    let filteredPurchases = purchases;
    if (minAmount) {
      filteredPurchases = filteredPurchases.filter(p => p.total_amount >= parseInt(minAmount));
    }
    if (maxAmount) {
      filteredPurchases = filteredPurchases.filter(p => p.total_amount <= parseInt(maxAmount));
    }
    
    // 총 개수 조회 (전체)
    const allPurchases = await database.getPurchases({ limit: 10000 });
    const totalCount = allPurchases.length;
    const totalPages = Math.ceil(totalCount / limit);
    
    // 요약 통계 계산
    const summary = {
      totalAmount: filteredPurchases.reduce((sum, p) => sum + (p.total_amount || 0), 0),
      averageAmount: filteredPurchases.length > 0 ? 
        Math.round(filteredPurchases.reduce((sum, p) => sum + (p.total_amount || 0), 0) / filteredPurchases.length) : 0,
      totalQuantity: filteredPurchases.reduce((sum, p) => sum + (p.quantity || 0), 0),
      averageUnitCost: filteredPurchases.length > 0 ?
        Math.round(filteredPurchases.reduce((sum, p) => sum + (p.unit_cost || 0), 0) / filteredPurchases.length) : 0
    };
    
    res.json({
      data: filteredPurchases,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount,
        limit: parseInt(limit),
        hasNext: page < totalPages,
        hasPrev: page > 1
      },
      summary
    });
    
    console.log(`✅ 매입 데이터 조회 완료: ${filteredPurchases.length}건`);
    
  } catch (error) {
    console.error('❌ 매입 데이터 조회 에러:', error);
    res.status(500).json({ error: error.message });
  }
});

// 매입 상세 조회
app.get('/api/purchases/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const purchase = await database.getPurchaseById(id);
    
    if (!purchase) {
      return res.status(404).json({ error: '매입 데이터를 찾을 수 없습니다.' });
    }
    
    res.json(purchase);
  } catch (error) {
    console.error('❌ 매입 조회 에러:', error);
    res.status(500).json({ error: error.message });
  }
});

// 매입 추가
app.post('/api/purchases', async (req, res) => {
  try {
    const purchaseData = req.body;
    
    const purchaseId = await database.addPurchase(purchaseData);
    res.json({ id: purchaseId, message: '매입이 성공적으로 추가되었습니다.' });
    
  } catch (error) {
    console.error('❌ 매입 추가 에러:', error);
    res.status(500).json({ error: error.message });
  }
});

// 매입 수정
app.put('/api/purchases/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const purchaseData = req.body;
    
    await database.updatePurchase(id, purchaseData);
    res.json({ message: '매입이 성공적으로 수정되었습니다.' });
    
  } catch (error) {
    console.error('❌ 매입 수정 에러:', error);
    res.status(500).json({ error: error.message });
  }
});

// 매입 삭제
app.delete('/api/purchases/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await database.deletePurchase(id);
    res.json({ message: '매입이 성공적으로 삭제되었습니다.' });
    
  } catch (error) {
    console.error('❌ 매입 삭제 에러:', error);
    res.status(500).json({ error: error.message });
  }
});

// 매입 데이터 엑셀 내보내기
app.get('/api/purchases/export', async (req, res) => {
  try {
    const { supplier, item, startDate, endDate, status } = req.query;
    console.log('📊 필터링된 매입 데이터 엑셀 내보내기 시작...', { supplier, item, startDate, endDate, status });

    // 필터링된 매입 데이터 조회
    const options = { limit: 10000 };
    if (supplier) {
      const supplierRecord = await database.getSupplierByName(supplier);
      if (supplierRecord) options.supplierId = supplierRecord.id;
    }
    if (item) {
      const itemRecord = await database.getItemByName(item);
      if (itemRecord) options.itemId = itemRecord.id;
    }
    if (startDate) options.startDate = startDate;
    if (endDate) options.endDate = endDate;
    if (status) options.status = status;

    const purchases = await database.getPurchases(options);

    if (purchases.length === 0) {
      return res.status(404).json({ error: '조건에 맞는 매입 데이터가 없습니다.' });
    }

    // 엑셀 데이터 변환
    const excelData = purchases.map(purchase => ({
      '매입일자': new Date(purchase.purchase_date).toLocaleDateString('ko-KR'),
      '공급업체': purchase.supplier_name,
      '품목명': purchase.item_name,
      '카테고리': purchase.item_category,
      '수량': purchase.quantity?.toLocaleString() || 0,
      '매입단가': purchase.unit_cost?.toLocaleString() || 0,
      '공급가액': purchase.supply_amount?.toLocaleString() || 0,
      '부가세': purchase.vat_amount?.toLocaleString() || 0,
      '총액': purchase.total_amount?.toLocaleString() || 0,
      '예상판매가': purchase.expected_sale_price?.toLocaleString() || 0,
      '예상마진율': purchase.expected_margin ? `${purchase.expected_margin.toFixed(1)}%` : '0%',
      '상태': purchase.status === 'ordered' ? '주문' : purchase.status === 'received' ? '입고' : '취소',
      '세금계산서번호': purchase.invoice_number || '',
      '비고': purchase.notes || ''
    }));

    // 엑셀 워크북 생성
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('필터링된매입데이터');
    
    // 헤더 추가
    const headers = ['매입일자', '공급업체', '품목명', '카테고리', '수량', '매입단가', '공급가액', 
                    '부가세', '총액', '예상판매가', '예상마진율', '상태', '세금계산서번호', '비고'];
    worksheet.addRow(headers);
    
    // 데이터 추가
    purchases.forEach(purchase => {
      worksheet.addRow([
        new Date(purchase.purchase_date).toLocaleDateString('ko-KR'),
        purchase.supplier_name,
        purchase.item_name,
        purchase.item_category,
        purchase.quantity?.toLocaleString() || 0,
        purchase.unit_cost?.toLocaleString() || 0,
        purchase.supply_amount?.toLocaleString() || 0,
        purchase.vat_amount?.toLocaleString() || 0,
        purchase.total_amount?.toLocaleString() || 0,
        purchase.expected_sale_price?.toLocaleString() || 0,
        purchase.expected_margin ? `${purchase.expected_margin.toFixed(1)}%` : '0%',
        purchase.status === 'ordered' ? '주문' : purchase.status === 'received' ? '입고' : '취소',
        purchase.invoice_number || '',
        purchase.notes || ''
      ]);
    });

    // 컬럼 너비 설정
    const colWidths = [12, 20, 25, 12, 10, 12, 15, 12, 15, 15, 12, 8, 18, 20];
    worksheet.columns.forEach((column, index) => {
      column.width = colWidths[index];
    });

    // 필터 조건 시트 추가
    const filterSheet = workbook.addWorksheet('검색조건');
    filterSheet.addRow(['필터조건', '값']);
    filterSheet.addRow(['공급업체', supplier || '전체']);
    filterSheet.addRow(['품목', item || '전체']);
    filterSheet.addRow(['시작일', startDate || '전체']);
    filterSheet.addRow(['종료일', endDate || '전체']);
    filterSheet.addRow(['상태', status || '전체']);
    filterSheet.addRow(['총건수', purchases.length]);
    filterSheet.addRow(['생성일시', new Date().toLocaleString('ko-KR')]);

    // 엑셀 파일 생성
    const buffer = await workbook.xlsx.writeBuffer();
    
    // 파일명 생성
    const filterSuffix = [
      supplier ? `공급업체_${supplier}` : '',
      item ? `품목_${item}` : '',
      startDate ? `${startDate}부터` : '',
      endDate ? `${endDate}까지` : ''
    ].filter(Boolean).join('_');
    
    const filename = `매입데이터_${filterSuffix || '전체'}_${new Date().toISOString().split('T')[0]}.xlsx`;

    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);

    console.log(`✅ 필터링된 매입 데이터 엑셀 내보내기 완료: ${purchases.length}건`);

  } catch (error) {
    console.error('❌ 필터링된 매입 엑셀 내보내기 에러:', error);
    res.status(500).json({ error: error.message });
  }
});

// =============================================
// 재고 관리 API
// =============================================

// 재고 목록 조회
app.get('/api/inventory', async (req, res) => {
  try {
    console.log('📦 재고 목록 조회 시작...');
    const inventory = await database.getInventory();
    
    res.json({
      success: true,
      data: inventory,
      count: inventory.length,
      timestamp: new Date().toISOString()
    });
    
    console.log(`✅ 재고 목록 조회 완료: ${inventory.length}개 품목`);
  } catch (error) {
    console.error('❌ 재고 목록 조회 에러:', error);
    res.status(500).json({ error: error.message });
  }
});

// 품목별 재고 조회
app.get('/api/inventory/item/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;
    const inventory = await database.getInventoryByItem(itemId);
    
    if (!inventory) {
      return res.status(404).json({ error: '해당 품목의 재고 정보가 없습니다.' });
    }
    
    res.json(inventory);
  } catch (error) {
    console.error('❌ 품목별 재고 조회 에러:', error);
    res.status(500).json({ error: error.message });
  }
});

// 재고 제한 설정
app.put('/api/inventory/:itemId/limits', async (req, res) => {
  try {
    const { itemId } = req.params;
    const { minStock, maxStock } = req.body;
    
    await database.setInventoryLimits(itemId, minStock, maxStock);
    res.json({ message: '재고 제한이 성공적으로 설정되었습니다.' });
    
  } catch (error) {
    console.error('❌ 재고 제한 설정 에러:', error);
    res.status(500).json({ error: error.message });
  }
});

// 거래명세서 엑셀 생성
app.get('/api/sales/:saleId/statement/excel', async (req, res) => {
  try {
    const { saleId } = req.params;
    console.log('📊 거래명세서 엑셀 생성 요청 시작...', { saleId });
    
    // 매출 데이터 조회
    const sale = await database.getSaleById(saleId);
    if (!sale) {
      return res.status(404).json({ error: '매출 데이터를 찾을 수 없습니다.' });
    }
    
    // 고객 정보 조회
    const customer = await database.getCustomerById(sale.customer_id);
    
    // 엑셀 워크북 생성
    const workbook = new ExcelJS.Workbook();
    
    // 실제 거래명세서 양식 기반 데이터 구성
    const supplyAmount = Math.round(sale.unit_price * sale.quantity);
    const vatAmount = sale.vat_amount || Math.round(supplyAmount * 0.1);
    const totalAmount = supplyAmount + vatAmount;
    const serialNumber = `${sale.sale_date} - ${sale.id}`;
    
    // 금액을 한글로 변환하는 함수 (간단버전)
    function numberToKorean(num) {
      if (num === 0) return '영';
      
      const digits = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
      const tens = ['', '십', '이십', '삼십', '사십', '오십', '육십', '칠십', '팔십', '구십'];
      const hundreds = ['', '일백', '이백', '삼백', '사백', '오백', '육백', '칠백', '팔백', '구백'];
      const thousands = ['', '일천', '이천', '삼천', '사천', '오천', '육천', '칠천', '팔천', '구천'];
      
      let result = '';
      
      if (num < 10000) {
        let tempNum = num;
        let thousand = Math.floor(tempNum / 1000);
        tempNum %= 1000;
        let hundred = Math.floor(tempNum / 100);
        tempNum %= 100;
        let ten = Math.floor(tempNum / 10);
        let one = tempNum % 10;
        
        if (thousand > 0) result += thousands[thousand];
        if (hundred > 0) result += hundreds[hundred];
        if (ten > 0) result += tens[ten];
        if (one > 0) result += digits[one];
      } else {
        result = num.toLocaleString();
      }
      
      return result;
    }
    
    const amountText = numberToKorean(totalAmount);
    
    // 실제 거래명세서와 정확히 동일한 엑셀 양식
    const statementData = [
      // Row 1: 제목
      ['거래명세서', '', '', '', '', '', '', ''],
      
      // Row 2-3: 빈 행
      ['', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', ''],
      
      // Row 4-8: 상단 정보 박스들
      [`주식회사 ${sale.customer_name || '알캠몰'} 귀중`, '', '', '', '일련번호', serialNumber, 'TEL', '031-234-1233'],
      ['경기도 하남시 검단산로333번길 7, 1층(창우동)', '', '', '', '사업자등록번호', '270-81-00234', '성명', '서종원'],
      ['☎ 010-8831-7495', '', '', '', '상호', '주식회사 엘리콘', '', ''],
      ['', '', '', '', '주소', '경기도 화성시 동탄지성로333 (기산동) 101-402', '', ''],
      ['', '', '', '', '', '', '', ''],
      
      // Row 9-10: 금액 정보
      [`금 액 : ${amountText}원 정 (￦ ${totalAmount.toLocaleString()})`, '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', ''],
      
      // Row 11-12: 상단 요약 (수량, 공급가액, VAT, 합계, 인수인)
      ['', '', '', '', '수량', '공급가액', 'VAT', '합계'],
      ['', '', '', '', '1', supplyAmount.toLocaleString(), vatAmount.toLocaleString(), totalAmount.toLocaleString()],
      
      // Row 13: 빈 행
      ['', '', '', '', '', '', '', ''],
      
      // Row 14: 테이블 헤더
      ['일자', '품목명[규격]', '수량(단위포함)', '단가', '공급가액', '부가세', '적요', ''],
      
      // Row 15: 실제 데이터
      [
        sale.sale_date.substring(5), // MM/DD 형식  
        `${sale.item_name} [${sale.unit_price.toLocaleString()}]`,
        sale.quantity.toLocaleString(),
        sale.unit_price.toLocaleString(),
        supplyAmount.toLocaleString(),
        vatAmount.toLocaleString(),
        '',
        ''
      ]
    ];
    
    // 빈 행들 추가 (16-30행: 15개 빈 행)
    for (let i = 0; i < 15; i++) {
      statementData.push(['', '', '', '', '', '', '', '']);
    }
    
    // 하단 합계 행 (31행)
    statementData.push([
      '소계', '1', '', supplyAmount.toLocaleString(), 'VAT', vatAmount.toLocaleString(), '합계', totalAmount.toLocaleString()
    ]);
    
    // 빈 행 (32행)
    statementData.push(['', '', '', '', '', '', '', '']);
    
    // 하단 확인 (33행)
    statementData.push(['수신자확인', '', '', '', '', '', '', '전']);
    
    const worksheet = workbook.addWorksheet('거래명세서');
    
    // 데이터 추가
    statementData.forEach(rowData => {
      worksheet.addRow(rowData);
    });
    
    // 컬럼 너비 설정 (8개 컬럼)
    const colWidths = [8, 25, 12, 12, 12, 10, 8, 12];
    worksheet.columns.forEach((column, index) => {
      column.width = colWidths[index];
    });
    
    // 제목 스타일 적용
    const titleCell = worksheet.getCell('A1');
    titleCell.font = { bold: true, size: 14 };
    titleCell.alignment = { horizontal: 'center' };
    
    // 셀 병합 (ExcelJS 스타일)
    worksheet.mergeCells('A1:H1'); // 제목
    worksheet.mergeCells('A4:D4'); // 고객사명 귀중
    worksheet.mergeCells('A5:D5'); // 주소
    worksheet.mergeCells('A6:D6'); // 전화번호
    worksheet.mergeCells('E7:H7'); // 우측 주소
    worksheet.mergeCells('A9:H9'); // 금액 정보
    worksheet.mergeCells('B31:C31'); // 소계 행
    
    // Response 헤더 설정
    const filename = `거래명세서_${sale.customer_name}_${sale.sale_date}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    
    // 엑셀 파일 생성 및 전송
    const buffer = await workbook.xlsx.writeBuffer();
    res.send(buffer);
    
    console.log('✅ 거래명세서 엑셀 생성 완료');
    
  } catch (error) {
    console.error('❌ 거래명세서 엑셀 생성 에러:', error);
    res.status(500).json({ error: error.message });
  }
});

// 거래명세서 PDF 생성
app.get('/api/sales/:saleId/statement', async (req, res) => {
  try {
    const { saleId } = req.params;
    console.log('📋 거래명세서 생성 요청 시작...', { saleId });
    
    // 매출 데이터 조회
    const sale = await database.getSaleById(saleId);
    if (!sale) {
      return res.status(404).json({ error: '매출 데이터를 찾을 수 없습니다.' });
    }
    
    // 고객 정보 조회
    const customer = await database.getCustomerById(sale.customer_id);
    
    // PDF 생성
    const doc = new PDFDocument({ margin: 50 });
    
    // Response 헤더 설정
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(`거래명세서_${sale.customer_name}_${sale.sale_date}.pdf`)}`);
    
    doc.pipe(res);
    
    // PDF 내용 작성 (실제 거래명세서 양식 기반)
    
    // 제목
    doc.fontSize(18).text('거래명세서', 250, 40, { align: 'center' });
    
    // 상단 박스들
    // 수신자 박스 (좌측)
    doc.rect(50, 80, 250, 120).stroke();
    doc.fontSize(10).text('주식회사 알캠몰 귀중', 60, 90);
    doc.text(`${sale.customer_name || '고객사명'}`, 60, 110);
    doc.text('경기도 하남시 검단산로333번길 7, 1층(창우동)', 60, 130);
    doc.text('☎ 010-8831-7495', 60, 150);
    
    // 공급자 박스 (우측)  
    doc.rect(320, 80, 230, 120).stroke();
    const serialNumber = `${sale.sale_date} - ${sale.id}`;
    doc.fontSize(9);
    doc.text('일련번호', 330, 90);
    doc.text(serialNumber, 380, 90);
    doc.text('TEL', 470, 90);
    doc.text('031-234-1233', 490, 90);
    
    doc.text('사업자등록', 330, 110);
    doc.text('270-81-00234', 380, 110);
    doc.text('성명', 470, 110);
    doc.text('서종원', 490, 110);
    
    doc.text('상호', 330, 130);
    doc.text('주식회사 엘리콘', 380, 130);
    
    doc.text('주소', 330, 150);
    doc.text('경기도 화성시 동탄지성로333 (기산동) 101-402', 380, 150);
    
    // 금액 박스
    const supplyAmount = Math.round(sale.unit_price * sale.quantity);
    const vatAmount = sale.vat_amount || Math.round(supplyAmount * 0.1);
    const totalAmount = supplyAmount + vatAmount;
    
    // 금액을 한글로 변환하는 함수 (간단버전)
    function numberToKorean(num) {
      const units = ['', '만', '억', '조'];
      const digits = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
      const tens = ['', '십', '이십', '삼십', '사십', '오십', '육십', '칠십', '팔십', '구십'];
      const hundreds = ['', '일백', '이백', '삼백', '사백', '오백', '육백', '칠백', '팔백', '구백'];
      const thousands = ['', '일천', '이천', '삼천', '사천', '오천', '육천', '칠천', '팔천', '구천'];
      
      if (num === 0) return '영';
      
      let result = '';
      let str = num.toString();
      let len = str.length;
      
      // 간단한 변환 (1만 이하)
      if (num < 10000) {
        let tempNum = num;
        let thousand = Math.floor(tempNum / 1000);
        tempNum %= 1000;
        let hundred = Math.floor(tempNum / 100);
        tempNum %= 100;
        let ten = Math.floor(tempNum / 10);
        let one = tempNum % 10;
        
        if (thousand > 0) result += thousands[thousand];
        if (hundred > 0) result += hundreds[hundred];
        if (ten > 0) result += tens[ten];
        if (one > 0) result += digits[one];
      } else {
        result = num.toLocaleString();
      }
      
      return result;
    }
    
    const amountText = numberToKorean(totalAmount);
    
    doc.rect(50, 220, 500, 30).stroke();
    doc.fontSize(11).text(`금 액 : ${amountText}원 정 (￦ ${totalAmount.toLocaleString()})`, 60, 235);
    
    // 요약 정보
    doc.rect(350, 260, 200, 25).stroke();
    doc.fontSize(9);
    doc.text('수량', 360, 270);
    doc.text('공급가액', 390, 270);
    doc.text('VAT', 440, 270);
    doc.text('합계', 470, 270);
    doc.text('인수인', 510, 270);
    
    doc.text('1', 360, 280);
    doc.text(supplyAmount.toLocaleString(), 385, 280);
    doc.text(vatAmount.toLocaleString(), 425, 280);
    doc.text(totalAmount.toLocaleString(), 465, 280);
    
    // 거래 테이블
    const tableY = 300;
    const rowHeight = 25;
    
    // 테이블 헤더
    doc.rect(50, tableY, 500, rowHeight).stroke();
    doc.fontSize(10);
    doc.text('일자', 60, tableY + 8);
    doc.text('품목명[규격]', 110, tableY + 8);
    doc.text('수량(단위포함)', 280, tableY + 8);
    doc.text('단가', 370, tableY + 8);
    doc.text('공급가액', 410, tableY + 8);
    doc.text('부가세', 460, tableY + 8);
    doc.text('적요', 510, tableY + 8);
    
    // 테이블 데이터 행
    const dataY = tableY + rowHeight;
    doc.rect(50, dataY, 500, rowHeight).stroke();
    
    // 세로선들
    doc.moveTo(100, tableY).lineTo(100, dataY + rowHeight).stroke();
    doc.moveTo(270, tableY).lineTo(270, dataY + rowHeight).stroke();
    doc.moveTo(360, tableY).lineTo(360, dataY + rowHeight).stroke();
    doc.moveTo(400, tableY).lineTo(400, dataY + rowHeight).stroke();
    doc.moveTo(450, tableY).lineTo(450, dataY + rowHeight).stroke();
    doc.moveTo(500, tableY).lineTo(500, dataY + rowHeight).stroke();
    
    // 데이터 입력
    doc.fontSize(9);
    doc.text(sale.sale_date.substring(5), 60, dataY + 8); // MM/DD 형식
    doc.text(`${sale.item_name} [${sale.unit_price.toLocaleString()}]`, 110, dataY + 8);
    doc.text(sale.quantity.toLocaleString(), 280, dataY + 8);
    doc.text(sale.unit_price.toLocaleString(), 370, dataY + 8);
    doc.text(supplyAmount.toLocaleString(), 410, dataY + 8);
    doc.text(vatAmount.toLocaleString(), 460, dataY + 8);
    
    // 빈 행들 (15개 정도)
    for (let i = 0; i < 15; i++) {
      const emptyRowY = dataY + (i + 1) * rowHeight;
      doc.rect(50, emptyRowY, 500, rowHeight).stroke();
      
      // 세로선들
      doc.moveTo(100, emptyRowY).lineTo(100, emptyRowY + rowHeight).stroke();
      doc.moveTo(270, emptyRowY).lineTo(270, emptyRowY + rowHeight).stroke();
      doc.moveTo(360, emptyRowY).lineTo(360, emptyRowY + rowHeight).stroke();
      doc.moveTo(400, emptyRowY).lineTo(400, emptyRowY + rowHeight).stroke();
      doc.moveTo(450, emptyRowY).lineTo(450, emptyRowY + rowHeight).stroke();
      doc.moveTo(500, emptyRowY).lineTo(500, emptyRowY + rowHeight).stroke();
    }
    
    // 하단 합계
    const summaryY = dataY + 16 * rowHeight;
    doc.rect(50, summaryY, 500, rowHeight).stroke();
    
    // 세로선들
    doc.moveTo(100, summaryY).lineTo(100, summaryY + rowHeight).stroke();
    doc.moveTo(270, summaryY).lineTo(270, summaryY + rowHeight).stroke();
    doc.moveTo(360, summaryY).lineTo(360, summaryY + rowHeight).stroke();
    doc.moveTo(400, summaryY).lineTo(400, summaryY + rowHeight).stroke();
    doc.moveTo(450, summaryY).lineTo(450, summaryY + rowHeight).stroke();
    doc.moveTo(500, summaryY).lineTo(500, summaryY + rowHeight).stroke();
    
    doc.fontSize(10);
    doc.text('소계', 60, summaryY + 8);
    doc.text('1', 280, summaryY + 8);
    doc.text(supplyAmount.toLocaleString(), 370, summaryY + 8);
    doc.text('VAT', 410, summaryY + 8);
    doc.text(vatAmount.toLocaleString(), 430, summaryY + 8);
    doc.text('합계', 460, summaryY + 8);
    doc.text(totalAmount.toLocaleString(), 480, summaryY + 8);
    doc.text('인수', 510, summaryY + 8);
    doc.text('인', 530, summaryY + 8);
    
    // 하단 확인 텍스트
    doc.fontSize(8);
    doc.text('수신자확인', 50, summaryY + 40);
    doc.text('전', 530, summaryY + 40);
    
    doc.end();
    console.log('✅ 거래명세서 PDF 생성 완료');
    
  } catch (error) {
    console.error('❌ 거래명세서 생성 에러:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== 백업 관련 API ====================

// 수동 백업 생성
app.post('/api/backup/create', async (req, res) => {
  try {
    console.log('📦 수동 백업 생성 요청...');
    const result = await backupScheduler.createBackup();
    
    if (result.success) {
      res.json({
        success: true,
        message: '백업이 성공적으로 생성되었습니다.',
        backup: result
      });
    } else {
      res.status(500).json({
        success: false,
        message: '백업 생성에 실패했습니다.',
        error: result.error
      });
    }
    
  } catch (error) {
    console.error('❌ 백업 생성 API 에러:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 백업 목록 조회
app.get('/api/backup/list', (req, res) => {
  try {
    const backups = backupScheduler.getBackupList();
    res.json({
      success: true,
      backups: backups,
      count: backups.length
    });
    
  } catch (error) {
    console.error('❌ 백업 목록 조회 에러:', error);
    res.status(500).json({
      success: false,
      message: '백업 목록 조회에 실패했습니다.',
      error: error.message
    });
  }
});

// 백업에서 복구
app.post('/api/backup/restore', async (req, res) => {
  try {
    const { backupFileName } = req.body;
    
    if (!backupFileName) {
      return res.status(400).json({
        success: false,
        message: '백업 파일명이 필요합니다.'
      });
    }
    
    console.log('🔄 백업 복구 요청:', backupFileName);
    const result = await backupScheduler.restoreFromBackup(backupFileName);
    
    if (result.success) {
      res.json({
        success: true,
        message: '데이터베이스가 성공적으로 복구되었습니다.',
        restore: result
      });
    } else {
      res.status(500).json({
        success: false,
        message: '데이터베이스 복구에 실패했습니다.',
        error: result.error
      });
    }
    
  } catch (error) {
    console.error('❌ 백업 복구 API 에러:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 자동 백업 스케줄 설정
app.post('/api/backup/schedule', (req, res) => {
  try {
    const { scheduleType } = req.body; // 'daily' or 'weekly'
    
    if (!['daily', 'weekly'].includes(scheduleType)) {
      return res.status(400).json({
        success: false,
        message: '스케줄 타입은 daily 또는 weekly만 가능합니다.'
      });
    }
    
    backupScheduler.startScheduler(scheduleType);
    
    res.json({
      success: true,
      message: `${scheduleType === 'daily' ? '일일' : '주간'} 자동 백업 스케줄이 설정되었습니다.`,
      scheduleType: scheduleType
    });
    
  } catch (error) {
    console.error('❌ 백업 스케줄 설정 에러:', error);
    res.status(500).json({
      success: false,
      message: '백업 스케줄 설정에 실패했습니다.',
      error: error.message
    });
  }
});

// 자동 백업 스케줄 중지
app.post('/api/backup/schedule/stop', (req, res) => {
  try {
    backupScheduler.stopScheduler();
    
    res.json({
      success: true,
      message: '자동 백업 스케줄이 중지되었습니다.'
    });
    
  } catch (error) {
    console.error('❌ 백업 스케줄 중지 에러:', error);
    res.status(500).json({
      success: false,
      message: '백업 스케줄 중지에 실패했습니다.',
      error: error.message
    });
  }
});

// 백업 파일 다운로드
app.get('/api/backup/download/:fileName', (req, res) => {
  try {
    const { fileName } = req.params;
    const backupPath = path.join(__dirname, 'backups', fileName);
    
    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({
        success: false,
        message: '백업 파일을 찾을 수 없습니다.'
      });
    }
    
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    
    const fileStream = fs.createReadStream(backupPath);
    fileStream.pipe(res);
    
  } catch (error) {
    console.error('❌ 백업 파일 다운로드 에러:', error);
    res.status(500).json({
      success: false,
      message: '백업 파일 다운로드에 실패했습니다.',
      error: error.message
    });
  }
});

// ==================== 매출 분석 API ==================== //

// 분석 데이터 조회
app.get('/api/analytics', async (req, res) => {
  try {
    const { period = 'monthly' } = req.query;
    
    // 매출 트렌드 데이터 생성
    const trends = await generateTrendData(period);
    
    // 고객별 매출 데이터
    const customerData = await getCustomerAnalytics();
    
    // 품목별 성과 데이터
    const itemData = await getItemAnalytics();
    
    // 목표 달성률 데이터
    const targets = await getTargetData();
    
    // 요약 통계
    const summary = await getSummaryData();
    
    const analyticsData = {
      trends: {
        monthly: period === 'monthly' ? trends : [],
        quarterly: period === 'quarterly' ? trends : [],
        yearly: period === 'yearly' ? trends : []
      },
      customers: {
        top: customerData,
        distribution: customerData
      },
      items: {
        top: itemData,
        performance: itemData
      },
      targets,
      summary
    };
    
    res.json(analyticsData);
    
  } catch (error) {
    console.error('분석 데이터 조회 에러:', error);
    res.status(500).json({ error: '분석 데이터 조회 실패' });
  }
});

// PDF 리포트 내보내기
app.post('/api/analytics/export/pdf', async (req, res) => {
  try {
    const { period } = req.body;
    const PDFDocument = require('pdfkit');
    
    const doc = new PDFDocument();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=sales-report-${period}-${new Date().toISOString().slice(0, 10)}.pdf`);
    
    doc.pipe(res);
    
    // PDF 헤더
    doc.fontSize(20).text('제이에스일렉트로닉 매출분석 리포트', 50, 50);
    doc.fontSize(12).text(`기간: ${period}`, 50, 80);
    doc.text(`생성일: ${new Date().toLocaleDateString('ko-KR')}`, 50, 100);
    
    // 분석 데이터 가져오기
    const trends = await generateTrendData(period);
    const customerData = await getCustomerAnalytics();
    const itemData = await getItemAnalytics();
    
    let yPos = 140;
    
    // 매출 트렌드
    doc.fontSize(16).text('매출 트렌드', 50, yPos);
    yPos += 30;
    trends.forEach(trend => {
      doc.fontSize(10).text(`${trend.period}: ₩${trend.revenue.toLocaleString()}`, 70, yPos);
      yPos += 20;
    });
    
    yPos += 20;
    
    // 주요 고객
    doc.fontSize(16).text('주요 고객 (TOP 10)', 50, yPos);
    yPos += 30;
    customerData.slice(0, 10).forEach(customer => {
      doc.fontSize(10).text(`${customer.customer}: ₩${customer.revenue.toLocaleString()}`, 70, yPos);
      yPos += 20;
    });
    
    yPos += 20;
    
    // 주요 품목
    doc.fontSize(16).text('주요 품목 (TOP 10)', 50, yPos);
    yPos += 30;
    itemData.slice(0, 10).forEach(item => {
      doc.fontSize(10).text(`${item.name}: ${item.quantity.toLocaleString()}개`, 70, yPos);
      yPos += 20;
    });
    
    doc.end();
    
  } catch (error) {
    console.error('PDF 생성 에러:', error);
    res.status(500).json({ error: 'PDF 생성 실패' });
  }
});

// 엑셀 리포트 내보내기
app.post('/api/analytics/export/excel', async (req, res) => {
  try {
    const { period } = req.body;
    
    // 분석 데이터 가져오기
    const trends = await generateTrendData(period);
    const customerData = await getCustomerAnalytics();
    const itemData = await getItemAnalytics();
    
    // 워크북 생성
    const wb = new ExcelJS.Workbook();
    
    // 매출 트렌드 시트
    const trendsWs = wb.addWorksheet('매출트렌드');
    trendsWs.addRow(['기간', '매출액', '순이익']);
    trends.forEach(t => {
      trendsWs.addRow([t.period, t.revenue, t.profit]);
    });
    
    // 고객별 분석 시트
    const customerWs = wb.addWorksheet('고객별분석');
    customerWs.addRow(['고객사', '매출액', '거래횟수', '평균주문액', '기여도']);
    customerData.forEach(c => {
      customerWs.addRow([c.customer, c.revenue, c.transactions, c.averageOrder, c.contribution]);
    });
    
    // 품목별 분석 시트
    const itemWs = wb.addWorksheet('품목별분석');
    itemWs.addRow(['품목명', '판매량', '매출액', '평균단가', '수익률']);
    itemData.forEach(i => {
      itemWs.addRow([i.name, i.quantity, i.revenue, i.averagePrice, i.profitRate]);
    });
    
    // 엑셀 파일 생성
    const buffer = await wb.xlsx.writeBuffer();
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=sales-report-${period}-${new Date().toISOString().slice(0, 10)}.xlsx`);
    
    res.send(buffer);
    
  } catch (error) {
    console.error('엑셀 생성 에러:', error);
    res.status(500).json({ error: '엑셀 생성 실패' });
  }
});

// ==================== 분석 데이터 생성 함수들 ==================== //

async function generateTrendData(period) {
  try {
    let sql = '';
    let groupBy = '';
    
    switch (period) {
      case 'monthly':
        sql = `
          SELECT 
            strftime('%Y-%m', created_at) as period,
            SUM(amount) as revenue,
            SUM(amount * 0.15) as profit
          FROM transactions 
          WHERE created_at >= date('now', '-12 months')
          GROUP BY strftime('%Y-%m', created_at)
          ORDER BY period DESC
          LIMIT 12
        `;
        break;
      case 'quarterly':
        sql = `
          SELECT 
            strftime('%Y-Q', created_at) || 
            CASE 
              WHEN cast(strftime('%m', created_at) as integer) BETWEEN 1 AND 3 THEN '1'
              WHEN cast(strftime('%m', created_at) as integer) BETWEEN 4 AND 6 THEN '2'
              WHEN cast(strftime('%m', created_at) as integer) BETWEEN 7 AND 9 THEN '3'
              ELSE '4'
            END as period,
            SUM(amount) as revenue,
            SUM(amount * 0.15) as profit
          FROM transactions 
          WHERE created_at >= date('now', '-2 years')
          GROUP BY strftime('%Y', created_at), 
                   CASE 
                     WHEN cast(strftime('%m', created_at) as integer) BETWEEN 1 AND 3 THEN 1
                     WHEN cast(strftime('%m', created_at) as integer) BETWEEN 4 AND 6 THEN 2
                     WHEN cast(strftime('%m', created_at) as integer) BETWEEN 7 AND 9 THEN 3
                     ELSE 4
                   END
          ORDER BY period DESC
          LIMIT 8
        `;
        break;
      case 'yearly':
        sql = `
          SELECT 
            strftime('%Y', created_at) as period,
            SUM(amount) as revenue,
            SUM(amount * 0.15) as profit
          FROM transactions 
          WHERE created_at >= date('now', '-5 years')
          GROUP BY strftime('%Y', created_at)
          ORDER BY period DESC
          LIMIT 5
        `;
        break;
    }
    
    const rows = db.prepare(sql).all();
    return rows.reverse(); // 시간순 정렬
    
  } catch (error) {
    console.error('트렌드 데이터 생성 에러:', error);
    return [];
  }
}

async function getCustomerAnalytics() {
  try {
    const sql = `
      SELECT 
        customer_name as customer,
        SUM(amount) as revenue,
        COUNT(*) as transactions,
        ROUND(AVG(amount), 0) as averageOrder,
        ROUND((SUM(amount) * 100.0 / (SELECT SUM(amount) FROM transactions)), 1) as contribution
      FROM transactions 
      WHERE created_at >= date('now', '-1 year')
      GROUP BY customer_name
      ORDER BY revenue DESC
      LIMIT 20
    `;
    
    return db.prepare(sql).all();
    
  } catch (error) {
    console.error('고객 분석 데이터 생성 에러:', error);
    return [];
  }
}

async function getItemAnalytics() {
  try {
    const sql = `
      SELECT 
        item_name as name,
        SUM(quantity) as quantity,
        SUM(amount) as revenue,
        ROUND(AVG(amount / quantity), 0) as averagePrice,
        ROUND((SUM(amount * 0.15) * 100.0 / SUM(amount)), 1) as profitRate
      FROM transactions 
      WHERE created_at >= date('now', '-1 year')
        AND quantity > 0
      GROUP BY item_name
      ORDER BY revenue DESC
      LIMIT 20
    `;
    
    return db.prepare(sql).all();
    
  } catch (error) {
    console.error('품목 분석 데이터 생성 에러:', error);
    return [];
  }
}

async function getTargetData() {
  try {
    const currentMonth = new Date().toISOString().slice(0, 7);
    
    const sql = `
      SELECT 
        SUM(amount) as achieved
      FROM transactions 
      WHERE strftime('%Y-%m', created_at) = ?
    `;
    
    const result = db.prepare(sql).get(currentMonth);
    const achieved = result?.achieved || 0;
    const target = 50000000; // 월 목표: 5천만원
    const rate = Math.round((achieved / target) * 100);
    
    return {
      monthly: target,
      achieved: achieved,
      rate: rate
    };
    
  } catch (error) {
    console.error('목표 데이터 생성 에러:', error);
    return { monthly: 0, achieved: 0, rate: 0 };
  }
}

async function getSummaryData() {
  try {
    const sql = `
      SELECT 
        SUM(amount) as totalRevenue,
        SUM(amount * 0.15) as totalProfit,
        ROUND(AVG(amount), 0) as averageOrder,
        COUNT(*) as totalTransactions
      FROM transactions 
      WHERE created_at >= date('now', '-1 year')
    `;
    
    const current = db.prepare(sql).get();
    
    // 전년 동기 비교
    const lastYearSql = `
      SELECT SUM(amount) as lastYearRevenue
      FROM transactions 
      WHERE created_at >= date('now', '-2 years') 
        AND created_at < date('now', '-1 year')
    `;
    
    const lastYear = db.prepare(lastYearSql).get();
    const growth = lastYear?.lastYearRevenue > 0 
      ? Math.round(((current.totalRevenue - lastYear.lastYearRevenue) / lastYear.lastYearRevenue) * 100)
      : 0;
    
    return {
      totalRevenue: current.totalRevenue || 0,
      totalProfit: current.totalProfit || 0,
      averageOrder: current.averageOrder || 0,
      growth: growth
    };
    
  } catch (error) {
    console.error('요약 데이터 생성 에러:', error);
    return { totalRevenue: 0, totalProfit: 0, averageOrder: 0, growth: 0 };
  }
}

// ==================== 알림 시스템 API ==================== //

// 알림 목록 조회
app.get('/api/notifications', async (req, res) => {
  try {
    const { type, is_read, limit = 50, priority } = req.query;
    
    const db = database.db;
    let sql = 'SELECT * FROM notifications WHERE 1=1';
    const params = [];
    
    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }
    
    if (is_read !== undefined) {
      sql += ' AND is_read = ?';
      params.push(is_read === 'true' ? 1 : 0);
    }
    
    if (priority) {
      sql += ' AND priority = ?';
      params.push(priority);
    }
    
    // 만료되지 않은 알림만 조회
    sql += ' AND (expires_at IS NULL OR expires_at > datetime("now"))';
    sql += ' ORDER BY priority DESC, created_at DESC LIMIT ?';
    params.push(parseInt(limit));
    
    const notifications = db.prepare(sql).all(...params);
    
    // 우선순위별 개수 계산
    const priorityCounts = {
      urgent: 0,
      high: 0,
      normal: 0,
      low: 0,
      unread_total: 0
    };
    
    notifications.forEach(notification => {
      if (!notification.is_read) {
        priorityCounts[notification.priority]++;
        priorityCounts.unread_total++;
      }
    });
    
    res.json({
      notifications,
      counts: priorityCounts
    });
    
  } catch (error) {
    console.error('알림 조회 에러:', error);
    res.status(500).json({ error: '알림 조회 실패' });
  }
});

// 알림 생성
app.post('/api/notifications', async (req, res) => {
  try {
    const { type, title, message, data, priority = 'normal', expires_at, related_id, related_type } = req.body;
    
    const db = database.db;
    const result = db.prepare(`
      INSERT INTO notifications (type, title, message, data, priority, expires_at, related_id, related_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(type, title, message, data ? JSON.stringify(data) : null, priority, expires_at, related_id, related_type);
    
    res.json({ id: result.lastInsertRowid, success: true });
    
  } catch (error) {
    console.error('알림 생성 에러:', error);
    res.status(500).json({ error: '알림 생성 실패' });
  }
});

// 알림 읽음 처리
app.put('/api/notifications/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    const db = database.db;
    
    const result = db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(id);
    
    if (result.changes > 0) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: '알림을 찾을 수 없습니다' });
    }
    
  } catch (error) {
    console.error('알림 읽음 처리 에러:', error);
    res.status(500).json({ error: '알림 읽음 처리 실패' });
  }
});

// 여러 알림 읽음 처리
app.put('/api/notifications/read-multiple', async (req, res) => {
  try {
    const { ids } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: '알림 ID 목록이 필요합니다' });
    }
    
    const db = database.db;
    const placeholders = ids.map(() => '?').join(',');
    const result = db.prepare(`UPDATE notifications SET is_read = 1 WHERE id IN (${placeholders})`).run(...ids);
    
    res.json({ success: true, updatedCount: result.changes });
    
  } catch (error) {
    console.error('여러 알림 읽음 처리 에러:', error);
    res.status(500).json({ error: '여러 알림 읽음 처리 실패' });
  }
});

// 모든 알림 읽음 처리
app.put('/api/notifications/read-all', async (req, res) => {
  try {
    const db = database.db;
    const result = db.prepare('UPDATE notifications SET is_read = 1 WHERE is_read = 0').run();
    
    res.json({ success: true, updatedCount: result.changes });
    
  } catch (error) {
    console.error('모든 알림 읽음 처리 에러:', error);
    res.status(500).json({ error: '모든 알림 읽음 처리 실패' });
  }
});

// 알림 삭제
app.delete('/api/notifications/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = database.db;
    
    const result = db.prepare('DELETE FROM notifications WHERE id = ?').run(id);
    
    if (result.changes > 0) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: '알림을 찾을 수 없습니다' });
    }
    
  } catch (error) {
    console.error('알림 삭제 에러:', error);
    res.status(500).json({ error: '알림 삭제 실패' });
  }
});

// 읽은 알림 일괄 삭제
app.delete('/api/notifications/read', async (req, res) => {
  try {
    const db = database.db;
    const result = db.prepare('DELETE FROM notifications WHERE is_read = 1').run();
    
    res.json({ success: true, deletedCount: result.changes });
    
  } catch (error) {
    console.error('읽은 알림 삭제 에러:', error);
    res.status(500).json({ error: '읽은 알림 삭제 실패' });
  }
});

// 만료된 알림 정리
app.delete('/api/notifications/expired', async (req, res) => {
  try {
    const db = database.db;
    const result = db.prepare('DELETE FROM notifications WHERE expires_at IS NOT NULL AND expires_at < datetime("now")').run();
    
    res.json({ success: true, deletedCount: result.changes });
    
  } catch (error) {
    console.error('만료된 알림 삭제 에러:', error);
    res.status(500).json({ error: '만료된 알림 삭제 실패' });
  }
});

// ==================== 자동 알림 생성 함수들 ==================== //

// 재고 부족 알림 확인
function checkLowStockAlerts() {
  try {
    const db = database.db;
    const lowStockItems = db.prepare(`
      SELECT inv.*, i.name as item_name, i.code as item_code
      FROM inventory inv
      JOIN items i ON inv.item_id = i.id
      WHERE inv.current_stock <= inv.min_stock AND inv.min_stock > 0
    `).all();
    
    if (!Array.isArray(lowStockItems) || lowStockItems.length === 0) {
      return;
    }
    
    lowStockItems.forEach(item => {
      // 최근 24시간 내에 같은 품목에 대한 재고 부족 알림이 있는지 확인
      const existingAlert = db.prepare(`
        SELECT id FROM notifications 
        WHERE type = 'low_stock' 
          AND related_id = ? 
          AND related_type = 'item'
          AND created_at > datetime('now', '-1 day')
      `).get(item.item_id);
      
      if (!existingAlert) {
        db.prepare(`
          INSERT INTO notifications (type, title, message, priority, related_id, related_type, data)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          'low_stock',
          '재고 부족 알림',
          `${item.item_name} (${item.item_code}) 품목의 재고가 부족합니다. (현재: ${item.current_stock}${item.unit || '개'}, 최소: ${item.min_stock}${item.unit || '개'})`,
          'high',
          item.item_id,
          'item',
          JSON.stringify({ 
            item_id: item.item_id,
            current_stock: item.current_stock,
            min_stock: item.min_stock,
            item_name: item.item_name
          })
        );
      }
    });
    
  } catch (error) {
    console.error('재고 부족 알림 확인 에러:', error);
  }
}

// 고액 거래 알림 (500만원 이상)
function checkHighAmountTransactions(saleData) {
  try {
    const HIGH_AMOUNT_THRESHOLD = 5000000; // 500만원
    
    if (saleData.total_amount >= HIGH_AMOUNT_THRESHOLD) {
      const db = database.db;
      db.prepare(`
        INSERT INTO notifications (type, title, message, priority, related_id, related_type, data)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        'high_amount',
        '고액 거래 발생',
        `${saleData.customer_name}와의 거래에서 ${saleData.total_amount.toLocaleString()}원의 고액 거래가 발생했습니다.`,
        'urgent',
        saleData.id,
        'sale',
        JSON.stringify({
          sale_id: saleData.id,
          customer_name: saleData.customer_name,
          amount: saleData.total_amount,
          item_name: saleData.item_name
        })
      );
    }
    
  } catch (error) {
    console.error('고액 거래 알림 생성 에러:', error);
  }
}

// 새 고객 알림
function createNewCustomerAlert(customerData) {
  try {
    const db = database.db;
    db.prepare(`
      INSERT INTO notifications (type, title, message, priority, related_id, related_type, data)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      'new_customer',
      '새 고객 등록',
      `새로운 고객 '${customerData.name}'이 등록되었습니다.`,
      'normal',
      customerData.id,
      'customer',
      JSON.stringify({
        customer_id: customerData.id,
        customer_name: customerData.name,
        contact_person: customerData.contact_person
      })
    );
    
  } catch (error) {
    console.error('새 고객 알림 생성 에러:', error);
  }
}

// 백업 완료 알림
function createBackupAlert(backupInfo) {
  try {
    const db = database.db;
    const priority = backupInfo.success ? 'low' : 'high';
    const title = backupInfo.success ? '백업 완료' : '백업 실패';
    const message = backupInfo.success 
      ? `데이터 백업이 성공적으로 완료되었습니다. (파일: ${backupInfo.filename})`
      : `데이터 백업이 실패했습니다. ${backupInfo.error}`;
    
    db.prepare(`
      INSERT INTO notifications (type, title, message, priority, data, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      'backup',
      title,
      message,
      priority,
      JSON.stringify(backupInfo),
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7일 후 만료
    );
    
  } catch (error) {
    console.error('백업 알림 생성 에러:', error);
  }
}

// 주기적 알림 확인 (매 시간마다 실행)
setInterval(() => {
  checkLowStockAlerts();
}, 60 * 60 * 1000); // 1시간마다 실행

// 서버 시작 시 즉시 한 번 실행
setTimeout(checkLowStockAlerts, 5000); // 5초 후 실행

// React Router 지원 (모든 경로를 React 앱으로 라우팅)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
  console.log(`웹 브라우저에서 접속: http://localhost:${PORT}`);
  
  // 서버 시작 시 일일 자동 백업 스케줄 시작
  backupScheduler.startScheduler('daily');
  console.log('🔄 자동 백업 시스템 초기화 완료');
  console.log('🔔 알림 시스템 초기화 완료');
});