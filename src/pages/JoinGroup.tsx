/**
 * 加入组页面
 * 用户可以创建新桌或加入已有桌
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, LogIn, Copy, Check } from 'lucide-react';
import { useGroupStore } from '@/store/groupStore';
import { generateQRCodeDataURL, generateJoinLink } from '@/utils/qrcode';
import { useI18n } from '@/i18n';
import { LanguageToggle } from '@/components/LanguageToggle';

export const JoinGroup: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useI18n();
  const { 
    createGroup, 
    joinGroup, 
    currentUser, 
    currentGroup, 
    loadGroup
  } = useGroupStore();

  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [name, setName] = useState('');
  const [groupId, setGroupId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdGroupId, setCreatedGroupId] = useState<string | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [linkCopied, setLinkCopied] = useState(false);

  // 检查URL参数（扫码打开）
  useEffect(() => {
    const urlGroupId = searchParams.get('groupId');
    if (urlGroupId) {
      setMode('join');
      setGroupId(urlGroupId.toUpperCase());
      // 清除可能存在的旧状态，防止干扰
      setError('');
      setCreatedGroupId(null);
      setQrCodeUrl('');
    }
  }, [searchParams]);

  // 如果已有身份，自动跳转到组页面
  useEffect(() => {
    // 如果URL中有groupId参数，说明是通过链接打开的，不自动跳转
    const urlGroupId = searchParams.get('groupId');
    if (urlGroupId) {
      return;
    }
    
    // 如果正在显示二维码弹窗，不自动跳转
    if (createdGroupId || sessionStorage.getItem('showing_qr_code') === 'true') {
      return;
    }
    
    const userId = localStorage.getItem('ordered_user_id');
    const groupId = localStorage.getItem('ordered_group_id');
    
    if (userId && groupId) {
      // 如果 store 中还没有数据，尝试加载
      if (!currentGroup) {
        loadGroup(groupId)
          .then(() => {
            // 再次检查是否有URL参数或正在显示二维码
            const hasUrlGroupId = searchParams.get('groupId');
            if (!hasUrlGroupId && !createdGroupId && sessionStorage.getItem('showing_qr_code') !== 'true') {
              navigate('/group');
            }
          })
          .catch(() => {
            // 如果加载失败，清除无效的 ID
            localStorage.removeItem('ordered_user_id');
            localStorage.removeItem('ordered_group_id');
          });
      } else {
        // 如果已经有数据，再次检查是否有URL参数或正在显示二维码
        const hasUrlGroupId = searchParams.get('groupId');
        if (!hasUrlGroupId && !createdGroupId && sessionStorage.getItem('showing_qr_code') !== 'true') {
          navigate('/group');
        }
      }
    }
  }, [currentUser, currentGroup, loadGroup, navigate, createdGroupId, searchParams]);


  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError(t('join.needName'));
      return;
    }

    setLoading(true);
    setError('');

    try {
      // 先设置标记，防止自动跳转
      sessionStorage.setItem('showing_qr_code', 'true');
      
      const { group } = await createGroup(name.trim());
      
      // 设置状态，触发弹窗显示
      setCreatedGroupId(group.id);
      
      // 生成二维码（异步，不阻塞）
      generateQRCodeDataURL(generateJoinLink(group.id))
        .then((qrCode) => {
          setQrCodeUrl(qrCode);
        })
        .catch((qrError) => {
          console.error('二维码生成失败:', qrError);
          // 不设置错误，只是不显示二维码，用户仍可以使用链接
        });
      
      // 不立即跳转，显示二维码
      // navigate('/group');
    } catch (err) {
      setError((err as Error).message);
      setCreatedGroupId(null);
      setQrCodeUrl('');
      sessionStorage.removeItem('showing_qr_code');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (!createdGroupId) return;
    const joinLink = generateJoinLink(createdGroupId);
    await navigator.clipboard.writeText(joinLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleContinueToGroup = () => {
    // 清除标记，允许正常跳转
    sessionStorage.removeItem('showing_qr_code');
    navigate('/group');
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError(t('join.needName'));
      return;
    }

    if (!groupId.trim()) {
      setError(t('join.needGroupId'));
      return;
    }

    setLoading(true);
    setError('');

    try {
      await joinGroup(groupId.trim().toUpperCase(), name.trim());
      navigate('/group');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo区域 */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3">
            <h1 className="text-4xl font-bold text-primary-700 mb-2">Ordered</h1>
            <div className="mb-2">
              <LanguageToggle
                className="px-3 py-2 rounded-lg bg-white text-gray-800 border border-gray-200 hover:bg-gray-50 text-sm font-medium flex items-center gap-2"
              />
            </div>
          </div>
          <p className="text-gray-600">{t('join.tagline')}</p>
        </div>

        {/* 主卡片 */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* 模式切换 */}
          <div className="flex border-b">
            <button
              onClick={() => setMode('create')}
              className={`flex-1 py-4 font-medium transition-colors ${
                mode === 'create'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Plus size={20} className="inline mr-2" />
              {t('join.createTab')}
            </button>
            <button
              onClick={() => setMode('join')}
              className={`flex-1 py-4 font-medium transition-colors ${
                mode === 'join'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              <LogIn size={20} className="inline mr-2" />
              {t('join.joinTab')}
            </button>
          </div>

          {/* 表单区域 */}
          <div className="p-6">
            {mode === 'create' ? (
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('join.nameLabel')}
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('join.namePlaceholderCreate')}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    {t('join.ownerHint')}
                  </p>
                </div>

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-lg"
                >
                  {loading ? t('join.creating') : t('join.createAndStart')}
                </button>
              </form>
            ) : (
              <form onSubmit={handleJoin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('join.groupIdLabel')}
                  </label>
                  <input
                    type="text"
                    value={groupId}
                    onChange={(e) => setGroupId(e.target.value.toUpperCase())}
                    placeholder={t('join.groupIdPlaceholder')}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono text-lg"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('join.nameLabel')}
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('join.namePlaceholderJoin')}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  />
                </div>

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-lg"
                >
                  {loading ? t('join.joining') : t('join.joinAndStart')}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* 底部说明 */}
        <div className="mt-6 text-center text-sm text-gray-600">
          <p>{t('join.footer')}</p>
        </div>
      </div>

      {/* 创建成功后的二维码弹窗 */}
      {createdGroupId && (
        <div 
          data-testid="qr-modal"
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          style={{ zIndex: 9999 }}
          ref={(el) => {
            if (el) {
            }
          }}
          onClick={() => {
            // 点击背景不关闭（可选：如果需要点击背景关闭，可以取消注释）
            // const e = event;
            // if (e.target === e.currentTarget) {
            //   setCreatedGroupId(null);
            //   setQrCodeUrl('');
            // }
          }}
        >
          <div 
            className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 调试信息 */}
            {process.env.NODE_ENV === 'development' && (
              <div className="mb-2 text-xs text-gray-400">
                {t('join.debug')}: createdGroupId={createdGroupId ? 'OK' : 'NG'}, qrCodeUrl={qrCodeUrl ? `OK(${qrCodeUrl.length})` : 'NG'}
              </div>
            )}
            <h3 className="text-xl font-bold text-gray-900 mb-4 text-center">
              {t('join.createdTitle')}
            </h3>
            <p className="text-sm text-gray-600 mb-2 text-center">
              {t('join.tableNo')}
              <span className="font-mono font-bold text-primary-600">{createdGroupId}</span>
            </p>
            <p className="text-sm text-gray-600 mb-4 text-center">
              {t('join.createdSubtitle')}
            </p>
            
            {/* 二维码 - 强制渲染版本 */}
            <div className="flex justify-center mb-4">
              <div className="w-64 h-64 border-4 border-gray-200 rounded-lg bg-white relative">
                {qrCodeUrl ? (
                  <>
                    {/* 使用背景图 */}
                    <div
                      className="absolute inset-0"
                      style={{
                        backgroundImage: `url(${qrCodeUrl})`,
                        backgroundSize: 'contain',
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'center'
                      }}
                    />
                    {/* 同时使用img标签 */}
                    <img 
                      src={qrCodeUrl} 
                      alt="Join QR Code" 
                      className="absolute inset-0 w-full h-full object-contain"
                      style={{ 
                        display: 'block',
                        zIndex: 1
                      }}
                      onError={(e) => {
                        console.error('二维码图片加载失败', e);
                      }}
                    />
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <p className="text-gray-500 text-sm text-center px-4">
                      {t('join.qrGenerating')}
                      <br />
                      {t('join.qrFallback')}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* 链接分享 */}
            <div className="mb-4">
              <div className="flex items-center space-x-2 bg-gray-50 rounded-lg p-3">
                <input
                  type="text"
                  value={generateJoinLink(createdGroupId)}
                  readOnly
                  className="flex-1 bg-transparent text-sm text-gray-700 truncate"
                />
                <button
                  onClick={handleCopyLink}
                  className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                  title={t('join.copyLink')}
                >
                  {linkCopied ? (
                    <Check size={18} className="text-green-600" />
                  ) : (
                    <Copy size={18} className="text-gray-600" />
                  )}
                </button>
              </div>
            </div>

            {/* 按钮 */}
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setCreatedGroupId(null);
                  setQrCodeUrl('');
                  sessionStorage.removeItem('showing_qr_code');
                }}
                className="flex-1 py-2 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                {t('common.back')}
              </button>
              <button
                onClick={handleContinueToGroup}
                className="flex-1 py-2 px-4 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                {t('join.enterOrder')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
