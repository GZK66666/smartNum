-- ============================================================
-- SmartNum V3.1 数据库初始化脚本
-- 数据库：MySQL 8.0+
-- 字符集：utf8mb4
-- ============================================================

-- 禁用外键检查
SET FOREIGN_KEY_CHECKS = 0;

-- 创建数据库
CREATE DATABASE IF NOT EXISTS smartnum
DEFAULT CHARACTER SET utf8mb4
DEFAULT COLLATE utf8mb4_unicode_ci;

USE smartnum;

-- 删除现有表（禁用外键检查后）
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS datasources;
DROP TABLE IF EXISTS users;

-- 恢复外键检查
SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- 用户表
-- ============================================================
DROP TABLE IF EXISTS users;
CREATE TABLE users (
    id VARCHAR(36) PRIMARY KEY COMMENT '用户 ID (UUID)',
    username VARCHAR(50) NOT NULL UNIQUE COMMENT '用户名',
    password_hash VARCHAR(255) NOT NULL COMMENT '密码哈希 (bcrypt)',
    email VARCHAR(100) COMMENT '邮箱',
    status TINYINT DEFAULT 1 COMMENT '状态：1-正常 0-禁用',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_username (username),
    INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

-- ============================================================
-- 数据源表
-- ============================================================
DROP TABLE IF EXISTS datasources;
CREATE TABLE datasources (
    id VARCHAR(36) PRIMARY KEY COMMENT '数据源 ID (UUID)',
    user_id VARCHAR(36) NOT NULL COMMENT '所属用户 ID',
    name VARCHAR(100) NOT NULL COMMENT '数据源名称',
    type VARCHAR(20) NOT NULL COMMENT '数据库类型：mysql/postgresql/sqlite',
    host VARCHAR(255) NOT NULL COMMENT '主机地址',
    port INT NOT NULL COMMENT '端口',
    database_name VARCHAR(100) NOT NULL COMMENT '数据库名',
    db_username VARCHAR(100) NOT NULL COMMENT '数据库用户名',
    db_password VARCHAR(255) NOT NULL COMMENT '数据库密码',
    schema_name VARCHAR(100) COMMENT 'Schema 名称 (PostgreSQL)',
    status TINYINT DEFAULT 1 COMMENT '状态：1-正常 0-禁用',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_user_id (user_id),
    INDEX idx_name (name),
    CONSTRAINT fk_datasources_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='数据源配置表';

-- ============================================================
-- 会话表（V3.1 增强版）
-- ============================================================
DROP TABLE IF EXISTS sessions;
CREATE TABLE sessions (
    id VARCHAR(36) PRIMARY KEY COMMENT '会话 ID (UUID)',
    user_id VARCHAR(36) NOT NULL COMMENT '所属用户 ID',
    datasource_id VARCHAR(36) NOT NULL COMMENT '关联数据源 ID',
    title VARCHAR(200) COMMENT '会话标题',
    message_count INT DEFAULT 0 COMMENT '消息数量（缓存）',
    is_archived TINYINT DEFAULT 0 COMMENT '是否归档：1-是 0-否',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    last_active_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '最后活跃时间',
    INDEX idx_user_id (user_id),
    INDEX idx_datasource_id (datasource_id),
    INDEX idx_last_active (last_active_at),
    INDEX idx_sessions_list (user_id, is_archived, last_active_at DESC),
    CONSTRAINT fk_sessions_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_sessions_datasource
        FOREIGN KEY (datasource_id) REFERENCES datasources(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='会话表';

-- ============================================================
-- 消息表
-- ============================================================
DROP TABLE IF EXISTS messages;
CREATE TABLE messages (
    id VARCHAR(36) PRIMARY KEY COMMENT '消息 ID (UUID)',
    session_id VARCHAR(36) NOT NULL COMMENT '关联会话 ID',
    role VARCHAR(10) NOT NULL COMMENT '角色：user/assistant',
    content TEXT NOT NULL COMMENT '消息内容',
    `sql` TEXT COMMENT '生成的 SQL 语句',
    result LONGTEXT COMMENT '查询结果 (JSON)',
    result_truncated TINYINT DEFAULT 0 COMMENT '结果是否截断：1-是 0-否',
    agent_steps LONGTEXT COMMENT '智能体执行步骤 (JSON)',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX idx_session_id (session_id),
    INDEX idx_role (role),
    INDEX idx_created_at (created_at),
    CONSTRAINT fk_messages_session
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='消息表';

-- ============================================================
-- 触发器：更新会话最后活跃时间 & 消息计数
-- ============================================================
DROP TRIGGER IF EXISTS trg_update_session_active;
DELIMITER $$
CREATE TRIGGER trg_update_session_active
AFTER INSERT ON messages
FOR EACH ROW
BEGIN
    UPDATE sessions
    SET last_active_at = NEW.created_at,
        message_count = message_count + 1
    WHERE id = NEW.session_id;
END$$
DELIMITER ;

-- ============================================================
-- 视图：会话消息统计
-- ============================================================
DROP VIEW IF EXISTS v_session_stats;
CREATE VIEW v_session_stats AS
SELECT
    s.id AS session_id,
    s.user_id,
    s.datasource_id,
    s.title,
    s.created_at,
    s.last_active_at,
    s.message_count,
    s.is_archived,
    COUNT(m.id) AS actual_message_count,
    MAX(m.created_at) AS last_message_at
FROM sessions s
LEFT JOIN messages m ON s.id = m.session_id
GROUP BY s.id, s.user_id, s.datasource_id, s.title, s.created_at, s.last_active_at, s.message_count, s.is_archived;

-- ============================================================
-- 存储过程：清理过期会话
-- ============================================================
DROP PROCEDURE IF EXISTS sp_cleanup_old_sessions;
DELIMITER $$
CREATE PROCEDURE sp_cleanup_old_sessions(IN days_to_keep INT)
BEGIN
    DECLARE cutoff_date DATETIME;
    SET cutoff_date = DATE_SUB(NOW(), INTERVAL days_to_keep DAY);

    DELETE FROM sessions
    WHERE last_active_at < cutoff_date;

    SELECT ROW_COUNT() AS deleted_count;
END$$
DELIMITER ;

-- ============================================================
-- 完成提示
-- ============================================================
SELECT 'SmartNum V3.1 数据库初始化完成！' AS status;
