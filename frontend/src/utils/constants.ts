/**
 * Application-wide constants.
 *
 * This module contains constants used throughout the application.
 */

/**
 * Thinking messages displayed while the tutor is processing.
 */
export const THINKING_MESSAGES: readonly string[] = [
  '正在分析你的问题，就像黑客分析目标系统一样...',
  '思考中... 顺便提醒，密码123456真的不安全哦 😄',
  '让我想想... 你知道为什么程序员喜欢用咖啡吗？因为Java需要咖啡因！',
  '正在处理你的问题... 就像防火墙过滤恶意流量一样仔细',
  '思考中... 网络安全就像洋葱，有很多层防护 🧅',
  '让我组织一下思路... 就像整理防火墙规则一样有条理',
  '正在分析... 你知道最安全的密码是什么吗？\'我不知道\' 😂',
  '思考中... 网络安全专家的一天：发现漏洞，修复漏洞，发现新漏洞...',
  '让我想想... 为什么黑客总是穿黑色？因为这样看起来更专业！',
  '正在处理... 就像加密算法一样，需要时间来保证质量',
  '思考中... 你知道什么是网络安全吗？就是让坏人进不来，好人出得去',
  '让我分析一下... 就像渗透测试一样，需要从多个角度思考',
  '正在思考... 网络安全就像保险，你希望永远用不到，但必须要有',
  '让我组织语言... 就像编写安全代码一样，每个细节都很重要',
  '思考中... 为什么网络安全专家总是很忙？因为坏人从不休息！',
  '正在分析... 就像漏洞扫描一样，需要全面而仔细',
  '让我想想... 你知道最好的安全策略是什么吗？就是假设你已经被攻击了',
  '思考中... 网络安全就像下棋，需要提前想好几步',
  '正在处理... 就像安全审计一样，需要耐心和细致',
  '让我思考一下... 为什么程序员喜欢用Linux？因为Windows太容易被黑了 😄',
] as const;

/**
 * Gets a random thinking message.
 *
 * @returns A random thinking message string
 */
export function getRandomThinkingMessage(): string {
  return THINKING_MESSAGES[
    Math.floor(Math.random() * THINKING_MESSAGES.length)
  ];
}




