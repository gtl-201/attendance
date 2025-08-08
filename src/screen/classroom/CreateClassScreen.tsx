import React, { useState } from 'react';
import { 
  collection, 
  addDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { auth, db } from '../../firebase'; // Import từ firebase config của bạn

// Interface cho dữ liệu lớp học
interface ClassData {
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

// Interface cho form input
interface CreateClassForm {
  className: string;
  subject: string;
  feePerSession: string;
  description: string;
}

const CreateClass: React.FC<{ user: any }> = ({ user }) => {
  const [formData, setFormData] = useState<CreateClassForm>({
    className: '',
    subject: '',
    feePerSession: '',
    description: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  // Xử lý thay đổi input
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Validate form
  const validateForm = (): boolean => {
    if (!formData.className.trim()) {
      setMessage({type: 'error', text: 'Tên lớp học không được để trống'});
      return false;
    }
    if (!formData.subject.trim()) {
      setMessage({type: 'error', text: 'Môn học không được để trống'});
      return false;
    }
    if (!formData.feePerSession || isNaN(Number(formData.feePerSession)) || Number(formData.feePerSession) <= 0) {
      setMessage({type: 'error', text: 'Học phí phải là số dương'});
      return false;
    }
    return true;
  };

  // Tạo lớp học
  const createClass = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      setMessage({type: 'error', text: 'Bạn cần đăng nhập để tạo lớp học'});
      return;
    }

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      // Dữ liệu lớp học
      const classData: ClassData = {
        className: formData.className.trim(),
        teacherId: user.uid,
        teacherName: user.displayName || user.email || 'Giáo viên',
        subject: formData.subject.trim(),
        feePerSession: Number(formData.feePerSession),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isActive: true,
        totalStudents: 0
      };

      // Chỉ thêm description nếu có nội dung
      if (formData.description.trim()) {
        classData.description = formData.description.trim();
      }

      // Thêm lớp học vào Firestore
      const docRef = await addDoc(collection(db, 'classes'), classData);
      
      setMessage({
        type: 'success', 
        text: `Tạo lớp học thành công! ID: ${docRef.id}`
      });

      // Reset form
      setFormData({
        className: '',
        subject: '',
        feePerSession: '',
        description: ''
      });

    } catch (error) {
      console.error('Lỗi khi tạo lớp học:', error);
      setMessage({
        type: 'error', 
        text: 'Có lỗi xảy ra khi tạo lớp học. Vui lòng thử lại.'
      });
    } finally {
      setLoading(false);
    }
  };

  // Format số tiền VND
  const formatCurrency = (value: string) => {
    const number = value.replace(/[^\d]/g, '');
    return number.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  const handleFeeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    const numericValue = value.replace(/[^\d]/g, '');
    setFormData(prev => ({
      ...prev,
      feePerSession: numericValue
    }));
  };

  if (!user) {
    return (
      <div className="max-w-md mx-auto mt-8 p-6 bg-white rounded-lg shadow-md">
        <p className="text-center text-gray-600">
          Bạn cần đăng nhập để tạo lớp học
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto mt-8 p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold text-center mb-6 text-gray-800">
        Tạo Lớp Học Mới
      </h2>

      {message && (
        <div className={`mb-4 p-4 rounded-md ${
          message.type === 'success' 
            ? 'bg-green-100 text-green-700 border border-green-300' 
            : 'bg-red-100 text-red-700 border border-red-300'
        }`}>
          {message.text}
        </div>
      )}

      <form onSubmit={createClass} className="space-y-4">
        <div>
          <label htmlFor="className" className="block text-sm font-medium text-gray-700 mb-1">
            Tên lớp học *
          </label>
          <input
            type="text"
            id="className"
            name="className"
            value={formData.className}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="VD: Lớp Toán 12 nâng cao"
            required
          />
        </div>

        <div>
          <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-1">
            Môn học *
          </label>
          <input
            type="text"
            id="subject"
            name="subject"
            value={formData.subject}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="VD: Toán học, Vật lý, Hóa học..."
            required
          />
        </div>

        <div>
          <label htmlFor="feePerSession" className="block text-sm font-medium text-gray-700 mb-1">
            Học phí mỗi buổi (VND) *
          </label>
          <input
            type="text"
            id="feePerSession"
            name="feePerSession"
            value={formatCurrency(formData.feePerSession)}
            onChange={handleFeeChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="VD: 500,000"
            required
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
            Mô tả (không bắt buộc)
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Mô tả về lớp học, phương pháp giảng dạy, yêu cầu..."
          />
        </div>

        <div className="bg-gray-50 p-4 rounded-md">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Thông tin giáo viên:</h3>
          <p className="text-sm text-gray-600">
            <strong>Tên:</strong> {user.displayName || user.email}
          </p>
          <p className="text-sm text-gray-600">
            <strong>ID:</strong> {user.uid}
          </p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className={`w-full py-2 px-4 rounded-md font-medium ${
            loading
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 focus:ring-2 focus:ring-blue-500'
          } text-white transition duration-200`}
        >
          {loading ? 'Đang tạo lớp học...' : 'Tạo lớp học'}
        </button>
      </form>
    </div>
  );
};

export default CreateClass;