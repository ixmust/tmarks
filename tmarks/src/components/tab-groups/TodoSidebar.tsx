import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TabGroup, TabGroupItem } from '@/lib/types'
import { ExternalLink, Trash2, Check, CheckCircle2, Circle, ListTodo, MoreVertical, Edit2, FolderInput, Archive } from 'lucide-react'
import { tabGroupsService } from '@/services/tab-groups'
import { useToastStore } from '@/stores/toastStore'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { formatDistanceToNow } from 'date-fns'
import { zhCN, enUS } from 'date-fns/locale'
import { DropdownMenu } from '@/components/common/DropdownMenu'
import { useIsMobile } from '@/hooks/useMediaQuery'

interface TodoSidebarProps {
  tabGroups: TabGroup[]
  onUpdate: () => void
}

export function TodoSidebar({ tabGroups, onUpdate }: TodoSidebarProps) {
  const { t, i18n } = useTranslation('tabGroups')
  const isMobile = useIsMobile()
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean
    title: string
    message: string
    onConfirm: () => void
  } | null>(null)
  const { success, error: showError } = useToastStore()
  
  const dateLocale = i18n.language === 'zh-CN' ? zhCN : enUS

  // 收集所有TODO项
  const todoItems: Array<{ item: TabGroupItem; groupId: string; groupTitle: string }> = []
  
  tabGroups.forEach((group) => {
    group.items?.forEach((item) => {
      if (item.is_todo) {
        todoItems.push({
          item,
          groupId: group.id,
          groupTitle: group.title,
        })
      }
    })
  })

  // 按创建时间排序（最新的在前）
  const sortedTodos = todoItems.sort((a, b) => 
    new Date(b.item.created_at || 0).getTime() - new Date(a.item.created_at || 0).getTime()
  )

  const handleToggleTodo = async (itemId: string, currentStatus: boolean) => {
    setProcessingId(itemId)
    try {
      await tabGroupsService.updateTabGroupItem(itemId, {
        is_todo: !currentStatus,
      })
      success(currentStatus ? t('todo.todoUnmarked') : t('todo.todoMarked'))
      onUpdate()
    } catch (err) {
      console.error('Failed to toggle todo:', err)
      showError(t('message.operationFailed'))
    } finally {
      setProcessingId(null)
    }
  }

  const handleDelete = async (itemId: string) => {
    setConfirmState({
      isOpen: true,
      title: t('confirm.deleteItem'),
      message: t('confirm.deleteItemMessage', { title: '' }),
      onConfirm: async () => {
        setConfirmState(null)
        setProcessingId(itemId)
        try {
          await tabGroupsService.deleteTabGroupItem(itemId)
          success(t('todo.tabDeleted'))
          onUpdate()
        } catch (err) {
          console.error('Failed to delete item:', err)
          showError(t('message.deleteFailed'))
        } finally {
          setProcessingId(null)
        }
      },
    })
  }

  const handleOpenTab = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const handleOpenInCurrentTab = (url: string) => {
    window.location.href = url
  }

  const handleOpenInIncognito = () => {
    showError(t('todo.incognitoNotSupported'))
  }

  const handleRename = (item: TabGroupItem) => {
    setEditingItemId(item.id)
    setEditingTitle(item.title)
  }

  const handleSaveRename = async (itemId: string) => {
    if (!editingTitle.trim()) {
      showError(t('message.titleRequired'))
      return
    }

    setProcessingId(itemId)
    try {
      await tabGroupsService.updateTabGroupItem(itemId, {
        title: editingTitle.trim(),
      })
      success(t('todo.renameSuccess'))
      setEditingItemId(null)
      setEditingTitle('')
      onUpdate()
    } catch (err) {
      console.error('Failed to rename item:', err)
      showError(t('message.renameFailed'))
    } finally {
      setProcessingId(null)
    }
  }

  const handleMove = async (itemId: string, currentGroupId: string) => {
    const availableGroups = tabGroups.filter(g => g.id !== currentGroupId && !g.is_folder)
    
    if (availableGroups.length === 0) {
      showError(t('todo.noGroupsToMove'))
      return
    }

    const targetGroup = availableGroups[0]
    
    if (!targetGroup) {
      showError(t('todo.noGroupsToMove'))
      return
    }

    setConfirmState({
      isOpen: true,
      title: t('todo.moveTab'),
      message: t('todo.moveTabMessage', { title: targetGroup.title }),
      onConfirm: async () => {
        setConfirmState(null)
        setProcessingId(itemId)
        try {
          await tabGroupsService.moveTabGroupItem(itemId, targetGroup.id)
          success(`${t('message.movedToTrash').replace(t('menu.moveToTrash'), targetGroup.title)}`)
          onUpdate()
        } catch (err) {
          console.error('Failed to move item:', err)
          showError(t('page.moveFailed'))
        } finally {
          setProcessingId(null)
        }
      },
    })
  }

  const handleArchive = async (itemId: string) => {
    setConfirmState({
      isOpen: true,
      title: t('todo.archiveTab'),
      message: t('todo.archiveTabMessage'),
      onConfirm: async () => {
        setConfirmState(null)
        setProcessingId(itemId)
        try {
          await tabGroupsService.updateTabGroupItem(itemId, {
            is_archived: true,
          })
          success(t('todo.tabArchived'))
          onUpdate()
        } catch (err) {
          console.error('Failed to archive item:', err)
          showError(t('message.operationFailed'))
        } finally {
          setProcessingId(null)
        }
      },
    })
  }

  return (
    <div className={`w-full h-full bg-card overflow-y-auto flex flex-col ${isMobile ? '' : 'border-l border-border'}`}>
      {confirmState && (
        <ConfirmDialog
          isOpen={confirmState.isOpen}
          title={confirmState.title}
          message={confirmState.message}
          type="warning"
          onConfirm={confirmState.onConfirm}
          onCancel={() => setConfirmState(null)}
        />
      )}

      {/* 标题栏 */}
      <div className={`p-4 border-b border-border bg-muted sticky top-0 z-10 shadow-md ${isMobile ? 'pt-safe-area-top' : ''}`}>
        <div className="flex items-center gap-2">
          <ListTodo className="w-5 h-5 text-foreground" />
          <h2 className="text-lg font-bold text-foreground">{t('todo.title')}</h2>
        </div>
        <div className="flex items-center gap-4 mt-2">
          <div className="flex items-center gap-1.5">
            <Circle className="w-3 h-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              {sortedTodos.length} {t('todo.title').toLowerCase()}
            </span>
          </div>
        </div>
      </div>

      {/* TODO列表 */}
      <div className={`p-4 space-y-3 ${isMobile ? 'pb-20' : ''}`}>
        {sortedTodos.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <ListTodo className="w-10 h-10 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-sm font-medium">{t('todo.empty')}</p>
            <p className="text-muted-foreground/70 text-xs mt-2">
              {t('todo.emptyTip')}
            </p>
          </div>
        ) : (
          sortedTodos.map(({ item, groupId, groupTitle }) => {
            const relativeTime = item.created_at
              ? formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: dateLocale })
              : ''

            return (
              <div
                key={item.id}
                className="group bg-card rounded-lg p-4 border border-border hover:shadow-md hover:border-primary/30 transition-all duration-200"
              >
                {/* 标题和操作 */}
                <div className="flex items-start gap-3">
                  {/* 复选框 */}
                  <button
                    onClick={() => handleToggleTodo(item.id, item.is_todo || false)}
                    disabled={processingId === item.id}
                    className={`flex-shrink-0 w-6 h-6 rounded border-2 flex items-center justify-center transition-all duration-200 ${
                      processingId === item.id
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:scale-110 hover:border-primary'
                    } ${
                      item.is_todo
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:bg-muted'
                    }`}
                  >
                    {item.is_todo && (
                      <Check className="w-4 h-4 text-primary" />
                    )}
                  </button>

                  {/* 内容 */}
                  <div className="flex-1 min-w-0">
                    {editingItemId === item.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleSaveRename(item.id)
                            } else if (e.key === 'Escape') {
                              setEditingItemId(null)
                              setEditingTitle('')
                            }
                          }}
                          className="input flex-1 text-sm"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveRename(item.id)}
                          className="text-success hover:text-success/80"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setEditingItemId(null)
                            setEditingTitle('')
                          }}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <h3 className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                        {item.title}
                      </h3>
                    )}

                    {/* 来源标签 */}
                    <div className="flex items-center gap-2 mt-2">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full font-medium">
                        <Circle className="w-2 h-2 fill-current" />
                        {groupTitle}
                      </span>
                      {relativeTime && (
                        <span className="text-xs text-muted-foreground/70">
                          {relativeTime}
                        </span>
                      )}
                    </div>

                    {/* URL */}
                    {item.url && (
                      <div className="flex items-center gap-1 mt-2">
                        <ExternalLink className="w-3 h-3 text-muted-foreground/70" />
                        <p className="text-xs text-muted-foreground truncate">
                          {new URL(item.url).hostname}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* 三个点菜单 */}
                  <DropdownMenu
                    trigger={
                      <button className="flex-shrink-0 p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    }
                    items={[
                      {
                        label: t('menu.openInNewWindow'),
                        icon: <ExternalLink className="w-4 h-4" />,
                        onClick: () => handleOpenTab(item.url),
                      },
                      {
                        label: t('menu.openInCurrentWindow'),
                        icon: <ExternalLink className="w-4 h-4" />,
                        onClick: () => handleOpenInCurrentTab(item.url),
                      },
                      {
                        label: t('menu.openInIncognito'),
                        icon: <ExternalLink className="w-4 h-4" />,
                        onClick: () => handleOpenInIncognito(),
                      },
                      {
                        label: t('menu.rename'),
                        icon: <Edit2 className="w-4 h-4" />,
                        onClick: () => handleRename(item),
                      },
                      {
                        label: item.is_todo ? t('todo.cancelTaskMark') : t('todo.markAsCompleted'),
                        icon: <CheckCircle2 className="w-4 h-4" />,
                        onClick: () => handleToggleTodo(item.id, item.is_todo || false),
                      },
                      {
                        label: t('todo.moveToOtherGroup'),
                        icon: <FolderInput className="w-4 h-4" />,
                        onClick: () => handleMove(item.id, groupId),
                      },
                      {
                        label: t('todo.markAsArchived'),
                        icon: <Archive className="w-4 h-4" />,
                        onClick: () => handleArchive(item.id),
                      },
                      {
                        label: t('menu.moveToTrash'),
                        icon: <Trash2 className="w-4 h-4" />,
                        onClick: () => handleDelete(item.id),
                        danger: true,
                      },
                    ]}
                  />
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

