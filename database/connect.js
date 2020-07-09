const path = require('path');
const { sqliteFolderDir } = require('../config');

// knex 操作数据库
const knex = require('knex')({
  client: 'sqlite3', // 数据库类型
  useNullAsDefault: true,
  connection: { // 连接参数
    filename: path.join(sqliteFolderDir, 'db.sqlite3'),
  },
  pool: {
    // 激活外键检查 (sqlite3 默认关闭外键限制)
    afterCreate: (conn, cb) => conn.run('PRAGMA foreign_keys = ON', cb)
  },
  acquireConnectionTimeout: 5000, // 连接计时器
});

module.exports = knex;