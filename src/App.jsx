import React, { useState, useEffect, useRef } from 'react';
import {
  Package,
  Calendar,
  Clock,
  User,
  LayoutDashboard,
  History,
  PlusCircle,
  Search,
  Camera,
  CheckCircle,
  AlertCircle,
  Edit,
  Trash2,
  Save,
  X,
  Database,
  RefreshCw,
  Lock,
  Image as ImageIcon,
  ImageOff,
  KeyRound,
  Settings,
  Download,
  Upload,
  FileText,
  AlertTriangle,
  ClipboardList,
  CheckSquare,
  XCircle,
  BadgeAlert,
  ArrowRightLeft,
  Loader2,
  Info,
  Archive // New Icon
} from 'lucide-react';

// Firebase SDK Imports
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithCustomToken,
  signInAnonymously,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  setDoc,
  writeBatch,
  getDoc
} from 'firebase/firestore';

// --- Firebase 初始化設定區 ---
const getFirebaseConfig = () => {
  if (typeof __firebase_config !== 'undefined') {
    return JSON.parse(__firebase_config);
  } else {
    // 🔴 請在這裡填入您的真實 Firebase 設定 🔴
    return {
      apiKey: 'AIzaSyA3szUkwzKS2fFsuF-_31FFwrCGa5qzpC4',
      authDomain: 'warehouse-system-c3ca1.firebaseapp.com',
      projectId: 'warehouse-system-c3ca1',
      storageBucket: 'warehouse-system-c3ca1.firebasestorage.app',
      messagingSenderId: '824787012597',
      appId: '1:824787012597:web:c599a8d6c03eb7d62e6ebc',
      measurementId: 'G-M72YYBL2N6',
    };
  }
};

const firebaseConfig = getFirebaseConfig();
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'warehouse-v7-title-fix';

