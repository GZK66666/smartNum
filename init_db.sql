-- ============================================================
-- SmartNum V3.0 数据库初始化脚本
-- 数据库：MySQL 8.0+
-- 字符集：utf8mb4
-- ============================================================

-- 创建数据库
CREATE DATABASE IF NOT EXISTS smartnum
DEFAULT CHARACTER SET utf8mb4
DEFAULT COLLATE utf8mb4_unicode_ci;

USE smartnum;

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
-- 会话表
-- ============================================================
DROP TABLE IF EXISTS sessions;
CREATE TABLE sessions (
    id VARCHAR(36) PRIMARY KEY COMMENT '会话 ID (UUID)',
    user_id VARCHAR(36) NOT NULL COMMENT '所属用户 ID',
    datasource_id VARCHAR(36) NOT NULL COMMENT '关联数据源 ID',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    last_active_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '最后活跃时间',
    INDEX idx_user_id (user_id),
    INDEX idx_datasource_id (datasource_id),
    INDEX idx_last_active (last_active_at),
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
    sql TEXT COMMENT '生成的 SQL 语句',
    result LONGTEXT COMMENT '查询结果 (JSON)',
    result_truncated TINYINT DEFAULT 0 COMMENT '结果是否截断：1-是 0-否',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX idx_session_id (session_id),
    INDEX idx_role (role),
    INDEX idx_created_at (created_at),
    CONSTRAINT fk_messages_session
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='消息表';

-- ============================================================
-- 初始化默认用户（可选）
-- 用户名：admin, 密码：admin123 (bcrypt 哈希)
-- ============================================================
-- INSERT INTO users (id, username, password_hash, email)
-- VALUES (
--     'user_0000000000000000000001',
--     'admin',
--     '$2b$12$LQv3c1yqBwlVXqRz.4hUOeZd3F5nY8K.xJvH2mW1pQ6rT8sU9vWx',
--     'admin@example.com'
-- );

-- ============================================================
-- 视图：会话消息统计（可选）
-- ============================================================
DROP VIEW IF EXISTS v_session_stats;
CREATE VIEW v_session_stats AS
SELECT
    s.id AS session_id,
    s.user_id,
    s.datasource_id,
    s.created_at,
    s.last_active_at,
    COUNT(m.id) AS message_count,
    MAX(m.created_at) AS last_message_at
FROM sessions s
LEFT JOIN messages m ON s.id = m.session_id
GROUP BY s.id, s.user_id, s.datasource_id, s.created_at, s.last_active_at;

-- ============================================================
-- 存储过程：清理过期会话（30 天无活动）
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
-- 触发器：更新会话最后活跃时间
-- ============================================================
DROP TRIGGER IF EXISTS trg_update_session_active;
DELIMITER $$
CREATE TRIGGER trg_update_session_active
AFTER INSERT ON messages
FOR EACH ROW
BEGIN
    UPDATE sessions
    SET last_active_at = NEW.created_at
    WHERE id = NEW.session_id;
END$$
DELIMITER ;

-- ============================================================
-- 数据插入示例（测试用）
-- ============================================================
-- 注意：实际使用时请删除以下测试数据

-- ============================================================
-- 完成提示
-- ============================================================
SELECT 'SmartNum V3.0 数据库初始化完成！' AS status;
