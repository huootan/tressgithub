// 20260511 真實Firebase + 資安升級版 + Google登入版
import React, { useState, useEffect, useRef } from 'react';
import {
  Package, Calendar, Clock, User, LayoutDashboard, History, PlusCircle,
  Search, Camera, CheckCircle, AlertCircle, Edit, Trash2, Save, X,
  RefreshCw, Lock, Image as ImageIcon, KeyRound, Settings, Download,
  Upload, FileText, AlertTriangle, ClipboardList, CheckSquare, XCircle,
  ArrowRightLeft, Loader2, Info, Archive, ShieldCheck
} from 'lucide-react';

// Firebase SDK Imports
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInAnonymously,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,   // 新增 Google 驗證提供者
  signInWithPopup       // 新增 彈窗登入方法
} from 'firebase/auth';
import {
  getFirestore, collection, doc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, setDoc, writeBatch, getDoc
} from 'firebase/firestore';

// --- Firebase 初始化設定區 ---
// ⚠️ 資安強烈警告：目前為了讓你方便測試先寫死在此。
// 正式上線或放上 GitHub 前，請務必改用環境變數 (例如 import.meta.env.VITE_FIREBASE_API_KEY)
const firebaseConfig = {
  apiKey: "AIzaSyDWSRg2CrBkiftBCOtPaNMhauN1S7tXDQ0",
  authDomain: 'warehouse-system-c3ca1.firebaseapp.com',
  projectId: 'warehouse-system-c3ca1',
  storageBucket: 'warehouse-system-c3ca1.firebasestorage.app',
  messagingSenderId: '824787012597',
  appId: '1:824787012597:web:c599a8d6c03eb7d62e6ebc',
  measurementId: 'G-M72YYBL2N6',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- 資安優化：簡易資料清理工具 ---
const sanitizeString = (str) => {
  if (!str) return '';
  return String(str).trim().substring(0, 200).replace(/[<>]/g, ''); // 濾除角括號防 XSS
};

export default function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('approval');
  const [userTab, setUserTab] = useState('borrow_form');
  const [role, setRole] = useState('user');
  
  // 登入 Modal 狀態 (已移除 Email 與 Password 狀態，改用 Google 登入)
  const [showLoginModal, setShowLoginModal] = useState(false);
  
  // Data States
  const [inventory, setInventory] = useState([]);
  const [logs, setLogs] = useState([]);
  const [activeLoans, setActiveLoans] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]); 
  
  // 搜尋與詳細資訊視窗狀態
  const [inventorySearch, setInventorySearch] = useState(''); 
  const [loanSearch, setLoanSearch] = useState('');           
  const [logSearch, setLogSearch] = useState('');             
  const [viewDetailItem, setViewDetailItem] = useState(null);
  
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef(null);
  const [notification, setNotification] = useState(null);

  // 時間選擇器 Modal 狀態
  const [timePicker, setTimePicker] = useState({
    isOpen: false, field: null, tempHour: '12', tempMinute: '00', tempPeriod: 'PM',
  });

  // 刪除確認 Modal 狀態
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, itemId: null, itemName: '' });

  // 歸還 Modal 狀態
  const [returnModal, setReturnModal] = useState({ isOpen: false, loan: null, returnQty: 1, isSubmitting: false });

  // 駁回確認 Modal 狀態
  const [rejectModal, setRejectModal] = useState({ isOpen: false, request: null });

  // 借用表單
  const [borrowForm, setBorrowForm] = useState({
    items: [], userName: '', borrowDate: '', borrowTime: '', expectedReturnDate: '', expectedReturnTime: '', photo: null,
  });

  const [borrowItemSearch, setBorrowItemSearch] = useState('');
  const [isBorrowDropdownOpen, setIsBorrowDropdownOpen] = useState(false);
  const borrowDropdownRef = useRef(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editItemForm, setEditItemForm] = useState(null);

  const showNotification = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (borrowDropdownRef.current && !borrowDropdownRef.current.contains(event.target)) {
        setIsBorrowDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // --- 圖片壓縮與匯入匯出函式保留 ---
  const fileToBase64 = (file) => new Promise((resolve, reject) => { const reader = new FileReader(); reader.readAsDataURL(file); reader.onload = () => resolve(reader.result); reader.onerror = (error) => reject(error); });
  const resizeAndCompressImage = (file, maxDim = 800, quality = 0.7) => new Promise((resolve, reject) => { const reader = new FileReader(); reader.readAsDataURL(file); reader.onload = (event) => { const img = new Image(); img.src = event.target.result; img.onload = () => { const canvas = document.createElement('canvas'); let { width, height } = img; if (width > height && width > maxDim) { height = Math.round((height * maxDim) / width); width = maxDim; } else if (height > maxDim) { width = Math.round((width * maxDim) / height); height = maxDim; } canvas.width = width; canvas.height = height; const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, width, height); resolve(canvas.toDataURL('image/jpeg', quality)); }; img.onerror = (error) => reject(error); }; reader.onerror = (error) => reject(error); });
  const convertToTSV = (data) => { if (!data || !data.length) return ''; const headers = Object.keys(data[0]); const headerRow = headers.join('\t'); const rows = data.map((row) => headers.map((fieldName) => { let val = row[fieldName]; if (val === null || val === undefined) val = ''; if (fieldName === 'imageUrl' && val.length > 100) return '[IMAGE]'; return String(val).replace(/\t/g, ' ').replace(/\n/g, ' '); }).join('\t') ); return [headerRow, ...rows].join('\n'); };
  const exportToTxt = (data, fileName) => { try { if (data.length === 0) { showNotification('沒有資料可以匯出', 'error'); return; } const textContent = convertToTSV(data); const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.setAttribute('href', url); link.setAttribute('download', `${fileName}_${new Date().toISOString().slice(0, 10)}.txt`); document.body.appendChild(link); link.click(); document.body.removeChild(link); showNotification('匯出成功！'); } catch (error) { console.error('Export error:', error); showNotification('匯出失敗', 'error'); } };
  const handleExportAllSystemData = () => { try { const fullBackup = { meta: { version: '1.0', exportedAt: new Date().toISOString(), exportedBy: user?.uid || 'anonymous' }, data: { inventory, activeLoans, pendingRequests, logs } }; const jsonString = JSON.stringify(fullBackup, null, 2); const blob = new Blob([jsonString], { type: 'application/json' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.setAttribute('href', url); link.setAttribute('download', `warehouse_backup_${new Date().toISOString().slice(0, 10)}.json`); document.body.appendChild(link); link.click(); document.body.removeChild(link); showNotification('完整備份匯出成功'); } catch (error) { showNotification('匯出失敗', 'error'); } };
  const handleExportInventory = () => exportToTxt(inventory.map((item) => ({ 中文名稱: item.nameZh, 英文名稱: item.nameEn, 位置: item.location, 總數量: item.total, 在庫數量: item.inStock })), '器材庫存清單');
  const handleExportActiveLoans = () => exportToTxt(activeLoans.map((item) => ({ 器材名稱: item.nameZh, 借用人: item.borrower, 借出數量: item.quantity, 借出時間: item.borrowTime, 預計歸還: item.expectedReturnTime, 狀態: item.status })), '目前借出清單');
  const handleExportLogs = () => exportToTxt(logs.map((item) => ({ 時間: item.timestamp, 動作: item.action, 器材名稱: item.nameZh, 數量: item.quantity, 操作人: item.borrower, 歸還時間: item.actualReturnTime || '-' })), '借還歷史紀錄');

  // --- 權限切換與正式登入流程 ---
  const handleRoleSwitch = async (targetRole) => {
    if (targetRole === 'admin') {
      if (role === 'admin') return;
      setShowLoginModal(true);
    } else {
      // 登出管理員並重新以匿名身分登入 (一般使用者模式)
      try {
        setLoading(true);
        await signOut(auth);
        await signInAnonymously(auth);
        setRole('user');
        setUserTab('borrow_form'); 
        showNotification('已切換為一般使用者模式');
      } catch (error) {
        showNotification('權限切換發生錯誤', 'error');
        setLoading(false);
      }
    }
  };

  // Google 登入處理函式
  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      const provider = new GoogleAuthProvider();
      // 可選擇性加上 customParameters 強制選擇帳號
      // provider.setCustomParameters({ prompt: 'select_account' });
      
      await signInWithPopup(auth, provider);
      setRole('admin');
      setActiveTab('approval');
      showNotification('管理員登入成功！');
      setShowLoginModal(false);
    } catch (error) {
      console.error(error);
      if (error.code === 'auth/popup-closed-by-user') {
        showNotification('您已取消登入', 'warning');
      } else {
        showNotification('登入失敗，請確認網路或 Firebase 設定！', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = "繩索器材倉庫管理系統";
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (!auth.currentUser) {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error('Auth error:', error);
        showNotification('登入系統失敗，請重新整理', 'error');
      }
    };
    initAuth();

    // 監聽登入狀態改變
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      // 若 currentUser 存在且不是匿名登入 (代表是 Google 登入)，即賦予管理員權限
      if (currentUser && !currentUser.isAnonymous) {
        setRole('admin');
      } else {
        setRole('user');
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    
    // 資安升級：移除了不安全的 settingsRef (密碼不再透過前端讀取)

    const inventoryQuery = collection(db, 'inventory');
    const unsubInventory = onSnapshot(inventoryQuery, (snapshot) => {
      const items = snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
      items.sort((a, b) => a.nameEn?.localeCompare(b.nameEn));
      setInventory(items);
    }, (error) => console.error('Sync error', error));

    const loansQuery = collection(db, 'active_loans');
    const unsubLoans = onSnapshot(loansQuery, (snapshot) => {
      const items = snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
      setActiveLoans(items);
    }, (error) => console.error('Loans Sync error', error));

    const pendingQuery = collection(db, 'pending_requests');
    const unsubPending = onSnapshot(pendingQuery, (snapshot) => {
      const items = snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
       items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setPendingRequests(items);
    }, (error) => console.error('Pending Sync error', error));

    const logsQuery = collection(db, 'logs');
    const unsubLogs = onSnapshot(logsQuery, (snapshot) => {
      const items = snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
      items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setLogs(items);
    }, (error) => console.error('Logs Sync error', error));

    return () => {
      unsubInventory();
      unsubLoans();
      unsubPending();
      unsubLogs();
    };
  }, [user]);

  // --- 使用者提交申請 (防呆與 Sanitization) ---
  const handleBorrowSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;

    if (borrowForm.items.length === 0) {
      showNotification('請從下拉選單中搜尋並加入至少一項器材！', 'error');
      return;
    }

    if (borrowForm.items.some(item => item.borrowQty === '' || item.borrowQty < 1)) {
      showNotification('請確認所有已選器材的「借用數量」皆已正確填寫！', 'error');
      return;
    }
    
    if (!borrowForm.borrowDate || !borrowForm.borrowTime || !borrowForm.expectedReturnDate || !borrowForm.expectedReturnTime) {
      showNotification('請完整填寫「借出日期時間」與「預計歸還日期時間」！', 'error');
      return;
    }

    // 基礎 Sanitization
    const safeUserName = sanitizeString(borrowForm.userName) || '匿名使用者';

    try {
      const timestamp = new Date().toLocaleString();
      
      const promises = borrowForm.items.map(item => {
        const currentItem = inventory.find((i) => i.id === item.id);
        const borrowQty = parseInt(item.borrowQty, 10);
        
        if (currentItem && currentItem.inStock < borrowQty) {
          showNotification(`注意: ${item.nameZh} 目前顯示庫存不足`, 'warning');
        }

        const requestData = {
          itemId: sanitizeString(item.id),
          nameZh: sanitizeString(item.nameZh),
          nameEn: sanitizeString(item.nameEn),
          location: sanitizeString(item.location),
          quantity: borrowQty,
          borrower: safeUserName,
          borrowTime: sanitizeString(`${borrowForm.borrowDate} ${borrowForm.borrowTime}`),
          expectedReturnTime: sanitizeString(`${borrowForm.expectedReturnDate} ${borrowForm.expectedReturnTime}`),
          status: 'pending', 
          photo: borrowForm.photo,
          timestamp: timestamp,
        };

        return addDoc(collection(db, 'pending_requests'), requestData);
      });

      await Promise.all(promises);

      showNotification(`申請已送出！共 ${borrowForm.items.length} 項器材待管理員審核。`, 'success');
      setBorrowForm({ ...borrowForm, items: [], photo: null, userName: '' });
      setBorrowItemSearch('');
    } catch (error) {
      console.error(error);
      showNotification('申請送出失敗，請重試', 'error');
    }
  };

  const handleApproveRequest = async (request) => {
    if (!user) return;

    try {
      const itemRef = doc(db, 'inventory', request.itemId);
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
      batch.update(itemRef, { inStock: Number(currentStock) - Number(requestQty) });

      const { id: oldId, ...loanData } = request;
      const newLoanRef = doc(collection(db, 'active_loans'));
      batch.set(newLoanRef, {
        ...loanData, 
        quantity: requestQty,
        status: 'borrowed',
        approvedAt: new Date().toLocaleString()
      });

      const pendingRef = doc(db, 'pending_requests', request.id);
      batch.delete(pendingRef);

      const logRef = doc(collection(db, 'logs'));
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

  const executeReject = async () => {
    const { request } = rejectModal;
    if (!request) return;

    try {
      const batch = writeBatch(db);
      const pendingRef = doc(db, 'pending_requests', request.id);
      batch.delete(pendingRef);

      const logRef = doc(collection(db, 'logs'));
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

  const openReturnModal = (loan) => {
    setReturnModal({ isOpen: true, loan: loan, returnQty: parseInt(loan.quantity || 1, 10), isSubmitting: false });
  };

  const executeReturn = async () => {
    const { loan, returnQty, isSubmitting } = returnModal;
    if (!user || !loan || isSubmitting) return;

    const qtyToReturn = parseInt(returnQty, 10);
    const totalBorrowedQty = parseInt(loan.quantity, 10);

    if (isNaN(qtyToReturn) || qtyToReturn <= 0) return showNotification('請輸入有效的歸還數量 (至少為 1)', 'error');
    if (qtyToReturn > totalBorrowedQty) return showNotification(`歸還數量不可超過借出數量 (${totalBorrowedQty})`, 'error');

    setReturnModal(prev => ({ ...prev, isSubmitting: true }));

    try {
      const loanRef = doc(db, 'active_loans', loan.id);
      const loanSnap = await getDoc(loanRef);

      if (!loanSnap.exists()) {
        showNotification('操作失敗：該借出單據已不存在 (可能已被其他人刪除)', 'error');
        setReturnModal({ isOpen: false, loan: null, returnQty: 1, isSubmitting: false });
        return;
      }

      const returnTime = new Date().toLocaleString();
      const currentItem = inventory.find((i) => i.id === loan.itemId);
      const batch = writeBatch(db);

      if (currentItem) {
        const itemRef = doc(db, 'inventory', loan.itemId);
        const currentStock = parseInt(currentItem.inStock || 0, 10);
        batch.update(itemRef, { inStock: Number(currentStock) + Number(qtyToReturn) });
      } else {
        showNotification('注意：原器材已被刪除，僅執行紀錄更新', 'warning');
      }
      
      const isFullReturn = qtyToReturn >= totalBorrowedQty;

      if (isFullReturn) {
        batch.delete(loanRef);
      } else {
        const remainingQty = Number(totalBorrowedQty) - Number(qtyToReturn);
        batch.update(loanRef, { quantity: remainingQty });
      }
      
      const logRef = doc(collection(db, 'logs'));
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
      showNotification('圖片已選取 (僅供本次預覽)', 'warning');
    }
  };

  const handleInventoryImageChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        let base64;
        if (file.size > 500 * 1024) {
          showNotification('圖片較大，自動壓縮中...', 'warning');
          base64 = await resizeAndCompressImage(file, 800, 0.7);
        } else {
          base64 = await fileToBase64(file);
        }
        setEditItemForm({ ...editItemForm, imageUrl: base64 });
      } catch (err) {
        showNotification('圖片處理失敗', 'error');
      }
    }
  };

  const startEditItem = (item) => { setEditItemForm({ ...item, imageUrl: item.imageUrl || '' }); setIsEditing(true); };
  const startAddNewItem = () => { setEditItemForm({ id: null, nameZh: '', nameEn: '', location: '', total: 1, inStock: 1, imageUrl: '' }); setIsEditing(true); };

  const handleSaveItem = async (e) => {
    e.preventDefault();
    if (!user || !editItemForm.nameZh || !editItemForm.total) return;
    try {
      const saveData = {
        nameZh: sanitizeString(editItemForm.nameZh),
        nameEn: sanitizeString(editItemForm.nameEn),
        location: sanitizeString(editItemForm.location),
        total: parseInt(editItemForm.total, 10),
        imageUrl: editItemForm.imageUrl || '' 
      };

      if (editItemForm.id) {
        const oldItem = inventory.find((i) => i.id === editItemForm.id);
        const diff = parseInt(editItemForm.total, 10) - oldItem.total;
        const newInStock = oldItem.inStock + diff;
        if (newInStock < 0) return showNotification('總數量不能小於目前已借出數量！', 'error');
        
        const itemRef = doc(db, 'inventory', editItemForm.id);
        await updateDoc(itemRef, { ...saveData, inStock: newInStock });
        showNotification('器材資訊已更新');
      } else {
        await addDoc(collection(db, 'inventory'), { ...saveData, inStock: parseInt(editItemForm.total, 10) });
        showNotification('新器材已新增');
      }
      setIsEditing(false);
      setEditItemForm(null);
    } catch (error) {
      showNotification('儲存失敗', 'error');
    }
  };

  const handleDeleteItem = (id) => {
    if (!user) return showNotification('系統尚未連線或未登入', 'error');
    const item = inventory.find((i) => i.id === id);
    if (!item) return;
    if (Number(item.total || 0) !== Number(item.inStock || 0)) return showNotification('此器材尚有外借中，無法刪除！', 'error');
    setDeleteModal({ isOpen: true, itemId: id, itemName: item.nameZh });
  };

  const executeDelete = async () => {
    if (!deleteModal.itemId) return;
    try {
      await deleteDoc(doc(db, 'inventory', deleteModal.itemId));
      showNotification('器材已刪除');
      setDeleteModal({ isOpen: false, itemId: null, itemName: '' });
    } catch (e) {
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
            {pendingRequests.length > 0 && <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">{pendingRequests.length}</span>}
          </h3>
          <p className="text-sm text-slate-500">核准後才會扣除庫存並計入借出</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-amber-50 text-amber-900 font-medium border-b border-amber-100">
              <tr><th className="p-3">申請時間</th><th className="p-3">器材名稱</th><th className="p-3">數量</th><th className="p-3">申請人</th><th className="p-3">預計借出</th><th className="p-3">預計歸還</th><th className="p-3">審核操作</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pendingRequests.length === 0 ? (
                <tr><td colSpan="7" className="p-8 text-center text-slate-400">目前沒有待審核的申請</td></tr>
              ) : (
                pendingRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50">
                    <td className="p-3 text-slate-500 text-xs">{req.timestamp}</td>
                    <td className="p-3">
                      <div className="font-medium text-slate-800">{req.nameZh}</div>
                      <div className="text-xs text-slate-500">{req.nameEn}</div>
                      <div className="text-xs text-slate-400 mt-1">庫存: {inventory.find(i=>i.id===req.itemId)?.inStock ?? '未知'}</div>
                    </td>
                    <td className="p-3 font-bold text-blue-600">x {req.quantity}</td>
                    <td className="p-3">{req.borrower}</td>
                    <td className="p-3 text-slate-600">{req.borrowTime}</td>
                    <td className="p-3 text-slate-600">{req.expectedReturnTime}</td>
                    <td className="p-3">
                      <div className="flex gap-2">
                        <button onClick={() => handleApproveRequest(req)} className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-xs transition-colors shadow-sm"><CheckSquare size={14} /> 核准</button>
                        <button onClick={() => setRejectModal({ isOpen: true, request: req })} className="flex items-center gap-1 bg-red-100 hover:bg-red-200 text-red-700 border border-red-200 px-3 py-1.5 rounded text-xs transition-colors"><XCircle size={14} /> 駁回</button>
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

  const InventoryOverview = ({ readOnly = false }) => {
    const filteredLoans = activeLoans.filter(loan => {
      if (!loanSearch.trim()) return true;
      const term = loanSearch.toLowerCase();
      return (loan.nameZh || '').toLowerCase().includes(term) || (loan.nameEn || '').toLowerCase().includes(term) || (loan.borrower || '').toLowerCase().includes(term);
    });
    return (
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Clock className="w-5 h-5 text-blue-600" /> 目前借出狀況 (追蹤清單) {readOnly && <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">僅供檢視</span>}</h3>
            {!readOnly && <button onClick={handleExportActiveLoans} className="flex items-center gap-2 text-sm text-green-700 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded border border-green-200 transition-colors"><FileText size={16} /> 匯出 TXT</button>}
          </div>
          <div className="mb-4 relative">
            <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input type="text" placeholder="搜尋借用人、器材名稱..." className="w-full pl-10 pr-10 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-shadow text-sm" value={loanSearch} onChange={(e) => setLoanSearch(e.target.value)} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-600 font-medium border-b">
                <tr><th className="p-3">器材名稱</th><th className="p-3">借出數量</th><th className="p-3">借用人</th><th className="p-3">借出時間</th><th className="p-3">預計歸還</th><th className="p-3">狀態</th>{!readOnly && <th className="p-3">操作</th>}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLoans.length === 0 ? (
                  <tr><td colSpan={readOnly ? 6 : 7} className="p-8 text-center text-slate-400">目前沒有借出的器材</td></tr>
                ) : (
                  filteredLoans.map((loan) => (
                    <tr key={loan.id} className="hover:bg-slate-50">
                      <td className="p-3"><div className="font-medium text-slate-800">{loan.nameZh}</div><div className="text-xs text-slate-500">{loan.nameEn}</div></td>
                      <td className="p-3 font-bold text-blue-600">x {loan.quantity}</td>
                      <td className="p-3"><span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs">{loan.borrower}</span></td>
                      <td className="p-3 text-slate-600">{loan.borrowTime}</td>
                      <td className="p-3 text-amber-600 font-medium">{loan.expectedReturnTime}</td>
                      <td className="p-3"><span className="text-red-500 flex items-center gap-1 text-xs">借出中</span></td>
                      {!readOnly && (
                        <td className="p-3"><button onClick={() => openReturnModal(loan)} className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs transition-colors shadow-sm flex items-center gap-1"><ArrowRightLeft size={12} /> 歸還入庫</button></td>
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
  };

  const InventoryManager = ({ readOnly = false }) => {
    const itemLoans = viewDetailItem ? activeLoans.filter(loan => loan.itemId === viewDetailItem.id) : [];
    const filteredInventory = inventory.filter(item => {
      if (!inventorySearch.trim()) return true;
      const term = inventorySearch.toLowerCase();
      return (item.nameZh || '').toLowerCase().includes(term) || (item.nameEn || '').toLowerCase().includes(term) || (item.location || '').toLowerCase().includes(term);
    });

    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 relative">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><LayoutDashboard className="w-5 h-5 text-purple-600" /> 庫存管理與統計 {readOnly && <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">僅供檢視</span>}</h3>
          {!readOnly && (
            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              <button onClick={handleExportAllSystemData} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors shadow-sm"><Archive size={16} /> 備份資料</button>
              <button onClick={handleExportInventory} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors shadow-sm"><FileText size={16} /> 匯出清單</button>
              <button onClick={startAddNewItem} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors shadow-sm"><PlusCircle size={16} /> 新增器材</button>
            </div>
          )}
        </div>
        <div className="mb-4 relative">
          <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input type="text" placeholder="搜尋器材..." className="w-full pl-10 pr-10 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" value={inventorySearch} onChange={(e) => setInventorySearch(e.target.value)} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 font-medium border-b">
              <tr><th className="p-3 text-center w-20">照片</th><th className="p-3">器材品項</th><th className="p-3">存放位置</th><th className="p-3 text-center">總數量</th><th className="p-3 text-center">在庫</th><th className="p-3 text-center">借出</th><th className="p-3 text-center">狀態</th>{!readOnly && <th className="p-3 text-right">管理</th>}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInventory.length === 0 ? (
                <tr><td colSpan={readOnly ? 7 : 8} className="p-8 text-center text-slate-400">目前資料庫為空</td></tr>
              ) : (
                filteredInventory.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 group cursor-pointer transition-colors" onClick={() => setViewDetailItem(item)}>
                    <td className="p-3 text-center">{item.imageUrl ? <img src={item.imageUrl} alt={item.nameZh} className="w-12 h-12 object-cover rounded-md border mx-auto" /> : <div className="w-12 h-12 bg-slate-100 rounded-md border mx-auto flex items-center justify-center"><ImageIcon className="text-slate-300 w-6 h-6" /></div>}</td>
                    <td className="p-3"><div className="font-medium text-slate-800">{item.nameZh}</div><div className="text-xs text-slate-500">{item.nameEn}</div></td>
                    <td className="p-3 text-slate-600">{item.location}</td>
                    <td className="p-3 text-center font-bold">{item.total}</td>
                    <td className="p-3 text-center text-green-600">{item.inStock}</td>
                    <td className="p-3 text-center text-red-500">{item.total - item.inStock}</td>
                    <td className="p-3 text-center align-middle"><div className="w-24 inline-block bg-slate-200 rounded-full h-2 overflow-hidden align-middle"><div className={`h-2 rounded-full ${item.inStock === 0 ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${item.total > 0 ? (item.inStock / item.total) * 100 : 0}%` }}></div></div></td>
                    {!readOnly && (
                      <td className="p-3 text-right">
                        <div className="flex justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <button onClick={(e) => { e.stopPropagation(); startEditItem(item); }} className="text-slate-400 hover:text-blue-600 p-1"><Edit size={16} /></button>
                          <button onClick={(e) => { e.stopPropagation(); handleDeleteItem(item.id); }} className="text-slate-400 hover:text-red-600 p-1"><Trash2 size={16} /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Detail Modal */}
        {viewDetailItem && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setViewDetailItem(null)}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-fade-in flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
              <div className="bg-purple-600 p-4 text-white flex justify-between items-center shrink-0">
                <h3 className="font-bold text-lg flex items-center gap-2"><Info size={20} /> 借出明細：{viewDetailItem.nameZh}</h3>
                <button onClick={() => setViewDetailItem(null)} className="text-purple-200 hover:text-white transition-colors"><X size={20} /></button>
              </div>
              <div className="p-6 overflow-y-auto">
                <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2"><Clock size={16} className="text-purple-600" /> 目前借用人列表</h4>
                {itemLoans.length === 0 ? (
                  <div className="text-center py-8 bg-slate-50 rounded-lg text-slate-400">目前沒有人借用此器材</div>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 rounded-lg">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 text-slate-600 border-b"><tr><th className="p-3">借用人</th><th className="p-3">數量</th><th className="p-3">預計歸還</th></tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {itemLoans.map((loan) => (
                          <tr key={loan.id} className="hover:bg-slate-50"><td className="p-3 font-medium text-slate-800">{loan.borrower}</td><td className="p-3 font-bold text-purple-600">x {loan.quantity}</td><td className="p-3 text-amber-600">{loan.expectedReturnTime}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div className="p-4 border-t border-slate-100 bg-slate-50 text-right shrink-0">
                <button onClick={() => setViewDetailItem(null)} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-medium">關閉</button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {isEditing && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in max-h-[90vh] overflow-y-auto">
              <div className="bg-slate-50 p-4 border-b flex justify-between items-center"><h3 className="font-bold text-lg">{editItemForm.id ? '編輯器材' : '新增器材'}</h3><button onClick={() => setIsEditing(false)}><X size={20}/></button></div>
              <form onSubmit={handleSaveItem} className="p-6 space-y-4">
                 <div><label className="block text-sm font-medium mb-1">器材中文名稱</label><input type="text" required className="w-full p-2 border rounded" value={editItemForm.nameZh} onChange={(e) => setEditItemForm({ ...editItemForm, nameZh: e.target.value })} /></div>
                 <div><label className="block text-sm font-medium mb-1">存放位置</label><input type="text" required className="w-full p-2 border rounded" value={editItemForm.location} onChange={(e) => setEditItemForm({ ...editItemForm, location: e.target.value })} /></div>
                 <div><label className="block text-sm font-medium mb-1">總數量</label><input type="number" min="1" required className="w-full p-2 border rounded" value={editItemForm.total} onChange={(e) => setEditItemForm({ ...editItemForm, total: e.target.value })} /></div>
                 <div className="pt-2 flex gap-3"><button type="button" onClick={() => setIsEditing(false)} className="flex-1 py-2 border rounded">取消</button><button type="submit" className="flex-1 py-2 bg-blue-600 text-white rounded">儲存</button></div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  };

  const TransactionLogs = ({ readOnly = false }) => (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><History className="w-5 h-5 text-slate-600" /> 借還歷史紀錄 {readOnly && <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">僅供檢視</span>}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-600 font-medium border-b"><tr><th className="p-3">日期時間</th><th className="p-3">動作</th><th className="p-3">器材名稱</th><th className="p-3">數量</th><th className="p-3">操作人</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {logs.map((log, idx) => (
              <tr key={idx} className="hover:bg-slate-50">
                <td className="p-3 text-slate-500">{log.timestamp}</td>
                <td className="p-3"><span className={`px-2 py-1 rounded text-xs ${log.action.includes('借出')?'bg-amber-100 text-amber-700':log.action.includes('駁回')?'bg-red-100 text-red-700':'bg-green-100 text-green-700'}`}>{log.action}</span></td>
                <td className="p-3 text-slate-800">{log.nameZh}</td>
                <td className="p-3 font-bold">{log.quantity}</td>
                <td className="p-3 text-slate-600">{log.borrower}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const SystemSettings = () => (
    <div className="max-w-xl mx-auto bg-white p-8 rounded-lg shadow-md border border-slate-200">
      <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2"><Settings className="w-6 h-6 text-slate-600" /> 系統安全設定</h3>
      <div className="bg-blue-50 p-6 rounded-lg border border-blue-200 text-blue-800">
        <h4 className="font-semibold mb-2 flex items-center gap-2"><ShieldCheck size={18} /> 帳號安全機制已升級 (Google 驗證)</h4>
        <p className="text-sm leading-relaxed">
          為了確保救援器材系統的安全，前端密碼與信箱登入功能已徹底廢除。<br /><br />
          若需要新增其他管理員授權，請至 <b>Firebase Console -{'>'} Authentication</b> 進行 Google 帳號的管理。
        </p>
      </div>
    </div>
  );

  const UserBorrowInterface = () => {
    const availableItems = inventory.filter((i) => i.inStock > 0 && (i.nameZh?.toLowerCase().includes(borrowItemSearch.toLowerCase()) || i.location?.toLowerCase().includes(borrowItemSearch.toLowerCase())));
    return (
      <div className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow-md border border-slate-200">
        <h3 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><PlusCircle className="w-6 h-6 text-blue-600" /> 器材借用申請</h3>
        <form onSubmit={handleBorrowSubmit} className="space-y-6">
          <div className="grid grid-cols-1 gap-4">
            <div className="relative" ref={borrowDropdownRef}>
              <label className="block text-sm font-medium text-slate-700 mb-2">搜尋與加入器材</label>
              <div className="relative">
                <input type="text" placeholder="點此搜尋欲借用的器材..." className="w-full p-3 pl-4 pr-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={borrowItemSearch} onChange={(e) => { setBorrowItemSearch(e.target.value); setIsBorrowDropdownOpen(true); }} onFocus={() => setIsBorrowDropdownOpen(true)} />
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              </div>
              {isBorrowDropdownOpen && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                  {availableItems.length > 0 ? (
                    availableItems.map((item) => (
                      <div key={item.id} className="p-3 cursor-pointer border-b border-slate-100 flex justify-between items-center hover:bg-blue-50" onClick={() => { if (!borrowForm.items.some(i => i.id === item.id)) { setBorrowForm({ ...borrowForm, items: [...borrowForm.items, { ...item, borrowQty: '' }] }); setBorrowItemSearch(''); } setIsBorrowDropdownOpen(false); }}>
                        <div><div className="font-medium">{item.nameZh}</div><div className="text-xs text-slate-500">位置: {item.location}</div></div>
                        <div className="text-sm font-bold text-green-600">庫存 {item.inStock}</div>
                      </div>
                    ))
                  ) : (<div className="p-4 text-center text-slate-500 text-sm">找不到符合的庫存器材</div>)}
                </div>
              )}
            </div>
            {borrowForm.items.length > 0 && (
              <div className="mt-2 mb-4 bg-slate-50 border border-slate-200 rounded-lg p-4">
                <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2"><CheckSquare size={18} className="text-blue-600" /> 已選擇的器材 ({borrowForm.items.length} 項)</h4>
                <div className="space-y-3">
                  {borrowForm.items.map((selected, index) => (
                    <div key={selected.id} className="flex flex-col sm:flex-row justify-between bg-white p-3 rounded-lg border shadow-sm gap-3">
                      <div className="flex-1"><div className="font-bold">{selected.nameZh}</div><div className="text-xs text-slate-500">庫存: {selected.inStock}</div></div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <label className="text-sm">數量:</label>
                          <input type="number" min="1" max={selected.inStock} required className="w-16 p-1.5 border rounded text-center font-bold" value={selected.borrowQty} onChange={(e) => { const newItems = [...borrowForm.items]; const val = e.target.value; if (val === '') { newItems[index].borrowQty = ''; } else { let num = parseInt(val, 10); if (isNaN(num) || num < 1) num = 1; if (num > selected.inStock) num = selected.inStock; newItems[index].borrowQty = num; } setBorrowForm({ ...borrowForm, items: newItems }); }} />
                          <span className="text-xs text-slate-400">/ {selected.inStock}</span>
                        </div>
                        <button type="button" onClick={() => setBorrowForm({ ...borrowForm, items: borrowForm.items.filter(i => i.id !== selected.id) })} className="text-red-400 hover:text-red-600 p-1.5"><Trash2 size={18} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div><label className="block text-sm font-medium text-slate-700 mb-2">借用人姓名</label><input type="text" required placeholder="請輸入姓名" className="w-full p-3 border rounded-lg" value={borrowForm.userName} onChange={(e) => setBorrowForm({ ...borrowForm, userName: e.target.value })} /></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="block text-sm mb-2">借出日期</label><input type="date" required className="w-full p-3 border rounded-lg" value={borrowForm.borrowDate} onChange={(e) => setBorrowForm({ ...borrowForm, borrowDate: e.target.value })} /></div>
            <div className="relative"><label className="block text-sm mb-2">借出時間</label><div onClick={() => openTimePicker('borrowTime')} className="w-full p-3 border rounded-lg bg-white flex justify-between cursor-pointer"><span>{borrowForm.borrowTime || <span className="text-slate-400">請選擇時間</span>}</span><Clock size={16} /></div></div>
            <div><label className="block text-sm mb-2">預計歸還日期</label><input type="date" required className="w-full p-3 border rounded-lg" value={borrowForm.expectedReturnDate} onChange={(e) => setBorrowForm({ ...borrowForm, expectedReturnDate: e.target.value })} /></div>
            <div className="relative"><label className="block text-sm mb-2">預計歸還時間</label><div onClick={() => openTimePicker('expectedReturnTime')} className="w-full p-3 border rounded-lg bg-white flex justify-between cursor-pointer"><span>{borrowForm.expectedReturnTime || <span className="text-slate-400">請選擇時間</span>}</span><Clock size={16} /></div></div>
          </div>
          <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg shadow-lg">送出申請 (待審核)</button>
        </form>
      </div>
    );
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-100 text-slate-500"><Loader2 className="animate-spin w-8 h-8 text-blue-600 mb-2" /><p>系統連線驗證中...</p></div>;
  }

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-900">
      <nav className="bg-slate-800 text-white p-4 sticky top-0 z-50 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <Package className="w-8 h-8 text-blue-400" />
            <div className="flex flex-col">
              <h1 className="text-xl font-bold tracking-wide">繩索器材倉庫管理系統</h1>
              <span className="text-xs text-green-400 font-light flex items-center gap-1"><ShieldCheck size={10} /> 官方驗證安全連線中</span>
            </div>
          </div>
          <div className="flex items-center gap-4 bg-slate-700 p-1 rounded-lg">
            <button onClick={() => handleRoleSwitch('admin')} className={`px-4 py-2 rounded-md text-sm transition-all flex items-center gap-2 ${role === 'admin' ? 'bg-blue-600 shadow-sm' : 'hover:bg-slate-600 text-slate-300'}`}>
              <User size={16} /> 管理者 {role !== 'admin' && <Lock size={12} className="text-slate-400" />}
            </button>
            <button onClick={() => handleRoleSwitch('user')} className={`px-4 py-2 rounded-md text-sm transition-all flex items-center gap-2 ${role === 'user' ? 'bg-green-600 shadow-sm' : 'hover:bg-slate-600 text-slate-300'}`}>
              <User size={16} /> 使用者
            </button>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto p-4 md:p-6">
        {notification && (
          <div className={`fixed top-20 right-4 p-4 rounded-lg shadow-lg text-white animate-bounce z-50 ${notification.type === 'error' ? 'bg-red-500' : notification.type === 'warning' ? 'bg-amber-500' : 'bg-green-600'}`}>
            <div className="flex items-center gap-2">{notification.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />} {notification.msg}</div>
          </div>
        )}
        
        {role === 'admin' && (
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
            <button onClick={() => setActiveTab('approval')} className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors flex items-center gap-2 ${activeTab === 'approval' ? 'bg-white text-amber-600 shadow-sm ring-1 ring-amber-100' : 'text-slate-600 hover:bg-white/50'}`}><ClipboardList size={18} /> 審核申請 {pendingRequests.length > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{pendingRequests.length}</span>}</button>
            <button onClick={() => setActiveTab('dashboard')} className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors flex items-center gap-2 ${activeTab === 'dashboard' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-blue-100' : 'text-slate-600 hover:bg-white/50'}`}><Clock size={18} /> 借出狀況</button>
            <button onClick={() => setActiveTab('inventory')} className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors flex items-center gap-2 ${activeTab === 'inventory' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-blue-100' : 'text-slate-600 hover:bg-white/50'}`}><LayoutDashboard size={18} /> 庫存管理</button>
            <button onClick={() => setActiveTab('history')} className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors flex items-center gap-2 ${activeTab === 'history' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-blue-100' : 'text-slate-600 hover:bg-white/50'}`}><History size={18} /> 歷史紀錄</button>
            <button onClick={() => setActiveTab('settings')} className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors flex items-center gap-2 ${activeTab === 'settings' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-blue-100' : 'text-slate-600 hover:bg-white/50'}`}><Settings size={18} /> 系統設定</button>
          </div>
        )}

        {role === 'user' && (
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
             <button onClick={() => setUserTab('borrow_form')} className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors flex items-center gap-2 ${userTab === 'borrow_form' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-blue-100' : 'text-slate-600 hover:bg-white/50'}`}><PlusCircle size={18} /> 我要借用</button>
            <button onClick={() => setUserTab('view_dashboard')} className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors flex items-center gap-2 ${userTab === 'view_dashboard' ? 'bg-white text-purple-600 shadow-sm ring-1 ring-purple-100' : 'text-slate-600 hover:bg-white/50'}`}><Clock size={18} /> 借出狀況(唯讀)</button>
            <button onClick={() => setUserTab('view_inventory')} className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors flex items-center gap-2 ${userTab === 'view_inventory' ? 'bg-white text-purple-600 shadow-sm ring-1 ring-purple-100' : 'text-slate-600 hover:bg-white/50'}`}><LayoutDashboard size={18} /> 庫存列表(唯讀)</button>
          </div>
        )}

        <div className="animate-fade-in">
          {activeTab === 'approval' && role === 'admin' && <ApprovalQueue />}
          {activeTab === 'dashboard' && role === 'admin' && <InventoryOverview readOnly={false} />}
          {activeTab === 'inventory' && role === 'admin' && <InventoryManager readOnly={false} />}
          {activeTab === 'history' && role === 'admin' && <TransactionLogs readOnly={false} />}
          {activeTab === 'settings' && role === 'admin' && <SystemSettings />}
          {role === 'user' && userTab === 'borrow_form' && <UserBorrowInterface />}
          {role === 'user' && userTab === 'view_dashboard' && <InventoryOverview readOnly={true} />}
          {role === 'user' && userTab === 'view_inventory' && <InventoryManager readOnly={true} />}
        </div>
      </main>
      
      {/* 登入 Modal (改為純 Google 登入按鈕) */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-fade-in">
            <div className="bg-slate-800 p-4 text-white flex justify-between items-center"><h3 className="font-bold text-lg flex items-center gap-2"><Lock size={18} /> 管理員安全登入</h3><button onClick={() => setShowLoginModal(false)} className="text-slate-300 hover:text-white transition-colors"><X size={20} /></button></div>
            <div className="p-6">
              <p className="text-sm text-slate-600 mb-6 text-center">為了提升系統安全性，請使用已授權的管理員 Google 帳號進行登入。</p>
              
              <button 
                onClick={handleGoogleLogin} 
                disabled={loading} 
                className="w-full py-3 px-4 border border-slate-200 bg-white text-slate-700 rounded-lg hover:bg-slate-50 font-medium shadow-sm transition-colors flex justify-center items-center gap-3 mb-4 disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 size={20} className="animate-spin text-blue-600" />
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
                      <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
                        <path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z"/>
                        <path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z"/>
                        <path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z"/>
                        <path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z"/>
                      </g>
                    </svg>
                    使用 Google 帳號登入
                  </>
                )}
              </button>
              <button type="button" onClick={() => setShowLoginModal(false)} className="w-full py-2 border rounded-lg text-slate-600 hover:bg-slate-50 font-medium transition-colors">
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 時間與確認 Modals 保持不變 */}
      {timePicker.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-fade-in">
            <div className="bg-blue-600 p-4 text-white flex justify-between items-center"><h3 className="font-bold text-lg flex items-center gap-2"><Clock size={18} /> 選擇時間</h3><button onClick={() => setTimePicker({ ...timePicker, isOpen: false })}><X size={20} /></button></div>
            <div className="p-6">
              <div className="flex gap-4 justify-center items-center mb-6">
                <div className="flex flex-col items-center"><span className="text-xs text-slate-500 font-bold mb-1">時段</span><select className="p-3 text-lg border rounded-lg bg-slate-50 font-bold" value={timePicker.tempPeriod} onChange={(e) => setTimePicker({ ...timePicker, tempPeriod: e.target.value })}><option value="AM">上午 (AM)</option><option value="PM">下午 (PM)</option></select></div>
                <div className="flex flex-col items-center"><span className="text-xs text-slate-500 font-bold mb-1">時</span><select className="p-3 text-lg border rounded-lg bg-slate-50 font-bold" value={timePicker.tempHour} onChange={(e) => setTimePicker({ ...timePicker, tempHour: e.target.value })}>{Array.from({ length: 12 }, (_, i) => { const val = (i + 1).toString().padStart(2, '0'); return <option key={val} value={val}>{val}</option>; })}</select></div>
                <span className="text-2xl font-bold text-slate-300 mt-4">:</span>
                <div className="flex flex-col items-center"><span className="text-xs text-slate-500 font-bold mb-1">分</span><select className="p-3 text-lg border rounded-lg bg-slate-50 font-bold" value={timePicker.tempMinute} onChange={(e) => setTimePicker({ ...timePicker, tempMinute: e.target.value })}>{Array.from({ length: 60 }, (_, i) => { const val = i.toString().padStart(2, '0'); return <option key={val} value={val}>{val}</option>; })}</select></div>
              </div>
              <div className="flex gap-3"><button onClick={() => setTimePicker({ ...timePicker, isOpen: false })} className="flex-1 py-3 border rounded-lg">取消</button><button onClick={confirmTimePicker} className="flex-1 py-3 bg-blue-600 text-white rounded-lg">確認時間</button></div>
            </div>
          </div>
        </div>
      )}
      {rejectModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden border-t-4 border-red-500 p-6 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4"><XCircle className="w-8 h-8 text-red-600" /></div>
            <h3 className="text-xl font-bold mb-2">確定要駁回嗎？</h3>
            <p className="text-slate-500 mb-6">將駁回 <span className="font-bold text-slate-800">{rejectModal.request?.borrower}</span> 的申請。<br />此動作<span className="text-red-600 font-bold">無法復原</span>。</p>
            <div className="flex gap-3"><button onClick={() => setRejectModal({ isOpen: false, request: null })} className="flex-1 py-3 border rounded-lg">取消</button><button onClick={executeReject} className="flex-1 py-3 bg-red-600 text-white rounded-lg">確認駁回</button></div>
          </div>
        </div>
      )}
      {returnModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-green-600 p-4 text-white flex justify-between"><h3 className="font-bold flex items-center gap-2"><ArrowRightLeft size={18}/>歸還入庫</h3><button onClick={() => setReturnModal({ isOpen: false, loan: null, returnQty: 1, isSubmitting: false })}><X size={20}/></button></div>
            <div className="p-6">
              <div className="mb-4"><label className="block text-sm mb-2">器材名稱</label><div className="text-lg font-bold">{returnModal.loan?.nameZh}</div></div>
              <div className="mb-6"><label className="block text-sm mb-2">歸還數量</label><div className="flex items-center gap-2"><input type="number" min="1" disabled={returnModal.isSubmitting} value={returnModal.returnQty} className="w-full p-3 border rounded-lg text-xl font-bold text-center" onChange={(e) => { const val = e.target.value; if(val==='') {setReturnModal({...returnModal, returnQty: ''}); return;} let numVal = parseInt(val, 10); const maxQty = parseInt(returnModal.loan?.quantity || 1, 10); if(isNaN(numVal)) numVal=1; if(numVal>maxQty) numVal=maxQty; if(numVal<1) numVal=1; setReturnModal({...returnModal, returnQty: numVal}); }} /><span className="text-slate-400 font-medium">/ {returnModal.loan?.quantity}</span></div></div>
              <div className="flex gap-3"><button onClick={() => setReturnModal({ isOpen: false, loan: null, returnQty: 1, isSubmitting: false })} disabled={returnModal.isSubmitting} className="flex-1 py-3 border rounded-lg disabled:opacity-50">取消</button><button onClick={executeReturn} disabled={returnModal.isSubmitting} className="flex-1 py-3 bg-green-600 text-white rounded-lg flex items-center justify-center gap-2 disabled:opacity-70">{returnModal.isSubmitting ? <Loader2 className="animate-spin" size={20} /> : '確認歸還'}</button></div>
            </div>
          </div>
        </div>
      )}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden border-t-4 border-red-500 p-6 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4"><AlertTriangle className="w-8 h-8 text-red-600" /></div>
            <h3 className="text-xl font-bold mb-2">確定要刪除嗎？</h3>
            <p className="text-slate-500 mb-6">即將刪除 <span className="font-bold text-slate-800">{deleteModal.itemName}</span>。<br />此動作<span className="text-red-600 font-bold">無法復原</span>。</p>
            <div className="flex gap-3"><button onClick={() => setDeleteModal({ isOpen: false, itemId: null, itemName: '' })} className="flex-1 py-3 border rounded-lg">取消</button><button onClick={executeDelete} className="flex-1 py-3 bg-red-600 text-white rounded-lg">確認刪除</button></div>
          </div>
        </div>
      )}
    </div>
  );
}