export default function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('borrow'); // Admin Tabs
  const [userTab, setUserTab] = useState('borrow_form'); // User Tabs
  const [role, setRole] = useState('user');
  const [currentAdminPin, setCurrentAdminPin] = useState('8888');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginPassword, setLoginPassword] = useState('');
  const [passwordForm, setPasswordForm] = useState({
    old: '',
    new: '',
    confirm: '',
  });
  
  // Data States
  const [inventory, setInventory] = useState([]);
  const [logs, setLogs] = useState([]);
  const [activeLoans, setActiveLoans] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]); 
  
  // 搜尋與詳細資訊視窗狀態
  const [inventorySearch, setInventorySearch] = useState(''); // 新增搜尋關鍵字狀態
  const [viewDetailItem, setViewDetailItem] = useState(null);
  
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef(null);
  const [notification, setNotification] = useState(null);

  // 時間選擇器 Modal 狀態
  const [timePicker, setTimePicker] = useState({
    isOpen: false,
    field: null,
    tempHour: '12',
    tempMinute: '00',
    tempPeriod: 'PM',
  });

  // 刪除確認 Modal 狀態
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    itemId: null,
    itemName: '',
  });

  // 歸還 Modal 狀態
  const [returnModal, setReturnModal] = useState({
    isOpen: false,
    loan: null,
    returnQty: 1,
    isSubmitting: false
  });

  // 駁回確認 Modal 狀態
  const [rejectModal, setRejectModal] = useState({
    isOpen: false,
    request: null
  });

  const [borrowForm, setBorrowForm] = useState({
    itemId: '',
    quantity: 1,
    userName: '',
    borrowDate: '',
    borrowTime: '',
    expectedReturnDate: '',
    expectedReturnTime: '',
    photo: null,
  });

  const [isEditing, setIsEditing] = useState(false);
  const [editItemForm, setEditItemForm] = useState(null);

  const showNotification = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // --- Helper: Convert File to Base64 ---
  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });
  };

  // --- TSV 工具 ---
  const convertToTSV = (data) => {
    if (!data || !data.length) return '';
    const headers = Object.keys(data[0]);
    const headerRow = headers.join('\t');
    const rows = data.map((row) =>
      headers
        .map((fieldName) => {
          let val = row[fieldName];
          if (val === null || val === undefined) val = '';
          if (fieldName === 'imageUrl' && val.length > 100) return '[IMAGE]';
          return String(val).replace(/\t/g, ' ').replace(/\n/g, ' ');
        })
        .join('\t')
    );
    return [headerRow, ...rows].join('\n');
  };

  const parseTSV = (text) => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    const headers = lines[0].split('\t').map((h) => h.trim());
    return lines.slice(1).map((line) => {
      const values = line.split('\t');
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = values[index]?.trim();
      });
      return obj;
    });
  };

  const exportToTxt = (data, fileName) => {
    try {
      if (data.length === 0) {
        showNotification('沒有資料可以匯出', 'error');
        return;
      }
      const textContent = convertToTSV(data);
      const blob = new Blob([textContent], {
        type: 'text/plain;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute(
        'download',
        `${fileName}_${new Date().toISOString().slice(0, 10)}.txt`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showNotification('匯出成功！(內容為 Tab 分隔，可直接貼入 Excel)');
    } catch (error) {
      console.error('Export error:', error);
      showNotification('匯出失敗', 'error');
    }
  };

  // --- New Feature: Export All Data (JSON) ---
  const handleExportAllSystemData = () => {
    try {
      const fullBackup = {
        meta: {
          version: '1.0',
          exportedAt: new Date().toISOString(),
          appId: appId,
          exportedBy: user?.uid || 'anonymous'
        },
        data: {
          inventory,
          activeLoans,
          pendingRequests,
          logs
        }
      };

      const jsonString = JSON.stringify(fullBackup, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `warehouse_full_backup_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showNotification('完整系統資料匯出成功 (JSON 格式)');
    } catch (error) {
      console.error('Export All Error:', error);
      showNotification('匯出失敗', 'error');
    }
  };

  // --- New Feature: Smart Import (Handles both TXT and JSON Backup) ---
  const handleSmartImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const content = evt.target.result;
        let jsonData;
        let isFullBackup = false;

        // 1. Try parsing as JSON (Full Backup)
        try {
          const parsed = JSON.parse(content);
          if (parsed.meta && parsed.data) {
            jsonData = parsed.data;
            isFullBackup = true;
          } else if (Array.isArray(parsed)) {
            // Simple JSON array (treat as inventory list)
            jsonData = parsed;
          } else {
            // Single object or unknown JSON
            jsonData = [parsed];
          }
        } catch (e) {
          // 2. Fallback to TSV/TXT parsing (Legacy Inventory Import)
          jsonData = parseTSV(content);
        }

        if (!jsonData) {
          showNotification('檔案格式錯誤或無資料', 'error');
          return;
        }

        // Helper to process chunks (Firestore batch limit is 500)
        const processBatch = async (collectionName, items) => {
          if (!items || items.length === 0) return 0;
          const chunkSize = 400; // Safe limit
          let processedCount = 0;
          
          for (let i = 0; i < items.length; i += chunkSize) {
            const batch = writeBatch(db);
            const chunk = items.slice(i, i + chunkSize);
            
            chunk.forEach(item => {
              // Use existing ID if present, otherwise generate new
              const docId = item.id || doc(collection(db, 'dummy')).id;
              // Clean item data (remove undefined/nulls that Firestore hates, and remove 'id' field from data)
              const { id, ...cleanItem } = item;
              
              // Ensure numeric fields are numbers
              if (cleanItem.total) cleanItem.total = Number(cleanItem.total);
              if (cleanItem.inStock) cleanItem.inStock = Number(cleanItem.inStock);
              if (cleanItem.quantity) cleanItem.quantity = Number(cleanItem.quantity);

              const docRef = doc(db, 'artifacts', appId, 'public', 'data', collectionName, docId);
              batch.set(docRef, cleanItem, { merge: true });
            });
            
            await batch.commit();
            processedCount += chunk.length;
          }
          return processedCount;
        };

        let totalCount = 0;

        if (isFullBackup) {
          // Restore All Collections
          if (jsonData.inventory) totalCount += await processBatch('inventory', jsonData.inventory);
          if (jsonData.activeLoans) totalCount += await processBatch('active_loans', jsonData.activeLoans);
          if (jsonData.pendingRequests) totalCount += await processBatch('pending_requests', jsonData.pendingRequests);
          if (jsonData.logs) totalCount += await processBatch('logs', jsonData.logs);
          
          showNotification(`系統還原成功！共處理 ${totalCount} 筆資料`);
        } else {
          // Legacy Inventory Import logic
          if (!Array.isArray(jsonData) || jsonData.length === 0) {
             showNotification('無法讀取資料', 'error');
             return;
          }
          
          const batch = writeBatch(db);
          let count = 0;
          
          jsonData.forEach((row) => {
            const nameZh = row['中文名稱'] || row['nameZh'];
            const nameEn = row['英文名稱'] || row['nameEn'] || '';
            const location = row['位置'] || row['location'] || '未分類';
            const total = parseInt(row['總數量'] || row['total'] || 0);

            if (nameZh && total > 0) {
              const docRef = doc(collection(db, 'artifacts', appId, 'public', 'data', 'inventory'));
              const inStock = row['在庫數量'] !== undefined ? parseInt(row['在庫數量']) : 
                              row['inStock'] !== undefined ? parseInt(row['inStock']) : total;

              batch.set(docRef, {
                nameZh,
                nameEn,
                location,
                total,
                inStock,
                imageUrl: '' 
              });
              count++;
            }
          });

          if (count > 0) {
            await batch.commit();
            showNotification(`成功匯入 ${count} 筆器材資料 (庫存)`);
          } else {
            showNotification('匯入失敗：無有效資料', 'error');
          }
        }

      } catch (error) {
        console.error('Import error:', error);
        showNotification('讀取檔案失敗，請確認格式', 'error');
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleExportInventory = () => {
    const exportData = inventory.map((item) => ({
      中文名稱: item.nameZh,
      英文名稱: item.nameEn,
      位置: item.location,
      總數量: item.total,
      在庫數量: item.inStock,
    }));
    exportToTxt(exportData, '器材庫存清單');
  };

  const handleExportActiveLoans = () => {
    const exportData = activeLoans.map((item) => ({
      器材名稱: item.nameZh,
      借用人: item.borrower,
      借出數量: item.quantity,
      借出時間: item.borrowTime,
      預計歸還: item.expectedReturnTime,
      狀態: item.status,
    }));
    exportToTxt(exportData, '目前借出清單');
  };

  const handleExportLogs = () => {
    const exportData = logs.map((item) => ({
      時間: item.timestamp,
      動作: item.action,
      器材名稱: item.nameZh,
      數量: item.quantity,
      操作人: item.borrower,
      歸還時間: item.actualReturnTime || '-',
    }));
    exportToTxt(exportData, '借還歷史紀錄');
  };

  // --- Auth & System Logic ---
  const handleRoleSwitch = (targetRole) => {
    if (targetRole === 'admin') {
      if (role === 'admin') return;
      setLoginPassword('');
      setShowLoginModal(true);
    } else {
      setRole('user');
      setUserTab('borrow_form'); 
      showNotification('已切換為使用者模式');
    }
  };

  const handleLoginSubmit = (e) => {
    e.preventDefault();
    if (loginPassword === currentAdminPin) {
      setRole('admin');
      setActiveTab('approval');
      showNotification('管理員登入成功');
      setShowLoginModal(false);
    } else {
      showNotification('密碼錯誤，拒絕存取', 'error');
      setLoginPassword('');
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwordForm.old !== currentAdminPin) {
      showNotification('舊密碼不正確', 'error');
      return;
    }
    if (passwordForm.new !== passwordForm.confirm) {
      showNotification('新密碼兩次輸入不一致', 'error');
      return;
    }
    if (passwordForm.new.length < 4) {
      showNotification('新密碼長度至少需 4 碼', 'error');
      return;
    }
    try {
      const settingsRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'config');
      await setDoc(settingsRef, { adminPin: passwordForm.new }, { merge: true });
      setCurrentAdminPin(passwordForm.new);
      showNotification('密碼修改成功！下次登入請使用新密碼。');
      setPasswordForm({ old: '', new: '', confirm: '' });
    } catch (error) {
      console.error('Password update error:', error);
      showNotification('密碼更新失敗', 'error');
    }
  };

  // --- Document Title Fix ---
  useEffect(() => {
    document.title = "繩索器材倉庫管理系統";
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error('Auth error:', error);
        showNotification('登入系統失敗，請重新整理', 'error');
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    
    // Config Listener
    const settingsRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'config');
    const unsubSettings = onSnapshot(settingsRef, (docSnap) => {
      if (docSnap.exists() && docSnap.data().adminPin)
        setCurrentAdminPin(docSnap.data().adminPin);
    });

    // Inventory Listener
    const inventoryQuery = collection(db, 'artifacts', appId, 'public', 'data', 'inventory');
    const unsubInventory = onSnapshot(inventoryQuery, (snapshot) => {
      const items = snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
      items.sort((a, b) => a.nameEn?.localeCompare(b.nameEn));
      setInventory(items);
      setLoading(false);
    }, (error) => console.error('Sync error', error));

    // Active Loans Listener
    const loansQuery = collection(db, 'artifacts', appId, 'public', 'data', 'active_loans');
    const unsubLoans = onSnapshot(loansQuery, (snapshot) => {
      const items = snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
      setActiveLoans(items);
    }, (error) => console.error('Loans Sync error', error));

    // Pending Requests Listener
    const pendingQuery = collection(db, 'artifacts', appId, 'public', 'data', 'pending_requests');
    const unsubPending = onSnapshot(pendingQuery, (snapshot) => {
      const items = snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
       items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setPendingRequests(items);
    }, (error) => console.error('Pending Sync error', error));

    // Logs Listener
    const logsQuery = collection(db, 'artifacts', appId, 'public', 'data', 'logs');
    const unsubLogs = onSnapshot(logsQuery, (snapshot) => {
      const items = snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
      items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setLogs(items);
    }, (error) => console.error('Logs Sync error', error));

    return () => {
      unsubSettings();
      unsubInventory();
      unsubLoans();
      unsubPending();
      unsubLogs();
    };
  }, [user]);

  // --- 核心邏輯 ---

  // 1. 使用者提交申請
  const handleBorrowSubmit = async (e) => {
    e.preventDefault();
    if (!user || !borrowForm.itemId) return;
    
    // 基本檢查
    if (!borrowForm.borrowDate || !borrowForm.borrowTime || !borrowForm.expectedReturnDate || !borrowForm.expectedReturnTime) {
      showNotification('請完整填寫「借出日期時間」與「預計歸還日期時間」！', 'error');
      return;
    }

    const item = inventory.find((i) => i.id === borrowForm.itemId);
    const borrowQty = parseInt(borrowForm.quantity, 10);
    
    if (item.inStock < borrowQty) {
      showNotification(`目前顯示庫存不足 (剩餘 ${item.inStock})，請確認`, 'warning');
    }

    try {
      const timestamp = new Date().toLocaleString();
      const requestData = {
        itemId: item.id,
        nameZh: item.nameZh,
        nameEn: item.nameEn,
        location: item.location,
        quantity: borrowQty,
        borrower: borrowForm.userName || '使用者',
        borrowTime: `${borrowForm.borrowDate} ${borrowForm.borrowTime}`,
        expectedReturnTime: `${borrowForm.expectedReturnDate} ${borrowForm.expectedReturnTime}`,
        status: 'pending', 
        photo: null,
        timestamp: timestamp,
      };

      await addDoc(
        collection(db, 'artifacts', appId, 'public', 'data', 'pending_requests'),
        requestData
      );

      showNotification(`申請已送出！待管理員審核通過後，才會正式借出。`, 'success');
      setBorrowForm({ ...borrowForm, itemId: '', quantity: 1, photo: null });
    } catch (error) {
      console.error(error);
      showNotification('申請送出失敗，請重試', 'error');
    }
  };

  // 2. 管理員核准申請
  const handleApproveRequest = async (request) => {
    if (!user) return;

    try {
      const itemRef = doc(db, 'artifacts', appId, 'public', 'data', 'inventory', request.itemId);
      const itemSnap = await getDoc(itemRef);
      
      if (!itemSnap.exists()) {
        showNotification('找不到該器材，可能已被刪除', 'error');
        return;
      }

      const currentItemData = itemSnap.data();
      const currentStock = parseInt(currentItemData.inStock || 0, 10);
      const requestQty = parseInt(request.quantity, 10);

      if (currentStock < requestQty) {
        showNotification(`核准失敗！庫存不足 (目前剩餘: ${currentStock}，申請: ${requestQty})`, 'error');
        return;
      }

      const batch = writeBatch(db);

      // A. 扣除庫存
      batch.update(itemRef, { inStock: Number(currentStock) - Number(requestQty) });

      // 移除 request 中的舊 id
      const { id: oldId, ...loanData } = request;

      // B. 新增到 active_loans
      const newLoanRef = doc(collection(db, 'artifacts', appId, 'public', 'data', 'active_loans'));
      batch.set(newLoanRef, {
        ...loanData, 
        quantity: requestQty,
        status: 'borrowed',
        approvedAt: new Date().toLocaleString()
      });

      // C. 刪除 pending_requests
      const pendingRef = doc(db, 'artifacts', appId, 'public', 'data', 'pending_requests', request.id);
      batch.delete(pendingRef);

      // D. 寫入 Log
      const logRef = doc(collection(db, 'artifacts', appId, 'public', 'data', 'logs'));
      batch.set(logRef, {
        ...loanData,
        quantity: requestQty,
        action: '借出(核准)',
        status: 'approved',
        timestamp: new Date().toLocaleString()
      });

      await batch.commit();
      showNotification(`已核准借出：${request.nameZh} x ${requestQty}`);

    } catch (error) {
      console.error('Approval error:', error);
      showNotification('核准過程發生錯誤', 'error');
    }
  };

  // 3. 管理員駁回申請
  const openRejectModal = (request) => {
    setRejectModal({
      isOpen: true,
      request: request
    });
  };

  const executeReject = async () => {
    const { request } = rejectModal;
    if (!request) return;

    try {
      const batch = writeBatch(db);
      const pendingRef = doc(db, 'artifacts', appId, 'public', 'data', 'pending_requests', request.id);
      batch.delete(pendingRef);

      const logRef = doc(collection(db, 'artifacts', appId, 'public', 'data', 'logs'));
      batch.set(logRef, {
        ...request,
        action: '駁回申請',
        status: 'rejected',
        timestamp: new Date().toLocaleString()
      });

      await batch.commit();
      showNotification('已駁回該申請', 'warning');
      setRejectModal({ isOpen: false, request: null });

    } catch (error) {
      console.error('Reject error:', error);
      showNotification('駁回操作失敗', 'error');
    }
  };

  // 4. 歸還邏輯
  const openReturnModal = (loan) => {
    setReturnModal({
      isOpen: true,
      loan: loan,
      returnQty: parseInt(loan.quantity || 1, 10), 
      isSubmitting: false
    });
  };

  const executeReturn = async () => {
    const { loan, returnQty, isSubmitting } = returnModal;
    if (!user || !loan || isSubmitting) return;

    const qtyToReturn = parseInt(returnQty, 10);
    const totalBorrowedQty = parseInt(loan.quantity, 10);

    if (isNaN(qtyToReturn) || qtyToReturn <= 0) {
      showNotification('請輸入有效的歸還數量 (至少為 1)', 'error');
      return;
    }

    if (qtyToReturn > totalBorrowedQty) {
      showNotification(`歸還數量不可超過借出數量 (${totalBorrowedQty})`, 'error');
      return;
    }

    setReturnModal(prev => ({ ...prev, isSubmitting: true }));

    try {
      const loanRef = doc(db, 'artifacts', appId, 'public', 'data', 'active_loans', loan.id);
      const loanSnap = await getDoc(loanRef);

      if (!loanSnap.exists()) {
        showNotification('操作失敗：該借出單據已不存在 (可能已被其他人刪除)', 'error');
        setReturnModal({ isOpen: false, loan: null, returnQty: 1, isSubmitting: false });
        return;
      }

      const returnTime = new Date().toLocaleString();
      const currentItem = inventory.find((i) => i.id === loan.itemId);
      const batch = writeBatch(db);

      // 1. 庫存回補
      if (currentItem) {
        const itemRef = doc(db, 'artifacts', appId, 'public', 'data', 'inventory', loan.itemId);
        const currentStock = parseInt(currentItem.inStock || 0, 10);
        batch.update(itemRef, {
          inStock: Number(currentStock) + Number(qtyToReturn), 
        });
      } else {
        showNotification('注意：原器材已被刪除，僅執行紀錄更新', 'warning');
      }
      
      // 2. 判斷是否全數歸還
      const isFullReturn = qtyToReturn >= totalBorrowedQty;

      if (isFullReturn) {
        batch.delete(loanRef);
      } else {
        const remainingQty = Number(totalBorrowedQty) - Number(qtyToReturn);
        batch.update(loanRef, {
          quantity: remainingQty
        });
      }
      
      // 3. 寫入 Log
      const logRef = doc(collection(db, 'artifacts', appId, 'public', 'data', 'logs'));
      batch.set(logRef, {
        ...loan,
        quantity: qtyToReturn, 
        action: isFullReturn ? '歸還(全部)' : '歸還(部分)',
        actualReturnTime: returnTime,
        timestamp: returnTime,
      });

      await batch.commit();
      
      showNotification(`已歸還：${loan.nameZh} x ${qtyToReturn}`);
      setReturnModal({ isOpen: false, loan: null, returnQty: 1, isSubmitting: false });

    } catch (error) {
      console.error(error);
      showNotification('歸還操作失敗', 'error');
      setReturnModal(prev => ({ ...prev, isSubmitting: false }));
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setBorrowForm({ ...borrowForm, photo: url });
      showNotification('圖片已選取 (僅供本次預覽，不會上傳雲端)', 'warning');
    }
  };

  // --- Feature 1: Image handling in Edit Form ---
  const handleInventoryImageChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 500 * 1024) {
        showNotification('圖片過大！建議使用小於 500KB 的圖片', 'error');
        return;
      }
      try {
        const base64 = await fileToBase64(file);
        setEditItemForm({ ...editItemForm, imageUrl: base64 });
      } catch (err) {
        console.error(err);
        showNotification('圖片處理失敗', 'error');
      }
    }
  };

  const startEditItem = (item) => {
    setEditItemForm({ ...item, imageUrl: item.imageUrl || '' }); 
    setIsEditing(true);
  };
  const startAddNewItem = () => {
    setEditItemForm({ id: null, nameZh: '', nameEn: '', location: '', total: 1, inStock: 1, imageUrl: '' });
    setIsEditing(true);
  };

  const handleSaveItem = async (e) => {
    e.preventDefault();
    if (!user || !editItemForm.nameZh || !editItemForm.total) return;
    try {
      const saveData = {
        nameZh: editItemForm.nameZh,
        nameEn: editItemForm.nameEn,
        location: editItemForm.location,
        total: parseInt(editItemForm.total),
        imageUrl: editItemForm.imageUrl || '' 
      };

      if (editItemForm.id) {
        const oldItem = inventory.find((i) => i.id === editItemForm.id);
        const diff = parseInt(editItemForm.total) - oldItem.total;
        const newInStock = oldItem.inStock + diff;
        if (newInStock < 0) {
          showNotification('總數量不能小於目前已借出數量！', 'error');
          return;
        }
        
        const itemRef = doc(db, 'artifacts', appId, 'public', 'data', 'inventory', editItemForm.id);
        await updateDoc(itemRef, {
          ...saveData,
          inStock: newInStock,
        });
        showNotification('器材資訊已更新');
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'inventory'), {
          ...saveData,
          inStock: parseInt(editItemForm.total),
        });
        showNotification('新器材已新增');
      }
      setIsEditing(false);
      setEditItemForm(null);
    } catch (error) {
      console.error(error);
      showNotification('儲存失敗', 'error');
    }
  };

  const handleDeleteItem = (id) => {
    if (!user) {
      showNotification('系統尚未連線或未登入', 'error');
      return;
    }
    const item = inventory.find((i) => i.id === id);
    if (!item) return;
    if (Number(item.total || 0) !== Number(item.inStock || 0)) {
      showNotification('此器材尚有外借中，無法刪除！(需所有器材歸還後才可刪除)', 'error');
      return;
    }
    setDeleteModal({ isOpen: true, itemId: id, itemName: item.nameZh });
  };

  const executeDelete = async () => {
    if (!deleteModal.itemId) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'inventory', deleteModal.itemId));
      showNotification('器材已刪除');
      setDeleteModal({ isOpen: false, itemId: null, itemName: '' });
    } catch (e) {
      console.error('Delete error:', e);
      showNotification('刪除失敗', 'error');
    }
  };

  const openTimePicker = (field) => {
    const currentVal = borrowForm[field];
    let initialHour = '12', initialMinute = '00', initialPeriod = 'PM';
    if (currentVal) {
      const [h, m] = currentVal.split(':');
      let hourNum = parseInt(h);
      if (hourNum === 0) { initialHour = '12'; initialPeriod = 'AM'; }
      else if (hourNum === 12) { initialHour = '12'; initialPeriod = 'PM'; }
      else if (hourNum > 12) { initialHour = (hourNum - 12).toString().padStart(2, '0'); initialPeriod = 'PM'; }
      else { initialHour = hourNum.toString().padStart(2, '0'); initialPeriod = 'AM'; }
      initialMinute = m;
    }
    setTimePicker({ isOpen: true, field, tempHour: initialHour, tempMinute: initialMinute, tempPeriod: initialPeriod });
  };

  const confirmTimePicker = () => {
    let hour = parseInt(timePicker.tempHour);
    if (timePicker.tempPeriod === 'PM' && hour !== 12) hour += 12;
    if (timePicker.tempPeriod === 'AM' && hour === 12) hour = 0;
    const timeStr = `${hour.toString().padStart(2, '0')}:${timePicker.tempMinute}`;
    setBorrowForm({ ...borrowForm, [timePicker.field]: timeStr });
    setTimePicker({ ...timePicker, isOpen: false });
  };

  // --- Components ---

  const ApprovalQueue = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-amber-600" /> 待審核申請清單
            {pendingRequests.length > 0 && (
              <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">{pendingRequests.length}</span>
            )}
          </h3>
          <p className="text-sm text-slate-500">
            核准後才會扣除庫存並計入借出
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-amber-50 text-amber-900 font-medium border-b border-amber-100">
              <tr>
                <th className="p-3">申請時間</th>
                <th className="p-3">器材名稱</th>
                <th className="p-3">數量</th>
                <th className="p-3">申請人</th>
                <th className="p-3">預計借出</th>
                <th className="p-3">預計歸還</th>
                <th className="p-3">審核操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pendingRequests.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-slate-400">
                    目前沒有待審核的申請
                  </td>
                </tr>
              ) : (
                pendingRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50">
                    <td className="p-3 text-slate-500 text-xs">{req.timestamp}</td>
                    <td className="p-3">
                      <div className="font-medium text-slate-800">{req.nameZh}</div>
                      <div className="text-xs text-slate-500">{req.nameEn}</div>
                      <div className="text-xs text-slate-400 mt-1">
                        庫存: {inventory.find(i=>i.id===req.itemId)?.inStock ?? '未知'}
                      </div>
                    </td>
                    <td className="p-3 font-bold text-blue-600">x {req.quantity}</td>
                    <td className="p-3">{req.borrower}</td>
                    <td className="p-3 text-slate-600">{req.borrowTime}</td>
                    <td className="p-3 text-slate-600">{req.expectedReturnTime}</td>
                    <td className="p-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApproveRequest(req)}
                          className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-xs transition-colors shadow-sm"
                        >
                          <CheckSquare size={14} /> 核准
                        </button>
                        <button
                          onClick={() => openRejectModal(req)}
                          className="flex items-center gap-1 bg-red-100 hover:bg-red-200 text-red-700 border border-red-200 px-3 py-1.5 rounded text-xs transition-colors"
                        >
                          <XCircle size={14} /> 駁回
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const InventoryOverview = ({ readOnly = false }) => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" /> 目前借出狀況 (追蹤清單)
            {readOnly && <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">僅供檢視</span>}
          </h3>
          {!readOnly && (
            <button
              onClick={handleExportActiveLoans}
              className="flex items-center gap-2 text-sm text-green-700 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded border border-green-200 transition-colors"
            >
              <FileText size={16} /> 匯出 TXT
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 font-medium border-b">
              <tr>
                <th className="p-3">器材名稱</th>
                <th className="p-3">借出數量</th>
                <th className="p-3">借用人</th>
                <th className="p-3">借出時間</th>
                <th className="p-3">預計歸還</th>
                <th className="p-3">狀態</th>
                {!readOnly && <th className="p-3">操作</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activeLoans.length === 0 ? (
                <tr>
                  <td colSpan={readOnly ? 6 : 7} className="p-4 text-center text-slate-400">
                    目前沒有借出的器材
                  </td>
                </tr>
              ) : (
                activeLoans.map((loan) => (
                  <tr key={loan.id} className="hover:bg-slate-50">
                    <td className="p-3">
                      <div className="font-medium text-slate-800">{loan.nameZh}</div>
                      <div className="text-xs text-slate-500">{loan.nameEn}</div>
                    </td>
                    <td className="p-3 font-bold text-blue-600">x {loan.quantity}</td>
                    <td className="p-3">
                      <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs">
                        {loan.borrower}
                      </span>
                    </td>
                    <td className="p-3 text-slate-600">{loan.borrowTime}</td>
                    <td className="p-3 text-amber-600 font-medium">{loan.expectedReturnTime}</td>
                    <td className="p-3">
                      <span className="text-red-500 flex items-center gap-1 text-xs">
                        借出中
                      </span>
                    </td>
                    {!readOnly && (
                      <td className="p-3">
                        <button
                          onClick={() => openReturnModal(loan)}
                          className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs transition-colors shadow-sm flex items-center gap-1"
                        >
                          <ArrowRightLeft size={12} /> 歸還入庫
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // --- Feature 3: Inventory Manager with Detail View ---
  const InventoryManager = ({ readOnly = false }) => {
    // Calculate loans specific to the selected item
    const itemLoans = viewDetailItem 
      ? activeLoans.filter(loan => loan.itemId === viewDetailItem.id)
      : [];

    // 關鍵字搜尋過濾邏輯
    const filteredInventory = inventory.filter(item => {
      if (!inventorySearch.trim()) return true;
      const term = inventorySearch.toLowerCase();
      return (
        (item.nameZh || '').toLowerCase().includes(term) ||
        (item.nameEn || '').toLowerCase().includes(term) ||
        (item.location || '').toLowerCase().includes(term)
      );
    });

    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 relative">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5 text-purple-600" /> 庫存管理與統計
            {readOnly && <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">僅供檢視</span>}
          </h3>
          {/* Only show actions if NOT readOnly */}
          {!readOnly && (
            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              <input type="file" ref={fileInputRef} onChange={handleSmartImport} accept=".txt,.json" className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors border border-slate-300">
                <Upload size={16} /> 匯入資料
              </button>
              <button onClick={handleExportAllSystemData} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors shadow-sm">
                <Archive size={16} /> 匯出完整備份(JSON)
              </button>
              <button onClick={handleExportInventory} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors shadow-sm">
                <FileText size={16} /> 匯出庫存清單(TXT)
              </button>
              <button onClick={startAddNewItem} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors shadow-sm">
                <PlusCircle size={16} /> 新增器材
              </button>
            </div>
          )}
        </div>

        {/* 搜尋列 */}
        <div className="mb-4 relative">
          <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="輸入關鍵字搜尋器材名稱、英文名稱或存放位置..."
            className="w-full pl-10 pr-10 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none transition-shadow"
            value={inventorySearch}
            onChange={(e) => setInventorySearch(e.target.value)}
          />
          {inventorySearch && (
            <button
              onClick={() => setInventorySearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              title="清除搜尋"
            >
              <X size={18} />
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 font-medium border-b">
              <tr>
                <th className="p-3 text-center w-20">照片</th>
                <th className="p-3">器材品項</th>
                <th className="p-3">存放位置</th>
                <th className="p-3 text-center">總數量</th>
                <th className="p-3 text-center">在庫</th>
                <th className="p-3 text-center">借出</th>
                <th className="p-3 text-center">狀態</th>
                {/* Only show management column if NOT readOnly */}
                {!readOnly && <th className="p-3 text-right">管理</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInventory.length === 0 ? (
                <tr>
                  <td colSpan={readOnly ? 7 : 8} className="p-8 text-center text-slate-400">
                    {inventorySearch ? `找不到符合「${inventorySearch}」的器材` : (
                      <>
                        目前資料庫為空
                        {!readOnly && '，請點擊上方按鈕新增或匯入 TXT/JSON'}
                      </>
                    )}
                  </td>
                </tr>
              ) : (
                filteredInventory.map((item) => (
                  <tr 
                    key={item.id} 
                    className="hover:bg-slate-50 group cursor-pointer transition-colors"
                    onClick={() => setViewDetailItem(item)} // Feature: Click to view details
                  >
                    <td className="p-3 text-center">
                      {item.imageUrl ? (
                        <img 
                          src={item.imageUrl} 
                          alt={item.nameZh} 
                          className="w-12 h-12 object-cover rounded-md border border-slate-200 mx-auto" 
                        />
                      ) : (
                        <div className="w-12 h-12 bg-slate-100 rounded-md border border-slate-200 mx-auto flex items-center justify-center">
                          <ImageIcon className="text-slate-300 w-6 h-6" />
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="font-medium text-slate-800">{item.nameZh}</div>
                      <div className="text-xs text-slate-500">{item.nameEn}</div>
                    </td>
                    <td className="p-3 text-slate-600">{item.location}</td>
                    <td className="p-3 text-center font-bold">{item.total}</td>
                    <td className="p-3 text-center text-green-600">{item.inStock}</td>
                    <td className="p-3 text-center text-red-500">{item.total - item.inStock}</td>
                    <td className="p-3 text-center align-middle">
                      <div className="w-24 inline-block bg-slate-200 rounded-full h-2 overflow-hidden align-middle">
                        <div
                          className={`h-2 rounded-full ${item.inStock === 0 ? 'bg-red-500' : 'bg-green-500'}`}
                          style={{ width: `${item.total > 0 ? (item.inStock / item.total) * 100 : 0}%` }}
                        ></div>
                      </div>
                    </td>
                    {!readOnly && (
                      <td className="p-3 text-right">
                        <div className="flex justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <button onClick={(e) => { e.stopPropagation(); startEditItem(item); }} className="text-slate-400 hover:text-blue-600 p-1" title="編輯">
                            <Edit size={16} />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); handleDeleteItem(item.id); }} className="text-slate-400 hover:text-red-600 p-1 cursor-pointer" title="刪除">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Feature: Detail View Modal */}
        {viewDetailItem && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setViewDetailItem(null)}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-fade-in flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
              <div className="bg-purple-600 p-4 text-white flex justify-between items-center shrink-0">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <Info size={20} /> 借出明細：{viewDetailItem.nameZh}
                </h3>
                <button onClick={() => setViewDetailItem(null)} className="text-purple-200 hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto">
                <div className="flex gap-4 mb-6 border-b border-slate-100 pb-4">
                   {viewDetailItem.imageUrl ? (
                      <img src={viewDetailItem.imageUrl} alt="Item" className="w-20 h-20 object-cover rounded-lg border border-slate-200 shadow-sm" />
                   ) : (
                      <div className="w-20 h-20 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400">
                        <ImageIcon size={32} />
                      </div>
                   )}
                   <div>
                     <div className="text-xl font-bold text-slate-800">{viewDetailItem.nameZh}</div>
                     <div className="text-sm text-slate-500 mb-1">{viewDetailItem.nameEn}</div>
                     <div className="flex gap-3 text-sm mt-2">
                        <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600">總數: {viewDetailItem.total}</span>
                        <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded">在庫: {viewDetailItem.inStock}</span>
                        <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded">
                           借出中: {itemLoans.reduce((acc, curr) => acc + parseInt(curr.quantity), 0)}
                        </span>
                     </div>
                   </div>
                </div>

                <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                  <Clock size={16} className="text-purple-600" /> 目前借用人列表
                </h4>
                
                {itemLoans.length === 0 ? (
                  <div className="text-center py-8 bg-slate-50 rounded-lg border border-dashed border-slate-200 text-slate-400">
                    目前沒有人借用此器材
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 rounded-lg">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                        <tr>
                          <th className="p-3">借用人</th>
                          <th className="p-3">數量</th>
                          <th className="p-3">借出時間</th>
                          <th className="p-3">預計歸還</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {itemLoans.map((loan) => (
                          <tr key={loan.id} className="hover:bg-slate-50">
                            <td className="p-3 font-medium text-slate-800">
                              <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full text-xs mr-1">
                                {loan.borrower}
                              </span>
                            </td>
                            <td className="p-3 font-bold text-purple-600">x {loan.quantity}</td>
                            <td className="p-3 text-slate-500">{loan.borrowTime}</td>
                            <td className="p-3 text-amber-600">{loan.expectedReturnTime}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div className="p-4 border-t border-slate-100 bg-slate-50 text-right shrink-0">
                <button 
                  onClick={() => setViewDetailItem(null)} 
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-medium transition-colors"
                >
                  關閉
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Modal - Only render if editing state is active (implicit !readOnly) */}
        {isEditing && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in max-h-[90vh] overflow-y-auto">
              <div className="bg-slate-50 p-4 border-b border-slate-100 flex justify-between items-center">
                <h3 className="font-bold text-lg text-slate-800">{editItemForm.id ? '編輯器材資訊' : '新增器材'}</h3>
                <button onClick={() => setIsEditing(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
              </div>
              <form onSubmit={handleSaveItem} className="p-6 space-y-4">
                <div className="flex flex-col items-center gap-4 mb-4">
                  <div className="w-32 h-32 bg-slate-100 border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center overflow-hidden relative group cursor-pointer">
                     {editItemForm.imageUrl ? (
                       <img src={editItemForm.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                     ) : (
                       <div className="flex flex-col items-center text-slate-400">
                         <Upload size={24} />
                         <span className="text-xs mt-1">上傳照片</span>
                       </div>
                     )}
                     <input 
                      type="file" 
                      accept="image/*" 
                      className="absolute inset-0 opacity-0 cursor-pointer" 
                      onChange={handleInventoryImageChange}
                     />
                  </div>
                  <span className="text-xs text-slate-400">點擊圖片區域以上傳 (建議使用小圖)</span>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">器材中文名稱</label>
                  <input type="text" required className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none" value={editItemForm.nameZh} onChange={(e) => setEditItemForm({ ...editItemForm, nameZh: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">器材英文名稱</label>
                  <input type="text" className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none" value={editItemForm.nameEn} onChange={(e) => setEditItemForm({ ...editItemForm, nameEn: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">存放位置</label>
                    <input type="text" required className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none" value={editItemForm.location} onChange={(e) => setEditItemForm({ ...editItemForm, location: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">總數量</label>
                    <input type="number" min="1" required className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none" value={editItemForm.total} onChange={(e) => setEditItemForm({ ...editItemForm, total: e.target.value })} />
                  </div>
                </div>
                <div className="pt-2 flex gap-3">
                  <button type="button" onClick={() => setIsEditing(false)} className="flex-1 py-2 border border-slate-300 rounded text-slate-600 hover:bg-slate-50 font-medium">取消</button>
                  <button type="submit" className="flex-1 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium shadow-sm">儲存</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  };

  const TransactionLogs = ({ readOnly = false }) => (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <History className="w-5 h-5 text-slate-600" /> 借還歷史紀錄 (Log)
          {readOnly && <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">僅供檢視</span>}
        </h3>
        {!readOnly && (
          <button onClick={handleExportLogs} className="flex items-center gap-2 text-sm text-green-700 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded border border-green-200 transition-colors">
            <FileText size={16} /> 匯出紀錄 TXT
          </button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-600 font-medium border-b">
            <tr>
              <th className="p-3">日期時間</th>
              <th className="p-3">動作</th>
              <th className="p-3">器材名稱</th>
              <th className="p-3">數量</th>
              <th className="p-3">操作人/借用人</th>
              <th className="p-3">備註</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.length === 0 ? (
              <tr><td colSpan="6" className="p-4 text-center text-slate-400">尚無紀錄</td></tr>
            ) : (
              logs.map((log, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="p-3 text-slate-500">{log.timestamp}</td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded text-xs ${
                      log.action.includes('借出') ? 'bg-amber-100 text-amber-700' : 
                      log.action.includes('駁回') ? 'bg-red-100 text-red-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="p-3 text-slate-800">{log.nameZh}</td>
                  <td className="p-3 font-bold">{log.quantity}</td>
                  <td className="p-3 text-slate-600">{log.borrower}</td>
                  <td className="p-3 text-xs text-slate-400">{log.status === 'pending' ? '申請中' : '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const SystemSettings = () => (
    <div className="max-w-xl mx-auto bg-white p-8 rounded-lg shadow-md border border-slate-200">
      <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
        <Settings className="w-6 h-6 text-slate-600" /> 系統設定
      </h3>
      <div className="bg-slate-50 p-6 rounded-lg border border-slate-100">
        <h4 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
          <KeyRound size={18} /> 修改管理員密碼
        </h4>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">目前密碼</label>
            <input type="password" required className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={passwordForm.old} onChange={(e) => setPasswordForm({ ...passwordForm, old: e.target.value })} placeholder="請輸入目前密碼" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">新密碼</label>
              <input type="password" required className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={passwordForm.new} onChange={(e) => setPasswordForm({ ...passwordForm, new: e.target.value })} placeholder="至少 4 碼" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">確認新密碼</label>
              <input type="password" required className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={passwordForm.confirm} onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })} placeholder="再次輸入" />
            </div>
          </div>
          <button type="submit" className="w-full bg-slate-700 hover:bg-slate-800 text-white font-medium py-2 rounded transition-colors shadow-sm">更新密碼</button>
        </form>
      </div>
    </div>
  );

  const UserBorrowInterface = () => {
    const selectedItem = inventory.find((i) => i.id === borrowForm.itemId);
    const maxQuantity = selectedItem ? selectedItem.inStock : 1;
    return (
      <div className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow-md border border-slate-200">
        <h3 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
          <PlusCircle className="w-6 h-6 text-blue-600" /> 器材借用申請
        </h3>
        <form onSubmit={handleBorrowSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">選擇器材</label>
              <select required className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={borrowForm.itemId} onChange={(e) => setBorrowForm({ ...borrowForm, itemId: e.target.value, quantity: 1 })}>
                <option value="">-- 請選擇 --</option>
                {inventory.filter((i) => i.inStock > 0).map((item) => (
                  <option key={item.id} value={item.id}>{item.nameZh} ({item.nameEn}) - 剩餘 {item.inStock}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">數量</label>
              <input type="number" min="1" max={maxQuantity} required disabled={!borrowForm.itemId} className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-400" value={borrowForm.quantity} onChange={(e) => setBorrowForm({ ...borrowForm, quantity: e.target.value })} />
              {borrowForm.itemId && <p className="text-xs text-slate-500 mt-1">最大可借: {maxQuantity}</p>}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">借用人姓名</label>
            <input type="text" required placeholder="請輸入您的姓名" className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={borrowForm.userName} onChange={(e) => setBorrowForm({ ...borrowForm, userName: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">借出日期</label>
              <input type="date" required className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={borrowForm.borrowDate} onChange={(e) => setBorrowForm({ ...borrowForm, borrowDate: e.target.value })} />
            </div>
            <div className="relative">
              <label className="block text-sm font-medium text-slate-700 mb-2">借出時間</label>
              <div onClick={() => openTimePicker('borrowTime')} className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 cursor-pointer bg-white flex items-center justify-between">
                <span>{borrowForm.borrowTime || <span className="text-slate-400">請選擇時間</span>}</span>
                <Clock size={16} className="text-slate-400" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">預計歸還日期</label>
              <input type="date" required className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={borrowForm.expectedReturnDate} onChange={(e) => setBorrowForm({ ...borrowForm, expectedReturnDate: e.target.value })} />
            </div>
            <div className="relative">
              <label className="block text-sm font-medium text-slate-700 mb-2">預計歸還時間</label>
              <div onClick={() => openTimePicker('expectedReturnTime')} className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 cursor-pointer bg-white flex items-center justify-between">
                <span>{borrowForm.expectedReturnTime || <span className="text-slate-400">請選擇時間</span>}</span>
                <Clock size={16} className="text-slate-400" />
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">器材狀況拍照 (僅本地預覽)</label>
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:bg-slate-50 transition-colors relative bg-slate-50">
              <input type="file" accept="image/*" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={handleImageUpload} />
              {borrowForm.photo ? (
                <div className="flex flex-col items-center">
                  <img src={borrowForm.photo} alt="Preview" className="h-32 object-contain mb-2" />
                  <span className="text-amber-600 text-sm flex items-center gap-1 font-bold"><AlertCircle size={14} /> 注意：照片僅供現在確認，不會上傳雲端</span>
                </div>
              ) : (
                <div className="flex flex-col items-center text-slate-500">
                  <Camera className="w-8 h-8 mb-2" />
                  <span>點擊上傳 (注意：僅限本地預覽)</span>
                </div>
              )}
            </div>
          </div>
          <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-colors shadow-lg shadow-blue-200">
            送出借出申請 (待審核)
          </button>
        </form>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 text-slate-500">
        <div className="flex flex-col items-center gap-2">
          <RefreshCw className="animate-spin w-8 h-8 text-blue-600" />
          <p>系統連線中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-900">
      <nav className="bg-slate-800 text-white p-4 sticky top-0 z-50 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <Package className="w-8 h-8 text-blue-400" />
            <div className="flex flex-col">
              <h1 className="text-xl font-bold tracking-wide">繩索器材倉庫管理系統</h1>
              <span className="text-xs text-blue-300 font-light flex items-center gap-1"><CheckCircle size={10} /> 雲端連線中 (Firestore)</span>
            </div>
          </div>
          <div className="flex items-center gap-4 bg-slate-700 p-1 rounded-lg">
            <button
              onClick={() => handleRoleSwitch('admin')}
              className={`px-4 py-2 rounded-md text-sm transition-all flex items-center gap-2 ${role === 'admin' ? 'bg-blue-600 shadow-sm' : 'hover:bg-slate-600 text-slate-300'}`}
            >
              <User size={16} /> 管理者 {role !== 'admin' && <Lock size={12} className="text-slate-400" />}
            </button>
            <button
              onClick={() => handleRoleSwitch('user')}
              className={`px-4 py-2 rounded-md text-sm transition-all flex items-center gap-2 ${role === 'user' ? 'bg-green-600 shadow-sm' : 'hover:bg-slate-600 text-slate-300'}`}
            >
              <User size={16} /> 使用者
            </button>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto p-4 md:p-6">
        {notification && (
          <div className={`fixed top-20 right-4 p-4 rounded-lg shadow-lg text-white animate-bounce z-50 ${notification.type === 'error' ? 'bg-red-500' : notification.type === 'warning' ? 'bg-amber-500' : 'bg-green-600'}`}>
            <div className="flex items-center gap-2">
              {notification.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
              {notification.msg}
            </div>
          </div>
        )}
        
        {/* Admin Navigation Tabs */}
        {role === 'admin' && (
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
            <button
              onClick={() => setActiveTab('approval')}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors flex items-center gap-2 ${activeTab === 'approval' ? 'bg-white text-amber-600 shadow-sm ring-1 ring-amber-100' : 'text-slate-600 hover:bg-white/50'}`}
            >
              <ClipboardList size={18} /> 審核申請
              {pendingRequests.length > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{pendingRequests.length}</span>}
            </button>
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors flex items-center gap-2 ${activeTab === 'dashboard' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-blue-100' : 'text-slate-600 hover:bg-white/50'}`}
            >
              <Clock size={18} /> 借出狀況清單
            </button>
            <button
              onClick={() => setActiveTab('inventory')}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors flex items-center gap-2 ${activeTab === 'inventory' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-blue-100' : 'text-slate-600 hover:bg-white/50'}`}
            >
              <LayoutDashboard size={18} /> 庫存管理與統計
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors flex items-center gap-2 ${activeTab === 'history' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-blue-100' : 'text-slate-600 hover:bg-white/50'}`}
            >
              <History size={18} /> 借還歷史紀錄
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors flex items-center gap-2 ${activeTab === 'settings' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-blue-100' : 'text-slate-600 hover:bg-white/50'}`}
            >
              <Settings size={18} /> 系統設定
            </button>
          </div>
        )}

        {/* Feature 2: User Navigation Tabs */}
        {role === 'user' && (
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
             <button
              onClick={() => setUserTab('borrow_form')}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors flex items-center gap-2 ${userTab === 'borrow_form' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-blue-100' : 'text-slate-600 hover:bg-white/50'}`}
            >
              <PlusCircle size={18} /> 我要借用
            </button>
            <button
              onClick={() => setUserTab('view_dashboard')}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors flex items-center gap-2 ${userTab === 'view_dashboard' ? 'bg-white text-purple-600 shadow-sm ring-1 ring-purple-100' : 'text-slate-600 hover:bg-white/50'}`}
            >
              <Clock size={18} /> 借出狀況(唯讀)
            </button>
            <button
              onClick={() => setUserTab('view_inventory')}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors flex items-center gap-2 ${userTab === 'view_inventory' ? 'bg-white text-purple-600 shadow-sm ring-1 ring-purple-100' : 'text-slate-600 hover:bg-white/50'}`}
            >
              <LayoutDashboard size={18} /> 庫存列表(唯讀)
            </button>
            <button
              onClick={() => setUserTab('view_history')}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors flex items-center gap-2 ${userTab === 'view_history' ? 'bg-white text-purple-600 shadow-sm ring-1 ring-purple-100' : 'text-slate-600 hover:bg-white/50'}`}
            >
              <History size={18} /> 歷史紀錄(唯讀)
            </button>
          </div>
        )}

        <div className="animate-fade-in">
          {/* Admin Views */}
          {activeTab === 'approval' && role === 'admin' && ApprovalQueue()}
          {activeTab === 'dashboard' && role === 'admin' && InventoryOverview({ readOnly: false })}
          {activeTab === 'inventory' && role === 'admin' && InventoryManager({ readOnly: false })}
          {activeTab === 'history' && role === 'admin' && TransactionLogs({ readOnly: false })}
          {activeTab === 'settings' && role === 'admin' && SystemSettings()}
          
          {/* User Views */}
          {role === 'user' && userTab === 'borrow_form' && UserBorrowInterface()}
          {role === 'user' && userTab === 'view_dashboard' && InventoryOverview({ readOnly: true })}
          {role === 'user' && userTab === 'view_inventory' && InventoryManager({ readOnly: true })}
          {role === 'user' && userTab === 'view_history' && TransactionLogs({ readOnly: true })}
        </div>
      </main>
      
      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-fade-in">
            <div className="bg-slate-800 p-4 text-white flex justify-between items-center">
              <h3 className="font-bold text-lg flex items-center gap-2"><Lock size={18} /> 管理員驗證</h3>
              <button onClick={() => setShowLoginModal(false)} className="text-slate-300 hover:text-white transition-colors"><X size={20} /></button>
            </div>
            <form onSubmit={handleLoginSubmit} className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">請輸入管理密碼 (預設: 8888)</label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input type="password" autoFocus required className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Enter Password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
                </div>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowLoginModal(false)} className="flex-1 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 font-medium transition-colors">取消</button>
                <button type="submit" className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm transition-colors">確認登入</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Time Picker & Other Modals (Reuse existing logic) */}
      {timePicker.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-fade-in">
            <div className="bg-blue-600 p-4 text-white flex justify-between items-center">
              <h3 className="font-bold text-lg flex items-center gap-2"><Clock size={18} /> 選擇時間</h3>
              <button onClick={() => setTimePicker({ ...timePicker, isOpen: false })} className="text-blue-200 hover:text-white transition-colors"><X size={20} /></button>
            </div>
            <div className="p-6">
              <div className="flex gap-4 justify-center items-center mb-6">
                <div className="flex flex-col items-center">
                  <span className="text-xs text-slate-500 font-bold mb-1">時段</span>
                  <select className="p-3 text-lg border border-slate-300 rounded-lg bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700" value={timePicker.tempPeriod} onChange={(e) => setTimePicker({ ...timePicker, tempPeriod: e.target.value })}>
                    <option value="AM">上午 (AM)</option>
                    <option value="PM">下午 (PM)</option>
                  </select>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-xs text-slate-500 font-bold mb-1">時</span>
                  <select className="p-3 text-lg border border-slate-300 rounded-lg bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700" value={timePicker.tempHour} onChange={(e) => setTimePicker({ ...timePicker, tempHour: e.target.value })}>
                    {Array.from({ length: 12 }, (_, i) => {
                      const val = (i + 1).toString().padStart(2, '0');
                      return <option key={val} value={val}>{val}</option>;
                    })}
                  </select>
                </div>
                <span className="text-2xl font-bold text-slate-300 mt-4">:</span>
                <div className="flex flex-col items-center">
                  <span className="text-xs text-slate-500 font-bold mb-1">分</span>
                  <select className="p-3 text-lg border border-slate-300 rounded-lg bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700" value={timePicker.tempMinute} onChange={(e) => setTimePicker({ ...timePicker, tempMinute: e.target.value })}>
                    {Array.from({ length: 60 }, (_, i) => {
                      const val = i.toString().padStart(2, '0');
                      return <option key={val} value={val}>{val}</option>;
                    })}
                  </select>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setTimePicker({ ...timePicker, isOpen: false })} className="flex-1 py-3 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 font-medium transition-colors">取消</button>
                <button onClick={confirmTimePicker} className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm transition-colors">確認時間</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* 駁回確認 Modal */}
      {rejectModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-fade-in border-t-4 border-red-500">
            <div className="p-6">
              <div className="flex flex-col items-center text-center mb-6">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4"><XCircle className="w-8 h-8 text-red-600" /></div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">確定要駁回嗎？</h3>
                <p className="text-slate-500">您即將駁回 <span className="font-bold text-slate-800">{rejectModal.request?.borrower}</span> 的申請。<br />此動作<span className="text-red-600 font-bold">無法復原</span>。</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setRejectModal({ isOpen: false, request: null })} className="flex-1 py-3 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 font-medium transition-colors">取消</button>
                <button onClick={executeReject} className="flex-1 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium shadow-sm transition-colors">確認駁回</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* 歸還 Modal */}
      {returnModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-fade-in">
            <div className="bg-green-600 p-4 text-white flex justify-between items-center">
              <h3 className="font-bold text-lg flex items-center gap-2"><ArrowRightLeft size={18} /> 歸還入庫</h3>
              <button 
                onClick={() => setReturnModal({ isOpen: false, loan: null, returnQty: 1, isSubmitting: false })} 
                disabled={returnModal.isSubmitting}
                className="text-green-100 hover:text-white transition-colors disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">器材名稱</label>
                <div className="text-lg font-bold text-slate-800">{returnModal.loan?.nameZh}</div>
                <div className="text-sm text-slate-500">{returnModal.loan?.nameEn}</div>
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-2">歸還數量</label>
                <div className="flex items-center gap-2">
                  <input 
                    type="number" 
                    min="1" 
                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-xl font-bold text-center" 
                    value={returnModal.returnQty} 
                    disabled={returnModal.isSubmitting}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                          setReturnModal({ ...returnModal, returnQty: '' });
                          return;
                      }
                      
                      let numVal = parseInt(val, 10);
                      const maxQty = parseInt(returnModal.loan?.quantity || 1, 10);

                      if (isNaN(numVal)) numVal = 1;
                      if (numVal > maxQty) numVal = maxQty;
                      if (numVal < 1) numVal = 1;

                      setReturnModal({ ...returnModal, returnQty: numVal });
                    }} 
                  />
                  <span className="text-slate-400 font-medium">/ {returnModal.loan?.quantity}</span>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  * 若歸還數量等於借出總數，該紀錄將從清單中移除。
                </p>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setReturnModal({ isOpen: false, loan: null, returnQty: 1, isSubmitting: false })} 
                  disabled={returnModal.isSubmitting}
                  className="flex-1 py-3 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  取消
                </button>
                <button 
                  onClick={executeReturn} 
                  disabled={returnModal.isSubmitting}
                  className="flex-1 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {returnModal.isSubmitting ? (
                    <><Loader2 className="animate-spin" size={20} /> 處理中...</>
                  ) : (
                    '確認歸還'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-fade-in border-t-4 border-red-500">
            <div className="p-6">
              <div className="flex flex-col items-center text-center mb-6">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4"><AlertTriangle className="w-8 h-8 text-red-600" /></div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">確定要刪除嗎？</h3>
                <p className="text-slate-500">您即將刪除 <span className="font-bold text-slate-800">{deleteModal.itemName}</span>。<br />此動作<span className="text-red-600 font-bold">無法復原</span>。</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setDeleteModal({ isOpen: false, itemId: null, itemName: '' })} className="flex-1 py-3 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 font-medium transition-colors">取消</button>
                <button onClick={executeDelete} className="flex-1 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium shadow-sm transition-colors">確認刪除</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
