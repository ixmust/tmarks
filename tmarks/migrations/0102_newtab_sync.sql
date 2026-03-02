-- NewTab 增量同步数据表
-- 支持离线优先 + 操作日志同步

-- ============================================
-- 1. 快捷方式表（增强版，支持软删除和版本控制）
-- ============================================
CREATE TABLE IF NOT EXISTS newtab_shortcuts_v2 (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  group_id TEXT,
  
  -- 核心数据
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  
  -- 扩展数据
  favicon_url TEXT,
  click_count INTEGER DEFAULT 0,
  
  -- 同步元数据
  created_at INTEGER NOT NULL,           -- 创建时间戳（毫秒）
  updated_at INTEGER NOT NULL,           -- 最后更新时间戳
  deleted_at INTEGER,                    -- 删除时间戳（软删除）
  device_id TEXT NOT NULL,               -- 最后修改设备ID
  version INTEGER DEFAULT 1,             -- 版本号（用于冲突检测）
  
  -- 索引
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_newtab_shortcuts_v2_user ON newtab_shortcuts_v2(user_id);
CREATE INDEX IF NOT EXISTS idx_newtab_shortcuts_v2_deleted ON newtab_shortcuts_v2(deleted_at);
CREATE INDEX IF NOT EXISTS idx_newtab_shortcuts_v2_updated ON newtab_shortcuts_v2(user_id, updated_at);

-- ============================================
-- 2. 分组表（增强版）
-- ============================================
CREATE TABLE IF NOT EXISTS newtab_groups_v2 (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  
  -- 核心数据
  name TEXT NOT NULL,
  icon TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  
  -- 浏览器书签关联
  bookmark_folder_id TEXT,               -- 对应的浏览器书签文件夹ID
  
  -- 同步元数据
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  device_id TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_newtab_groups_v2_user ON newtab_groups_v2(user_id);
CREATE INDEX IF NOT EXISTS idx_newtab_groups_v2_deleted ON newtab_groups_v2(deleted_at);
CREATE INDEX IF NOT EXISTS idx_newtab_groups_v2_updated ON newtab_groups_v2(user_id, updated_at);

-- ============================================
-- 3. 网格项表（新版统一数据结构）
-- ============================================
CREATE TABLE IF NOT EXISTS newtab_grid_items (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  
  -- 类型和位置
  type TEXT NOT NULL,                    -- shortcut/bookmarkFolder/weather/clock/todo/notes等
  size TEXT NOT NULL DEFAULT '1x1',      -- 1x1/2x1/1x2/2x2等
  position INTEGER NOT NULL DEFAULT 0,
  group_id TEXT,                         -- 所属分组
  parent_id TEXT,                        -- 父级ID（用于文件夹嵌套）
  
  -- 浏览器书签关联
  browser_bookmark_id TEXT,              -- 浏览器书签ID
  
  -- 快捷方式数据（JSON）
  shortcut_data TEXT,                    -- {"url":"","title":"","favicon":""}
  
  -- 书签文件夹数据（JSON）
  folder_data TEXT,                      -- {"title":""}
  
  -- 组件配置（JSON）
  widget_config TEXT,                    -- 组件配置数据
  
  -- 同步元数据
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  device_id TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_newtab_grid_items_user ON newtab_grid_items(user_id);
CREATE INDEX IF NOT EXISTS idx_newtab_grid_items_group ON newtab_grid_items(group_id);
CREATE INDEX IF NOT EXISTS idx_newtab_grid_items_deleted ON newtab_grid_items(deleted_at);
CREATE INDEX IF NOT EXISTS idx_newtab_grid_items_updated ON newtab_grid_items(user_id, updated_at);

-- ============================================
-- 4. 操作日志表（用于增量同步）
-- ============================================
CREATE TABLE IF NOT EXISTS newtab_operations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  
  -- 操作信息
  operation_type TEXT NOT NULL,          -- create/update/delete
  target_type TEXT NOT NULL,             -- shortcut/group/gridItem
  target_id TEXT NOT NULL,               -- 目标对象ID
  
  -- 操作数据（JSON）
  data TEXT,                             -- 操作相关数据
  
  -- 元数据
  timestamp INTEGER NOT NULL,            -- 操作时间戳
  device_id TEXT NOT NULL,               -- 操作设备ID
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_newtab_operations_user_time ON newtab_operations(user_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_newtab_operations_target ON newtab_operations(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_newtab_operations_device ON newtab_operations(user_id, device_id, timestamp);

-- ============================================
-- 5. 同步状态表（记录每个设备的同步位置）
-- ============================================
CREATE TABLE IF NOT EXISTS newtab_sync_state (
  user_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  
  -- 同步状态
  last_sync_at INTEGER NOT NULL,        -- 最后同步时间
  last_operation_id TEXT,                -- 最后同步的操作ID
  sync_version INTEGER DEFAULT 1,        -- 同步版本号
  
  PRIMARY KEY (user_id, device_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_newtab_sync_state_user ON newtab_sync_state(user_id);

-- ============================================
-- 6. 数据迁移（从旧表迁移到新表）
-- ============================================

-- 迁移分组数据
INSERT OR IGNORE INTO newtab_groups_v2 (
  id, user_id, name, icon, position,
  created_at, updated_at, deleted_at, device_id, version
)
SELECT 
  id,
  user_id,
  name,
  COALESCE(icon, ''),
  COALESCE(position, 0),
  CAST(strftime('%s', created_at) * 1000 AS INTEGER),
  CAST(strftime('%s', updated_at) * 1000 AS INTEGER),
  NULL,
  'migration',
  1
FROM newtab_groups
WHERE EXISTS (SELECT 1 FROM newtab_groups);

-- 迁移快捷方式数据
INSERT OR IGNORE INTO newtab_shortcuts_v2 (
  id, user_id, group_id, title, url, position,
  favicon_url, click_count,
  created_at, updated_at, deleted_at, device_id, version
)
SELECT 
  id,
  user_id,
  group_id,
  title,
  url,
  COALESCE(position, 0),
  favicon,
  0,
  CAST(strftime('%s', created_at) * 1000 AS INTEGER),
  CAST(strftime('%s', updated_at) * 1000 AS INTEGER),
  NULL,
  'migration',
  1
FROM newtab_shortcuts
WHERE EXISTS (SELECT 1 FROM newtab_shortcuts);

-- ============================================
-- 7. 清理策略（定期执行）
-- ============================================

-- 清理30天前的软删除数据（通过应用层定期调用）
-- DELETE FROM newtab_shortcuts_v2 
-- WHERE deleted_at IS NOT NULL 
--   AND deleted_at < (strftime('%s', 'now') - 2592000) * 1000;

-- 清理7天前的操作日志（通过应用层定期调用）
-- DELETE FROM newtab_operations 
-- WHERE timestamp < (strftime('%s', 'now') - 604800) * 1000;
