const fs = require('fs');
const path = require('path');
const stringRandom = require('string-random');

const rootDir = process.pkg ? path.join(process.execPath, '..') : __dirname;
const configPath = path.join(rootDir, 'config', 'config.json'); // 配置文件路径
const coverFolderDir = path.join(rootDir, 'covers');
const sqliteFolderDir = path.join(rootDir, 'sqlite');

let config = null;

const defaultConfig = {
  maxParallelism: 16,
  rootFolders: [
    // {
    //   name: '',
    //   path: ''
    // }
  ],
  auth: false,
  md5secret: stringRandom(14),
  jwtsecret: stringRandom(14),
  expiresIn: 2592000,
  maxRecursionDepth: 2,
  pageSize: 12,
  tagLanguage: 'zh-cn',
  retry: 5,
  dlsiteTimeout: 10000,
  hvdbTimeout: 10000,
  retryDelay: 2000,
  httpProxyHost: '',
  httpProxyPort: 0
};

const initConfig = () => fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, "\t"));

const setConfig = newConfig => {
  // 更新 config  
  for(let key in config) {
    if (newConfig[key]) {
      config[key] = newConfig[key];
    }
  }

  // 保存 config
  fs.writeFileSync(configPath, JSON.stringify(config, null, "\t"));
};

const init = () => {
  if (!fs.existsSync(sqliteFolderDir)) {
    try {
      fs.mkdirSync(sqliteFolderDir, { recursive: true });
    } catch (err) {
      throw new Error(`在创建存放数据库文件的文件夹时出错: ${err.message}`);
    }
  }

  if (!fs.existsSync(coverFolderDir)) {
    try {
      fs.mkdirSync(coverFolderDir, { recursive: true });
    } catch (err) {
      throw new Error(`在创建存放音声封面的文件夹时出错: ${err.message}`);
    }
  }

  if (!fs.existsSync(configPath)) {
    const configFolderDir = path.dirname(configPath);
    if (!fs.existsSync(configFolderDir)) {
      try {
        fs.mkdirSync(configFolderDir, { recursive: true });
      } catch (err) {
        throw new Error(`在创建存放配置文件的文件夹时出错: ${err.message}`);
      }
    }

    try {
      initConfig();
    } catch (err) {
      throw new Error(`在初始化配置文件时出错: ${err.message}`);
    } 
  }
  
  if (!config) {
    try {
      config = JSON.parse(fs.readFileSync(configPath));
    } catch (err) {
      throw new Error(`在解析 config.json 时出错: ${err.message}`);
    }
  }
};

try {
  init();
} catch (err) {
  console.error(err);
}


module.exports = {
  coverFolderDir, sqliteFolderDir, config,
  setConfig
};
