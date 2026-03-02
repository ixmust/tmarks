import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { tabGroupsService } from '@/services/tab-groups'
import type { TabGroup, TabGroupItem } from '@/lib/types'
import { useToastStore } from '@/stores/toastStore'
import { formatDistanceToNow } from 'date-fns'
import { zhCN, enUS } from 'date-fns/locale'
import { logger } from '@/lib/logger'

interface UseTabGroupActionsProps {
  setTabGroups: React.Dispatch<React.SetStateAction<TabGroup[]>>
  setDeletingId: React.Dispatch<React.SetStateAction<string | null>>
  setConfirmDialog: React.Dispatch<React.SetStateAction<{
    isOpen: boolean
    title: string
    message: string
    onConfirm: () => void
  }>>
  confirmDialog: {
    isOpen: boolean
    title: string
    message: string
    onConfirm: () => void
  }
}

export function useTabGroupActions({
  setTabGroups,
  setDeletingId,
  setConfirmDialog,
  confirmDialog,
}: UseTabGroupActionsProps) {
  const { t, i18n } = useTranslation('tabGroups')
  const { success, error: showError } = useToastStore()
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [editingGroupTitle, setEditingGroupTitle] = useState('')

  const dateLocale = i18n.language === 'zh-CN' ? zhCN : enUS

  const formatDate = (dateStr: string) => {
    try {
      return formatDistanceToNow(new Date(dateStr), {
        addSuffix: true,
        locale: dateLocale,
      })
    } catch {
      return dateStr
    }
  }

  const handleDelete = (id: string, title: string) => {
    setConfirmDialog({
      isOpen: true,
      title: t('confirm.deleteGroup'),
      message: t('confirm.deleteGroupMessage', { title }),
      onConfirm: async () => {
        setConfirmDialog({ ...confirmDialog, isOpen: false })
        setDeletingId(id)
        try {
          await tabGroupsService.deleteTabGroup(id)
          setTabGroups((prev) => prev.filter((g) => g.id !== id))
          success(t('message.movedToTrash'))
        } catch (err) {
          logger.error('Failed to delete tab group:', err)
          showError(t('message.deleteFailed'))
        } finally {
          setDeletingId(null)
        }
      },
    })
  }

  const handleOpenAll = (items: TabGroupItem[]) => {
    if (!items || items.length === 0) {
      showError(t('message.noTabsToOpen'))
      return
    }

    const itemCount = items.length

    // 提示用户
    const message =
      itemCount > 10
        ? t('confirm.openTabsWarning', { count: itemCount })
        : t('confirm.openTabsMessage', { mode: t('openMode.newWindow'), count: itemCount })

    setConfirmDialog({
      isOpen: true,
      title: t('confirm.openMultipleTabs'),
      message,
      onConfirm: () => {
        setConfirmDialog({ ...confirmDialog, isOpen: false })

        // 直接打开所有标签
        items.forEach((item, index) => {
          setTimeout(() => {
            window.open(item.url, '_blank', 'noopener,noreferrer')
          }, index * 20) // 20ms 间隔
        })

        // 显示成功消息
        success(t('message.openingTabs', { count: itemCount }))
      },
    })
  }

  const handleExportMarkdown = (group: TabGroup) => {
    const items = group.items || []
    let markdown = `# ${group.title}\n\n`
    markdown += `${t('export.createdTime')}: ${formatDate(group.created_at)}\n`
    markdown += `${t('export.tabCount')}: ${items.length}\n\n`

    if (group.tags && group.tags.length > 0) {
      markdown += `${t('export.tags')}: ${group.tags.join(', ')}\n\n`
    }

    markdown += `---\n\n`

    items.forEach((item, index) => {
      markdown += `${index + 1}. [${item.title}](${item.url})\n`
      if (item.is_pinned) markdown += `   - 📌 ${t('item.pinned')}\n`
      if (item.is_todo) markdown += `   - ✅ ${t('item.todo')}\n`
      markdown += '\n'
    })

    const blob = new Blob([markdown], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${group.title}-${Date.now()}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    success(t('message.exportSuccess'))
  }

  const handleEditGroup = (group: TabGroup) => {
    setEditingGroupId(group.id)
    setEditingGroupTitle(group.title)
  }

  const handleSaveGroupEdit = async (groupId: string) => {
    if (!editingGroupTitle.trim()) {
      showError(t('message.titleRequired'))
      return
    }

    try {
      await tabGroupsService.updateTabGroup(groupId, { title: editingGroupTitle })
      setTabGroups((prev) =>
        prev.map((g) => (g.id === groupId ? { ...g, title: editingGroupTitle } : g))
      )
      setEditingGroupId(null)
      setEditingGroupTitle('')
      success(t('message.renameSuccess'))
    } catch (err) {
      logger.error('Failed to update group title:', err)
      showError(t('message.renameFailed'))
    }
  }

  const handleEditItem = (item: TabGroupItem) => {
    setEditingItemId(item.id)
    setEditingTitle(item.title)
  }

  const handleSaveEdit = async (groupId: string, itemId: string) => {
    if (!editingTitle.trim()) {
      showError(t('message.titleRequired'))
      return
    }

    try {
      await tabGroupsService.updateTabGroupItem(itemId, { title: editingTitle })
      setTabGroups((prev) =>
        prev.map((group) =>
          group.id === groupId
            ? {
              ...group,
              items: group.items?.map((item) =>
                item.id === itemId ? { ...item, title: editingTitle } : item
              ),
            }
            : group
        )
      )
      setEditingItemId(null)
      setEditingTitle('')
      success(t('message.editSuccess'))
    } catch (err) {
      logger.error('Failed to update item:', err)
      showError(t('message.editFailed'))
    }
  }

  const handleTogglePin = async (groupId: string, itemId: string, currentPinned: boolean) => {
    const newPinned = !currentPinned
    try {
      await tabGroupsService.updateTabGroupItem(itemId, { is_pinned: newPinned })
      setTabGroups((prev) =>
        prev.map((group) =>
          group.id === groupId
            ? {
              ...group,
              items: group.items?.map((item) =>
                item.id === itemId ? { ...item, is_pinned: newPinned } : item
              ),
            }
            : group
        )
      )
      success(newPinned ? t('message.pinSuccess') : t('message.unpinSuccess'))
    } catch (err) {
      logger.error('Failed to toggle pin:', err)
      showError(t('message.operationFailed'))
    }
  }

  const handleToggleTodo = async (groupId: string, itemId: string, currentTodo: boolean) => {
    const newTodo = !currentTodo
    try {
      await tabGroupsService.updateTabGroupItem(itemId, { is_todo: newTodo })
      setTabGroups((prev) =>
        prev.map((group) =>
          group.id === groupId
            ? {
              ...group,
              items: group.items?.map((item) =>
                item.id === itemId ? { ...item, is_todo: newTodo } : item
              ),
            }
            : group
        )
      )
      success(newTodo ? t('message.todoSuccess') : t('message.untodoSuccess'))
    } catch (err) {
      logger.error('Failed to toggle todo:', err)
      showError(t('message.operationFailed'))
    }
  }

  const handleDeleteItem = (groupId: string, itemId: string, title: string) => {
    setConfirmDialog({
      isOpen: true,
      title: t('confirm.deleteItem'),
      message: t('confirm.deleteItemMessage', { title }),
      onConfirm: async () => {
        setConfirmDialog({ ...confirmDialog, isOpen: false })
        try {
          await tabGroupsService.deleteTabGroupItem(itemId)
          setTabGroups((prev) =>
            prev.map((group) =>
              group.id === groupId
                ? {
                  ...group,
                  items: group.items?.filter((item) => item.id !== itemId),
                  item_count: (group.item_count || 0) - 1,
                }
                : group
            )
          )
          success(t('message.deleteSuccess'))
        } catch (err) {
          logger.error('Failed to delete item:', err)
          showError(t('message.deleteFailed'))
        }
      },
    })
  }

  return {
    editingItemId,
    setEditingItemId,
    editingTitle,
    setEditingTitle,
    editingGroupId,
    setEditingGroupId,
    editingGroupTitle,
    setEditingGroupTitle,
    formatDate,
    handleDelete,
    handleOpenAll,
    handleExportMarkdown,
    handleEditGroup,
    handleSaveGroupEdit,
    handleEditItem,
    handleSaveEdit,
    handleTogglePin,
    handleToggleTodo,
    handleDeleteItem,
  }
}

