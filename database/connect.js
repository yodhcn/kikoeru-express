const fs = require('fs');
const path = require('path');

const { getConfig } = require('../config');
const config = getConfig();

const databaseFolderDir = config.databaseFolderDir;
if (!fs.existsSync(databaseFolderDir)) {
  try {
    fs.mkdirSync(databaseFolderDir, { recursive: true });
  } catch(err) {
    console.error(` ! 在创建存放数据库文件的文件夹时出错: ${err.message}`);
  }
}

// knex 操作数据库
const knex = require('knex')({
  client: 'sqlite3', // 数据库类型
  useNullAsDefault: true,
  connection: { // 连接参数
    filename: path.join(databaseFolderDir, 'db.sqlite3'),
  },
  pool: {
    // 激活外键检查 (sqlite3 默认关闭外键限制)
    afterCreate: (conn, cb) => conn.run('PRAGMA foreign_keys = ON', cb)
  },
  acquireConnectionTimeout: 5000, // 连接计时器
});

module.exports = knex;