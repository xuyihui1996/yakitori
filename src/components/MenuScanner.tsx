/**
 * 菜单扫描组件
 * 允许用户拍照或上传菜单图片，自动识别菜品和价格
 */

import React, { useState, useRef } from 'react';
import { Camera, Upload, X, Check, AlertCircle, Loader2, Edit2 } from 'lucide-react';
import { formatMoney } from '@/utils/money';

export interface ScannedMenuItem {
  name: string;
  price?: number;
  rawText: string;
  confidence?: number;
  needsReview: boolean;
  selected: boolean;
  editing?: boolean;
}

interface MenuScannerProps {
  onConfirm: (items: Array<{ name: string; price: number; note?: string }>) => Promise<void>;
  onCancel: () => void;
}

export const MenuScanner: React.FC<MenuScannerProps> = ({ onConfirm, onCancel }) => {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scannedItems, setScannedItems] = useState<ScannedMenuItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // 处理文件选择
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 检查文件大小（最大 10MB）
    if (file.size > 10 * 1024 * 1024) {
      setError('图片文件太大，请选择小于 10MB 的图片');
      return;
    }

    // 检查文件类型
    if (!file.type.startsWith('image/')) {
      setError('请选择图片文件');
      return;
    }

    setImageFile(file);
    setError(null);
    
    // 生成预览
    const reader = new FileReader();
    reader.onload = (event) => {
      setImagePreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // 执行扫描
  const handleScan = async () => {
    if (!imageFile) return;

    setScanning(true);
    setError(null);

    try {
      // 将图片转为 base64
      const formData = new FormData();
      formData.append('image', imageFile);

      // 调用 API
      const response = await fetch('/api/parse-menu', {
        method: 'POST',
        body: formData,
      });

      // 先克隆响应，避免 body stream already read 错误
      const responseClone = response.clone();
      
      if (!response.ok) {
        // 尝试解析错误响应
        let errorMessage = '识别失败';
        try {
          const errorData = await responseClone.json();
          errorMessage = errorData.message || errorData.error || '识别失败';
        } catch (e) {
          // 如果响应不是 JSON，尝试读取文本
          try {
            const errorText = await response.text();
            errorMessage = errorText || `HTTP ${response.status}: ${response.statusText}`;
          } catch (textError) {
            errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          }
        }
        throw new Error(errorMessage);
      }

      // 解析成功的响应
      const result = await response.json();
      
      // 处理结果
      const items: ScannedMenuItem[] = result.items.map((item: any) => ({
        name: item.name,
        price: item.price,
        rawText: item.rawText,
        confidence: item.confidence,
        needsReview: item.needsReview,
        selected: !item.needsReview, // 自动选中高置信度的项
        editing: false,
      }));

      setScannedItems(items);

      if (items.length === 0) {
        setError('未识别到菜品，请尝试重新拍照或手动添加');
      }
    } catch (err) {
      console.error('Scan error:', err);
      setError(err instanceof Error ? err.message : '识别失败，请重试');
    } finally {
      setScanning(false);
    }
  };

  // 切换选中状态
  const toggleItemSelection = (index: number) => {
    const newItems = [...scannedItems];
    newItems[index].selected = !newItems[index].selected;
    setScannedItems(newItems);
  };

  // 编辑菜品
  const startEditingItem = (index: number) => {
    const newItems = [...scannedItems];
    newItems[index].editing = true;
    setScannedItems(newItems);
  };

  // 保存编辑
  const saveItemEdit = (index: number, name: string, price: string) => {
    const newItems = [...scannedItems];
    newItems[index].name = name.trim();
    newItems[index].price = parseFloat(price) || undefined;
    newItems[index].editing = false;
    newItems[index].needsReview = false;
    setScannedItems(newItems);
  };

  // 确认添加
  const handleConfirmItems = async () => {
    const selectedItems = scannedItems.filter(item => item.selected && item.price);
    
    if (selectedItems.length === 0) {
      setError('请至少选择一个有价格的菜品');
      return;
    }

    setSubmitting(true);
    try {
      await onConfirm(
        selectedItems.map(item => ({
          name: item.name,
          price: item.price!,
          note: item.needsReview ? '(扫描识别)' : undefined,
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : '添加失败');
    } finally {
      setSubmitting(false);
    }
  };

  // 重置
  const handleReset = () => {
    setImageFile(null);
    setImagePreview(null);
    setScannedItems([]);
    setError(null);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* 头部 */}
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="text-lg font-semibold text-gray-800">扫描菜单</h3>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* 步骤 1: 上传图片 */}
          {!imagePreview && (
            <div className="space-y-4">
              <div className="flex gap-3">
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex-1 py-8 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors flex flex-col items-center space-y-2"
                >
                  <Camera size={32} className="text-primary-600" />
                  <span className="text-sm text-gray-700 font-medium">拍照</span>
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 py-8 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors flex flex-col items-center space-y-2"
                >
                  <Upload size={32} className="text-primary-600" />
                  <span className="text-sm text-gray-700 font-medium">上传图片</span>
                </button>
              </div>
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                className="hidden"
              />

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <strong>提示：</strong>为了更好的识别效果，请确保：
                </p>
                <ul className="text-sm text-blue-700 mt-2 space-y-1 ml-4 list-disc">
                  <li>菜单图片清晰、光线充足</li>
                  <li>菜品名称和价格都在画面内</li>
                  <li>尽量避免倾斜和遮挡</li>
                  <li>如果菜单很长，可以分多次拍摄</li>
                </ul>
              </div>
            </div>
          )}

          {/* 步骤 2: 图片预览和扫描 */}
          {imagePreview && scannedItems.length === 0 && (
            <div className="space-y-4">
              <div className="relative">
                <img
                  src={imagePreview}
                  alt="菜单预览"
                  className="w-full max-h-96 object-contain rounded-lg border"
                />
                <button
                  onClick={handleReset}
                  className="absolute top-2 right-2 p-2 bg-white/90 hover:bg-white rounded-lg shadow-md transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start space-x-2">
                  <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              <button
                onClick={handleScan}
                disabled={scanning}
                className="w-full py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {scanning ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    <span>识别中...</span>
                  </>
                ) : (
                  <>
                    <Camera size={20} />
                    <span>开始识别</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* 步骤 3: 识别结果 */}
          {scannedItems.length > 0 && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="font-medium text-gray-800">
                  识别结果 ({scannedItems.filter(i => i.selected).length}/{scannedItems.length})
                </h4>
                <button
                  onClick={handleReset}
                  className="text-sm text-primary-600 hover:text-primary-700"
                >
                  重新扫描
                </button>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start space-x-2">
                  <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {scannedItems.map((item, index) => (
                  <div
                    key={index}
                    className={`border rounded-lg p-3 transition-colors ${
                      item.selected ? 'border-primary-500 bg-primary-50' : 'border-gray-300'
                    } ${item.needsReview ? 'border-orange-300' : ''}`}
                  >
                    {item.editing ? (
                      <EditItemForm
                        item={item}
                        onSave={(name, price) => saveItemEdit(index, name, price)}
                        onCancel={() => {
                          const newItems = [...scannedItems];
                          newItems[index].editing = false;
                          setScannedItems(newItems);
                        }}
                      />
                    ) : (
                      <div className="flex items-start space-x-3">
                        <input
                          type="checkbox"
                          checked={item.selected}
                          onChange={() => toggleItemSelection(index)}
                          className="mt-1 w-5 h-5 text-primary-600 rounded"
                        />
                        <div className="flex-1">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h5 className="font-medium text-gray-900">{item.name}</h5>
                              {item.price ? (
                                <p className="text-primary-600 font-semibold mt-1">
                                  {formatMoney(item.price)}
                                </p>
                              ) : (
                                <p className="text-red-600 text-sm mt-1">未识别到价格</p>
                              )}
                              {item.needsReview && (
                                <p className="text-xs text-orange-600 mt-1 flex items-center space-x-1">
                                  <AlertCircle size={12} />
                                  <span>建议确认</span>
                                </p>
                              )}
                            </div>
                            <button
                              onClick={() => startEditingItem(index)}
                              className="p-2 hover:bg-gray-100 rounded transition-colors"
                              title="编辑"
                            >
                              <Edit2 size={16} className="text-gray-600" />
                            </button>
                          </div>
                          <p className="text-xs text-gray-500 mt-2">原文: {item.rawText}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 底部操作按钮 */}
        {scannedItems.length > 0 && (
          <div className="border-t p-4 space-y-3">
            <button
              onClick={handleConfirmItems}
              disabled={submitting || scannedItems.filter(i => i.selected && i.price).length === 0}
              className="w-full py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {submitting ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  <span>添加中...</span>
                </>
              ) : (
                <>
                  <Check size={20} />
                  <span>
                    确认添加 ({scannedItems.filter(i => i.selected && i.price).length} 项)
                  </span>
                </>
              )}
            </button>
            <button
              onClick={onCancel}
              className="w-full py-2 text-gray-600 hover:text-gray-800"
            >
              取消
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// 编辑表单子组件
const EditItemForm: React.FC<{
  item: ScannedMenuItem;
  onSave: (name: string, price: string) => void;
  onCancel: () => void;
}> = ({ item, onSave, onCancel }) => {
  const [name, setName] = useState(item.name);
  const [price, setPrice] = useState(item.price?.toString() || '');

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">菜品名称</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">价格 (¥)</label>
        <input
          type="number"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          step="0.01"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>
      <div className="flex space-x-2">
        <button
          onClick={() => onSave(name, price)}
          className="flex-1 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
        >
          保存
        </button>
        <button
          onClick={onCancel}
          className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
        >
          取消
        </button>
      </div>
    </div>
  );
};

