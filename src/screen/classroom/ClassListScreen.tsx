import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  collection,
  getDocs,
  query,
  orderBy,
  where,
  doc,
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../../firebase';

// Interface cho dữ liệu lớp học
interface ClassData {
  id: string;
  className: string;
  teacherId: string;
  teacherName: string;
  subject: string;
  feePerSession: number;
  description?: string;
  createdAt: any;
  updatedAt: any;
  isActive: boolean;
  totalStudents: number;
}

// Interface cho Toast Message
interface ToastMessage {
  id: string;
  type: 'success' | 'error';
  text: string;
  timestamp: number;
}

interface ClassListProps {
  user: any;
}

const ClassList: React.FC<ClassListProps> = ({ user }) => {
  const navigate = useNavigate();
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string>('');

  // New toast message system
  const [toastMessages, setToastMessages] = useState<ToastMessage[]>([]);

  // Function to add toast message
  const addMessage = (type: 'success' | 'error', text: string) => {
    const newMessage: ToastMessage = {
      id: `${Date.now()}-${Math.random()}`,
      type,
      text,
      timestamp: Date.now()
    };

    setToastMessages(prev => [...prev, newMessage]);

    // Auto remove after 10 seconds
    setTimeout(() => {
      removeMessage(newMessage.id);
    }, 10000);
  };

  // Function to remove toast message
  const removeMessage = (id: string) => {
    setToastMessages(prev => prev.filter(msg => msg.id !== id));
  };

  // Fetch toàn bộ lớp học của user hiện tại
  const fetchClasses = async () => {
    // Kiểm tra user trước khi fetch
    if (!user || !user.uid) {
      console.log('User chưa đăng nhập hoặc không có UID');
      setError('Vui lòng đăng nhập để xem danh sách lớp học');
      setLoading(false);
      return;
    }

    console.log('Fetching classes for user:', user.uid); // Debug log
    setLoading(true);
    setError('');

    try {
      // Query lấy tất cả lớp học có teacherId = user.uid
      const q = query(
        collection(db, 'classes'),
        where('teacherId', '==', user.uid),
        // orderBy('createdAt', 'desc')
      );
      console.log(user.uid);


      const querySnapshot = await getDocs(q);
      const classList: ClassData[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        console.log('Found class:', doc.id, data); // Debug log
        classList.push({
          id: doc.id,
          ...data,
          // Đảm bảo các field mặc định
          totalStudents: data.totalStudents || 0,
          isActive: data.isActive !== false // Mặc định true nếu không có
        } as ClassData);
      });

      console.log(`Loaded ${classList.length} classes for user ${user.uid}`); // Debug log
      setClasses(classList);

      if (classList.length === 0) {
        console.log('No classes found for this user');
      }

    } catch (error: any) {
      console.error('Lỗi khi tải danh sách lớp học:', error);
      setError('Không thể tải danh sách lớp học');
      addMessage('error', 'Không thể tải danh sách lớp học: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Load dữ liệu khi component mount hoặc user thay đổi
  useEffect(() => {
    console.log('User changed:', user); // Debug log
    fetchClasses();
  }, [user]);

  // Debug: Log khi classes thay đổi
  useEffect(() => {
    console.log('Classes updated:', classes);
  }, [classes]);

  // Lọc theo từ khóa tìm kiếm
  const filteredClasses = classes.filter(cls =>
    cls.className.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cls.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (cls.teacherName && cls.teacherName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Toggle trạng thái lớp học
  const toggleClassStatus = async (classId: string, currentStatus: boolean) => {
    try {
      const classRef = doc(db, 'classes', classId);
      await updateDoc(classRef, {
        isActive: !currentStatus,
        updatedAt: new Date()
      });

      addMessage('success', `${!currentStatus ? 'Kích hoạt' : 'Vô hiệu hóa'} lớp học thành công`);

      // Refresh danh sách
      await fetchClasses();
    } catch (error) {
      console.error('Lỗi khi cập nhật trạng thái lớp học:', error);
      addMessage('error', 'Không thể cập nhật trạng thái lớp học');
    }
  };

  // Xóa lớp học
  const deleteClass = async (classId: string, className: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa lớp học "${className}"?\nHành động này không thể hoàn tác.`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'classes', classId));
      addMessage('success', 'Xóa lớp học thành công');

      // Refresh danh sách
      await fetchClasses();
    } catch (error) {
      console.error('Lỗi khi xóa lớp học:', error);
      addMessage('error', 'Không thể xóa lớp học');
    }
  };

  // Format tiền tệ
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount);
  };

  // Format ngày tháng
  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';

    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'N/A';
    }
  };

  // Kiểm tra user đăng nhập
  if (!user) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <p className="text-red-500 text-lg mb-4">Vui lòng đăng nhập để xem danh sách lớp học</p>
          <button
            onClick={() => navigate('/login')}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Đăng nhập
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        <p className="ml-4">Đang tải danh sách lớp học cho {user.displayName || user.email}...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <p className="text-red-500 text-lg mb-4">{error}</p>
          <button
            onClick={fetchClasses}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 mr-2"
          >
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:p-6">
      {/* Toast Notification Container */}
      <div className="fixed top-20 right-4 z-50 space-y-2 max-w-sm">
        {toastMessages.map((message) => (
          <div
            key={message.id}
            className={`transform transition-all duration-300 ease-out p-4 rounded-lg shadow-lg border-l-4 ${message.type === 'success'
                ? 'bg-white border-green-500 text-green-800'
                : 'bg-white border-red-500 text-red-800'
              }`}
            style={{
              animation: 'slideInRight 0.3s ease-out',
              animationFillMode: 'both'
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-lg">
                  {message.type === 'success' ? '✅' : '❌'}
                </span>
                <span className="font-medium text-sm">{message.text}</span>
              </div>
              <button
                onClick={() => removeMessage(message.id)}
                className="ml-4 text-gray-400 hover:text-gray-600 text-lg font-bold leading-none"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add CSS animation keyframes */}
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes slideInRight {
            from {
              transform: translateX(100%);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
        `
      }} />

      <div className="mb-6">
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-end mb-6 gap-4">
          <div className="flex-1">
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
              Lớp Học Của Tôi
            </h1>
            <p className="text-slate-500 mt-1 font-medium">
              Quản lý các lớp học bạn đang giảng dạy
            </p>
          </div>

          {/* Teacher Info - responsive layout */}
          <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded-xl lg:bg-transparent lg:p-0 border border-slate-100 lg:border-none">
            <div className="flex flex-col lg:items-end gap-1">
              <div>
                <span className="font-medium">Giáo viên:</span>
                <span className="block lg:inline ml-0 lg:ml-1">
                  {user.displayName || user.email}
                </span>
              </div>
              <div className="text-xs text-slate-400 font-mono">
                ID: {user.uid.substring(0, 8)}...
              </div>
            </div>
          </div>
        </div>

        {/* Search and Actions Section */}
        <div className="space-y-4">
          {/* Search Input */}
          <div className="relative w-full">
            <input
              type="text"
              placeholder="🔍 Tìm kiếm lớp học, môn học..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm transition-all"
            />
          </div>

          {/* Stats and Actions Row */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            {/* Stats */}
            <div className="flex justify-around sm:justify-start gap-8 text-sm text-slate-600">
              <div className="text-center sm:text-left">
                <span className="font-bold text-indigo-600 text-lg">{filteredClasses.length}</span>
                <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Hiển thị</div>
              </div>
              <div className="text-center sm:text-left">
                <span className="font-bold text-slate-700 text-lg">{classes.length}</span>
                <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Tổng cộng</div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <button
                onClick={() => navigate('/createClass')}
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-md hover:shadow-indigo-200 font-semibold"
              >
                <span>➕</span>
                <span>Tạo lớp mới</span>
              </button>
              <button
                onClick={fetchClasses}
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-white text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all font-semibold shadow-sm"
              >
                <span>🔄</span>
                <span>Làm mới</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Danh sách lớp học */}
      {filteredClasses.length === 0 ? (
        <div className="text-center py-12">
          <div className="mb-4">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5m14 0v-4.5M5 21v-4.5" />
            </svg>
          </div>
          <p className="text-gray-500 text-lg mb-4">
            {searchTerm
              ? `Không tìm thấy lớp học nào phù hợp với "${searchTerm}"`
              : classes.length === 0
                ? 'Bạn chưa tạo lớp học nào'
                : 'Danh sách trống'
            }
          </p>
          {!searchTerm && classes.length === 0 && (
            <button
              onClick={() => navigate('/createClass')}
              className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Tạo lớp học đầu tiên
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredClasses.map((cls) => (
            <div
              key={cls.id}
              className={`group bg-white rounded-2xl shadow-sm border border-slate-100 p-5 hover:shadow-xl hover:shadow-slate-200 transition-all duration-300 relative overflow-hidden ${!cls.isActive ? 'opacity-75' : ''
                }`}
            >
              {/* Active Accent Bar */}
              <div className={`absolute top-0 left-0 right-0 h-1.5 ${cls.isActive ? 'bg-indigo-500' : 'bg-slate-300'}`} />

              {/* Header */}
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-bold text-slate-800 group-hover:text-indigo-600 transition-colors truncate pr-2">
                  {cls.className}
                </h3>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${cls.isActive
                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                    : 'bg-slate-100 text-slate-500 border border-slate-200'
                  }`}>
                  {cls.isActive ? 'Hoạt động' : 'Tạm dừng'}
                </span>
              </div>

              {/* Thông tin lớp học */}
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <span className="text-indigo-400">📚</span>
                  <span>{cls.subject}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <span className="text-indigo-400">👥</span>
                  <span>{cls.totalStudents} học sinh</span>
                </div>
                <div className="text-sm">
                  <span className="text-emerald-600 font-bold text-base">
                    {formatCurrency(cls.feePerSession)}/buổi
                  </span><span className="text-slate-400 text-xs font-medium ml-1">/ buổi</span>
                </div>
                {cls.description && (
                  <p className="text-xs text-slate-400 line-clamp-1 italic mt-1">
                    {cls.description}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-5">
                <span>🕒</span>
                <span>Cập nhật {formatDate(cls.updatedAt || cls.createdAt)}</span>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-3 gap-2 pt-4 border-t border-slate-50">
                <button
                  onClick={() => navigate(`/classList/${cls.id}/students`)}
                  className="flex flex-col items-center justify-center py-2 rounded-xl bg-slate-50 text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition-all border border-transparent hover:border-indigo-100"
                  title="Học sinh"
                >
                  <span className="text-base mb-1">👥</span>
                  <span className="text-[10px] font-bold uppercase">Học sinh</span>
                </button>

                <button
                  onClick={() => toggleClassStatus(cls.id, cls.isActive)}
                  className={`flex flex-col items-center justify-center py-2 rounded-xl transition-all border border-transparent ${cls.isActive
                      ? 'bg-slate-50 text-slate-700 hover:bg-amber-50 hover:text-amber-600 hover:border-amber-100'
                      : 'bg-slate-50 text-slate-700 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-100'
                    }`}
                  title={cls.isActive ? 'Tạm dừng' : 'Kích hoạt'}
                >
                  <span className="text-base mb-1">{cls.isActive ? '⏸️' : '▶️'}</span>
                  <span className="text-[10px] font-bold uppercase">{cls.isActive ? 'Dừng' : 'Mở'}</span>
                </button>

                <button
                  onClick={() => deleteClass(cls.id, cls.className)}
                  className="flex flex-col items-center justify-center py-2 rounded-xl bg-slate-50 text-slate-700 hover:bg-red-50 hover:text-red-600 transition-all border border-transparent hover:border-red-100"
                  title="Xóa"
                >
                  <span className="text-base mb-1">🗑️</span>
                  <span className="text-[10px] font-bold uppercase">Xóa</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ClassList;