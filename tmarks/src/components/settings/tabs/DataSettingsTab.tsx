/**
 * 数据设置标签页
 * 简化版本：导入导出、存储管理、AI设置
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Database, Download, Camera, Trash2, Bot, ChevronDown, ChevronUp } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { ExportSection } from '@/components/import-export/ExportSection'
// 注意：批量导入功能已移至浏览器扩展（Tab）中实现
// import { ImportSection } from '@/components/import-export/ImportSection'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { BOOKMARKS_QUERY_KEY } from '@/hooks/useBookmarks'
import { useToastStore } from '@/stores/toastStore'
import { useAuthStore } from '@/stores/authStore'
import { useR2StorageQuota } from '@/hooks/useStorage'
import { AiSettingsTab } from './AiSettingsTab'
import { SettingsSection, SettingsDivider } from '../SettingsSection'
import type { ExportFormat, ExportOptions } from '@shared/import-export-types'

export function DataSettingsTab() {
  const { t } = useTranslation('settings')
  const queryClient = useQueryClient()
  const { addToast } = useToastStore()
  const { accessToken } = useAuthStore()
  const { data: r2Quota, isLoading: isLoadingR2Quota } = useR2StorageQuota()
  // 移除导入标签页，只保留导出
  // const [activeTab, setActiveTab] = useState<'export' | 'import'>('export')
  const [isCleaningSnapshots, setIsCleaningSnapshots] = useState(false)
  const [showCleanupConfirm, setShowCleanupConfirm] = useState(false)
  const [showAiSettings, setShowAiSettings] = useState(false)

  const handleExportComplete = (format: ExportFormat, options: ExportOptions) => {
    const details = `${format.toUpperCase()}${options.include_tags ? ' + tags' : ''}${options.include_metadata ? ' + metadata' : ''}`
    addToast('success', t('data.exportSuccess', { details }))
  }

  // 移除导入完成处理函数
  // const handleImportComplete = (result: ImportResult) => { ... }

  const handleCleanupAllSnapshots = async () => {
    setShowCleanupConfirm(true)
  }

  const confirmCleanupAllSnapshots = async () => {
    setShowCleanupConfirm(false)
    setIsCleaningSnapshots(true)
    try {
      const response = await fetch('/api/v1/bookmarks?page=1&page_size=1000', {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      })

      if (!response.ok) throw new Error(t('data.fetchBookmarksFailed'))

      const data = await response.json()
      const bookmarks = data.data?.bookmarks || []
      let totalCleaned = 0

      for (const bookmark of bookmarks) {
        if (bookmark.snapshot_count > 0) {
          try {
            const cleanupResponse = await fetch(`/api/v1/bookmarks/${bookmark.id}/snapshots/cleanup`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ verify_and_fix: true }),
            })
            if (cleanupResponse.ok) {
              const result = await cleanupResponse.json()
              totalCleaned += result.data?.deleted_count || 0
            }
          } catch (error) {
            console.error(`Clean snapshot failed for bookmark ${bookmark.id}:`, error)
          }
        }
      }

      if (totalCleaned > 0) {
        addToast('success', t('data.cleanSnapshotsSuccess', { count: totalCleaned }))
        queryClient.invalidateQueries({ queryKey: [BOOKMARKS_QUERY_KEY] })
      } else {
        addToast('info', t('data.cleanSnapshotsNone'))
      }
    } catch (error) {
      console.error('Clean snapshots failed:', error)
      addToast('error', t('data.cleanSnapshotsFailed'))
    } finally {
      setIsCleaningSnapshots(false)
    }
  }

  return (
    <div className="space-y-6">
      <ConfirmDialog
        isOpen={showCleanupConfirm}
        title={t('data.cleanSnapshotsConfirmTitle')}
        message={t('data.cleanSnapshotsConfirmMessage')}
        type="warning"
        onConfirm={confirmCleanupAllSnapshots}
        onCancel={() => setShowCleanupConfirm(false)}
      />

      {/* 存储用量 */}
      <SettingsSection icon={Database} title={t('data.r2Storage.title')} description={t('data.r2Storage.description')}>
        <div className="p-4 rounded-lg bg-card border border-border">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t('data.r2Storage.currentUsage')}</span>
            <span className="text-sm font-medium">
              {isLoadingR2Quota || !r2Quota ? (
                t('data.loading')
              ) : (
                <>
                  {(r2Quota.used_bytes / (1024 * 1024 * 1024)).toFixed(2)} GB
                  {' / '}
                  {r2Quota.unlimited || r2Quota.limit_bytes === null
                    ? t('data.r2Storage.unlimited')
                    : `${(r2Quota.limit_bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`}
                </>
              )}
            </span>
          </div>
          {r2Quota && !r2Quota.unlimited && r2Quota.limit_bytes && (
            <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${Math.min((r2Quota.used_bytes / r2Quota.limit_bytes) * 100, 100)}%` }}
              />
            </div>
          )}
        </div>
      </SettingsSection>

      <SettingsDivider />

      {/* 导入导出 */}
      <SettingsSection icon={Download} title={t('data.importExport.title')} description={t('data.importExport.description')}>
        <div className="space-y-4">
          <div className="p-4 rounded-lg border border-border bg-card">
            <ExportSection onExport={handleExportComplete} />
            {/* 导入功能提示 */}
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-xs sm:text-sm text-blue-700 dark:text-blue-300">
                💡 批量导入功能已移至浏览器扩展中实现，请使用扩展的 Options 页面进行批量导入操作
              </p>
            </div>
          </div>
        </div>
      </SettingsSection>

      <SettingsDivider />

      {/* 快照清理 */}
      <SettingsSection icon={Camera} title={t('data.snapshotManagement.title')} description={t('data.snapshotManagement.description')}>
        <div className="p-4 rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Trash2 className="w-5 h-5 text-warning" />
              <div>
                <div className="text-sm font-medium">{t('data.snapshotManagement.cleanOrphan')}</div>
                <div className="text-xs text-muted-foreground">{t('data.cleanSnapshots.tip1')}</div>
              </div>
            </div>
            <button
              onClick={handleCleanupAllSnapshots}
              disabled={isCleaningSnapshots}
              className="btn btn-warning btn-sm"
            >
              {isCleaningSnapshots ? t('data.snapshotManagement.cleaning') : t('data.snapshotManagement.cleanButton')}
            </button>
          </div>
        </div>
      </SettingsSection>

      <SettingsDivider />

      {/* AI 设置 - 可折叠 */}
      <div className="space-y-4">
        <button
          onClick={() => setShowAiSettings(!showAiSettings)}
          className="w-full flex items-center justify-between p-4 rounded-lg bg-card border border-border hover:border-primary/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Bot className="w-5 h-5 text-primary" />
            </div>
            <div className="text-left">
              <h3 className="text-sm font-semibold text-foreground">{t('data.aiSettings.title')}</h3>
              <p className="text-xs text-muted-foreground">{t('data.aiSettings.description')}</p>
            </div>
          </div>
          {showAiSettings ? (
            <ChevronUp className="w-5 h-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-5 h-5 text-muted-foreground" />
          )}
        </button>

        {showAiSettings && (
          <div className="p-4 rounded-lg border border-border bg-card">
            <AiSettingsTab />
          </div>
        )}
      </div>
    </div>
  )
}
