/**
 * 格式化工具函数
 */

/**
 * 格式化日期时间
 * @param dateString ISO日期字符串
 * @returns 格式化后的字符串
 */
export function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours === 0) {
      const minutes = Math.floor(diff / (1000 * 60));
      if (minutes === 0) {
        return '刚刚';
      }
      return `${minutes}分钟前`;
    }
    return `${hours}小时前`;
  }

  if (days < 7) {
    return `${days}天前`;
  }

  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * 格式化简短日期
 * @param dateString ISO日期字符串
 * @returns MM/DD HH:mm
 */
export function formatShortDate(dateString: string): string {
  const date = new Date(dateString);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${month}/${day} ${hours}:${minutes}`;
}

/**
 * 生成短ID
 * @param prefix 前缀
 * @returns 6位随机字符串
 */
export function generateShortId(prefix: string = ''): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 去掉易混淆的字符
  let result = prefix;
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 生成唯一ID
 * @param prefix 前缀
 * @returns 唯一ID
 */
export function generateUniqueId(prefix: string = ''): string {
  return `${prefix}${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 验证桌号格式
 * @param groupId 桌号
 * @returns 是否有效
 */
export function isValidGroupId(groupId: string): boolean {
  return /^G[A-Z0-9]{6}$/.test(groupId);
}

/**
 * 提取轮次显示ID
 * 从格式 {groupId}_R{num} 中提取 Round {num}
 * @param roundId 轮次ID（可能是 G123456_R1 或 R1）
 * @returns 显示用的轮次ID（如 Round 1）
 */
export function getRoundDisplayId(roundId: string): string {
  // 如果是新格式 {groupId}_R{num}，提取数字部分
  const match = roundId.match(/_R(\d+)$/);
  if (match) {
    return `Round ${match[1]}`;
  }
  // 如果已经是 R{num} 格式，提取数字
  const rMatch = roundId.match(/^R(\d+)$/);
  if (rMatch) {
    return `Round ${rMatch[1]}`;
  }
  // 默认返回原值
  return roundId;
}

