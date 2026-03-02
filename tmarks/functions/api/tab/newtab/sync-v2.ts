/**
 * NewTab 增量同步 API v2
 * 支持离线优先 + 操作日志同步
 */

import type { PagesFunction } from '@cloudflare/workers-types'
import type { Env, RouteParams } from '../../../../lib/types'
import { success, badRequest, internalError } from '../../../../lib/response'
import { requireApiKeyAuth, ApiKeyAuthContext } from '../../../../middleware/api-key-auth-pages'
import type { 
  SyncPushRequest, 
  SyncPushResponse,
  SyncPullParams,
  SyncPullResponse,
  Operation 
} from '../../../../shared/newtab-sync-types'

// ============================================
// POST /api/tab/newtab/sync-v2/push
// 推送本地操作到服务器
// ============================================
export const onRequestPost: PagesFunction<Env, RouteParams, ApiKeyAuthContext>[] = [
  requireApiKeyAuth('bookmarks.create'),
  async (context) => {
    const userId = context.data.user_id

    try {
      const body = await context.request.json() as SyncPushRequest
      const { device_id, operations, last_sync_at } = body

      if (!device_id || !Array.isArray(operations)) {
        return badRequest('Invalid request body')
      }

      let syncedCount = 0
      const conflicts: Array<{ operation_id: string; reason: string }> = []

      // 处理每个操作
      for (const op of operations) {
        try {
          // 1. 记录操作日志
          await context.env.DB.prepare(
            `INSERT INTO newtab_operations (id, user_id, operation_type, target_type, target_id, data, timestamp, device_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            op.id,
            userId,
            op.operation_type,
            op.target_type,
            op.target_id,
            op.data ? JSON.stringify(op.data) : null,
            op.timestamp,
            device_id
          ).run()

          // 2. 应用操作到数据表
          await applyOperation(context.env.DB, userId, op)
          
          syncedCount++
        } catch (error) {
          console.error('Apply operation error:', error)
          conflicts.push({
            operation_id: op.id,
            reason: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }

      // 3. 更新同步状态
      await context.env.DB.prepare(
        `INSERT INTO newtab_sync_state (user_id, device_id, last_sync_at, sync_version)
         VALUES (?, ?, ?, 1)
         ON CONFLICT(user_id, device_id) 
         DO UPDATE SET last_sync_at = ?, sync_version = sync_version + 1`
      ).bind(userId, device_id, Date.now(), Date.now()).run()

      const response: SyncPushResponse = {
        success: true,
        synced_count: syncedCount,
        conflicts: conflicts.length > 0 ? conflicts : undefined
      }

      return success(response)
    } catch (error) {
      console.error('Sync push error:', error)
      return internalError('Failed to push sync data')
    }
  }
]

// ============================================
// 应用操作到数据表
// ============================================
async function applyOperation(db: D1Database, userId: string, op: Operation) {
  const { operation_type, target_type, target_id, data, timestamp, device_id } = op

  if (target_type === 'gridItem') {
    if (operation_type === 'create') {
      // 创建网格项
      await db.prepare(
        `INSERT OR REPLACE INTO newtab_grid_items 
         (id, user_id, type, size, position, group_id, parent_id, browser_bookmark_id, 
          shortcut_data, folder_data, widget_config, 
          created_at, updated_at, deleted_at, device_id, version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        target_id,
        userId,
        data.type,
        data.size,
        data.position,
        data.group_id || null,
        data.parent_id || null,
        data.browser_bookmark_id || null,
        data.shortcut_data ? JSON.stringify(data.shortcut_data) : null,
        data.folder_data ? JSON.stringify(data.folder_data) : null,
        data.widget_config ? JSON.stringify(data.widget_config) : null,
        data.created_at || timestamp,
        timestamp,
        null,
        device_id,
        data.version || 1
      ).run()
    } else if (operation_type === 'update') {
      // 更新网格项
      await db.prepare(
        `UPDATE newtab_grid_items 
         SET shortcut_data = ?, folder_data = ?, widget_config = ?,
             position = ?, group_id = ?, parent_id = ?,
             updated_at = ?, device_id = ?, version = version + 1
         WHERE id = ? AND user_id = ?`
      ).bind(
        data.shortcut_data ? JSON.stringify(data.shortcut_data) : null,
        data.folder_data ? JSON.stringify(data.folder_data) : null,
        data.widget_config ? JSON.stringify(data.widget_config) : null,
        data.position,
        data.group_id || null,
        data.parent_id || null,
        timestamp,
        device_id,
        target_id,
        userId
      ).run()
    } else if (operation_type === 'delete') {
      // 软删除
      await db.prepare(
        `UPDATE newtab_grid_items 
         SET deleted_at = ?, updated_at = ?, device_id = ?
         WHERE id = ? AND user_id = ?`
      ).bind(timestamp, timestamp, device_id, target_id, userId).run()
    }
  } else if (target_type === 'group') {
    if (operation_type === 'create') {
      await db.prepare(
        `INSERT OR REPLACE INTO newtab_groups_v2 
         (id, user_id, name, icon, position, created_at, updated_at, device_id, version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        target_id, userId, data.name, data.icon || '', data.position,
        data.created_at || timestamp, timestamp, device_id, data.version || 1
      ).run()
    } else if (operation_type === 'update') {
      await db.prepare(
        `UPDATE newtab_groups_v2 
         SET name = ?, icon = ?, position = ?, updated_at = ?, device_id = ?, version = version + 1
         WHERE id = ? AND user_id = ?`
      ).bind(data.name, data.icon || '', data.position, timestamp, device_id, target_id, userId).run()
    } else if (operation_type === 'delete') {
      await db.prepare(
        `UPDATE newtab_groups_v2 
         SET deleted_at = ?, updated_at = ?, device_id = ?
         WHERE id = ? AND user_id = ?`
      ).bind(timestamp, timestamp, device_id, target_id, userId).run()
    }
  }
}
