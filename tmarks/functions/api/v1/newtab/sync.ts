/**
 * NewTab 同步 API
 * 支持批量导入书签到后端
 */

import type { PagesFunction } from '@cloudflare/workers-types'
import type { Env, AuthContext } from '../../../lib/types'
import { requireAuth } from '../../../middleware/auth'

interface SyncBookmark {
  url: string
  title: string
  description?: string
  folder?: string
  browser_bookmark_id?: string
}

interface SyncRequest {
  bookmarks: SyncBookmark[]
  device_id: string
  folders?: Array<{
    id: string
    name: string
    position: number
  }>
}

interface SyncResult {
  success: number
  failed: number
  skipped: number
  total: number
  created_groups: string[]
  created_shortcuts: string[]
  errors: Array<{
    url: string
    error: string
  }>
}

/**
 * POST /api/v1/newtab/sync - 同步 NewTab 书签到后端
 */
export const onRequestPost: PagesFunction<Env, string, AuthContext>[] = [
  requireAuth,
  async (context) => {
    try {
      const userId = context.data.user_id
      const db = context.env.DB

      const { bookmarks, device_id, folders = [] } = await context.request.json() as SyncRequest

      if (!bookmarks || !Array.isArray(bookmarks)) {
        return new Response(
          JSON.stringify({ error: 'Invalid request: bookmarks array required' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
      }

      const result: SyncResult = {
        success: 0,
        failed: 0,
        skipped: 0,
        total: bookmarks.length,
        created_groups: [],
        created_shortcuts: [],
        errors: []
      }

      const now = Date.now()
      const deviceId = device_id || 'unknown'

      // 1. 创建或更新文件夹/分组
      const folderMap = new Map<string, string>() // folder name -> group id

      for (const folder of folders) {
        try {
          // 检查分组是否已存在
          const existing = await db.prepare(
            'SELECT id FROM newtab_groups_v2 WHERE user_id = ? AND name = ? AND deleted_at IS NULL'
          ).bind(userId, folder.name).first<{ id: string }>()

          if (existing) {
            folderMap.set(folder.name, existing.id)
          } else {
            // 创建新分组
            const groupId = crypto.randomUUID()
            await db.prepare(`
              INSERT INTO newtab_groups_v2 (
                id, user_id, name, position, created_at, updated_at, device_id, version
              ) VALUES (?, ?, ?, ?, ?, ?, ?, 1)
            `).bind(
              groupId,
              userId,
              folder.name,
              folder.position,
              now,
              now,
              deviceId
            ).run()

            folderMap.set(folder.name, groupId)
            result.created_groups.push(groupId)
          }
        } catch (error) {
          console.error(`Failed to create folder: ${folder.name}`, error)
        }
      }

      // 2. 批量导入书签
      for (const bookmark of bookmarks) {
        try {
          // 检查 URL 是否已存在
          const existing = await db.prepare(
            'SELECT id FROM newtab_shortcuts_v2 WHERE user_id = ? AND url = ? AND deleted_at IS NULL'
          ).bind(userId, bookmark.url).first<{ id: string }>()

          if (existing) {
            result.skipped++
            continue
          }

          // 确定分组ID
          let groupId: string | null = null
          if (bookmark.folder && folderMap.has(bookmark.folder)) {
            groupId = folderMap.get(bookmark.folder)!
          }

          // 创建快捷方式
          const shortcutId = crypto.randomUUID()
          await db.prepare(`
            INSERT INTO newtab_shortcuts_v2 (
              id, user_id, group_id, title, url, position,
              created_at, updated_at, device_id, version
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
          `).bind(
            shortcutId,
            userId,
            groupId,
            bookmark.title,
            bookmark.url,
            result.success, // 使用成功计数作为位置
            now,
            now,
            deviceId
          ).run()

          result.created_shortcuts.push(shortcutId)
          result.success++

        } catch (error) {
          result.failed++
          result.errors.push({
            url: bookmark.url,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }

      // 3. 更新同步状态
      await db.prepare(`
        INSERT INTO newtab_sync_state (user_id, device_id, last_sync_at, sync_version)
        VALUES (?, ?, ?, 1)
        ON CONFLICT(user_id, device_id) 
        DO UPDATE SET last_sync_at = ?, sync_version = sync_version + 1
      `).bind(userId, deviceId, now, now).run()

      return new Response(
        JSON.stringify(result),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )

    } catch (error) {
      console.error('NewTab sync error:', error)
      return new Response(
        JSON.stringify({
          error: 'Sync failed',
          message: error instanceof Error ? error.message : 'Unknown error'
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }
]
