/**
 * NewTab 增量同步类型定义
 * 用于前端和后端共享
 */

// ============================================
// 操作类型
// ============================================

export type OperationType = 'create' | 'update' | 'delete'
export type TargetType = 'shortcut' | 'group' | 'gridItem'

// ============================================
// 操作日志
// ============================================

export interface Operation {
  id: string
  operation_type: OperationType
  target_type: TargetType
  target_id: string
  data?: any // JSON 数据
  timestamp: number // 毫秒时间戳
  device_id: string
}

// ============================================
// 同步元数据
// ============================================

export interface SyncMeta {
  created_at: number
  updated_at: number
  deleted_at?: number
  device_id: string
  version: number
}

// ============================================
// 快捷方式（服务器端）
// ============================================

export interface ShortcutV2 {
  id: string
  user_id: string
  group_id?: string
  title: string
  url: string
  position: number
  favicon_url?: string
  click_count: number
  // 同步元数据
  created_at: number
  updated_at: number
  deleted_at?: number
  device_id: string
  version: number
}

// ============================================
// 分组（服务器端）
// ============================================

export interface GroupV2 {
  id: string
  user_id: string
  name: string
  icon?: string
  position: number
  bookmark_folder_id?: string
  // 同步元数据
  created_at: number
  updated_at: number
  deleted_at?: number
  device_id: string
  version: number
}

// ============================================
// 网格项（服务器端）
// ============================================

export interface GridItemV2 {
  id: string
  user_id: string
  type: string
  size: string
  position: number
  group_id?: string
  parent_id?: string
  browser_bookmark_id?: string
  shortcut_data?: string // JSON
  folder_data?: string // JSON
  widget_config?: string // JSON
  // 同步元数据
  created_at: number
  updated_at: number
  deleted_at?: number
  device_id: string
  version: number
}

// ============================================
// 同步状态
// ============================================

export interface SyncState {
  user_id: string
  device_id: string
  last_sync_at: number
  last_operation_id?: string
  sync_version: number
}

// ============================================
// API 请求/响应
// ============================================

// Push 请求
export interface SyncPushRequest {
  device_id: string
  operations: Operation[]
  last_sync_at?: number
}

// Push 响应
export interface SyncPushResponse {
  success: boolean
  synced_count: number
  conflicts?: Array<{
    operation_id: string
    reason: string
  }>
}

// Pull 请求参数
export interface SyncPullParams {
  since: number // 时间戳
  device_id: string
  limit?: number
}

// Pull 响应
export interface SyncPullResponse {
  operations: Operation[]
  deleted_ids: string[]
  has_more: boolean
  latest_timestamp: number
}

// 完整同步响应
export interface SyncFullResponse {
  shortcuts: ShortcutV2[]
  groups: GroupV2[]
  grid_items: GridItemV2[]
  sync_state: SyncState
}
