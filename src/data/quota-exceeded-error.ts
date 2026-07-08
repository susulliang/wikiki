// EXPORTS: IQuotaExceededState, MOCK_QUOTA_EXCEEDED_STATE
export interface IQuotaExceededState {
  /** 是否发生配额超限 */
  occurred: boolean
  /** 触发配额超限的操作类型 */
  operation: 'save' | 'import' | 'image-upload'
  /** 用户提示消息 */
  message: string
  /** 建议操作 */
  suggestion: string
}

export const MOCK_QUOTA_EXCEEDED_STATE: IQuotaExceededState = {
  occurred: true,
  operation: 'save',
  message: '存储空间不足，自动保存失败',
  suggestion: '已自动移除部分图片以释放空间，请清理不必要的内容后重试',
}