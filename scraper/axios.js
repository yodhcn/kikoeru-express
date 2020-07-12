const originAxios = require('axios');
const { httpsOverHttp, httpOverHttp } = require('tunnel-agent');
const { config } = require('../config');

const axios = originAxios.create();

// 使用 http 代理
axios.interceptors.request.use(function (axiosConfig) {
  // 代理设置
  const tunnelOptions = {
    proxy: {
      port: config.httpProxyPort || null,
      host: config.httpProxyHost || null
    }
  };

  if (tunnelOptions.proxy.port) {
    axiosConfig.proxy = false; // 强制禁用环境变量中的代理配置
    axiosConfig.httpAgent = httpOverHttp(tunnelOptions);
    axiosConfig.httpsAgent = httpsOverHttp(tunnelOptions);
  }
  
  return axiosConfig;
});

const retryGet = async (url, axiosConfig) => {
  const defaultLimit = config.retry || 5;
  const defaultRetryDelay = config.retryDelay || 2000;
  let defaultTimeout = 10000; 
  if (url.indexOf('dlsite') !== -1) {
    defaultTimeout = config.dlsiteTimeout || defaultTimeout;
  } else if (url.indexOf('hvdb') !== -1) {
    defaultTimeout = config.hvdbTimeout || defaultTimeout;
  }

  // 添加自定义的 retry 参数
  axiosConfig.retry = {
    limit: (axiosConfig.retry && axiosConfig.retry.limit) || defaultLimit,
    retryCount: (axiosConfig.retry && axiosConfig.retry.retryCount) || 0,
    retryDelay: (axiosConfig.retry && axiosConfig.retry.retryDelay) || defaultRetryDelay,
    timeout: (axiosConfig.retry && axiosConfig.retry.timeout) || defaultTimeout
  };

  // 超时自动取消请求
  const abort = originAxios.CancelToken.source();
  const timeoutId = setTimeout(
    () => abort.cancel(`Timeout of ${axiosConfig.retry.timeout}ms.`),
    axiosConfig.retry.timeout
  );
  axiosConfig.cancelToken = abort.token;

  try {
    const res = await axios.get(url, axiosConfig);
    clearTimeout(timeoutId);

    return res;
  } catch (err) {
    // 重试延时
    const backoff = new Promise((resolve) => {
      setTimeout(() => resolve(), axiosConfig.retry.retryDelay);
    });

    // 错误重试
    if (axiosConfig.retry.retryCount < axiosConfig.retry.limit && !err.response) {
      axiosConfig.retry.retryCount += 1;
      await backoff;
      console.log(`${url} 第 ${axiosConfig.retry.retryCount} 次重试请求`);

      return retryGet(url, axiosConfig);
    } else {
      throw err;
    }
  }
};

axios.retryGet = retryGet;


module.exports = axios;
