/**
 * NewTab 增量同步 - Pull API
 * 拉取自指定时间后的所有变更
 */

import type { PagesFunction } from '@cloudflare/workers-types'
import type { Env, RouteParams } from '../../../../lib/types'
import { success, badRequest, internalError } from '../../../../lib/response'
import { requireApiKeyAuth, ApiKeyAuthContext } from '../../../../middleware/api-key-auth-pages'
import type { SyncPullResponse, Operation } from '../../../../shared/newtab-sync-types'

// ============================================
// GET /api/tab/newtab/pull?since=<timestamp>&device_id=<id>
// 拉取增量变更
// ============================================
export const onRequestGet: PagesFunction<Env, RouteParams, ApiKeyAuthContext>[] = [
  requireApiKeyAuth('bookmarks.read'),
  async (context) => {
    const userId = context.data.user_id
    const url = new URL(context.request.url)
    
    const since = parseInt(url.searchParams.get('since') || '0')
    const deviceId = url.searchParams.get('device_id')
    const limit = parseInt(url.searchParams.get('limit') || '100')

    if (!deviceId) {
      return badRequest('Missing device_id parameter')
    }

    try {
      // 1. 获取操作日志（排除当前设备的操作）
      const { results: operations } = await context.env.DB.prepare(
        `SELECT id, operation_type, target_type, target_id, data, timestamp, device_id
         FROM newtab_operations
         WHERE user_id = ? AND timestamp > ? AND device_id != ?
         ORDER BY timestamp ASC
         LIMIT ?`
      ).bind(userId, since, deviceId, limit).all<{
        id: string
        operation_type: string
        target_type: string
        target_id: string
        data: string | null
        timestamp: number
        device_id: string
      }>()

      // 2. 转换操作数据
      const ops: Operation[] = (operations || []).map(op => ({
        id: op.id,
        operation_type: op.operation_type as any,
        target_type: op.target_type as any,
        target_id: op.target_id,
        data: op.data ? JSON.parse(op.data) : undefined,
        timestamp: op.timestamp,
        device_id: op.device_id
      }))

      // 3. 获取已删除的ID列表
      const deletedOps = ops.filter(op => op.operation_type === 'delete')
      const deletedIds = deletedOps.map(op => op.target_id)

      // 4. 检查是否还有更多数据
      const hasMore = operations.length === limit
      const latestTimestamp = operations.length > 0 
        ? operations[operations.length - 1]!.timestamp 
        : since

      const response: SyncPullResponse = {
        operations: ops,
        deleted_ids: deletedIds,
        has_more: hasMore,
        latest_timestamp: latestTimestamp
      }

      return success(response)
    } catch (error) {
      console.error('Sync pull error:', error)
      return internalError('Failed to pull sync data')
    }
  }
]
