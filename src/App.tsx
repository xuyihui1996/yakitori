/**
 * 应用主组件
 * 配置路由和全局布局
 */

import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { JoinGroup } from './pages/JoinGroup';
import { GroupHome } from './pages/GroupHome';
import { MyBill } from './pages/MyBill';
import { MerchantDashboard } from './pages/MerchantDashboard';
import { useGroupStore } from './store/groupStore';
import { getUser } from './api/supabaseService';

function App() {
  const { setCurrentUser, loadGroup } = useGroupStore();

  useEffect(() => {
    // 从localStorage恢复用户和组状态
    const initApp = async () => {
      const currentPath = window.location.pathname;
      const currentSearch = window.location.search;

      // 如果当前在首页
      if (currentPath === '/') {
        // 如果有查询参数（如 ?groupId=xxx），说明是通过链接打开的，不应该自动跳转
        if (currentSearch && currentSearch.includes('groupId=')) {
          return;
        }

        // 如果没有查询参数，检查是否有标记表示正在显示二维码
        const showingQR = sessionStorage.getItem('showing_qr_code');
        if (showingQR === 'true') {
          // 正在显示二维码，不自动跳转
          return;
        }
      }

      const userId = localStorage.getItem('ordered_user_id');
      const groupId = localStorage.getItem('ordered_group_id');

      if (userId) {
        try {
          // 从 Supabase 加载用户信息
          const user = await getUser(userId);
          if (user) {
            setCurrentUser(user);

            // 如果有组ID，加载组信息
            if (groupId) {
              try {
                await loadGroup(groupId);

                // 如果成功加载，自动跳转到组页面（除非已结账且已在组页面）
                // 但如果在首页且有groupId参数，说明是通过链接打开的，不跳转
                if (currentPath === '/' && !currentSearch.includes('groupId=')) {
                  const group = useGroupStore.getState().currentGroup;
                  if (!group?.settled) {
                    window.location.href = '/group';
                  }
                }
              } catch (error) {
                console.error('Failed to load group:', error);
                // 清除无效的组ID
                localStorage.removeItem('ordered_group_id');
              }
            }
          }
        } catch (error) {
          console.error('Failed to load user:', error);
          // 如果用户不存在，清除存储
          localStorage.removeItem('ordered_user_id');
          localStorage.removeItem('ordered_group_id');
        }
      }
    };

    initApp();
  }, [setCurrentUser, loadGroup]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<JoinGroup />} />
        <Route path="/group" element={<GroupHome />} />
        <Route path="/my-bill" element={<MyBill />} />
        <Route path="/merchant" element={<MerchantDashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

