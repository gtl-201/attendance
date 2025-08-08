import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
    <div className="max-w-7xl mx-auto p-6">
      {/* Toast Notification Container */}
      <div className="fixed top-20 right-4 z-50 space-y-2 max-w-sm">
        {toastMessages.map((message) => (
          <div
            key={message.id}
            className={`transform transition-all duration-300 ease-out p-4 rounded-lg shadow-lg border-l-4 ${
              message.type === 'success'
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
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">
              Lớp Học Của Tôi
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Quản lý các lớp học bạn đang giảng dạy
            </p>
          </div>
          <div className="text-sm text-gray-600">
            <div><span className="font-medium">Giáo viên:</span> {user.displayName || user.email}</div>
            <div className="text-xs text-gray-500">User ID: {user.uid}</div>
          </div>
        </div>

        {/* Search */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex-1 max-w-md">
            <input
              type="text"
              placeholder="Tìm kiếm lớp học, môn học..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-4 ml-4">
            <div className="text-sm text-gray-600">
              <div>Hiển thị: {filteredClasses.length} lớp</div>
              <div>Tổng: {classes.length} lớp học</div>
            </div>
            <button
              onClick={() => navigate('/createClass')}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              + Tạo lớp mới
            </button>
            <button
              onClick={fetchClasses}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              🔄 Làm mới
            </button>
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
              className={`bg-white rounded-lg shadow-md p-6 border-l-4 hover:shadow-lg transition-shadow ${
                cls.isActive ? 'border-green-500' : 'border-red-500'
              }`}
            >
              {/* Header */}
              <div className="flex justify-between items-start mb-3">
                <h3 className="text-xl font-semibold text-gray-800 truncate">
                  {cls.className}
                </h3>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  cls.isActive 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {cls.isActive ? 'Hoạt động' : 'Tạm dừng'}
                </span>
              </div>

              {/* Thông tin lớp học */}
              <div className="space-y-2 mb-4">
                <p className="text-sm">
                  <span className="font-medium text-gray-600">Môn học:</span>{' '}
                  <span className="text-blue-600">{cls.subject}</span>
                </p>
                <p className="text-sm">
                  <span className="font-medium text-gray-600">Học phí:</span>{' '}
                  <span className="text-green-600 font-medium">
                    {formatCurrency(cls.feePerSession)}/buổi
                  </span>
                </p>
                <p className="text-sm">
                  <span className="font-medium text-gray-600">Học sinh:</span>{' '}
                  <span className="font-medium">{cls.totalStudents}</span> người
                </p>
                <p className="text-sm">
                  <span className="font-medium text-gray-600">Teacher ID:</span>{' '}
                  <span className="text-xs text-gray-500 font-mono">{cls.teacherId}</span>
                </p>
                {cls.description && (
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {cls.description}
                  </p>
                )}
              </div>

              {/* Thông tin thời gian */}
              <div className="text-xs text-gray-500 mb-4">
                <p>Tạo: {formatDate(cls.createdAt)}</p>
                {cls.updatedAt && (
                  <p>Cập nhật: {formatDate(cls.updatedAt)}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t">
                {/* Nút xem học sinh */}
                <button
                  onClick={() => navigate(`/classList/${cls.id}/students`)}
                  className="px-3 py-1 text-xs rounded-md font-medium bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors"
                >
                  👥 Học sinh ({cls.totalStudents})
                </button>
                
                {/* Nút toggle trạng thái */}
                <button
                  onClick={() => toggleClassStatus(cls.id, cls.isActive)}
                  className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                    cls.isActive
                      ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                      : 'bg-green-100 text-green-800 hover:bg-green-200'
                  }`}
                >
                  {cls.isActive ? '⏸️ Tạm dừng' : '▶️ Kích hoạt'}
                </button>
                
                {/* Nút xóa */}
                <button
                  onClick={() => deleteClass(cls.id, cls.className)}
                  className="px-3 py-1 text-xs rounded-md font-medium bg-red-100 text-red-800 hover:bg-red-200 transition-colors"
                >
                  🗑️ Xóa
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